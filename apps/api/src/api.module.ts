import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { PrismaWorkflowInstanceRepository } from '@app/core/adapters/prisma-workflow-instance-repository';
import { PrismaTaskRepository } from '@app/core/adapters/prisma-task-repository';
import { KafkaProducer } from '@app/core/adapters/kafka.producer';
import { ApiController } from './api.controller';
import { WorkflowService } from './workflow.service';

@Module({
  imports: [ConfigModule.forRoot()],
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
      provide: 'QueuePort',
      useClass: KafkaProducer,
    },
  ],
})
export class ApiModule {}
