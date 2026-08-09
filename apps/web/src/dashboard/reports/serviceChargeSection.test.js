import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
const reportsPage = read('./RestaurantReportsPage.jsx')
const salesSection = () => reportsPage.split('function SalesRevenue(')[1].split('\nfunction ')[0]

test('service charges are read off the sales_revenue payload', () => {
  const section = salesSection()
  assert.match(section, /const chargeRows = section\.service_charges\?\.by_charge \|\| \[\]/)
  assert.match(section, /const chargeSections = section\.service_charges\?\.by_section \|\| \[\]/)
  assert.match(section, /const hasServiceCharges = allServiceCharges !== 0 \|\| hasEmployeeGratuity \|\| hasRestaurantCharges \|\| hasUnclassifiedCharges/)
})

test('employee gratuity is excluded from restaurant service-charge revenue', () => {
  const section = salesSection()
  assert.ok(section.includes('label="Net revenue" value={money(summary.net_revenue)}'), 'net revenue was redefined')
  assert.ok(section.includes('label="Employee gratuity" value={money(employeeGratuity)}'), 'missing employee gratuity tile')
  assert.ok(section.includes('label="Restaurant service charges" value={money(restaurantServiceCharges)}'), 'missing restaurant charge tile')
  assert.ok(section.includes('label="Net revenue + restaurant charges" value={money(revenueWithRestaurantCharges)}'), 'missing restaurant-revenue combined tile')
  assert.ok(section.includes('comparison={comparison.restaurant_service_charges}'), 'restaurant charges have no period comparison')
  assert.ok(section.includes('comparison={comparison.net_revenue_with_restaurant_service_charges}'), 'combined restaurant revenue has no period comparison')
})

test('restaurants with no charges or gratuity see no ownership breakdown', () => {
  const section = salesSection()
  assert.match(section, /\{hasRestaurantCharges && <Stat label="Restaurant service charges"/)
  assert.match(section, /\{hasRestaurantCharges && <Stat label="Net revenue \+ restaurant charges"/)
  assert.match(section, /\{hasServiceCharges && <div className="mt-5"><h3 className="mb-2 text-sm font-semibold">Charges &amp; gratuity<\/h3>/)
})

test('the breakdown tables render by charge and, when there is more than one, by section', () => {
  const section = salesSection()
  assert.ok(section.includes('rows={chargeRows}'), 'missing by-charge table')
  assert.ok(section.includes('{chargeSections.length > 1 && '), 'by-section table is not conditional')
  assert.ok(section.includes('rows={chargeSections}'), 'missing by-section table')
  for (const label of ['Charge', 'Applied by', 'Effective rate', 'Tax on charge']) {
    assert.ok(section.includes(`label: '${label}'`), `missing column ${label}`)
  }
})

test('the copy distinguishes employee gratuity from restaurant revenue and avoids duplicate tax', () => {
  const section = salesSection()
  assert.match(section, /Employee-owned gratuity is tip earnings and is not restaurant revenue/)
  assert.match(section, /Restaurant-owned service charges remain revenue/)
  assert.match(section, /already included in the tax summary/)
})
