from flask import Blueprint, request, jsonify, current_app
import mysql.connector
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import get_db_connection

schedules_bp = Blueprint("schedules", __name__, url_prefix="/api/schedules")

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

# GET /api/schedules
@schedules_bp.route('', methods=['GET'])
@jwt_required()
def get_schedules():
    conn = get_db_connection()
    cur = conn.cursor()

    # 1. prendo tutti gli schedules
    cur.execute("SELECT SCH_COD, SCH_NAME FROM schedules")
    schedules = cur.fetchall()

    results = []
    for sch_cod, sch_name in schedules:
        # 2. eccezioni
        cur.execute("SELECT SEX_DATE FROM schedule_exceptions WHERE SEX_SCH = %s", (sch_cod,))
        exceptions = [row[0].strftime("%Y-%m-%d") for row in cur.fetchall()]

        # 3. intervalli per giorno
        cur.execute("SELECT ST_DAY, ST_START, ST_END FROM schedule_times WHERE ST_SCH = %s", (sch_cod,))
        intervals = cur.fetchall()

        # ST_DAY coerente con ENUM della tabella
        times = {day: [] for day in ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"]}
        for day_name, start, end in intervals:
            def fmt(t):
                # se è timedelta -> converto in ore e minuti
                if hasattr(t, 'seconds'):
                    total_seconds = t.seconds
                    hours = total_seconds // 3600
                    minutes = (total_seconds % 3600) // 60
                    return f"{hours:02d}:{minutes:02d}"
                # se è già datetime.time
                elif hasattr(t, 'strftime'):
                    return t.strftime("%H:%M")
                else:
                    return str(t)

            times[day_name].append({
                "start": fmt(start),
                "end": fmt(end)
            })


        results.append({
            "SCH_COD": sch_cod,
            "SCH_NAME": sch_name,
            "exceptions": exceptions,
            "times": times
        })

    cur.close()
    conn.close()
    return jsonify(results)

# PUT /api/schedules/<id>
@schedules_bp.route('/<int:sch_cod>', methods=['PUT'])
@jwt_required()
@role_required('GESTORE')
def update_schedule(sch_cod):
    conn = get_db_connection()
    cur = conn.cursor()
    data = request.get_json()

    # Aggiorna nome se presente
    if "SCH_NAME" in data:
        cur.execute("UPDATE schedules SET SCH_NAME = %s WHERE SCH_COD = %s",
                    (data["SCH_NAME"], sch_cod))

    # Aggiorna eccezioni se presenti
    if "exceptions" in data:
        cur.execute("DELETE FROM schedule_exceptions WHERE SEX_SCH = %s", (sch_cod,))
        for ex in data["exceptions"]:
            cur.execute("INSERT INTO schedule_exceptions (SEX_SCH, SEX_DATE) VALUES (%s,%s)",
                        (sch_cod, ex))

    # Aggiorna intervalli se presenti
    if "times" in data:
        cur.execute("DELETE FROM schedule_times WHERE ST_SCH = %s", (sch_cod,))
        for day, intervals in data["times"].items():
            for interval in intervals:
                cur.execute(
                    "INSERT INTO schedule_times (ST_SCH, ST_DAY, ST_START, ST_END) VALUES (%s,%s,%s,%s)",
                    (sch_cod, day, interval["start"], interval["end"])
                )

    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"status": "ok"})

# POST /api/schedules
@schedules_bp.route('', methods=['POST'])
@jwt_required()
@role_required('GESTORE')
def create_schedule():
    
    data = request.json
    name = data.get('name')
 
    if not isinstance(name, str) or not name.strip():
        return jsonify({'msg': 'Nome schedule mancante o non valido'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("INSERT INTO schedules (SCH_NAME) VALUES (%s)", (name.strip(),))
        conn.commit()
        sch_cod = cursor.lastrowid
    except mysql.connector.Error as err:
        cursor.close()
        conn.close()
        return jsonify({'msg': str(err)}), 400

    cursor.close()
    conn.close()
    return jsonify({'SCH_COD': sch_cod, 'SCH_NAME': name.strip()})

# DELETE /api/schedules/<sch_cod>
@schedules_bp.route('/<int:sch_cod>', methods=['DELETE'])
@jwt_required()
@role_required('GESTORE')
def delete_schedule(sch_cod):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Controlla se ci sono porte collegate a questo schedule
        cursor.execute(
            "SELECT COUNT(*) as cnt FROM porte_pannelli WHERE PPA_SCH = %s",
            (sch_cod,)
        )
        result = cursor.fetchone()
        if result and result['cnt'] > 0:
            cursor.close()
            conn.close()
            return jsonify({"msg": "Impossibile eliminare: almeno una porta è collegata a questo calendario."}), 409

        # Elimina schedule (grazie a ON DELETE CASCADE su times/exceptions)
        cursor.execute(
            "DELETE FROM schedules WHERE SCH_COD = %s",
            (sch_cod,)
        )
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"msg": "Schedule eliminato"})
    except Exception as err:
        return jsonify({"msg": "Errore database", "error": str(err)}), 500