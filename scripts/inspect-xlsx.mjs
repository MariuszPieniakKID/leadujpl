import fs from 'fs'
import path from 'path'
import * as XLSX from 'xlsx/xlsx.mjs'

const ROOT = process.cwd()
const filePath = path.join(ROOT, 'Kalkulator B2C_08.2025.xlsx')
if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath)
  process.exit(1)
}

XLSX.set_fs(fs)
const wb = XLSX.readFile(filePath, { cellFormula: true, cellNF: true, cellDates: true })

console.log('Sheets:')
console.log(wb.SheetNames.map((n, i) => `${i + 1}. ${n}`).join('\n'))

const names = wb?.Workbook?.Names || []
if (names.length) {
  console.log('\nDefined Names:')
  for (const n of names) {
    console.log(`- ${n.Name}: ${n.Ref || n.Ref3D || ''}`)
  }
}

function collectFormulas(ws, max = 20) {
  const out = []
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1')
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C })
      const cell = ws[addr]
      if (!cell) continue
      if (cell.f) {
        out.push({ addr, f: cell.f, v: cell.v })
        if (out.length >= max) return out
      }
    }
  }
  return out
}

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName]
  const formulas = collectFormulas(ws, 20)
  console.log(`\nSheet: ${sheetName}`)
  console.log(`- Cells: ${(ws['!ref'] || '').toString()}`)
  console.log(`- Formula samples (${formulas.length}):`)
  for (const f of formulas) {
    console.log(`  ${f.addr} = ${f.f}`)
  }
}


