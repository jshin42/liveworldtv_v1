import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for local development
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  // Enable API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('LiveWorldTV API')
    .setDescription('Real-time global live TV with AI-powered English dubbing')
    .setVersion('0.1.0')
    .addTag('catalog', 'Channel catalog management')
    .addTag('ranking', 'Content ranking and recommendations')
    .addTag('analytics', 'User analytics and telemetry')
    .addTag('health', 'System health and status')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`
🚀 LiveWorldTV API is running on: http://localhost:${port}
📚 API Documentation: http://localhost:${port}/api/docs
  `);
}

bootstrap();
