import { useEffect, useRef, useState } from 'react'
import { supabase } from '../shared/lib/supabase'
import { fetchWithSupabaseAuth } from '../shared/query'
import {
  addGroupOption,
  attachGroupToItem,
  cloneGroupChainForItem,
  createModifierGroup,
  detachGroupFromItem,
  removeGroupOption,
  setItemGroupPromptMode,
  updateGroupOption,
  updateModifierGroup,
  wouldCreateCycle,
} from './data/menuGroups'
import { setItemImage, uploadMenuImage } from './data/menuExtras'
import {
  DAYS_SHORT,
  Field,
  MenuEmptyState,
  ModifierPicker,
  PosTilePreview,
  SelectInput,
  SmallButton,
  TextAreaInput,
  TextInput,
  cleanDecimal,
  cleanDigits,
  dominantModifierCategory,
  groupRulesSummary,
  money,
} from './components/menuUi'

const ROUTE_INHERIT_VALUE = ''
const ROUTE_NO_PRODUCTION_VALUE = '__no_production_route__'
const ROUTE_MULTI_VALUE = '__multiple_production_routes__'

const COURSE_OPTIONS = [
  { value: '', label: 'Inherit from category' },
  { value: 'appetizer', label: 'Appetizer' },
  { value: 'entree', label: 'Entree' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'drink', label: 'Drink' },
  { value: 'side', label: 'Side' },
  { value: 'other', label: 'Other' },
  { value: 'none', label: 'None' },
]

const AVAILABILITY_MODES = [
  { value: 'always', label: 'Always available' },
  { value: 'schedule', label: 'Weekly schedule' },
  { value: 'seasonal', label: 'Seasonal (date window)' },
  { value: 'manual', label: 'Manual only' },
]

const WEEKDAY_PRICE_RULE_DAYS = [1, 2, 3, 4, 5]
const ALL_PRICE_RULE_DAYS = [0, 1, 2, 3, 4, 5, 6]

