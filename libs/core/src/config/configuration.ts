import {
  IsString,
  IsNumber,
  IsEnum,
  validateSync,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  VERBOSE = 'verbose',
}

class EnvironmentVariables {
  @IsString()
  DATABASE_URL: string;

  @IsString()
  BROKER_URLS: string;

  @IsNumber()
  PORT: number = 3000;

  @IsEnum(LogLevel)
  LOG_LEVEL: LogLevel = LogLevel.INFO;
}

export type EnvConfig = EnvironmentVariables;

export const validate = (config: Record<string, unknown>) => {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
};
