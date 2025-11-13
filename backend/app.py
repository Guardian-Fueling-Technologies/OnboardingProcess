
from functools import wraps
from nt import environ
from jwt_utils import make_access_token, make_refresh_token, decode_token
from flask import Blueprint, Flask, jsonify, request, send_from_directory, g
from flask_cors import CORS
import pandas as pd
import os, time, requests, jwt
from uuid import uuid4
import json 
from typing import Any, Dict
from datetime import datetime, date, timezone
import inspect

global env
env = "dev"
# --- Role hierarchy: higher number = higher privilege ---
ROLE_HIERARCHY = {
    "simple": 1,
    "fr": 2,
    "manager": 3,
    "hr": 4,
    "admin": 5,
}

def can_escalate(editor_role: str, target_status: str) -> bool:
    """
    Restrict escalation paths based on the editor's role.
    Example: HR cannot escalate 'To Admin', Manager cannot escalate 'To HR' or above.
    Returns True if allowed, False otherwise.
    """
    if not target_status:
        return True  # nothing to check

    # Extract target role from status string, e.g. "to admin" -> "admin"
    target_role = target_status.replace("to", "").strip().lower()

    editor_rank = ROLE_HIERARCHY.get(editor_role.lower(), 0)
    target_rank = ROLE_HIERARCHY.get(target_role.lower(), 0)

    # Admin can do anything
    if editor_role.lower() == "admin":
        return True

    # Others cannot escalate above their own rank
    return editor_rank >= target_rank

# Assuming you have get_onboard_all and other db utilities defined in servertest.py
from servertest import (
    get_onboard_all,
    FALLBACK_TASK_CONFIG,
    insert_onboard_request,
    update_onboard_request,
    delete_onboard_request,
    manage_EmployeeStatusChanges,
    compose_task_id,
    update_role_only,
    get_onboard_request_by_id,
    get_profile_by_id,
    find_task_by_id,
    get_profile_by_email,
    get_profile_by_username,
    insert_profile,
    update_profile,
    list_all_tasks_simple,
    remove_task_by_id,
    get_all_roles,
    get_roles_with_role,
    update_task_in_db_list,
    manage_onboarding_tasks,
    CF_SP_Emp_Detail_Search,
)
from users_rbac import register_user_routes
from functools import wraps

app = Flask(__name__,)
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "https://hrportal.guardianfueltech.com",   # ✅ add your production portal
        ],
        "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True,
    }
})

register_user_routes(app)

# --- A simplified token validation and decoding function ---
# Flask route
REDACT = {"password", "password_hash"}
def filter_by_env(result):
    """
    Applies an env filter to typical return types:
    - pandas.DataFrame (if it has 'env' column)
    - list[dict] (filters dicts that have 'env' == env_value; if no 'env' key, keep or drop per policy)
    - dict (returns {} if it has 'env' and doesn't match)
    - primitives / bool: returned unchanged
    """
    global env
    try:
        if isinstance(result, pd.DataFrame):
            if "env" in result.columns:
                return result[result["env"] == env]
            return result  # cannot filter if column doesn't exist

        if isinstance(result, list):
            # Only keep dict items where env matches (if 'env' key exists)
            filtered = []
            for it in result:
                if isinstance(it, dict):
                    if "env" not in it or it.get("env") == env:
                        filtered.append(it)
                else:
                    filtered.append(it)  # not a dict; keep as-is
            return filtered

        if isinstance(result, dict):
            if "env" in result and result.get("env") != env:
                return {}  # does not match current env
            return result
    except Exception:
        # Never let filtering crash a route
        return result

    return result  # non-filterable type

def select_with_env(fn):
    """
    Wrapper that:
      1) Tries to pass env as a kwarg if the function supports it.
      2) Post-filters the result by env for common return types.
    """
    @wraps(fn)
    def _inner(*args, **kwargs):
        # Try to pass env if the function signature includes it
        try:
            sig = inspect.signature(fn)
            if "env" in sig.parameters and "env" not in kwargs:
                kwargs["env"] = env
        except (ValueError, TypeError):
            # Builtins/c-extension funcs might not be introspectable
            pass

        result = fn(*args, **kwargs)
        return filter_by_env(result)
    return _inner

