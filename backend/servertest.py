# servertest.py
# -*- coding: utf-8 -*-

import os
import re
import json
import base64
import hashlib
import datetime, uuid
import traceback
from typing import Any, Dict, Iterable, List, Optional, Tuple

import pandas as pd
from pandas.core.series import sanitize_array
import pyodbc
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.backends import default_backend

# ------------------------------------------------------------------------------
# ENV
# ------------------------------------------------------------------------------
global env
env = "dev"
server     = os.environ.get("serverGFT")
database   = os.environ.get("databaseGFTSharePoint")
username   = os.environ.get("usernameSharePointGFT")
password   = os.environ.get("passwordSharePointGFT")
SQLaddress = os.environ.get("addressGFT")
ENCRYPTION_PASSPHRASE = os.environ.get("onboardPasscode") or "change-me"

# ------------------------------------------------------------------------------
# DB
# ------------------------------------------------------------------------------
def get_db_connection() -> pyodbc.Connection:
    """Connect to SQL Server using pyodbc (TrustServerCertificate enabled)."""
    conn_str = (
        f"DRIVER={SQLaddress};SERVER={server};DATABASE={database};"
        f"UID={username};PWD={password};TrustServerCertificate=yes;"
    )
    return pyodbc.connect(conn_str)

def rows_to_dicts(cursor: pyodbc.Cursor, rows: Iterable[Tuple]) -> List[Dict[str, Any]]:
    cols = [c[0] for c in cursor.description]
    return [dict(zip(cols, r)) for r in rows]

# ------------------------------------------------------------------------------
# Crypto (AES-256-CBC)
# ------------------------------------------------------------------------------
def _derive_key(passphrase: str, salt: bytes = b"static_salt_for_app_key_derivation") -> bytes:
    kdf = hashlib.pbkdf2_hmac("sha256", passphrase.encode("utf-8"), salt, 100000)
    return kdf[:32]

AES_KEY = _derive_key(ENCRYPTION_PASSPHRASE)

def encrypt_aes_cbc(value: Any) -> Optional[str]:
    if value is None:
        return None
    data = str(value).encode("utf-8")
    iv = os.urandom(16)
    cipher = Cipher(algorithms.AES(AES_KEY), modes.CBC(iv), backend=default_backend())
    enc = cipher.encryptor()
    padder = padding.PKCS7(algorithms.AES.block_size).padder()
    padded = padder.update(data) + padder.finalize()
    ct = enc.update(padded) + enc.finalize()
    return base64.b64encode(iv + ct).decode("utf-8")

def decrypt_aes_cbc(enc_b64: Any) -> Optional[str]:
    if enc_b64 is None:
        return None
    try:
        if not isinstance(enc_b64, str):
            return enc_b64
        raw = base64.b64decode(enc_b64)
        iv, ct = raw[:16], raw[16:]
        cipher = Cipher(algorithms.AES(AES_KEY), modes.CBC(iv), backend=default_backend())
        dec = cipher.decryptor()
        padded = dec.update(ct) + dec.finalize()
        unpad = padding.PKCS7(algorithms.AES.block_size).unpadder()
        plain = unpad.update(padded) + unpad.finalize()
        return plain.decode("utf-8")
    except Exception as e:
        print(f"[decrypt] failed: {e}")
        traceback.print_exc()
        return None

# ------------------------------------------------------------------------------
# Sanitization (defense-in-depth; we still use parametrized queries)
# ------------------------------------------------------------------------------
SQL_INJECTION_PATTERNS = re.compile(
    r"""(?ix)
        (?:--|;|/\*|\*/|'|"|
        \b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC|XP_CMDSHELL|BENCHMARK|SP_)\b|
        \b(OR|AND)\b\s*.*\b(EXISTS|SLEEP|WAITFOR\s+DELAY)\b)
    """
)

def sanitize_input(value: Any) -> Any:
    if isinstance(value, str):
        if SQL_INJECTION_PATTERNS.search(value):
            raise ValueError(f"Potential SQL injection detected in input: {value}")
        return value
    if isinstance(value, (list, tuple)):
        return [sanitize_input(v) for v in value]
    if isinstance(value, dict):
        return {k: sanitize_input(v) for k, v in value.items()}
    if isinstance(value, (int, float, bool, datetime.datetime, datetime.date)) or value is None:
        return value
    raise ValueError(f"Unsupported input type for SQL sanitization: {type(value)}")

# ------------------------------------------------------------------------------
# Role / Profile (MR_OnBoardRoleInfo)
# ------------------------------------------------------------------------------
def get_profile_by_username(username: str) -> Optional[Dict[str, Any]]:
    """Return the latest role row for a given username/UPN (case-insensitive)."""
    try:
        if not username:
            return None
        u = sanitize_input(username.strip().lower())

        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT TOP 1
                       display_name,
                       email,
                       role,
                       edited_by,
                       createdTime,
                       editTime,
                       role_id,
                       env,
                       password,
                       status,
                       ROW_ID
                FROM MR_OnBoardRoleInfo
                WHERE 
                   LOWER(display_name) = ?
                ORDER BY COALESCE(editTime, createdTime) DESC
                """,
                (u),
            )
            row = cur.fetchone()
            if not row:
                return None
            cols = [c[0] for c in cur.description]
            return dict(zip(cols, row))
    except Exception as e:
        print(f"[get_profile_by_username] {e}")
        traceback.print_exc()
        return None

def get_profile_by_id(username: str) -> Optional[Dict[str, Any]]:
    """Return the latest role row for a given username/UPN (case-insensitive)."""
    try:
        if not username:
            return None
        u = sanitize_input(username.strip().lower())

        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT TOP 1
                       display_name,
                       email,
                       role,
                       edited_by,
                       createdTime,
                       editTime,
                       env,
                       status,
                       role_id,
                       ROW_ID
                FROM MR_OnBoardRoleInfo
                WHERE LOWER(role_id) = ?
                ORDER BY COALESCE(editTime, createdTime) DESC
                """,
                (u),
            )
            row = cur.fetchone()
            if not row:
                return None
            cols = [c[0] for c in cur.description]
            return dict(zip(cols, row))
    except Exception as e:
        print(f"[get_profile_by_id] {e}")
        traceback.print_exc()
        return None

