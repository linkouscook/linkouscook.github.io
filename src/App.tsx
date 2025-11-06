import { useEffect, useState } from 'react'

import { FamilyGraph } from './components/FamilyGraph'
import { graphSchema } from './lib/model'

import type { GraphData } from './lib/model'

export default function App() {
  const [data, setData] = useState<GraphData | null>(null)

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'data/nate-and-courtney.json')
      .then(r => r.json())
      .then(json => {
        const parsed = graphSchema.safeParse(json)
        if (parsed.success) setData(parsed.data)
        else console.error(parsed.error)
      })
  }, [])

  if (!data) {
    return (
      <div style={{ padding: 16, fontSize: 16, fontWeight: 500 }}>
        Loading…
      </div>
    )
  }

  return (
    <div
      style={{
        padding: 16,
        display: 'grid',
        gap: 16,
        justifyItems: 'center',
        textAlign: 'center'
      }}
    >
      <h1 style={{ margin: 0 }}>Family Graph</h1>
      <p style={{ margin: 0, maxWidth: 520 }}>
        Nathaniel Cook and Courtney Linkous
      </p>
      <FamilyGraph data={data} />
    </div>
  )
}
