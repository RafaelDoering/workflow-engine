import { Injectable } from '@nestjs/common';
import { TaskHandler, TaskPayload } from './task-handler.interface';

@Injectable()
export class SendEmailHandler implements TaskHandler {
  async execute(payload: TaskPayload): Promise<TaskPayload> {
    console.log('[SendEmailHandler] Sending email for:', payload);
    await this.delay(300);

    const emailResult = {
      messageId: `msg-${Date.now()}`,
      recipient: `customer-${payload.orderId ?? 'unknown'}@example.com`,
      subject: `Invoice ${payload.invoice?.invoiceId ?? 'N/A'}`,
      sentAt: new Date().toISOString(),
      status: 'sent',
    };

    console.log('[SendEmailHandler] Email sent:', emailResult);
    return { email: emailResult };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
