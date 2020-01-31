import {plainToClass, Type} from 'class-transformer'
import {
  IsBoolean, IsInstance, IsInt, IsOptional, IsPort, IsString, Max, Min, ValidateIf, ValidateNested, validateOrReject,
} from 'class-validator'
import {readFileSync} from 'fs'
import * as yaml from 'js-yaml'
import {cpus} from 'os'
import {join} from 'path'

class ConfigProxy {
  @Min(1) @Max(65535) public port: number
  @IsString() @IsOptional() public host?: string

  private _workers: number

  public set workers(value: number) {
    if (value === 0) {
      this._workers = cpus().length
    } else {
      this._workers = value
    }
  }

  public get workers(): number {
    return this._workers
  }
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
  @IsBoolean() public isDefault: boolean

  @IsInstance(ServerPingInfo) @ValidateNested() @ValidateIf((e: ConfigServer) => e.handlePing)
  public ping: ServerPingInfo
}

export class Config {
  @ValidateNested() proxy: ConfigProxy
  @ValidateNested({each: true}) @Type(() => ConfigServer) servers: ConfigServer[]
}

export async function loadConfig(path = join(__dirname, '../config/config.yaml')): Promise<Config> {
  const data = yaml.load(readFileSync(path, 'utf8'))
  const config = plainToClass(Config, data, {enableImplicitConversion: true})
  await validateOrReject(config)
  return config
}
