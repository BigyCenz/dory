/*

Project:    Skecth NORVI-AE04V
Version:    1.0.2
Author:     Michele Cenzato
Company:    WebInTeam

*/

// Implementate: lettura analogica locale,   lettura analogica periferica,   lettura digitale locale,   NO lettura digitale periferica   (MCP)
//               scrittura analogica locale, scrittura analogica periferica, scrittura digitale locale, NO scrittura digitale periferica (MCP)

// Da implementare: associazione tramite MAC, blocco con password del portale di accesso, valore di default per porte analogiche/digitali in caso di schedule (ora acceso a 1 e basta). range di valori

// Librerie
#include <WiFi.h>
#include <SD.h>
#include <SPI.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_ADS1X15.h>
#include <Update.h>
#include <WebServer.h>
#include <Preferences.h>
#include <PubSubClient.h>
#include <RTClib.h>
#include <WiFiClientSecure.h>
#include "time.h"

// Gestione tempistiche (DA CAMBIARE PER PRODUZIONE)
#define CONFIG_PORTAL_TIME 30000       // Tempo di attivazione portale di configurazione all'avvio
#define WIFI_CONNECT_TIMEOUT 20000     // Tempo di tentativo di connessione al WiFi
#define RETRY_INTERVAL 60000           // Tempo che deve passare prima di fare un altro tentativo di connessione al WiFi
#define READ_INTERVAL 60000            // Tempo di invio dati delle letture
#define WRITE_INTERVAL 60000           // Tempo di controllo orario per decidere su quali porte in modalità automatica scrivere
#define HB_INTERVAL 300000             // Tempo di intervallo invio heartbeat

// Configurazione WiFi standalone
#define WIFI_STANDALONE_SSID "ConfigPanel"
#define WIFI_STANDALONE_PASS "12345678"

// Configurazione OLED
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1

// Altre configurazioni (FARE CONTROLLO SU MAX PORTS!!!!!!!)
#define MAX_PORTS 30
#define MAX_READING_ATTEMPTS 5
#define SD_OFFLINE_DATALOG "/offline.txt"

// Configurazione di base
const char* modello = "IIOT-AE04V";
const char* versione = "1.1.0";

// Configurazione OTA
const char* otaServer = "https://iot.webinteam.com/firmware/";  //Per un modello specifico si può aggiungere un pezzo alla path
const char* otaUser = "webinteam";
const char* otaPass = "webinteam";

// Configurazione MQTT
const char* mqtt_server = "iot.webinteam.com";
const int mqtt_port = 1883;
const char* mqtt_user = "webinteam";
const char* mqtt_pass = "webinteam";

// Configurazione TOPIC MQTT
const char* mqtt_readings_topic = "dory/letture";
const char* mqtt_ota_topic = "dory/ota";
const char* mqtt_ports_topic = "dory/config/ports";
const char* mqtt_schedules_topic = "dory/config/schedules";
const char* mqtt_config_ack_topic = "dory/config/ack";
const char* mqtt_control_topic = "dory/control";
const char* mqtt_pin_state_topic = "dory/states";
const char* mqtt_pin_state_response_topic = "dory/states/response";
const char* mqtt_pin_mode_topic = "dory/ports/mode";
const char* mqtt_ping_topic = "dory/ping";
const char* mqtt_ping_response_topic = "dory/ping_response";
const char* mqtt_i2c_topic = "dory/addresses";
const char* mqtt_i2c_response_topic = "dory/addresses_response";
const char* mqtt_heartbeat_topic = "dory/heartbeat";
const char* mqtt_restart_topic = "dory/restart";
const char* mqtt_log_topic = "dory/log";

// Configurazione generale per porte
struct PortaConfig {

  uint8_t address;       // 0 = porta locale, altrimenti I2C
  uint8_t pin;           // Pin/canale
  uint8_t mode;          // 0 = Input,   1 = Output
  uint8_t type;          // 0 = Analog,  1 = Digital
  uint8_t autoMode;      // 0 = Manuale, 1 = Automatica
  uint8_t defaultValue;  // Valore iniziale (0/1 o analogico) per porte in output
};

// Variabili di supporto
unsigned long lastReconnectAttempt = 0;
unsigned long lastReadTime = 0;
unsigned long lastWriteTime = 0;
unsigned long lastHbTime = 0;
bool rxEnabled = true;
char otaUrl[128];
int numInputPorts = 0;
int numOutputPorts = 0;
String clientId;
String ultimoPayloadInviato = "";
String WIFI_SSID = "";
String WIFI_PASS = "";
String CONN_MODE = "";
String PANEL_COD = "";
bool rtcOk = false;
bool rtcSynced = false;  // per non risincronizzare ogni volta

PortaConfig porte[MAX_PORTS];
StaticJsonDocument<4096> schedulesDoc;
StaticJsonDocument<2048> configDoc;

// Inizializzazione oggetti
RTC_DS3231 rtc;
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
Preferences preferences;
WebServer server(80);
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
Adafruit_ADS1115 ads;

