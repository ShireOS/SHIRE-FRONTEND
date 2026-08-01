import {
  createAdminModifier,
  createAdminMenuItem,
  fetchAdminModifiers,
  fetchAdminMenuItems,
  fetchMenuItemInsight,
  replaceAdminModifierItems,
  setMenuItemImageUrl,
  setMenuItemAvailability,
  updateAdminModifier,
  updateAdminMenuItem,
  type AdminModifier,
  type AdminMenuItem,
  type MenuItemInsight,
} from '@/api/menu';
import { MobilePricingWorkspace } from '@/components/MobilePricingWorkspace';
import { color_pallet, semanticColors, statusColors } from '@/styles/colors';
import { card, layout, radius, spacing } from '@/styles/tokens';
import { typography } from '@/styles/typography';
import { Feather } from '@expo/vector-icons';
import { rankModifierMatches } from '@shire/menu-search';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { fetchResellerPortfolio, getOwnerRestaurant, type OwnerRestaurant } from '../../packages/supabase';

type AvailabilityFilter = 'all' | 'available' | 'unavailable';
type MenuWorkspaceMode = 'items' | 'modifiers' | 'pricing' | 'availability';
type AvailabilityMode = NonNullable<AdminMenuItem['availability_mode']>;
type MenuItemForm = {
  name: string;
  category: string;
  price: string;
  description: string;
  imageUrl: string;
};

type ModifierForm = {
  name: string;
  price: string;
  category: string;
  notes: string;
  isActive: boolean;
  printsOnKitchenTicket: boolean;
  itemIds: Set<string>;
};

const FILTERS: { id: AvailabilityFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'available', label: 'Available' },
  { id: 'unavailable', label: "86'd" },
];

const AVAILABILITY_MODES: { id: AvailabilityMode; label: string }[] = [
  { id: 'always', label: 'Always' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'seasonal', label: 'Seasonal' },
  { id: 'manual', label: 'Manual' },
];

const DAY_OPTIONS = [
  { id: 0, label: 'Sun' },
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
];

const SERVICE_MODE_OPTIONS = ['Dine-in', 'Takeout', 'Delivery', 'Bar', 'Patio'];
const COURSE_OPTIONS: [NonNullable<AdminMenuItem['course_type']> | '', string][] = [
  ['', 'Default'],
  ['none', 'None'],
  ['appetizer', 'App'],
  ['entree', 'Entree'],
  ['dessert', 'Dessert'],
  ['drink', 'Drink'],
  ['side', 'Side'],
  ['other', 'Other'],
];
const FIRE_OPTIONS: [NonNullable<AdminMenuItem['fire_mode']> | '', string][] = [
  ['', 'Default'],
  ['inherit', 'Inherit'],
  ['immediate', 'Immediate'],
  ['hold', 'Hold'],
  ['manual', 'Manual'],
  ['by_course', 'By course'],
];

function formatCurrency(value: unknown) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(Number.isFinite(number) ? number : 0);
}

function isItemAvailable(item: AdminMenuItem) {
  return item.is_available !== false;
}

function sortMenuItems(rows: AdminMenuItem[]) {
  return [...rows].sort((a, b) => {
    const categoryCompare = (a.category || 'zz').localeCompare(b.category || 'zz');
    if (categoryCompare !== 0) return categoryCompare;
    return a.name.localeCompare(b.name);
  });
}

function mergeMenuItemUpdate(current: AdminMenuItem, updated: AdminMenuItem) {
  return {
    ...updated,
    image_url: updated.image_url ?? current.image_url ?? null,
  };
}

function formatNumber(value: number | null | undefined, suffix = '') {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'No data';
  return `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}${suffix}`;
}

const EMPTY_FORM: MenuItemForm = {
  name: '',
  category: '',
  price: '',
  description: '',
  imageUrl: '',
};

const emptyModifierForm = (name = ''): ModifierForm => ({
  name,
  price: '',
  category: '',
  notes: '',
  isActive: true,
  printsOnKitchenTicket: true,
  itemIds: new Set(),
});

