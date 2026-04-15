from flask import Flask, request, jsonify, send_from_directory, redirect
from flask_cors import CORS
from flask_jwt_extended import get_jwt_identity
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    jwt_required,
    get_jwt_identity,
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
STATIC_DIR = os.path.join(PROJECT_ROOT, "static")
DB_NAME = os.path.join(BASE_DIR, "database.db")

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path="/static")
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


def ensure_column(cursor, table_name, column_name, column_sql):
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [row["name"] for row in cursor.fetchall()]
    if column_name not in columns:
        cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_sql}")


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
                admin_role TEXT DEFAULT '',
                created_at TEXT,
                active_plan TEXT DEFAULT 'Free',
                plan_start_date TEXT,
                plan_expiry_date TEXT
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

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS pricing_page (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                description TEXT
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS pricing_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                price REAL NOT NULL,
                duration_days INTEGER NOT NULL,
                description TEXT,
                features TEXT
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS purchases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                username TEXT,
                plan_name TEXT NOT NULL,
                amount TEXT,
                status TEXT DEFAULT 'pending',
                payment_reference TEXT,
                created_at TEXT,
                updated_at TEXT,
                purchase_date TEXT,
                start_date TEXT,
                expiry_date TEXT
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                title TEXT,
                message TEXT,
                type TEXT,
                is_read INTEGER DEFAULT 0,
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

        ensure_column(cursor, "users", "admin_role", "admin_role TEXT DEFAULT ''")
        ensure_column(cursor, "users", "active_plan", "active_plan TEXT DEFAULT 'Free'")
        ensure_column(cursor, "users", "plan_start_date", "plan_start_date TEXT")
        ensure_column(cursor, "users", "plan_expiry_date", "plan_expiry_date TEXT")

        cursor.execute("SELECT COUNT(*) AS total FROM pricing_page")
        if cursor.fetchone()["total"] == 0:
            cursor.execute("""
                INSERT INTO pricing_page (title, description)
                VALUES (?, ?)
            """, (
                "Simple pricing for every workflow",
                "Choose a plan that fits your API testing and management needs."
            ))

        cursor.execute("SELECT COUNT(*) AS total FROM pricing_plans")
        if cursor.fetchone()["total"] == 0:
            plans = [
                ("Starter", 199, 30, "Basic testing and collections support.", json.dumps(["API testing", "Collections", "History"])),
                ("Pro", 499, 30, "Advanced workflow for regular users.", json.dumps(["Everything in Starter", "Priority support", "Better usage limits"])),
                ("Enterprise", 999, 30, "Full premium workflow for teams.", json.dumps(["Everything in Pro", "Team-ready workflow", "Premium management tools"]))
            ]
            cursor.executemany("""
                INSERT INTO pricing_plans (name, price, duration_days, description, features)
                VALUES (?, ?, ?, ?, ?)
            """, plans)

        conn.commit()


@app.route("/")
def serve_root():
    return redirect("/page/home")


@app.route("/login.html")
def serve_login_page():
    return send_from_directory(FRONTEND_DIR, "login.html")


@app.route("/register.html")
def serve_register_page():
    return send_from_directory(FRONTEND_DIR, "register.html")


@app.route("/dashboard.html")
def serve_dashboard_page():
    return send_from_directory(FRONTEND_DIR, "dashboard.html")


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


@app.route("/pricing.html")
def serve_pricing_page():
    return send_from_directory(FRONTEND_DIR, "pricing.html")


@app.route("/notifications.html")
def serve_notifications_page():
    return send_from_directory(FRONTEND_DIR, "notifications.html")


@app.route("/contact.html")
def serve_contact_page():
    return send_from_directory(FRONTEND_DIR, "contact.html")


@app.route("/page/<slug>")
def serve_dynamic_page(slug):
    return send_from_directory(FRONTEND_DIR, "page.html")


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
            admin_role = "super_admin" if is_admin else ""

            cursor.execute("""
                INSERT INTO users (username, email, password, is_admin, admin_role, created_at, active_plan)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (username, email, hashed_password, is_admin, admin_role, now_str(), "Free"))
            conn.commit()

        return jsonify({"message": "User registered successfully"}), 201
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

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
            user = cursor.fetchone()

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not check_password_hash(user["password"], password):
            return jsonify({"error": "Invalid password"}), 401

        if login_as == "user" and bool(user["is_admin"]):
            return jsonify({"error": "Use admin login page for admin account"}), 403

        if login_as == "admin" and not bool(user["is_admin"]):
            return jsonify({"error": "Admin access required"}), 403

        access_token = create_access_token(
            identity=str(user["id"]),
            additional_claims={
                "username": user["username"],
                "email": user["email"],
                "is_admin": bool(user["is_admin"]),
                "admin_role": user["admin_role"] or ""
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
                "admin_role": user["admin_role"] or "",
                "active_plan": user["active_plan"] or "Free"
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/pricing-page", methods=["GET"])
def get_pricing_page():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM pricing_page ORDER BY id DESC LIMIT 1")
            page = cursor.fetchone()

            cursor.execute("SELECT * FROM pricing_plans ORDER BY price ASC")
            plans = cursor.fetchall()

        return jsonify({
            "title": page["title"] if page else "",
            "description": page["description"] if page else "",
            "plans": [
                {
                    "id": p["id"],
                    "name": p["name"],
                    "price": p["price"],
                    "duration_days": p["duration_days"],
                    "description": p["description"],
                    "features": parse_json_field(p["features"], [])
                }
                for p in plans
            ]
        })
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

    try:
        start_time = time.time()
        response = requests.request(method=method, url=url, headers=headers, json=body, timeout=30)
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
                now_str()
            ))
            conn.commit()

        return jsonify({
            "status_code": response.status_code,
            "headers": dict(response.headers),
            "response": response_content,
            "response_time_ms": response_time_ms
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/history", methods=["GET"])
@jwt_required()
def get_history():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM history WHERE user_id = ? ORDER BY id DESC", (current_user_id(),))
            rows = cursor.fetchall()
        return jsonify([dict(row) for row in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/collections", methods=["GET"])
@jwt_required()
def get_collections():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM collections WHERE user_id = ? ORDER BY id DESC", (current_user_id(),))
            rows = cursor.fetchall()
        return jsonify([dict(row) for row in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/save", methods=["POST"])
@jwt_required()
def save_collection():
    data = request.get_json() or {}
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO collections (user_id, name, method, url, headers, body, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                current_user_id(),
                data.get("name", "").strip(),
                data.get("method", "").strip().upper(),
                data.get("url", "").strip(),
                json.dumps(data.get("headers", {}) or {}),
                json.dumps(data.get("body", {}) or {}),
                now_str()
            ))
            conn.commit()
        return jsonify({"message": "Collection saved successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/purchase/checkout", methods=["POST"])
@jwt_required()
def create_purchase_checkout():
    data = request.get_json() or {}
    plan_id = data.get("plan_id")

    if not plan_id:
        return jsonify({"error": "Plan id is required"}), 400

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("SELECT * FROM pricing_plans WHERE id = ?", (plan_id,))
            plan = cursor.fetchone()
            if not plan:
                return jsonify({"error": "Plan not found"}), 404

            cursor.execute("SELECT username FROM users WHERE id = ?", (current_user_id(),))
            user = cursor.fetchone()

            purchase_reference = f"PAY-{int(time.time())}"

            cursor.execute("""
                INSERT INTO purchases (
                    user_id, username, plan_name, amount, status, payment_reference,
                    created_at, updated_at, purchase_date, start_date, expiry_date
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                current_user_id(),
                user["username"] if user else "-",
                plan["name"],
                str(plan["price"]),
                "pending",
                purchase_reference,
                now_str(),
                now_str(),
                now_str(),
                None,
                None
            ))
            purchase_id = cursor.lastrowid
            conn.commit()

        return jsonify({
            "message": "Checkout created",
            "purchase_id": purchase_id,
            "plan_id": plan["id"],
            "plan_name": plan["name"],
            "amount": plan["price"],
            "duration_days": plan["duration_days"]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/purchase/confirm/<int:purchase_id>", methods=["POST"])
@jwt_required()
def confirm_purchase(purchase_id):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("SELECT * FROM purchases WHERE id = ? AND user_id = ?", (purchase_id, current_user_id()))
            purchase = cursor.fetchone()
            if not purchase:
                return jsonify({"error": "Purchase not found"}), 404

            conn.commit()

        return jsonify({"message": "Purchase confirmed"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/my/purchases", methods=["GET"])
@jwt_required()
def get_my_purchases():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, plan_name, amount, status, payment_reference,
                       created_at, updated_at, purchase_date, start_date, expiry_date
                FROM purchases
                WHERE user_id = ?
                ORDER BY id DESC
            """, (current_user_id(),))
            rows = cursor.fetchall()

        return jsonify([dict(row) for row in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/me/profile", methods=["PUT"])
@jwt_required()
def update_my_profile():
    data = request.get_json() or {}
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE users
                SET username = ?, email = ?
                WHERE id = ?
            """, (
                data.get("username", "").strip(),
                data.get("email", "").strip().lower(),
                current_user_id()
            ))
            conn.commit()
        return jsonify({"message": "Profile updated successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/notifications", methods=["GET"])
@jwt_required()
def get_notifications():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT *
                FROM notifications
                WHERE user_id = ?
                ORDER BY id DESC
            """, (current_user_id(),))
            rows = cursor.fetchall()
        return jsonify([dict(row) for row in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/notifications/unread-count", methods=["GET"])
@jwt_required()
def get_unread_notification_count():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT COUNT(*) AS unread_count
                FROM notifications
                WHERE user_id = ? AND is_read = 0
            """, (current_user_id(),))
            row = cursor.fetchone()

        return jsonify({"unread_count": row["unread_count"] if row else 0})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/contact/query", methods=["POST"])
@jwt_required(optional=True)
def submit_query():
    data = request.get_json() or {}

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    subject = (data.get("subject") or "").strip()
    message = (data.get("message") or "").strip()

    if not name or not email or not subject or not message:
        return jsonify({"error": "All fields are required"}), 400

    try:
        user_id = get_jwt_identity()

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO queries (user_id, name, email, subject, message, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                int(user_id) if user_id else None,
                name,
                email,
                subject,
                message,
                "pending",
                now_str(),
                now_str()
            ))
            conn.commit()

        return jsonify({"message": "Query submitted successfully"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/<path:filename>")
def serve_static_file(filename):
    file_path = os.path.join(FRONTEND_DIR, filename)
    if os.path.isfile(file_path):
        return send_from_directory(FRONTEND_DIR, filename)
    return jsonify({"error": "File not found"}), 404


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)