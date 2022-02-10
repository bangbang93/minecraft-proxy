import {join} from 'path'
import 'reflect-metadata'
import {Container} from 'typedi'
import {Config, loadConfig} from './config'
import {ProxyServer} from './proxy-server'

export async function bootstrap(): Promise<void> {
  const config = await loadConfig(join(process.cwd(), '../config/config.yml'))
  Container.set('config', config)
  Container.set(Config, config)

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

  await proxy.plugin.loadPlugin()
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
