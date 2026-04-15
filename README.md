# Smart Fire Response System

## Quick Links
- Live Deployment: https://smart-fire-response-system.vercel.app/
- Demo Video: https://youtu.be/5AuoG7aDiLo

## 1. Project Overview
Smart Fire Response System is an IoT-based campus safety project for real-time fire monitoring and response. The system collects data from building-level sensor nodes, computes fire risk on the backend, and displays live status on a centralized dashboard.

The project is designed for academic demonstration with practical features such as:
- Multi-building monitoring
- Automated emergency actuation (water pump and siren)
- Manual override controls
- Alert acknowledgement workflow
- SMS and call notifications for critical conditions
- Building-level map and trend visualization

## 2. Key Features
### 2.1 Real-Time Monitoring
- Live flame, gas (MQ2), and temperature/humidity inputs
- Fire probability and risk-level estimation
- Per-building cards with online/offline state

### 2.2 Automated Response
- Auto activation of siren and pump based on fusion logic
- Test-ready rule for full-flame detection

### 2.3 Alerting and Escalation
- Alert list with threshold breaches
- Acknowledgement support
- Twilio integration for SMS and voice call escalation

### 2.4 Dashboard and Visualization
- Home dashboard with building cards and map preview
- Dedicated map page with coordinate update tools
- Graphs page showing temperature and fire probability for all buildings
- Stats page with historical summaries

## 3. Tech Stack
- Frontend: React.js
- Backend: Node.js, Express.js
- Database: MongoDB with Mongoose
- Messaging: MQTT
- Maps: Leaflet
- Charts: Chart.js
- Notifications: Twilio SMS/Voice
- Device Layer: Arduino/ESP32 sketches

## 4. How the System Works
1. Sensor nodes publish readings to MQTT topics.
2. Backend consumes messages, normalizes payloads, and computes fire risk.
3. Decision engine determines actuator command (auto/manual logic).
4. Backend stores readings and node status in MongoDB.
5. Frontend polls backend APIs and renders cards, map, graphs, and alerts.
6. Critical/full-flame conditions can trigger Twilio SMS/calls.

## 5. Prerequisites
Install the following before running:
- Node.js (LTS recommended)
- npm
- MongoDB (local or cloud)
- MQTT broker (example: HiveMQ, Mosquitto)
- Twilio account (optional, for SMS/calls)

## 6. Environment Variables
Create Backend/.env with values similar to the following:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
MQTT_BROKER=your_mqtt_broker_url
MQTT_USER=your_mqtt_username
MQTT_PASS=your_mqtt_password
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Optional notification settings
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_FROM_PHONE=+10000000000
TWILIO_TO_PHONE=+10000000001

# Optional tuning
FIRE_AUTO_THRESHOLD=70
FIRE_ALERT_THRESHOLD=60
```

Create frontend/.env if needed:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

## 7. Local Setup and Run
### 7.1 Run Backend
```bash
cd Backend
npm install
npm start
```

### 7.2 Run Frontend
```bash
cd frontend
npm install
npm start
```

Frontend default URL: http://localhost:3000

## 8. Testing Notes
- Send sample MQTT payloads for each building node.
- Verify card state changes in dashboard.
- Trigger high flame/gas/temperature to validate emergency response.
- Confirm acknowledgement behavior in alerts page.
- If Twilio is configured, verify SMS/call on critical scenarios.

## 9. Current Scope and Limitations
- This is a student project intended for controlled testing and demo environments.
- Polling-based UI updates are used instead of persistent websocket streams.
- Sensor values and thresholds may need calibration for production deployment.

