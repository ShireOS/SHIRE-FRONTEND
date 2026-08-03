import assert from 'node:assert/strict'
import test from 'node:test'

import {
  SERVER_RECEIPT_PRESETS,
  SERVER_RECEIPT_SECTION_IDS,
  normalizeServerReceiptTemplate,
  serverReceiptPresetFor,
  toggleServerReceiptSection,
} from './serverReceiptTemplatePolicy.js'

test('standard remains the default and sections stay in canonical receipt order', () => {
  assert.deepEqual(normalizeServerReceiptTemplate({}), {
    size: 'medium',
    sections: SERVER_RECEIPT_PRESETS.standard,
  })
  assert.deepEqual(
    normalizeServerReceiptTemplate({ size: 'large', sections: ['checks', 'sales', 'tax'] }),
    { size: 'large', sections: ['tax', 'sales', 'checks'] },
  )
})

test('minimal allows every optional section to be hidden', () => {
  const minimal = normalizeServerReceiptTemplate({ size: 'compact', sections: [] })
  assert.deepEqual(minimal, { size: 'compact', sections: [] })
  assert.equal(serverReceiptPresetFor(minimal), 'minimal')
  assert.deepEqual(SERVER_RECEIPT_SECTION_IDS, ['tax', 'sales', 'tenders', 'tips', 'checks'])
})

test('granular toggles do not duplicate sections', () => {
  const withChecks = toggleServerReceiptSection({ size: 'medium', sections: SERVER_RECEIPT_PRESETS.standard }, 'checks')
  assert.deepEqual(withChecks.sections, SERVER_RECEIPT_PRESETS.detailed)
  assert.deepEqual(toggleServerReceiptSection(withChecks, 'checks').sections, SERVER_RECEIPT_PRESETS.standard)
})
