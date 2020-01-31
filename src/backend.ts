import * as MinecraftData from 'minecraft-data'

export interface IBackend {
  host: string
  port: number
  version: string
  handlePing: boolean
  isDefault: boolean
  ping: {
    maxPlayer: number
    description?: string
    favicon?: string
  }
}

export class Backend implements IBackend {
  public readonly protocolVersion: number
  public readonly host: string
  public readonly port: number
  public readonly version: string
  public readonly handlePing: boolean
  public readonly isDefault: boolean
  public readonly ping: IBackend['ping']

  constructor(data: IBackend) {
    this.host = data.host
    this.port = data.port
    this.version = data.version
    this.handlePing = data.handlePing
    this.isDefault = data.isDefault
    this.ping = data.ping

    const minecraftData = MinecraftData(this.version)
    this.protocolVersion = minecraftData.version.version
  }
}
