import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowService } from './workflow.service';
import {
  WorkflowInstance,
  WorkflowInstanceStatus,
} from '@app/core/domain/workflow-instance.entity';
import { Task, TaskStatus } from '@app/core/domain/task.entity';
import type { WorkflowInstanceRepositoryPort } from '@app/core/ports/workflow-instance-repository.port';
import type { TaskRepositoryPort } from '@app/core/ports/task-repository.port';
import type { TaskQueuePort } from '@app/core/ports/task-queue.port';

describe('WorkflowService', () => {
  let service: WorkflowService;
  let mockInstanceRepository: jest.Mocked<WorkflowInstanceRepositoryPort>;
  let mockTaskRepository: jest.Mocked<TaskRepositoryPort>;
  let mockTaskQueue: jest.Mocked<TaskQueuePort>;
  const payload = { orderId: '123' };

  beforeEach(async () => {
    mockInstanceRepository = {
      saveWorkflowInstance: jest.fn(),
      findWorkflowInstanceById: jest.fn(),
      findByWorkflowId: jest.fn(),
    };

    mockTaskRepository = {
      saveTask: jest.fn(),
      findByInstanceId: jest.fn(),
      findRetryableTasks: jest.fn(),
    };

    mockTaskQueue = {
      publish: jest.fn(),
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
          provide: 'TaskQueuePort',
          useValue: mockTaskQueue,
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
      expect(mockInstanceRepository.saveWorkflowInstance).toHaveBeenCalled();
      expect(mockTaskRepository.saveTask).toHaveBeenCalled();
      expect(mockTaskQueue.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          instanceId: result.instanceId,
          type: 'fetch-orders',
          payload,
        }),
      );
    });

    it('should create workflow instance with RUNNING status', async () => {
      await service.startWorkflow('workflow-123', payload);

      const savedInstance =
        mockInstanceRepository.saveWorkflowInstance.mock.calls[0][0];
      expect(savedInstance.status).toBe(WorkflowInstanceStatus.RUNNING);
    });

    it('should create task with PENDING status', async () => {
      await service.startWorkflow('workflow-123', payload);

      const savedTask = mockTaskRepository.saveTask.mock.calls[0][0];
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

      mockInstanceRepository.findWorkflowInstanceById.mockResolvedValue(
        instance,
      );

      const result = await service.cancelInstance('instance-1');

      expect(result).toEqual({ success: true });
      expect(instance.status).toBe(WorkflowInstanceStatus.CANCELLED);
      expect(mockInstanceRepository.saveWorkflowInstance).toHaveBeenCalled();
    });

    it('should return success: false if instance not found', async () => {
      mockInstanceRepository.findWorkflowInstanceById.mockResolvedValue(null);

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

      mockInstanceRepository.findWorkflowInstanceById.mockResolvedValue(
        instance,
      );

      const result = await service.cancelInstance('instance-1');

      expect(result).toEqual({ success: false });
    });
  });

  describe('getInstances', () => {
    it('should return all instances for a workflow', async () => {
      const instances = [
        new WorkflowInstance(
          'instance-1',
          'workflow-1',
          WorkflowInstanceStatus.RUNNING,
          new Date(),
          new Date(),
        ),
        new WorkflowInstance(
          'instance-2',
          'workflow-1',
          WorkflowInstanceStatus.SUCCEEDED,
          new Date(),
          new Date(),
        ),
      ];

      mockInstanceRepository.findByWorkflowId.mockResolvedValue(instances);

      const result = await service.getInstances('workflow-1');

      expect(result).toEqual(instances);
      expect(mockInstanceRepository.findByWorkflowId).toHaveBeenCalledWith(
        'workflow-1',
      );
    });
  });

  describe('getInstance', () => {
    it('should return instance with tasks', async () => {
      const instance = new WorkflowInstance(
        'instance-1',
        'workflow-1',
        WorkflowInstanceStatus.RUNNING,
        new Date(),
        new Date(),
      );
      const tasks = [
        new Task(
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
        ),
      ];

      mockInstanceRepository.findWorkflowInstanceById.mockResolvedValue(
        instance,
      );
      mockTaskRepository.findByInstanceId.mockResolvedValue(tasks);

      const result = await service.getInstance('instance-1');

      expect(result).toEqual({ instance, tasks });
    });

    it('should return null if instance not found', async () => {
      mockInstanceRepository.findWorkflowInstanceById.mockResolvedValue(null);

      const result = await service.getInstance('missing-instance');

      expect(result).toBeNull();
    });
  });
});
