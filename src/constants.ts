import {PacketMeta} from 'minecraft-protocol'

export enum EnumHandShakeState {
  status = 1,
  login = 2,
}

export interface IPacket<T = any> {
  data: T
  packetMeta: PacketMeta
  buffer: Buffer
  fullBuffer: Buffer
}
