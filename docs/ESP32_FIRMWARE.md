# ESP32 Firmware — connecting your boards to the JARVIS Core

## Wiring / hardware

- **Board:** ESP32 (ESP32-S3 recommended for more RAM for TinyML).
- **Network:** same LAN as the PC running the Core.
- **Power:** USB or battery (the node reports battery % if you feed it from a voltage divider).

## Protocol

Boards connect to the Core's **ESP32 gateway** (WebSocket, default `ws://<PC-IP>:8765`) and
exchange compact JSON:

| Direction | Message | Purpose |
|-----------|---------|---------|
| Node → Core | `{type:"hello", nodeId, name, firmwareVersion}` | Register on connect |
| Core → Node | `{type:"welcome", serverTime}` | Acknowledge |
| Node → Core | `{type:"metrics", accuracy, loss, latencyMs, modelSizeBytes, round, samples, signal, battery}` | Heartbeat + telemetry |
| Node → Core | `{type:"round_result", round, algorithm, accuracy, loss, latencyMs, modelSizeBytes, samples}` | Report a finished local training round |
| Core → Node | `{type:"command", commandId, payload:{type, ...}}` | Ask the node to do something |
| Node → Core | `{type:"ack", commandId, ok, message, data}` | Acknowledge a command |
| Node → Core | `{type:"log", level, message}` | Send a log line |

Commands: `ping`, `deploy_model` (with `model`), `start_training` (with `algorithm`, `rounds`),
`stop_training`, `execute_action` (with `action`).

## Example sketch (Arduino)

```cpp
#include <WiFi.h>
#include <WebSocketsClient.h>

const char* ssid = "YOUR_WIFI";
const char* password = "YOUR_PASSWORD";
const char* coreHost = "192.168.1.10";   // PC running the Core
const uint16_t corePort = 8765;

WebSocketsClient ws;
String nodeId = "esp32-001";

void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      ws.sendTXT("{\"type\":\"hello\",\"nodeId\":\"" + nodeId +
                 "\",\"name\":\"ESP32-1\",\"firmwareVersion\":\"0.4.2\"}");
      break;
    case WStype_TEXT: {
      StaticJsonDocument<512> doc;            // requires ArduinoJson
      deserializeJson(doc, payload, length);
      if (doc["type"] == "command") {
        String commandId = doc["commandId"].as<String>();
        String cmd = doc["payload"]["type"].as<String>();
        String reply;
        if (cmd == "ping") {
          reply = "{\"type\":\"ack\",\"commandId\":\"" + commandId + "\",\"ok\":true,\"message\":\"pong\"}";
        } else if (cmd == "deploy_model") {
          // load model bytes into memory, validate checksum...
          reply = "{\"type\":\"ack\",\"commandId\":\"" + commandId + "\",\"ok\":true,\"message\":\"model deployed\"}";
        } else if (cmd == "start_training") {
          // start local training loop (see below)
          reply = "{\"type\":\"ack\",\"commandId\":\"" + commandId + "\",\"ok\":true,\"message\":\"training started\"}";
        } else {
          reply = "{\"type\":\"ack\",\"commandId\":\"" + commandId + "\",\"ok\":false,\"message\":\"unknown command\"}";
        }
        ws.sendTXT(reply);
      }
      break;
    }
    default: break;
  }
}

// Simulated local training round: report back numbers the Core can aggregate.
void reportRoundResult(float accuracy, float loss, float latencyMs, size_t modelBytes, int round, int samples) {
  char buf[256];
  snprintf(buf, sizeof(buf),
           "{\"type\":\"round_result\",\"nodeId\":\"%s\",\"round\":%d,\"accuracy\":%.2f,"
           "\"loss\":%.4f,\"latencyMs\":%.1f,\"modelSizeBytes\":%u,\"samples\":%d}",
           nodeId.c_str(), round, accuracy, loss, latencyMs, modelBytes, samples);
  ws.sendTXT(buf);
}

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(300); }
  ws.begin(coreHost, corePort, "/");
  ws.onEvent(webSocketEvent);
  ws.setReconnectInterval(3000);
}

void loop() {
  ws.loop();
  // every few seconds, send live metrics for the dashboard
  static unsigned long last = 0;
  if (millis() - last > 5000) {
    last = millis();
    ws.sendTXT("{\"type\":\"metrics\",\"nodeId\":\"" + nodeId +
               "\",\"accuracy\":94.8,\"loss\":0.082,\"latencyMs\":23.4,"
               "\"modelSizeBytes\":61200,\"round\":3,\"samples\":1200,\"signal\":-52}");
  }
}
```

## Next steps for real TinyML

Replace the simulated round result with real on-device training:
1. Convert your model with **TensorFlow Lite Micro** and flash it to the board.
2. Run local training on-device (e.g., a small MLP for MNIST or gesture data).
3. Report `accuracy`/`loss` per round via `round_result`.
4. The Core's `FederationManager` aggregates the fleet's results with FedAvg and commits
   the global round to the research database automatically.
