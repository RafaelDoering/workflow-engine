import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaClient } from '@app/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { PrismaWorkflowInstanceRepository } from '@app/core/adapters/prisma-workflow-instance-repository';
import { PrismaWorkflowRepository } from '@app/core/adapters/prisma-workflow-repository';
import { PrismaTaskRepository } from '@app/core/adapters/prisma-task-repository';
import { KafkaTaskQueueAdapter } from '@app/core/adapters/kafka-task-queue.adapter';
import { ApiController } from './api.controller';
import { WorkflowService } from './workflow.service';

import { validate } from '@app/core/config/configuration';

import { LoggerModule } from '@app/core/logger/logger.module';

@Module({
  imports: [ConfigModule.forRoot({ validate }), LoggerModule],
  controllers: [ApiController],
  providers: [
    WorkflowService,
    {
      provide: PrismaClient,
      useFactory: () => {
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        const adapter = new PrismaPg(pool);
        return new PrismaClient({ adapter });
      },
    },
    {
      provide: 'WorkflowInstanceRepository',
      useClass: PrismaWorkflowInstanceRepository,
    },
    {
      provide: 'TaskRepository',
      useClass: PrismaTaskRepository,
    },
    {
      provide: 'TaskQueuePort',
      useClass: KafkaTaskQueueAdapter,
    },
    {
      provide: 'WorkflowRepository',
      useClass: PrismaWorkflowRepository,
    },
  ],
})
export class ApiModule {}
