#!/usr/bin/env ts-node
/*
  Master GEDCOM appender for the Cook/Linkous tree.
  - Keeps/creates a single master file: public/data/cook_linkous_family.ged
  - Adds a new person (and optional spouse) as INDI + FAM records
  - Ensures HEAD/TRLR exist
  - Ensures two source records exist: @S1@ (Nathaniel) and @S2@ (Courtney)
  - Cites Nathaniel & Courtney as SOUR on entered facts

  Run (recommended):
    npx ts-node scripts/add-person.ts
  Or add to package.json:
    "scripts": { "add:person": "ts-node scripts/add-person.ts" }
*/

import fs from 'fs'
import path from 'path'
import { stdin as input, stdout as output } from 'process'
import { createInterface } from 'readline/promises'

// === Config ===
const MASTER_RELATIVE = path.join('public', 'data', 'cook_linkous_family.ged')

// === Helpers ===
function fileEnsureDir(p: string) {
  const dir = path.dirname(p)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function todayGedDate(): string {
  const d = new Date()
  return toGedDate(d)
}

const MONTHS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const

function toGedDate(d: Date | string): string {
  if (d instanceof Date) {
    const day = String(d.getUTCDate()).padStart(2, '0')
    const mon = MONTHS[d.getUTCMonth()]
    const year = d.getUTCFullYear()
    return `${day} ${mon} ${year}`
  }
  // Allow user to type YYYY-MM-DD or DD MMM YYYY; convert when possible
  const s = d.trim()
  const iso = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/
  const m = s.match(iso)
  if (m) {
    const year = Number(m[1])
    const mon = MONTHS[Number(m[2]) - 1]
    const day = m[3]
    return `${day} ${mon} ${year}`
  }
  return s.toUpperCase() // assume already GED style
}

function normalizePlace(input: string): string {
  // Keep user order; optionally trim whitespace around commas
  return input
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .join(', ')
}

function extractMaxIds(ged: string) {
  let maxI = 0,
    maxF = 0,
    maxS = 0
  const indiRe = /^0\s+@(I\d+)@\s+INDI$/gm
  const famRe = /^0\s+@(F\d+)@\s+FAM$/gm
  const srcRe = /^0\s+@(S\d+)@\s+SOUR$/gm
  for (const m of ged.matchAll(indiRe))
    maxI = Math.max(maxI, Number(m[1].slice(1)))
  for (const m of ged.matchAll(famRe))
    maxF = Math.max(maxF, Number(m[1].slice(1)))
  for (const m of ged.matchAll(srcRe))
    maxS = Math.max(maxS, Number(m[1].slice(1)))
  return { maxI, maxF, maxS }
}

function ensureHeadAndTrailer(ged: string): string {
  let out = ged
  if (!/^0\s+HEAD/m.test(out)) {
    const head = [
      '0 HEAD',
      '1 SOUR CookLinkousTool',
      '2 VERS 1.0',
      '2 NAME Cook/Linkous GEDCOM Tool',
      '1 GEDC',
      '2 VERS 5.5.1',
      '2 FORM LINEAGE-LINKED',
      '1 CHAR UTF-8',
    ].join('\n')
    out = head + '\n' + out
  }
  if (!/\n0\s+TRLR\s*$/.test(out)) {
    out = out.replace(/\n?$/, '') + '\n0 TRLR\n'
  }
  return out
}

function stripTrailer(ged: string): string {
  return ged.replace(/\n0\s+TRLR\s*$/, '\n')
}

function ensureSources(ged: string) {
  const hasS1 = /^0\s+@S1@\s+SOUR/m.test(ged)
  const hasS2 = /^0\s+@S2@\s+SOUR/m.test(ged)
  let add = ''
  const today = todayGedDate()
  if (!hasS1) {
    add += [
      '0 @S1@ SOUR',
      '1 TITL Testimony of Nathaniel (Nate) Cook',
      '1 AUTH Nathaniel Cook',
      `1 NOTE First-hand family information provided by Nathaniel (created ${today}).`,
      '',
    ].join('\n')
  }
  if (!hasS2) {
    add += [
      '0 @S2@ SOUR',
      '1 TITL Testimony of Courtney Jean Linkous',
      '1 AUTH Courtney Jean Linkous',
      `1 NOTE First-hand family information provided by Courtney (created ${today}).`,
      '',
    ].join('\n')
  }
  return add
}

function buildName(given: string, middle: string, surname: string) {
  const g = [given, middle].filter(Boolean).join(' ').trim()
  return `${g} /${surname}/`
}

function blockINDI(
  id: number,
  opts: {
    given: string
    middle?: string
    surname: string
    sex?: 'M' | 'F' | 'U'
    birthDate?: string
    birthPlace?: string
    deathDate?: string
    deathPlace?: string
    famsId?: number // spouse family id
    famcId?: number // child of family id
    notes?: string
  },
): string {
  const lines: string[] = []
  lines.push(`0 @I${id}@ INDI`)
  lines.push(`1 NAME ${buildName(opts.given, opts.middle || '', opts.surname)}`)
  if (opts.sex) lines.push(`1 SEX ${opts.sex}`)
  if (opts.birthDate || opts.birthPlace) {
    lines.push('1 BIRT')
    if (opts.birthDate) lines.push(`2 DATE ${toGedDate(opts.birthDate)}`)
    if (opts.birthPlace) lines.push(`2 PLAC ${normalizePlace(opts.birthPlace)}`)
    lines.push('2 SOUR @S1@')
    lines.push('2 SOUR @S2@')
  }
  if (opts.deathDate || opts.deathPlace) {
    lines.push('1 DEAT')
    if (opts.deathDate) lines.push(`2 DATE ${toGedDate(opts.deathDate)}`)
    if (opts.deathPlace) lines.push(`2 PLAC ${normalizePlace(opts.deathPlace)}`)
    lines.push('2 SOUR @S1@')
    lines.push('2 SOUR @S2@')
  }
  if (opts.famsId) lines.push(`1 FAMS @F${opts.famsId}@`)
  if (opts.famcId) lines.push(`1 FAMC @F${opts.famcId}@`)
  if (opts.notes) lines.push(`1 NOTE ${opts.notes}`)
  return lines.join('\n') + '\n'
}

function blockFAM(
  id: number,
  opts: {
    husbId?: number
    wifeId?: number
    marrDate?: string
    marrPlace?: string
    notes?: string
  },
): string {
  const lines: string[] = []
  lines.push(`0 @F${id}@ FAM`)
  if (opts.husbId) lines.push(`1 HUSB @I${opts.husbId}@`)
  if (opts.wifeId) lines.push(`1 WIFE @I${opts.wifeId}@`)
  if (opts.marrDate || opts.marrPlace) {
    lines.push('1 MARR')
    if (opts.marrDate) lines.push(`2 DATE ${toGedDate(opts.marrDate)}`)
    if (opts.marrPlace) lines.push(`2 PLAC ${normalizePlace(opts.marrPlace)}`)
    lines.push('2 SOUR @S1@')
    lines.push('2 SOUR @S2@')
  }
  if (opts.notes) lines.push(`1 NOTE ${opts.notes}`)
  return lines.join('\n') + '\n'
}

async function promptYN(
  rl: ReturnType<typeof createInterface>,
  q: string,
): Promise<boolean> {
  const a = (await rl.question(`${q} (y/N): `)).trim().toLowerCase()
  return a === 'y' || a === 'yes'
}

async function main() {
  const rl = createInterface({ input, output })
  try {
    const masterPath = MASTER_RELATIVE
    fileEnsureDir(masterPath)

    let ged = ''
    if (fs.existsSync(masterPath)) {
      ged = fs.readFileSync(masterPath, 'utf8')
    }
    ged = ensureHeadAndTrailer(ged)

    // Ensure SOUR records
    let out = stripTrailer(ged)
    out += ensureSources(out)

    let nextI = extractMaxIds(out).maxI + 1
    let nextF = extractMaxIds(out).maxF + 1

    // === Primary person ===
    console.log(
      '\nAdd a person to the Cook/Linkous master GED. Leave fields blank to skip.',
    )
    const given = await rl.question('Given (first) name: ')
    const middle = await rl.question('Middle name(s): ')
    const surname = await rl.question('Surname (last): ')

    const sexRaw = (
      await rl.question('Sex (M/F, blank = unknown): ')
    ).toUpperCase()
    const sex = sexRaw === 'M' ? 'M' : sexRaw === 'F' ? 'F' : 'U'

    const bdate = await rl.question('Birth date (YYYY-MM-DD or DD MMM YYYY): ')
    const bplace = await rl.question(
      'Birth place (City, County, State, Country): ',
    )
    const ddate = await rl.question('Death date (optional): ')
    const dplace = await rl.question('Death place (optional): ')

    const personId = nextI++

    // Spouse?
    const addSpouse = await promptYN(
      rl,
      'Add a spouse and link with a family record?',
    )
    let famId: number | undefined
    let spouseId: number | undefined
    let spouseSex: 'M' | 'F' | 'U' | undefined
    let marrDate = ''
    let marrPlace = ''

    if (addSpouse) {
      famId = nextF++
      console.log('\n— Spouse —')
      const sgiven = await rl.question('Spouse given (first) name: ')
      const smiddle = await rl.question('Spouse middle name(s): ')
      const ssurname = await rl.question('Spouse surname (last): ')
      const ssexRaw = (
        await rl.question('Spouse sex (M/F, blank = unknown): ')
      ).toUpperCase()
      spouseSex = ssexRaw === 'M' ? 'M' : ssexRaw === 'F' ? 'F' : 'U'
      const sbdate = await rl.question('Spouse birth date: ')
      const sbplace = await rl.question('Spouse birth place: ')
      const sddate = await rl.question('Spouse death date (optional): ')
      const sdplace = await rl.question('Spouse death place (optional): ')

      marrDate = await rl.question('Marriage date (optional): ')
      marrPlace = await rl.question('Marriage place (optional): ')

      spouseId = nextI++

      const spouseBlock = blockINDI(spouseId, {
        given: sgiven,
        middle: smiddle,
        surname: ssurname,
        sex: spouseSex,
        birthDate: sbdate,
        birthPlace: sbplace,
        deathDate: sddate,
        deathPlace: sdplace,
        famsId: famId,
      })
      out += spouseBlock + '\n'
    }

    // Primary person block (after spouse so FAMS can point correctly)
    const primaryBlock = blockINDI(personId, {
      given,
      middle,
      surname,
      sex,
      birthDate: bdate,
      birthPlace: bplace,
      deathDate: ddate,
      deathPlace: dplace,
      famsId: famId,
    })
    out += primaryBlock + '\n'

    // Family block if spouse
    if (famId && spouseId) {
      // Try to assign roles based on sex markers
      let husbId: number | undefined
      let wifeId: number | undefined
      if (sex === 'M') husbId = personId
      if (sex === 'F') wifeId = personId
      if (spouseSex === 'M') husbId = spouseId
      if (spouseSex === 'F') wifeId = spouseId

      const famBlock = blockFAM(famId, { husbId, wifeId, marrDate, marrPlace })
      out += famBlock + '\n'
    }

    // Close trailer
    out = out.replace(/\n?$/, '') + '\n0 TRLR\n'

    fs.writeFileSync(masterPath, out, 'utf8')

    console.log(`\nSaved updates to: ${masterPath}`)
    console.log(
      'Individuals now up to I' +
        extractMaxIds(out).maxI +
        ', families up to F' +
        extractMaxIds(out).maxF,
    )
    console.log('\nDone.')
  } finally {
    rl.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
