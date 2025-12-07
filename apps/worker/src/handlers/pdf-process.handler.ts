import { Injectable } from '@nestjs/common';
import { TaskPayload } from '@app/core/domain/task.entity';
import { TaskHandler } from './task-handler.interface';

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
    return { ...payload, pdf };
  }

  async compensate(payload: TaskPayload): Promise<void> {
    if (!payload.pdf?.pdfUrl) {
      console.log('[PdfProcessHandler] No PDF to compensate');
      return;
    }

    console.log(
      `[PdfProcessHandler] Compensating: Deleting PDF ${payload.pdf.pdfUrl}`,
    );
    await this.delay(300);

    console.log(
      `[PdfProcessHandler] Compensation complete: PDF ${payload.pdf.pdfUrl} deleted`,
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
