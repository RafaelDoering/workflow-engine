import { Test, TestingModule } from '@nestjs/testing';
import { WorkerService } from './worker.service';
import { KafkaConsumer } from '@app/core/adapters/kafka.consumer';
import { TaskExecutor } from './task-executor.service';
import { TaskStateService } from './task-state.service';
import { TaskChainService } from './task-chain.service';
import { Task, TaskStatus } from '@app/core/domain/task.entity';
import type { TaskRepositoryPort } from '@app/core/ports/task-repository.port';

describe('WorkerService', () => {
  let service: WorkerService;
  let mockKafkaConsumer: jest.Mocked<KafkaConsumer>;
  let mockTaskExecutor: jest.Mocked<TaskExecutor>;
  let mockTaskState: jest.Mocked<TaskStateService>;
  let mockTaskChain: jest.Mocked<TaskChainService>;
  let mockTaskRepository: jest.Mocked<TaskRepositoryPort>;
  let capturedMessageHandler: (payload: unknown) => Promise<void>;

  beforeEach(async () => {
    mockKafkaConsumer = {
      setMessageHandler: jest.fn(
        (handler: (payload: unknown) => Promise<void>) => {
          capturedMessageHandler = handler;
        },
      ),
      start: jest.fn(),
      onModuleInit: jest.fn(),
      onModuleDestroy: jest.fn(),
    } as unknown as jest.Mocked<KafkaConsumer>;

    mockTaskExecutor = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<TaskExecutor>;

    mockTaskState = {
      markTaskRunning: jest.fn(),
      markTaskSucceeded: jest.fn(),
      markTaskFailed: jest.fn(),
      scheduleRetry: jest.fn(),
      markTaskDeadLetter: jest.fn(),
    } as unknown as jest.Mocked<TaskStateService>;

    mockTaskChain = {
      queueNextTask: jest.fn(),
    } as unknown as jest.Mocked<TaskChainService>;

    mockTaskRepository = {
      saveTask: jest.fn(),
      findByInstanceId: jest.fn(),
      findRetryableTasks: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkerService,
        { provide: KafkaConsumer, useValue: mockKafkaConsumer },
        { provide: TaskExecutor, useValue: mockTaskExecutor },
        { provide: TaskStateService, useValue: mockTaskState },
        { provide: TaskChainService, useValue: mockTaskChain },
        { provide: 'TaskRepository', useValue: mockTaskRepository },
      ],
    }).compile();

    service = module.get<WorkerService>(WorkerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should set message handler and start consumer', async () => {
      await service.onModuleInit();

      expect(mockKafkaConsumer.setMessageHandler).toHaveBeenCalled();
      expect(mockKafkaConsumer.start).toHaveBeenCalled();
    });
  });

  describe('processTask', () => {
    const taskMessage = {
      taskId: 'task-1',
      instanceId: 'instance-1',
      type: 'fetch-orders',
      payload: { orderId: 'ORD-1' },
      attempt: 0,
      maxAttempts: 3,
      idempotencyKey: 'key-1',
      scheduledAt: Date.now(),
    };

    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should process task successfully', async () => {
      const task = new Task(
        'task-1',
        'instance-1',
        'fetch-orders',
        { orderId: 'ORD-1' },
        TaskStatus.PENDING,
        0,
        3,
        null,
        null,
        null,
        null,
        null,
      );
      const result = { orderId: 'ORD-1', orders: [] };

      mockTaskRepository.findByInstanceId.mockResolvedValue([task]);
      mockTaskExecutor.execute.mockResolvedValue(result);

      await capturedMessageHandler(taskMessage);

      expect(mockTaskState.markTaskRunning).toHaveBeenCalledWith(task);
      expect(mockTaskExecutor.execute).toHaveBeenCalledWith(
        'fetch-orders',
        taskMessage.payload,
      );
      expect(mockTaskState.markTaskSucceeded).toHaveBeenCalledWith(task);
      expect(mockTaskChain.queueNextTask).toHaveBeenCalledWith(task, result);
    });

    it('should skip if task not found', async () => {
      mockTaskRepository.findByInstanceId.mockResolvedValue([]);

      await capturedMessageHandler(taskMessage);

      expect(mockTaskState.markTaskRunning).not.toHaveBeenCalled();
    });

    it('should skip if task already succeeded', async () => {
      const task = new Task(
        'task-1',
        'instance-1',
        'fetch-orders',
        { orderId: 'ORD-1' },
        TaskStatus.SUCCEEDED,
        0,
        3,
        null,
        null,
        null,
        null,
        null,
      );

      mockTaskRepository.findByInstanceId.mockResolvedValue([task]);

      await capturedMessageHandler(taskMessage);

      expect(mockTaskState.markTaskRunning).not.toHaveBeenCalled();
    });

    it('should skip if task already failed', async () => {
      const task = new Task(
        'task-1',
        'instance-1',
        'fetch-orders',
        { orderId: 'ORD-1' },
        TaskStatus.FAILED,
        0,
        3,
        null,
        null,
        null,
        null,
        null,
      );

      mockTaskRepository.findByInstanceId.mockResolvedValue([task]);

      await capturedMessageHandler(taskMessage);

      expect(mockTaskState.markTaskRunning).not.toHaveBeenCalled();
    });

    it('should skip if task in dead letter', async () => {
      const task = new Task(
        'task-1',
        'instance-1',
        'fetch-orders',
        { orderId: 'ORD-1' },
        TaskStatus.DEAD_LETTER,
        0,
        3,
        null,
        null,
        null,
        null,
        null,
      );

      mockTaskRepository.findByInstanceId.mockResolvedValue([task]);

      await capturedMessageHandler(taskMessage);

      expect(mockTaskState.markTaskRunning).not.toHaveBeenCalled();
    });

    it('should schedule retry on failure if attempts remaining', async () => {
      const task = new Task(
        'task-1',
        'instance-1',
        'fetch-orders',
        { orderId: 'ORD-1' },
        TaskStatus.PENDING,
        0,
        3,
        null,
        null,
        null,
        null,
        null,
      );
      const error = new Error('Network error');

      mockTaskRepository.findByInstanceId.mockResolvedValue([task]);
      mockTaskExecutor.execute.mockRejectedValue(error);

      await capturedMessageHandler(taskMessage);

      expect(mockTaskState.scheduleRetry).toHaveBeenCalledWith(task, error);
    });

    it('should move to dead letter when max attempts reached', async () => {
      const task = new Task(
        'task-1',
        'instance-1',
        'fetch-orders',
        { orderId: 'ORD-1' },
        TaskStatus.PENDING,
        2,
        3,
        null,
        null,
        null,
        null,
        null,
      );
      const error = new Error('Permanent error');

      mockTaskRepository.findByInstanceId.mockResolvedValue([task]);
      mockTaskExecutor.execute.mockRejectedValue(error);

      await capturedMessageHandler(taskMessage);

      expect(mockTaskState.markTaskDeadLetter).toHaveBeenCalledWith(
        task,
        error,
      );
    });

    it('should handle error when task not found in catch block', async () => {
      const task = new Task(
        'task-1',
        'instance-1',
        'fetch-orders',
        { orderId: 'ORD-1' },
        TaskStatus.PENDING,
        0,
        3,
        null,
        null,
        null,
        null,
        null,
      );
      const error = new Error('Error');

      mockTaskRepository.findByInstanceId
        .mockResolvedValueOnce([task])
        .mockResolvedValueOnce([]);
      mockTaskExecutor.execute.mockRejectedValue(error);

      await capturedMessageHandler(taskMessage);

      expect(mockTaskState.scheduleRetry).not.toHaveBeenCalled();
      expect(mockTaskState.markTaskDeadLetter).not.toHaveBeenCalled();
    });
  });
});
