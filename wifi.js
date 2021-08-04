var _wifi = function (settings, connection_cb) {
    var wifi = require('Wifi');
    var self = this;

    this.settings = {
        // required
        host_name: settings.host_name,
        ssid: settings.ssid,
        pw: settings.pw,
        retry_ms: settings.retry_ms,
        // optional
        led: {
            enable_toggle: settings.led.enable_toggle || false,
            gpio: settings.led.gpio ?? undefined,
            high_value: settings.led.high_value ?? 1,
            blink_interval_ms: settings.led.blink_interval_ms ?? 100
        }
    };

    this.connection_cb = connection_cb;

    this.connection_info = undefined;
    this.led_blink_interval = 0;

    this.fn = {
        init: function () {
            wifi.setHostname(self.settings.host_name);
            wifi.disconnect();

            wifi.on('disconnected', function() {
                console.log('Wifi disconnected, reconnecting in ' + self.settings.retry_ms + ' ms...');
                setTimeout(function () {
                    self.fn.connect();
                }, self.settings.retry_ms);
            });
        },
        connect: function () {
            if (self.settings.led.enable_toggle) {
                clearInterval(self.led_blink_interval);
                self.led_blink_interval = self.fn.toggleLed();
            }

            console.log('Connecting wifi...');
            wifi.connect(self.settings.ssid, {
                password: self.settings.pw
            }, self.fn.afterConnect);
        },
        afterConnect: function (err) {
            self.connection_info = wifi.getIP();
            var ip = self.connection_info.ip;

            if (err) {
                console.log('Wifi connection error: ' + err);
                wifi.disconnect();
            }
            else if (!ip || ip == '0.0.0.0') {
                console.log('Invalid Wifi IP.');
                wifi.disconnect();
            }
            else {
                console.log("Wifi connected! Info: " + JSON.stringify(self.connection_info));
                if (self.settings.led.enable_toggle) {
                    clearInterval(self.led_blink_interval);
                    digitalWrite(self.settings.led.gpio, self.settings.led.high_value);
                }

                wifi.stopAP();

                if (typeof self.connection_cb == 'function') {
                    self.connection_cb();
                    self.connection_cb = undefined;
                }
            }
        },
        toggleLed: function () {
            var state = 1;
            return setInterval(function () {
                digitalWrite(self.settings.led.gpio, state);
                state = !state;
            }, self.settings.led.blink_interval_ms);
        }
    };

    // init
    this.fn.init();
};

exports.wifi = _wifi;