import 'reflect-metadata'
import 'source-map-support/register'
import {isMainThread, Worker as NodeWorker, parentPort, threadId} from 'worker_threads'
import {join} from 'path'
import {loadConfig} from './config'
import {masterOnClusterMessage} from './cluster'
import {
  createWorkerWrapper,
  isWorkerShutdownMessage,
  removeWorker,
  workers,
} from './worker-cluster'
import {createLogger} from 'bunyan'

let workerCounter = 0
const intentionallyStoppedWorkers = new Set<number>()
const configPath = join(process.cwd(), 'config/config.yml')

const Logger = createLogger({
  name: isMainThread ? 'master' : `worker ${threadId}`,
})

async function main(): Promise<void> {
  const config = await loadConfig(configPath)

  if (isMainThread) {
    process.title = 'mc-proxy: master process'
    for (let i = 0; i < config.proxy.workers; i++) {
      startWorker()
    }
    setupMaster()
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
    const isIntentionalStop = intentionallyStoppedWorkers.has(workerId)
    intentionallyStoppedWorkers.delete(workerId)
    removeWorker(workerId)

    if (code !== 0) {
      Logger.warn({workerId, code}, `worker exited with error code: ${code}`)
      if (!isIntentionalStop) {
        startWorker()
      }
    }
  })

  wrapper.on('message', (data) => {
    void masterOnClusterMessage(wrapper, data)
  })
}

function setupWorker(workerId: number): void {
  process.title = `mc-proxy: worker ${workerId}`
  parentPort?.on('message', (message) => {
    if (!isWorkerShutdownMessage(message)) return
    process.title = `mc-proxy: old worker ${workerId}`
    process.exit(0)
  })
}

function setupMaster(): void {
  process.on('SIGUSR1', async () => {
    try {
      Logger.info('got SIGUSR1, reloading')
      const config = await loadConfig(configPath)

      for (const [id, worker] of workers) {
        intentionallyStoppedWorkers.add(id)
        worker.disconnect()
        removeWorker(id)
      }

      for (let i = 0; i < config.proxy.workers; i++) {
        startWorker()
      }
    } catch (err) {
      Logger.error({err}, 'reload failed')
    }
  })
}

void main()
  .catch((err: Error) => {
    // eslint-disable-next-line no-console
    console.error(err)
    process.exit(1)
  })
