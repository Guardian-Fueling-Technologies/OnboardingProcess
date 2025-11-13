# not used
# jwt_utils.py
import os, time
from datetime import datetime, timedelta
import jwt  # PyJWT

JWT_SECRET   = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ISSUER   = os.getenv("JWT_ISSUER", "velia-api")
JWT_AUDIENCE = os.getenv("JWT_AUDIENCE", "velia-client")
ALG          = "HS256"
ACCESS_TTL_MIN = int(os.getenv("ACCESS_TTL_MIN", "15"))
REFRESH_TTL_DAYS = int(os.getenv("REFRESH_TTL_DAYS", "7"))

def _now(): return datetime.utcnow()

def _make_token(sub: str, claims: dict, minutes: int) -> str:
    iat = _now()
    exp = iat + timedelta(minutes=minutes)
    payload = {
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "iat": int(iat.timestamp()),
        "nbf": int(iat.timestamp()),
        "exp": int(exp.timestamp()),
        "sub": sub,
        **(claims or {})
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=ALG)

def make_access_token(user_id: str, role: str, extra: dict | None = None) -> str:
    return _make_token(user_id, {"role": role, **(extra or {})}, ACCESS_TTL_MIN)

def make_refresh_token(user_id: str) -> str:
    minutes = REFRESH_TTL_DAYS * 24 * 60
    return _make_token(user_id, {"typ": "refresh"}, minutes)

def decode_token(token: str) -> dict:
    return jwt.decode(
        token,
        JWT_SECRET,
        algorithms=[ALG],
        audience=JWT_AUDIENCE,
        options={"require": ["exp","iat","nbf","iss","aud","sub"]}
    )
