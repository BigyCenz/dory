# run.py
from create_database import create_database
from create_all_tables import create_all_tables
from database.popola_clienti import create_test_cliente
from database.popola_locations import create_test_location
from popola_modelli import popola_modello_ae04v, popola_porte_modello
from popola_utenti import create_test_user

def main():

    print("Creazione del database...")
    create_database()

    print("Creazione delle tabelle...")
    create_all_tables()
    
    print("\nPopolamento modello AE04-V...")
    #popola_modello_ae04v()

    print("\nPopolamento porte modello AE04-V...")
    #popola_porte_modello()

    print("\nCreazione utente di test...")
    #create_test_user()

    print("\nCreazione cliente di test...")
    #create_test_cliente()

    print("\nCreazione location di test...")
    #create_test_location()

    print("\nTutto completato!")

if __name__ == "__main__":
    main()
