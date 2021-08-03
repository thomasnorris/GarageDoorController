
var http = require('http');
var _assistant = function(settings) {
    var self = this;

    self.settings = {
        url: settings.url,
        endpoint: settings.endpoint,
        auth: settings.auth
    };

    this.send = function(command, cb, cb_on_error) {
        console.log(this);
        var options = url.parse(self.settings.url + self.settings.endpoint + '/' + encodeURIComponent(command));
        options.headers = {
            'X-Auth': self.settings.auth
        };

        var req = http.request(options, function (res) {
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
};

exports.assistant = _assistant;