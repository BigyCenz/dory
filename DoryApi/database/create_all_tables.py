import mysql.connector
from mysql.connector import errorcode

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import config


def create_all_tables():
    """
    Crea tutte le tabelle del database per il progetto NORVI/Dory.
    """
    TABLES = {}

    TABLES['gestori'] = (
        """
        CREATE TABLE IF NOT EXISTS gestori (
            GES_COD INT AUTO_INCREMENT PRIMARY KEY,
            GES_NAME VARCHAR(100) NOT NULL
        );
        """
    )

    TABLES['utenti'] = (
        """
        CREATE TABLE IF NOT EXISTS utenti (
            UTE_COD INT AUTO_INCREMENT PRIMARY KEY,
            UTE_USERNAME VARCHAR(50) NOT NULL UNIQUE,
            UTE_PASSWORD VARCHAR(255) NOT NULL,
            UTE_ROLE ENUM('ADMIN', 'GESTORE', 'OPERATORE', 'OSSERVATORE') NOT NULL,
            UTE_GESTORE INT NULL,
            FOREIGN KEY (UTE_GESTORE) REFERENCES gestori(GES_COD)
        );
        """
    )

    TABLES['clienti'] = (
        """
        CREATE TABLE IF NOT EXISTS clienti (
            CLI_COD INT AUTO_INCREMENT PRIMARY KEY,
            CLI_NAME VARCHAR(100) NOT NULL,
            CLI_GESTORE INT NOT NULL,
            FOREIGN KEY (CLI_GESTORE) REFERENCES gestori(GES_COD)
        );
        """
    )

    TABLES['locations'] = (
        """
        CREATE TABLE IF NOT EXISTS locations (
            LOC_COD INT AUTO_INCREMENT PRIMARY KEY,
            LOC_NAME VARCHAR(100) NOT NULL,
            LOC_CLI INT NOT NULL,
            FOREIGN KEY (LOC_CLI) REFERENCES clienti(CLI_COD) ON DELETE CASCADE
        );
        """
    )

     # Contiene tutti i modelli di NORVI
    TABLES['modelli'] = (
        """
        CREATE TABLE IF NOT EXISTS modelli (
            MOD_COD INT AUTO_INCREMENT PRIMARY KEY,
            MOD_NAME VARCHAR(100) NOT NULL
        );
        """
    )

    TABLES['schedules'] = (
        """
        CREATE TABLE IF NOT EXISTS schedules (
            SCH_COD INT AUTO_INCREMENT PRIMARY KEY,
            SCH_NAME VARCHAR(100) NOT NULL UNIQUE
        );
        """
    )

    TABLES['schedule_exceptions'] = (
        """
            CREATE TABLE IF NOT EXISTS schedule_exceptions (
                SEX_SCH INT NOT NULL,
                SEX_DATE DATE NOT NULL,
                FOREIGN KEY (SEX_SCH) REFERENCES schedules(SCH_COD) ON DELETE CASCADE,
                PRIMARY KEY (SEX_SCH, SEX_DATE)
            );
        """
    )   

    TABLES['schedule_times'] = (
        """
        CREATE TABLE IF NOT EXISTS schedule_times (
            ST_SCH INT NOT NULL,
            ST_DAY ENUM('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY') NOT NULL,
            ST_START TIME NOT NULL,
            ST_END TIME NOT NULL,
            FOREIGN KEY (ST_SCH) REFERENCES schedules(SCH_COD) ON DELETE CASCADE,
            PRIMARY KEY (ST_SCH, ST_DAY, ST_START)
        );
        """
    )   

    # Contiene per ogni modello di NORVI le porte disponibili, specificando eventualmente se hanno bisogno di indirizzo i2c
    TABLES['porte_modelli'] = (
        """
        CREATE TABLE IF NOT EXISTS porte_modelli (
            PMO_MOD INT NOT NULL,
            PMO_ADD INT NOT NULL,
            PMO_PRT INT NOT NULL,
            PMO_NAME VARCHAR(50) NOT NULL,
            PMO_TYPE ENUM('DIGITAL_IN','DIGITAL_OUT','ANALOG_IN','ANALOG_OUT') NOT NULL,
            FOREIGN KEY (PMO_MOD) REFERENCES modelli(MOD_COD),
            PRIMARY KEY (PMO_MOD, PMO_ADD, PMO_PRT)

        );
        """ # PMO_ADD è 0 o indirizzo I2C
    )

    # Contiene tutti i modelli di espansioni per il NORVI
    TABLES['espansioni'] = (
        """
        CREATE TABLE IF NOT EXISTS espansioni (
            EXP_COD INT AUTO_INCREMENT PRIMARY KEY,
            EXP_NAME VARCHAR(100) NOT NULL
        );
        """
    )

    # Contiene per ogni espansione le porte disponibili. L'indirizzo i2c essendo modificabile è specificato altrove.
    TABLES['porte_espansioni'] = (
        """
        CREATE TABLE IF NOT EXISTS porte_espansioni (
            PEX_EXP INT NOT NULL,
            PEX_PRT INT NOT NULL,
            PEX_NAME VARCHAR(50) NOT NULL,
            PEX_TYPE ENUM('DIGITAL_IN','DIGITAL_OUT','ANALOG_IN','ANALOG_OUT') NOT NULL,
            FOREIGN KEY (PEX_EXP) REFERENCES espansioni(EXP_COD),
            PRIMARY KEY (PEX_EXP, PEX_PRT)

        ); 
        """
    )

    # Contiene tutti i pannelli registrati nel sistema, abbinati a un cliente, location e modello
    TABLES['pannelli'] = (
        """
        CREATE TABLE IF NOT EXISTS pannelli (
            PAN_COD INT PRIMARY KEY,
            PAN_NAME VARCHAR(100) NOT NULL,
            PAN_MOD INT NOT NULL,
            PAN_CLI INT NOT NULL,
            PAN_LOC INT NOT NULL,
            PAN_FW VARCHAR(10) DEFAULT "1.0.0",
            PAN_LAST_UPD TIMESTAMP DEFAULT NULL,
            PAN_ONLINE BOOLEAN DEFAULT 0,
            PAN_SYNC_STATUS VARCHAR(16) DEFAULT 'SYNCED',
            FOREIGN KEY (PAN_MOD) REFERENCES modelli(MOD_COD),
            FOREIGN KEY (PAN_CLI) REFERENCES clienti(CLI_COD),
            FOREIGN KEY (PAN_LOC) REFERENCES locations(LOC_COD)
        );
        """
    )

     # Contiene per ogni pannello le espansioni effettivamente collegate, specificando l'indirizzo i2c
    TABLES['espansioni_pannelli'] = (
        """
        CREATE TABLE IF NOT EXISTS espansioni_pannelli (
            EPA_PAN INT NOT NULL,
            EPA_EXP INT NOT NULL,
            EPA_ADD INT NOT NULL,
            FOREIGN KEY (EPA_PAN) REFERENCES pannelli(PAN_COD) ON DELETE CASCADE,
            FOREIGN KEY (EPA_EXP) REFERENCES espansioni(EXP_COD),
            PRIMARY KEY (EPA_PAN, EPA_EXP, EPA_ADD)
        );
        """
    )

    # Contiene le porte abilitate per ogni pannello, discriminando per espansione o modello (deve essere coerente con il modello e le espansioni collegate)
    TABLES['porte_pannelli'] = (
        """
        CREATE TABLE IF NOT EXISTS porte_pannelli (
            PPA_PAN INT NOT NULL,   
            PPA_MOD_EXP INT NOT NULL,   
            PPA_ADD INT NOT NULL,   
            PPA_PRT INT NOT NULL,   
            PPA_MAN BOOLEAN NULL,   
            PPA_LAST_VAL INT NULL,  
            PPA_SCH INT NULL,       
            PPA_SRC ENUM('MOD','EXP') NOT NULL,
            PPA_TITLE VARCHAR(100) NULL,
            FOREIGN KEY (PPA_SCH) REFERENCES schedules(SCH_COD),
            FOREIGN KEY (PPA_PAN) REFERENCES pannelli(PAN_COD) ON DELETE CASCADE,
            PRIMARY KEY (PPA_PAN, PPA_MOD_EXP, PPA_ADD, PPA_PRT)
        );
        """
    )
	# Usando PPA_MOD_EXP, PPA_ADD e PPA_PRT possiamo riferirici alle righe di porte_modelli.
	# Usando PPA_MOD_EXP, PPA_PRT possiamo riferirci alle righe di porte_espansioni.
	# La scelta di dove riferirsi è data non da foreign key ma dall'attributo PPA_SRC.
	# In questo modo possiamo sapere per ogni porta anche il suo nome e tipo (digital_in ecc) facendo join.

    TABLES['letture'] = (
        """
        CREATE TABLE IF NOT EXISTS letture (
            LET_COD INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            LET_PAN INT NOT NULL,
            LET_ADD VARCHAR(10) NOT NULL,
            LET_PORT INT NOT NULL,
            LET_VAL FLOAT NOT NULL,
            LET_TIME TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
            FOREIGN KEY (LET_PAN) REFERENCES pannelli(PAN_COD) ON DELETE CASCADE
        );
        """
    )

    try:
        cnx = mysql.connector.connect(host=config.DB_HOST, user=config.DB_USER, password=config.DB_PASSWORD, database=config.DB_NAME)
        cursor = cnx.cursor()
        for name, ddl in TABLES.items():
            print(f"Creazione tabella {name}...")
            cursor.execute(ddl)
        cnx.commit()
        cursor.close()
        cnx.close()
        print("Tutte le tabelle sono state create correttamente!")
    except mysql.connector.Error as err:
        if err.errno == errorcode.ER_ACCESS_DENIED_ERROR:
            print("Errore: accesso negato. Controlla user/password")
        elif err.errno == errorcode.ER_BAD_DB_ERROR:
            print("Errore: database non trovato")
        else:
            print(err)
