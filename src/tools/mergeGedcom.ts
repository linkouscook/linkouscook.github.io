#!/usr/bin/env ts-node
/* eslint-disable no-control-regex */
/*
  Merge a standalone GEDCOM file into the Cook/Linkous master GED.

  - Master path: public/data/cook_linkous_family.ged
  - Reads an input .ged and appends its INDI/FAM/SOUR/NOTE records
  - Avoids ID collisions by remapping @I*@, @F*@, and @S*@ to new IDs
  - Preserves and/or adds HEAD/TRLR in master as needed
  - Ensures @S1@ (Nathaniel) and @S2@ (Courtney) SOUR records exist
  - For imported records, injects extra citations to @S1@ and @S2@ on BIRT/DEAT/MARR events if not already present

  Usage:
    npx ts-node scripts/merge-gedcom.ts path/to/import.ged

  Optional flags:
    --no-cite   Do not add @S1@/@S2@ citations to imported events
*/

import fs from 'fs'
import path from 'path'

const MASTER_PATH = path.join('public', 'data', 'cook_linkous_family.ged')

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

function todayGedDate(): string {
  const d = new Date()
  const day = String(d.getUTCDate()).padStart(2, '0')
  const mon = MONTHS[d.getUTCMonth()]
  const year = d.getUTCFullYear()
  return `${day} ${mon} ${year}`
}

function readFileOrEmpty(p: string): string {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''
}

function ensureDir(p: string) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
}

function ensureHead(ged: string): string {
  if (/^0\s+HEAD/m.test(ged)) return ged
  const head = [
    '0 HEAD',
    '1 SOUR CookLinkousTool',
    '2 VERS 1.0',
    '2 NAME Cook/Linkous GEDCOM Tool',
    '1 GEDC',
    '2 VERS 5.5.1',
    '2 FORM LINEAGE-LINKED',
    '1 CHAR UTF-8',
    '',
  ].join('\n')
  return head + ged
}

function ensureTrailer(ged: string): string {
  return /\n0\s+TRLR\s*$/.test(ged)
    ? ged
    : ged.replace(/\n?$/, '') + '\n0 TRLR\n'
}

function stripTrailer(ged: string): string {
  return ged.replace(/\n0\s+TRLR\s*$/, '\n')
}

function extractMaxIds(ged: string) {
  let maxI = 0,
    maxF = 0,
    maxS = 0
  const iRe = /^0\s+@(I\d+)@\s+INDI$/gm
  const fRe = /^0\s+@(F\d+)@\s+FAM$/gm
  const sRe = /^0\s+@(S\d+)@\s+SOUR$/gm
  for (const m of ged.matchAll(iRe))
    maxI = Math.max(maxI, Number(m[1].slice(1)))
  for (const m of ged.matchAll(fRe))
    maxF = Math.max(maxF, Number(m[1].slice(1)))
  for (const m of ged.matchAll(sRe))
    maxS = Math.max(maxS, Number(m[1].slice(1)))
  return { maxI, maxF, maxS }
}

function ensureS1S2(ged: string): string {
  const hasS1 = /^0\s+@S1@\s+SOUR/m.test(ged)
  const hasS2 = /^0\s+@S2@\s+SOUR/m.test(ged)
  let add = ''
  const today = todayGedDate()
  if (!hasS1)
    add += [
      '0 @S1@ SOUR',
      '1 TITL Testimony of Nathaniel (Nate) Cook',
      '1 AUTH Nathaniel Cook',
      `1 NOTE First-hand family information provided by Nathaniel (created ${today}).`,
      '',
    ].join('\n')
  if (!hasS2)
    add += [
      '0 @S2@ SOUR',
      '1 TITL Testimony of Courtney Jean Linkous',
      '1 AUTH Courtney Jean Linkous',
      `1 NOTE First-hand family information provided by Courtney (created ${today}).`,
      '',
    ].join('\n')
  if (!add) return ged
  return stripTrailer(ged) + add + '0 TRLR\n'
}

function splitRecords(ged: string): string[] {
  // Return array of 0-level records (HEAD, INDI, FAM, SOUR, NOTE, TRLR)
  // Keep HEAD/TRLR out of merge chunks; we'll manage them separately.
  const blocks: string[] = []
  const cleaned = ged.replace(/\r\n?/g, '\n')
  const lines = cleaned.split('\n')
  let cur: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^0\s+/.test(line)) {
      if (cur.length) blocks.push(cur.join('\n'))
      cur = [line]
    } else {
      cur.push(line)
    }
  }
  if (cur.length) blocks.push(cur.join('\n'))
  return blocks.filter((b) => !/^0\s+HEAD/m.test(b) && !/^0\s+TRLR/m.test(b))
}

function classify(records: string[]) {
  const out = {
    INDI: [] as string[],
    FAM: [] as string[],
    SOUR: [] as string[],
    OTHER: [] as string[],
  }
  for (const r of records) {
    if (/^0\s+@I\d+@\s+INDI/m.test(r)) out.INDI.push(r)
    else if (/^0\s+@F\d+@\s+FAM/m.test(r)) out.FAM.push(r)
    else if (/^0\s+@S\d+@\s+SOUR/m.test(r)) out.SOUR.push(r)
    else out.OTHER.push(r)
  }
  return out
}

