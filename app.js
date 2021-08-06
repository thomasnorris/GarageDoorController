// STARTUP REQUIREMENTS
// require('Storage').write('wifi_ssid', <<ssid>>)
// require('Storage').write('wifi_pw', <<pw>>)
// require('Storage').write('assistant_url', <<url>>)
// require('Storage').write('assistant_endpoint', <<endpoint>>)
// require('Storage').write('assistant_auth', <<auth>>)
// require('Storage').write('blynk_url', <<url>>)
// require('Storage').write('blynk_auth', <<auth>>)

// Custom Modules
var _wifi = require('https://raw.githubusercontent.com/thomasnorris/EspruinoModules/master/wifi.js').wifi;
var _assistant = require('https://raw.githubusercontent.com/thomasnorris/EspruinoModules/master/google_assistant.js').assistant;
var _gpio = require('https://raw.githubusercontent.com/thomasnorris/EspruinoModules/master/gpio.js').gpio;
var _core = require('https://raw.githubusercontent.com/thomasnorris/EspruinoModules/master/core.js').core;
var _hcsr04 = require('https://raw.githubusercontent.com/thomasnorris/EspruinoModules/master/hcsr04.js').hcsr04;
_core = new _core();

// Settings
var _settings = {};
// Google Assistant
_settings.assistant = {
    // used in class
    url: _core.fn.readStorage('assistant_url'),
    endpoint: _core.fn.readStorage('assistant_endpoint'),
    auth: _core.fn.readStorage('assistant_auth'),
    // used elsewhere
    commands: {
        cycle_box: 'Cycle Ellie\'s Box'
    }
};
// GPIO
_settings.gpio = {
    wifi_led: {
        mode: 'output',
        pin: NodeMCU.D0
    },
    sr04: {
        trig: {
            mode: 'output',
            pin: NodeMCU.D1
        },
        echo: {
            mode: 'input',
            pin: NodeMCU.D2
        }
    }
};
// Wifi
_settings.wifi = {
    // used in class
    host_name: 'Litter-Box-Cycler',
    ssid: _core.fn.readStorage('wifi_ssid'),
    pw: _core.fn.readStorage('wifi_pw'),
    retry_ms: 3000,
    led: {
        enable_toggle: true,
        blink_interval_ms: 250,
        gpio: {
            pin: _settings.gpio.wifi_led.pin,
            connection_complete_write_value: 0
        }
    }
};
// HC-SR04
_settings.sr04 = {
    // used in class
    trigger_interval_ms: 500,
    gpio: {
        trigger_pin: _settings.gpio.sr04.trig.pin,
        echo_pin: _settings.gpio.sr04.echo.pin
    }
};

// MAIN (must be hoisted)
function main() {
    console.log('Ready!\n');
    _hcsr04.fn.startMonitoring();
}

// Setup modules
_assistant = new _assistant(_settings.assistant, { core: _core });
_gpio = new _gpio({
    pins: [_settings.gpio.wifi_led.pin, _settings.gpio.sr04.trig.pin, _settings.gpio.sr04.echo.pin],
    modes: [_settings.gpio.wifi_led.mode, _settings.gpio.sr04.trig.mode, _settings.gpio.sr04.echo.mode]
}, { core: _core });
_hcsr04 = new _hcsr04(_settings.sr04, { core: _core }, function (self) {
    self.fn.onEcho = function (dist_cm) {
        self.modules.core.fn.logInfo('HC-SR04 distance: ' + dist_cm + ' cm');
    };
});
_wifi = new _wifi(_settings.wifi, { core: _core, gpio: _gpio }, main);

// connect wifi, then run main
_wifi.fn.connect();