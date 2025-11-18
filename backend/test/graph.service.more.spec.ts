import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect, beforeAll } from 'vitest'
import { GraphService } from '../src/graph/graph.service'
import type { GraphData } from '../src/graph/interfaces/graph.interfaces'

// Load fixture from docs folder
const fixturePath = resolve(__dirname, '../../docs/train-ticket-be (1).json')
const raw = readFileSync(fixturePath, 'utf8')
const data: GraphData = JSON.parse(raw)

function buildSetsFromData(d: GraphData) {
  const publicSet = new Set<string>()
  const sinkSet = new Set<string>()
  const vulnerableSet = new Set<string>()
  for (const n of d.nodes) {
    if (n.publicExposed) publicSet.add(n.name)
    if (['rds', 'sqs', 'sql', 'database'].includes(n.kind)) sinkSet.add(n.name)
    if (Array.isArray(n.vulnerabilities) && n.vulnerabilities.length > 0) vulnerableSet.add(n.name)
  }
  return { publicSet, sinkSet, vulnerableSet }
}

describe('GraphService deeper tests', () => {
  let svc: GraphService
  const sets = buildSetsFromData(data)

  beforeAll(async () => {
    svc = new GraphService()
    await svc.loadGraph(data)
  })

  it('builtin startsWithPublic matches equivalent custom filter', async () => {
    const builtin = await svc.getFilteredGraph({ startsWithPublic: true })
    // customFilters are applied to the seeded set, so include the builtin flag as well
    const custom = await svc.getFilteredGraph({ startsWithPublic: true, customFilters: [route => sets.publicSet.has(route.source)] })

    expect(builtin.nodes.length).toBe(custom.nodes.length)
    expect(builtin.links.length).toBe(custom.links.length)
  })

  it('builtin endsInSink matches equivalent custom filter', async () => {
    const builtin = await svc.getFilteredGraph({ endsInSink: true })
    const custom = await svc.getFilteredGraph({ endsInSink: true, customFilters: [route => sets.sinkSet.has(route.target)] })

    expect(builtin.nodes.length).toBe(custom.nodes.length)
    expect(builtin.links.length).toBe(custom.links.length)
  })

  it('builtin hasVulnerability matches equivalent custom filter', async () => {
    const builtin = await svc.getFilteredGraph({ hasVulnerability: true })
    const custom = await svc.getFilteredGraph({ hasVulnerability: true, customFilters: [route => route.hasVulnerability] })

    expect(builtin.nodes.length).toBe(custom.nodes.length)
    expect(builtin.links.length).toBe(custom.links.length)
  })

  it('combined builtin filters equal combined custom filter', async () => {
    const builtin = await svc.getFilteredGraph({ startsWithPublic: true, endsInSink: true })

    // Expected behavior: service returns union of public-origin routes and sink-target routes,
    // but when both flags are set sink routes are only included if their source is public.
    const publicOnly = await svc.getFilteredGraph({ startsWithPublic: true })
    const sinkOnly = await svc.getFilteredGraph({ endsInSink: true })

    // Filter sinkOnly links to only those whose source is in publicSet
    const sinkLinksFiltered = sinkOnly.links.filter(l => sets.publicSet.has((l as any).source))

    // Build expected node set from publicOnly + sinkLinksFiltered
    const expectedNodeIds = new Set<string>(publicOnly.nodes.map(n => n.id))
    sinkLinksFiltered.forEach(l => { expectedNodeIds.add((l as any).source); expectedNodeIds.add((l as any).target) })

    const expectedLinkCount = new Set(sinkLinksFiltered.map(l => `${(l as any).source}->${(l as any).target}`)).size +
      new Set(publicOnly.links.map(l => `${(l as any).source}->${(l as any).target}`)).size

    expect(builtin.nodes.length).toBe(expectedNodeIds.size)
    expect(builtin.links.length).toBe(expectedLinkCount)
  })

  it('getStatistics returns counts consistent with fixture', () => {
    const stats = svc.getStatistics()
    // compute expected
    const expectedPublic = sets.publicSet.size
    const expectedSink = sets.sinkSet.size
    const expectedVuln = sets.vulnerableSet.size

    expect(stats.publicNodes).toBe(expectedPublic)
    expect(stats.sinkNodes).toBe(expectedSink)
    expect(stats.vulnerableNodes).toBe(expectedVuln)
    expect(stats.totalNodes).toBeGreaterThan(0)
  })

  it('loadGraph replaces prior data (reset behavior)', async () => {
    // small graph
    const small: GraphData = {
      nodes: [
        { name: 'A', kind: 'service', publicExposed: true },
        { name: 'B', kind: 'rds' }
      ],
      edges: [ { from: 'A', to: 'B' } ]
    }

    await svc.loadGraph(small)

    const stats = svc.getStatistics()
    expect(stats.totalNodes).toBe(2)
    expect(stats.publicNodes).toBe(1)
    expect(stats.sinkNodes).toBe(1)

    const res = await svc.getFilteredGraph({ startsWithPublic: true })
    // should include edge A->B
    expect(res.links.length).toBeGreaterThanOrEqual(1)

    // reload original fixture to restore state for other tests (if any)
    await svc.loadGraph(data)
  })
})
