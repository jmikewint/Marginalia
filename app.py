from flask import Flask, request, jsonify, render_template, Response, session, redirect
from claude_client import analyze_syllabus
from file_parser import extract_text_from_file
from datetime import datetime
from urllib.parse import quote
from flask_limiter import Limiter, Limit
from flask_limiter.util import get_remote_address
from anthropic import APIError
import db
import json
import re
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY")
db.init_db()


def analyze_rate_key():
    """Key by account, not IP, so a shared campus/office network doesn't share one daily bucket."""
    return f"user:{session['user_id']}" if "user_id" in session else get_remote_address()


limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=[
        Limit(
            "30 per hour",
            error_message="You're sending requests too quickly. Please wait a bit and try again.",
        )
    ],
)


@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({"error": e.description}), 429


def login_required(f):
    """Decorator: blocks access to a route unless someone is logged in."""
    from functools import wraps
    @wraps(f)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Your session has ended. Please log in again."}), 401
        return f(*args, **kwargs)
    return wrapper


@app.route("/")
def home():
    return render_template("index.html")


# ---- Auth routes ----

@app.route("/signup", methods=["POST"])
def signup():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not username or not email or not password:
        return jsonify({"error": "Username, email, and password required"}), 400
    if "@" not in email or "." not in email.split("@")[-1]:
        return jsonify({"error": "Enter a valid email address"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    user_id, conflict = db.create_user(username, email, password)
    if user_id is None:
        message = "That email is already registered" if conflict == "email" else "That username is already taken"
        return jsonify({"error": message}), 400

    session["user_id"] = user_id
    session["username"] = username
    return jsonify({"username": username})


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    user = db.verify_user(username, password)
    if not user:
        return jsonify({"error": "Invalid username or password"}), 401

    session["user_id"] = user["id"]
    session["username"] = user["username"]
    return jsonify({"username": user["username"]})


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"success": True})


@app.route("/me", methods=["GET"])
def me():
    if "user_id" in session:
        return jsonify({"username": session["username"]})
    return jsonify({"username": None})


@app.route("/forgot-password", methods=["POST"])
@limiter.limit(
    "5 per hour",
    error_message="Too many reset requests. Please wait a bit and try again.",
)
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()

    if not email:
        return jsonify({"error": "Enter your email address."}), 400

    user = db.get_user_by_email(email)
    if not user:
        return jsonify({"error": "No account found with that email."}), 404

    token = db.create_password_reset(user["id"])
    # No email service is configured, so the link is handed back directly
    # instead of sent; a real deployment would email it and drop this from
    # the response.
    reset_url = f"{request.host_url}?reset_token={token}"
    return jsonify({
        "reset_url": reset_url,
        "note": "In a real deployment this link would be emailed to you instead of shown here. It expires in 1 hour."
    })


