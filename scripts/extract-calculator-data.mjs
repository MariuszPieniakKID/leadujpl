import fs from 'fs'
import path from 'path'
import * as XLSX from 'xlsx/xlsx.mjs'

XLSX.set_fs(fs)

const ROOT = process.cwd()
// Prefer explicit Bazówka file if present
let xlsxPath = ''
const direct = path.join(ROOT, 'Bazówka 585 (1).xlsx') // with combining accent
const directAlt = path.join(ROOT, 'Bazówka 585 (1).xlsx') // precomposed
if (fs.existsSync(direct)) xlsxPath = direct
else if (fs.existsSync(directAlt)) xlsxPath = directAlt
else {
  // robust diacritics-insensitive scan
  function stripDiacritics(s) { try { return s.normalize('NFD').replace(/\p{Diacritic}+/gu, '') } catch { return s } }
  const preferred = ['bazowka 585 (1).xlsx', 'kalkulator b2c_08.2025.xlsx']
  const files = fs.readdirSync(ROOT)
  for (const name of files) {
    if (!name.toLowerCase().endsWith('.xlsx')) continue
    const plain = stripDiacritics(name.toLowerCase())
    if (preferred.some(p => plain.includes(stripDiacritics(p)))) { xlsxPath = path.join(ROOT, name); break }
  }
  if (!xlsxPath) {
    const any = files.find(n => n.toLowerCase().endsWith('.xlsx'))
    if (any) xlsxPath = path.join(ROOT, any)
  }
}
if (!xlsxPath || !fs.existsSync(xlsxPath)) {
  console.error('XLSX not found in project root')
  process.exit(1)
}

const wb = XLSX.readFile(xlsxPath)

function sheetToArray(ws, opts = {}) {
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false, ...opts })
}

// Gather existing settings (keep grants etc. if already curated)
let existingSettings = {}
try {
  const bePath = path.join(ROOT, 'backend', 'src', 'data', 'calculatorData.json')
  if (fs.existsSync(bePath)) {
    const cur = JSON.parse(fs.readFileSync(bePath, 'utf8'))
    if (cur && cur.settings) existingSettings = cur.settings
  }
} catch {}

// Extract from sheet FOTOWOLTAIKA
const pvWs = wb.Sheets['FOTOWOLTAIKA']
const pvRows = pvWs ? sheetToArray(pvWs) : []

function findHeaderRow(rowsArr) {
  for (let i = 0; i < Math.min(rowsArr.length, 50); i++) {
    const r = rowsArr[i] || []
    const a = String(r[0] || '').trim().toLowerCase()
    const b = String(r[1] || '').trim().toLowerCase()
    if ((a.includes('moc') && b.includes('modu')) || (a.includes('moc instalacji') && b)) return i
  }
  return -1
}

const headerRowIdx = findHeaderRow(pvRows)
const pvPowerPriceD = {}
const pvPowerPriceE = {}
const inverterMap = {}
const batteryMap = {}

function formatPowerLabel(v) {
  if (v == null || v === '') return ''
  const num = Number(String(v).toString().replace(',', '.'))
  if (!isFinite(num)) return String(v)
  const s = (Math.round(num * 100) / 100).toFixed(2).replace('.', ',')
  return s.replace(/,(00|0)$/,'').replace(/,$/,'')
}

if (headerRowIdx >= 0) {
  for (let i = headerRowIdx + 1; i < pvRows.length; i++) {
    const r = pvRows[i] || []
    const power = r[0]
    const modules = r[1]
    const priceD = r[2]
    const priceE = r[3]
    const battKey = r[4]
    const battPrice = r[5]
    const invKey = r[6]
    const invPrice = r[7]
    // Stop PV sequence if row is empty entirely
    const anyVal = r.some(v => v !== '' && v != null)
    if (!anyVal) continue
    // PV
    if (power !== '' && modules !== '' && (priceD !== '' || priceE !== '')) {
      const key = `${formatPowerLabel(power)} kW – ${String(modules).trim()} paneli`
      if (priceD !== '' && !isNaN(Number(priceD))) pvPowerPriceD[key] = Number(priceD)
      if (priceE !== '' && !isNaN(Number(priceE))) pvPowerPriceE[key] = Number(priceE)
    }
    // Batteries can appear on these rows as well
    if (battKey && String(battKey).toString().trim()) {
      const label = String(battKey).toString().replace(/\s+/g, ' ').trim().replace(/kwh/i, 'kWh')
      if (battPrice !== '' && !isNaN(Number(battPrice))) batteryMap[label] = Number(battPrice)
    }
    // Inverters block appears further down after headers in row ~15
    if (invKey && String(invKey).toString().trim()) {
      const label = String(invKey).toString().trim()
      if (invPrice !== '' && !isNaN(Number(invPrice))) inverterMap[label] = Number(invPrice)
    }
  }
}

const out = {
  settings: existingSettings,
  pricing: {
    pvPowerPriceD,
    pvPowerPriceE,
    inverterMap,
    batteryMap,
    headers: [],
  }
}

// Write to frontend data (fallback for offline/dev)
const outDirFE = path.join(ROOT, 'frontend', 'src', 'data')
fs.mkdirSync(outDirFE, { recursive: true })
const outPathFE = path.join(outDirFE, 'calculatorData.json')
fs.writeFileSync(outPathFE, JSON.stringify(out, null, 2), 'utf8')
console.log('Wrote', path.relative(ROOT, outPathFE))

// Write also to backend embedded data used to bootstrap/sync config
const outDirBE = path.join(ROOT, 'backend', 'src', 'data')
fs.mkdirSync(outDirBE, { recursive: true })
const outPathBE = path.join(outDirBE, 'calculatorData.json')
fs.writeFileSync(outPathBE, JSON.stringify(out, null, 2), 'utf8')
console.log('Wrote', path.relative(ROOT, outPathBE))


