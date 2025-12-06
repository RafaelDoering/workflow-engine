import { Task } from '../domain/task.entity';

export interface TaskQueuePort {
  publish(message: Task): Promise<void>;
}
