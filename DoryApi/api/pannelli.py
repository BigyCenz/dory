from flask import Blueprint, request, jsonify, current_app
import mysql.connector
from flask_jwt_extended import get_jwt_identity, jwt_required
import random
from db import get_db_connection
from pub import publish_mqtt  # <--- importa qui

pannelli_bp = Blueprint('pannelli', __name__, url_prefix='/api/pannelli')

MQTT_TOPIC_PORTS = 'dory/config/ports/'
MQTT_TOPIC_SCHEDULES = 'dory/config/schedules/'


def set_sync_status(pan_cod, status):
    db = mysql.connector.connect(
        host=current_app.config['DB_HOST'],
        user=current_app.config['DB_USER'],
        password=current_app.config['DB_PASSWORD'],
        database=current_app.config['DB_NAME']
    )
    cursor = db.cursor()
    cursor.execute(
        "UPDATE pannelli SET PAN_SYNC_STATUS = %s WHERE PAN_COD = %s",
        (status, pan_cod)
    )
    db.commit()
    cursor.close()
    db.close()

def role_required(*roles):
    def decorator(fn):
        from functools import wraps
        @wraps(fn)
        def wrapper(*args, **kwargs):
            identity = get_jwt_identity()
            if identity.get('role', '').upper() not in roles:
                return jsonify({'msg': 'Permesso negato'}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator

# --- API per invio configurazione a ESP32 via MQTT ---
@pannelli_bp.route('/<int:pan_cod>/publish_config', methods=['POST'])
@jwt_required()
@role_required('GESTORE')
def publish_config(pan_cod):
    """
    Pubblica la configurazione porte e schedules via MQTT per il pannello specificato.
    """
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    # 1. Prendi tutte le porte del pannello
    cur.execute("""
        SELECT PPA_MOD_EXP, PPA_ADD, PPA_PRT, PPA_MAN, PPA_SCH, PPA_SRC, PPA_TITLE, PPA_LAST_VAL, PPA_PAN,
               CASE WHEN PPA_MAN IS NULL THEN 1 ELSE 0 END as IS_INPUT
        FROM porte_pannelli
        WHERE PPA_PAN = %s
    """, (pan_cod,))
    porte = cur.fetchall()

    # 2. Prendi tutte le schedules usate da queste porte
    schedule_ids = set([p['PPA_SCH'] for p in porte if p['PPA_SCH']])
    schedules = {}
    if schedule_ids:
        format_strings = ','.join(['%s'] * len(schedule_ids))
        cur.execute(f"SELECT * FROM schedules WHERE SCH_COD IN ({format_strings})", tuple(schedule_ids))
        for row in cur.fetchall():
            sch_cod = row['SCH_COD']
            schedules[sch_cod] = {
                'SCH_NAME': row['SCH_NAME'],
                'SCH_COD': sch_cod,
                'exceptions': [],
                'times': {d: [] for d in ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]}
            }
        # Eccezioni
        cur.execute(f"SELECT * FROM schedule_exceptions WHERE SEX_SCH IN ({format_strings})", tuple(schedule_ids))
        for row in cur.fetchall():
            sch_cod = row['SEX_SCH']
            if sch_cod in schedules:
                schedules[sch_cod]['exceptions'].append(row['SEX_DATE'].strftime('%Y-%m-%d'))
        # Intervalli
        cur.execute(f"SELECT * FROM schedule_times WHERE ST_SCH IN ({format_strings})", tuple(schedule_ids))
        for row in cur.fetchall():
            sch_cod = row['ST_SCH']
            day = row['ST_DAY'].lower()
            start = row['ST_START'].strftime('%H:%M') if hasattr(row['ST_START'], 'strftime') else str(row['ST_START'])
            end = row['ST_END'].strftime('%H:%M') if hasattr(row['ST_END'], 'strftime') else str(row['ST_END'])
            if sch_cod in schedules:
                schedules[sch_cod]['times'][day].append({'start': start, 'end': end})

    # 3. Prepara payload porte (solo i campi necessari all'ESP)
    ports_payload = []
    for p in porte:
        ports_payload.append({
            'address': p['PPA_ADD'],
            'pin': p['PPA_PRT'],
            'mode': 1 if not p['IS_INPUT'] else 0,
            'type': 1 if p['PPA_SRC'] == 'EXP' else 0,  # 1 = digital, 0 = analog (adatta se serve)
            'autoMode': 0 if p['IS_INPUT'] else (0 if p['PPA_MAN'] else 1),
            'defaultValue': p['PPA_LAST_VAL'] if not p['IS_INPUT'] else 0,
            'schedule_ref': str(p['PPA_SCH']) if p['PPA_SCH'] else ""
        })

    # 4. Prepara payload schedules
    schedules_payload = {k: v for k, v in schedules.items()}

    # 5. Pubblica su MQTT
    try:
        publish_mqtt(MQTT_TOPIC_PORTS + str(pan_cod), {"ports": ports_payload})
        publish_mqtt(MQTT_TOPIC_SCHEDULES + str(pan_cod), {"schedules": schedules_payload})
        set_sync_status(pan_cod, "PENDING")
        return jsonify({"status": "ok"})
    except Exception as e:
        set_sync_status(pan_cod, "ERROR")
        return jsonify({"error": str(e)}), 500

