import os
from dotenv import load_dotenv
from anthropic import Anthropic

load_dotenv()
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

def analyze_syllabus(syllabus_text):
    prompt = f"""You are analyzing a course syllabus. Extract the following information and return ONLY valid JSON, no other text, in this exact structure:

{{
  "grading": [
    {{"component": "string, e.g. Midterm Exam", "weight": "string, e.g. 25%"}}
  ],
  "deadlines": [
    {{"item": "string, e.g. Assignment 1", "date": "string, e.g. Oct 15"}}
  ],
  "flags": [
    {{"severity": "high" or "medium", "text": "string describing the policy"}}
  ]
}}

For flags: only include the 3-6 MOST IMPORTANT things a student could get seriously burned by missing (grade-threshold rules, harsh late penalties, no-makeup policies, academic integrity risks). Mark "high" severity for things that could tank a grade or get someone in academic trouble, "medium" for things worth knowing but less severe. Skip minor administrative details.

If a category has no relevant info in the syllabus, return an empty array for it. Do not invent information that isn't in the text.

Syllabus text:
{syllabus_text}
"""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}]
    )

    return response.content[0].text