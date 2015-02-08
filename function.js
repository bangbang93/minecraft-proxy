/**
 * Created by bangbang on 15/01/27.
 */

var crypto = require('crypto');
var protocol = require('./protocol');
var protocolVersion = require('./protocolVersion');
var net = require('net');
var fs = require('fs');

exports.md5 = function md5 (str) {
    var md5sum = crypto.createHash('md5');
    md5sum.update(str);
    str = md5sum.digest('hex');
    return str;
};

var close = exports.close = function (client, reaseon){
    client.write(protocol.createPacketBuffer(0x00, 'login', {
        reason: reaseon
    }, true));
    client.end();
    console.log('[' + client.remoteAddress + ':' + client.remotePort + '] close because ' + reaseon);
};

var getServer = exports.getServer = function getServer(serverName, serverPort){
    return global.Config['servers'][serverName + ':' + serverPort] ||
        global.Config['servers'][serverName] ||
        global.Config['servers'][serverPort] ||
        global.Config['servers'][global.Config['default']];
};

var mcError = exports.mcError = function mcError(server, err){
    console.error("Couldn't connect to " + server.host + ':' + server.port);
    console.trace(err);
};

var removeConnection = exports.removeConnection = function removeConnection(serverName, uuid){
    delete global.connections[serverName][uuid];
};

var makePipe = exports.makePipe = function makePipe(client, server, handshake, login, serverInfo){
    client.pipe(server).pipe(client);
    console.log('add connection');
    if (handshake){
        global.connections[serverInfo.host + ':' + (serverInfo.port||25565)] = global.connections[serverInfo.host + ':' + (serverInfo.port||25565)] || {};
        var connectPool = global.connections[serverInfo.host + ':' + (serverInfo.port||25565)];
        connectPool.count = connectPool.count +1 || 1;
        var newConnection = connectPool[handshake.uuid] = {
            socket: client,
            username: login['username']
        };

        for(var i in handshake){
            newConnection[i] = handshake[i];
        }
        client.on('end', (function(uuid){
            return function(){
                removeConnection(serverInfo.host + ':' + (serverInfo.port||25565), uuid);
                connectPool.count --;
            };
        })(handshake['uuid']));
        client.on('error', (function(uuid){
            return function(){
                removeConnection(serverInfo.host + ':' + (serverInfo.port||25565), uuid);
                connectPool.count --;
            };
        })(handshake['uuid']));
        console.log('piping ' + login['username'] + '(' + handshake['uuid'] + ')' +
        '[' + client.remoteAddress + ':' + client.remotePort + '] to '
        + handshake['originHost'] + '[' + serverInfo['host'] + ':' + serverInfo['port'] + ']');
    } else {
        console.log(client.remoteAddress + 'for pinging');
    }
};

var status = exports.status = function status(serverInfo, client){
    var connectPool = global.connections[serverInfo.host + ':' + (serverInfo.port||25565)] || {
        count: 0
    };
    var response = {
        'version':{
            'name': serverInfo['handlePing']['version'],
            'protocol': protocolVersion(serverInfo['handlePing']['version'])
        },
        'players':{
            'max': serverInfo['handlePing']['maxPlayers'],
            'online': connectPool.count
        },
        'description':{
            'text': serverInfo['handlePing']['description']
        }
    };
    if (serverInfo['handlePing']['favicon']){
        fs.exists(serverInfo['handlePing']['favicon'], function (exists){
            if (exists){
                fs.readFile(serverInfo['handlePing']['favicon'], {encoding: null}, function (err, data){
                    if (!err){
                        response.favicon = 'data:image/png;base64,' + data.toString('base64');
                    }
                    client.write(protocol.createPacketBuffer(0x00, 'status', {
                        response: JSON.stringify(response)
                    }, true));
                })
            } else {
                client.write(protocol.createPacketBuffer(0x00, 'status', {
                    response: JSON.stringify(response)
                }, true));
            }
        })
    } else {
        client.write(protocol.createPacketBuffer(0x00, 'status', {
            response: JSON.stringify(response)
        }, true));
    }
};

exports.handshake = function (result, client, buffer){
    if (result.results['nextState'] == 1){
        var server = getServer(result.results['serverHost'], result.results['serverPort']);
        if (!server){
            client.end();
        } else {
            if (server['handlePing']){
                status(server, client);
            } else {
                var mc = net.connect(server);
                (function (mc, buffer){
                    mc.on('error', function (err){
                        close(client, err.toString());
                        mcError(mc, err);
                    });
                    mc.on('connect', function (){
                        mc.write(buffer);
                        client.removeAllListeners('data');
                        makePipe(client, mc);
                    })
                })(mc, buffer);
            }
        }
        return {
            handshake: result.results,
            state: 'status'
        };
    } else {
        return {
            handshake: result.results,
            state: 'login'
        };
    }
};

var ping = exports.ping = function ping(client, result, handshake){
    var serverInfo = getServer(handshake['serverHost'], handshake['serverPort']);
    if (!serverInfo){
        close(client, '服务器不存在');
        return;
    }
    if (serverInfo['handlePing']){
        if (result.results.id == 0) return;
        client.write(protocol.createPacketBuffer(0x01, 'status',{
            time: result.results.time
        }, true));
        client.end();
    }
};