export default function AdminMenu() {
  const [restaurant, setRestaurant] = useState<OwnerRestaurant | null>(null);
  const [restaurantOptions, setRestaurantOptions] = useState<OwnerRestaurant[]>([]);
  const [workspaceMode, setWorkspaceMode] = useState<MenuWorkspaceMode>('items');
  const [items, setItems] = useState<AdminMenuItem[]>([]);
  const [filter, setFilter] = useState<AvailabilityFilter>('all');
  const [query, setQuery] = useState('');
  const [pendingItemIds, setPendingItemIds] = useState<Set<string>>(() => new Set());
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [form, setForm] = useState<MenuItemForm>(EMPTY_FORM);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [selectedItem, setSelectedItem] = useState<AdminMenuItem | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<MenuItemInsight | null>(null);
  const [imageDraft, setImageDraft] = useState('');
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);
  const [isInsightLoading, setIsInsightLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const loadMenu = useCallback(async (options?: { refreshing?: boolean }) => {
    if (options?.refreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      let selectedRestaurant = restaurant ?? await getOwnerRestaurant();
      if (!selectedRestaurant) {
        const portfolio = await fetchResellerPortfolio();
        const options = portfolio.restaurants.map((row) => ({
          id: row.id,
          name: row.name || 'Restaurant',
          role: portfolio.employee ? 'reseller_employee' : 'reseller',
        }));
        setRestaurantOptions(options);
        selectedRestaurant = options[0] || null;
      } else if (!restaurantOptions.some((row) => row.id === selectedRestaurant?.id)) {
        setRestaurantOptions([selectedRestaurant]);
      }
      setRestaurant(selectedRestaurant);
      if (!selectedRestaurant?.id) {
        setItems([]);
        return;
      }
      setItems(sortMenuItems(await fetchAdminMenuItems(selectedRestaurant.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load menu.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [restaurant, restaurantOptions]);

  useEffect(() => {
    void loadMenu();
  }, [loadMenu]);

  const counts = useMemo(() => {
    const available = items.filter(isItemAvailable).length;
    return {
      available,
      unavailable: items.length - available,
      total: items.length,
    };
  }, [items]);

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      const available = isItemAvailable(item);
      if (filter === 'available' && !available) return false;
      if (filter === 'unavailable' && available) return false;
      if (!normalizedQuery) return true;
      return [item.name, item.category, item.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [filter, items, query]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, AdminMenuItem[]>();
    visibleItems.forEach((item) => {
      const category = item.category?.trim() || 'Uncategorized';
      groups.set(category, [...(groups.get(category) || []), item]);
    });
    return Array.from(groups.entries());
  }, [visibleItems]);

  const toggleAvailability = async (item: AdminMenuItem) => {
    if (!restaurant?.id || pendingItemIds.has(item.id)) return;
    const nextAvailable = !isItemAvailable(item);
    const previousItems = items;

    setPendingItemIds((current) => new Set(current).add(item.id));
    setItems((current) => current.map((row) => (
      row.id === item.id
        ? { ...row, is_available: nextAvailable, updated_at: new Date().toISOString() }
        : row
    )));
    setError(null);

    try {
      const updated = await setMenuItemAvailability(restaurant.id, item.id, nextAvailable);
      if (updated) {
        setItems((current) => current.map((row) => (
          row.id === item.id ? mergeMenuItemUpdate(row, updated) : row
        )));
        setSelectedItem((current) => (
          current?.id === item.id ? mergeMenuItemUpdate(current, updated) : current
        ));
      }
    } catch (err) {
      setItems(previousItems);
      setError(err instanceof Error ? err.message : 'Could not sync menu item.');
    } finally {
      setPendingItemIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  };

  const openItem = (item: AdminMenuItem) => {
    setSelectedItem(item);
    setSelectedInsight(null);
    setImageDraft(item.image_url || '');
    if (!restaurant?.id) return;
    setIsInsightLoading(true);
    fetchMenuItemInsight(restaurant.id, item)
      .then(setSelectedInsight)
      .catch(() => setSelectedInsight(null))
      .finally(() => setIsInsightLoading(false));
  };

  const closeAddModal = () => {
    if (isSavingItem) return;
    setIsAddModalVisible(false);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const submitNewItem = async () => {
    if (!restaurant?.id || isSavingItem) return;
    const priceText = form.price.trim();
    const price = Number(priceText);
    if (!form.name.trim()) {
      setFormError('Item name is required.');
      return;
    }
    if (!priceText || !Number.isFinite(price) || price < 0) {
      setFormError('Enter a valid price.');
      return;
    }

    setIsSavingItem(true);
    setFormError(null);
    setError(null);
    try {
      const created = await createAdminMenuItem(restaurant.id, {
        name: form.name,
        category: form.category || 'Other',
        price,
        description: form.description,
        is_available: true,
        image_url: form.imageUrl,
      });
      setItems((current) => sortMenuItems([...current, created]));
      setSelectedItem(created);
      setSelectedInsight(null);
      setIsAddModalVisible(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add item.');
    } finally {
      setIsSavingItem(false);
    }
  };

  const saveSelectedImage = async () => {
    if (!restaurant?.id || !selectedItem || isSavingImage) return;
    setIsSavingImage(true);
    setError(null);
    try {
      await setMenuItemImageUrl(restaurant.id, selectedItem.id, imageDraft || null);
      const imageUrl = imageDraft.trim() || null;
      setItems((current) => current.map((row) => (
        row.id === selectedItem.id ? { ...row, image_url: imageUrl } : row
      )));
      setSelectedItem((current) => (current ? { ...current, image_url: imageUrl } : current));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save image.');
    } finally {
      setIsSavingImage(false);
    }
  };

  const updateSelectedAvailability = (patch: Partial<AdminMenuItem>) => {
    setSelectedItem((current) => (current ? { ...current, ...patch } : current));
  };

  const saveSelectedAvailability = async () => {
    if (!restaurant?.id || !selectedItem || isSavingAvailability) return;
    setIsSavingAvailability(true);
    setError(null);
    try {
      const updated = await updateAdminMenuItem(restaurant.id, selectedItem.id, {
        availability_mode: selectedItem.availability_mode || 'always',
        availability_days: selectedItem.availability_days?.length
          ? selectedItem.availability_days
          : [0, 1, 2, 3, 4, 5, 6],
        availability_start_time: selectedItem.availability_start_time || null,
        availability_end_time: selectedItem.availability_end_time || null,
        availability_service_modes: selectedItem.availability_service_modes || [],
        availability_start_date: selectedItem.availability_start_date || null,
        availability_end_date: selectedItem.availability_end_date || null,
        availability_notes: selectedItem.availability_notes || null,
        course_type: selectedItem.course_type || null,
        fire_mode: selectedItem.fire_mode || null,
        routing_station_id: selectedItem.routing_station_id || null,
        prep_time_minutes: selectedItem.prep_time_minutes === '' || selectedItem.prep_time_minutes == null
          ? null
          : Number(selectedItem.prep_time_minutes),
        kds_display_group: selectedItem.kds_display_group || null,
        item_routing_notes: selectedItem.item_routing_notes || null,
      });
      setItems((current) => current.map((row) => (
        row.id === selectedItem.id ? mergeMenuItemUpdate(row, updated) : row
      )));
      setSelectedItem((current) => (current ? mergeMenuItemUpdate(current, updated) : current));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save item availability.');
    } finally {
      setIsSavingAvailability(false);
    }
  };

  const showsItemWorkspace = workspaceMode === 'items' || workspaceMode === 'availability';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={(
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => void loadMenu({ refreshing: true })}
          tintColor={color_pallet.ink[700]}
        />
      )}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heading}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.eyebrow, styles.eyebrow]}>
            {restaurant?.name || 'Restaurant'}
          </Text>
          <Text style={[typography.h2, styles.title]}>Menu</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconButton} onPress={() => void loadMenu({ refreshing: true })}>
            <Feather name="refresh-cw" size={18} color={color_pallet.ink[700]} />
          </Pressable>
          {workspaceMode === 'items' && <Pressable style={styles.addButton} onPress={() => setIsAddModalVisible(true)}>
            <Feather name="plus" size={18} color={color_pallet.cream[50]} />
            <Text style={[typography.caption, styles.addButtonText]}>Add</Text>
          </Pressable>}
        </View>
      </View>

      {restaurantOptions.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.restaurantOptions}>
          {restaurantOptions.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => {
                if (option.id === restaurant?.id) return;
                setRestaurant(option);
                setItems([]);
                setSelectedItem(null);
              }}
              style={[styles.restaurantOption, option.id === restaurant?.id && styles.restaurantOptionActive]}
            >
              <Text style={[styles.restaurantOptionText, option.id === restaurant?.id && styles.restaurantOptionTextActive]}>{option.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <View style={styles.workspaceTabs}>
        {([
          ['items', 'Items'],
          ['modifiers', 'Modifiers'],
          ['pricing', 'Pricing'],
          ['availability', 'Availability'],
        ] as const).map(([id, label]) => (
          <Pressable key={id} onPress={() => setWorkspaceMode(id)} style={[styles.workspaceTab, workspaceMode === id && styles.workspaceTabActive]}>
            <Text style={[styles.workspaceTabText, workspaceMode === id && styles.workspaceTabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {workspaceMode === 'pricing' && restaurant?.id ? <MobilePricingWorkspace restaurantId={restaurant.id} /> : null}

      {workspaceMode === 'modifiers' && restaurant?.id ? (
        <MobileModifierWorkspace restaurantId={restaurant.id} menuItems={items} />
      ) : null}

      {showsItemWorkspace && <View style={styles.summaryRow}>
        <SummaryPill label="Items" value={counts.total} />
        <SummaryPill label="Available" value={counts.available} tone="success" />
        <SummaryPill label="86'd" value={counts.unavailable} tone="warning" />
      </View>}

      {showsItemWorkspace && <View style={styles.searchWrap}>
        <Feather name="search" size={17} color={color_pallet.ink[500]} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search items"
          placeholderTextColor={color_pallet.ink[400]}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} style={styles.clearButton}>
            <Feather name="x" size={16} color={color_pallet.ink[500]} />
          </Pressable>
        )}
      </View>}

      {showsItemWorkspace && <View style={styles.filterRow}>
        {FILTERS.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => setFilter(item.id)}
            style={[styles.filterPill, filter === item.id && styles.filterPillActive]}
          >
            <Text style={[styles.filterText, filter === item.id && styles.filterTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>}

      {showsItemWorkspace && isLoading && (
        <View style={styles.stateCard}>
          <Text style={[typography.bodySmall, styles.stateText]}>Loading menu...</Text>
        </View>
      )}

      {showsItemWorkspace && error && (
        <View style={styles.errorCard}>
          <Text style={[typography.caption, styles.errorTitle]}>Menu sync needs attention</Text>
          <Text style={[typography.bodySmall, styles.errorCopy]}>{error}</Text>
        </View>
      )}

      {showsItemWorkspace && !isLoading && groupedItems.length === 0 && (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Feather name="coffee" size={22} color={color_pallet.ink[600]} />
          </View>
          <Text style={[typography.h3, styles.emptyTitle]}>
            {items.length === 0 ? 'No menu items yet' : 'No matching items'}
          </Text>
          <Text style={[typography.bodySmall, styles.emptyCopy]}>
            {items.length === 0
              ? 'Add or import items from the web setup flow, then they will show here for quick 86 controls.'
              : 'Try a different search or filter.'}
          </Text>
        </View>
      )}

      {showsItemWorkspace && !isLoading && groupedItems.map(([category, categoryItems]) => (
        <View key={category} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[typography.h3, styles.sectionTitle]}>{category}</Text>
            <Text style={[typography.caption, styles.sectionHint]}>
              {categoryItems.length} item{categoryItems.length === 1 ? '' : 's'}
            </Text>
          </View>
          {categoryItems.map((item) => (
            <MenuItemRow
              key={item.id}
              item={item}
              pending={pendingItemIds.has(item.id)}
              onPress={() => openItem(item)}
              onToggle={() => void toggleAvailability(item)}
            />
          ))}
        </View>
      ))}
      <AddItemModal
        form={form}
        error={formError}
        isSaving={isSavingItem}
        visible={isAddModalVisible}
        onChange={setForm}
        onClose={closeAddModal}
        onSubmit={() => void submitNewItem()}
      />
      <ItemDetailModal
        insight={selectedInsight}
        isLoading={isInsightLoading}
        imageDraft={imageDraft}
        isSavingAvailability={isSavingAvailability}
        isSavingImage={isSavingImage}
        item={selectedItem}
        pending={selectedItem ? pendingItemIds.has(selectedItem.id) : false}
        onChangeImage={setImageDraft}
        onChangeAvailability={updateSelectedAvailability}
        onClose={() => setSelectedItem(null)}
        onSaveAvailability={() => void saveSelectedAvailability()}
        onSaveImage={() => void saveSelectedImage()}
        onToggle={() => {
          if (selectedItem) void toggleAvailability(selectedItem);
        }}
      />
    </ScrollView>
  );
}

function MobileModifierWorkspace({
  restaurantId,
  menuItems,
}: {
  restaurantId: string;
  menuItems: AdminMenuItem[];
}) {
  const [modifiers, setModifiers] = useState<AdminModifier[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<AdminModifier | null>(null);
  const [form, setForm] = useState<ModifierForm>(() => emptyModifierForm());
  const [editorVisible, setEditorVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setModifiers(await fetchAdminModifiers(restaurantId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load modifiers.');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const matches = useMemo(() => rankModifierMatches(modifiers, query, {
    aliases: (modifier) => [modifier.group_name],
  }), [modifiers, query]);

  const openCreate = (name = '') => {
    setSelected(null);
    setForm(emptyModifierForm(name));
    setError(null);
    setEditorVisible(true);
  };

  const openModifier = (modifier: AdminModifier) => {
    setSelected(modifier);
    setForm({
      name: modifier.name,
      price: String(modifier.price_delta || ''),
      category: modifier.group_name,
      notes: modifier.modifier_notes || '',
      isActive: modifier.is_active,
      printsOnKitchenTicket: modifier.print_on_kitchen_ticket,
      itemIds: new Set(modifier.item_ids),
    });
    setError(null);
    setEditorVisible(true);
  };

  const save = async () => {
    if (saving) return;
    const name = form.name.trim();
    const price = Number(form.price || 0);
    if (!name) {
      setError('Modifier name is required.');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setError('Enter a valid non-negative price.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name,
        price_delta: price,
        group_name: form.category.trim() || 'Add-ons',
        modifier_notes: form.notes.trim() || null,
        is_active: form.isActive,
        print_on_kitchen_ticket: form.printsOnKitchenTicket,
      };
      let saved = selected
        ? await updateAdminModifier(restaurantId, selected.id, payload)
        : await createAdminModifier(restaurantId, payload);
      saved = await replaceAdminModifierItems(restaurantId, saved.id, Array.from(form.itemIds));
      setModifiers((current) => {
        const next = current.some((modifier) => modifier.id === saved.id)
          ? current.map((modifier) => (modifier.id === saved.id ? saved : modifier))
          : [...current, saved];
        return next.sort((left, right) => (
          left.group_name.localeCompare(right.group_name) || left.name.localeCompare(right.name)
        ));
      });
      setEditorVisible(false);
      setSelected(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save modifier.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.modifierWorkspace}>
      <View style={styles.modifierToolbar}>
        <View>
          <Text style={[typography.h3, styles.sectionTitle]}>Modifier library</Text>
          <Text style={[typography.caption, styles.sectionHint]}>{modifiers.length} configured</Text>
        </View>
        <Pressable style={styles.addButton} onPress={() => openCreate()}>
          <Feather name="plus" size={18} color={color_pallet.cream[50]} />
          <Text style={[typography.caption, styles.addButtonText]}>Add</Text>
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Feather name="search" size={17} color={color_pallet.ink[500]} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search modifiers or categories"
          placeholderTextColor={color_pallet.ink[400]}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable accessibilityLabel="Clear modifier search" onPress={() => setQuery('')} style={styles.clearButton}>
            <Feather name="x" size={16} color={color_pallet.ink[500]} />
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator size="small" color={color_pallet.ink[700]} />
        </View>
      ) : null}
      {error && !editorVisible ? (
        <View style={styles.errorCard}>
          <Text style={[typography.bodySmall, styles.errorCopy]}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.inlineAction}>
            <Text style={[typography.caption, styles.inlineActionText]}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && modifiers.length === 0 ? (
        <View style={styles.emptyCard}>
          <Feather name="sliders" size={24} color={color_pallet.ink[600]} />
          <Text style={[typography.h3, styles.emptyTitle]}>No modifiers yet</Text>
          <Pressable onPress={() => openCreate()} style={styles.inlineAction}>
            <Text style={[typography.caption, styles.inlineActionText]}>Add the first modifier</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && modifiers.length > 0 && matches.length === 0 ? (
        <View style={styles.emptyCard}>
          <Feather name="search" size={24} color={color_pallet.ink[600]} />
          <Text style={[typography.h3, styles.emptyTitle]}>No matching modifiers found</Text>
          <Pressable onPress={() => openCreate(query.trim())} style={styles.inlineAction}>
            <Text style={[typography.caption, styles.inlineActionText]}>Create “{query.trim()}”</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && matches.map(({ modifier }) => (
        <Pressable key={modifier.id} onPress={() => openModifier(modifier)} style={styles.modifierRow}>
          <View style={styles.modifierIcon}>
            <Feather name="sliders" size={17} color={color_pallet.ink[700]} />
          </View>
          <View style={styles.itemBody}>
            <View style={styles.itemTitleRow}>
              <Text numberOfLines={1} style={[typography.title, styles.itemName]}>{modifier.name}</Text>
              {!modifier.is_active ? (
                <View style={[styles.statusBadge, styles.statusBadgeUnavailable]}>
                  <Text style={[typography.eyebrow, styles.statusBadgeText, styles.statusBadgeTextUnavailable]}>Inactive</Text>
                </View>
              ) : null}
            </View>
            <Text style={[typography.caption, styles.itemMeta]}>
              {modifier.group_name} · {formatCurrency(modifier.price_delta)} · {modifier.item_ids.length} item{modifier.item_ids.length === 1 ? '' : 's'}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={color_pallet.ink[500]} />
        </Pressable>
      ))}

      <ModifierEditorModal
        error={editorVisible ? error : null}
        form={form}
        isSaving={saving}
        menuItems={menuItems}
        title={selected ? 'Edit modifier' : 'New modifier'}
        visible={editorVisible}
        onChange={setForm}
        onClose={() => {
          if (!saving) setEditorVisible(false);
        }}
        onSave={() => void save()}
      />
    </View>
  );
}

function ModifierEditorModal({
  error,
  form,
  isSaving,
  menuItems,
  title,
  visible,
  onChange,
  onClose,
  onSave,
}: {
  error: string | null;
  form: ModifierForm;
  isSaving: boolean;
  menuItems: AdminMenuItem[];
  title: string;
  visible: boolean;
  onChange: (next: ModifierForm) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const patch = (next: Partial<ModifierForm>) => onChange({ ...form, ...next });
  const toggleItem = (itemId: string) => {
    const next = new Set(form.itemIds);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    patch({ itemIds: next });
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.eyebrow, styles.eyebrow]}>Menu modifier</Text>
              <Text style={[typography.h2, styles.sheetTitle]}>{title}</Text>
            </View>
            <Pressable style={styles.iconButton} onPress={onClose}>
              <Feather name="x" size={18} color={color_pallet.ink[700]} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.sheetScroll}>
            <FieldLabel label="Name" />
            <TextInput
              value={form.name}
              onChangeText={(value) => patch({ name: value })}
              placeholder="Extra cheese"
              placeholderTextColor={color_pallet.ink[400]}
              style={styles.fieldInput}
            />
            <View style={styles.formRow}>
              <View style={styles.formColumn}>
                <FieldLabel label="Category" />
                <TextInput
                  value={form.category}
                  onChangeText={(value) => patch({ category: value })}
                  placeholder="Cheese"
                  placeholderTextColor={color_pallet.ink[400]}
                  style={styles.fieldInput}
                />
              </View>
              <View style={styles.priceColumn}>
                <FieldLabel label="Price +$" />
                <TextInput
                  value={form.price}
                  onChangeText={(value) => patch({ price: value.replace(/[^\d.]/g, '') })}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={color_pallet.ink[400]}
                  style={styles.fieldInput}
                />
              </View>
            </View>
            <FieldLabel label="Notes" />
            <TextInput
              value={form.notes}
              onChangeText={(value) => patch({ notes: value })}
              multiline
              placeholder="Optional preparation note"
              placeholderTextColor={color_pallet.ink[400]}
              style={[styles.fieldInput, styles.descriptionInput]}
            />
            <View style={styles.modifierToggleRow}>
              <ToggleSetting
                active={form.isActive}
                label="Available"
                onPress={() => patch({ isActive: !form.isActive })}
              />
              <ToggleSetting
                active={form.printsOnKitchenTicket}
                label="Prints in kitchen"
                onPress={() => patch({ printsOnKitchenTicket: !form.printsOnKitchenTicket })}
              />
            </View>

            <View style={styles.modifierItemsHeader}>
              <FieldLabel label={`Applies to (${form.itemIds.size})`} />
              <Pressable
                onPress={() => patch({
                  itemIds: form.itemIds.size === menuItems.length
                    ? new Set()
                    : new Set(menuItems.map((item) => item.id)),
                })}
              >
                <Text style={[typography.caption, styles.inlineActionText]}>
                  {form.itemIds.size === menuItems.length ? 'Clear all' : 'Select all'}
                </Text>
              </Pressable>
            </View>
            <View style={styles.modifierItemList}>
              {menuItems.map((item) => {
                const active = form.itemIds.has(item.id);
                return (
                  <Pressable key={item.id} onPress={() => toggleItem(item.id)} style={styles.modifierItemOption}>
                    <Feather
                      name={active ? 'check-square' : 'square'}
                      size={18}
                      color={active ? color_pallet.elevated.dark : color_pallet.ink[500]}
                    />
                    <Text style={[typography.bodySmall, styles.modifierItemName]}>{item.name}</Text>
                    <Text style={[typography.caption, styles.sectionHint]}>{item.category || 'Other'}</Text>
                  </Pressable>
                );
              })}
            </View>

            {error ? (
              <View style={styles.inlineError}>
                <Text style={[typography.caption, styles.errorCopy]}>{error}</Text>
              </View>
            ) : null}
            <Pressable disabled={isSaving} onPress={onSave} style={[styles.primaryAction, isSaving && styles.disabledButton]}>
              {isSaving ? <ActivityIndicator size="small" color={color_pallet.cream[50]} /> : <Feather name="save" size={17} color={color_pallet.cream[50]} />}
              <Text style={[typography.caption, styles.primaryActionText]}>{isSaving ? 'Saving' : 'Save modifier'}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ToggleSetting({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.modifierToggle, active && styles.modifierToggleActive]}>
      <Feather name={active ? 'check-circle' : 'circle'} size={16} color={active ? color_pallet.cream[50] : color_pallet.ink[600]} />
      <Text style={[typography.caption, styles.modifierToggleText, active && styles.modifierToggleTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SummaryPill({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  const toneStyle = tone === 'success'
    ? styles.summaryPillSuccess
    : tone === 'warning'
      ? styles.summaryPillWarning
      : undefined;

  return (
    <View style={[styles.summaryPill, toneStyle]}>
      <Text style={[typography.eyebrow, styles.summaryLabel]}>{label}</Text>
      <Text style={[typography.title, styles.summaryValue]}>{value}</Text>
    </View>
  );
}

function MenuItemRow({
  item,
  pending,
  onPress,
  onToggle,
}: {
  item: AdminMenuItem;
  pending: boolean;
  onPress: () => void;
  onToggle: () => void;
}) {
  const available = isItemAvailable(item);

  return (
    <Pressable onPress={onPress} style={[styles.itemRow, !available && styles.itemRowUnavailable]}>
      <MenuItemImage item={item} size={62} />
      <View style={styles.itemBody}>
        <View style={styles.itemTitleRow}>
          <Text numberOfLines={1} style={[typography.title, styles.itemName, !available && styles.mutedText]}>
            {item.name}
          </Text>
          <View style={[
            styles.statusBadge,
            available ? styles.statusBadgeAvailable : styles.statusBadgeUnavailable,
          ]}>
            <Text style={[
              typography.eyebrow,
              styles.statusBadgeText,
              available ? styles.statusBadgeTextAvailable : styles.statusBadgeTextUnavailable,
            ]}>
              {pending ? 'Syncing' : available ? 'Available' : "86'd"}
            </Text>
          </View>
        </View>
        <Text style={[typography.caption, styles.itemMeta]} numberOfLines={1}>
          {formatCurrency(item.price)}{item.description ? ` · ${item.description}` : ''}
        </Text>
      </View>
      <Pressable
        disabled={pending}
        onPress={onToggle}
        style={[styles.toggleButton, !available && styles.restoreButton, pending && styles.disabledButton]}
      >
        <Feather
          name={available ? 'slash' : 'rotate-ccw'}
          size={15}
          color={available ? color_pallet.danger[700] : color_pallet.success[700]}
        />
        <Text style={[typography.caption, styles.toggleButtonText, !available && styles.restoreButtonText]}>
          {available ? '86' : 'Restore'}
        </Text>
      </Pressable>
    </Pressable>
  );
}

function AddItemModal({
  error,
  form,
  isSaving,
  visible,
  onChange,
  onClose,
  onSubmit,
}: {
  error: string | null;
  form: MenuItemForm;
  isSaving: boolean;
  visible: boolean;
  onChange: (next: MenuItemForm) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const updateField = (field: keyof MenuItemForm, value: string) => {
    onChange({ ...form, [field]: value });
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={[typography.eyebrow, styles.eyebrow]}>New item</Text>
              <Text style={[typography.h2, styles.sheetTitle]}>Add Menu Item</Text>
            </View>
            <Pressable style={styles.iconButton} onPress={onClose}>
              <Feather name="x" size={18} color={color_pallet.ink[700]} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.sheetScroll}
          >
            <FieldLabel label="Name" />
            <TextInput
              value={form.name}
              onChangeText={(value) => updateField('name', value)}
              placeholder="Chicken sandwich"
              placeholderTextColor={color_pallet.ink[400]}
              style={styles.fieldInput}
            />

            <View style={styles.formRow}>
              <View style={styles.formColumn}>
                <FieldLabel label="Category" />
                <TextInput
                  value={form.category}
                  onChangeText={(value) => updateField('category', value)}
                  placeholder="Entrees"
                  placeholderTextColor={color_pallet.ink[400]}
                  style={styles.fieldInput}
                />
              </View>
              <View style={styles.priceColumn}>
                <FieldLabel label="Price" />
                <TextInput
                  value={form.price}
                  onChangeText={(value) => updateField('price', value)}
                  keyboardType="decimal-pad"
                  placeholder="12.00"
                  placeholderTextColor={color_pallet.ink[400]}
                  style={styles.fieldInput}
                />
              </View>
            </View>

            <FieldLabel label="Description" />
            <TextInput
              value={form.description}
              onChangeText={(value) => updateField('description', value)}
              multiline
              placeholder="Optional"
              placeholderTextColor={color_pallet.ink[400]}
              style={[styles.fieldInput, styles.descriptionInput]}
            />

            <FieldLabel label="Image URL" />
            <TextInput
              value={form.imageUrl}
              onChangeText={(value) => updateField('imageUrl', value)}
              autoCapitalize="none"
              keyboardType="url"
              placeholder="https://..."
              placeholderTextColor={color_pallet.ink[400]}
              style={styles.fieldInput}
            />

            {error && (
              <View style={styles.inlineError}>
                <Text style={[typography.caption, styles.errorCopy]}>{error}</Text>
              </View>
            )}

            <Pressable
              disabled={isSaving}
              onPress={onSubmit}
              style={[styles.primaryAction, isSaving && styles.disabledButton]}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={color_pallet.cream[50]} />
              ) : (
                <Feather name="plus" size={17} color={color_pallet.cream[50]} />
              )}
              <Text style={[typography.caption, styles.primaryActionText]}>
                {isSaving ? 'Saving' : 'Add item'}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ItemDetailModal({
  insight,
  imageDraft,
  isLoading,
  isSavingAvailability,
  isSavingImage,
  item,
  pending,
  onChangeAvailability,
  onChangeImage,
  onClose,
  onSaveAvailability,
  onSaveImage,
  onToggle,
}: {
  insight: MenuItemInsight | null;
  imageDraft: string;
  isLoading: boolean;
  isSavingAvailability: boolean;
  isSavingImage: boolean;
  item: AdminMenuItem | null;
  pending: boolean;
  onChangeAvailability: (patch: Partial<AdminMenuItem>) => void;
  onChangeImage: (value: string) => void;
  onClose: () => void;
  onSaveAvailability: () => void;
  onSaveImage: () => void;
  onToggle: () => void;
}) {
  if (!item) return null;
  const available = isItemAvailable(item);
  const availabilityMode = item.availability_mode || 'always';
  const availabilityDays = item.availability_days?.length ? item.availability_days : [0, 1, 2, 3, 4, 5, 6];
  const serviceModes = item.availability_service_modes || [];

  const toggleDay = (day: number) => {
    const nextDays = availabilityDays.includes(day)
      ? availabilityDays.filter((value) => value !== day)
      : [...availabilityDays, day].sort((a, b) => a - b);
    onChangeAvailability({ availability_days: nextDays });
  };

  const toggleServiceMode = (mode: string) => {
    const nextModes = serviceModes.includes(mode)
      ? serviceModes.filter((value) => value !== mode)
      : [...serviceModes, mode];
    onChangeAvailability({ availability_service_modes: nextModes });
  };

  return (
    <Modal animationType="slide" transparent visible={Boolean(item)} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <MenuItemImage item={{ ...item, image_url: imageDraft || item.image_url }} size={82} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.eyebrow, styles.eyebrow]}>{item.category || 'Uncategorized'}</Text>
              <Text style={[typography.h2, styles.sheetTitle]}>{item.name}</Text>
              <Text style={[typography.caption, styles.itemMeta]}>{formatCurrency(item.price)}</Text>
            </View>
            <Pressable style={styles.iconButton} onPress={onClose}>
              <Feather name="x" size={18} color={color_pallet.ink[700]} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.sheetScroll}
          >
            {item.description ? (
              <Text style={[typography.bodySmall, styles.detailCopy]}>{item.description}</Text>
            ) : null}

            <View style={styles.imageConfigBox}>
              <FieldLabel label="Image URL" />
              <View style={styles.imageConfigRow}>
                <TextInput
                  value={imageDraft}
                  onChangeText={onChangeImage}
                  autoCapitalize="none"
                  keyboardType="url"
                  placeholder="https://..."
                  placeholderTextColor={color_pallet.ink[400]}
                  style={[styles.fieldInput, styles.imageConfigInput]}
                />
                <Pressable
                  disabled={isSavingImage}
                  onPress={onSaveImage}
                  style={[styles.saveImageButton, isSavingImage && styles.disabledButton]}
                >
                  {isSavingImage ? (
                    <ActivityIndicator size="small" color={color_pallet.cream[50]} />
                  ) : (
                    <Feather name="image" size={16} color={color_pallet.cream[50]} />
                  )}
                </Pressable>
              </View>
            </View>

            <View style={styles.detailStatusRow}>
              <View style={[
                styles.statusBadge,
                available ? styles.statusBadgeAvailable : styles.statusBadgeUnavailable,
              ]}>
                <Text style={[
                  typography.eyebrow,
                  styles.statusBadgeText,
                  available ? styles.statusBadgeTextAvailable : styles.statusBadgeTextUnavailable,
                ]}>
                  {available ? 'Available' : "86'd"}
                </Text>
              </View>
              <Pressable
                disabled={pending}
                onPress={onToggle}
                style={[styles.toggleButton, !available && styles.restoreButton, pending && styles.disabledButton]}
              >
                <Feather
                  name={available ? 'slash' : 'rotate-ccw'}
                  size={15}
                  color={available ? color_pallet.danger[700] : color_pallet.success[700]}
                />
                <Text style={[typography.caption, styles.toggleButtonText, !available && styles.restoreButtonText]}>
                  {available ? '86' : 'Restore'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.availabilityBox}>
              <View style={styles.availabilityHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.eyebrow, styles.eyebrow]}>Availability</Text>
                  <Text style={[typography.caption, styles.availabilityHint]}>
                    Controls when this item can be sold.
                  </Text>
                </View>
                <Pressable
                  disabled={isSavingAvailability}
                  onPress={onSaveAvailability}
                  style={[styles.saveAvailabilityButton, isSavingAvailability && styles.disabledButton]}
                >
                  {isSavingAvailability ? (
                    <ActivityIndicator size="small" color={color_pallet.cream[50]} />
                  ) : (
                    <Feather name="save" size={15} color={color_pallet.cream[50]} />
                  )}
                  <Text style={[typography.caption, styles.saveAvailabilityText]}>
                    Save
                  </Text>
                </Pressable>
              </View>

              <View style={styles.choiceWrap}>
                {AVAILABILITY_MODES.map((mode) => (
                  <Pressable
                    key={mode.id}
                    onPress={() => onChangeAvailability({ availability_mode: mode.id })}
                    style={[
                      styles.choicePill,
                      availabilityMode === mode.id && styles.choicePillActive,
                    ]}
                  >
                    <Text style={[
                      styles.choiceText,
                      availabilityMode === mode.id && styles.choiceTextActive,
                    ]}>
                      {mode.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {availabilityMode === 'schedule' && (
                <View style={styles.availabilitySection}>
                  <FieldLabel label="Days" />
                  <View style={styles.choiceWrap}>
                    {DAY_OPTIONS.map((day) => {
                      const selected = availabilityDays.includes(day.id);
                      return (
                        <Pressable
                          key={day.id}
                          onPress={() => toggleDay(day.id)}
                          style={[styles.dayPill, selected && styles.choicePillActive]}
                        >
                          <Text style={[styles.choiceText, selected && styles.choiceTextActive]}>
                            {day.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={styles.formRow}>
                    <View style={styles.formColumn}>
                      <FieldLabel label="Start time" />
                      <TextInput
                        value={item.availability_start_time || ''}
                        onChangeText={(value) => onChangeAvailability({ availability_start_time: value })}
                        placeholder="09:00"
                        placeholderTextColor={color_pallet.ink[400]}
                        style={styles.fieldInput}
                      />
                    </View>
                    <View style={styles.formColumn}>
                      <FieldLabel label="End time" />
                      <TextInput
                        value={item.availability_end_time || ''}
                        onChangeText={(value) => onChangeAvailability({ availability_end_time: value })}
                        placeholder="22:00"
                        placeholderTextColor={color_pallet.ink[400]}
                        style={styles.fieldInput}
                      />
                    </View>
                  </View>
                </View>
              )}

              {availabilityMode === 'seasonal' && (
                <View style={styles.availabilitySection}>
                  <View style={styles.formRow}>
                    <View style={styles.formColumn}>
                      <FieldLabel label="Start date" />
                      <TextInput
                        value={item.availability_start_date || ''}
                        onChangeText={(value) => onChangeAvailability({ availability_start_date: value })}
                        placeholder="2026-06-01"
                        placeholderTextColor={color_pallet.ink[400]}
                        style={styles.fieldInput}
                      />
                    </View>
                    <View style={styles.formColumn}>
                      <FieldLabel label="End date" />
                      <TextInput
                        value={item.availability_end_date || ''}
                        onChangeText={(value) => onChangeAvailability({ availability_end_date: value })}
                        placeholder="2026-08-31"
                        placeholderTextColor={color_pallet.ink[400]}
                        style={styles.fieldInput}
                      />
                    </View>
                  </View>
                </View>
              )}

              {(availabilityMode === 'schedule' || availabilityMode === 'seasonal') && (
                <View style={styles.availabilitySection}>
                  <FieldLabel label="Service modes" />
                  <View style={styles.choiceWrap}>
                    {SERVICE_MODE_OPTIONS.map((mode) => {
                      const selected = serviceModes.includes(mode);
                      return (
                        <Pressable
                          key={mode}
                          onPress={() => toggleServiceMode(mode)}
                          style={[styles.choicePill, selected && styles.choicePillActive]}
                        >
                          <Text style={[styles.choiceText, selected && styles.choiceTextActive]}>
                            {mode}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              <FieldLabel label="Notes" />
              <TextInput
                value={item.availability_notes || ''}
                onChangeText={(value) => onChangeAvailability({ availability_notes: value })}
                multiline
                placeholder="Happy hour only, weekend brunch, seasonal prep note..."
                placeholderTextColor={color_pallet.ink[400]}
                style={[styles.fieldInput, styles.descriptionInput]}
              />
              <FieldLabel label="Course" />
              <View style={styles.choiceWrap}>
                {COURSE_OPTIONS.map(([value, label]) => {
                  const selected = (item.course_type || '') === value;
                  return (
                    <Pressable
                      key={value || 'default'}
                      onPress={() => onChangeAvailability({ course_type: value || null })}
                      style={[styles.choicePill, selected && styles.choicePillActive]}
                    >
                      <Text style={[styles.choiceText, selected && styles.choiceTextActive]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <FieldLabel label="Fire mode" />
              <View style={styles.choiceWrap}>
                {FIRE_OPTIONS.map(([value, label]) => {
                  const selected = (item.fire_mode || '') === value;
                  return (
                    <Pressable
                      key={value || 'default'}
                      onPress={() => onChangeAvailability({ fire_mode: value || null })}
                      style={[styles.choicePill, selected && styles.choicePillActive]}
                    >
                      <Text style={[styles.choiceText, selected && styles.choiceTextActive]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.formRow}>
                <View style={styles.formColumn}>
                  <FieldLabel label="Prep minutes" />
                  <TextInput
                    value={item.prep_time_minutes == null ? '' : String(item.prep_time_minutes)}
                    onChangeText={(value) => onChangeAvailability({ prep_time_minutes: value.replace(/[^\d]/g, '').slice(0, 3) })}
                    placeholder="12"
                    keyboardType="number-pad"
                    placeholderTextColor={color_pallet.ink[400]}
                    style={styles.fieldInput}
                  />
                </View>
                <View style={styles.formColumn}>
                  <FieldLabel label="KDS group" />
                  <TextInput
                    value={item.kds_display_group || ''}
                    onChangeText={(value) => onChangeAvailability({ kds_display_group: value })}
                    placeholder="Grill"
                    placeholderTextColor={color_pallet.ink[400]}
                    style={styles.fieldInput}
                  />
                </View>
              </View>
              <FieldLabel label="Routing notes" />
              <TextInput
                value={item.item_routing_notes || ''}
                onChangeText={(value) => onChangeAvailability({ item_routing_notes: value })}
                multiline
                placeholder="Expo note, bar garnish, special printer note..."
                placeholderTextColor={color_pallet.ink[400]}
                style={[styles.fieldInput, styles.descriptionInput]}
              />
            </View>

            <View style={styles.metricsGrid}>
              <MetricTile label="Ordered" value={formatNumber(insight?.times_ordered)} />
              <MetricTile label="Per day" value={formatNumber(insight?.orders_per_day)} />
              <MetricTile label="Demand" value={formatNumber(insight?.demand_score, '%')} />
              <MetricTile label="Score" value={formatNumber(insight?.combined_score)} />
            </View>

            <View style={styles.detailList}>
              <DetailLine label="Revenue" value={insight?.revenue == null ? 'No data' : formatCurrency(insight.revenue)} />
              <DetailLine label="Margin" value={formatNumber(insight?.margin_pct, '%')} />
              <DetailLine label="Rank" value={insight?.rank == null ? 'No data' : `#${insight.rank}`} />
              <DetailLine label="Source" value={formatInsightSource(insight?.source)} />
            </View>

            {isLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="small" color={color_pallet.ink[700]} />
                <Text style={[typography.caption, styles.stateText]}>Loading stats...</Text>
              </View>
            )}

            {insight?.recommendation_reason ? (
              <View style={styles.recommendationBox}>
                <Text style={[typography.eyebrow, styles.recommendationTitle]}>86 signal</Text>
                <Text style={[typography.bodySmall, styles.recommendationCopy]}>
                  {insight.recommendation_reason}
                </Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={[typography.caption, styles.fieldLabel]}>{label}</Text>;
}

function MenuItemImage({ item, size }: { item: Pick<AdminMenuItem, 'name' | 'image_url'>; size: number }) {
  const initials = item.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  if (item.image_url) {
    return (
      <Image
        source={{ uri: item.image_url }}
        resizeMode="cover"
        style={[styles.menuImage, { height: size, width: size }]}
      />
    );
  }

  return (
    <View style={[styles.menuImagePlaceholder, { height: size, width: size }]}>
      <Feather name="image" size={Math.max(18, size * 0.28)} color={color_pallet.ink[500]} />
      {size > 70 ? (
        <Text style={[typography.eyebrow, styles.menuImageInitials]}>{initials || 'ITEM'}</Text>
      ) : null}
    </View>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricTile}>
      <Text style={[typography.eyebrow, styles.metricLabel]}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[typography.metricSmall, styles.metricValue]}>
        {value}
      </Text>
    </View>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailLine}>
      <Text style={[typography.caption, styles.detailLineLabel]}>{label}</Text>
      <Text style={[typography.caption, styles.detailLineValue]}>{value}</Text>
    </View>
  );
}

function formatInsightSource(source: MenuItemInsight['source'] | undefined) {
  if (source === 'analytics') return 'Analytics';
  if (source === 'pos_dashboard') return 'POS dashboard';
  if (source === 'pos_orders') return 'POS orders';
  return 'No data';
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color_pallet.bg.DEFAULT,
  },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing[4],
    paddingBottom: 128,
  },
  heading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[3],
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: color_pallet.ink[500],
  },
  title: {
    color: color_pallet.ink[900],
    marginTop: 2,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
  },
  restaurantOptions: {
    gap: spacing[2],
    paddingTop: spacing[3],
  },
  restaurantOption: {
    borderColor: semanticColors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
  },
  restaurantOptionActive: {
    backgroundColor: color_pallet.elevated.dark,
    borderColor: color_pallet.elevated.dark,
  },
  restaurantOptionText: {
    color: color_pallet.ink[600],
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  restaurantOptionTextActive: {
    color: color_pallet.cream[50],
  },
  workspaceTabs: {
    backgroundColor: color_pallet.stone[100],
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing[1],
    marginTop: spacing[4],
    padding: spacing[1],
  },
  workspaceTab: {
    alignItems: 'center',
    borderRadius: radius.sm,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: spacing[1],
  },
  workspaceTabActive: {
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderWidth: StyleSheet.hairlineWidth,
  },
  workspaceTabText: {
    color: color_pallet.ink[500],
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    textAlign: 'center',
  },
  workspaceTabTextActive: {
    color: color_pallet.ink[900],
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: semanticColors.surface,
    borderColor: semanticColors.border,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    height: layout.controlHeightSmall,
    justifyContent: 'center',
    width: layout.controlHeightSmall,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: color_pallet.elevated.dark,
    borderColor: color_pallet.elevated.dark,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[1],
    minHeight: layout.controlHeightSmall,
    paddingHorizontal: spacing[3],
  },
  addButtonText: {
    color: color_pallet.cream[50],
    fontFamily: 'Inter_700Bold',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[4],
  },
  summaryPill: {
    ...card.compact,
    flex: 1,
    minHeight: 68,
  },
  summaryPillSuccess: {
    backgroundColor: statusColors.success.bg,
    borderColor: statusColors.success.border,
  },
  summaryPillWarning: {
    backgroundColor: statusColors.warning.bg,
    borderColor: statusColors.warning.border,
  },
  summaryLabel: {
    color: color_pallet.ink[500],
  },
  summaryValue: {
    color: color_pallet.ink[900],
    marginTop: spacing[1],
  },
  searchWrap: {
    alignItems: 'center',
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[2],
    minHeight: layout.controlHeight,
    marginTop: spacing[4],
    paddingHorizontal: spacing[3],
  },
  searchInput: {
    color: color_pallet.ink[900],
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    minHeight: layout.controlHeight,
  },
  clearButton: {
    alignItems: 'center',
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[3],
  },
  filterPill: {
    alignItems: 'center',
    backgroundColor: semanticColors.surface,
    borderColor: semanticColors.border,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    minHeight: layout.controlHeightSmall,
    justifyContent: 'center',
  },
  filterPillActive: {
    backgroundColor: color_pallet.elevated.dark,
    borderColor: color_pallet.elevated.dark,
  },
  filterText: {
    color: color_pallet.ink[600],
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  filterTextActive: {
    color: color_pallet.cream[50],
  },
  stateCard: {
    ...card.base,
    alignItems: 'center',
    marginTop: spacing[5],
  },
  stateText: {
    color: color_pallet.ink[500],
  },
  errorCard: {
    backgroundColor: statusColors.danger.bg,
    borderColor: statusColors.danger.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing[4],
    padding: spacing[4],
  },
  errorTitle: {
    color: color_pallet.danger[700],
  },
  errorCopy: {
    color: color_pallet.ink[700],
    marginTop: spacing[1],
  },
  emptyCard: {
    ...card.base,
    alignItems: 'center',
    marginTop: spacing[5],
    padding: spacing[6],
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: color_pallet.stone[100],
    borderRadius: radius.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  emptyTitle: {
    color: color_pallet.ink[900],
    marginTop: spacing[3],
    textAlign: 'center',
  },
  emptyCopy: {
    color: color_pallet.ink[500],
    marginTop: spacing[2],
    textAlign: 'center',
  },
  section: {
    marginTop: spacing[5],
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  sectionTitle: {
    color: color_pallet.ink[900],
  },
  sectionHint: {
    color: color_pallet.ink[500],
  },
  itemRow: {
    alignItems: 'center',
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[2],
    minHeight: 76,
    padding: spacing[3],
  },
  itemRowUnavailable: {
    backgroundColor: color_pallet.stone[50],
  },
  menuImage: {
    backgroundColor: color_pallet.stone[100],
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  menuImagePlaceholder: {
    alignItems: 'center',
    backgroundColor: color_pallet.stone[100],
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
  },
  menuImageInitials: {
    color: color_pallet.ink[500],
    fontSize: 9,
    marginTop: spacing[1],
  },
  itemBody: {
    flex: 1,
  },
  itemTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
  },
  itemName: {
    color: color_pallet.ink[900],
    flex: 1,
  },
  itemMeta: {
    color: color_pallet.ink[500],
    marginTop: spacing[1],
  },
  statusBadge: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
  },
  statusBadgeAvailable: {
    backgroundColor: statusColors.success.bg,
    borderColor: statusColors.success.border,
  },
  statusBadgeUnavailable: {
    backgroundColor: statusColors.warning.bg,
    borderColor: statusColors.warning.border,
  },
  statusBadgeText: {
    fontSize: 9,
  },
  statusBadgeTextAvailable: {
    color: statusColors.success.text,
  },
  statusBadgeTextUnavailable: {
    color: statusColors.warning.text,
  },
  toggleButton: {
    alignItems: 'center',
    backgroundColor: color_pallet.danger[50],
    borderColor: color_pallet.danger[100],
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 66,
    paddingHorizontal: spacing[3],
  },
  restoreButton: {
    backgroundColor: color_pallet.success[50],
    borderColor: color_pallet.success[100],
    minWidth: 92,
  },
  disabledButton: {
    opacity: 0.58,
  },
  toggleButtonText: {
    color: color_pallet.danger[700],
    fontFamily: 'Inter_700Bold',
  },
  restoreButtonText: {
    color: color_pallet.success[700],
  },
  mutedText: {
    color: color_pallet.ink[500],
  },
  modalBackdrop: {
    backgroundColor: semanticColors.overlay,
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: color_pallet.bg.DEFAULT,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '86%',
    paddingBottom: spacing[8],
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing[5],
  },
  sheetScroll: {
    flexShrink: 1,
  },
  sheetHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing[3],
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  sheetTitle: {
    color: color_pallet.ink[900],
    marginTop: spacing[1],
  },
  fieldLabel: {
    color: color_pallet.ink[600],
    marginBottom: spacing[2],
    marginTop: spacing[3],
  },
  fieldInput: {
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: color_pallet.ink[900],
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    minHeight: layout.controlHeight,
    paddingHorizontal: spacing[3],
  },
  descriptionInput: {
    minHeight: 86,
    paddingTop: spacing[3],
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  formColumn: {
    flex: 1,
  },
  priceColumn: {
    width: 118,
  },
  inlineError: {
    backgroundColor: statusColors.danger.bg,
    borderColor: statusColors.danger.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing[4],
    padding: spacing[3],
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: color_pallet.elevated.dark,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing[2],
    justifyContent: 'center',
    marginTop: spacing[5],
    minHeight: layout.controlHeight,
  },
  primaryActionText: {
    color: color_pallet.cream[50],
    fontFamily: 'Inter_700Bold',
  },
  detailCopy: {
    color: color_pallet.ink[600],
    marginBottom: spacing[4],
  },
  imageConfigBox: {
    marginBottom: spacing[4],
  },
  imageConfigRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
  },
  imageConfigInput: {
    flex: 1,
  },
  saveImageButton: {
    alignItems: 'center',
    backgroundColor: color_pallet.elevated.dark,
    borderColor: color_pallet.elevated.dark,
    borderRadius: radius.md,
    borderWidth: 1,
    height: layout.controlHeight,
    justifyContent: 'center',
    width: layout.controlHeight,
  },
  detailStatusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  availabilityBox: {
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing[4],
    padding: spacing[3],
  },
  availabilityHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[3],
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  availabilityHint: {
    color: color_pallet.ink[500],
    marginTop: 2,
  },
  availabilitySection: {
    marginTop: spacing[2],
  },
  saveAvailabilityButton: {
    alignItems: 'center',
    backgroundColor: color_pallet.elevated.dark,
    borderColor: color_pallet.elevated.dark,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[1],
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 78,
    paddingHorizontal: spacing[3],
  },
  saveAvailabilityText: {
    color: color_pallet.cream[50],
    fontFamily: 'Inter_700Bold',
  },
  choiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  choicePill: {
    alignItems: 'center',
    backgroundColor: color_pallet.stone[50],
    borderColor: semanticColors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: spacing[3],
  },
  dayPill: {
    alignItems: 'center',
    backgroundColor: color_pallet.stone[50],
    borderColor: semanticColors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    minWidth: 48,
    paddingHorizontal: spacing[2],
  },
  choicePillActive: {
    backgroundColor: color_pallet.elevated.dark,
    borderColor: color_pallet.elevated.dark,
  },
  choiceText: {
    color: color_pallet.ink[600],
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  choiceTextActive: {
    color: color_pallet.cream[50],
  },
  modifierWorkspace: {
    marginTop: spacing[4],
  },
  modifierToolbar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modifierRow: {
    alignItems: 'center',
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[2],
    minHeight: 72,
    padding: spacing[3],
  },
  modifierIcon: {
    alignItems: 'center',
    backgroundColor: color_pallet.stone[100],
    borderRadius: radius.md,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  inlineAction: {
    alignItems: 'center',
    borderColor: semanticColors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: spacing[3],
    minHeight: 36,
    paddingHorizontal: spacing[4],
  },
  inlineActionText: {
    color: color_pallet.elevated.dark,
    fontFamily: 'Inter_700Bold',
  },
  modifierToggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginTop: spacing[4],
  },
  modifierToggle: {
    alignItems: 'center',
    borderColor: semanticColors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[2],
    minHeight: 38,
    paddingHorizontal: spacing[3],
  },
  modifierToggleActive: {
    backgroundColor: color_pallet.elevated.dark,
    borderColor: color_pallet.elevated.dark,
  },
  modifierToggleText: {
    color: color_pallet.ink[600],
  },
  modifierToggleTextActive: {
    color: color_pallet.cream[50],
  },
  modifierItemsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[5],
  },
  modifierItemList: {
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing[2],
    overflow: 'hidden',
  },
  modifierItemOption: {
    alignItems: 'center',
    backgroundColor: semanticColors.elevated,
    borderBottomColor: semanticColors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing[2],
    minHeight: 48,
    paddingHorizontal: spacing[3],
  },
  modifierItemName: {
    color: color_pallet.ink[800],
    flex: 1,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  metricTile: {
    ...card.compact,
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 88,
  },
  metricLabel: {
    color: color_pallet.ink[500],
  },
  metricValue: {
    color: color_pallet.ink[900],
    fontSize: 24,
    lineHeight: 30,
    marginTop: spacing[2],
  },
  detailList: {
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing[4],
    overflow: 'hidden',
  },
  detailLine: {
    alignItems: 'center',
    backgroundColor: semanticColors.elevated,
    borderBottomColor: semanticColors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 42,
    paddingHorizontal: spacing[3],
  },
  detailLineLabel: {
    color: color_pallet.ink[500],
  },
  detailLineValue: {
    color: color_pallet.ink[800],
    fontFamily: 'Inter_700Bold',
  },
  loadingOverlay: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
    justifyContent: 'center',
    marginTop: spacing[4],
  },
  recommendationBox: {
    backgroundColor: statusColors.warning.bg,
    borderColor: statusColors.warning.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing[4],
    padding: spacing[3],
  },
  recommendationTitle: {
    color: statusColors.warning.text,
  },
  recommendationCopy: {
    color: color_pallet.ink[700],
    marginTop: spacing[1],
  },
});
