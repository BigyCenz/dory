from flask import Blueprint, request, jsonify, current_app
import mysql.connector
from flask_jwt_extended import jwt_required, get_jwt_identity

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

locations_bp = Blueprint('locations', __name__, url_prefix='/api/locations')

@locations_bp.route('', methods=['GET'])
@jwt_required()
def get_locations():
    cliente_cod = request.args.get('cliente')
    if not cliente_cod:
        return jsonify({'msg': 'Parametro cliente mancante'}), 400

    db = mysql.connector.connect(
        host=current_app.config['DB_HOST'],
        user=current_app.config['DB_USER'],
        password=current_app.config['DB_PASSWORD'],
        database=current_app.config['DB_NAME']
    )
    cursor = db.cursor(dictionary=True)

    cursor.execute("SELECT LOC_COD, LOC_NAME FROM locations WHERE LOC_CLI = %s", (cliente_cod,))
    locations = cursor.fetchall()

    cursor.close()
    db.close()
    return jsonify(locations)


@locations_bp.route('', methods=['POST'])
@jwt_required()
@role_required('GESTORE')
def create_location():
    identity = get_jwt_identity()
    data = request.get_json()
    gestore_cod = identity.get('gestore_cod')  # dal token JWT
    if not data:
        return jsonify({"msg": "Dati richiesti"}), 400

    loc_name = data.get('loc_name')
    cli_cod = data.get('cli_cod')
    if not loc_name or not cli_cod:
        return jsonify({"msg": "Nome location e cli_cod richiesti"}), 400

    try:
        db = mysql.connector.connect(
            host=current_app.config['DB_HOST'],
            user=current_app.config['DB_USER'],
            password=current_app.config['DB_PASSWORD'],
            database=current_app.config['DB_NAME']
        )
        cursor = db.cursor(dictionary=True)

        # Verifica che il cliente appartenga al gestore dell'utente loggato
        cursor.execute(
            "SELECT CLI_COD FROM clienti WHERE CLI_COD = %s AND CLI_GESTORE = %s",
            (cli_cod, gestore_cod)
        )
        cliente_esistente = cursor.fetchone()

        if not cliente_esistente:
            cursor.close()
            db.close()
            return jsonify({"msg": "Cliente non trovato o non autorizzato"}), 404

        # Inserisce la nuova location
        cursor.execute(
            "INSERT INTO locations (LOC_NAME, LOC_CLI) VALUES (%s, %s)",
            (loc_name, cli_cod)
        )
        db.commit()
        
        # Ottiene l'ID della location appena creata
        loc_cod = cursor.lastrowid
        
        # Recupera la location completa per la risposta
        cursor.execute(
            "SELECT LOC_COD, LOC_NAME FROM locations WHERE LOC_COD = %s",
            (loc_cod,)
        )
        location = cursor.fetchone()
        
        cursor.close()
        db.close()

        return jsonify(location), 201

    except mysql.connector.Error as err:
        return jsonify({"msg": "Errore database", "error": str(err)}), 500


@locations_bp.route('/<int:loc_cod>', methods=['DELETE'])
@jwt_required()
@role_required('GESTORE')
def delete_location(loc_cod):
    """
    Elimina una location.
    """
    identity = get_jwt_identity()
    gestore_cod = identity.get('gestore_cod')  # dal token JWT

    if not gestore_cod:
        return jsonify({"msg": "Utente senza gestore"}), 403

    try:
        db = mysql.connector.connect(
            host=current_app.config['DB_HOST'],
            user=current_app.config['DB_USER'],
            password=current_app.config['DB_PASSWORD'],
            database=current_app.config['DB_NAME']
        )
        cursor = db.cursor(dictionary=True)

        # Verifica che la location esista e che il cliente associato appartenga al gestore dell'utente
        cursor.execute(
            """SELECT l.LOC_COD 
               FROM locations l 
               JOIN clienti c ON l.LOC_CLI = c.CLI_COD 
               WHERE l.LOC_COD = %s AND c.CLI_GESTORE = %s""",
            (loc_cod, gestore_cod)
        )
        location_esistente = cursor.fetchone()

        if not location_esistente:
            cursor.close()
            db.close()
            return jsonify({"msg": "Location non trovata o non autorizzata"}), 404

        # Elimina la location
        cursor.execute(
            "DELETE FROM locations WHERE LOC_COD = %s",
            (loc_cod,)
        )
        db.commit()

        cursor.close()
        db.close()

        return jsonify({"msg": "Location eliminata"})

    except mysql.connector.Error as err:
        return jsonify({"msg": "Errore database", "error": str(err)}), 500
