# not used yet
# auth_ms.py
import os, jwt
from jwt import PyJWKClient
from functools import wraps
from flask import request, jsonify, g
from app_config import Config

TENANT = os.getenv("AZURE_AD_TENANT_ID")
JWKS_URL = f"https://login.microsoftonline.com/{TENANT}/discovery/v2.0/keys"
ISSUER   = f"https://login.microsoftonline.com/{TENANT}/v2.0"
_jwks    = PyJWKClient(JWKS_URL)

def _decode_ms_token(token: str):
    key = _jwks.get_signing_key_from_jwt(token).key
    return jwt.decode(
        token, key, algorithms=["RS256"],
        audience=Config.AZURE_AD_AUDIENCE, issuer=ISSUER
    )

def require_auth(required_scope: str):
    def deco(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            auth = request.headers.get("Authorization", "")
            if not auth.startswith("Bearer "):
                return jsonify({"error":"missing bearer token"}), 401
            token = auth.split(" ",1)[1]
            try:
                claims = _decode_ms_token(token)
            except Exception as e:
                return jsonify({"error":"invalid token","detail":str(e)}), 401

            scopes = set((claims.get("scp") or "").split())
            roles  = set(claims.get("roles") or [])
            if required_scope not in scopes and required_scope not in roles:
                return jsonify({"error":"forbidden","need":required_scope}), 403

            g.ms_claims = claims
            return f(*args, **kwargs)
        return wrapper
    return deco
