import { Test, TestingModule } from '@nestjs/testing';
import { TaskChainService } from './task-chain.service';
import { Task, TaskStatus } from '@app/core/domain/task.entity';
import {
  WorkflowInstance,
  WorkflowInstanceStatus,
} from '@app/core/domain/workflow-instance.entity';
import { Workflow } from '@app/core/domain/workflow.entity';
import type { WorkflowRepositoryPort } from '@app/core/ports/workflow-repository.port';
import type { WorkflowInstanceRepositoryPort } from '@app/core/ports/workflow-instance-repository.port';
import type { TaskRepositoryPort } from '@app/core/ports/task-repository.port';
import type { QueuePort } from '@app/core/ports/queue.port';

describe('TaskChainService', () => {
  let service: TaskChainService;
  let mockWorkflowRepository: jest.Mocked<WorkflowRepositoryPort>;
  let mockInstanceRepository: jest.Mocked<WorkflowInstanceRepositoryPort>;
  let mockTaskRepository: jest.Mocked<TaskRepositoryPort>;
  let mockQueue: jest.Mocked<QueuePort>;

  beforeEach(async () => {
    mockWorkflowRepository = {
      findWorkflowById: jest.fn(),
      saveWorkflow: jest.fn(),
    };
    mockInstanceRepository = {
      findWorkflowInstanceById: jest.fn(),
      saveWorkflowInstance: jest.fn(),
      findByWorkflowId: jest.fn(),
    };
    mockTaskRepository = {
      saveTask: jest.fn(),
      findByInstanceId: jest.fn(),
      findRetryableTasks: jest.fn(),
    };
    mockQueue = { publish: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskChainService,
        { provide: 'WorkflowRepository', useValue: mockWorkflowRepository },
        {
          provide: 'WorkflowInstanceRepository',
          useValue: mockInstanceRepository,
        },
        { provide: 'TaskRepository', useValue: mockTaskRepository },
        { provide: 'QueuePort', useValue: mockQueue },
      ],
    }).compile();

    service = module.get<TaskChainService>(TaskChainService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('queueNextTask', () => {
    const mockWorkflow = new Workflow(
      'workflow-1',
      'invoice',
      {
        steps: ['fetch-orders', 'create-invoice', 'pdf-process', 'send-email'],
      },
      new Date(),
      new Date(),
    );

    const mockInstance = new WorkflowInstance(
      'instance-1',
      'workflow-1',
      WorkflowInstanceStatus.RUNNING,
      new Date(),
      new Date(),
    );

    it('should queue next task when there are more steps', async () => {
      const completedTask = new Task(
        'task-1',
        'instance-1',
        'fetch-orders',
        { orderId: 'ORD-123' },
        TaskStatus.SUCCEEDED,
        0,
        3,
        null,
        null,
        null,
        null,
        null,
      );

      mockInstanceRepository.findWorkflowInstanceById.mockResolvedValue(
        mockInstance,
      );
      mockWorkflowRepository.findWorkflowById.mockResolvedValue(mockWorkflow);

      const nextTask = await service.queueNextTask(completedTask, {
        orderId: 'ORD-123',
      });

      expect(nextTask).not.toBeNull();
      expect(nextTask?.type).toBe('create-invoice');
      expect(mockTaskRepository.saveTask).toHaveBeenCalled();
      expect(mockQueue.publish).toHaveBeenCalledWith(
        'task-queue',
        expect.objectContaining({
          type: 'create-invoice',
        }),
      );
    });

    it('should return null when on last step', async () => {
      const completedTask = new Task(
        'task-1',
        'instance-1',
        'send-email',
        { orderId: 'ORD-123' },
        TaskStatus.SUCCEEDED,
        0,
        3,
        null,
        null,
        null,
        null,
        null,
      );

      mockInstanceRepository.findWorkflowInstanceById.mockResolvedValue(
        mockInstance,
      );
      mockWorkflowRepository.findWorkflowById.mockResolvedValue(mockWorkflow);

      const nextTask = await service.queueNextTask(completedTask, {});

      expect(nextTask).toBeNull();
      expect(mockTaskRepository.saveTask).not.toHaveBeenCalled();
    });

    it('should return null when instance not found', async () => {
      const completedTask = new Task(
        'task-1',
        'missing-instance',
        'fetch-orders',
        { orderId: 'ORD-123' },
        TaskStatus.SUCCEEDED,
        0,
        3,
        null,
        null,
        null,
        null,
        null,
      );

      mockInstanceRepository.findWorkflowInstanceById.mockResolvedValue(null);

      const nextTask = await service.queueNextTask(completedTask, {});

      expect(nextTask).toBeNull();
    });
  });
});
