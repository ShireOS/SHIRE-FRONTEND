import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./HomepageWidgets.jsx', import.meta.url), 'utf8')

test('sales trend renders a dedicated numeric net sales series', () => {
  assert.match(source, /SalesTrendChart rows=\{trendData\.rows\}/)
  assert.match(source, /net_sales: Number\(row\.net_sales \|\| 0\)/)
  assert.match(source, /dataKey="net_sales"/)
  assert.match(source, /const netSalesWidget = \{ \.\.\.widget, primary_column: 'net_sales'/)
})
