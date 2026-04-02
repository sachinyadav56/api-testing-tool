from flask import Flask, request, jsonify, send_from_directory, redirect
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    jwt_required,
    get_jwt_identity,
    get_jwt,
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


def now_str():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def get_db_connection():
    conn = sqlite3.connect(DB_NAME, timeout=10, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def current_user_id():
    return int(get_jwt_identity())


def current_user_is_admin():
    return bool(get_jwt().get("is_admin"))


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
            CREATE TABLE IF NOT EXISTS queries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                name TEXT,
                email TEXT,
                subject TEXT,
                message TEXT,
                status TEXT DEFAULT 'pending',
                created_at TEXT,
                updated_at TEXT
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

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS pages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                content TEXT NOT NULL,
                status TEXT DEFAULT 'draft',
                created_by INTEGER,
                created_at TEXT,
                updated_at TEXT
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS purchases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                plan_name TEXT NOT NULL,
                amount TEXT,
                status TEXT DEFAULT 'pending',
                payment_reference TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        """)

        cursor.execute("PRAGMA table_info(users)")
        user_columns = [row["name"] for row in cursor.fetchall()]
        if "active_plan" not in user_columns:
            cursor.execute("ALTER TABLE users ADD COLUMN active_plan TEXT DEFAULT 'Free'")

        conn.commit()


# ---------------- FRONTEND ROUTES ---------------- #

@app.route("/")
def serve_root():
    return redirect("/page/home")

@app.route("/queries.html")
def serve_queries_page():
    return send_from_directory(FRONTEND_DIR, "queries.html")


@app.route("/login.html")
def serve_login_page():
    return send_from_directory(FRONTEND_DIR, "login.html")


@app.route("/faq.html")
def faq_page():
    return send_from_directory(FRONTEND_DIR, "faq.html")

@app.route("/contact.html")
def contact_page():
    return send_from_directory(FRONTEND_DIR, "contact.html")


@app.route("/dashboard.html")
def serve_dashboard_page():
    return send_from_directory(FRONTEND_DIR, "dashboard.html")




@app.route("/settings.html")
def serve_settings_page():
    return send_from_directory(FRONTEND_DIR, "settings.html")


@app.route("/index.html")
def serve_index_page():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/admin.html")
def serve_admin_page():
    return send_from_directory(FRONTEND_DIR, "admin.html")


@app.route("/users.html")
def serve_users_page():
    return send_from_directory(FRONTEND_DIR, "users.html")

@app.route("/docs.html")
def serve_docs_page():
    return send_from_directory(FRONTEND_DIR, "docs.html")


@app.route("/cms.html")
def serve_cms_page():
    return send_from_directory(FRONTEND_DIR, "cms.html")


@app.route("/history.html")
def serve_history_page():
    return send_from_directory(FRONTEND_DIR, "history.html")


@app.route("/collections.html")
def serve_collections_page():
    return send_from_directory(FRONTEND_DIR, "collections.html")


@app.route("/purchase.html")
def serve_purchase_page():
    return send_from_directory(FRONTEND_DIR, "purchase.html")


@app.route("/payment.html")
def serve_payment_page():
    return send_from_directory(FRONTEND_DIR, "payment.html")


@app.route("/purchases.html")
def serve_purchases_page():
    return send_from_directory(FRONTEND_DIR, "purchases.html")


@app.route("/page/<slug>")
def serve_dynamic_page(slug):
    return send_from_directory(FRONTEND_DIR, "page.html")


@app.route("/admin-settings.html")
def serve_admin_settings_page():
    return send_from_directory(FRONTEND_DIR, "admin-settings.html")


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
                INSERT INTO users (username, email, password, is_admin, created_at, active_plan)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (username, email, hashed_password, is_admin, now_str(), "Free"))
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
    login_as = data.get("login_as", "user").strip().lower()

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    if login_as not in ["user", "admin"]:
        return jsonify({"error": "Invalid login type"}), 400

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
            user = cursor.fetchone()

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not check_password_hash(user["password"], password):
            return jsonify({"error": "Invalid password"}), 401

        if login_as == "admin" and not bool(user["is_admin"]):
            return jsonify({"error": "Only admin credentials are allowed here"}), 403

        if login_as == "user" and bool(user["is_admin"]):
            return jsonify({"error": "Use admin login for admin account"}), 403

        access_token = create_access_token(
            identity=str(user["id"]),
            additional_claims={
                "username": user["username"],
                "email": user["email"],
                "is_admin": bool(user["is_admin"]),
            }
        )

        return jsonify({
            "message": "Login successful",
            "access_token": access_token,
            "user": {
                "id": user["id"],
                "username": user["username"],
                "email": user["email"],
                "is_admin": bool(user["is_admin"]),
                "active_plan": user["active_plan"] if "active_plan" in user.keys() else "Free"
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------- USER DASHBOARD / SUBSCRIPTION ---------------- #

@app.route("/me/subscription", methods=["GET"])
@jwt_required()
def get_my_subscription():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, username, email, active_plan
                FROM users
                WHERE id = ?
            """, (current_user_id(),))
            user = cursor.fetchone()

        if not user:
            return jsonify({"error": "User not found"}), 404

        return jsonify(dict(user))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------- PURCHASES ---------------- #

