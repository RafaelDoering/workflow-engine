import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowService } from './workflow.service';
import {
  WorkflowInstance,
  WorkflowInstanceStatus,
} from '@app/core/domain/workflow-instance.entity';
import { Task, TaskStatus } from '@app/core/domain/task.entity';
import type { WorkflowInstanceRepositoryPort } from '@app/core/ports/workflow-instance-repository.port';
import type { TaskRepositoryPort } from '@app/core/ports/task-repository.port';
import type { QueuePort } from '@app/core/ports/queue.port';

describe('WorkflowService', () => {
  let service: WorkflowService;
  let mockInstanceRepository: WorkflowInstanceRepositoryPort;
  let mockInstanceRepositorySaveWorkflowInstance: jest.Mock;
  let mockTaskRepository: TaskRepositoryPort;
  let mockTaskRepositorySaveTask: jest.Mock;
  let mockQueue: QueuePort;
  let mockQueuePublish: jest.Mock;
  const payload = { orderId: '123' };

  beforeEach(async () => {
    mockInstanceRepositorySaveWorkflowInstance = jest.fn();
    mockInstanceRepository = {
      saveWorkflowInstance: mockInstanceRepositorySaveWorkflowInstance,
      findWorkflowInstanceById: jest.fn(),
      findByWorkflowId: jest.fn(),
    };

    mockTaskRepositorySaveTask = jest.fn();
    mockTaskRepository = {
      saveTask: mockTaskRepositorySaveTask,
      findByInstanceId: jest.fn(),
      findRetryableTasks: jest.fn(),
    };

    mockQueuePublish = jest.fn();
    mockQueue = {
      publish: mockQueuePublish,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowService,
        {
          provide: 'WorkflowInstanceRepository',
          useValue: mockInstanceRepository,
        },
        {
          provide: 'TaskRepository',
          useValue: mockTaskRepository,
        },
        {
          provide: 'QueuePort',
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<WorkflowService>(WorkflowService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('startWorkflow', () => {
    it('should create workflow instance, task, and publish to queue', async () => {
      const workflowId = 'workflow-123';
      const payload = { orderId: 'order-456' };

      const result = await service.startWorkflow(workflowId, payload);

      expect(result).toHaveProperty('instanceId');
      expect(mockInstanceRepositorySaveWorkflowInstance).toHaveBeenCalled();
      expect(mockTaskRepositorySaveTask).toHaveBeenCalled();
      expect(mockQueuePublish).toHaveBeenCalledWith(
        'task-queue',
        expect.objectContaining({
          instanceId: result.instanceId,
          type: 'fetch-orders',
          payload,
        }),
      );
    });

    it('should create workflow instance with RUNNING status', async () => {
      await service.startWorkflow('workflow-123', payload);

      const savedInstance = (
        mockInstanceRepositorySaveWorkflowInstance.mock
          .calls as WorkflowInstance[][]
      )[0][0];
      expect(savedInstance.status).toBe(WorkflowInstanceStatus.RUNNING);
    });

    it('should create task with PENDING status', async () => {
      await service.startWorkflow('workflow-123', payload);

      const savedTask = (
        mockTaskRepositorySaveTask.mock.calls as Task[][]
      )[0][0];
      expect(savedTask.status).toBe(TaskStatus.PENDING);
      expect(savedTask.attempt).toBe(0);
      expect(savedTask.maxAttempts).toBe(3);
    });
  });

  describe('cancelInstance', () => {
    it('should cancel a running workflow instance', async () => {
      const instance = new WorkflowInstance(
        'instance-1',
        'workflow-1',
        WorkflowInstanceStatus.RUNNING,
        new Date(),
        new Date(),
      );

      (
        mockInstanceRepository.findWorkflowInstanceById as jest.Mock
      ).mockResolvedValue(instance);

      const result = await service.cancelInstance('instance-1');

      expect(result).toEqual({ success: true });
      expect(instance.status).toBe(WorkflowInstanceStatus.CANCELLED);
      expect(mockInstanceRepositorySaveWorkflowInstance).toHaveBeenCalled();
    });

    it('should return success: false if instance not found', async () => {
      (
        mockInstanceRepository.findWorkflowInstanceById as jest.Mock
      ).mockResolvedValue(null);

      const result = await service.cancelInstance('missing-instance');

      expect(result).toEqual({ success: false });
    });

    it('should return success: false if instance not running', async () => {
      const instance = new WorkflowInstance(
        'instance-1',
        'workflow-1',
        WorkflowInstanceStatus.SUCCEEDED,
        new Date(),
        new Date(),
      );

      (
        mockInstanceRepository.findWorkflowInstanceById as jest.Mock
      ).mockResolvedValue(instance);

      const result = await service.cancelInstance('instance-1');

      expect(result).toEqual({ success: false });
    });
  });
});
