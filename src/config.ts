import {plainToClass, Transform, Type} from 'class-transformer'
import {
  IsBoolean, IsInstance, IsInt, IsOptional, IsPort, IsString, IsUUID, Max, Min, ValidateIf, ValidateNested,
  validateOrReject,
} from 'class-validator'
import {readFileSync} from 'fs'
import * as IPCIDR from 'ip-cidr'
import * as yaml from 'js-yaml'
import {cpus} from 'os'
import {join} from 'path'

class ConfigProxy {
  @Min(1) @Max(65535) public port: number
  @IsString() @IsOptional() public host?: string

  @IsInt() @Min(0) @Transform((v) => v === 0 ? cpus().length : v)
  public workers: number
}

class ServerPingInfo {
  @IsInt() @Min(1) public maxPlayer: number
  @IsString() @IsOptional() public description?: string
  @IsString() @IsOptional() public favicon?: string
}

class ConfigServer {
  @IsString() public serverName: string
  @IsString() public proxyHost: string
  @Min(1) @Max(65535)  public proxyPort: number
  @IsString() public version: string
  @IsBoolean() public handlePing: boolean
  @IsBoolean() public onlineMode: boolean

  @IsInstance(ServerPingInfo) @ValidateNested() @ValidateIf((e: ConfigServer) => e.handlePing)
  public ping: ServerPingInfo
}

class BlockList {
  @IsInstance(IPCIDR, {each: true}) @Transform((v: string[]) => v.map((e) => new IPCIDR(e)))
  public ips: IPCIDR[] = []

  @IsString({each: true})
  public usernames: string[] = []

  @IsString({each: true})
  public uuids: string[] = []
}

export class Config {
  @ValidateNested() proxy: ConfigProxy
  @ValidateNested({each: true}) @Type(() => ConfigServer) servers: ConfigServer[]
  @IsString() public defaultServer: string
  @ValidateNested() public blockList: BlockList
}

export async function loadConfig(path = join(__dirname, '../config/config.yml')): Promise<Config> {
  const data = yaml.load(readFileSync(path, 'utf8'))
  const config = plainToClass(Config, data, {enableImplicitConversion: true})
  await validateOrReject(config)
  return config
}
