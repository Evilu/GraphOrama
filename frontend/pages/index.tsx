import React, { useState } from 'react'
import dynamic from 'next/dynamic'
import Controls from '../src/components/Controls'

const GraphViewer = dynamic(() => import('../src/components/GraphViewer'), { ssr: false })

export default function Home() {
  const [useSample, setUseSample] = useState(true)
  const [apiUrl, setApiUrl] = useState('/api/graph/query')

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
        <GraphViewer useSample={useSample} apiUrl={apiUrl} />
      </main>
    </div>
  )
}

