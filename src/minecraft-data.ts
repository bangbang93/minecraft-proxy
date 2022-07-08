import {postNettyVersionsByProtocolVersion, preNettyVersionsByProtocolVersion} from 'minecraft-data'
import {Service} from 'typedi'

@Service()
export class MinecraftData {
  public protocolVersionToMcVersion(protocolVersion: number): string {
    return preNettyVersionsByProtocolVersion.pc[protocolVersion]?.minecraftVersion
        ?? postNettyVersionsByProtocolVersion.pc[protocolVersion]?.minecraftVersion
  }
}
