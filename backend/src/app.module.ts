import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { GraphModule } from './graph/graph.module';
import { RedisModule } from './redis/redis.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),
        ThrottlerModule.forRoot([{
            ttl: 60000,
            limit: 100,
        }]),
        RedisModule,
        GraphModule,
    ],
})
export class AppModule {}