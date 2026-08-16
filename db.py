import sqlite3
from pathlib import Path
from werkzeug.security import generate_password_hash, check_password_hash

DB_PATH = Path(__file__).parent / "syllabi.db"


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS syllabi (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            course_name TEXT NOT NULL,
            data_json TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    """)
    conn.commit()
    conn.close()


# ---- User functions ----

def create_user(username, password):
    conn = get_connection()
    password_hash = generate_password_hash(password)
    try:
        cursor = conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, password_hash)
        )
        conn.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError:
        return None  # username already taken
    finally:
        conn.close()


def verify_user(username, password):
    conn = get_connection()
    row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()

    if row and check_password_hash(row["password_hash"], password):
        return dict(row)
    return None


# ---- Syllabus functions (now scoped to a user) ----

def save_syllabus(user_id, course_name, data_json):
    conn = get_connection()
    cursor = conn.execute(
        "INSERT INTO syllabi (user_id, course_name, data_json) VALUES (?, ?, ?)",
        (user_id, course_name, data_json)
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return new_id


def list_syllabi(user_id):
    conn = get_connection()
    rows = conn.execute(
        "SELECT id, course_name, created_at FROM syllabi WHERE user_id = ? ORDER BY created_at DESC",
        (user_id,)
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_syllabus(user_id, syllabus_id):
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM syllabi WHERE id = ? AND user_id = ?",
        (syllabus_id, user_id)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def delete_syllabus(user_id, syllabus_id):
    conn = get_connection()
    conn.execute("DELETE FROM syllabi WHERE id = ? AND user_id = ?", (syllabus_id, user_id))
    conn.commit()
    conn.close()


def rename_syllabus(user_id, syllabus_id, course_name):
    conn = get_connection()
    conn.execute(
        "UPDATE syllabi SET course_name = ? WHERE id = ? AND user_id = ?",
        (course_name, syllabus_id, user_id)
    )
    conn.commit()
    conn.close()