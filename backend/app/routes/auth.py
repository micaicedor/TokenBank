import secrets
from datetime import UTC, datetime, timedelta

from flask import Blueprint, jsonify, request
from werkzeug.security import check_password_hash

from app.db import db

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


def utcnow():
    return datetime.now(UTC).replace(tzinfo=None)


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    username = data.get("username")
    password = data.get("password")
    if not username or not password:
        return jsonify({"error": "Faltan username y password"}), 400

    user = db.users.find_one({"username": username, "active": True})
    if not user or not check_password_hash(user["passwordHash"], password):
        return jsonify({"error": "Credenciales invalidas"}), 401

    now = utcnow()
    session_token = secrets.token_urlsafe(32)
    db.sessions.insert_one({
        "token": session_token,
        "userId": user["_id"],
        "revoked": False,
        "createdAt": now,
        "expiresAt": now + timedelta(hours=8)
    })

    return jsonify({
        "sessionToken": session_token,
        "tokenId": user["tokenId"],
        "role": user["role"],
        "privateKey": user.get("privateKey"),
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "username": user["username"],
            "role": user["role"],
            "balance": user["balance"],
            "tokenId": user["tokenId"]
        }
    }), 200
