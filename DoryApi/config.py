import os
from datetime import timedelta
from dotenv import load_dotenv

# Carica le variabili dal file .env
load_dotenv()

# Configurazione LOGIN JWT
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'super-segreto')
JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES_MINUTES', 150)))
JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=int(os.getenv('JWT_REFRESH_TOKEN_EXPIRES_DAYS', 7)))
JWT_TOKEN_LOCATION = ['headers', 'json']  # accetta header e json body
JWT_VERIFY_SUB = False

# Configurazione Database
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_USER = os.getenv('DB_USER', 'root')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'root')
DB_NAME = os.getenv('DB_NAME', 'dory')

# Configurazione MQTT
MQTT_HOST = os.getenv('MQTT_HOST', 'iot.webinteam.com')
MQTT_PORT = int(os.getenv('MQTT_PORT', 1883))
MQTT_USER = os.getenv('MQTT_USER', '')
MQTT_PASS = os.getenv('MQTT_PASS', '')