"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    // Enable CORS for local development
    app.enableCors({
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        credentials: true,
    });
    // Global validation pipe
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    // Swagger API documentation
    const config = new swagger_1.DocumentBuilder()
        .setTitle('LiveWorldTV API')
        .setDescription('Real-time global live TV with AI-powered English dubbing')
        .setVersion('0.1.0')
        .addTag('catalog', 'Channel catalog management')
        .addTag('ranking', 'Content ranking and recommendations')
        .addTag('analytics', 'User analytics and telemetry')
        .addTag('health', 'System health and status')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api/docs', app, document);
    const port = process.env.PORT || 3001;
    await app.listen(port);
    console.log(`
🚀 LiveWorldTV API is running on: http://localhost:${port}
📚 API Documentation: http://localhost:${port}/api/docs
  `);
}
bootstrap();
