from flask import Blueprint, current_app, request, jsonify
from flask_jwt_extended import jwt_required
import mysql
from db import get_db_connection


espansioni_bp = Blueprint('espansioni', __name__, url_prefix='/api/espansioni')

# Recupera tutte le espansioni disponibili
@espansioni_bp.route('', methods=['GET'])
@jwt_required()
def get_espansioni():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT EXP_COD, EXP_NAME FROM espansioni ORDER BY EXP_NAME")
    results = [{"EXP_COD": r[0], "EXP_NAME": r[1]} for r in cur.fetchall()]
    cur.close()
    conn.close()
    return jsonify(results)


# Recupera le espansioni associate a un pannello
@espansioni_bp.route('/pannello/<int:pan_cod>', methods=['GET'])
@jwt_required()
def get_espansioni_pannello(pan_cod):
    conn = get_db_connection()
    cur = conn.cursor()
    query = """
        SELECT ep.EPA_EXP, e.EXP_NAME, ep.EPA_ADD
        FROM espansioni_pannelli ep
        JOIN espansioni e ON e.EXP_COD = ep.EPA_EXP
        WHERE ep.EPA_PAN = %s
        ORDER BY e.EXP_NAME
    """
    cur.execute(query, (pan_cod,))
    results = [{"EXP_COD": r[0], "EXP_NAME": r[1], "i2cAddr": r[2]} for r in cur.fetchall()]
    cur.close()
    conn.close()
    return jsonify(results)


# Aggiunge un'espansione a un pannello
@espansioni_bp.route('/pannelli/<int:pan_cod>', methods=['POST'])
@jwt_required()
def add_espansione_pannello(pan_cod):
    data = request.get_json()
    exp_cod = data.get('exp_cod')
    i2c = data.get('i2cAddr')

    if not all([exp_cod, i2c]):
        return jsonify({'msg': 'Dati mancanti'}), 400

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO espansioni_pannelli (EPA_PAN, EPA_EXP, EPA_ADD) VALUES (%s,%s,%s)",
            (pan_cod, exp_cod, i2c)
        )
        conn.commit()
    except Exception as e:
        cur.close()
        conn.close()
        return jsonify({'msg': str(e)}), 400

    cur.close()
    conn.close()
    return jsonify({'status': 'ok'})


# Rimuove un'espansione da un pannello
@espansioni_bp.route('/pannelli/<int:pan_cod>', methods=['DELETE'])
@jwt_required()
def remove_espansione_pannello(pan_cod):
    data = request.get_json()
    exp_cod = data.get('exp_cod')
    i2c = data.get('i2cAddr')

    if not all([exp_cod, i2c]):
        return jsonify({'msg': 'Dati mancanti'}), 400

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "DELETE FROM espansioni_pannelli WHERE EPA_PAN=%s AND EPA_EXP=%s AND EPA_ADD=%s",
            (pan_cod, exp_cod, i2c)
        )
        conn.commit()
    except Exception as e:
        cur.close()
        conn.close()
        return jsonify({'msg': str(e)}), 400

    cur.close()
    conn.close()
    return jsonify({'status': 'ok'})