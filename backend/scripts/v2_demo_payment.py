import base64
import json
import os
import sys
from pathlib import Path
from urllib import error, request

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.security import canonical_payment_payload


BASE_URL = os.getenv("TOKEN_BANK_URL", "http://127.0.0.1:5000")
PAYER_PRIVATE_KEY = ROOT / "scripts" / "demo_keys" / "payer_private.pem"


def request_json(method, path, payload=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    body = None
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")

    req = request.Request(
        f"{BASE_URL}{path}",
        data=body,
        headers=headers,
        method=method
    )

    try:
        with request.urlopen(req, timeout=10) as res:
            data = res.read().decode("utf-8")
            return res.status, json.loads(data) if data else {}
    except error.HTTPError as exc:
        data = exc.read().decode("utf-8")
        try:
            parsed = json.loads(data)
        except json.JSONDecodeError:
            parsed = {"raw": data}
        return exc.code, parsed


def print_response(title, status, body):
    print(f"\n{title} - HTTP {status}")
    print(json.dumps(body, indent=2, ensure_ascii=False))


def sign_payment(payer_token_id, merchant_token_id, amount, capture_method, nonce):
    private_key = serialization.load_pem_private_key(
        PAYER_PRIVATE_KEY.read_bytes(),
        password=None
    )
    message = canonical_payment_payload(
        payer_token_id,
        merchant_token_id,
        amount,
        capture_method,
        nonce
    )
    signature = private_key.sign(
        message,
        padding.PKCS1v15(),
        hashes.SHA256()
    )
    return base64.b64encode(signature).decode("utf-8")


def main():
    amount = float(os.getenv("PAYMENT_AMOUNT", "50"))
    capture_method = os.getenv("CAPTURE_METHOD", "QR")
    merchant_token_id = os.getenv("MERCHANT_TOKEN_ID", "MERCHANT_DEMO")

    if not PAYER_PRIVATE_KEY.exists():
        print("No existe la clave privada demo. Ejecuta primero:")
        print("docker compose exec token_bank python scripts/seed_demo.py")
        return

    login_status, login_body = request_json("POST", "/auth/login", {
        "username": os.getenv("PAYER_USERNAME", "payer_demo"),
        "password": os.getenv("PAYER_PASSWORD", "demo123")
    })
    print_response("Login", login_status, login_body)
    if login_status != 200:
        return

    session_token = login_body["sessionToken"]
    payer_token_id = login_body["tokenId"]

    nonce_status, nonce_body = request_json("POST", "/payments/v2/nonce", {}, session_token)
    print_response("Nonce", nonce_status, nonce_body)
    if nonce_status != 201:
        return

    payment_body = {
        "merchantTokenId": merchant_token_id,
        "amount": amount,
        "captureMethod": capture_method,
        "nonce": nonce_body["nonce"],
        "signature": sign_payment(
            payer_token_id,
            merchant_token_id,
            amount,
            capture_method,
            nonce_body["nonce"]
        )
    }

    payment_status, payment_response = request_json(
        "POST",
        "/payments/v2",
        payment_body,
        session_token
    )
    print_response("Pago V2", payment_status, payment_response)


if __name__ == "__main__":
    main()
