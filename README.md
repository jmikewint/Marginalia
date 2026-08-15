# Syllabus Translator

A full-stack tool that extracts the important stuff from a course syllabus — grading breakdown, deadlines, and easy-to-miss policies that could hurt your grade — and presents it clearly instead of making you dig through pages of dense text.

## Why I built this

Syllabi bury critical information (grade-threshold rules, harsh late penalties, no-makeup policies) in dense paragraphs students often skim past. This tool uses Claude to extract and prioritize what actually matters, so nothing important gets missed.

## Features

- **Paste text or upload a file** — supports pasted text, PDF, and DOCX syllabi
- **AI-powered extraction** — structured breakdown of grading weights, deadlines, and severity-ranked policy flags
- **Calendar export** — download all deadlines as a `.ics` file, importable into Google Calendar, Apple Calendar, or Outlook
- **User accounts** — sign up, log in, and keep your saved syllabi private to your account
- **Save & revisit** — save analyzed syllabi and pull them back up anytime without re-uploading
- **Multi-syllabus dashboard** — see every deadline across all your saved classes in one combined, sorted view
- **Dark mode** — theme preference saved across visits
- **Responsive design** — works on mobile as well as desktop

## How it works

1. Paste syllabus text or upload a PDF/DOCX file
2. The backend extracts raw text (if a file was uploaded) and sends it to Claude with a structured extraction prompt
3. Claude returns categorized JSON: grading breakdown, deadlines, and prioritized flags
4. The frontend renders it as clean, scannable cards
5. Optionally save it to your account, export deadlines to your calendar, or view all your saved syllabi together on the dashboard

## Tech stack

- **Backend:** Python, Flask
- **Database:** SQLite
- **AI:** Anthropic Claude API
- **Auth:** Flask sessions with hashed passwords (Werkzeug)
- **File parsing:** pypdf, python-docx
- **Frontend:** HTML/CSS/JavaScript (vanilla, no framework)

## Running locally

1. Clone the repo and create a virtual environment
2. `pip install -r requirements.txt`
3. Create a `.env` file with:
ANTHROPIC_API_KEY=your_key_here
FLASK_SECRET_KEY=any_long_random_string
4. `python app.py`
5. Open `http://127.0.0.1:5000`

## What I'd improve next

- Deploy for live public use
- Export a full-semester calendar across all saved syllabi at once, not just one at a time
- Let students share a syllabus link with classmates
- Visual redesign / polish pass


<img width="1904" height="910" alt="Screen1" src="https://github.com/user-attachments/assets/ba4b889d-d0c0-4dbb-859c-154c5330a9c8" />
<img width="1906" height="907" alt="Screen 2" src="https://github.com/user-attachments/assets/4fda5a05-e56b-4d82-b56c-20088ea537e2" />
