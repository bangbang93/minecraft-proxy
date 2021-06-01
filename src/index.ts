import * as globby from 'globby'
import {States} from 'minecraft-protocol'
import 'reflect-metadata'
import {Container} from 'typedi'
import {loadConfig} from './config'
import {ProxyServer} from './proxy-server'
import { join } from 'path'

export async function bootstrap(): Promise<void> {
  const config = await loadConfig()
  Container.set('config', config)

  const proxy = new ProxyServer(config.proxy.port, config.proxy.host)

  Container.set('proxy', proxy)

  for (const server of config.servers) {
    proxy.addBackend(server.serverName, {
      ...server,
      host: server.proxyHost,
      port: server.proxyPort,
    })
  }
  proxy.defaultServer = config.defaultServer

  for (const file of await globby(join(__dirname, '../plugins/*.js'))) {
    const plugin = require(file)
    plugin(proxy)
  }

  await proxy.listen()
}

if (require.main === module) {
  bootstrap()
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err)
      process.exit(1)
    })
}


declare module 'minecraft-protocol' {
  export const states: typeof States
}
