import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import ColorPicker, { HueSlider, Panel1 } from 'reanimated-color-picker';
import { WebView } from 'react-native-webview';
import {
  defaultUiTheme,
  effectiveUiTheme,
  groupUiThemeTokens,
  type UiService,
  type UiComponentOverrides,
  type UiPreviewComponentSelection,
  type UiPreviewMode,
} from '@shire/db';
import {
  RESELLER_UNGROUPED_ID,
  fetchResellerPortfolio,
  type ResellerGroup,
  type ResellerRestaurant,
} from '../../packages/supabase';
import {
  applyUiTheme,
  deleteUiThemeHistoryColor,
  fetchUiThemes,
  type UiThemeResponse,
} from '@/api/uiThemes';
import { color_pallet, semanticColors, statusColors } from '@/styles/colors';
import { typography } from '@/styles/typography';
import { PublishControls } from '@/components/ui/PublishControls';
import { scheduleChange } from '@/api/scheduledChanges';

type ScopeTab = 'restaurants' | 'groups';

type GroupCard = ResellerGroup & {
  restaurant_count: number;
};

function groupCards(restaurants: ResellerRestaurant[], groups: ResellerGroup[]): GroupCard[] {
  return [
    ...groups.map((group) => ({
      ...group,
      restaurant_count: restaurants.filter((item) => item.reseller_group_id === group.id).length,
    })),
    {
      id: RESELLER_UNGROUPED_ID,
      reseller_id: '',
      name: 'Ungrouped',
      color: '#9CA3AF',
      restaurant_count: restaurants.filter((item) => item.reseller_group_id === RESELLER_UNGROUPED_ID).length,
    },
  ];
}

function themesMatch(left: Record<string, string>, right: Record<string, string>) {
  return Object.keys(left).every((key) => left[key] === right[key]);
}

function cloneOverrides(value: UiComponentOverrides): UiComponentOverrides {
  return JSON.parse(JSON.stringify(value)) as UiComponentOverrides;
}

const SERVICE_PREVIEW_URLS: Record<UiService, string> = {
  pos: process.env.EXPO_PUBLIC_POS_UI_PREVIEW_URL || 'http://Harshiths-MacBook-Pro.local:8082/?shirePreview=1',
  host: process.env.EXPO_PUBLIC_HOST_UI_PREVIEW_URL || 'http://Harshiths-MacBook-Pro.local:8081/?shirePreview=1',
};

function RealThemePreview({
  service,
  tokens,
  componentOverrides,
  mode,
  onComponentSelect,
}: {
  service: UiService;
  tokens: Record<string, string>;
  componentOverrides: UiComponentOverrides;
  mode: UiPreviewMode;
  onComponentSelect: (selection: UiPreviewComponentSelection) => void;
}) {
  const webView = useRef<WebView>(null);
  const sendState = () => {
    const message = JSON.stringify({ type: 'shire-ui-preview-state', service, tokens, componentOverrides, mode });
    webView.current?.injectJavaScript(`window.postMessage(${message}, window.location.origin); true;`);
  };

  useEffect(() => sendState(), [componentOverrides, mode, service, tokens]);

  return (
    <View style={styles.realPreview}>
      <WebView
        ref={webView}
        source={{ uri: SERVICE_PREVIEW_URLS[service] }}
        onLoadEnd={sendState}
        onMessage={(event) => {
          try {
            const message = JSON.parse(event.nativeEvent.data);
            if (message?.type === 'shire-ui-preview-component-selected' && message.service === service) onComponentSelect(message.component);
            if (message?.type === 'shire-ui-preview-ready' && message.service === service) sendState();
          } catch {
            // Ignore messages from service runtimes that are unrelated to the editor bridge.
          }
        }}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled={false}
        originWhitelist={['http://*', 'https://*']}
        style={styles.previewWebView}
      />
    </View>
  );
}

