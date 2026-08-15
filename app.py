from flask import Flask, request, jsonify, render_template
from claude_client import analyze_syllabus
from file_parser import extract_text_from_file
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

if __name__ == "__main__":
    app.run(debug=True)