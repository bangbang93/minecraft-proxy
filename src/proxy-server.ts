import * as Logger from 'bunyan'
import {plainToClass} from 'class-transformer'
import {EventEmitter} from 'events'
import {createServer, Server, Socket} from 'net'
import {Backend, IBackend} from './backend'
import {Client} from './client'

export class ProxyServer extends EventEmitter {
  public clients: Set<Client> = new Set()

  private server: Server
  private logger: Logger

  private backends: Map<string, Backend> = new Map()

  constructor(
    private port: number,
    private host?: string,
  ) {
    super()
    this.logger = Logger.createLogger({name: 'server', port, host})
  }

  public async listen(): Promise<void> {
    if (this.server) throw new Error('already listen')
    const server = this.server = createServer()
    await new Promise((resolve) => {
      server.listen(this.port, this.host, resolve)
    })
    server.on('connection', async (socket) => this.onConnection(socket))
    this.logger.info('ready')
  }

  public addBackend(name: string, backend: IBackend): void {
    this.backends.set(name, new Backend(backend))
  }

  public getBackend(name: string): Backend {
    if (this.backends.has(name)) return this.backends.get(name)
    for (const value of this.backends.values()) {
      if (value.isDefault) return value
    }
    return null
  }

  private async onConnection(socket: Socket): Promise<void> {
    if (this.isIpBanned(socket.remoteAddress)) {
      socket.end()
    }
    const client = new Client(socket, this)
    this.clients.add(client)
    socket.once('disconnect', () => this.onDisconnect(client))
    socket.on('error', (err) => {
      this.logger.error({err})
    })
    const nextState = await client.awaitHandshake()
    const backend = this.getBackend(client.host)
    if (!backend) return client.close(`${client.host} not found`)
    if (nextState === 2 || !backend.handlePing) {
      await client.pipeToBackend(backend, nextState)
    } else {
      await client.responsePing(backend)
    }
  }

  private onDisconnect(client: Client): void {
    this.clients.delete(client)
  }

  private isIpBanned(ip: string): boolean {
    return false
  }
}
