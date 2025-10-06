from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from werkzeug.security import check_password_hash, generate_password_hash
from db import get_db_connection

auth_bp = Blueprint('auth', __name__, url_prefix='/api')

@auth_bp.route('/login', methods=['POST'])
def login():

    data = request.json
    username = data.get('username')
    password = data.get('password')

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute("""
        SELECT u.UTE_COD, u.UTE_USERNAME, u.UTE_PASSWORD, u.UTE_ROLE, 
               g.GES_COD AS gestore_cod, g.GES_NAME AS gestore_name
        FROM utenti u
        LEFT JOIN gestori g ON u.UTE_GESTORE = g.GES_COD
        WHERE u.UTE_USERNAME = %s
    """, (username,))
    user = cursor.fetchone()

    print("User:", user)

    if not user or not check_password_hash(user['UTE_PASSWORD'], password):
        cursor.close()
        conn.close()
        return jsonify({'msg': 'Credenziali non valide'}), 401

    user_dict = {
        'id': user['UTE_COD'],
        'username': user['UTE_USERNAME'],
        'role': user['UTE_ROLE'],
        'gestore_cod': user['gestore_cod'],
        'gestore_name': user['gestore_name']
    }

    cursor.close()
    conn.close()

    access_token = create_access_token(identity=user_dict)
    refresh_token = create_refresh_token(identity=user_dict)

    return jsonify(access_token=access_token, refresh_token=refresh_token)

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh_token():
    identity = get_jwt_identity()
    new_access_token = create_access_token(identity=identity)
    return jsonify(access_token=new_access_token)