get_onboard_all          = select_with_env(get_onboard_all)
get_onboard_request_by_id = select_with_env(get_onboard_request_by_id)
get_profile_by_id        = select_with_env(get_profile_by_id)
get_profile_by_email     = select_with_env(get_profile_by_email)
get_profile_by_username  = select_with_env(get_profile_by_username)
get_all_roles            = select_with_env(get_all_roles)
get_roles_with_role      = select_with_env(get_roles_with_role)
CF_SP_Emp_Detail_Search  = select_with_env(CF_SP_Emp_Detail_Search)
list_all_tasks_simple    = select_with_env(list_all_tasks_simple)
find_task_by_id          = select_with_env(find_task_by_id)
def protected_route(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if request.method == "OPTIONS":
            return ("", 204)

        auth_header = request.headers.get("Authorization", "")
        # DEV: accept "Bearer demo:<uid>"
        if auth_header.lower().startswith("bearer demo:") or auth_header.startswith("Bearer :"):
            uid = auth_header.split(":", 1)[1].strip()
            if uid:
                g.user_claims = {"oid": uid, "name": uid, "auth": "dev-demo"}
                return f(*args, **kwargs)

        # Real JWT path...
        if not auth_header:
            return jsonify({"message": "Authorization header is missing"}), 401
        if not auth_header.lower().startswith("bearer "):
            return jsonify({"message": "Invalid token scheme"}), 401

        token = auth_header.split(" ", 1)[1].strip()
        if not token:
            return jsonify({"message": "Missing bearer token"}), 401

        user_claims = validate_and_decode_token(token) or {}
        if not user_claims:
            return jsonify({"message": "Invalid or expired token"}), 401

        g.user_claims = user_claims
        return f(*args, **kwargs)
    return wrapper

def _now():
    import datetime as dt
    return dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

# -------- 1) VERIFY TOKEN (Microsoft SSO) ----------
_JWKS_CACHE = {"ts": 0, "data": None}

def _jwks():
    if not _JWKS_CACHE["data"] or (time.time() - _JWKS_CACHE["ts"] > 3600):
        _JWKS_CACHE["data"] = requests.get("https://login.microsoftonline.com/3f55f1df-18ff-4c55-baac-79c960fb03e6/discovery/v2.0/keys", timeout=5).json()
        _JWKS_CACHE["ts"] = time.time()
    return _JWKS_CACHE["data"]

def verify_microsoft_id_token(id_token: str) -> dict:
    # pick the signing key
    hdr = jwt.get_unverified_header(id_token)
    key = next(k for k in _jwks()["keys"] if k["kid"] == hdr["kid"])
    pub = jwt.algorithms.RSAAlgorithm.from_jwk(key)

    # verify signature + audience
    claims = jwt.decode(
        id_token,
        key=pub,
        algorithms=["RS256"],
        audience="52e98c1f-5fdf-4da1-9780-51068c5bc14b",
        options={"verify_at_hash": False},
    )

    # confirm it's Microsoft issuer
    iss = claims.get("iss", "")
    if not iss.startswith("https://login.microsoftonline.com/"):
        raise ValueError("issuer is not Microsoft login")

    return claims

# -------- 2) CREATE / UPDATE USER FROM CLAIMS -------
def create_or_update_user_from_claims(claims: dict, env: str) -> dict:
    oid   = claims.get("oid") or claims.get("sub")

    email = (claims.get("preferred_username") or claims.get("email") or "").lower()
    name  = claims.get("name") or (email.split("@")[0] if email else "New User")
    if not oid:
        raise ValueError("missing oid/sub in ID token claims")
    if not email:
        raise ValueError("missing email in ID token claims")

    prof = get_profile_by_email(email)
    if not prof:
        now_iso = datetime.utcnow().isoformat()
        # seed a minimal row in the audit table
        ok = insert_profile(
            display_name=name,
            email=email,
            role="simple",
            edited_by=name,
            createdTime=now_iso,
            edit_time=now_iso,
            password="",           
            status="stable",
            # role_id=None,
            env=env,
        )
        if not ok:
            raise RuntimeError("failed to insert initial profile")
        prof = get_profile_by_email(email) or {}

    # normalize return
    return {
        "role_id":            prof.get("role_id"),
        "display_name":  prof.get("display_name"),
        "email":         prof.get("email"),
        "role":          prof.get("role"),
        "edited_by":      prof.get("edited_by"),
        "env":           prof.get("env") or env,
        "createdTime":   prof.get("createdTime") or prof.get("createdTime"),
        "status":        prof.get("status"),
        "editTime":      prof.get("editTime") or prof.get("edit_time"),
    }

# ---------- ROUTE THAT COMPOSES THE TWO -------------
@app.route("/api/auth/msal-login", methods=["POST"])
def msal_login():
    global env
    env = "prod"
    data = request.get_json(force=True) or {}
    id_token = data.get("idToken")
    if not id_token:
        return jsonify(error="missing idToken"), 400

    try:
        claims = verify_microsoft_id_token(id_token)
        user = create_or_update_user_from_claims(claims, env)
        return jsonify(user=user), 200
    except Exception as e:
        return jsonify(error=str(e)), 401

@app.route("/api/auth/local-login", methods=["POST"])
def local_login():
    """
    Dev/local login
    Body: { "username" or "email": "...", "password": "..." }
    Returns: { user: {...} } with id/display_name/email/role/etc.
    """
    try:
        global env
        env = "dev"
        body = request.get_json(silent=True) or {}
        userid   = (body.get("username")).strip().lower()
        password = body.get("password") or ""

        if not userid:
            return jsonify({"message": "username/email is required"}), 400

        # 1) Load the account from local users.json
        u = get_profile_by_username(userid)

        if not u:
            return jsonify({"message": "User not found"}), 404

        # 2) Only allow local provider here
        if u.get("provider", "local") != "local":
            return jsonify({"message": "This account uses SSO"}), 401

        # 3) Dev-only password check
        if "password" in u and u["password"] != password:
            return jsonify({"message": "Invalid password"}), 401

        # 4) Normalize fields from users.json
        email        = (u.get("email") or userid).lower()
        display_name = u.get("display_name") or u.get("name") or email.split("@")[0]
        role         = (u.get("role") or "simple").lower()

        # 6) Compose payload (frontend uses id for "Bearer demo:<id>")
        user = {
            "role_id": u.get("role_id"),
            "edited_by": u.get("edited_by"),
            "display_name": display_name,
            "email": email,
            "role": role,
            "auth_provider": "local",
            "env": env,
            "createdTime":u.get("createdTime"),
            "status": u.get("status"), 
            "editTime": u.get("editTime"),
        }
        return jsonify(user=user), 200

    except Exception as e:
        app.logger.exception("[/api/auth/local-login] error")
        return jsonify({"message": "internal server error"}), 500

@app.route("/api/submissions/count", methods=["GET"])
@protected_route
def get_submissions_count():
    try:
        # Only managers send Createdby param; HR/Admin skip it
        created_by = request.args.get("Createdby", type=str)
        if created_by:
            created_by = created_by.strip().lower()

        onboard_data = get_onboard_all()
        if getattr(onboard_data, "empty", True):
            return jsonify({"count": 0, "today": 0, "monthly": [0]*12}), 200

        # 🟢 Keep real column name from DB exactly as-is (Createdby)
        if created_by and "Createdby" in onboard_data.columns:
            onboard_data["Createdby"] = (
                onboard_data["Createdby"]
                .astype(str)
                .replace("None", "")
                .fillna("")
                .str.strip()
                .str.lower()
            )
            onboard_data = onboard_data[onboard_data["Createdby"] == created_by]

        app.logger.info(f"[DEBUG] Filter param Createdby={created_by}")
        app.logger.info(f"[DEBUG] Columns: {list(onboard_data.columns)}")
        app.logger.info(f"[DEBUG] Rows after filter: {len(onboard_data)}")

        today = datetime.now().date()
        current_year = today.year
        total = len(onboard_data)
        today_count = 0
        monthly = [0] * 12

        for _, row in onboard_data.iterrows():
            d = pd.to_datetime(row.get("CreatedAt"), errors="coerce")
            if pd.isna(d):
                continue
            if d.date() == today:
                today_count += 1
            if d.year == current_year:
                monthly[d.month - 1] += 1

        return jsonify({"count": total, "today": today_count, "monthly": monthly}), 200

    except Exception as e:
        app.logger.exception("Error in get_submissions_count: %s", e)
        return jsonify({"error": "Internal server error"}), 500

def _redact(u: dict) -> dict:
    return {k: v for k, v in u.items() if k not in REDACT}

@app.route("/api/users/<role>", methods=["PUT"])
def users_list_route(role):
    try:
        raw = get_roles_with_role(role)
        data = list(raw.values()) if isinstance(raw, dict) else raw
        return jsonify([_redact(u) for u in data]), 200
    except Exception as e:
        app.logger.exception(f"[users_list_route] {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route("/api/users/adminEdit", methods=["PUT"])
@protected_route
def edit_user_role():
    try:
        data = request.get_json(silent=True) or {}
        target_email = (data.get("email") or "").strip().lower()
        new_role = (data.get("new_role") or "").strip().lower()

        if not target_email or not new_role:
            return jsonify({"error": "Missing required fields"}), 400

        # 🧠 Load the current user's claims
        claims = getattr(g, "user_claims", {}) if hasattr(g, "user_claims") else {}

        # Dev/demo tokens only have oid + name
        editor_auth = claims.get("auth", "")
        editor_oid = claims.get("oid") or claims.get("sub") or ""
        editor_email = (
            claims.get("preferred_username")
            or claims.get("email")
            or claims.get("name")
            or ""
        ).lower()

        # ✅ Resolve profile correctly for each mode
        if editor_auth == "dev-demo":
            editor_profile = get_profile_by_id(editor_oid) if editor_oid else {}
        elif editor_email:
            editor_profile = get_profile_by_email(editor_email)
        else:
            editor_profile = {}

        editor_role = (editor_profile.get("role") or "").lower()

        app.logger.info(
            f"Editor {editor_email or editor_oid} ({editor_role}) → "
            f"Target {target_email} to '{new_role}'"
        )

        # 🔒 Restrict HR from escalating above HR
        if not can_escalate(editor_role, new_role):
            app.logger.warning(
                f"Blocked escalation attempt: {editor_email or editor_oid} "
                f"({editor_role}) → {target_email} ({new_role})"
            )
            return jsonify({
                "error": f"Permission denied: {editor_role.title()} cannot escalate users to '{new_role}'."
            }), 403

        success = update_role_only(email=target_email, new_role=new_role)
        if success:
            return jsonify({"message": "Role updated successfully"}), 200
        else:
            return jsonify({"error": "Failed to update role"}), 500

    except Exception as e:
        app.logger.exception(f"[edit_user_role] {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route("/api/user/by-email", methods=["PUT"])
def update_user_profile_by_email():
    try:
        body   = request.get_json(force=True) or {}
        email  = (body.get("email") or "").strip().lower()
        if not email:
            return jsonify(error="email is required"), 400

        role_in       = body.get("role") or body.get("appRole") or "user"
        role          = role_in.strip().lower()
        display_name  = (body.get("display_name") or body.get("name") or email.split("@")[0]).strip()
        status_in     = (body.get("status") or "").lower()

        claims    = getattr(g, "user_claims", {}) if hasattr(g, "user_claims") else {}
        edited_by = body.get("edited_by") or claims.get("name") or claims.get("preferred_username") or email
        env_val   = body.get("env") or env

        # Use provided timestamps or fallback to now
        now_iso    = datetime.now(timezone.utc).isoformat()
        createdTime = body.get("createdTime") or now_iso
        edit_time   = body.get("editTime") or body.get("edit_time") or now_iso

        # 🔒 Determine editor’s role for escalation checks
        editor_email = claims.get("preferred_username") or claims.get("name") or ""
        editor_profile = get_profile_by_email(editor_email) if editor_email else {}
        editor_role = (editor_profile.get("role") or "").lower()
        print(editor_email)
        # ✅ Restrict escalation paths
        if "to" in status_in:
            ok = update_profile(
                display_name=display_name,
                email=email,
                role=role,
                env=env_val,
                edited_by=edited_by,
                createdTime=createdTime,
                edit_time=edit_time,
                status=status_in,
            )
            if not ok:
                return jsonify(error="failed to persist profile"), 500
        
        prof = get_profile_by_email(email) or {}
    
        user = {
            "role_id":      prof.get("role_id"),
            "display_name": prof.get("display_name"),
            "email":        prof.get("email"),
            "role":         prof.get("role"),
            "edited_by":    prof.get("edited_by"),
            "env":          prof.get("env") or env,
            "createdTime":  prof.get("createdTime"),
            "status":       prof.get("status"),
            "editTime":     prof.get("editTime") or prof.get("edit_time"),
        }
        return jsonify(user), 200

    except Exception as e:
        app.logger.exception("[PUT /api/user/by-email] error: %s", e)
        return jsonify(error="internal server error"), 500


# In a real app, use a library like python-jose or PyJWT with cryptographic checks.
def validate_and_decode_token(token):
    """
    Validates the token's signature, expiry, and claims.
    Returns the decoded claims or None if validation fails.
    
    This is a conceptual placeholder. A production-ready function would:
    1. Fetch the public key from Microsoft's keys endpoint.
    2. Use a library like python-jose to decode and verify the token.
    3. Handle various errors (expired token, invalid signature, etc.).
    """
    try:
        # NOTE: This is for demonstration purposes ONLY. Do NOT use this in production.
        # It assumes the token is a standard JWT and a library would do the heavy lifting.
        # A real implementation would involve fetching jwks_uri and verifying the signature.
        import jwt # Example library to use
        
        # This is a placeholder for a real validation process
        # For example, with PyJWT, you'd do:
        # decoded_token = jwt.decode(token, key="your-key", algorithms=["RS256"], audience="your-app-id")
        
        # For now, we'll just parse the payload part of the JWT
        token_payload = token.split('.')[1]
        decoded_payload = json.loads(token_payload) # In a real scenario, this would be base64-decoded and parsed.
        return decoded_payload
        
    except Exception as e:
        app.logger.exception(f"Token validation failed: {e}")
        return None

@app.route("/api/submissions", methods=["GET"])
@protected_route
def get_submissions():
    global env
    claims = getattr(g, "user_claims", {})
    user_id = claims.get("oid") or claims.get("sub")
    if not user_id:
        return jsonify({"message": "User ID not found in token claims", "reason": "no_oid"}), 400

    try:
        created_by = request.args.get("created_by")
        onboard_data = get_onboard_all()
        if getattr(onboard_data, "empty", True):
            return jsonify({"message": "No submissions found", "env": env}), 200

        if created_by:
            # Normalize column names just once (in case of inconsistent casing)
            onboard_data.columns = [col.strip().lower() for col in onboard_data.columns]

            # Only filter if the column actually exists
            if "createdby" in onboard_data.columns or "create_by" in onboard_data.columns:
                col_name = "createdby" if "createdby" in onboard_data.columns else "create_by"
                onboard_data = onboard_data[onboard_data[col_name].str.strip().str.lower() == created_by.strip().lower()]
            else:
                app.logger.warning("No 'Createdby' or 'create_by' column in onboard_data")

        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page") or request.args.get("limit") or 20)
        page = max(1, page)
        per_page = max(1, per_page)

        total = len(onboard_data)

        total_pages = (total + per_page - 1) // per_page

        start = (page - 1) * per_page
        end = start + per_page
        paged_data = onboard_data.iloc[start:end]

        return jsonify({
            "items": paged_data.to_dict(orient="records"),
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": total_pages,
            "env": env,
        }), 200
    except Exception as e:
        app.logger.exception("Error in get_submissions route: %s", e)
        return jsonify({"error": "Internal server error"}), 500

# --- GET Submission by ID ---
@app.route('/api/submissions/<uuid:submission_id>', methods=['GET'])
def get_submission_by_id(submission_id):
    try:
        submission = get_onboard_request_by_id(submission_id)
        if submission:
            # Convert datetime objects in the dictionary to string for JSON serialization
            for key, value in submission.items():
                if isinstance(value, (datetime, date)):
                    submission[key] = value.isoformat()
            return jsonify(submission), 200
        else:
            return jsonify({"message": f"Submission with ID {submission_id} not found"}), 404
    except Exception as e:
        app.logger.exception(f"Error in get_submission_by_id route: {e}")
        return jsonify({"error": "Internal server error"}), 500

# --- CREATE Operation ---
# CREATE
@app.route('/api/submissions', methods=['POST'])
def add_submission():
    request_data = request.get_json(silent=True) or {}
    if not request_data:
        return jsonify({"error": "Invalid data: Request body must be JSON"}), 400
    try:
        new_id = insert_onboard_request(request_data)
        return jsonify({"message": "Submission created", "id": str(new_id)}), 201
    except Exception as e:
        app.logger.exception(f"Error in add_submission: {e}")
        return jsonify({"error": f"Internal server error: {e}"}), 500

# UPDATE
@app.route('/api/submissions', methods=['PUT'])
def update_submission():
    data = request.get_json(silent=True) or {}
    submission_id = data.get("submission_id")
    if not data:
        return jsonify({"error": "Invalid data: Request body must be JSON"}), 400
    try:
        ok = update_onboard_request(submission_id, data)
        if not ok:
            return jsonify({"error": f"Submission {submission_id} not found"}), 404
        return jsonify({"message": f"Submission {submission_id} updated"}), 200
    except Exception as e:
        if (env == "dev"):
            return jsonify({
                "error": str(e),         # human-readable error
                "details": repr(e)       # Python exception repr, optional
            }), 500
        else:
            app.logger.exception(f"Error in update_submission: {e}")
            return jsonify({"error": "Internal server error during update"}), 500


# --- Task-specific Endpoints (Now interacting with servertest.py's in-memory tasks_db) ---
@app.route('/api/tasks', methods=['GET'])
def get_all_tasks():
    """Returns all tasks currently in the in-memory database."""
    # tasks_db is now imported from servertest.py
    return jsonify(list_all_tasks_simple()), 200

@app.route('/api/tasks/<uuid:task_id>', methods=['GET'])
def get_task_by_id(task_id):
    tid = str(task_id)
    task = find_task_by_id(tid)
    if task:
        return jsonify(task), 200
    return jsonify({"message": "Task not found"}), 404

@app.route('/api/tasks/update', methods=['POST'])
def update_task_status():
    update_data = request.get_json(silent=True) or {}
    task_id = update_data.get("task_id")
    if not update_data:
        return jsonify({"error": "Invalid data: Request body must be JSON"}), 400

    if find_task_by_id(task_id):
        success = update_task_in_db_list(task_id, update_data)  # <-- pass id, fields
        if success:
            return jsonify({"message": f"Task {task_id} updated successfully"}), 200
        return jsonify({"error": "Failed to update task"}), 500
    return jsonify({"message": "Task not found"}), 404

@app.route('/api/tasks/<uuid:task_id>', methods=['DELETE'])
def delete_task(task_id):
    tid = str(task_id)
    app.logger.exception(f"Received request to DELETE task with ID: {tid}")
    success = remove_task_by_id(tid)
    if success:
        return jsonify({"message": "Task deleted successfully"}), 200
    return jsonify({"message": "Task not found"}), 404

@app.route('/api/employee-search', methods=['GET'])
def search_employees():
    """
    Searches for employee details using the CF_SP_Emp_Detail_Search function
    and returns matching records.
    Expects a 'term' query parameter (e.g., /api/employee-search?term=john).
    If 'term' is empty, it will be passed as an empty string to the search function.
    """
    search_term = request.args.get('term', '') # Default to empty string instead of None

    app.logger.exception(f"Received employee search request for term: '{search_term}'")
    if search_term:
        try:
            # Call the Python function to execute the stored procedure
            # The CF_SP_Emp_Detail_Search function is expected to handle empty strings
            employee_df = CF_SP_Emp_Detail_Search(search_term=search_term)

            if not employee_df.empty:
                # Convert DataFrame to a list of dictionaries for JSON response
                employees_list = employee_df.to_dict(orient='records')
                app.logger.exception(f"Found {len(employees_list)} employee(s) for term '{search_term}'.")
                return jsonify(employees_list), 200
            else:
                app.logger.exception(f"No employees found for term '{search_term}'.")
                return jsonify({"message": "No matching employees found"}), 404
        except Exception as e:
            app.logger.exception(f"Error during employee search: {e}")
            return jsonify({"message": f"An error occurred during search: {str(e)}"}), 500
    else:
        return jsonify({"message": "please enter params"}), 200
    
# ---- Employee Status Change (insert/update) ----
@app.route("/api/employee-status-change", methods=["POST"])
@protected_route 
def employee_status_change():
    """
    Upsert into [dbo].[EmployeeStatusChanges].
    - If body has no SubmissionID  -> INSERT (201 on success)
    - If body has SubmissionID     -> UPDATE (200 on success)

    Note: manage_EmployeeStatusChanges() already encrypts CurrentRate_E/NewRate_E
    and handles the SQL.
    """
    try:
        data = request.get_json(silent=True) or {}
        if not data:
            return jsonify({"ok": False, "error": "Empty or invalid JSON body."}), 400

        ok, msg = manage_EmployeeStatusChanges(data)

        if ok:
            status = 200 if data.get("SubmissionID") else 201
            return jsonify({"ok": True, "message": msg}), status

        # helper returned a failure with explanation in msg
        return jsonify({"ok": False, "error": msg}), 400

    except Exception as e:
        app.logger.exception("[/api/employee-status-change] error: %s", e)
        return jsonify({"ok": False, "error": "Internal server error"}), 500

if __name__ == '__main__':
    app.debug = True
    app.run(host='0.0.0.0', port=5000)