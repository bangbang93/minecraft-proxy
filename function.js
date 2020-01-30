/**
 * Created by bangbang on 15/01/27.
 */
var protocol = require('./protocol');
var protocolVersion = require('./protocolVersion');
var fs = require('fs');

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
