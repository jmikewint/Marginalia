import secrets
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
            email TEXT,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    # Migration for DBs created before the email column existed. A plain
    # ALTER TABLE ADD COLUMN can't carry a UNIQUE constraint in SQLite, so
    # uniqueness is enforced via a separate index instead, uniformly for
    # both fresh and migrated databases.
    existing_columns = {row["name"] for row in conn.execute("PRAGMA table_info(users)")}
    if "email" not in existing_columns:
        conn.execute("ALTER TABLE users ADD COLUMN email TEXT")
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)")

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
    conn.execute("""
        CREATE TABLE IF NOT EXISTS password_resets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT NOT NULL UNIQUE,
            expires_at TEXT NOT NULL,
            used INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    """)
    conn.commit()
    conn.close()


# ---- User functions ----

def create_user(username, email, password):
    """Returns (user_id, None) on success, or (None, conflict) where conflict
    is "username" or "email", identifying which UNIQUE constraint failed."""
    conn = get_connection()
    password_hash = generate_password_hash(password)
    try:
        cursor = conn.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            (username, email, password_hash)
        )
        conn.commit()
        return cursor.lastrowid, None
    except sqlite3.IntegrityError as e:
        conflict = "email" if "users.email" in str(e) else "username"
        return None, conflict
    finally:
        conn.close()


def verify_user(username, password):
    conn = get_connection()
    row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()

    if row and check_password_hash(row["password_hash"], password):
        return dict(row)
    return None


def get_user_by_email(email):
    conn = get_connection()
    row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()
    return dict(row) if row else None


# ---- Password reset functions ----

def create_password_reset(user_id):
    conn = get_connection()
    # Requesting a new link retires any earlier unused one for this account,
    # so only the most recently issued link actually works.
    conn.execute("UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0", (user_id,))
    token = secrets.token_urlsafe(32)
    conn.execute(
        "INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, datetime('now', '+1 hour'))",
        (user_id, token)
    )
    conn.commit()
    conn.close()
    return token


def get_valid_reset(token):
    conn = get_connection()
    row = conn.execute(
        "SELECT user_id FROM password_resets WHERE token = ? AND used = 0 AND expires_at > datetime('now')",
        (token,)
    ).fetchone()
    conn.close()
    return row["user_id"] if row else None


def reset_password(user_id, token, new_password):
    conn = get_connection()
    password_hash = generate_password_hash(new_password)
    conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (password_hash, user_id))
    conn.execute("UPDATE password_resets SET used = 1 WHERE token = ?", (token,))
    conn.commit()
    conn.close()


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
        "SELECT id, course_name, created_at, data_json FROM syllabi WHERE user_id = ? ORDER BY created_at DESC",
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