# --- API per controllo porte via MQTT ---
@pannelli_bp.route('/<int:pan_cod>/control', methods=['POST'])
@jwt_required()
@role_required('GESTORE', 'OPERATORE')
def control_port(pan_cod):
    """
    Invia comando di controllo porta via MQTT (accensione/spegnimento, valore analogico, ecc).
    Payload richiesto: {"address":..., "pin":..., "value":..., "save":true/false}
    """
    data = request.get_json()
    address = data.get('address')
    pin = data.get('pin')
    value = data.get('value')
    save = data.get('save', False)
    if address is None or pin is None or value is None:
        return jsonify({"error": "Dati mancanti"}), 400

    # Pubblica su MQTT
    try:
        topic = f'dory/control/{pan_cod}'
        payload = {
            "address": address,
            "pin": pin,
            "value": value,
            "save": save
        }
        publish_mqtt(topic, payload)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    # Se richiesto, aggiorna valore di default nel DB
    if save:
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                UPDATE porte_pannelli
                SET PPA_LAST_VAL = %s
                WHERE PPA_PAN = %s AND PPA_ADD = %s AND PPA_PRT = %s
                """,
                (value, pan_cod, address, pin)
            )
            conn.commit()
        except Exception as e:
            conn.rollback()
            print(str(e))
            return jsonify({"error": str(e)}), 500
        finally:
            cursor.close()
            conn.close()

    return jsonify({"status": "ok"})

@pannelli_bp.route('', methods=['POST'])
@jwt_required()
@role_required('GESTORE')
def create_pannello():
    identity = get_jwt_identity()
    data = request.get_json()
    if not data:
        return jsonify({"msg": "Dati richiesti"}), 400

    pan_name = data.get('pan_name')
    mod_cod = data.get('mod_cod')
    cli_cod = data.get('cli_cod')
    loc_cod = data.get('loc_cod')

    print(cli_cod)

    db = mysql.connector.connect(
        host=current_app.config['DB_HOST'],
        user=current_app.config['DB_USER'],
        password=current_app.config['DB_PASSWORD'],
        database=current_app.config['DB_NAME']
    )
    cursor = db.cursor()

    # Genera un PAN_COD a 5 cifre unico
    while True:
        pan_cod = random.randint(10000, 99999)
        cursor.execute("SELECT 1 FROM pannelli WHERE PAN_COD = %s", (pan_cod,))
        if not cursor.fetchone():
            break

    cursor.execute(
        "INSERT INTO pannelli (PAN_COD, PAN_NAME, PAN_CLI, PAN_LOC, PAN_MOD) VALUES (%s,%s,%s,%s,%s)",
        (pan_cod, pan_name, cli_cod, loc_cod, mod_cod)
    )
    db.commit()

    cursor.close()
    db.close()
    return jsonify({'PAN_COD': pan_cod, 'nome': pan_name})

@pannelli_bp.route('', methods=['GET'])
@jwt_required()
def get_pannelli():
    
    """
    Restituisce tutti i pannelli associati al gestore dell'utente loggato
    con informazioni su nome, codice, cliente, location, stato (placeholder)
    """
    user = get_jwt_identity()
    gestore_cod = user.get('gestore_cod')

    if not gestore_cod:
        return jsonify({'msg': 'Gestore non trovato nel token'}), 401

    db = mysql.connector.connect(
        host=current_app.config['DB_HOST'],
        user=current_app.config['DB_USER'],
        password=current_app.config['DB_PASSWORD'],
        database=current_app.config['DB_NAME']
    )
    cursor = db.cursor(dictionary=True)

    query = """
        SELECT 
            p.PAN_COD,
            p.PAN_NAME as nome,
            c.CLI_NAME AS cliente_name,
            l.LOC_NAME AS location_name,
            p.PAN_FW AS firmware_ver,
            p.PAN_LAST_UPD AS last_update,
            p.PAN_SYNC_STATUS AS sync_status,
            p.PAN_ONLINE AS online
        FROM pannelli p
        JOIN clienti c ON p.PAN_CLI = c.CLI_COD
        JOIN locations l ON p.PAN_LOC = l.LOC_COD
        WHERE c.CLI_GESTORE = %s
        ORDER BY p.PAN_COD
    """
    cursor.execute(query, (gestore_cod,))
    pannelli = cursor.fetchall()


    import datetime
    for p in pannelli:
        lu = p.get('last_update')
        if isinstance(lu, datetime.datetime):
            p['last_update'] = lu.replace(tzinfo=datetime.timezone.utc).isoformat().replace('+00:00', 'Z')

    cursor.close()
    db.close()

    return jsonify(pannelli)

@pannelli_bp.route('/<int:pan_cod>/porte', methods=['GET'])
def get_porte_pannello(pan_cod):
    db = mysql.connector.connect(
        host=current_app.config['DB_HOST'],
        user=current_app.config['DB_USER'],
        password=current_app.config['DB_PASSWORD'],
        database=current_app.config['DB_NAME']
    )
    cursor = db.cursor(dictionary=True)

    query = """
     SELECT pp.PPA_SRC, pp.PPA_MOD_EXP, pp.PPA_ADD, pp.PPA_PRT,
         pp.PPA_MAN, pp.PPA_SCH, pp.PPA_LAST_VAL, pp.PPA_TITLE,
         CASE 
           WHEN pp.PPA_SRC = 'MOD' 
           THEN pm.PMO_NAME 
           ELSE pe.PEX_NAME 
         END AS NAME,
         CASE 
           WHEN pp.PPA_SRC = 'MOD' 
           THEN pm.PMO_TYPE 
           ELSE pe.PEX_TYPE 
         END AS TYPE,
         CASE 
           WHEN pp.PPA_SRC = 'MOD'
           THEN m.MOD_NAME
           ELSE e.EXP_NAME
         END AS MODEL_NAME
     FROM porte_pannelli pp
     LEFT JOIN porte_modelli pm 
         ON pp.PPA_SRC = 'MOD' 
        AND pp.PPA_MOD_EXP = pm.PMO_MOD 
        AND pp.PPA_ADD = pm.PMO_ADD 
        AND pp.PPA_PRT = pm.PMO_PRT
     LEFT JOIN modelli m 
         ON m.MOD_COD = pm.PMO_MOD
     LEFT JOIN porte_espansioni pe 
         ON pp.PPA_SRC = 'EXP' 
        AND pp.PPA_MOD_EXP = pe.PEX_EXP 
        AND pp.PPA_PRT = pe.PEX_PRT
     LEFT JOIN espansioni e
         ON e.EXP_COD = pe.PEX_EXP
     WHERE pp.PPA_PAN = %s
     ORDER BY pp.PPA_SRC, pp.PPA_MOD_EXP, pp.PPA_PRT
    """
    cursor.execute(query, (pan_cod,))
    rows = cursor.fetchall()

    result = []
    for r in rows:
        result.append({
            "ADDR": r["PPA_ADD"],
            "MODEL_NAME": r["MODEL_NAME"],
            "MOD_EXP": r["PPA_MOD_EXP"],
            "NAME": r["NAME"],
            "PRT": r["PPA_PRT"],
            "SRC": r["PPA_SRC"],
            "TYPE": r["TYPE"],
            "MAN": r["PPA_MAN"],   # Modalità manuale/automatica se output, altrimenti null
            "SCH": r["PPA_SCH"],   # Schedule associato se automatico, altrimenti null
            "LAST_VAL": r["PPA_LAST_VAL"],  # Valore ultimo se disponibile, altrimenti null
            "TITLE": r["PPA_TITLE"] # Nome personalizzato della porta
        })

    return jsonify(result)

@pannelli_bp.route('/<int:pan_cod>/porte', methods=['POST'])
@jwt_required()
@role_required('GESTORE')
def save_porte_pannello(pan_cod):

    """
    Aggiorna le porte di un pannello.
    La richiesta deve contenere la lista completa di porte da salvare.
    """
    db = mysql.connector.connect(
        host=current_app.config['DB_HOST'],
        user=current_app.config['DB_USER'],
        password=current_app.config['DB_PASSWORD'],
        database=current_app.config['DB_NAME']
    )
    cursor = db.cursor()

    data = request.json  # lista di porte
 
    try:

        # Prima rimuoviamo tutte le porte attuali del pannello
        cursor.execute("DELETE FROM porte_pannelli WHERE PPA_PAN = %s", (pan_cod,))

        # Reinseriamo tutte le porte passate dal frontend
        for p in data["porte"]:
            # Normalizzazione valori
            port_type = p.get("TYPE", "")
            is_input = port_type.endswith("IN")

            man = None if is_input else p.get("MAN")
            last_val = None if is_input else 0
            sch = None if is_input else p.get("SCH")
            title = p.get("TITLE")

            cursor.execute(
                """
                INSERT INTO porte_pannelli
                (PPA_PAN, PPA_MOD_EXP, PPA_ADD, PPA_PRT, 
                PPA_MAN, PPA_LAST_VAL, PPA_SCH, PPA_SRC, PPA_TITLE)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    pan_cod,
                    p.get("MOD_EXP"),
                    p.get("ADDR", 0),
                    p.get("PRT"),
                    man,
                    last_val,
                    sch,
                    p.get("SRC"),
                    title,
                ),
            )


        db.commit()
        set_sync_status(pan_cod, "PENDING")
        return jsonify({"status": "ok"})
    except Exception as e:
        db.rollback()
        set_sync_status(pan_cod, "ERROR")
        print(str(e))
        return jsonify({"error": str(e)}), 500

