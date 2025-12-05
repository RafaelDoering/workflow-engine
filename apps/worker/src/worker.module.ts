import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { PrismaWorkflowInstanceRepository } from '@app/core/adapters/prisma-workflow-instance-repository';
import { PrismaTaskRepository } from '@app/core/adapters/prisma-task-repository';
import { KafkaConsumer } from '@app/core/adapters/kafka.consumer';
import { WorkerService } from './worker.service';
import { TaskExecutor } from './task-executor.service';
import { TaskStateService } from './task-state.service';
import { FetchOrdersHandler } from './handlers/fetch-orders.handler';
import { CreateInvoiceHandler } from './handlers/create-invoice.handler';
import { PdfProcessHandler } from './handlers/pdf-process.handler';
import { SendEmailHandler } from './handlers/send-email.handler';

@Module({
  imports: [ConfigModule.forRoot()],
  providers: [
    WorkerService,
    TaskExecutor,
    TaskStateService,
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
    KafkaConsumer,
    PrismaWorkflowInstanceRepository,
    PrismaTaskRepository,
    FetchOrdersHandler,
    CreateInvoiceHandler,
    PdfProcessHandler,
    SendEmailHandler,
  ],
})
export class WorkerModule {}
