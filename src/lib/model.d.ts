export type ID = string

export type ISODate = string // '1996-01-03' or '1996'

export type SourceType =
  | 'certificate'
  | 'census'
  | 'directory'
  | 'obituary'
  | 'headstone'
  | 'dna'
  | 'other'

export type Gender = 'male' | 'female' | 'unknown'

export type EventType =
  | 'birth'
  | 'death'
  | 'marriage'
  | 'residence'
  | 'census'
  | 'other'

export type Uncertain<T> = {
  value?: T
  note?: string
  confidence?: number // 0..1
}

export interface Source {
  id: ID
  title: string
  url?: string
  citation?: string
  type?: SourceType
}

export interface SourceRef {
  sourceId: ID
  detail?: string
}

export interface Event {
  type: EventType
  date?: Uncertain<ISODate>
  place?: Uncertain<string>
  note?: string
  sources?: SourceRef[]
}

export interface Person {
  id: ID
  given: string
  surname: string
  aka?: string[]
  gender?: Gender
  life?: {
    birth?: Event
    death?: Event
  }
  parents?: { fatherId?: ID; motherId?: ID }
  spouses?: ID[]
  children?: ID[]
  isLiving?: boolean
  note?: string
  tags?: string[]
  sources?: SourceRef[]
}

export interface GraphData {
  people: Person[]
  sources: Source[]
}
