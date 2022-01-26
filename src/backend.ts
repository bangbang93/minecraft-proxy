import * as cluster from 'cluster'
import * as MinecraftData from 'minecraft-data'
import {Container, Inject} from 'typedi'
import {Client} from './client'
import {ClusterRequest} from './cluster'

export interface IBackend {
  serverName: string[]
  host: string
  port: number
  version: string
  handlePing: boolean
  onlineMode: boolean
  useProxy: boolean
  ping?: {
    maxPlayer: number
    description?: string
    favicon?: string
  }
}

export class Backend implements IBackend {
  public readonly protocolVersion: number
  public readonly serverName: string[]
  public readonly host: string
  public readonly port: number
  public readonly version: string
  public readonly handlePing: boolean
  public readonly onlineMode: boolean
  public readonly useProxy: boolean
  public readonly ping: IBackend['ping']

  private clients = new Set<Client>()

  private clusterRequest = Container.get(ClusterRequest)

  constructor(data: IBackend) {
    this.serverName = data.serverName
    this.host = data.host
    this.port = data.port
    this.version = data.version
    this.handlePing = data.handlePing
    this.onlineMode = data.onlineMode
    this.ping = data.ping
    this.useProxy = data.useProxy

    const minecraftData = MinecraftData(this.version)
    if (this.handlePing && !minecraftData) {
      throw new Error(`不支持的版本: ${this.version}，不可启用handlePing功能`)
    }
    this.protocolVersion = minecraftData?.version?.version
  }

  public addClient(client: Client): void {
    this.clients.add(client)
    client.on('end', () => {
      this.removeClient(client)
    })
  }

  public removeClient(client: Client): void {
    this.clients.delete(client)
  }

  public async getOnline(curr = false): Promise<number> {
    if (cluster.isMaster || curr) {
      return this.clients.size
    }

    return this.clusterRequest.getOnline(this.serverName[0])
  }
}
