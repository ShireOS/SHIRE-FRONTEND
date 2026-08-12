import { useMemo, useState } from 'react'
import { SmartTimeInput } from '../shared/components/SmartTimeInput'
import {
  DAYS_SHORT,
  Field,
  ModifierPicker,
  SelectInput,
  SmallButton,
  TextAreaInput,
  TextInput,
  cleanDecimal,
  cleanDigits,
  groupRulesSummary,
  money,
} from './components/menuUi'
import {
  ROUTE_INHERIT_VALUE,
  ROUTE_MULTI_VALUE,
  ROUTE_NO_PRODUCTION_VALUE,
} from './menuRouting'

const AVAILABILITY_MODES = [
  { value: 'always', label: 'Always available' },
  { value: 'schedule', label: 'Weekly schedule' },
  { value: 'seasonal', label: 'Seasonal (date window)' },
  { value: 'manual', label: 'Manual only' },
]

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

function CreateCard({ title, hint, children }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <h4 className="text-lg font-semibold">{title}</h4>
      {hint && <p className="mt-1 text-sm text-dash-tertiary">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

// Full-screen "New item" flow (replaces the old inline add row). Nothing is
// saved until Save; "Save & duplicate" saves this item and immediately starts
// the next one holding everything — category, price, printers, availability,
// questions — with only the name (and photo) cleared. Question/modifier picks
// are staged on the draft and applied right after the item row is created.
export function MenuItemCreate({
  categoryNames,
  categoriesByName = {},
  stations,
  groups = [],
  modifiers = [],
  source,
  sourceGroupIds = [],
  carryover,
  initialDraft,
  busy,
  onCancel,
  onSave,
  onCreateModifier = null,
  resolveRoutingForDraft = null,
}) {
  const [draft, setDraft] = useState(initialDraft)
  const [showModifierPicker, setShowModifierPicker] = useState(false)
  const [questionSearch, setQuestionSearch] = useState('')
  const set = (patch) => setDraft(prev => ({ ...prev, ...patch }))
  const resolvedRoute = resolveRoutingForDraft?.(draft) || null
  const routingIssue = resolvedRoute?.error || ''
  const canSave = Boolean(draft.name.trim()) && draft.price !== '' && !routingIssue && !busy
  const [routeOverrideOpen, setRouteOverrideOpen] = useState(() => Boolean(draft.routing))

  const modifiersById = useMemo(() => Object.fromEntries(modifiers.map(m => [m.id, m])), [modifiers])

  // Question sources on this draft, mirroring the item editor: carried over
  // from the duplicate source, inherited from the chosen category, picked here.
  const sourceGroups = useMemo(
    () => sourceGroupIds.map(id => groups.find(group => group.id === id)).filter(Boolean),
    [sourceGroupIds, groups],
  )
  const category = categoriesByName[draft.category || ''] || null
  const inheritedGroups = useMemo(
    () => (category
      ? groups.filter(group => (group.category_links || []).some(link => link.category_id === category.id))
      : []),
    [groups, category],
  )
  const selectedGroups = (draft.question_ids || []).map(id => groups.find(group => group.id === id)).filter(Boolean)
  const takenGroupIds = new Set([
    ...(draft.question_ids || []),
    ...inheritedGroups.map(group => group.id),
    ...sourceGroupIds,
  ])
  const attachableGroups = groups
    .filter(group => !takenGroupIds.has(group.id))
    .sort((a, b) => b.item_ids.length - a.item_ids.length || a.name.localeCompare(b.name))
  const filteredAttachableGroups = questionSearch.trim()
    ? attachableGroups.filter(group => group.name.toLowerCase().includes(questionSearch.trim().toLowerCase()))
    : attachableGroups

  const extrasModifiers = (draft.extra_modifier_ids || []).map(id => modifiersById[id]).filter(Boolean)
  const excludeModifierIds = new Set([
    ...(draft.extra_modifier_ids || []),
    ...[...selectedGroups, ...inheritedGroups, ...sourceGroups].flatMap(group => (group.options || []).map(option => option.modifier_id)),
  ])

  const addQuestion = (groupId) => setDraft(prev => ({
    ...prev,
    question_ids: (prev.question_ids || []).includes(groupId) ? prev.question_ids : [...(prev.question_ids || []), groupId],
  }))
  const removeQuestion = (groupId) => setDraft(prev => ({
    ...prev,
    question_ids: (prev.question_ids || []).filter(id => id !== groupId),
    pending_group_options: (prev.pending_group_options || []).filter(pending => pending.group_id !== groupId),
  }))
  const addExtras = (modifierIds) => setDraft(prev => ({
    ...prev,
    extra_modifier_ids: [...new Set([...(prev.extra_modifier_ids || []), ...modifierIds])],
  }))
  const removeExtra = (modifierId) => setDraft(prev => ({
    ...prev,
    extra_modifier_ids: (prev.extra_modifier_ids || []).filter(id => id !== modifierId),
  }))

  // Create-new from the picker: the modifier itself is created immediately
  // (it's a shared library object); where it lands on this item is staged.
  // Naming an existing question routes it there, like the item editor does;
  // anything else goes to this item's "Extras".
  const quickCreateModifier = async (modifierDraft) => {
    if (!onCreateModifier) return
    const created = await onCreateModifier(modifierDraft)
    if (!created?.id) return
    const needle = (modifierDraft.group_name || '').trim().toLowerCase()
    const match = needle ? groups.find(group => group.name.trim().toLowerCase() === needle) : null
    if (match) {
      setDraft(prev => {
        const alreadyAsked = (prev.question_ids || []).includes(match.id)
          || inheritedGroups.some(group => group.id === match.id)
          || sourceGroupIds.includes(match.id)
        return {
          ...prev,
          question_ids: alreadyAsked ? (prev.question_ids || []) : [...(prev.question_ids || []), match.id],
          pending_group_options: [...(prev.pending_group_options || []), { group_id: match.id, modifier_id: created.id }],
        }
      })
    } else {
      addExtras([created.id])
    }
  }

  const questionCount = sourceGroups.length + inheritedGroups.length + selectedGroups.length + (extrasModifiers.length > 0 ? 1 : 0)

  const carryoverBits = source ? [
    'category & price',
    carryover?.questions ? `${carryover.questions} question${carryover.questions === 1 ? '' : 's'} & their mods` : null,
    carryover?.modOverrides ? 'modifier price/print overrides' : null,
    'printer routing',
    'availability schedule',
    'tax split',
    carryover?.specials ? `${carryover.specials} special${carryover.specials === 1 ? '' : 's'}` : null,
    'happy hour rules',
    carryover?.allergens ? 'allergen settings' : null,
  ].filter(Boolean) : []

  const actions = (
    <div className="flex flex-wrap gap-2">
      <SmallButton onClick={onCancel} disabled={busy}>Cancel</SmallButton>
      <SmallButton
        variant="secondary"
        disabled={!canSave}
        title="Save this item and immediately start the next one — everything is kept, you just type the new name"
        onClick={() => void onSave(draft, { duplicate: true })}
      >
        Save & duplicate
      </SmallButton>
      <SmallButton
        variant="primary"
        disabled={!canSave}
        title={canSave ? 'Save and open the full item editor' : routingIssue || 'Name and price are required'}
        onClick={() => void onSave(draft, { duplicate: false })}
      >
        Save item
      </SmallButton>
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-2xl font-semibold tracking-tight">
            {source ? <>New item — duplicating “{source.name}”</> : 'New item'}
          </h3>
          <p className="mt-1 text-sm text-dash-tertiary">
            {source
              ? 'Type the name (and tweak anything below) — everything else carries over.'
              : 'Nothing is saved until you hit Save.'}
          </p>
        </div>
        {actions}
      </div>

      {source && (
        <div className="rounded-xl border border-dash-gold/25 bg-dash-gold/[0.06] p-3 text-sm text-dash-secondary">
          <span className="font-semibold text-dash-gold">Carrying over:</span>{' '}
          {carryoverBits.join(', ')}. <span className="text-dash-tertiary">The photo is not copied.</span>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <CreateCard title="Basics">
            <div className="grid gap-3 md:grid-cols-[1.4fr_120px_1fr]">
              <Field label="Name">
                <TextInput
                  autoFocus
                  value={draft.name}
                  onChange={event => set({ name: event.target.value })}
                  placeholder={source ? `Duplicating: ${source.name} — type the new name` : 'New item name'}
                />
              </Field>
              <Field label="Price $">
                <TextInput
                  inputMode="decimal"
                  value={draft.price}
                  onChange={event => set({ price: cleanDecimal(event.target.value) })}
                  placeholder="12.00"
                />
              </Field>
              <Field label="Category">
                <SelectInput value={draft.category} onChange={event => set({ category: event.target.value })}>
                  <option value="">Other / no category</option>
                  {categoryNames.filter(name => name !== 'Other').map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                  {categoryNames.includes('Other') && <option value="Other">Other</option>}
                </SelectInput>
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Description">
                <TextAreaInput
                  value={draft.description}
                  placeholder="What guests see under the item name..."
                  onChange={event => set({ description: event.target.value })}
                />
              </Field>
            </div>
          </CreateCard>

          <CreateCard
            title={`Questions & modifiers${questionCount ? ` (${questionCount})` : ''}`}
            hint="What the POS asks when this item is ordered. Attach existing questions or quick-add modifiers here — answers, ★ defaults, and follow-ups are fine-tuned on the item screen after saving."
          >
            <div className="space-y-4">
              {sourceGroups.length > 0 && (
                <div>
                  <p className="label-mono mb-2">Copied from “{source.name}”</p>
                  <div className="flex flex-wrap gap-1.5">
                    {sourceGroups.map(group => (
                      <span
                        key={group.id}
                        title={`${groupRulesSummary(group)} — carries over with its per-item settings; adjust on the item screen after saving`}
                        className="rounded-full border border-dash-gold/30 bg-dash-gold/10 px-3 py-1.5 text-sm text-dash-gold"
                      >
                        {group.name}
                        <span className="ml-1.5 text-xs opacity-70">{group.options.length} option{group.options.length === 1 ? '' : 's'}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {inheritedGroups.length > 0 && (
                <div>
                  <p className="label-mono mb-2">Inherited from {draft.category || 'the category'} — asked automatically</p>
                  <div className="flex flex-wrap gap-1.5">
                    {inheritedGroups.map(group => (
                      <span
                        key={group.id}
                        title={`Every item in ${draft.category} asks this — including this one. Opt out on the item screen after saving.`}
                        className="rounded-full border border-sky-300/30 bg-sky-300/10 px-3 py-1.5 text-sm text-sky-200"
                      >
                        {group.name}
                        <span className="ml-1.5 text-xs opacity-70">{group.options.length} option{group.options.length === 1 ? '' : 's'}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedGroups.length > 0 && (
                <div>
                  <p className="label-mono mb-2">Added on this item</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedGroups.map(group => (
                      <button
                        key={group.id}
                        type="button"
                        title={`${groupRulesSummary(group)} — click to remove`}
                        onClick={() => removeQuestion(group.id)}
                        className="rounded-full border border-dash-gold/60 bg-dash-gold/15 px-3 py-1.5 text-sm font-medium text-dash-cream transition hover:border-red-400/60 hover:bg-red-400/10"
                      >
                        ✓ {group.name}
                        <span className="ml-1.5 text-xs text-dash-tertiary">{group.options.length} option{group.options.length === 1 ? '' : 's'} · ×</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {attachableGroups.length > 0 && (
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <p className="label-mono">Ask an existing question — click to add</p>
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
                        onClick={() => addQuestion(group.id)}
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

              <div className="border-t border-white/10 pt-4">
                {extrasModifiers.length > 0 && (
                  <div className="mb-3">
                    <p className="label-mono mb-2">Quick-added — will land in an “Extras” question on this item</p>
                    <div className="flex flex-wrap gap-1.5">
                      {extrasModifiers.map(modifier => (
                        <button
                          key={modifier.id}
                          type="button"
                          title="Click to remove"
                          onClick={() => removeExtra(modifier.id)}
                          className="rounded-full border border-dash-gold/60 bg-dash-gold/15 px-3 py-1.5 text-sm font-medium text-dash-cream transition hover:border-red-400/60 hover:bg-red-400/10"
                        >
                          ✓ {modifier.name}
                          {Number(modifier.price_delta) > 0 && <span className="ml-1 text-xs text-dash-tertiary">+{money(modifier.price_delta)}</span>}
                          <span className="ml-1.5 text-xs text-dash-tertiary">×</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {showModifierPicker ? (
                  <div className="space-y-2">
                    <ModifierPicker
                      autoFocus
                      modifiers={modifiers}
                      excludeIds={excludeModifierIds}
                      extraCategoryNames={groups.map(group => group.name)}
                      onAddExisting={ids => addExtras(ids)}
                      onCreateNew={modifierDraft => void quickCreateModifier(modifierDraft)}
                    />
                    <p className="text-xs text-dash-tertiary">New modifiers land in an "Extras" question on this item — or, if the category you type names an existing question, straight into that question.</p>
                    <SmallButton onClick={() => setShowModifierPicker(false)}>Done</SmallButton>
                  </div>
                ) : (
                  <SmallButton variant="primary" onClick={() => setShowModifierPicker(true)}>+ Quick add modifiers</SmallButton>
                )}
              </div>
            </div>
          </CreateCard>

          <CreateCard
            title="Kitchen"
            hint="The category chooses production automatically. Add an item override only when this item is an exception."
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.025] p-4">
              <div>
                <p className="label-mono">Automatic destination</p>
                <p className={`mt-1 text-base font-semibold ${routingIssue ? 'text-amber-200' : 'text-dash-cream'}`}>{resolvedRoute?.label || 'Resolving route...'}</p>
                <p className="mt-1 text-xs text-dash-tertiary">{resolvedRoute?.description || 'Choose a category to preview where this item will print.'}</p>
              </div>
              <SmallButton
                variant={routeOverrideOpen ? 'primary' : 'secondary'}
                onClick={() => {
                  if (routeOverrideOpen) set({ routing: ROUTE_INHERIT_VALUE })
                  setRouteOverrideOpen(value => !value)
                }}
              >
                {routeOverrideOpen ? 'Use automatic route' : 'Add item override'}
              </SmallButton>
            </div>
            {routeOverrideOpen && <div className="mb-4 max-w-md">
              <Field label="Item-specific destination">
                <SelectInput value={draft.routing} onChange={event => set({ routing: event.target.value })}>
                  <option value={ROUTE_INHERIT_VALUE}>Automatic · category or restaurant fallback</option>
                  <option value={ROUTE_NO_PRODUCTION_VALUE}>No production ticket</option>
                  {draft.routing === ROUTE_MULTI_VALUE && <option value={ROUTE_MULTI_VALUE}>Multiple stations (same as source)</option>}
                  {stations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}
                </SelectInput>
              </Field>
            </div>}
            {routingIssue && <p className="mb-4 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-amber-200">{routingIssue}</p>}
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Course">
                <SelectInput value={draft.course_type} onChange={event => set({ course_type: event.target.value })}>
                  {COURSE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </SelectInput>
              </Field>
              <Field label="Prep minutes">
                <TextInput
                  inputMode="numeric"
                  value={draft.prep_time_minutes}
                  onChange={event => set({ prep_time_minutes: cleanDigits(event.target.value) })}
                  placeholder="—"
                />
              </Field>
            </div>
          </CreateCard>
        </div>

        <div className="space-y-5">
          <CreateCard title="Availability schedule">
            <div className="space-y-3">
              <SelectInput value={draft.availability_mode} onChange={event => set({ availability_mode: event.target.value })}>
                {AVAILABILITY_MODES.map(mode => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
              </SelectInput>
              {draft.availability_mode === 'schedule' && (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS_SHORT.map((day, index) => (
                      <SmallButton
                        key={day}
                        variant={draft.availability_days.includes(index) ? 'primary' : 'secondary'}
                        onClick={() => set({
                          availability_days: draft.availability_days.includes(index)
                            ? draft.availability_days.filter(value => value !== index)
                            : [...draft.availability_days, index].sort(),
                        })}
                      >
                        {day}
                      </SmallButton>
                    ))}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="From"><SmartTimeInput ariaLabel="Item available from" value={draft.availability_start_time} onChange={value => set({ availability_start_time: value })} /></Field>
                    <Field label="Until"><SmartTimeInput ariaLabel="Item available until" value={draft.availability_end_time} onChange={value => set({ availability_end_time: value })} /></Field>
                  </div>
                </>
              )}
              {draft.availability_mode === 'seasonal' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Start date"><TextInput type="date" value={draft.availability_start_date} onChange={event => set({ availability_start_date: event.target.value })} /></Field>
                  <Field label="End date"><TextInput type="date" value={draft.availability_end_date} onChange={event => set({ availability_end_date: event.target.value })} /></Field>
                </div>
              )}
              <TextInput value={draft.availability_notes} onChange={event => set({ availability_notes: event.target.value })} placeholder="Notes (brunch only, seasonal...)" />
            </div>
          </CreateCard>

          {!source && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-dash-tertiary">
              Photo, ★ defaults, follow-up questions, specials, and the tax split are managed on the item screen after saving — or duplicate an existing item to carry all of that over.
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">{actions}</div>
    </div>
  )
}

export default MenuItemCreate
