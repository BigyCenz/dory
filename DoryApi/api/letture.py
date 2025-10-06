from flask import Blueprint, request, jsonify, current_app
import mysql.connector
from flask_jwt_extended import jwt_required
from datetime import datetime
from db import get_db_connection

letture_bp = Blueprint('letture', __name__, url_prefix='/api/letture')

@letture_bp.route('/<int:pan_cod>', methods=['GET'])
@jwt_required()
def get_letture(pan_cod):
    date_from = request.args.get('from')
    date_to = request.args.get('to')
    if not date_from or not date_to:
        return jsonify({'error': 'Date mancanti'}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # Prendi tutte le porte di input del pannello
    cursor.execute('''
        SELECT pp.PPA_MOD_EXP, pp.PPA_ADD, pp.PPA_PRT, pp.PPA_TITLE, pp.PPA_SRC,
               CASE WHEN pp.PPA_SRC = 'MOD' THEN pm.PMO_NAME ELSE pe.PEX_NAME END AS NAME,
               CASE WHEN pp.PPA_SRC = 'MOD' THEN m.MOD_NAME ELSE e.EXP_NAME END AS MODEL_NAME
        FROM porte_pannelli pp
        LEFT JOIN porte_modelli pm ON pp.PPA_SRC = 'MOD' AND pp.PPA_MOD_EXP = pm.PMO_MOD AND pp.PPA_ADD = pm.PMO_ADD AND pp.PPA_PRT = pm.PMO_PRT
        LEFT JOIN modelli m ON m.MOD_COD = pm.PMO_MOD
        LEFT JOIN porte_espansioni pe ON pp.PPA_SRC = 'EXP' AND pp.PPA_MOD_EXP = pe.PEX_EXP AND pp.PPA_PRT = pe.PEX_PRT
        LEFT JOIN espansioni e ON e.EXP_COD = pe.PEX_EXP
        WHERE pp.PPA_PAN = %s AND (pm.PMO_TYPE LIKE '%IN' OR pe.PEX_TYPE LIKE '%IN')
        ORDER BY pp.PPA_SRC, pp.PPA_MOD_EXP, pp.PPA_PRT
    ''', (pan_cod,))
    porte = cursor.fetchall()

    results = []
    for porta in porte:
        # Query letture per questa porta
        cursor.execute('''
            SELECT LET_VAL, LET_TIME FROM letture
            WHERE LET_PAN = %s AND LET_ADD = %s AND LET_PORT = %s
              AND LET_TIME >= %s AND LET_TIME <= %s
            ORDER BY LET_TIME
        ''', (pan_cod, str(porta['PPA_ADD']), porta['PPA_PRT'], date_from, date_to))
        letture = cursor.fetchall()
        results.append({
            'MODEL_NAME': porta['MODEL_NAME'],
            'NAME': porta['NAME'],
            'TITLE': porta['PPA_TITLE'],
            'ADDR': porta['PPA_ADD'],
            'PRT': porta['PPA_PRT'],
            'SRC': porta['PPA_SRC'],
            'data': [
                {'timestamp': l['LET_TIME'].isoformat(), 'value': l['LET_VAL']} for l in letture
            ]
        })

    cursor.close()
    conn.close()
    return jsonify(results)
