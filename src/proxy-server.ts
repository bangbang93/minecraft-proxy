import * as Logger from 'bunyan'
import {EventEmitter} from 'events'
import {createServer, Server, Socket} from 'net'
import {Client} from './client'

interface IBackend {
  host: string
  port: number
  version: string
  handlePing: boolean
  isDefault: boolean
}

export class ProxyServer extends EventEmitter {
  public clients: Set<Client> = new Set()

  private server: Server
  private logger: Logger

  private backends: Map<string, IBackend> = new Map()

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
    this.backends.set(name, backend)
  }

  public getBackend(name: string): IBackend {
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
    await client.pipeToBackend(backend.port, backend.host, backend.version, nextState)
    // if (nextState !== 1) {
    //   await client.pipeToBackend(backend.port, backend.host, backend.version, nextState)
    // } else {
    //   client.write('server_info', {response: JSON.stringify({
    //       "version": {
    //         "name": "1.8.7",
    //         "protocol": 5
    //       },
    //       "players": {
    //         "max": 100,
    //         "online": 5,
    //         "sample": [
    //           {
    //             "name": "thinkofdeath",
    //             "id": "4566e69f-c907-48ee-8d71-d7ba5aa00d20"
    //           }
    //         ]
    //       },
    //       "description": {
    //         "text": "Hello world"
    //       }
    //     })})
    // }
  }

  private onDisconnect(client: Client): void {
    this.clients.delete(client)
  }

  private isIpBanned(ip: string): boolean {
    return false
  }
}