function ScopeModal({
  visible,
  restaurants,
  groups,
  initialIds,
  dismissible,
  onClose,
  onApply,
}: {
  visible: boolean;
  restaurants: ResellerRestaurant[];
  groups: ResellerGroup[];
  initialIds: string[];
  dismissible: boolean;
  onClose: () => void;
  onApply: (ids: string[]) => void;
}) {
  const cards = useMemo(() => groupCards(restaurants, groups), [groups, restaurants]);
  const [tab, setTab] = useState<ScopeTab>('restaurants');
  const [filter, setFilter] = useState('all');
  const [restaurantIds, setRestaurantIds] = useState(new Set(initialIds));
  const [groupIds, setGroupIds] = useState(new Set<string>());

  useEffect(() => {
    if (visible) setRestaurantIds(new Set(initialIds));
  }, [initialIds, visible]);

  const visibleRestaurants = filter === 'all'
    ? restaurants
    : restaurants.filter((item) => item.reseller_group_id === filter);
  const targets = tab === 'groups'
    ? restaurants.filter((item) => groupIds.has(item.reseller_group_id)).map((item) => item.id)
    : [...restaurantIds];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={dismissible ? onClose : undefined}>
      <View style={styles.modalPage}>
        <View style={styles.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>UI SCOPE</Text>
            <Text style={styles.modalTitle}>Choose what you want to view</Text>
            <Text style={styles.supporting}>Themes are loaded and saved for this exact selection.</Text>
          </View>
          {dismissible && <Pressable accessibilityLabel="Close scope selector" onPress={onClose} style={styles.iconButton}><Feather name="x" size={19} color={semanticColors.text} /></Pressable>}
        </View>
        <View style={styles.segmented}>{(['restaurants', 'groups'] as ScopeTab[]).map((item) => <Pressable key={item} onPress={() => setTab(item)} style={[styles.segment, tab === item && styles.segmentActive]}><Text style={[styles.segmentText, tab === item && styles.segmentTextActive]}>{item === 'restaurants' ? 'Restaurants' : 'Groups'}</Text></Pressable>)}</View>
        <ScrollView contentContainerStyle={styles.modalContent}>
          {tab === 'restaurants' ? <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {[{ id: 'all', name: 'All groups', color: semanticColors.textMuted }, ...cards].map((group) => <Pressable key={group.id} onPress={() => setFilter(group.id)} style={[styles.filterPill, filter === group.id && styles.filterPillActive]}><View style={[styles.dot, { backgroundColor: group.color }]} /><Text style={[styles.filterText, filter === group.id && styles.filterTextActive]}>{group.name}</Text></Pressable>)}
            </ScrollView>
            <View style={styles.selectionList}>{visibleRestaurants.map((restaurant) => {
              const selected = restaurantIds.has(restaurant.id);
              return <Pressable key={restaurant.id} onPress={() => setRestaurantIds((current) => { const next = new Set(current); if (next.has(restaurant.id)) next.delete(restaurant.id); else next.add(restaurant.id); return next; })} style={[styles.selectionRow, selected && styles.selectionRowActive]}><View style={[styles.checkbox, selected && styles.checkboxActive]}>{selected && <Feather name="check" size={13} color="#FFFFFF" />}</View><View style={{ flex: 1 }}><Text style={styles.selectionTitle}>{restaurant.name}</Text><View style={styles.groupLine}><View style={[styles.dot, { backgroundColor: restaurant.reseller_group_color }]} /><Text style={styles.selectionMeta}>{restaurant.reseller_group_name}</Text></View></View></Pressable>;
            })}</View>
          </> : <View style={styles.selectionList}>{cards.map((group) => {
            const selected = groupIds.has(group.id);
            return <Pressable key={group.id} onPress={() => setGroupIds((current) => { const next = new Set(current); if (next.has(group.id)) next.delete(group.id); else next.add(group.id); return next; })} style={[styles.selectionRow, selected && styles.selectionRowActive]}><View style={[styles.dotLarge, { backgroundColor: group.color }]} /><View style={{ flex: 1 }}><Text style={styles.selectionTitle}>{group.name}</Text><Text style={styles.selectionMeta}>{group.restaurant_count} restaurants</Text></View>{selected && <Feather name="check-circle" size={20} color={semanticColors.primary} />}</Pressable>;
          })}</View>}
        </ScrollView>
        <View style={styles.modalFooter}><Text style={styles.selectionMeta}>{new Set(targets).size} restaurants selected</Text><Pressable disabled={targets.length === 0} onPress={() => onApply([...new Set(targets)])} style={[styles.primaryButton, targets.length === 0 && styles.disabled]}><Text style={styles.primaryButtonText}>View selection</Text></Pressable></View>
      </View>
    </Modal>
  );
}

