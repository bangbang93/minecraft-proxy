import {createLogger} from 'bunyan'
import {createHash} from 'crypto'
import {EventEmitter} from 'events'
import got from 'got'
import {createDeserializer, createSerializer, states, States} from 'minecraft-protocol'
import * as framing from 'minecraft-protocol/src/transforms/framing'
import {connect, Socket} from 'net'
import {Duplex} from 'stream'
import {Backend} from './backend'
import {ProxyServer} from './proxy-server'
import { pick } from 'lodash'

export class Client extends EventEmitter {
  public host: string
  public protocolVersion: number
  public version = '1.8'
  public username: string
  public fml = false

  private _state: States
  private _uuid: string
  private splitter: Duplex = framing.createSplitter()
  private framer: Duplex = framing.createFramer()
  private deserializer
  private serializer
  private logger = createLogger({name: 'client'})

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
    private readonly socket: Socket,
    public readonly proxy: ProxyServer,
  ) {
    super()
    this.socket.on('end', () => {
      this.emit('end')
    })
    Object.assign(this.logger.fields, pick(socket, 'remoteAddress', 'remotePort'))
  }

  public async awaitHandshake(): Promise<number> {
    if (this.host) return
    this.state = states.HANDSHAKING
    return new Promise<number>((resolve) => {
      this.splitter.on('data', (chunk) => {
        const packet = this.deserializer.parsePacketBuffer(chunk)
        const {name, params} = packet.data
        switch (name) {
          case 'set_protocol':
            this.protocolVersion = params.protocolVersion
            this.host = params.serverHost
            if (this.host.includes('\0')) {
              const split = this.host.split('\0')
              this.host = split[0]
              this.fml = split[1] === 'FML'
            }
            switch (params.nextState) {
              case 1:
                this.state = states.STATUS
                this.splitter.removeAllListeners('data')
                return resolve(params.nextState)
              case 2:
                this.state = states.LOGIN
                break
              default:
                throw new Error(`wrong next state, except 1 or 2, got ${params.nextState}`)
            }
            break
          case 'login_start':
            this.username = params.username
            this.logger.fields['username'] = this.username
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
    return new Promise<Socket>((resolve) => {
      socket.on('connect', async () => {
        backend.addClient(this)
        if (backend.useProxy) {
          socket.write(
            'PROXY TCP4 '
            + `${this.socket.remoteAddress} ${socket.remoteAddress} ${this.socket.remotePort} ${socket.remotePort}\r\n`,
          )
        }
        let serializer: Duplex = createSerializer(
          {state: states.HANDSHAKING, isServer: false, version: backend.version, customPackets: {}},
        )
        const framer: Duplex = framing.createFramer()
        serializer.pipe(framer).pipe(socket)
        if (this.username) {
          const serverHost: string[] = [backend.host, this.socket.remoteAddress, await this.getUUID(backend)]
          if (this.fml) serverHost.push('FML\0')
          serializer.write({name: 'set_protocol', params: {
            protocolVersion: this.protocolVersion,
            serverHost: serverHost.join('\0'),
            serverPort: backend.port, nextState,
          }})
          serializer = createSerializer(
            {state: states.LOGIN, isServer: false, version: backend.version, customPackets: {}},
          )
          serializer.pipe(framer)
          serializer.write({name: 'login_start', params: {username: this.username}})
        } else {
          serializer.write({name: 'set_protocol', params: {
            protocolVersion: this.protocolVersion,
            serverHost: `${backend.host}`,
            serverPort: backend.port, nextState,
          }})
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
        resolve(socket)
      })
      socket.on('close', () => {
        backend.removeClient(this)
      })
      socket.on('error', (err) => {
        this.logger.error({err})
        this.close(`failed to connect backend: ${err.message}`)
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
          this.splitter.removeAllListeners('data')
          this.write(name, params)
          resolve()
        }
      })
    })
  }

  public async getUUID(backend: Backend): Promise<string> {
    if (this._uuid) return this._uuid
    if (!backend.onlineMode) {
      const buf = createHash('md5').update('OfflinePlayer:').update(this.username).digest()
      buf[6] = buf[6] & 0x0f | 0x30
      buf[8] = buf[8] & 0x3f | 0x80
      this._uuid = buf.toString('hex')
    } else {
      const resp = await got<{id: string; name: string}[]>(
        'https://api.mojang.com/profiles/minecraft',
        {method: 'POST', responseType: 'json', body: JSON.stringify([this.username])},
      )
      if (resp.body.length > 0) {
        this._uuid = resp.body[0].id
      } else {
        this.close('cannot get uuid for the user')
      }
    }
    return this._uuid
  }

  public close(reason: string): void {
    try {
      this.write('disconnect', {reason: JSON.stringify({text: reason})})
    } catch (err) {
      this.logger.warn(err, 'failed to disconnect')
      this.kill()
    }
  }

  public kill(): void {
    this.socket.end()
  }

  public write(name, params): void {
    this.serializer.write({name, params})
  }
}
