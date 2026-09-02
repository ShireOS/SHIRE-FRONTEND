import { useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../../shared/lib/supabase'
import { API_CONFIG } from '../../shared/api/config'
import type { MenuEditorItem } from './MenuItemsTable'
import { collapseEntryWhitespace, duplicateName, numberRangeError, sanitizeMoneyInput } from '@shire/settings'
import {
  addGroupOption,
  archiveModifierGroup,
  createModifierGroup,
  fetchModifierGroups,
  removeGroupOption,
  replaceGroupItems,
  updateGroupOption,
  updateModifierGroup,
} from '../../dashboard/data/menuGroups'

// ── Types ──────────────────────────────────────────────────────────────────
//
// This editor writes the "questions" model the POS actually prompts from:
// menu_modifier_groups (rules) + menu_modifier_group_options (answers) +
// menu_modifier_group_items (which items ask). Modifiers themselves are just
// answer rows (name + price) created through the ML API.

interface EditorOption {
  localId: string
  modifierId: string | null   // saved menu_modifiers id
  linkedToGroup: boolean      // modifier row and question link are separate writes
  name: string
  priceDelta: string          // controlled input, parsed on save
  isDefault: boolean
  printOnKitchenTicket: boolean
}

interface EditorQuestion {
  localId: string
  groupId: string | null      // saved menu_modifier_groups id
  name: string
  isRequired: boolean
  minSelections: string
  maxSelections: string
  includedCount: string       // first N selections free
  overagePrice: string        // $ per selection past the free count
  options: EditorOption[]
  removedOptionIds: string[]  // saved modifier ids detached on save
  itemIds: Set<string>
}

interface ModifierEditorProps {
  restaurantId: string
  menuItems: MenuEditorItem[]   // items saved in previous step
  onBack: () => void
  onDone: () => void            // advance onboarding
}

// ── API helpers ────────────────────────────────────────────────────────────

const getToken = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? `Bearer ${session.access_token}` : ''
}

const modifiersBase = (restaurantId: string) =>
  `${API_CONFIG.baseUrl}/restaurants/${restaurantId}/menu/modifiers`

const blankOption = (): EditorOption => ({
  localId: crypto.randomUUID(),
  modifierId: null,
  linkedToGroup: false,
  name: '',
  priceDelta: '',
  isDefault: false,
  printOnKitchenTicket: true,
})

const blankQuestion = (): EditorQuestion => ({
  localId: crypto.randomUUID(),
  groupId: null,
  name: '',
  isRequired: false,
  minSelections: '0',
  maxSelections: '',
  includedCount: '0',
  overagePrice: '',
  options: [blankOption()],
  removedOptionIds: [],
  itemIds: new Set(),
})

const digits = (value: string) => value.replace(/\D/g, '').slice(0, 2)
const decimal = sanitizeMoneyInput

const responseError = async (response: Response, fallback: string) => {
  let detail = ''
  try {
    const payload = await response.json()
    detail = typeof payload?.detail === 'string' ? payload.detail : payload?.detail?.message || payload?.message || ''
  } catch {
    // Non-JSON failures still surface the endpoint and status below.
  }
  return new Error(detail || `${fallback} (${response.status})`)
}

// ── Main component ─────────────────────────────────────────────────────────