@app.route("/reset-password", methods=["POST"])
@limiter.limit(
    "20 per hour",
    error_message="Too many attempts. Please wait a bit and try again.",
)
def reset_password():
    data = request.get_json(silent=True) or {}
    token = data.get("token", "").strip()
    password = data.get("password", "")

    if not token:
        return jsonify({"error": "Missing reset token."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    user_id = db.get_valid_reset(token)
    if user_id is None:
        return jsonify({"error": "This reset link is invalid or has expired. Request a new one."}), 400

    db.reset_password(user_id, token, password)
    return jsonify({"success": True})


# ---- Main app routes (now require login) ----

@app.route("/extract-text", methods=["POST"])
@login_required
def extract_text():
    """Splits file reading out from /analyze so the client gets a real,
    observable stage boundary (this request completing) instead of having to
    fake a "reading file..." status during a single combined request."""
    if "syllabus_file" not in request.files or request.files["syllabus_file"].filename == "":
        return jsonify({"error": "Please choose a file to upload."}), 400

    file = request.files["syllabus_file"]
    try:
        syllabus_text = extract_text_from_file(file)
    except ValueError as e:
        # file_parser raises this for an unsupported extension; the message
        # is already plain-language, so it's safe to pass through as-is.
        return jsonify({"error": str(e)}), 400
    except Exception:
        # Anything else here is a corrupted/unreadable PDF or DOCX (pypdf and
        # python-docx raise their own library-specific exception types for
        # that), not something the user can act on by name.
        return jsonify({"error": "We couldn't read that file. It may be corrupted or password-protected — try a different file."}), 400

    if not syllabus_text.strip():
        return jsonify({"error": "Please paste your syllabus text or upload a file first."}), 400

    return jsonify({"text": syllabus_text})


@app.route("/analyze", methods=["POST"])
@login_required
@limiter.limit(
    "15 per day",
    key_func=analyze_rate_key,
    override_defaults=False,
    error_message="You've used all 15 syllabus analyses for today. Come back tomorrow for more, or try pasting a shorter excerpt if you just need one section reviewed.",
)
def analyze():
    data = request.get_json(silent=True) or {}
    syllabus_text = data.get("syllabus_text", "")

    if not syllabus_text.strip():
        return jsonify({"error": "Please paste your syllabus text or upload a file first."}), 400

    try:
        raw_result = analyze_syllabus(syllabus_text)
    except APIError:
        return jsonify({"error": "We couldn't reach the analysis service. Please try again in a moment."}), 502

    cleaned = re.sub(r"^```json\s*|\s*```$", "", raw_result.strip())

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        return jsonify({"error": "Something went wrong analyzing that syllabus. Please try again."}), 500

    return jsonify(parsed)


@app.route("/save", methods=["POST"])
@login_required
def save():
    data = request.get_json(silent=True) or {}
    course_name = data.get("course_name", "").strip()
    result_data = data.get("data")
    overwrite_id = data.get("overwrite_id")

    if not course_name or not result_data:
        return jsonify({"error": "There's no syllabus data to save. Try analyzing it again."}), 400

    existing_id = db.find_syllabus_by_name(session["user_id"], course_name)

    # A name collision with something other than the entry the client asked
    # to overwrite is a real conflict; ask before replacing anything.
    if existing_id and existing_id != overwrite_id:
        return jsonify({
            "error": f'You already have a syllabus saved as "{course_name}".',
            "conflict": "duplicate_name",
            "existing_id": existing_id
        }), 400

    if overwrite_id:
        if not db.overwrite_syllabus(session["user_id"], overwrite_id, course_name, json.dumps(result_data)):
            return jsonify({"error": "That saved syllabus no longer exists. Try saving again."}), 404
        return jsonify({"id": overwrite_id, "course_name": course_name})

    new_id = db.save_syllabus(session["user_id"], course_name, json.dumps(result_data))
    return jsonify({"id": new_id, "course_name": course_name})


@app.route("/saved", methods=["GET"])
@login_required
def saved_list():
    syllabi = db.list_syllabi(session["user_id"])
    result = []

    for item in syllabi:
        data = json.loads(item["data_json"])
        flags = data.get("flags", [])
        if any(f.get("severity") == "high" for f in flags):
            flag_severity = "high"
        elif flags:
            flag_severity = "medium"
        else:
            flag_severity = None

        result.append({
            "id": item["id"],
            "course_name": item["course_name"],
            "created_at": item["created_at"],
            "deadline_count": len(data.get("deadlines", [])),
            "flag_severity": flag_severity
        })

    return jsonify(result)


@app.route("/saved/<int:syllabus_id>", methods=["GET"])
@login_required
def saved_detail(syllabus_id):
    record = db.get_syllabus(session["user_id"], syllabus_id)
    if not record:
        return jsonify({"error": "That saved syllabus couldn't be found. It may have been deleted."}), 404

    record["data"] = json.loads(record["data_json"])
    del record["data_json"]
    return jsonify(record)


@app.route("/saved/<int:syllabus_id>", methods=["DELETE"])
@login_required
def saved_delete(syllabus_id):
    db.delete_syllabus(session["user_id"], syllabus_id)
    return jsonify({"success": True})


@app.route("/saved/<int:syllabus_id>", methods=["PATCH"])
@login_required
def saved_rename(syllabus_id):
    data = request.get_json(silent=True) or {}
    course_name = data.get("course_name", "").strip()

    if not course_name:
        return jsonify({"error": "Course name is required"}), 400

    db.rename_syllabus(session["user_id"], syllabus_id, course_name)
    return jsonify({"id": syllabus_id, "course_name": course_name})


@app.route("/dashboard", methods=["GET"])
@login_required
def dashboard_data():
    all_syllabi = db.list_syllabi(session["user_id"])
    combined_deadlines = []

    for item in all_syllabi:
        record = db.get_syllabus(session["user_id"], item["id"])
        data = json.loads(record["data_json"])
        for deadline in data.get("deadlines", []):
            combined_deadlines.append({
                "course": record["course_name"],
                "item": deadline.get("item", ""),
                "date": deadline.get("date", ""),
                "date_sort": _parse_date_guess(deadline.get("date", "")) or "99999999"
            })

    combined_deadlines.sort(key=lambda d: d["date_sort"])

    return jsonify({
        "course_count": len(all_syllabi),
        "deadlines": combined_deadlines
    })


@app.route("/export-calendar", methods=["POST"])
@login_required
def export_calendar():
    data = request.get_json(silent=True) or {}
    deadlines = data.get("deadlines", [])

    if not deadlines:
        return jsonify({"error": "No deadlines to export"}), 400

    ics_content, skipped = _build_ics(deadlines)

    response = Response(
        ics_content,
        mimetype="text/calendar",
        headers={"Content-Disposition": "attachment; filename=syllabus-deadlines.ics"}
    )
    response.headers["X-Skipped-Count"] = str(len(skipped))
    if skipped:
        response.headers["X-Skipped-Items"] = quote(", ".join(skipped))
    return response


def _build_ics(deadlines):
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Marginalia//EN"]
    skipped = []

    for i, deadline in enumerate(deadlines):
        date_str = _parse_date_guess(deadline.get("date", ""))
        if not date_str:
            skipped.append(deadline.get("item") or "Deadline")
            continue

        item = deadline.get("item", "Deadline")
        course = deadline.get("course")
        summary = f"{course}: {item}" if course else item

        lines += [
            "BEGIN:VEVENT",
            f"UID:{i}-{datetime.now().timestamp()}@marginalia",
            f"DTSTART;VALUE=DATE:{date_str}",
            f"SUMMARY:{summary}",
            "END:VEVENT",
        ]

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines), skipped


def _parse_date_guess(date_text):
    date_text = re.sub(r"\s*\(.*?\)", "", date_text)
    date_text = re.sub(r"\s+at\s+.*", "", date_text)
    date_text = date_text.strip().rstrip(".,")

    if not date_text or date_text.lower() in ("tbd", "n/a"):
        return None

    current_year = datetime.now().year

    formats_with_year = ["%B %d, %Y", "%B %d %Y", "%b %d, %Y", "%b %d %Y"]
    for fmt in formats_with_year:
        try:
            return datetime.strptime(date_text, fmt).strftime("%Y%m%d")
        except ValueError:
            continue

    formats_no_year = ["%B %d", "%b %d"]
    for fmt in formats_no_year:
        try:
            parsed = datetime.strptime(date_text, fmt).replace(year=current_year)
            return parsed.strftime("%Y%m%d")
        except ValueError:
            continue

    return None


if __name__ == "__main__":
    app.run(debug=True)