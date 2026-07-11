// Client-side payroll exports for the Payroll & Tips hub.
// No dependencies: CSV is a Blob download; PDF is a print window the browser
// turns into a PDF via "Save as PDF" (how most small shops file pay runs).

function money(value) {
  const num = Number(value ?? 0)
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function windowLabel(run) {
  const start = fmtDate(run?.window_start)
  const end = fmtDate(run?.window_end)
  return start === end || !end ? start : `${start} – ${end}`
}

// Build a flat, export-ready row per payout. rateFor(payout) -> hourly rate.
export function buildPayrollRows(payouts, rateFor) {
  return (payouts || []).map(p => {
    const hours = Number(p.hours_worked ?? 0)
    const rate = Number(rateFor?.(p) ?? 0)
    const baseWage = hours * rate
    const tipsNet = Number(p.final_amount ?? 0) // tips take-home after pool/tipout/adjustment
    return {
      staff_name: p.staff_name || 'Unknown',
      role_key: p.role_key || '',
      hours,
      rate,
      base_wage: baseWage,
      tips_collected: Number(p.tips_collected ?? 0),
      pool_share: Number(p.pool_share ?? 0),
      tipout_paid: Number(p.tipout_paid ?? 0),
      tipout_received: Number(p.tipout_received ?? 0),
      adjustment: Number(p.adjustment ?? 0),
      tips_net: tipsNet,
      gross_pay: baseWage + tipsNet,
    }
  })
}

export function payrollTotals(rows) {
  return (rows || []).reduce((acc, r) => ({
    hours: acc.hours + r.hours,
    base_wage: acc.base_wage + r.base_wage,
    tips_collected: acc.tips_collected + r.tips_collected,
    pool_share: acc.pool_share + r.pool_share,
    tipout_paid: acc.tipout_paid + r.tipout_paid,
    tipout_received: acc.tipout_received + r.tipout_received,
    tips_net: acc.tips_net + r.tips_net,
    gross_pay: acc.gross_pay + r.gross_pay,
  }), { hours: 0, base_wage: 0, tips_collected: 0, pool_share: 0, tipout_paid: 0, tipout_received: 0, tips_net: 0, gross_pay: 0 })
}

const CSV_HEADERS = [
  'Employee', 'Role', 'Hours', 'Rate', 'Base wage', 'Tips collected',
  'Pool share', 'Tipout paid', 'Tipout received', 'Adjustment', 'Tips net', 'Gross pay',
]

function csvCell(value) {
  const str = String(value ?? '')
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

export function exportPayrollCsv(run, rows, restaurantName) {
  const lines = [CSV_HEADERS.join(',')]
  rows.forEach(r => {
    lines.push([
      csvCell(r.staff_name), csvCell(r.role_key), r.hours.toFixed(2), r.rate.toFixed(2),
      r.base_wage.toFixed(2), r.tips_collected.toFixed(2), r.pool_share.toFixed(2),
      r.tipout_paid.toFixed(2), r.tipout_received.toFixed(2), r.adjustment.toFixed(2),
      r.tips_net.toFixed(2), r.gross_pay.toFixed(2),
    ].join(','))
  })
  const totals = payrollTotals(rows)
  lines.push([
    'TOTALS', '', totals.hours.toFixed(2), '', totals.base_wage.toFixed(2), totals.tips_collected.toFixed(2),
    totals.pool_share.toFixed(2), totals.tipout_paid.toFixed(2), totals.tipout_received.toFixed(2),
    '', totals.tips_net.toFixed(2), totals.gross_pay.toFixed(2),
  ].join(','))

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `payroll-${(restaurantName || 'run').replace(/\s+/g, '-').toLowerCase()}-${windowLabel(run).replace(/\s+/g, '')}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function esc(str) {
  return String(str ?? '').replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]))
}

// Opens a print-ready window. "summary" => one totals sheet; "stubs" => one page per employee.
export function exportPayrollPdf(run, rows, restaurantName, variant = 'summary') {
  const win = window.open('', '_blank', 'width=900,height=1100')
  if (!win) {
    alert('Pop-up blocked. Allow pop-ups for this site to export the PDF pay run.')
    return
  }
  const totals = payrollTotals(rows)
  const title = `${restaurantName || 'Payroll'} — ${windowLabel(run)}`

  const summaryTable = `
    <table>
      <thead><tr>
        <th class="l">Employee</th><th class="l">Role</th><th>Hours</th><th>Base wage</th>
        <th>Tips net</th><th>Gross pay</th>
      </tr></thead>
      <tbody>
        ${rows.map(r => `<tr>
          <td class="l b">${esc(r.staff_name)}</td>
          <td class="l muted">${esc(r.role_key)}</td>
          <td>${r.hours.toFixed(2)}</td>
          <td>$${money(r.base_wage)}</td>
          <td>$${money(r.tips_net)}</td>
          <td class="b">$${money(r.gross_pay)}</td>
        </tr>`).join('')}
      </tbody>
      <tfoot><tr>
        <td class="l b">Totals · ${rows.length} staff</td><td></td>
        <td>${totals.hours.toFixed(2)}</td><td>$${money(totals.base_wage)}</td>
        <td>$${money(totals.tips_net)}</td><td>$${money(totals.gross_pay)}</td>
      </tr></tfoot>
    </table>`

  const stubs = rows.map(r => `
    <section class="stub">
      <div class="stubhdr">
        <div><div class="who">${esc(r.staff_name)}</div><div class="muted">${esc(r.role_key)}</div></div>
        <div class="muted r">${esc(title)}</div>
      </div>
      <table class="kv">
        <tr><td>Hours worked</td><td class="r">${r.hours.toFixed(2)}</td></tr>
        <tr><td>Hourly rate</td><td class="r">$${money(r.rate)}</td></tr>
        <tr><td>Base wage</td><td class="r">$${money(r.base_wage)}</td></tr>
        <tr><td>Tips collected</td><td class="r">$${money(r.tips_collected)}</td></tr>
        <tr><td>Pool share</td><td class="r">$${money(r.pool_share)}</td></tr>
        <tr><td>Tipout paid</td><td class="r">−$${money(r.tipout_paid)}</td></tr>
        <tr><td>Tipout received</td><td class="r">+$${money(r.tipout_received)}</td></tr>
        ${r.adjustment ? `<tr><td>Adjustment</td><td class="r">$${money(r.adjustment)}</td></tr>` : ''}
        <tr><td>Tips take-home</td><td class="r">$${money(r.tips_net)}</td></tr>
        <tr class="grand"><td>Gross pay</td><td class="r">$${money(r.gross_pay)}</td></tr>
      </table>
    </section>`).join('')

  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;margin:0;padding:32px}
    h1{font-size:20px;margin:0 0 2px}
    .sub{color:#666;font-size:12px;margin-bottom:20px}
    table{width:100%;border-collapse:collapse;font-size:12.5px;font-variant-numeric:tabular-nums}
    th,td{padding:8px 10px;text-align:right;border-bottom:1px solid #e2e2e2}
    th.l,td.l{text-align:left}
    thead th{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#888;border-bottom:1.5px solid #333}
    .b{font-weight:700}.muted{color:#888}.r{text-align:right}
    tfoot td{font-weight:700;border-top:1.5px solid #333;border-bottom:none}
    .stub{page-break-after:always;max-width:520px;margin:0 auto 32px;border:1px solid #ddd;border-radius:10px;padding:22px}
    .stubhdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1.5px solid #333;padding-bottom:10px;margin-bottom:12px}
    .who{font-size:16px;font-weight:700}
    table.kv td{border-bottom:1px solid #eee}
    tr.grand td{font-size:15px;font-weight:700;border-top:1.5px solid #333}
    @media print{ body{padding:0} .stub{border:none} }
  </style></head><body>
    <h1>${esc(restaurantName || 'Payroll')}</h1>
    <div class="sub">Pay run · ${esc(windowLabel(run))} · status ${esc(run?.status || 'draft')}</div>
    ${variant === 'stubs' ? stubs : summaryTable}
    <script>window.onload=function(){window.print()}<\/script>
  </body></html>`)
  win.document.close()
}
