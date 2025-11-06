import type { Date as TopolaDate, JsonEvent, JsonFam, JsonGedcomData, JsonIndi } from 'topola'

import type { Event, Gender, GraphData, Person } from './model'

type MutableFam = JsonFam & { childrenSet: Set<string> }

const ISO_DATE_REGEX = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/

const preferredFocusNames = [
  { given: 'nathaniel', surname: 'cook' },
  { given: 'courtney', surname: 'linkous' }
]

const toSex = (gender?: Gender) => {
  if (gender === 'male') return 'M'
  if (gender === 'female') return 'F'
  return undefined
}

const parseIsoDate = (value?: string): TopolaDate | undefined => {
  if (!value) return undefined
  const trimmed = value.trim()
  const match = ISO_DATE_REGEX.exec(trimmed)
  if (!match) {
    return { text: trimmed }
  }
  const [, year, month, day] = match
  const parsed: TopolaDate = {}
  if (year) parsed.year = Number(year)
  if (month) parsed.month = Number(month)
  if (day) parsed.day = Number(day)
  return parsed
}

const toJsonEvent = (event?: Event): JsonEvent | undefined => {
  if (!event) return undefined
  const details: string[] = []
  if (event.note) details.push(event.note)
  if (event.date?.note) details.push(event.date.note)
  if (event.place?.note) details.push(event.place.note)
  const parsedDate = parseIsoDate(event.date?.value)
  const json: JsonEvent = {}
  if (event.type) json.type = event.type
  if (event.place?.value) json.place = event.place.value
  if (parsedDate) {
    json.date = parsedDate
  } else if (event.date?.value) {
    json.date = { text: event.date.value }
  }
  if (event.date?.confidence !== undefined) json.confirmed = event.date.confidence >= 1
  if (details.length) json.notes = details
  return json
}

const familyKey = (a?: string, b?: string) => {
  if (!a && !b) return null
  const sorted = [a ?? '', b ?? ''].sort()
  return `${sorted[0]}__${sorted[1]}`
}

const assignPartner = (
  fam: MutableFam,
  personId?: string,
  gender?: Gender,
  spouseFamilies?: Map<string, Set<string>>
) => {
  if (!personId) return
  let assigned = false
  if (gender === 'male') {
    if (!fam.husb) {
      fam.husb = personId
      assigned = true
    } else if (fam.husb === personId) {
      assigned = true
    } else if (!fam.wife) {
      fam.wife = personId
      assigned = true
    }
  } else if (gender === 'female') {
    if (!fam.wife) {
      fam.wife = personId
      assigned = true
    } else if (fam.wife === personId) {
      assigned = true
    } else if (!fam.husb) {
      fam.husb = personId
      assigned = true
    }
  } else {
    if (!fam.husb) {
      fam.husb = personId
      assigned = true
    } else if (fam.husb === personId) {
      assigned = true
    } else if (!fam.wife) {
      fam.wife = personId
      assigned = true
    }
  }
  if (assigned && spouseFamilies) {
    if (!spouseFamilies.has(personId)) spouseFamilies.set(personId, new Set())
    spouseFamilies.get(personId)!.add(fam.id)
  }
}

export const personDisplayName = (person: Person) => `${person.given ?? ''} ${person.surname ?? ''}`.trim() || person.id

const matchesPreferredName = (person: Person, given: string, surname: string) => {
  const givenName = (person.given ?? '').toLowerCase()
  const surnameName = (person.surname ?? '').toLowerCase()
  return givenName.startsWith(given) && surnameName.includes(surname)
}

export const getFocusPeople = (data: GraphData): Person[] => {
  const result: Person[] = []
  const seen = new Set<string>()
  preferredFocusNames.forEach(({ given, surname }) => {
    const match = data.people.find(person => matchesPreferredName(person, given, surname))
    if (match && !seen.has(match.id)) {
      result.push(match)
      seen.add(match.id)
    }
  })
  data.people.forEach(person => {
    if (person.tags?.includes('self') && !seen.has(person.id)) {
      result.push(person)
      seen.add(person.id)
    }
  })
  if (!result.length && data.people.length) {
    result.push(data.people[0])
    seen.add(data.people[0].id)
  }
  if (result.length === 1) {
    const alt = data.people.find(person => !seen.has(person.id))
    if (alt) result.push(alt)
  }
  return result
}

export const toTopolaData = (data: GraphData): JsonGedcomData => {
  const families = new Map<string, MutableFam>()
  const childFamilies = new Map<string, string>()
  const spouseFamilies = new Map<string, Set<string>>()
  const byId = new Map(data.people.map(person => [person.id, person]))

  const ensureFamily = (a?: string, b?: string) => {
    const key = familyKey(a, b)
    if (!key) return undefined
    if (!families.has(key)) {
      families.set(key, {
        id: `fam-${key}`,
        childrenSet: new Set()
      })
    }
    return families.get(key)
  }

  data.people.forEach(person => {
    const fatherId = person.parents?.fatherId
    const motherId = person.parents?.motherId
    if (fatherId || motherId) {
      const fam = ensureFamily(fatherId, motherId)
      if (fam) {
        const father = fatherId ? byId.get(fatherId) : undefined
        const mother = motherId ? byId.get(motherId) : undefined
        assignPartner(fam, fatherId, father?.gender, spouseFamilies)
        assignPartner(fam, motherId, mother?.gender, spouseFamilies)
        fam.childrenSet.add(person.id)
        childFamilies.set(person.id, fam.id)
      }
    }
  })

  data.people.forEach(person => {
    person.spouses?.forEach(spouseId => {
      if (!byId.has(spouseId)) return
      if (person.id < spouseId) {
        const fam = ensureFamily(person.id, spouseId)
        if (fam) {
          assignPartner(fam, person.id, person.gender, spouseFamilies)
          assignPartner(fam, spouseId, byId.get(spouseId)?.gender, spouseFamilies)
        }
      }
    })
  })

  const indis: JsonIndi[] = data.people.map(person => {
    const spouseFamIds = spouseFamilies.get(person.id)
    const birth = toJsonEvent(person.life?.birth)
    const death = toJsonEvent(person.life?.death)
    const notes = [] as string[]
    if (person.note) notes.push(person.note)
    const tagsNote = person.tags?.filter(tag => !tag.startsWith('focus'))
    if (tagsNote?.length) notes.push(`Tags: ${tagsNote.join(', ')}`)
    return {
      id: person.id,
      firstName: person.given,
      lastName: person.surname,
      sex: toSex(person.gender),
      birth,
      death,
      notes: notes.length ? notes : undefined,
      numberOfChildren: person.children?.length,
      numberOfMarriages: person.spouses?.length,
      famc: childFamilies.get(person.id),
      fams: spouseFamIds ? Array.from(spouseFamIds).sort() : undefined,
      hideId: !!person.isLiving
    }
  })

  const fams: JsonFam[] = Array.from(families.values()).map(({ childrenSet, ...fam }) => ({
    ...fam,
    children: childrenSet.size ? Array.from(childrenSet).sort() : undefined
  }))

  return { indis, fams }
}
