import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseTournamentImport } from '../src/lib/import/json-import.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const demosDir = path.join(__dirname, '..', 'public', 'demos')
const files = fs.readdirSync(demosDir).filter(f => f.endsWith('.json'))
let allOk = true
for (const f of files) {
  const raw = fs.readFileSync(path.join(demosDir, f), 'utf-8')
  const result = parseTournamentImport(raw)
  console.log(f, '=>', result.ok ? 'OK' : `FAIL: ${result.error}`)
  if (!result.ok) allOk = false
}
if (!allOk) process.exit(1)
