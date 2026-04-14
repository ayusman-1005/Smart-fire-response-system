#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

#define NODE_ID "SD_Hall"

// WiFi
#define WIFI_SSID "Realme 8i"
#define WIFI_PASSWORD "2444666668888888"

// MQTT (HiveMQ Cloud)
#define MQTT_HOST "d1df7b2e9a394f44a7b6827a5ae0920c.s1.eu.hivemq.cloud"
#define MQTT_PORT 8883
#define MQTT_USER "ayusman"
#define MQTT_PASS "Youshouldnotseethis1"

// UART
#define UART_RX_PIN 16
#define UART_TX_PIN 17
#define UART_BAUD 9600

// Pins
#define BUZZER_1_PIN 25
#define BUZZER_2_PIN 26
#define RELAY_PIN 27

WiFiClientSecure secureClient;
PubSubClient mqttClient(secureClient);

String serialBuffer = "";
unsigned long lastDataTime = 0;

// Topics
String TOPIC_DATA = "sensors/SD_Hall/data";
String TOPIC_CONTROL = "sensors/SD_Hall/control";

// Actuator states
bool relayOn = false;
bool buzzerOn = false;

// ---------------- WIFI ----------------
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) delay(300);
}

// ---------------- MQTT ----------------
void connectMQTT() {
  while (!mqttClient.connected()) {
    String clientId = "ESP32-" + String(random(10000));
    mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS);
    delay(1000);
  }
  mqttClient.subscribe(TOPIC_CONTROL.c_str());
}

// ---------------- ACTUATORS ----------------
void applyActuators() {
  digitalWrite(RELAY_PIN, relayOn);
  digitalWrite(BUZZER_1_PIN, buzzerOn);
  digitalWrite(BUZZER_2_PIN, buzzerOn);
}

// ---------------- MQTT CONTROL ----------------
void onMQTTMessage(char* topic, byte* payload, unsigned int length) {
  String msg;
  for (int i = 0; i < length; i++) msg += (char)payload[i];

  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, msg)) return;

  relayOn = doc["relayOn"] | false;
  buzzerOn = doc["buzzerOn"] | false;

  applyActuators();
}

// ---------------- HEALTHY SIM DATA ----------------
void generateHealthyData() {

  StaticJsonDocument<512> doc;
  doc["nodeId"] = NODE_ID;

  // 🔥 Flame sensors (no fire)
  JsonArray flame = doc.createNestedArray("flame");
  for (int i = 0; i < 5; i++) {
    flame.add(0);
  }

  // 🌫 MQ2 sensors (normal air values)
  JsonArray mq2 = doc.createNestedArray("mq2");
  mq2.add(300);
  mq2.add(320);
  mq2.add(310);
  mq2.add(305);
  mq2.add(315);

  // 🌡 DHT sensors (normal room conditions)
  JsonArray dht = doc.createNestedArray("dht");

  JsonObject d1 = dht.createNestedObject();
  d1["temperature"] = 28.5;
  d1["humidity"] = 55;

  JsonObject d2 = dht.createNestedObject();
  d2["temperature"] = 29.0;
  d2["humidity"] = 52;

  char payload[512];
  serializeJson(doc, payload);

  mqttClient.publish(TOPIC_DATA.c_str(), payload);
}

// ---------------- NANO DATA ----------------
void processNanoLine(String line) {
  line.trim();
  if (!line.startsWith("{")) return;

  StaticJsonDocument<512> doc;
  if (deserializeJson(doc, line)) return;

  doc["nodeId"] = NODE_ID;

  char out[512];
  serializeJson(doc, out);

  mqttClient.publish(TOPIC_DATA.c_str(), out);

  lastDataTime = millis();
}

// ---------------- SETUP ----------------
void setup() {
  Serial.begin(115200);
  Serial2.begin(UART_BAUD, SERIAL_8N1, UART_RX_PIN, UART_TX_PIN);

  pinMode(BUZZER_1_PIN, OUTPUT);
  pinMode(BUZZER_2_PIN, OUTPUT);
  pinMode(RELAY_PIN, OUTPUT);

  secureClient.setInsecure();

  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(onMQTTMessage);

  connectWiFi();
  connectMQTT();
}

// ---------------- LOOP ----------------
void loop() {
  if (!mqttClient.connected()) connectMQTT();
  mqttClient.loop();

  // Read Nano data
  while (Serial2.available()) {
    char c = Serial2.read();
    if (c == '\n') {
      processNanoLine(serialBuffer);
      serialBuffer = "";
    } else if (c != '\r') {
      serialBuffer += c;
    }
  }

  // If no Nano data → send healthy simulation
  if (millis() - lastDataTime > 3000) {
    generateHealthyData();
    delay(2000);
  }
}