import { z } from 'zod'

export type ID = string
type ISODate = string // '1996-01-03' or '1996'

type Uncertain<T> = { value?: T; note?: string; confidence?: number } // 0..1

export interface Source {
  id: ID
  title: string
  url?: string
  citation?: string
  type?: 'certificate' | 'census' | 'directory' | 'obituary' | 'headstone' | 'dna' | 'other'
}
export interface SourceRef { sourceId: ID; detail?: string }

export interface Event {
  type: 'birth' | 'death' | 'marriage' | 'residence' | 'census' | 'other'
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
  gender?: 'male' | 'female' | 'unknown'
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

export const sourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url().optional(),
  citation: z.string().optional(),
  type: z.enum(['certificate','census','directory','obituary','headstone','dna','other']).optional()
})

export const personSchema = z.object({
  id: z.string(),
  given: z.string(),
  surname: z.string(),
  aka: z.array(z.string()).optional(),
  gender: z.enum(['male','female','unknown']).optional(),
  life: z.object({ birth: z.any().optional(), death: z.any().optional() }).optional(),
  parents: z.object({ fatherId: z.string().optional(), motherId: z.string().optional() }).optional(),
  spouses: z.array(z.string()).optional(),
  children: z.array(z.string()).optional(),
  isLiving: z.boolean().optional(),
  note: z.string().optional(),
  tags: z.array(z.string()).optional(),
  sources: z.array(z.object({ sourceId: z.string(), detail: z.string().optional() })).optional()
})

export const graphSchema = z.object({
  people: z.array(personSchema),
  sources: z.array(sourceSchema)
})
