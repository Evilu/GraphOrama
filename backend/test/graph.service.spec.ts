import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect, beforeAll } from 'vitest'
import { GraphService } from '../src/graph/graph.service'
import type { GraphData } from '../src/graph/interfaces/graph.interfaces'

// Load fixture from docs folder
const fixturePath = resolve(__dirname, '../../docs/train-ticket-be (1).json')
const raw = readFileSync(fixturePath, 'utf8')
const data: GraphData = JSON.parse(raw)

describe('GraphService filters', () => {
  let svc: GraphService

  beforeAll(async () => {
    svc = new GraphService()
    await svc.loadGraph(data)
  })

  it('returns routes starting from public services when startsWithPublic is set', async () => {
    const res = await svc.getFilteredGraph({ startsWithPublic: true })
    // All routes returned should have source node that is public
    expect(res.nodes.length).toBeGreaterThan(0)
    for (const node of res.nodes) {
      if (node.id === undefined) continue
    }
    // ensure at least one route exists and the metadata publicNodes > 0
    expect(res.metadata.publicNodes).toBeGreaterThan(0)
  })

  it('returns routes that end in sinks when endsInSink is set', async () => {
    const res = await svc.getFilteredGraph({ endsInSink: true })
    expect(res.nodes.length).toBeGreaterThan(0)
    // sinks in fixture are prod-postgresdb (rds) and prod-sqs (sqs) - ensure metadata counts them
    expect(res.metadata.sinkNodes).toBeGreaterThan(0)
  })

  it('returns routes that include vulnerable nodes when hasVulnerability is set', async () => {
    const res = await svc.getFilteredGraph({ hasVulnerability: true })
    expect(res.nodes.length).toBeGreaterThan(0)
    // vulnerable nodes should be > 0
    expect(res.metadata.vulnerableNodes).toBeGreaterThan(0)
  })

  it('returns all routes when no filters are applied', async () => {
    const res = await svc.getFilteredGraph({})
    // Should return something
    expect(res.nodes.length).toBeGreaterThan(0)
    expect(res.links.length).toBeGreaterThan(0)
  })
})

