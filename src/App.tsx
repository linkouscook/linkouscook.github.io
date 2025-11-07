import { useEffect, useState } from 'react'
import { gedcomToJson } from 'topola'
import { FamilyGraph } from './components/FamilyGraph'
import type { JsonGedcomData } from 'topola'

const GEDCOM_PATH = `${import.meta.env.BASE_URL}data/cook_linkous_family.ged`

export default function App() {
  const [gedcomData, setGedcomData] = useState<JsonGedcomData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetch(GEDCOM_PATH, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load GEDCOM (${response.status})`)
        }
        return response.text()
      })
      .then((text) => {
        const parsed = gedcomToJson(text)
        setGedcomData(parsed)
        setLoading(false)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        console.error(err)
        setError(err.message ?? 'Unable to load GEDCOM')
        setGedcomData(null)
        setLoading(false)
      })
    return () => controller.abort()
  }, [])

  return (
    <div
      style={{
        padding: 16,
        display: 'grid',
        gap: 16,
        justifyItems: 'center',
        textAlign: 'center',
      }}
    >
      <h1 style={{ margin: 0 }}>Family Graph</h1>

      {error && (
        <div
          style={{
            border: '1px solid #f97316',
            background: '#fff7ed',
            color: '#9a3412',
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 14,
            maxWidth: 520,
          }}
        >
          {error}
        </div>
      )}

      {isLoading && !error && (
        <div style={{ fontSize: 15, fontWeight: 500 }}>Loading tree…</div>
      )}

      {gedcomData && !error && <FamilyGraph data={gedcomData} />}
    </div>
  )
}
