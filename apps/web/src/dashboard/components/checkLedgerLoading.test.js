import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./CheckLedgerSection.jsx', import.meta.url), 'utf8')

test('tab changes replace stale check rows with a labeled loading state', () => {
  assert.doesNotMatch(source, /keepPreviousData/)
  assert.match(source, /Loading \{tab === 'active' \? 'active' : tab === 'closed' \? 'closed' : 'check history'\} checks/)
  assert.match(source, /<LoaderCircle[^>]+animate-spin/)
})

