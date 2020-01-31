# Minecraft-ProxyServer 
[![npm](https://nodei.co/npm/minecraft-proxy.png?downloads=true&downloadRank=true)](https://nodei.co/npm/minecraft-proxy)

[![tnpm](http://npm.taobao.org/badge/v/minecraft-proxy.svg?style=flat-square)](http://npm.taobao.org/package/minecraft-proxy)

反向代理Minecraft，完整支持Forge，支持正版登录。若后端服务器是Spigot或者Cauldron，可以通过spigot.yml启用bungee模式来获取正确的客户端IP

# 配置 config.yml
```yaml
proxy:
  port: 25565 #监听端口
  host: 0.0.0.0 #监听ip
  workers: 0 #worker数量，以便充分利用多核服务器，0代表用上全部核心
servers:
  - serverName: localhost #服务连接的主机名
    proxyHost: localhost # 后端服务实际ip
    proxyPort: 25565 #后端服务实际端口
    version: 1.8.7 #版本（暂时没用，预留以后接管ping请求）
    handlePing: true #暂未实现，同上
    isDefault: true #是否为默认服务器，多个默认服务器以第一个为准
  - serverName: 192.168.193.7
    proxyHost: 192.168.193.1
    proxyPort: 25565
    version: 1.8.7
    handlePing: true
    isDefault: false
```

默认服务器： 当未找到对应的服务器主机名时，会连接默认服务器，若无默认服务器，则会断开连接

# 配置文件说明