def get_profile_by_email(email: str, env: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Return the latest role row for a user email.
    If env is provided, scope the search to that environment.
    """
    try:
        if not email:
            return None

        with get_db_connection() as conn:
            cur = conn.cursor()

            where_clauses = ["email = ?"]
            params = [sanitize_input(email)]

            if env is not None and str(env).strip() != "":
                where_clauses.append("env = ?")
                params.append(sanitize_input(env))

            sql = f"""
                SELECT TOP 1
                    display_name,
                    email,
                    role,
                    edited_by,
                    createdTime,
                    editTime,
                    role_id,
                    env,
                    status,
                    ROW_ID
                FROM MR_OnBoardRoleInfo
                WHERE {" AND ".join(where_clauses)}
                ORDER BY
                    COALESCE(editTime, createdTime) DESC,
                    ROW_ID DESC
            """

            cur.execute(sql, tuple(params))
            row = cur.fetchone()
            if not row:
                return None

            cols = [c[0] for c in cur.description]
            return dict(zip(cols, row))

    except Exception as e:
        print(f"[get_profile_by_email] {e}")
        traceback.print_exc()
        return None

def get_all_roles() -> Optional[Dict[str, Any]]:
    """Return the latest role row for a user email."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT *
                FROM MR_OnBoardRoleInfo
                """
            )
            rows = cur.fetchall()
            if not rows:
                return []
            cols = [c[0] for c in cur.description]
            return [dict(zip(cols, r)) for r in rows]
    except Exception as e:
        print(f"[get_profile_by_email] {e}")
        traceback.print_exc()
        return None

def allowed_roles_for(role: str) -> List[str]:
    """Return same-or-below roles; 'simple' is special-cased elsewhere to self-only."""
    if role == "admin":
        return ["simple", "fr", "manager", "hr", "admin"]
    if role == "hr":
        return ["simple", "fr", "manager", "hr"]
    # Add other roles as needed
    return []

def get_roles_with_role(role: str) -> Optional[List[dict]]:
    """Return all rows from MR_OnBoardRoleInfo where role is in allowed roles."""
    try:
        allowed_roles = allowed_roles_for(role)
        if not allowed_roles:
            return []

        with get_db_connection() as conn:
            cur = conn.cursor()
            placeholders = ','.join(['?'] * len(allowed_roles))
            query = f"""
                SELECT *
                FROM MR_OnBoardRoleInfo 
                WHERE role IN ({placeholders})
            """
            cur.execute(query, allowed_roles)
            rows = cur.fetchall()
            if not rows:
                return []
            cols = [c[0] for c in cur.description]
            return [dict(zip(cols, r)) for r in rows]
    except Exception as e:
        print(f"[get_all_roles] {e}")
        traceback.print_exc()
        return None

def update_profile(
    *,
    email: str,
    role: str,
    edited_by: str,
    edit_time: str | None = None,
    createdTime: str | None = None,
    status: str | None = None,
    display_name: str | None = None,
    env: str | None = None,
    role_id: str | None = None,
) -> bool:
    """
    Update MR_OnBoardRoleInfo dynamically.
    Required: email, role, edited_by
    Optional: display_name, env, createdTime, edit_time, status
    If role_id provided, updates by role_id+email. Otherwise, update most recent row for that email.
    """
    try:
        if not edit_time:
            edit_time = datetime.datetime.utcnow().isoformat()

        # Always update these three
        set_cols = ["role = ?", "edited_by = ?", "editTime = ?"]
        params   = [
            sanitize_input(role),
            sanitize_input(edited_by),
            edit_time,
        ]

        # Optional params
        if status is not None:
            set_cols.append("status = ?")
            params.append(sanitize_input(status))

        if display_name is not None:
            set_cols.append("display_name = ?")
            params.append(sanitize_input(display_name))

        if env is not None:
            set_cols.append("env = ?")
            params.append(sanitize_input(env))

        if createdTime is not None:
            set_cols.append("createdTime = ?")
            params.append(createdTime)

        set_clause = ", ".join(set_cols)

        with get_db_connection() as conn:
            cur = conn.cursor()

            if role_id:
                # update specific record
                sql = f"""
                    UPDATE MR_OnBoardRoleInfo
                    SET {set_clause}
                    WHERE role_id = ? AND email = ?
                """
                params_final = params + [role_id, sanitize_input(email)]
            else:
                # update most recent row for this email
                sql = f"""
                    UPDATE MR_OnBoardRoleInfo
                    SET {set_clause}
                    WHERE email = ?
                      AND editTime = (
                          SELECT MAX(editTime)
                          FROM MR_OnBoardRoleInfo
                          WHERE email = ?
                      )
                """
                params_final = params + [sanitize_input(email), sanitize_input(email)]

            cur.execute(sql, tuple(params_final))
            conn.commit()
            return cur.rowcount > 0

    except Exception as e:
        print(f"[update_profile] {e}")
        traceback.print_exc()
        return False

def insert_profile( display_name: str, email: str, role: str, edited_by: str, createdTime: str, edit_time: str, password: str, status: str, role_id: Optional[uuid.UUID] = None, env: str = "dev" ) -> bool:
    """Insert a new role row (audit table semantics). Skip role_id if None."""
    try:
        if not edit_time:
            edit_time = datetime.datetime.utcnow()

        with get_db_connection() as conn:
            cur = conn.cursor()
            if role_id:
                # Insert with role_id
                cur.execute(
                    """
                    INSERT INTO MR_OnBoardRoleInfo 
                        (display_name, email, role, edited_by, role_id, createdTime, editTime, env, password, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        sanitize_input(display_name),
                        sanitize_input(email),
                        sanitize_input(role),
                        sanitize_input(edited_by),
                        role_id,
                        createdTime, edit_time,
                        sanitize_input(env),
                        sanitize_input(password),
                        sanitize_input(status),
                    ),
                )
            else:
                cur.execute(
                    """
                    INSERT INTO MR_OnBoardRoleInfo 
                        (display_name, email, role, edited_by, createdTime, editTime, env, password, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        sanitize_input(display_name),
                        sanitize_input(email),
                        sanitize_input(role),
                        sanitize_input(edited_by),
                        createdTime, edit_time,
                        sanitize_input(env),
                        sanitize_input(password),
                        sanitize_input(status),
                    ),
                )
                cur.execute("EXEC dbo.MR_UpdateSubmissionIds")
            conn.commit()
            return True

    except Exception as e:
        print(f"[insert_profile] {e}")
        traceback.print_exc()
        return False

def update_role_only(email: str, new_role: str) -> bool:
    """Update only the role field for a user identified by email."""
    try:
        edit_time = datetime.datetime.utcnow()
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                UPDATE MR_OnBoardRoleInfo
                SET role = ?, editTime = ?, status = ?
                WHERE email = ?
                """,
                (
                    sanitize_input(new_role),
                    edit_time, "stable",
                    sanitize_input(email),
                ),
            )
            conn.commit()
            return True
    except Exception as e:
        print(f"[update_role_only] {e}")
        traceback.print_exc()
        return False

