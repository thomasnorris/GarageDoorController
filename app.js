// STARTUP REQUIREMENTS
// require('Storage').write('wifi_ssid', <<ssid>>)
// require('Storage').write('wifi_pw', <<pw>>)
// require('Storage').write('assistant_url', <<url>>)
// require('Storage').write('assistant_endpoint', <<endpoint>>)
// require('Storage').write('assistant_auth', <<auth>>)
// require('Storage').write('blynk_url', <<url>>)
// require('Storage').write('blynk_auth', <<auth>>)

// SETUP FUNCTIONS
function readStorage(key) {
    console.log('Reading ' + key + ' from Storage...');

    var value = _modules.storage.read(key);
    if (value == undefined) {
        console.log(key + ' in Storage is undefined!');
    }

    return value;
}

function initStart(section) {
    console.log('Initializing ' + section + '...');
}

function initEnd(section) {
    console.log(section + ' Initialized!\n');
}

// MODULES
initStart('Modules');
var _modules = {
    wifi: require('Wifi'),
    storage: require('Storage'),
    sr04: require('HC-SR04'),
    http: require('http'),
    blynk: require('https://raw.githubusercontent.com/thomasnorris/blynk-library-js/8e7f4f87131bac09b454a46de235ba0517209373/blynk-espruino.js')
};
initEnd('Modules');

// SETTINGS
initStart('Settings');
var _settings = {
    host_name: 'Litter-Box-Cycler',
    assistant: {
        commands: {
            cycle_box: 'Cycle Ellie\'s Box'
        },
        url: readStorage('assistant_url'),
        endpoint: readStorage('assistant_endpoint'),
        auth: readStorage('assistant_auth')
    },
    wifi: {
        ssid: readStorage('wifi_ssid'),
        pw: readStorage('wifi_pw'),
        retry_ms: 3000,
        led_blink_interval_ms: 500,
        connection_cb: undefined
    },
    sr04: {
        trigger_interval_ms: 500
    },
    blynk: {
        url: readStorage('blynk_url'),
        auth: readStorage('blynk_auth'),
        port: 8442
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
initEnd('Settings');

var _globals = {
    wifi: {
        ip: undefined,
        led_blink_interval: 0
    },
    sr04: {
        connection: undefined,
        interval: 0,
        dist_cm: undefined
    },
    blynk: {
        connection: undefined,
        update_interval_ms: 1000,
        components: {
            ip_display: undefined
        }
    }
};


function initPins() {
    initStart('GPIO');
    var pins = _settings.pins;

    // wifi LED
    pinMode(pins.wifi_led.pin, pins.wifi_led.mode);
    digitalWrite(pins.wifi_led.pin, 1);

    // SR04 pins
    pinMode(pins.sr04.trig.pin, pins.sr04.trig.mode);
    pinMode(pins.sr04.echo.pin, pins.sr04.echo.mode);

    initEnd('GPIO');
}

function initWifi() {
    initStart('Wifi');
    _modules.wifi.setHostname(_settings.host_name);
    _modules.wifi.disconnect();

    _modules.wifi.on('disconnected', function (cb) {
        console.log('Wifi disconnected, reconnecting in ' + msToS(_settings.wifi.retry_ms) + ' seconds...');
        setTimeout(function () {
            connectWifi();
        }, _settings.wifi.retry_ms);
    });

    // called after wifi connects for the first time
    _settings.wifi.connection_cb = main;

    initEnd('Wifi');
}

function initSR04() {
    initStart('SR04');
    var pins = _settings.pins.sr04;
    _globals.sr04.connection = _modules.sr04.connect(pins.trig.pin, pins.echo.pin, sr04Echo);

    initEnd('SR04');
}

function initBlynk() {
    initStart('Blynk');
    _globals.blynk.connection = new _modules.blynk.Blynk(_settings.blynk.auth, {
        addr: _settings.blynk.url,
        port: _settings.blynk.port,
        skip_connect: true
    });

    // add components
    _globals.blynk.components.ip_display = new _globals.blynk.connection.VirtualPin(0);
    _globals.blynk.components.sr04_dist_cm = new _globals.blynk.connection.VirtualPin(1);

    // cycle updates
    setInterval(function () {
        updateBlynkComponent('ip_display', _globals.wifi.ip);
    }, _globals.blynk.update_interval_ms);
    setInterval(function () {
        updateBlynkComponent('sr04_dist_cm', _globals.sr04.dist_cm + ' cm');
    }, _globals.blynk.update_interval_ms);

    initEnd('Blynk');
}

function updateBlynkComponent(component, value) {
    _globals.blynk.components[component].write(value);
}

function connectWifi() {
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
            _modules.wifi.disconnect();
        }
        else if (!ip || ip == '0.0.0.0') {
            console.log('Invalid Wifi IP.');
            _modules.wifi.disconnect();
        }
        else {
            console.log("Wifi connected! Info: " + JSON.stringify(_modules.wifi.getIP()));
            clearInterval(_globals.wifi.led_blink_interval);
            digitalWrite(_settings.pins.wifi_led.pin, 0);
            _modules.wifi.stopAP();

            _globals.wifi.ip = ip;

            if (typeof _settings.wifi.connection_cb == 'function') {
                _settings.wifi.connection_cb();
                _settings.wifi.connection_cb = undefined;
            }
        }
    });
}

function connectBlynk() {
    console.log('Connecting Blynk...');
    _globals.blynk.connection.connect();
}

function msToS(ms) {
    return ms / 1000;
}

function toggleGPIO(pin, interval) {
    var state = 1;
    return setInterval(function () {
        digitalWrite(pin, state);
        state = !state;
    }, interval);
}

function startMonitorSR04() {
    console.log('Starting SR04 sensor monitoring.');
    _globals.sr04.interval = setInterval(function () {
        _globals.sr04.connection.trigger();
    }, _settings.sr04.trigger_interval_ms);
}

function stopMonitorSR04() {
    console.log('Stopping SR04 sensor monitoring.');
    clearInterval(_globals.sr04.interval);
}

function sr04Echo(dist) {
    _globals.sr04.dist_cm = dist.toFixed(2);
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

// MAIN
function main() {
    console.log('Ready!\n');
    connectBlynk();
    startMonitorSR04();
}

// Init functions
initPins();
initWifi();
initSR04();
initBlynk();

// this will call _settings.wifi.connection_cb
connectWifi();