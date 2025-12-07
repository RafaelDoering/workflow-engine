import { Test, TestingModule } from '@nestjs/testing';
import { CompensationScheduler } from './compensation-scheduler.service';
import { CompensationService } from './compensation.service';
import { Task, TaskStatus } from '@app/core/domain/task.entity';
import {
  WorkflowInstance,
  WorkflowInstanceStatus,
} from '@app/core/domain/workflow-instance.entity';
import type { WorkflowInstanceRepositoryPort } from '@app/core/ports/workflow-instance-repository.port';
import type { TaskRepositoryPort } from '@app/core/ports/task-repository.port';

describe('CompensationScheduler', () => {
  let service: CompensationScheduler;
  let mockInstanceRepository: jest.Mocked<WorkflowInstanceRepositoryPort>;
  let mockTaskRepository: jest.Mocked<TaskRepositoryPort>;
  let mockCompensationService: jest.Mocked<CompensationService>;

  beforeEach(async () => {
    mockInstanceRepository = {
      findWorkflowInstanceById: jest.fn(),
      saveWorkflowInstance: jest.fn(),
      findByWorkflowId: jest.fn(),
      findByStatus: jest.fn(),
    };
    mockTaskRepository = {
      saveTask: jest.fn(),
      findByInstanceId: jest.fn(),
      findRetryableTasks: jest.fn(),
    };
    mockCompensationService = {
      compensateWorkflow: jest.fn(),
      compensateTask: jest.fn(),
    } as unknown as jest.Mocked<CompensationService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompensationScheduler,
        {
          provide: 'WorkflowInstanceRepository',
          useValue: mockInstanceRepository,
        },
        { provide: 'TaskRepository', useValue: mockTaskRepository },
        { provide: CompensationService, useValue: mockCompensationService },
      ],
    }).compile();

    service = module.get<CompensationScheduler>(CompensationScheduler);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkForCompensationNeeded', () => {
    it('should compensate cancelled instances with succeeded tasks', async () => {
      const cancelledInstance = new WorkflowInstance(
        'instance-1',
        'workflow-1',
        WorkflowInstanceStatus.CANCELLED,
        new Date(),
        new Date(),
      );

      const succeededTask = new Task(
        'task-1',
        'instance-1',
        'create-invoice',
        { orderId: 'ORD-1' },
        TaskStatus.SUCCEEDED,
        0,
        3,
        'key-1',
        new Date(),
        new Date(),
        new Date(),
        null,
        null,
      );

      mockInstanceRepository.findByStatus
        .mockResolvedValueOnce([cancelledInstance])
        .mockResolvedValueOnce([]);
      mockTaskRepository.findByInstanceId.mockResolvedValue([succeededTask]);
      mockCompensationService.compensateWorkflow.mockResolvedValue();

      await service.checkForCompensationNeeded();

      expect(mockCompensationService.compensateWorkflow).toHaveBeenCalledWith(
        'instance-1',
      );
    });

    it('should compensate failed instances with succeeded tasks', async () => {
      const failedInstance = new WorkflowInstance(
        'instance-1',
        'workflow-1',
        WorkflowInstanceStatus.FAILED,
        new Date(),
        new Date(),
      );

      const succeededTask = new Task(
        'task-1',
        'instance-1',
        'create-invoice',
        { orderId: 'ORD-1' },
        TaskStatus.SUCCEEDED,
        0,
        3,
        'key-1',
        new Date(),
        new Date(),
        new Date(),
        null,
        null,
      );

      mockInstanceRepository.findByStatus
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([failedInstance]);
      mockTaskRepository.findByInstanceId.mockResolvedValue([succeededTask]);
      mockCompensationService.compensateWorkflow.mockResolvedValue();

      await service.checkForCompensationNeeded();

      expect(mockCompensationService.compensateWorkflow).toHaveBeenCalledWith(
        'instance-1',
      );
    });

    it('should not compensate if no succeeded tasks', async () => {
      const cancelledInstance = new WorkflowInstance(
        'instance-1',
        'workflow-1',
        WorkflowInstanceStatus.CANCELLED,
        new Date(),
        new Date(),
      );

      const pendingTask = new Task(
        'task-1',
        'instance-1',
        'create-invoice',
        { orderId: 'ORD-1' },
        TaskStatus.PENDING,
        0,
        3,
        'key-1',
        new Date(),
        null,
        null,
        null,
        null,
      );

      mockInstanceRepository.findByStatus
        .mockResolvedValueOnce([cancelledInstance])
        .mockResolvedValueOnce([]);
      mockTaskRepository.findByInstanceId.mockResolvedValue([pendingTask]);

      await service.checkForCompensationNeeded();

      expect(mockCompensationService.compensateWorkflow).not.toHaveBeenCalled();
    });

    it('should handle compensation errors gracefully', async () => {
      const cancelledInstance = new WorkflowInstance(
        'instance-1',
        'workflow-1',
        WorkflowInstanceStatus.CANCELLED,
        new Date(),
        new Date(),
      );

      const succeededTask = new Task(
        'task-1',
        'instance-1',
        'create-invoice',
        { orderId: 'ORD-1' },
        TaskStatus.SUCCEEDED,
        0,
        3,
        'key-1',
        new Date(),
        new Date(),
        new Date(),
        null,
        null,
      );

      mockInstanceRepository.findByStatus
        .mockResolvedValueOnce([cancelledInstance])
        .mockResolvedValueOnce([]);
      mockTaskRepository.findByInstanceId.mockResolvedValue([succeededTask]);
      mockCompensationService.compensateWorkflow.mockRejectedValue(
        new Error('Compensation failed'),
      );

      await expect(service.checkForCompensationNeeded()).resolves.not.toThrow();

      expect(mockCompensationService.compensateWorkflow).toHaveBeenCalled();
    });

    it('should handle multiple instances', async () => {
      const instance1 = new WorkflowInstance(
        'instance-1',
        'workflow-1',
        WorkflowInstanceStatus.CANCELLED,
        new Date(),
        new Date(),
      );

      const instance2 = new WorkflowInstance(
        'instance-2',
        'workflow-1',
        WorkflowInstanceStatus.FAILED,
        new Date(),
        new Date(),
      );

      const succeededTask1 = new Task(
        'task-1',
        'instance-1',
        'create-invoice',
        { orderId: 'ORD-1' },
        TaskStatus.SUCCEEDED,
        0,
        3,
        'key-1',
        new Date(),
        new Date(),
        new Date(),
        null,
        null,
      );

      const succeededTask2 = new Task(
        'task-2',
        'instance-2',
        'create-invoice',
        { orderId: 'ORD-2' },
        TaskStatus.SUCCEEDED,
        0,
        3,
        'key-2',
        new Date(),
        new Date(),
        new Date(),
        null,
        null,
      );

      mockInstanceRepository.findByStatus
        .mockResolvedValueOnce([instance1])
        .mockResolvedValueOnce([instance2]);
      mockTaskRepository.findByInstanceId
        .mockResolvedValueOnce([succeededTask1])
        .mockResolvedValueOnce([succeededTask2]);
      mockCompensationService.compensateWorkflow.mockResolvedValue();

      await service.checkForCompensationNeeded();

      expect(mockCompensationService.compensateWorkflow).toHaveBeenCalledTimes(
        2,
      );
      expect(mockCompensationService.compensateWorkflow).toHaveBeenCalledWith(
        'instance-1',
      );
      expect(mockCompensationService.compensateWorkflow).toHaveBeenCalledWith(
        'instance-2',
      );
    });
  });
});
