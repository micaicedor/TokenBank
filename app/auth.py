from datetime import UTC, datetime
from functools import wraps

from flask import jsonify, request

from app.db import db


def utcnow():
    return datetime.now(UTC).replace(tzinfo=None)


def _extract_bearer_token():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    return auth_header.removeprefix("Bearer ").strip()


def get_current_user():
    token = _extract_bearer_token()
    if not token:
        return None

    session = db.sessions.find_one({
        "token": token,
        "revoked": False,
        "expiresAt": {"$gt": utcnow()}
    })
    if not session:
        return None

    return db.users.find_one({"_id": session["userId"], "active": True})


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Sesion invalida o expirada"}), 401
        return fn(user, *args, **kwargs)
    return wrapper