def delete_all_profiles(reseed_identity: bool = False, env: str = "dev"):
    """
    Delete rows from [dbo].[MR_OnBoardRoleInfo] for the given env.
    Treat NULL env as the provided env (via COALESCE). Returns (ok, deleted_count, message).
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()

            table_name = "[dbo].[MR_OnBoardRoleInfo]"

            # Parameterized query; treat NULL as provided env
            q = f"DELETE FROM {table_name} WHERE COALESCE(env, ?) = ?"
            cur.execute(q, (env, env))
            deleted = cur.rowcount
            msg = f"Deleted {deleted} row(s) from {table_name} where env='{env}'."

            if reseed_identity:
                # Reseed identity after deletion (if the table has one)
                bare = table_name.replace("[dbo].[", "dbo.").replace("]", "")
                reseed_sql = (
                    "IF EXISTS (SELECT 1 FROM sys.identity_columns "
                    f"WHERE object_id = OBJECT_ID('{bare}')) "
                    f"DBCC CHECKIDENT('{bare}', RESEED, 0)"
                )
                cur.execute(reseed_sql)
                msg += " Identity reseeded to 0."

            conn.commit()
            print(msg)
            return True, deleted, msg

    except Exception as e:
        print(f"[delete_all_profiles] {e}")
        traceback.print_exc()
        return False, None, str(e)


def delete_profile_by_email(email: str, env: str | None = None):
    """
    Hard-delete rows from [dbo].[MR_OnBoardRoleInfo] by email.
    If env is provided, match rows where COALESCE(env, env_param) = env_param.
    Case-insensitive match on email.

    Returns: (ok: bool, deleted_count: int | None, message: str)
    """
    if not email:
        return False, None, "Email is required"

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()

            table_name = "[dbo].[MR_OnBoardRoleInfo]"

            if env is None:
                # No env filter — delete by email only (case-insensitive)
                sql = f"""
                    DELETE FROM {table_name}
                    WHERE LOWER(email) = LOWER(?)
                """
                params = (email,)
            else:
                # With env filter; treat NULL env as provided env (COALESCE)
                sql = f"""
                    DELETE FROM {table_name}
                    WHERE LOWER(email) = LOWER(?)
                      AND COALESCE(env, ?) = ?
                """
                params = (email, env, env)

            cur.execute(sql, params)
            deleted = cur.rowcount
            conn.commit()

            msg = (f"Deleted {deleted} row(s) from {table_name} "
                   f"for email='{email}'" + (f" and env='{env}'." if env is not None else "."))
            print(msg)
            return True, deleted, msg

    except Exception as e:
        print(f"[delete_profile_by_email] {e}")
        traceback.print_exc()
        return False, None, str(e)

def _as_uuid_or_none(val: Optional[str]) -> Optional[uuid.UUID]:
    if not val:
        return None
    try:
        return uuid.UUID(str(val))
    except Exception:
        # make deterministic GUID from string (email, idhash, etc.)
        return uuid.uuid5(uuid.NAMESPACE_URL, str(val))

def seed_roles_from_users_json(path: str = None, env: str = None, dedupe: bool = True) -> dict:
    path = path or os.getenv("USERS_DB_PATH", "users.json")
    env  = env  or os.getenv("APP_ENV", "dev")

    summary = {"file": path, "env": env, "total": 0, "inserted": 0, "skipped": 0, "failed": 0, "failures": []}

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        users = list(data.values()) if isinstance(data, dict) else list(data)
        summary["total"] = len(users)
        seen_emails = set()

        for idx, u in enumerate(users):
            try:
                email = (u.get("email") or "").strip().lower()
                if not email:
                    summary["failed"] += 1
                    summary["failures"].append({"index": idx, "reason": "missing email"})
                    continue

                if email in seen_emails:
                    summary["skipped"] += 1
                    continue
                seen_emails.add(email)

                display_name = (u.get("display_name") or u.get("name") or email.split("@")[0]).strip()
                # Keep role handling consistent with DB defaults
                role = (u.get("role") or "simple").strip()
                edited_by_raw = (u.get("edited_by") or email).strip()

                role_id = _as_uuid_or_none(u.get("role_id") or u.get("idhash") or u.get("id") or None)

                edited_by = edited_by_raw

                createdTime = u.get("createdTime")
                edit_time    = u.get("editTime")
                password     = u.get("password")
                status = u.get("status").strip()

                if dedupe:
                    # Make sure this filters by env and prefers latest edit_time
                    current = get_profile_by_email(email, env=env)
                    if current and \
                       (current.get("display_name") or "").strip() == display_name and \
                       (current.get("role") or "").strip().lower() == role.lower():
                        summary["skipped"] += 1
                        continue

                ok = insert_profile(
                    display_name=display_name,
                    email=email,
                    role=role,
                    edited_by=edited_by,
                    createdTime=createdTime,
                    edit_time=edit_time,
                    env=env,
                    role_id=role_id,
                    password=password,
                    status=status
                )

                if ok:
                    summary["inserted"] += 1
                else:
                    summary["failed"] += 1
                    summary["failures"].append({"index": idx, "reason": "upsert_profile returned False"})

            except Exception as e:
                summary["failed"] += 1
                summary["failures"].append({"index": idx, "reason": f"{type(e).__name__}: {e}"})
                traceback.print_exc()

    except Exception as e:
        summary["failed"] += 1
        summary["failures"].append({"index": None, "reason": f"{type(e).__name__}: {e}"})
        traceback.print_exc()

    print(f"[seed] file={summary['file']} env={summary['env']} -> inserted={summary['inserted']} skipped={summary['skipped']} failed={summary['failed']}")
    return summary

def elevate_all_roles_to_admin(env: str = "dev", include_null_env: bool = True, only_if_not_admin: bool = True, limit: int | None = None, dry_run: bool = False) -> dict:
    """
    Set role='admin' for all rows in MR_OnBoardRoleInfo for the given env.
    Treat NULL env as the target env when include_null_env=True.
    Optionally only update rows that aren't already admin.
    """
    table = "[dbo].[MR_OnBoardRoleInfo]"
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()

            # Build WHERE
            where_env = "COALESCE(env, ?) = ?" if include_null_env else "env = ?"
            params = [env, env] if include_null_env else [env]

            if only_if_not_admin:
                where_env += " AND (role IS NULL OR LTRIM(RTRIM(LOWER(role))) <> 'admin')"

            # Preview: how many would be affected?
            preview_sql = f"SELECT COUNT(*) FROM {table} WHERE {where_env}"
            cur.execute(preview_sql, tuple(params))
            (would_update,) = cur.fetchone()

            # Optionally limit (by role_id descending just to be deterministic)
            limit_clause = ""
            if limit and limit > 0:
                limit_clause = f" TOP ({int(limit)}) "

            # Do the update
            update_sql = f"""
                UPDATE{limit_clause} {table}
                SET role = 'admin', editTime = SYSDATETIME()
                WHERE {where_env}
            """

            updated = 0
            if not dry_run:
                cur.execute(update_sql, tuple(params))
                updated = cur.rowcount
                conn.commit()

            return {
                "env": env,
                "include_null_env": include_null_env,
                "only_if_not_admin": only_if_not_admin,
                "limit": limit,
                "dry_run": dry_run,
                "would_update": int(would_update),
                "updated": int(updated),
                "message": ("Dry run (no changes)." if dry_run else f"Updated {updated} row(s).")
            }
    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}

# trial run never run again
# delete_all_profiles(env = "dev")
# print(delete_profile_by_email( "sam@corp.local", env="prod"))
# print(delete_profile_by_email( "nancy@guardianfueltech.com", env="prod"))
# print(delete_profile_by_email( "maya@corp.local", env="prod"))
# print(delete_profile_by_email( "sam@corp.local", env="prod"))


# seed_roles_from_users_json(path="users.json", env="dev", dedupe=True)
# print(seed_roles_from_users_json(path="microusers.json", env="dev", dedupe=True))
# print(elevate_all_roles_to_admin(env="prod", dry_run=False))
# print(get_all_roles())

# ------------------------------------------------------------------------------
# Task Categories (MR_OnBoardCategory)
# ------------------------------------------------------------------------------
def load_task_categories(env: str = None) -> Dict[str, Dict[str, Any]]:
    """
    Build a dict keyed by event_key (e.g. 'EmployeeID_Requested') from MR_OnBoardCategory.
    If env is provided, filter by it.
    """
    q = """
        SELECT event_key, env, short_code, task_type, name_prefix, assignedTo, description,
               to_email, to_phone, email_subject, email_body_template
        FROM MR_OnBoardCategory
    """
    params: Tuple = ()
    if env:
        q += " WHERE env = ?"
        params = (sanitize_input(env),)

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(q, params)
            rows = rows_to_dicts(cur, cur.fetchall())
            out = {}
            for r in rows:
                out[r["event_key"]] = r
            return out
    except Exception as e:
        print(f"[load_task_categories] {e}")
        traceback.print_exc()
        return {}

def handle_db_exception(ctx: str, e: Exception, default):
    """Handle DB exceptions differently in dev vs prod."""
    if env == "dev":
        # Raise full error stack so Flask route catches & returns JSON
        raise
    else:
        print(f"[{ctx}] {e}")
        traceback.print_exc()
        return default

# ------------------------------------------------------------------------------
# Tasks (MR_OnBoardTask)  — all JSON/in-memory code removed
# ------------------------------------------------------------------------------
TASK_TABLE = "MR_OnBoardTask"

def compose_task_id(onboarding_id: uuid.UUID, short_code: str) -> str:
    return f"ONB-{onboarding_id}-{short_code}"

# def _row_to_json_safe(cursor, row) -> Dict[str, Any]:
#     """Zip row to dict and convert datetimes to ISO strings so it can be JSON-serialized."""
#     cols = [c[0] for c in cursor.description]
#     obj = dict(zip(cols, row))
#     for k, v in obj.items():
#         if isinstance(v, (datetime.date, datetime.datetime)):
#             obj[k] = v.isoformat()
#         # add other conversions here if needed (e.g., Decimal -> float)
#     return obj

def list_all_tasks_simple() -> List[Dict[str, Any]]:
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(f"""
                SELECT task_id, name, description, task_type, assignedTo, employee_full_name,
                       related_onboarding_id, manager, onboarding_id, to_email, to_phone,
                       Status, created_at, updated_at, submission_id, env, Row_ID
                FROM {TASK_TABLE}
                ORDER BY created_at DESC
            """)
            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()

            # Convert rows -> list of dicts
            tasks = [dict(zip(columns, row)) for row in rows]

            # ✅ Ensure unique task_id (in case of query engine differences)
            unique_tasks = []
            seen = set()
            for task in tasks:
                tid = str(task.get("task_id")).strip()
                if tid and tid not in seen:
                    seen.add(tid)
                    unique_tasks.append(task)

            print(f"[list_all_tasks_simple] ✅ Retrieved {len(unique_tasks)} unique tasks")
            return unique_tasks
    except Exception as e:
        print(f"[list_all_tasks_simple] ⚠️ Error: {e}")
    return handle_db_exception("list_all_tasks_simple", e, [])
# print(list_all_tasks_simple())

def find_task_by_id(task_id: str) -> Optional[Dict[str, Any]]:
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                f"SELECT * FROM {TASK_TABLE} WHERE task_id = ?",
                (sanitize_input(task_id),),
            )
            row = cur.fetchone()
            return dict(zip([c[0] for c in cur.description], row)) if row else None
    except Exception as e:
        return handle_db_exception("find_task_by_id", e, [])

def db_find_task(employee_full_name: str, task_type: str, related_onboarding_id: uuid.UUID) -> Optional[Dict[str, Any]]:
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                f"""
                SELECT TOP 1 *
                FROM {TASK_TABLE}
                WHERE employee_full_name = ? AND task_type = ? AND related_onboarding_id = ?
                ORDER BY updated_at DESC
                """,
                (sanitize_input(employee_full_name), sanitize_input(task_type), related_onboarding_id),
            )
            row = cur.fetchone()
            return dict(zip([c[0] for c in cur.description], row)) if row else None
    except Exception as e:
        return handle_db_exception("db_find_task", e, [])

def db_insert_task(task: Dict[str, Any]) -> bool:
    cols = [
        "task_id","name","description","task_type","assignedTo","employee_full_name",
        "related_onboarding_id","manager","onboarding_id","to_email","to_phone","Status",
        "created_at","updated_at","submission_id"
    ]
    now = datetime.datetime.utcnow()
    task = {**task}
    task.setdefault("Status", "Open")
    task.setdefault("created_at", now)
    task.setdefault("updated_at", now)
    values = [task.get(c) for c in cols]
    q = f"""
        INSERT INTO {TASK_TABLE} ({", ".join("[" + c + "]" for c in cols)})
        VALUES ({", ".join("?" for _ in cols)})
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(q, tuple(values))
            conn.commit()
            print(f"[db_insert_task] inserted {task.get('task_id')}")
            return True
    except Exception as e:
        return handle_db_exception("db_insert_task", e, [])

