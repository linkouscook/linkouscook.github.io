import { useEffect, useState } from 'react'
import type { GraphData } from './lib/model'
import { graphSchema } from './lib/model'
import { FamilyGraph } from './components/FamilyGraph'
import { Pedigree } from './components/Pedigree'
import './components/pedigree.css'

export default function App() {
  const [data, setData] = useState<GraphData | null>(null)
  const [focusId, setFocusId] = useState('courtney')

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'data/nate-and-courtney.json')
      .then(r => r.json())
      .then(json => {
        const parsed = graphSchema.safeParse(json)
        if (parsed.success) setData(parsed.data)
        else console.error(parsed.error)
      })
  }, [])

  if (!data) return <div style={{ padding: 16 }}>Loading…</div>

  return (
    <div style={{ padding: 16, display: 'grid', gap: 16 }}>
      <h1>Family Graph</h1>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        Focus ID:
        <input value={focusId} onChange={e => setFocusId(e.target.value)} />
      </label>
      <FamilyGraph data={data} />
      <h2>Pedigree (3-gen)</h2>
      <Pedigree data={data} focusId={focusId} />
    </div>
  )
}
