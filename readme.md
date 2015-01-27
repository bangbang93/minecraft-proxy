# Minecraft-Proxy
相当于BungeeCord的精简版，完整支持Forge，暂不支持正版登录。若后端服务器是Spigot或者Cauldron，可以通过spigot.yml启用bungee模式来获取正确的客户端IP

*暂不支持传送门*
# 配置 config.js
初次启动前需要复制config.ex.js重命名为config.js

# 配置文件说明

    {
      "port": [25566, 25567, 25568],   //程序监听的端口，可以监听任意多个端口
      "host": "0.0.0.0",  //程序监听的IP，暂不支持监听多个，0.0.0.0代表所有入口ip
      "default": "localhost",
      "ipLimit": {    //IP并发限制
        "default": 0,   //默认限制，-1代表不限制
        "127.0.0.1": 0
      },
      "ban": {"ip": []},  //封禁ip
      "servers":{  //服务器们
        "25566": {    //连接的服务器的端口，即上面的端口
          "host": "localhost",   //真正的minecraft服务器地址
          "port": 25565          //及其端口
        },
        "25567": {    //连接的服务器的端口
          "host": "localhost",   //真正的minecraft服务器地址
          "port": 25565          //及其端口
        },
        "localhost:25568": {    //同时可以使用端口和域名区分服务器
          "host": "localhost",   //真正的minecraft服务器地址
          "port": 25565          //及其端口
        },
        "localhost2:25568": {    //连接的服务器的端口  host 127.0.0.1 localhost2
          "host": "localhost",   //真正的minecraft服务器地址
          "port": 25565          //及其端口
        },
      }
    }

程序区分服务器的优先级为：

1. 查询端口和域名都符合的服务器
2. 查询域名符合的服务器
3. 查询端口符合的服务器

若上述三步均未找到服务器，则查找default字段指定的服务器，若default字段指定的服务器不存在，则会断开和客户端的连接

# 命令
- reload

```reload```

重载：
重载不会导致程序重新监听端口

- banip

```banip <ip>```

封禁ip，后跟一个有效ip。不会将封禁ip已有连接断开

- limitip

```limitip <ip> <limit>```

限制单ip并发，不会断开已经超过的连接

# Referer
protocol.js引用自[node-minecraft-protocol](https://github.com/andrewrk/node-minecraft-protocol/blob/master/lib/protocol.js)