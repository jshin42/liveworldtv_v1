import { Module, Controller, Get } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Controller()
class AppController {
  @Get()
  getHello() {
    return {
      message: 'LiveWorldTV API',
      version: '0.1.0',
      status: 'running',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  getHealth() {
    return {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
