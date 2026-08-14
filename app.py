from flask import Flask, request, jsonify, render_template
from claude_client import analyze_syllabus
import json
import re

app = Flask(__name__)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json()
    syllabus_text = data.get("syllabus_text", "")

    if not syllabus_text.strip():
        return jsonify({"error": "No syllabus text provided"}), 400

    raw_result = analyze_syllabus(syllabus_text)

    # Claude sometimes wraps JSON in ```json ... ``` — strip that if present
    cleaned = re.sub(r"^```json\s*|\s*```$", "", raw_result.strip())

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        return jsonify({"error": "Could not parse response"}), 500

    return jsonify(parsed)

if __name__ == "__main__":
    app.run(debug=True)