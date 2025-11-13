# users_rbac.py
from __future__ import annotations

from flask import jsonify, request
from typing import Dict, Any, Optional
import datetime
import traceback

from servertest import (
    get_profile_by_email,
    insert_profile,   # <-- audit INSERT
)

# ----------------------------------------------------------------------
# Permissions / Roles
# ----------------------------------------------------------------------
PERMISSIONS = {
    "READ_SELF":        "read:self",
    "READ_ALL":         "read:all",
    "USER_CREATE":      "user:create",
    "USER_EDIT":        "user:edit",
    "USER_EDIT_OWN":    "user:edit:own",
    "ROLE_EDIT":        "roles:edit",
    "TASK_VIEW":        "task:view",
    "TASK_EDIT_STATUS": "task:edit:status",
    "TASK_EDIT":        "task:edit",
}

ROLE_PERMISSIONS = {
    "simple":  {PERMISSIONS["READ_SELF"], PERMISSIONS["TASK_VIEW"]},
    "fr":      {PERMISSIONS["READ_SELF"], PERMISSIONS["TASK_VIEW"], PERMISSIONS["TASK_EDIT_STATUS"], PERMISSIONS["USER_EDIT_OWN"]},
    "manager": {PERMISSIONS["READ_SELF"], PERMISSIONS["TASK_VIEW"], PERMISSIONS["USER_CREATE"], PERMISSIONS["USER_EDIT_OWN"]},
    "hr":      {
        PERMISSIONS["READ_SELF"], PERMISSIONS["READ_ALL"],
        PERMISSIONS["TASK_VIEW"], PERMISSIONS["TASK_EDIT_STATUS"], PERMISSIONS["TASK_EDIT"],
        PERMISSIONS["USER_CREATE"], PERMISSIONS["USER_EDIT"], PERMISSIONS["ROLE_EDIT"]
    },
    "admin":   set(PERMISSIONS.values()),
}

def _perms_for_role(role: Optional[str]) -> set:
    return ROLE_PERMISSIONS.get((role or "simple").lower(), ROLE_PERMISSIONS["simple"])

# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------
def _effective_profile(email: str) -> Dict[str, Any]:
    prof = get_profile_by_email(email) or {}
    role = (prof.get("role") or "simple").strip().lower()
    display = prof.get("display_name") or email.split("@")[0]
    return {
        "email": email,
        "display_name": display,
        "role": role,
        "permissions": list(_perms_for_role(role)),
        "editTime": prof.get("editTime"),
        "createdTime": prof.get("createdTime"),
        "env": prof.get("env") or "dev",
    }

def current_user_from_request() -> Optional[Dict[str, Any]]:
    email = (request.headers.get("X-User-Email") or "").strip().lower()
    if not email:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer email:"):
            email = auth.split("Bearer email:", 1)[1].strip().lower()
    if not email:
        email = (request.args.get("email") or "").strip().lower()
    if not email:
        return None
    try:
        return _effective_profile(email)
    except Exception as e:
        print("[current_user_from_request] error:", e)
        traceback.print_exc()
        return None

def require_login():
    user = current_user_from_request()
    if not user:
        return None, (jsonify({"error": "unauthorized"}), 401)
    return user, None

def can(user: Dict[str, Any], *needed: str) -> bool:
    return set(needed).issubset(set(user.get("permissions", [])))

# ----------------------------------------------------------------------
# Routes
# ----------------------------------------------------------------------
def register_user_routes(app):

    @app.get("/api/users/me")
    def users_me():
        user, err = require_login()
        if err: return err
        return jsonify(user)

    @app.get("/api/users/<path:email>")
    def users_get(email: str):
        user, err = require_login()
        if err: return err

        target_email = email.strip().lower()
        if not target_email:
            return jsonify({"error": "invalid email"}), 400

        if user["email"] != target_email and not can(user, PERMISSIONS["READ_ALL"]):
            return jsonify({"error": "forbidden"}), 403

        prof = get_profile_by_email(target_email)
        if not prof:
            return jsonify({"error": "not found"}), 404
        return jsonify(prof)

    @app.post("/api/users")
    def users_create():
        user, err = require_login()
        if err: return err
        if not can(user, PERMISSIONS["USER_CREATE"]):
            return jsonify({"error": "forbidden"}), 403

        data = request.get_json(silent=True) or {}
        display = (data.get("display_name") or data.get("name") or "").strip()
        email   = (data.get("email") or "").strip().lower()
        role    = (data.get("role") or "simple").strip().lower()
        env     = (data.get("env") or "dev").strip()

        if not email:
            return jsonify({"error": "email is required"}), 400
        if not display:
            display = email.split("@")[0]
        if role not in ROLE_PERMISSIONS:
            role = "simple"

        now_iso = datetime.datetime.utcnow().isoformat()
        ok = insert_profile(
            display_name=display,
            email=email,
            role=role,
            edited_by=(user.get("display_name") or user.get("email") or email),
            created_time=data.get("createdTime") or now_iso,
            edit_time=data.get("editTime") or now_iso,
            password=data.get("password") or "",
            status=("stable").strip().lower(),
            role_id=data.get("role_id"),
            env=env,
        )
        if not ok:
            return jsonify({"error": "failed to persist profile"}), 500
        return jsonify(_effective_profile(email)), 201

    @app.delete("/api/users/<path:email>")
    def users_delete(email: str):
        # Deactivation by inserting a new audit row with role 'simple' + status 'inactive'
        user, err = require_login()
        if err: return err
        if not can(user, PERMISSIONS["USER_EDIT"]):
            return jsonify({"error": "forbidden"}), 403

        target_email = email.strip().lower()
        if not target_email:
            return jsonify({"error": "invalid email"}), 400

        current = _effective_profile(target_email)
        now_iso = datetime.datetime.utcnow().isoformat()
        ok = insert_profile(
            display_name=current["display_name"],
            email=target_email,
            role="simple",
            edited_by=(user.get("display_name") or user.get("email") or target_email),
            created_time=now_iso,
            edit_time=now_iso,
            password="",
            status="stable",
            role_id=None,
            env=current.get("env") or "dev",
        )
        if not ok:
            return jsonify({"error": "failed to persist deactivation"}), 500
        return jsonify({"ok": True, "email": target_email, "role": "simple", "status": "inactive"})