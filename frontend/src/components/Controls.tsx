import React, { useState } from 'react'
import axios from 'axios'

export default function Controls({ apiUrl, setApiUrl, filter = 'none', setFilter = () => {}, setUploadStamp }: any) {
  const [pasteJson, setPasteJson] = useState('')
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)

  // derive load endpoint from the current apiUrl (replace /query or /query/custom with /load)
  const getLoadUrl = (baseUrl: string) => {
    if (!baseUrl) return '/api/graph/load'
    return baseUrl.replace(/\/query(\/custom)?$/, '') + '/load'
  }

  const handleUpload = async () => {
    setUploadStatus(null)
    if (!pasteJson) {
      setUploadStatus('Paste JSON into the box before uploading.')
      return
    }

    let parsed
    try {
      parsed = JSON.parse(pasteJson)
    } catch (err: any) {
      setUploadStatus('Invalid JSON: ' + String(err))
      return
    }

    const loadUrl = getLoadUrl(apiUrl || '/api/graph/query')

    try {
      const res = await axios.post(loadUrl, parsed)
      setUploadStatus('Upload successful: ' + (res?.data?.message || 'OK'))
      if (setUploadStamp) setUploadStamp(Date.now())
    } catch (err: any) {
      // try alternate double-API path as fallback
      const alt = loadUrl.includes('/api/api/graph')
        ? loadUrl.replace('/api/api/graph/load', '/api/graph/load')
        : loadUrl.replace('/api/graph/load', '/api/api/graph/load')

      try {
        const res2 = await axios.post(alt, parsed)
        setUploadStatus('Upload successful (alt): ' + (res2?.data?.message || 'OK'))
        if (setApiUrl) setApiUrl(alt.replace('/load', '/query'))
        if (setUploadStamp) setUploadStamp(Date.now())
      } catch (err2: any) {
        setUploadStatus('Upload failed: ' + (err2?.message || String(err)))
      }
    }
  }

  return (
    <div>

      <div style={{ marginTop: 12 }}>
        <small>Choose exactly one filter (mutually exclusive):</small>
        <div>
          <label style={{ display: 'block' }}>
            <input type="radio" name="filter" checked={filter === 'none'} onChange={() => setFilter('none')} /> None
          </label>
          <label style={{ display: 'block' }}>
            <input type="radio" name="filter" checked={filter === 'startsWithPublic'} onChange={() => setFilter('startsWithPublic')} /> startsWithPublic
          </label>
          <label style={{ display: 'block' }}>
            <input type="radio" name="filter" checked={filter === 'endsInSink'} onChange={() => setFilter('endsInSink')} /> endsInSink
          </label>
          <label style={{ display: 'block' }}>
            <input type="radio" name="filter" checked={filter === 'hasVulnerability'} onChange={() => setFilter('hasVulnerability')} /> hasVulnerability
          </label>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <label>Upload JSON (paste here)</label>
        <textarea
          value={pasteJson}
          onChange={e => setPasteJson(e.target.value)}
          style={{ width: '100%', height: 160 }}
          placeholder='Paste full graph JSON here and click Upload to POST to the backend /api/graph/load'
        />
        <div style={{ marginTop: 8 }}>
          <button onClick={handleUpload}>Upload</button>
          {uploadStatus && <span style={{ marginLeft: 8 }}>{uploadStatus}</span>}
        </div>
      </div>

    </div>
  )
}
