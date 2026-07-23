import {
  applyPricing,
  archivePricingSpecial,
  createPricingSpecial,
  fetchPricingSpecials,
  fetchPricingWorkspace,
  previewPricing,
  updatePricingSpecial,
  updatePricingBatch,
  type PricingInput,
  type PricingSpecial,
  type PricingSpecialInput,
  type PricingWorkspace,
} from '@/api/menuPricing';
import { color_pallet, semanticColors, statusColors } from '@/styles/colors';
import { radius, spacing } from '@/styles/tokens';
import { typography } from '@/styles/typography';
import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const emptyDraft = (): PricingInput => ({
  name: '', restaurant_ids: [], scope_type: 'item', item_ids: [], category_ids: [],
  adjustment_type: 'percent_up', adjustment_value: 0, timing: 'now',
  start_date: null, end_date: null, start_time: null, end_time: null,
  days_of_week: [1, 2, 3, 4, 5], priority: 0,
});
const emptySpecial = (): PricingSpecialInput => ({
  menu_item_id: '', display_name: '', note: '', special_price: null,
  schedule_kind: 'manual', days_of_week: [1, 2, 3, 4, 5],
  start_time: null, end_time: null, start_date: null, end_date: null,
  cycle_anchor_date: null, cycle_length_days: null, cycle_day_number: null,
  is_active: true, expires_at: null,
});

function money(value: unknown) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function Choice({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.choice, active && styles.choiceActive]}><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text></Pressable>;
}