def update_task_in_db_list(task_id: str, fields: Dict[str, Any]) -> bool:
    if not fields:
        return True
    fields = {k: v for k, v in fields.items() if k.lower() != "task_id"}
    fields["updated_at"] = datetime.datetime.utcnow()
    sets = ", ".join(f"[{k}] = ?" for k in fields.keys())
    vals = list(fields.values()) + [task_id]
    q = f"UPDATE {TASK_TABLE} SET {sets} WHERE task_id = ?"
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(q, tuple(vals))
            conn.commit()
            return cur.rowcount > 0
    except Exception as e:
        return handle_db_exception("update_task_in_db_list", e, [])
        return False

def remove_task_by_id(task_id: str) -> bool:
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(f"DELETE FROM {TASK_TABLE} WHERE task_id = ?", (task_id,))
            conn.commit()
            return cur.rowcount > 0
    except Exception as e:
        return handle_db_exception("remove_task_by_id", e, [])

# ------------------------------------------------------------------------------
# OnBoardRequestForm CRUD (with PayRate encryption in DB / decryption on read)
# ------------------------------------------------------------------------------
def get_onboard_all() -> pd.DataFrame:
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM OnBoardRequestForm")
            rows = cur.fetchall()
            cols = [c[0] for c in cur.description]
            df = pd.DataFrame.from_records(rows, columns=cols)

        if "PayRate" in df.columns:
            def safe_decrypt(x):
                try:
                    return decrypt_aes_cbc(str(x)) if x is not None else None
                except Exception:
                    return None
            df["PayRate"] = df["PayRate"].apply(safe_decrypt)
            df = df[df["PayRate"].notna()]
            df["PayRate"] = pd.to_numeric(df["PayRate"], errors="coerce")
        return df
    except Exception as e:
        return handle_db_exception("get_onboard_all", e, [])
        
