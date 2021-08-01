// STARTUP REQUIREMENTS
// require('Storage').write('wifi_ssid', <<ssid>>)
// require('Storage').write('wifi_pw', <<pw>>)
// require('Storage').write('assistant_url', <<url>>)
// require('Storage').write('assistant_endpoint', <<endpoint>>)
// require('Storage').write('assistant_auth', <<auth>>)
// require('Storage').write('blynk_url', <<url>>)
// require('Storage').write('blynk_auth', <<auth>>)

// SETUP FUNCTIONS
var _core = {
    functions: {
        readStorage: function(key) {
            console.log('Reading ' + key + ' from Storage...');

            var value = _modules.storage.read(key);
            if (value == undefined) {
                console.log(key + ' in Storage is undefined!');
            }

            return value;
        },
        init: {
            start: function(section) {
                console.log('Initializing ' + section + '...');
            },
            end: function(section) {
                console.log(section + ' Initialized!\n');
            }
        }
    }
};

// MODULES
_core.functions.init.start('Modules');
var _modules = {
    wifi: require('Wifi'),
    storage: require('Storage'),
    sr04: require('HC-SR04'),
    http: require('http'),
    blynk: require('https://raw.githubusercontent.com/thomasnorris/blynk-library-js/8e7f4f87131bac09b454a46de235ba0517209373/blynk-espruino.js')
};
_core.functions.init.end('Modules');

// SETTINGS
_core.functions.init.start('Settings');
var _settings = {
    host_name: 'Litter-Box-Cycler',
    assistant: {
        commands: {
            cycle_box: 'Cycle Ellie\'s Box'
        },
        url: _core.functions.readStorage('assistant_url'),
        endpoint: _core.functions.readStorage('assistant_endpoint'),
        auth: _core.functions.readStorage('assistant_auth')
    },
    wifi: {
        ssid: _core.functions.readStorage('wifi_ssid'),
        pw: _core.functions.readStorage('wifi_pw'),
        retry_ms: 3000,
        led_blink_interval_ms: 500,
        connection_cb: undefined
    },
    sr04: {
        trigger_interval_ms: 500
    },
    blynk: {
        url: _core.functions.readStorage('blynk_url'),
        auth: _core.functions.readStorage('blynk_auth'),
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
_core.functions.init.end('Settings');

// GLOBALS
var _wifi = {
    ip: undefined,
    led_blink_interval: 0,
    functions: {
        init: function() {
            _core.functions.init.start('Wifi');
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

            _core.functions.init.end('Wifi');
        },
        connect: function() {
            // reset LED blinking
            clearInterval(_wifi.led_blink_interval);
            _wifi.led_blink_interval = toggleGPIO(_settings.pins.wifi_led.pin, _settings.wifi.led_blink_interval_ms);

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
                    clearInterval(_wifi.led_blink_interval);
                    digitalWrite(_settings.pins.wifi_led.pin, 0);
                    _modules.wifi.stopAP();

                    _wifi.ip = ip;

                    if (typeof _settings.wifi.connection_cb == 'function') {
                        _settings.wifi.connection_cb();
                        _settings.wifi.connection_cb = undefined;
                    }
                }
            });
        }
    }
};
var _sr04 = {
    connection: undefined,
    interval: 0,
    dist_cm: undefined,
    functions: {
        init: function() {
            _core.functions.init.start('SR04');
            var pins = _settings.pins.sr04;
            _sr04.connection = _modules.sr04.connect(pins.trig.pin, pins.echo.pin, _sr04.functions.onEcho);

            _core.functions.init.end('SR04');
        },
        onEcho: function(dist) {
            _sr04.dist_cm = dist.toFixed(2);
        }
    }
};
var _blynk = {
    connection: undefined,
    update_interval_ms: 1000,
    components: {
        ip_display: undefined,
        sr04_dist_cm: undefined
    },
    functions: {
        init: function() {
            _core.functions.init.start('Blynk');
            _blynk.connection = new _modules.blynk.Blynk(_settings.blynk.auth, {
                addr: _settings.blynk.url,
                port: _settings.blynk.port,
                skip_connect: true
            });

            // add components
            _blynk.components.ip_display = new _blynk.connection.VirtualPin(0);
            _blynk.components.sr04_dist_cm = new _blynk.connection.VirtualPin(1);

            // cycle updates
            setInterval(function () {
                _blynk.functions.updateComponent('ip_display', _wifi.ip);
            }, _blynk.update_interval_ms);
            setInterval(function () {
                _blynk.functions.updateComponent('sr04_dist_cm', _sr04.dist_cm + ' cm');
            }, _blynk.update_interval_ms);

            _core.functions.init.end('Blynk');
        },
        updateComponent: function(component, value) {
            _blynk.components[component].write(value);
        }
    }
};
var _gpio = {
    functions: {
        init: function() {
            _core.functions.init.start('GPIO');
            var pins = _settings.pins;

            // wifi LED
            pinMode(pins.wifi_led.pin, pins.wifi_led.mode);
            digitalWrite(pins.wifi_led.pin, 1);

            // SR04 pins
            pinMode(pins.sr04.trig.pin, pins.sr04.trig.mode);
            pinMode(pins.sr04.echo.pin, pins.sr04.echo.mode);

            _core.functions.init.end('GPIO');
        }
    }
}

function connectBlynk() {
    console.log('Connecting Blynk...');
    _blynk.connection.connect();
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
    _sr04.interval = setInterval(function () {
        _sr04.connection.trigger();
    }, _settings.sr04.trigger_interval_ms);
}

function stopMonitorSR04() {
    console.log('Stopping SR04 sensor monitoring.');
    clearInterval(_sr04.interval);
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
_gpio.functions.init();
_wifi.functions.init();
_sr04.functions.init();
_blynk.functions.init();

// this will call _settings.wifi.connection_cb
_wifi.functions.connect();