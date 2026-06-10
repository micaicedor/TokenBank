import base64
import json

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding


def canonical_payment_payload(payer_token_id, merchant_token_id, amount, capture_method, nonce):
    payload = {
        "amount": float(amount),
        "captureMethod": capture_method,
        "merchantTokenId": merchant_token_id,
        "nonce": nonce,
        "payerTokenId": payer_token_id
    }
    return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")


def verify_payment_signature(public_key_pem, message, signature_b64):
    try:
        public_key = serialization.load_pem_public_key(public_key_pem.encode("utf-8"))
        signature = base64.b64decode(signature_b64)
        public_key.verify(
            signature,
            message,
            padding.PKCS1v15(),
            hashes.SHA256()
        )
        return True
    except (ValueError, TypeError, InvalidSignature):
        return False
