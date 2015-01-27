/**
 * Created by bangbang on 15/01/27.
 */

var crypto = require('crypto');
var protocol = require('./protocol');

exports.md5 = function md5 (str) {
    var md5sum = crypto.createHash('md5');
    md5sum.update(str);
    str = md5sum.digest('hex');
    return str;
};

exports.close = function (client, reaseon){
    client.write(protocol.createPacketBuffer(0x00, 'login', {
        reason: reaseon
    }, true));
    client.end();
    console.log('[' + client.remoteAddress + ':' + client.remotePort + '] close because ' + reaseon);
};