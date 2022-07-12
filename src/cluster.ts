import * as Bluebird from 'bluebird'
import {isWorker, worker, Worker, workers} from 'cluster'
import {sum} from 'lodash'
import {Container, Inject, Service} from 'typedi'
import {ProxyServer} from './proxy-server'

const handlers = new Map<number, (...args: unknown[]) => unknown>()

interface IClusterRpc {
  getOnline(name: string): Promise<number>
}

interface IRpcRequest {
  type: 'rpc-request'
  service: string
  method: string
  arguments: unknown[]
  correlationId: number
}

interface IRpcResponse {
  type: 'rpc-response'
  data: unknown
  correlationId: number
}

type IRpcData = IRpcRequest | IRpcResponse

@Service()
export class ClusterRequest implements IClusterRpc {
  public async getOnline(name: string): Promise<number> {
    return new Promise<number>((resolve) => {
      const correlationId = Math.random()
      process.send({
        type: 'rpc-request',
        service: 'backend',
        method: 'getOnline',
        arguments: [name],
        correlationId,
      })
      handlers.set(correlationId, resolve)
    })
  }
}

@Service()
export class ClusterProxy implements IClusterRpc {
  public async getOnline(name: string): Promise<number> {
    const data = await Bluebird.map(Object.values(workers), async (worker) => {
      const correlationId = Math.random()
      worker.send({
        type: 'rpc-request',
        service: 'backend',
        method: 'getOnline',
        arguments: [name],
        correlationId,
      })
      return new Promise<number>((resolve) => handlers.set(correlationId, resolve))
    })
    return sum(data)
  }
}

@Service()
export class ClusterHandler implements IClusterRpc {
  @Inject('proxy') proxyServer: ProxyServer

  public async getOnline(name: string): Promise<number> {
    const backend = await this.proxyServer.getBackend(name)
    if (!backend) return 0
    return backend.getOnline(true)
  }
}

export async function masterOnClusterMessage(worker: Worker, data: IRpcData) {
  switch (data.type) {
    case 'rpc-request': {
      const clusterProxy = Container.get(ClusterProxy)
      const resp = await clusterProxy[data.method](...data.arguments)
      const rpcResponse: IRpcResponse = {
        type: 'rpc-response',
        correlationId: data.correlationId,
        data: resp,
      }
      worker.send(rpcResponse)
      break
    }
    case 'rpc-response': {
      const handler = handlers.get(data.correlationId)
      if (handler) await handler(data.data)
      handlers.delete(data.correlationId)
      break
    }
    default:
  }
}

if (isWorker) {
  worker.on('message', async (data: IRpcData) => {
    switch (data.type) {
      case 'rpc-request': {
        const clusterHandler = Container.get(ClusterHandler)
        const resp = await clusterHandler[data.method](...data.arguments)
        const rpcResponse: IRpcResponse = {
          type: 'rpc-response',
          correlationId: data.correlationId,
          data: resp,
        }
        worker.send(rpcResponse)
        break
      }
      case 'rpc-response': {
        const handler = handlers.get(data.correlationId)
        if (handler) await handler(data.data)
        handlers.delete(data.correlationId)
        break
      }
      default:
    }
  })
}
