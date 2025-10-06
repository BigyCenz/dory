import mysql.connector
from mysql.connector import errorcode
from mysql.connector import Error
from werkzeug.security import generate_password_hash

import sys
import os

from db import get_db_connection
from flask import Flask

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import config


def create_gestore_user():

    db = get_db_connection()
    cursor = db.cursor()

    # Creazione di un gestore di test
    cursor.execute("""
        INSERT IGNORE INTO gestori (GES_COD, GES_NAME)
        VALUES (1, 'Seno&Seno')
    """)

    # Creazione utente di test
    test_username = "senoeseno"
    test_password = "1234"
    hashed_pwd = generate_password_hash(test_password)

    cursor.execute("""
        INSERT IGNORE INTO utenti (UTE_COD, UTE_USERNAME, UTE_PASSWORD, UTE_ROLE, UTE_GESTORE)
        VALUES (%s, %s, %s, %s, %s)
    """, (1, test_username, hashed_pwd, 'GESTORE', 1))

    db.commit()
    cursor.close()
    db.close()
    print("Utente di test creato")

def create_operatore_user():

    db = get_db_connection()
    cursor = db.cursor()

    # Creazione utente di test
    test_username = "operatore"
    test_password = "1234"
    hashed_pwd = generate_password_hash(test_password)

    cursor.execute("""
        INSERT IGNORE INTO utenti (UTE_COD, UTE_USERNAME, UTE_PASSWORD, UTE_ROLE, UTE_GESTORE)
        VALUES (%s, %s, %s, %s, %s)
    """, (2, test_username, hashed_pwd, 'OPERATORE', 1))

    db.commit()
    cursor.close()
    db.close()
    print("Utente operatore creato")

def create_osservatore_user():

    db = get_db_connection()
    cursor = db.cursor()

    # Creazione utente di test
    test_username = "osservatore"
    test_password = "1234"
    hashed_pwd = generate_password_hash(test_password)

    cursor.execute("""
        INSERT IGNORE INTO utenti (UTE_COD, UTE_USERNAME, UTE_PASSWORD, UTE_ROLE, UTE_GESTORE)
        VALUES (%s, %s, %s, %s, %s)
    """, (3, test_username, hashed_pwd, 'OSSERVATORE', 1))

    db.commit()
    cursor.close()
    db.close()
    print("Utente osservatore creato")

if __name__ == "__main__":
    app = Flask(__name__)
    import config
    app.config.from_object(config)
    with app.app_context():
        create_gestore_user()
        create_operatore_user()
        create_osservatore_user()