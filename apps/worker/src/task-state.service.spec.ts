import { Test, TestingModule } from '@nestjs/testing';
import { TaskStateService } from './task-state.service';
import { Task, TaskStatus } from '@app/core/domain/task.entity';
import {
  WorkflowInstance,
  WorkflowInstanceStatus,
} from '@app/core/domain/workflow-instance.entity';
import type { TaskRepositoryPort } from '@app/core/ports/task-repository.port';
import type { WorkflowInstanceRepositoryPort } from '@app/core/ports/workflow-instance-repository.port';

describe('TaskStateService', () => {
  let service: TaskStateService;
  let mockTaskRepository: jest.Mocked<TaskRepositoryPort>;
  let mockInstanceRepository: jest.Mocked<WorkflowInstanceRepositoryPort>;

  beforeEach(async () => {
    mockTaskRepository = {
      saveTask: jest.fn(),
      findByInstanceId: jest.fn(),
      findRetryableTasks: jest.fn(),
    };
    mockInstanceRepository = {
      findWorkflowInstanceById: jest.fn(),
      saveWorkflowInstance: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskStateService,
        { provide: 'TaskRepository', useValue: mockTaskRepository },
        {
          provide: 'WorkflowInstanceRepository',
          useValue: mockInstanceRepository,
        },
      ],
    }).compile();

    service = module.get<TaskStateService>(TaskStateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('markTaskRunning', () => {
    it('should update task status to RUNNING', async () => {
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
    });
  });

  describe('markTaskSucceeded', () => {
    it('should update task status to SUCCEEDED', async () => {
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
      expect(task.finishedAt).toBeInstanceOf(Date);
      expect(mockTaskRepository.saveTask).toHaveBeenCalledWith(task);
    });

    it('should mark workflow SUCCEEDED when all tasks complete', async () => {
      const task = new Task(
        'task-1',
        'instance-1',
        'send-email',
        { orderId: 'ORD-1' },
        TaskStatus.SUCCEEDED,
        0,
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

      mockTaskRepository.findByInstanceId.mockResolvedValue([task]);
      mockInstanceRepository.findWorkflowInstanceById.mockResolvedValue(
        instance,
      );

      await service.markTaskSucceeded(task);

      expect(mockInstanceRepository.saveWorkflowInstance).toHaveBeenCalled();
    });
  });

  describe('scheduleRetry', () => {
    it('should increment attempt and schedule retry', async () => {
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
      expect(task.status).toBe(TaskStatus.PENDING);
      expect(task.lastError).toBe('Network timeout');
      expect(task.scheduledAt).toBeInstanceOf(Date);
      expect(mockTaskRepository.saveTask).toHaveBeenCalledWith(task);
    });
  });

  describe('markTaskFailed', () => {
    it('should mark task and workflow as FAILED', async () => {
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
      expect(task.lastError).toBe('Fatal error');
      expect(instance.status).toBe(WorkflowInstanceStatus.FAILED);
      expect(mockInstanceRepository.saveWorkflowInstance).toHaveBeenCalled();
    });
  });
});
