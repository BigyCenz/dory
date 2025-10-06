import paho.mqtt.client as mqtt
import json
import mysql.connector
import os

MQTT_HOST = 'iot.webinteam.com'
MQTT_PORT = 1883
MQTT_USER = 'webinteam'
MQTT_PASS = 'webinteam'
MQTT_TOPIC_ACK = 'dory/config/ack/+'

DB_HOST = os.environ.get('DB_HOST', 'localhost')
DB_USER = os.environ.get('DB_USER', 'root')
DB_PASSWORD = os.environ.get('DB_PASSWORD', 'root')
DB_NAME = os.environ.get('DB_NAME', 'dory')

print("Starting MQTT Sync Listener...")

def set_sync_status(pan_cod, status):
    db = mysql.connector.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME
    )
    cursor = db.cursor()
    cursor.execute(
        "UPDATE pannelli SET PAN_SYNC_STATUS = %s WHERE PAN_COD = %s",
        (status, pan_cod)
    )
    db.commit()
    cursor.close()
    db.close()

def on_connect(client, userdata, flags, rc):
    print("Connected with result code "+str(rc))
    client.subscribe(MQTT_TOPIC_ACK)

def on_message(client, userdata, msg):
    try:
        pan_cod = int(msg.topic.split('/')[-1])
        payload = json.loads(msg.payload.decode())
        if payload.get('status') == 'ok':
            set_sync_status(pan_cod, 'SYNCED')
            print(f"SYNCED pannello {pan_cod}")
        else:
            set_sync_status(pan_cod, 'ERROR')
            print(f"ERROR sync pannello {pan_cod}")
    except Exception as e:
        print("Errore gestione ack:", e)

client = mqtt.Client()
client.username_pw_set(MQTT_USER, MQTT_PASS)
client.on_connect = on_connect
client.on_message = on_message

client.connect(MQTT_HOST, MQTT_PORT, 60)
client.loop_forever()