@pannelli_bp.route('/<int:pan_cod>/porte/disponibili', methods=['GET'])
@jwt_required()
def get_porte_disponibili(pan_cod):

    db = mysql.connector.connect(
        host=current_app.config['DB_HOST'],
        user=current_app.config['DB_USER'],
        password=current_app.config['DB_PASSWORD'],
        database=current_app.config['DB_NAME']
    )
    cur = db.cursor(dictionary=True)

    # 1) prendo il modello del pannello
    cur.execute("SELECT PAN_MOD FROM pannelli WHERE PAN_COD = %s", (pan_cod,))
    row = cur.fetchone()
    if not row:
        cur.close()
        db.close()
        return jsonify([])  # pannello non trovato -> lista vuota

    pan_mod = row['PAN_MOD']

    results = []

    # 2) porte del modello (PMO)
    if pan_mod is not None:
        cur.execute("""
            SELECT 
              'MOD' AS SRC,
              pm.PMO_MOD   AS MOD_EXP,
              pm.PMO_ADD   AS ADDR,
              pm.PMO_PRT   AS PRT,
              pm.PMO_NAME  AS NAME,
              pm.PMO_TYPE  AS TYPE,
              m.MOD_NAME   AS MODEL_NAME
            FROM porte_modelli pm
            JOIN modelli m ON m.MOD_COD = pm.PMO_MOD
            WHERE pm.PMO_MOD = %s
            ORDER BY pm.PMO_PRT
        """, (pan_mod,))
        model_ports = cur.fetchall()
        for r in model_ports:
            results.append({
                "SRC": r["SRC"],
                "MOD_EXP": r["MOD_EXP"],
                "ADDR": r["ADDR"],
                "PRT": r["PRT"],
                "NAME": r["NAME"],
                "TYPE": r["TYPE"],
                "MODEL_NAME": r.get("MODEL_NAME")
            })

    # 3) porte delle espansioni collegate al pannello
    #    per ogni espansione collegata (EPA_EXP,EPA_ADD) prendo le porte PEX_*
    cur.execute("""
        SELECT 
          'EXP' AS SRC,
          ep.EPA_EXP    AS MOD_EXP,
          ep.EPA_ADD    AS ADDR,
          pe.PEX_PRT    AS PRT,
          pe.PEX_NAME   AS NAME,
          pe.PEX_TYPE   AS TYPE,
          e.EXP_NAME    AS EXP_NAME
        FROM espansioni_pannelli ep
        JOIN porte_espansioni pe ON pe.PEX_EXP = ep.EPA_EXP
        JOIN espansioni e ON e.EXP_COD = ep.EPA_EXP
        WHERE ep.EPA_PAN = %s
        ORDER BY e.EXP_NAME, pe.PEX_PRT
    """, (pan_cod,))
    exp_ports = cur.fetchall()
    for r in exp_ports:
        results.append({
            "SRC": r["SRC"],
            "MOD_EXP": r["MOD_EXP"],
            "ADDR": r["ADDR"],
            "PRT": r["PRT"],
            "NAME": r["NAME"],
            "TYPE": r["TYPE"],
            "MODEL_NAME": r.get("EXP_NAME")
        })

    cur.close()
    db.close()
    return jsonify(results)

