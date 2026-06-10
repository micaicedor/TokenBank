import os
from datetime import UTC, datetime
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from dotenv import load_dotenv
from pymongo import MongoClient
from werkzeug.security import generate_password_hash


ROOT = Path(__file__).resolve().parents[1]
KEY_DIR = ROOT / "scripts" / "demo_keys"
PAYER_PRIVATE_KEY = KEY_DIR / "payer_private.pem"
MERCHANT_PRIVATE_KEY = KEY_DIR / "merchant_private.pem"


def utcnow():
    return datetime.now(UTC).replace(tzinfo=None)


def mongo_uri():
    load_dotenv(ROOT / ".env")
    uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/securepay?replicaSet=rs0")
    if "://mongo:" in uri and not Path("/.dockerenv").exists():
        uri = uri.replace("://mongo:", "://localhost:")
    return uri


def ensure_key_pair(private_key_path):
    KEY_DIR.mkdir(parents=True, exist_ok=True)
    if private_key_path.exists():
        private_key = serialization.load_pem_private_key(
            private_key_path.read_bytes(),
            password=None
        )
    else:
        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        private_key_path.write_bytes(private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        ))

    public_key_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    return public_key_pem.decode("utf-8")


def upsert_user(db, user):
    now = utcnow()
    password = user.pop("password")
    user = {
        **user,
        "passwordHash": generate_password_hash(password),
        "active": True,
        "updatedAt": now
    }
    db.users.update_one(
        {"username": user["username"]},
        {
            "$set": user,
            "$unset": {"password": ""},
            "$setOnInsert": {"createdAt": now}
        },
        upsert=True
    )
    return db.users.find_one({"username": user["username"]})


def main():
    client = MongoClient(mongo_uri())
    db = client.get_database()

    db.users.create_index("username", unique=True)
    db.users.create_index("tokenId", unique=True)

    payer_public_key = ensure_key_pair(PAYER_PRIVATE_KEY)
    merchant_public_key = ensure_key_pair(MERCHANT_PRIVATE_KEY)

    payer = upsert_user(db, {
        "name": "Pagador Demo",
        "username": "payer_demo",
        "password": "demo123",
        "role": "payer",
        "balance": 1000.0,
        "tokenId": "PAYER_DEMO",
        "publicKey": payer_public_key
    })
    merchant = upsert_user(db, {
        "name": "Comercio Demo",
        "username": "merchant_demo",
        "password": "demo123",
        "role": "merchant",
        "balance": 100.0,
        "tokenId": "MERCHANT_DEMO",
        "publicKey": merchant_public_key
    })

    db.sessions.delete_many({"userId": {"$in": [payer["_id"], merchant["_id"]]}})
    db.nonces.delete_many({"userId": payer["_id"]})
    db.transactions.delete_many({
        "$or": [
            {"payerTokenId": "PAYER_DEMO"},
            {"merchantTokenId": "MERCHANT_DEMO"}
        ]
    })

    print("Seed demo listo")
    print("Pagador:  username=payer_demo password=demo123 tokenId=PAYER_DEMO balance=1000")
    print("Comercio: username=merchant_demo password=demo123 tokenId=MERCHANT_DEMO balance=100")
    print(f"Private key V2 pagador: {PAYER_PRIVATE_KEY}")


if __name__ == "__main__":
    main()
