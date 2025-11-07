import { useEffect, useMemo, useRef, useState } from 'react'
import { createChart, DetailedRenderer } from 'topola'
import { InvertedRelativesChart } from '../lib/InvertedRelativesChart'

import type { ChartHandle, JsonGedcomData, JsonIndi } from 'topola'

const indiDisplayName = (person: JsonIndi) => {
  const first = person.firstName ?? ''
  const last = person.lastName ?? person.maidenName ?? ''
  const label = `${first} ${last}`.trim()
  return label || person.id
}

export function FamilyGraph({ data }: { data: JsonGedcomData }) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const chartRef = useRef<ChartHandle | null>(null)
  const svgId = useMemo(
    () => `family-graph-${Math.random().toString(36).slice(2, 10)}`,
    [],
  )
  const focusPeople = useMemo(() => data.indis ?? [], [data])
  const initialTopolaData = useRef(data)
  const fallbackFocusId = focusPeople[0]?.id ?? data.indis?.[0]?.id ?? null
  const [startId, setStartId] = useState<string | null>(fallbackFocusId)

  useEffect(() => {
    setStartId((current) =>
      current && focusPeople.some((person) => person.id === current)
        ? current
        : fallbackFocusId,
    )
  }, [fallbackFocusId, focusPeople])

  useEffect(() => {
    initialTopolaData.current = data
  }, [data])

  useEffect(() => {
    if (!svgRef.current) return
    if (chartRef.current) return
    const chart = createChart({
      json: initialTopolaData.current,
      chartType: InvertedRelativesChart,
      renderer: DetailedRenderer,
      svgSelector: `#${svgId}`,
      horizontal: false,
      expanders: true,
      animate: true,
    })
    chartRef.current = chart
    return () => {
      chartRef.current = null
      if (svgRef.current) {
        while (svgRef.current.firstChild) {
          svgRef.current.removeChild(svgRef.current.firstChild)
        }
      }
    }
  }, [svgId])

  useEffect(() => {
    if (!chartRef.current) return
    chartRef.current.setData(data)
    const start =
      startId ?? focusPeople[0]?.id ?? data.indis?.[0]?.id ?? undefined
    chartRef.current.render(start ? { startIndi: start } : {})
  }, [data, startId, focusPeople])

  return (
    <div style={{ width: '100%', display: 'grid', gap: 12 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {focusPeople.map((person) => {
          const isActive = startId === person.id
          return (
            <button
              key={person.id}
              type='button'
              onClick={() => setStartId(person.id)}
              aria-pressed={isActive}
              style={{
                padding: '6px 14px',
                borderRadius: 999,
                cursor: 'pointer',
                border: isActive ? '2px solid #1d4ed8' : '1px solid #d1d5db',
                background: isActive ? '#dbeafe' : '#fff',
                fontWeight: isActive ? 600 : 500,
                fontSize: 14,
                transition: 'all 120ms ease-in-out',
              }}
            >
              {indiDisplayName(person)}
            </button>
          )
        })}
      </div>
      <svg
        id={svgId}
        ref={svgRef}
        role='img'
        aria-label='Topola family tree'
        style={{ width: '100%', minHeight: 520 }}
      />
    </div>
  )
}
