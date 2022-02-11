import {Service} from 'typedi'
import {schemas} from 'minecraft-data'

@Service()
export class MinecraftData {
  public protocolVersionToMcVersion(protocolVersion: number): string {
    for (const schema of schemas.protocolVersions) {
      if (schema.version === protocolVersion) {
        return schema.minecraftVersion
      }
    }
  }
}
