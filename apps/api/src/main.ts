import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ApiModule } from './api.module';

async function bootstrap() {
  const app = await NestFactory.create(ApiModule);

  const config = new DocumentBuilder()
    .setTitle('Workflow Manager API')
    .setDescription('The Workflow Manager API')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.port ?? 3000);
}
void bootstrap();
