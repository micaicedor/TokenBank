from flask import Blueprint, jsonify, request
from app.db import db
from datetime import UTC, datetime
from pymongo.errors import DuplicateKeyError
from werkzeug.security import generate_password_hash

users_bp = Blueprint("users", __name__, url_prefix="/users")


def utcnow():
    return datetime.now(UTC).replace(tzinfo=None)


@users_bp.route("", methods=["POST"])
def create_user():
    data = request.get_json(silent=True) or {}

    required_fields = ["name", "username", "password", "role", "balance", "tokenId"]

    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Falta el campo: {field}"}), 400

    if data["role"] not in ["payer", "merchant"]:
        return jsonify({"error": "El rol debe ser payer o merchant"}), 400

    try:
        balance = float(data["balance"])
    except (TypeError, ValueError):
        return jsonify({"error": "El balance debe ser numerico"}), 400

    if balance < 0:
        return jsonify({"error": "El balance no puede ser negativo"}), 400

    existing_user = db.users.find_one({"username": data["username"]})
    if existing_user:
        return jsonify({"error": "El usuario ya existe"}), 409

    existing_token = db.users.find_one({"tokenId": data["tokenId"]})
    if existing_token:
        return jsonify({"error": "El tokenId ya existe"}), 409

    user = {
        "name": data["name"],
        "username": data["username"],
        "passwordHash": generate_password_hash(data["password"]),
        "role": data["role"],
        "balance": balance,
        "tokenId": data["tokenId"],
        "publicKey": data.get("publicKey"),
        "active": True,
        "createdAt": utcnow(),
        "updatedAt": utcnow()
    }

    try:
        result = db.users.insert_one(user)
    except DuplicateKeyError:
        return jsonify({"error": "El username o tokenId ya existe"}), 409

    return jsonify({
        "message": "Usuario creado correctamente",
        "userId": str(result.inserted_id)
    }), 201


@users_bp.route("", methods=["GET"])
def list_users():
    users = []

    for user in db.users.find():
        users.append({
            "id": str(user["_id"]),
            "name": user["name"],
            "username": user["username"],
            "role": user["role"],
            "balance": user["balance"],
            "tokenId": user["tokenId"],
            "hasPublicKey": bool(user.get("publicKey")),
            "active": user["active"]
        })

    return jsonify(users), 200
