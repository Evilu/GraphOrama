import { Test, TestingModule } from '@nestjs/testing';
import { GraphService } from './graph.service';
import { RedisService } from '../redis/redis.service';
import Redis from 'ioredis';

const sampleData = {
  nodes: [
    { name: 'frontend', kind: 'service', publicExposed: true },
    { name: 'auth', kind: 'service', publicExposed: false, vulnerabilities: [{ file: 'a.js', severity: 'high', message: 'x', metadata: { cwe: '79' } }] },
    { name: 'db', kind: 'rds' }
  ],
  edges: [
    { from: 'frontend', to: 'auth' },
    { from: 'auth', to: 'db' }
  ]
};

describe('GraphService with Redis', () => {
  let service: GraphService;
  let redisService: RedisService;
  let redis: Redis;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GraphService,
        {
          provide: RedisService,
          useValue: {
            isAvailable: jest.fn().mockResolvedValue(true),
            getClient: jest.fn().mockReturnValue(new Redis('redis://localhost:6379')),
          },
        },
      ],
    }).compile();

    service = module.get<GraphService>(GraphService);
    redisService = module.get<RedisService>(RedisService);
    redis = redisService.getClient();

    // Initialize the service
    await service.onModuleInit();

    // Clear any existing test data
    const keys = await redis.keys('graph:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  afterAll(async () => {
    // Clean up
    const keys = await redis.keys('graph:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    await redis.quit();
  });

  describe('loadGraph with Redis', () => {
    test('should store nodes in Redis', async () => {
      await service.loadGraph(sampleData as any);

      const allNodes = await redis.smembers('graph:nodes:all');
      expect(allNodes).toHaveLength(3);
      expect(allNodes).toContain('frontend');
      expect(allNodes).toContain('auth');
      expect(allNodes).toContain('db');
    });

    test('should index public nodes', async () => {
      await service.loadGraph(sampleData as any);

      const publicNodes = await redis.smembers('graph:nodes:public');
      expect(publicNodes).toContain('frontend');
      expect(publicNodes).not.toContain('auth');
    });

    test('should index sink nodes', async () => {
      await service.loadGraph(sampleData as any);

      const sinkNodes = await redis.smembers('graph:nodes:sinks');
      expect(sinkNodes).toContain('db');
    });

    test('should index vulnerable nodes', async () => {
      await service.loadGraph(sampleData as any);

      const vulnerableNodes = await redis.smembers('graph:nodes:vulnerable');
      expect(vulnerableNodes).toContain('auth');
    });

    test('should store edges', async () => {
      await service.loadGraph(sampleData as any);

      const edges = await redis.smembers('graph:edges:frontend');
      expect(edges).toContain('auth');

      const authEdges = await redis.smembers('graph:edges:auth');
      expect(authEdges).toContain('db');
    });

    test('should compute reachable sets from public nodes', async () => {
      await service.loadGraph(sampleData as any);

      const reachable = await redis.smembers('graph:reachable:public:frontend');
      expect(reachable).toContain('auth');
      expect(reachable).toContain('db');
    });
  });

  describe('getFilteredGraph with Redis', () => {
    beforeEach(async () => {
      await service.loadGraph(sampleData as any);
    });

    test('startsWithPublic filter returns paths from public nodes', async () => {
      const result = await service.getFilteredGraph({ startsWithPublic: true } as any);

      expect(result.nodes.map(n => n.id)).toContain('frontend');
      expect(result.nodes.map(n => n.id)).toContain('auth');
      expect(result.links.some(l => l.source === 'frontend' && l.target === 'auth')).toBe(true);
    });

    test('endsInSink filter returns paths to sink nodes', async () => {
      const result = await service.getFilteredGraph({ endsInSink: true } as any);

      expect(result.nodes.map(n => n.id)).toContain('db');
      expect(result.nodes.map(n => n.id)).toContain('auth');
    });

    test('hasVulnerability filter returns vulnerable paths', async () => {
      const result = await service.getFilteredGraph({ hasVulnerability: true } as any);

      expect(result.nodes.map(n => n.id)).toContain('auth');
    });

    test('no filters returns all nodes', async () => {
      const result = await service.getFilteredGraph({} as any);

      expect(result.nodes).toHaveLength(3);
      expect(result.links.length).toBeGreaterThan(0);
    });

    test('metadata includes correct counts', async () => {
      const result = await service.getFilteredGraph({} as any);

      expect(result.metadata.totalNodes).toBe(3);
      expect(result.metadata.publicNodes).toBe(1);
      expect(result.metadata.sinkNodes).toBe(1);
      expect(result.metadata.vulnerableNodes).toBe(1);
    });
  });

  describe('getStatistics with Redis', () => {
    test('returns correct statistics', async () => {
      await service.loadGraph(sampleData as any);

      const stats = await service.getStatistics();

      expect(stats.totalNodes).toBe(3);
      expect(stats.publicNodes).toBe(1);
      expect(stats.sinkNodes).toBe(1);
      expect(stats.vulnerableNodes).toBe(1);
      expect(stats.storageType).toBe('redis');
    });
  });

  describe('Complex graph scenarios', () => {
    const complexData = {
      nodes: [
        { name: 'api-gateway', kind: 'service', publicExposed: true },
        { name: 'auth-service', kind: 'service', publicExposed: false },
        { name: 'user-service', kind: 'service', publicExposed: false, vulnerabilities: [{ file: 'auth.js', severity: 'critical', message: 'SQL injection', metadata: {} }] },
        { name: 'order-service', kind: 'service', publicExposed: false },
        { name: 'postgres', kind: 'rds' },
        { name: 'redis-cache', kind: 'cache' },
      ],
      edges: [
        { from: 'api-gateway', to: 'auth-service' },
        { from: 'api-gateway', to: 'user-service' },
        { from: 'auth-service', to: 'postgres' },
        { from: 'user-service', to: 'postgres' },
        { from: 'user-service', to: 'order-service' },
        { from: 'order-service', to: 'postgres' },
        { from: 'auth-service', to: 'redis-cache' },
      ]
    };

    test('handles complex multi-path graphs', async () => {
      await service.loadGraph(complexData as any);

      const result = await service.getFilteredGraph({ startsWithPublic: true } as any);

      // Should include all nodes reachable from api-gateway
      expect(result.nodes.length).toBeGreaterThan(1);
      expect(result.nodes.map(n => n.id)).toContain('api-gateway');
    });

    test('finds vulnerable paths correctly', async () => {
      await service.loadGraph(complexData as any);

      const result = await service.getFilteredGraph({ hasVulnerability: true } as any);

      expect(result.nodes.map(n => n.id)).toContain('user-service');
    });

    test('combines multiple filters', async () => {
      await service.loadGraph(complexData as any);

      const result = await service.getFilteredGraph({
        startsWithPublic: true,
        hasVulnerability: true
      } as any);

      // Should include public paths that go through vulnerable nodes
      expect(result.nodes.length).toBeGreaterThan(0);
    });
  });
});

