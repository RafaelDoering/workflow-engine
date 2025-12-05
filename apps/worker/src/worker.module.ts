import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { PrismaWorkflowRepository } from '@app/core/adapters/prisma-workflow-repository';
import { PrismaWorkflowInstanceRepository } from '@app/core/adapters/prisma-workflow-instance-repository';
import { PrismaTaskRepository } from '@app/core/adapters/prisma-task-repository';
import { KafkaConsumer } from '@app/core/adapters/kafka.consumer';
import { KafkaProducer } from '@app/core/adapters/kafka.producer';
import { WorkerService } from './worker.service';
import { TaskExecutor } from './task-executor.service';
import { TaskStateService } from './task-state.service';
import { TaskChainService } from './task-chain.service';
import { RetryScheduler } from './retry-scheduler.service';
import { FetchOrdersHandler } from './handlers/fetch-orders.handler';
import { CreateInvoiceHandler } from './handlers/create-invoice.handler';
import { PdfProcessHandler } from './handlers/pdf-process.handler';
import { SendEmailHandler } from './handlers/send-email.handler';

@Module({
  imports: [ConfigModule.forRoot(), ScheduleModule.forRoot()],
  providers: [
    WorkerService,
    TaskExecutor,
    TaskStateService,
    TaskChainService,
    RetryScheduler,
    {
      provide: PrismaClient,
      useFactory: () => {
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        const adapter = new PrismaPg(pool);
        return new PrismaClient({ adapter });
      },
    },
    {
      provide: 'WorkflowRepository',
      useClass: PrismaWorkflowRepository,
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
    KafkaConsumer,
    KafkaProducer,
    PrismaWorkflowRepository,
    PrismaWorkflowInstanceRepository,
    PrismaTaskRepository,
    FetchOrdersHandler,
    CreateInvoiceHandler,
    PdfProcessHandler,
    SendEmailHandler,
  ],
})
export class WorkerModule {}
