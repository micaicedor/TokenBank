import secrets
from datetime import UTC, datetime, timedelta

from bson import ObjectId
from flask import Blueprint, jsonify, request
from pymongo.errors import PyMongoError

from app.auth import login_required
from app.db import client, db
from app.security import canonical_payment_payload, verify_payment_signature

payments_bp = Blueprint("payments", __name__, url_prefix="/payments")


def utcnow():
    return datetime.now(UTC).replace(tzinfo=None)


class PaymentError(Exception):
    def __init__(self, message, status_code):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _parse_amount(value):
    try:
        amount = float(value)
    except (TypeError, ValueError):
        raise PaymentError("El monto debe ser numerico", 400)

    if amount <= 0:
        raise PaymentError("El monto debe ser mayor a cero", 400)
    return amount


def _require_fields(data, fields):
    for field in fields:
        if field not in data:
            raise PaymentError(f"Falta el campo: {field}", 400)


def _move_balance_in_session(session, payer_token_id, merchant_token_id, amount, version, capture_method, extra=None):
    extra = extra or {}
    now = utcnow()

    payer = db.users.find_one({
        "tokenId": payer_token_id,
        "role": "payer",
        "active": True
    }, session=session)
    merchant = db.users.find_one({
        "tokenId": merchant_token_id,
        "role": "merchant",
        "active": True
    }, session=session)

    if not payer:
        raise PaymentError("Pagador no encontrado", 404)
    if not merchant:
        raise PaymentError("Cobrador no encontrado", 404)

    payer_balance_before = float(payer["balance"])
    merchant_balance_before = float(merchant["balance"])

    if payer_balance_before < amount:
        raise PaymentError("Saldo insuficiente", 400)

    payer_update = db.users.update_one(
        {"_id": payer["_id"], "balance": {"$gte": amount}},
        {"$inc": {"balance": -amount}, "$set": {"updatedAt": now}},
        session=session
    )
    if payer_update.modified_count != 1:
        raise PaymentError("Saldo insuficiente", 400)

    db.users.update_one(
        {"_id": merchant["_id"]},
        {"$inc": {"balance": amount}, "$set": {"updatedAt": now}},
        session=session
    )

    payer_balance_after = payer_balance_before - amount
    merchant_balance_after = merchant_balance_before + amount

    transaction = {
        "payerId": payer["_id"],
        "merchantId": merchant["_id"],
        "payerTokenId": payer_token_id,
        "merchantTokenId": merchant_token_id,
        "amount": amount,
        "version": version,
        "captureMethod": capture_method,
        "status": "approved",
        "payerBalanceBefore": payer_balance_before,
        "payerBalanceAfter": payer_balance_after,
        "merchantBalanceBefore": merchant_balance_before,
        "merchantBalanceAfter": merchant_balance_after,
        "createdAt": now
    }
    transaction.update(extra)

    result = db.transactions.insert_one(transaction, session=session)
    return {
        "transactionId": str(result.inserted_id),
        "payerBalanceAfter": payer_balance_after,
        "merchantBalanceAfter": merchant_balance_after
    }


def _move_balance_atomic(payer_token_id, merchant_token_id, amount, version, capture_method, extra=None):
    def callback(session):
        return _move_balance_in_session(
            session,
            payer_token_id,
            merchant_token_id,
            amount,
            version,
            capture_method,
            extra
        )

    with client.start_session() as session:
        return session.with_transaction(callback)


@payments_bp.route("/v1", methods=["POST"])
def create_payment_v1():
    data = request.get_json(silent=True) or {}

    try:
        _require_fields(data, ["payerTokenId", "merchantTokenId", "amount", "captureMethod"])
        amount = _parse_amount(data["amount"])
        result = _move_balance_atomic(
            data["payerTokenId"],
            data["merchantTokenId"],
            amount,
            "V1",
            data["captureMethod"]
        )
    except PaymentError as exc:
        return jsonify({"error": exc.message}), exc.status_code
    except PyMongoError as exc:
        return jsonify({"error": "No se pudo registrar el pago", "detail": str(exc)}), 500

    return jsonify({
        "message": "Pago V1 aprobado",
        **result
    }), 201