@pannelli_bp.route('/<int:pan_cod>/porte/value', methods=['PATCH'])
@jwt_required()
@role_required('GESTORE')
def update_port_value(pan_cod):
    """
    Aggiorna PPA_LAST_VAL di una porta specifica.
    Si aspetta payload: {"data": {"MOD_EXP": ..., "ADDR": ..., "PRT": ..., "LAST_VAL": ...}}
    """
    db = mysql.connector.connect(
        host=current_app.config['DB_HOST'],
        user=current_app.config['DB_USER'],
        password=current_app.config['DB_PASSWORD'],
        database=current_app.config['DB_NAME']
    )
    cursor = db.cursor()

    payload = request.json.get("data", {})
    mod_exp = payload.get("MOD_EXP")
    addr = payload.get("ADDR", 0)
    prt = payload.get("PRT")
    last_val = payload.get("LAST_VAL")

    if mod_exp is None or prt is None or last_val is None:
        return jsonify({"error": "Dati incompleti"}), 400

    try:
        cursor.execute(
            """
            UPDATE porte_pannelli
            SET PPA_LAST_VAL = %s
            WHERE PPA_PAN = %s AND PPA_MOD_EXP = %s AND PPA_PRT = %s AND PPA_ADD = %s
            """,
            (last_val, pan_cod, mod_exp, prt, addr)
        )
        db.commit()
        return jsonify({"status": "ok"})
    except Exception as e:
        db.rollback()
        print(str(e))
        return jsonify({"error": str(e)}), 500

