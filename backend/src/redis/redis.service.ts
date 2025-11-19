import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private client: Redis;

    async onModuleInit() {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

        this.client = new Redis(redisUrl, {
            retryStrategy: (times) => {
                if (times > 3) {
                    console.warn('Redis connection failed after 3 retries, running without Redis cache');
                    return null;
                }
                return Math.min(times * 50, 2000);
            },
            maxRetriesPerRequest: 3,
        });

        this.client.on('error', (err) => {
            console.warn('Redis client error:', err.message);
        });

        this.client.on('connect', () => {
            console.log('Redis client connected');
        });
    }

    async onModuleDestroy() {
        await this.client.quit();
    }

    getClient(): Redis {
        return this.client;
    }

    async isAvailable(): Promise<boolean> {
        try {
            await this.client.ping();
            return true;
        } catch {
            return false;
        }
    }
}

