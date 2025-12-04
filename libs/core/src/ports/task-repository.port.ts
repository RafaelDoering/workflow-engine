import { Task } from '../domain/task.entity';

export interface TaskRepositoryPort {
    saveTask(task: Task): Promise<void>;
    findByInstanceId(instanceId: string): Promise<Task[]>;
}
