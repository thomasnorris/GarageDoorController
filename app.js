// STARTUP REQUIREMENTS
// require('Storage').write('wifi_ssid', <<ssid>>)
// require('Storage').write('wifi_pw', <<pw>>)

// MODULES
const _modules = {
    wifi: require('Wifi'),
    storage: require('Storage'),
    sr04: require('HC-SR04')
};

// SETTINGS
var _settings = {
    host_name: 'Garage Door Controller',
    wifi: {
        ssid: undefined, // read from storage
        pw: undefined, // read from storage
        retry_ms: 3000,
        led_blink_interval_ms: 500
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

function initWifi(cb, led_interval) {
    var wifi = _modules.wifi;
    var storage = _modules.storage;
    wifi.setHostname(_settings.host_name);
    wifi.disconnect();
    wifi.stopAP();

    _settings.wifi.ssid = storage.read('wifi_ssid');
    _settings.wifi.pw = storage.read('wifi_pw');

    console.log('Wifi connecting...');
    if (!led_interval) {
        led_interval = toggleGPIO(_settings.pins.wifi_led.pin, _settings.wifi.led_blink_interval_ms);
    }

    wifi.connect(_settings.wifi.ssid, {
        password: _settings.wifi.pw
    }, function (err) {
        var ip = wifi.getIP().ip;
        if (err) {
            console.log('Wifi connection error: ' + err);
        }
        else if (!ip || ip == '0.0.0.0') {
            console.log('Invalid IP, retrying connection in ' + _settings.wifi.retry_ms / 1000 + ' seconds...');
            setTimeout(function () {
                initWifi(cb, led_interval);
            }, _settings.wifi.retry_ms);
        }
        else {
            console.log("Wifi connected! Info: " + JSON.stringify(wifi.getIP()));
            clearInterval(led_interval);
            digitalWrite(_settings.pins.wifi_led.pin, 0);
            cb();
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
// END OF FUNCTIONS

// MAIN
function main() {
    console.log('Ready!');
    console.log('Starting SR04 sensor monitoring');

    monitorSR04();
}

// ENTRY POINT
initPins();
initWifi(main);
