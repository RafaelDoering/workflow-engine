import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  const logger = app.get(Logger);
  logger.log('Worker application started');
}
void bootstrap();
