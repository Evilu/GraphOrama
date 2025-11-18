import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as compression from 'compression';
import * as helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    // Security middleware
    // @ts-ignore
    app.use(helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    }));

    // Enable compression
    app.use(compression());

    // Enable CORS for React frontend
    app.enableCors({
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    });

    // Global validation pipe
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: {
                enableImplicitConversion: false,
            },
        }),
    );

    // Set global prefix
    app.setGlobalPrefix('api', { exclude: ['health'] });

    // Swagger documentation
    const config = new DocumentBuilder()
        .setTitle('Graph Query Engine API')
        .setDescription('RESTful API for querying microservices graph with 3D visualization support')
        .setVersion('1.0')
        .addTag('graph', 'Graph operations and queries')
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    // Graceful shutdown
    app.enableShutdownHooks();

    const port = process.env.PORT || 3001;
    await app.listen(port);

    console.log(`
    🚀 Graph Query Engine API is running!
    📍 Local: http://localhost:${port}
    📚 Swagger: http://localhost:${port}/api/docs
    🔧 Environment: ${process.env.NODE_ENV || 'development'}
  `);
}

bootstrap();