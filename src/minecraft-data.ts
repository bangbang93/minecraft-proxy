import {createLogger} from 'bunyan'
import {postNettyVersionsByProtocolVersion, preNettyVersionsByProtocolVersion} from 'minecraft-data'
import {Service} from 'typedi'

@Service()
export class MinecraftData {
  private logger = createLogger({name: 'minecraft-data'})

  public protocolVersionToMcVersion(protocolVersion: number): string {
    const res = preNettyVersionsByProtocolVersion.pc[protocolVersion]
        ?? postNettyVersionsByProtocolVersion.pc[protocolVersion]
    // minecraft-data的typings这里是错的，会返回数组
    if (Array.isArray(res)) {
      return res[0].minecraftVersion
    } else {
      return res.minecraftVersion
    }
    if (!res) {
      this.logger.warn('unknown protocol version: %d', protocolVersion)
    }
    return null
  }
}
