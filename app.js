// STARTUP REQUIREMENTS
// require('Storage').write('wifi_ssid', <<ssid>>)
// require('Storage').write('wifi_pw', <<pw>>)
// require('Storage').write('assistant_url', <<url>>)
// require('Storage').write('assistant_endpoint', <<endpoint>>)
// require('Storage').write('assistant_auth_type', <<type>>)
// require('Storage').write('assistant_auth_phrase', <<phrase>>)

// MODULES
var _modules = {
    wifi: require('Wifi'),
    storage: require('Storage'),
    sr04: require('HC-SR04')
};

// SETTINGS
var _settings = {
    host_name: 'Garage-Door-Controller',
    assistant: {
        url: undefined,       // read from storage
        endpoint: undefined,  // read from storage
        auth: {
            type: undefined,    // read from storage
            phrase: undefined   // read from storage
        }
    },
    wifi: {
        ssid: undefined,    // read from storage
        pw: undefined,      // read from storage
        retry_ms: 3000,
        led: {
            blink_interval_ms: 500,
            interval: 0
        }
    },
    sr04: {
        trigger_interval_ms: 1000
    },
    pins: {
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
    }
};

// START OF FUNCTIONS
function initPins() {
    var pins = _settings.pins;

    // wifi LED
    pinMode(pins.wifi_led.pin, pins.wifi_led.mode);
    digitalWrite(pins.wifi_led.pin, 1);

    // SR04 pins
    pinMode(pins.sr04.trig.pin, pins.sr04.trig.mode);
    pinMode(pins.sr04.echo.pin, pins.sr04.echo.mode);
}

function initWifi() {
    _modules.wifi.setHostname(_settings.host_name);
    _modules.wifi.disconnect();
    _modules.wifi.stopAP();

    _modules.wifi.on('disconnected', function (details) {
        console.log('Wifi disconnected, reconnecting in ' + msToS(_settings.wifi.retry_ms) + ' seconds...');
        setTimeout(function () {
            connectWifi();
        }, _settings.wifi.retry_ms);
    });

    _settings.wifi.ssid = readStorage('wifi_ssid');
    _settings.wifi.pw = readStorage('wifi_pw');
}

function initAssistant() {
    _settings.assistant.url = readStorage('assistant_url');
    _settings.assistant.endpoint = readStorage('assistant_endpoint');
    _settings.assistant.auth.type = readStorage('assistant_auth_type');
    _settings.assistant.auth.phrase = readStorage('assistant_auth_phrase');
}

function connectWifi(cb) {
    // reset LED blinking
    clearInterval(_settings.wifi.led.interval);
    _settings.wifi.led.interval = toggleGPIO(_settings.pins.wifi_led.pin, _settings.wifi.led.blink_interval_ms);

    console.log('Wifi connecting...');
    _modules.wifi.connect(_settings.wifi.ssid, {
        password: _settings.wifi.pw
    }, function (err) {
        var ip = _modules.wifi.getIP().ip;
        if (err) {
            console.log('Wifi connection error: ' + err);
            console.log('Retrying in ' + msToS(_settings.wifi.retry_ms) + ' seconds...');
            setTimeout(function () {
                clearInterval(_settings.wifi.led.interval);
                connectWifi(cb);
            }, _settings.wifi.retry_ms);
        }
        else if (!ip || ip == '0.0.0.0') {
            // do nothing, handler will pick it up
            if (typeof cb == 'function') {
                cb();
            }
        }
        else {
            console.log("Wifi connected! Info: " + JSON.stringify(_modules.wifi.getIP()));
            clearInterval(_settings.wifi.led.interval);
            digitalWrite(_settings.pins.wifi_led.pin, 0);
            if (typeof cb == 'function') {
                cb();
            }
        }
    });
}

function toggleGPIO(pin, interval) {
    var state = 1;
    return setInterval(function () {
        digitalWrite(pin, state);
        state = !state;
    }, interval);
}

function msToS(ms) {
    return ms / 1000;
}

function monitorSR04() {
    // connect
    var pins = _settings.pins.sr04;
    var sr04 = _modules.sr04.connect(pins.trig.pin, pins.echo.pin, distanceReceived);

    // refresh
    setInterval(function () {
        sr04.trigger();
    }, _settings.sr04.trigger_interval_ms);
}

function distanceReceived(dist) {
    console.log(dist + ' cm');
}

function readStorage(key) {
    console.log('Reading ' + key + ' from Storage...');

    var value = _modules.storage.read(key);
    if (value == undefined) {
        console.log(key + ' in Storage is undefined!');
    }

    return value;
}
// END OF FUNCTIONS

// MAIN
function main() {
    console.log('Ready!');
    console.log('Starting SR04 sensor monitoring');

    monitorSR04();
}

// ENTRY POINT
initPins();
initWifi();
initAssistant();

connectWifi(main);
