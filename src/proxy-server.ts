import * as Logger from 'bunyan'
import {isWorker, worker} from 'cluster'
import {EventEmitter} from 'events'
import {createServer, Server, Socket} from 'net'
import {Container} from 'typedi'
import {Backend, IBackend} from './backend'
import {Client} from './client'
import {Config} from './config'
import {PluginHook} from './plugin-hook'

export class ProxyServer extends EventEmitter {
  public clients: Set<Client> = new Set()
  public defaultServer: string
  public readonly config: Config = Container.get('config')
  public readonly plugin = Container.get(PluginHook)
  public readonly workdir = process.cwd()

  private server: Server
  private logger: Logger

  private backends: Map<string, Backend> = new Map()

  constructor(
    private port: number,
    private host?: string,
  ) {
    super()
    const loggerOptions: Logger.LoggerOptions = {name: 'server', port, host}
    if (isWorker) {
      loggerOptions.worker = worker.id
    }
    this.logger = Logger.createLogger(loggerOptions)
  }

  public static getConfig(): Config {
    return Container.get('config')
  }

  public async listen(): Promise<void> {
    if (this.server) throw new Error('already listen')
    const server = this.server = createServer()
    await new Promise<void>((resolve) => {
      server.listen(this.port, this.host, () => resolve())
    })
    server.on('connection', async (socket) => this.onConnection(socket))
    this.logger.info('ready')
  }

  public addBackend(names: string[], backend: IBackend): void {
    const be = new Backend(backend)
    for (const name of names) {
      if (this.backends.has(name)) {
        throw new Error(`duplicate name ${name}`)
      }
      this.backends.set(name, be)
    }
  }

  public async getBackend(name: string): Promise<Backend> {
    if (this.backends.has(name)) return this.backends.get(name)
    if (this.backends.has(this.defaultServer)) return this.backends.get(this.defaultServer)
    const dynamicBackend = await this.plugin.hooks.server.lookupBackend.promise(name)
    if (dynamicBackend) {
      return new Backend(dynamicBackend)
    }
    return null
  }

  private async onConnection(socket: Socket): Promise<void> {
    if (this.isIpBanned(socket.remoteAddress)) {
      socket.end()
      this.logger.warn({ip: socket.remoteAddress}, `block ip ${socket.remoteAddress}`)
      return
    }
    const client = new Client(socket, this)
    this.clients.add(client)
    socket.once('disconnect', () => this.onDisconnect(client))
    socket.on('error', (err) => {
      this.logger.error({err})
    })
    try {
      const nextState = await client.awaitHandshake()
      const backend = await this.getBackend(client.host)
      if (!backend) return client.close(`${client.host} not found`)
      if (nextState === 2 || !backend.handlePing) {
        if (nextState === 2) {
          if (client.username && this.isUsernameBanned(client.username)) {
            this.logger.warn({
              ip: socket.remoteAddress, username: client.username,
            }, `block username ${client.username}`)
            client.close('username banned')
            return
          }
          if (backend.onlineMode && this.isUuidBanned(await client.getUUID(backend))) {
            this.logger.warn({
              ip: socket.remoteAddress, username: client.username, uuid: await client.getUUID(backend),
            }, `block uuid ${await client.getUUID(backend)}`)
            client.close('uuid banned')
            return
          }
        }
        await client.pipeToBackend(backend, nextState)
      } else {
        await client.responsePing(backend)
      }
    } catch (err) {
      this.logger.error(err)
      client.close(err.message)
    }
  }

  private onDisconnect(client: Client): void {
    this.clients.delete(client)
  }

  private isIpBanned(ip: string): boolean {
    if (this.config.allowListOnly) {
      return !this.config.allowList.ips.some((cidr) => cidr.contains(ip))
    }
    return this.config.blockList.ips.some((cidr) => cidr.contains(ip))
  }

  private isUsernameBanned(username: string): boolean {
    if (this.config.allowListOnly) {
      return !this.config.allowList.usernames.includes(username)
    }
    return this.config.blockList.usernames.includes(username)
  }

  private isUuidBanned(uuid: string): boolean {
    if (this.config.allowListOnly) {
      return !this.config.allowList.uuids.includes(uuid)
    }
    return this.config.blockList.uuids.includes(uuid)
  }
}
