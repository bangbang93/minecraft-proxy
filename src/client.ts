import {createLogger} from 'bunyan'
import {createDeserializer, createSerializer, states, States} from 'minecraft-protocol'
import * as framing from 'minecraft-protocol/src/transforms/framing'
import {connect, Socket} from 'net'
import {Duplex} from 'stream'
import {ProxyServer} from './proxy-server'

export class Client {
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
            return resolve(2)
          // no default
        }
      })
    })
  }

  public async pipeToBackend(port: number, host: string, version: string, nextState: number): Promise<Socket> {
    this.socket.unpipe()
    const socket = connect(port, host)
    return new Promise((resolve) => {
      socket.on('connect', () => {
        let serializer: Duplex = createSerializer(
          {state: states.HANDSHAKING, isServer: false, version, customPackets: {}},
        )
        const framer: Duplex = framing.createFramer()
        serializer.pipe(framer).pipe(socket)
        serializer.write({name: 'set_protocol', params: {
          protocolVersion: this.protocolVersion, serverHost: `${host}\0${this.socket.remoteAddress}\0`,
          serverPort: port, nextState,
        }})
        if (this.username) {
          serializer = createSerializer(
            {state: states.LOGIN, isServer: false, version, customPackets: {}},
          )
          serializer.pipe(framer)
          serializer.write({name: 'login_start', params: {username: this.username}})
        }
        this.socket.pipe(socket)
        socket.pipe(this.socket)
        resolve()
      })
      socket.on('error', (err) => {
        this.logger.error({err})
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
