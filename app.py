from flask import Flask, request, jsonify, render_template, Response
from claude_client import analyze_syllabus
from file_parser import extract_text_from_file
from datetime import datetime
import db
import json
import re

app = Flask(__name__)
db.init_db()

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/analyze", methods=["POST"])
def analyze():
    syllabus_text = ""

    if "syllabus_file" in request.files and request.files["syllabus_file"].filename != "":
        file = request.files["syllabus_file"]
        try:
            syllabus_text = extract_text_from_file(file)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
    else:
        data = request.get_json(silent=True) or {}
        syllabus_text = data.get("syllabus_text", "")

    if not syllabus_text.strip():
        return jsonify({"error": "No syllabus text or file provided"}), 400

    raw_result = analyze_syllabus(syllabus_text)
    cleaned = re.sub(r"^```json\s*|\s*```$", "", raw_result.strip())

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        return jsonify({"error": "Could not parse response"}), 500

    return jsonify(parsed)


@app.route("/save", methods=["POST"])
def save():
    data = request.get_json(silent=True) or {}
    course_name = data.get("course_name", "").strip()
    result_data = data.get("data")

    if not course_name or not result_data:
        return jsonify({"error": "Missing course name or data"}), 400

    new_id = db.save_syllabus(course_name, json.dumps(result_data))
    return jsonify({"id": new_id, "course_name": course_name})


@app.route("/saved", methods=["GET"])
def saved_list():
    return jsonify(db.list_syllabi())


@app.route("/saved/<int:syllabus_id>", methods=["GET"])
def saved_detail(syllabus_id):
    record = db.get_syllabus(syllabus_id)
    if not record:
        return jsonify({"error": "Not found"}), 404

    record["data"] = json.loads(record["data_json"])
    del record["data_json"]
    return jsonify(record)


@app.route("/saved/<int:syllabus_id>", methods=["DELETE"])
def saved_delete(syllabus_id):
    db.delete_syllabus(syllabus_id)
    return jsonify({"success": True})


@app.route("/export-calendar", methods=["POST"])
def export_calendar():
    data = request.get_json(silent=True) or {}
    deadlines = data.get("deadlines", [])

    if not deadlines:
        return jsonify({"error": "No deadlines to export"}), 400

    ics_content = _build_ics(deadlines)

    return Response(
        ics_content,
        mimetype="text/calendar",
        headers={"Content-Disposition": "attachment; filename=syllabus-deadlines.ics"}
    )
@app.route("/dashboard", methods=["GET"])
def dashboard_data():
    all_syllabi = db.list_syllabi()
    combined_deadlines = []

    for item in all_syllabi:
        record = db.get_syllabus(item["id"])
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

def _build_ics(deadlines):
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Syllabus Translator//EN",
    ]

    for i, deadline in enumerate(deadlines):
        date_str = _parse_date_guess(deadline.get("date", ""))
        if not date_str:
            continue

        lines += [
            "BEGIN:VEVENT",
            f"UID:{i}-{datetime.now().timestamp()}@syllabus-translator",
            f"DTSTART;VALUE=DATE:{date_str}",
            f"SUMMARY:{deadline.get('item', 'Deadline')}",
            "END:VEVENT",
        ]

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines)


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
            parsed = datetime.strptime(date_text, fmt)
            return parsed.strftime("%Y%m%d")
        except ValueError:
            continue

    formats_no_year = ["%B %d", "%b %d"]
    for fmt in formats_no_year:
        try:
            parsed = datetime.strptime(date_text, fmt)
            parsed = parsed.replace(year=current_year)
            return parsed.strftime("%Y%m%d")
        except ValueError:
            continue

    return None


if __name__ == "__main__":
    app.run(debug=True)