# pd.set_option('display.max_rows', None)
# pd.set_option('display.max_columns', None)
# print(get_onboard_all())

def get_onboard_request_by_id(submission_id: uuid) -> Optional[Dict[str, Any]]:
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM OnBoardRequestForm WHERE submission_id = ?", (submission_id,))
            row = cur.fetchone()
            if not row:
                return None
            record = dict(zip([c[0] for c in cur.description], row))
            if "PayRate" in record:
                dec = decrypt_aes_cbc(str(record["PayRate"]))
                if not dec:
                    record.pop("PayRate", None)
                else:
                    try:
                        record["PayRate"] = float(dec) if "." in dec else int(dec)
                    except Exception:
                        record["PayRate"] = dec
            return record
    except Exception as e:
        return handle_db_exception("get_onboard_request_by_id", e, [])
        
def insert_onboard_request(request_data: Dict[str, Any]) -> Optional[int]:
    try:
        # Copy request data and filter out primary key fields
        request_data = {
            k: v
            for k, v in (request_data or {}).items()
            if isinstance(k, str) and k.lower() not in {"id", "submission_id"}
        }

        # Add timestamps
        now = datetime.datetime.utcnow()
        request_data["UpdatedAt"] = now
        request_data["CreatedAt"] = now

        # Sanitize data
        sanitized = {}
        for k, v in request_data.items():
            if k.lower() == "payrate":
                sanitized[k] = encrypt_aes_cbc(str(v))
            elif k.lower() == "email":
                sanitized[k] = str(v).strip()
            else:
                sanitized[k] = sanitize_input(v)

        valid_columns = [
        "Type",
        "adminSpField",
        "ProjectedStartDate",
        "LegalFirstName",
        "LegalMiddleName",
        "LegalLastName",
        "Suffix",
        "employee_email",
        "PositionTitle",
        "Manager",
        "Department",
        "Location",
        "PayRateType",
        "PayRate",
        "AdditionType",
        "env",
        "IsReHire",
        "IsDriver",
        "EmployeeID_Requested",
        "PurchasingCard_Requested",
        "GasCard_Requested",
        "EmailAddress_Provided",
        "MobilePhone_Requested",
        "TLCBonusEligible",
        "NoteField",
        "Createdby",
        "CreatedAt",
        "UpdatedAt",
        ]
        global env
        sanitized["env"] = env

        # 3️⃣ Rebuild in the exact order of valid_columns
        sanitized = {col: sanitized[col] for col in valid_columns if col in sanitized}

        # Build SQL
        cols = ", ".join(f"[{k}]" for k in sanitized.keys())
        vals = ", ".join("?" for _ in sanitized)
        sql = f"INSERT INTO OnBoardRequestForm ({cols}) VALUES ({vals})"

        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, tuple(sanitized.values()))
            print(sql, tuple(sanitized.values()))

            # If table has an identity column, fetch new ID
            new_id = None
            try:
                cur.execute("SELECT SCOPE_IDENTITY()")
                new_id = cur.fetchone()[0]
            except Exception:
                pass

            conn.commit()
            return new_id

    except Exception as e:
        print(f"[insert_onboard_request] {e}")
        traceback.print_exc()
        raise
    
