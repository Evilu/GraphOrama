import React, { useState } from 'react'
import GraphViewer from './components/GraphViewer'
import Controls from './components/Controls'

export default function App() {
  const [apiUrl, setApiUrl] = useState('/api/graph/query')
  const [filter, setFilter] = useState<'none' | 'startsWithPublic' | 'endsInSink' | 'hasVulnerability'>('none')
  const [uploadStamp, setUploadStamp] = useState<number | null>(null)

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>GraphOrama</h1>
        <Controls
          apiUrl={apiUrl}
          setApiUrl={setApiUrl}
          filter={filter}
          setFilter={setFilter}
          setUploadStamp={setUploadStamp}
        />
      </aside>
      <main className="main">
        <GraphViewer apiUrl={apiUrl} filter={filter} setApiUrl={setApiUrl} uploadStamp={uploadStamp} />
      </main>
    </div>
  )
}
