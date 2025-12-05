import { Injectable } from '@nestjs/common';
import { TaskPayload } from '@app/core/domain/task.entity';
import { TaskHandler } from './task-handler.interface';

@Injectable()
export class CreateInvoiceHandler implements TaskHandler {
  async execute(payload: TaskPayload): Promise<TaskPayload> {
    console.log('[CreateInvoiceHandler] Creating invoice for:', payload);
    await this.delay(400);

    const total = payload.orders?.reduce((sum, o) => sum + o.amount, 0) ?? 0;
    const invoice = {
      invoiceId: `INV-${Date.now()}`,
      customerId: payload.orderId ?? 'unknown',
      total,
      createdAt: new Date().toISOString(),
    };

    console.log('[CreateInvoiceHandler] Created invoice:', invoice);
    return { ...payload, invoice };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