def update_onboard_request(submission_id: uuid.UUID, update_data: Dict[str, Any]) -> bool:
    try:
        # 1️⃣ Normalize incoming keys (trim whitespace etc.)
        cleaned = {
            (k.strip() if isinstance(k, str) else k): v
            for k, v in update_data.items()
        }

        # 2️⃣ Remove Id/submission_id from being updated
        cleaned = {
            k: v
            for k, v in cleaned.items()
            if not (isinstance(k, str) and k.lower() in {"Id","submission_id"})
        }

        # 3️⃣ Server-side timestamp
        cleaned["UpdatedAt"] = datetime.datetime.now(datetime.timezone.utc)

        # 4️⃣ Sanitize each value
        sanitized: Dict[str, Any] = {}
        for k, v in cleaned.items():
            if not isinstance(k, str):
                continue
            key_norm = k.lower()
            if key_norm == "payrate":
                sanitized[k] = encrypt_aes_cbc(str(v))
            elif key_norm in {"email", "employee_email", "emailaddress_provided"}:
                sanitized[k] = str(v).strip()
            else:
                sanitized[k] = sanitize_input(v)

        # 5️⃣ Full column whitelist (explicitly defined for safety)
        valid_columns = [
            "Type",
            "adminSpField",
            "ProjectedStartDate",
            "LegalFirstName",
            "LegalMiddleName",
            "LegalLastName",
            "Suffix",
            "employee_email",
            "PositionTitle",
            "Manager",
            "Department",
            "Location",
            "PayRateType",
            "PayRate",
            "AdditionType",
            "env",
            "IsReHire",
            "IsDriver",
            "EmployeeID_Requested",
            "PurchasingCard_Requested",
            "GasCard_Requested",
            "EmailAddress_Provided",
            "MobilePhone_Requested",
            "TLCBonusEligible",
            "NoteField",
            "Createdby",
            "CreatedAt",
            "UpdatedAt",
        ]

        # 6️⃣ Keep only known columns
        sanitized = {k: v for k, v in sanitized.items() if k in valid_columns}

        if not sanitized:
            print("⚠️ No valid fields to update.")
            return False

        # 7️⃣ Construct SQL safely
        set_clause = ", ".join(f"[{col}] = ?" for col in sanitized.keys())
        sql = f"""
        UPDATE OnBoardRequestForm
        SET {set_clause}
        WHERE submission_id = ?
        """

        # Add parameters (in order)
        params = list(sanitized.values()) + [uuid.UUID(str(submission_id))]

        # 8️⃣ Execute
        with get_db_connection() as conn:
            cur = conn.cursor()
            print(f"[SQL EXEC]: {sql}")
            print(f"[PARAMS]: {tuple(params)}")
            cur.execute(sql, tuple(params))
            conn.commit()
            ok = (cur.rowcount or 0) > 0
        return ok

    except Exception as e:
        print(f"[update_onboard_request] {e}")
        traceback.print_exc()
        raise

