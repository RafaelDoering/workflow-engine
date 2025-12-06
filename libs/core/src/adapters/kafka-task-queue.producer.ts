import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';

import { TaskQueuePort } from '../ports/task-queue.port';
import { Task } from '../domain/task.entity';

@Injectable()
export class KafkaProducer
  implements TaskQueuePort, OnModuleInit, OnModuleDestroy
{
  private kafka: Kafka;
  private producer: Producer;
  private topic: string = 'task-queue';

  constructor() {
    this.kafka = new Kafka({
      clientId: 'workflow-api',
      brokers: ['localhost:19092'],
    });
    this.producer = this.kafka.producer();
  }

  async onModuleInit() {
    await this.producer.connect();
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

  async publish(message: Task): Promise<void> {
    await this.producer.send({
      topic: this.topic,
      messages: [{ value: JSON.stringify(message) }],
    });
  }
}
