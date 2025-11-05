import type { GraphData, Person } from './model'

type VisNode = { id: string; label: string; shape?: string; color?: string; title?: string; borderWidth?: number; dashes?: boolean }
type VisEdge = { from: string; to: string; dashes?: boolean }
export interface BuiltGraph { nodes: VisNode[]; edges: VisEdge[] }

const initials = (name: string) => name.split(/\s+/).map(s => s[0]).join('')
const labelFor = (p: Person) => {
  const name = `${p.given} ${p.surname}`.trim()
  return p.isLiving ? initials(name) : name
}

export function buildGraph(data: GraphData): BuiltGraph {
  const byId = new Map(data.people.map(p => [p.id, p]))
  const nodes: VisNode[] = data.people.map(p => ({
    id: p.id,
    label: labelFor(p),
    shape: 'box',
    color: p.isLiving ? '#e8f0fe' : '#f4e9db',
    borderWidth: p.tags?.some(t => t.startsWith('to-confirm')) ? 2 : 1,
    dashes: p.tags?.some(t => t.includes('speculative'))
  }))

  const edges: VisEdge[] = []
  // parent -> child
  data.people.forEach(p => {
    const { parents } = p
    if (parents?.fatherId) edges.push({ from: parents.fatherId, to: p.id })
    if (parents?.motherId) edges.push({ from: parents.motherId, to: p.id })
  })
  // spouse <-> spouse (dashed)
  data.people.forEach(p => {
    p.spouses?.forEach(sid => { if (byId.has(sid) && p.id < sid) edges.push({ from: p.id, to: sid, dashes: true }) })
  })
  return { nodes, edges }
}
