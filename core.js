var _storage = require('Storage');
var _core = {
    fn: {
        readStorage: function (key) {
            console.log('Reading ' + key + ' from Storage...');

            var value = _storage.read(key);
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
        },
        nullCoalesce: function(item, rhs) {
            // equivalent to item ?? rhs
            if (item == null || item == undefined) {
                return rhs;
            }
            return item;
        }
    }
};

exports.core = _core;