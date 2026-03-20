from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests
import sqlite3
import json
import time
import os
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")
DB_NAME = os.path.join(BASE_DIR, "database.db")

app = Flask(
    __name__,
    static_folder=FRONTEND_DIR,
    static_url_path=""
)
CORS(app)


def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            is_admin INTEGER DEFAULT 0,
            created_at TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            method TEXT,
            url TEXT,
            headers TEXT,
            body TEXT,
            response TEXT,
            status_code INTEGER,
            created_at TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS collections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            name TEXT,
            method TEXT,
            url TEXT,
            headers TEXT,
            body TEXT,
            created_at TEXT
        )
    """)

    conn.commit()

    # Add is_admin column safely if old database exists without it
    cursor.execute("PRAGMA table_info(users)")
    columns = [col["name"] for col in cursor.fetchall()]
    if "is_admin" not in columns:
        cursor.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0")
        conn.commit()

    conn.close()


# ---------------- FRONTEND ROUTES ---------------- #

@app.route("/")
def serve_login():
    return send_from_directory(FRONTEND_DIR, "login.html")


@app.route("/index.html")
def serve_index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/login.html")
def serve_login_page():
    return send_from_directory(FRONTEND_DIR, "login.html")


@app.route("/admin.html")
def serve_admin_page():
    return send_from_directory(FRONTEND_DIR, "admin.html")


@app.route("/<path:filename>")
def serve_static_files(filename):
    file_path = os.path.join(FRONTEND_DIR, filename)
    if os.path.isfile(file_path):
        return send_from_directory(FRONTEND_DIR, filename)
    return jsonify({"error": "File not found"}), 404


# ---------------- AUTH ---------------- #

@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()

    username = data.get("username", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "").strip()

    if not username or not email or not password:
        return jsonify({"error": "All fields are required"}), 400

    hashed_password = generate_password_hash(password)

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) as total FROM users")
        total_users = cursor.fetchone()["total"]
        is_admin = 1 if total_users == 0 else 0

        cursor.execute("""
            INSERT INTO users (username, email, password, is_admin, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (
            username,
            email,
            hashed_password,
            is_admin,
            datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ))

        conn.commit()
        conn.close()

        return jsonify({
            "message": "User registered successfully",
            "is_admin": bool(is_admin)
        })
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username or email already exists"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()

    email = data.get("email", "").strip()
    password = data.get("password", "").strip()

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    conn.close()

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not check_password_hash(user["password"], password):
        return jsonify({"error": "Invalid password"}), 401

    return jsonify({
        "message": "Login successful",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "is_admin": bool(user["is_admin"])
        }
    })


# ---------------- API TESTER ---------------- #

@app.route("/request", methods=["POST"])
def send_request():
    data = request.get_json()

    method = data.get("method", "GET").upper()
    url = data.get("url", "").strip()
    headers = data.get("headers", {})
    body = data.get("body", {})

    if not url:
        return jsonify({"error": "URL is required"}), 400

    try:
        start_time = time.time()

        request_kwargs = {
            "method": method,
            "url": url,
            "headers": headers,
            "timeout": 30
        }

        if method in ["POST", "PUT", "PATCH", "DELETE"]:
            request_kwargs["json"] = body

        response = requests.request(**request_kwargs)

        end_time = time.time()
        response_time = round((end_time - start_time) * 1000, 2)

        try:
            response_content = response.json()
        except Exception:
            response_content = response.text

        response_data = {
            "status_code": response.status_code,
            "response_time_ms": response_time,
            "headers": dict(response.headers),
            "response": response_content
        }

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO history (method, url, headers, body, response, status_code, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            method,
            url,
            json.dumps(headers),
            json.dumps(body),
            json.dumps(response_content),
            response.status_code,
            datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ))
        conn.commit()
        conn.close()

        return jsonify(response_data)

    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Request failed: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/history", methods=["GET"])
def get_history():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM history ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()

    return jsonify([dict(row) for row in rows])


@app.route("/history/<int:history_id>", methods=["DELETE"])
def delete_history(history_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM history WHERE id = ?", (history_id,))
    conn.commit()
    conn.close()

    return jsonify({"message": "History deleted successfully"})


@app.route("/history/clear", methods=["DELETE"])
def clear_history():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM history")
    conn.commit()
    conn.close()

    return jsonify({"message": "All history cleared successfully"})


# ---------------- COLLECTIONS ---------------- #

@app.route("/save", methods=["POST"])
def save_collection():
    data = request.get_json()

    user_id = data.get("user_id")
    name = data.get("name", "").strip()
    method = data.get("method", "").strip()
    url = data.get("url", "").strip()
    headers = data.get("headers", {})
    body = data.get("body", {})

    if not user_id:
        return jsonify({"error": "User ID is required"}), 400

    if not name or not method or not url:
        return jsonify({"error": "Name, method and URL are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO collections (user_id, name, method, url, headers, body, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        user_id,
        name,
        method,
        url,
        json.dumps(headers),
        json.dumps(body),
        datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    ))
    conn.commit()
    conn.close()

    return jsonify({"message": "Collection saved successfully"})


@app.route("/collections/<int:user_id>", methods=["GET"])
def get_collections(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM collections WHERE user_id = ? ORDER BY id DESC", (user_id,))
    rows = cursor.fetchall()
    conn.close()

    return jsonify([dict(row) for row in rows])


@app.route("/collections/item/<int:collection_id>", methods=["PUT"])
def update_collection(collection_id):
    data = request.get_json()

    name = data.get("name", "").strip()
    method = data.get("method", "").strip()
    url = data.get("url", "").strip()
    headers = json.dumps(data.get("headers", {}))
    body = json.dumps(data.get("body", {}))

    if not name or not method or not url:
        return jsonify({"error": "Name, method and URL are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE collections
        SET name = ?, method = ?, url = ?, headers = ?, body = ?
        WHERE id = ?
    """, (name, method, url, headers, body, collection_id))
    conn.commit()
    conn.close()

    return jsonify({"message": "Collection updated successfully"})


@app.route("/collections/item/<int:collection_id>", methods=["DELETE"])
def delete_collection(collection_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM collections WHERE id = ?", (collection_id,))
    conn.commit()
    conn.close()

    return jsonify({"message": "Collection deleted successfully"})


# ---------------- ADMIN USER MANAGEMENT ---------------- #

@app.route("/users", methods=["GET"])
def get_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, username, email, is_admin, created_at
        FROM users
        ORDER BY id DESC
    """)
    users = cursor.fetchall()
    conn.close()

    return jsonify([dict(user) for user in users])


@app.route("/users/<int:user_id>", methods=["PUT"])
def update_user(user_id):
    data = request.get_json()

    username = data.get("username", "").strip()
    email = data.get("email", "").strip()
    is_admin = 1 if data.get("is_admin") else 0

    if not username or not email:
        return jsonify({"error": "Username and email are required"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE users
            SET username = ?, email = ?, is_admin = ?
            WHERE id = ?
        """, (username, email, is_admin, user_id))
        conn.commit()
        conn.close()

        return jsonify({"message": "User updated successfully"})
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username or email already exists"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/users/<int:user_id>", methods=["DELETE"])
def delete_user(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM collections WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))

    conn.commit()
    conn.close()

    return jsonify({"message": "User deleted successfully"})

if __name__ == "__main__":
    init_db()
    app.run(debug=True)