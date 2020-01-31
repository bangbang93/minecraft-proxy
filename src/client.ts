import {createLogger} from 'bunyan'
import {EventEmitter} from 'events'
import {createDeserializer, createSerializer, states, States} from 'minecraft-protocol'
import * as framing from 'minecraft-protocol/src/transforms/framing'
import {connect, Socket} from 'net'
import {Duplex} from 'stream'
import {Backend} from './backend'
import {ProxyServer} from './proxy-server'

export class Client extends EventEmitter {
  public host: string
  public protocolVersion: number
  public version = '1.8'
  public username: string

  private _state: States
  private splitter: Duplex = framing.createSplitter()
  private framer: Duplex = framing.createFramer()
  private deserializer
  private serializer
  private logger = createLogger({name: 'client'})

  private buffer: Buffer[] = []

  public get state(): States {
    return this._state
  }

  public set state(state) {
    this._state = state
    this.socket.unpipe()
    // this.splitter.unpipe()
    this.deserializer?.unpipe()
    this.serializer?.unpipe()
    this.framer.unpipe()
    this.serializer = createSerializer(
      {state, isServer: true, version: this.version, customPackets: {}},
    )
    this.deserializer = createDeserializer(
      {state, isServer: true, version: this.version, customPackets: {}},
    )
    this.socket.pipe(this.splitter)
    this.serializer.pipe(this.framer).pipe(this.socket)
  }

  constructor(
    private socket: Socket,
    public proxy: ProxyServer,
  ) {
    super()
    this.socket.on('end', () => {
      this.emit('end')
    })
  }

  public async awaitHandshake(): Promise<number> {
    if (this.host) return
    this.state = states.HANDSHAKING
    return new Promise<number>((resolve) => {
      this.splitter.on('data', (chunk) => {
        this.buffer.push(chunk)
        const packet = this.deserializer.parsePacketBuffer(chunk)
        const {name, params} = packet.data
        switch (name) {
          case 'set_protocol':
            this.protocolVersion = params.protocolVersion
            this.host = params.serverHost
            switch (params.nextState) {
              case 1:
                this.state = states.STATUS
                this.splitter.removeAllListeners('data')
                return resolve(params.nextState)
              case 2:
                this.state = states.LOGIN
                break
              default:
                throw new Error('wrong next state')
            }
            break
          case 'login_start':
            this.username = params.username
            this.splitter.removeAllListeners('data')
            return resolve(2)
          // no default
        }
      })
    })
  }

  public async pipeToBackend(backend: Backend, nextState: number): Promise<Socket> {
    this.socket.unpipe()
    const socket = connect(backend.port, backend.host)
    return new Promise((resolve) => {
      socket.on('connect', () => {
        backend.addClient(this)
        let serializer: Duplex = createSerializer(
          {state: states.HANDSHAKING, isServer: false, version: backend.version, customPackets: {}},
        )
        const framer: Duplex = framing.createFramer()
        serializer.pipe(framer).pipe(socket)
        serializer.write({name: 'set_protocol', params: {
          protocolVersion: this.protocolVersion, serverHost: `${backend.host}\0${this.socket.remoteAddress}\0`,
          serverPort: backend.port, nextState,
        }})
        if (this.username) {
          serializer = createSerializer(
            {state: states.LOGIN, isServer: false, version: backend.version, customPackets: {}},
          )
          serializer.pipe(framer)
          serializer.write({name: 'login_start', params: {username: this.username}})
        }
        if (nextState === 1) {
          serializer = createSerializer(
            {state: states.STATUS, isServer: false, version: backend.version, customPackets: {}},
          )
          serializer.pipe(framer)
          serializer.write({name: 'ping_start', params: {}})
        }
        this.socket.pipe(socket)
        socket.pipe(this.socket)
        resolve()
      })
      socket.on('close', () => {
        backend.removeClient(this)
      })
      socket.on('error', (err) => {
        this.logger.error({err})
      })
    })
  }

  public async responsePing(backend: Backend): Promise<void> {
    const response = JSON.stringify({
      version: {
        name: backend.version,
        protocol: backend.protocolVersion,
      },
      players: {
        max: backend.ping.maxPlayer,
        online: await backend.getOnline(),
        sample: [],
      },
      description: {
        text: backend.ping.description,
      },
      favicon: backend.ping.favicon ? backend.ping.favicon : undefined,
    })
    this.write('server_info', {response})
    return new Promise((resolve) => {
      this.splitter.on('data', (chunk) => {
        const packet = this.deserializer.parsePacketBuffer(chunk)
        const {name, params} = packet.data
        if (name === 'ping') {
          this.write(name, params)
          resolve()
        }
      })
    })
  }

  public close(reason: string): void {
    this.write('disconnect', {reason})
    // this.socket.end()
  }

  public kill(): void {
    this.socket.end()
  }

  public write(name, params): void {
    this.serializer.write({name, params})
  }
}
