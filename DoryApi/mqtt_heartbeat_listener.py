import paho.mqtt.client as mqtt
import mysql.connector
import re
from datetime import datetime
import os
from dotenv import load_dotenv

# Carica variabili ambiente (DB)
load_dotenv()

DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_USER = os.getenv('DB_USER', 'root')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'root')
DB_NAME = os.getenv('DB_NAME', 'dory')

MQTT_HOST = os.getenv('MQTT_HOST', 'iot.webinteam.com')
MQTT_PORT = int(os.getenv('MQTT_PORT', 1883))
MQTT_USER = os.getenv('MQTT_USER', 'webinteam')
MQTT_PASS = os.getenv('MQTT_PASS', 'webinteam')

# Regex per estrarre codice pannello e versione dal payload
RE_HEARTBEAT = re.compile(r"Pannello (\w+) Online, versione ([\w\.-]+)")


def on_connect(client, userdata, flags, rc):
    client.subscribe("dory/heartbeat/+")
    client.subscribe("dory/ping_response/+")

def on_message(client, userdata, msg):
    topic = msg.topic
    payload = msg.payload.decode()
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    if topic.startswith("dory/heartbeat/") or topic.startswith("dory/ping_response/"):
        pan_cod = topic.split("/")[-1]
        version = None
        if "versione" in payload:
            try:
                version = payload.split("versione")[1].strip().split()[0]
            except Exception:
                version = None

        conn = mysql.connector.connect(
            host=DB_HOST, user=DB_USER, password=DB_PASSWORD, database=DB_NAME
        )
        cursor = conn.cursor()

        if topic.startswith("dory/ping_response/"):
            print("Ping response inviato")
            cursor.execute(
                "UPDATE pannelli SET PAN_LAST_UPD=UTC_TIMESTAMP(), PAN_FW=%s, PAN_ONLINE=1 WHERE PAN_COD=%s",
                (version, pan_cod)
            )
        else:
            print("Heartbeat ricevuto")
            cursor.execute(
                "UPDATE pannelli SET PAN_LAST_UPD=UTC_TIMESTAMP(), PAN_FW=%s, PAN_ONLINE=1 WHERE PAN_COD=%s",
                (version, pan_cod)
            )

        conn.commit()
        cursor.close()
        conn.close()

def main():
    client = mqtt.Client()
    client.username_pw_set(MQTT_USER, MQTT_PASS)
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(MQTT_HOST, MQTT_PORT, 60)
    print("MQTT heartbeat listener avviato...")
    client.loop_forever()

if __name__ == "__main__":
    main()