def delete_onboard_request(id: int) -> bool:
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM OnBoardRequestForm WHERE submission_id = ?", (sanitize_input(id),))
            conn.commit()
            return cur.rowcount > 0
    except Exception as e:
        print(f"[delete_onboard_request] {e}")
        traceback.print_exc()
        return False

# ------------------------------------------------------------------------------
# Employee Status Changes table (encrypt selected columns)
# ------------------------------------------------------------------------------
def manage_EmployeeStatusChanges(request_data: Dict[str, Any]) -> Tuple[bool, str]:
    op = "UPDATE" if request_data.get("SubmissionID") else "INSERT"
    processed = request_data.copy()
    for col in ["CurrentRate_E", "NewRate_E"]:
        if col in processed and processed[col] is not None:
            processed[col] = encrypt_aes_cbc(processed[col])
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            if op == "INSERT":
                cols = [c for c in processed.keys() if c not in ["SubmissionID", "SubmittedAt"]]
                q = f"""
                    INSERT INTO [dbo].[EmployeeStatusChanges] ({", ".join("[" + c + "]" for c in cols)})
                    VALUES ({", ".join("?" for _ in cols)})
                """
                cur.execute(q, tuple(processed[c] for c in cols))
                conn.commit()
                return True, "Record inserted successfully."
            else:
                sid = processed.pop("SubmissionID")
                cols = [c for c in processed.keys() if c != "SubmittedAt"]
                sets = ", ".join(f"[{c}] = ?" for c in cols)
                q = f"UPDATE [dbo].[EmployeeStatusChanges] SET {sets} WHERE [SubmissionID] = ?"
                cur.execute(q, tuple(processed[c] for c in cols) + (sid,))
                conn.commit()
                if cur.rowcount == 0:
                    return False, f"No record found with SubmissionID: {sid}."
                return True, f"Record {sid} updated."
    except Exception as e:
        print(f"[manage_EmployeeStatusChanges] {e}")
        traceback.print_exc()
        return False, f"Error during {op}: {e}"

# ------------------------------------------------------------------------------
# Orchestration: create/update tasks based on onboarding flags
# Uses MR_OnBoardCategory rows as the source-of-truth (falls back to TASK_CONFIG if table empty)
# ------------------------------------------------------------------------------
# Optional local fallback (kept minimal; you can delete if Category table is fully populated)
FALLBACK_TASK_CONFIG: Dict[str, Dict[str, Any]] = {}

def _get_category_map(env: Optional[str] = None) -> Dict[str, Dict[str, Any]]:
    m = load_task_categories(env=env)
    return m if m else FALLBACK_TASK_CONFIG

def _create_task_payload(onboarding_id: uuid.UUID, employee_full_name: str, manager_name: str,
                         config_row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "task_id": compose_task_id(onboarding_id, config_row["short_code"]),
        "name": f"{config_row['name_prefix']} {employee_full_name}",
        "description": f"{config_row['description']} (Onboarding ID: {onboarding_id})",
        "task_type": config_row["task_type"],
        "assignedTo": config_row["assignedTo"],
        "employee_full_name": employee_full_name,
        "related_onboarding_id": onboarding_id,
        "manager": manager_name,
        "onboarding_id": onboarding_id,
        "to_email": config_row.get("to_email"),
        "to_phone": config_row.get("to_phone"),
        "Status": "Open",
    }

