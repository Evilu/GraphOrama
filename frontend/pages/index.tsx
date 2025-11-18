import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Controls from '../src/components/Controls'
import type { NextPage } from 'next'

const GraphViewer = dynamic(() => import('../src/components/GraphViewer'), { ssr: false })

export default function Home() {
  const defaultBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  // Backend currently registers controller as 'api/graph' while a global prefix 'api' is set,
  // so the effective route becomes '/api/api/graph/query'. Prefer that by default to avoid 404s.
  const defaultApiCandidate1 = `${defaultBase.replace(/\/$/, '')}/api/api/graph/query`
  const defaultApiCandidate2 = `${defaultBase.replace(/\/$/, '')}/api/graph/query`
  const [useSample, setUseSample] = useState(true)
  const [apiUrl, setApiUrl] = useState(defaultApiCandidate1)
  // On mount, probe the backend to find which endpoint works and set apiUrl accordingly
  useEffect(() => {
    let mounted = true
    async function probe() {
      // Try candidate1 first (double-api), then candidate2
      try {
        const res1 = await fetch(defaultApiCandidate1 + '?probe=true', { method: 'GET' })
        if (mounted && res1.ok) {
          setApiUrl(defaultApiCandidate1)
          return
        }
      } catch (e) {
        // ignore
      }

      try {
        const res2 = await fetch(defaultApiCandidate2 + '?probe=true', { method: 'GET' })
        if (mounted && res2.ok) {
          setApiUrl(defaultApiCandidate2)
          return
        }
      } catch (e) {
        // ignore
      }
    }
    probe()
    return () => { mounted = false }
  }, [defaultBase])

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>GraphOrama</h1>
        <Controls
          useSample={useSample}
          setUseSample={setUseSample}
          apiUrl={apiUrl}
          setApiUrl={setApiUrl}
        />
      </aside>
      <main className="main">
        <GraphViewer useSample={useSample} apiUrl={apiUrl} setApiUrl={setApiUrl} />
      </main>
    </div>
  )
}
