import {
  isMainThread,
  parentPort,
  threadId,
  Worker,
} from 'worker_threads'
import {EventEmitter} from 'events'

export interface WorkerLike extends EventEmitter {
  id: number
  send(message: unknown): boolean
  disconnect(): void
}

const WORKER_TERMINATE_TIMEOUT_MS = 5000

export interface WorkerShutdownMessage {
  type: 'shutdown'
}

export function isWorkerShutdownMessage(message: unknown): message is WorkerShutdownMessage {
  return typeof message === 'object'
    && message !== null
    && (message as {type?: string}).type === 'shutdown'
}

class WorkerThreadWrapper extends EventEmitter implements WorkerLike {
  id: number
  private worker: Worker
  private terminateTimeout?: NodeJS.Timeout

  constructor(worker: Worker, id: number) {
    super()
    this.worker = worker
    this.id = id
    this.worker.on('message', (msg) => this.emit('message', msg))
    this.worker.on('error', (err) => this.emit('error', err))
    this.worker.on('exit', (code) => {
      if (this.terminateTimeout) {
        clearTimeout(this.terminateTimeout)
        this.terminateTimeout = undefined
      }
      this.emit('exit', code)
    })
    this.worker.on('online', () => this.emit('online'))
  }

  send(message: unknown): boolean {
    this.worker.postMessage(message)
    return true
  }

  disconnect(): void {
    try {
      this.worker.postMessage({type: 'shutdown'} as WorkerShutdownMessage)
    } catch {
      void this.worker.terminate()
      return
    }
    this.terminateTimeout = setTimeout(() => {
      void this.worker.terminate()
    }, WORKER_TERMINATE_TIMEOUT_MS)
  }
}

export {isMainThread, parentPort, threadId, Worker}
export const isMaster = isMainThread
export const isWorker = !isMainThread

export function getWorkerId(): number {
  return threadId
}

export function sendMessage(message: unknown): void {
  parentPort?.postMessage(message)
}

export function onMessage(handler: (message: unknown) => void): void {
  parentPort?.on('message', handler)
}

export const workers = new Map<number, WorkerLike>()

export function createWorkerWrapper(worker: Worker, id: number): WorkerLike {
  const wrapper = new WorkerThreadWrapper(worker, id)
  workers.set(id, wrapper)
  return wrapper
}

export function removeWorker(id: number): void {
  workers.delete(id)
}
