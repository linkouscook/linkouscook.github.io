import { useEffect, useMemo, useRef, useState } from 'react'

import { createChart, DetailedRenderer, RelativesChart } from 'topola'
import type { ChartHandle } from 'topola'

import { getFocusPeople, personDisplayName, toTopolaData } from '../lib/topola'

import type { GraphData } from '../lib/model'

export function FamilyGraph({ data }: { data: GraphData }) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const chartRef = useRef<ChartHandle | null>(null)
  const svgId = useMemo(() => `family-graph-${Math.random().toString(36).slice(2, 10)}`, [])
  const topolaData = useMemo(() => toTopolaData(data), [data])
  const initialTopolaData = useRef(topolaData)
  const focusPeople = useMemo(() => getFocusPeople(data), [data])
  const fallbackFocusId = focusPeople[0]?.id ?? data.people[0]?.id ?? null
  const [startId, setStartId] = useState<string | null>(fallbackFocusId)

  useEffect(() => {
    setStartId(current => (current === fallbackFocusId ? current : fallbackFocusId))
  }, [fallbackFocusId])

  useEffect(() => {
    initialTopolaData.current = topolaData
  }, [topolaData])

  useEffect(() => {
    if (!svgRef.current) return
    if (chartRef.current) return
    const chart = createChart({
      json: initialTopolaData.current,
      chartType: RelativesChart,
      renderer: DetailedRenderer,
      svgSelector: `#${svgId}`,
      horizontal: true,
      expanders: true,
      animate: true
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
    chartRef.current.setData(topolaData)
    const start = startId ?? focusPeople[0]?.id ?? topolaData.indis[0]?.id
    chartRef.current.render(start ? { startIndi: start } : {})
  }, [topolaData, startId, focusPeople])

  return (
    <div style={{ width: '100%', display: 'grid', gap: 12 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 8
        }}
      >
        {focusPeople.map(person => {
          const isActive = startId === person.id
          return (
            <button
              key={person.id}
              type="button"
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
                transition: 'all 120ms ease-in-out'
              }}
            >
              {personDisplayName(person)}
            </button>
          )
        })}
      </div>
      <svg
        id={svgId}
        ref={svgRef}
        role="img"
        aria-label="Topola family tree"
        style={{ width: '100%', minHeight: 520 }}
      />
    </div>
  )
}