export function MobilePricingWorkspace({ restaurantId }: { restaurantId: string }) {
  const [workspace, setWorkspace] = useState<PricingWorkspace | null>(null);
  const [specials, setSpecials] = useState<PricingSpecial[]>([]);
  const [specialDraft, setSpecialDraft] = useState<PricingSpecialInput>(emptySpecial);
  const [draft, setDraft] = useState<PricingInput>(emptyDraft);
  const [query, setQuery] = useState('');
  const [showTargets, setShowTargets] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [specialsError, setSpecialsError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setSpecialsError(null);
    try {
      const data = await fetchPricingWorkspace(restaurantId);
      setWorkspace(data);
      setDraft(current => ({ ...current, restaurant_ids: current.restaurant_ids.length ? current.restaurant_ids : [restaurantId] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load pricing.');
      return;
    }
    try {
      setSpecials(await fetchPricingSpecials(restaurantId));
    } catch (err) {
      setSpecials([]);
      setSpecialsError(err instanceof Error ? err.message : 'Could not load featured specials.');
    }
  }, [restaurantId]);
  useEffect(() => {
    setDraft({ ...emptyDraft(), restaurant_ids: [restaurantId] });
    void load();
  }, [load, restaurantId]);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (workspace?.menu_items || []).filter(item => !needle || `${item.name} ${item.category || ''}`.toLowerCase().includes(needle));
  }, [query, workspace?.menu_items]);
  const batches = useMemo(() => {
    const map = new Map<string, any>();
    for (const rule of workspace?.rules || []) {
      const id = String(rule.batch_id || rule.id);
      const row = map.get(id) || { ...rule, count: 0, restaurant_ids: [] };
      row.count += 1;
      if (!row.restaurant_ids.includes(rule.restaurant_id)) row.restaurant_ids.push(rule.restaurant_id);
      map.set(id, row);
    }
    return Array.from(map.values());
  }, [workspace?.rules]);

  const toggle = (field: 'item_ids' | 'category_ids' | 'restaurant_ids', id: string) => setDraft(current => ({
    ...current,
    [field]: current[field].includes(id) ? current[field].filter(value => value !== id) : [...current[field], id],
  }));

  const review = async () => {
    if (!draft.name.trim()) return setError('Name this pricing change.');
    if (!draft.restaurant_ids.length) return setError('Choose at least one restaurant.');
    if (draft.scope_type === 'item' && !draft.item_ids.length) return setError('Select at least one item.');
    if (draft.scope_type === 'category' && !draft.category_ids.length) return setError('Select at least one category.');
    if (draft.adjustment_type !== 'fixed' && draft.adjustment_value === 0) return setError('Enter a non-zero adjustment.');
    setBusy(true); setError(null);
    try {
      const data = await previewPricing(restaurantId, draft);
      setPreview(data); setShowPreview(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not preview pricing.'); }
    finally { setBusy(false); }
  };

  const publish = async () => {
    setBusy(true); setError(null);
    try {
      await applyPricing(restaurantId, draft);
      setShowPreview(false); setPreview(null); setDraft({ ...emptyDraft(), restaurant_ids: [restaurantId] });
      setNotice('Pricing published. POS devices refresh automatically.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not publish pricing.'); }
    finally { setBusy(false); }
  };

  const changeBatch = async (batch: any, action: 'pause' | 'resume' | 'archive') => {
    setBusy(true); setError(null);
    try { await updatePricingBatch(restaurantId, batch.batch_id || batch.id, batch.restaurant_ids, action); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update pricing.'); }
    finally { setBusy(false); }
  };

  const saveSpecial = async () => {
    if (!specialDraft.menu_item_id) return setError('Choose a base item for the special.');
    if (specialDraft.schedule_kind === 'weekly' && !specialDraft.days_of_week?.length) return setError('Choose at least one weekday.');
    if (specialDraft.schedule_kind === 'date_window' && (!specialDraft.start_date || !specialDraft.end_date)) return setError('Enter the special start and end dates.');
    if (specialDraft.schedule_kind === 'cycle' && (!specialDraft.cycle_anchor_date || !specialDraft.cycle_length_days || !specialDraft.cycle_day_number)) return setError('Enter the cycle anchor, length, and special day.');
    setBusy(true); setError(null);
    try {
      await createPricingSpecial(restaurantId, { ...specialDraft, sort_order: specials.length });
      setSpecialDraft(emptySpecial()); setNotice('Featured special saved.'); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save the special.'); }
    finally { setBusy(false); }
  };

  const changeSpecial = async (special: PricingSpecial, action: 'toggle' | 'archive') => {
    setBusy(true); setError(null);
    try {
      if (action === 'archive') await archivePricingSpecial(restaurantId, special.id);
      else await updatePricingSpecial(restaurantId, special.id, { is_active: !special.is_active });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update the special.'); }
    finally { setBusy(false); }
  };

  if (!workspace) return <View style={styles.loading}>{busy || !error ? <ActivityIndicator /> : null}<Text style={styles.muted}>{error || 'Loading pricing...'}</Text></View>;

  return (
    <View style={styles.page}>
      {error ? <View style={[styles.message, styles.error]}><Text style={styles.errorText}>{error}</Text></View> : null}
      {notice ? <View style={[styles.message, styles.notice]}><Text style={styles.noticeText}>{notice}</Text></View> : null}
      <View style={styles.section}>
        <View style={styles.headingRow}><View style={styles.flex}><Text style={styles.title}>Bulk pricing</Text><Text style={styles.muted}>Review exact prices before publishing.</Text></View><Pressable onPress={() => setShowTargets(true)} style={styles.targetButton}><Feather name="map-pin" size={15} color={color_pallet.ink[800]} /><Text style={styles.targetText}>{draft.restaurant_ids.length}</Text></Pressable></View>
        <View style={styles.wrap}><Choice active={draft.scope_type === 'item'} label="Items" onPress={() => setDraft(current => ({ ...current, scope_type: 'item' }))} /><Choice active={draft.scope_type === 'category'} label="Categories" onPress={() => setDraft(current => ({ ...current, scope_type: 'category' }))} /><Choice active={draft.scope_type === 'all'} label="Entire menu" onPress={() => setDraft(current => ({ ...current, scope_type: 'all' }))} /></View>
        {draft.scope_type === 'item' ? <><TextInput value={query} onChangeText={setQuery} placeholder="Search items" style={styles.input} /><View style={styles.listActions}><Pressable onPress={() => setDraft(current => ({ ...current, item_ids: Array.from(new Set([...current.item_ids, ...filteredItems.map(item => item.id)])) }))}><Text style={styles.action}>Select shown</Text></Pressable><Pressable onPress={() => setDraft(current => ({ ...current, item_ids: current.item_ids.filter(id => !filteredItems.some(item => item.id === id)) }))}><Text style={styles.action}>Clear shown</Text></Pressable></View><View style={styles.selectionList}>{filteredItems.map(item => <Pressable key={item.id} onPress={() => toggle('item_ids', item.id)} style={styles.selectionRow}><Feather name={draft.item_ids.includes(item.id) ? 'check-square' : 'square'} size={19} color={draft.item_ids.includes(item.id) ? color_pallet.elevated.dark : color_pallet.ink[500]} /><View style={styles.flex}><Text style={styles.rowTitle}>{item.name}</Text><Text style={styles.rowMeta}>{item.category || 'Other'} · {money(item.price)}</Text></View></Pressable>)}</View></> : null}
        {draft.scope_type === 'category' ? <View style={styles.selectionList}>{workspace.categories.map(category => <Pressable key={category.id} onPress={() => toggle('category_ids', category.id)} style={styles.selectionRow}><Feather name={draft.category_ids.includes(category.id) ? 'check-square' : 'square'} size={19} color={draft.category_ids.includes(category.id) ? color_pallet.elevated.dark : color_pallet.ink[500]} /><Text style={styles.rowTitle}>{category.name}</Text></Pressable>)}</View> : null}
        {draft.scope_type === 'all' ? <Text style={styles.info}>Every active menu item in each selected restaurant will change.</Text> : null}
        <Text style={styles.label}>Change name</Text><TextInput value={draft.name} onChangeText={name => setDraft(current => ({ ...current, name }))} placeholder="Fourth of July pricing" style={styles.input} />
        <Text style={styles.label}>Adjustment</Text><View style={styles.wrap}>{[
          ['percent_up', '+ %'], ['amount_up', '+ $'], ['percent_off', '- %'], ['amount_off', '- $'], ['fixed', 'Set price'],
        ].map(([id, label]) => <Choice key={id} active={draft.adjustment_type === id} label={label} onPress={() => setDraft(current => ({ ...current, adjustment_type: id as PricingInput['adjustment_type'] }))} />)}</View>
        <TextInput keyboardType="decimal-pad" value={draft.adjustment_value ? String(draft.adjustment_value) : ''} onChangeText={value => setDraft(current => ({ ...current, adjustment_value: Number(value.replace(/[^\d.]/g, '')) || 0 }))} placeholder="Value" style={styles.input} />
        <Text style={styles.label}>Timing</Text><View style={styles.wrap}>{[['now', 'Now'], ['scheduled', 'Future'], ['window', 'Event'], ['weekly', 'Weekly']].map(([id, label]) => <Choice key={id} active={draft.timing === id} label={label} onPress={() => setDraft(current => ({ ...current, timing: id as PricingInput['timing'] }))} />)}</View>
        {draft.timing !== 'now' && draft.timing !== 'weekly' ? <View style={styles.twoCols}><TextInput value={draft.start_date || ''} onChangeText={value => setDraft(current => ({ ...current, start_date: value }))} placeholder="Start YYYY-MM-DD" style={[styles.input, styles.flex]} />{draft.timing === 'window' ? <TextInput value={draft.end_date || ''} onChangeText={value => setDraft(current => ({ ...current, end_date: value }))} placeholder="End YYYY-MM-DD" style={[styles.input, styles.flex]} /> : null}</View> : null}
        {draft.timing !== 'now' ? <View style={styles.twoCols}><TextInput value={draft.start_time || ''} onChangeText={value => setDraft(current => ({ ...current, start_time: value }))} placeholder="Start HH:MM" style={[styles.input, styles.flex]} />{draft.timing !== 'scheduled' ? <TextInput value={draft.end_time || ''} onChangeText={value => setDraft(current => ({ ...current, end_time: value }))} placeholder="End HH:MM" style={[styles.input, styles.flex]} /> : null}</View> : null}
        {draft.timing === 'weekly' ? <View style={styles.wrap}>{DAYS.map((label, day) => <Choice key={label} active={(draft.days_of_week || []).includes(day)} label={label} onPress={() => setDraft(current => ({ ...current, days_of_week: (current.days_of_week || []).includes(day) ? (current.days_of_week || []).filter(value => value !== day) : [...(current.days_of_week || []), day] }))} />)}</View> : null}
        <Pressable onPress={() => void review()} disabled={busy} style={styles.primary}><Text style={styles.primaryText}>{busy ? 'Checking...' : 'Review prices'}</Text></Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>Featured specials</Text>
        <Text style={styles.muted}>Create a promoted POS tile from a real item while preserving its modifiers, tax, and routing.</Text>
        {specialsError ? <View style={[styles.message, styles.warning]}><Text style={styles.warningText}>Featured specials could not load: {specialsError}</Text></View> : null}
        {specials.length ? specials.map(special => {
          const baseItem = workspace.menu_items.find(item => item.id === special.menu_item_id);
          return <View key={special.id} style={styles.batch}><View style={styles.flex}><Text style={styles.rowTitle}>{special.display_name || baseItem?.name || 'Special'}</Text><Text style={styles.rowMeta}>{baseItem?.name || 'Menu item'} · {special.special_price == null ? money(baseItem?.price) : money(special.special_price)} · {special.schedule_kind}</Text></View><Pressable disabled={busy} onPress={() => void changeSpecial(special, 'toggle')}><Text style={styles.action}>{special.is_active ? 'Pause' : 'Resume'}</Text></Pressable><Pressable disabled={busy} onPress={() => void changeSpecial(special, 'archive')}><Feather name="archive" size={18} color={statusColors.danger.text} /></Pressable></View>;
        }) : <Text style={styles.info}>No featured specials yet.</Text>}

        <Text style={styles.label}>Base menu item</Text>
        <View style={styles.selectionList}>{workspace.menu_items.map(item => <Pressable key={item.id} onPress={() => setSpecialDraft(current => ({ ...current, menu_item_id: item.id, display_name: current.display_name || item.name, special_price: current.special_price ?? Number(item.price || 0) }))} style={styles.selectionRow}><Feather name={specialDraft.menu_item_id === item.id ? 'check-circle' : 'circle'} size={19} color={specialDraft.menu_item_id === item.id ? color_pallet.elevated.dark : color_pallet.ink[500]} /><View style={styles.flex}><Text style={styles.rowTitle}>{item.name}</Text><Text style={styles.rowMeta}>{item.category || 'Other'} · {money(item.price)}</Text></View></Pressable>)}</View>
        <Text style={styles.label}>Special name and price</Text>
        <View style={styles.twoCols}><TextInput value={specialDraft.display_name || ''} onChangeText={display_name => setSpecialDraft(current => ({ ...current, display_name }))} placeholder="Tuesday Burger" style={[styles.input, styles.flex]} /><TextInput keyboardType="decimal-pad" value={specialDraft.special_price == null ? '' : String(specialDraft.special_price)} onChangeText={value => setSpecialDraft(current => ({ ...current, special_price: value ? Number(value.replace(/[^\d.]/g, '')) : null }))} placeholder="Price" style={[styles.input, styles.flex]} /></View>
        <TextInput value={specialDraft.note || ''} onChangeText={note => setSpecialDraft(current => ({ ...current, note }))} placeholder="Guest-facing special note" style={styles.input} />
        <Text style={styles.label}>Special schedule</Text>
        <View style={styles.wrap}>{[['manual', 'Manual'], ['weekly', 'Weekly'], ['date_window', 'Dates'], ['cycle', 'Cycle']].map(([id, label]) => <Choice key={id} active={specialDraft.schedule_kind === id} label={label} onPress={() => setSpecialDraft(current => ({ ...current, schedule_kind: id as PricingSpecialInput['schedule_kind'] }))} />)}</View>
        {specialDraft.schedule_kind === 'weekly' ? <View style={styles.wrap}>{DAYS.map((label, day) => <Choice key={label} active={(specialDraft.days_of_week || []).includes(day)} label={label} onPress={() => setSpecialDraft(current => ({ ...current, days_of_week: (current.days_of_week || []).includes(day) ? (current.days_of_week || []).filter(value => value !== day) : [...(current.days_of_week || []), day] }))} />)}</View> : null}
        {specialDraft.schedule_kind === 'date_window' ? <View style={styles.twoCols}><TextInput value={specialDraft.start_date || ''} onChangeText={start_date => setSpecialDraft(current => ({ ...current, start_date }))} placeholder="Start YYYY-MM-DD" style={[styles.input, styles.flex]} /><TextInput value={specialDraft.end_date || ''} onChangeText={end_date => setSpecialDraft(current => ({ ...current, end_date }))} placeholder="End YYYY-MM-DD" style={[styles.input, styles.flex]} /></View> : null}
        {specialDraft.schedule_kind === 'cycle' ? <><TextInput value={specialDraft.cycle_anchor_date || ''} onChangeText={cycle_anchor_date => setSpecialDraft(current => ({ ...current, cycle_anchor_date }))} placeholder="Anchor YYYY-MM-DD" style={styles.input} /><View style={styles.twoCols}><TextInput keyboardType="number-pad" value={specialDraft.cycle_length_days ? String(specialDraft.cycle_length_days) : ''} onChangeText={value => setSpecialDraft(current => ({ ...current, cycle_length_days: Number(value) || null }))} placeholder="Cycle days" style={[styles.input, styles.flex]} /><TextInput keyboardType="number-pad" value={specialDraft.cycle_day_number ? String(specialDraft.cycle_day_number) : ''} onChangeText={value => setSpecialDraft(current => ({ ...current, cycle_day_number: Number(value) || null }))} placeholder="Special day" style={[styles.input, styles.flex]} /></View></> : null}
        {specialDraft.schedule_kind !== 'manual' ? <View style={styles.twoCols}><TextInput value={specialDraft.start_time || ''} onChangeText={start_time => setSpecialDraft(current => ({ ...current, start_time }))} placeholder="Start HH:MM" style={[styles.input, styles.flex]} /><TextInput value={specialDraft.end_time || ''} onChangeText={end_time => setSpecialDraft(current => ({ ...current, end_time }))} placeholder="End HH:MM" style={[styles.input, styles.flex]} /></View> : null}
        <Pressable onPress={() => void saveSpecial()} disabled={busy} style={styles.primary}><Text style={styles.primaryText}>{busy ? 'Saving...' : 'Save special'}</Text></Pressable>
      </View>

      <View style={styles.section}><Text style={styles.title}>Scheduled pricing</Text>{batches.length ? batches.map(batch => <View key={batch.batch_id} style={styles.batch}><View style={styles.flex}><Text style={styles.rowTitle}>{batch.name}</Text><Text style={styles.rowMeta}>{batch.count} target{batch.count === 1 ? '' : 's'} · {batch.rule_kind}</Text></View>{!batch.archived_at ? <><Pressable onPress={() => void changeBatch(batch, batch.is_active ? 'pause' : 'resume')}><Text style={styles.action}>{batch.is_active ? 'Pause' : 'Resume'}</Text></Pressable><Pressable onPress={() => void changeBatch(batch, 'archive')}><Feather name="archive" size={18} color={statusColors.danger.text} /></Pressable></> : <Text style={styles.muted}>Archived</Text>}</View>) : <Text style={styles.info}>No scheduled or recurring pricing yet.</Text>}</View>

      <Modal visible={showTargets} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowTargets(false)}><ScrollView contentContainerStyle={styles.modal}><View style={styles.headingRow}><Text style={styles.title}>Apply to restaurants</Text><Pressable onPress={() => setShowTargets(false)}><Text style={styles.action}>Done</Text></Pressable></View>{workspace.groups.map(group => <Pressable key={group.id} onPress={() => { const ids = group.restaurant_ids || []; const all = ids.every(id => draft.restaurant_ids.includes(id)); setDraft(current => ({ ...current, restaurant_ids: all ? current.restaurant_ids.filter(id => !ids.includes(id)) : Array.from(new Set([...current.restaurant_ids, ...ids])) })); }} style={styles.groupRow}><View style={[styles.dot, { backgroundColor: group.color || color_pallet.ink[400] }]} /><Text style={styles.rowTitle}>{group.name}</Text><Text style={styles.rowMeta}>{(group.restaurant_ids || []).filter(id => draft.restaurant_ids.includes(id)).length}/{group.restaurant_ids?.length || 0}</Text></Pressable>)}{workspace.available_restaurants.map(row => <Pressable key={row.id} onPress={() => toggle('restaurant_ids', row.id)} style={styles.selectionRow}><Feather name={draft.restaurant_ids.includes(row.id) ? 'check-square' : 'square'} size={20} color={color_pallet.elevated.dark} /><Text style={styles.rowTitle}>{row.name}</Text></Pressable>)}</ScrollView></Modal>

      <Modal visible={showPreview} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPreview(false)}><ScrollView contentContainerStyle={styles.modal}><View style={styles.headingRow}><Text style={styles.title}>Review pricing</Text><Pressable onPress={() => setShowPreview(false)}><Text style={styles.action}>Close</Text></Pressable></View>{preview?.issues?.length ? <View style={[styles.message, styles.error]}>{preview.issues.map((issue: any, index: number) => <Text key={index} style={styles.errorText}>{issue.restaurant_name}: {issue.source} was {issue.reason}.</Text>)}</View> : null}{(preview?.targets || []).map((target: any) => <View key={target.restaurant_id} style={styles.previewTarget}><Text style={styles.rowTitle}>{target.restaurant_name} · {target.item_count} items</Text>{target.items.map((item: any) => <View key={item.id} style={styles.previewRow}><Text style={styles.flex}>{item.name}</Text><Text style={styles.rowMeta}>{money(item.current_price)}</Text><Text style={styles.newPrice}>{money(item.new_price)}</Text></View>)}</View>)}<Pressable onPress={() => void publish()} disabled={busy || preview?.issues?.length} style={styles.primary}><Text style={styles.primaryText}>{busy ? 'Publishing...' : 'Publish pricing'}</Text></Pressable></ScrollView></Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing[4] }, loading: { alignItems: 'center', gap: spacing[2], padding: spacing[6] },
  section: { backgroundColor: semanticColors.elevated, borderColor: semanticColors.border, borderRadius: radius.md, borderWidth: 1, padding: spacing[4] },
  headingRow: { alignItems: 'center', flexDirection: 'row', gap: spacing[3], justifyContent: 'space-between' }, flex: { flex: 1 },
  title: { ...typography.h3, color: color_pallet.ink[900] }, muted: { ...typography.bodySmall, color: color_pallet.ink[500] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[3] },
  choice: { borderColor: semanticColors.border, borderRadius: radius.pill, borderWidth: 1, minHeight: 34, justifyContent: 'center', paddingHorizontal: spacing[3] }, choiceActive: { backgroundColor: color_pallet.elevated.dark, borderColor: color_pallet.elevated.dark },
  choiceText: { color: color_pallet.ink[600], fontFamily: 'Inter_700Bold', fontSize: 12 }, choiceTextActive: { color: color_pallet.cream[50] },
  input: { borderColor: semanticColors.border, borderRadius: radius.md, borderWidth: 1, color: color_pallet.ink[900], minHeight: 44, marginTop: spacing[2], paddingHorizontal: spacing[3] },
  label: { ...typography.eyebrow, color: color_pallet.ink[600], marginTop: spacing[4] }, selectionList: { borderColor: semanticColors.border, borderRadius: radius.md, borderWidth: 1, marginTop: spacing[2], overflow: 'hidden' },
  selectionRow: { alignItems: 'center', borderBottomColor: semanticColors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing[3], minHeight: 52, paddingHorizontal: spacing[3] }, rowTitle: { ...typography.body, color: color_pallet.ink[800], fontFamily: 'Inter_700Bold' }, rowMeta: { ...typography.bodySmall, color: color_pallet.ink[500] },
  targetButton: { alignItems: 'center', borderColor: semanticColors.border, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', gap: spacing[1], paddingHorizontal: spacing[3], paddingVertical: spacing[2] }, targetText: { color: color_pallet.ink[800], fontFamily: 'Inter_700Bold' },
  info: { ...typography.bodySmall, color: color_pallet.ink[600], marginTop: spacing[3] }, twoCols: { flexDirection: 'row', gap: spacing[2] },
  listActions: { flexDirection: 'row', gap: spacing[4], justifyContent: 'flex-end', marginTop: spacing[2] },
  primary: { alignItems: 'center', backgroundColor: color_pallet.elevated.dark, borderRadius: radius.md, justifyContent: 'center', marginTop: spacing[5], minHeight: 46 }, primaryText: { color: color_pallet.cream[50], fontFamily: 'Inter_700Bold' },
  batch: { alignItems: 'center', borderBottomColor: semanticColors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing[3], paddingVertical: spacing[3] }, action: { color: color_pallet.elevated.dark, fontFamily: 'Inter_700Bold' },
  message: { borderRadius: radius.md, borderWidth: 1, padding: spacing[3] }, error: { backgroundColor: statusColors.danger.bg, borderColor: statusColors.danger.border }, errorText: { color: statusColors.danger.text }, warning: { backgroundColor: statusColors.warning.bg, borderColor: statusColors.warning.border, marginTop: spacing[3] }, warningText: { color: statusColors.warning.text }, notice: { backgroundColor: statusColors.success.bg, borderColor: statusColors.success.border }, noticeText: { color: statusColors.success.text },
  modal: { backgroundColor: color_pallet.bg.DEFAULT, flexGrow: 1, gap: spacing[3], padding: spacing[5] }, groupRow: { alignItems: 'center', borderColor: semanticColors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing[3], padding: spacing[3] }, dot: { borderRadius: 6, height: 12, width: 12 },
  previewTarget: { borderTopColor: semanticColors.border, borderTopWidth: 1, paddingTop: spacing[3] }, previewRow: { alignItems: 'center', flexDirection: 'row', gap: spacing[3], paddingVertical: spacing[2] }, newPrice: { color: statusColors.success.text, fontFamily: 'Inter_700Bold' },
});
