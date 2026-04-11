#include <ArduinoJson.h>
#include <DHT.h>

#define NODE_ID "Node1"
#define SEND_INTERVAL_MS 5000
#define FLAME_ACTIVE_LOW true

const uint8_t FLAME_PINS[5] = {2, 3, 4, 5, 6};
const uint8_t MQ2_PINS[5] = {A0, A1, A2, A3, A4};

#define DHT_TYPE DHT11
const uint8_t DHT_PINS[2] = {7, 8};
DHT dht0(DHT_PINS[0], DHT_TYPE);
DHT dht1(DHT_PINS[1], DHT_TYPE);

unsigned long lastSend = 0;

int readMQ2Averaged(uint8_t pin) {
  long sum = 0;
  for (int i = 0; i < 10; i++) {
    sum += analogRead(pin);
    delay(3);
  }
  return (int)(sum / 10);
}

bool readFlame(uint8_t pin) {
  int value = digitalRead(pin);
  return FLAME_ACTIVE_LOW ? (value == LOW) : (value == HIGH);
}

void setup() {
  Serial.begin(9600);

  for (int i = 0; i < 5; i++) {
    pinMode(FLAME_PINS[i], INPUT);
  }

  dht0.begin();
  dht1.begin();
  delay(1500);
}

void loop() {
  if (millis() - lastSend < SEND_INTERVAL_MS) return;
  lastSend = millis();

  StaticJsonDocument<512> doc;
  doc["nodeId"] = NODE_ID;

  JsonArray flame = doc.createNestedArray("flame");
  for (int i = 0; i < 5; i++) {
    flame.add(readFlame(FLAME_PINS[i]) ? 1 : 0);
  }

  JsonArray mq2 = doc.createNestedArray("mq2");
  for (int i = 0; i < 5; i++) {
    mq2.add(readMQ2Averaged(MQ2_PINS[i]));
  }

  JsonArray dht = doc.createNestedArray("dht");

  float t0 = dht0.readTemperature();
  float h0 = dht0.readHumidity();
  JsonObject d0 = dht.createNestedObject();
  d0["temperature"] = isnan(t0) ? 0.0 : t0;
  d0["humidity"] = isnan(h0) ? 0.0 : h0;

  float t1 = dht1.readTemperature();
  float h1 = dht1.readHumidity();
  JsonObject d1 = dht.createNestedObject();
  d1["temperature"] = isnan(t1) ? 0.0 : t1;
  d1["humidity"] = isnan(h1) ? 0.0 : h1;

  serializeJson(doc, Serial);
  Serial.println();
}