// Manca ricarica pin output defaultValue
// Controllo del pannello inserito (problema di sicurezza se pubblico su pannello di un altro)
// Check coerenza dimensioni StaticJsonDocument e altre variabili
// Ad ora per salvare anche solo una preferences vanno iterate tutte, valutare strada migliore
// Mandare MQTT LOG!!!
void setup() {

  Serial.begin(115200);
  Wire.begin(16, 17);

  // Inizializzazione OLED
  if (!initOLED()) {
    doryLog("[SETUP] Errore inizializzazione OLED");
  } else {
    doryLog("[SETUP] OK - OLED pronto!");
  }

  // Inizializzazione MicroSD
  if (!SD.begin(5)) {
    doryLog("[SETUP] Errore inizializzazione SD");
  } else {
    doryLog("[SETUP] OK - Scheda SD pronta!");
  }

  // Inizializzazione RTC
  rtcOk = rtc.begin();
  if (!rtcOk) {
    doryLog("[SETUP] Errore inizializzazione RTC");
  } else {
    if (rtc.lostPower()) {
      rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
    }
    doryLog("[SETUP] OK - RTC pronto!");
  }

  // Caricamento impostazioni generali (WiFi, codice pannello)
  loadGeneral();
  doryLog("[SETUP] Codice pannello: " + PANEL_COD);
  doryLog("[SETUP] SSID WiFi: " + WIFI_SSID);
  doryLog("[SETUP] PASS WiFi: " + WIFI_PASS);
  bool configurazioneCompleta = (WIFI_SSID.length() > 0 && WIFI_PASS.length() > 0);

  // Inizializzazione portale web di configurazione (al 192.168.4.1)
  startConfigPortal();
  initWebServer();

  // Attivazione momentanea pagina locale di configutazione
  doryLog("[SETUP] Configurazione accessibile per " + String(CONFIG_PORTAL_TIME / 1000) + " secondi...");
  unsigned long startTime = millis();
  while (millis() - startTime < CONFIG_PORTAL_TIME || !configurazioneCompleta) {
    server.handleClient();
    delay(10);
  }
  WiFi.softAPdisconnect(true);
  doryLog(" [SETUP] Portale web disattivato.");

  // Connessione al WiFi
  bool wifiOK = connectToWiFi();
  if (wifiOK) {
    doryLog("[SETUP] OK - WiFi Connesso! IP: " + WiFi.localIP().toString());
    printToOLED("WiFi Connesso!");
  } else {
    doryLog("[SETUP] Avvio offline (Wi-Fi non disponibile)");
    printToOLED("Errore WiFi!");
  }

  // Connessione a MQTT
  if (wifiOK) {

    // Sincronizzazione data e ora
    configTime(3600, 3600, "pool.ntp.org", "time.nist.gov");
    syncRTCFromNTP();

    if (connectMQTT()) {

      printToOLED("MQTT Connesso!");
      sendHeartBeat();

      // Attendi 10 secondi per ricevere eventuali messaggi MQTT (es. configurazione)
      Serial.println("[SETUP] Attendo 10 secondi per ricevere messaggi MQTT iniziali...");
      unsigned long tStart = millis();
      while (millis() - tStart < 10000) {
        mqttClient.loop();
        delay(10);
      }
      Serial.println("[SETUP] Fine attesa MQTT iniziale.");

    } else {
      Serial.println("[SETUP] MQTT non disponibile");
      printToOLED("MQTT NON Connesso!");
    }
  }

  // Caricamento impostazioni per calendari e porte salvate in memoria
  loadSchedules();
  loadPorts();

  // Impostazione delle porte con gli ultimi valori salvati
  applyDefaultManualPorts();
  doryLog("[SETUP] Setup completato.");

}

void loop() {

  // Ricezione su MQTT
  mqttClient.loop();

  // Tentativo di (ri)connessione periodico
  if (WiFi.status() != WL_CONNECTED || !mqttClient.connected()) {
    if (millis() - lastReconnectAttempt > RETRY_INTERVAL) {
      lastReconnectAttempt = millis();
      if (connectToWiFi()) {
        configTime(3600, 3600, "pool.ntp.org", "time.nist.gov");
        syncRTCFromNTP();
        connectMQTT();
      }
    }
  }

  // Lettura e invio dati periodico (solo se esistono porte di input)
  if (millis() - lastReadTime >= READ_INTERVAL && numInputPorts > 0) {
    lastReadTime = millis();
    publishReadings();
  }

  // Aggiornamento periodico stato porte (in base a schedule o modalità manuale)
  if (millis() - lastWriteTime >= WRITE_INTERVAL && numOutputPorts > 0) {
    lastWriteTime = millis();
    checkSchedulesAndSchedulesPerPort();
  }

  // Invio hearthbeat periodico
  if (millis() - lastHbTime >= HB_INTERVAL) {
    lastHbTime = millis();
    sendHeartBeat();
  }

}




// ------------- GESTIONE DELLE PORTE -------------------- //

// Abilitazione porte in base alle impostazioni (pinMode necessario solo per porte locali)
void setupPinMode() {

  String log = "";

  for (int i = 0; i < numInputPorts + numOutputPorts; i++) {
    if (porte[i].address == 0) {
      pinMode(porte[i].pin, porte[i].mode ? OUTPUT : INPUT);
    }
    log = log + "[SETUP/LOAD] Porta " + String(i) + ": addr=0x" + String(porte[i].address, HEX) + " pin=" + String(porte[i].pin) + " mode=" + String(porte[i].mode) + "\n";
  }

  doryLog(log);

}

// Trova indice della porta in porte[] dato address e pin
int findPort(uint8_t address, uint8_t pin) {
  for (int i = 0; i < numInputPorts + numOutputPorts; i++) {
    if (porte[i].address == address && porte[i].pin == pin) {
      return i;
    }
  }
  return -1;
}

// Attiva o disattiva la porta passata
void setPortState(PortaConfig& port, int value) {

  if (port.mode != 1) return;  // solo output

  if (port.address == 0) {

    // locale
    if (port.type == 1) digitalWrite(port.pin, value); // Output locale digitale
    else analogWrite(port.pin, value);                 // Output locale analogico

  } else {

    // I2C
    if (port.type == 1) Serial.print("[Not impl]");    // IMPLEMENTARE OUTPUT i2c DIGITALE
    else { config_dac(port.address, 0, 0, 0, 0); write_channel(port.address, port.pin, value);} // Output i2c analogico

  }

}

