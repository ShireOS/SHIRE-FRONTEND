import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { rankModifierMatches } from '@shire/menu-search'
import { supabase } from '../shared/lib/supabase'
import { queryClient, queryKeys, fetchCached, fetchWithSupabaseAuth, STALE_TIMES } from '../shared/query'
import {
  addGroupOption,
  applyAlphaOrderToGroup,
  attachGroupToCategory,
  attachGroupToItem,
  archiveModifierGroup,
  createModifierGroup,
  detachGroupFromCategory,
  fetchItemModifierOverrides,
  fetchModifierGroups,
  followUpParents,
  groupAnswerSortMode,
  itemOrderingBehavior,
  removeGroupOption,
  reorderCategoryGroups,
  reorderGroupOptions,
  replaceGroupItems,
  setItemGroupOverride,
  setGroupAnswerSortMode,
  setModifierKitchenDisplayRole,
  updateGroupOption,
  updateModifierGroup,
  wouldCreateCycle,
} from './data/menuGroups'
import { SortableRows, DragHandle } from './components/shared/SortableRows'
import { fetchCategoryColors, fetchItemImages, setCategoryColor } from './data/menuExtras'
import { fetchPosApi } from '../shared/api/posClient'
import { DEFAULT_API_TIMEOUT_MS } from '../shared/api/requestDeadline'
import { viewVisible } from '../shared/backOfficeView'
import {
  addAllergyPill,
  ensureAllergyGroup,
  fetchAllergyExclusions,
  fetchAllergyGroup,
  fetchAllergyPills,
  renameAllergyPill,
  setAllergyPillActive,
  setItemPillExcluded,
} from './data/menuAllergies'
import { MenuItemDetail } from './MenuItemDetail'
import { MenuItemCreate } from './MenuItemCreate'
import { MenuCombosPanel } from './MenuCombosPanel'
import { comboPayloadFromDraft } from './data/menuCombos.js'
import {
  ROUTE_INHERIT_VALUE,
  ROUTE_MULTI_VALUE,
  ROUTE_NO_PRODUCTION_VALUE,
  hasItemProductionOverride,
  resolveDraftProductionRoute,
} from './menuRouting'
import {
  bucketItemsByCategoryIdentity,
  categoryKeyForCategory,
  effectiveItemCategoryName,
  orphanCategoryBucketsFromIdentity,
} from './menuCategoryIdentity.js'
import { MenuEditor } from '../onboarding/components/MenuEditor'
import { useAuth } from '../auth'
import { PublishControls } from '../shared/components/PublishControls'
import { SmartDateTimeInput } from '../shared/components/SmartDateTimeInput'
import { SmartTimeInput } from '../shared/components/SmartTimeInput'
import { formatTimeLabel } from '../shared/utils/timeInput.js'
import { ScheduledChangesPanel } from '../shared/components/ScheduledChangesPanel'
import { PropagationModal } from '../shared/components/PropagationModal'
import { scheduleChange } from '../shared/api/scheduledChanges'
import { fetchResellerPortfolioForUser } from '../reseller/data/resellerPortfolio'
import { copyItemConfig } from './data/menuDuplicate'
import {
  directQuestionGroupsForItem,
  inheritedQuestionIdsToOptOut,
} from './data/menuDuplicateQuestions.js'
import {
  categoryQuestionGroups,
  nextCategoryQuestionOrder,
} from './data/menuCategoryQuestions.js'
import BulkPricingPanel from './BulkPricingPanel'
import {
  cleanMoneyDraft,
  moneyDraftMapToValues,
  moneyValuesToDraft,
  parseMoneyDraft,
} from './utils/moneyDraft.js'
import {
  archivePricingSpecial,
  createPricingSpecial,
  getPricingSpecials,
  updatePricingSpecial,
} from '../shared/api/menuPricing'
import {
  ColorSwatchPicker,
  DAYS_SHORT,
  Field,
  ItemChecklist,
  ItemThumb,
  MenuEmptyState,
  ModifierPicker,
  PosTilePreview,
  SaveStatus,
  SectionShell,
  SelectInput,
  SmallButton,
  TextInput,
  bucketModifiersByCategory,
  cleanDecimal,
  cleanDigits,
  dominantModifierCategory,
  groupRulesSummary,
  modifierCategoryOf,
  money,
} from './components/menuUi'

const MENU_TABS = [
  { id: 'items', label: 'Items' },
  { id: 'categories', label: 'Categories' },
  { id: 'combos', label: 'Combos' },
  { id: 'modifiers', label: 'Modifiers' },
  { id: 'groups', label: 'Questions' },
  { id: 'allergies', label: 'Allergies' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'specials', label: 'Item Availability' },
  { id: 'printing', label: 'Printing & Routing' },
]

const MENU_TAB_SOURCE_KEYS = {
  categories: ['category-colors', 'modifiers', 'groups', 'routing'],
  combos: ['combos'],
  modifiers: ['modifiers', 'groups'],
  groups: ['modifiers', 'groups'],
  allergies: ['allergies'],
  pricing: ['specials', 'special-settings'],
  specials: [],
  printing: ['category-colors', 'modifiers', 'routing', 'printing-config'],
}

const MENU_SOURCE_TIMEOUT_MS = 45_000

const loadMenuSource = (label, loader) => new Promise((resolve, reject) => {
  const timer = window.setTimeout(
    () => reject(new Error(`${label} timed out`)),
    MENU_SOURCE_TIMEOUT_MS,
  )
  Promise.resolve()
    .then(loader)
    .then(resolve, reject)
    .finally(() => window.clearTimeout(timer))
})

const routeCategoryKey = (value) => String(value || '').trim().toLowerCase()

const COURSE_OPTIONS = [
  { value: '', label: 'Course default' },
  { value: 'appetizer', label: 'Appetizer' },
  { value: 'entree', label: 'Entree' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'drink', label: 'Drink' },
  { value: 'side', label: 'Side' },
  { value: 'other', label: 'Other' },
  { value: 'none', label: 'None' },
]

// Location-level specials behavior, stored on restaurants.config.daily_specials
// (moved here from the old Setup → Specials tab).
const DEFAULT_DAILY_SPECIAL_SETTINGS = {
  enabled: true,
  show_specials_lane: true,
  show_in_source_categories: true,
  manager_quick_pin_enabled: true,
}

const SPECIAL_SETTING_LABELS = [
  ['enabled', 'Enable location specials'],
  ['show_specials_lane', 'Show Specials lane first'],
  ['show_in_source_categories', 'Also show in source categories'],
  ['manager_quick_pin_enabled', 'Allow manager quick pin'],
]

// API row → the onboarding MenuEditor's row shape, for the import/bulk table.
const editorItemFromApi = (item) => ({
  id: item.id,
  name: item.name || '',
  category: item.category || '',
  menu_category_id: item.menu_category_id || undefined,
  price: item.price != null ? String(item.price) : '',
  description: item.description || '',
  is_available: item.is_available !== false,
  availability_mode: item.availability_mode || 'always',
  availability_days: Array.isArray(item.availability_days) && item.availability_days.length > 0 ? item.availability_days : [0, 1, 2, 3, 4, 5, 6],
  availability_start_time: item.availability_start_time ? String(item.availability_start_time).slice(0, 5) : '',
  availability_end_time: item.availability_end_time ? String(item.availability_end_time).slice(0, 5) : '',
  availability_service_modes: item.availability_service_modes || [],
  availability_start_date: item.availability_start_date || '',
  availability_end_date: item.availability_end_date || '',
  availability_notes: item.availability_notes || '',
  fire_mode: item.fire_mode || '',
  kds_display_group: item.kds_display_group || '',
})

const defaultSpecialDraft = () => ({
  menu_item_id: '',
  display_name: '',
  note: '',
  special_price: '',
  suggested_tip_basis: 'after_discount',
  schedule_kind: 'manual',
  days_of_week: [1, 2, 3, 4, 5],
  start_time: '',
  end_time: '',
  start_date: '',
  end_date: '',
  cycle_anchor_date: '',
  cycle_length_days: '',
  cycle_day_number: '',
  expires_at: '',
  preserve_gratuity_basis: true,
})

const defaultGroupDraft = () => ({
  name: '',
  min_selections: '0',
  max_selections: '',
  is_required: false,
  prompt_on_order: true,
  included_count: '0',
  overage_price: '',
  prompt_mode: 'ask',
  pre_modifiers: [],
  pre_modifier_prices: {},
  kitchen_display_role: 'ingredient',
})

// Pull a human-readable reason out of whatever was thrown (Error, Supabase
// PostgrestError-shaped object, string, ...), so banners do not fall back to a
// generic message that hides the actual failure.
const describeError = (err) => {
  if (typeof err === 'string' && err.trim()) return err
  for (const candidate of [err?.message, err?.error_description, err?.details, err?.hint]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate
  }
  try {
    const encoded = JSON.stringify(err)
    if (encoded && encoded !== '{}') return encoded
  } catch { /* not serializable */ }
  return 'Something went wrong. Try again.'
}

const STANDARD_SIDE_BUTTONS = ['No', 'Extra', 'Light', 'On side']
const normalizedPromptMode = mode => (mode === 'skip_defaults' || mode === 'hidden' ? mode : 'ask')
const sideButtonMode = values => {
  const configured = Array.isArray(values) ? values : []
  if (configured.length === 0) return 'off'
  return configured.join('|') === STANDARD_SIDE_BUTTONS.join('|') ? 'standard' : 'custom'
}

// Read-only recursive preview of how a group prompts on the POS, following
// child_group_id edges. `seen` guards against cycles in existing data.
function GroupTree({ groupId, groupsById, modifiersById, depth = 0, seen }) {
  const group = groupsById[groupId]
  if (!group || depth > 8 || seen.has(groupId)) return null
  const nextSeen = new Set(seen)
  nextSeen.add(groupId)
  return (
    <div className={depth > 0 ? 'ml-4 mt-2 border-l border-dash-gold/25 pl-3' : ''}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-dash-cream">{group.name}</span>
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-dash-tertiary">{groupRulesSummary(group)}</span>
      </div>
      <div className="mt-1 space-y-1">
        {(group.options || []).map(option => {
          const modifier = modifiersById[option.modifier_id]
          return (
            <div key={option.modifier_id} className="text-sm text-dash-secondary">
              <span>
                {option.is_default ? '★ ' : ''}{modifier?.name || 'Modifier'}
                {Number(modifier?.price_delta) > 0 && <span className="text-dash-tertiary"> +{money(modifier.price_delta)}</span>}
                {option.child_group_id && <span className="text-dash-gold"> → then asks:</span>}
              </span>
              {option.child_group_id && (
                <GroupTree
                  groupId={option.child_group_id}
                  groupsById={groupsById}
                  modifiersById={modifiersById}
                  depth={depth + 1}
                  seen={nextSeen}
                />
              )}
            </div>
          )
        })}
        {(group.options || []).length === 0 && <p className="text-sm text-dash-tertiary">No options yet.</p>}
      </div>
    </div>
  )
}

// ── Modifier group editor card (Groups tab power view) ─────────────────────

const groupFieldsDraft = (group) => ({
  name: group.name,
  min_selections: String(group.min_selections ?? 0),
  max_selections: group.max_selections == null ? '' : String(group.max_selections),
  is_required: Boolean(group.is_required),
  prompt_on_order: group.prompt_on_order !== false,
  included_count: String(group.included_count ?? 0),
  overage_price: group.overage_price == null ? '' : String(group.overage_price),
  prompt_mode: normalizedPromptMode(group.prompt_mode),
  pre_modifiers: Array.isArray(group.pre_modifiers) ? group.pre_modifiers : [],
  pre_modifier_prices: moneyValuesToDraft(group.pre_modifier_prices),
  no_print: Boolean(group.no_print),
  kitchen_display_role: group.kitchen_display_role || (group.type === 'side' ? 'side' : ''),
})

