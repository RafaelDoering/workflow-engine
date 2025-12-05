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
    };

    mockTaskRepositorySaveTask = jest.fn();
    mockTaskRepository = {
      saveTask: mockTaskRepositorySaveTask,
      findByInstanceId: jest.fn(),
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
});
