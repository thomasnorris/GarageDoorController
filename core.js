/**
 * Core Object
 */
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

exports.core = _core;