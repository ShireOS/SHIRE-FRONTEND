import {
  RESELLER_UNGROUPED_ID,
  createResellerGroup,
  fetchResellerPortfolio,
  moveRestaurantsToResellerGroup,
  type ResellerGroup,
  type ResellerRestaurant,
} from '../../packages/supabase';
import { color_pallet, semanticColors, statusColors } from '@/styles/colors';
import { typography } from '@/styles/typography';
import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
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

const GROUP_COLORS = ['#2EA6A1', '#D4A854', '#7C8CF8', '#E06B4F', '#6DAF5C', '#B66DD8'];

type ViewMode = 'restaurants' | 'groups';
type SelectMode = 'browse' | 'new-group' | 'move';

type GroupCard = ResellerGroup & {
  restaurant_count: number;
  restaurants: ResellerRestaurant[];
  locked?: boolean;
};

function buildGroupCards(restaurants: ResellerRestaurant[], groups: ResellerGroup[]): GroupCard[] {
  const cards = groups.map((group) => {
    const groupRestaurants = restaurants.filter((restaurant) => restaurant.reseller_group_id === group.id);
    return { ...group, restaurants: groupRestaurants, restaurant_count: groupRestaurants.length };
  });
  const ungrouped = restaurants.filter((restaurant) => restaurant.reseller_group_id === RESELLER_UNGROUPED_ID);
  return [
    ...cards,
    {
      id: RESELLER_UNGROUPED_ID,
      reseller_id: '',
      name: 'Ungrouped',
      color: '#9CA3AF',
      restaurants: ungrouped,
      restaurant_count: ungrouped.length,
      locked: true,
    },
  ];
}

function formatLocation(restaurant: ResellerRestaurant) {
  return [restaurant.city, restaurant.state].filter(Boolean).join(', ') || restaurant.address || 'Location not set';
}

