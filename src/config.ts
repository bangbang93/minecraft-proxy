import {plainToClass} from 'class-transformer'
import {IsBoolean, IsOptional, IsPort, IsString, validate, ValidateNested} from 'class-validator'
import {readFileSync} from 'fs'
import * as yaml from 'js-yaml'
import {join} from 'path'

class ConfigProxy {
  @IsPort() public port: number
  @IsString() @IsOptional() public host?: string
}

class ConfigServer {
  @IsString() public serverName: string
  @IsString() public proxyHost: string
  @IsPort() public proxyPort: number
  @IsString() public version: string
  @IsBoolean() public handlePing: boolean
  @IsBoolean() public isDefault: boolean
}

export class Config {
  @ValidateNested() proxy: ConfigProxy
  @ValidateNested({each: true}) servers: ConfigServer[]
}

export async function loadConfig(path = join(__dirname, '../config/config.yaml')): Promise<Config> {
  const data = yaml.load(readFileSync(path, 'utf8'))
  const config = plainToClass(Config, data, {enableImplicitConversion: true})
  await validate(config)
  return config
}
