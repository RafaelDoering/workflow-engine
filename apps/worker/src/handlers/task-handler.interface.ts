export type Invoice = {
  invoiceId: string;
  customerId: string;
  total: number;
  createdAt: string;
};

export type Order = {
  id: number;
  amount: number;
  items: number;
};

export type Pdf = {
  pdfUrl: string;
  size: number;
  generatedAt: string;
};

export type Email = {
  messageId: string;
  recipient: string;
  subject: string;
  sentAt: string;
  status: string;
};

export interface TaskPayload {
  orderId?: string;
  invoice?: Invoice;
  orders?: Order[];
  pdf?: Pdf;
  email?: Email;
}

export interface TaskHandler {
  execute(payload: TaskPayload): Promise<TaskPayload>;
}
