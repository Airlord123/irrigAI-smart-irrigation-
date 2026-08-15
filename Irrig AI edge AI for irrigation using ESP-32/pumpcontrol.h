#ifndef PUMP_CONTROLLER_H
#define PUMP_CONTROLLER_H

#include <Arduino.h>
#include "config.h"

class PumpController {
public:
    PumpController();

    // Set up the GPIO pin and initial state
    void begin();

    // State machine update called in main loop for safety timeouts
    void update();

    // Turn the pump on or off
    void turnOn(bool isManualOverride = false);
    void turnOff();

    // Status queries
    bool isRunning() const { return running; }
    bool canRunAuto() const; // Check cooldown timers
    bool wasSafetyCutoffTriggered() const { return safetyCutoffActive; }
    void resetSafetyCutoff();

    // Get time elapsed since pump started (in ms)
    unsigned long getRunningDuration() const;

private:
    bool running;
    bool safetyCutoffActive;
    unsigned long pumpStartTime;
    unsigned long lastPumpOffTime;
};

#endif // PUMP_CONTROLLER_H
