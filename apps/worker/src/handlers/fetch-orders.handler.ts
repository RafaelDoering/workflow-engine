import { Injectable } from '@nestjs/common';
import { TaskPayload } from '@app/core/domain/task.entity';
import { TaskHandler } from './task-handler.interface';

@Injectable()
export class FetchOrdersHandler implements TaskHandler {
  async execute(payload: TaskPayload): Promise<TaskPayload> {
    console.log('[FetchOrdersHandler] Fetching orders for:', payload);
    await this.delay(500);

    const orders = [
      {
        id: 1,
        customerId: payload.orderId ?? 'unknown',
        amount: 100.5,
        items: 3,
      },
      {
        id: 2,
        customerId: payload.orderId ?? 'unknown',
        amount: 250.75,
        items: 5,
      },
    ];

    console.log('[FetchOrdersHandler] Fetched orders:', orders);
    return { ...payload, orders };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