function DetailCard({ title, hint, children, actions }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold">{title}</h4>
          {hint && <p className="mt-1 text-sm text-dash-tertiary">{hint}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

// Recursive editor for one question (modifier group). At depth 0 it's a
// question asked on the item; nested, it renders as the modifiers OF a
// modifier (the child_group_id chain) — the same surface at every level, so
// "salad → dressing → add steak → temperature" is just drilling in three times.
function QuestionEditor({
  groupId, restaurantId, itemId, groups, modifiers,
  run, reloadGroups, reloadModifiers, depth = 0, seenIds = [],
  parentModifierName = null, onUnlink = null,
}) {
  const group = groups.find(candidate => candidate.id === groupId)
  const [expandedChild, setExpandedChild] = useState(null)
  const [showPicker, setShowPicker] = useState(false)

  if (!group || depth > 6 || seenIds.includes(groupId)) return null
  const nextSeen = [...seenIds, groupId]

  const modifiersById = Object.fromEntries(modifiers.map(m => [m.id, m]))
  const usedByCount = group.item_ids.length
  const sharedElsewhere = depth === 0 && usedByCount > 1
  const nestableGroups = groups.filter(candidate =>
    candidate.id !== group.id && !wouldCreateCycle(groups, group.id, candidate.id))

  const patchGroup = (patch, message) => run(async () => {
    await updateModifierGroup(group.id, patch)
    await reloadGroups()
  }, message)

  const linkWork = (work, message) => run(async () => {
    await work()
    await reloadGroups()
  }, message)

  const addModifiers = (modifierIds) => run(async () => {
    let order = group.options.length
    for (const modifierId of modifierIds) {
      if (group.options.some(option => option.modifier_id === modifierId)) continue
      await addGroupOption(group.id, modifierId, { display_order: order })
      order += 1
    }
    await reloadGroups()
  }, modifierIds.length > 1 ? 'Modifiers added.' : 'Modifier added.')

  const createAndAddModifier = (draft) => run(async () => {
    const created = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/menu/modifiers`, {
      method: 'POST',
      body: JSON.stringify({ ...draft, is_active: true }),
    })
    if (created?.id) {
      if (depth === 0 && itemId) {
        await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/menu/modifiers/${created.id}/items`, {
          method: 'PUT',
          body: JSON.stringify({ item_ids: [itemId] }),
        }).catch(() => null)
      }
      await addGroupOption(group.id, created.id, { display_order: group.options.length })
    }
    await reloadModifiers()
    await reloadGroups()
  }, 'Modifier created and added.')

  // First drill-in on an option: create its nested question on the spot and
  // open it, so "add modifiers to this modifier" is one click.
  const startDrillIn = (option, modifier) => run(async () => {
    const created = await createModifierGroup(restaurantId, {
      name: `${modifier?.name || 'Choice'} options`,
      min_selections: 0,
      max_selections: null,
      is_required: false,
      prompt_on_order: true,
      display_order: groups.length,
    })
    await updateGroupOption(group.id, option.modifier_id, { child_group_id: created.id })
    setExpandedChild(option.modifier_id)
    await reloadGroups()
  }, 'Nested — now add its modifiers.')

  return (
    <div className={depth > 0 ? 'mt-2 rounded-xl border border-dash-gold/20 bg-white/[0.02] p-3' : 'rounded-xl border border-white/10 bg-white/[0.025] p-4'}>
      {parentModifierName && (
        <p className="label-mono mb-2">Asked when “{parentModifierName}” is picked</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-64 flex-1 items-center gap-2">
          <TextInput
            defaultValue={group.name}
            onBlur={event => {
              const next = event.target.value.trim()
              if (next && next !== group.name) void patchGroup({ name: next })
            }}
          />
          {sharedElsewhere && (
            <span className="whitespace-nowrap rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-[11px] font-semibold text-amber-200" title="Edits here change this question everywhere it is used.">
              Used by {usedByCount} items
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {itemId && (
            <SelectInput
              className="!w-auto !py-1.5"
              value={group.item_prompt_modes?.[itemId] || ''}
              title="Override only this item's behavior; the shared question remains unchanged elsewhere"
              onChange={event => void linkWork(
                () => setItemGroupPromptMode(group.id, itemId, event.target.value || null),
                event.target.value ? 'Item-specific behavior saved.' : 'Using question default.',
              )}
            >
              <option value="">This item: use question default</option>
              <option value="ask">This item: ask every time</option>
              <option value="skip_defaults">This item: apply defaults and skip</option>
              <option value="hidden">This item: hidden</option>
            </SelectInput>
          )}
          <SmallButton
            variant={group.is_required ? 'primary' : 'secondary'}
            onClick={() => void patchGroup({
              is_required: !group.is_required,
              min_selections: !group.is_required ? Math.max(1, group.min_selections || 0) : group.min_selections,
              prompt_on_order: true,
            })}
          >
            {group.is_required ? 'Required' : 'Optional'}
          </SmallButton>
          {sharedElsewhere && (
            <SmallButton
              title="Make a private copy of this question (and everything nested inside it) just for this item"
              onClick={() => run(async () => {
                await cloneGroupChainForItem(restaurantId, groups, group.id, itemId)
                await reloadGroups()
              }, 'Question copied for this item only.')}
            >
              Customize for this item
            </SmallButton>
          )}
          {depth === 0 && (
            <SmallButton
              variant="danger"
              onClick={() => linkWork(() => detachGroupFromItem(group.id, itemId), 'Question removed from this item.')}
            >
              Remove from item
            </SmallButton>
          )}
          {depth > 0 && onUnlink && (
            <SmallButton
              variant="danger"
              title="Stop asking this when the option above is picked (the question itself is kept)"
              onClick={onUnlink}
            >
              Unlink
            </SmallButton>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-dash-secondary">
        <span>Guest picks at least</span>
        <TextInput
          inputMode="numeric"
          className="!w-16 !px-2 !py-1.5 text-center"
          defaultValue={String(group.min_selections ?? 0)}
          onBlur={event => {
            const next = Number(cleanDigits(event.target.value)) || 0
            if (next !== group.min_selections) void patchGroup({ min_selections: group.is_required ? Math.max(1, next) : next })
          }}
        />
        <span>and at most</span>
        <TextInput
          inputMode="numeric"
          className="!w-16 !px-2 !py-1.5 text-center"
          placeholder="∞"
          defaultValue={group.max_selections == null ? '' : String(group.max_selections)}
          onBlur={event => {
            const raw = cleanDigits(event.target.value)
            const next = raw === '' ? null : Math.max(Number(raw), group.min_selections || 0)
            if (next !== group.max_selections) void patchGroup({ max_selections: next })
          }}
        />
        <span className="text-dash-tertiary">·</span>
        <span>first</span>
        <TextInput
          inputMode="numeric"
          className="!w-16 !px-2 !py-1.5 text-center"
          defaultValue={String(group.included_count ?? 0)}
          onBlur={event => {
            const next = Number(cleanDigits(event.target.value)) || 0
            if (next !== (group.included_count ?? 0)) void patchGroup({ included_count: next })
          }}
        />
        <span>are free, then $</span>
        <TextInput
          inputMode="decimal"
          className="!w-20 !px-2 !py-1.5 text-center"
          placeholder="0.00"
          defaultValue={group.overage_price == null ? '' : String(group.overage_price)}
          onBlur={event => {
            const raw = cleanDecimal(event.target.value)
            const next = raw === '' ? null : Number(raw)
            if (next !== group.overage_price) void patchGroup({ overage_price: next })
          }}
        />
        <span>each extra</span>
      </div>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-dash-gold/80">{groupRulesSummary(group)}</p>

      <div className="mt-3 space-y-2">
        {group.options.map(option => {
          const modifier = modifiersById[option.modifier_id]
          const childGroup = option.child_group_id ? groups.find(candidate => candidate.id === option.child_group_id) : null
          const showingChild = expandedChild === option.modifier_id
          const nestedCount = childGroup ? childGroup.options.length : 0
          return (
            <div key={option.modifier_id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-32 text-sm font-medium text-dash-cream">
                  {modifier?.name || 'Modifier'}
                  {Number(modifier?.price_delta) > 0 && <span className="ml-1 font-normal text-dash-tertiary">+{money(modifier.price_delta)}</span>}
                </span>
                <SmallButton
                  variant={option.is_default ? 'primary' : 'secondary'}
                  title="Pre-selected when the item is ordered"
                  onClick={() => linkWork(() => updateGroupOption(group.id, option.modifier_id, { is_default: !option.is_default }))}
                >
                  {option.is_default ? '★ Default' : 'Default'}
                </SmallButton>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  {childGroup ? (
                    <SmallButton
                      variant={nestedCount > 0 ? 'primary' : 'secondary'}
                      title={`Modifiers guests can add when they pick ${modifier?.name || 'this'}`}
                      onClick={() => setExpandedChild(showingChild ? null : option.modifier_id)}
                    >
                      {showingChild ? '▾' : '▸'} Modifiers ({nestedCount})
                    </SmallButton>
                  ) : (
                    <>
                      <SmallButton
                        title={`Give ${modifier?.name || 'this option'} its own modifiers — sauces on the side salad, temperature on the steak...`}
                        onClick={() => void startDrillIn(option, modifier)}
                      >
                        ＋ Modifiers
                      </SmallButton>
                      {nestableGroups.length > 0 && (
                        <SelectInput
                          className="!w-auto !py-1.5"
                          value=""
                          title="Reuse a question that already exists instead of building a new one"
                          onChange={event => {
                            if (!event.target.value) return
                            void linkWork(() => updateGroupOption(group.id, option.modifier_id, { child_group_id: event.target.value }), 'Question linked.')
                            setExpandedChild(option.modifier_id)
                          }}
                        >
                          <option value="">reuse existing...</option>
                          {nestableGroups.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
                        </SelectInput>
                      )}
                    </>
                  )}
                  <SmallButton variant="danger" onClick={() => linkWork(() => removeGroupOption(group.id, option.modifier_id))}>Remove</SmallButton>
                </div>
              </div>
              {childGroup && showingChild && (
                <QuestionEditor
                  groupId={childGroup.id}
                  restaurantId={restaurantId}
                  itemId={itemId}
                  groups={groups}
                  modifiers={modifiers}
                  run={run}
                  reloadGroups={reloadGroups}
                  reloadModifiers={reloadModifiers}
                  depth={depth + 1}
                  seenIds={nextSeen}
                  parentModifierName={modifier?.name || null}
                  onUnlink={() => {
                    setExpandedChild(null)
                    void linkWork(() => updateGroupOption(group.id, option.modifier_id, { child_group_id: null }), 'Nested question unlinked.')
                  }}
                />
              )}
            </div>
          )
        })}
        {group.options.length === 0 && <p className="text-sm text-dash-tertiary">No modifiers in this question yet — add some below.</p>}
      </div>

      <div className="mt-3">
        {showPicker ? (
          <div className="space-y-2">
            <ModifierPicker
              autoFocus
              modifiers={modifiers}
              excludeIds={new Set(group.options.map(option => option.modifier_id))}
              defaultCategory={dominantModifierCategory(group.options, modifiersById, group.name)}
              extraCategoryNames={groups.map(candidate => candidate.name)}
              onAddExisting={ids => void addModifiers(ids)}
              onCreateNew={draft => void createAndAddModifier(draft)}
            />
            <SmallButton onClick={() => setShowPicker(false)}>Done</SmallButton>
          </div>
        ) : (
          <SmallButton variant="primary" onClick={() => setShowPicker(true)}>+ Add modifiers</SmallButton>
        )}
      </div>
    </div>
  )
}

export function MenuItemDetail({
  restaurantId, item, categories, categoryNames, stations, groups, modifiers, specials,
  productionRouting, onRouteItemProduction,
  busy, onBack, patchItem, deleteItem, run,
  reloadGroups, reloadModifiers, reloadSpecials, reloadImages,
}) {
  const fileInputRef = useRef(null)
  const [newQuestion, setNewQuestion] = useState('')
  const [questionSearch, setQuestionSearch] = useState('')
  const [showQuickPicker, setShowQuickPicker] = useState(false)
  const [specialForm, setSpecialForm] = useState({ display_name: '', special_price: '', note: '', expires_at: '' })
  const [schedule, setSchedule] = useState(() => ({
    availability_mode: item.availability_mode || 'always',
    availability_days: Array.isArray(item.availability_days) && item.availability_days.length > 0 ? item.availability_days : [0, 1, 2, 3, 4, 5, 6],
    availability_start_time: item.availability_start_time ? String(item.availability_start_time).slice(0, 5) : '',
    availability_end_time: item.availability_end_time ? String(item.availability_end_time).slice(0, 5) : '',
    availability_start_date: item.availability_start_date || '',
    availability_end_date: item.availability_end_date || '',
    availability_notes: item.availability_notes || '',
  }))

  const itemGroups = groups
    .filter(group => group.item_ids.includes(item.id))
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0) || a.name.localeCompare(b.name))
  // Questions this item doesn't ask yet, most-reused first — one click attaches.
  const attachableGroups = groups
    .filter(group => !group.item_ids.includes(item.id))
    .sort((a, b) => b.item_ids.length - a.item_ids.length || a.name.localeCompare(b.name))
  const filteredAttachableGroups = questionSearch.trim()
    ? attachableGroups.filter(group => group.name.toLowerCase().includes(questionSearch.trim().toLowerCase()))
    : attachableGroups
  const itemSpecials = specials.filter(special => special.menu_item_id === item.id)
  const category = categories.find(candidate => candidate.name === item.category)
  const stationName = (id) => stations.find(station => station.id === id)?.name

  // Quick-add lands modifiers in this item's "Extras" question, creating and
  // attaching it on first use — no question naming required.
  const ensureExtrasGroup = async () => {
    const existing = itemGroups.find(group => group.name.trim().toLowerCase() === 'extras')
    if (existing) return existing
    const created = await createModifierGroup(restaurantId, {
      name: 'Extras',
      min_selections: 0,
      max_selections: null,
      is_required: false,
      prompt_on_order: true,
      display_order: groups.length,
    })
    await attachGroupToItem(created.id, item.id, itemGroups.length)
    return { ...created, options: [] }
  }

  const createNamedQuestion = () => {
    if (!newQuestion.trim() || busy) return
    return run(async () => {
      const created = await createModifierGroup(restaurantId, {
        name: newQuestion.trim(),
        min_selections: 0,
        max_selections: null,
        is_required: false,
        prompt_on_order: true,
        display_order: groups.length,
      })
      await attachGroupToItem(created.id, item.id, itemGroups.length)
      setNewQuestion('')
      await reloadGroups()
    }, 'Question added.')
  }

  const quickAddModifiers = (modifierIds) => run(async () => {
    const extras = await ensureExtrasGroup()
    let order = extras.options?.length || 0
    for (const modifierId of modifierIds) {
      if (extras.options?.some(option => option.modifier_id === modifierId)) continue
      await addGroupOption(extras.id, modifierId, { display_order: order })
      order += 1
    }
    await reloadGroups()
  }, modifierIds.length > 1 ? 'Modifiers added to this item.' : 'Modifier added to this item.')

  // Quick-create routes by category: naming an existing question sends the
  // modifier into that question (attaching it to this item if needed);
  // anything else lands in this item's "Extras".
  const quickCreateModifier = (draft) => {
    const categoryNeedle = (draft.group_name || '').trim().toLowerCase()
    const matchingGroup = categoryNeedle
      ? groups.find(group => group.name.trim().toLowerCase() === categoryNeedle)
      : null
    return run(async () => {
      const created = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/menu/modifiers`, {
        method: 'POST',
        body: JSON.stringify({ ...draft, is_active: true }),
      })
      if (created?.id) {
        await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/menu/modifiers/${created.id}/items`, {
          method: 'PUT',
          body: JSON.stringify({ item_ids: [item.id] }),
        }).catch(() => null)
        const target = matchingGroup || await ensureExtrasGroup()
        if (matchingGroup && !matchingGroup.item_ids.includes(item.id)) {
          await attachGroupToItem(matchingGroup.id, item.id, itemGroups.length)
        }
        if (!target.options?.some(option => option.modifier_id === created.id)) {
          await addGroupOption(target.id, created.id, { display_order: target.options?.length || 0 })
        }
      }
      await reloadModifiers()
      await reloadGroups()
    }, matchingGroup ? `Modifier added to "${matchingGroup.name}" on this item.` : 'Modifier created and added.')
  }

  const uploadPhoto = (file) => {
    if (!file) return
    return run(async () => {
      const url = await uploadMenuImage(restaurantId, file)
      await setItemImage(restaurantId, item.id, url)
      await reloadImages()
    }, 'Photo updated.')
  }

  const saveSchedule = () => patchItem(item.id, {
    availability_mode: schedule.availability_mode,
    availability_days: schedule.availability_days,
    availability_start_time: schedule.availability_start_time || null,
    availability_end_time: schedule.availability_end_time || null,
    availability_start_date: schedule.availability_start_date || null,
    availability_end_date: schedule.availability_end_date || null,
    availability_notes: schedule.availability_notes.trim() || null,
  }, 'Availability saved.')

  const pinSpecial = () => run(async () => {
    const { data, error } = await supabase
      .from('pos_daily_specials')
      .insert({
        restaurant_id: restaurantId,
        menu_item_id: item.id,
        display_name: specialForm.display_name.trim() || item.name,
        note: specialForm.note.trim() || null,
        special_price: specialForm.special_price === '' ? null : Number(specialForm.special_price),
        schedule_kind: 'manual',
        days_of_week: [0, 1, 2, 3, 4, 5, 6],
        expires_at: specialForm.expires_at ? new Date(specialForm.expires_at).toISOString() : null,
        sort_order: 0,
        is_active: true,
      })
      .select('*')
      .single()
    if (error) throw error
    await supabase.from('pos_daily_special_events').insert({
      restaurant_id: restaurantId,
      daily_special_id: data.id,
      event_type: 'created',
      after_data: data,
    }).then(() => null, () => null)
    setSpecialForm({ display_name: '', special_price: '', note: '', expires_at: '' })
    await reloadSpecials()
  }, 'Special pinned.')

  const toggleSpecial = (special) => run(async () => {
    const { error } = await supabase
      .from('pos_daily_specials')
      .update({ is_active: !special.is_active, updated_at: new Date().toISOString() })
      .eq('id', special.id)
      .eq('restaurant_id', restaurantId)
    if (error) throw error
    await reloadSpecials()
  })

  const archiveSpecial = (special) => run(async () => {
    const { error } = await supabase
      .from('pos_daily_specials')
      .update({ archived_at: new Date().toISOString(), is_active: false, updated_at: new Date().toISOString() })
      .eq('id', special.id)
      .eq('restaurant_id', restaurantId)
    if (error) throw error
    await reloadSpecials()
  }, 'Special archived.')

  // ── Happy hour / recurring price rules (item-scoped) ─────────────────────────
  // Written directly to pos_menu_price_rules, mirroring how specials are managed
  // here. RLS restricts this to owner/manager. Delta rules (% / $ off) auto-track
  // the base price; a flat rule sets an absolute price.
  const [itemPriceRules, setItemPriceRules] = useState([])
  const [priceRuleForm, setPriceRuleForm] = useState({
    name: '', adjustment_type: 'percent_off', adjustment_value: '', start_time: '', end_time: '',
    days_of_week: WEEKDAY_PRICE_RULE_DAYS,
  })
  const reloadPriceRules = async () => {
    const { data } = await supabase
      .from('pos_menu_price_rules')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('menu_item_id', item.id)
      .is('archived_at', null)
      .order('priority', { ascending: false })
    setItemPriceRules(data || [])
  }
  useEffect(() => { void reloadPriceRules() }, [item.id, restaurantId])

  const priceRuleSummary = (rule) => rule.adjustment_type === 'percent_off'
    ? `${Number(rule.adjustment_value)}% off`
    : rule.adjustment_type === 'amount_off'
      ? `${money(rule.adjustment_value)} off`
      : `${money(rule.adjustment_value)} flat`
  const fmtRuleTime = (t) => (t ? String(t).slice(0, 5) : '')
  const priceRuleDaysSummary = (rule) => {
    const days = [...(rule.days_of_week || [])].sort((a, b) => a - b)
    if (days.length === 7) return 'Every day'
    if (days.length === 5 && WEEKDAY_PRICE_RULE_DAYS.every(day => days.includes(day))) return 'Mon-Fri'
    return days.map(day => DAYS_SHORT[day]).filter(Boolean).join(', ') || 'No days'
  }
  const priceRuleScheduleSummary = (rule) => {
    if (!rule.start_time && !rule.end_time) return 'always on'
    const timeWindow = (fmtRuleTime(rule.start_time) || 'open') + '-' + (fmtRuleTime(rule.end_time) || 'close')
    return priceRuleDaysSummary(rule) + ' · ' + timeWindow
  }

  const addPriceRule = () => run(async () => {
    const value = priceRuleForm.adjustment_value === '' ? 0 : Number(priceRuleForm.adjustment_value)
    if (!Number.isFinite(value) || value < 0) throw new Error('Enter a valid amount')
    if (priceRuleForm.adjustment_type === 'percent_off' && value > 100) throw new Error('% off cannot exceed 100')
    const scheduled = Boolean(priceRuleForm.start_time || priceRuleForm.end_time)
    if (scheduled && (!priceRuleForm.start_time || !priceRuleForm.end_time)) throw new Error('Choose both a start and end time')
    if (scheduled && priceRuleForm.days_of_week.length === 0) throw new Error('Choose at least one day')
    const { data, error } = await supabase
      .from('pos_menu_price_rules')
      .insert({
        restaurant_id: restaurantId,
        name: priceRuleForm.name.trim() || 'Happy hour',
        scope_type: 'item',
        menu_item_id: item.id,
        adjustment_type: priceRuleForm.adjustment_type,
        adjustment_value: value,
        is_active: true,
        schedule_kind: scheduled ? 'weekly' : 'manual',
        days_of_week: scheduled ? [...priceRuleForm.days_of_week].sort((a, b) => a - b) : ALL_PRICE_RULE_DAYS,
        start_time: priceRuleForm.start_time || null,
        end_time: priceRuleForm.end_time || null,
      })
      .select('*')
      .single()
    if (error) throw error
    await supabase.from('pos_menu_price_rule_events').insert({
      restaurant_id: restaurantId,
      price_rule_id: data.id,
      event_type: 'created',
      after_data: data,
    }).then(() => null, () => null)
    setPriceRuleForm({
      name: '', adjustment_type: 'percent_off', adjustment_value: '', start_time: '', end_time: '',
      days_of_week: WEEKDAY_PRICE_RULE_DAYS,
    })
    await reloadPriceRules()
  }, 'Price rule added.')

  const togglePriceRule = (rule) => run(async () => {
    const { error } = await supabase
      .from('pos_menu_price_rules')
      .update({ is_active: !rule.is_active, updated_at: new Date().toISOString() })
      .eq('id', rule.id)
      .eq('restaurant_id', restaurantId)
    if (error) throw error
    await reloadPriceRules()
  })

  const archivePriceRule = (rule) => run(async () => {
    const { error } = await supabase
      .from('pos_menu_price_rules')
      .update({ archived_at: new Date().toISOString(), is_active: false, updated_at: new Date().toISOString() })
      .eq('id', rule.id)
      .eq('restaurant_id', restaurantId)
    if (error) throw error
    await reloadPriceRules()
  }, 'Price rule archived.')

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <SmallButton onClick={onBack}>← All items</SmallButton>
          <div title={category?.color ? 'How this button looks on the POS (color comes from the category)' : 'This item’s category has no button color yet — set one on the Categories tab'}>
            <PosTilePreview color={category?.color} label={item.name} sublabel={money(item.price)} size="sm" />
          </div>
          <div>
            <h3 className="text-2xl font-semibold tracking-tight">{item.name}</h3>
            <p className="text-sm text-dash-tertiary">{item.category || 'Uncategorized'} · {money(item.price)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <SmallButton
            variant={item.is_available === false ? 'danger' : 'secondary'}
            onClick={() => void patchItem(item.id, { is_available: item.is_available === false }, item.is_available === false ? 'Item restored.' : "Item 86'd.")}
          >
            {item.is_available === false ? "86'd — tap to restore" : 'Available'}
          </SmallButton>
          <SmallButton variant="danger" onClick={() => { void deleteItem(item.id); onBack() }} disabled={busy}>Remove item</SmallButton>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <DetailCard title="Basics" hint="Changes save when you click away.">
            <div className="grid gap-3 md:grid-cols-[1.4fr_120px_1fr]">
              <Field label="Name">
                <TextInput
                  defaultValue={item.name}
                  onBlur={event => {
                    const next = event.target.value.trim()
                    if (next && next !== item.name) void patchItem(item.id, { name: next })
                  }}
                />
              </Field>
              <Field label="Price $">
                <TextInput
                  inputMode="decimal"
                  defaultValue={item.price != null ? String(item.price) : ''}
                  onBlur={event => {
                    const next = Number(cleanDecimal(event.target.value))
                    if (Number.isFinite(next) && next !== Number(item.price)) void patchItem(item.id, { price: next })
                  }}
                />
              </Field>
              <Field label="Category">
                <SelectInput value={item.category || 'Other'} onChange={event => void patchItem(item.id, { category: event.target.value })}>
                  {categoryNames.map(name => <option key={name} value={name}>{name}</option>)}
                  {!categoryNames.includes(item.category || 'Other') && <option value={item.category || 'Other'}>{item.category || 'Other'}</option>}
                </SelectInput>
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Description">
                <TextAreaInput
                  defaultValue={item.description || ''}
                  placeholder="What guests see under the item name..."
                  onBlur={event => {
                    const next = event.target.value.trim()
                    if (next !== (item.description || '')) void patchItem(item.id, { description: next || null })
                  }}
                />
              </Field>
            </div>
          </DetailCard>

          <DetailCard
            title={`Modifiers & questions (${itemGroups.length})`}
            hint='Asked in order when this item is ordered. Open "Modifiers" on any row to give that modifier its own modifiers — salad → dressing → add steak → temperature, as deep as you need.'
          >
            <div className="space-y-3">
              {itemGroups.map(group => (
                <QuestionEditor
                  key={group.id}
                  groupId={group.id}
                  restaurantId={restaurantId}
                  itemId={item.id}
                  groups={groups}
                  modifiers={modifiers}
                  run={run}
                  reloadGroups={reloadGroups}
                  reloadModifiers={reloadModifiers}
                />
              ))}
              {itemGroups.length === 0 && (
                <MenuEmptyState title="No modifiers yet">
                  Quick-add modifiers below, or create a named question — "Choose a side", "Pick a temperature".
                </MenuEmptyState>
              )}
            </div>

            <div className="mt-4 border-t border-white/10 pt-4">
              {showQuickPicker ? (
                <div className="space-y-2">
                  <p className="label-mono">Quick add modifiers to this item</p>
                  <ModifierPicker
                    autoFocus
                    modifiers={modifiers}
                    excludeIds={new Set(itemGroups.flatMap(group => group.options.map(option => option.modifier_id)))}
                    extraCategoryNames={groups.map(group => group.name)}
                    onAddExisting={ids => void quickAddModifiers(ids)}
                    onCreateNew={draft => void quickCreateModifier(draft)}
                  />
                  <p className="text-xs text-dash-tertiary">New modifiers land in an "Extras" question on this item — or, if the category you type names an existing question, straight into that question.</p>
                  <SmallButton onClick={() => setShowQuickPicker(false)}>Done</SmallButton>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <SmallButton variant="primary" onClick={() => setShowQuickPicker(true)}>+ Add modifiers</SmallButton>
                    <span className="text-sm text-dash-tertiary">or a named question:</span>
                    <div className="min-w-56 flex-1">
                      <TextInput
                        value={newQuestion}
                        onChange={event => setNewQuestion(event.target.value)}
                        onKeyDown={event => {
                          if (event.key === 'Enter') void createNamedQuestion()
                        }}
                        placeholder='e.g. "Choose a side"'
                      />
                    </div>
                    <SmallButton disabled={!newQuestion.trim() || busy} onClick={() => void createNamedQuestion()}>
                      Add question
                    </SmallButton>
                  </div>
                  {attachableGroups.length > 0 && (
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <p className="label-mono">Reuse an existing question — click to attach</p>
                        {attachableGroups.length > 8 && (
                          <div className="w-56">
                            <TextInput
                              value={questionSearch}
                              onChange={event => setQuestionSearch(event.target.value)}
                              placeholder="Search questions..."
                              className="!py-1.5"
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {filteredAttachableGroups.map(group => (
                          <button
                            key={group.id}
                            type="button"
                            disabled={busy}
                            title={groupRulesSummary(group)}
                            onClick={() => run(async () => {
                              await attachGroupToItem(group.id, item.id, itemGroups.length)
                              await reloadGroups()
                            }, `"${group.name}" now asked on this item.`)}
                            className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-dash-secondary transition hover:border-dash-gold/60 hover:text-dash-cream disabled:opacity-50"
                          >
                            + {group.name}
                            <span className="ml-1.5 text-xs text-dash-tertiary">
                              {group.options.length} option{group.options.length === 1 ? '' : 's'}
                              {group.item_ids.length > 0 && ` · ${group.item_ids.length} item${group.item_ids.length === 1 ? '' : 's'}`}
                            </span>
                          </button>
                        ))}
                        {filteredAttachableGroups.length === 0 && (
                          <p className="text-sm text-dash-tertiary">No questions match "{questionSearch}".</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </DetailCard>

          <DetailCard title="Specials" hint="Overlay a special name/price on this item. Full scheduling lives in the Specials & Schedule tab.">
            <div className="space-y-2">
              {itemSpecials.map(special => (
                <div key={special.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm">
                  <div>
                    <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">Special</span>
                    <span className="ml-2 font-medium text-dash-cream">{special.display_name || item.name}</span>
                    <span className="ml-2 text-dash-tertiary">{special.special_price != null ? money(special.special_price) : money(item.price)} · {special.schedule_kind}</span>
                  </div>
                  <div className="flex gap-2">
                    <SmallButton variant={special.is_active ? 'primary' : 'secondary'} onClick={() => void toggleSpecial(special)}>
                      {special.is_active ? 'Active' : 'Paused'}
                    </SmallButton>
                    <SmallButton variant="danger" onClick={() => void archiveSpecial(special)}>Archive</SmallButton>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[1.2fr_110px_1.4fr_1fr_auto]">
              <TextInput value={specialForm.display_name} onChange={event => setSpecialForm(prev => ({ ...prev, display_name: event.target.value }))} placeholder={`Special name (${item.name})`} />
              <TextInput inputMode="decimal" value={specialForm.special_price} onChange={event => setSpecialForm(prev => ({ ...prev, special_price: cleanDecimal(event.target.value) }))} placeholder="Price" />
              <TextInput value={specialForm.note} onChange={event => setSpecialForm(prev => ({ ...prev, note: event.target.value }))} placeholder="Note (optional)" />
              <TextInput type="datetime-local" value={specialForm.expires_at} onChange={event => setSpecialForm(prev => ({ ...prev, expires_at: event.target.value }))} />
              <SmallButton variant="primary" onClick={() => void pinSpecial()} disabled={busy}>Pin special</SmallButton>
            </div>
          </DetailCard>

          <DetailCard title="Happy hour & price rules" hint="Recurring price change for this item during a daily window. % off / $ off follow the base price; flat sets an absolute price. Leave times empty for always-on.">
            <div className="space-y-2">
              {itemPriceRules.map(rule => (
                <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm">
                  <div>
                    <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-900">Happy hour</span>
                    <span className="ml-2 font-medium text-dash-cream">{rule.name}</span>
                    <span className="ml-2 text-dash-tertiary">
                      {priceRuleSummary(rule)} · {priceRuleScheduleSummary(rule)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <SmallButton variant={rule.is_active ? 'primary' : 'secondary'} onClick={() => void togglePriceRule(rule)}>
                      {rule.is_active ? 'Active' : 'Paused'}
                    </SmallButton>
                    <SmallButton variant="danger" onClick={() => void archivePriceRule(rule)}>Archive</SmallButton>
                  </div>
                </div>
              ))}
              {itemPriceRules.length === 0 ? <p className="text-sm text-dash-tertiary">No price rules yet.</p> : null}
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[1.3fr_120px_110px_110px_110px_auto]">
              <TextInput value={priceRuleForm.name} onChange={event => setPriceRuleForm(prev => ({ ...prev, name: event.target.value }))} placeholder="Rule name (Happy hour)" />
              <SelectInput value={priceRuleForm.adjustment_type} onChange={event => setPriceRuleForm(prev => ({ ...prev, adjustment_type: event.target.value }))}>
                <option value="percent_off">% off</option>
                <option value="amount_off">$ off</option>
                <option value="fixed">Flat price</option>
              </SelectInput>
              <TextInput inputMode="decimal" value={priceRuleForm.adjustment_value} onChange={event => setPriceRuleForm(prev => ({ ...prev, adjustment_value: cleanDecimal(event.target.value) }))} placeholder={priceRuleForm.adjustment_type === 'percent_off' ? '20' : '2.00'} />
              <TextInput type="time" value={priceRuleForm.start_time} onChange={event => setPriceRuleForm(prev => ({ ...prev, start_time: event.target.value }))} />
              <TextInput type="time" value={priceRuleForm.end_time} onChange={event => setPriceRuleForm(prev => ({ ...prev, end_time: event.target.value }))} />
              <SmallButton variant="primary" onClick={() => void addPriceRule()} disabled={busy}>Add rule</SmallButton>
            </div>
            {(priceRuleForm.start_time || priceRuleForm.end_time) && (
              <div className="mt-3">
                <span className="label-mono">Days</span>
                <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Price rule days">
                  {DAYS_SHORT.map((day, index) => {
                    const selected = priceRuleForm.days_of_week.includes(index)
                    return (
                      <SmallButton
                        key={day}
                        variant={selected ? 'primary' : 'secondary'}
                        title={(selected ? 'Remove ' : 'Add ') + day}
                        onClick={() => setPriceRuleForm(prev => ({
                          ...prev,
                          days_of_week: selected
                            ? prev.days_of_week.filter(value => value !== index)
                            : [...prev.days_of_week, index].sort((a, b) => a - b),
                        }))}
                      >
                        {day}
                      </SmallButton>
                    )
                  })}
                </div>
              </div>
            )}
          </DetailCard>
        </div>

        <div className="space-y-5">
          <DetailCard title="Photo" hint="Shown on the POS tile and online ordering.">
            <div className="space-y-3">
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="h-44 w-full rounded-xl object-cover" />
              ) : (
                <div className="flex h-44 w-full items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.02] text-sm text-dash-tertiary">
                  No photo yet
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={event => {
                  void uploadPhoto(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
              <div className="flex gap-2">
                <SmallButton variant="primary" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                  {item.image_url ? 'Replace photo' : 'Upload photo'}
                </SmallButton>
                {item.image_url && (
                  <SmallButton
                    variant="danger"
                    onClick={() => run(async () => {
                      await setItemImage(restaurantId, item.id, null)
                      await reloadImages()
                    }, 'Photo removed.')}
                  >
                    Remove
                  </SmallButton>
                )}
              </div>
            </div>
          </DetailCard>

          <DetailCard title="Availability schedule">
            <div className="space-y-3">
              <SelectInput value={schedule.availability_mode} onChange={event => setSchedule(prev => ({ ...prev, availability_mode: event.target.value }))}>
                {AVAILABILITY_MODES.map(mode => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
              </SelectInput>
              {schedule.availability_mode === 'schedule' && (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS_SHORT.map((day, index) => (
                      <SmallButton
                        key={day}
                        variant={schedule.availability_days.includes(index) ? 'primary' : 'secondary'}
                        onClick={() => setSchedule(prev => ({
                          ...prev,
                          availability_days: prev.availability_days.includes(index)
                            ? prev.availability_days.filter(value => value !== index)
                            : [...prev.availability_days, index].sort(),
                        }))}
                      >
                        {day}
                      </SmallButton>
                    ))}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="From"><TextInput type="time" value={schedule.availability_start_time} onChange={event => setSchedule(prev => ({ ...prev, availability_start_time: event.target.value }))} /></Field>
                    <Field label="Until"><TextInput type="time" value={schedule.availability_end_time} onChange={event => setSchedule(prev => ({ ...prev, availability_end_time: event.target.value }))} /></Field>
                  </div>
                </>
              )}
              {schedule.availability_mode === 'seasonal' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Start date"><TextInput type="date" value={schedule.availability_start_date} onChange={event => setSchedule(prev => ({ ...prev, availability_start_date: event.target.value }))} /></Field>
                  <Field label="End date"><TextInput type="date" value={schedule.availability_end_date} onChange={event => setSchedule(prev => ({ ...prev, availability_end_date: event.target.value }))} /></Field>
                </div>
              )}
              <TextInput value={schedule.availability_notes} onChange={event => setSchedule(prev => ({ ...prev, availability_notes: event.target.value }))} placeholder="Notes (brunch only, seasonal...)" />
              <SmallButton variant="primary" onClick={() => void saveSchedule()} disabled={busy}>Save availability</SmallButton>
            </div>
          </DetailCard>

          <DetailCard title="Kitchen" hint={productionRouting?.categoryRouting?.description || (category?.routing_station_id ? `Category default: ${stationName(category.routing_station_id) || 'station'}` : 'No category default station set.')}>
            <div className="space-y-3">
              <Field label="Production route">
                <SelectInput
                  value={productionRouting?.value ?? item.routing_station_id ?? ''}
                  onChange={event => {
                    if (event.target.value === ROUTE_MULTI_VALUE) return
                    if (onRouteItemProduction) {
                      void onRouteItemProduction(item, event.target.value)
                      return
                    }
                    void patchItem(item.id, { routing_station_id: event.target.value || null }, event.target.value ? 'Station override saved.' : 'Now inherits category station.')
                  }}
                >
                  <option value={ROUTE_INHERIT_VALUE}>Inherit category/fallback</option>
                  <option value={ROUTE_NO_PRODUCTION_VALUE}>No production route</option>
                  {productionRouting?.value === ROUTE_MULTI_VALUE && <option value={ROUTE_MULTI_VALUE}>Multiple stations</option>}
                  {stations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}
                </SelectInput>
                {productionRouting?.description && <p className="mt-2 text-xs text-dash-tertiary">{productionRouting.description}</p>}
              </Field>
              <Field label="Course">
                <SelectInput
                  value={item.course_type || ''}
                  onChange={event => void patchItem(item.id, { course_type: event.target.value || null })}
                >
                  {COURSE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </SelectInput>
              </Field>
              <Field label="Prep minutes">
                <TextInput
                  inputMode="numeric"
                  defaultValue={item.prep_time_minutes == null ? '' : String(item.prep_time_minutes)}
                  onBlur={event => {
                    const raw = cleanDigits(event.target.value)
                    const next = raw === '' ? null : Number(raw)
                    if (next !== item.prep_time_minutes) void patchItem(item.id, { prep_time_minutes: next })
                  }}
                />
              </Field>
            </div>
          </DetailCard>
        </div>
      </div>
    </div>
  )
}

export default MenuItemDetail
