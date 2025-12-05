import { Test, TestingModule } from '@nestjs/testing';
import { RetryScheduler } from './retry-scheduler.service';
import { Task, TaskStatus } from '@app/core/domain/task.entity';
import type { TaskRepositoryPort } from '@app/core/ports/task-repository.port';
import type { QueuePort } from '@app/core/ports/queue.port';

describe('RetryScheduler', () => {
  let scheduler: RetryScheduler;
  let mockTaskRepository: jest.Mocked<TaskRepositoryPort>;
  let mockQueue: jest.Mocked<QueuePort>;

  beforeEach(async () => {
    mockTaskRepository = {
      saveTask: jest.fn(),
      findByInstanceId: jest.fn(),
      findRetryableTasks: jest.fn(),
    };
    mockQueue = { publish: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetryScheduler,
        { provide: 'TaskRepository', useValue: mockTaskRepository },
        { provide: 'QueuePort', useValue: mockQueue },
      ],
    }).compile();

    scheduler = module.get<RetryScheduler>(RetryScheduler);
  });

  it('should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  describe('pollRetryableTasks', () => {
    it('should re-queue retryable tasks', async () => {
      const retryableTask = new Task(
        'task-1',
        'instance-1',
        'fetch-orders',
        { orderId: 'ORD-1' },
        TaskStatus.PENDING,
        1,
        3,
        'key-1',
        new Date(Date.now() - 1000),
        null,
        null,
        'Previous error',
      );

      mockTaskRepository.findRetryableTasks.mockResolvedValue([retryableTask]);

      await scheduler.pollRetryableTasks();

      expect(mockQueue.publish).toHaveBeenCalledWith(
        'task-queue',
        expect.objectContaining({
          taskId: 'task-1',
          type: 'fetch-orders',
          attempt: 1,
        }),
      );
      expect(retryableTask.scheduledAt).toBeNull();
      expect(mockTaskRepository.saveTask).toHaveBeenCalledWith(retryableTask);
    });

    it('should not call publish when no retryable tasks', async () => {
      mockTaskRepository.findRetryableTasks.mockResolvedValue([]);

      await scheduler.pollRetryableTasks();

      expect(mockQueue.publish).not.toHaveBeenCalled();
    });

    it('should process multiple retryable tasks', async () => {
      const tasks = [
        new Task(
          'task-1',
          'inst-1',
          'fetch-orders',
          { orderId: 'O1' },
          TaskStatus.PENDING,
          1,
          3,
          null,
          new Date(Date.now() - 1000),
          null,
          null,
          null,
        ),
        new Task(
          'task-2',
          'inst-2',
          'create-invoice',
          { orderId: 'O2' },
          TaskStatus.PENDING,
          2,
          3,
          null,
          new Date(Date.now() - 2000),
          null,
          null,
          null,
        ),
      ];

      mockTaskRepository.findRetryableTasks.mockResolvedValue(tasks);

      await scheduler.pollRetryableTasks();

      expect(mockQueue.publish).toHaveBeenCalledTimes(2);
      expect(mockTaskRepository.saveTask).toHaveBeenCalledTimes(2);
    });
  });
});
