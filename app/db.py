import os
from pymongo import MongoClient

mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/securepay")

client = MongoClient(mongo_uri)
db = client.get_database()


def init_indexes():
    db.users.create_index("username", unique=True)
    db.users.create_index("tokenId", unique=True)
    db.sessions.create_index("token", unique=True)
    db.sessions.create_index("expiresAt", expireAfterSeconds=0)
    db.nonces.create_index("nonce", unique=True)
    db.nonces.create_index("expiresAt", expireAfterSeconds=0)
    db.transactions.create_index("createdAt")