export function ModifierEditor({ restaurantId, menuItems, onBack, onDone }: ModifierEditorProps) {
  const [questions, setQuestions] = useState<EditorQuestion[]>([])
  const [removedGroupIds, setRemovedGroupIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [popupFor, setPopupFor] = useState<string | null>(null) // localId of open popup

  // Load existing questions + their answers on mount (survive back-navigation).
  // A failed modifier read must never masquerade as a genuinely empty menu.
  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
        const token = await getToken()
        const [groups, modifiersRes] = await Promise.all([
          fetchModifierGroups(restaurantId),
          fetch(modifiersBase(restaurantId), { headers: { Authorization: token } }),
        ])
        if (!modifiersRes.ok) throw await responseError(modifiersRes, 'Could not load modifiers')
        const modifierRows: any[] = await modifiersRes.json()
        const modifiersById = new Map(modifierRows.map(row => [String(row.id), row]))
        setQuestions(groups
          // Allergy questions are managed by their own surface, not here.
          .filter(group => group.type !== 'allergy')
          .map(group => ({
            localId: group.id,
            groupId: group.id,
            name: group.name,
            isRequired: Boolean(group.is_required),
            minSelections: String(group.min_selections ?? 0),
            maxSelections: group.max_selections == null ? '' : String(group.max_selections),
            includedCount: String(group.included_count ?? 0),
            overagePrice: group.overage_price == null ? '' : String(group.overage_price),
            options: group.options.map(option => {
              const modifier = modifiersById.get(String(option.modifier_id))
              return {
                localId: option.modifier_id,
                modifierId: option.modifier_id,
                linkedToGroup: true,
                name: modifier?.name ?? 'Modifier',
                priceDelta: modifier && Number(modifier.price_delta) > 0 ? String(modifier.price_delta) : '',
                isDefault: Boolean(option.is_default),
                printOnKitchenTicket: modifier ? modifier.print_on_kitchen_ticket !== false : true,
              }
            }),
            removedOptionIds: [],
            itemIds: new Set(group.item_ids),
          })))
        setRemovedGroupIds(new Set())
    } catch (loadFailure) {
      setLoadError(loadFailure instanceof Error ? loadFailure.message : 'Could not load modifier questions.')
    } finally {
      setLoading(false)
    }
  }, [restaurantId])

  useEffect(() => {
    void load()
  }, [load])

  const updateQuestion = useCallback((localId: string, patch: Partial<Omit<EditorQuestion, 'localId' | 'groupId' | 'options' | 'itemIds'>>) => {
    setQuestions(prev => prev.map(q => q.localId === localId ? { ...q, ...patch } : q))
  }, [])

  const updateOption = useCallback((questionId: string, optionId: string, patch: Partial<Omit<EditorOption, 'localId'>>) => {
    setQuestions(prev => prev.map(q => q.localId === questionId
      ? { ...q, options: q.options.map(o => o.localId === optionId ? { ...o, ...patch } : o) }
      : q))
  }, [])

  const addOption = (questionId: string) => {
    setQuestions(prev => prev.map(q => q.localId === questionId ? { ...q, options: [...q.options, blankOption()] } : q))
  }

  const removeOption = (questionId: string, optionId: string) => {
    setQuestions(prev => prev.map(q => {
      if (q.localId !== questionId) return q
      const option = q.options.find(o => o.localId === optionId)
      return {
        ...q,
        options: q.options.filter(o => o.localId !== optionId),
        removedOptionIds: option?.modifierId && option.linkedToGroup ? [...q.removedOptionIds, option.modifierId] : q.removedOptionIds,
      }
    }))
  }

  const removeQuestion = (localId: string) => {
    const question = questions.find(q => q.localId === localId)
    if (question?.groupId) {
      setRemovedGroupIds(ids => new Set(ids).add(question.groupId as string))
    }
    setQuestions(prev => prev.filter(q => q.localId !== localId))
  }

  const setItemIds = useCallback((localId: string, ids: Set<string>) => {
    setQuestions(prev => prev.map(q => q.localId === localId ? { ...q, itemIds: new Set(ids) } : q))
  }, [])

  const handleSave = async () => {
    const drafted = questions.filter(question => (
      question.name.trim()
      || question.options.some(option => option.name.trim())
      || question.groupId
    ))
    const names = drafted.map(question => collapseEntryWhitespace(question.name))
    const blankQuestionIndex = names.findIndex(name => !name)
    if (blankQuestionIndex >= 0) {
      setError(`Question ${blankQuestionIndex + 1} needs a name.`)
      return
    }
    const duplicateQuestionIndex = names.findIndex((name, index) => duplicateName(names, name, index))
    if (duplicateQuestionIndex >= 0) {
      setError(`“${names[duplicateQuestionIndex]}” is already in the question list.`)
      return
    }
    for (const question of drafted) {
      const answerNames = question.options.map(option => collapseEntryWhitespace(option.name)).filter(Boolean)
      if (answerNames.length === 0) {
        setError(`“${question.name}” needs at least one answer.`)
        return
      }
      const duplicateAnswerIndex = answerNames.findIndex((name, index) => duplicateName(answerNames, name, index))
      if (duplicateAnswerIndex >= 0) {
        setError(`“${duplicateAnswerIndex >= 0 ? answerNames[duplicateAnswerIndex] : ''}” appears more than once in “${question.name}”.`)
        return
      }
      const minError = numberRangeError(question.minSelections, `${question.name} minimum selections`, { required: true, min: question.isRequired ? 1 : 0, max: 99, integer: true })
      const maxError = numberRangeError(question.maxSelections, `${question.name} maximum selections`, { min: 0, max: 99, integer: true })
      const includedError = numberRangeError(question.includedCount, `${question.name} included selections`, { required: true, min: 0, max: 99, integer: true })
      const overageError = numberRangeError(question.overagePrice, `${question.name} overage price`, { min: 0 })
      if (minError || maxError || includedError || overageError) {
        setError(minError || maxError || includedError || overageError)
        return
      }
      const min = Number(question.minSelections)
      const max = question.maxSelections === '' ? null : Number(question.maxSelections)
      const included = Number(question.includedCount)
      if (max != null && max < min) {
        setError(`${question.name} maximum selections cannot be below its minimum.`)
        return
      }
      if (max != null && included > max) {
        setError(`${question.name} cannot include more free selections than its maximum.`)
        return
      }
      const defaultCount = question.options.filter(option => option.name.trim() && option.isDefault).length
      if (max != null && defaultCount > max) {
        setError(`${question.name} has more default answers than its maximum selections.`)
        return
      }
      const invalidPrice = question.options.find(option => option.name.trim() && numberRangeError(option.priceDelta, `${option.name} price`, { min: 0 }))
      if (invalidPrice) {
        setError(numberRangeError(invalidPrice.priceDelta, `${invalidPrice.name} price`, { min: 0 }))
        return
      }
    }
    const valid = drafted
    setSaving(true)
    setError(null)
    try {
      const token = await getToken()
      const headers = { 'Content-Type': 'application/json', Authorization: token }

      for (const [index, question] of valid.entries()) {
        const minSelections = Number(question.minSelections)
        const groupDraft = {
          name: question.name.trim(),
          min_selections: minSelections,
          max_selections: question.maxSelections === '' ? null : Number(question.maxSelections),
          is_required: question.isRequired,
          prompt_on_order: true,
          included_count: Number(question.includedCount) || 0,
          overage_price: question.overagePrice === '' ? null : Number(question.overagePrice),
          display_order: index,
        }
        const group = question.groupId
          ? await updateModifierGroup(question.groupId, groupDraft)
          : await createModifierGroup(restaurantId, groupDraft)
        if (!question.groupId) {
          // Save progress after each successful write. A later answer failure
          // can then retry this group instead of creating a duplicate group.
          setQuestions(prev => prev.map(candidate => (
            candidate.localId === question.localId ? { ...candidate, groupId: group.id } : candidate
          )))
        }

        let optionOrder = 0
        for (const option of question.options) {
          if (option.name.trim() === '') continue
          const priceDelta = parseFloat(option.priceDelta) || 0
          let modifierId = option.modifierId
          if (!option.modifierId) {
            // New answer: create the modifier, then add it to the question.
            const res = await fetch(modifiersBase(restaurantId), {
              method: 'POST',
              headers,
              body: JSON.stringify({
                name: option.name.trim(),
                price_delta: priceDelta,
                group_name: question.name.trim() || 'Add-ons',
                print_on_kitchen_ticket: option.printOnKitchenTicket,
                is_active: true,
              }),
            })
            if (!res.ok) throw await responseError(res, `Failed to create "${option.name}"`)
            const created: { id: string } = await res.json()
            modifierId = created.id
            // Preserve the created modifier id even if the separate link write
            // fails. The retry can link this row instead of cloning it.
            updateOption(question.localId, option.localId, { modifierId, linkedToGroup: false })
          } else {
            const response = await fetch(`${modifiersBase(restaurantId)}/${option.modifierId}`, {
              method: 'PUT',
              headers,
              body: JSON.stringify({
                name: option.name.trim(),
                price_delta: priceDelta,
                group_name: question.name.trim() || 'Add-ons',
                print_on_kitchen_ticket: option.printOnKitchenTicket,
              }),
            })
            if (!response.ok) throw await responseError(response, `Failed to update "${option.name}"`)
          }
          if (!modifierId) throw new Error(`Modifier "${option.name}" did not return an id.`)
          if (option.linkedToGroup) {
            await updateGroupOption(group.id, modifierId, { is_default: option.isDefault, display_order: optionOrder })
          } else {
            await addGroupOption(group.id, modifierId, { is_default: option.isDefault, display_order: optionOrder })
            updateOption(question.localId, option.localId, { modifierId, linkedToGroup: true })
          }
          optionOrder += 1
        }

        // Answers removed with the ✕ leave the question; the modifier row
        // stays in the library for reuse.
        for (const modifierId of question.removedOptionIds) {
          await removeGroupOption(group.id, modifierId)
        }

        await replaceGroupItems(group.id, Array.from(question.itemIds))
      }

      for (const groupId of removedGroupIds) {
        await archiveModifierGroup(groupId)
      }

      setRemovedGroupIds(new Set())
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const validCount = questions.filter(q => q.name.trim() !== '' && q.options.some(o => o.name.trim() !== '')).length
  const popupQuestion = questions.find(q => q.localId === popupFor) ?? null

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[rgb(var(--gold))]" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-[70vh]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          disabled={saving}
          className="flex items-center gap-2 text-sm text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] disabled:opacity-40 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="text-center">
          <h2 className="text-[rgb(var(--text-primary))] font-semibold text-sm">Modifier Questions</h2>
          <p className="text-[rgb(var(--text-tertiary))] text-xs mt-0.5">
            Questions the POS asks — "Choose a side", "Temperature?" — with the answers guests pick from
          </p>
        </div>

        <button
          data-onboarding-save
          onClick={() => void handleSave()}
          disabled={saving || Boolean(loadError)}
          className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors"
        >
          {saving ? 'Saving…' : validCount > 0 || removedGroupIds.size > 0 ? 'Save & Continue' : 'Skip'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loadError && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          <span>{loadError} Nothing was changed; retry the read before saving.</span>
          <button
            type="button"
            onClick={() => void load()}
            className="shrink-0 rounded-lg border border-red-400/30 px-3 py-1.5 font-medium hover:bg-red-500/10"
          >
            Retry
          </button>
        </div>
      )}

      {questions.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)] py-16 text-[rgb(var(--text-tertiary))]">
          <svg className="w-8 h-8 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <p className="text-sm">No questions yet — add one below</p>
        </div>
      )}

      {/* Question cards */}
      <div className="flex-1 space-y-4">
        {questions.map(question => {
          const assignedCount = question.itemIds.size
          return (
            <div key={question.localId} className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)] p-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={question.name}
                  onChange={e => updateQuestion(question.localId, { name: e.target.value })}
                  disabled={saving}
                  placeholder='Question, e.g. "Choose a side"'
                  className="min-w-56 flex-1 px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-sm text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-tertiary))] focus:outline-none focus:border-[rgba(201,169,98,0.4)] transition-colors disabled:opacity-50"
                />
                <ToggleChip active={question.isRequired} disabled={saving} onClick={() => updateQuestion(question.localId, { isRequired: !question.isRequired })}>
                  Required
                </ToggleChip>
                <button
                  onClick={() => setPopupFor(question.localId)}
                  disabled={saving}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    assignedCount > 0
                      ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                      : 'bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.1)] text-[rgb(var(--text-tertiary))] hover:border-[rgba(201,169,98,0.3)] hover:text-[rgb(var(--gold))]'
                  } disabled:opacity-50`}
                >
                  {assignedCount > 0 ? `Asked on ${assignedCount} item${assignedCount !== 1 ? 's' : ''}` : 'Assign items'}
                </button>
                <button
                  onClick={() => removeQuestion(question.localId)}
                  disabled={saving}
                  aria-label="Delete question"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[rgb(var(--text-tertiary))] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs text-[rgb(var(--text-secondary))]">
                <span>Guest picks at least</span>
                <input value={question.minSelections} onChange={e => updateQuestion(question.localId, { minSelections: digits(e.target.value) })} disabled={saving} className="w-12 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-center text-xs text-white" />
                <span>and at most</span>
                <input value={question.maxSelections} onChange={e => updateQuestion(question.localId, { maxSelections: digits(e.target.value) })} disabled={saving} placeholder="∞" className="w-12 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-center text-xs text-white" />
                <span className="text-[rgb(var(--text-tertiary))]">·</span>
                <span>first</span>
                <input value={question.includedCount} onChange={e => updateQuestion(question.localId, { includedCount: digits(e.target.value) })} disabled={saving} className="w-12 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-center text-xs text-white" />
                <span>free, then $</span>
                <input value={question.overagePrice} onChange={e => updateQuestion(question.localId, { overagePrice: decimal(e.target.value) })} disabled={saving} placeholder="0.00" className="w-16 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-center text-xs text-white" />
                <span>each extra</span>
              </div>

              {/* Answers */}
              <div className="mt-3 space-y-2">
                {question.options.map(option => (
                  <div key={option.localId} className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_120px_auto_auto_32px] lg:items-center">
                    <input
                      type="text"
                      value={option.name}
                      onChange={e => updateOption(question.localId, option.localId, { name: e.target.value })}
                      disabled={saving}
                      placeholder="Answer, e.g. Fries"
                      className="w-full px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-sm text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-tertiary))] focus:outline-none focus:border-[rgba(201,169,98,0.4)] transition-colors disabled:opacity-50"
                    />
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[rgb(var(--text-tertiary))]">+$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={option.priceDelta}
                        onChange={e => updateOption(question.localId, option.localId, { priceDelta: decimal(e.target.value) })}
                        disabled={saving}
                        placeholder="0.00"
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-sm text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-tertiary))] focus:outline-none focus:border-[rgba(201,169,98,0.4)] transition-colors disabled:opacity-50"
                      />
                    </div>
                    <ToggleChip active={option.isDefault} disabled={saving} onClick={() => updateOption(question.localId, option.localId, { isDefault: !option.isDefault })}>
                      Default
                    </ToggleChip>
                    <ToggleChip active={option.printOnKitchenTicket} disabled={saving} onClick={() => updateOption(question.localId, option.localId, { printOnKitchenTicket: !option.printOnKitchenTicket })}>
                      Ticket
                    </ToggleChip>
                    <button
                      onClick={() => removeOption(question.localId, option.localId)}
                      disabled={saving}
                      aria-label="Remove answer"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-[rgb(var(--text-tertiary))] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addOption(question.localId)}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[rgb(var(--text-secondary))] border border-[rgba(255,255,255,0.1)] rounded-lg hover:bg-[rgba(255,255,255,0.05)] hover:text-[rgb(var(--text-primary))] disabled:opacity-40 transition-all"
                >
                  + Add answer
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add question */}
      <div className="mt-4">
        <button
          onClick={() => setQuestions(prev => [...prev, blankQuestion()])}
          disabled={saving}
          className="flex items-center gap-2 px-3 py-2 text-sm text-[rgb(var(--text-secondary))] border border-[rgba(255,255,255,0.1)] rounded-lg hover:bg-[rgba(255,255,255,0.05)] hover:text-[rgb(var(--text-primary))] disabled:opacity-40 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Question
        </button>
      </div>

      <button
        data-onboarding-save
        type="button"
        onClick={() => void handleSave()}
        disabled={saving || Boolean(loadError)}
        className="mt-6 w-full rounded-xl bg-white px-4 py-4 text-sm font-semibold text-black transition-colors hover:bg-gray-100 disabled:opacity-40"
      >
        {saving ? 'Saving modifiers...' : 'Continue'}
      </button>

      {/* Item assignment popup */}
      {popupFor && popupQuestion && (
        <ItemAssignmentPopup
          title={`"${popupQuestion.name || 'Question'}" is asked on…`}
          selectedIds={popupQuestion.itemIds}
          menuItems={menuItems}
          onConfirm={(ids) => {
            setItemIds(popupFor, ids)
            setPopupFor(null)
          }}
        />
      )}
    </div>
  )
}

function ToggleChip({ active, disabled, onClick, children }: { active: boolean; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded border px-2 py-1 text-[10px] font-semibold ${active ? 'border-[rgb(var(--gold))] text-[rgb(var(--gold))]' : 'border-white/10 text-[rgb(var(--text-tertiary))]'}`}
    >
      {children}
    </button>
  )
}

