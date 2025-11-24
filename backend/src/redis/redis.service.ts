import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private client: Redis;

    async onModuleInit() {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

        this.client = new Redis(redisUrl, {
            // Retry with increasing delay for a long time while Redis is coming up.
            // Returning a number schedules next retry; do not return null here so client keeps retrying.
            retryStrategy: (times) => Math.min(100 * times, 2000),
            // Allow many retries per request so transient failures during startup don't abort operations.
            maxRetriesPerRequest: 50,
            // Try to reconnect on errors rather than giving up immediately
            enableOfflineQueue: true,
        });

        this.client.on('error', (err) => {
            console.warn('Redis client error:', err.message);
        });

        this.client.on('connect', () => {
            console.log('Redis client connected');
        });
        this.client.on('ready', () => {
            console.log('Redis client ready');
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