// Funzione per configurare il DAC per controllare i pin analogici di output su espansioni
void config_dac(byte device_address, unsigned int c1, unsigned int c2, unsigned int c3, unsigned int c4) {
  unsigned int tft_value = 0;
  Wire.beginTransmission(device_address);
  Wire.write(0x01);  // Pointer Register
  tft_value = c4 << 3;
  tft_value = tft_value | (c3 << 2);
  tft_value = tft_value | (c2 << 1);
  tft_value = tft_value | c1;
  Serial.print("BINARY PRINT  ");
  Serial.println(tft_value, BIN);
  Wire.write(tft_value);  //  Register [1] Config
  Wire.endTransmission();
}

// Scrive un valore analogico su DAC i2c, per porte analogiche di output (su espansioni)
void write_channel(byte device_address, unsigned int channel, unsigned int value) {

  unsigned int tft_value=0;
  Wire.beginTransmission(device_address);
  Wire.write(1+(channel*2)); // Pointer Register
  tft_value = value >>8;
  Wire.write(tft_value); //  Register [1] Config
  tft_value = value & 0xFF;
  Wire.write(tft_value); //  Register [1] Config
  Wire.endTransmission();

}

// Imposta tutte le porte in manuale al valore di default
void applyDefaultManualPorts() {
  for (int i = 0; i < numInputPorts + numOutputPorts; i++) {
    PortaConfig& port = porte[i];

    // controlla solo output
    if (port.mode != 1) continue;

    // controlla se in modalità manuale
    if (!port.autoMode) {
      setPortState(port, port.defaultValue);
      Serial.printf("[INIT] Porta addr=0x%02X pin=%d impostata a default=%d (manuale)\n",port.address, port.pin, port.defaultValue);
    }
  }

}

// Imposta le porte in modalità automatica in stato acceso nei range stabiliti
void checkSchedulesAndSchedulesPerPort() {
  int h, m, dow;
  char currentDate[11]; // YYYY-MM-DD
  getCurrentTime(h, m, dow, currentDate, sizeof(currentDate));

  const char* days[] = { "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday" };
  const char* today = days[dow];

  for (int i = 0; i < numInputPorts + numOutputPorts; i++) {
    PortaConfig& port = porte[i];
    if (!port.autoMode) continue;
    // schedule_ref come stringa nelle preferences
    preferences.begin("ports", true);
    String portsJson = preferences.getString("ports", "[]");
    preferences.end();
    StaticJsonDocument<2048> docPorts;
    deserializeJson(docPorts, portsJson);
    JsonArray portsArr = docPorts.as<JsonArray>();
    String scheduleRef = "";
    if (i < portsArr.size() && portsArr[i]["schedule_ref"]) {
      scheduleRef = String(portsArr[i]["schedule_ref"].as<const char*>());
    }
    if (scheduleRef == "") continue;
    // Cerca lo schedule
    JsonObject schedForPort = schedulesDoc[scheduleRef];
    if (schedForPort.isNull()) continue;
    // Controllo eccezioni
    bool skipToday = false;
    JsonArray exc = schedForPort["exceptions"];
    if (!exc.isNull()) {
      for (const char* d : exc) {
        Serial.println(String(d) + " " + currentDate);
        Serial.println(strcmp(d, currentDate));
        if (strcmp(d, currentDate) == 0) {
          skipToday = true;
          break;
        }
      }
    }
    // Controllo intervalli orari
    bool active = false;
    if (!skipToday) {
      JsonObject times = schedForPort["times"];
      if (!times.isNull()) {
        JsonArray todayArr = times[today];
        if (!todayArr.isNull()) {
          for (JsonObject range : todayArr) {
            const char* start = range["start"];
            const char* end   = range["end"];
            if (start && end && inTimeRange(start, end, h, m)) {
              active = true;
              break;
            }
          }
        }
      }
    }
    // Aggiorna stato porta
    setPortState(port, active ? 1 : 0);
  }
}






// ------------- GESTIONE DEL TEMPO (DATA E ORA) -------------------- //


// Sincronizza RTC da NTP
void syncRTCFromNTP() {
  struct tm timeinfo;
  if (getLocalTime(&timeinfo)) {
    DateTime dt(
      timeinfo.tm_year + 1900,
      timeinfo.tm_mon + 1,
      timeinfo.tm_mday,
      timeinfo.tm_hour,
      timeinfo.tm_min,
      timeinfo.tm_sec
    );
    rtc.adjust(dt);
    rtcSynced = true;
    doryLog("[RTC] RTC aggiornato da NTP.");
  } else {
    doryLog("[RTC] Impossibile sincronizzare RTC da NTP.");
  }
}

// Normalizzazione data per coerenza RTC e NTP
int normalizeWday(int wday, bool fromRTC) {
  if (fromRTC) {
    // DS3231: 0=Lunedì...6=Domenica → trasformo in 0=Domenica...6=Sabato
    return (wday == 6) ? 0 : wday + 1;
  } else {
    // NTP già in formato 0=Domenica...6=Sabato
    return wday;
  }
}

// Ottiene data e ora da RTC, se non va prova da NTP
void getCurrentTime(int& h, int& m, int& wday, char* currentDate, size_t dateLen) {

  struct tm timeinfo;

  // Se RTC disponibile e valido
  if (rtcOk && !rtc.lostPower()) {
    DateTime now = rtc.now();
    h = now.hour();
    m = now.minute();
    wday = normalizeWday(now.dayOfTheWeek(), true);

    snprintf(currentDate, dateLen, "%04d-%02d-%02d",
             now.year(), now.month(), now.day());

    char buffer[64];
    snprintf(buffer, sizeof(buffer), "%02d/%02d/%04d %02d:%02d:%02d",
             now.day(), now.month(), now.year(),
             now.hour(), now.minute(), now.second());
    Serial.println(String("[TIME] Ora da RTC: ") + buffer + " (weekday=" + String(wday) + ")");
    return;
  }

  // Altrimenti prova da NTP
  if (getLocalTime(&timeinfo)) {
    h = timeinfo.tm_hour;
    m = timeinfo.tm_min;
    wday = normalizeWday(timeinfo.tm_wday, false);

    snprintf(currentDate, dateLen, "%04d-%02d-%02d",
             timeinfo.tm_year + 1900,
             timeinfo.tm_mon + 1,
             timeinfo.tm_mday);

    char buffer[64];
    strftime(buffer, sizeof(buffer), "%d/%m/%Y %H:%M:%S", &timeinfo);
    Serial.println(String("[TIME] Ora da NTP: ") + buffer + " (weekday=" + String(wday) + ")");
  } else {
    Serial.println("[TIME] Errore: impossibile ottenere ora né da RTC né da NTP");
    h = 0; m = 0; wday = 0;
    snprintf(currentDate, dateLen, "1970-01-01");
  }
}

