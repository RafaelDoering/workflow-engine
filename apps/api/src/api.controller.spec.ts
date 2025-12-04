import { Test, TestingModule } from '@nestjs/testing';
import { ApiController } from './api.controller';
import { WorkflowService } from './workflow.service';

describe('ApiController', () => {
    let controller: ApiController;
    let workflowService: WorkflowService;

    beforeEach(async () => {
        const mockWorkflowService = {
            startWorkflow: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [ApiController],
            providers: [
                {
                    provide: WorkflowService,
                    useValue: mockWorkflowService,
                },
            ],
        }).compile();

        controller = module.get<ApiController>(ApiController);
        workflowService = module.get<WorkflowService>(WorkflowService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('startWorkflow', () => {
        it('should call workflowService.startWorkflow with correct params', async () => {
            const workflowId = 'test-workflow-id';
            const payload = { orderId: '123' };
            const expectedResult = { instanceId: 'instance-id' };

            jest.spyOn(workflowService, 'startWorkflow').mockResolvedValue(expectedResult);

            const result = await controller.startWorkflow(workflowId, { payload });

            expect(workflowService.startWorkflow).toHaveBeenCalledWith(workflowId, payload);
            expect(result).toEqual(expectedResult);
        });
    });
});
