import mysql.connector
from mysql.connector import errorcode

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import config

DB_NAME = config.DB_NAME

def create_database():
    try:
        cnx = mysql.connector.connect(
            host=config.DB_HOST,
            user=config.DB_USER,
            password=config.DB_PASSWORD
        )
        cursor = cnx.cursor()
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME} DEFAULT CHARACTER SET 'utf8mb4'")
        print(f"Database '{DB_NAME}' creato o già esistente.")
        cursor.close()
        cnx.close()
    except mysql.connector.Error as err:
        if err.errno == errorcode.ER_ACCESS_DENIED_ERROR:
            print("Errore: accesso negato, controlla user/password")
        else:
            print(err)

if __name__ == "__main__":
    create_database()