function buildIdMap(records: string[], prefix: 'I' | 'F' | 'S', start: number) {
  const map = new Map<string, string>()
  let next = start
  for (const r of records) {
    const m = r.match(new RegExp(`^0\\s+@(${prefix}\\d+)@\\s+`, 'm'))
    if (!m) continue
    const oldId = m[1]
    const newId = `${prefix}${next++}`
    map.set(oldId, newId)
  }
  return { map, next }
}

function remapXrefs(
  block: string,
  maps: {
    I: Map<string, string>
    F: Map<string, string>
    S: Map<string, string>
  },
): string {
  function repl(prefix: 'I' | 'F' | 'S') {
    const re = new RegExp(`@(${prefix}\\d+)@`, 'g')
    return (text: string) =>
      text.replace(re, (_, id) =>
        maps[prefix].get(id) ? `@${maps[prefix].get(id)}@` : `@${id}@`,
      )
  }
  return repl('S')(repl('F')(repl('I')(block)))
}

function injectCitations(block: string, addCite: boolean): string {
  if (!addCite) return block
  const hasS1 = /\n2\s+SOUR\s+@S1@/.test(block)
  const hasS2 = /\n2\s+SOUR\s+@S2@/.test(block)
  const cite = (b: string, tag: 'BIRT' | 'DEAT' | 'MARR') => {
    if (hasS1 && hasS2) return b // already present somewhere in the block
    const re = new RegExp(`(^1 ${tag}[^\n]*\n(?:^(?:2 .*)\n)*)`, 'm')
    if (re.test(b)) {
      // Prevent duplicate insertion if a previous pass added it
      if (!new RegExp('\n2\\s+SOUR\\s+@S1@').test(b))
        b = b.replace(re, (m) => m + '2 SOUR @S1@\n')
      if (!new RegExp('\n2\\s+SOUR\\s+@S2@').test(b))
        b = b.replace(re, (m) => m + '2 SOUR @S2@\n')
    }
    return b
  }
  block = cite(block, 'BIRT')
  block = cite(block, 'DEAT')
  block = cite(block, 'MARR')
  return block
}

function merge(master: string, incoming: string, addCite: boolean) {
  let base = ensureTrailer(ensureHead(master))
  base = ensureS1S2(base)
  base = stripTrailer(base)

  const incRecords = splitRecords(incoming)
  const { INDI, FAM, SOUR, OTHER } = classify(incRecords)

  const ids = extractMaxIds(base)
  let nextI = ids.maxI + 1
  let nextF = ids.maxF + 1
  let nextS = Math.max(ids.maxS, 2) + 1 // keep S1/S2 stable

  const iMap = buildIdMap(INDI, 'I', nextI)
  nextI = iMap.next
  const fMap = buildIdMap(FAM, 'F', nextF)
  nextF = fMap.next
  const sMap = buildIdMap(
    SOUR.filter((s) => !/^0\s+@S1@\s+/.test(s) && !/^0\s+@S2@\s+/.test(s)),
    'S',
    nextS,
  )
  nextS = sMap.next

  const maps = { I: iMap.map, F: fMap.map, S: sMap.map }

  // Append mapped SOUR first (excluding S1/S2 which are ensured already)
  for (const s of SOUR) {
    const isS1S2 = /^0\s+@S(1|2)@\s+SOUR/m.test(s)
    if (isS1S2) continue
    const b = remapXrefs(s, maps)
    base += b.replace(/\n?$/, '') + '\n\n'
  }

  // Append INDI
  for (const i of INDI) {
    let b = remapXrefs(i, maps)
    b = injectCitations(b, addCite)
    base += b.replace(/\n?$/, '') + '\n\n'
  }

  // Append FAM
  for (const f of FAM) {
    let b = remapXrefs(f, maps)
    b = injectCitations(b, addCite)
    base += b.replace(/\n?$/, '') + '\n\n'
  }

  // Other records (NOTE/REPO/OBJE/etc.) — remap and append conservatively
  for (const o of OTHER) {
    const b = remapXrefs(o, maps)
    base += b.replace(/\n?$/, '') + '\n\n'
  }

  base = base.replace(/\n+$/, '\n')
  base += '0 TRLR\n'
  return base
}

async function main() {
  const [, , importPath, ...flags] = process.argv
  if (!importPath) {
    console.error(
      'Usage: ts-node scripts/merge-gedcom.ts <path-to-import.ged> [--no-cite]',
    )
    process.exit(1)
  }
  const addCite = !flags.includes('--no-cite')

  ensureDir(MASTER_PATH)
  const master = ensureTrailer(ensureHead(readFileOrEmpty(MASTER_PATH)))
  const incoming = readFileOrEmpty(importPath)
  if (!incoming.trim()) {
    console.error('Import file is empty or not found:', importPath)
    process.exit(2)
  }

  const merged = merge(master, incoming, addCite)
  fs.writeFileSync(MASTER_PATH, merged, 'utf8')

  const { maxI, maxF, maxS } = extractMaxIds(merged)
  console.log(`Merged into ${MASTER_PATH}`)
  console.log(`Now up to: I${maxI} / F${maxF} / S${maxS}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
