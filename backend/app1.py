from flask import Flask, redirect, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager, jwt_required, get_jwt, get_jwt_identity
import sqlite3
import json
import os
from datetime import timedelta, datetime

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


def current_user_is_admin():
    return bool(get_jwt().get("is_admin"))


def current_admin_role():
    return (get_jwt().get("admin_role") or "").strip()


def require_admin_roles(*roles):
    if not current_user_is_admin():
        return jsonify({"error": "Admin access required"}), 403
    if current_admin_role() not in roles:
        return jsonify({"error": "Permission denied"}), 403
    return None


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


@app.route("/")
def admin_root():
    return redirect("/admin-login.html")

@app.route("/admin-login.html")
def serve_admin_login():
    return send_from_directory(FRONTEND_DIR, "admin-login.html")



@app.route("/admin.html")
def serve_admin_dashboard():
    return send_from_directory(FRONTEND_DIR, "admin.html")


@app.route("/cms.html")
def serve_cms_page():
    return send_from_directory(FRONTEND_DIR, "cms.html")


@app.route("/admin-pricing.html")
def serve_admin_pricing():
    return send_from_directory(FRONTEND_DIR, "admin-pricing.html")


@app.route("/users.html")
def serve_users_page():
    return send_from_directory(FRONTEND_DIR, "users.html")

@app.route("/queries.html")
def serve_queries_page():
    return send_from_directory(FRONTEND_DIR, "queries.html")

@app.route("/settings.html")
def serve_settings_page():
    return send_from_directory(FRONTEND_DIR, "settings.html")

@app.route("/notifications.html")
def serve_notifications_page():
    return send_from_directory(FRONTEND_DIR, "notifications.html")


@app.route("/admin-roles.html")
def serve_admin_roles_page():
    return send_from_directory(FRONTEND_DIR, "admin-roles.html")



@app.route("/history.html")
def serve_history_page():
    return send_from_directory(FRONTEND_DIR, "history.html")

@app.route("/collections.html")
def serve_collections_page():
    return send_from_directory(FRONTEND_DIR, "collections.html")

@app.route("/purchases.html")
def serve_purchases_page():
    return send_from_directory(FRONTEND_DIR, "purchases.html")


