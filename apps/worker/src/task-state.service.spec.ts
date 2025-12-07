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
import { CompensationService } from './compensation.service';

describe('TaskStateService', () => {
  let service: TaskStateService;
  let mockTaskRepository: jest.Mocked<TaskRepositoryPort>;
  let mockInstanceRepository: jest.Mocked<WorkflowInstanceRepositoryPort>;
  let mockTaskLogRepository: jest.Mocked<TaskLogRepositoryPort>;
  let mockCompensationService: jest.Mocked<CompensationService>;

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
      findByStatus: jest.fn(),
    };
    mockTaskLogRepository = {
      createLog: jest.fn(),
    };
    mockCompensationService = {
      compensateWorkflow: jest.fn(),
      compensateTask: jest.fn(),
    } as unknown as jest.Mocked<CompensationService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskStateService,
        { provide: 'TaskRepository', useValue: mockTaskRepository },
        {
          provide: 'WorkflowInstanceRepository',
          useValue: mockInstanceRepository,
        },
        { provide: 'TaskLogRepository', useValue: mockTaskLogRepository },
        { provide: CompensationService, useValue: mockCompensationService },
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
        '123',
        new Date(),
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
        '123',
        new Date(),
        new Date(),
        null,
        null,
        null,
      );

      mockTaskRepository.findByInstanceId.mockResolvedValue([task]);
      const result = { orderId: 'ORD-1', orders: [] };

      await service.markTaskSucceeded(task, result);

      expect(task.status).toBe(TaskStatus.SUCCEEDED);
      expect(task.result).toBe(result);
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
        '123',
        new Date(),
        new Date(),
        null,
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
        '123',
        new Date(),
        new Date(),
        null,
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

  describe('markTaskDeadLetter', () => {
    it('should mark task DEAD_LETTER and log', async () => {
      const task = new Task(
        'task-1',
        'instance-1',
        'fetch-orders',
        { orderId: 'ORD-1' },
        TaskStatus.RUNNING,
        2,
        3,
        '123',
        new Date(),
        new Date(),
        null,
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
      mockCompensationService.compensateWorkflow.mockResolvedValue();

      await service.markTaskDeadLetter(task, new Error('Permanent failure'));

      expect(task.status).toBe(TaskStatus.DEAD_LETTER);
      expect(task.finishedAt).toBeInstanceOf(Date);
      expect(mockTaskLogRepository.createLog).toHaveBeenCalledWith(
        task.id,
        'ERROR',
        expect.stringContaining('dead letter'),
      );
      expect(instance.status).toBe(WorkflowInstanceStatus.FAILED);
      expect(mockInstanceRepository.saveWorkflowInstance).toHaveBeenCalled();
      expect(mockCompensationService.compensateWorkflow).toHaveBeenCalledWith(
        task.instanceId,
      );
    });
  });
  describe('checkWorkflowCompletion', () => {
    it('should mark workflow SUCCEEDED if all tasks succeeded', async () => {
      const task1 = new Task(
        'task-1',
        'instance-1',
        'fetch-orders',
        { orderId: 'ORD-1' },
        TaskStatus.SUCCEEDED,
        0,
        3,
        '123',
        new Date(),
        new Date(),
        null,
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

      mockTaskRepository.findByInstanceId.mockResolvedValue([task1]);
      mockInstanceRepository.findWorkflowInstanceById.mockResolvedValue(
        instance,
      );

      await service.checkWorkflowCompletion('instance-1');

      expect(instance.status).toBe(WorkflowInstanceStatus.SUCCEEDED);
      expect(mockInstanceRepository.saveWorkflowInstance).toHaveBeenCalledWith(
        instance,
      );
    });

    it('should NOT mark workflow SUCCEEDED if any task is not succeeded', async () => {
      const task1 = new Task(
        'task-1',
        'instance-1',
        'fetch-orders',
        { orderId: 'ORD-1' },
        TaskStatus.SUCCEEDED,
        0,
        3,
        '123',
        new Date(),
        new Date(),
        null,
        null,
        null,
      );
      const task2 = new Task(
        'task-2',
        'instance-1',
        'create-invoice',
        { orderId: 'ORD-1' },
        TaskStatus.PENDING,
        0,
        3,
        '124',
        new Date(),
        null,
        null,
        null,
        null,
      );

      mockTaskRepository.findByInstanceId.mockResolvedValue([task1, task2]);

      await service.checkWorkflowCompletion('instance-1');

      expect(
        mockInstanceRepository.saveWorkflowInstance,
      ).not.toHaveBeenCalled();
    });
  });
});
