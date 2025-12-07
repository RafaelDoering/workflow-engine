import { TaskPayload } from '@app/core/domain/task.entity';

export interface TaskHandler {
  execute(payload: TaskPayload): Promise<TaskPayload>;
  compensate?(payload: TaskPayload): Promise<void>;
}