export default function ResellerUiEditor() {
  const [restaurants, setRestaurants] = useState<ResellerRestaurant[]>([]);
  const [groups, setGroups] = useState<ResellerGroup[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scopeOpen, setScopeOpen] = useState(true);
  const [service, setService] = useState<UiService>('pos');
  const [data, setData] = useState<UiThemeResponse | null>(null);
  const [drafts, setDrafts] = useState<Record<UiService, Record<string, string>>>({ pos: defaultUiTheme('pos'), host: defaultUiTheme('host') });
  const [savedDrafts, setSavedDrafts] = useState<Record<UiService, Record<string, string>>>({ pos: defaultUiTheme('pos'), host: defaultUiTheme('host') });
  const [previewDrafts, setPreviewDrafts] = useState<Record<UiService, Record<string, string>>>({ pos: defaultUiTheme('pos'), host: defaultUiTheme('host') });
  const [componentDrafts, setComponentDrafts] = useState<Record<UiService, UiComponentOverrides>>({ pos: {}, host: {} });
  const [savedComponents, setSavedComponents] = useState<Record<UiService, UiComponentOverrides>>({ pos: {}, host: {} });
  const [previewComponents, setPreviewComponents] = useState<Record<UiService, UiComponentOverrides>>({ pos: {}, host: {} });
  const [mixed, setMixed] = useState<Record<UiService, boolean>>({ pos: false, host: false });
  const [previewMode, setPreviewMode] = useState<UiPreviewMode>('view');
  const [componentSelection, setComponentSelection] = useState<UiPreviewComponentSelection | null>(null);
  const [componentProperty, setComponentProperty] = useState<'backgroundColor' | 'color' | 'borderColor'>('backgroundColor');
  const [componentColor, setComponentColor] = useState('#000000');
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    fetchResellerPortfolio()
      .then((portfolio) => { setRestaurants(portfolio.restaurants); setGroups(portfolio.groups); })
      .catch((error) => setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Could not load portfolio.' }))
      .finally(() => setLoading(false));
  }, []);

  const loadSelection = async (ids: string[]) => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetchUiThemes(ids);
      const nextDrafts = {} as Record<UiService, Record<string, string>>;
      const nextComponents = {} as Record<UiService, UiComponentOverrides>;
      const nextMixed = {} as Record<UiService, boolean>;
      for (const targetService of ['pos', 'host'] as UiService[]) {
        const effective = ids.map((restaurantId) => {
          const row = response.themes.find((item) => item.restaurant_id === restaurantId && item.service === targetService);
          return effectiveUiTheme(targetService, row?.tokens);
        });
        const consistent = effective.length > 0 && effective.every((theme) => themesMatch(effective[0], theme));
        nextDrafts[targetService] = consistent ? effective[0] : defaultUiTheme(targetService);
        const componentSets = ids.map((restaurantId) => response.themes.find((item) => item.restaurant_id === restaurantId && item.service === targetService)?.component_overrides ?? {});
        const componentsConsistent = componentSets.length > 0 && componentSets.every((item) => JSON.stringify(item) === JSON.stringify(componentSets[0]));
        nextComponents[targetService] = componentsConsistent ? componentSets[0] : {};
        nextMixed[targetService] = !consistent || !componentsConsistent;
      }
      setSelectedIds(ids);
      setData(response);
      setDrafts(nextDrafts);
      setSavedDrafts(nextDrafts);
      setPreviewDrafts(nextDrafts);
      setComponentDrafts(nextComponents);
      setSavedComponents(nextComponents);
      setPreviewComponents(nextComponents);
      setMixed(nextMixed);
      setPreviewMode('view');
      setComponentSelection(null);
      setScopeOpen(false);
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Could not load themes.' });
    } finally {
      setSaving(false);
    }
  };

  const updateColor = (key: string, color: string) => {
    setActiveToken(key);
    setDrafts((current) => ({ ...current, [service]: { ...current[service], [key]: color } }));
  };

  const pushToIpads = async (publication?: { scheduledFor: string; timezone: string }) => {
    setSaving(true);
    setMessage(null);
    try {
      if (publication) {
        const scheduled = await scheduleChange({
          label: `${service.toUpperCase()} UI theme`,
          scheduledFor: publication.scheduledFor,
          timezone: publication.timezone,
          commands: [{ method: 'PUT', path: '/reseller/ui-themes', body: { service, restaurant_ids: selectedIds, tokens: drafts[service], component_overrides: componentDrafts[service] }, target_type: 'reseller' }],
        });
        setMessage({ tone: 'success', text: `${service.toUpperCase()} UI scheduled for ${new Date(scheduled.scheduled_for).toLocaleString()}.` });
        setSaving(false);
        return;
      }
      await applyUiTheme(service, selectedIds, drafts[service], componentDrafts[service]);
      await loadSelection(selectedIds);
      setMessage({ tone: 'success', text: `${service.toUpperCase()} UI pushed to ${selectedIds.length} restaurants.` });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Could not apply theme.' });
      setSaving(false);
    }
  };

  const previewChanges = () => {
    setPreviewDrafts((current) => ({ ...current, [service]: { ...drafts[service] } }));
    setPreviewComponents((current) => ({ ...current, [service]: cloneOverrides(componentDrafts[service]) }));
    setMessage({ tone: 'success', text: `${service.toUpperCase()} draft is shown in the sandbox. Nothing has been pushed.` });
  };

  const selectComponent = (selection: UiPreviewComponentSelection) => {
    const property = selection.properties.find((item) => item.property === 'backgroundColor') ?? selection.properties[0];
    if (!property) return;
    setComponentSelection(selection);
    setComponentProperty(property.property);
    setComponentColor(property.value);
  };

  const saveComponentColor = (scope: 'component' | 'theme') => {
    const property = componentSelection?.properties.find((item) => item.property === componentProperty);
    if (!componentSelection || !property) return;
    if (scope === 'theme') {
      if (!property.tokenKey) return;
      const nextTheme = { ...drafts[service], [property.tokenKey]: componentColor };
      setDrafts((current) => ({ ...current, [service]: nextTheme }));
      setPreviewDrafts((current) => ({ ...current, [service]: nextTheme }));
    } else {
      if (!componentSelection.registered) return;
      const nextOverrides = {
        ...componentDrafts[service],
        [componentSelection.componentId]: {
          ...(componentDrafts[service][componentSelection.componentId] ?? {}),
          [componentProperty]: componentColor,
        },
      };
      setComponentDrafts((current) => ({ ...current, [service]: nextOverrides }));
      setPreviewComponents((current) => ({ ...current, [service]: nextOverrides }));
    }
    setComponentSelection(null);
    setMessage({ tone: 'success', text: `${componentSelection.label} updated in the sandbox. Push to iPads when it looks right.` });
  };

  const removeComponentOverride = () => {
    if (!componentSelection?.registered) return;
    const nextOverrides = cloneOverrides(componentDrafts[service]);
    const selectedOverrides = nextOverrides[componentSelection.componentId];
    if (!selectedOverrides) return;
    delete selectedOverrides[componentProperty];
    if (!Object.keys(selectedOverrides).length) delete nextOverrides[componentSelection.componentId];
    setComponentDrafts((current) => ({ ...current, [service]: nextOverrides }));
    setPreviewComponents((current) => ({ ...current, [service]: nextOverrides }));
    setComponentSelection(null);
    setMessage({ tone: 'success', text: `${componentSelection.label} now inherits its theme color in the sandbox.` });
  };

  const removeHistory = async (color: string) => {
    try {
      await deleteUiThemeHistoryColor(color);
      setData((current) => current ? { ...current, color_history: current.color_history.filter((item) => item.color !== color) } : current);
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Could not delete color.' });
    }
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator color={semanticColors.primary} /></View>;
  const colors = drafts[service];
  const activeColor = activeToken ? colors[activeToken] : '#000000';
  const dirty = Object.fromEntries((['pos', 'host'] as UiService[]).map((item) => [item,
    JSON.stringify(drafts[item]) !== JSON.stringify(savedDrafts[item])
      || JSON.stringify(componentDrafts[item]) !== JSON.stringify(savedComponents[item]),
  ])) as Record<UiService, boolean>;
  const previewOutdated = JSON.stringify(drafts[service]) !== JSON.stringify(previewDrafts[service])
    || JSON.stringify(componentDrafts[service]) !== JSON.stringify(previewComponents[service]);
  const openScope = () => {
    if (!Object.values(dirty).some(Boolean)) {
      setScopeOpen(true);
      return;
    }
    Alert.alert('Discard unpushed changes?', 'Changing the selection discards UI changes that have not been pushed.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => setScopeOpen(true) },
    ]);
  };

  return (
    <View style={styles.page}>
      <ScopeModal visible={scopeOpen} restaurants={restaurants} groups={groups} initialIds={selectedIds} dismissible={selectedIds.length > 0} onClose={() => setScopeOpen(false)} onApply={(ids) => void loadSelection(ids)} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headingRow}><View style={{ flex: 1 }}><Text style={styles.eyebrow}>RESELLER UI EDITOR</Text><Text style={styles.title}>Application colors</Text><Text style={styles.supporting}>Edit the runtime theme for the selected POS and Host apps.</Text></View><View style={styles.headingActions}><Pressable onPress={openScope} style={styles.secondaryButton}><Feather name="filter" size={15} color={semanticColors.text} /><Text style={styles.secondaryButtonText}>Scope</Text></Pressable>{dirty[service] && <PublishControls label="Push to iPads" busy={saving} onPublishNow={() => pushToIpads()} onSchedule={(scheduledFor, timezone) => pushToIpads({ scheduledFor, timezone })} />}</View></View>
        <View style={styles.scopeSummary}><Text style={styles.scopeSummaryText}>{selectedIds.length ? `${selectedIds.length} restaurants selected` : 'Choose restaurants to begin'}</Text></View>
        {message && <View style={[styles.message, message.tone === 'error' ? styles.messageError : styles.messageSuccess]}><Text style={message.tone === 'error' ? styles.messageErrorText : styles.messageSuccessText}>{message.text}</Text></View>}
        <View style={styles.segmented}>{(['pos', 'host'] as UiService[]).map((item) => <Pressable key={item} onPress={() => { setService(item); setActiveToken(null); }} style={[styles.segment, service === item && styles.segmentActive]}><Text style={[styles.segmentText, service === item && styles.segmentTextActive]}>{item.toUpperCase()}</Text></Pressable>)}</View>
        {mixed[service] && <View style={styles.mixedNotice}><Text style={styles.mixedText}>These restaurants have different {service.toUpperCase()} UI settings. The service default is shown; pushing makes the complete scheme consistent.</Text></View>}
        <View style={styles.panel}><View style={styles.previewHeading}><View style={{ flex: 1 }}><Text style={styles.panelTitle}>Real application sandbox</Text><Text style={styles.panelHelp}>Uses the service's actual screens with in-memory preview data.</Text></View><Pressable accessibilityLabel="Open full-screen preview" onPress={() => setPreviewOpen(true)} style={styles.iconButton}><Feather name="maximize-2" size={18} color={semanticColors.text} /></Pressable></View><View style={styles.modeSegmented}>{(['view', 'edit'] as UiPreviewMode[]).map((item) => <Pressable key={item} onPress={() => setPreviewMode(item)} style={[styles.modeSegment, previewMode === item && styles.modeSegmentActive]}><Feather name={item === 'view' ? 'eye' : 'edit-2'} size={14} color={previewMode === item ? semanticColors.textInverse : semanticColors.textMuted} /><Text style={[styles.modeText, previewMode === item && styles.modeTextActive]}>{item === 'view' ? 'View' : 'Edit'}</Text></Pressable>)}</View><RealThemePreview service={service} tokens={previewDrafts[service]} componentOverrides={previewComponents[service]} mode={previewMode} onComponentSelect={selectComponent} /></View>
        <View style={styles.panel}><Text style={styles.panelTitle}>Recent colors</Text><Text style={styles.panelHelp}>Tap to apply to the active field. Long-press to delete.</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyRow}>{(data?.color_history || []).map((item) => <Pressable key={item.color} accessibilityLabel={`Use ${item.color}`} onPress={() => activeToken && updateColor(activeToken, item.color)} onLongPress={() => void removeHistory(item.color)} style={[styles.historySwatch, { backgroundColor: item.color }]} />)}{!data?.color_history.length && <Text style={styles.selectionMeta}>Colors appear after the first save.</Text>}</ScrollView></View>
        {groupUiThemeTokens(service).map(({ group, tokens }) => <View key={group} style={styles.panel}><Text style={styles.panelTitle}>{group}</Text><View style={styles.tokenList}>{tokens.map((item) => <Pressable key={item.key} onPress={() => { setActiveToken(item.key); setColorPickerOpen(true); }} style={[styles.tokenRow, activeToken === item.key && styles.tokenRowActive]}><View style={[styles.tokenSwatch, { backgroundColor: colors[item.key] }]} /><View style={{ flex: 1 }}><Text style={styles.tokenLabel}>{item.label}</Text><TextInput value={colors[item.key]} onFocus={() => setActiveToken(item.key)} onChangeText={(value) => updateColor(item.key, value)} autoCapitalize="none" autoCorrect={false} style={styles.colorCode} /></View><Feather name="chevron-right" size={18} color={semanticColors.textMuted} /></Pressable>)}</View></View>)}
        <Pressable disabled={!previewOutdated} onPress={previewChanges} style={[styles.saveButton, !previewOutdated && styles.disabled]}><Feather name="eye" size={16} color={semanticColors.textInverse} /><Text style={styles.saveButtonText}>Preview changes</Text></Pressable>
      </ScrollView>
      <Modal visible={previewOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setPreviewOpen(false)}><View style={styles.previewModal}><View style={styles.previewModalHeader}><View><Text style={styles.eyebrow}>{service.toUpperCase()} SANDBOX</Text><Text style={styles.panelTitle}>Real application preview</Text></View><Pressable accessibilityLabel="Close preview" onPress={() => setPreviewOpen(false)} style={styles.iconButton}><Feather name="x" size={19} color={semanticColors.text} /></Pressable></View><View style={styles.modeSegmented}>{(['view', 'edit'] as UiPreviewMode[]).map((item) => <Pressable key={item} onPress={() => setPreviewMode(item)} style={[styles.modeSegment, previewMode === item && styles.modeSegmentActive]}><Feather name={item === 'view' ? 'eye' : 'edit-2'} size={14} color={previewMode === item ? semanticColors.textInverse : semanticColors.textMuted} /><Text style={[styles.modeText, previewMode === item && styles.modeTextActive]}>{item === 'view' ? 'View' : 'Edit'}</Text></Pressable>)}</View><View style={styles.previewModalBody}><RealThemePreview service={service} tokens={previewDrafts[service]} componentOverrides={previewComponents[service]} mode={previewMode} onComponentSelect={selectComponent} /></View></View></Modal>
      <Modal visible={Boolean(componentSelection)} transparent animationType="fade" onRequestClose={() => setComponentSelection(null)}>
        <View style={styles.pickerBackdrop}><View style={styles.pickerCard}><View style={styles.pickerHeading}><View style={{ flex: 1 }}><Text style={styles.eyebrow}>EDIT COMPONENT</Text><Text style={styles.panelTitle}>{componentSelection?.label}</Text><Text numberOfLines={2} style={styles.componentId}>{componentSelection?.componentId}</Text></View><Pressable accessibilityLabel="Close component editor" onPress={() => setComponentSelection(null)} style={styles.iconButton}><Feather name="x" size={19} color={semanticColors.text} /></Pressable></View><View style={styles.propertyRow}>{componentSelection?.properties.map((item) => <Pressable key={item.property} onPress={() => { setComponentProperty(item.property); setComponentColor(item.value); }} style={[styles.propertyButton, componentProperty === item.property && styles.propertyButtonActive]}><Text style={[styles.propertyText, componentProperty === item.property && styles.propertyTextActive]}>{item.label}</Text></Pressable>)}</View><ColorPicker value={componentColor} onComplete={({ hex }) => setComponentColor(hex)} style={styles.colorPicker}><Panel1 style={styles.colorPanel} /><HueSlider style={styles.hueSlider} /></ColorPicker><TextInput value={componentColor} onChangeText={setComponentColor} autoCapitalize="none" style={styles.pickerInput} /><View style={styles.componentActions}><Pressable disabled={!componentSelection?.registered} onPress={() => saveComponentColor('component')} style={[styles.componentAction, !componentSelection?.registered && styles.disabled]}><Text style={styles.componentActionText}>Save to component</Text></Pressable><Pressable disabled={!componentSelection?.properties.find((item) => item.property === componentProperty)?.tokenKey} onPress={() => saveComponentColor('theme')} style={[styles.primaryButton, !componentSelection?.properties.find((item) => item.property === componentProperty)?.tokenKey && styles.disabled]}><Text style={styles.primaryButtonText}>Update theme</Text></Pressable></View>{componentSelection?.registered && componentDrafts[service][componentSelection.componentId]?.[componentProperty] && <Pressable onPress={removeComponentOverride}><Text style={styles.removeOverride}>Remove component override</Text></Pressable>}<Text style={styles.panelHelp}>This updates only the sandbox draft. Push to iPads after reviewing it.</Text></View></View>
      </Modal>
      <Modal visible={colorPickerOpen} transparent animationType="fade" onRequestClose={() => setColorPickerOpen(false)}>
        <View style={styles.pickerBackdrop}><View style={styles.pickerCard}><View style={styles.pickerHeading}><View><Text style={styles.panelTitle}>Choose color</Text><Text style={styles.colorCode}>{activeToken}</Text></View><Pressable accessibilityLabel="Close color picker" onPress={() => setColorPickerOpen(false)} style={styles.iconButton}><Feather name="x" size={19} color={semanticColors.text} /></Pressable></View>{activeToken && <ColorPicker value={activeColor} onComplete={({ hex }) => updateColor(activeToken, hex)} style={styles.colorPicker}><Panel1 style={styles.colorPanel} /><HueSlider style={styles.hueSlider} /></ColorPicker>}<TextInput value={activeToken ? colors[activeToken] : ''} onChangeText={(value) => activeToken && updateColor(activeToken, value)} autoCapitalize="none" style={styles.pickerInput} /><Pressable onPress={() => setColorPickerOpen(false)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Done</Text></Pressable></View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color_pallet.bg.DEFAULT },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color_pallet.bg.DEFAULT },
  content: { padding: 18, paddingBottom: 130, gap: 14 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headingActions: { alignItems: 'stretch', gap: 8 },
  eyebrow: { ...typography.eyebrow, color: semanticColors.textMuted, fontSize: 10 },
  title: { ...typography.h1, color: semanticColors.text, marginTop: 3 },
  supporting: { ...typography.body, color: semanticColors.textMuted, marginTop: 5 },
  secondaryButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: semanticColors.border, borderRadius: 8, paddingHorizontal: 13, backgroundColor: semanticColors.elevated },
  secondaryButtonText: { ...typography.caption, color: semanticColors.text },
  pushButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 8, paddingHorizontal: 13, backgroundColor: semanticColors.text },
  pushButtonText: { ...typography.caption, color: semanticColors.textInverse },
  scopeSummary: { borderWidth: 1, borderColor: semanticColors.border, borderRadius: 8, backgroundColor: semanticColors.elevated, padding: 12 },
  scopeSummaryText: { ...typography.caption, color: semanticColors.text },
  segmented: { flexDirection: 'row', borderWidth: 1, borderColor: semanticColors.border, borderRadius: 8, backgroundColor: color_pallet.cream[200], padding: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 6 },
  segmentActive: { backgroundColor: semanticColors.text },
  segmentText: { ...typography.caption, color: semanticColors.textMuted },
  segmentTextActive: { color: semanticColors.textInverse },
  panel: { borderWidth: 1, borderColor: semanticColors.border, borderRadius: 8, backgroundColor: semanticColors.elevated, padding: 14 },
  panelTitle: { ...typography.h3, color: semanticColors.text },
  panelHelp: { ...typography.caption, color: semanticColors.textMuted, marginTop: 3 },
  mixedNotice: { borderWidth: 1, borderColor: statusColors.warning.border, borderRadius: 8, backgroundColor: statusColors.warning.bg, padding: 12 },
  mixedText: { ...typography.body, color: statusColors.warning.text },
  previewHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modeSegmented: { alignSelf: 'flex-end', flexDirection: 'row', gap: 3, marginTop: 12, borderWidth: 1, borderColor: semanticColors.border, borderRadius: 8, padding: 3 },
  modeSegment: { minHeight: 34, minWidth: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 6 },
  modeSegmentActive: { backgroundColor: semanticColors.text },
  modeText: { ...typography.caption, color: semanticColors.textMuted },
  modeTextActive: { color: semanticColors.textInverse },
  previewModal: { flex: 1, backgroundColor: color_pallet.bg.DEFAULT, padding: 18 },
  previewModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12 },
  previewModalBody: { flex: 1, justifyContent: 'center' },
  realPreview: { marginTop: 12, width: '100%', aspectRatio: 4 / 3, minHeight: 420, overflow: 'hidden', borderWidth: 1, borderColor: semanticColors.border, borderRadius: 8, backgroundColor: '#000000' },
  previewWebView: { flex: 1, backgroundColor: '#000000' },
  historyRow: { gap: 9, alignItems: 'center', paddingTop: 12 },
  historySwatch: { width: 42, height: 42, borderRadius: 7, borderWidth: 1, borderColor: semanticColors.borderStrong },
  tokenList: { marginTop: 10, gap: 8 },
  tokenRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: semanticColors.border, borderRadius: 8, padding: 10 },
  tokenRowActive: { borderColor: semanticColors.primary },
  tokenSwatch: { width: 40, height: 40, borderRadius: 7, borderWidth: 1, borderColor: semanticColors.borderStrong },
  tokenLabel: { ...typography.caption, color: semanticColors.text, fontSize: 12 },
  colorCode: { ...typography.eyebrow, color: semanticColors.textMuted, fontSize: 11, paddingVertical: 3, textTransform: 'none' },
  saveButton: { minHeight: 50, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: semanticColors.text },
  saveButtonText: { ...typography.caption, color: semanticColors.textInverse },
  disabled: { opacity: 0.4 },
  message: { borderWidth: 1, borderRadius: 8, padding: 12 },
  messageError: { backgroundColor: statusColors.danger.bg, borderColor: statusColors.danger.border },
  messageSuccess: { backgroundColor: statusColors.success.bg, borderColor: statusColors.success.border },
  messageErrorText: { ...typography.body, color: statusColors.danger.text },
  messageSuccessText: { ...typography.body, color: statusColors.success.text },
  modalPage: { flex: 1, backgroundColor: color_pallet.bg.DEFAULT },
  modalHeader: { flexDirection: 'row', gap: 12, padding: 18, borderBottomWidth: 1, borderColor: semanticColors.border },
  modalTitle: { ...typography.h2, color: semanticColors.text, marginTop: 3 },
  modalContent: { padding: 16, paddingBottom: 28 },
  modalFooter: { minHeight: 72, borderTopWidth: 1, borderColor: semanticColors.border, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  iconButton: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: semanticColors.border, alignItems: 'center', justifyContent: 'center' },
  filterRow: { gap: 8, paddingBottom: 14 },
  filterPill: { height: 38, borderRadius: 999, borderWidth: 1, borderColor: semanticColors.border, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: semanticColors.elevated },
  filterPillActive: { backgroundColor: semanticColors.text, borderColor: semanticColors.text },
  filterText: { ...typography.caption, color: semanticColors.textMuted, fontSize: 11 },
  filterTextActive: { color: semanticColors.textInverse },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotLarge: { width: 14, height: 14, borderRadius: 7 },
  selectionList: { gap: 9 },
  selectionRow: { minHeight: 70, borderWidth: 1, borderColor: semanticColors.border, borderRadius: 8, backgroundColor: semanticColors.elevated, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  selectionRowActive: { borderColor: semanticColors.primary, backgroundColor: color_pallet.sky[50] },
  checkbox: { width: 22, height: 22, borderWidth: 1, borderColor: semanticColors.borderStrong, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: semanticColors.primary, borderColor: semanticColors.primary },
  selectionTitle: { ...typography.caption, color: semanticColors.text },
  selectionMeta: { ...typography.caption, color: semanticColors.textMuted },
  groupLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  primaryButton: { minHeight: 42, minWidth: 130, borderRadius: 8, backgroundColor: semanticColors.text, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryButtonText: { ...typography.caption, color: semanticColors.textInverse },
  pickerBackdrop: { flex: 1, backgroundColor: semanticColors.overlay, alignItems: 'center', justifyContent: 'center', padding: 18 },
  pickerCard: { width: '100%', maxWidth: 480, borderRadius: 8, backgroundColor: semanticColors.elevated, padding: 16, gap: 14 },
  pickerHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  colorPicker: { width: '100%', gap: 14 },
  colorPanel: { height: 230, borderRadius: 8 },
  hueSlider: { height: 30, borderRadius: 8 },
  pickerInput: { ...typography.eyebrow, textTransform: 'none', minHeight: 44, borderWidth: 1, borderColor: semanticColors.border, borderRadius: 8, paddingHorizontal: 12, color: semanticColors.text },
  componentId: { ...typography.eyebrow, textTransform: 'none', color: semanticColors.textMuted, marginTop: 4, fontSize: 9 },
  propertyRow: { flexDirection: 'row', gap: 7 },
  propertyButton: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: semanticColors.border, borderRadius: 7 },
  propertyButtonActive: { backgroundColor: semanticColors.text, borderColor: semanticColors.text },
  propertyText: { ...typography.caption, color: semanticColors.textMuted, fontSize: 11 },
  propertyTextActive: { color: semanticColors.textInverse },
  componentActions: { flexDirection: 'row', gap: 8 },
  componentAction: { minHeight: 42, flex: 1, borderRadius: 8, borderWidth: 1, borderColor: semanticColors.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  componentActionText: { ...typography.caption, color: semanticColors.text, textAlign: 'center' },
  removeOverride: { ...typography.caption, color: statusColors.danger.text, textAlign: 'center' },
});