@payments_bp.route("/v2/nonce", methods=["POST"])
@login_required
def create_payment_nonce(current_user):
    if current_user["role"] != "payer":
        return jsonify({"error": "Solo un pagador puede solicitar nonce"}), 403

    now = utcnow()
    nonce = secrets.token_urlsafe(24)
    expires_at = now + timedelta(minutes=5)

    db.nonces.insert_one({
        "nonce": nonce,
        "userId": current_user["_id"],
        "used": False,
        "createdAt": now,
        "expiresAt": expires_at
    })

    return jsonify({
        "nonce": nonce,
        "expiresAt": expires_at.isoformat()
    }), 201


@payments_bp.route("/v2", methods=["POST"])
@login_required
def create_payment_v2(current_user):
    data = request.get_json(silent=True) or {}

    try:
        if current_user["role"] != "payer":
            raise PaymentError("Solo un pagador puede crear pagos V2", 403)

        _require_fields(data, ["merchantTokenId", "amount", "captureMethod", "nonce", "signature"])
        amount = _parse_amount(data["amount"])

        public_key = current_user.get("publicKey")
        if not public_key:
            raise PaymentError("El usuario no tiene publicKey registrada", 400)

        message = canonical_payment_payload(
            current_user["tokenId"],
            data["merchantTokenId"],
            amount,
            data["captureMethod"],
            data["nonce"]
        )
        if not verify_payment_signature(public_key, message, data["signature"]):
            raise PaymentError("Firma invalida", 401)

        def callback(session):
            now = utcnow()
            nonce = db.nonces.find_one({
                "nonce": data["nonce"],
                "userId": current_user["_id"]
            }, session=session)

            if not nonce:
                raise PaymentError("Nonce no encontrado", 409)
            if nonce.get("used"):
                raise PaymentError("Nonce ya fue usado", 409)
            if nonce["expiresAt"] <= now:
                raise PaymentError("Nonce expirado", 409)

            nonce_update = db.nonces.update_one(
                {"_id": nonce["_id"], "used": False},
                {"$set": {"used": True, "usedAt": now}},
                session=session
            )
            if nonce_update.modified_count != 1:
                raise PaymentError("Nonce ya fue usado", 409)

            result = _move_balance_in_session(
                session,
                current_user["tokenId"],
                data["merchantTokenId"],
                amount,
                "V2",
                data["captureMethod"],
                {
                    "nonce": data["nonce"],
                    "signature": data["signature"]
                }
            )
            result["nonce"] = data["nonce"]
            return result

        with client.start_session() as session:
            result = session.with_transaction(callback)
    except PaymentError as exc:
        return jsonify({"error": exc.message}), exc.status_code
    except PyMongoError as exc:
        return jsonify({"error": "No se pudo registrar el pago V2", "detail": str(exc)}), 500

    return jsonify({
        "message": "Pago V2 aprobado",
        **result
    }), 201


@payments_bp.route("", methods=["GET"])
def list_payments():
    transactions = []

    for tx in db.transactions.find().sort("createdAt", -1):
        transactions.append({
            "id": str(tx["_id"]),
            "payerId": str(tx["payerId"]) if isinstance(tx.get("payerId"), ObjectId) else None,
            "merchantId": str(tx["merchantId"]) if isinstance(tx.get("merchantId"), ObjectId) else None,
            "payerTokenId": tx["payerTokenId"],
            "merchantTokenId": tx["merchantTokenId"],
            "amount": tx["amount"],
            "version": tx["version"],
            "captureMethod": tx["captureMethod"],
            "status": tx["status"],
            "nonce": tx.get("nonce"),
            "createdAt": tx["createdAt"].isoformat()
        })

    return jsonify(transactions), 200
