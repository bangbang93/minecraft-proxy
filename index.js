/**
 * Created by bangbang on 15/01/10.
 */
var net = require('net');
var crypto = require('crypto');
var protocol = require('./protocol');

var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

var connections = {};

var server = net.createServer();

server.on('connection', function (client){

    var buffer = new Buffer(0);
    var state = 'handshaking';
    var handshake;
    var uuid;
    client.on('data', function (data){
        buffer = Buffer.concat([buffer, data]);
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
                    var server = config['servers'][result.results['serverHost']];
                    if (!server){
                        client.close();
                    } else {
                        var host = server.host;
                        var port = server.port;
                        var mc = net.connect({
                            host: host,
                            port: port
                        });
                        (function (mc, buffer){
                            mc.on('connect', function (){
                                mc.write(buffer);
                                client.removeAllListeners('data');
                                makePipe(client, mc);
                            })
                        })(mc, buffer);
                    }
                } else {
                    handshake = result.results;
                    state = 'login';
                }
            } else if (state = 'login'){
                server = config['servers'][handshake['serverHost']];
                if (!server){
                    client.write(protocol.createPacketBuffer(0x00, 'login', {
                        reason: '服务器不存在'
                    }, true));
                } else {
                    host = server.host;
                    port = server.port;
                    mc = net.connect({
                        host: host,
                        port: port
                    });
                    (function (mc, result){
                        mc.on('connect', function (){
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
                        })
                    })(mc, result);
                }

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

server.listen(config.port, config.host);