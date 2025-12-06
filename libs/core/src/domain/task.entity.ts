import {
  IsString,
  IsNumber,
  IsArray,
  ValidateNested,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TaskOrder {
  @IsNumber()
  id: number;

  @IsNumber()
  amount: number;

  @IsNumber()
  items: number;
}

export class TaskInvoice {
  @IsString()
  invoiceId: string;

  @IsString()
  customerId: string;

  @IsNumber()
  total: number;

  @IsDateString()
  createdAt: string;
}

export class TaskPdf {
  @IsString()
  pdfUrl: string;

  @IsNumber()
  size: number;

  @IsDateString()
  generatedAt: string;
}

export class TaskEmail {
  @IsString()
  messageId: string;

  @IsString()
  recipient: string;

  @IsString()
  subject: string;

  @IsDateString()
  sentAt: string;

  @IsString()
  status: string;
}

export class TaskPayload {
  @IsString()
  @IsOptional()
  orderId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskOrder)
  @IsOptional()
  orders?: TaskOrder[];

  @ValidateNested()
  @Type(() => TaskInvoice)
  @IsOptional()
  invoice?: TaskInvoice;

  @ValidateNested()
  @Type(() => TaskPdf)
  @IsOptional()
  pdf?: TaskPdf;

  @ValidateNested()
  @Type(() => TaskEmail)
  @IsOptional()
  email?: TaskEmail;
}

export enum TaskStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  DEAD_LETTER = 'DEAD_LETTER',
}

export class Task {
  constructor(
    public readonly id: string,
    public readonly instanceId: string,
    public readonly type: string,
    public readonly payload: TaskPayload,
    public status: TaskStatus,
    public attempt: number,
    public readonly maxAttempts: number,
    public readonly idempotencyKey: string,
    public scheduledAt: Date,
    public startedAt: Date | null,
    public finishedAt: Date | null,
    public lastError: string | null,
  ) {}
}
