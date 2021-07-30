// STARTUP REQUIREMENTS
// require('Storage').write('wifi_ssid', <<ssid>>)
// require('Storage').write('wifi_pw', <<pw>>)
// require('Storage').write('assistant_url', <<url>>)
// require('Storage').write('assistant_endpoint', <<endpoint>>)
// require('Storage').write('assistant_auth', <<auth>>)

// MODULES
var _modules = {
    wifi: require('Wifi'),
    storage: require('Storage'),
    sr04: require('HC-SR04'),
    http: require('http'),
    blynk: require('https://raw.githubusercontent.com/vshymanskyy/blynk-library-js/master/blynk-espruino.js')
};

// SETTINGS
var _settings = {
    host_name: 'Litter-Box-Cycler',
    storage: {
      wifi: {
        ssid: 'wifi_ssid',
        pw: 'wifi_pw'
      },
      assistant: {
        url: 'assistant_url',
        endpoint: 'assistant_endpoint',
        auth: 'assistant_auth'
      }
    },
    assistant: {
        commands: {
            cycle_box: 'Cycle Ellie\'s Box'
        },
        url: undefined,       // storage
        endpoint: undefined,  // storage
        auth: undefined       // storage
    },
    wifi: {
        ssid: undefined,      // storage
        pw: undefined,        // storage
        retry_ms: 3000,
        led_blink_interval_ms: 500
    },
    sr04: {
        trigger_interval_ms: 500
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

// GLOBALS
var _globals = {
    wifi: {
        led_blink_interval: 0
    },
    sr04: {
        connection: undefined,
        interval: 0
    }
};

// START FUNCTIONS
function initPins() {
    console.log('Initializing pins...');
    var pins = _settings.pins;

    // wifi LED
    pinMode(pins.wifi_led.pin, pins.wifi_led.mode);
    digitalWrite(pins.wifi_led.pin, 1);

    // SR04 pins
    pinMode(pins.sr04.trig.pin, pins.sr04.trig.mode);
    pinMode(pins.sr04.echo.pin, pins.sr04.echo.mode);
}

function initWifi() {
    console.log('Initializing wifi...');

    _modules.wifi.setHostname(_settings.host_name);
    _modules.wifi.disconnect();
    _modules.wifi.stopAP();

    _modules.wifi.on('disconnected', function (details) {
        console.log('Wifi disconnected, reconnecting in ' + msToS(_settings.wifi.retry_ms) + ' seconds...');
        setTimeout(function () {
            connectWifi();
        }, _settings.wifi.retry_ms);
    });

    _settings.wifi.ssid = readStorage(_settings.storage.wifi.ssid);
    _settings.wifi.pw = readStorage(_settings.storage.wifi.pw);
}

function initAssistant() {
    console.log('Initializing assistant...');

    _settings.assistant.url = readStorage(_settings.storage.assistant.url);
    _settings.assistant.endpoint = readStorage(_settings.storage.assistant.endpoint);
    _settings.assistant.auth = readStorage(_settings.storage.assistant.auth);
}

function initSR04() {
    var pins = _settings.pins.sr04;
    _globals.sr04.connection = _modules.sr04.connect(pins.trig.pin, pins.echo.pin, distanceReceived);
}

function connectWifi(cb) {
    // reset LED blinking
    clearInterval(_globals.wifi.led_blink_interval);
    _globals.wifi.led_blink_interval = toggleGPIO(_settings.pins.wifi_led.pin, _settings.wifi.led_blink_interval_ms);

    console.log('Connecting wifi...');
    _modules.wifi.connect(_settings.wifi.ssid, {
        password: _settings.wifi.pw
    }, function (err) {
        var ip = _modules.wifi.getIP().ip;
        if (err) {
            console.log('Wifi connection error: ' + err);
            console.log('Retrying in ' + msToS(_settings.wifi.retry_ms) + ' seconds...');
            setTimeout(function () {
                clearInterval(_globals.wifi.led_blink_interval);
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
            clearInterval(_globals.wifi.led_blink_interval);
            digitalWrite(_settings.pins.wifi_led.pin, 0);
            if (typeof cb == 'function') {
                cb();
            }
        }
    });
}

function msToS(ms) {
    return ms / 1000;
}

function readStorage(key) {
    console.log('Reading ' + key + ' from Storage...');

    var value = _modules.storage.read(key);
    if (value == undefined) {
        console.log(key + ' in Storage is undefined!');
    }

    return value;
}

function toggleGPIO(pin, interval) {
    var state = 1;
    return setInterval(function () {
        digitalWrite(pin, state);
        state = !state;
    }, interval);
}

function startMonitorSR04() {
    _globals.sr04.interval = setInterval(function () {
        _globals.sr04.connection.trigger();
    }, _settings.sr04.trigger_interval_ms);
}

function stopMonitorSR04() {
    clearInterval(_globals.sr04.interval);
}

function distanceReceived(dist) {
    console.log(dist + ' cm');

    if (dist <= 9) {
        //sendAssistantCommand(_settings.assistant.commands.cycle_box);
    }
}

function sendAssistantCommand(command, cb, cb_on_error) {
    var options = url.parse(_settings.assistant.url + _settings.assistant.endpoint + '/' + encodeURIComponent(command));
    options.headers = {
        'X-Auth': _settings.assistant.auth
    };

    var req = _modules.http.request(options, function (res) {
        res.on('data', function (data) {
            console.log('Assistant Response: ' + data);
            if (typeof cb == 'function') {
                cb(data);
            }
        });

        res.on('close', function (data) {
            console.log('Connection closed.');
        });
    });

    req.on('error', function (err) {
        console.log('Assistant error: ' + err);
        if (typeof cb == 'function' && cb_on_error) {
            cb(data);
        }
    });

    req.end();
}
// END FUNCTIONS

// MAIN
function main() {
    console.log('Ready!');

    /*
    console.log('Starting SR04 sensor monitoring');
    startMonitorSR04();
    */

}

// ENTRY POINT
initPins();
initWifi();
initSR04();
initAssistant();

connectWifi(main);

