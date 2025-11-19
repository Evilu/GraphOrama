import { Test, TestingModule } from '@nestjs/testing';
import { GraphService } from './graph.service';
import { RedisService } from '../redis/redis.service';

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

describe('GraphService (basic)', () => {
  let service: GraphService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GraphService,
        {
          provide: RedisService,
          useValue: {
            isAvailable: jest.fn().mockResolvedValue(false), // Use memory storage
            getClient: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GraphService>(GraphService);
    await service.onModuleInit();
    await service.loadGraph(sampleData as any);
  });

  test('statistics reflects loaded graph', async () => {
    const stats = await service.getStatistics();
    expect(stats.totalNodes).toBe(3);
    expect(stats.publicNodes).toBe(1);
    expect(stats.sinkNodes).toBe(1);
    expect(stats.vulnerableNodes).toBe(1);
  });

  test('query with startsWithPublic returns paths starting at frontend', async () => {
    const result = await service.getFilteredGraph({ startsWithPublic: true } as any);
    // Expect at least one node 'frontend' and path to 'auth'
    expect(result.nodes.map(n => n.id)).toContain('frontend');
    expect(result.links.some(l => l.source === 'frontend' && l.target === 'auth')).toBe(true);
  });

  test('query with hasVulnerability returns vulnerable routes', async () => {
    const result = await service.getFilteredGraph({ hasVulnerability: true } as any);
    expect(result.nodes.map(n => n.id)).toContain('auth');
  });

  test('no filters returns all precomputed routes', async () => {
    const result = await service.getFilteredGraph({} as any);
    // Should include frontend->auth and auth->db
    expect(result.links.some(l => l.source === 'frontend' && l.target === 'auth')).toBe(true);
    expect(result.links.some(l => l.source === 'auth' && l.target === 'db')).toBe(true);
  });
});

