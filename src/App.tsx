import { useEffect, useMemo, useState } from 'react'
import { gedcomToJson } from 'topola'
import { FamilyGraph } from './components/FamilyGraph'
import type { JsonGedcomData } from 'topola'

type ManifestEntry = {
  id: string
  label: string
  filename: string
}

type PeopleManifest = {
  people: ManifestEntry[]
}

export default function App() {
  const [manifest, setManifest] = useState<PeopleManifest | null>(null)
  const [manifestError, setManifestError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [gedcomData, setGedcomData] = useState<JsonGedcomData | null>(null)
  const [gedcomError, setGedcomError] = useState<string | null>(null)
  const [isGedcomLoading, setGedcomLoading] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const manifestUrl = `${import.meta.env.BASE_URL}data/people/index.json`
    setManifestError(null)
    fetch(manifestUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load manifest (${response.status})`)
        }
        return response.json()
      })
      .then((json: PeopleManifest) => {
        if (!Array.isArray(json.people)) {
          throw new Error('Manifest is missing a people array')
        }
        setManifest(json)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        console.error(err)
        setManifestError(err.message ?? 'Failed to load manifest')
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!manifest?.people.length) return
    setSelectedId((current) =>
      current && manifest.people.some((entry) => entry.id === current)
        ? current
        : manifest.people[0].id,
    )
  }, [manifest])

  useEffect(() => {
    if (!manifest || !selectedId) {
      setGedcomData(null)
      return
    }
    const entry = manifest.people.find((person) => person.id === selectedId)
    if (!entry) {
      setGedcomData(null)
      return
    }
    const controller = new AbortController()
    setGedcomLoading(true)
    setGedcomError(null)
    setGedcomData(null)
    const gedcomUrl = `${import.meta.env.BASE_URL}data/people/${entry.filename}`
    fetch(gedcomUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load GEDCOM (${response.status})`)
        }
        return response.text()
      })
      .then((text) => {
        try {
          const parsed = gedcomToJson(text)
          setGedcomData(parsed)
          setGedcomLoading(false)
        } catch (parseError) {
          const message =
            parseError instanceof Error
              ? parseError.message
              : 'Unable to parse GEDCOM'
          throw new Error(message)
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        console.error(err)
        setGedcomError(err.message ?? 'Failed to load GEDCOM')
        setGedcomData(null)
        setGedcomLoading(false)
      })
    return () => {
      controller.abort()
      setGedcomLoading(false)
    }
  }, [manifest, selectedId])

  const peopleOptions = useMemo(() => manifest?.people ?? [], [manifest])
  const hasPeople = peopleOptions.length > 0

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

      {!manifest && !manifestError && (
        <div style={{ fontSize: 15, fontWeight: 500 }}>
          Loading available GEDCOM files…
        </div>
      )}

      {manifestError && (
        <div
          style={{
            border: '1px solid #ef4444',
            background: '#fee2e2',
            color: '#991b1b',
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 14,
            maxWidth: 480,
          }}
        >
          Unable to load manifest: {manifestError}
        </div>
      )}

      {manifest && !hasPeople && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px dashed #cbd5f5',
            background: '#f8fafc',
            fontSize: 15,
            maxWidth: 520,
          }}
        >
          No GEDCOM files found under <code>public/data/people</code>. Run
          <code style={{ marginLeft: 4, marginRight: 4 }}>
            npm run make:gedcom
          </code>
          to create one.
        </div>
      )}

      {hasPeople && (
        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            fontSize: 15,
            fontWeight: 500,
            textAlign: 'left',
            width: 'min(360px, 90vw)',
          }}
        >
          <span>Select a GEDCOM file</span>
          <select
            value={selectedId ?? ''}
            onChange={(event) => setSelectedId(event.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              fontSize: 15,
            }}
          >
            {peopleOptions.map((person) => (
              <option key={person.id} value={person.id}>
                {person.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {gedcomError && (
        <div
          style={{
            border: '1px solid #f97316',
            background: '#fff7ed',
            color: '#9a3412',
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 14,
            maxWidth: 480,
          }}
        >
          {gedcomError}
        </div>
      )}

      {isGedcomLoading && (
        <div style={{ fontSize: 15, fontWeight: 500 }}>Loading tree…</div>
      )}

      {gedcomData && !gedcomError && <FamilyGraph data={gedcomData} />}
    </div>
  )
}