// Controlla se ora corrente è dentro un intervallo
bool inTimeRange(const char* start, const char* end, int h, int m) {
  int sh = atoi(String(start).substring(0, 2).c_str());
  int sm = atoi(String(start).substring(3, 5).c_str());
  int eh = atoi(String(end).substring(0, 2).c_str());
  int em = atoi(String(end).substring(3, 5).c_str());

  int now = h * 60 + m;
  int s = sh * 60 + sm;
  int e = eh * 60 + em;

  return (now >= s && now < e);
}




// ------------- GESTIONE DELLE LETTURE (PORTE DI INPUT) -------------------- //

// Pubblica su MQTT o su scheda SD le letture delle porte abilitate
// MANCA CONTROLLO DATI UGUALI e STABILIZZAZIONE A RANGE LETTURE!!!
// Ad ora manda su un unico topic e differenzia per panel_cod, valutare di separare i topic
void publishReadings() {

  Serial.println("Ora di leggere!");
  if (!rxEnabled) {
    Serial.println("Ricezione disattivata.");
    return;
  }

  StaticJsonDocument<4096> doc;
  JsonArray readings = doc.createNestedArray("readings");

  // Lettura porte di input
  for (int i = 0; i < numInputPorts + numOutputPorts; i++) {

    PortaConfig& port = porte[i];

    if (port.mode) continue;

    int pin = port.pin;
    int addr = port.address;

    int valoreStabilizzato;
    if (addr == 0) {
      valoreStabilizzato = digitalRead(pin);
    } else {
      if (i2cDeviceExists(addr)) {
        ads.begin(addr); // DA NON FARE OGNI VOLTA!!!
        valoreStabilizzato = ads.readADC_SingleEnded(pin);
      }
    }
   
    JsonObject lettura = readings.createNestedObject();
    lettura["address"] = addr;
    lettura["pin"] = pin;
    lettura["value"] = valoreStabilizzato;
  }

  if (readings.size() == 0) return;

  char buffer[4096];
  size_t len = serializeJson(doc, buffer);

  // Tentativo di invio dati MQTT oppure tentativo di salvataggio su scheda MicroSD
  if (WiFi.status()==WL_CONNECTED && mqttClient.connected()) {
    if (mqttClient.publish(panelTopic(mqtt_readings_topic).c_str(), buffer, len)) {
      Serial.println("[READ] Pubblicato MQTT:");
      Serial.println(buffer);
      tryToSendOfflineReadings();
    } else {
      Serial.println("[READ] Errore invio MQTT, salvo su SD.");
      appendToOfflineLog(buffer);
    }
  } else {
    Serial.println("[READ] Offline, salvo su SD.");
    appendToOfflineLog(buffer);
  }

}




// ------------- GESTIONE MQTT -------------------- //

// Gestisce la connessione al broker MQTT e sottoscrizione ai topic
bool connectMQTT() {

  if (mqttClient.connected()) {
    return true;
  }

  mqttClient.setBufferSize(2048);
  mqttClient.setServer(mqtt_server, mqtt_port);
  mqttClient.setCallback(callbackMQTT);
  clientId = "client" + String(millis(), HEX) + " - " + String(PANEL_COD);

  const int maxRetries = 5;
  int retryCount = 0;

  Serial.print("Tentativo connessione MQTT con clientId: ");
  Serial.println(clientId);

  // Tentativo di riconnessione
  while (retryCount < maxRetries) {

    if (mqttClient.connect(clientId.c_str(), mqtt_user, mqtt_pass)) {

      // Iscrizione ai topic
      mqttClient.subscribe(panelTopic(mqtt_pin_mode_topic).c_str());
      mqttClient.subscribe(panelTopic(mqtt_pin_state_topic).c_str());
      mqttClient.subscribe(panelTopic(mqtt_i2c_topic).c_str());
      mqttClient.subscribe(panelTopic(mqtt_restart_topic).c_str());
      mqttClient.subscribe(panelTopic(mqtt_ota_topic).c_str());
      mqttClient.subscribe(panelTopic(mqtt_ping_topic).c_str());
      mqttClient.subscribe(panelTopic(mqtt_ports_topic).c_str());
      mqttClient.subscribe(panelTopic(mqtt_schedules_topic).c_str());
      mqttClient.subscribe(panelTopic(mqtt_control_topic).c_str());

      Serial.println("[MQTT] MQTT connesso!");

      return true;

    } else {

      int state = mqttClient.state();
      Serial.printf("Connessione MQTT fallita (tentativo %d/%d), stato: %d\n", retryCount + 1, maxRetries, state);
      retryCount++;
    }
  }

  Serial.println("Connessione MQTT fallita dopo massimo tentativi.");
  return false;
}

