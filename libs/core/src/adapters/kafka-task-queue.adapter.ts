import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, Consumer, EachMessagePayload } from 'kafkajs';

import { TaskQueuePort, TaskHandler } from '../ports/task-queue.port';
import { Task } from '../domain/task.entity';

@Injectable()
export class KafkaTaskQueueAdapter
  implements TaskQueuePort, OnModuleInit, OnModuleDestroy
{
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;
  private topic: string = 'task-queue';
  private messageHandler: TaskHandler | null = null;

  constructor(private configService: ConfigService) {
    const brokerUrls = this.configService.getOrThrow<string>('BROKER_URLS');

    this.kafka = new Kafka({
      clientId: 'workflow-service',
      brokers: brokerUrls.split(','),
    });
    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({ groupId: 'workflow-workers' });
  }

  async onModuleInit() {
    await this.producer.connect();
    await this.consumer.connect();
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
    await this.consumer.disconnect();
  }

  async publish(message: Task): Promise<void> {
    await this.producer.send({
      topic: this.topic,
      messages: [{ value: JSON.stringify(message) }],
    });
  }

  async consume(handler: TaskHandler): Promise<void> {
    this.messageHandler = handler;
    await this.consumer.subscribe({
      topic: this.topic,
      fromBeginning: false,
    });
    await this.consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        const { message } = payload;
        if (!message.value) return;

        try {
          const data = JSON.parse(message.value.toString()) as Task;
          if (this.messageHandler) {
            await this.messageHandler(data);
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      },
    });
  }
}
