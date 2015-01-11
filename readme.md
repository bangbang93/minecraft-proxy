# Minecraft-Proxy
相当于BungeeCord的精简版，完整支持Forge，暂不支持正版登录。若后端服务器是Spigot或者Cauldron，可以通过spigot.yml启用bungee模式来获取正确的客户端IP

*暂不支持传送门*
# 配置 config.js
初次启动前需要复制config.ex.js重命名为config.js

    {
      "port": 25566,   //程序监听的端口
      "host": "0.0.0.0",  //程序监听的IP
      "servers":{  //服务器们
        "localhost": {    //连接的服务器的域名，如example.com，可设置多个服务器，每个服务器只能有一个域名
          "host": "localhost",   //真正的minecraft服务器地址
          "port": 25565          //及其端口
        }
      }
    }

# 命令
reload 重载。重载只能重载服务器列表

# Referer
protocol.js引用自[node-minecraft-protocol](https://github.com/andrewrk/node-minecraft-protocol/blob/master/lib/protocol.js)