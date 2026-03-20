from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    jwt_required,
    get_jwt_identity,
    get_jwt
)
import requests
import sqlite3
import json
import time
import os
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")
DB_NAME = os.path.join(BASE_DIR, "database.db")

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
CORS(app)

app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "super-secret-change-this")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=2)
jwt = JWTManager(app)


def get_db_connection():
    conn = sqlite3.connect(DB_NAME, timeout=10, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db_connection() as conn:
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
                user_id INTEGER,
                method TEXT,
                url TEXT,
                headers TEXT,
                body TEXT,
                response TEXT,
                status_code INTEGER,
                response_time_ms REAL,
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

        cursor.execute("PRAGMA table_info(users)")
        user_columns = [col["name"] for col in cursor.fetchall()]
        if "is_admin" not in user_columns:
            cursor.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0")

        cursor.execute("PRAGMA table_info(history)")
        history_columns = [col["name"] for col in cursor.fetchall()]
        if "user_id" not in history_columns:
            cursor.execute("ALTER TABLE history ADD COLUMN user_id INTEGER")
        if "response_time_ms" not in history_columns:
            cursor.execute("ALTER TABLE history ADD COLUMN response_time_ms REAL")

        conn.commit()


def parse_json_field(value, default=None):
    if default is None:
        default = {}
    if value is None or value == "":
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return default


def current_user_id():
    return int(get_jwt_identity())


def current_user_is_admin():
    claims = get_jwt()
    return bool(claims.get("is_admin"))


# ---------------- FRONTEND ROUTES ---------------- #

@app.route("/")
def serve_login():
    return send_from_directory(FRONTEND_DIR, "login.html")


@app.route("/login.html")
def serve_login_page():
    return send_from_directory(FRONTEND_DIR, "login.html")


@app.route("/index.html")
def serve_index_page():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/admin.html")
def serve_admin_page():
    return send_from_directory(FRONTEND_DIR, "admin.html")


@app.route("/<path:filename>")
def serve_static_file(filename):
    file_path = os.path.join(FRONTEND_DIR, filename)
    if os.path.isfile(file_path):
        return send_from_directory(FRONTEND_DIR, filename)
    return jsonify({"error": "File not found"}), 404


# ---------------- AUTH ---------------- #

@app.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}

    username = data.get("username", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()

    if not username or not email or not password:
        return jsonify({"error": "All fields are required"}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    hashed_password = generate_password_hash(password)

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("SELECT COUNT(*) AS total FROM users")
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

        return jsonify({
            "message": "User registered successfully",
            "is_admin": bool(is_admin)
        }), 201

    except sqlite3.IntegrityError:
        return jsonify({"error": "Username or email already exists"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}

    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
            user = cursor.fetchone()

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not check_password_hash(user["password"], password):
            return jsonify({"error": "Invalid password"}), 401

        access_token = create_access_token(
            identity=str(user["id"]),
            additional_claims={
                "username": user["username"],
                "email": user["email"],
                "is_admin": bool(user["is_admin"])
            }
        )

        return jsonify({
            "message": "Login successful",
            "access_token": access_token,
            "user": {
                "id": user["id"],
                "username": user["username"],
                "email": user["email"],
                "is_admin": bool(user["is_admin"])
            }
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------- API TESTER ---------------- #

@app.route("/request", methods=["POST"])
@jwt_required()
def send_request():
    data = request.get_json() or {}

    method = data.get("method", "GET").upper()
    url = data.get("url", "").strip()
    headers = data.get("headers", {}) or {}
    body = data.get("body", {}) or {}
    params = data.get("params", {}) or {}

    if not url:
        return jsonify({"error": "URL is required"}), 400

    if method not in ["GET", "POST", "PUT", "PATCH", "DELETE"]:
        return jsonify({"error": "Unsupported HTTP method"}), 400

    try:
        headers = {str(k): str(v) for k, v in headers.items()}

        start_time = time.time()

        request_kwargs = {
            "method": method,
            "url": url,
            "headers": headers,
            "params": params,
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

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO history (
                    user_id, method, url, headers, body, response,
                    status_code, response_time_ms, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                current_user_id(),
                method,
                response.url,
                json.dumps(headers),
                json.dumps(body),
                json.dumps(response_content),
                response.status_code,
                response_time,
                datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            ))
            conn.commit()

        return jsonify(response_data)

    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Request failed: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/history", methods=["GET"])
@jwt_required()
def get_history():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM history WHERE user_id = ? ORDER BY id DESC",
                (current_user_id(),)
            )
            rows = cursor.fetchall()

        return jsonify([dict(row) for row in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/history/item/<int:history_id>", methods=["DELETE"])
@jwt_required()
def delete_history(history_id):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM history WHERE id = ?", (history_id,))
            item = cursor.fetchone()

            if not item:
                return jsonify({"error": "History item not found"}), 404

            if item["user_id"] != current_user_id() and not current_user_is_admin():
                return jsonify({"error": "Unauthorized"}), 403

            cursor.execute("DELETE FROM history WHERE id = ?", (history_id,))
            conn.commit()

        return jsonify({"message": "History deleted successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/history/clear", methods=["DELETE"])
@jwt_required()
def clear_history():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM history WHERE user_id = ?", (current_user_id(),))
            conn.commit()

        return jsonify({"message": "History cleared successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------- COLLECTIONS ---------------- #

@app.route("/save", methods=["POST"])
@jwt_required()
def save_collection():
    data = request.get_json() or {}

    name = data.get("name", "").strip()
    method = data.get("method", "").strip().upper()
    url = data.get("url", "").strip()
    headers = data.get("headers", {}) or {}
    body = data.get("body", {}) or {}

    if not name or not method or not url:
        return jsonify({"error": "Name, method and URL are required"}), 400

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO collections (user_id, name, method, url, headers, body, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                current_user_id(),
                name,
                method,
                url,
                json.dumps(headers),
                json.dumps(body),
                datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            ))
            conn.commit()

        return jsonify({"message": "Collection saved successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/collections", methods=["GET"])
@jwt_required()
def get_collections():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM collections WHERE user_id = ? ORDER BY id DESC",
                (current_user_id(),)
            )
            rows = cursor.fetchall()

        return jsonify([dict(row) for row in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/collections/item/<int:collection_id>", methods=["PUT"])
@jwt_required()
def update_collection(collection_id):
    data = request.get_json() or {}

    name = data.get("name", "").strip()
    method = data.get("method", "").strip().upper()
    url = data.get("url", "").strip()
    headers = json.dumps(data.get("headers", {}) or {})
    body = json.dumps(data.get("body", {}) or {})

    if not name or not method or not url:
        return jsonify({"error": "Name, method and URL are required"}), 400

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT user_id FROM collections WHERE id = ?", (collection_id,))
            item = cursor.fetchone()

            if not item:
                return jsonify({"error": "Collection not found"}), 404

            if item["user_id"] != current_user_id() and not current_user_is_admin():
                return jsonify({"error": "Unauthorized"}), 403

            cursor.execute("""
                UPDATE collections
                SET name = ?, method = ?, url = ?, headers = ?, body = ?
                WHERE id = ?
            """, (name, method, url, headers, body, collection_id))
            conn.commit()

        return jsonify({"message": "Collection updated successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/collections/item/<int:collection_id>", methods=["DELETE"])
@jwt_required()
def delete_collection(collection_id):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT user_id FROM collections WHERE id = ?", (collection_id,))
            item = cursor.fetchone()

            if not item:
                return jsonify({"error": "Collection not found"}), 404

            if item["user_id"] != current_user_id() and not current_user_is_admin():
                return jsonify({"error": "Unauthorized"}), 403

            cursor.execute("DELETE FROM collections WHERE id = ?", (collection_id,))
            conn.commit()

        return jsonify({"message": "Collection deleted successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/collections/export", methods=["GET"])
@jwt_required()
def export_collections():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM collections WHERE user_id = ? ORDER BY id DESC",
                (current_user_id(),)
            )
            rows = cursor.fetchall()

        items = []
        for row in rows:
            items.append({
                "name": row["name"],
                "request": {
                    "method": row["method"],
                    "header": [
                        {"key": k, "value": str(v)}
                        for k, v in parse_json_field(row["headers"], {}).items()
                    ],
                    "url": row["url"],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps(parse_json_field(row["body"], {}), indent=2)
                    }
                }
            })

        export_data = {
            "info": {
                "name": f"{get_jwt().get('username', 'User')} Collections",
                "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
            },
            "item": items
        }

        return jsonify(export_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------- ADMIN ---------------- #

@app.route("/users", methods=["GET"])
@jwt_required()
def get_users():
    if not current_user_is_admin():
        return jsonify({"error": "Admin access required"}), 403

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, username, email, is_admin, created_at
                FROM users
                ORDER BY id DESC
            """)
            users = cursor.fetchall()

        return jsonify([dict(user) for user in users])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/users/<int:user_id>", methods=["PUT"])
@jwt_required()
def update_user(user_id):
    if not current_user_is_admin():
        return jsonify({"error": "Admin access required"}), 403

    data = request.get_json() or {}
    username = data.get("username", "").strip()
    email = data.get("email", "").strip().lower()
    is_admin = 1 if data.get("is_admin") else 0

    if not username or not email:
        return jsonify({"error": "Username and email are required"}), 400

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE users
                SET username = ?, email = ?, is_admin = ?
                WHERE id = ?
            """, (username, email, is_admin, user_id))
            conn.commit()

        return jsonify({"message": "User updated successfully"})
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username or email already exists"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/users/<int:user_id>", methods=["DELETE"])
@jwt_required()
def delete_user(user_id):
    if not current_user_is_admin():
        return jsonify({"error": "Admin access required"}), 403

    if current_user_id() == user_id:
        return jsonify({"error": "Admin cannot delete own account"}), 400

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM collections WHERE user_id = ?", (user_id,))
            cursor.execute("DELETE FROM history WHERE user_id = ?", (user_id,))
            cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
            conn.commit()

        return jsonify({"message": "User deleted successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/admin/history", methods=["GET"])
@jwt_required()
def get_admin_history():
    if not current_user_is_admin():
        return jsonify({"error": "Admin access required"}), 403

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT h.*, u.username
                FROM history h
                LEFT JOIN users u ON h.user_id = u.id
                ORDER BY h.id DESC
            """)
            rows = cursor.fetchall()

        return jsonify([dict(row) for row in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/dashboard/stats", methods=["GET"])
@jwt_required()
def dashboard_stats():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            if current_user_is_admin():
                cursor.execute("SELECT COUNT(*) AS total_users FROM users")
                total_users = cursor.fetchone()["total_users"]

                cursor.execute("SELECT COUNT(*) AS total_requests FROM history")
                total_requests = cursor.fetchone()["total_requests"]

                cursor.execute("""
                    SELECT COUNT(*) AS success_requests
                    FROM history
                    WHERE status_code BETWEEN 200 AND 299
                """)
                success_requests = cursor.fetchone()["success_requests"]

                cursor.execute("""
                    SELECT method, COUNT(*) AS count
                    FROM history
                    GROUP BY method
                    ORDER BY count DESC
                """)
                methods = [dict(row) for row in cursor.fetchall()]
            else:
                total_users = 1

                cursor.execute(
                    "SELECT COUNT(*) AS total_requests FROM history WHERE user_id = ?",
                    (current_user_id(),)
                )
                total_requests = cursor.fetchone()["total_requests"]

                cursor.execute("""
                    SELECT COUNT(*) AS success_requests
                    FROM history
                    WHERE user_id = ? AND status_code BETWEEN 200 AND 299
                """, (current_user_id(),))
                success_requests = cursor.fetchone()["success_requests"]

                cursor.execute("""
                    SELECT method, COUNT(*) AS count
                    FROM history
                    WHERE user_id = ?
                    GROUP BY method
                    ORDER BY count DESC
                """, (current_user_id(),))
                methods = [dict(row) for row in cursor.fetchall()]

        success_rate = round((success_requests / total_requests) * 100, 2) if total_requests else 0

        return jsonify({
            "total_users": total_users,
            "total_requests": total_requests,
            "success_requests": success_requests,
            "success_rate": success_rate,
            "methods": methods
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True, use_reloader=False)