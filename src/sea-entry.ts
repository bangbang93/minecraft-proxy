import 'reflect-metadata'
import 'source-map-support/register'
import {isMainThread, Worker as NodeWorker, threadId} from 'worker_threads'
import {join} from 'path'
import {loadConfig} from './config'
import {masterOnClusterMessage} from './cluster'
import {createWorkerWrapper, removeWorker, workers} from './worker-cluster'
import {createLogger} from 'bunyan'

let workerCounter = 0

const Logger = createLogger({
  name: isMainThread ? 'master' : `worker ${threadId}`,
})

async function main(): Promise<void> {
  const config = await loadConfig(join(process.cwd(), 'config/config.yml'))

  if (isMainThread) {
    process.title = 'mc-proxy: master process'
    for (let i = 0; i < config.proxy.workers; i++) {
      startWorker()
    }
    setupMaster(config)
    Logger.info('all workers started')
  } else {
    setupWorker(threadId)
    const {bootstrap} = await import('./main')
    bootstrap()
      .catch((err: Error) => {
        // eslint-disable-next-line no-console
        console.error(err)
        process.exit(1)
      })
  }
}

function startWorker(): void {
  const workerId = ++workerCounter
  const worker = new NodeWorker(__filename)
  const wrapper = createWorkerWrapper(worker, workerId)

  worker.on('exit', (code) => {
    if (code !== 0) {
      Logger.warn({workerId, code}, `worker exited with error code: ${code}`)
      removeWorker(workerId)
      startWorker()
    }
  })

  wrapper.on('message', (data) => {
    masterOnClusterMessage(wrapper, data)
  })
}

function setupWorker(workerId: number): void {
  process.title = `mc-proxy: worker ${workerId}`
  process.on('disconnect', () => {
    Logger.info('disconnect from master')
    process.title = `mc-proxy: old worker ${workerId}`
  })
}

function setupMaster(config: {proxy: {workers: number}}): void {
  process.on('SIGUSR1', async () => {
    Logger.info('got SIGUSR1, reloading')

    for (const [id, worker] of workers) {
      worker.disconnect()
      removeWorker(id)
    }
    workerCounter = 0

    for (let i = 0; i < config.proxy.workers; i++) {
      startWorker()
    }
  })
}

void main()
  .catch((err: Error) => {
    // eslint-disable-next-line no-console
    console.error(err)
    process.exit(1)
  })
