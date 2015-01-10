/**
 * Created by bangbang on 15/01/10.
 */
var net = require('net');
var crypto = require('crypto');
var protocol = require('./protocol');

var connections = {};

var server = net.createServer();

server.on('connection', function (client){
    var mc = net.connect({
        port: 25565
    });
    var buffer = new Buffer(0);
    var state = 'handshaking';
    var handshake;
    var uuid;
    client.on('data', function (data){
        buffer = Buffer.concat([buffer, data]);
        console.log(buffer);
        console.log(state);
        while (true){
            var result = protocol.parsePacket(buffer, state, true, {
                set_protocol: 1,
                ping_start: 1,
                login_start: 1
            });
            if (!result){
                break;
            }
            if (result.error){
                break;
            }
            console.log(result);
            console.log(state);
            if (state == 'handshaking'){
                if (result.results['nextState'] == 1){
                    mc.write(buffer);
                    makePipe(client, mc);
                } else {
                    handshake = result.results;
                    state = 'login';
                }
            } else if (state = 'login'){
                var packet = result.results;
                var usernameMD5 = md5(packet['username']);
                uuid = usernameMD5.substr(0,8) + '-' + usernameMD5.substr(8,4) + '-' + usernameMD5.substr(12,4) + '-' + usernameMD5.substr(16,4) + '-' + usernameMD5.substr(20,12);
                handshake['serverHost'] += '\0' + client.remoteAddress + '\0' + uuid;
                var handshakePacket = protocol.createPacketBuffer(0x00, 'handshaking', handshake, false);
                var loginPacket = protocol.createPacketBuffer(0x00, 'login', packet, false);
                var newBuffer = Buffer.concat([handshakePacket, loginPacket]);
                mc.write(newBuffer);
                client.removeAllListeners('data');
                makePipe(client, mc);
            }
            buffer = buffer.slice(result.size);
        }
    });
});

function makePipe(client, server){
    client.pipe(server).pipe(client);
    console.log('add connection');
    console.log('local port' + client.remotePort);
}

function md5 (str) {
    var md5sum = crypto.createHash('md5');
    md5sum.update(str);
    str = md5sum.digest('hex');
    return str;
}

server.listen(25566);