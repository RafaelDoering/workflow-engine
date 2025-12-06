import { Task } from '../domain/task.entity';

export type TaskHandler = (message: Task) => Promise<void>;

export interface TaskQueuePort {
  publish(message: Task): Promise<void>;
  consume(handler: TaskHandler): Promise<void>;
}
