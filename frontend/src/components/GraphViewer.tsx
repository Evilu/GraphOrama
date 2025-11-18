import React, { useRef, useEffect, useMemo } from 'react'
import ForceGraph3D, { ForceGraphMethods } from 'react-force-graph-3d'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import * as THREE from 'three'

type Node = {
  id: string
  name?: string
  group?: string
  isPublic?: boolean
  isSink?: boolean
  hasVulnerability?: boolean
  vulnerabilities?: any[]
}

type Link = {
  source: string
  target: string
  value?: number
}

export default function GraphViewer({ useSample, apiUrl }: { useSample: boolean; apiUrl: string }) {
  const fgRef = useRef<ForceGraphMethods>()

  const { data, isLoading, error } = useQuery(['graph', apiUrl, useSample], async () => {
    if (useSample) {
      const res = await import('../data/train-ticket.json')
      return res.default
    }
    const res = await axios.get(apiUrl, { params: { startsWithPublic: true, endsInSink: true, hasVulnerability: true } })
    return res.data
  }, { staleTime: 1000 * 60 * 5 })

  const graph = useMemo(() => {
    if (!data) return { nodes: [], links: [] }

    // if sample JSON structure has nodes & edges
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
      nodeLabel={(n: any) => `${n.id}\nPublic: ${n.isPublic}\nSink: ${n.isSink}\nVulns: ${n.hasVulnerability}`}
      linkDirectionalParticles={2}
      linkDirectionalParticleWidth={(l: any) => 1}
      linkDirectionalParticleColor={() => '#ff4500'}
      nodeThreeObject={(node: any) => {
        // create a sphere with color based on vulnerability/public
        const color = node.hasVulnerability ? 'red' : node.isPublic ? 'green' : '#888'
        const sprite = new THREE.Mesh(new THREE.SphereGeometry(4), new THREE.MeshBasicMaterial({ color }))
        return sprite
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
