# Minecraft-ProxyServer 
[![npm](https://nodei.co/npm/minecraft-proxy.png?downloads=true&downloadRank=true)](https://nodei.co/npm/minecraft-proxy)

[![tnpm](http://npm.taobao.org/badge/v/minecraft-proxy.svg?style=flat-square)](http://npm.taobao.org/package/minecraft-proxy)

反向代理Minecraft，完整支持Forge，支持正版登录。若后端服务器是Spigot或者Cauldron，可以通过spigot.yml启用bungeecord模式来获取正确的客户端IP

## 和BungeeCord的区别
minecraft-proxy更像NGINX。
BungeeCord的目标是把多个Minecraft实例用起来像一个，minecraft-proxy的目标是让多个Minecraft实例共享25565端口，就像http应用的虚拟主机。

## 安装
### 运行环境
#### Windows/Linux/macOS
请参阅各平台<https://nodejs.org/zh-cn/>的安装方法
### 安装包
- 去<https://github.com/bangbang93/minecraft-proxy/releases>下载一个版本
- 解压
    ```shell script
    tar xvf minecraft-proxy.tar.gz
    ```
- 运行
    ```shell script
    bin/mcproxy
    ```
### Docker
```shell script
docker run -p 25565:25565 -v ./config:/opt/minecraft-proxy/config bangbang93/minecraft-proxy
```
### 手动编译
```shell script
git clone git@github.com:bangbang93/minecraft-proxy.git
cd minecraft-proxy
npm ci
npm run build
```

## 配置 config.yml
```yaml
proxy:
  port: 25565 #监听端口
  host: 0.0.0.0 #监听ip
  workers: 0 #worker数量，以便充分利用多核服务器，0代表用上全部核心
defaultServer: localhost #默认服务器，若不想指定，删除此行或设为false
servers:
  - serverName: localhost #服务连接的主机名
    proxyHost: localhost # 后端服务实际ip
    proxyPort: 25565 #后端服务实际端口
    version: 1.8.7 #版本
    handlePing: true #是否接管ping响应
    onlineMode: true
    ping: #接管ping时必填
      maxPlayer: 100 #最大玩家
      description: motd #motd
      favicon: data:image/png;base64, #没有就不用设置
  - serverName: 192.168.193.7
    proxyHost: 192.168.193.1
    proxyPort: 25565
    version: 1.8.7
    handlePing: true
blockList:
  ips: #同时会阻拦掉ping请求
    - 114.114.114.114
    - 10.0.0.0/32
  usernames:
    - BadGays
  uuids: # 只有开了正版验证的服务端可以封禁uuid，离线服务器只能用usernames
    - 12b8b9e0eba0ca37e935f037ff1ae90d
```

默认服务器： 当未找到对应的服务器主机名时，会连接默认服务器，若无默认服务器，则会断开连接

## 拆分配置文件
参阅 [/config](/config)

## bungeecord模式
找到spigot.yml，修改settings.bungeecord为true，重启服务器即可
