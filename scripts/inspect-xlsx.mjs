import fs from 'fs'
import path from 'path'
import * as XLSX from 'xlsx/xlsx.mjs'

const ROOT = process.cwd()
// Pick first matching Excel in root (prefer Bazówka)
function strip(s){ try { return s.normalize('NFD').replace(/\p{Diacritic}+/gu, '') } catch { return s } }
const files = fs.readdirSync(ROOT)
let filePath = ''
const preferred = ['bazowka 585', 'kalkulator b2c']
for (const f of files) {
  if (!f.toLowerCase().endsWith('.xlsx')) continue
  const plain = strip(f.toLowerCase())
  if (preferred.some(p => plain.includes(p))) { filePath = path.join(ROOT, f); break }
}
if (!filePath) {
  const any = files.find(n => n.toLowerCase().endsWith('.xlsx'))
  if (any) filePath = path.join(ROOT, any)
}
if (!filePath || !fs.existsSync(filePath)) {
  console.error('File not found in root')
  process.exit(1)
}

XLSX.set_fs(fs)
const wb = XLSX.readFile(filePath, { cellFormula: true, cellNF: true, cellDates: true })

console.log('Using:', path.basename(filePath))
console.log('Sheets:')
console.log(wb.SheetNames.map((n, i) => `${i + 1}. ${n}`).join('\n'))

const names = wb?.Workbook?.Names || []
if (names.length) {
  console.log('\nDefined Names:')
  for (const n of names) {
    console.log(`- ${n.Name}: ${n.Ref || n.Ref3D || ''}`)
  }
}

function collectHeaders(ws) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1')
  const firstRow = []
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const addr = XLSX.utils.encode_cell({ r: range.s.r, c: C })
    const cell = ws[addr]
    firstRow.push(cell ? (cell.v ?? '') : '')
  }
  return firstRow
}

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName]
  const headers = collectHeaders(ws)
  console.log(`\nSheet: ${sheetName}`)
  console.log(`- Cells: ${(ws['!ref'] || '').toString()}`)
  console.log(`- Headers: ${headers.map(h => String(h)).join(' | ')}`)
}

// Dump sample grid for FOTOWOLTAIKA first 40 rows, cols A..O
const target = wb.Sheets['FOTOWOLTAIKA']
if (target) {
  console.log('\nSample FOTOWOLTAIKA (A1:O40):')
  const cols = 'ABCDEFGHIJKLMNOPQRSTUV'.split('').slice(0, 15)
  for (let r = 1; r <= 40; r++) {
    const row = cols.map(col => {
      const addr = `${col}${r}`
      const cell = target[addr]
      const v = cell ? (cell.v ?? '') : ''
      return String(v)
    })
    console.log(`${r}\t` + row.join('\t'))
  }
}


