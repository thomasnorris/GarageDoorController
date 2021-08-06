// STARTUP REQUIREMENTS
// require('Storage').write('wifi_ssid', <<ssid>>)
// require('Storage').write('wifi_pw', <<pw>>)
// require('Storage').write('assistant_url', <<url>>)
// require('Storage').write('assistant_endpoint', <<endpoint>>)
// require('Storage').write('assistant_auth', <<auth>>)
// require('Storage').write('blynk_url', <<url>>)
// require('Storage').write('blynk_auth', <<auth>>)

// Custom Modules
var _wifi = require('https://raw.githubusercontent.com/thomasnorris/NodeMCUEspruinoModules/master/wifi.js').wifi;
var _assistant = require('https://raw.githubusercontent.com/thomasnorris/NodeMCUEspruinoModules/master/google_assistant.js').assistant;
var _gpio = require('https://raw.githubusercontent.com/thomasnorris/NodeMCUEspruinoModules/master/gpio.js').gpio;
var _core = require('https://raw.githubusercontent.com/thomasnorris/NodeMCUEspruinoModules/master/core.js').core;
_core = new _core();

var _sr04 = require('https://raw.githubusercontent.com/thomasnorris/NodeMCUEspruinoModules/master/hcsr04.js').hcsr04;
var _blynk = require('https://raw.githubusercontent.com/thomasnorris/NodeMCUEspruinoModules/master/blynk.js').blynk;

var main = function () {
    console.log('ORIGINAL MAIN');
    // placeholder
};

// Settings
_settings = {};
// Google Assistant
_settings.assistant = {
    commands: {
        cycle_box: 'Cycle Ellie\'s Box'
    },
    url: _core.fn.readStorage('assistant_url'),
    endpoint: _core.fn.readStorage('assistant_endpoint'),
    auth: _core.fn.readStorage('assistant_auth')
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
    trigger_interval_ms: 500,
    gpio: {
        trigger_pin: _settings.gpio.sr04.trig.pin,
        echo_pin: _settings.gpio.sr04.echo.pin
    }
};
// BLYNK
_settings.blynk = {
    url: _core.fn.readStorage('blynk_url'),
    auth: _core.fn.readStorage('blynk_auth'),
    port: 8442,
};

// MAIN (must be hoisted)
function main() {
    console.log('Ready!\n');
    _sr04.fn.startMonitoring();
}

// Setup modules
_assistant = new _assistant(_settings.assistant, { core: _core });
_gpio = new _gpio({
    pins: [_settings.gpio.wifi_led.pin, _settings.gpio.sr04.trig.pin, _settings.gpio.sr04.echo.pin],
    modes: [_settings.gpio.wifi_led.mode, _settings.gpio.sr04.trig.mode, _settings.gpio.sr04.echo.mode]
}, { core: _core });
_sr04 = new _sr04(_settings.sr04, { core: _core });
_blynk = new _blynk(_settings.blynk, { core: _core }, main, function () {
    // additional setup here
});
_wifi = new _wifi(_settings.wifi, { core: _core, gpio: _gpio }, _blynk.fn.connect);

// GLOBALS
/*
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
        init: function (cb) {
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

            _blynk.fn.onConnect(function () {
                if (typeof _settings.blynk.conection_cb == 'function') {
                    _settings.blynk.conection_cb();
                    _settings.blynk.conection_cb = undefined;
                }
            });

            // handlers for buttons
            // manual box trigger
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

            // called after blynk connects for the first time
            _settings.blynk.conection_cb = cb;
        },
        connect: function () {
            console.log('Connecting Blynk...');
            _blynk.connection.connect();
        },
        onConnect: function (cb) {
            _blynk.connection.on('connect', cb);
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
*/

// connect wifi, set up blynk, then run main
_wifi.fn.connect();