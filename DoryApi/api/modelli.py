from flask import Blueprint, request, jsonify, current_app
from db import get_db_connection
from flask_jwt_extended import jwt_required, get_jwt_identity

modelli_bp = Blueprint('modelli', __name__, url_prefix='/api/modelli')

@modelli_bp.route('', methods=['GET'])
@jwt_required()
def get_modelli():
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT MOD_COD, MOD_NAME FROM modelli")
    modelli = cursor.fetchall()
    cursor.close()
    db.close()
    return jsonify(modelli)