// ── Item Assignment Popup ──────────────────────────────────────────────────

interface ItemAssignmentPopupProps {
  title: string
  selectedIds: Set<string>
  menuItems: MenuEditorItem[]
  onConfirm: (ids: Set<string>) => void
}

function ItemAssignmentPopup({ title, selectedIds, menuItems, onConfirm }: ItemAssignmentPopupProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds))

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(menuItems.map(i => i.id)))
  const clearAll = () => setSelected(new Set())

  // Group items by category
  const grouped = menuItems.reduce<Record<string, MenuEditorItem[]>>((acc, item) => {
    const cat = item.category || 'Uncategorized'
    ;(acc[cat] ??= []).push(item)
    return acc
  }, {})

  const categories = Object.keys(grouped).sort()

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
        onClick={() => onConfirm(selected)}
      />

      {/* Panel */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-full max-w-md max-h-[80vh] flex flex-col rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgb(var(--bg-panel))] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.07)] flex-shrink-0">
          <div>
            <p className="text-[rgb(var(--text-primary))] font-semibold text-sm">{title}</p>
            <p className="text-[rgb(var(--text-tertiary))] text-xs mt-0.5">
              {selected.size} of {menuItems.length} item{menuItems.length !== 1 ? 's' : ''} selected
            </p>
          </div>
          <button
            onClick={() => onConfirm(selected)}
            className="text-[rgb(var(--text-tertiary))] hover:text-[rgb(var(--text-primary))] transition-colors p-1 rounded-lg"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Select all / clear */}
        <div className="flex gap-3 px-5 py-2.5 border-b border-[rgba(255,255,255,0.05)] flex-shrink-0">
          <button onClick={selectAll} className="text-xs text-[rgb(var(--gold))] hover:opacity-80 transition-opacity">
            Select all
          </button>
          <span className="text-[rgba(255,255,255,0.15)]">·</span>
          <button onClick={clearAll} className="text-xs text-[rgb(var(--text-tertiary))] hover:text-[rgb(var(--text-secondary))] transition-colors">
            Clear
          </button>
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto py-2">
          {menuItems.length === 0 ? (
            <p className="text-center text-[rgb(var(--text-tertiary))] text-sm py-8">
              No items yet — add menu items first
            </p>
          ) : (
            categories.map(cat => (
              <div key={cat}>
                <p className="px-5 py-1.5 text-[10px] uppercase tracking-wider text-[rgb(var(--text-tertiary))] font-semibold">
                  {cat}
                </p>
                {grouped[cat].map(item => {
                  const checked = selected.has(item.id)
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggle(item.id)}
                      className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                        checked
                          ? 'bg-[rgba(201,169,98,0.08)]'
                          : 'hover:bg-[rgba(255,255,255,0.04)]'
                      }`}
                    >
                      {/* Checkbox */}
                      <span className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-all ${
                        checked
                          ? 'bg-[rgb(var(--gold))] border-[rgb(var(--gold))]'
                          : 'border-[rgba(255,255,255,0.2)]'
                      }`}>
                        {checked && (
                          <svg className="w-2.5 h-2.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className="text-sm text-[rgb(var(--text-primary))]">{item.name}</span>
                      {item.price && (
                        <span className="ml-auto text-xs text-[rgb(var(--text-tertiary))]">
                          ${item.price}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Confirm */}
        <div className="flex-shrink-0 px-5 py-4 border-t border-[rgba(255,255,255,0.07)]">
          <button
            onClick={() => onConfirm(selected)}
            className="w-full py-2.5 bg-[rgb(var(--gold))] text-black text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            Confirm — {selected.size} item{selected.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </>
  )
}
