#include <Arduino.h>


// ======================================================
// CONFIGURAÇÃO
// ======================================================

constexpr uint8_t BOOT_BUTTON = 9;

constexpr unsigned long DEBOUNCE_MS = 50;


// Estado do botão
bool previousButtonState = HIGH;
unsigned long lastButtonChange = 0;


// Buffer para comandos recebidos por Serial
String serialBuffer;


// Estado simulado da válvula
bool valveClosed = false;


// ======================================================
// ENVIAR EVENTO DE FUGA
// ======================================================

void sendLeakEvent() {

  Serial.println();
  Serial.println("LEAK_EVENT");

  Serial.println("water_detected=true");
  Serial.println("flow=8.4");
  Serial.println("occupancy=away");

}


// ======================================================
// PROCESSAR COMANDO
// ======================================================

void handleCommand(String command) {

  command.trim();


  if (command.length() == 0) {
    return;
  }


  // ----------------------------------------------------
  // FECHAR VÁLVULA
  // ----------------------------------------------------

  if (command == "VALVE_CLOSE") {

    valveClosed = true;


    // Futuramente:
    //
    // digitalWrite(RELAY_PIN, HIGH);
    //
    // ou controlo de:
    // - relé
    // - servo
    // - válvula motorizada
    // - LED


    Serial.println(
      "VALVE_CLOSED_ACK"
    );

    return;
  }


  // ----------------------------------------------------
  // ABRIR VÁLVULA
  // ----------------------------------------------------

  if (command == "VALVE_OPEN") {

    valveClosed = false;


    Serial.println(
      "VALVE_OPENED_ACK"
    );

    return;
  }


  // ----------------------------------------------------
  // TESTE DE COMUNICAÇÃO
  // ----------------------------------------------------

  if (command == "PING") {

    Serial.println(
      "PONG"
    );

    return;
  }


  // ----------------------------------------------------
  // ESTADO DO DISPOSITIVO
  // ----------------------------------------------------

  if (command == "STATUS") {

    Serial.println(
      "DEVICE_STATUS"
    );

    Serial.print(
      "valve_closed="
    );

    Serial.println(
      valveClosed
        ? "true"
        : "false"
    );

    return;
  }


  // ----------------------------------------------------
  // COMANDO DESCONHECIDO
  // ----------------------------------------------------

  Serial.print(
    "UNKNOWN_COMMAND="
  );

  Serial.println(
    command
  );

}


// ======================================================
// RECEBER COMANDOS DO NODE.JS
// ======================================================

void processSerialInput() {

  while (Serial.available()) {

    char incomingChar =
      Serial.read();


    // Ignorar CR
    if (incomingChar == '\r') {
      continue;
    }


    // Final do comando
    if (incomingChar == '\n') {

      if (serialBuffer.length() > 0) {

        handleCommand(
          serialBuffer
        );

        serialBuffer = "";

      }

      continue;
    }


    serialBuffer +=
      incomingChar;


    // Proteção contra comandos absurdamente grandes
    if (serialBuffer.length() > 128) {

      serialBuffer = "";

      Serial.println(
        "ERROR=SERIAL_BUFFER_OVERFLOW"
      );

    }

  }

}


// ======================================================
// PROCESSAR BOTÃO BOOT
// ======================================================

void processBootButton() {

  const bool currentButtonState =
    digitalRead(
      BOOT_BUTTON
    );


  if (
    currentButtonState != previousButtonState &&
    millis() - lastButtonChange >= DEBOUNCE_MS
  ) {

    lastButtonChange =
      millis();


    previousButtonState =
      currentButtonState;


    // Botão pressionado
    if (
      currentButtonState == LOW
    ) {

      sendLeakEvent();

    }

  }

}


// ======================================================
// SETUP
// ======================================================

void setup() {

  // ----------------------------------------------------
  // BOTÃO
  // ----------------------------------------------------

  pinMode(
    BOOT_BUTTON,
    INPUT_PULLUP
  );


  // ----------------------------------------------------
  // SERIAL USB
  // ----------------------------------------------------

  Serial.begin(
    115200
  );


  delay(
    1500
  );


  previousButtonState =
    digitalRead(
      BOOT_BUTTON
    );


  // ----------------------------------------------------
  // STARTUP
  // ----------------------------------------------------

  Serial.println();

  Serial.println(
    "=============================="
  );

  Serial.println(
    " RescueMesh ESP32-C3"
  );

  Serial.println(
    "=============================="
  );


  Serial.println(
    "DEVICE_READY"
  );


  Serial.println(
    "Press BOOT to simulate a leak."
  );


  Serial.println(
    "Waiting for commands..."
  );

}


// ======================================================
// LOOP
// ======================================================

void loop() {

  // Detetar botão físico
  processBootButton();


  // Receber comandos do Node.js
  processSerialInput();


  delay(
    5
  );

}