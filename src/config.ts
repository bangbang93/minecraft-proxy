import {LogLevel} from 'bunyan'
import {plainToClass, Transform, Type} from 'class-transformer'
import {
  IsArray, IsBoolean, IsIn, IsInstance, IsInt, IsOptional, IsString, IsUrl, Max, Min, validate, ValidateIf,
  ValidateNested,
} from 'class-validator'
import * as IPCIDR from 'ip-cidr'
import {castArray} from 'lodash'
import {cpus} from 'os'
import {inspect} from 'util'
import * as yimp from 'yaml-import'

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
  @IsString({each: true}) @Transform((v) => castArray(v)) public serverName: string[]
  @IsString() public proxyHost: string
  @Min(1) @Max(65535)  public proxyPort: number
  @IsString() public version: string
  @IsBoolean() public handlePing: boolean
  @IsBoolean() public onlineMode: boolean
  @IsBoolean() public useProxy: boolean = false

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

class Messages {
  @IsOptional() @IsString() public bannedUsername: string = '未授权用户'
  @IsOptional() @IsString() public bannedUUID: string = '未授权用户'
}

export class Config {
  @ValidateNested() proxy: ConfigProxy
  @ValidateNested({each: true}) @Type(() => ConfigServer) servers: ConfigServer[]
  @IsOptional() @IsString() public defaultServer?: string
  @IsOptional() @IsBoolean() public allowListOnly: boolean = false
  @ValidateNested() public blockList: BlockList
  @IsOptional() @ValidateNested() public allowList: BlockList
  @IsUrl({protocols: ['http', 'https']}) profileEndpoint = 'https://api.mojang.com/profiles/minecraft'
  @IsOptional() @IsArray() @IsString({each: true}) plugins: string[] = []
  @ValidateNested() message: Messages
  @IsIn(['trace', 'debug', 'info', 'warn', 'error', 'fatal']) @IsOptional() loglevel: LogLevel = 'info'
}

export async function loadConfig(path: string): Promise<Config> {
  const data = yimp.read(path, {safe: false})
  const config = plainToClass(Config, data, {enableImplicitConversion: true})
  const errors = await validate(config)
  if (errors.length === 0) return config
  // eslint-disable-next-line no-console
  console.error(inspect(errors, {depth: 1e5}))
  process.exit(1)
}
