/**
 * Created by bangbang on 15/02/09.
 */
var fs = require('fs');
var path = require('path');

var plugins = [];

module.exports = function (Proxy){
    if (fs.existsSync(path.join(__dirname, 'plugins'))){
        loadPlugin(Proxy);
    } else {
        fs.mkdir(path.join(__dirname, 'plugins'));
    }
};


function loadPlugin(Proxy){
    var files = fs.readdirSync(path.join(__dirname, 'plugins'));
    files.forEach(function (e){
        if (e.match(/\.js$/i)){
            var plugin = require(path.join(path.join(__dirname, 'plugins'), e));
            if (typeof plugin == 'function'){
                plugin = plugin(Proxy);
                plugins.push(plugin);
            }
        }
    })
}