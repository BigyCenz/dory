import mysql.connector
from mysql.connector import errorcode
from mysql.connector import Error
from werkzeug.security import generate_password_hash

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import config


def create_test_location():

    db = mysql.connector.connect(
        host=config.DB_HOST,
        user=config.DB_USER,
        password=config.DB_PASSWORD,
        database=config.DB_NAME
    )
    cursor = db.cursor()

    # Creazione di una location
    cursor.execute("""
        INSERT INTO locations (LOC_COD, LOC_NAME, LOC_CLI)
        VALUES (1, 'Aladino', 1)
    """)

    db.commit()
    cursor.close()
    db.close()
    print("Location creata")