import { Injectable } from '@nestjs/common';
import { TaskHandler, TaskPayload } from './task-handler.interface';

@Injectable()
export class PdfProcessHandler implements TaskHandler {
  async execute(payload: TaskPayload): Promise<TaskPayload> {
    console.log('[PdfProcessHandler] Generating PDF for:', payload);
    await this.delay(600);

    const pdf = {
      pdfUrl: `https://storage.example.com/invoices/${payload.invoice?.invoiceId ?? 'unknown'}.pdf`,
      size: Math.floor(Math.random() * 500) + 100,
      generatedAt: new Date().toISOString(),
    };

    console.log('[PdfProcessHandler] Generated PDF:', pdf);
    return { pdf };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
