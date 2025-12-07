import { Injectable } from '@nestjs/common';
import { TaskPayload } from '@app/core/domain/task.entity';
import { TaskHandler } from './task-handler.interface';

@Injectable()
export class SendEmailHandler implements TaskHandler {
  async execute(payload: TaskPayload): Promise<TaskPayload> {
    console.log('[SendEmailHandler] Sending email for:', payload);
    await this.delay(300);

    const email = {
      messageId: `msg-${Date.now()}`,
      recipient: `customer-${payload.orderId ?? 'unknown'}@example.com`,
      subject: `Invoice ${payload.invoice?.invoiceId ?? 'N/A'}`,
      sentAt: new Date().toISOString(),
      status: 'sent',
    };

    console.log('[SendEmailHandler] Email sent:', email);
    return { ...payload, email };
  }

  async compensate(payload: TaskPayload): Promise<void> {
    if (!payload.email?.messageId) {
      console.log('[SendEmailHandler] No email to compensate');
      return;
    }

    console.log(
      `[SendEmailHandler] Compensating: Sending cancellation email for ${payload.email.messageId}`,
    );
    await this.delay(300);

    console.log(
      `[SendEmailHandler] Compensation complete: Cancellation email sent for ${payload.email.messageId}`,
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
