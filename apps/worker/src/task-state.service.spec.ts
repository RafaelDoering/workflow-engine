import { Test, TestingModule } from '@nestjs/testing';
import { TaskStateService } from './task-state.service';
import { Task, TaskStatus } from '@app/core/domain/task.entity';
import {
  WorkflowInstance,
  WorkflowInstanceStatus,
} from '@app/core/domain/workflow-instance.entity';
import type { TaskRepositoryPort } from '@app/core/ports/task-repository.port';
import type { WorkflowInstanceRepositoryPort } from '@app/core/ports/workflow-instance-repository.port';
import type { TaskLogRepositoryPort } from '@app/core/ports/task-log-repository.port';

describe('TaskStateService', () => {
  let service: TaskStateService;
  let mockTaskRepository: jest.Mocked<TaskRepositoryPort>;
  let mockInstanceRepository: jest.Mocked<WorkflowInstanceRepositoryPort>;
  let mockTaskLogRepository: jest.Mocked<TaskLogRepositoryPort>;

  beforeEach(async () => {
    mockTaskRepository = {
      saveTask: jest.fn(),
      findByInstanceId: jest.fn(),
      findRetryableTasks: jest.fn(),
    };
    mockInstanceRepository = {
      findWorkflowInstanceById: jest.fn(),
      saveWorkflowInstance: jest.fn(),
      findByWorkflowId: jest.fn(),
    };
    mockTaskLogRepository = {
      createLog: jest.fn(),
      findByTaskId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskStateService,
        { provide: 'TaskRepository', useValue: mockTaskRepository },
        {
          provide: 'WorkflowInstanceRepository',
          useValue: mockInstanceRepository,
        },
        { provide: 'TaskLogRepository', useValue: mockTaskLogRepository },
      ],
    }).compile();

    service = module.get<TaskStateService>(TaskStateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('markTaskRunning', () => {
    it('should update task status to RUNNING and log', async () => {
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

      await service.markTaskRunning(task);

      expect(task.status).toBe(TaskStatus.RUNNING);
      expect(task.startedAt).toBeInstanceOf(Date);
      expect(mockTaskRepository.saveTask).toHaveBeenCalledWith(task);
      expect(mockTaskLogRepository.createLog).toHaveBeenCalledWith(
        task.id,
        'INFO',
        expect.stringContaining('started'),
      );
    });
  });

  describe('markTaskSucceeded', () => {
    it('should update task status to SUCCEEDED and log', async () => {
      const task = new Task(
        'task-1',
        'instance-1',
        'fetch-orders',
        { orderId: 'ORD-1' },
        TaskStatus.RUNNING,
        0,
        3,
        null,
        null,
        new Date(),
        null,
        null,
      );

      mockTaskRepository.findByInstanceId.mockResolvedValue([task]);

      await service.markTaskSucceeded(task);

      expect(task.status).toBe(TaskStatus.SUCCEEDED);
      expect(mockTaskLogRepository.createLog).toHaveBeenCalledWith(
        task.id,
        'INFO',
        'Task succeeded',
      );
    });
  });

  describe('scheduleRetry', () => {
    it('should increment attempt and log', async () => {
      const task = new Task(
        'task-1',
        'instance-1',
        'fetch-orders',
        { orderId: 'ORD-1' },
        TaskStatus.RUNNING,
        1,
        3,
        null,
        null,
        new Date(),
        null,
        null,
      );

      await service.scheduleRetry(task, new Error('Network timeout'));

      expect(task.attempt).toBe(2);
      expect(mockTaskLogRepository.createLog).toHaveBeenCalledWith(
        task.id,
        'WARN',
        expect.stringContaining('retry'),
      );
    });
  });

  describe('markTaskFailed', () => {
    it('should mark task FAILED and log error', async () => {
      const task = new Task(
        'task-1',
        'instance-1',
        'fetch-orders',
        { orderId: 'ORD-1' },
        TaskStatus.RUNNING,
        2,
        3,
        null,
        null,
        new Date(),
        null,
        null,
      );

      const instance = new WorkflowInstance(
        'instance-1',
        'workflow-1',
        WorkflowInstanceStatus.RUNNING,
        new Date(),
        new Date(),
      );

      mockInstanceRepository.findWorkflowInstanceById.mockResolvedValue(
        instance,
      );

      await service.markTaskFailed(task, new Error('Fatal error'));

      expect(task.status).toBe(TaskStatus.FAILED);
      expect(mockTaskLogRepository.createLog).toHaveBeenCalledWith(
        task.id,
        'ERROR',
        expect.stringContaining('Fatal error'),
      );
    });
  });
});
