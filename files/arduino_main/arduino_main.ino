#include <ArduinoJson.h>
#include <DHT.h>

#define NODE_ID "SD_Hall"
#define SEND_INTERVAL_MS 5000
#define FLAME_ACTIVE_LOW true

// --------- ONLY 2 REAL SENSORS ---------
const uint8_t FLAME_PINS[2] = {2, 3};
const uint8_t MQ2_PINS[2]   = {A0, A1};

#define DHT_TYPE DHT11
const uint8_t DHT_PINS[2] = {7, 8};
DHT dht0(DHT_PINS[0], DHT_TYPE);
DHT dht1(DHT_PINS[1], DHT_TYPE);

unsigned long lastSend = 0;

// ---------------- HELPERS ----------------
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

// ---------------- SETUP ----------------
void setup() {
  Serial.begin(9600);

  for (int i = 0; i < 2; i++) {
    pinMode(FLAME_PINS[i], INPUT);
  }

  dht0.begin();
  dht1.begin();

  delay(1500);
}

// ---------------- LOOP ----------------
void loop() {
  if (millis() - lastSend < SEND_INTERVAL_MS) return;
  lastSend = millis();

  StaticJsonDocument<512> doc;
  doc["nodeId"] = NODE_ID;

  // 🔥 Flame (duplicate to 5 sensors)
  bool f1 = readFlame(FLAME_PINS[0]);
  bool f2 = readFlame(FLAME_PINS[1]);

  JsonArray flame = doc.createNestedArray("flame");
  flame.add(f1 ? 1 : 0);
  flame.add(f2 ? 1 : 0);
  flame.add(f1 ? 1 : 0);  // copy
  flame.add(f2 ? 1 : 0);  // copy
  flame.add(f1 ? 1 : 0);  // copy

  // 🌫 MQ2 (duplicate to 5 sensors)
  int m1 = readMQ2Averaged(MQ2_PINS[0]);
  int m2 = readMQ2Averaged(MQ2_PINS[1]);

  JsonArray mq2 = doc.createNestedArray("mq2");
  mq2.add(m1);
  mq2.add(m2);
  mq2.add(m1); // copy
  mq2.add(m2); // copy
  mq2.add(m1); // copy

  // 🌡 DHT (already 2, keep same)
  JsonArray dht = doc.createNestedArray("dht");

  float t0 = dht0.readTemperature();
  float h0 = dht0.readHumidity();
  JsonObject d0 = dht.createNestedObject();
  d0["temperature"] = isnan(t0) ? 0.0 : t0;
  d0["humidity"]    = isnan(h0) ? 0.0 : h0;

  float t1 = dht1.readTemperature();
  float h1 = dht1.readHumidity();
  JsonObject d1 = dht.createNestedObject();
  d1["temperature"] = isnan(t1) ? 0.0 : t1;
  d1["humidity"]    = isnan(h1) ? 0.0 : h1;

  serializeJson(doc, Serial);
  Serial.println();
}