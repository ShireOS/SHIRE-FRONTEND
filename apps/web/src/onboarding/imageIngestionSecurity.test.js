import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const menu = fs.readFileSync(path.join(here, 'components/MenuEditor.tsx'), 'utf8')
const floor = fs.readFileSync(path.join(here, 'components/FloorPlanEditor.tsx'), 'utf8')

test('onboarding analysis uses authenticated server-issued image assets', () => {
  for (const source of [menu, floor]) {
    assert.match(source, /Authorization: token/)
    assert.match(source, /const \{[^}]*asset_id[^}]*\} = await uploadRes\.json\(\)/)
    assert.match(source, /JSON\.stringify\(\{ asset_id \}\)/)
    assert.doesNotMatch(source, /JSON\.stringify\(\{ image_url \}\)/)
  }
})
