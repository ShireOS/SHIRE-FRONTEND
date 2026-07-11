import { dateKeyOf } from './payrollIntervals.js'
import { buildPayrollRows, payrollTotals } from '../pages/payrollExport.js'

export const money = (value) =>
  `$${Number(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const hours = (value) => Number(value ?? 0).toFixed(2)

export function numericRate(value) {
  if (value == null || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

export function makeRateResolver(jobCodes = [], waiters = []) {
  const roleRates = new Map(jobCodes.map((code) => [code.code, numericRate(code.default_hourly_rate) ?? 0]))
  const jobCodeRates = new Map(jobCodes.filter((code) => code.id).map((code) => [code.id, numericRate(code.default_hourly_rate) ?? 0]))
  const waitersById = new Map((waiters || []).filter((waiter) => waiter?.id).map((waiter) => [waiter.id, waiter]))
  return (item) => {
    if (item && typeof item === 'object') {
      const directRate = [item.hourly_rate, item.pay_rate, item.base_hourly_rate]
        .map(numericRate)
        .find((rate) => rate != null)
      if (directRate != null) return directRate
      const waiter = waitersById.get(item.staff_id)
      const waiterRate = numericRate(waiter?.hourly_rate)
      if (waiterRate != null) return waiterRate
      if (waiter?.job_code_id && jobCodeRates.has(waiter.job_code_id)) return jobCodeRates.get(waiter.job_code_id) || 0
      return roleRates.get(item.role_key || item.role) || 0
    }
    return roleRates.get(item) || 0
  }
}

function roleLabel(role, jobCodes = []) {
  const match = jobCodes.find((code) => code.code === role)
  return match?.label || role || 'Unassigned'
}

function addToGroup(map, key, patch) {
  const row = map.get(key) || {
    key,
    label: patch.label || key,
    hours: 0,
    wages: 0,
    tips: 0,
    gross: 0,
    entries: 0,
    missingRate: false,
    children: [],
  }
  row.hours += Number(patch.hours || 0)
  row.wages += Number(patch.wages || 0)
  row.tips += Number(patch.tips || 0)
  row.gross = row.wages + row.tips
  row.entries += Number(patch.entries || 0)
  row.missingRate = row.missingRate || Boolean(patch.missingRate)
  if (patch.child) row.children.push(patch.child)
  map.set(key, row)
}

export function summarizeLaborCost({ timeReport, payRuns, jobCodes, waiters, rateFor }) {
  const staffById = new Map((waiters || []).map((w) => [w.id, w]))
  const roleRows = new Map()
  const employeeRows = new Map()
  const dayRows = new Map()

  ;(timeReport?.entries || []).forEach((entry) => {
    if (entry.voided_at || entry.status === 'voided') return
    const staff = staffById.get(entry.staff_id)
    const role = entry.role || staff?.role || 'unassigned'
    const roleName = roleLabel(role, jobCodes)
    const staffName = entry.staff_name || staff?.name || 'Unknown'
    const workedHours = Number(entry.worked_minutes || 0) / 60
    const inferredRate = rateFor?.({ staff_id: entry.staff_id, role_key: role, role }) || 0
    const wageCost = entry.labor_cost == null ? workedHours * inferredRate : Number(entry.labor_cost)
    const missingRate = entry.labor_cost == null && !inferredRate
    const day = entry.clock_in_at ? dateKeyOf(new Date(entry.clock_in_at)) : 'unknown'
    const child = {
      staff_id: entry.staff_id,
      staff_name: staffName,
      role,
      day,
      hours: workedHours,
      wages: wageCost,
      tips: 0,
      gross: wageCost,
      missingRate,
    }
    addToGroup(roleRows, role, { label: roleName, hours: workedHours, wages: wageCost, entries: 1, missingRate, child })
    addToGroup(employeeRows, entry.staff_id || staffName, { label: staffName, hours: workedHours, wages: wageCost, entries: 1, missingRate, child })
    addToGroup(dayRows, day, { label: day, hours: workedHours, wages: wageCost, entries: 1, missingRate, child })
  })

  ;(payRuns || []).forEach((run) => {
    const rows = buildPayrollRows(run?.payouts || [], rateFor)
    rows.forEach((row, index) => {
      const payout = run.payouts[index] || {}
      const role = row.role_key || payout.role_key || 'unassigned'
      const roleName = roleLabel(role, jobCodes)
      const staffKey = payout.staff_id || row.staff_name
      const runDay = run.window_start ? dateKeyOf(new Date(run.window_start)) : 'pay-run'
      const tip = Number(row.tips_net || 0)
      if (!tip) return
      const child = {
        staff_id: payout.staff_id,
        staff_name: row.staff_name,
        role,
        day: runDay,
        hours: 0,
        wages: 0,
        tips: tip,
        gross: tip,
        missingRate: false,
      }
      addToGroup(roleRows, role, { label: roleName, tips: tip, child })
      addToGroup(employeeRows, staffKey, { label: row.staff_name, tips: tip, child })
      addToGroup(dayRows, runDay, { label: runDay, tips: tip, child })
    })
  })

  const totals = [...employeeRows.values()].reduce((acc, row) => ({
    hours: acc.hours + row.hours,
    wages: acc.wages + row.wages,
    tips: acc.tips + row.tips,
    gross: acc.gross + row.gross,
    missingRate: acc.missingRate || row.missingRate,
  }), { hours: 0, wages: 0, tips: 0, gross: 0, missingRate: false })

  const withShare = (rows) => [...rows.values()]
    .map((row) => ({ ...row, share: totals.gross > 0 ? row.gross / totals.gross : 0 }))
    .sort((a, b) => b.gross - a.gross || a.label.localeCompare(b.label))

  return {
    totals,
    byRole: withShare(roleRows),
    byEmployee: withShare(employeeRows),
    byDay: withShare(dayRows).sort((a, b) => String(a.key).localeCompare(String(b.key))),
    payrollTotals: payrollTotals((payRuns || []).flatMap((run) => buildPayrollRows(run?.payouts || [], rateFor))),
  }
}

export function exportLaborCostCsv(summary, interval, restaurantName) {
  const headers = ['Group', 'Name', 'Hours', 'Wages', 'Tips', 'Total labor', 'Share']
  const lines = [headers.join(',')]
  ;[
    ['Role', summary.byRole],
    ['Employee', summary.byEmployee],
    ['Day', summary.byDay],
  ].forEach(([group, rows]) => {
    rows.forEach((row) => {
      lines.push([
        group,
        csvCell(row.label),
        row.hours.toFixed(2),
        row.wages.toFixed(2),
        row.tips.toFixed(2),
        row.gross.toFixed(2),
        `${(row.share * 100).toFixed(1)}%`,
      ].join(','))
    })
  })
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `labor-cost-${slug(restaurantName)}-${interval.start}-${interval.end}.csv`)
}

export function exportLaborCostPdf(summary, interval, restaurantName) {
  const win = window.open('', '_blank', 'width=920,height=1100')
  if (!win) {
    alert('Pop-up blocked. Allow pop-ups for this site to export the PDF.')
    return
  }
  const rowHtml = (rows) => rows.map((row) => `
    <tr>
      <td class="l b">${esc(row.label)}</td>
      <td>${row.hours.toFixed(2)}</td>
      <td>$${num(row.wages)}</td>
      <td>$${num(row.tips)}</td>
      <td class="b">$${num(row.gross)}</td>
      <td>${(row.share * 100).toFixed(1)}%</td>
    </tr>
  `).join('')
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Labor Cost</title>
  <style>
    body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#181818;margin:0;padding:32px}
    h1{font-size:22px;margin:0 0 4px}.sub{color:#666;font-size:12px;margin-bottom:18px}
    .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px}
    .card{border:1px solid #ddd;border-radius:10px;padding:12px}.k{font-size:10px;color:#777;text-transform:uppercase;letter-spacing:.06em}.v{font-size:18px;font-weight:700;margin-top:4px}
    h2{font-size:15px;margin:20px 0 8px}table{width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums}
    th,td{padding:7px 9px;text-align:right;border-bottom:1px solid #e5e5e5}th.l,td.l{text-align:left}thead th{font-size:10px;text-transform:uppercase;color:#777;border-bottom:1.5px solid #333}.b{font-weight:700}
  </style></head><body>
    <h1>${esc(restaurantName || 'Labor Cost')}</h1>
    <div class="sub">${esc(interval.start)} - ${esc(interval.end)}</div>
    <div class="cards">
      <div class="card"><div class="k">Total labor</div><div class="v">$${num(summary.totals.gross)}</div></div>
      <div class="card"><div class="k">Wages</div><div class="v">$${num(summary.totals.wages)}</div></div>
      <div class="card"><div class="k">Tips</div><div class="v">$${num(summary.totals.tips)}</div></div>
      <div class="card"><div class="k">Hours</div><div class="v">${summary.totals.hours.toFixed(2)}</div></div>
    </div>
    <h2>By role</h2>${table(rowHtml(summary.byRole))}
    <h2>By employee</h2>${table(rowHtml(summary.byEmployee))}
    <h2>By day</h2>${table(rowHtml(summary.byDay))}
    <script>window.onload=function(){window.print()}<\/script>
  </body></html>`)
  win.document.close()
}

function table(rows) {
  return `<table><thead><tr><th class="l">Name</th><th>Hours</th><th>Wages</th><th>Tips</th><th>Total</th><th>Share</th></tr></thead><tbody>${rows}</tbody></table>`
}

function csvCell(value) {
  const str = String(value ?? '')
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function slug(value) {
  return String(value || 'report').replace(/\s+/g, '-').toLowerCase()
}

function esc(str) {
  return String(str ?? '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]))
}

function num(value) {
  return Number(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