@pannelli_bp.route('/<int:pan_cod>/ping', methods=['POST'])
@jwt_required()
def ping_pannello(pan_cod):
    # Imposta subito offline
    db = mysql.connector.connect(
        host=current_app.config['DB_HOST'],
        user=current_app.config['DB_USER'],
        password=current_app.config['DB_PASSWORD'],
        database=current_app.config['DB_NAME']
    )
    cursor = db.cursor()
    cursor.execute(
        "UPDATE pannelli SET PAN_ONLINE = 0 WHERE PAN_COD = %s",
        (pan_cod,)
    )
    db.commit()
    cursor.close()
    db.close()

    # Invia il ping via MQTT come prima
    topic = f'dory/ping/{pan_cod}'
    payload = {"ping": True}
    publish_mqtt(topic, payload)
    return jsonify({"msg": "Ping inviato"}), 200

@pannelli_bp.route('/<int:pan_cod>/set_offline', methods=['POST'])
def set_pannello_offline(pan_cod):
    db = mysql.connector.connect(
        host=current_app.config['DB_HOST'],
        user=current_app.config['DB_USER'],
        password=current_app.config['DB_PASSWORD'],
        database=current_app.config['DB_NAME']
    )
    cursor = db.cursor()
    cursor.execute(
        "UPDATE pannelli SET PAN_ONLINE = 0 WHERE PAN_COD = %s",
        (pan_cod,)
    )
    db.commit()
    cursor.close()
    db.close()
    return jsonify({"status": "ok"})