// Gestione messaggi ricevuti MQTT
// Sistemare o rimuovere RX_ENABLE. Fare controlli "ContainsKey" e non mettere di default a zero
void callbackMQTT(char* topic, byte* payload, unsigned int length) {

  // Costruzione messaggio MQTT
  String msg;
  for (int i = 0; i < length; i++) msg += (char)payload[i];
  Serial.printf("[MQTT] Ricevuto su %s: %s\n", topic, msg.c_str());

  StaticJsonDocument<2048> doc;
  DeserializationError parseError = deserializeJson(doc, msg);

  // --- ACK LOGIC: only for config topics ---
  bool isConfigTopic = (String(topic).indexOf(mqtt_ports_topic) != -1) || (String(topic).indexOf(mqtt_schedules_topic) != -1);
  bool configOk = false;

  // Messaggi MQTT validi
  if (!parseError) {

    // Stato pin
    if (String(topic).indexOf(mqtt_pin_state_topic) != -1) {
      // Payload atteso: { "pins": [ { "address": <int>, "pin": <int> }, ... ] }
      StaticJsonDocument<512> respDoc;
      JsonArray arr = respDoc.createNestedArray("states");

      if (doc.containsKey("pins")) {
        JsonArray pins = doc["pins"].as<JsonArray>();
        for (JsonObject p : pins) {
          int addr = p["address"] | 0;
          int pin = p["pin"] | 0;

          // Cerca la porta corrispondente in porte[]
          int idx = findPort(addr, pin);
          if (idx < 0) continue; // non trovata, non aggiungere

          int type = porte[idx].type; // 0=analog, 1=digital

          int value = 0;
          if (addr == 0) {
            if (type == 1) {
              value = digitalRead(pin);
            } else {
              value = analogRead(pin);
            }
          } else {
            value = -1;
            // Espansione I2C
            if (type == 1) {
              // Digital read su espansione: non implementato
            } else {
              //value = read_channel(addr, pin);
            }
          }
          JsonObject state = arr.createNestedObject();
          state["address"] = addr;
          state["pin"] = pin;
          state["type"] = type;
          state["value"] = value;
        }
      }

      char respBuf[512];
      size_t respLen = serializeJson(respDoc, respBuf);
      mqttClient.publish(panelTopic(mqtt_pin_state_response_topic).c_str(), respBuf, respLen);
      return;
    }

    // Gestione porte
    if (String(topic).indexOf(mqtt_ports_topic) != -1) {

      preferences.begin("ports", false);

      // Sovrascrivi direttamente tutte le porte ricevute
      if (doc.containsKey("ports")) {
        String portsStr;
        serializeJson(doc["ports"], portsStr);
        preferences.putString("ports", portsStr);
      }

      preferences.end();
      loadPorts();
      Serial.println("[MQTT] Configurazione porte aggiornata.");
      configOk = true;
    }

    // Gestione schedules
    if (String(topic).indexOf(mqtt_schedules_topic) != -1) {

      preferences.begin("schedules", false);

      // Se sono presenti nuovi schedules, li salvo
      if (doc.containsKey("schedules")) {
        String schedulesStr;
        serializeJson(doc["schedules"], schedulesStr);
        Serial.println(schedulesStr);
        preferences.putString("schedules", schedulesStr);
      }

      preferences.end();
      loadSchedules();
      Serial.println("[MQTT] Configurazione schedules aggiornata.");
      configOk = true;
    }
    
    // Gestione controllo valori porte
    if (String(topic).indexOf(mqtt_control_topic) != -1) {

      uint8_t addr = doc["address"] | 0;
      uint8_t pin = doc["pin"] | 0;
      int value = doc["value"] | 0;
      bool save = doc.containsKey("save") && doc["save"].as<bool>();

      bool found = false;
      for (int i = 0; i < numInputPorts + numOutputPorts; i++) {

        if (porte[i].address == addr && porte[i].pin == pin) {

          found = true;

          if (!porte[i].mode) { Serial.printf("[MQTT] Porta addr=0x%02X pin=%d in modalità input, ignorato.\n", addr, pin); continue; }
          if (porte[i].autoMode) { Serial.printf("[MQTT] Porta addr=0x%02X pin=%d in modalità automatica, ignorato.\n", addr, pin); continue; }

          uint8_t type = porte[i].type;

          // Scrittura effettiva in base alla tipologia di porta (anlogica/digitale) e al piazzamento (dispositivio principale/estensione)
          if (type == 1) {
            if (addr == 0) digitalWrite(pin, value);
            //else config_dac(addr, pin, value, 0);  // espansioni digitale
          } else {
            if (addr == 0) analogWrite(pin, value);
            else write_channel(addr, pin, value);
          }

          doryLog("[MQTT] Scritto valore " + String(value) + " su addr=0x" + String(addr, HEX) + " pin=" + String(pin));

          // Se il valore inviato deve essere ripreso al prossimo avvio
          if (save) {

            porte[i].defaultValue = value;

            // Salvataggio array porteOutput in preferences come JSON (è evitabile ricreare JSON completo per un singolo cambiamento? magari sì, ma alla fine)
            StaticJsonDocument<2048> docOut;
            JsonArray arr = docOut.to<JsonArray>();
            for (int j = 0; j < numOutputPorts + numInputPorts; j++) {
              JsonObject o = arr.createNestedObject();
              o["address"] = porte[j].address;
              o["pin"] = porte[j].pin;
              o["type"] = porte[j].type;
              o["mode"] = porte[j].mode;
              o["autoMode"] = porte[j].autoMode;
              o["defaultValue"] = porte[j].defaultValue;
            }
            String jsonStr;
            serializeJson(arr, jsonStr);
            preferences.begin("ports", false);
            preferences.putString("ports", jsonStr);
            preferences.end();

            Serial.printf("[MQTT] Valore di default salvato per addr=0x%02X pin=%d\n", addr, pin);
          }

          break;
        }
      }

      if (!found) {
        doryLog("[MQTT] Porta non trovata (addr=0x%02X pin=%d)" + String(addr, HEX) + String(pin));
      }

    }

    // Gestione controllo modalità porte (manuale, automatica, VALUTARE SE TOGLIERE)
    if (String(topic).indexOf(mqtt_pin_mode_topic) != -1) {

      if (doc.containsKey("ports")) {
        JsonArray arr = doc["ports"].as<JsonArray>();
        
        for (JsonObject p : arr) {

          uint8_t addr = p["address"] | 0;
          uint8_t pin  = p["pin"] | 0;
          uint8_t autoMode = p["autoMode"] | 0;

          // cerca porta corrispondente
          for (int i = 0; i < numInputPorts + numOutputPorts; i++) {
            if (porte[i].address == addr && porte[i].pin == pin) {
              porte[i].autoMode = autoMode;
              Serial.printf("[MQTT] Aggiornata autoMode: addr=0x%02X pin=%d -> %d\n", addr, pin, autoMode);
              break;
            }
          }
      
          // --- SALVA NELLE PREFERENCES ---
          preferences.begin("ports", false); // false = scrittura
          StaticJsonDocument<2048> docSave;
          JsonArray saveArr = docSave.to<JsonArray>();

          for (int i = 0; i < numInputPorts + numOutputPorts; i++) {
            JsonObject obj = saveArr.createNestedObject();
            obj["address"] = porte[i].address;
            obj["pin"]     = porte[i].pin;
            obj["mode"]    = porte[i].mode;
            obj["type"]    = porte[i].type;
            obj["defaultValue"] = porte[i].defaultValue;
            obj["autoMode"]     = porte[i].autoMode;
          }

          String finalPorts;
          serializeJson(saveArr, finalPorts);
          preferences.putString("ports", finalPorts);
          preferences.end();

          Serial.println("[PREFERENCES] Porte salvate con nuovo autoMode.");
        }

      }

    }

    // Aggiornamento OTA
    if (String(topic).indexOf(mqtt_ota_topic) != -1) {

      if (doc["force"].as<bool>()) {

        String version = doc["version"] | "1.0.0";  // default versione 1.0.0
        sprintf(otaUrl, "%sfirmware_%s.bin", otaServer, version);
        doryLog("[MQTT/OTA] Avvio aggiornamento OTA alla versione " + version + " per pannello " + PANEL_COD);
        performHttpOta();
      }

    }

    // Ping
    if (String(topic).indexOf(mqtt_ping_topic) != -1) {
      Serial.println("Ping received! Replying...");
      mqttClient.publish(panelTopic(mqtt_ping_response_topic).c_str(), (String("Pannello ") + PANEL_COD + " Online, versione " + versione).c_str());
    }

    // I2C Address Discover
    if (String(topic).indexOf(mqtt_i2c_topic) != -1) {
      Serial.println("[MQTT] I2C Address discover request! Replying...");
      String msg = discoverI2C();
      mqttClient.publish(panelTopic(mqtt_i2c_response_topic).c_str(), msg.c_str());
    }

    // Restart ESP
    if (String(topic).indexOf(mqtt_restart_topic) != -1) {
      Serial.println("Richiesta riavvio. Esecuzione...");
      delay(5000);
      ESP.restart();
    }

  } else {
    doryLog("[MQTT] Errore parsing JSON");
    if (isConfigTopic) configOk = false;
  }

  // --- PUBBLICAZIONE ACK CONFIGURAZIONE ---
  if (isConfigTopic) {
    String ackTopic = panelTopic(mqtt_config_ack_topic);
    String ackPayload;
    if (configOk) {
      ackPayload = "{\"status\":\"ok\"}";
    } else {
      ackPayload = "{\"status\":\"error\"}";
    }
    mqttClient.publish(ackTopic.c_str(), ackPayload.c_str());
  }

}

