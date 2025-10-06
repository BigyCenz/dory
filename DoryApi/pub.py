import json
import os
import paho.mqtt.publish as publish
from flask import current_app

# Prende i dati dal config Flask (che li prende da .env)
def get_mqtt_config():

    return {
        "host": current_app.config['MQTT_HOST'],
        "port": int(current_app.config['MQTT_PORT']),
        "user": current_app.config['MQTT_USER'],
        "pass": current_app.config['MQTT_PASS']
    }

# Pubblica un messaggio MQTT sul topic specificato
def publish_mqtt(topic, payload):
    cfg = get_mqtt_config()
    publish.single(
        topic,
        payload=json.dumps(payload),
        hostname=cfg["host"],
        port=cfg["port"],
        auth={"username": cfg["user"], "password": cfg["pass"]},
        qos=1
    )