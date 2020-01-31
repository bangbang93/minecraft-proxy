import * as cluster from 'cluster'
import * as MinecraftData from 'minecraft-data'
import {Container, Inject} from 'typedi'
import {Client} from './client'
import {ClusterRequest} from './cluster'

export interface IBackend {
  serverName: string
  host: string
  port: number
  version: string
  handlePing: boolean
  isDefault: boolean
  onlineMode: boolean
  ping: {
    maxPlayer: number
    description?: string
    favicon?: string
  }
}

export class Backend implements IBackend {
  public readonly protocolVersion: number
  public readonly serverName: string
  public readonly host: string
  public readonly port: number
  public readonly version: string
  public readonly handlePing: boolean
  public readonly isDefault: boolean
  public readonly onlineMode: boolean
  public readonly ping: IBackend['ping']

  private clients = new Set<Client>()

  private clusterRequest = Container.get(ClusterRequest)

  constructor(data: IBackend) {
    this.serverName = data.serverName
    this.host = data.host
    this.port = data.port
    this.version = data.version
    this.handlePing = data.handlePing
    this.isDefault = data.isDefault
    this.ping = data.ping

    const minecraftData = MinecraftData(this.version)
    this.protocolVersion = minecraftData.version.version
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

    return this.clusterRequest.getOnline(this.serverName)
  }
}