// Manda un messaggio MQTT di Heartbeat
void sendHeartBeat() {
  if (mqttClient.connected()) {
    mqttClient.publish(panelTopic(mqtt_heartbeat_topic).c_str(), (String("Pannello ") + PANEL_COD + " Online, versione " + versione).c_str());
    Serial.println("Mandato Heartbeat");
  }
}




// ------------- INIZIALIZZAZIONE MODULI -------------------- //

// Inizializzazione dispaly OLED
bool initOLED() {
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    return false;
  } else {
    printToOLED("Versione: " + String(versione));
    return true;
  }
}

// Funzione per stampare un messaggio
void printToOLED(const String& message) {
  display.clearDisplay();
  display.setCursor(0, 0);
  display.setTextSize(1);
  display.setTextColor(WHITE);
  display.println(message);
  display.display();
}




// -------- GESTIONE AGGIORNAMENTO OTA -------- //

void performHttpOta() {

  printToOLED("Updating...");
  delay(3000);

  WiFiClientSecure otaClient;  // HTTPS client
  otaClient.setInsecure();     // solo test, non verifica certificato

  HTTPClient http;

  Serial.printf("[OTA] Connessione a %s\n", String(otaUrl).c_str());
  http.begin(otaClient, String(otaUrl));    // URL firmware HTTPS
  http.setAuthorization(otaUser, otaPass);  // Basic Auth

  int httpCode = http.GET();
  if (httpCode == HTTP_CODE_OK) {
    int len = http.getSize();
    WiFiClient* stream = http.getStreamPtr();

    if (!Update.begin(len)) {
      doryLog("Update.begin fallito");
      printToOLED("Update begin fallito!");
      http.end();
      return;
    }

    size_t written = Update.writeStream(*stream);
    if (written != len) {
      doryLog("Update incompleto");
      printToOLED("Update incompleto!");
      http.end();
      return;
    }

    if (Update.end() && Update.isFinished()) {
      printToOLED("Update completato!");
      doryLog("Update completato. Riavvio...");
      delay(5000);
      ESP.restart();
    } else {
      printToOLED("Update NON completato!");
      doryLog("Update non completato.");
    }
  } else {
    doryLog("Errore HTTP: " + String(httpCode));
    printToOLED("Errore HTTP");
  }

  http.end();
}




// -------- GESTIONE WIFI -------- //