@pannelli_bp.route('/<int:pan_cod>', methods=['PUT'])
@jwt_required()
@role_required('GESTORE')
def update_pannello(pan_cod):
    """
    Aggiorna nome, cliente e location di un pannello.
    """
    identity = get_jwt_identity()
    data = request.get_json()
    if not data:
        return jsonify({"msg": "Dati richiesti"}), 400

    pan_name = data.get('pan_name')
    cli_cod = data.get('cli_cod')
    loc_cod = data.get('loc_cod')

    if not pan_name or not cli_cod or not loc_cod:
        return jsonify({"msg": "Dati richiesti: nome, cliente, location"}), 400

    try:
        cnx = mysql.connector.connect(
            host=current_app.config['DB_HOST'],
            user=current_app.config['DB_USER'],
            password=current_app.config['DB_PASSWORD'],
            database=current_app.config['DB_NAME']
        )
        cursor = cnx.cursor(dictionary=True)

        # Verifica che il pannello appartenga al gestore dell'utente
        cursor.execute(
            "SELECT PAN_COD FROM pannelli WHERE PAN_COD = %s",
            ([pan_cod])
        )
        pannello = cursor.fetchone()
        if not pannello:
            cursor.close()
            cnx.close()
            return jsonify({"msg": "Pannello non trovato o non autorizzato"}), 404

        cursor.execute(
            "UPDATE pannelli SET PAN_NAME = %s, PAN_CLI = %s, PAN_LOC = %s WHERE PAN_COD = %s",
            (pan_name, cli_cod, loc_cod, pan_cod)
        )
        cnx.commit()
        cursor.close()
        cnx.close()
        return jsonify({"msg": "Pannello aggiornato"}), 200

    except mysql.connector.Error as err:
        print(f"Database error: {str(err)}")
        return jsonify({"msg": "Errore database", "error": str(err)}), 500

@pannelli_bp.route('/<int:pan_cod>', methods=['DELETE'])
@jwt_required()
@role_required('GESTORE')
def delete_pannello(pan_cod):
    """
    Elimina un pannello e tutte le entità collegate (porte, espansioni, letture) tramite ON DELETE CASCADE.
    """
    identity = get_jwt_identity()
    # (opzionale) Verifica che il pannello appartenga al gestore dell'utente
    try:
        db = mysql.connector.connect(
            host=current_app.config['DB_HOST'],
            user=current_app.config['DB_USER'],
            password=current_app.config['DB_PASSWORD'],
            database=current_app.config['DB_NAME']
        )
        cursor = db.cursor()
        cursor.execute("DELETE FROM pannelli WHERE PAN_COD = %s", (pan_cod,))
        db.commit()
        cursor.close()
        db.close()
        return jsonify({"msg": "Pannello eliminato"})
    except Exception as err:
        print(f"Database error: {str(err)}")
        return jsonify({"msg": "Errore database", "error": str(err)}), 500