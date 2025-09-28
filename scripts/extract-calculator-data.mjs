import fs from 'fs'
import path from 'path'
import * as XLSX from 'xlsx/xlsx.mjs'

XLSX.set_fs(fs)

const ROOT = process.cwd()
// Prefer the new Bazówka file if present
const candidateFiles = [
  'Bazówka 585 (1).xlsx',
  'Bazówka 585 (1).xlsx',
  'Kalkulator B2C_08.2025.xlsx',
]
let xlsxPath = ''
for (const f of candidateFiles) {
  const p = path.join(ROOT, f)
  if (fs.existsSync(p)) { xlsxPath = p; break }
}
if (!fs.existsSync(xlsxPath)) {
  console.error('XLSX not found:', xlsxPath)
  process.exit(1)
}

const wb = XLSX.readFile(xlsxPath)

function sheetToArray(ws, opts = {}) {
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false, ...opts })
}

// Extract USTAWIENIA (A:B -> key/value by first non-empty header)
const ustawieniaWs = wb.Sheets['USTAWIENIA']
const ustawieniaRows = ustawieniaWs ? sheetToArray(ustawieniaWs) : []
const settings = {}
for (const row of ustawieniaRows) {
  if (!row || row.length < 2) continue
  const key = String(row[0] || '').trim()
  const valRaw = row[1]
  if (!key) continue
  settings[key] = valRaw
}

// Extract CENNIKI into structured maps
const cennikiWs = wb.Sheets['CENNIKI']
const cennikiRows = cennikiWs ? sheetToArray(cennikiWs) : []
// Assume headers in first row
let headers = []
if (cennikiRows.length > 0) {
  headers = cennikiRows[0].map(h => String(h || '').trim())
}
const body = cennikiRows.slice(1)
const rows = body.map(r => {
  const obj = {}
  headers.forEach((h, i) => { obj[h || `COL${i}`] = r[i] })
  return obj
})

// Try to infer key columns by header names or fall back to lettered columns
function pick(colNameVariants, fallbackIndex) {
  for (const name of colNameVariants) {
    const idx = headers.findIndex(h => h.toLowerCase() === name.toLowerCase())
    if (idx >= 0) return headers[idx]
  }
  return headers[fallbackIndex] || null
}

const colPowerKey = pick(['Moc','Power','C'], 2) // original formula: key in column C
const colPriceD = headers[3] || null // D
const colPriceE = headers[4] || null // E

const colInvKey = pick(['Model inwertera + magazyn','Inwerter+Magazyn','F'], 5) // F
const colInvPrice = headers[6] || null // G

const colBattKey = pick(['Pojemność magazynu','Bateria','H'], 7) // H
const colBattPrice = headers[8] || null // I

const pvPowerPriceD = {}
const pvPowerPriceE = {}
const inverterMap = {}
const batteryMap = {}

for (const r of rows) {
  if (colPowerKey && (colPriceD || colPriceE)) {
    const key = String(r[colPowerKey] || '').trim()
    if (key) {
      if (colPriceD && r[colPriceD] !== undefined && r[colPriceD] !== '') pvPowerPriceD[key] = r[colPriceD]
      if (colPriceE && r[colPriceE] !== undefined && r[colPriceE] !== '') pvPowerPriceE[key] = r[colPriceE]
    }
  }
  if (colInvKey && colInvPrice) {
    const key = String(r[colInvKey] || '').trim()
    if (key) inverterMap[key] = r[colInvPrice]
  }
  if (colBattKey && colBattPrice) {
    const key = String(r[colBattKey] || '').trim()
    if (key) batteryMap[key] = r[colBattPrice]
  }
}

const out = {
  settings,
  pricing: {
    pvPowerPriceD,
    pvPowerPriceE,
    inverterMap,
    batteryMap,
    headers,
  }
}

const outDir = path.join(ROOT, 'frontend', 'src', 'data')
fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, 'calculatorData.json')
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8')
console.log('Wrote', path.relative(ROOT, outPath))