bool connectToWiFi() {

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID.c_str(), WIFI_PASS.c_str());

  unsigned long t0 = millis();

  while (WiFi.status() != WL_CONNECTED && millis() - t0 < WIFI_CONNECT_TIMEOUT) {
    delay(500);
    Serial.print(".");
  }

  return WiFi.status() == WL_CONNECTED;
}

void startConfigPortal() {
  WiFi.softAP(WIFI_STANDALONE_SSID, WIFI_STANDALONE_PASS);
  Serial.println("Access Point: " + String(WIFI_STANDALONE_SSID));
  Serial.print("IP: ");
  Serial.println(WiFi.softAPIP());
}




// -------- GESTIONE PAGINA WEB CONFIGURAZIONE -------- //

void initWebServer() {
  server.on("/", handleRoot);
  server.on("/save", handleSave);
  server.begin();
}

void handleRoot() {

  String html = R"rawliteral(
      <!DOCTYPE html>
      <html>
        <head>
          <title>Configurazione dispositivo</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { 
              font-family: Arial; 
              background: #f0f0f0; 
              padding-top: 20px; 
              text-align: center; 
            }
            form { 
              background: white; 
              padding: 20px; 
              margin: auto; 
              width: 90%%; 
              max-width: 400px; 
              border-radius: 10px; 
              box-shadow: 0 0 10px rgba(0,0,0,0.1); 
            }
            input[type='text'], 
            input[type='password'] { 
              width: 100%%; 
              padding: 12px; 
              margin: 10px 0; 
              border: 1px solid #ccc; 
              border-radius: 5px; 
              box-sizing: border-box;
            }
            button { 
              background: #007BFF; 
              color: white; 
              padding: 12px; 
              margin-top: 20px; /* distanzia dal campo sopra */
              border: none; 
              border-radius: 5px; 
              cursor: pointer; 
              width: 100%%; 
              font-size: 16px;
            }
            button:hover { background: #0056b3; }
            label { 
              display: block; 
              margin: 10px 0 5px; 
              text-align: left; 
            }
          </style>
        </head>
        <body>
          <form action="/save" method="get">
            <h2>Wi-Fi</h2>
            <input name="ssid" type="text" placeholder="SSID Wi-Fi" required>
            <input name="pass" type="password" placeholder="Password Wi-Fi" required>

            <h2>Pannello</h2>
            <input name="panel" type="text" placeholder="Codice Pannello" required>
            
            <button type="submit">Salva configurazione</button>
          </form>
        </body>
    </html>
  )rawliteral";


  server.send(200, "text/html", html);
}

void handleSave() {

  if (server.hasArg("ssid") && server.hasArg("pass") && server.hasArg("panel")) {

    preferences.begin("settings", false);
    preferences.putString("ssid", server.arg("ssid"));
    preferences.putString("pass", server.arg("pass"));
    preferences.putString("panel", server.arg("panel"));

    preferences.end();
    server.send(200, "text/html", "<h3>Configurazione salvata! Riavvio...</h3>");
    delay(1000);
    ESP.restart();

  } else {
    server.send(400, "text/plain", "Parametri mancanti.");
  }
}




// -------- GESTIONE IMPOSTAZIONI IN MEMORIA -------- //

void loadSettings() {

  loadGeneral();
  loadPorts();
  loadSchedules();
}

void loadGeneral() {
  preferences.begin("settings", true);
  WIFI_SSID = preferences.getString("ssid", "");
  WIFI_PASS = preferences.getString("pass", "");
  PANEL_COD = preferences.getString("panel", "");
  rxEnabled = preferences.getBool("rx_enabled", true);
  preferences.end();
  Serial.println("Preferenze generali caricate.");
}

void loadPorts() {

  // --- CARICAMENTO PORTE --- //
  preferences.begin("ports", true);

  String portsJson = preferences.getString("ports", "[]");

  // Logga il contenuto delle porte su MQTT log topic
  //doryLog("[PORTS] Contenuto preferences: " + portsJson);

  StaticJsonDocument<2048> docPorts;

  DeserializationError err = deserializeJson(docPorts, portsJson);

  numInputPorts = 0;
  numOutputPorts = 0;

  // Parsing porte
  if (err) {

    doryLog("[SETUP/LOAD] Errore parsing JSON porte: " + String(err.c_str()));

  } else {

    JsonArray portsArr = docPorts.as<JsonArray>();

    for (JsonObject p : portsArr) {

      PortaConfig& port = porte[numInputPorts + numOutputPorts];

      port.address = p["address"] | 0;
      port.pin = p["pin"] | 0;
      port.type = p["type"] | 0;
      port.mode = p["mode"] | 0;
      port.autoMode = p["autoMode"] | 0;

      if (!port.mode) {
        numInputPorts++;
      } else {
        numOutputPorts++;
        port.defaultValue = p["defaultValue"] | 0;
      }
    }
  }

  preferences.end();

  doryLog("[SETUP/LOAD] Configurazione porte caricata: " + String(numInputPorts) + " ingressi, " + String(numOutputPorts) + " uscite");
  setupPinMode();

}

void loadSchedules() {

  preferences.begin("schedules", true);
  String schedulesStr = preferences.getString("schedules", "{}");
  DeserializationError errSched = deserializeJson(schedulesDoc, schedulesStr);

  if (errSched) {
    doryLog("[SETUP/LOAD] Errore parsing JSON schedules: " + String(errSched.c_str()));
  } else {
    doryLog("[SETUP/LOAD] Schedules caricati correttamente.");
  }
  preferences.end();

  // Debug: stampa tutte le schedule caricate
  for (JsonPair s : schedulesDoc.as<JsonObject>()) {
    Serial.println("Schedule: " + String(s.key().c_str()));
    JsonObject sched = s.value().as<JsonObject>();
    if (!sched.containsKey("times")) continue;
    JsonObject times = sched["times"].as<JsonObject>();
    for (JsonPair d : times) {
      JsonArray ranges = d.value().as<JsonArray>();
      Serial.println("  " + String(d.key().c_str()) + ":");
      for (JsonObject r : ranges) {
        Serial.println("    " + String(r["start"].as<const char*>()) + " - " + String(r["end"].as<const char*>()));
      }
    }
  }
}




