# Syllabus Translator

A tool that extracts the important stuff from a course syllabus — grading breakdown, deadlines, and easy-to-miss policies that could hurt your grade — and presents it clearly instead of making you dig through pages of dense text.

## Why I built this

Syllabi bury critical information (grade-threshold rules, harsh late penalties, no-makeup policies) in dense paragraphs students often skim past. This tool uses Claude to extract and prioritize what actually matters.

## How it works

1. Paste raw syllabus text into the app
2. The backend sends it to Claude with a structured extraction prompt
3. Claude returns categorized JSON (grading, deadlines, flags)
4. The frontend renders it as clean, scannable cards — with flags ranked by severity

## Tech stack

- **Backend:** Python, Flask
- **AI:** Anthropic Claude API
- **Frontend:** HTML/CSS/JavaScript (vanilla)

## Running locally

1. Clone the repo and create a virtual environment
2. `pip install -r requirements.txt`
3. Add your Anthropic API key to a `.env` file: `ANTHROPIC_API_KEY=your_key_here`
4. `python app.py`
5. Open `http://127.0.0.1:5000`

## What I'd improve next

- Support for PDF/Word upload instead of copy-paste
- Export deadlines directly to a calendar
- Handle multiple syllabi at once for a full course-load overview