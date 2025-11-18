import React, { useState } from 'react'
import GraphViewer from './components/GraphViewer'
import Controls from './components/Controls'

export default function App() {
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

