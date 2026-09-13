#!/usr/bin/env node
// Brand check for a generated video component: The Buy Box's rules, never its
// layouts. Every video designs its own scenes; this only makes sure they stay
// inside the brand. The Assembly stage runs it and fixes what it reports
// before rendering; CI runs it again and turns anything left into a warning.
//
//   node brand-lint.mjs src/SomeVideo.tsx     exits 1 when something is off
import fs from 'node:fs'

const file = process.argv[2]
if (!file) {
  console.error('usage: node brand-lint.mjs <component.tsx>')
  process.exit(2)
}
const src = fs.readFileSync(file, 'utf8')
const lineOf = (i) => src.slice(0, i).split('\n').length
const problems = []
const at = (i, msg) => problems.push(`${file}:${lineOf(i)}: ${msg}`)
const once = (msg) => problems.push(`${file}: ${msg}`)

const PALETTE = ['#000000', '#FFFFFF', '#E6E7E8', '#6A6E72', '#FF5A1F', '#0E7A42']

// Colours: only the six brand colours, flat.
for (const m of src.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
  let h = m[0].toUpperCase()
  if (h.length === 4) h = '#' + [...h.slice(1)].map((c) => c + c).join('')
  if (h.length === 9) h = h.slice(0, 7)
  if (!PALETTE.includes(h)) at(m.index, `colour ${m[0]} is not a brand colour; use BLACK, WHITE, CONCRETE, GRAPHITE, ORANGE or GREEN from ./brand`)
}
for (const m of src.matchAll(/\b(rgba?|hsla?)\(([^)]*)\)/g)) {
  const [r, g, b] = m[2].split(/[\s,/]+/).filter(Boolean).map(Number)
  const blackOrWhite = m[1].startsWith('rgb') && ((r === 0 && g === 0 && b === 0) || (r === 255 && g === 255 && b === 255))
  if (!blackOrWhite) at(m.index, `colour ${m[0]} is not a brand colour`)
}
for (const m of src.matchAll(/gradient\(/g)) at(m.index, 'gradients are off-brand: flat colour only')
for (const m of src.matchAll(/\b(boxShadow|textShadow)\s*:/g)) at(m.index, `${m[1]} is off-brand: the look is flat; put text in a solid box instead`)
for (const m of src.matchAll(/borderRadius\s*:\s*(\d+(?:\.\d+)?)\b/g)) {
  if (Number(m[1]) > 0) at(m.index, `borderRadius ${m[1]}: the brand is square-cornered ("50%" for a true circle is fine)`)
}

// Fonts: Archivo and Inter, through ./brand.
if (!/from\s+["']\.\/brand["']/.test(src)) once('does not import from ./brand, the only source for colours, fonts, logo and safe zone')
for (const m of src.matchAll(/from\s+["']\.\/(tokens|fonts|components\/[^"']+)["']/g)) at(m.index, `imports ./${m[1]}, the old look; use ./brand and design the scene here`)
for (const m of src.matchAll(/fontFamily\s*:\s*(["'`])([^"'`]*)\1/g)) {
  if (!m[2].includes('${')) at(m.index, `fontFamily "${m[2]}" is hard-coded; use HEAD (Archivo) or BODY (Inter) from ./brand`)
}
for (const m of src.matchAll(/AgencyFB|Fraunces/g)) at(m.index, `${m[0]} is the old typeface`)

// Size: nothing small.
for (const m of src.matchAll(/fontSize\s*(?::|=\{)\s*(\d+(?:\.\d+)?)\b/g)) {
  if (Number(m[1]) < 40) at(m.index, `fontSize ${m[1]} is below the 40px floor (MIN_TEXT)`)
}

// Every video: captions, and a closing frame with the logo and the follow ask.
if (!/<Captions\b/.test(src)) once('no <Captions> overlay; every video carries the synced captions')
if (!/LOGO_(WHITE|BLACK)/.test(src)) once('the logo never appears; the closing frame shows LOGO_WHITE (on black) or LOGO_BLACK (on white) from ./brand')
if (!/\bHANDLE\b|@thebuyboxre/.test(src)) once('no follow ask; the closing frame shows HANDLE (@thebuyboxre) from ./brand')

if (problems.length) {
  console.log(problems.join('\n'))
  console.log(`\n${problems.length} brand problem(s). Fix them and run this again.`)
  process.exit(1)
}
console.log(`${file}: brand check passed`)