// ------- GESTIONE BACKUP SU SCHEDA SD ------- //

void appendToOfflineLog(const String& jsonLine) {
  File file = SD.open(SD_OFFLINE_DATALOG, FILE_APPEND);
  if (file) {
    file.println(jsonLine);
    file.close();
  } else {
    Serial.println("Errore apertura file datalog offline");
  }
}

void tryToSendOfflineReadings() {
  File file = SD.open(SD_OFFLINE_DATALOG, FILE_READ);
  if (!file) return;

  File temp = SD.open("/temp.txt", FILE_WRITE);
  while (file.available()) {
    String line = file.readStringUntil('\n');
    if (mqttClient.connected() && mqttClient.publish(panelTopic(mqtt_readings_topic).c_str(), line.c_str())) {
      Serial.println("Recuperato e pubblicato: " + line);
    } else {
      temp.println(line);
    }
  }
  file.close();
  temp.close();

  SD.remove(SD_OFFLINE_DATALOG);
  SD.rename("/temp.txt", SD_OFFLINE_DATALOG);
}




// -------- FUNZIONI DI SUPPORTO -------- //

// Log sulla seriale e su MQTT
void doryLog(const String& msg) {
  Serial.println(msg);
  //printToOLED(msg);
  if (WiFi.status() == WL_CONNECTED && mqttClient.connected()) {
    mqttClient.publish(panelTopic(mqtt_log_topic).c_str(), msg.c_str());
  }
}

// Controllo esistenza di un dispositivo I2C
bool i2cDeviceExists(uint8_t addr) {
  Wire.beginTransmission(addr);
  return (Wire.endTransmission() == 0);
}

// Funzione per generare il topic MQTT del pannello corrente
String panelTopic(const char* baseTopic) {
  return String(baseTopic) + "/" + PANEL_COD;
}

// Funzione che scopre gli indirizzi I2C collegati
String discoverI2C() {
  String result = "{ \"i2c_addresses\": [";
  bool first = true;

  for (byte address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    if (Wire.endTransmission() == 0) {
      if (!first) result += ",";
      result += String(address, HEX);  // indirizzo in HEX
      first = false;
    }
  }

  result += "] }";
  return result;
}




/*


Di seguito i principali topic MQTT e il formato JSON atteso/inviato:

----------------------------------------------------------
Topic: dory/letture/<PANEL_COD> (mqtt_readings_topic)
Tipo: PUB
Formato inviato:
{
  "readings": [
    { "address": <int>, "pin": <int>, "value": <int> },
    ...
  ]
}
----------------------------------------------------------
Topic: dory/config/ports/<PANEL_COD> (mqtt_ports_topic)
Tipo: SUB
Formato atteso:
{
  "ports": [
    {
      "address": <int>,
      "pin": <int>,
      "type": <int>,
      "mode": <int>,
      "autoMode": <int>,
      "defaultValue": <int>,
      "schedule_ref": <string> // opzionale
    },
    ...
  ]
}
Se presente: { "reset": true } per reset configurazione porte.
----------------------------------------------------------
Topic: dory/config/schedules/<PANEL_COD> (mqtt_schedules_topic)
Tipo: SUB
Formato atteso:
{
  "schedules": {
    "<schedule_ref>": {
      "exceptions": [ "YYYY-MM-DD", ... ],
      "times": {
        "monday": [ { "start": "HH:MM", "end": "HH:MM" }, ... ],
        ...
      }
    },
    ...
  }
}

----------------------------------------------------------
Topic: dory/control/<PANEL_COD> (mqtt_control_topic)
Tipo: SUB
Formato atteso:
{
  "address": <int>,
  "pin": <int>,
  "value": <int>,
  "save": <bool> // opzionale, se true salva come defaultValue
}
----------------------------------------------------------
Topic: dory/ports/mode/<PANEL_COD> (mqtt_pin_mode_topic)
Tipo: SUB
Formato atteso:
{
  "ports": [
    {
      "address": <int>,
      "pin": <int>,
      "autoMode": <int>
    },
    ...
  ]
}
----------------------------------------------------------
Topic: dory/ota/<PANEL_COD> (mqtt_ota_topic)
Tipo: SUB
Formato atteso:
{
  "force": true,
  "version": "1.0.0"
}
----------------------------------------------------------
Topic: dory/ping/<PANEL_COD> (mqtt_ping_topic)
Tipo: SUB
Formato atteso: qualsiasi payload (non usato)
Risposta su dory/ping_response/<PANEL_COD>:
  "Pannello <PANEL_COD> Online, versione <versione>"
----------------------------------------------------------
Topic: dory/addresses/<PANEL_COD> (mqtt_i2c_topic)
Tipo: SUB
Formato atteso: qualsiasi payload (non usato)
Risposta su dory/addresses_response/<PANEL_COD>:
{
  "i2c_addresses": [ "hex", ... ]
}
----------------------------------------------------------
Topic: dory/heartbeat/<PANEL_COD> (mqtt_heartbeat_topic)
Tipo: PUB
Formato inviato:
  "Pannello <PANEL_COD> Online, versione <versione>"
----------------------------------------------------------
Topic: dory/log/<PANEL_COD> (mqtt_log_topic)
Tipo: PUB
Formato inviato:
  "<messaggio di log>" (stringa semplice)
----------------------------------------------------------
Topic: dory/config/ack/<PANEL_COD> (mqtt_config_ack_topic)
Tipo: PUB
Formato inviato:
  { "status": "ok" } oppure { "status": "error" }
----------------------------------------------------------
*/