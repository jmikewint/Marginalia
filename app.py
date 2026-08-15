from flask import Flask, request, jsonify, render_template, Response
from claude_client import analyze_syllabus
from file_parser import extract_text_from_file
from datetime import datetime
import json
import re

app = Flask(__name__)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/analyze", methods=["POST"])
def analyze():
    syllabus_text = ""

    # Check if a file was uploaded
    if "syllabus_file" in request.files and request.files["syllabus_file"].filename != "":
        file = request.files["syllabus_file"]
        try:
            syllabus_text = extract_text_from_file(file)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
    else:
        # Fall back to pasted text
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
    date_text = re.sub(r"\s*\(.*?\)", "", date_text)       # strip things like "(tentative)"
    date_text = re.sub(r"\s+at\s+.*", "", date_text)        # strip "at 11:55pm"
    date_text = date_text.strip().rstrip(".,")

    if not date_text or date_text.lower() in ("tbd", "n/a"):
        return None

    current_year = datetime.now().year

    # Try parsing as-is first (in case a year is already present)
    formats_with_year = ["%B %d, %Y", "%B %d %Y", "%b %d, %Y", "%b %d %Y"]
    for fmt in formats_with_year:
        try:
            parsed = datetime.strptime(date_text, fmt)
            return parsed.strftime("%Y%m%d")
        except ValueError:
            continue

    # If that failed, assume no year was present — append the current year and retry
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