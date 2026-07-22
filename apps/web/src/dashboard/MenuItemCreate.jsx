import { useState } from 'react'
import {
  DAYS_SHORT,
  Field,
  SelectInput,
  SmallButton,
  TextAreaInput,
  TextInput,
  cleanDecimal,
  cleanDigits,
} from './components/menuUi'

const ROUTE_INHERIT_VALUE = ''
const ROUTE_NO_PRODUCTION_VALUE = '__no_production_route__'
const ROUTE_MULTI_VALUE = '__multiple_production_routes__'

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
// and (when duplicating) the source item's questions, mods, specials, tax
// split, and allergen settings — with only the name (and photo) cleared.
export function MenuItemCreate({
  categoryNames,
  stations,
  source,
  carryover,
  initialDraft,
  busy,
  onCancel,
  onSave,
}) {
  const [draft, setDraft] = useState(initialDraft)
  const set = (patch) => setDraft(prev => ({ ...prev, ...patch }))
  const canSave = Boolean(draft.name.trim()) && draft.price !== '' && !busy

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
        title={canSave ? 'Save and open the full item editor' : 'Name and price are required'}
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
              : 'Nothing is saved until you hit Save. Questions & mods are added on the item screen after saving.'}
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
            title="Kitchen"
            hint="Where this item prints and how it courses. Inherit follows the category."
          >
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Production route">
                <SelectInput value={draft.routing} onChange={event => set({ routing: event.target.value })}>
                  <option value={ROUTE_INHERIT_VALUE}>Inherit category/fallback</option>
                  <option value={ROUTE_NO_PRODUCTION_VALUE}>No production route</option>
                  {draft.routing === ROUTE_MULTI_VALUE && (
                    <option value={ROUTE_MULTI_VALUE}>Multiple stations (same as source)</option>
                  )}
                  {stations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}
                </SelectInput>
              </Field>
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
                    <Field label="From"><TextInput type="time" value={draft.availability_start_time} onChange={event => set({ availability_start_time: event.target.value })} /></Field>
                    <Field label="Until"><TextInput type="time" value={draft.availability_end_time} onChange={event => set({ availability_end_time: event.target.value })} /></Field>
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
              Photo, questions & mods, specials, and the tax split are added on the item screen after saving — or duplicate an existing item to carry all of that over.
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">{actions}</div>
    </div>
  )
}

export default MenuItemCreate
