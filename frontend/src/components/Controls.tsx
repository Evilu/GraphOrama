import React from 'react'

export default function Controls({ useSample, setUseSample, apiUrl, setApiUrl }: any) {
  return (
    <div>
      <label>
        <input type="checkbox" checked={useSample} onChange={e => setUseSample(e.target.checked)} /> Use sample JSON
      </label>

      <div style={{ marginTop: 12 }}>
        <label>API URL</label>
        <input
          type="text"
          value={apiUrl}
          onChange={e => setApiUrl(e.target.value)}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <small>Toggle filters in the API URL or use query endpoints directly.</small>
      </div>
    </div>
  )
}
