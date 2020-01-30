import 'reflect-metadata'
import {States} from 'minecraft-protocol'
import {Container} from 'typedi'
import {ProxyServer} from './proxy-server'

const proxy = new ProxyServer(25565)

Container.set('proxy', proxy)

proxy.listen()

proxy.backends.set('localhost', {version: '1.8.7', host: 'localhost', port: 25565, handlePing: true})
proxy.backends.set('192.168.193.7', {version: '1.8.7', host: '192.168.193.1', port: 25565, handlePing: true})

declare module 'minecraft-protocol' {
  export const states: typeof States
}
