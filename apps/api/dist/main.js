"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    // Global validation pipe
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
            enableImplicitConversion: true
        }
    }));
    // API versioning
    app.enableVersioning({
        type: common_1.VersioningType.URI,
        prefix: 'v'
    });
    // CORS configuration
    app.enableCors({
        origin: process.env.NODE_ENV === 'production'
            ? ['https://liveworldtv.com', 'https://www.liveworldtv.com']
            : true,
        credentials: true
    });
    // OpenAPI documentation
    if (process.env.NODE_ENV !== 'production') {
        const config = new swagger_1.DocumentBuilder()
            .setTitle('LiveWorldTV API')
            .setDescription('Real-time AI dubbing platform API')
            .setVersion('1.0')
            .addTag('catalog', 'Channel catalog and discovery')
            .addTag('ranking', 'Content ranking and recommendations')
            .addTag('analytics', 'User analytics and events')
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, config);
        swagger_1.SwaggerModule.setup('docs', app, document);
    }
    const port = process.env.PORT || 3001;
    await app.listen(port);
    console.log(`🚀 LiveWorldTV API running on port ${port}`);
    console.log(`📚 API docs available at http://localhost:${port}/docs`);
}
bootstrap();
