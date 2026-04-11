#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

#define NODE_ID "Node1"
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#define MQTT_BROKER "YOUR_MQTT_BROKER_IP_OR_HOST"
#define MQTT_PORT 1883

#define UART_RX_PIN 16
#define UART_TX_PIN 17
#define UART_BAUD 9600

#define BUZZER_1_PIN 25
#define BUZZER_2_PIN 26
#define RELAY_PIN 27

#define WIFI_TIMEOUT_MS 20000
#define MQTT_RETRY_DELAY_MS 2000
#define MQTT_MAX_RETRIES 5

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
String serialBuffer = "";

const String TOPIC_DATA = String("sensors/") + NODE_ID + "/data";
const String TOPIC_CONTROL = String("sensors/") + NODE_ID + "/control";
const String TOPIC_STATE = String("sensors/") + NODE_ID + "/actuator_state";

bool relayOn = false;
bool buzzerOn = false;

void applyActuators() {
  digitalWrite(RELAY_PIN, relayOn ? HIGH : LOW);
  digitalWrite(BUZZER_1_PIN, buzzerOn ? HIGH : LOW);
  digitalWrite(BUZZER_2_PIN, buzzerOn ? HIGH : LOW);
}

void publishActuatorState(const char* source) {
  if (!mqttClient.connected()) return;

  StaticJsonDocument<192> doc;
  doc["nodeId"] = NODE_ID;
  doc["relayOn"] = relayOn;
  doc["buzzerOn"] = buzzerOn;
  doc["source"] = source;

  char payload[192];
  serializeJson(doc, payload);
  mqttClient.publish(TOPIC_STATE.c_str(), payload);
}

void onMQTTMessage(char* topic, byte* payload, unsigned int length) {
  String message;
  for (unsigned int i = 0; i < length; i++) message += (char)payload[i];

  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, message)) return;

  relayOn = doc["relayOn"] | false;
  buzzerOn = doc["buzzerOn"] | false;

  applyActuators();
  publishActuatorState("backend-control");
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_TIMEOUT_MS) {
    delay(300);
  }
}

void reconnectMQTT() {
  if (mqttClient.connected() || WiFi.status() != WL_CONNECTED) return;

  for (int attempt = 0; attempt < MQTT_MAX_RETRIES && !mqttClient.connected(); attempt++) {
    String clientId = String("ESP32-") + NODE_ID + "-" + String((uint32_t)ESP.getEfuseMac(), HEX);

    if (mqttClient.connect(clientId.c_str())) {
      mqttClient.subscribe(TOPIC_CONTROL.c_str());
      publishActuatorState("reconnect");
      return;
    }

    delay(MQTT_RETRY_DELAY_MS);
  }
}

void processNanoLine(String line) {
  line.trim();
  if (line.length() < 5 || !line.startsWith("{")) return;

  StaticJsonDocument<512> doc;
  DeserializationError err = deserializeJson(doc, line);
  if (err) return;

  if (!doc["nodeId"].is<const char*>()) {
    doc["nodeId"] = NODE_ID;
  }

  char out[512];
  serializeJson(doc, out);
  mqttClient.publish(TOPIC_DATA.c_str(), out);
}

void setup() {
  Serial.begin(115200);
  Serial2.begin(UART_BAUD, SERIAL_8N1, UART_RX_PIN, UART_TX_PIN);

  pinMode(BUZZER_1_PIN, OUTPUT);
  pinMode(BUZZER_2_PIN, OUTPUT);
  pinMode(RELAY_PIN, OUTPUT);

  relayOn = false;
  buzzerOn = false;
  applyActuators();

  connectWiFi();

  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(onMQTTMessage);
  mqttClient.setBufferSize(1024);
  reconnectMQTT();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
  if (!mqttClient.connected()) reconnectMQTT();
  mqttClient.loop();

  while (Serial2.available()) {
    char c = (char)Serial2.read();
    if (c == '\n') {
      processNanoLine(serialBuffer);
      serialBuffer = "";
    } else if (c != '\r') {
      serialBuffer += c;
      if (serialBuffer.length() > 900) serialBuffer = "";
    }
  }

  yield();
}
