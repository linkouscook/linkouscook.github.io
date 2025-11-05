import type { GraphData, Person } from '../lib/model'
import './pedigree.css'

function get(byId: Map<string, Person>, id?: string) { return id ? byId.get(id) : undefined }

function Card({ p }: { p?: Person }) {
  if (!p) return <div className='card empty'>—</div>
  const name = `${p.given} ${p.surname}`
  const label = p.isLiving ? name.split(' ').map(s=>s[0]).join('') : name
  return (
    <div className={`card ${p.isLiving ? 'living' : ''}`} title={p.note ?? ''}>
      <div>{label}</div>
      <small>
        {p.life?.birth?.date?.value ?? ''}
        {p.life?.death?.date?.value ? ` – ${p.life.death.date.value}` : ''}
      </small>
    </div>
  )
}

export function Pedigree({ data, focusId }: { data: GraphData; focusId: string }) {
  const byId = new Map(data.people.map(p => [p.id, p]))
  const proband = byId.get(focusId)
  const f1 = get(byId, proband?.parents?.fatherId)
  const m1 = get(byId, proband?.parents?.motherId)
  const ff = get(byId, f1?.parents?.fatherId)
  const fm = get(byId, f1?.parents?.motherId)
  const mf = get(byId, m1?.parents?.fatherId)
  const mm = get(byId, m1?.parents?.motherId)

  return (
    <div className='pedigree'>
      <div className='gen gen0'><Card p={proband} /></div>
      <div className='gen gen1'><Card p={f1} /><Card p={m1} /></div>
      <div className='gen gen2'><Card p={ff} /><Card p={fm} /><Card p={mf} /><Card p={mm} /></div>
    </div>
  )
}
