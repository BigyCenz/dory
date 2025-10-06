import mysql.connector
from mysql.connector import errorcode
from mysql.connector import Error
from werkzeug.security import generate_password_hash

import sys
import os

from db import get_db_connection
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import config

def create_test_cliente():

    db = get_db_connection()
    cursor = db.cursor()

    # Creazione di un cliente
    cursor.execute("""
        INSERT INTO clienti (CLI_COD, CLI_NAME, CLI_GESTORE)
        VALUES (1, 'Gardaland', 1)
    """)

    db.commit()
    cursor.close()
    db.close()
    print("Cliente creato")

