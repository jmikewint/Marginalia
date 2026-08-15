import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "syllabi.db"


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # lets us access columns by name, e.g. row["course_name"]
    return conn


def init_db():
    """Creates the syllabi table if it doesn't already exist. Safe to call every startup."""
    conn = get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS syllabi (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_name TEXT NOT NULL,
            data_json TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    conn.commit()
    conn.close()


def save_syllabus(course_name, data_json):
    conn = get_connection()
    cursor = conn.execute(
        "INSERT INTO syllabi (course_name, data_json) VALUES (?, ?)",
        (course_name, data_json)
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return new_id


def list_syllabi():
    conn = get_connection()
    rows = conn.execute(
        "SELECT id, course_name, created_at FROM syllabi ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_syllabus(syllabus_id):
    conn = get_connection()
    row = conn.execute("SELECT * FROM syllabi WHERE id = ?", (syllabus_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def delete_syllabus(syllabus_id):
    conn = get_connection()
    conn.execute("DELETE FROM syllabi WHERE id = ?", (syllabus_id,))
    conn.commit()
    conn.close()