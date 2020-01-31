import {States} from 'minecraft-protocol'
import 'reflect-metadata'
import {Container} from 'typedi'
import {loadConfig} from './config'
import {ProxyServer} from './proxy-server'

async function bootstrap(): Promise<void> {
  const config = await loadConfig()

  const proxy = new ProxyServer(config.proxy.port, config.proxy.host)

  Container.set('proxy', proxy)

  for (const server of config.servers) {
    proxy.addBackend(server.serverName, {
      ...server,
      host: server.proxyHost,
      port: server.proxyPort,
    })
  }

  await proxy.listen()
}

bootstrap()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err)
    process.exit(1)
  })


declare module 'minecraft-protocol' {
  export const states: typeof States
}
