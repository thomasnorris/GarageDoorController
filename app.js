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
    fn: {
        readStorage: function (key) {
            console.log('Reading ' + key + ' from Storage...');

            var value = _modules.storage.read(key);
            if (value == undefined) {
                console.log(key + ' in Storage is undefined!');
            }

            return value;
        },
        init: {
            start: function (section) {
                console.log('Initializing ' + section + '...');
            },
            end: function (section) {
                console.log(section + ' Initialized!\n');
            }
        },
        msToS: function (ms) {
            return ms / 1000;
        }
    }
};

// MODULES
_core.fn.init.start('Modules');
var _modules = {
    wifi: require('Wifi'),
    storage: require('Storage'),
    sr04: require('HC-SR04'),
    http: require('http'),
    blynk: require('https://raw.githubusercontent.com/thomasnorris/blynk-library-js/8e7f4f87131bac09b454a46de235ba0517209373/blynk-espruino.js')
};
_core.fn.init.end('Modules');

// SETTINGS
_core.fn.init.start('Settings');
var _settings = {
    host_name: 'Litter-Box-Cycler',
    assistant: {
        commands: {
            cycle_box: 'Cycle Ellie\'s Box'
        },
        url: _core.fn.readStorage('assistant_url'),
        endpoint: _core.fn.readStorage('assistant_endpoint'),
        auth: _core.fn.readStorage('assistant_auth')
    },
    wifi: {
        ssid: _core.fn.readStorage('wifi_ssid'),
        pw: _core.fn.readStorage('wifi_pw'),
        retry_ms: 3000,
        led_blink_interval_ms: 500,
        connection_cb: undefined
    },
    sr04: {
        trigger_interval_ms: 500
    },
    blynk: {
        url: _core.fn.readStorage('blynk_url'),
        auth: _core.fn.readStorage('blynk_auth'),
        port: 8442,
        cycle_update_interval_ms: 1000,
        reboot_timeout_ms: 2000,
        component_vpins: {
            ip_display: 0,
            sr04_dist_cm: 1,
            cycle_box_button: 2,
            reboot_button: 3
        }
    },
    gpio: {
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
_core.fn.init.end('Settings');

// GLOBALS
var _wifi = {
    ip: undefined,
    led_blink_interval: 0,
    fn: {
        init: function () {
            _core.fn.init.start('Wifi');
            _modules.wifi.setHostname(_settings.host_name);
            _modules.wifi.disconnect();

            _wifi.fn.onDisconnected(function () {
                console.log('Wifi disconnected, reconnecting in ' + _core.fn.msToS(_settings.wifi.retry_ms) + ' seconds...');
                setTimeout(function () {
                    _wifi.fn.connect();
                }, _settings.wifi.retry_ms);
            });

            // called after wifi connects for the first time
            _settings.wifi.connection_cb = main;

            _core.fn.init.end('Wifi');
        },
        connect: function () {
            // reset LED blinking
            clearInterval(_wifi.led_blink_interval);
            _wifi.led_blink_interval = _gpio.fn.toggle(_settings.gpio.wifi_led.pin, _settings.wifi.led_blink_interval_ms);

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
                    digitalWrite(_settings.gpio.wifi_led.pin, 0);
                    _modules.wifi.stopAP();

                    _wifi.ip = ip;

                    if (typeof _settings.wifi.connection_cb == 'function') {
                        _settings.wifi.connection_cb();
                        _settings.wifi.connection_cb = undefined;
                    }
                }
            });
        },
        onDisconnected: function (cb) {
            _modules.wifi.on('disconnected', cb);
        }
    }
};
var _sr04 = {
    connection: undefined,
    interval: 0,
    dist_cm: undefined,
    fn: {
        init: function () {
            _core.fn.init.start('SR04');
            var pins = _settings.gpio.sr04;
            _sr04.connection = _modules.sr04.connect(pins.trig.pin, pins.echo.pin, _sr04.fn.onEcho);

            _core.fn.init.end('SR04');
        },
        onEcho: function (dist) {
            _sr04.dist_cm = dist.toFixed(2);
        },
        monitor: {
            start: function () {
                console.log('Starting SR04 sensor monitoring.');
                _sr04.interval = setInterval(function () {
                    _sr04.connection.trigger();
                }, _settings.sr04.trigger_interval_ms);
            },
            stop: function () {
                console.log('Stopping SR04 sensor monitoring.');
                clearInterval(_sr04.interval);
            }
        }
    }
};
var _blynk = {
    connection: undefined,
    components: {
        ip_display: undefined,
        sr04_dist_cm: undefined,
        cycle_box_button: undefined,
        notify: undefined,
        reboot_button: undefined
    },
    fn: {
        init: function () {
            _core.fn.init.start('Blynk');
            _blynk.connection = new _modules.blynk.Blynk(_settings.blynk.auth, {
                addr: _settings.blynk.url,
                port: _settings.blynk.port,
                skip_connect: true
            });

            // add components
            _blynk.components.ip_display = new _blynk.connection.VirtualPin(_settings.blynk.component_vpins.ip_display);
            _blynk.components.sr04_dist_cm = new _blynk.connection.VirtualPin(_settings.blynk.component_vpins.sr04_dist_cm);
            _blynk.components.cycle_box_button = new _blynk.connection.VirtualPin(_settings.blynk.component_vpins.cycle_box_button);
            _blynk.components.reboot_button = new _blynk.connection.VirtualPin(_settings.blynk.component_vpins.reboot_button);

            // cycle updates
            setInterval(function () {
                _blynk.fn.updateComponent('ip_display', _wifi.ip);
            }, _settings.blynk.cycle_update_interval_ms);
            setInterval(function () {
                _blynk.fn.updateComponent('sr04_dist_cm', _sr04.dist_cm + 'cm');
            }, _settings.blynk.cycle_update_interval_ms);

            // handlers for buttons
            _blynk.fn.onWrite(_blynk.components.cycle_box_button, null, function () {
                _assistant.fn.send(_settings.assistant.commands.cycle_box, function (resp) {
                    _blynk.fn.notify(resp);
                });
            });

            // reboot the system
            _blynk.fn.onWrite(_blynk.components.reboot_button, null, function () {
                _blynk.fn.notify('Rebooting...');
                setTimeout(E.reboot, _settings.blynk.reboot_timeout_ms);
            });

            _core.fn.init.end('Blynk');
        },
        connect: function () {
            console.log('Connecting Blynk...');
            _blynk.connection.connect();
        },
        updateComponent: function (component, value) {
            _blynk.components[component].write(value);
        },
        notify: function (msg) {
            _blynk.connection.notify(msg);
        },
        onWrite: function (component, cb_0, cb_1) {
            component.on('write', function (value) {
                if (value == 0 && typeof cb_0 == 'function') {
                    cb_0();
                }
                else if (value == 1 && typeof cb_1 == 'function') {
                    cb_1();
                }
            });
        }
    }
};
var _gpio = {
    fn: {
        init: function () {
            _core.fn.init.start('GPIO');
            var pins = _settings.gpio;

            // wifi LED
            pinMode(pins.wifi_led.pin, pins.wifi_led.mode);
            digitalWrite(pins.wifi_led.pin, 1);

            // SR04 pins
            pinMode(pins.sr04.trig.pin, pins.sr04.trig.mode);
            pinMode(pins.sr04.echo.pin, pins.sr04.echo.mode);

            _core.fn.init.end('GPIO');
        },
        toggle: function (pin, interval) {
            var state = 1;
            return setInterval(function () {
                digitalWrite(pin, state);
                state = !state;
            }, interval);
        }
    }
};
var _assistant = {
    fn: {
        send: function (command, cb, cb_on_error) {
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
                    cb(err);
                }
            });

            req.end();
        }
    }
};

// MAIN
function main() {
    console.log('Ready!\n');
    _blynk.fn.connect();
    _sr04.fn.monitor.start();
}

// Init functions
_gpio.fn.init();
_wifi.fn.init();
_sr04.fn.init();
_blynk.fn.init();

// this will call _settings.wifi.connection_cb
_wifi.fn.connect();