function GroupCard({ group, groups, modifiers, menuItems, categories = [], busy, onSave, onArchive, onLink, onAddModifiers, onCreateModifier, onToggleCategory = null }) {
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState(() => groupFieldsDraft(group))
  useEffect(() => setDraft(groupFieldsDraft(group)), [group])
  const modifiersById = useMemo(() => Object.fromEntries(modifiers.map(m => [m.id, m])), [modifiers])
  const groupsById = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g])), [groups])
  const attachedIds = useMemo(() => new Set(group.item_ids), [group])
  const nestableGroups = groups.filter(candidate =>
    candidate.id !== group.id && !wouldCreateCycle(groups, group.id, candidate.id))
  // Everywhere this question is used: direct items, inheriting categories, and
  // modifiers whose selection triggers it as a follow-up.
  const inheritingCategories = (group.category_links || [])
    .map(link => categories.find(category => category.id === link.category_id))
    .filter(Boolean)
  const followUpHosts = useMemo(() => followUpParents(groups, group.id), [groups, group.id])
  const answerSortMode = groupAnswerSortMode(group)
  // A–Z sorts client-side too, so the list is right even before the
  // normalized display_order values land in the DB.
  const orderedOptions = useMemo(() => (
    answerSortMode === 'alpha'
      ? [...group.options].sort((a, b) => (modifiersById[a.modifier_id]?.name || '')
          .localeCompare(modifiersById[b.modifier_id]?.name || '', undefined, { sensitivity: 'base' }))
      : group.options
  ), [answerSortMode, group.options, modifiersById])

  const saveFields = () => {
    const minSelections = Math.max(draft.is_required ? 1 : 0, Number(draft.min_selections) || 0)
    const maxSelections = draft.max_selections === '' ? null : Math.max(minSelections, Number(draft.max_selections) || 0)
    onSave(group.id, {
      name: draft.name.trim() || group.name,
      min_selections: minSelections,
      max_selections: maxSelections,
      is_required: draft.is_required,
      prompt_on_order: draft.is_required ? true : draft.prompt_on_order,
      included_count: Number(draft.included_count) || 0,
      overage_price: parseMoneyDraft(draft.overage_price),
      prompt_mode: draft.prompt_mode,
      pre_modifiers: draft.pre_modifiers,
      pre_modifier_prices: moneyDraftMapToValues(draft.pre_modifier_prices, draft.pre_modifiers),
      no_print: draft.no_print,
      kitchen_display_role: draft.kitchen_display_role || null,
    })
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="text-left" onClick={() => setExpanded(current => !current)}>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-dash-cream">{group.name}</h4>
            {group.is_required && <span className="rounded-full bg-dash-gold/15 px-2 py-0.5 text-[11px] font-semibold text-dash-gold">Required</span>}
            {group.no_print && <span className="rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-dash-tertiary" title="Never prints on kitchen tickets">No print</span>}
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-dash-tertiary">
              {group.options.length} option{group.options.length === 1 ? '' : 's'} · {group.item_ids.length} item{group.item_ids.length === 1 ? '' : 's'}
              {inheritingCategories.length > 0 && ` · inherited by ${inheritingCategories.map(category => category.name).join(', ')}`}
            </span>
            {followUpHosts.length > 0 && (
              <span className="rounded-full border border-sky-300/25 bg-sky-300/10 px-2 py-0.5 text-[11px] font-semibold text-sky-200" title={followUpHosts.map(host => `${modifiersById[host.modifier_id]?.name || 'an option'} (in "${host.group.name}")`).join(', ')}>
                Follow-up of {followUpHosts.map(host => modifiersById[host.modifier_id]?.name).filter(Boolean).join(', ') || `${followUpHosts.length} option${followUpHosts.length === 1 ? '' : 's'}`}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-dash-tertiary">{groupRulesSummary(group)}</p>
        </button>
        <div className="flex gap-2">
          <SmallButton onClick={() => setExpanded(current => !current)}>{expanded ? 'Close' : 'Edit'}</SmallButton>
          <SmallButton
            variant="danger"
            onClick={() => {
              const confirmed = window.confirm(
                `Delete “${group.name}”?\n\nThis question will be removed from all menu items and will no longer appear on the POS. Past orders will not be changed.`,
              )
              if (confirmed) onArchive(group.id)
            }}
            disabled={busy}
          >
            Delete
          </SmallButton>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-5 border-t border-white/10 pt-4">
          <div className="space-y-3">
            <Field label="Question guests are asked">
              <TextInput value={draft.name} onChange={event => setDraft(prev => ({ ...prev, name: event.target.value }))} placeholder="Choose a side" />
            </Field>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-dash-secondary">
              <span>Guest picks at least</span>
              <TextInput inputMode="numeric" className="!w-16 !px-2 !py-1.5 text-center" value={draft.min_selections} onChange={event => setDraft(prev => ({ ...prev, min_selections: cleanDigits(event.target.value) }))} />
              <span>and at most</span>
              <TextInput inputMode="numeric" className="!w-16 !px-2 !py-1.5 text-center" placeholder="∞" value={draft.max_selections} onChange={event => setDraft(prev => ({ ...prev, max_selections: cleanDigits(event.target.value) }))} />
              <span className="text-dash-tertiary">·</span>
              <span>first</span>
              <TextInput inputMode="numeric" className="!w-16 !px-2 !py-1.5 text-center" value={draft.included_count} onChange={event => setDraft(prev => ({ ...prev, included_count: cleanDigits(event.target.value) }))} />
              <span>are free, then $</span>
              <TextInput inputMode="decimal" className="!w-20 !px-2 !py-1.5 text-center" placeholder="0.00" value={draft.overage_price} onChange={event => setDraft(prev => ({ ...prev, overage_price: cleanDecimal(event.target.value) }))} />
              <span>each extra</span>
              <SmallButton
                variant={draft.is_required ? 'primary' : 'secondary'}
                onClick={() => setDraft(prev => ({ ...prev, is_required: !prev.is_required }))}
              >
                {draft.is_required ? 'Required' : 'Optional'}
              </SmallButton>
              <SmallButton onClick={() => setDraft(groupFieldsDraft(group))} disabled={busy}>Cancel</SmallButton>
              <SmallButton variant="primary" onClick={saveFields} disabled={busy}>Save</SmallButton>
            </div>
            <div className="grid gap-3 rounded-xl border border-white/10 bg-black/10 p-3 md:grid-cols-2">
              <Field label="When this question appears">
                <SelectInput value={draft.prompt_mode} onChange={event => setDraft(prev => ({ ...prev, prompt_mode: event.target.value }))}>
                  <option value="ask">Ask every time</option>
                  <option value="skip_defaults">Apply defaults and skip</option>
                  <option value="hidden">Hidden (never ask)</option>
                </SelectInput>
              </Field>
              <Field label="Kitchen tickets">
                <SelectInput
                  title="Whether this question's selections print on kitchen tickets (receipts always show them)"
                  value={draft.no_print ? 'no' : 'yes'}
                  onChange={event => setDraft(prev => ({ ...prev, no_print: event.target.value === 'no' }))}
                >
                  <option value="yes">Print selections</option>
                  <option value="no">Never print (FOH-only)</option>
                </SelectInput>
              </Field>
              <Field label="Kitchen ticket hierarchy">
                <SelectInput
                  value={draft.kitchen_display_role}
                  onChange={event => setDraft(prev => ({ ...prev, kitchen_display_role: event.target.value }))}
                >
                  <option value="">Inherit / legacy</option>
                  <option value="ingredient">Ingredient (+ and indented)</option>
                  <option value="side">Side / non-ingredient (flush left)</option>
                </SelectInput>
              </Field>
              <Field label="Side buttons">
                <SelectInput
                  value={sideButtonMode(draft.pre_modifiers)}
                  onChange={event => setDraft(prev => ({
                    ...prev,
                    pre_modifiers: event.target.value === 'off' ? [] : (event.target.value === 'standard' ? STANDARD_SIDE_BUTTONS : (prev.pre_modifiers.length ? prev.pre_modifiers : STANDARD_SIDE_BUTTONS)),
                  }))}
                >
                  <option value="off">Off</option>
                  <option value="standard">Standard: No, Extra, Light, On side</option>
                  <option value="custom">Custom</option>
                </SelectInput>
              </Field>
              {sideButtonMode(draft.pre_modifiers) === 'custom' && (
                <Field label="Custom buttons (comma separated)">
                  <TextInput value={draft.pre_modifiers.join(', ')} onChange={event => setDraft(prev => ({ ...prev, pre_modifiers: event.target.value.split(',').map(value => value.trim()).filter(Boolean) }))} placeholder="No, Extra, Light, On side" />
                </Field>
              )}
              {draft.pre_modifiers.length > 0 && (
                <div>
                  <p className="label-mono mb-2">Default surcharge by button</p>
                  <div className="flex flex-wrap gap-2">
                    {draft.pre_modifiers.map(value => (
                      <label key={value} className="flex items-center gap-1 text-xs text-dash-secondary">
                        {value} $
                        <TextInput
                          className="!w-20 !px-2 !py-1.5"
                          inputMode="decimal"
                          value={draft.pre_modifier_prices[value] ?? ''}
                          onChange={event => setDraft(prev => ({
                            ...prev,
                            pre_modifier_prices: {
                              ...prev.pre_modifier_prices,
                              [value]: cleanMoneyDraft(event.target.value),
                            },
                          }))}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="label-mono !mb-0">Options in this group</p>
              {group.options.length > 1 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-dash-tertiary">Answer order:</span>
                  <SmallButton
                    variant={answerSortMode === 'alpha' ? 'primary' : 'secondary'}
                    title="Keep answers alphabetical — including ones added later"
                    disabled={busy}
                    onClick={() => onLink(() => setGroupAnswerSortMode(group.id, 'alpha'))}
                  >
                    A–Z
                  </SmallButton>
                  <SmallButton
                    variant={answerSortMode === 'custom' ? 'primary' : 'secondary'}
                    title="Arrange answers by hand — drag the ⠿ grip"
                    disabled={busy}
                    onClick={() => onLink(() => setGroupAnswerSortMode(group.id, 'custom'))}
                  >
                    Custom
                  </SmallButton>
                </div>
              )}
            </div>
            <SortableRows
              ids={orderedOptions.map(option => option.modifier_id)}
              className="space-y-2"
              disabled={busy}
              onReorder={orderedIds => onLink(async () => {
                // Dragging while A–Z is on switches to a custom order.
                if (answerSortMode === 'alpha') await updateModifierGroup(group.id, { modifier_sort_mode: 'custom' })
                await reorderGroupOptions(group.id, orderedIds)
              })}
              renderRow={(modifierId, { handleProps }) => {
                const option = orderedOptions.find(candidate => candidate.modifier_id === modifierId)
                if (!option) return null
                const modifier = modifiersById[option.modifier_id]
                return (
                  <div className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 lg:grid-cols-[auto_1.2fr_auto_1fr_1fr_1.3fr_1.1fr_auto] lg:items-center">
                    <DragHandle
                      handleProps={handleProps}
                      title={answerSortMode === 'alpha' ? 'Drag to switch to a custom order' : 'Drag to reorder this answer'}
                    />
                    <div className="text-sm">
                      <span className="font-medium text-dash-cream">{modifier?.name || 'Modifier'}</span>
                      {Number(modifier?.price_delta) > 0 && <span className="ml-2 text-dash-tertiary">+{money(modifier.price_delta)}</span>}
                    </div>
                    <SmallButton
                      variant={option.is_default ? 'primary' : 'secondary'}
                      title="Pre-selected by default"
                      onClick={() => onLink(() => updateGroupOption(group.id, option.modifier_id, { is_default: !option.is_default }))}
                    >
                      {option.is_default ? '★ Default' : 'Default'}
                    </SmallButton>
                    <TextInput
                      inputMode="decimal"
                      defaultValue={option.overage_price == null ? '' : String(option.overage_price)}
                      placeholder="Extra $ override"
                      onBlur={event => {
                        const next = parseMoneyDraft(event.target.value)
                        if (next !== option.overage_price) {
                          onLink(() => updateGroupOption(group.id, option.modifier_id, { overage_price: next }))
                        }
                      }}
                    />
                    <div className="flex gap-2">
                      <SelectInput
                        className="!min-w-28"
                        value={option.default_pre_modifier || ''}
                        title="Production instruction automatically applied with this default option"
                        onChange={event => onLink(() => updateGroupOption(group.id, option.modifier_id, { default_pre_modifier: event.target.value || null }))}
                      >
                        <option value="">No side default</option>
                        {draft.pre_modifiers.map(value => <option key={value} value={value}>{value}</option>)}
                      </SelectInput>
                      {option.default_pre_modifier && (
                        <TextInput
                          className="!w-20"
                          inputMode="decimal"
                          defaultValue={option.pre_modifier_price_overrides?.[option.default_pre_modifier] ?? ''}
                          placeholder="+$"
                          title="Override this side instruction's surcharge for this modifier"
                          onBlur={event => {
                            const prices = { ...(option.pre_modifier_price_overrides || {}) }
                            const amount = parseMoneyDraft(event.target.value)
                            if (amount === null) delete prices[option.default_pre_modifier]
                            else prices[option.default_pre_modifier] = amount
                            onLink(() => updateGroupOption(group.id, option.modifier_id, {
                              pre_modifier_price_overrides: prices,
                            }))
                          }}
                        />
                      )}
                    </div>
                    <SelectInput
                      value={option.child_group_id || ''}
                      onChange={event => onLink(() => updateGroupOption(group.id, option.modifier_id, { child_group_id: event.target.value || null }))}
                    >
                      <option value="">No follow-up question</option>
                      {nestableGroups.map(candidate => (
                        <option key={candidate.id} value={candidate.id}>Then ask: {candidate.name}</option>
                      ))}
                      {option.child_group_id && !nestableGroups.some(candidate => candidate.id === option.child_group_id) && (
                        <option value={option.child_group_id}>Then ask: {groupsById[option.child_group_id]?.name || 'Nested group'}</option>
                      )}
                    </SelectInput>
                    <SelectInput
                      value={option.kitchen_display_role || ''}
                      title="Override this option's kitchen ticket hierarchy"
                      onChange={event => onLink(() => updateGroupOption(group.id, option.modifier_id, { kitchen_display_role: event.target.value || null }))}
                    >
                      <option value="">Inherit from group</option>
                      <option value="ingredient">Ingredient</option>
                      <option value="side">Side / non-ingredient</option>
                    </SelectInput>
                    <SmallButton variant="danger" onClick={() => onLink(() => removeGroupOption(group.id, option.modifier_id))}>Remove</SmallButton>
                  </div>
                )
              }}
            />
            {group.options.length === 0 && <p className="text-sm text-dash-tertiary">Add modifiers below to give this question answers.</p>}
            <div className="mt-3">
              <ModifierPicker
                modifiers={modifiers}
                excludeIds={new Set(group.options.map(option => option.modifier_id))}
                busy={busy}
                defaultCategory={dominantModifierCategory(group.options, modifiersById, group.name)}
                extraCategoryNames={groups.map(candidate => candidate.name)}
                onAddExisting={ids => onAddModifiers(ids)}
                onCreateNew={draft => onCreateModifier(draft)}
              />
            </div>
          </div>

          {onToggleCategory && categories.filter(category => category.id).length > 0 && (
            <div>
              <p className="label-mono mb-2">Inherited by categories</p>
              <p className="mb-2 text-xs text-dash-tertiary">
                Every item in a selected category asks this question automatically — including items added later. Individual items can opt out from their own editor.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {categories.filter(category => category.id).map(category => {
                  const inherited = (group.category_links || []).some(link => link.category_id === category.id)
                  return (
                    <button
                      key={category.id}
                      type="button"
                      disabled={busy}
                      onClick={() => onToggleCategory(group, category, !inherited)}
                      className={[
                        'rounded-full border px-3 py-1.5 text-sm transition disabled:opacity-50',
                        inherited
                          ? 'border-dash-gold/60 bg-dash-gold/15 text-dash-cream'
                          : 'border-white/10 bg-white/[0.03] text-dash-secondary hover:border-dash-gold/60 hover:text-dash-cream',
                      ].join(' ')}
                    >
                      {inherited ? '✓' : '+'} {category.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {followUpHosts.length > 0 && (
            <div>
              <p className="label-mono mb-2">Asked as a follow-up</p>
              <div className="space-y-1.5">
                {followUpHosts.map(host => (
                  <div key={`${host.group.id}:${host.modifier_id}`} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-2.5 text-sm">
                    <span className="text-dash-secondary">
                      After <span className="font-medium text-dash-cream">{modifiersById[host.modifier_id]?.name || 'an option'}</span> is picked in <span className="font-medium text-dash-cream">“{host.group.name}”</span>
                    </span>
                    <span className="flex-1" />
                    <SmallButton
                      variant="danger"
                      title="Stop asking this after that option (the question itself is kept)"
                      onClick={() => onLink(() => updateGroupOption(host.group.id, host.modifier_id, { child_group_id: null }))}
                    >
                      Detach
                    </SmallButton>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="label-mono mb-2">Applies to items directly</p>
              <p className="mb-2 text-xs text-dash-tertiary">Items covered by an inheriting category aren’t listed as checked here — inheritance already reaches them.</p>
              <ItemChecklist
                menuItems={menuItems}
                selectedIds={attachedIds}
                onToggle={itemId => {
                  const next = attachedIds.has(itemId)
                    ? group.item_ids.filter(id => id !== itemId)
                    : [...group.item_ids, itemId]
                  onLink(() => replaceGroupItems(group.id, next))
                }}
                onBulk={(itemIds, shouldSelect) => {
                  const next = new Set(group.item_ids)
                  for (const itemId of itemIds) {
                    if (shouldSelect) next.add(itemId)
                    else next.delete(itemId)
                  }
                  onLink(() => replaceGroupItems(group.id, Array.from(next)))
                }}
              />
            </div>
            <div>
              <p className="label-mono mb-2">Guest flow preview</p>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <GroupTree groupId={group.id} groupsById={groupsById} modifiersById={modifiersById} seen={new Set()} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main panel ──────────────────────────────────────────────────────────────

export function MenuPanel({ restaurantId, initialTab = 'items', onlyTab = null, canEditPrices = false, viewPolicy = null }) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const visibleMenuTabs = useMemo(() => MENU_TABS.filter((tab) => {
    const capability = {
      items: 'menu.items', categories: 'menu.categories', combos: 'menu.combos',
      modifiers: 'menu.modifiers', groups: 'menu.modifiers', allergies: 'menu.allergies',
      pricing: 'menu.pricing', specials: 'menu.availability', printing: 'menu.routing',
    }[tab.id]
    return !viewPolicy || !capability || viewVisible(viewPolicy, capability)
  }), [viewPolicy])

  useEffect(() => {
    if (!visibleMenuTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(visibleMenuTabs[0]?.id || 'items')
    }
  }, [activeTab, visibleMenuTabs])
  const [menuItems, setMenuItems] = useState([])
  const [itemImages, setItemImages] = useState({})
  const [categories, setCategories] = useState([])
  const [savedCategories, setSavedCategories] = useState([])
  const [categoryColors, setCategoryColors] = useState({})
  const [taxRates, setTaxRates] = useState([])
  const [combos, setCombos] = useState([])
  const [comboManagerPasscode, setComboManagerPasscode] = useState('')
  const [modifiers, setModifiers] = useState([])
  const [groups, setGroups] = useState([])
  const [itemModifierOverrides, setItemModifierOverrides] = useState({})
  const [specials, setSpecials] = useState([])
  const [specialsError, setSpecialsError] = useState('')
  const [routing, setRouting] = useState(null)
  const [printingConfig, setPrintingConfig] = useState({ aliases: { items: {}, modifiers: {} } })
  const [loading, setLoading] = useState(true)
  const [sourceStates, setSourceStates] = useState({})
  const sourceRequestsRef = useRef(new Map())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saveStatuses, setSaveStatuses] = useState({})
  const saveStatusTimersRef = useRef({})
  const [selectedItemId, setSelectedItemId] = useState(null)

  const [itemSearch, setItemSearch] = useState('')
  const [modifierSearch, setModifierSearch] = useState('')
  const [itemCategoryFilter, setItemCategoryFilter] = useState('all')
  const [itemAvailabilityFilter, setItemAvailabilityFilter] = useState('all')
  // null | { source: item-to-duplicate | null, draft: prefilled draft | null }
  const [creating, setCreating] = useState(null)
  // null | 'upload' (AI photo extraction) | 'manual' (bulk table editing)
  const [importing, setImporting] = useState(null)
  const [dailySpecialSettings, setDailySpecialSettings] = useState(null)
  // Multi-store propagation (reseller accounts): portfolio + pending modal request.
  const auth = useAuth()
  const [portfolio, setPortfolio] = useState(null)
  const [propagationRequest, setPropagationRequest] = useState(null)
  // Item-editor layout prefs (card order + collapse), per user via
  // reports/view-preferences context "menu_item_editor".
  const [editorPrefs, setEditorPrefs] = useState(null)
  const editorPrefsRef = useRef(null)
  const editorPrefsTimerRef = useRef(null)
  const editorPrefsPendingRef = useRef(null)
  const editorPrefsRestaurantRef = useRef(restaurantId)
  const categoryDraftKeyRef = useRef(0)
  editorPrefsRestaurantRef.current = restaurantId
  const [expandedCategoryNames, setExpandedCategoryNames] = useState(() => new Set())
  const [editingCategoryKey, setEditingCategoryKey] = useState(null)
  const [categoryScrollTarget, setCategoryScrollTarget] = useState(null)

  const [allergyGroup, setAllergyGroup] = useState(null)
  const [allergyPills, setAllergyPills] = useState([])
  const [allergyExclusions, setAllergyExclusions] = useState([])
  const [pillDraft, setPillDraft] = useState('')

  const [modifierDraft, setModifierDraft] = useState({ name: '', price_delta: '', category: '', tax_rate_id: '', reporting_category_id: '', group_id: '', new_question_name: '', print_on_kitchen_ticket: true, kitchen_display_role: '', item_ids: new Set() })
  const [showModifierDrawer, setShowModifierDrawer] = useState(false)
  const [groupDraft, setGroupDraft] = useState(() => defaultGroupDraft())
  const [specialDraft, setSpecialDraft] = useState(() => defaultSpecialDraft())
  const [scheduleItemId, setScheduleItemId] = useState('')
  const [routingItemSearch, setRoutingItemSearch] = useState('')
  const [showAllRoutingItems, setShowAllRoutingItems] = useState(true)

  const api = (path, init = {}) => fetchWithSupabaseAuth(path, {
    timeoutMs: DEFAULT_API_TIMEOUT_MS,
    ...init,
  })
  const routingApi = (path, init) => fetchPosApi(restaurantId, path, init)

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 3000)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => () => {
    Object.values(saveStatusTimersRef.current).forEach(clearTimeout)
  }, [])

  const markSaved = (key, message = 'Saved') => {
    if (!key) return
    clearTimeout(saveStatusTimersRef.current[key])
    setSaveStatuses(current => ({ ...current, [key]: message }))
    saveStatusTimersRef.current[key] = setTimeout(() => {
      setSaveStatuses(current => {
        if (!current[key]) return current
        const next = { ...current }
        delete next[key]
        return next
      })
      delete saveStatusTimersRef.current[key]
    }, 2400)
  }

  const localSave = (key, message = 'Saved') => ({ localKey: key, message })
  const saved = key => saveStatuses[key] || ''

  const loadItems = async (force = false) => {
    const rows = await fetchCached(
      queryKeys.menuItems(restaurantId),
      () => api(`/restaurants/${restaurantId}/menu/items`),
      force ? 0 : STALE_TIMES.setup,
    )
    setMenuItems(Array.isArray(rows) ? rows : [])
  }

  // image_url is portal-managed and absent from the ML API response; merged in
  // separately. Fails soft until the images/colors migration is applied.
  const loadImages = async (force = true) => {
    try {
      const images = await fetchCached(
        queryKeys.menuItemImages(restaurantId),
        () => fetchItemImages(restaurantId),
        force ? 0 : STALE_TIMES.setup,
      )
      setItemImages(images)
    } catch {
      setItemImages({})
    }
  }

  const loadCategories = async (force = false) => {
    const data = await fetchCached(
      queryKeys.menuCategories(restaurantId),
      () => api(`/restaurants/${restaurantId}/menu/categories`),
      force ? 0 : STALE_TIMES.setup,
    )
    const next = Array.isArray(data) ? data : (data?.categories || [])
    setCategories(next)
    setSavedCategories(next)
    setTaxRates(Array.isArray(data?.tax_rates) ? data.tax_rates : [])
  }

  const loadCategoryColors = async (force = true) => {
    try {
      const colors = await fetchCached(
        queryKeys.menuCategoryColors(restaurantId),
        () => fetchCategoryColors(restaurantId),
        force ? 0 : STALE_TIMES.setup,
      )
      setCategoryColors(colors)
    } catch {
      setCategoryColors({})
    }
  }

  const loadModifiers = async (force = true) => {
    const next = await fetchCached(
      queryKeys.menuModifiers(restaurantId),
      async () => {
        const rows = await api(`/restaurants/${restaurantId}/menu/modifiers`)
        const list = Array.isArray(rows) ? rows : []
        const { data: roleRows, error: roleError } = await supabase
          .from('menu_modifiers')
          .select('id, kitchen_display_role')
          .eq('restaurant_id', restaurantId)
          .is('archived_at', null)
        if (roleError && roleError.code !== '42703') throw roleError
        const roleById = Object.fromEntries((roleRows || []).map(row => [row.id, row.kitchen_display_role || null]))
        return list.map(row => ({ ...row, kitchen_display_role: roleById[row.id] ?? row.kitchen_display_role ?? null }))
      },
      force ? 0 : STALE_TIMES.setup,
    )
    setModifiers(next)
  }

  const loadGroups = async (force = true) => {
    const next = await fetchCached(
      queryKeys.menuModifierGroups(restaurantId),
      () => fetchModifierGroups(restaurantId),
      force ? 0 : STALE_TIMES.setup,
    )
    setGroups(next)
  }

  const loadCombos = async (force = true) => {
    const data = await fetchCached(
      queryKeys.menuCombos(restaurantId),
      () => fetchPosApi(restaurantId, '/manager/combos'),
      force ? 0 : STALE_TIMES.setup,
    )
    setCombos(Array.isArray(data?.combos) ? data.combos : [])
  }

  // { [itemId]: { [modifierId]: { price_delta, no_print } } } — per-item price
  // and kitchen-print overrides for modifiers. Fails soft pre-migration.
  const loadItemModifierOverrides = async (force = true) => {
    try {
      const overrides = await fetchCached(
        queryKeys.menuModifierOverrides(restaurantId),
        () => fetchItemModifierOverrides(restaurantId),
        force ? 0 : STALE_TIMES.setup,
      )
      setItemModifierOverrides(overrides)
    } catch {
      setItemModifierOverrides({})
    }
  }

  const loadAllergies = async (force = true) => {
    const data = await fetchCached(
      queryKeys.menuAllergies(restaurantId),
      async () => {
        const group = await fetchAllergyGroup(restaurantId)
        const pills = group ? await fetchAllergyPills(group.id) : []
        let exclusions = []
        try {
          exclusions = await fetchAllergyExclusions(restaurantId)
        } catch {
          exclusions = [] // exclusions table not migrated yet — fail soft
        }
        return { group, pills, exclusions }
      },
      force ? 0 : STALE_TIMES.setup,
    )
    setAllergyGroup(data.group)
    setAllergyPills(data.pills)
    setAllergyExclusions(data.exclusions)
  }

  const loadSpecials = async ({ soft = false, force = true } = {}) => {
    try {
      const nextSpecials = await fetchCached(
        queryKeys.menuSpecials(restaurantId),
        () => getPricingSpecials(restaurantId, { timeoutMs: DEFAULT_API_TIMEOUT_MS }),
        force ? 0 : STALE_TIMES.setup,
      )
      setSpecials(nextSpecials)
      setSpecialsError('')
      return nextSpecials
    } catch (err) {
      setSpecials([])
      setSpecialsError(describeError(err))
      if (!soft) throw err
      return []
    }
  }

  const loadRouting = async (force = false) => {
    const data = await fetchCached(
      queryKeys.kitchenRouting(restaurantId),
      () => routingApi(`/restaurants/${restaurantId}/kitchen-routing`),
      force ? 0 : STALE_TIMES.setup,
    )
    setRouting(data)
  }

  const propagationEligible = ['reseller', 'reseller_employee', 'admin'].includes(auth?.accountType || '')

  useEffect(() => {
    if (!propagationEligible || !auth?.user?.id) return
    let cancelled = false
    fetchResellerPortfolioForUser({
      userId: auth.user.id,
      accountType: auth.accountType,
      restaurants: auth.restaurant?.restaurants || [],
    })
      .then(data => {
        if (!cancelled) setPortfolio(data)
      })
      .catch(() => {
        if (!cancelled) setPortfolio(null) // propagation UI simply stays hidden
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propagationEligible, auth?.user?.id, auth?.accountType])

  // Resellers/admins always; reseller employees need the propagate permission.
  const propagationReady = Boolean(
    portfolio &&
    (['reseller', 'admin'].includes(auth?.accountType) || portfolio.employee?.permissions?.propagate_changes),
  )

  const requestPropagationTargets = (descriptor) => new Promise(resolve => {
    setPropagationRequest({ descriptor, resolve })
  })

  const closePropagationModal = (restaurantIds = null) => {
    setPropagationRequest(current => {
      current?.resolve(restaurantIds)
      return null
    })
  }

  const loadEditorPrefs = async (force = false) => {
    const targetRestaurantId = restaurantId
    // Layout prefs are cosmetic — swallow failures so they never block the menu.
    try {
      const data = await fetchCached(
        queryKeys.menuEditorPreferences(targetRestaurantId),
        () => api(`/restaurants/${targetRestaurantId}/reports/view-preferences`),
        force ? 0 : STALE_TIMES.setup,
      )
      if (editorPrefsRestaurantRef.current !== targetRestaurantId) return
      const saved = data?.settings?.menu_item_editor
      const next = saved && typeof saved === 'object' ? saved : {}
      editorPrefsRef.current = next
      setEditorPrefs(next)
    } catch {
      if (editorPrefsRestaurantRef.current !== targetRestaurantId) return
      editorPrefsRef.current = {}
      setEditorPrefs({})
    }
  }

  const persistEditorPrefs = ({ restaurantId: targetRestaurantId, settings }) => {
    void fetchWithSupabaseAuth(`/restaurants/${targetRestaurantId}/reports/view-preferences/menu_item_editor`, {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    }).catch(() => {})
  }

  const flushEditorPrefs = () => {
    if (editorPrefsTimerRef.current) {
      clearTimeout(editorPrefsTimerRef.current)
      editorPrefsTimerRef.current = null
    }
    const pending = editorPrefsPendingRef.current
    editorPrefsPendingRef.current = null
    if (pending) persistEditorPrefs(pending)
  }

  // Optimistic local merge; the PUT is debounced so drag/collapse bursts
  // coalesce into one write.
  const saveEditorPrefs = (patch) => {
    const next = { ...(editorPrefsRef.current || {}), ...patch }
    editorPrefsRef.current = next
    setEditorPrefs(next)
    queryClient.setQueryData(queryKeys.menuEditorPreferences(restaurantId), current => ({
      ...(current && typeof current === 'object' ? current : {}),
      settings: {
        ...(current?.settings && typeof current.settings === 'object' ? current.settings : {}),
        menu_item_editor: next,
      },
    }))
    if (editorPrefsTimerRef.current) clearTimeout(editorPrefsTimerRef.current)
    editorPrefsPendingRef.current = { restaurantId, settings: next }
    editorPrefsTimerRef.current = setTimeout(() => {
      editorPrefsTimerRef.current = null
      const pending = editorPrefsPendingRef.current
      editorPrefsPendingRef.current = null
      if (pending) persistEditorPrefs(pending)
    }, 450)
  }

  useEffect(() => () => {
    // Switching stores and unmounting both flush the captured store+settings
    // pair. Never combine a new store's ref with an old store's URL.
    flushEditorPrefs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId])

  const loadSpecialSettings = async (force = false) => {
    const next = await fetchCached(
      queryKeys.menuSpecialSettings(restaurantId),
      async () => {
        const { data, error } = await supabase.from('restaurants').select('config').eq('id', restaurantId).single()
        if (error) throw error
        const raw = data?.config?.daily_specials
        return { ...DEFAULT_DAILY_SPECIAL_SETTINGS, ...(raw && typeof raw === 'object' ? raw : {}) }
      },
      force ? 0 : STALE_TIMES.setup,
    )
    setDailySpecialSettings(next)
  }

  // Read-merge-write on restaurants.config so unrelated config keys survive.
  const saveSpecialSettings = (patch) => run(async () => {
    const { data, error } = await supabase.from('restaurants').select('config').eq('id', restaurantId).single()
    if (error) throw error
    const config = data?.config && typeof data.config === 'object' ? data.config : {}
    const current = config.daily_specials && typeof config.daily_specials === 'object' ? config.daily_specials : {}
    const next = { ...DEFAULT_DAILY_SPECIAL_SETTINGS, ...current, ...patch }
    const update = await supabase
      .from('restaurants')
      .update({ config: { ...config, daily_specials: next } })
      .eq('id', restaurantId)
    if (update.error) throw update.error
    setDailySpecialSettings(next)
    queryClient.setQueryData(queryKeys.menuSpecialSettings(restaurantId), next)
  }, 'Specials settings saved.', 'Couldn’t save specials settings')

  const loadPrintingConfig = async (force = false) => {
    try {
      const data = await fetchCached(
        queryKeys.menuPrintingConfig(restaurantId),
        () => fetchPosApi(restaurantId, `/restaurants/${restaurantId}/printing-config`),
        force ? 0 : STALE_TIMES.setup,
      )
      setPrintingConfig(data || { aliases: { items: {}, modifiers: {} } })
    } catch {
      // printing-config ships with the POS receipt-config backend build and
      // may be unavailable independently — kitchen aliases fall back to defaults
      // without blocking the rest of the menu workspace.
      setPrintingConfig({ aliases: { items: {}, modifiers: {} } })
    }
  }

  const ensureSource = (key, label, loader) => {
    const current = sourceRequestsRef.current.get(key)
    if (current?.status === 'loaded') return Promise.resolve()
    if (current?.status === 'loading') return current.promise

    const promise = loadMenuSource(label, loader)
      .then((value) => {
        sourceRequestsRef.current.set(key, { status: 'loaded', promise: null })
        setSourceStates(states => ({ ...states, [key]: 'loaded' }))
        return value
      })
      .catch((sourceError) => {
        sourceRequestsRef.current.set(key, { status: 'error', promise: null })
        setSourceStates(states => ({ ...states, [key]: 'error' }))
        throw sourceError
      })

    sourceRequestsRef.current.set(key, { status: 'loading', promise })
    setSourceStates(states => ({ ...states, [key]: 'loading' }))
    return promise
  }

  useEffect(() => {
    if (!restaurantId) return
    let cancelled = false
    sourceRequestsRef.current.clear()
    setSourceStates({})
    setLoading(true)
    setError('')
    setMenuItems([])
    setItemImages({})
    setCategories([])
    setSavedCategories([])
    setCategoryColors({})
    setTaxRates([])
    setCombos([])
    setModifiers([])
    setGroups([])
    setItemModifierOverrides({})
    setSpecials([])
    setDailySpecialSettings(null)
    setRouting(null)
    setPrintingConfig({ aliases: { items: {}, modifiers: {} } })
    setAllergyGroup(null)
    setAllergyPills([])
    setAllergyExclusions([])
    setSelectedItemId(null)
    setEditingCategoryKey(null)
    setExpandedCategoryNames(new Set())
    setComboManagerPasscode('')
    const loaders = [
      ['items', 'items', () => loadItems(false)],
      ['categories', 'categories', () => loadCategories(false)],
    ]
    Promise.allSettled(loaders.map(([key, label, load]) => ensureSource(key, label, load))).then(results => {
      if (cancelled) return
      const failures = results.flatMap((result, index) => (
        result.status === 'rejected'
          ? [`${loaders[index][1]}: ${describeError(result.reason)}`]
          : []
      ))
      if (failures.length > 0) {
        setError(`The menu could not fully load: ${failures.join('; ')}.`)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId])

  useEffect(() => {
    if (!restaurantId || loading) return
    const loadersByTab = {
      items: [
        ['images', 'item images', () => loadImages(false)],
        ['category-colors', 'category colors', () => loadCategoryColors(false)],
        ['modifiers', 'modifiers', () => loadModifiers(false)],
        ['groups', 'questions', () => loadGroups(false)],
        ['modifier-overrides', 'modifier overrides', () => loadItemModifierOverrides(false)],
        ['specials', 'specials', () => loadSpecials({ soft: true, force: false })],
        ['editor-layout', 'editor layout', () => loadEditorPrefs(false)],
        ['printing-config', 'printing config', () => loadPrintingConfig(false)],
      ],
      categories: [
        ['category-colors', 'category colors', () => loadCategoryColors(false)],
        ['modifiers', 'modifiers', () => loadModifiers(false)],
        ['groups', 'questions', () => loadGroups(false)],
        ['routing', 'kitchen routing', () => loadRouting(false)],
      ],
      combos: [['combos', 'combos', () => loadCombos(false)]],
      modifiers: [
        ['modifiers', 'modifiers', () => loadModifiers(false)],
        ['groups', 'questions', () => loadGroups(false)],
      ],
      groups: [
        ['modifiers', 'modifiers', () => loadModifiers(false)],
        ['groups', 'questions', () => loadGroups(false)],
      ],
      allergies: [['allergies', 'allergies', () => loadAllergies(false)]],
      pricing: [
        ['specials', 'specials', () => loadSpecials({ soft: true, force: false })],
        ['special-settings', 'specials settings', () => loadSpecialSettings(false)],
      ],
      specials: [],
      printing: [
        ['category-colors', 'category colors', () => loadCategoryColors(false)],
        ['modifiers', 'modifiers', () => loadModifiers(false)],
        ['routing', 'kitchen routing', () => loadRouting(false)],
        ['printing-config', 'printing config', () => loadPrintingConfig(false)],
      ],
    }
    const loaders = loadersByTab[activeTab] || []
    Promise.allSettled(loaders.map(([key, label, load]) => ensureSource(key, label, load))).then(results => {
      const failures = results.flatMap((result, index) => (
        result.status === 'rejected'
          ? [`${loaders[index][1]}: ${describeError(result.reason)}`]
          : []
      ))
      if (failures.length > 0) setError(`Some ${activeTab} data failed to load: ${failures.join('; ')}.`)
    })
    // The loader functions intentionally use the restaurant captured by this
    // render; sourceRequestsRef deduplicates overlapping tab requirements.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, loading, restaurantId])

  useEffect(() => {
    if (loading || activeTab !== 'items' || (!selectedItemId && !creating)) return
    const loaders = [
      ['routing', 'kitchen routing', () => loadRouting(false)],
      ['allergies', 'allergies', () => loadAllergies(false)],
    ]
    void Promise.allSettled(loaders.map(([key, label, load]) => ensureSource(key, label, load)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, creating, loading, restaurantId, selectedItemId])

  const invalidateItems = () => queryClient.invalidateQueries({ queryKey: queryKeys.menuItems(restaurantId) })
  const invalidateCategories = () => queryClient.invalidateQueries({ queryKey: queryKeys.menuCategories(restaurantId) })

  const run = async (work, successMessage, failLabel) => {
    const success = typeof successMessage === 'object' && successMessage !== null ? successMessage : null
    setBusy(true)
    setError('')
    if (!success?.localKey) setNotice('')
    try {
      await work()
      if (success?.localKey) markSaved(success.localKey, success.message)
      else if (success?.globalMessage) setNotice(success.globalMessage)
      else if (successMessage) setNotice(successMessage)
      return true
    } catch (err) {
      const reason = describeError(err)
      setError(failLabel ? `${failLabel} — ${reason}` : reason)
      return false
    } finally {
      setBusy(false)
    }
  }

  const stations = routing?.stations || []
  const stationsById = useMemo(() => Object.fromEntries(stations.map(station => [station.id, station])), [stations])
  const activeOutputTargetsById = useMemo(
    () => Object.fromEntries((routing?.targets || [])
      .filter(target => target?.is_active !== false && !target?.archived_at && ['kitchen', 'both'].includes(target?.usage || 'kitchen'))
      .map(target => [target.id, target])),
    [routing],
  )
  const routableStationIds = useMemo(
    () => new Set((routing?.station_targets || [])
      .filter(assignment => assignment?.is_active !== false && !assignment?.archived_at && activeOutputTargetsById[assignment.target_id])
      .map(assignment => assignment.station_id)),
    [routing, activeOutputTargetsById],
  )
  const routableStations = useMemo(
    () => stations.filter(station => routableStationIds.has(station.id)),
    [stations, routableStationIds],
  )
  const activeRoutingRules = useMemo(
    () => (routing?.routing_rules || []).filter(rule => rule?.is_active !== false && !rule?.archived_at),
    [routing],
  )
  const activeRoutingExclusions = useMemo(
    () => (routing?.routing_exclusions || []).filter(rule => rule?.is_active !== false && !rule?.archived_at),
    [routing],
  )

  const mergedItems = useMemo(
    () => menuItems.map(item => ({ ...item, image_url: itemImages[item.id] ?? null })),
    [menuItems, itemImages],
  )
  const mergedCategories = useMemo(
    () => categories.map(category => ({ ...category, color: categoryColors[category.id] ?? category.color ?? null })),
    [categories, categoryColors],
  )
  const categoriesById = useMemo(
    () => Object.fromEntries(mergedCategories.filter(category => category.id).map(category => [String(category.id), category])),
    [mergedCategories],
  )
  const categoryNames = useMemo(() => {
    const names = new Set(mergedCategories.map(category => category.name).filter(Boolean))
    for (const item of menuItems) names.add(effectiveItemCategoryName(item, categoriesById))
    return Array.from(names).sort()
  }, [mergedCategories, menuItems, categoriesById])
  const categoriesByName = useMemo(
    () => Object.fromEntries(mergedCategories.filter(category => category.name).map(category => [category.name, category])),
    [mergedCategories],
  )
  const activeSpecials = useMemo(
    () => specials.filter(special => {
      if (!special.is_active) return false
      if (special.expires_at && new Date(special.expires_at).getTime() <= Date.now()) return false
      return true
    }),
    [specials],
  )
  const activeSpecialItemIds = useMemo(
    () => new Set(activeSpecials.map(special => special.menu_item_id)),
    [activeSpecials],
  )
  const stationLabel = (stationId) => stationsById[stationId]?.name || 'Station'
  const routeRuleLabel = (rule) => rule.station_name || stationLabel(rule.station_id)
  const categoryRouteRules = (categoryName) => activeRoutingRules.filter(rule => rule.source_type === 'category' && routeCategoryKey(rule.category) === routeCategoryKey(categoryName))
  const categoryNoRouteRules = (categoryName) => activeRoutingExclusions.filter(rule => rule.source_type === 'category' && routeCategoryKey(rule.category) === routeCategoryKey(categoryName))
  const itemRouteRules = (item) => activeRoutingRules.filter(rule => rule.source_type === 'menu_item' && String(rule.source_id || '') === String(item.id || item.menu_item_id || ''))
  const itemNoRouteRules = (item) => activeRoutingExclusions.filter(rule => rule.source_type === 'menu_item' && String(rule.source_id || '') === String(item.id || item.menu_item_id || ''))
  const routingValueFor = (rules, exclusions) => {
    if (exclusions.length > 0) return ROUTE_NO_PRODUCTION_VALUE
    if (rules.length > 1) return ROUTE_MULTI_VALUE
    if (rules.length === 1) return rules[0].station_id || ''
    return ROUTE_INHERIT_VALUE
  }
  const routingDescriptionFor = (rules, exclusions, emptyLabel) => {
    if (exclusions.length > 0) return 'No kitchen ticket'
    if (rules.length > 1) return `Routes to ${rules.map(routeRuleLabel).join(' + ')}`
    if (rules.length === 1) return `Routes to ${routeRuleLabel(rules[0])}`
    return emptyLabel
  }
  const categoryProductionRouting = (categoryName) => {
    const rules = categoryRouteRules(categoryName)
    const exclusions = categoryNoRouteRules(categoryName)
    return {
      rules,
      exclusions,
      value: routingValueFor(rules, exclusions),
      description: routingDescriptionFor(
        rules,
        exclusions,
        routing?.fallback?.ok
          ? `Uses restaurant fallback · ${routing.fallback.station?.name || 'station'}`
          : 'No category route or working restaurant fallback',
      ),
    }
  }
  const itemProductionRouting = (item) => {
    const rules = itemRouteRules(item)
    const exclusions = itemNoRouteRules(item)
    const categoryRouting = categoryProductionRouting(effectiveItemCategoryName(item, categoriesById))
    const inherited = categoryRouting.value === ROUTE_NO_PRODUCTION_VALUE
      ? 'Automatic · no kitchen ticket from category'
      : categoryRouting.rules.length > 0
        ? `Inherits ${categoryRouting.description.replace(/^Routes to /, '')}`
        : routing?.fallback?.ok
          ? `Automatic · ${routing.fallback.station?.name || 'station'} via restaurant fallback`
          : 'No working automatic route'
    return {
      rules,
      exclusions,
      categoryRouting,
      value: routingValueFor(rules, exclusions),
      description: routingDescriptionFor(rules, exclusions, inherited),
    }
  }

  const resolveRoutingForDraft = (draft, sourceItem = null) => {
    const categoryRouting = categoryProductionRouting(draft.category || 'Other')
    return resolveDraftProductionRoute({
      routing: draft.routing,
      category: draft.category || 'Other',
      categoryRules: categoryRouting.rules,
      categoryExcluded: categoryRouting.exclusions.length > 0,
      sourceItemRules: sourceItem ? itemRouteRules(sourceItem) : [],
      stations,
      routableStationIds,
      fallback: routing?.fallback,
    })
  }

  // ── Items ────────────────────────────────────────────────────────────────

  const patchItem = (itemId, patch, message) => run(async () => {
    const wantsPublish = patch.is_available === true
    const ordinaryPatch = { ...patch }
    if (wantsPublish) delete ordinaryPatch.is_available
    let updated = null
    if (Object.prototype.hasOwnProperty.call(ordinaryPatch, 'category')) {
      updated = await routingApi(`/restaurants/${restaurantId}/menu/items/${itemId}/category`, {
        method: 'PUT',
        body: JSON.stringify({ category: ordinaryPatch.category }),
      })
      delete ordinaryPatch.category
    }
    if (Object.keys(ordinaryPatch).length > 0) {
      const ordinaryUpdate = await api(`/restaurants/${restaurantId}/menu/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify(ordinaryPatch),
      })
      updated = { ...updated, ...ordinaryUpdate }
    }
    if (wantsPublish) {
      updated = await routingApi(`/restaurants/${restaurantId}/menu/items/publish`, {
        method: 'POST',
        body: JSON.stringify({ menu_item_id: itemId }),
      })
    }
    setMenuItems(prev => prev.map(item => (item.id === itemId ? { ...item, ...updated } : item)))
    invalidateItems()
  }, message, 'Couldn’t update the item')

  const emptyItemDraft = () => ({
    name: '',
    category: '',
    price: '',
    description: '',
    course_type: '',
    prep_time_minutes: '',
    routing: ROUTE_INHERIT_VALUE,
    availability_mode: 'always',
    availability_days: [0, 1, 2, 3, 4, 5, 6],
    availability_start_time: '',
    availability_end_time: '',
    availability_start_date: '',
    availability_end_date: '',
    availability_notes: '',
    // Staged question/modifier picks, applied right after the item is created:
    // question_ids attach existing questions; extra_modifier_ids land in a new
    // "Extras" question; pending_group_options add a just-created modifier as
    // an option of an existing question (picker "category" matched its name).
    question_ids: [],
    excluded_question_ids: [],
    extra_modifier_ids: [],
    pending_group_options: [],
  })

  // Duplicate flow: everything but the name (and photo) prefills from the source.
  const draftFromItem = (item) => ({
    ...emptyItemDraft(),
    category: item.category || '',
    price: item.price != null ? String(item.price) : '',
    description: item.description || '',
    course_type: item.course_type || '',
    prep_time_minutes: item.prep_time_minutes == null ? '' : String(item.prep_time_minutes),
    routing: itemProductionRouting(item).value,
    availability_mode: item.availability_mode || 'always',
    availability_days: Array.isArray(item.availability_days) && item.availability_days.length > 0 ? item.availability_days : [0, 1, 2, 3, 4, 5, 6],
    availability_start_time: item.availability_start_time ? String(item.availability_start_time).slice(0, 5) : '',
    availability_end_time: item.availability_end_time ? String(item.availability_end_time).slice(0, 5) : '',
    availability_start_date: item.availability_start_date || '',
    availability_end_date: item.availability_end_date || '',
    availability_notes: item.availability_notes || '',
    excluded_question_ids: groups
      .filter(group => group.item_overrides?.[item.id]?.opted_out)
      .map(group => group.id),
  })

  const startCreateItem = (source = null) => {
    setSelectedItemId(null)
    setCreating({ source, draft: null })
  }

  // Create-new from the create screen's modifier picker. The modifier is a
  // shared library object, so creating it before the item exists is safe.
  const createModifierForDraft = async (modifierDraft) => {
    try {
      const created = await api(`/restaurants/${restaurantId}/menu/modifiers`, {
        method: 'POST',
        body: JSON.stringify({ ...modifierDraft, is_active: true }),
      })
      await loadModifiers()
      return created
    } catch (err) {
      setError(`Couldn’t create the modifier — ${describeError(err)}`)
      return null
    }
  }

  // Save from the create screen. With `duplicate`, the screen stays open with
  // the just-saved item as the new source, so a merchant can burn through a
  // whole section typing only names.
  const saveNewItem = (draft, { duplicate }) => {
    if (!draft.name.trim() || draft.price === '') {
      setError('New items need at least a name and a price.')
      return
    }
    const source = creating?.source || null
    return run(async () => {
      const copiedStationIds = draft.routing === ROUTE_MULTI_VALUE && source
        ? itemRouteRules(source).map(rule => rule.station_id).filter(Boolean)
        : []
      const routingMode = draft.routing === ROUTE_NO_PRODUCTION_VALUE
        ? 'no_production'
        : draft.routing === ROUTE_MULTI_VALUE || draft.routing
          ? 'stations'
          : 'inherit'
      const stationIds = draft.routing === ROUTE_MULTI_VALUE
        ? copiedStationIds
        : draft.routing && draft.routing !== ROUTE_NO_PRODUCTION_VALUE
          ? [draft.routing]
          : []
      const created = await routingApi(`/restaurants/${restaurantId}/menu/items/draft-with-routing`, {
        method: 'POST',
        body: JSON.stringify({
          name: draft.name.trim(),
          category: draft.category.trim() || 'Other',
          price: Number(draft.price) || 0,
          description: draft.description.trim() || null,
          course_type: draft.course_type || null,
          prep_time_minutes: draft.prep_time_minutes === '' ? null : Number(draft.prep_time_minutes),
          availability_mode: draft.availability_mode,
          availability_days: draft.availability_days,
          availability_start_time: draft.availability_start_time || null,
          availability_end_time: draft.availability_end_time || null,
          availability_start_date: draft.availability_start_date || null,
          availability_end_date: draft.availability_end_date || null,
          availability_notes: draft.availability_notes.trim() || null,
          routing_mode: routingMode,
          station_ids: stationIds,
        }),
      })
      if (!created?.id) throw new Error('The item was not created.')
      const warnings = []
      const excludedQuestionIds = draft.excluded_question_ids || []
      let full = created
      if (source) {
        warnings.push(...await copyItemConfig({
          restaurantId,
          api,
          sourceItem: source,
          targetItem: full,
          groups,
          sourceModifierOverrides: itemModifierOverrides[source.id] || {},
          sourceAllergyExclusions: allergyExclusions.filter(row => row.item_id === source.id),
          sourceSpecials: specials.filter(special => special.menu_item_id === source.id),
          excludedQuestionIds,
        }))
      }
      // Staged question/modifier picks from the create screen.
      try {
        let order = source ? (behaviorByItemId[source.id]?.questions?.length || 0) : 0
        for (const groupId of draft.question_ids || []) {
          await attachGroupToItem(groupId, full.id, order)
          order += 1
        }
        const categoryId = categoriesByName[draft.category || '']?.id || null
        for (const groupId of inheritedQuestionIdsToOptOut(groups, categoryId, excludedQuestionIds)) {
          await setItemGroupOverride(groupId, full.id, { opted_out: true })
        }
        for (const pending of draft.pending_group_options || []) {
          const group = groups.find(candidate => candidate.id === pending.group_id)
          if (!group || group.options.some(option => option.modifier_id === pending.modifier_id)) continue
          await addGroupOption(pending.group_id, pending.modifier_id, { display_order: group.options.length })
          if (groupAnswerSortMode(group) === 'alpha') await applyAlphaOrderToGroup(pending.group_id)
        }
        if ((draft.extra_modifier_ids || []).length > 0) {
          const extras = await createModifierGroup(restaurantId, {
            name: 'Extras',
            min_selections: 0,
            max_selections: null,
            is_required: false,
            prompt_on_order: true,
            display_order: groups.length,
          })
          await attachGroupToItem(extras.id, full.id, order)
          let optionOrder = 0
          for (const modifierId of draft.extra_modifier_ids) {
            await addGroupOption(extras.id, modifierId, { display_order: optionOrder })
            optionOrder += 1
          }
        }
      } catch {
        warnings.push('questions & modifiers')
      }
      if (warnings.length === 0) {
        try {
          const published = await routingApi(`/restaurants/${restaurantId}/menu/items/publish`, {
            method: 'POST',
            body: JSON.stringify({ menu_item_id: full.id }),
          })
          full = { ...full, ...published }
        } catch (err) {
          warnings.push(`publishing (${describeError(err)})`)
        }
      }
      invalidateItems()
      await Promise.allSettled([
        loadItems(true),
        loadGroups(),
        loadItemModifierOverrides(),
        loadSpecials(),
        loadAllergies(),
        loadRouting(true),
      ])
      const published = full.is_available !== false && warnings.length === 0
      const base = published
        ? duplicate ? `"${full.name}" saved — set up the next one.` : `"${full.name}" added.`
        : `"${full.name}" saved as an unavailable draft.`
      if (warnings.length) setError(`${base} Needs attention: ${[...new Set(warnings)].join(', ')}.`)
      else setNotice(base)
      if (duplicate && published) {
        // Staged picks were just saved onto this item, so they now carry over
        // via the copy path — clear them to avoid double-attaching.
        const categoryId = categoriesByName[draft.category || '']?.id || null
        const inheritedExclusions = inheritedQuestionIdsToOptOut(groups, categoryId, excludedQuestionIds)
        setCreating({ source: full, draft: { ...draft, name: '', question_ids: [], excluded_question_ids: inheritedExclusions, extra_modifier_ids: [], pending_group_options: [] } })
      } else {
        setCreating(null)
        setSelectedItemId(full.id)
      }
    }, undefined, 'Couldn’t add the item')
  }

  const deleteItem = (itemId) => run(async () => {
    await api(`/restaurants/${restaurantId}/menu/items/${itemId}`, { method: 'DELETE' })
    setMenuItems(prev => prev.filter(item => item.id !== itemId))
    invalidateItems()
  }, 'Item removed.', 'Couldn’t remove the item')

  const filteredItems = useMemo(() => {
    const needle = itemSearch.trim().toLowerCase()
    return mergedItems.filter(item => {
      const categoryName = effectiveItemCategoryName(item, categoriesById)
      if (itemCategoryFilter !== 'all' && categoryName !== itemCategoryFilter) return false
      if (itemAvailabilityFilter === 'available' && item.is_available === false) return false
      if (itemAvailabilityFilter === '86d' && item.is_available !== false) return false
      if (itemAvailabilityFilter === 'specials' && !activeSpecialItemIds.has(item.id)) return false
      if (!needle) return true
      return item.name.toLowerCase().includes(needle)
        || (item.description || '').toLowerCase().includes(needle)
        || categoryName.toLowerCase().includes(needle)
    })
  }, [mergedItems, itemSearch, itemCategoryFilter, itemAvailabilityFilter, activeSpecialItemIds, categoriesById])

  const itemsByCategory = useMemo(() => {
    const buckets = {}
    for (const item of filteredItems) {
      ;(buckets[effectiveItemCategoryName(item, categoriesById)] ||= []).push(item)
    }
    return Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredItems, categoriesById])

  // Unfiltered per-category item buckets for the Categories tab drill-in
  // (newer rows follow stable category ids; older rows fall back to names).
  const allItemsByCategoryKey = useMemo(
    () => bucketItemsByCategoryIdentity(mergedItems, categoriesById),
    [mergedItems, categoriesById],
  )

  // Item category names that have no matching category card — items still show
  // on the POS, but inherit no color/tax/station defaults.
  const orphanCategoryBuckets = useMemo(
    () => orphanCategoryBucketsFromIdentity(mergedItems, mergedCategories, categoriesById),
    [mergedItems, mergedCategories, categoriesById],
  )

  const toggleCategoryExpanded = (name) => {
    if (!name) return
    setExpandedCategoryNames(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  // Items tab → Categories tab: open that category's card, expanded and scrolled into view.
  const jumpToCategory = (name) => {
    setSelectedItemId(null)
    setActiveTab('categories')
    setExpandedCategoryNames(prev => new Set(prev).add(name))
    setCategoryScrollTarget(name)
  }

  const openItemEditor = (itemId) => {
    setActiveTab('items')
    setSelectedItemId(itemId)
  }

  useEffect(() => {
    if (activeTab !== 'categories' || !categoryScrollTarget) return
    const timer = setTimeout(() => {
      document.getElementById(`category-card-${encodeURIComponent(categoryScrollTarget)}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setCategoryScrollTarget(null)
    }, 80)
    return () => clearTimeout(timer)
  }, [activeTab, categoryScrollTarget])

  const selectedItem = selectedItemId ? mergedItems.find(item => item.id === selectedItemId) : null

  // Per-item POS ordering behavior (quick-add vs asks-N), for list badges.
  const modifiersById = useMemo(() => Object.fromEntries(modifiers.map(m => [m.id, m])), [modifiers])
  // Which questions offer each modifier — a modifier in none is invisible to guests.
  const groupsByModifierId = useMemo(() => {
    const map = {}
    for (const group of groups) {
      for (const option of group.options || []) {
        ;(map[option.modifier_id] ||= []).push(group)
      }
    }
    return map
  }, [groups])
  const modifierMatches = useMemo(() => rankModifierMatches(modifiers, modifierSearch, {
    aliases: modifier => [
      modifierCategoryOf(modifier),
      ...(groupsByModifierId[modifier.id] || []).map(group => group.name),
    ],
  }), [groupsByModifierId, modifierSearch, modifiers])
  const displayedModifierBuckets = useMemo(() => (
    modifierSearch.trim()
      ? [['Search results', modifierMatches.map(match => match.modifier)]]
      : bucketModifiersByCategory(modifiers)
  ), [modifierMatches, modifierSearch, modifiers])
  const behaviorByItemId = useMemo(() => {
    const directGroupsByItemId = {}
    const inheritedGroupsByCategoryId = {}
    for (const group of groups) {
      for (const itemId of group.item_ids || []) {
        ;(directGroupsByItemId[itemId] ||= []).push(group)
      }
      for (const link of group.category_links || []) {
        ;(inheritedGroupsByCategoryId[link.category_id] ||= []).push(group)
      }
    }
    const map = {}
    for (const item of mergedItems) {
      const categoryId = categoriesByName[item.category || '']?.id
      const candidates = [
        ...(directGroupsByItemId[item.id] || []),
        ...(categoryId ? inheritedGroupsByCategoryId[categoryId] || [] : []),
      ]
      const uniqueCandidates = [...new Map(candidates.map(group => [group.id, group])).values()]
      map[item.id] = itemOrderingBehavior(item, uniqueCandidates, categoriesByName, modifiersById)
    }
    return map
  }, [mergedItems, groups, categoriesByName, modifiersById])
  // ── Categories ───────────────────────────────────────────────────────────

  // Per-store ids (category, tax rate, station) never travel to OTHER stores —
  // they'd reference rows that don't exist there. Names do; the target backend
  // re-links stations by name and leaves tax overrides unset.
  const categoriesBodyFor = (targetId, nextCategories) => ({
    categories: nextCategories
      .filter(category => category.name && category.name.trim())
      .map(category => ({
        id: targetId === restaurantId ? (category.id || undefined) : undefined,
        name: category.name.trim(),
        tax_rate_id: targetId === restaurantId ? (category.tax_rate_id || null) : null,
        routing_station_id: targetId === restaurantId ? (category.routing_station_id || null) : null,
        routing_station_name: category.routing_station_name || stationsById[category.routing_station_id]?.name || null,
        default_course_type: category.default_course_type || null,
        default_fire_mode: category.default_fire_mode || null,
        prep_time_minutes: category.prep_time_minutes === '' || category.prep_time_minutes == null ? null : Number(category.prep_time_minutes),
        kds_display_group: category.kds_display_group || null,
        is_active: true,
        // Visible hours — always sent explicitly so clearing works; the
        // backend preserves windows only for callers that omit the mode.
        availability_mode: category.availability_mode === 'schedule' ? 'schedule' : 'always',
        availability_days: Array.isArray(category.availability_days) && category.availability_days.length > 0 ? category.availability_days : [0, 1, 2, 3, 4, 5, 6],
        availability_start_time: category.availability_start_time ? String(category.availability_start_time).slice(0, 5) : null,
        availability_end_time: category.availability_end_time ? String(category.availability_end_time).slice(0, 5) : null,
      })),
  })

  // Save now or later, to this store or (for resellers) a picked set of stores.
  const publishCategories = async (publication = null) => {
    const targets = propagationReady
      ? await requestPropagationTargets({
          sectionId: 'menu_categories',
          label: 'Menu categories',
          propagation: 'general',
          sourceRestaurantId: restaurantId,
        })
      : [restaurantId]
    if (targets === null) return // modal cancelled
    const targetIds = [...new Set((targets || []).filter(Boolean))]
      .sort((a, b) => (a === restaurantId ? -1 : b === restaurantId ? 1 : 0))
    if (targetIds.length === 0) {
      setError('Select at least one restaurant.')
      return
    }
    await run(async () => {
      if (publication?.scheduledFor) {
        const scheduled = await scheduleChange({
          label: 'Menu categories',
          scheduledFor: publication.scheduledFor,
          timezone: publication.timezone,
          commands: targetIds.map(targetId => ({
            method: 'PUT',
            path: `/restaurants/${targetId}/menu/categories`,
            body: categoriesBodyFor(targetId, categories),
            target_type: 'restaurant',
            target_id: targetId,
          })),
        })
        setNotice(`Menu categories scheduled for ${new Date(scheduled.scheduled_for).toLocaleString()}.`)
        return
      }
      for (const targetId of targetIds) {
        const saved = await api(`/restaurants/${targetId}/menu/categories`, {
          method: 'PUT',
          body: JSON.stringify(categoriesBodyFor(targetId, categories)),
        })
        if (targetId === restaurantId) {
          const next = Array.isArray(saved) ? saved : (saved?.categories || [])
          setCategories(next)
          setSavedCategories(next)
          invalidateCategories()
        }
      }
      setNotice(targetIds.length > 1 ? `Categories saved to ${targetIds.length} restaurants.` : 'Categories saved.')
    }, undefined, 'Couldn’t save categories')
  }

  const updateCategory = (index, patch) => {
    setCategories(prev => prev.map((category, currentIndex) => (currentIndex === index ? { ...category, ...patch } : category)))
  }

  const categoryDraft = (name = '') => ({
    client_key: `category-draft-${categoryDraftKeyRef.current++}`,
    name,
    tax_rate_id: '',
    routing_station_id: '',
    routing_station_name: '',
    default_course_type: '',
    default_fire_mode: 'inherit',
    prep_time_minutes: '',
    kds_display_group: '',
    is_active: true,
  })

  const addCategory = (name = '') => {
    const draft = categoryDraft(name)
    setCategories(prev => [...prev, draft])
    setEditingCategoryKey(draft.client_key)
    setCategoryScrollTarget(draft.client_key)
    if (name) setExpandedCategoryNames(prev => new Set(prev).add(name))
  }

  // True inheritance: link a question to the CATEGORY. Every item in it asks
  // the question — including items created later. Items opt out individually
  // from their own editor.
  const toggleGroupInheritance = (group, category, shouldAttach) => run(async () => {
    if (shouldAttach) {
      const nextCategoryOrder = nextCategoryQuestionOrder(groups, category.id)
      await attachGroupToCategory(restaurantId, group.id, category.id, nextCategoryOrder)
    } else {
      await detachGroupFromCategory(group.id, category.id)
    }
    await loadGroups()
  }, shouldAttach
    ? `Every item in ${category.name} now asks "${group.name}" — including items you add later.`
    : `"${group.name}" is no longer inherited by ${category.name}.`, 'Couldn’t update the question')

  const reorderCategoryQuestions = (category, orderedGroupIds) => run(async () => {
    await reorderCategoryGroups(category.id, orderedGroupIds)
    await loadGroups()
  }, `Question order saved for ${category.name}.`, 'Couldn’t reorder the questions')

  const pickCategoryColor = (category, color) => run(async () => {
    await setCategoryColor(restaurantId, category.id, color)
    setCategoryColors(prev => {
      const next = { ...prev }
      if (color) next[category.id] = color
      else delete next[category.id]
      queryClient.setQueryData(queryKeys.menuCategoryColors(restaurantId), next)
      return next
    })
  }, color ? 'Category color set.' : 'Category color cleared.', 'Couldn’t save the button color')

  // ── Modifiers ────────────────────────────────────────────────────────────

  // A modifier "category" that names an existing question (modifier group) is
  // treated as that question: the modifier lands in it, not just under a label.
  const groupMatchingCategory = (categoryName) => {
    const needle = (categoryName || '').trim().toLowerCase()
    if (!needle) return null
    return groups.find(group => group.name.trim().toLowerCase() === needle) || null
  }

  // The question the new modifier will be asked by: an explicit pick wins,
  // "__new__" creates one, and with no pick a category that names an existing
  // question keeps working as before.
  const draftTargetGroup = modifierDraft.group_id && modifierDraft.group_id !== '__new__'
    ? groups.find(group => group.id === modifierDraft.group_id) || null
    : modifierDraft.group_id === '' ? groupMatchingCategory(modifierDraft.category) : null

  const createModifier = () => {
    if (!modifierDraft.name.trim()) {
      setError('Give the modifier a name first.')
      return
    }
    if (modifierDraft.group_id === '__new__' && !modifierDraft.new_question_name.trim() && !modifierDraft.category.trim()) {
      setError('Name the new question — e.g. "Choose a side".')
      return
    }
    const explicitGroup = modifierDraft.group_id && modifierDraft.group_id !== '__new__'
      ? groups.find(group => group.id === modifierDraft.group_id) || null
      : null
    const matchingGroup = explicitGroup || (modifierDraft.group_id === '' ? groupMatchingCategory(modifierDraft.category) : null)
    const wantsNewQuestion = modifierDraft.group_id === '__new__'
    return run(async () => {
      const created = await api(`/restaurants/${restaurantId}/menu/modifiers`, {
        method: 'POST',
        body: JSON.stringify({
          name: modifierDraft.name.trim(),
          price_delta: modifierDraft.price_delta === '' ? 0 : Number(modifierDraft.price_delta),
          group_name: modifierDraft.category.trim() || 'Add-ons',
          is_active: true,
          tax_rate_id: modifierDraft.tax_rate_id || null,
          reporting_category_id: modifierDraft.reporting_category_id || null,
          print_on_kitchen_ticket: modifierDraft.print_on_kitchen_ticket !== false,
          kitchen_display_role: modifierDraft.kitchen_display_role || null,
        }),
      })
      if (created?.id && modifierDraft.item_ids.size > 0) {
        await api(`/restaurants/${restaurantId}/menu/modifiers/${created.id}/items`, {
          method: 'PUT',
          body: JSON.stringify({ item_ids: Array.from(modifierDraft.item_ids) }),
        })
      }
      if (created?.id && modifierDraft.kitchen_display_role) {
        await setModifierKitchenDisplayRole(created.id, modifierDraft.kitchen_display_role)
      }
      let targetGroup = matchingGroup
      if (created?.id && wantsNewQuestion) {
        targetGroup = await createModifierGroup(restaurantId, {
          name: modifierDraft.new_question_name.trim() || modifierDraft.category.trim(),
          min_selections: 0,
          max_selections: null,
          is_required: false,
          prompt_on_order: true,
          display_order: groups.length,
        })
        targetGroup = { ...targetGroup, item_ids: [], options: [] }
      }
      if (created?.id && targetGroup) {
        for (const itemId of modifierDraft.item_ids) {
          if (!targetGroup.item_ids.includes(itemId)) {
            await attachGroupToItem(targetGroup.id, itemId, targetGroup.item_ids.length)
          }
        }
        await addGroupOption(targetGroup.id, created.id, { display_order: targetGroup.options.length })
        await loadGroups()
      }
      setModifierDraft(prev => ({ name: '', price_delta: '', category: prev.category, tax_rate_id: '', reporting_category_id: '', group_id: prev.group_id === '__new__' ? '' : prev.group_id, new_question_name: '', print_on_kitchen_ticket: true, kitchen_display_role: '', item_ids: new Set() }))
      setShowModifierDrawer(false)
      await loadModifiers()
    }, wantsNewQuestion
      ? `Modifier added — new question "${modifierDraft.new_question_name.trim() || modifierDraft.category.trim()}" asks it${modifierDraft.item_ids.size ? ' on the selected items' : ''}.`
      : matchingGroup
        ? `Modifier added to the "${matchingGroup.name}" question.`
        : 'Modifier added to the library — attach it to a question so the POS asks it.', 'Couldn’t add the modifier')
  }

  // Attach an existing modifier to a question (and the question to the
  // modifier's items) — the rescue path for library-only modifiers.
  const addModifierToQuestion = (modifier, group) => run(async () => {
    for (const itemId of modifier.item_ids || []) {
      if (!group.item_ids.includes(itemId)) {
        await attachGroupToItem(group.id, itemId, group.item_ids.length)
      }
    }
    if (!group.options.some(option => option.modifier_id === modifier.id)) {
      await addGroupOption(group.id, modifier.id, { display_order: group.options.length })
      if (groupAnswerSortMode(group) === 'alpha') await applyAlphaOrderToGroup(group.id)
    }
    await loadGroups()
  }, `"${modifier.name}" is now an answer in "${group.name}".`, 'Couldn’t attach the modifier')

  const updateModifier = (modifierId, patch, message = 'Modifier saved.') => run(async () => {
    await api(`/restaurants/${restaurantId}/menu/modifiers/${modifierId}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    })
    await loadModifiers()
  }, message, 'Couldn’t update the modifier')

  const setModifierKitchenRole = (modifierId, role, message) => run(async () => {
    await setModifierKitchenDisplayRole(modifierId, role)
    await loadModifiers()
  }, message || (role ? 'Kitchen hierarchy saved.' : 'Kitchen hierarchy now inherits.'), 'Couldn’t save kitchen hierarchy')

  const recategorizeModifier = (modifier, nextCategory) => {
    const matchingGroup = groupMatchingCategory(nextCategory)
    const alreadyInGroup = matchingGroup?.options.some(option => option.modifier_id === modifier.id)
    return run(async () => {
      await api(`/restaurants/${restaurantId}/menu/modifiers/${modifier.id}`, {
        method: 'PUT',
        body: JSON.stringify({ group_name: nextCategory }),
      })
      if (matchingGroup && !alreadyInGroup) {
        await addGroupOption(matchingGroup.id, modifier.id, { display_order: matchingGroup.options.length })
        await loadGroups()
      }
      await loadModifiers()
    }, matchingGroup && !alreadyInGroup ? `Also added to the "${matchingGroup.name}" question.` : localSave(`modifier:${modifier.id}:category`), 'Couldn’t update the modifier')
  }

  const replaceModifierItems = (modifierId, itemIds, message = 'Modifier item list saved.') => run(async () => {
    await api(`/restaurants/${restaurantId}/menu/modifiers/${modifierId}/items`, {
      method: 'PUT',
      body: JSON.stringify({ item_ids: itemIds }),
    })
    await loadModifiers()
  }, message, 'Couldn’t update the modifier’s items')

  const deleteModifier = (modifierId) => run(async () => {
    await api(`/restaurants/${restaurantId}/menu/modifiers/${modifierId}`, { method: 'DELETE' })
    await loadModifiers()
    await loadGroups()
  }, 'Modifier removed.', 'Couldn’t remove the modifier')

  // ── Allergies ────────────────────────────────────────────────────────────

  // Row present in menu_item_allergy_exclusions = pill HIDDEN on that item, so
  // every pill applies to every item (incl. future ones) until narrowed.
  const exclusionsByPill = useMemo(() => {
    const map = {}
    for (const row of allergyExclusions) {
      ;(map[row.modifier_id] ||= new Set()).add(row.item_id)
    }
    return map
  }, [allergyExclusions])

  const setupAllergies = () => run(async () => {
    await ensureAllergyGroup(restaurantId)
    await loadAllergies()
  }, 'Allergy question created — add your pills below.', 'Couldn’t set up allergies')

  const addPill = () => {
    if (!pillDraft.trim() || !allergyGroup) return
    return run(async () => {
      await addAllergyPill(restaurantId, allergyGroup.id, pillDraft.trim(), allergyPills.length)
      setPillDraft('')
      await loadAllergies()
    }, 'Allergy pill added — live on every item.', 'Couldn’t add the pill')
  }

  const renamePill = (pill, name) => run(async () => {
    await renameAllergyPill(pill.id, name)
    await loadAllergies()
  }, localSave(`allergy:${pill.id}:name`), 'Couldn’t rename the pill')

  const togglePill = (pill) => run(async () => {
    await setAllergyPillActive(pill.id, pill.is_available === false)
    await loadAllergies()
  }, localSave(`allergy:${pill.id}:active`), 'Couldn’t update the pill')

  const togglePillOnItem = (pill, itemId, hide) => run(async () => {
    await setItemPillExcluded(restaurantId, itemId, pill.id, hide)
    await loadAllergies()
  }, localSave(`allergy:${pill.id}:items`), 'Couldn’t update the item')

  const bulkPillOnItems = (pill, itemIds, hide) => run(async () => {
    for (const itemId of itemIds) {
      const currentlyHidden = exclusionsByPill[pill.id]?.has(itemId) || false
      if (currentlyHidden !== hide) await setItemPillExcluded(restaurantId, itemId, pill.id, hide)
    }
    await loadAllergies()
  }, localSave(`allergy:${pill.id}:items`), 'Couldn’t update the items')

  // ── Modifier groups ──────────────────────────────────────────────────────

  const createGroup = () => {
    if (!groupDraft.name.trim()) {
      setError('Name the question first — e.g. "Choose a side".')
      return
    }
    return run(async () => {
      const minSelections = Math.max(groupDraft.is_required ? 1 : 0, Number(groupDraft.min_selections) || 0)
      await createModifierGroup(restaurantId, {
        name: groupDraft.name.trim(),
        min_selections: minSelections,
        max_selections: groupDraft.max_selections === '' ? null : Math.max(minSelections, Number(groupDraft.max_selections) || 0),
        is_required: groupDraft.is_required,
        prompt_on_order: groupDraft.prompt_on_order,
        included_count: Number(groupDraft.included_count) || 0,
        overage_price: parseMoneyDraft(groupDraft.overage_price),
        prompt_mode: groupDraft.prompt_mode,
        pre_modifiers: groupDraft.pre_modifiers,
        pre_modifier_prices: groupDraft.pre_modifier_prices,
        kitchen_display_role: groupDraft.kitchen_display_role || null,
        display_order: groups.length,
      })
      setGroupDraft(defaultGroupDraft())
      await loadGroups()
    }, 'Modifier group created.', 'Couldn’t create the question')
  }

  const saveGroup = (groupId, patch) => run(async () => {
    await updateModifierGroup(groupId, patch)
    await loadGroups()
  }, 'Group saved.', 'Couldn’t save the question')

  const archiveGroup = (groupId) => run(async () => {
    await archiveModifierGroup(groupId)
    await loadGroups()
  }, 'Question deleted.', 'Couldn’t delete the question')

  const runGroupLink = (work) => run(async () => {
    await work()
    await loadGroups()
  }, 'Question links saved.', 'Couldn’t update the question')

  const addModifiersToGroup = (group, modifierIds) => run(async () => {
    let order = group.options.length
    for (const modifierId of modifierIds) {
      if (group.options.some(option => option.modifier_id === modifierId)) continue
      await addGroupOption(group.id, modifierId, { display_order: order })
      order += 1
    }
    if (groupAnswerSortMode(group) === 'alpha') await applyAlphaOrderToGroup(group.id)
    await loadGroups()
  }, modifierIds.length > 1 ? 'Options added.' : 'Option added.', 'Couldn’t add the options')

  const createModifierIntoGroup = (group, draft) => run(async () => {
    const created = await api(`/restaurants/${restaurantId}/menu/modifiers`, {
      method: 'POST',
      body: JSON.stringify({ ...draft, is_active: true }),
    })
    if (created?.id) await addGroupOption(group.id, created.id, { display_order: group.options.length })
    if (groupAnswerSortMode(group) === 'alpha') await applyAlphaOrderToGroup(group.id)
    await loadModifiers()
    await loadGroups()
  }, 'Modifier created and added.', 'Couldn’t create the modifier')

  // ── Combos ───────────────────────────────────────────────────────────────

  const createCombo = (draft) => run(async () => {
    await fetchPosApi(restaurantId, '/manager/combos', {
      method: 'POST',
      body: JSON.stringify(comboPayloadFromDraft(draft, comboManagerPasscode)),
    })
    await loadCombos()
  }, localSave('combo:new'), 'Couldn’t create the combo')

  const updateCombo = (comboId, draft) => run(async () => {
    await fetchPosApi(restaurantId, `/manager/combos/${comboId}`, {
      method: 'PATCH',
      body: JSON.stringify(comboPayloadFromDraft(draft, comboManagerPasscode)),
    })
    await loadCombos()
  }, localSave(`combo:${comboId}`), 'Couldn’t save the combo')

  const archiveCombo = (comboId) => run(async () => {
    if (!comboManagerPasscode.trim()) throw new Error('Manager PIN is required to archive combos.')
    await fetchPosApi(restaurantId, `/manager/combos/${comboId}`, {
      method: 'DELETE',
      body: JSON.stringify({ manager_passcode: comboManagerPasscode.trim() }),
    })
    await loadCombos()
  }, 'Combo archived.', 'Couldn’t archive the combo')

  // ── Specials (tab-level scheduling) ──────────────────────────────────────

  const createSpecial = () => {
    if (!specialDraft.menu_item_id) {
      setError('Choose a base menu item for the special first.')
      return
    }
    if (specialDraft.schedule_kind === 'cycle' && (!specialDraft.cycle_anchor_date || !specialDraft.cycle_length_days || !specialDraft.cycle_day_number)) {
      setError('Cycle specials need an anchor date, cycle length, and special day.')
      return
    }
    return run(async () => {
      const payload = {
        menu_item_id: specialDraft.menu_item_id,
        display_name: specialDraft.display_name.trim() || null,
        note: specialDraft.note.trim() || null,
        special_price: specialDraft.special_price === '' ? null : Number(specialDraft.special_price),
        suggested_tip_basis: specialDraft.suggested_tip_basis,
        schedule_kind: specialDraft.schedule_kind,
        days_of_week: specialDraft.schedule_kind === 'weekly' ? specialDraft.days_of_week : [0, 1, 2, 3, 4, 5, 6],
        start_time: specialDraft.start_time || null,
        end_time: specialDraft.end_time || null,
        start_date: specialDraft.schedule_kind === 'date_window' ? (specialDraft.start_date || null) : null,
        end_date: specialDraft.schedule_kind === 'date_window' ? (specialDraft.end_date || null) : null,
        cycle_anchor_date: specialDraft.schedule_kind === 'cycle' ? specialDraft.cycle_anchor_date : null,
        cycle_length_days: specialDraft.schedule_kind === 'cycle' ? Number(specialDraft.cycle_length_days) : null,
        cycle_day_number: specialDraft.schedule_kind === 'cycle' ? Number(specialDraft.cycle_day_number) : null,
        expires_at: specialDraft.expires_at || null,
        sort_order: specials.length,
        is_active: true,
        preserve_gratuity_basis: specialDraft.preserve_gratuity_basis,
      }
      await createPricingSpecial(restaurantId, payload)
      setSpecialDraft(defaultSpecialDraft())
      await loadSpecials()
    }, 'Special saved.', 'Couldn’t save the special')
  }

  const updateSpecial = (special, patch, message) => run(async () => {
    await updatePricingSpecial(restaurantId, special.id, patch)
    await loadSpecials()
  }, message || localSave(`special:${special.id}:settings`), 'Couldn’t update the special')

  const archiveSpecial = (special) => run(async () => {
    await archivePricingSpecial(restaurantId, special.id)
    await loadSpecials()
  }, 'Special archived.', 'Couldn’t archive the special')

  const scheduledItems = mergedItems.filter(item => item.availability_mode && item.availability_mode !== 'always')

  // ── Printing / routing ───────────────────────────────────────────────────

  const routeSelectionPayload = (routeValue) => ({
    mode: routeValue === ROUTE_NO_PRODUCTION_VALUE ? 'no_production' : routeValue ? 'stations' : 'inherit',
    station_ids: routeValue && routeValue !== ROUTE_NO_PRODUCTION_VALUE ? [routeValue] : [],
  })

  const routeCategory = (categoryName, routeValue) => run(async () => {
    await routingApi(`/restaurants/${restaurantId}/kitchen-routing/categories`, {
      method: 'PUT',
      body: JSON.stringify({ category: categoryName, ...routeSelectionPayload(routeValue) }),
    })
    invalidateCategories()
    await Promise.all([loadRouting(true), loadCategories(true)])
  }, localSave(`route:category:${categoryName}`), 'Couldn’t route the category')

  const routeItemProduction = (item, routeValue) => run(async () => {
    await routingApi(`/restaurants/${restaurantId}/kitchen-routing/items/${item.id}`, {
      method: 'PUT',
      body: JSON.stringify(routeSelectionPayload(routeValue)),
    })
    await Promise.all([loadRouting(true), loadItems(true)])
  }, localSave(`route:item:${item.id}`), 'Couldn’t route the item')

  const createStation = (name) => run(async () => {
    await routingApi(`/restaurants/${restaurantId}/kitchen-routing/stations`, {
      method: 'POST',
      body: JSON.stringify({ name, is_active: true }),
    })
    await loadRouting(true)
  }, 'Station added.', 'Couldn’t add the station')

  const createTarget = (name, host) => run(async () => {
    await routingApi(`/restaurants/${restaurantId}/kitchen-routing/targets`, {
      method: 'POST',
      body: JSON.stringify({
        name: name || 'Kitchen Printer',
        target_type: 'printer',
        connection_type: host ? 'network' : 'dummy',
        config: host ? { host, port: 9100, profile: 'TM-T88V' } : {},
        is_active: true,
      }),
    })
    await loadRouting(true)
  }, 'Printer target added.', 'Couldn’t add the printer')

  const assignTarget = (stationId, targetId) => run(async () => {
    await routingApi(`/restaurants/${restaurantId}/kitchen-routing/station-targets`, {
      method: 'POST',
      body: JSON.stringify({ station_id: stationId, target_id: targetId, priority: 0, is_active: true }),
    })
    await loadRouting(true)
  }, 'Printer assigned to station.', 'Couldn’t assign the printer')

  const routingItems = useMemo(() => {
    const needle = routingItemSearch.trim().toLowerCase()
    const visible = showAllRoutingItems
      ? mergedItems
      : mergedItems.filter(item => hasItemProductionOverride(item, activeRoutingRules, activeRoutingExclusions))
    if (!needle) return visible
    return visible.filter(item => item.name.toLowerCase().includes(needle) || (item.category || '').toLowerCase().includes(needle))
  }, [mergedItems, routingItemSearch, showAllRoutingItems, activeRoutingRules, activeRoutingExclusions])

  // ── Render ───────────────────────────────────────────────────────────────

  const activeTabSourceKeys = MENU_TAB_SOURCE_KEYS[activeTab] || []
  const activeTabLoading = activeTab !== 'items' && activeTabSourceKeys.some(key => (
    !sourceStates[key] || sourceStates[key] === 'loading'
  ))
  const itemEditorLoading = activeTab === 'items' && Boolean(selectedItemId || creating) && ['routing', 'allergies'].some(key => (
    !sourceStates[key] || sourceStates[key] === 'loading'
  ))
  const contentReady = !loading && !activeTabLoading

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="label-mono">Menu Workspace</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">Menu</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-dash-secondary">
            Click any item to open its full editor — photo, availability, pricing, and modifier questions with unlimited follow-ups. Changes reach the POS on its next sync.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-dash-tertiary">
          <span className="rounded-full border border-white/10 px-3 py-1">{menuItems.length} items</span>
          {sourceStates.combos === 'loaded' && <span className="rounded-full border border-white/10 px-3 py-1">{combos.filter(combo => combo.is_available !== false).length} combos</span>}
          {sourceStates.modifiers === 'loaded' && <span className="rounded-full border border-white/10 px-3 py-1">{modifiers.length} modifiers</span>}
          {sourceStates.groups === 'loaded' && <span className="rounded-full border border-white/10 px-3 py-1">{groups.length} questions</span>}
          {sourceStates.specials === 'loaded' && <span className="rounded-full border border-white/10 px-3 py-1">{activeSpecials.length} live specials</span>}
        </div>
      </div>

      {!onlyTab && <div className="flex flex-wrap gap-2">
        {visibleMenuTabs.map(tab => (
          <SmallButton
            key={tab.id}
            variant={activeTab === tab.id ? 'primary' : 'secondary'}
            onClick={() => {
              setActiveTab(tab.id)
              setSelectedItemId(null)
              setCreating(null)
              setImporting(null)
            }}
          >
            {tab.label}
          </SmallButton>
        ))}
      </div>}

      {error && <div role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}
      {notice && <div role="status" aria-live="polite" className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">{notice}</div>}
      {loading && <div className="text-sm text-dash-tertiary">Loading menu...</div>}
      {!loading && activeTabLoading && <div className="text-sm text-dash-tertiary">Loading {MENU_TABS.find(tab => tab.id === activeTab)?.label || 'menu details'}...</div>}
      {!loading && itemEditorLoading && <div className="text-sm text-dash-tertiary">Loading item details...</div>}

      {contentReady && activeTab === 'items' && importing && (
        <SectionShell
          title={importing === 'upload' ? 'Import menu from a photo' : 'Bulk edit menu'}
          description="Rows keep their identity: saving updates existing items in place and adds new ones. Photos, questions, specials, and routing on existing items are untouched. Nothing is removed unless you delete its row here."
        >
          <MenuEditor
            restaurantId={restaurantId}
            mode={importing}
            initialItems={mergedItems.map(editorItemFromApi)}
            categories={mergedCategories}
            onBack={() => setImporting(null)}
            onSave={() => {
              setImporting(null)
              void run(async () => {
                invalidateItems()
                invalidateCategories()
                await Promise.allSettled([loadItems(true), loadCategories(true), loadRouting(true)])
              }, 'Menu saved.')
            }}
          />
        </SectionShell>
      )}

      {contentReady && !itemEditorLoading && activeTab === 'items' && !importing && creating && (
        <MenuItemCreate
          key={creating.source?.id || 'new-item'}
          categoryNames={categoryNames}
          categoriesByName={categoriesByName}
          stations={routableStations}
          groups={groups}
          modifiers={modifiers}
          source={creating.source}
          sourceGroupIds={creating.source
            ? directQuestionGroupsForItem(groups, creating.source.id).map(group => group.id)
            : []}
          onCreateModifier={createModifierForDraft}
          carryover={creating.source ? {
            questions: behaviorByItemId[creating.source.id]?.questions?.length || 0,
            modOverrides: Object.keys(itemModifierOverrides[creating.source.id] || {}).length,
            specials: specials.filter(special => special.menu_item_id === creating.source.id).length,
            allergens: allergyExclusions.filter(row => row.item_id === creating.source.id).length,
          } : null}
          initialDraft={creating.draft || (creating.source ? draftFromItem(creating.source) : emptyItemDraft())}
          busy={busy}
          onCancel={() => setCreating(null)}
          onSave={saveNewItem}
          resolveRoutingForDraft={draft => resolveRoutingForDraft(draft, creating.source)}
        />
      )}

      {contentReady && !itemEditorLoading && activeTab === 'items' && !importing && !creating && selectedItem && (
        <MenuItemDetail
          key={selectedItem.id}
          restaurantId={restaurantId}
          item={{ ...selectedItem, category: effectiveItemCategoryName(selectedItem, categoriesById) }}
          categories={mergedCategories}
          categoryNames={categoryNames}
          stations={routableStations}
          groups={groups}
          modifiers={modifiers}
          specials={specials}
          productionRouting={itemProductionRouting(selectedItem)}
          onRouteItemProduction={routeItemProduction}
          busy={busy}
          onBack={() => setSelectedItemId(null)}
          patchItem={patchItem}
          saveStatuses={saveStatuses}
          deleteItem={deleteItem}
          run={run}
          reloadGroups={loadGroups}
          reloadModifiers={loadModifiers}
          reloadSpecials={loadSpecials}
          reloadImages={loadImages}
          itemModifierOverrides={itemModifierOverrides[selectedItem.id] || {}}
          reloadItemModifierOverrides={loadItemModifierOverrides}
          canEditPrices={canEditPrices}
          onDuplicate={item => startCreateItem(item)}
          editorPrefs={editorPrefs}
          onSaveEditorPrefs={saveEditorPrefs}
        />
      )}

      {contentReady && activeTab === 'items' && !importing && !creating && !selectedItem && (
        <SectionShell
          title="Items"
          description="Click an item to open its full editor. Quick-86 on every row."
          actions={(
            <>
              <SmallButton onClick={() => { setSelectedItemId(null); setCreating(null); setImporting('upload') }} disabled={busy}>Import from photo</SmallButton>
              <SmallButton onClick={() => { setSelectedItemId(null); setCreating(null); setImporting('manual') }} disabled={busy}>Bulk edit table</SmallButton>
              <SmallButton variant="primary" onClick={() => startCreateItem()} disabled={busy}>+ Add item</SmallButton>
            </>
          )}
        >
          <div className="mb-4 grid gap-3 md:grid-cols-[1.6fr_1fr_1fr]">
            <TextInput value={itemSearch} onChange={event => setItemSearch(event.target.value)} placeholder="Search items, descriptions, categories..." />
            <SelectInput value={itemCategoryFilter} onChange={event => setItemCategoryFilter(event.target.value)}>
              <option value="all">All categories</option>
              {categoryNames.map(name => <option key={name} value={name}>{name}</option>)}
            </SelectInput>
            <SelectInput value={itemAvailabilityFilter} onChange={event => setItemAvailabilityFilter(event.target.value)}>
              <option value="all">All items</option>
              <option value="available">Available</option>
              <option value="86d">86'd only</option>
              <option value="specials">Running a special</option>
            </SelectInput>
          </div>

          {itemsByCategory.length === 0 ? (
            <MenuEmptyState title="No items match">
              Add your first item above, or loosen the search and filters.
            </MenuEmptyState>
          ) : (
            <div className="space-y-6">
              {itemsByCategory.map(([categoryName, items]) => {
                const categoryColor = categoriesByName[categoryName]?.color || null
                return (
                  <div key={categoryName}>
                    <div className="mb-2 flex items-center gap-2">
                      {categoryColor && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: categoryColor }} />}
                      <h4 className="text-sm font-semibold uppercase tracking-[0.08em] text-dash-tertiary">{categoryName}</h4>
                      <span className="text-xs text-dash-tertiary">{items.length}</span>
                      <button
                        type="button"
                        onClick={() => jumpToCategory(categoryName)}
                        title="Color, tax rate, station, and course for this category"
                        className="text-xs font-semibold text-dash-gold/80 transition hover:text-dash-gold"
                      >
                        Category settings →
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {items.map(item => (
                        <div
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedItemId(item.id)}
                          onKeyDown={event => {
                            if (event.key === 'Enter') setSelectedItemId(item.id)
                          }}
                          className={[
                            'flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition hover:border-dash-gold/40 hover:bg-white/[0.04]',
                            item.is_available === false ? 'border-amber-300/25 bg-amber-300/[0.04]' : 'border-white/10 bg-white/[0.025]',
                          ].join(' ')}
                        >
                          <ItemThumb item={item} color={categoryColor} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-dash-cream">{item.name}</span>
                              <a
                                href="./printing-routing#receipts"
                                onClick={event => event.stopPropagation()}
                                className="rounded-full border border-dash-gold/25 bg-dash-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-dash-gold"
                                title="Open Receipts & Tickets"
                              >
                                Kitchen: {printingConfig.aliases?.items?.[item.id] || 'Full name'}
                              </a>
                              {behaviorByItemId[item.id]?.questions.length > 0 && (
                                behaviorByItemId[item.id].quickAdd ? (
                                  <span
                                    className="rounded-full border border-dash-gold/40 bg-dash-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase text-dash-gold"
                                    title={`Taps straight onto the check${behaviorByItemId[item.id].skipsWithDefaults.length ? ` with ${behaviorByItemId[item.id].skipsWithDefaults.flatMap(entry => entry.defaultNames).join(', ')}` : ''} — no popup`}
                                  >
                                    ⚡ Quick add
                                  </span>
                                ) : (
                                  <span
                                    className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-dash-tertiary"
                                    title={`Asks: ${behaviorByItemId[item.id].asks.map(group => group.name).join(', ')}`}
                                  >
                                    Asks {behaviorByItemId[item.id].asks.length}
                                  </span>
                                )
                              )}
                              {activeSpecialItemIds.has(item.id) && (
                                <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">Special</span>
                              )}
                              {item.availability_mode && item.availability_mode !== 'always' && (
                                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-dash-tertiary">Scheduled</span>
                              )}
                            </div>
                            {item.description && <p className="truncate text-sm text-dash-tertiary">{item.description}</p>}
                          </div>
                          <span className="text-sm font-semibold text-dash-cream">{money(item.price)}</span>
                          <span onClick={event => event.stopPropagation()}>
                            <SmallButton
                              variant={item.is_available === false ? 'danger' : 'secondary'}
                              title={item.is_available === false ? 'Item is 86’d — tap to restore' : 'Take item off the menu (86)'}
                              onClick={() => void patchItem(item.id, { is_available: item.is_available === false }, item.is_available === false ? 'Item restored.' : "Item 86'd.")}
                            >
                              {item.is_available === false ? "86'd" : 'Available'}
                            </SmallButton>
                          </span>
                          <span className="text-dash-tertiary">›</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionShell>
      )}

      {contentReady && activeTab === 'categories' && (
        <SectionShell
          title="Categories"
          description="How the menu is organized on the POS. Each category card shows exactly how its button will look on the device, and sets the tax rate, prep station, and course its items inherit. Click an item count to see what's inside."
          actions={(
            <div className="flex flex-wrap gap-2">
              <SmallButton onClick={() => { setCategories(structuredClone(savedCategories)); setError(''); setNotice('Changes discarded.') }} disabled={busy}>Cancel</SmallButton>
              <SmallButton onClick={() => addCategory()} disabled={busy}>Add category</SmallButton>
              <PublishControls
                label={propagationReady ? 'Save categories…' : 'Save categories'}
                busy={busy}
                disabled={busy}
                onPublishNow={() => void publishCategories()}
                onSchedule={(scheduledFor, timezone) => void publishCategories({ scheduledFor, timezone })}
              />
            </div>
          )}
        >
          <div className="mb-4"><ScheduledChangesPanel /></div>
          <div className="space-y-3">
            {mergedCategories.map((category, index) => {
              const categoryItems = allItemsByCategoryKey[categoryKeyForCategory(category)] || []
              const isExpanded = Boolean(category.name) && expandedCategoryNames.has(category.name)
              const productionRouting = categoryProductionRouting(category.name)
              const categoryCardId = category.id ? (category.name || category.id) : (category.client_key || `new-${index}`)
              const categoryEditorKey = category.id || category.client_key || `new-${index}`
              const isEditing = editingCategoryKey === categoryEditorKey
              const inheritedGroups = categoryQuestionGroups(groups, category.id)
              return (
                <div
                  key={category.id || category.client_key || `new-${index}`}
                  id={`category-card-${encodeURIComponent(categoryCardId)}`}
                  className="rounded-xl border border-white/10 bg-white/[0.025] p-4"
                >
                  <div className="flex flex-wrap items-end gap-4">
                    <div>
                      <p className="label-mono mb-1.5">On the POS</p>
                      <PosTilePreview
                        color={category.color}
                        label={category.name || 'New category'}
                        sublabel={`${categoryItems.length} item${categoryItems.length === 1 ? '' : 's'}`}
                      />
                    </div>
                    <div className="w-full sm:w-72">
                      <Field label="Category name">
                        <TextInput value={category.name || ''} onChange={event => updateCategory(index, { name: event.target.value })} placeholder="Appetizers" />
                      </Field>
                    </div>
                    <div className="min-w-44 flex-1 pb-1 text-sm text-dash-tertiary">
                      <p>{inheritedGroups.length} base question{inheritedGroups.length === 1 ? '' : 's'}</p>
                      <p className="mt-0.5">{productionRouting.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 pb-0.5">
                      <SmallButton
                        variant={isEditing ? 'primary' : 'secondary'}
                        onClick={() => setEditingCategoryKey(isEditing ? null : categoryEditorKey)}
                      >
                        {isEditing ? 'Close editor' : 'Edit category'}
                      </SmallButton>
                      <SmallButton
                        onClick={() => toggleCategoryExpanded(category.name)}
                        disabled={!category.name}
                        title="See every item that lives in this category"
                      >
                        {isExpanded ? 'Hide items' : `View ${categoryItems.length} item${categoryItems.length === 1 ? '' : 's'}`}
                      </SmallButton>
                      <SmallButton
                        variant="danger"
                        onClick={() => {
                          if (isEditing) setEditingCategoryKey(null)
                          setCategories(prev => prev.filter((_, currentIndex) => currentIndex !== index))
                        }}
                      >
                        Remove
                      </SmallButton>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="mt-4 border-t border-white/10 pt-4">
                      <p className="label-mono mb-3">Category defaults</p>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <Field label="Production route">
                          <SelectInput
                            value={productionRouting.value}
                            disabled={!category.id || busy}
                            onChange={event => {
                              if (event.target.value === ROUTE_MULTI_VALUE) return
                              void routeCategory(category.name, event.target.value)
                            }}
                          >
                            <option value={ROUTE_INHERIT_VALUE}>Use restaurant fallback</option>
                            <option value={ROUTE_NO_PRODUCTION_VALUE}>No kitchen ticket</option>
                            {productionRouting.value === ROUTE_MULTI_VALUE && <option value={ROUTE_MULTI_VALUE}>Multiple stations</option>}
                            {routableStations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}
                          </SelectInput>
                        </Field>
                        <Field label="Default course">
                          <SelectInput value={category.default_course_type || ''} onChange={event => updateCategory(index, { default_course_type: event.target.value })}>
                            {COURSE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </SelectInput>
                        </Field>
                        <Field label="Prep minutes">
                          <TextInput
                            value={category.prep_time_minutes == null ? '' : String(category.prep_time_minutes)}
                            onChange={event => updateCategory(index, { prep_time_minutes: cleanDigits(event.target.value) })}
                            placeholder="e.g. 12"
                          />
                        </Field>
                        <Field label="Tax rate">
                          <SelectInput
                            title="Every item in this category is taxed at this rate on the POS"
                            value={category.tax_rate_id || ''}
                            onChange={event => updateCategory(index, { tax_rate_id: event.target.value || null })}
                          >
                            <option value="">Store default rate</option>
                            {taxRates.map(rate => (
                              <option key={rate.id} value={rate.id}>{rate.name} · {Number(rate.rate)}%</option>
                            ))}
                          </SelectInput>
                        </Field>
                        <Field label="Fire timing">
                          <SelectInput
                            title="Default kitchen fire timing for new items in this category — individual items can override it"
                            value={category.default_fire_mode || ''}
                            onChange={event => updateCategory(index, { default_fire_mode: event.target.value || null })}
                          >
                            <option value="">Use order default</option>
                            <option value="inherit">Use order default</option>
                            <option value="immediate">Immediate</option>
                            <option value="hold">Hold</option>
                            <option value="manual">Manual</option>
                            <option value="by_course">By course</option>
                          </SelectInput>
                        </Field>
                        <Field label="KDS group">
                          <TextInput
                            title="Kitchen display grouping label for this category's tickets"
                            value={category.kds_display_group || ''}
                            onChange={event => updateCategory(index, { kds_display_group: event.target.value })}
                            placeholder="Apps, Entrees, Bar…"
                          />
                        </Field>
                      </div>

                  <div className="mt-4">
                    <p className="label-mono mb-2">Visible hours</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <SelectInput
                        className="!w-auto"
                        title="Outside these hours the category hides on the POS and its items can't be rung in"
                        value={category.availability_mode === 'schedule' ? 'schedule' : 'always'}
                        onChange={event => updateCategory(index, { availability_mode: event.target.value })}
                      >
                        <option value="always">Always visible</option>
                        <option value="schedule">Visible during set hours</option>
                      </SelectInput>
                      {category.availability_mode === 'schedule' && (
                        <>
                          {DAYS_SHORT.map((day, dayIndex) => {
                            const days = Array.isArray(category.availability_days) && category.availability_days.length > 0 ? category.availability_days : [0, 1, 2, 3, 4, 5, 6]
                            const selected = days.includes(dayIndex)
                            return (
                              <SmallButton
                                key={day}
                                variant={selected ? 'primary' : 'secondary'}
                                onClick={() => updateCategory(index, {
                                  availability_days: selected ? days.filter(value => value !== dayIndex) : [...days, dayIndex].sort((a, b) => a - b),
                                })}
                              >
                                {day}
                              </SmallButton>
                            )
                          })}
                          <SmartTimeInput
                            className="w-36"
                            ariaLabel={`${category.name} visible from`}
                            value={category.availability_start_time ? String(category.availability_start_time).slice(0, 5) : ''}
                            onChange={value => updateCategory(index, { availability_start_time: value })}
                          />
                          <span className="text-xs text-dash-tertiary">to</span>
                          <SmartTimeInput
                            className="w-36"
                            ariaLabel={`${category.name} visible until`}
                            value={category.availability_end_time ? String(category.availability_end_time).slice(0, 5) : ''}
                            onChange={value => updateCategory(index, { availability_end_time: value })}
                          />
                        </>
                      )}
                    </div>
                    {category.availability_mode === 'schedule' && (
                      <p className="mt-1.5 text-xs text-dash-tertiary">
                        Outside this window the category hides on the POS and its items can't be rung in or re-ordered. Overnight windows (e.g. 22:00 to 02:00) belong to the day they start.
                      </p>
                    )}
                  </div>

                  <div className="mt-4">
                    <p className="label-mono mb-2">Button color</p>
                    <ColorSwatchPicker
                      value={category.color}
                      disabled={!category.id || busy}
                      onPick={color => category.id && void pickCategoryColor(category, color)}
                    />
                    {!category.id && <p className="mt-1.5 text-xs text-dash-tertiary">Save categories first to pick a color.</p>}
                  </div>

                  <div className="mt-5 border-t border-white/10 pt-4">
                    <p className="label-mono mb-1">Base questions</p>
                    <p className="mb-2 text-xs text-dash-tertiary">
                      These questions are inherited by every item in {category.name || 'this category'}, including items added later. Individual items can opt out or override their defaults.
                    </p>
                    {category.id ? (
                      <>
                        <div className="flex flex-wrap gap-1.5">
                          {groups.map(group => {
                            const inherited = (group.category_links || []).some(link => link.category_id === category.id)
                            const optedOutCount = categoryItems.filter(row => group.item_overrides?.[row.id]?.opted_out).length
                            const directCount = categoryItems.filter(row => group.item_ids.includes(row.id)).length
                            return (
                              <button
                                key={group.id}
                                type="button"
                                disabled={busy}
                                aria-pressed={inherited}
                                title={groupRulesSummary(group)}
                                onClick={() => void toggleGroupInheritance(group, category, !inherited)}
                                className={[
                                  'rounded-full border px-3 py-1.5 text-sm transition disabled:opacity-50',
                                  inherited
                                    ? 'border-dash-gold/60 bg-dash-gold/15 text-dash-cream'
                                    : 'border-white/10 bg-white/[0.03] text-dash-secondary hover:border-dash-gold/60 hover:text-dash-cream',
                                ].join(' ')}
                              >
                                {inherited ? 'Selected:' : 'Add:'} {group.name}
                                <span className="ml-1.5 text-xs text-dash-tertiary">
                                  {group.options.length} option{group.options.length === 1 ? '' : 's'}
                                  {inherited && optedOutCount > 0 && ` · ${optedOutCount} opted out`}
                                  {!inherited && directCount > 0 && ` · on ${directCount}/${categoryItems.length} directly`}
                                </span>
                              </button>
                            )
                          })}
                          {groups.length === 0 && (
                            <p className="text-sm text-dash-tertiary">No questions yet — build one on the Questions tab or inside any item.</p>
                          )}
                        </div>

                        {inheritedGroups.length > 0 && (
                          <div className="mt-4">
                            <p className="label-mono mb-1">Asked in this order</p>
                            <p className="mb-2 text-xs text-dash-tertiary">
                              Drag to set the category-wide order. Each newly selected question is added at the bottom; individual item ordering can still override it.
                            </p>
                            <SortableRows
                              ids={inheritedGroups.map(group => group.id)}
                              className="max-w-xl space-y-1.5"
                              disabled={busy || inheritedGroups.length < 2}
                              onReorder={orderedIds => reorderCategoryQuestions(category, orderedIds)}
                              renderRow={(groupId, { handleProps }) => {
                                const group = inheritedGroups.find(candidate => candidate.id === groupId)
                                if (!group) return null
                                const position = inheritedGroups.indexOf(group) + 1
                                return (
                                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-2.5">
                                    <DragHandle handleProps={handleProps} />
                                    <span className="w-5 text-center text-[11px] font-bold text-dash-gold">{position}</span>
                                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-dash-cream">{group.name}</span>
                                    <span className="text-xs text-dash-tertiary">{group.options.length} option{group.options.length === 1 ? '' : 's'}</span>
                                  </div>
                                )
                              }}
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-dash-tertiary">Save categories first to set base questions.</p>
                    )}
                  </div>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="mt-4 border-t border-white/10 pt-3">
                      <p className="label-mono mb-2">Items in {category.name}</p>
                      {categoryItems.length === 0 ? (
                        <p className="text-sm text-dash-tertiary">No items here yet — add them on the Items tab, or move an existing item into this category from its editor.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {categoryItems.map(item => (
                            <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-2.5">
                              <ItemThumb item={item} color={category.color} />
                              <div className="min-w-0 flex-1">
                                <span className="font-medium text-dash-cream">{item.name}</span>
                                {item.is_available === false && (
                                  <span className="ml-2 rounded-full bg-amber-300/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-200">86'd</span>
                                )}
                              </div>
                              <span className="text-sm font-semibold text-dash-cream">{money(item.price)}</span>
                              <SmallButton onClick={() => openItemEditor(item.id)}>Edit item →</SmallButton>
                            </div>
                          ))}
                        </div>
                      )}

                    </div>
                  )}
                </div>
              )
            })}
            {mergedCategories.length === 0 && (
              <MenuEmptyState title="No categories yet">
                Add your first category — Appetizers, Entrees, Drinks — then save.
              </MenuEmptyState>
            )}
          </div>

          {orphanCategoryBuckets.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-300/25 bg-amber-300/[0.04] p-4">
              <p className="text-sm font-semibold text-amber-100">Items without a category card</p>
              <p className="mt-1 text-sm text-dash-secondary">
                These items name a category that isn't set up above, so they get no button color, tax rate, or station defaults. Create the card to configure them.
              </p>
              <div className="mt-3 space-y-2">
                {orphanCategoryBuckets.map(([name, orphanItems]) => (
                  <div key={name} id={`category-card-${encodeURIComponent(name)}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <span className="font-medium text-dash-cream">{name}</span>
                    <span className="text-sm text-dash-tertiary">{orphanItems.length} item{orphanItems.length === 1 ? '' : 's'} · {orphanItems.slice(0, 4).map(item => item.name).join(', ')}{orphanItems.length > 4 ? '…' : ''}</span>
                    <span className="flex-1" />
                    <SmallButton
                      onClick={() => {
                        addCategory(name)
                      }}
                    >
                      Create "{name}" category
                    </SmallButton>
                  </div>
                ))}
              </div>
            </div>
          )}

        </SectionShell>
      )}

      {contentReady && activeTab === 'combos' && (
        <MenuCombosPanel
          combos={combos}
          menuItems={mergedItems.map(item => ({ ...item, category: effectiveItemCategoryName(item, categoriesById) }))}
          managerPasscode={comboManagerPasscode}
          onManagerPasscodeChange={setComboManagerPasscode}
          busy={busy}
          statusFor={saved}
          onCreateCombo={createCombo}
          onUpdateCombo={updateCombo}
          onArchiveCombo={archiveCombo}
        />
      )}

      {contentReady && activeTab === 'modifiers' && (
        <SectionShell
          title="Modifiers"
          description="Individual add-ons and choices — Extra cheese, Ranch, Medium rare — organized into categories like Sauces or Temperatures. A modifier tax or sales-category override applies to that modifier's charged amount only. To reclassify part of a fixed-price combo without changing its total, price the base item and modifier portion separately."
        >
          <datalist id="menu-modifier-categories">
            {Array.from(new Set([
              ...modifiers.map(modifierCategoryOf),
              ...groups.map(group => group.name.trim()).filter(Boolean),
            ])).sort().map(name => <option key={name} value={name} />)}
          </datalist>
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-4">
            <SmallButton variant="primary" onClick={() => setShowModifierDrawer(true)}>＋ New modifier</SmallButton>
            <span className="text-sm text-dash-tertiary">Price, tax, kitchen printing, the question that asks it, and the items it applies to — all in one panel.</span>
          </div>

          <div className="relative mb-5 max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dash-tertiary" aria-hidden="true" />
            <input
              type="search"
              value={modifierSearch}
              onChange={event => setModifierSearch(event.target.value)}
              placeholder="Search modifiers, categories, or questions"
              aria-label="Search modifiers"
              className="min-h-11 w-full rounded-lg border border-white/10 bg-white/[0.04] py-2 pl-10 pr-11 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary focus:border-dash-gold/50"
            />
            {modifierSearch && (
              <button
                type="button"
                onClick={() => setModifierSearch('')}
                aria-label="Clear modifier search"
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-dash-tertiary hover:bg-white/[0.06] hover:text-dash-cream"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {showModifierDrawer && (
            <>
              <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setShowModifierDrawer(false)} />
              <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-white/10 bg-[#14120e] shadow-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight">New modifier</h3>
                    <p className="mt-1 text-sm text-dash-tertiary">Guests only see it once a question asks it.</p>
                  </div>
                  <SmallButton onClick={() => setShowModifierDrawer(false)}>✕</SmallButton>
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto p-5">
                  <Field label="Modifier name">
                    <TextInput autoFocus value={modifierDraft.name} onChange={event => setModifierDraft(prev => ({ ...prev, name: event.target.value }))} placeholder="Extra cheese" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Price +$">
                      <TextInput inputMode="decimal" value={modifierDraft.price_delta} onChange={event => setModifierDraft(prev => ({ ...prev, price_delta: cleanDecimal(event.target.value) }))} placeholder="0.00" />
                    </Field>
                    <Field label="Category">
                      <TextInput list="menu-modifier-categories" value={modifierDraft.category} onChange={event => setModifierDraft(prev => ({ ...prev, category: event.target.value }))} placeholder="Add-ons" />
                    </Field>
                  </div>
                  <Field label="Kitchen ticket">
                    <SelectInput
                      title="Some choices only matter front-of-house — upsells, FOH notes. 'Never prints' keeps them off kitchen tickets everywhere; receipts still show them."
                      value={modifierDraft.print_on_kitchen_ticket === false ? 'no' : 'yes'}
                      onChange={event => setModifierDraft(prev => ({ ...prev, print_on_kitchen_ticket: event.target.value !== 'no' }))}
                    >
                      <option value="yes">Prints on kitchen tickets</option>
                      <option value="no">Never prints (FOH-only)</option>
                    </SelectInput>
                  </Field>
                  <Field label="Kitchen ticket hierarchy fallback">
                    <SelectInput
                      value={modifierDraft.kitchen_display_role}
                      onChange={event => setModifierDraft(prev => ({ ...prev, kitchen_display_role: event.target.value }))}
                    >
                      <option value="">Inherit / legacy</option>
                      <option value="ingredient">Ingredient</option>
                      <option value="side">Side / non-ingredient</option>
                    </SelectInput>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                  <Field label="Tax rate">
              <SelectInput
                title="Tax this modifier's charge at its own rate — e.g. liquor in a Jack & Coke"
                value={modifierDraft.tax_rate_id}
                onChange={event => setModifierDraft(prev => ({ ...prev, tax_rate_id: event.target.value }))}
              >
                <option value="">Follows item</option>
                {taxRates.map(rate => (
                  <option key={rate.id} value={rate.id}>{rate.name} · {Number(rate.rate)}%</option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Sales category">
              <SelectInput
                title="Report this modifier's charged amount under its own sales category"
                value={modifierDraft.reporting_category_id}
                onChange={event => setModifierDraft(prev => ({ ...prev, reporting_category_id: event.target.value }))}
              >
                <option value="">Item's category</option>
                {mergedCategories.filter(category => category.id).map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </SelectInput>
            </Field>
            </div>
            <div>
              <Field label="Asked by question">
                <SelectInput
                  title="The question the POS asks that offers this modifier — without one, guests are never offered it"
                  value={modifierDraft.group_id}
                  onChange={event => setModifierDraft(prev => ({ ...prev, group_id: event.target.value }))}
                >
                  <option value="">{draftTargetGroup ? `Matches "${draftTargetGroup.name}"` : 'No question yet…'}</option>
                  <option value="__new__">＋ New question…</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </SelectInput>
              </Field>
              {modifierDraft.group_id === '__new__' && (
                <div className="mt-2">
                  <TextInput
                    value={modifierDraft.new_question_name}
                    onChange={event => setModifierDraft(prev => ({ ...prev, new_question_name: event.target.value }))}
                    placeholder='e.g. "Choose a side"'
                    className="!py-2"
                  />
                </div>
              )}
              {modifierDraft.group_id === '' && !draftTargetGroup && (
                <p className="mt-1.5 text-xs text-amber-200">
                  Without a question the POS never offers this modifier — pick one, or create it here.
                </p>
              )}
              {(draftTargetGroup || modifierDraft.group_id === '__new__') && (
                <p className="mt-1.5 text-xs text-dash-tertiary">
                  The question is also attached to every item you select, so they start asking it.
                </p>
              )}
            </div>
            <div>
              <p className="label-mono mb-2">Applies to ({modifierDraft.item_ids.size} items)</p>
              <ItemChecklist
                menuItems={mergedItems}
                selectedIds={modifierDraft.item_ids}
                onToggle={itemId => setModifierDraft(prev => {
                  const next = new Set(prev.item_ids)
                  if (next.has(itemId)) next.delete(itemId)
                  else next.add(itemId)
                  return { ...prev, item_ids: next }
                })}
                onBulk={(itemIds, shouldSelect) => setModifierDraft(prev => {
                  const next = new Set(prev.item_ids)
                  for (const itemId of itemIds) {
                    if (shouldSelect) next.add(itemId)
                    else next.delete(itemId)
                  }
                  return { ...prev, item_ids: next }
                })}
              />
            </div>
                </div>
                <div className="flex gap-2 border-t border-white/10 p-5">
                  <SmallButton variant="primary" onClick={() => void createModifier()} disabled={busy || !modifierDraft.name.trim()}>Add modifier</SmallButton>
                  <SmallButton onClick={() => setShowModifierDrawer(false)}>Cancel</SmallButton>
                </div>
              </aside>
            </>
          )}

          <div className="space-y-5">
            {displayedModifierBuckets.map(([bucketName, bucketModifiers]) => (
              <div key={bucketName}>
                <div className="mb-2 flex items-center gap-2">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.08em] text-dash-tertiary">{bucketName}</h4>
                  <span className="text-xs text-dash-tertiary">{bucketModifiers.length}</span>
                </div>
                <div className="space-y-2">
                  {bucketModifiers.map(modifier => (
                    <ModifierRow
                      key={modifier.id}
                      modifier={modifier}
                      menuItems={mergedItems}
                      taxRates={taxRates}
                      reportingCategories={mergedCategories.filter(category => category.id)}
                      kitchenAlias={printingConfig.aliases?.modifiers?.[modifier.id] || ''}
                      askedByGroups={groupsByModifierId[modifier.id] || []}
                      allGroups={groups}
                      onAddToQuestion={group => void addModifierToQuestion(modifier, group)}
                      busy={busy}
                      statusFor={key => saved(`modifier:${modifier.id}:${key}`)}
                      onRename={next => void updateModifier(modifier.id, { name: next }, localSave(`modifier:${modifier.id}:name`))}
                      onReprice={next => void updateModifier(modifier.id, { price_delta: next }, localSave(`modifier:${modifier.id}:price`))}
                      onRecategorize={next => void recategorizeModifier(modifier, next)}
                      onSetTaxRate={next => void updateModifier(modifier.id, { tax_rate_id: next }, localSave(`modifier:${modifier.id}:tax`))}
                      onSetReportingCategory={next => void updateModifier(modifier.id, { reporting_category_id: next }, localSave(`modifier:${modifier.id}:sales`))}
                      onSetPrint={shouldPrint => void updateModifier(modifier.id, { print_on_kitchen_ticket: shouldPrint }, localSave(`modifier:${modifier.id}:print`))}
                      onSetKitchenRole={next => void setModifierKitchenRole(modifier.id, next, localSave(`modifier:${modifier.id}:kitchen`))}
                      onReplaceItems={itemIds => void replaceModifierItems(modifier.id, itemIds, localSave(`modifier:${modifier.id}:items`))}
                      onDelete={() => void deleteModifier(modifier.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
            {modifiers.length === 0 && (
              <MenuEmptyState title="No modifiers yet">
                Add choices guests make — sides, temps, sauces, add-ons — and attach them to items.
              </MenuEmptyState>
            )}
            {modifiers.length > 0 && modifierSearch.trim() && modifierMatches.length === 0 && (
              <MenuEmptyState title="No matching modifiers found">
                <span>Nothing in this restaurant is sufficiently similar to “{modifierSearch.trim()}”.</span>
                <span className="mt-3 block">
                  <SmallButton
                    variant="primary"
                    onClick={() => {
                      setModifierDraft(prev => ({ ...prev, name: modifierSearch.trim() }))
                      setShowModifierDrawer(true)
                    }}
                  >
                    Create “{modifierSearch.trim()}”
                  </SmallButton>
                </span>
              </MenuEmptyState>
            )}
          </div>
        </SectionShell>
      )}

      {contentReady && activeTab === 'allergies' && (
        <SectionShell
          title="Allergies"
          description="The allergy pills servers can flag on any order line — Peanut, Gluten, Dairy. Every pill applies to every item automatically (including new items and new pills); narrow a pill off specific items below. Allergy flags always print on kitchen tickets and never block quick-add."
        >
          {!allergyGroup ? (
            <MenuEmptyState title="Allergies aren't set up yet">
              One click creates the restaurant-wide allergy question the POS shows on every item.
              <span className="mt-3 block">
                <SmallButton variant="primary" disabled={busy} onClick={() => void setupAllergies()}>Set up allergies</SmallButton>
              </span>
            </MenuEmptyState>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-3">
                <span className="label-mono">New pill</span>
                <div className="w-56">
                  <TextInput
                    value={pillDraft}
                    onChange={event => setPillDraft(event.target.value)}
                    onKeyDown={event => { if (event.key === 'Enter') void addPill() }}
                    placeholder="Peanut, Gluten, Shellfish..."
                    className="!py-2"
                  />
                </div>
                <SmallButton variant="primary" disabled={!pillDraft.trim() || busy} onClick={() => void addPill()}>Add pill</SmallButton>
                <span className="text-xs text-dash-tertiary">New pills go live on every item immediately.</span>
              </div>

              <div className="space-y-2">
                {allergyPills.map(pill => (
                  <AllergyPillRow
                    key={pill.id}
                    pill={pill}
                    menuItems={mergedItems}
                    hiddenItemIds={exclusionsByPill[pill.id] || new Set()}
                    busy={busy}
                    statusFor={key => saved(`allergy:${pill.id}:${key}`)}
                    onRename={name => void renamePill(pill, name)}
                    onToggle={() => void togglePill(pill)}
                    onToggleItem={(itemId, hide) => void togglePillOnItem(pill, itemId, hide)}
                    onBulkItems={(itemIds, hide) => void bulkPillOnItems(pill, itemIds, hide)}
                  />
                ))}
                {allergyPills.length === 0 && (
                  <MenuEmptyState title="No pills yet">
                    Add the allergies your servers need to flag — Peanut, Gluten, Dairy, Shellfish...
                  </MenuEmptyState>
                )}
              </div>
            </div>
          )}
        </SectionShell>
      )}

      {contentReady && activeTab === 'groups' && (
        <SectionShell
          title="Questions"
          description='Every question the POS can ask, with everything it touches: the items that ask it, the categories that inherit it, and the modifiers it follows up on. A question is shared — edit it once, it updates everywhere; items keep their own overrides (defaults, skip, order).'
        >
          <div className="mb-5 space-y-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-4">
            <div className="grid gap-3 md:grid-cols-[1.6fr_auto_auto]">
              <TextInput value={groupDraft.name} onChange={event => setGroupDraft(prev => ({ ...prev, name: event.target.value }))} placeholder='Question guests are asked, e.g. "Choose a side"' />
              <SmallButton
                variant={groupDraft.is_required ? 'primary' : 'secondary'}
                onClick={() => setGroupDraft(prev => ({ ...prev, is_required: !prev.is_required }))}
              >
                {groupDraft.is_required ? 'Required' : 'Optional'}
              </SmallButton>
              <SmallButton variant="primary" onClick={() => void createGroup()} disabled={busy}>Create question</SmallButton>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-dash-secondary">
              <span>Guest picks at least</span>
              <TextInput inputMode="numeric" className="!w-16 !px-2 !py-1.5 text-center" value={groupDraft.min_selections} onChange={event => setGroupDraft(prev => ({ ...prev, min_selections: cleanDigits(event.target.value) }))} />
              <span>and at most</span>
              <TextInput inputMode="numeric" className="!w-16 !px-2 !py-1.5 text-center" placeholder="∞" value={groupDraft.max_selections} onChange={event => setGroupDraft(prev => ({ ...prev, max_selections: cleanDigits(event.target.value) }))} />
              <span className="text-dash-tertiary">·</span>
              <span>first</span>
              <TextInput inputMode="numeric" className="!w-16 !px-2 !py-1.5 text-center" value={groupDraft.included_count} onChange={event => setGroupDraft(prev => ({ ...prev, included_count: cleanDigits(event.target.value) }))} />
              <span>selections are free, then $</span>
              <TextInput inputMode="decimal" className="!w-20 !px-2 !py-1.5 text-center" placeholder="0.00" value={groupDraft.overage_price} onChange={event => setGroupDraft(prev => ({ ...prev, overage_price: cleanDecimal(event.target.value) }))} />
              <span>each extra</span>
              <span className="text-dash-tertiary">·</span>
              <span>Kitchen hierarchy</span>
              <SelectInput
                className="!w-auto !py-1.5"
                value={groupDraft.kitchen_display_role}
                title="Suggested for this new question; no classification is stored until Create question is clicked"
                onChange={event => setGroupDraft(prev => ({ ...prev, kitchen_display_role: event.target.value }))}
              >
                <option value="">Inherit / legacy</option>
                <option value="ingredient">Ingredient (suggested)</option>
                <option value="side">Side / non-ingredient</option>
              </SelectInput>
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-dash-gold/80">
              {groupRulesSummary({
                is_required: groupDraft.is_required,
                min_selections: groupDraft.min_selections,
                max_selections: groupDraft.max_selections === '' ? null : groupDraft.max_selections,
                included_count: groupDraft.included_count,
                overage_price: groupDraft.overage_price === '' ? null : groupDraft.overage_price,
              })}
            </p>
          </div>

          <div className="space-y-3">
            {groups.map(group => (
              <GroupCard
                key={group.id}
                group={group}
                groups={groups}
                modifiers={modifiers}
                menuItems={mergedItems}
                categories={mergedCategories}
                busy={busy}
                onSave={saveGroup}
                onArchive={archiveGroup}
                onLink={runGroupLink}
                onAddModifiers={ids => void addModifiersToGroup(group, ids)}
                onCreateModifier={draft => void createModifierIntoGroup(group, draft)}
                onToggleCategory={(targetGroup, category, shouldAttach) => void toggleGroupInheritance(targetGroup, category, shouldAttach)}
              />
            ))}
            {groups.length === 0 && (
              <MenuEmptyState title="No modifier groups yet">
                Create a question above, add modifier options to it, and attach it to items — or build questions directly inside an item's editor.
              </MenuEmptyState>
            )}
          </div>
        </SectionShell>
      )}

      {contentReady && (activeTab === 'pricing' || activeTab === 'specials') && (
        <div className="space-y-5">
          {activeTab === 'pricing' && (
            <>
              <BulkPricingPanel restaurantId={restaurantId} canEditPrices={canEditPrices} />
          <SectionShell
            title="Specials"
            description="Overlay a special name, price, and note on a real menu item — the base item keeps its tax, modifiers, and routing. Schedule weekly, by date window, on an N-day cycle, or pin manually."
          >
            {dailySpecialSettings && (
              <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {SPECIAL_SETTING_LABELS.map(([field, label]) => (
                  <button
                    key={field}
                    type="button"
                    disabled={busy}
                    onClick={() => void saveSpecialSettings({ [field]: !dailySpecialSettings[field] })}
                    className={[
                      'rounded-xl border p-4 text-left transition disabled:opacity-50',
                      dailySpecialSettings[field] ? 'border-dash-gold/60 bg-dash-gold/10' : 'border-white/10 bg-white/[0.025] hover:border-white/20',
                    ].join(' ')}
                  >
                    <span className="text-sm font-semibold">{label}</span>
                    <span className="mt-1 block text-xs text-dash-tertiary">{dailySpecialSettings[field] ? 'On' : 'Off'}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
              <div className="space-y-3">
                <p className="label-mono">Current specials</p>
                {specialsError && (
                  <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
                    Specials could not load: {specialsError}
                  </div>
                )}
                {specials.length === 0 && (
                  <MenuEmptyState title="No specials yet">
                    Pin today's special or build a schedule on the right.
                  </MenuEmptyState>
                )}
                {specials.map(special => {
                  const baseItem = mergedItems.find(item => item.id === special.menu_item_id)
                  const isLive = activeSpecials.includes(special)
                  return (
                    <div key={special.id} className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${isLive ? 'bg-amber-200 text-amber-900' : 'bg-white/10 text-dash-tertiary'}`}>
                              {isLive ? 'Live' : 'Scheduled'}
                            </span>
                            <h4 className="font-semibold">{special.display_name || baseItem?.name || 'Daily special'}</h4>
                          </div>
                          <p className="mt-1 text-sm text-dash-secondary">
                            {baseItem?.name || 'Base item'} · {special.schedule_kind === 'weekly'
                              ? `Weekly: ${(special.days_of_week || []).map(day => DAYS_SHORT[day]).join(', ')}`
                              : special.schedule_kind === 'date_window'
                                ? `${special.start_date || '...'} → ${special.end_date || '...'}`
                                : special.schedule_kind === 'cycle'
                                  ? `Every ${special.cycle_length_days} days`
                                  : 'Manual'}
                            {special.start_time ? ` · ${formatTimeLabel(special.start_time)}${special.end_time ? `–${formatTimeLabel(special.end_time)}` : ''}` : ''}
                          </p>
                          {special.note && <p className="mt-1 text-sm text-dash-tertiary">{special.note}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-lg font-semibold">{special.special_price != null ? money(special.special_price) : money(baseItem?.price)}</div>
                          <SelectInput
                            value={special.suggested_tip_basis || 'after_discount'}
                            onChange={event => void updateSpecial(special, { suggested_tip_basis: event.target.value }, localSave(`special:${special.id}:basis`))}
                          >
                            <option value="after_discount">Tips on special price</option>
                            <option value="before_discount">Tips on regular price</option>
                          </SelectInput>
                          <div className="flex gap-2">
                            <SmallButton variant={special.is_active ? 'primary' : 'secondary'} onClick={() => void updateSpecial(special, { is_active: !special.is_active }, localSave(`special:${special.id}:active`))}>
                              {special.is_active ? 'Active' : 'Paused'}
                            </SmallButton>
                            <SmallButton variant="danger" onClick={() => void archiveSpecial(special)}>Archive</SmallButton>
                          </div>
                          <label className="flex items-center gap-2 text-xs text-dash-secondary">
                            <input type="checkbox" checked={special.preserve_gratuity_basis !== false} onChange={event => void updateSpecial(special, { preserve_gratuity_basis: event.target.checked }, localSave(`special:${special.id}:gratuity`))} className="h-4 w-4 accent-dash-gold" />
                            Regular-price gratuity
                          </label>
                          <div className="flex min-h-4 justify-end">
                            <SaveStatus message={saved(`special:${special.id}:basis`) || saved(`special:${special.id}:active`) || saved(`special:${special.id}:gratuity`)} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <p className="label-mono">New special</p>
                <div className="mt-3 space-y-3">
                  <Field label="Base menu item">
                    <SelectInput
                      value={specialDraft.menu_item_id}
                      onChange={event => {
                        const item = mergedItems.find(row => row.id === event.target.value)
                        setSpecialDraft(prev => ({
                          ...prev,
                          menu_item_id: event.target.value,
                          display_name: prev.display_name || item?.name || '',
                          special_price: prev.special_price || (item?.price != null ? String(item.price) : ''),
                        }))
                      }}
                    >
                      <option value="">Choose item...</option>
                      {mergedItems.map(item => <option key={item.id} value={item.id}>{item.name} · {item.category}</option>)}
                    </SelectInput>
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Special name">
                      <TextInput value={specialDraft.display_name} onChange={event => setSpecialDraft(prev => ({ ...prev, display_name: event.target.value }))} placeholder="Tuesday Burger" />
                    </Field>
                    <Field label="Special price">
                      <TextInput inputMode="decimal" value={specialDraft.special_price} onChange={event => setSpecialDraft(prev => ({ ...prev, special_price: cleanDecimal(event.target.value) }))} placeholder="12.00" />
                    </Field>
                  </div>
                  <Field label="Note">
                    <TextInput value={specialDraft.note} onChange={event => setSpecialDraft(prev => ({ ...prev, note: event.target.value }))} placeholder="Blackened mahi, lemon slaw" />
                  </Field>
                  <Field label="Suggested tips">
                    <SelectInput value={specialDraft.suggested_tip_basis} onChange={event => setSpecialDraft(prev => ({ ...prev, suggested_tip_basis: event.target.value }))}>
                      <option value="after_discount">Use special price</option>
                      <option value="before_discount">Use regular price</option>
                    </SelectInput>
                  </Field>
                  <Field label="Schedule">
                    <SelectInput value={specialDraft.schedule_kind} onChange={event => setSpecialDraft(prev => ({ ...prev, schedule_kind: event.target.value }))}>
                      <option value="manual">Manual (pin now, unpin when done)</option>
                      <option value="weekly">Weekly on chosen days</option>
                      <option value="date_window">Date window</option>
                      <option value="cycle">N-day cycle</option>
                    </SelectInput>
                  </Field>
                  {specialDraft.schedule_kind === 'weekly' && (
                    <div className="flex flex-wrap gap-2">
                      {DAYS_SHORT.map((day, index) => (
                        <SmallButton
                          key={day}
                          variant={specialDraft.days_of_week.includes(index) ? 'primary' : 'secondary'}
                          onClick={() => setSpecialDraft(prev => ({
                            ...prev,
                            days_of_week: prev.days_of_week.includes(index)
                              ? prev.days_of_week.filter(value => value !== index)
                              : [...prev.days_of_week, index].sort(),
                          }))}
                        >
                          {day}
                        </SmallButton>
                      ))}
                    </div>
                  )}
                  {specialDraft.schedule_kind === 'date_window' && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Start date"><TextInput type="date" value={specialDraft.start_date} onChange={event => setSpecialDraft(prev => ({ ...prev, start_date: event.target.value }))} /></Field>
                      <Field label="End date"><TextInput type="date" value={specialDraft.end_date} onChange={event => setSpecialDraft(prev => ({ ...prev, end_date: event.target.value }))} /></Field>
                    </div>
                  )}
                  {specialDraft.schedule_kind === 'cycle' && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label="Anchor date"><TextInput type="date" value={specialDraft.cycle_anchor_date} onChange={event => setSpecialDraft(prev => ({ ...prev, cycle_anchor_date: event.target.value }))} /></Field>
                      <Field label="Cycle days"><TextInput inputMode="numeric" value={specialDraft.cycle_length_days} onChange={event => setSpecialDraft(prev => ({ ...prev, cycle_length_days: cleanDigits(event.target.value) }))} /></Field>
                      <Field label="Special day"><TextInput inputMode="numeric" value={specialDraft.cycle_day_number} onChange={event => setSpecialDraft(prev => ({ ...prev, cycle_day_number: cleanDigits(event.target.value) }))} /></Field>
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Start time"><SmartTimeInput ariaLabel="Special start time" value={specialDraft.start_time} onChange={value => setSpecialDraft(prev => ({ ...prev, start_time: value }))} /></Field>
                    <Field label="End time"><SmartTimeInput ariaLabel="Special end time" value={specialDraft.end_time} onChange={value => setSpecialDraft(prev => ({ ...prev, end_time: value }))} /></Field>
                  </div>
                  <Field label="Expires (optional)">
                    <SmartDateTimeInput ariaLabel="Special expiration" value={specialDraft.expires_at} onChange={value => setSpecialDraft(prev => ({ ...prev, expires_at: value }))} />
                  </Field>
                  <label className="flex min-h-11 items-center gap-3 rounded-md border border-white/10 px-3 text-sm text-dash-primary">
                    <input type="checkbox" checked={specialDraft.preserve_gratuity_basis} onChange={event => setSpecialDraft(prev => ({ ...prev, preserve_gratuity_basis: event.target.checked }))} className="h-4 w-4 accent-dash-gold" />
                    <span>Calculate gratuity using the regular price</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <SmallButton onClick={() => setSpecialDraft(defaultSpecialDraft())} disabled={busy}>Cancel</SmallButton>
                    <SmallButton variant="primary" onClick={() => void createSpecial()} disabled={busy}>Save special</SmallButton>
                  </div>
                </div>
              </div>
            </div>
          </SectionShell>
            </>
          )}

          {activeTab === 'specials' && (
          <SectionShell
            title="Item Availability Schedule"
            description="Limit when regular items appear on the POS — brunch-only dishes, seasonal plates, late-night menus. Full editor lives inside each item."
          >
            {mergedCategories.some(category => category.availability_mode === 'schedule') && (
              <div className="mb-5 space-y-2">
                <p className="label-mono">Categories with visible hours</p>
                {mergedCategories.filter(category => category.availability_mode === 'schedule').map(category => (
                  <div key={category.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-sm">
                    <div>
                      <span className="font-medium text-dash-cream">{category.name}</span>
                      <span className="ml-2 text-dash-tertiary">
                        {(Array.isArray(category.availability_days) && category.availability_days.length > 0 && category.availability_days.length < 7
                          ? category.availability_days.map(day => DAYS_SHORT[day]).join(', ')
                          : 'Every day')}
                        {category.availability_start_time ? ` · ${formatTimeLabel(category.availability_start_time)}–${category.availability_end_time ? formatTimeLabel(category.availability_end_time) : 'close'}` : ''}
                      </span>
                    </div>
                    <SmallButton onClick={() => jumpToCategory(category.name)}>Edit category →</SmallButton>
                  </div>
                ))}
              </div>
            )}
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-2">
                <p className="label-mono">Items with schedules</p>
                {scheduledItems.length === 0 && (
                  <MenuEmptyState title="Everything is always available">
                    Open an item (or pick one on the right) to give it a weekly or seasonal window.
                  </MenuEmptyState>
                )}
                {scheduledItems.map(item => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-sm">
                    <div>
                      <span className="font-medium text-dash-cream">{item.name}</span>
                      <span className="ml-2 text-dash-tertiary">
                        {item.availability_mode === 'schedule'
                          ? `Weekly: ${(item.availability_days || []).map(day => DAYS_SHORT[day]).join(', ')}${item.availability_start_time ? ` · ${formatTimeLabel(item.availability_start_time)}–${item.availability_end_time ? formatTimeLabel(item.availability_end_time) : 'close'}` : ''}`
                          : item.availability_mode === 'seasonal'
                            ? `${item.availability_start_date || '...'} → ${item.availability_end_date || '...'}`
                            : 'Manual only'}
                      </span>
                    </div>
                    <SmallButton onClick={() => { setActiveTab('items'); setSelectedItemId(item.id) }}>Edit item</SmallButton>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <p className="label-mono">Jump to an item</p>
                <div className="mt-3 space-y-3">
                  <SelectInput value={scheduleItemId} onChange={event => setScheduleItemId(event.target.value)}>
                    <option value="">Choose item...</option>
                    {mergedItems.map(item => <option key={item.id} value={item.id}>{item.name} · {item.category}</option>)}
                  </SelectInput>
                  <SmallButton
                    variant="primary"
                    disabled={!scheduleItemId}
                    onClick={() => {
                      setActiveTab('items')
                      setSelectedItemId(scheduleItemId)
                    }}
                  >
                    Open availability editor
                  </SmallButton>
                </div>
              </div>
            </div>
          </SectionShell>
          )}
        </div>
      )}

      {propagationRequest && portfolio && (
        <PropagationModal
          request={propagationRequest}
          restaurants={portfolio.restaurants}
          groups={portfolio.groups}
          sourceRestaurantId={restaurantId}
          onCancel={() => closePropagationModal(null)}
          onApply={closePropagationModal}
        />
      )}

      {contentReady && activeTab === 'printing' && (
        <div className="space-y-5">
          <SectionShell
            title="Stations & Printers"
            description="Items choose a prep station. Each station sends its tickets to the printer or KDS display attached here."
          >
            {routing?.fallback && (
              <div className={`mb-4 rounded-xl border p-3 text-sm ${routing.fallback.ok ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100' : 'border-red-400/20 bg-red-400/10 text-red-200'}`}>
                {routing.fallback.ok ? 'Fallback station is ready — kitchen send is unblocked.' : routing.fallback.reason || 'Configure a fallback station with an active printer to unblock kitchen send.'}
              </div>
            )}
            <div className="grid gap-4 lg:grid-cols-2">
              <StationsEditor stations={stations} busy={busy} onCreate={createStation} />
              <TargetsEditor targets={routing?.targets || []} stations={stations} busy={busy} onCreate={createTarget} onAssign={assignTarget} />
            </div>
          </SectionShell>

          <SectionShell
            title="Category Printing Defaults"
            description="Choose a prep station for the category, or choose No kitchen ticket when the entire category should never print."
          >
            <div className="space-y-2">
              {categoryNames.map(name => {
                const category = categoriesByName[name]
                const productionRouting = categoryProductionRouting(name)
                return (
                  <div key={name} className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3 lg:grid-cols-[1fr_1fr] lg:items-center">
                    <div>
                      <span className="flex items-center gap-2 text-sm font-medium text-dash-cream">
                        {category?.color && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />}
                        {name}
                      </span>
                      <p className="mt-1 text-xs text-dash-tertiary">{productionRouting.description}</p>
                    </div>
                    <div>
                      <SelectInput
                        value={productionRouting.value}
                        onChange={event => {
                          if (event.target.value === ROUTE_MULTI_VALUE) return
                          void routeCategory(name, event.target.value)
                        }}
                      >
                        <option value={ROUTE_INHERIT_VALUE}>Use restaurant fallback</option>
                        <option value={ROUTE_NO_PRODUCTION_VALUE}>No kitchen ticket</option>
                        {productionRouting.value === ROUTE_MULTI_VALUE && <option value={ROUTE_MULTI_VALUE}>Multiple stations</option>}
                        {routableStations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}
                      </SelectInput>
                      <div className="mt-1 flex justify-end">
                        <SaveStatus message={saved(`route:category:${name}`)} />
                      </div>
                    </div>
                  </div>
                )
              })}
              {categoryNames.length === 0 && (
                <MenuEmptyState title="No categories yet">
                  Create categories first, then route them to stations here.
                </MenuEmptyState>
              )}
            </div>
          </SectionShell>

          <SectionShell
            title="Item Printing Rules"
            description="Items normally follow their category. Choose No kitchen ticket or a different prep station only when an item is an exception."
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="min-w-64 flex-1">
              <TextInput value={routingItemSearch} onChange={event => setRoutingItemSearch(event.target.value)} placeholder="Search items..." />
              </div>
              <SmallButton onClick={() => setShowAllRoutingItems(value => !value)}>{showAllRoutingItems ? 'Show exceptions only' : 'Show all items'}</SmallButton>
            </div>
            <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
              {routingItems.map(item => {
                const productionRouting = itemProductionRouting(item)
                return (
                  <div key={item.id} className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3 lg:grid-cols-[1.4fr_1fr_1fr] lg:items-center">
                    <div className="text-sm">
                      <span className="font-medium text-dash-cream">{item.name}</span>
                      <span className="ml-2 text-xs text-dash-tertiary">{item.category}</span>
                    </div>
                    <span className="text-sm text-dash-tertiary">
                      {productionRouting.description}
                    </span>
                    <div>
                      <SelectInput
                        value={productionRouting.value}
                        onChange={event => {
                          if (event.target.value === ROUTE_MULTI_VALUE) return
                          void routeItemProduction(item, event.target.value)
                        }}
                      >
                        <option value={ROUTE_INHERIT_VALUE}>Automatic · category or restaurant fallback</option>
                        <option value={ROUTE_NO_PRODUCTION_VALUE}>No kitchen ticket</option>
                        {productionRouting.value === ROUTE_MULTI_VALUE && <option value={ROUTE_MULTI_VALUE}>Multiple stations</option>}
                        {routableStations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}
                      </SelectInput>
                      <div className="mt-1 flex justify-end">
                        <SaveStatus message={saved(`route:item:${item.id}`)} />
                      </div>
                    </div>
                  </div>
                )
              })}
              {routingItems.length === 0 && <MenuEmptyState title={routingItemSearch ? 'No matching items' : 'No item-specific routes'}>{routingItemSearch ? 'Try another item or category name.' : 'All items are using their category or the restaurant fallback automatically.'}</MenuEmptyState>}
            </div>
          </SectionShell>
        </div>
      )}
    </div>
  )
}

// ── Modifier list row ───────────────────────────────────────────────────────

function ModifierRowField({ label, children, status }) {
  return (
    <div className="min-w-0">
      <span className="mb-1.5 flex min-h-4 items-center justify-between gap-2">
        <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-dash-tertiary">{label}</span>
        {status !== undefined && <SaveStatus message={status} />}
      </span>
      {children}
    </div>
  )
}

function ModifierRow({ modifier, menuItems, taxRates, reportingCategories, kitchenAlias, askedByGroups = [], allGroups = [], onAddToQuestion = null, busy, statusFor = () => '', onRename, onReprice, onRecategorize, onSetTaxRate, onSetReportingCategory, onSetPrint, onSetKitchenRole, onReplaceItems, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const selectedIds = useMemo(() => new Set(modifier.item_ids || []), [modifier])
  const neverPrints = modifier.print_on_kitchen_ticket === false
  const askedByIds = useMemo(() => new Set(askedByGroups.map(group => group.id)), [askedByGroups])
  const attachableQuestions = allGroups.filter(group => !askedByIds.has(group.id))

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 2xl:items-end">
        <ModifierRowField label="Modifier name" status={statusFor('name')}>
          <TextInput
            aria-label="Modifier name"
            className="min-w-0"
            defaultValue={modifier.name}
            onBlur={event => {
              const next = event.target.value.trim()
              if (next && next !== modifier.name) onRename(next)
            }}
          />
        </ModifierRowField>
        <ModifierRowField label="Price adjustment" status={statusFor('price')}>
          <TextInput
            aria-label="Price adjustment"
            className="min-w-0"
            inputMode="decimal"
            defaultValue={modifier.price_delta != null ? String(modifier.price_delta) : '0'}
            onBlur={event => {
              const next = Number(cleanDecimal(event.target.value)) || 0
              if (next !== Number(modifier.price_delta)) onReprice(next)
            }}
          />
        </ModifierRowField>
        <ModifierRowField label="Modifier category" status={statusFor('category')}>
          <TextInput
            aria-label="Modifier category"
            className="min-w-0"
            list="menu-modifier-categories"
            title="Category — type a new name to create one"
            defaultValue={modifierCategoryOf(modifier)}
            onBlur={event => {
              const next = event.target.value.trim() || 'Add-ons'
              if (next !== modifierCategoryOf(modifier)) onRecategorize(next)
            }}
          />
        </ModifierRowField>
        <ModifierRowField label="Tax rate" status={statusFor('tax')}>
          <SelectInput
            aria-label="Modifier tax rate"
            className="min-w-0"
            title="Tax this modifier's charge at its own rate instead of the item's"
            value={modifier.tax_rate_id || ''}
            onChange={event => onSetTaxRate(event.target.value || null)}
          >
            <option value="">Follows item</option>
            {taxRates.map(rate => (
              <option key={rate.id} value={rate.id}>{rate.name} · {Number(rate.rate)}%</option>
            ))}
          </SelectInput>
        </ModifierRowField>
        <ModifierRowField label="Sales category" status={statusFor('sales')}>
          <SelectInput
            aria-label="Modifier sales category"
            className="min-w-0"
            title="Report this modifier's sales under its own department instead of the item's"
            value={modifier.reporting_category_id || ''}
            onChange={event => onSetReportingCategory(event.target.value || null)}
          >
            <option value="">Item's category</option>
            {reportingCategories.map(category => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </SelectInput>
        </ModifierRowField>
        <ModifierRowField label="Kitchen hierarchy" status={statusFor('kitchen')}>
          <SelectInput
            aria-label="Modifier kitchen hierarchy"
            className="min-w-0"
            title="Legacy fallback used only when the group and item do not override it"
            value={modifier.kitchen_display_role || ''}
            onChange={event => onSetKitchenRole(event.target.value || null)}
          >
            <option value="">Hierarchy: inherit</option>
            <option value="ingredient">Ingredient</option>
            <option value="side">Side / non-ingredient</option>
          </SelectInput>
        </ModifierRowField>
        <ModifierRowField label="Kitchen ticket" status={statusFor('print')}>
          <SmallButton
            variant={neverPrints ? 'primary' : 'secondary'}
            title={neverPrints
              ? 'Hidden from kitchen tickets everywhere it’s used — click to print again'
              : 'Prints on kitchen tickets — click to never print it (e.g. FOH-only notes, upsells the kitchen doesn’t need)'}
            onClick={() => onSetPrint(neverPrints)}
          >
            {neverPrints ? 'Never prints' : 'Prints'}
          </SmallButton>
        </ModifierRowField>
        <ModifierRowField label="Applied items" status={statusFor('items')}>
          <span className="flex min-h-10 items-center rounded-xl border border-white/10 bg-white/[0.025] px-3 text-sm text-dash-tertiary">
            {(modifier.item_ids || []).length} item{(modifier.item_ids || []).length === 1 ? '' : 's'}
          </span>
        </ModifierRowField>
        <ModifierRowField label="Ticket name">
          <a href="./printing-routing#receipts" className="flex min-h-10 items-center justify-center rounded-lg border border-dash-gold/25 bg-dash-gold/10 px-2 py-2 text-center text-xs font-semibold text-dash-gold" title="Open Receipts & Tickets">{kitchenAlias || 'Full name'}</a>
        </ModifierRowField>
        <ModifierRowField label="Actions">
          <div className="flex flex-wrap gap-2">
            <SmallButton onClick={() => setExpanded(current => !current)}>{expanded ? 'Close' : 'Items'}</SmallButton>
            <SmallButton variant="danger" onClick={onDelete} disabled={busy}>Remove</SmallButton>
          </div>
        </ModifierRowField>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {askedByGroups.length > 0 ? (
          <>
            <span className="text-dash-tertiary">Asked by:</span>
            {askedByGroups.map(group => (
              <span key={group.id} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-dash-secondary">{group.name}</span>
            ))}
          </>
        ) : (
          <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 font-semibold text-amber-200" title="This modifier is in no question, so the POS never offers it to guests — attach it to one.">
            ⚠ Not asked by any question
          </span>
        )}
        {onAddToQuestion && attachableQuestions.length > 0 && (
          <SelectInput
            className="!w-auto !py-1 !text-xs"
            value=""
            title="Add this modifier as an answer in a question (and attach the question to this modifier's items)"
            onChange={event => {
              const group = attachableQuestions.find(candidate => candidate.id === event.target.value)
              if (group) onAddToQuestion(group)
            }}
          >
            <option value="">{askedByGroups.length > 0 ? 'also add to question…' : 'add to question…'}</option>
            {attachableQuestions.map(group => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </SelectInput>
        )}
      </div>
      {expanded && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <ItemChecklist
            menuItems={menuItems}
            selectedIds={selectedIds}
            onToggle={itemId => {
              const next = selectedIds.has(itemId)
                ? (modifier.item_ids || []).filter(id => id !== itemId)
                : [...(modifier.item_ids || []), itemId]
              onReplaceItems(next)
            }}
            onBulk={(itemIds, shouldSelect) => {
              const next = new Set(modifier.item_ids || [])
              for (const itemId of itemIds) {
                if (shouldSelect) next.add(itemId)
                else next.delete(itemId)
              }
              onReplaceItems(Array.from(next))
            }}
          />
        </div>
      )}
    </div>
  )
}

// One allergy pill: rename, hide-everywhere toggle, and per-item narrowing
// (checked = servers see the pill on that item; unchecked = hidden there).
function AllergyPillRow({ pill, menuItems, hiddenItemIds, busy, statusFor = () => '', onRename, onToggle, onToggleItem, onBulkItems }) {
  const [expanded, setExpanded] = useState(false)
  const shownIds = useMemo(
    () => new Set(menuItems.filter(item => !hiddenItemIds.has(item.id)).map(item => item.id)),
    [menuItems, hiddenItemIds],
  )
  const hiddenCount = hiddenItemIds.size

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-56">
          <div className="mb-1 flex min-h-4 justify-end">
            <SaveStatus message={statusFor('name')} />
          </div>
          <TextInput
            defaultValue={pill.name}
            onBlur={event => {
              const next = event.target.value.trim()
              if (next && next !== pill.name) onRename(next)
            }}
          />
        </div>
        <div>
          <div className="mb-1 flex min-h-4 justify-end">
            <SaveStatus message={statusFor('active')} />
          </div>
          <SmallButton
            variant={pill.is_available === false ? 'danger' : 'secondary'}
            title={pill.is_available === false ? 'Hidden on every item — tap to restore' : 'Hide this pill everywhere without deleting it'}
            onClick={onToggle}
          >
            {pill.is_available === false ? 'Hidden — restore' : 'Active'}
          </SmallButton>
        </div>
        <span className="text-sm text-dash-tertiary">
          {hiddenCount === 0 ? 'On all items' : `Hidden on ${hiddenCount} item${hiddenCount === 1 ? '' : 's'}`}
        </span>
        <span className="flex-1" />
        <div>
          <div className="mb-1 flex min-h-4 justify-end">
            <SaveStatus message={statusFor('items')} />
          </div>
          <SmallButton onClick={() => setExpanded(current => !current)} disabled={busy}>
            {expanded ? 'Close' : 'Narrow by item'}
          </SmallButton>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <p className="mb-2 text-xs text-dash-tertiary">Checked = servers can flag {pill.name} on that item. Uncheck to hide it there.</p>
          <ItemChecklist
            menuItems={menuItems}
            selectedIds={shownIds}
            onToggle={itemId => onToggleItem(itemId, shownIds.has(itemId))}
            onBulk={(itemIds, shouldSelect) => onBulkItems(itemIds, !shouldSelect)}
          />
        </div>
      )}
    </div>
  )
}

// ── Printing sub-editors ────────────────────────────────────────────────────

function StationsEditor({ stations, busy, onCreate }) {
  const [name, setName] = useState('')
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
      <h4 className="text-sm font-semibold">Stations</h4>
      <div className="mt-3 flex gap-2">
        <TextInput value={name} onChange={event => setName(event.target.value)} placeholder="Grill, Fry, Bar, Expo" />
        <SmallButton
          variant="primary"
          disabled={!name.trim() || busy}
          onClick={() => {
            onCreate(name.trim())
            setName('')
          }}
        >
          Add
        </SmallButton>
      </div>
      <div className="mt-4 space-y-2">
        {stations.map(station => (
          <div key={station.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm">
            <span>{station.name}</span>
            {station.is_fallback && <span className="rounded-full bg-dash-gold/15 px-2 py-0.5 text-[11px] font-semibold text-dash-gold">Fallback</span>}
          </div>
        ))}
        {stations.length === 0 && <p className="text-sm text-dash-tertiary">No stations yet — add Grill, Fry, Bar...</p>}
      </div>
    </section>
  )
}

function TargetsEditor({ targets, stations, busy, onCreate, onAssign }) {
  const [name, setName] = useState('Kitchen Printer')
  const [host, setHost] = useState('')
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
      <h4 className="text-sm font-semibold">Printers & Displays</h4>
      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
        <TextInput value={name} onChange={event => setName(event.target.value)} placeholder="Printer name" />
        <TextInput value={host} onChange={event => setHost(event.target.value)} placeholder="Host/IP (blank = test)" />
        <SmallButton
          variant="primary"
          disabled={busy}
          onClick={() => {
            onCreate(name.trim(), host.trim())
            setHost('')
          }}
        >
          Add
        </SmallButton>
      </div>
      <div className="mt-4 space-y-2">
        {targets.map(target => (
          <div key={target.id} className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm md:grid-cols-[1fr_auto] md:items-center">
            <span>{target.name} · {target.connection_type}</span>
            <SelectInput defaultValue="" onChange={event => event.target.value && onAssign(event.target.value, target.id)}>
              <option value="">Attach to station...</option>
              {stations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}
            </SelectInput>
          </div>
        ))}
        {targets.length === 0 && <p className="text-sm text-dash-tertiary">No printers yet — add one, then attach it to a station.</p>}
      </div>
    </section>
  )
}

export default MenuPanel
