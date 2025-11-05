import { useEffect, useRef } from 'react'
import { Network } from 'vis-network/standalone'
import type { GraphData } from '../lib/model'
import { buildGraph } from '../lib/graph'

export function FamilyGraph({ data }: { data: GraphData }) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const { nodes, edges } = buildGraph(data)
    const net = new Network(
      ref.current,
      { nodes, edges },
      {
        physics: { stabilization: true },
        layout: { improvedLayout: true },
        edges: { arrows: { to: false } },
        interaction: { hover: true }
      }
    )
    return () => net?.destroy()
  }, [data])

  return <div ref={ref} style={{ width: '100%', height: 520 }} />
}