@app.route("/purchase/checkout", methods=["POST"])
@jwt_required()
def create_purchase_checkout():
    data = request.get_json() or {}
    plan_name = data.get("plan_name", "").strip()
    amount = data.get("amount", "").strip()

    if not plan_name:
        return jsonify({"error": "Plan name is required"}), 400

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO purchases (
                    user_id, plan_name, amount, status, payment_reference, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                current_user_id(),
                plan_name,
                amount,
                "pending",
                f"PAY-{int(time.time())}",
                now_str(),
                now_str()
            ))
            purchase_id = cursor.lastrowid
            conn.commit()

        return jsonify({
            "message": "Checkout created",
            "purchase_id": purchase_id,
            "plan_name": plan_name,
            "amount": amount
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/purchase/confirm/<int:purchase_id>", methods=["POST"])
@jwt_required()
def confirm_purchase(purchase_id):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM purchases
                WHERE id = ? AND user_id = ?
            """, (purchase_id, current_user_id()))
            purchase = cursor.fetchone()

            if not purchase:
                return jsonify({"error": "Purchase not found"}), 404

            cursor.execute("""
                UPDATE purchases
                SET status = ?, updated_at = ?
                WHERE id = ?
            """, ("paid", now_str(), purchase_id))

            cursor.execute("""
                UPDATE users
                SET active_plan = ?
                WHERE id = ?
            """, (purchase["plan_name"], current_user_id()))

            conn.commit()

        return jsonify({
            "message": "Payment confirmed and plan activated",
            "active_plan": purchase["plan_name"]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/my/purchases", methods=["GET"])
@jwt_required()
def get_my_purchases():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, plan_name, amount, status, payment_reference, created_at, updated_at
                FROM purchases
                WHERE user_id = ?
                ORDER BY id DESC
            """, (current_user_id(),))
            rows = cursor.fetchall()

        return jsonify([dict(row) for row in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/admin/purchases", methods=["GET"])
@jwt_required()
def admin_get_purchases():
    if not current_user_is_admin():
        return jsonify({"error": "Admin access required"}), 403

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT p.id, p.plan_name, p.amount, p.status, p.payment_reference,
                       p.created_at, p.updated_at, u.username, u.email, u.active_plan
                FROM purchases p
                LEFT JOIN users u ON p.user_id = u.id
                ORDER BY p.id DESC
            """)
            rows = cursor.fetchall()

        return jsonify([dict(row) for row in rows])
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
            "timeout": 30,
        }

        if method in ["POST", "PUT", "PATCH", "DELETE"]:
            request_kwargs["json"] = body

        response = requests.request(**request_kwargs)
        response_time_ms = round((time.time() - start_time) * 1000, 2)

        try:
            response_content = response.json()
        except Exception:
            response_content = response.text

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
                response_time_ms,
                now_str(),
            ))
            conn.commit()

        return jsonify({
            "status_code": response.status_code,
            "response_time_ms": response_time_ms,
            "headers": dict(response.headers),
            "response": response_content,
        })

    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Request failed: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------- USER HISTORY ---------------- #

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


# ---------------- USER COLLECTIONS ---------------- #

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
                now_str(),
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

        export_data = []
        for row in rows:
            export_data.append({
                "name": row["name"],
                "method": row["method"],
                "url": row["url"],
                "headers": parse_json_field(row["headers"], {}),
                "body": parse_json_field(row["body"], {})
            })

        return jsonify({
            "exported_at": now_str(),
            "total": len(export_data),
            "collections": export_data
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/collections/import", methods=["POST"])
@jwt_required()
def import_collections():
    try:
        data = request.get_json() or {}
        collections = data.get("collections", [])

        if not isinstance(collections, list) or len(collections) == 0:
            return jsonify({"error": "No collections found to import"}), 400

        with get_db_connection() as conn:
            cursor = conn.cursor()

            for item in collections:
                name = item.get("name", "").strip()
                method = item.get("method", "GET").strip().upper()
                url = item.get("url", "").strip()
                headers = item.get("headers", {})
                body = item.get("body", {})

                if not name or not url:
                    continue

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
                    now_str(),
                ))

            conn.commit()

        return jsonify({"message": "Collections imported successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------- CMS ---------------- #

@app.route("/cms/pages", methods=["GET"])
@jwt_required()
def get_pages():
    if not current_user_is_admin():
        return jsonify({"error": "Admin access required"}), 403

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM pages ORDER BY id DESC")
            rows = cursor.fetchall()
        return jsonify([dict(row) for row in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/cms/pages", methods=["POST"])
@jwt_required()
def create_page():
    if not current_user_is_admin():
        return jsonify({"error": "Admin access required"}), 403

    data = request.get_json() or {}
    title = data.get("title", "").strip()
    slug = data.get("slug", "").strip().lower()
    content = data.get("content", "").strip()
    status = data.get("status", "draft").strip().lower()

    if not title or not slug or not content:
        return jsonify({"error": "Title, slug and content are required"}), 400

    try:
        json.loads(content)
    except Exception as e:
        return jsonify({"error": f"Invalid JSON content: {str(e)}"}), 400

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO pages (title, slug, content, status, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                title,
                slug,
                content,
                status,
                current_user_id(),
                now_str(),
                now_str(),
            ))
            conn.commit()
        return jsonify({"message": "Page created successfully"})
    except sqlite3.IntegrityError:
        return jsonify({"error": "Slug already exists"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/cms/pages/<int:page_id>", methods=["PUT"])
@jwt_required()
def update_page(page_id):
    if not current_user_is_admin():
        return jsonify({"error": "Admin access required"}), 403

    data = request.get_json() or {}
    title = data.get("title", "").strip()
    slug = data.get("slug", "").strip().lower()
    content = data.get("content", "").strip()
    status = data.get("status", "draft").strip().lower()

    if not title or not slug or not content:
        return jsonify({"error": "Title, slug and content are required"}), 400

    try:
        json.loads(content)
    except Exception as e:
        return jsonify({"error": f"Invalid JSON content: {str(e)}"}), 400

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE pages
                SET title = ?, slug = ?, content = ?, status = ?, updated_at = ?
                WHERE id = ?
            """, (title, slug, content, status, now_str(), page_id))
            conn.commit()
        return jsonify({"message": "Page updated successfully"})
    except sqlite3.IntegrityError:
        return jsonify({"error": "Slug already exists"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/cms/pages/<int:page_id>", methods=["DELETE"])
@jwt_required()
def delete_page(page_id):
    if not current_user_is_admin():
        return jsonify({"error": "Admin access required"}), 403

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM pages WHERE id = ?", (page_id,))
            conn.commit()
        return jsonify({"message": "Page deleted successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/public/page/<slug>", methods=["GET"])
def get_public_page_data(slug):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, title, slug, content, status, created_at, updated_at
                FROM pages
                WHERE slug = ? AND status = 'published'
            """, (slug,))
            page = cursor.fetchone()

        if not page:
            return jsonify({"error": "Page not found"}), 404

        return jsonify(dict(page))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------- ADMIN USERS ---------------- #

@app.route("/users", methods=["GET"])
@jwt_required()
def get_users():
    if not current_user_is_admin():
        return jsonify({"error": "Admin access required"}), 403

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, username, email, is_admin, created_at, active_plan
                FROM users
                ORDER BY id DESC
            """)
            rows = cursor.fetchall()
        return jsonify([dict(row) for row in rows])
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
            cursor.execute("DELETE FROM purchases WHERE user_id = ?", (user_id,))
            cursor.execute("DELETE FROM pages WHERE created_by = ?", (user_id,))
            cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
            conn.commit()
        return jsonify({"message": "User deleted successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------- ADMIN HISTORY ---------------- #

@app.route("/admin/history", methods=["GET"])
@jwt_required()
def admin_get_history():
    if not current_user_is_admin():
        return jsonify({"error": "Admin access required"}), 403

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT h.id, h.method, h.url, h.status_code, h.created_at, u.username
                FROM history h
                LEFT JOIN users u ON h.user_id = u.id
                ORDER BY h.id DESC
            """)
            rows = cursor.fetchall()
        return jsonify([dict(row) for row in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/admin/history/delete", methods=["POST"])
@jwt_required()
def admin_delete_history():
    if not current_user_is_admin():
        return jsonify({"error": "Admin access required"}), 403

    data = request.get_json() or {}
    ids = data.get("ids", [])

    if not isinstance(ids, list) or len(ids) == 0:
        return jsonify({"error": "No history ids provided"}), 400

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            placeholders = ",".join(["?"] * len(ids))
            cursor.execute(f"DELETE FROM history WHERE id IN ({placeholders})", ids)
            conn.commit()
        return jsonify({"message": "Selected history deleted successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------- ADMIN COLLECTIONS ---------------- #

@app.route("/admin/collections", methods=["GET"])
@jwt_required()
def admin_get_collections():
    if not current_user_is_admin():
        return jsonify({"error": "Admin access required"}), 403

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT c.id, c.method, c.url, c.created_at, u.username
                FROM collections c
                LEFT JOIN users u ON c.user_id = u.id
                ORDER BY c.id DESC
            """)
            rows = cursor.fetchall()
        return jsonify([dict(row) for row in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/admin/collections/delete", methods=["POST"])
@jwt_required()
def admin_delete_collections():
    if not current_user_is_admin():
        return jsonify({"error": "Admin access required"}), 403

    data = request.get_json() or {}
    ids = data.get("ids", [])

    if not isinstance(ids, list) or len(ids) == 0:
        return jsonify({"error": "No collection ids provided"}), 400

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            placeholders = ",".join(["?"] * len(ids))
            cursor.execute(f"DELETE FROM collections WHERE id IN ({placeholders})", ids)
            conn.commit()
        return jsonify({"message": "Selected collections deleted successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------- ADMIN DASHBOARD ---------------- #

@app.route("/dashboard/stats", methods=["GET"])
@jwt_required()
def dashboard_stats():
    if not current_user_is_admin():
        return jsonify({"error": "Admin access required"}), 403

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("SELECT COUNT(*) AS total_users FROM users")
            total_users = cursor.fetchone()["total_users"]

            cursor.execute("SELECT COUNT(*) AS total_requests FROM history")
            total_requests = cursor.fetchone()["total_requests"]

            cursor.execute("SELECT COUNT(*) AS success_requests FROM history WHERE status_code BETWEEN 200 AND 299")
            success_requests = cursor.fetchone()["success_requests"]

            cursor.execute("SELECT COUNT(*) AS total_pages FROM pages")
            total_pages = cursor.fetchone()["total_pages"]

            cursor.execute("SELECT COUNT(*) AS total_collections FROM collections")
            total_collections = cursor.fetchone()["total_collections"]

        success_rate = round((success_requests / total_requests) * 100, 2) if total_requests else 0

        return jsonify({
            "total_users": total_users,
            "total_requests": total_requests,
            "success_requests": success_requests,
            "success_rate": success_rate,
            "total_pages": total_pages,
            "total_collections": total_collections,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
    
@app.route("/me/profile", methods=["PUT"])
@jwt_required()
def update_my_profile():
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    email = data.get("email", "").strip().lower()

    if not username or not email:
        return jsonify({"error": "Username and email are required"}), 400

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE users
                SET username = ?, email = ?
                WHERE id = ?
            """, (username, email, current_user_id()))
            conn.commit()

        return jsonify({"message": "Profile updated successfully"})
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username or email already exists"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/me/password", methods=["PUT"])
@jwt_required()
def update_my_password():
    data = request.get_json() or {}
    current_password = data.get("current_password", "").strip()
    new_password = data.get("new_password", "").strip()

    if not current_password or not new_password:
        return jsonify({"error": "Current and new password are required"}), 400

    if len(new_password) < 6:
        return jsonify({"error": "New password must be at least 6 characters"}), 400

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT password FROM users WHERE id = ?", (current_user_id(),))
            user = cursor.fetchone()

            if not user:
                return jsonify({"error": "User not found"}), 404

            if not check_password_hash(user["password"], current_password):
                return jsonify({"error": "Current password is incorrect"}), 400

            cursor.execute("""
                UPDATE users
                SET password = ?
                WHERE id = ?
            """, (generate_password_hash(new_password), current_user_id()))
            conn.commit()

        return jsonify({"message": "Password changed successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route("/support", methods=["POST"])
def create_support():
    data = request.get_json() or {}

    subject = data.get("subject", "").strip()
    message = data.get("message", "").strip()

    if not subject or not message:
        return jsonify({"error": "All fields required"}), 400

    return jsonify({"message": "Support request sent successfully"})



@app.route("/support/query", methods=["POST"])
@jwt_required(optional=True)
def create_query():
    data = request.get_json() or {}

    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    subject = data.get("subject", "").strip()
    message = data.get("message", "").strip()

    if not name or not email or not subject or not message:
        return jsonify({"error": "All fields are required"}), 400

    try:
        user_id = None
        try:
            identity = get_jwt_identity()
            if identity:
                user_id = int(identity)
        except Exception:
            user_id = None

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO queries (user_id, name, email, subject, message, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                user_id,
                name,
                email,
                subject,
                message,
                "pending",
                now_str(),
                now_str()
            ))
            conn.commit()

        return jsonify({"message": "Query sent successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/admin/queries", methods=["GET"])
@jwt_required()
def admin_get_queries():
    if not current_user_is_admin():
        return jsonify({"error": "Admin access required"}), 403

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, name, email, subject, message, status, created_at, updated_at
                FROM queries
                ORDER BY id DESC
            """)
            rows = cursor.fetchall()

        return jsonify([dict(row) for row in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/admin/queries/<int:query_id>/solve", methods=["PUT"])
@jwt_required()
def admin_solve_query(query_id):
    if not current_user_is_admin():
        return jsonify({"error": "Admin access required"}), 403

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE queries
                SET status = ?, updated_at = ?
                WHERE id = ?
            """, ("solved", now_str(), query_id))
            conn.commit()

        return jsonify({"message": "Query marked as solved"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True, use_reloader=False)