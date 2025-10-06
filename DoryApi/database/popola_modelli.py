import mysql.connector
from mysql.connector import errorcode
from mysql.connector import Error

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import config


def popola_modello_ae04v():

    try:
        conn = mysql.connector.connect(host=config.DB_HOST, user=config.DB_USER, password=config.DB_PASSWORD, database=config.DB_NAME)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO modelli (MOD_NAME) VALUES (%s)",
            ('AE04-V',)
        )
        conn.commit()
        print("Modello AE04-V inserito con successo!")
    except Error as e:
        print(f"Errore: {e}")
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def popola_porte_modello():

    try:

        cnx = mysql.connector.connect(host=config.DB_HOST, user=config.DB_USER, password=config.DB_PASSWORD, database=config.DB_NAME)
        cursor = cnx.cursor()

        # Modello AE04-V con PMO_MOD = 1
        modello_id = 1

        # Digital Input
        digital_inputs = [
            ('DI1', 'DIGITAL_IN', 39),
            ('DI2', 'DIGITAL_IN', 34),
            ('DI3', 'DIGITAL_IN', 35),
            ('DI4', 'DIGITAL_IN', 21),
            ('DI5', 'DIGITAL_IN', 22),
            ('DI6', 'DIGITAL_IN', 15),
        ]

        for name, tipo, port in digital_inputs:
            cursor.execute("""
                INSERT INTO porte_modelli (PMO_MOD, PMO_ADD, PMO_PRT, PMO_NAME, PMO_TYPE)
                VALUES (%s, %s, %s, %s, %s)
            """, (modello_id, 0, port, name, tipo))

        # Analog Input (ADS1115)
        analog_inputs = [
            ('AI0', 'ANALOG_IN', 72, 0),
            ('AI1', 'ANALOG_IN', 72, 1),
            ('AI2', 'ANALOG_IN', 72, 2),
            ('AI3', 'ANALOG_IN', 72, 3),
            ('AI4', 'ANALOG_IN', 73, 0),
            ('AI5', 'ANALOG_IN', 73, 1),
        ]

        for name, tipo, exp, port in analog_inputs:
            cursor.execute("""
                INSERT INTO porte_modelli (PMO_MOD, PMO_ADD, PMO_PRT, PMO_NAME, PMO_TYPE)
                VALUES (%s, %s, %s, %s, %s)
            """, (modello_id, exp, port, name, tipo))

        # Digital Output
        digital_outputs = [
            ('DO1', 'DIGITAL_OUT', 26),
            ('DO2', 'DIGITAL_OUT', 27)
        ]

        for name, tipo, port in digital_outputs:
            cursor.execute("""
                INSERT INTO porte_modelli (PMO_MOD, PMO_ADD, PMO_PRT, PMO_NAME, PMO_TYPE)
                VALUES (%s, %s, %s, %s, %s)
            """, (modello_id, 0, port, name, tipo))

        cnx.commit()
        cursor.close()
        cnx.close()
        print("Porte modello inserite correttamente!")

    except mysql.connector.Error as err:
        print(f"Errore: {err}")