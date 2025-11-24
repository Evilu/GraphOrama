import React, { useRef, useEffect, useMemo } from 'react'
import ForceGraph3D, { ForceGraphMethods } from 'react-force-graph-3d'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import * as THREE from 'three'

export default function GraphViewer({ apiUrl, setApiUrl, filter, uploadStamp }: { apiUrl: string; setApiUrl?: (url: string) => void; filter: string; uploadStamp?: number | null }) {
  const fgRef = useRef<ForceGraphMethods>()

  // include uploadStamp in the query key so uploads trigger a refetch
  const { data, isLoading, error } = useQuery(['graph', apiUrl, filter, uploadStamp], async () => {
    if (!apiUrl) return { nodes: [], links: [] }
    // Try primary URL, but some backend setups add a global 'api' prefix resulting in '/api/api/graph/query'
    try {
      const params: any = {}
      if (filter === 'startsWithPublic') params.startsWithPublic = true
      if (filter === 'endsInSink') params.endsInSink = true
      if (filter === 'hasVulnerability') params.hasVulnerability = true

      const res = await axios.get(apiUrl, { params })
      return res.data
    } catch (err: any) {
      // If 404, try the alternate double-api path
      if (err?.response?.status === 404) {
        const alt = apiUrl.includes('/api/api/graph/query')
          ? apiUrl.replace('/api/api/graph/query', '/api/graph/query')
          : apiUrl.replace('/api/graph/query', '/api/api/graph/query')

        try {
          const params: any = {}
          if (filter === 'startsWithPublic') params.startsWithPublic = true
          if (filter === 'endsInSink') params.endsInSink = true
          if (filter === 'hasVulnerability') params.hasVulnerability = true

          const res2 = await axios.get(alt, { params })

          if (setApiUrl) setApiUrl(alt)
          return res2.data
        } catch (err2: any) {
          // rethrow original error or the alternate error
          throw err2 || err
        }
      }
      throw err
    }
  }, { staleTime: 1000 * 60 * 5 })

  const graph = useMemo(() => {
    if (!data) return { nodes: [], links: [] }

    // if JSON structure has nodes & edges
    if (data.nodes && data.edges) {
      // Build node map to quickly detect missing nodes referenced by edges
      const nodeMap = new Map<string, any>()
      const nodes: any[] = data.nodes.map((n: any) => {
        const node = {
          id: n.name,
          name: n.name,
          group: n.kind,
          isPublic: !!n.publicExposed,
          isSink: n.kind === 'rds' || n.kind === 'sqs',
          hasVulnerability: Array.isArray(n.vulnerabilities) && n.vulnerabilities.length > 0,
          vulnerabilities: n.vulnerabilities || [],
          metadata: n.metadata || {}
        }
        nodeMap.set(node.id, node)
        return node
      })

      const links: any[] = []
      data.edges.forEach((e: any) => {
        const tos: string[] = Array.isArray(e.to) ? e.to : [e.to]
        tos.forEach((t: string) => {
          // If source/target are missing from nodes, create placeholder nodes so d3-force doesn't crash
          if (!nodeMap.has(e.from)) {
            const placeholder = { id: e.from, name: e.from, group: 'unknown', isPlaceholder: true }
            nodeMap.set(e.from, placeholder)
            nodes.push(placeholder)
          }
          if (!nodeMap.has(t)) {
            const placeholder = { id: t, name: t, group: 'unknown', isPlaceholder: true }
            nodeMap.set(t, placeholder)
            nodes.push(placeholder)
          }
          links.push({ source: e.from, target: t, value: 1 })
        })
      })

      return { nodes, links }
    }

    // if API already returns GraphResponse
    return data
  }, [data])

  useEffect(() => {
    if (!graph || !fgRef.current) return
    const charge = fgRef.current.d3Force('charge')
    if (charge) charge.strength(-120)
  }, [graph])

  if (isLoading) return <div className="loader">Loading graph...</div>
  if (error) return <div className="error">Error loading graph: {String(error)}</div>

  return (
    <ForceGraph3D
      ref={fgRef as any}
      graphData={graph as any}
      nodeAutoColorBy={(n: any) => (n.group || n.id)}
      nodeLabel={(n: any) => `${n.id}\nPublic: ${String(n.isPublic)}\nSink: ${String(n.isSink)}\nVulns: ${String(n.hasVulnerability)}`}
      linkDirectionalParticles={2}
      linkDirectionalParticleWidth={() => 1}
      linkDirectionalParticleColor={() => '#ff4500'}
      nodeThreeObject={(node: any) => {
        // create a sphere with color based on vulnerability/public
        const color = node.hasVulnerability ? 'red' : node.isPublic ? 'green' : '#888'
        return new THREE.Mesh(new THREE.SphereGeometry(4), new THREE.MeshBasicMaterial({ color }))
      }}
      onNodeClick={(node: any) => {
        // center on node
        const distance = 40
        const distRatio = 1 + distance / Math.hypot((node as any).x || 1, (node as any).y || 1, (node as any).z || 1)
        fgRef.current?.cameraPosition({ x: (node as any).x! * distRatio, y: (node as any).y! * distRatio, z: (node as any).z! * distRatio }, node as any, 3000)
      }}
    />
  )
}