def manage_onboarding_tasks(onboarding_request_data: Dict[str, Any], env: Optional[str] = None) -> None:
    """
    New version: writes tasks to MR_OnBoardTask, creates or updates as needed.
    Uses MR_OnBoardCategory to know which flags -> which tasks.
    """
    emp_first = onboarding_request_data.get("LegalFirstName", "N/A")
    emp_last  = onboarding_request_data.get("LegalLastName", "N/A")
    employee_full_name = f"{emp_first} {emp_last}".strip()
    submission_id = onboarding_request_data.get("submission_id")
    manager_name  = onboarding_request_data.get("Manager", "N/A")

    if submission_id is None:
        print("manage_onboarding_tasks: missing onboarding Id")
        return

    cat = _get_category_map(env)
    print(f"--- Managing tasks for ONB {submission_id} ({employee_full_name}) ---")

    for flag_field, cfg in cat.items():
        requested = str(onboarding_request_data.get(flag_field, "False")).lower() in ("true", "1", "yes")
        existing = db_find_task(employee_full_name, cfg["task_type"], submission_id)

        if requested:
            payload = _create_task_payload(submission_id, employee_full_name, manager_name, cfg)
            if not existing:
                db_insert_task(payload)
            else:
                # Re-open or just refresh details/manager
                fields = {"Status": "Open", "manager": manager_name}
                update_task_in_db_list(existing["task_id"], fields)
        else:
            # Not requested: if exists and active -> mark N/A
            if existing and existing.get("Status") not in ("N/A", "Cancelled", "Completed"):
                update_task_in_db_list(existing["task_id"], {
                    "Status": "N/A",
                    "description": f"{existing['description']} (No longer required)"
                })

def seed_tasks_from_json_simple(path: str = None, skip_existing: bool = True) -> dict:
    """
    Read tasks from tasks.json (array) and insert straight into MR_OnBoardTask.
    Minimal aliasing:
      - if 'id' present and 'task_id' missing -> task_id = id
      - if 'submissionid' present and 'submission_id' missing -> submission_id = submissionid
    """
    path = path or os.getenv("TASKS_JSON_PATH", "tasks.json")
    summary = {"file": path, "total": 0, "inserted": 0, "skipped": 0, "failed": 0, "failures": []}

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, list):
            raise ValueError("tasks.json must be an array of task objects")
        summary["total"] = len(data)

        for i, task in enumerate(data):
            try:
                # minimal aliasing so DB columns line up
                if "task_id" not in task and "id" in task:
                    task["task_id"] = task["id"]
                if "submission_id" not in task and "submissionid" in task:
                    task["submission_id"] = task["submissionid"]

                # optionally skip if already exists
                if skip_existing:
                    existing = find_task_by_id(task.get("task_id"))
                    if existing:
                        summary["skipped"] += 1
                        continue

                ok = db_insert_task(task)
                if ok:
                    summary["inserted"] += 1
                else:
                    summary["failed"] += 1
                    summary["failures"].append({"index": i, "reason": "db_insert_task returned False"})
            except Exception as e:
                summary["failed"] += 1
                summary["failures"].append({"index": i, "reason": f"{type(e).__name__}: {e}"})
                traceback.print_exc()

    except Exception as e:
        summary["failed"] += 1
        summary["failures"].append({"index": None, "reason": f"{type(e).__name__}: {e}"})
        traceback.print_exc()

    print(f"[seed_tasks_from_json_simple] file={summary['file']} inserted={summary['inserted']} skipped={summary['skipped']} failed={summary['failed']}")
    return summary
# seed_tasks_from_json_simple("tasks.json", skip_existing=True)

def manage_tasks_after_submission_update(onboarding_id: uuid.UUID, updated_submission: Dict[str, Any], env: Optional[str] = None) -> None:
    """
    Called after an UPDATE to OnBoardRequestForm — keeps tasks in sync with changed data.
    """
    # load current request to get names if not provided
    record = get_onboard_request_by_id(onboarding_id) or {}
    # prefer new values if present
    emp_first = updated_submission.get("LegalFirstName", record.get("LegalFirstName", ""))
    emp_last  = updated_submission.get("LegalLastName", record.get("LegalLastName", ""))
    employee_full_name = f"{emp_first} {emp_last}".strip()
    manager_name = updated_submission.get("Manager", record.get("Manager", "N/A"))

    # run the same orchestration using merged fields
    merged = {**record, **updated_submission, "submission_id": onboarding_id}
    manage_onboarding_tasks(merged, env=env)

    # Ensure name/manager updates propagate to all tasks for this onboarding_id
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                f"UPDATE {TASK_TABLE} SET employee_full_name = ?, manager = ?, updated_at = ? WHERE related_onboarding_id = ?",
                (employee_full_name, manager_name, datetime.datetime.utcnow(), onboarding_id),
            )
            conn.commit()
    except Exception as e:
        print(f"[manage_tasks_after_submission_update] propagate names failed: {e}")
        traceback.print_exc()

# ------------------------------------------------------------------------------
# Paylocity / employee directory SP (unchanged)
# ------------------------------------------------------------------------------
def CF_SP_Emp_Detail_Search(search_term: Optional[str] = None) -> pd.DataFrame:
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            term = sanitize_input(search_term) if search_term is not None else None
            cur.execute("EXEC [GPReporting].[dbo].[CF_SP_Emp_Detail_Search] ?", (term,))
            rows = cur.fetchall()
            cols = [c[0] for c in cur.description]
            return pd.DataFrame.from_records(rows, columns=cols)
    except Exception as e:
        print(f"[CF_SP_Emp_Detail_Search] {e}")
        traceback.print_exc()
        return pd.DataFrame()

# ------------------------------------------------------------------------------
# (Optional) tiny smoke tests when running directly
# ------------------------------------------------------------------------------
if __name__ == "__main__":
    print("servertest.py loaded.")
    # Example: print latest role for an email
    # prof = get_profile_by_email("someone@guardianfueltech.com")
    # print(prof)