export default function ResellerPortfolio() {
  const [viewMode, setViewMode] = useState<ViewMode>('restaurants');
  const [selectMode, setSelectMode] = useState<SelectMode>('browse');
  const [groupFilter, setGroupFilter] = useState('all');
  const [restaurants, setRestaurants] = useState<ResellerRestaurant[]>([]);
  const [groups, setGroups] = useState<ResellerGroup[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailRestaurant, setDetailRestaurant] = useState<ResellerRestaurant | null>(null);
  const [inspectedGroupId, setInspectedGroupId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<SelectMode>('browse');

  const load = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const data = await fetchResellerPortfolio();
      setRestaurants(data.restaurants);
      setGroups(data.groups);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load reseller portfolio.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const groupCards = useMemo(() => buildGroupCards(restaurants, groups), [restaurants, groups]);
  const inspectedGroup = useMemo(
    () => groupCards.find((group) => group.id === inspectedGroupId) || null,
    [groupCards, inspectedGroupId],
  );
  const filteredRestaurants = useMemo(() => {
    if (groupFilter === 'all') return restaurants;
    return restaurants.filter((restaurant) => restaurant.reseller_group_id === groupFilter);
  }, [groupFilter, restaurants]);

  const selectable = selectMode !== 'browse';

  const toggleSelected = (restaurantId: string) => {
    setSelectedIds((current) =>
      current.includes(restaurantId)
        ? current.filter((id) => id !== restaurantId)
        : [...current, restaurantId],
    );
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setSelectMode('browse');
    setModal('browse');
  };

  const startSelection = (nextMode: SelectMode) => {
    setSelectMode(nextMode);
    setViewMode('restaurants');
  };

  const createGroupAndMaybeMove = async (name: string, color: string) => {
    setIsSaving(true);
    setError(null);
    try {
      const group = await createResellerGroup({ name, color });
      if (selectedIds.length > 0) {
        await moveRestaurantsToResellerGroup(selectedIds, group.id);
      }
      setGroupFilter(group.id);
      await load();
      clearSelection();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create group.');
    } finally {
      setIsSaving(false);
    }
  };

  const moveSelected = async (groupId: string) => {
    setIsSaving(true);
    setError(null);
    try {
      await moveRestaurantsToResellerGroup(selectedIds, groupId);
      setGroupFilter(groupId);
      await load();
      clearSelection();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not move restaurants.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Reseller</Text>
          <Text style={styles.title}>Restaurant Portfolio</Text>
          <Text style={styles.subtitle}>
            Groups organize your view only. Moving a restaurant does not change setup, menu, payroll, or POS configuration.
          </Text>
        </View>

        <View style={styles.toolbar}>
          <SegmentedControl
            value={viewMode}
            options={[
              { id: 'restaurants', label: 'Restaurants' },
              { id: 'groups', label: 'Groups' },
            ]}
            onChange={(value) => {
              const nextView = value as ViewMode;
              setViewMode(nextView);
              if (nextView === 'restaurants') {
                setGroupFilter('all');
                setInspectedGroupId(null);
              }
            }}
          />
          <View style={styles.actionRow}>
            <ActionButton label="Add group" icon="folder-plus" onPress={() => startSelection('new-group')} />
            <ActionButton label="Move group" icon="move" onPress={() => startSelection('move')} />
          </View>
        </View>

        {viewMode === 'restaurants' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <FilterChip label="All groups" selected={groupFilter === 'all'} onPress={() => setGroupFilter('all')} />
            {groups.map((group) => (
              <FilterChip key={group.id} label={group.name} color={group.color} selected={groupFilter === group.id} onPress={() => setGroupFilter(group.id)} />
            ))}
            <FilterChip label="Ungrouped" color="#9CA3AF" selected={groupFilter === RESELLER_UNGROUPED_ID} onPress={() => setGroupFilter(RESELLER_UNGROUPED_ID)} />
          </ScrollView>
        )}

        {selectable && (
          <View style={styles.selectionBar}>
            <Text style={styles.selectionText}>{selectedIds.length} selected</Text>
            <Pressable
              disabled={selectedIds.length === 0 || isSaving}
              onPress={() => setModal(selectMode)}
              style={[styles.primaryButton, (selectedIds.length === 0 || isSaving) && styles.disabledButton]}
            >
              <Text style={styles.primaryButtonText}>{isSaving ? 'Saving...' : 'Continue'}</Text>
            </Pressable>
            <Pressable onPress={clearSelection} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={semanticColors.primary} />
          </View>
        ) : viewMode === 'groups' && inspectedGroup ? (
          <View style={styles.list}>
            <View style={styles.groupInspectHeader}>
              <View style={styles.nameRow}>
                <View style={[styles.groupDot, { backgroundColor: inspectedGroup.color }]} />
                <View>
                  <Text style={styles.cardTitle}>{inspectedGroup.name}</Text>
                  <Text style={styles.cardMeta}>{inspectedGroup.restaurant_count} restaurants</Text>
                </View>
              </View>
              <Pressable onPress={() => setInspectedGroupId(null)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>All groups</Text>
              </Pressable>
            </View>
            {inspectedGroup.restaurants.map((restaurant) => {
              const selected = selectedIds.includes(restaurant.id);
              return (
                <Pressable
                  key={restaurant.id}
                  style={[styles.card, selected && styles.selectedCard]}
                  onPress={() => selectable ? toggleSelected(restaurant.id) : setDetailRestaurant(restaurant)}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.restaurantText}>
                      <Text style={styles.cardTitle}>{restaurant.name || 'Unnamed restaurant'}</Text>
                      <Text style={styles.cardMeta}>{formatLocation(restaurant)}</Text>
                    </View>
                    {selectable && (
                      <Feather
                        name={selected ? 'check-square' : 'square'}
                        size={22}
                        color={selected ? color_pallet.amber[600] : color_pallet.ink[400]}
                      />
                    )}
                  </View>
                </Pressable>
              );
            })}
            {inspectedGroup.restaurants.length === 0 && (
              <View style={styles.emptyBox}>
                <Text style={styles.cardMeta}>No restaurants are in this group yet.</Text>
              </View>
            )}
          </View>
        ) : viewMode === 'groups' ? (
          <View style={styles.list}>
            {groupCards.map((group) => (
              <Pressable
                key={group.id}
                style={styles.card}
                onPress={() => setInspectedGroupId(group.id)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.nameRow}>
                    <View style={[styles.groupDot, { backgroundColor: group.color }]} />
                    <Text style={styles.cardTitle}>{group.name}</Text>
                  </View>
                  <Text style={styles.countPill}>{group.restaurant_count}</Text>
                </View>
                <Text style={styles.cardMeta} numberOfLines={2}>
                  {group.restaurants.map((restaurant) => restaurant.name).join(', ') || 'No restaurants'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.list}>
            {filteredRestaurants.map((restaurant) => {
              const selected = selectedIds.includes(restaurant.id);
              return (
                <Pressable
                  key={restaurant.id}
                  style={[styles.card, selected && styles.selectedCard]}
                  onPress={() => selectable ? toggleSelected(restaurant.id) : setDetailRestaurant(restaurant)}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.restaurantText}>
                      <Text style={styles.cardTitle}>{restaurant.name || 'Unnamed restaurant'}</Text>
                      <Text style={styles.cardMeta}>{formatLocation(restaurant)}</Text>
                    </View>
                    {selectable && (
                      <Feather
                        name={selected ? 'check-square' : 'square'}
                        size={22}
                        color={selected ? color_pallet.amber[600] : color_pallet.ink[400]}
                      />
                    )}
                  </View>
                  <View style={styles.nameRow}>
                    <View style={[styles.groupDot, { backgroundColor: restaurant.reseller_group_color }]} />
                    <Text style={styles.groupLabel}>{restaurant.reseller_group_name}</Text>
                  </View>
                </Pressable>
              );
            })}
            {filteredRestaurants.length === 0 && (
              <View style={styles.emptyBox}>
                <Text style={styles.cardMeta}>No restaurants match this filter.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <GroupCreateModal
        visible={modal === 'new-group'}
        selectedCount={selectedIds.length}
        isSaving={isSaving}
        onCancel={() => setModal('browse')}
        onSubmit={createGroupAndMaybeMove}
      />
      <MoveGroupModal
        visible={modal === 'move'}
        groups={groups}
        selectedCount={selectedIds.length}
        isSaving={isSaving}
        onCancel={() => setModal('browse')}
        onSubmit={moveSelected}
      />
      <RestaurantDetailModal
        restaurant={detailRestaurant}
        onClose={() => setDetailRestaurant(null)}
      />
    </View>
  );
}

function SegmentedControl({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map((option) => (
        <Pressable
          key={option.id}
          onPress={() => onChange(option.id)}
          style={[styles.segmentButton, value === option.id && styles.segmentButtonActive]}
        >
          <Text style={[styles.segmentText, value === option.id && styles.segmentTextActive]}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ActionButton({ label, icon, onPress }: { label: string; icon: keyof typeof Feather.glyphMap; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.actionButton}>
      <Feather name={icon} size={16} color={semanticColors.text} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function FilterChip({
  label,
  color,
  selected,
  onPress,
}: {
  label: string;
  color?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.filterChip, selected && styles.filterChipActive]}>
      {color && <View style={[styles.groupDot, { backgroundColor: color }]} />}
      <Text style={[styles.filterText, selected && styles.filterTextActive]}>{label}</Text>
    </Pressable>
  );
}

function GroupCreateModal({
  visible,
  selectedCount,
  isSaving,
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  selectedCount: number;
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: (name: string, color: string) => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(GROUP_COLORS[0]);
  const canSubmit = name.trim().length > 1 && !isSaving;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Create group</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Downtown Growth"
            placeholderTextColor={color_pallet.ink[400]}
            style={styles.input}
          />
          <View style={styles.colorRow}>
            {GROUP_COLORS.map((item) => (
              <Pressable
                key={item}
                onPress={() => setColor(item)}
                style={[styles.colorSwatch, { backgroundColor: item }, color === item && styles.colorSwatchSelected]}
              />
            ))}
          </View>
          <Text style={styles.modalCopy}>
            {selectedCount > 0 ? `${selectedCount} restaurants will move into this group.` : 'You can move restaurants into this group later.'}
          </Text>
          <View style={styles.modalActions}>
            <Pressable onPress={onCancel} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable disabled={!canSubmit} onPress={() => onSubmit(name, color)} style={[styles.primaryButton, !canSubmit && styles.disabledButton]}>
              <Text style={styles.primaryButtonText}>{isSaving ? 'Saving...' : 'Create'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MoveGroupModal({
  visible,
  groups,
  selectedCount,
  isSaving,
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  groups: ResellerGroup[];
  selectedCount: number;
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: (groupId: string) => void;
}) {
  const [groupId, setGroupId] = useState(groups[0]?.id || RESELLER_UNGROUPED_ID);
  const targets = [...groups, { id: RESELLER_UNGROUPED_ID, reseller_id: '', name: 'Ungrouped', color: '#9CA3AF' }];

  useEffect(() => {
    if (visible) setGroupId(groups[0]?.id || RESELLER_UNGROUPED_ID);
  }, [groups, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Move restaurants</Text>
          <View style={styles.modalGroupList}>
            {targets.map((group) => (
              <Pressable
                key={group.id}
                onPress={() => setGroupId(group.id)}
                style={[styles.groupTarget, groupId === group.id && styles.groupTargetActive]}
              >
                <View style={[styles.groupDot, { backgroundColor: group.color }]} />
                <Text style={styles.groupTargetText}>{group.name}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.modalCopy}>
            {selectedCount} restaurants will move groups. Their operational setup will not change.
          </Text>
          <View style={styles.modalActions}>
            <Pressable onPress={onCancel} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable disabled={isSaving} onPress={() => onSubmit(groupId)} style={[styles.primaryButton, isSaving && styles.disabledButton]}>
              <Text style={styles.primaryButtonText}>{isSaving ? 'Saving...' : 'Move'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function RestaurantDetailModal({
  restaurant,
  onClose,
}: {
  restaurant: ResellerRestaurant | null;
  onClose: () => void;
}) {
  return (
    <Modal visible={Boolean(restaurant)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{restaurant?.name || 'Restaurant'}</Text>
          <Text style={styles.modalCopy}>{restaurant ? formatLocation(restaurant) : ''}</Text>
          <View style={styles.detailRows}>
            <DetailRow label="Group" value={restaurant?.reseller_group_name || 'Ungrouped'} color={restaurant?.reseller_group_color} />
            <DetailRow label="Onboarding" value={restaurant?.onboarding_completed_at ? 'Complete' : 'Incomplete'} />
            <DetailRow label="Phone" value={restaurant?.phone || 'Not set'} />
            <DetailRow label="Type" value={restaurant?.type || 'Not set'} />
          </View>
          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.detailValueRow}>
        {color && <View style={[styles.groupDot, { backgroundColor: color }]} />}
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: semanticColors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    gap: 8,
    marginBottom: 18,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: color_pallet.ink[500],
    textTransform: 'uppercase',
  },
  title: {
    ...typography.h1,
    color: semanticColors.text,
    letterSpacing: 0,
  },
  subtitle: {
    ...typography.bodySmall,
    color: semanticColors.textMuted,
    maxWidth: 720,
  },
  toolbar: {
    gap: 12,
    marginBottom: 12,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: color_pallet.stone[100],
    borderRadius: 12,
    padding: 4,
    alignSelf: 'flex-start',
  },
  segmentButton: {
    minHeight: 38,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  segmentButtonActive: {
    backgroundColor: color_pallet.elevated.DEFAULT,
  },
  segmentText: {
    ...typography.caption,
    color: semanticColors.textMuted,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: semanticColors.text,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: color_pallet.elevated.DEFAULT,
    borderWidth: 1,
    borderColor: semanticColors.border,
  },
  actionText: {
    ...typography.caption,
    color: semanticColors.text,
    fontWeight: '700',
  },
  filterRow: {
    gap: 8,
    paddingVertical: 6,
    marginBottom: 8,
  },
  filterChip: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: semanticColors.border,
    backgroundColor: color_pallet.elevated.DEFAULT,
  },
  filterChipActive: {
    borderColor: color_pallet.sky[600],
    backgroundColor: color_pallet.sky[50],
  },
  filterText: {
    ...typography.caption,
    color: semanticColors.textMuted,
    fontWeight: '700',
  },
  filterTextActive: {
    color: color_pallet.sky[700],
  },
  selectionBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: color_pallet.amber[50],
    borderWidth: 1,
    borderColor: color_pallet.amber[100],
  },
  selectionText: {
    ...typography.caption,
    color: color_pallet.amber[700],
    fontWeight: '800',
    marginRight: 'auto',
  },
  primaryButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: semanticColors.primary,
  },
  primaryButtonText: {
    ...typography.caption,
    color: semanticColors.textInverse,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: color_pallet.stone[100],
  },
  secondaryButtonText: {
    ...typography.caption,
    color: semanticColors.text,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.45,
  },
  errorBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: statusColors.danger.bg,
    borderWidth: 1,
    borderColor: statusColors.danger.border,
    marginBottom: 12,
  },
  errorText: {
    ...typography.caption,
    color: statusColors.danger.text,
  },
  loadingBox: {
    padding: 28,
    alignItems: 'center',
  },
  list: {
    gap: 12,
  },
  card: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: color_pallet.elevated.DEFAULT,
    borderWidth: 1,
    borderColor: semanticColors.border,
    gap: 14,
  },
  selectedCard: {
    borderColor: color_pallet.amber[600],
    backgroundColor: color_pallet.amber[50],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  restaurantText: {
    flex: 1,
  },
  cardTitle: {
    ...typography.body,
    color: semanticColors.text,
    fontWeight: '800',
  },
  cardMeta: {
    ...typography.caption,
    color: semanticColors.textMuted,
    marginTop: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupDot: {
    width: 10,
    height: 10,
    borderRadius: 99,
  },
  groupLabel: {
    ...typography.caption,
    color: semanticColors.textMuted,
    fontWeight: '700',
  },
  countPill: {
    ...typography.caption,
    color: semanticColors.textMuted,
    fontWeight: '800',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: color_pallet.stone[100],
  },
  emptyBox: {
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: semanticColors.border,
  },
  groupInspectHeader: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: color_pallet.elevated.DEFAULT,
    borderWidth: 1,
    borderColor: semanticColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(21, 19, 19, 0.56)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    padding: 18,
    borderRadius: 16,
    backgroundColor: color_pallet.elevated.DEFAULT,
    gap: 14,
  },
  modalTitle: {
    ...typography.h2,
    color: semanticColors.text,
  },
  input: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: semanticColors.border,
    paddingHorizontal: 12,
    color: semanticColors.text,
    fontSize: 16,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorSwatch: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderColor: color_pallet.ink[900],
  },
  modalCopy: {
    ...typography.bodySmall,
    color: semanticColors.textMuted,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  detailRows: {
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: semanticColors.border,
  },
  detailLabel: {
    ...typography.caption,
    color: semanticColors.textMuted,
    fontWeight: '700',
  },
  detailValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexShrink: 1,
  },
  detailValue: {
    ...typography.caption,
    color: semanticColors.text,
    fontWeight: '800',
    textAlign: 'right',
  },
  modalGroupList: {
    gap: 8,
  },
  groupTarget: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: semanticColors.border,
  },
  groupTargetActive: {
    backgroundColor: color_pallet.sky[50],
    borderColor: color_pallet.sky[600],
  },
  groupTargetText: {
    ...typography.bodySmall,
    color: semanticColors.text,
    fontWeight: '700',
  },
});
