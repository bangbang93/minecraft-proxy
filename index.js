/**
 * Created by bangbang on 15/01/10.
 */
var net = require('net');
var events = require('events');
var util = require('util');
var EventEmitter = events.EventEmitter;
var protocol = require('./protocol');
var fun = require('./function');

require('./command');

var fs = require('fs');

global.Config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

global.connections = {};
var ips = global.ips = {};

var servers = [];

var Proxy = module.exports = function(){
    this.getConnections = function(){
        return global.connections;
    };
    this.getConfig = function(){
        return global.Config;
    };
    this.getProtocol = function (){
        return protocol;
    };
    this.getFun = function (){
        return fun;
    };
    this.getServers = function(){
        return servers;
    }
};
util.inherits(module.exports, EventEmitter);

var proxy = global.Proxy = new Proxy;

require('./plugin')(proxy);

if (!Array.isArray(Config.port)){
    Config.port = [Config.port];
}

Config.port.forEach(function (e){
    var server = net.createServer();
    server.on('connection', onConnection);
    server.listen(e, Config.host);
    server.on('listening', function (){
        console.log('proxy is ready on ' + Config.host + ':' + e);
        proxy.emit('ready', server);
    });
    server.on('error', function (err){
        onError(e, err);
    });
    servers.push(server);
});

var makePipe = fun.makePipe;

function onConnection(client) {
    if (checkBanIp(client.remoteAddress)){
        fun.close(client, 'ip被封禁');
        return;
    }
    ips[client.remoteAddress] = ips[client.remoteAddress] ++ ||1;
    if (!checkGlobalIp(client.remoteAddress)){
        fun.close(client, '超过单IP并发限制');
        return;
    }
    proxy.emit('connection', client);
    var state = 'handshaking';
    var handshake;
    var uuid;
    var buffer = new Buffer(0);
    client.on('data', function (data){
        buffer = Buffer.concat([buffer, data]);
        while (true){
            var result = protocol.parsePacket(buffer, state, true, {
                set_protocol: 1,
                login_start: 1,
                ping: 1
            });
            if (!result){
                break;
            }
            if (result.error){
                break;
            }
            console.log(state);
            if (state == 'handshaking'){
                proxy.emit('handshaking', client, result);
                var res = fun.handshake(result, client, buffer);
                if (!!res){
                    handshake = res.handshake;
                    state = res.state;
                }
            } else if (state == 'status') {
                proxy.emit('status', client, result, handshake);
                fun.ping(client, result, handshake);
            } else if (state = 'login'){
                    var server = getServer(handshake['serverHost'], handshake['serverPort']);
                    if (!server){
                        fun.close(client, '服务器不存在');
                    } else {
                        proxy.emit('login', client, server, result, handshake);
                        var mc = net.connect(server);
                        (function (mc, result, server){
                            mc.on('error', function (err){
                                proxy.emit('backEndError', client, server, err);
                                fun.close(client, err.toString());
                                mcError(server, err);
                            });
                            mc.on('connect', function (){
                                proxy.emit('backEndConnect', client, server, mc);
                                var packet = result.results;
                                var usernameMD5 = fun.md5(packet['username']);
                                uuid = usernameMD5.substr(0,8) + '-' + usernameMD5.substr(8,4) + '-' + usernameMD5.substr(12,4) + '-' + usernameMD5.substr(16,4) + '-' + usernameMD5.substr(20,12);
                                handshake['uuid'] = uuid;
                                handshake['originHost'] = handshake['serverHost'];
                                handshake['serverHost'] += '\0' + client.remoteAddress + '\0' + uuid;
                                var handshakePacket = protocol.createPacketBuffer(0x00, 'handshaking', handshake, false);
                                var loginPacket = protocol.createPacketBuffer(0x00, 'login', packet, false);
                                var newBuffer = Buffer.concat([handshakePacket, loginPacket]);
                                mc.write(newBuffer);
                                client.removeAllListeners('data');
                                makePipe(client, mc, handshake, packet, server);
                            })
                        })(mc, result, server);
                    }
                }
                buffer = buffer.slice(result.size || 0);
            }
    });
    client.on('close', function (){
        proxy.emit('close', client);
        onClose(client);
    })
}

function onError(port, err){
    console.error("Server on port " + port + " couldn't work property" );
    console.trace(err);
}

function onClose(client){
    ips[client.remoteAddress] --;
}

var mcError = fun.mcError;

var getServer = fun.getServer;

function checkGlobalIp(ip){
    var ipLimit = Config['ipLimit'][ip]||Config['ipLimit']['default'] || -1;
    if (ipLimit == -1){
        return true;
    }
    var nowIp = ips[ip] || 0;
    return nowIp < ipLimit;
}

function checkBanIp(ip){
    return global.Config['ban']['ip'].indexOf(ip) !== -1;

}

process.on('uncaughtException', function (err){
    console.dir(err);
    console.log(JSON.stringify(err));
});