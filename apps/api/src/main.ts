import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe, VersioningType } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  
  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true
    }
  }))
  
  // API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    prefix: 'v'
  })
  
  // CORS configuration
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://liveworldtv.com', 'https://www.liveworldtv.com']
      : true,
    credentials: true
  })
  
  // OpenAPI documentation
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('LiveWorldTV API')
      .setDescription('Real-time AI dubbing platform API')
      .setVersion('1.0')
      .addTag('catalog', 'Channel catalog and discovery')
      .addTag('ranking', 'Content ranking and recommendations')
      .addTag('analytics', 'User analytics and events')
      .build()
    
    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup('docs', app, document)
  }
  
  const port = process.env.PORT || 3001
  await app.listen(port)
  
  console.log(`🚀 LiveWorldTV API running on port ${port}`)
  console.log(`📚 API docs available at http://localhost:${port}/docs`)
}

bootstrap()