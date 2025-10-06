from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import get_db_connection

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

clienti_bp = Blueprint('clienti', __name__, url_prefix='/api/clienti')

@clienti_bp.route('', methods=['GET'])
@jwt_required()
def get_clienti():
    """
    Restituisce tutti i clienti associati al gestore dell'utente loggato.
    """
    identity = get_jwt_identity()
    gestore_cod = identity.get('gestore_cod')  # dal token JWT

    if not gestore_cod:
        return jsonify({"msg": "Utente senza gestore"}), 403

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            "SELECT CLI_COD, CLI_NAME FROM clienti WHERE CLI_GESTORE = %s ORDER BY CLI_NAME",
            (gestore_cod,)
        )
        clienti = cursor.fetchall()
        cursor.close()
        conn.close()

        return jsonify(clienti)

    except Exception as err:
        return jsonify({"msg": "Errore database", "error": str(err)}), 500

@clienti_bp.route('', methods=['POST'])
@jwt_required()
@role_required('GESTORE')
def create_cliente():
    """
    Crea un nuovo cliente.
    """
    identity = get_jwt_identity()
    user_gestore_cod = identity.get('gestore_cod')  # dal token JWT
    data = request.get_json()
    if not data:
        return jsonify({"msg": "Dati richiesti"}), 400

    cli_name = data.get('cli_name')
    if not cli_name:
        return jsonify({"msg": "Nome cliente richiesto"}), 400

    gestore_cod = user_gestore_cod

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            "INSERT INTO clienti (CLI_NAME, CLI_GESTORE) VALUES (%s, %s)",
            (cli_name, gestore_cod)
        )
        conn.commit()
        cli_cod = cursor.lastrowid
        cursor.execute(
            "SELECT CLI_COD, CLI_NAME FROM clienti WHERE CLI_COD = %s",
            (cli_cod,)
        )
        cliente = cursor.fetchone()
        cursor.close()
        conn.close()

        return jsonify(cliente), 201

    except Exception as err:
        return jsonify({"msg": "Errore database", "error": str(err)}), 500

@clienti_bp.route('/<int:cli_cod>', methods=['PUT'])
@jwt_required()
@role_required('GESTORE')
def update_cliente(cli_cod):
    """
    Aggiorna un cliente esistente.
    """
    identity = get_jwt_identity()
    gestore_cod = identity.get('gestore_cod')  # dal token JWT
    data = request.get_json()
    if not data:
        return jsonify({"msg": "Dati richiesti"}), 400

    cli_name = data.get('cli_name')
    if not gestore_cod:
        return jsonify({"msg": "Utente senza gestore"}), 403

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            "SELECT CLI_COD FROM clienti WHERE CLI_COD = %s AND CLI_GESTORE = %s",
            (cli_cod, gestore_cod)
        )
        cliente_esistente = cursor.fetchone()

        if not cliente_esistente:
            cursor.close()
            conn.close()
            return jsonify({"msg": "Cliente non trovato o non autorizzato"}), 404

        update_fields = []
        update_values = []

        if cli_name:
            update_fields.append("CLI_NAME = %s")
            update_values.append(cli_name)

        if not update_fields:
            cursor.close()
            conn.close()
            return jsonify({"msg": "Nessun campo da aggiornare"}), 400

        update_values.append(cli_cod)
        update_query = f"UPDATE clienti SET {', '.join(update_fields)} WHERE CLI_COD = %s"
        cursor.execute(update_query, update_values)
        conn.commit()

        cursor.execute(
            "SELECT CLI_COD, CLI_NAME FROM clienti WHERE CLI_COD = %s",
            (cli_cod,)
        )
        cliente_aggiornato = cursor.fetchone()

        cursor.close()
        conn.close()

        return jsonify(cliente_aggiornato)

    except Exception as err:
        return jsonify({"msg": "Errore database", "error": str(err)}), 500

@clienti_bp.route('/<int:cli_cod>', methods=['DELETE'])
@jwt_required()
@role_required('GESTORE')
def delete_cliente(cli_cod):
    """
    Elimina un cliente solo se non possiede pannelli.
    """
    identity = get_jwt_identity()
    gestore_cod = identity.get('gestore_cod')  # dal token JWT

    if not gestore_cod:
        return jsonify({"msg": "Utente senza gestore"}), 403

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            "SELECT CLI_COD FROM clienti WHERE CLI_COD = %s AND CLI_GESTORE = %s",
            (cli_cod, gestore_cod)
        )
        cliente_esistente = cursor.fetchone()

        if not cliente_esistente:
            cursor.close()
            conn.close()
            return jsonify({"msg": "Cliente non trovato o non autorizzato"}), 404

        # Controlla se esistono pannelli associati al cliente
        cursor.execute(
            "SELECT COUNT(*) as cnt FROM pannelli WHERE PAN_CLI = %s",
            (cli_cod,)
        )
        result = cursor.fetchone()
        if result and result['cnt'] > 0:
            cursor.close()
            conn.close()
            return jsonify({"msg": "Impossibile eliminare: esistono pannelli associati a questo cliente."}), 409

        # Elimina il cliente (le location vengono eliminate in cascata dal DB)
        cursor.execute(
            "DELETE FROM clienti WHERE CLI_COD = %s",
            (cli_cod,)
        )
        conn.commit()

        cursor.close()
        conn.close()

        return jsonify({"msg": "Cliente eliminato"})

    except Exception as err:
        return jsonify({"msg": "Errore database", "error": str(err)}), 500