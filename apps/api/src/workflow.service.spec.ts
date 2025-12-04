import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowService } from './workflow.service';
import { WorkflowInstanceStatus } from '@app/core/domain/workflow-instance.entity';
import { TaskStatus } from '@app/core/domain/task.entity';

describe('WorkflowService', () => {
    let service: WorkflowService;
    let mockInstanceRepo: any;
    let mockTaskRepo: any;
    let mockQueue: any;

    beforeEach(async () => {
        mockInstanceRepo = {
            saveWorkflowInstance: jest.fn(),
        };

        mockTaskRepo = {
            saveTask: jest.fn(),
        };

        mockQueue = {
            publish: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WorkflowService,
                {
                    provide: 'WorkflowInstanceRepository',
                    useValue: mockInstanceRepo,
                },
                {
                    provide: 'TaskRepository',
                    useValue: mockTaskRepo,
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
            expect(mockInstanceRepo.saveWorkflowInstance).toHaveBeenCalled();
            expect(mockTaskRepo.saveTask).toHaveBeenCalled();
            expect(mockQueue.publish).toHaveBeenCalledWith('task-queue', expect.objectContaining({
                instanceId: result.instanceId,
                type: 'fetch-orders',
                payload,
            }));
        });

        it('should create workflow instance with RUNNING status', async () => {
            await service.startWorkflow('workflow-123', {});

            const savedInstance = mockInstanceRepo.saveWorkflowInstance.mock.calls[0][0];
            expect(savedInstance.status).toBe(WorkflowInstanceStatus.RUNNING);
        });

        it('should create task with PENDING status', async () => {
            await service.startWorkflow('workflow-123', {});

            const savedTask = mockTaskRepo.saveTask.mock.calls[0][0];
            expect(savedTask.status).toBe(TaskStatus.PENDING);
            expect(savedTask.attempt).toBe(0);
            expect(savedTask.maxAttempts).toBe(3);
        });
    });
});