@app.route("/dashboard/stats", methods=["GET"])
@jwt_required()
def dashboard_stats():
    role_error = require_admin_roles("super_admin")
    if role_error:
        return role_error

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("SELECT COUNT(*) AS total_users FROM users")
            total_users = cursor.fetchone()["total_users"]

            cursor.execute("SELECT COUNT(*) AS total_requests FROM history")
            total_requests = cursor.fetchone()["total_requests"]

            cursor.execute("SELECT COUNT(*) AS total_pages FROM pages")
            total_pages = cursor.fetchone()["total_pages"]

            cursor.execute("SELECT COUNT(*) AS total_purchases FROM purchases")
            total_purchases = cursor.fetchone()["total_purchases"]

        return jsonify({
            "total_users": total_users,
            "total_requests": total_requests,
            "total_pages": total_pages,
            "total_purchases": total_purchases
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/users", methods=["GET"])
@jwt_required()
def get_users():
    role_error = require_admin_roles("super_admin")
    if role_error:
        return role_error

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, username, email, is_admin, admin_role, created_at,
                       active_plan, plan_start_date, plan_expiry_date
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
    role_error = require_admin_roles("super_admin")
    if role_error:
        return role_error

    data = request.get_json() or {}
    username = data.get("username", "").strip()
    email = data.get("email", "").strip().lower()
    admin_role = data.get("admin_role", "").strip()

    allowed_roles = ["", "super_admin", "cms_admin", "pricing_admin"]
    if admin_role not in allowed_roles:
        return jsonify({"error": "Invalid admin role"}), 400

    is_admin = 1 if admin_role else 0

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE users
                SET username = ?, email = ?, is_admin = ?, admin_role = ?
                WHERE id = ?
            """, (username, email, is_admin, admin_role, user_id))
            conn.commit()

        return jsonify({"message": "User updated successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/users/<int:user_id>", methods=["DELETE"])
@jwt_required()
def delete_user(user_id):
    role_error = require_admin_roles("super_admin")
    if role_error:
        return role_error

    if current_user_id() == user_id:
        return jsonify({"error": "Admin cannot delete own account"}), 400

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
            conn.commit()
        return jsonify({"message": "User deleted successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/cms/pages", methods=["GET"])
@jwt_required()
def get_pages():
    role_error = require_admin_roles("super_admin", "cms_admin")
    if role_error:
        return role_error

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
    role_error = require_admin_roles("super_admin", "cms_admin")
    if role_error:
        return role_error

    data = request.get_json() or {}

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO pages (title, slug, content, status, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                data.get("title", "").strip(),
                data.get("slug", "").strip().lower(),
                data.get("content", "").strip(),
                data.get("status", "draft").strip().lower(),
                current_user_id(),
                now_str(),
                now_str()
            ))
            conn.commit()
        return jsonify({"message": "Page created successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/cms/pages/<int:page_id>", methods=["PUT"])
@jwt_required()
def update_page(page_id):
    role_error = require_admin_roles("super_admin", "cms_admin")
    if role_error:
        return role_error

    data = request.get_json() or {}

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE pages
                SET title = ?, slug = ?, content = ?, status = ?, updated_at = ?
                WHERE id = ?
            """, (
                data.get("title", "").strip(),
                data.get("slug", "").strip().lower(),
                data.get("content", "").strip(),
                data.get("status", "draft").strip().lower(),
                now_str(),
                page_id
            ))
            conn.commit()
        return jsonify({"message": "Page updated successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/cms/pages/<int:page_id>", methods=["DELETE"])
@jwt_required()
def delete_page(page_id):
    role_error = require_admin_roles("super_admin", "cms_admin")
    if role_error:
        return role_error

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM pages WHERE id = ?", (page_id,))
            conn.commit()
        return jsonify({"message": "Page deleted successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/admin/pricing-page", methods=["GET"])
@jwt_required()
def admin_get_pricing_page():
    role_error = require_admin_roles("super_admin", "pricing_admin")
    if role_error:
        return role_error

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM pricing_page ORDER BY id DESC LIMIT 1")
            page = cursor.fetchone()

            cursor.execute("SELECT * FROM pricing_plans ORDER BY id ASC")
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


@app.route("/admin/pricing-page", methods=["PUT"])
@jwt_required()
def admin_update_pricing_page():
    role_error = require_admin_roles("super_admin", "pricing_admin")
    if role_error:
        return role_error

    data = request.get_json() or {}
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM pricing_page ORDER BY id DESC LIMIT 1")
            row = cursor.fetchone()

            if row:
                cursor.execute("""
                    UPDATE pricing_page
                    SET title = ?, description = ?
                    WHERE id = ?
                """, (data.get("title", "").strip(), data.get("description", "").strip(), row["id"]))
            else:
                cursor.execute("""
                    INSERT INTO pricing_page (title, description)
                    VALUES (?, ?)
                """, (data.get("title", "").strip(), data.get("description", "").strip()))

            conn.commit()
        return jsonify({"message": "Pricing page updated successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/admin/pricing-plans/<int:plan_id>", methods=["PUT"])
@jwt_required()
def admin_update_pricing_plan(plan_id):
    role_error = require_admin_roles("super_admin", "pricing_admin")
    if role_error:
        return role_error

    data = request.get_json() or {}
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE pricing_plans
                SET name = ?, price = ?, duration_days = ?, description = ?, features = ?
                WHERE id = ?
            """, (
                data.get("name", "").strip(),
                data.get("price"),
                data.get("duration_days"),
                data.get("description", "").strip(),
                json.dumps(data.get("features", [])),
                plan_id
            ))
            conn.commit()
        return jsonify({"message": "Plan updated successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/admin/purchases", methods=["GET"])
@jwt_required()
def admin_get_purchases():
    role_error = require_admin_roles("super_admin", "pricing_admin")
    if role_error:
        return role_error
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT p.id, p.user_id, p.username, p.plan_name, p.amount, p.status,
                       p.payment_reference, p.created_at, p.updated_at,
                       p.purchase_date, p.start_date, p.expiry_date,
                       u.email, u.active_plan
                FROM purchases p
                LEFT JOIN users u ON p.user_id = u.id
                ORDER BY p.id DESC
            """)
            rows = cursor.fetchall()
        return jsonify([dict(row) for row in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/admin/purchases/remove/<int:purchase_id>", methods=["DELETE"])
@jwt_required()
def admin_remove_purchase(purchase_id):
    role_error = require_admin_roles("super_admin", "pricing_admin")
    if role_error:
        return role_error

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM purchases WHERE id = ?", (purchase_id,))
            conn.commit()
        return jsonify({"message": "Purchase removed successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/admin/queries", methods=["GET"])
@jwt_required()
def admin_get_queries():
    role_error = require_admin_roles("super_admin")
    if role_error:
        return role_error

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT *
                FROM queries
                ORDER BY id DESC
            """)
            rows = cursor.fetchall()

        return jsonify([dict(row) for row in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/admin/queries/latest", methods=["GET"])
@jwt_required()
def admin_get_latest_queries():
    role_error = require_admin_roles("super_admin")
    if role_error:
        return role_error

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, name, email, subject, message, status, created_at
                FROM queries
                ORDER BY id DESC
                LIMIT 5
            """)
            rows = cursor.fetchall()

        return jsonify([dict(row) for row in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/admin/queries/pending-count", methods=["GET"])
@jwt_required()
def admin_pending_queries_count():
    role_error = require_admin_roles("super_admin")
    if role_error:
        return role_error

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT COUNT(*) AS pending_count
                FROM queries
                WHERE status = 'pending'
            """)
            row = cursor.fetchone()

        return jsonify({"pending_count": row["pending_count"] if row else 0})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/admin/queries/<int:query_id>/solve", methods=["PUT"])
@jwt_required()
def admin_solve_query(query_id):
    role_error = require_admin_roles("super_admin")
    if role_error:
        return role_error

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE queries
                SET status = 'solved',
                    updated_at = ?
                WHERE id = ?
            """, (now_str(), query_id))
            conn.commit()

        return jsonify({"message": "Query marked as solved"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route("/admin/collections", methods=["GET"])
@jwt_required()
def admin_get_collections():
    role_error = require_admin_roles("super_admin")
    if role_error:
        return role_error
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT c.id, c.user_id, c.name, c.method, c.url, c.created_at,
                       u.username, u.email
                FROM collections c
                LEFT JOIN users u ON c.user_id = u.id
                ORDER BY c.id DESC
            """)
            rows = cursor.fetchall()
        return jsonify([dict(row) for row in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
    
@app.route("/admin/history", methods=["GET"])
@jwt_required()
def admin_get_history():
    role_error = require_admin_roles("super_admin")
    if role_error:
        return role_error
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT h.id, h.user_id, h.method, h.url, h.status_code,
                       h.response_time_ms, h.created_at,
                       u.username, u.email
                FROM history h
                LEFT JOIN users u ON h.user_id = u.id
                ORDER BY h.id DESC
            """)
            rows = cursor.fetchall()
        return jsonify([dict(row) for row in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True, use_reloader=False)