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
    var wifi = _modules.wifi;
    var storage = _modules.storage;
    wifi.setHostname(_settings.host_name);
    wifi.disconnect();
    wifi.stopAP();

    wifi.on('disconnected', function (details) {
        console.log('Wifi disconnected, reconnecting in ' + msToS(_settings.wifi.retry_ms) + ' seconds...');
        setTimeout(function () {
            connectWifi();
        }, _settings.wifi.retry_ms);
    });

    _settings.wifi.ssid = storage.read('wifi_ssid');
    _settings.wifi.pw = storage.read('wifi_pw');
}

function connectWifi(cb) {
    var wifi = _modules.wifi;

    clearInterval(_settings.wifi.led.interval);
    _settings.wifi.led.interval = toggleGPIO(_settings.pins.wifi_led.pin, _settings.wifi.led.blink_interval_ms);

    console.log('Wifi connecting...');
    wifi.connect(_settings.wifi.ssid, {
        password: _settings.wifi.pw
    }, function (err) {
        var ip = wifi.getIP().ip;
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
            console.log("Wifi connected! Info: " + JSON.stringify(wifi.getIP()));
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
connectWifi(main);
