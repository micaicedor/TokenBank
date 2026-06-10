import base64
import json
import os
import sys
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.security import canonical_payment_payload


PAYER_PRIVATE_KEY = ROOT / "scripts" / "demo_keys" / "payer_private.pem"


def main():
    nonce = os.getenv("NONCE")
    if not nonce:
        print("Falta NONCE. Ejemplo:")
        print("NONCE=abc123 python scripts/sign_v2_postman_body.py")
        return

    payer_token_id = os.getenv("PAYER_TOKEN_ID", "PAYER_DEMO")
    merchant_token_id = os.getenv("MERCHANT_TOKEN_ID", "MERCHANT_DEMO")
    amount = float(os.getenv("PAYMENT_AMOUNT", "50"))
    capture_method = os.getenv("CAPTURE_METHOD", "QR")

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

    print(json.dumps({
        "merchantTokenId": merchant_token_id,
        "amount": amount,
        "captureMethod": capture_method,
        "nonce": nonce,
        "signature": base64.b64encode(signature).decode("utf-8")
    }, indent=2))


if __name__ == "__main__":
    main()
