import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { FormEvent } from 'react'
import { createChart, DetailedRenderer } from 'topola'
import { InvertedRelativesChart } from '../lib/InvertedRelativesChart'

import type {
  ChartHandle,
  JsonFam,
  JsonGedcomData,
  JsonIndi,
} from 'topola'

const indiDisplayName = (person: JsonIndi) => {
  const first = person.firstName ?? ''
  const last = person.lastName ?? person.maidenName ?? ''
  const label = `${first} ${last}`.trim()
  return label || person.id
}

type LineageHighlights = {
  individuals: Set<string>
  families: Set<string>
}

type TreeNodeData = {
  indi?: { id: string }
  spouse?: { id: string }
  family?: { id: string }
}

type HierarchyLikeNode = {
  data: TreeNodeData
  parent?: HierarchyLikeNode | null
}

type SvgD3Element<T> = SVGElement & { __data__?: T }

export function FamilyGraph({ data }: { data: JsonGedcomData }) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const chartRef = useRef<ChartHandle | null>(null)
  const svgId = useMemo(
    () => `family-graph-${Math.random().toString(36).slice(2, 10)}`,
    [],
  )
  const searchListId = useMemo(
    () => `indi-search-${Math.random().toString(36).slice(2, 8)}`,
    [],
  )
  const people = useMemo(() => data.indis ?? [], [data])
  const [query, setQuery] = useState('')
  const fallbackId = people[0]?.id ?? null
  const [activeId, setActiveId] = useState<string | null>(fallbackId)

  useEffect(() => {
    setActiveId((current) =>
      current && people.some((person) => person.id === current)
        ? current
        : fallbackId,
    )
  }, [fallbackId, people])

  useEffect(() => {
    if (!svgRef.current) return
    if (chartRef.current) return
    const chart = createChart({
      json: data,
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
    chartRef.current.render()
  }, [data])

  useEffect(() => {
    const styleId = 'family-graph-highlight-styles'
    if (document.getElementById(styleId)) return
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      .focus-highlight rect.border {
        stroke: #2563eb;
        stroke-width: 3px;
      }
      .focus-highlight text.name {
        fill: #1d4ed8;
      }
      .focus-highlight rect.background {
        filter: drop-shadow(0 3px 8px rgba(37, 99, 235, 0.25));
      }
      .lineage-highlight {
        stroke: #1d4ed8 !important;
        stroke-width: 2px;
      }
    `
    document.head.appendChild(style)
    return () => {
      style.remove()
    }
  }, [])

  const normalizedPeople = useMemo(
    () =>
      people.map((person) => ({
        ...person,
        _search: indiDisplayName(person).toLowerCase(),
      })),
    [people],
  )

  const indiById = useMemo(() => {
    const map = new Map<string, JsonIndi>()
    people.forEach((person) => map.set(person.id, person))
    return map
  }, [people])

  const famById = useMemo(() => {
    const map = new Map<string, JsonFam>()
    data.fams?.forEach((fam) => map.set(fam.id, fam))
    return map
  }, [data.fams])

  const lineage = useMemo<LineageHighlights>(() => {
    if (!activeId) return { individuals: new Set(), families: new Set() }
    const individuals = new Set<string>()
    const families = new Set<string>()
    const ancestorSeen = new Set<string>()
    const descendantSeen = new Set<string>()
    const visitAncestors = (id: string | undefined) => {
      if (!id || ancestorSeen.has(id)) return
      ancestorSeen.add(id)
      individuals.add(id)
      const person = indiById.get(id)
      const famId = person?.famc
      if (!famId) return
      families.add(famId)
      const fam = famById.get(famId)
      if (fam?.husb) visitAncestors(fam.husb)
      if (fam?.wife) visitAncestors(fam.wife)
    }
    const visitDescendants = (id: string | undefined) => {
      if (!id || descendantSeen.has(id)) return
      descendantSeen.add(id)
      individuals.add(id)
      const person = indiById.get(id)
      person?.fams?.forEach((famId) => {
        families.add(famId)
        const fam = famById.get(famId)
        fam?.children?.forEach((childId) => {
          individuals.add(childId)
          visitDescendants(childId)
        })
      })
    }
    visitAncestors(activeId)
    visitDescendants(activeId)
    return { individuals, families }
  }, [activeId, famById, indiById])

  const highlightSvg = useCallback(() => {
    if (!svgRef.current) return
    const nodeClass = 'focus-highlight'
    const linkClass = 'lineage-highlight'
    svgRef.current
      .querySelectorAll<SVGGElement>(`.${nodeClass}`)
      .forEach((el) => el.classList.remove(nodeClass))
    svgRef.current
      .querySelectorAll<SVGPathElement>(`.${linkClass}`)
      .forEach((el) => el.classList.remove(linkClass))

    const combinedIds = new Set<string>([
      ...lineage.individuals,
      ...lineage.families,
    ])

    svgRef.current
      .querySelectorAll<SVGGElement>('g.indi')
      .forEach((node: SvgD3Element<{ indi?: { id: string } }>) => {
        const boundId = node.__data__?.indi?.id
        if (boundId && lineage.individuals.has(boundId)) {
          node.classList.add(nodeClass)
        }
      })

    svgRef.current
      .querySelectorAll<SVGGElement>('g.family')
      .forEach((node: SvgD3Element<unknown>) => {
        const parentData =
          (node.parentElement as unknown as SvgD3Element<
            HierarchyLikeNode | undefined
          >)?.__data__
        const famId =
          (parentData as HierarchyLikeNode | undefined)?.data.family?.id
        if (famId && lineage.families.has(famId)) {
          node.classList.add(nodeClass)
        }
      })

    svgRef.current
      .querySelectorAll<SVGPathElement>('path.link')
      .forEach((path: SvgD3Element<HierarchyLikeNode>) => {
        const datum = path.__data__
        if (!datum) return
        const currentIds = extractNodeIds(datum.data)
        const parentIds = datum.parent ? extractNodeIds(datum.parent.data) : []
        const highlightParent = parentIds.some((id) => combinedIds.has(id))
        const highlightChild = currentIds.some((id) => combinedIds.has(id))
        if (highlightParent && highlightChild) {
          path.classList.add(linkClass)
        }
      })
  }, [lineage])

  useEffect(() => {
    highlightSvg()
  }, [highlightSvg])

  const findMatch = useCallback(
    (term: string) => {
      const normalized = term.trim().toLowerCase()
      if (!normalized) return null
      const match =
        normalizedPeople.find(
          (person) =>
            person._search.includes(normalized) ||
            person.id.toLowerCase().includes(normalized),
        ) ?? null
      return match?.id ?? null
    },
    [normalizedPeople],
  )

  const handleSearchChange = (value: string) => {
    setQuery(value)
    if (!value.trim()) {
      setActiveId(fallbackId)
      return
    }
    const match = findMatch(value)
    setActiveId(match ?? fallbackId)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!query.trim()) {
      setActiveId(fallbackId)
      return
    }
    const match = findMatch(query)
    setActiveId(match ?? fallbackId)
  }

  return (
    <div style={{ width: '100%', display: 'grid', gap: 16 }}>
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          alignItems: 'stretch',
          width: 'min(420px, 90vw)',
          margin: '0 auto',
        }}
      >
        <label
          htmlFor={`${svgId}-search`}
          style={{ fontSize: 15, fontWeight: 600, textAlign: 'left' }}
        >
          Focus on a person
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id={`${svgId}-search`}
            type='search'
            value={query}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder='Type a name or ID…'
            list={searchListId}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              fontSize: 15,
            }}
          />
          <button
            type='submit'
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Focus
          </button>
        </div>
        <datalist id={searchListId}>
          {people.map((person) => (
            <option key={person.id} value={indiDisplayName(person)} />
          ))}
        </datalist>
      </form>
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

function extractNodeIds(data: TreeNodeData) {
  const ids: string[] = []
  if (data.indi?.id) ids.push(data.indi.id)
  if (data.spouse?.id) ids.push(data.spouse.id)
  if (data.family?.id) ids.push(data.family.id)
  return ids
}
