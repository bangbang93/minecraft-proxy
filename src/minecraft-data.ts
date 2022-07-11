import {createLogger} from 'bunyan'
import {postNettyVersionsByProtocolVersion, preNettyVersionsByProtocolVersion} from 'minecraft-data'
import {Service} from 'typedi'

@Service()
export class MinecraftData {
  private logger = createLogger({name: 'minecraft-data'})

  public protocolVersionToMcVersion(protocolVersion: number): string {
    const res = preNettyVersionsByProtocolVersion.pc[protocolVersion]?.minecraftVersion
        ?? postNettyVersionsByProtocolVersion.pc[protocolVersion]?.minecraftVersion
    if (!res) {
      this.logger.warn('unknown protocol version: %d', protocolVersion)
    }
    return null
  }
}
