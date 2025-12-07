import { Test, TestingModule } from '@nestjs/testing';
import { TaskExecutor } from './task-executor.service';
import { FetchOrdersHandler } from './handlers/fetch-orders.handler';
import { CreateInvoiceHandler } from './handlers/create-invoice.handler';
import { PdfProcessHandler } from './handlers/pdf-process.handler';
import { SendEmailHandler } from './handlers/send-email.handler';

describe('TaskExecutor', () => {
  let executor: TaskExecutor;
  let fetchOrdersHandler: FetchOrdersHandler;
  let createInvoiceHandler: CreateInvoiceHandler;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        TaskExecutor,
        FetchOrdersHandler,
        CreateInvoiceHandler,
        PdfProcessHandler,
        SendEmailHandler,
      ],
    }).compile();

    executor = module.get<TaskExecutor>(TaskExecutor);
    fetchOrdersHandler = module.get<FetchOrdersHandler>(FetchOrdersHandler);
    createInvoiceHandler =
      module.get<CreateInvoiceHandler>(CreateInvoiceHandler);
  });

  it('should be defined', () => {
    expect(executor).toBeDefined();
  });

  describe('execute', () => {
    it('should execute fetch-orders handler', async () => {
      const payload = { orderId: 'ORD-123' };
      const spy = jest.spyOn(fetchOrdersHandler, 'execute');

      await executor.execute('fetch-orders', payload);

      expect(spy).toHaveBeenCalledWith(payload);
    });

    it('should throw error for unknown task type', async () => {
      await expect(executor.execute('unknown-task', {})).rejects.toThrow(
        'No handler found for task type: unknown-task',
      );
    });

    it('should return result with orders from fetch-orders handler', async () => {
      const payload = { orderId: 'ORD-123' };
      const result = await executor.execute('fetch-orders', payload);

      expect(result).toHaveProperty('orders');
      expect(Array.isArray(result.orders)).toBe(true);
    });

    it('should execute create-invoice handler', async () => {
      const payload = {
        orderId: 'ORD-123',
        orders: [{ id: 1, amount: 100, items: 2 }],
      };
      const result = await executor.execute('create-invoice', payload);

      expect(result).toHaveProperty('invoice');
      expect(result.invoice).toHaveProperty('invoiceId');
    });
  });

  describe('compensate', () => {
    it('should call compensate on create-invoice handler', async () => {
      const payload = {
        orderId: 'ORD-123',
        invoice: {
          invoiceId: 'INV-1',
          customerId: 'CUST-1',
          total: 100,
          createdAt: new Date().toISOString(),
        },
      };
      const spy = jest.spyOn(createInvoiceHandler, 'compensate');

      await executor.compensate('create-invoice', payload);

      expect(spy).toHaveBeenCalledWith(payload);
    });

    it('should throw error for unknown task type', async () => {
      await expect(executor.compensate('unknown-task', {})).rejects.toThrow(
        'No handler found for task type: unknown-task',
      );
    });
  });
});
