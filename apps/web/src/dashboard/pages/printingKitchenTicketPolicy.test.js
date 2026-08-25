import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const page = await readFile(new URL('./PrintingRoutingPage.jsx', import.meta.url), 'utf8')

test('Back Office exposes the hybrid kitchen defaults and legacy choices', () => {
  assert.match(page, /modifier_marker: 'indent', line_density: 'tight'/)
  assert.match(page, /<option value="indent">Indent only \(recommended\)<\/option>/)
  assert.match(page, /<option value="plus">Plus sign<\/option>/)
  assert.match(page, /<option value="tight">Tight impact pitch \(recommended\)<\/option>/)
  assert.match(page, /<option value="standard">Standard printer spacing<\/option>/)
})

test('Back Office accepts renderer v9 and uses the printer-faithful SVG artifact', () => {
  assert.match(page, /'printing-v9'/)
  assert.match(page, /setPreviewSvg\(result\.preview_svg \|\| ''\)/)
  assert.match(page, /<PrinterFaithfulPreview svg=\{previewSvg\}/)
  assert.match(page, /Physical model for preview/)
  assert.match(page, /Choose the model on the printer label/)
})

test('kitchen editing is section-oriented and ticket-top controls have no second advanced gate', async () => {
  assert.match(page, /const KITCHEN_EDITOR_SECTIONS = \[/)
  for (const label of ['Ticket top', 'Items', 'Modifiers', 'Notes', 'Spacing & format', 'Printed names']) {
    assert.match(page, new RegExp(`label: '${label.replace('&', '\\&')}'`))
  }

  const builder = await readFile(new URL('../components/printing/TicketTopBuilder.jsx', import.meta.url), 'utf8')
  assert.match(builder, /Customize ticket top/)
  assert.doesNotMatch(builder, /setAdvanced|>Advanced</)
  assert.match(builder, /renderAddZone\('header'\)/)
  assert.match(builder, /renderAddZone\('info'\)/)
  assert.match(builder, /grid-cols-\[minmax\(0,1fr\)_auto\]/)
  assert.match(builder, /md:grid-cols-2/)
  assert.match(builder, /flex w-full min-w-0 flex-wrap items-center justify-end/)
})

test('impact sizing labels and wrapping guidance describe the physical ticket', () => {
  assert.match(page, /Easy Read · wide \+ tall/)
  assert.match(page, /Large · wide \+ tall/)
  assert.match(page, /Large notes use \{displayedImpactWideColumns\} wide characters/)
  assert.match(page, /“\*\* Gluten allergy \*\*” therefore wraps on the physical printer too/)
  assert.match(page, /63\.4 mm printable area/)
  assert.match(page, /7×9 impact dots/)
})

test('full-document saves rebase edits onto a fresh canonical read', () => {
  assert.match(page, /function mergeChangedPrintingValues/)
  assert.match(page, /const fresh = await fetchPosApi\(restaurantId, `\/restaurants\/\$\{restaurantId\}\/printing-config`/)
  assert.match(page, /mergeChangedPrintingValues\(loadedConfigRef\.current \|\| fresh, config, fresh\)/)
})
