import { Test, TestingModule } from '@nestjs/testing';
import { WorkerService } from './worker.service';
import { TaskExecutor } from './task-executor.service';
import { TaskStateService } from './task-state.service';
import { TaskChainService } from './task-chain.service';
import { Task, TaskStatus } from '@app/core/domain/task.entity';
import type { TaskRepositoryPort } from '@app/core/ports/task-repository.port';
import type { TaskQueuePort } from '@app/core/ports/task-queue.port';

describe('WorkerService', () => {
  let service: WorkerService;
  let mockTaskQueue: jest.Mocked<TaskQueuePort>;
  let mockTaskExecutor: jest.Mocked<TaskExecutor>;
  let mockTaskState: jest.Mocked<TaskStateService>;
  let mockTaskChain: jest.Mocked<TaskChainService>;
  let mockTaskRepository: jest.Mocked<TaskRepositoryPort>;
  let capturedMessageHandler: (payload: Task) => Promise<void>;

  beforeEach(async () => {
    mockTaskQueue = {
      consume: jest.fn((handler: (payload: Task) => Promise<void>) => {
        capturedMessageHandler = handler;
        return Promise.resolve();
      }),
      publish: jest.fn(),
    } as unknown as jest.Mocked<TaskQueuePort>;

    mockTaskExecutor = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<TaskExecutor>;

    mockTaskState = {
      markTaskRunning: jest.fn(),
      markTaskSucceeded: jest.fn(),
      markTaskFailed: jest.fn(),
      scheduleRetry: jest.fn(),
      markTaskDeadLetter: jest.fn(),
      checkWorkflowCompletion: jest.fn(),
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
        { provide: 'TaskQueuePort', useValue: mockTaskQueue },
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
    it('should set consume handler', async () => {
      await service.onModuleInit();

      expect(mockTaskQueue.consume).toHaveBeenCalled();
    });
  });

  describe('processTask', () => {
    const taskMessage = new Task(
      'task-1',
      'instance-1',
      'fetch-orders',
      { orderId: 'ORD-1' },
      TaskStatus.PENDING,
      0,
      3,
      'key-1',
      new Date(),
      null,
      null,
      null,
    );

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
        '123',
        new Date(),
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
      expect(mockTaskState.checkWorkflowCompletion).toHaveBeenCalledWith(
        task.instanceId,
      );
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
        '123',
        new Date(),
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
        '123',
        new Date(),
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
        '123',
        new Date(),
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
        '123',
        new Date(),
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
        '123',
        new Date(),
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
        '123',
        new Date(),
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
