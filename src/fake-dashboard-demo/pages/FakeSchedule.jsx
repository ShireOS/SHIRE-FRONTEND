import { useState, useCallback, useEffect, useRef } from 'react'
import { Card, CardContent } from '../../dashboard/components/shared/Card'
import { Badge } from '../../dashboard/components/shared/Badge'
import { Button } from '../../dashboard/components/shared/Button'
import {
  Sparkles, ChevronLeft, ChevronRight, Send, AlertTriangle, Loader2,
  Check, Clock, TrendingUp, ChevronDown, ChevronUp, X
} from 'lucide-react'
import { schedule, aiScheduleSuggestion } from '../data/mimosasMockData'

// ─── NEXT WEEK DATA (full 33-person roster) ──────────────────────────

const nextWeekSchedule = {
  weekOf: 'Mar 2 - Mar 8',
  days: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
  dayTypes: ['slow', 'avg', 'avg', 'avg', 'busy', 'busy', 'busy'],
  staff: [
    // ── MANAGEMENT ──
    { name: 'Genta T.', role: 'GM', shifts: ['7-3', '7-3', '7-3', '7-3', '7-3', '7-3', 'OFF'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Besim T.', role: 'AGM', shifts: ['OFF', '7-3', '7-3', '7-3', '7-3', '7-3', '7-3'], isTraining: [false, false, false, false, false, false, false] },
    // ── SERVERS ──
    { name: 'Adriana', role: 'Server', shifts: ['6-2', 'OFF', '6-2', '6-2', '6-2', '6-2', 'OFF'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Fabian', role: 'Server', shifts: ['OFF', '6-2', '6-2', 'OFF', '6-2', '6-2', '6-2'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Maria', role: 'Server', shifts: ['6-2', '6-2', 'OFF', '6-2', 'OFF', '6-2', '6-2'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Fernando', role: 'Server', shifts: ['7-2', '7-2', '7-2', '7-2', '6-2', 'OFF', '6-2'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Jaime', role: 'Server', shifts: ['7-1', 'OFF', '7-1', '7-2', '7-2', '7-2', 'OFF'], isTraining: [true, false, true, false, false, false, false] },
    { name: 'Aaliyah B.', role: 'Server', shifts: ['6-2', 'OFF', '6-2', '6-2', '6-2', '6-2', 'OFF'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Dominique P.', role: 'Server', shifts: ['OFF', '6-2', '6-2', 'OFF', '6-2', '6-2', '6-2'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Keisha L.', role: 'Server', shifts: ['7-2', '7-2', 'OFF', '7-2', 'OFF', '6-2', '6-2'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Tyler H.', role: 'Server', shifts: ['OFF', 'OFF', '7-2', '7-2', '6-2', '6-2', '6-2'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Jasmine C.', role: 'Server', shifts: ['6-2', '6-2', '6-2', 'OFF', 'OFF', '6-2', '6-2'], isTraining: [false, false, false, false, false, false, false] },
    // ── HOSTS ──
    { name: 'Mia S.', role: 'Host', shifts: ['7-2', '7-2', 'OFF', '7-2', '7-2', '7-2', 'OFF'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Deja W.', role: 'Host', shifts: ['OFF', 'OFF', '7-2', '7-2', '7-2', '7-2', '7-2'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Elijah N.', role: 'Host', shifts: ['7-12', '7-12', '7-12', 'OFF', 'OFF', '7-2', '7-2'], isTraining: [true, true, true, false, false, false, false] },
    // ── BARTENDERS ──
    { name: 'Andre F.', role: 'Bartender', shifts: ['8-2', '8-2', 'OFF', '8-2', '8-2', '7-2', '7-2'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Skylar D.', role: 'Bartender', shifts: ['OFF', '8-2', '8-2', '8-2', '8-2', '7-2', 'OFF'], isTraining: [false, false, false, false, false, false, false] },
    // ── KITCHEN ──
    { name: 'DeShawn H.', role: 'Exec Chef', shifts: ['5-1', '5-1', '5-1', '5-1', '5-1', '5-1', 'OFF'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Marco V.', role: 'Sous Chef', shifts: ['OFF', '5-1', '5-1', '5-1', '5-1', '5-1', '5-1'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Tamika G.', role: 'Line Cook', shifts: ['5-1', '5-1', 'OFF', '5-1', '5-1', '5-1', '5-1'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Ricky A.', role: 'Line Cook', shifts: ['5-1', 'OFF', '5-1', '5-1', '5-1', '5-1', 'OFF'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Priya N.', role: 'Line Cook', shifts: ['OFF', '5-1', '5-1', 'OFF', '5-1', '5-1', '5-1'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Jamal T.', role: 'Line Cook', shifts: ['6-1', '6-1', '6-1', '6-1', 'OFF', '5-1', '5-1'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Nina O.', role: 'Prep Cook', shifts: ['4-10', '4-10', '4-10', '4-10', '4-10', '4-10', 'OFF'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Luis R.', role: 'Prep Cook', shifts: ['OFF', '4-10', '4-10', '4-10', '4-10', '4-10', '4-10'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Hakeem W.', role: 'Dishwasher', shifts: ['6-2', '6-2', 'OFF', '6-2', '6-2', '6-2', '6-2'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Santiago M.', role: 'Dishwasher', shifts: ['6-2', 'OFF', '6-2', '6-2', '6-2', 'OFF', '6-2'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Chris B.', role: 'Expo', shifts: ['7-2', '7-2', '7-2', 'OFF', '7-2', '7-2', '7-2'], isTraining: [false, false, false, false, false, false, false] },
    // ── BUSSERS / RUNNERS ──
    { name: 'Jaylen P.', role: 'Busser', shifts: ['7-2', '7-2', 'OFF', '7-2', '7-2', '7-2', 'OFF'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Bianca Q.', role: 'Busser', shifts: ['OFF', '7-2', '7-2', 'OFF', '7-2', '7-2', '7-2'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Malik E.', role: 'Busser', shifts: ['OFF', 'OFF', '7-1', '7-1', '7-2', '7-2', '7-2'], isTraining: [false, false, true, true, false, false, false] },
    { name: 'Savannah T.', role: 'Runner', shifts: ['7-2', '7-2', '7-2', 'OFF', '7-2', '7-2', 'OFF'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Devon J.', role: 'Runner', shifts: ['OFF', '7-2', 'OFF', '7-2', '7-2', '7-2', '7-2'], isTraining: [false, false, false, false, false, false, false] },
  ],
  laborCost: 15280,
  laborPercent: 29,
  warnings: [
    'Spring break week — expect 20-30% higher volume Friday through Sunday',
    'Jaime and Elijah both in training — avoid scheduling solo on peak days',
    'Malik E. training as busser — pair with Jaylen or Bianca during Fri-Sun rush'
  ]
}

// ─── AI SUGGESTIONS ───────────────────────────────────────────────────

const currentWeekMetrics = { shiftsCreated: 192, totalHours: 1046, avgConfidence: 89, coverageGaps: 0 }

const nextWeekAISuggestion = {
  text: "Spring break traffic projected to spike 25% based on last year's POS data and local event calendar. I've optimized all 33 staff across 6 departments for maximum coverage Fri-Sun: senior servers on peak shifts, kitchen reinforced with Priya on Saturday opening, bartenders start early for mimosa prep, and training condensed to Mon-Wed. Recommend adding 1 extra server and 1 busser for Saturday patio overflow.",
  changes: [
    { type: 'add', staff: 'Extra server', day: 'SAT', shift: '8am-1pm' },
    { type: 'add', staff: 'Extra busser', day: 'SAT', shift: '8am-1pm' },
    { type: 'add', staff: 'Extra server', day: 'SUN', shift: '8am-1pm' },
    { type: 'remove', staff: 'Jaime (training)', day: 'THU', shift: 'convert to full' },
    { type: 'add', staff: 'Priya N.', day: 'SAT', shift: '5am-1pm (opening)' },
    { type: 'remove', staff: 'Andre F.', day: 'SAT', shift: '7am start (was 8am)' }
  ],
  metrics: { shiftsCreated: 198, totalHours: 1082, avgConfidence: 90, coverageGaps: 1 }
}

// ─── PER-STAFF AI REASONING (grouped by department) ──────────────────

const currentWeekReasoning = [
  // Management
  { staff: 'Genta T.', role: 'GM', confidence: 0.97, summary: 'GM present 6 days. Sunday off — AGM Besim covers. Ensures management coverage every day of the week.', reasons: ['Owner-operator present every open day to maintain quality and handle escalations', 'Sunday off aligns with lowest-complexity day — AGM fully capable of covering', 'Full 7-3 shifts overlap with both opening prep and closing side work', 'On-floor during peak 9-11 AM window every day to support service'] },
  { staff: 'Besim T.', role: 'AGM', confidence: 0.96, summary: 'AGM covers Sunday when GM is off. Monday off staggers management rest days.', reasons: ['Monday off opposite Genta ensures daily management coverage 7 days/week', 'Sunday coverage critical — tourist weekend traffic requires senior oversight', 'Handles Saturday close procedures to free Genta for floor management', 'Overlap with Genta Tue-Sat provides dual-manager coverage during peak'] },
  // Servers
  { staff: 'Adriana', role: 'Server', confidence: 0.93, summary: 'Top performer on peak weekend coverage. Monday off balances 5-day week.', reasons: ['Highest efficiency (94%) — prioritized for Fri/Sat/Sun brunch peak', 'Monday off — lowest traffic day, minimal revenue impact', 'Opening shift (6AM) on weekends to lead pre-rush prep', 'Historically generates $218/shift in weekend tips', 'Consecutive days capped at 5 per fatigue policy'] },
  { staff: 'Fabian', role: 'Server', confidence: 0.90, summary: 'Mid-week anchor. Tuesday off; Sunday off prevents 6-day stretch.', reasons: ['Strong weekend performer ($156 avg tips) — kept on Fri/Sat peak', 'Tuesday off staggered opposite Adriana for max senior coverage', 'Section B specialist — fastest turns in his zone (34min avg)'] },
  { staff: 'Jaime', role: 'Server', confidence: 0.76, summary: '6-week new hire. Training on slow days, building to full shifts.', reasons: ['Training paired with Tue/Thu (slow days) for shadowing without rush', 'Shortened shifts (7-1) give seniors bandwidth to mentor', 'Efficiency at 78% — needs 2 more weeks before solo peak assignment'] },
  { staff: 'Aaliyah B.', role: 'Server', confidence: 0.88, summary: 'Covers Monday when Fabian is off. Strong weekday performer.', reasons: ['6AM opening on Mon ensures floor presence when senior servers are off', 'Tuesday off balances 5-day week', 'Consistent weekend coverage supports spring break staffing'] },
  // Hosts
  { staff: 'Mia S.', role: 'Host', confidence: 0.91, summary: 'Lead host on 5 busiest days. Wednesday off during low-traffic window.', reasons: ['Experienced host — handles Saturday/Sunday tourist rush with 45-min waitlists', 'Wednesday off is lowest-waitlist day (avg 4 parties vs 18 on Saturday)', 'Opening shift (7AM) manages reservation confirmations before brunch flood'] },
  { staff: 'Elijah N.', role: 'Host', confidence: 0.74, summary: 'Training Mon-Wed (shorter shifts). Weekend full shifts with Mia as backup.', reasons: ['Training concentrated on slow days for focused learning', 'Shortened shifts (7-12) allow Mia/Deja to mentor during overlap', 'Weekend full shifts build confidence with increasing volume'] },
  // Kitchen
  { staff: 'DeShawn H.', role: 'Exec Chef', confidence: 0.95, summary: 'Exec chef 6 days. Sunday off — sous chef Marco leads kitchen.', reasons: ['5AM start enables full prep oversight before 7AM open', 'Sunday off — Marco runs kitchen (2yr experience, handles Sunday volume)', 'Present every peak day to manage ticket times and quality control', 'Overlap with prep cooks (4AM start) for daily menu prep review'] },
  { staff: 'Tamika G.', role: 'Line Cook', confidence: 0.89, summary: 'Strongest line cook on 6-day schedule. Wednesday off for rest.', reasons: ['Handles grill and fryer stations — critical for Fried Lobster & Waffles (top seller)', 'Wednesday off is lowest-ticket day (avg 142 vs 210 on Saturday)', '6-day schedule reflects her stated availability preference'] },
  { staff: 'Nina O.', role: 'Prep Cook', confidence: 0.92, summary: '4AM-10AM prep shift 6 days. All sauces, batters, and mise en place before open.', reasons: ['4AM start ensures hollandaise, waffle batter, and grits are ready by 6:30', 'Sunday off — Luis covers prep (his schedule mirrors hers offset by 1 day)', '6-day schedule critical during spring break for higher-volume prep'] },
  // Bar
  { staff: 'Andre F.', role: 'Bartender', confidence: 0.90, summary: 'Lead bartender on peak days. Earlier start Sat/Sun for mimosa prep.', reasons: ['8AM weekday start aligns with bar open (brunch cocktails peak at 9:30)', '7AM weekend start for mimosa batch prep before 8AM rush', 'Wednesday off — Skylar covers as sole bartender (low mimosa volume)'] },
  // Bussers/Runners
  { staff: 'Jaylen P.', role: 'Busser', confidence: 0.87, summary: 'Lead busser 5 days. Table reset speed directly impacts turn times.', reasons: ['Fastest reset time on staff (2.8min avg vs 4.1min team avg)', 'Weekend coverage essential — 44min Saturday turns need fast resets', 'Wednesday and Sunday off to stay under 40h threshold'] },
  { staff: 'Savannah T.', role: 'Runner', confidence: 0.86, summary: 'Primary runner 5 days. Kitchen-to-table speed improves customer experience.', reasons: ['Averages 1.4min from expo to table — fastest on team', 'Weekend coverage supports peak kitchen output (210+ tickets Sat)', 'Thursday and Sunday off — Devon covers those days'] },
]

const nextWeekReasoning = [
  // Management
  { staff: 'Genta T.', role: 'GM', confidence: 0.97, summary: 'GM present 6 days including full spring break weekend. Sunday off — Besim covers.', reasons: ['Owner on floor during projected highest-revenue days of the quarter', 'Sunday off maintained — Besim fully capable of spring break Sunday management', 'Full 7-3 shifts overlap both opening and close for quality control'] },
  { staff: 'Besim T.', role: 'AGM', confidence: 0.96, summary: 'Full spring break weekend coverage. Monday off staggers with Genta.', reasons: ['Sunday spring break coverage critical — tourist volume projected 30% above normal', 'Monday off maintained — lowest spring break impact day'] },
  // Servers
  { staff: 'Adriana', role: 'Server', confidence: 0.94, summary: 'Top server on 5-day peak schedule. Tuesday and Sunday off for recovery.', reasons: ['94% efficiency — handles projected 28 covers/shift on Saturday', 'Tuesday off honored (low-traffic, 33min avg turn)', 'Sunday off after 5-day spring break stretch prevents burnout', 'Opening shifts (6AM) on peak days for team coordination'] },
  { staff: 'Fabian', role: 'Server', confidence: 0.91, summary: 'Full weekend for spring break. Mon/Thu off staggered opposite Adriana.', reasons: ['$156 avg weekend tips — essential for spring break Sat/Sun', 'Off days staggered opposite Adriana for max senior coverage', 'Section B specialization reduces seating friction during high turnover'] },
  { staff: 'Jaime', role: 'Server', confidence: 0.78, summary: 'Training moved to Mon/Wed. Full shifts Thu-Sat to build peak-day confidence.', reasons: ['Training shifted to Mon/Wed — slowest spring break days for focused mentoring', 'Full Thursday serves as practice ramp before weekend', 'Friday/Saturday full shifts build confidence at progressively higher volume', 'Saturday is first solo peak-day trial — Adriana available as backup'] },
  { staff: 'Aaliyah B.', role: 'Server', confidence: 0.89, summary: 'Full spring break coverage Mon-Sat. Sunday off prevents overtime.', reasons: ['Covers Monday (Fabian off) and Friday (Maria off) gaps', 'Sunday off keeps hours under 40h at projected 38.5h', 'Opening shifts support spring break tourist early brunch crowd'] },
  { staff: 'Tyler H.', role: 'Server', confidence: 0.85, summary: 'Wed-Sun schedule covers spring break peak days. New to weekends.', reasons: ['5-day schedule concentrated on Wed-Sun for maximum weekend impact', 'Mon/Tue off since he\'s lowest-seniority — seniors cover early week', 'Spring break weekend his first full Sat/Sun — paired with Adriana\'s section'] },
  // Hosts
  { staff: 'Mia S.', role: 'Host', confidence: 0.92, summary: 'Lead host on peak spring break days. Wednesday off — Deja covers.', reasons: ['Handles 45+ min waitlists — critical for spring break Saturday/Sunday', 'Wednesday off during expected lowest-waitlist spring break day', 'Opening shift manages pre-brunch reservation confirmations'] },
  { staff: 'Elijah N.', role: 'Host', confidence: 0.75, summary: 'Training Mon-Wed. Weekend full shifts to experience spring break volume.', reasons: ['Training concentrated on slow start of week', 'Weekend full shifts with Mia as backup for learning under pressure', 'Saturday/Sunday spring break exposure accelerates onboarding'] },
  // Kitchen
  { staff: 'DeShawn H.', role: 'Exec Chef', confidence: 0.96, summary: 'Exec chef 6 days. Must lead kitchen for projected highest-volume week.', reasons: ['5AM start enables spring break prep volume (projected 25% more covers)', 'Present every peak day — ticket times must stay under 14min', 'Sunday off — Marco leads (has done spring break Sundays before)'] },
  { staff: 'Priya N.', role: 'Line Cook', confidence: 0.88, summary: 'Added to Saturday opening. Moved off Monday to reinforce weekend line.', reasons: ['Saturday opening (5AM) strengthens the line for projected 210+ ticket day', 'Monday off moved from schedule — slow day needs fewer cooks', 'Spring break waffle and lobster ticket volume requires 4 line cooks Sat/Sun'] },
  { staff: 'Nina O.', role: 'Prep Cook', confidence: 0.93, summary: '4AM prep 6 days. Spring break volume requires larger batch sizes.', reasons: ['Waffle batter, hollandaise, and grits batches increased 30% for spring break', '4AM start ensures everything is ready for expanded 6:30 line setup', 'Sunday off — Luis handles prep (his strongest day)'] },
  // Bar
  { staff: 'Andre F.', role: 'Bartender', confidence: 0.91, summary: 'Earlier Saturday start (7AM) for mimosa flight batch prep before tourist rush.', reasons: ['Saturday moved from 8AM to 7AM — spring break mimosa orders projected up 40%', 'Pre-batches 6 mimosa flavors before 8AM tourist wave', 'Sunday 7AM start maintained for consistent weekend bar coverage'] },
  // Bussers/Runners
  { staff: 'Jaylen P.', role: 'Busser', confidence: 0.88, summary: 'Lead busser on peak days. Spring break turns need fastest resets.', reasons: ['2.8min avg reset time — essential for Saturday 44min target turns', 'Weekend coverage non-negotiable during spring break volume', 'Mentors Malik during Wed/Thu training shifts'] },
  { staff: 'Malik E.', role: 'Busser', confidence: 0.72, summary: 'Training Wed-Thu. Full shifts Fri-Sun to handle spring break volume.', reasons: ['Training concentrated mid-week with Jaylen available to mentor', 'Full weekend shifts to experience spring break pace firsthand', 'Mon/Tue off — lowest-impact days for a trainee to be absent'] },
]

// ─── CONSTANTS ────────────────────────────────────────────────────────

const GENERATION_STEPS = [
  'Analyzing last 90 days of POS traffic data...',
  'Checking 33 staff availability, preferences, and overtime limits...',
  'Running constraint solver across 6 departments...',
  'Optimizing for labor cost, fairness, and full-coverage...',
  'Generating per-assignment reasoning...',
]

const HOUR_OPTIONS = [
  { value: '4', label: '4 AM' }, { value: '5', label: '5 AM' },
  { value: '6', label: '6 AM' }, { value: '7', label: '7 AM' },
  { value: '8', label: '8 AM' }, { value: '9', label: '9 AM' },
  { value: '10', label: '10 AM' }, { value: '11', label: '11 AM' },
  { value: '12', label: '12 PM' }, { value: '1', label: '1 PM' },
  { value: '2', label: '2 PM' }, { value: '3', label: '3 PM' },
]

const ROLE_COLORS = {
  'GM': 'role-type-label role-type-label-gm',
  'AGM': 'role-type-label role-type-label-gm',
  'Server': 'role-type-label role-type-label-server',
  'Host': 'role-type-label role-type-label-host',
  'Bartender': 'role-type-label role-type-label-bartender',
  'Exec Chef': 'role-type-label role-type-label-kitchen',
  'Sous Chef': 'role-type-label role-type-label-kitchen',
  'Line Cook': 'role-type-label role-type-label-kitchen-light',
  'Prep Cook': 'role-type-label role-type-label-kitchen-light',
  'Dishwasher': 'role-type-label role-type-label-dishwasher',
  'Expo': 'role-type-label role-type-label-kitchen-light',
  'Busser': 'role-type-label role-type-label-support',
  'Runner': 'role-type-label role-type-label-support',
}

const getRoleClassName = (role) => ROLE_COLORS[role] || 'role-type-label role-type-label-default'

// ─── DARK MODAL ──────────────────────────────────────────────────────

function DarkModal({ isOpen, onClose, title, size = 'lg', children }) {
  if (!isOpen) return null
  const sizes = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' }
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-dash-base/70 backdrop-blur-sm" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={`relative bg-dash-surface border border-dash-border rounded-xl shadow-2xl w-full ${sizes[size]} max-h-[90vh] overflow-y-auto`}
          onClick={(e) => e.stopPropagation()}
        >
          {title && (
            <div className="flex items-center justify-between p-6 soft-divider-bottom sticky top-0 bg-dash-surface/95 backdrop-blur-sm z-10 rounded-t-xl">
              <h2 className="text-xl font-semibold text-dash-cream">{title}</h2>
              <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-dash-tertiary hover:text-dash-cream hover:bg-dash-cream/10 transition-colors">
                <X size={20} />
              </button>
            </div>
          )}
          <div className="p-6">{children}</div>
        </div>
      </div>
    </div>
  )
}

// ─── AI PREVIEW MODAL ────────────────────────────────────────────────

const PREVIEW_ROW_LIMIT = 10

function AIPreviewModal({ isOpen, scheduleSource, suggestion, reasoning, metrics, onApply, onCancel }) {
  const [expandedIdx, setExpandedIdx] = useState(null)
  const [showAllPreviewStaff, setShowAllPreviewStaff] = useState(false)

  if (!isOpen || !scheduleSource) return null

  const previewStaff = showAllPreviewStaff ? scheduleSource.staff : scheduleSource.staff.slice(0, PREVIEW_ROW_LIMIT)
  const hiddenPreviewCount = scheduleSource.staff.length - PREVIEW_ROW_LIMIT

  return (
    <DarkModal isOpen={isOpen} onClose={onCancel} title="AI Schedule Suggestion" size="xl">
      {/* Strategy Summary */}
      <div className="border border-dash-gold/30 bg-dash-gold/5 rounded-lg p-5 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-dash-gold/20 border border-dash-gold/30 rounded-lg flex items-center justify-center flex-shrink-0">
            <Sparkles size={20} className="text-dash-gold" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-dash-cream mb-1">AI Strategy</p>
            <p className="text-sm text-dash-secondary leading-relaxed">{suggestion.text}</p>
            {suggestion.changes && (
              <div className="flex flex-wrap gap-2 mt-3">
                {suggestion.changes.map((change, idx) => (
                  <div key={idx} className={`text-xs px-2 py-1 rounded ${change.type === 'add' ? 'bg-dash-success/20 text-dash-success' : 'bg-dash-warning/20 text-dash-warning'}`}>
                    {change.type === 'add' ? '+' : '~'} {change.staff} · {change.day} {change.shift}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="border border-dash-border bg-dash-cream/5 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1"><Check size={14} className="text-dash-success" /></div>
          <div className="text-xl font-bold text-dash-cream">{metrics.shiftsCreated}</div>
          <div className="text-[11px] text-dash-tertiary">Shifts Created</div>
        </div>
        <div className="border border-dash-border bg-dash-cream/5 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1"><Clock size={14} className="text-dash-secondary" /></div>
          <div className="text-xl font-bold text-dash-cream">{metrics.totalHours}h</div>
          <div className="text-[11px] text-dash-tertiary">Total Hours</div>
        </div>
        <div className="border border-dash-border bg-dash-cream/5 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1"><TrendingUp size={14} className="text-dash-gold" /></div>
          <div className="text-xl font-bold text-dash-cream">{metrics.avgConfidence}%</div>
          <div className="text-[11px] text-dash-tertiary">Avg Confidence</div>
        </div>
        <div className={`border rounded-lg p-3 ${metrics.coverageGaps > 0 ? 'border-dash-warning/30 bg-dash-warning/10' : 'border-dash-success/30 bg-dash-success/10'}`}>
          <div className="flex items-center gap-1.5 mb-1"><AlertTriangle size={14} className={metrics.coverageGaps > 0 ? 'text-dash-warning' : 'text-dash-success'} /></div>
          <div className="text-xl font-bold text-dash-cream">{metrics.coverageGaps}</div>
          <div className="text-[11px] text-dash-tertiary">Coverage Gap{metrics.coverageGaps !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Per-Staff Reasoning */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-dash-cream mb-3 flex items-center gap-2">
          <Sparkles size={14} className="text-dash-gold" />
          Per-Staff Reasoning <span className="text-dash-tertiary font-normal">({reasoning.length} key assignments)</span>
        </h3>
        <div className="soft-inset-surface rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
          {reasoning.map((item, idx) => (
            <div key={idx} className={idx < reasoning.length - 1 ? 'rail-seam' : ''}>
              <button
                onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                className="w-full flex items-center justify-between p-3 hover:bg-dash-cream/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-dash-gold/20 border border-dash-gold/30 rounded-lg flex items-center justify-center text-dash-gold text-xs font-bold">
                    {item.staff.charAt(0)}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-dash-cream">{item.staff} <span className={`text-xs font-normal ${getRoleClassName(item.role)}`}>{item.role}</span></p>
                    <p className="text-xs text-dash-tertiary max-w-lg truncate">{item.summary}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${item.confidence >= 0.9 ? 'bg-dash-success/20 text-dash-success' : item.confidence >= 0.85 ? 'bg-dash-gold/20 text-dash-gold' : item.confidence >= 0.75 ? 'bg-dash-warning/20 text-dash-warning' : 'bg-dash-danger/20 text-dash-danger'}`}>
                    {Math.round(item.confidence * 100)}%
                  </span>
                  {expandedIdx === idx ? <ChevronUp size={14} className="text-dash-tertiary" /> : <ChevronDown size={14} className="text-dash-tertiary" />}
                </div>
              </button>
              {expandedIdx === idx && (
                <div className="px-3 pb-3 ml-11">
                  <div className="bg-dash-cream/5 rounded-lg p-3 space-y-2">
                    {item.reasons.map((reason, rIdx) => (
                      <div key={rIdx} className="flex items-start gap-2 text-sm">
                        <div className="w-4 h-4 bg-dash-gold/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-[10px] text-dash-gold font-bold">{rIdx + 1}</span>
                        </div>
                        <span className="text-dash-secondary">{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Schedule Grid Preview */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-dash-cream mb-3">Schedule Preview <span className="text-dash-tertiary font-normal">({scheduleSource.staff.length} staff)</span></h3>
        <div className="soft-inset-surface rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr className="soft-table-head bg-dash-surface">
                  <th className="text-left py-2 px-3 text-[11px] font-medium text-dash-tertiary uppercase sticky left-0 bg-dash-surface z-20">Staff</th>
                  <th className="text-left py-2 px-2 text-[11px] font-medium text-dash-tertiary uppercase">Role</th>
                  {scheduleSource.days.map((day, idx) => (
                    <th key={day} className="text-center py-2 px-2 text-[11px] font-medium text-dash-tertiary uppercase min-w-[60px]">
                      <div>{day}</div>
                      <div className={`text-[9px] mt-0.5 px-1 py-0.5 rounded ${scheduleSource.dayTypes[idx] === 'busy' ? 'bg-dash-danger/20 text-dash-danger' : scheduleSource.dayTypes[idx] === 'avg' ? 'bg-dash-warning/20 text-dash-warning' : 'bg-dash-cream/10 text-dash-tertiary'}`}>{scheduleSource.dayTypes[idx].toUpperCase()}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="soft-divider-y">
                {previewStaff.map((row) => (
                  <tr key={row.name} className="soft-table-row">
                    <td className="py-1.5 px-3 text-xs font-medium text-dash-cream sticky left-0 bg-dash-surface z-10 whitespace-nowrap">{row.name}</td>
                    <td className={`py-1.5 px-2 text-[10px] whitespace-nowrap ${getRoleClassName(row.role)}`}>{row.role}</td>
                    {row.shifts.map((shift, idx) => (
                      <td key={idx} className="py-1.5 px-1 text-center">
                        {shift === 'OFF' ? (
                          <span className="text-[9px] text-dash-tertiary">—</span>
                        ) : (
                          <div className={`px-1 py-0.5 rounded text-[10px] font-medium ${row.isTraining[idx] ? 'bg-purple-500/20 text-purple-400' : 'bg-dash-gold/10 text-dash-gold'}`}>
                            {shift}
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!showAllPreviewStaff && hiddenPreviewCount > 0 && (
            <button
              onClick={() => setShowAllPreviewStaff(true)}
              className="w-full py-2.5 text-xs font-medium text-dash-gold hover:text-dash-cream bg-dash-cream/5 hover:bg-dash-cream/10 soft-divider-top transition-colors flex items-center justify-center gap-1.5"
            >
              <ChevronDown size={14} />
              Show all {scheduleSource.staff.length} staff ({hiddenPreviewCount} more)
            </button>
          )}
          {showAllPreviewStaff && hiddenPreviewCount > 0 && (
            <button
              onClick={() => setShowAllPreviewStaff(false)}
              className="w-full py-2.5 text-xs font-medium text-dash-tertiary hover:text-dash-cream bg-dash-cream/5 hover:bg-dash-cream/10 soft-divider-top transition-colors flex items-center justify-center gap-1.5"
            >
              <ChevronUp size={14} />
              Show less
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 soft-divider-top">
        <p className="text-xs text-dash-tertiary">You can edit individual shifts after applying</p>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button icon={<Check size={18} />} onClick={onApply}>Apply Schedule</Button>
        </div>
      </div>
    </DarkModal>
  )
}

// ─── EDIT SHIFT MODAL ────────────────────────────────────────────────

function EditShiftModal({ shift, staffName, staffRole, dayLabel, isTraining, allStaff, onSave, onDelete, onClose }) {
  const parts = shift.split('-')
  const [startHour, setStartHour] = useState(parts[0] || '6')
  const [endHour, setEndHour] = useState(parts[1] || '2')
  const [assignedTo, setAssignedTo] = useState(staffName)
  const [training, setTraining] = useState(isTraining)

  const conflictStaff = assignedTo !== staffName
    ? allStaff.find((s) => s.name === assignedTo && s.hasShiftOnDay)
    : null

  const handleSave = () => {
    onSave({
      newShift: `${startHour}-${endHour}`,
      newStaffName: assignedTo,
      isTraining: training,
    })
  }

  return (
    <DarkModal isOpen={true} onClose={onClose} title={`Edit Shift — ${dayLabel}`} size="sm">
      <div className="space-y-5">
        <div className="bg-dash-cream/5 rounded-lg p-3 border border-dash-border">
          <p className="text-xs text-dash-tertiary mb-1">Current</p>
          <p className="text-sm text-dash-cream"><span className="font-medium">{staffName}</span> <span className={`text-xs ${getRoleClassName(staffRole)}`}>{staffRole}</span> · {shift}{isTraining ? ' (Training)' : ''}</p>
        </div>

        <div>
          <label className="text-xs font-medium text-dash-secondary block mb-2">Shift Time</label>
          <div className="flex items-center gap-2">
            <select value={startHour} onChange={(e) => setStartHour(e.target.value)} className="flex-1 px-3 py-2 bg-dash-cream/5 border border-dash-border rounded-lg text-dash-cream text-sm focus:outline-none focus:ring-1 focus:ring-dash-gold/50">
              {HOUR_OPTIONS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
            </select>
            <span className="text-dash-tertiary">to</span>
            <select value={endHour} onChange={(e) => setEndHour(e.target.value)} className="flex-1 px-3 py-2 bg-dash-cream/5 border border-dash-border rounded-lg text-dash-cream text-sm focus:outline-none focus:ring-1 focus:ring-dash-gold/50">
              {HOUR_OPTIONS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-dash-secondary block mb-2">Assigned To</label>
          <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="w-full px-3 py-2 bg-dash-cream/5 border border-dash-border rounded-lg text-dash-cream text-sm focus:outline-none focus:ring-1 focus:ring-dash-gold/50">
            {allStaff.map((s) => (
              <option key={s.name} value={s.name}>{s.name} ({s.role}){s.hasShiftOnDay && s.name !== staffName ? ' — already scheduled' : ''}</option>
            ))}
          </select>
          {conflictStaff && (
            <p className="text-xs text-dash-warning mt-1.5 flex items-center gap-1">
              <AlertTriangle size={12} /> {assignedTo} already has a shift on {dayLabel}
            </p>
          )}
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={training} onChange={(e) => setTraining(e.target.checked)} className="w-4 h-4 rounded border-dash-border bg-dash-cream/5 text-dash-gold focus:ring-dash-gold/50" />
          <span className="text-sm text-dash-secondary">Training shift</span>
        </label>
      </div>

      <div className="flex items-center justify-between pt-5 mt-5 soft-divider-top">
        <button onClick={onDelete} className="text-xs text-dash-danger hover:text-red-400 transition-colors">Remove shift</button>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      </div>
    </DarkModal>
  )
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────

export default function FakeSchedule() {
  const [weekIndex, setWeekIndex] = useState(0)
  const [isLoadingWeek, setIsLoadingWeek] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStep, setGenerationStep] = useState(0)
  const [scheduleData, setScheduleData] = useState({
    0: JSON.parse(JSON.stringify(schedule)),
    1: null,
  })
  const [showSchedule, setShowSchedule] = useState({ 0: true, 1: false })
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [editingShift, setEditingShift] = useState(null)
  const [showAllStaff, setShowAllStaff] = useState(false)
  const generationTimers = useRef([])

  useEffect(() => {
    return () => generationTimers.current.forEach(clearTimeout)
  }, [])

  const sourceSchedules = [schedule, nextWeekSchedule]
  const suggestions = [aiScheduleSuggestion, nextWeekAISuggestion]
  const reasonings = [currentWeekReasoning, nextWeekReasoning]
  const metricsList = [currentWeekMetrics, nextWeekAISuggestion.metrics]

  const displayData = scheduleData[weekIndex]

  const handlePrevWeek = () => {
    if (weekIndex > 0 && !isLoadingWeek) {
      setIsLoadingWeek(true)
      setEditingShift(null)
      setShowPreviewModal(false)
      setShowAllStaff(false)
      setTimeout(() => { setWeekIndex(weekIndex - 1); setIsLoadingWeek(false) }, 600 + Math.random() * 400)
    }
  }

  const handleNextWeek = () => {
    if (weekIndex < 1 && !isLoadingWeek) {
      setIsLoadingWeek(true)
      setEditingShift(null)
      setShowPreviewModal(false)
      setShowAllStaff(false)
      setTimeout(() => { setWeekIndex(weekIndex + 1); setIsLoadingWeek(false) }, 600 + Math.random() * 400)
    }
  }

  const handleAISuggest = useCallback(() => {
    if (isGenerating || showSchedule[weekIndex]) return
    setIsGenerating(true)
    setGenerationStep(0)
    generationTimers.current.forEach(clearTimeout)
    generationTimers.current = []
    GENERATION_STEPS.forEach((_, idx) => {
      const timer = setTimeout(() => setGenerationStep(idx), idx * (700 + Math.random() * 500))
      generationTimers.current.push(timer)
    })
    const finishTimer = setTimeout(() => {
      setIsGenerating(false)
      setGenerationStep(0)
      setShowPreviewModal(true)
    }, GENERATION_STEPS.length * 900 + 800)
    generationTimers.current.push(finishTimer)
  }, [isGenerating, weekIndex, showSchedule])

  const handleApplySchedule = useCallback(() => {
    setScheduleData((prev) => ({ ...prev, [weekIndex]: JSON.parse(JSON.stringify(sourceSchedules[weekIndex])) }))
    setShowSchedule((prev) => ({ ...prev, [weekIndex]: true }))
    setShowPreviewModal(false)
  }, [weekIndex])

  const handleShiftClick = (staffIndex, dayIndex) => {
    if (!displayData) return
    if (displayData.staff[staffIndex].shifts[dayIndex] === 'OFF') return
    setEditingShift({ staffIndex, dayIndex })
  }

  const handleShiftSave = ({ newShift, newStaffName, isTraining: newTraining }) => {
    if (!editingShift || !displayData) return
    const { staffIndex, dayIndex } = editingShift
    const oldName = displayData.staff[staffIndex].name
    setScheduleData((prev) => {
      const copy = JSON.parse(JSON.stringify(prev))
      const week = copy[weekIndex]
      if (newStaffName !== oldName) {
        week.staff[staffIndex].shifts[dayIndex] = 'OFF'
        week.staff[staffIndex].isTraining[dayIndex] = false
        const newIdx = week.staff.findIndex((s) => s.name === newStaffName)
        if (newIdx !== -1) {
          week.staff[newIdx].shifts[dayIndex] = newShift
          week.staff[newIdx].isTraining[dayIndex] = newTraining
        }
      } else {
        week.staff[staffIndex].shifts[dayIndex] = newShift
        week.staff[staffIndex].isTraining[dayIndex] = newTraining
      }
      return copy
    })
    setEditingShift(null)
  }

  const handleShiftDelete = () => {
    if (!editingShift || !displayData) return
    const { staffIndex, dayIndex } = editingShift
    setScheduleData((prev) => {
      const copy = JSON.parse(JSON.stringify(prev))
      copy[weekIndex].staff[staffIndex].shifts[dayIndex] = 'OFF'
      copy[weekIndex].staff[staffIndex].isTraining[dayIndex] = false
      return copy
    })
    setEditingShift(null)
  }

  const allStaffForEdit = editingShift && displayData
    ? displayData.staff.map((s) => ({ name: s.name, role: s.role, hasShiftOnDay: s.shifts[editingShift.dayIndex] !== 'OFF' }))
    : []

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dash-cream"><span className="font-dash-display italic text-dash-gold">Schedule</span></h1>
          <p className="text-dash-secondary mt-1">Plan and manage your team's shifts <span className="text-sm text-dash-gold ml-2">· Mimosas Southern Kitchen & Bar</span></p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" icon={isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />} onClick={handleAISuggest} disabled={isGenerating || showSchedule[weekIndex]}>
            {isGenerating ? 'Generating...' : 'AI Suggest'}
          </Button>
          <Button icon={<Send size={18} />} disabled={!showSchedule[weekIndex]}>Publish</Button>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={<ChevronLeft size={18} />} onClick={handlePrevWeek} disabled={weekIndex === 0 || isLoadingWeek} />
          <span className="text-lg font-semibold text-dash-cream">
            {isLoadingWeek ? <span className="flex items-center gap-2"><Loader2 size={18} className="animate-spin text-dash-gold" /> Loading week...</span> : `Week of ${displayData?.weekOf || sourceSchedules[weekIndex].weekOf}`}
          </span>
          <Button variant="ghost" size="sm" icon={<ChevronRight size={18} />} onClick={handleNextWeek} disabled={weekIndex >= 1 || isLoadingWeek} />
        </div>
        <div className="flex items-center gap-2">
          {showSchedule[weekIndex] && !isLoadingWeek && <span className="text-xs text-dash-tertiary">{displayData?.staff.length || 0} staff</span>}
          {showSchedule[weekIndex] && !isLoadingWeek && <Badge variant="info">DRAFT</Badge>}
        </div>
      </div>

      {isLoadingWeek && (
        <Card className="mb-6"><CardContent className="p-8 flex items-center justify-center"><div className="flex items-center gap-3 text-dash-secondary"><Loader2 size={20} className="animate-spin text-dash-gold" /><span>Loading schedule data...</span></div></CardContent></Card>
      )}

      {!isLoadingWeek && (
        <>
          {showSchedule[weekIndex] && displayData && displayData.warnings.length > 0 && (
            <Card className="mb-6 border-dash-warning/30 bg-dash-warning/10">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={20} className="text-dash-warning flex-shrink-0 mt-0.5" />
                  <div>{displayData.warnings.map((w, i) => (<p key={i} className="text-sm text-dash-secondary">{w}</p>))}</div>
                </div>
              </CardContent>
            </Card>
          )}

          {isGenerating && (
            <Card className="mb-6 border-dash-gold/30 bg-dash-gold/5">
              <CardContent className="p-5">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 bg-dash-gold/20 border border-dash-gold/30 rounded-lg flex items-center justify-center flex-shrink-0"><Sparkles size={20} className="text-dash-gold" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-dash-cream mb-1">AI Schedule Engine</p>
                    <p className="text-xs text-dash-tertiary">Generating optimized schedule for {sourceSchedules[weekIndex].weekOf} · {sourceSchedules[weekIndex].staff.length} staff across 6 departments</p>
                  </div>
                </div>
                <div className="space-y-2 ml-[52px]">
                  {GENERATION_STEPS.map((step, idx) => (
                    <div key={idx} className={`flex items-center gap-2 text-sm transition-all duration-300 ${idx < generationStep ? 'text-dash-success' : idx === generationStep ? 'text-dash-cream' : 'text-dash-tertiary/40'}`}>
                      {idx < generationStep ? <Check size={14} className="text-dash-success flex-shrink-0" /> : idx === generationStep ? <Loader2 size={14} className="animate-spin text-dash-gold flex-shrink-0" /> : <div className="w-3.5 h-3.5 rounded-full border border-dash-border flex-shrink-0" />}
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 ml-[52px] h-1 bg-dash-cream/10 rounded-full overflow-hidden">
                  <div className="h-full bg-dash-gold rounded-full transition-all duration-700 ease-out" style={{ width: `${((generationStep + 1) / GENERATION_STEPS.length) * 100}%` }} />
                </div>
              </CardContent>
            </Card>
          )}

          {!showSchedule[weekIndex] && !isGenerating && (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="text-dash-gold/30 mb-4"><Sparkles size={48} className="mx-auto" /></div>
                <p className="text-lg font-medium text-dash-cream mb-2">No schedule for this week yet</p>
                <p className="text-sm text-dash-tertiary mb-6 max-w-md mx-auto">Use the AI scheduling engine to generate an optimized schedule for all {sourceSchedules[weekIndex].staff.length} staff across management, servers, hosts, bartenders, kitchen, and support.</p>
                <Button icon={<Sparkles size={18} />} onClick={handleAISuggest}>Generate with AI</Button>
              </CardContent>
            </Card>
          )}

          {showSchedule[weekIndex] && displayData && (() => {
            const MAIN_ROW_LIMIT = 10
            const visibleStaff = showAllStaff ? displayData.staff : displayData.staff.slice(0, MAIN_ROW_LIMIT)
            const hiddenCount = displayData.staff.length - MAIN_ROW_LIMIT
            return (
            <>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="soft-table-head">
                          <th className="text-left py-3 px-4 label-mono sticky left-0 bg-dash-surface z-10 min-w-[140px]">STAFF</th>
                          <th className="text-left py-3 px-2 label-mono min-w-[80px]">ROLE</th>
                          {displayData.days.map((day, idx) => (
                            <th key={day} className="text-center py-3 px-3 label-mono min-w-[80px]">
                              <div>{day}</div>
                              <div className={`text-[10px] mt-1 px-1.5 py-0.5 rounded ${displayData.dayTypes[idx] === 'busy' ? 'bg-dash-danger/20 text-dash-danger' : displayData.dayTypes[idx] === 'avg' ? 'bg-dash-warning/20 text-dash-warning' : 'bg-dash-cream/10 text-dash-tertiary'}`}>{displayData.dayTypes[idx].toUpperCase()}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="soft-divider-y">
                        {visibleStaff.map((row, visIdx) => {
                          // Map visible index back to real index for editing
                          const staffIdx = showAllStaff ? visIdx : visIdx
                          return (
                          <tr key={row.name} className="soft-table-row">
                            <td className="py-2 px-4 sticky left-0 bg-dash-surface z-10">
                              <span className="font-medium text-dash-cream text-sm">{row.name}</span>
                            </td>
                            <td className={`py-2 px-2 text-xs whitespace-nowrap ${getRoleClassName(row.role)}`}>{row.role}</td>
                            {row.shifts.map((shift, dayIdx) => (
                              <td key={dayIdx} className={`py-2 px-2 text-center ${shift !== 'OFF' ? 'cursor-pointer' : ''}`} onClick={() => handleShiftClick(staffIdx, dayIdx)}>
                                {shift === 'OFF' ? (
                                  <span className="text-xs text-dash-tertiary">OFF</span>
                                ) : (
                                  <div className={`px-1.5 py-1 rounded text-xs font-medium transition-all ${row.isTraining[dayIdx] ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:ring-2 hover:ring-purple-400/40' : 'bg-dash-gold/20 text-dash-gold border border-dash-gold/30 hover:ring-2 hover:ring-dash-gold/40'}`}>
                                    {shift}
                                    {row.isTraining[dayIdx] && <span className="block text-[10px] mt-0.5 opacity-70">Training</span>}
                                  </div>
                                )}
                              </td>
                            ))}
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {!showAllStaff && hiddenCount > 0 && (
                    <button
                      onClick={() => setShowAllStaff(true)}
                      className="w-full py-3 text-sm font-medium text-dash-gold hover:text-dash-cream bg-dash-cream/5 hover:bg-dash-cream/10 soft-divider-top transition-colors flex items-center justify-center gap-2"
                    >
                      <ChevronDown size={16} />
                      Show all {displayData.staff.length} staff ({hiddenCount} more)
                    </button>
                  )}
                  {showAllStaff && hiddenCount > 0 && (
                    <button
                      onClick={() => setShowAllStaff(false)}
                      className="w-full py-3 text-sm font-medium text-dash-tertiary hover:text-dash-cream bg-dash-cream/5 hover:bg-dash-cream/10 soft-divider-top transition-colors flex items-center justify-center gap-2"
                    >
                      <ChevronUp size={16} />
                      Show less
                    </button>
                  )}
                </CardContent>
              </Card>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-sm text-dash-secondary">
                  <div className="flex items-center gap-2"><span className="w-3 h-3 bg-dash-gold/20 border border-dash-gold/30 rounded" /><span>Regular</span></div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 bg-purple-500/20 border border-purple-500/30 rounded" /><span>Training</span></div>
                  <span className="text-dash-tertiary text-xs ml-2">Click any shift to edit</span>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-dash-tertiary">Staff:</span>
                    <span className="ml-1 font-semibold text-dash-cream">{displayData.staff.length}</span>
                  </div>
                  <div>
                    <span className="text-dash-tertiary">Labor:</span>
                    <span className="ml-1 font-semibold text-dash-cream">${displayData.laborCost.toLocaleString()}</span>
                    <span className="ml-1 text-dash-tertiary">({displayData.laborPercent}%)</span>
                  </div>
                </div>
              </div>
            </>
            )
          })()}
        </>
      )}

      <AIPreviewModal
        isOpen={showPreviewModal}
        scheduleSource={sourceSchedules[weekIndex]}
        suggestion={suggestions[weekIndex]}
        reasoning={reasonings[weekIndex]}
        metrics={metricsList[weekIndex]}
        onApply={handleApplySchedule}
        onCancel={() => setShowPreviewModal(false)}
      />

      {editingShift && displayData && (
        <EditShiftModal
          shift={displayData.staff[editingShift.staffIndex].shifts[editingShift.dayIndex]}
          staffName={displayData.staff[editingShift.staffIndex].name}
          staffRole={displayData.staff[editingShift.staffIndex].role}
          dayLabel={displayData.days[editingShift.dayIndex]}
          isTraining={displayData.staff[editingShift.staffIndex].isTraining[editingShift.dayIndex]}
          allStaff={allStaffForEdit}
          onSave={handleShiftSave}
          onDelete={handleShiftDelete}
          onClose={() => setEditingShift(null)}
        />
      )}
    </div>
  )
}
