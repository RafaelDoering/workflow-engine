import { Injectable } from '@nestjs/common';
import { TaskPayload } from '@app/core/domain/task.entity';
import { FetchOrdersHandler } from './handlers/fetch-orders.handler';
import { CreateInvoiceHandler } from './handlers/create-invoice.handler';
import { PdfProcessHandler } from './handlers/pdf-process.handler';
import { SendEmailHandler } from './handlers/send-email.handler';
import { TaskHandler } from './handlers/task-handler.interface';

@Injectable()
export class TaskExecutor {
  private handlers: Map<string, TaskHandler>;

  constructor(
    private fetchOrdersHandler: FetchOrdersHandler,
    private createInvoiceHandler: CreateInvoiceHandler,
    private pdfProcessHandler: PdfProcessHandler,
    private sendEmailHandler: SendEmailHandler,
  ) {
    this.handlers = new Map();
    this.handlers.set('fetch-orders', this.fetchOrdersHandler);
    this.handlers.set('create-invoice', this.createInvoiceHandler);
    this.handlers.set('pdf-process', this.pdfProcessHandler);
    this.handlers.set('send-email', this.sendEmailHandler);
  }

  async execute(taskType: string, payload: TaskPayload): Promise<TaskPayload> {
    const handler = this.handlers.get(taskType);
    if (!handler) {
      throw new Error(`No handler found for task type: ${taskType}`);
    }

    return handler.execute(payload);
  }
}
