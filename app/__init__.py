from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
from app.db import init_indexes

load_dotenv()

def create_app():
    app = Flask(__name__)
    CORS(app)
    init_indexes()

    from app.routes.health import health_bp
    app.register_blueprint(health_bp)

    from app.routes.auth import auth_bp
    app.register_blueprint(auth_bp)

    from app.routes.users import users_bp
    app.register_blueprint(users_bp)

    from app.routes.payments import payments_bp
    app.register_blueprint(payments_bp)

    return app
