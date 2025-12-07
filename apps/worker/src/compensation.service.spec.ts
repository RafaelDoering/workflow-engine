import { Test, TestingModule } from '@nestjs/testing';
import { CompensationService } from './compensation.service';
import { TaskExecutor } from './task-executor.service';
import { Task, TaskPayload, TaskStatus } from '@app/core/domain/task.entity';
import {
  WorkflowInstance,
  WorkflowInstanceStatus,
} from '@app/core/domain/workflow-instance.entity';
import { Workflow } from '@app/core/domain/workflow.entity';
import type { TaskRepositoryPort } from '@app/core/ports/task-repository.port';
import type { WorkflowRepositoryPort } from '@app/core/ports/workflow-repository.port';
import type { WorkflowInstanceRepositoryPort } from '@app/core/ports/workflow-instance-repository.port';
import type { TaskLogRepositoryPort } from '@app/core/ports/task-log-repository.port';

describe('CompensationService', () => {
  let service: CompensationService;
  let mockTaskRepository: jest.Mocked<TaskRepositoryPort>;
  let mockWorkflowRepository: jest.Mocked<WorkflowRepositoryPort>;
  let mockInstanceRepository: jest.Mocked<WorkflowInstanceRepositoryPort>;
  let mockTaskLogRepository: jest.Mocked<TaskLogRepositoryPort>;
  let mockTaskExecutor: jest.Mocked<TaskExecutor>;

  beforeEach(async () => {
    mockTaskRepository = {
      saveTask: jest.fn(),
      findByInstanceId: jest.fn(),
      findRetryableTasks: jest.fn(),
    };
    mockWorkflowRepository = {
      findWorkflowById: jest.fn(),
      saveWorkflow: jest.fn(),
      findAllWorkflows: jest.fn(),
    };
    mockInstanceRepository = {
      findWorkflowInstanceById: jest.fn(),
      saveWorkflowInstance: jest.fn(),
      findByWorkflowId: jest.fn(),
      findByStatus: jest.fn(),
    };
    mockTaskLogRepository = {
      createLog: jest.fn(),
    };
    mockTaskExecutor = {
      execute: jest.fn(),
      compensate: jest.fn(),
    } as unknown as jest.Mocked<TaskExecutor>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompensationService,
        { provide: 'TaskRepository', useValue: mockTaskRepository },
        { provide: 'WorkflowRepository', useValue: mockWorkflowRepository },
        {
          provide: 'WorkflowInstanceRepository',
          useValue: mockInstanceRepository,
        },
        { provide: 'TaskLogRepository', useValue: mockTaskLogRepository },
        { provide: TaskExecutor, useValue: mockTaskExecutor },
      ],
    }).compile();

    service = module.get<CompensationService>(CompensationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('compensateWorkflow', () => {
    const instanceId = 'instance-1';
    const workflowId = 'workflow-1';

    const instance = new WorkflowInstance(
      instanceId,
      workflowId,
      WorkflowInstanceStatus.FAILED,
      new Date(),
      new Date(),
    );

    const workflow = new Workflow(
      workflowId,
      'Invoice Workflow',
      {
        steps: ['fetch-orders', 'create-invoice', 'pdf-process', 'send-email'],
      },
      new Date(),
      new Date(),
    );

    it('should return early if instance not found', async () => {
      mockInstanceRepository.findWorkflowInstanceById.mockResolvedValue(null);

      await service.compensateWorkflow(instanceId);

      expect(mockTaskRepository.findByInstanceId).not.toHaveBeenCalled();
    });

    it('should return early if workflow not found', async () => {
      mockInstanceRepository.findWorkflowInstanceById.mockResolvedValue(
        instance,
      );
      mockWorkflowRepository.findWorkflowById.mockResolvedValue(null);

      await service.compensateWorkflow(instanceId);

      expect(mockTaskRepository.findByInstanceId).not.toHaveBeenCalled();
    });

    it('should compensate all succeeded tasks in reverse order', async () => {
      const task1 = new Task(
        'task-1',
        instanceId,
        'fetch-orders',
        { orderId: 'ORD-1' },
        TaskStatus.SUCCEEDED,
        0,
        3,
        'key-1',
        new Date(),
        new Date(),
        null,
        new Date(),
        null,
        null,
        0,
      );

      const task2 = new Task(
        'task-2',
        instanceId,
        'create-invoice',
        { orderId: 'ORD-1', orders: [] },
        TaskStatus.SUCCEEDED,
        0,
        3,
        'key-2',
        new Date(),
        new Date(),
        null,
        new Date(),
        null,
        null,
        0,
      );

      const task3 = new Task(
        'task-3',
        instanceId,
        'pdf-process',
        {
          orderId: 'ORD-1',
          invoice: {
            invoiceId: 'INV-1',
            customerId: 'CUST-1',
            total: 100,
            createdAt: new Date().toISOString(),
          },
        },
        TaskStatus.SUCCEEDED,
        0,
        3,
        'key-3',
        new Date(),
        new Date(),
        null,
        new Date(),
        null,
        null,
        0,
      );

      mockInstanceRepository.findWorkflowInstanceById.mockResolvedValue(
        instance,
      );
      mockWorkflowRepository.findWorkflowById.mockResolvedValue(workflow);
      mockTaskRepository.findByInstanceId.mockResolvedValue([
        task1,
        task2,
        task3,
      ]);
      mockTaskExecutor.compensate.mockResolvedValue();

      await service.compensateWorkflow(instanceId);

      expect(mockTaskExecutor.compensate).toHaveBeenCalledTimes(3);
      expect(mockTaskExecutor.compensate).toHaveBeenNthCalledWith(
        1,
        'pdf-process',
        task3.payload,
      );
      expect(mockTaskExecutor.compensate).toHaveBeenNthCalledWith(
        2,
        'create-invoice',
        task2.payload,
      );
      expect(mockTaskExecutor.compensate).toHaveBeenNthCalledWith(
        3,
        'fetch-orders',
        task1.payload,
      );
    });

    it('should only compensate succeeded tasks', async () => {
      const succeededTask = new Task(
        'task-1',
        instanceId,
        'create-invoice',
        { orderId: 'ORD-1' },
        TaskStatus.SUCCEEDED,
        0,
        3,
        'key-1',
        new Date(),
        new Date(),
        null,
        new Date(),
        null,
        null,
        0,
      );

      const pendingTask = new Task(
        'task-2',
        instanceId,
        'pdf-process',
        { orderId: 'ORD-1' },
        TaskStatus.PENDING,
        0,
        3,
        'key-2',
        new Date(),
        null,
        null,
        null,
        null,
      );

      const failedTask = new Task(
        'task-3',
        instanceId,
        'send-email',
        { orderId: 'ORD-1' },
        TaskStatus.FAILED,
        0,
        3,
        'key-3',
        new Date(),
        new Date(),
        null,
        new Date(),
        'Error',
        null,
        0,
        3,
      );

      mockInstanceRepository.findWorkflowInstanceById.mockResolvedValue(
        instance,
      );
      mockWorkflowRepository.findWorkflowById.mockResolvedValue(workflow);
      mockTaskRepository.findByInstanceId.mockResolvedValue([
        succeededTask,
        pendingTask,
        failedTask,
      ]);
      mockTaskExecutor.compensate.mockResolvedValue();

      await service.compensateWorkflow(instanceId);

      expect(mockTaskExecutor.compensate).toHaveBeenCalledTimes(1);
      expect(mockTaskExecutor.compensate).toHaveBeenCalledWith(
        'create-invoice',
        succeededTask.payload,
      );
    });

    it('should stop compensation and mark instance as DEAD_LETTER when task reaches DEAD_LETTER', async () => {
      const task1 = new Task(
        'task-1',
        instanceId,
        'create-invoice',
        { orderId: 'ORD-1' },
        TaskStatus.SUCCEEDED,
        0,
        3,
        'key-1',
        new Date(),
        new Date(),
        null,
        new Date(),
        null,
        null,
        0,
      );

      const task2 = new Task(
        'task-2',
        instanceId,
        'pdf-process',
        { orderId: 'ORD-1' },
        TaskStatus.SUCCEEDED,
        0,
        3,
        'key-2',
        new Date(),
        new Date(),
        null,
        new Date(),
        null,
        null,
        0,
      );

      mockInstanceRepository.findWorkflowInstanceById.mockResolvedValue(
        instance,
      );
      mockWorkflowRepository.findWorkflowById.mockResolvedValue(workflow);
      mockTaskRepository.findByInstanceId.mockResolvedValue([task1, task2]);
      mockTaskExecutor.compensate.mockRejectedValue(
        new Error('Compensation failed'),
      );
      jest.useFakeTimers();

      const resultPromise = service.compensateWorkflow(instanceId);

      for (let i = 0; i < 3; i++) {
        await jest.runAllTimersAsync();
      }

      await resultPromise;

      expect(mockTaskExecutor.compensate).toHaveBeenCalledTimes(3);
      expect(mockTaskExecutor.compensate).toHaveBeenCalledWith(
        'pdf-process',
        task2.payload,
      );
      expect(mockTaskRepository.saveTask).toHaveBeenCalledWith(
        expect.objectContaining({
          id: task2.id,
          status: TaskStatus.DEAD_LETTER,
        }),
      );
      expect(instance.status).toBe(WorkflowInstanceStatus.DEAD_LETTER);
      expect(mockInstanceRepository.saveWorkflowInstance).toHaveBeenCalledWith(
        instance,
      );
      expect(mockTaskExecutor.compensate).not.toHaveBeenCalledWith(
        'create-invoice',
        task1.payload,
      );

      jest.useRealTimers();
    });

    it('should return early if no succeeded tasks', async () => {
      const pendingTask = new Task(
        'task-1',
        instanceId,
        'create-invoice',
        { orderId: 'ORD-1' },
        TaskStatus.PENDING,
        0,
        3,
        'key-1',
        new Date(),
        null,
        null,
        null,
        null,
      );

      mockInstanceRepository.findWorkflowInstanceById.mockResolvedValue(
        instance,
      );
      mockWorkflowRepository.findWorkflowById.mockResolvedValue(workflow);
      mockTaskRepository.findByInstanceId.mockResolvedValue([pendingTask]);

      await service.compensateWorkflow(instanceId);

      expect(mockTaskExecutor.compensate).not.toHaveBeenCalled();
    });
  });

  describe('compensateTask', () => {
    let task: Task;

    beforeEach(() => {
      task = new Task(
        'task-1',
        'instance-1',
        'create-invoice',
        {
          orderId: 'ORD-1',
          invoice: {
            invoiceId: 'INV-1',
            customerId: 'CUST-1',
            total: 100,
            createdAt: new Date().toISOString(),
          },
        },
        TaskStatus.SUCCEEDED,
        0,
        3,
        'key-1',
        new Date(),
        new Date(),
        null,
        new Date(),
        null,
        null,
        0,
        3,
      );
    });

    it('should mark task as compensating and then compensated', async () => {
      task.compensationAttempt = 0;
      mockTaskExecutor.compensate.mockResolvedValue();

      const result = await service.compensateTask(task);

      expect(result).toBe('SUCCESS');
      expect(task.status).toBe(TaskStatus.COMPENSATED);
      expect(task.compensatedAt).toBeInstanceOf(Date);
      expect(task.compensationAttempt).toBe(0);
      expect(mockTaskRepository.saveTask).toHaveBeenCalled();
      expect(mockTaskLogRepository.createLog).toHaveBeenCalledWith(
        task.id,
        'INFO',
        expect.stringContaining('Starting compensation attempt'),
      );
      expect(mockTaskLogRepository.createLog).toHaveBeenCalledWith(
        task.id,
        'INFO',
        'Compensation completed successfully',
      );
      expect(mockTaskExecutor.compensate).toHaveBeenCalledWith(
        'create-invoice',
        task.payload,
      );
    });

    it('should retry compensation up to 3 times before marking as DEAD_LETTER', async () => {
      task.compensationAttempt = 0;
      const error = new Error('Compensation failed');
      mockTaskExecutor.compensate.mockRejectedValue(error);
      jest.useFakeTimers();

      const resultPromise = service.compensateTask(task);

      for (let i = 0; i < 3; i++) {
        await jest.runAllTimersAsync();
      }

      const result = await resultPromise;

      expect(result).toBe('DEAD_LETTER');
      expect(task.status).toBe(TaskStatus.DEAD_LETTER);
      expect(task.compensationAttempt).toBe(3);
      expect(task.lastError).toContain('Compensation failed after 3 attempts');
      expect(mockTaskExecutor.compensate).toHaveBeenCalledTimes(3);
      expect(mockTaskLogRepository.createLog).toHaveBeenCalledWith(
        task.id,
        'ERROR',
        expect.stringContaining('marked as DEAD_LETTER'),
      );

      jest.useRealTimers();
    });

    it('should succeed on retry after initial failure', async () => {
      const error = new Error('Compensation failed');
      mockTaskExecutor.compensate
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce();
      jest.useFakeTimers();

      // Reset compensation attempt for this test
      task.compensationAttempt = 0;

      const resultPromise = service.compensateTask(task);

      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result).toBe('SUCCESS');
      expect(task.status).toBe(TaskStatus.COMPENSATED);
      expect(mockTaskExecutor.compensate).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should use saved result for compensation when available', async () => {
      const savedResult: TaskPayload = {
        orderId: 'ORD-1',
        invoice: {
          invoiceId: 'INV-123',
          customerId: 'CUST-1',
          total: 200,
          createdAt: new Date().toISOString(),
        },
        pdf: {
          pdfUrl: 'https://example.com/invoice.pdf',
          size: 1024,
          generatedAt: new Date().toISOString(),
        },
      };
      task.result = savedResult;
      task.compensationAttempt = 0;
      mockTaskExecutor.compensate.mockResolvedValue();

      await service.compensateTask(task);

      // Should use the saved result, not the original payload
      expect(mockTaskExecutor.compensate).toHaveBeenCalledWith(
        'create-invoice',
        savedResult,
      );
      expect(mockTaskExecutor.compensate).not.toHaveBeenCalledWith(
        'create-invoice',
        task.payload,
      );
    });
  });
});
