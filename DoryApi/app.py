from flask import Flask
from flask_cors import CORS

import config
from database.popola_utenti import create_operatore_user, create_osservatore_user

app = Flask(__name__)
app.config.from_object(config)

from flask_jwt_extended import JWTManager
jwt = JWTManager(app)
CORS(app)

# Blueprint import
from auth import auth_bp
from api.clienti import clienti_bp
from api.locations import locations_bp
from api.pannelli import pannelli_bp
from api.modelli import modelli_bp

from api.schedules import schedules_bp
from api.espansioni import espansioni_bp
from api.letture import letture_bp

# Registrazione dei blueprint
app.register_blueprint(auth_bp)
app.register_blueprint(clienti_bp)
app.register_blueprint(locations_bp)
app.register_blueprint(pannelli_bp)
app.register_blueprint(modelli_bp)
app.register_blueprint(schedules_bp)
app.register_blueprint(espansioni_bp)
app.register_blueprint(letture_bp)




if __name__ == '__main__':
    with app.app_context():
        create_osservatore_user()
    app.run(debug=True)