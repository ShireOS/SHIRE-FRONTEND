import {
  RESELLER_UNGROUPED_ID,
  DEFAULT_RESELLER_PERMISSIONS,
  createResellerEmployee,
  createResellerGroup,
  fetchResellerEmployees,
  fetchResellerPortfolio,
  fetchResellerProfile,
  isResellerProfileComplete,
  moveRestaurantsToResellerGroup,
  saveResellerProfile,
  type ResellerEmployee,
  type ResellerGroup,
  type ResellerProfile,
  type ResellerRestaurant,
} from '../../packages/supabase';
import { color_pallet, semanticColors, statusColors } from '@/styles/colors';
import { typography } from '@/styles/typography';
import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const GROUP_COLORS = ['#2EA6A1', '#D4A854', '#7C8CF8', '#E06B4F', '#6DAF5C', '#B66DD8'];

const EMPTY_PROFILE: ResellerProfile = {
  reseller_id: '',
  organization_name: '',
  legal_business_name: null,
  business_email: null,
  phone: null,
  website: null,
  logo_url: null,
  default_general_propagation: 'current_group',
  default_specified_propagation: 'current_restaurant',
  onboarding_completed_at: null,
};

type ViewMode = 'restaurants' | 'groups' | 'profile';
type SelectMode = 'browse' | 'new-group' | 'move';
type ResellerEmployeeDraft = {
  name: string;
  email: string;
  username: string;
  password: string;
  restaurant_ids: string[];
  group_ids: string[];
  permissions: Record<string, boolean>;
};

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
  const [resellerId, setResellerId] = useState<string | null>(null);
  const [employee, setEmployee] = useState<ResellerEmployee | null>(null);
  const [profile, setProfile] = useState<ResellerProfile>(EMPTY_PROFILE);
  const [employees, setEmployees] = useState<ResellerEmployee[]>([]);
  const [employeeDraft, setEmployeeDraft] = useState<ResellerEmployeeDraft>({
    name: '',
    email: '',
    username: '',
    password: '11111111',
    restaurant_ids: [] as string[],
    group_ids: [] as string[],
    permissions: { ...DEFAULT_RESELLER_PERMISSIONS },
  });
  const [restaurants, setRestaurants] = useState<ResellerRestaurant[]>([]);
  const [groups, setGroups] = useState<ResellerGroup[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailRestaurant, setDetailRestaurant] = useState<ResellerRestaurant | null>(null);
  const [inspectedGroupId, setInspectedGroupId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<SelectMode>('browse');
  const canManageProfile = !employee;
  const canManageGroups = !employee || Boolean(employee.permissions.manage_groups);
  const profileComplete = isResellerProfileComplete(profile);

  const load = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const data = await fetchResellerPortfolio();
      setResellerId(data.resellerId);
      setEmployee(data.employee);
      setRestaurants(data.restaurants);
      setGroups(data.groups);
      if (data.resellerId) {
        const profileRow = await fetchResellerProfile(data.resellerId);
        setProfile(profileRow);
        setEmployees(data.employee ? [] : await fetchResellerEmployees(data.resellerId));
      }
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
              { id: 'profile', label: profileComplete ? 'Profile' : 'Profile !' },
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
          {canManageGroups && (
            <View style={styles.actionRow}>
              <ActionButton label="Add group" icon="folder-plus" onPress={() => startSelection('new-group')} />
              <ActionButton label="Move group" icon="move" onPress={() => startSelection('move')} />
            </View>
          )}
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
        ) : viewMode === 'profile' ? (
          <ResellerProfilePanel
            resellerId={resellerId}
            profile={profile}
            groups={groups}
            restaurants={restaurants}
            employees={employees}
            employeeDraft={employeeDraft}
            canManage={canManageProfile}
            isSaving={isSaving}
            onProfileChange={setProfile}
            onDraftChange={setEmployeeDraft}
            onSavingChange={setIsSaving}
            onError={setError}
            onReload={load}
          />
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

function ResellerProfilePanel({
  resellerId,
  profile,
  groups,
  restaurants,
  employees,
  employeeDraft,
  canManage,
  isSaving,
  onProfileChange,
  onDraftChange,
  onSavingChange,
  onError,
  onReload,
}: {
  resellerId: string | null;
  profile: ResellerProfile;
  groups: ResellerGroup[];
  restaurants: ResellerRestaurant[];
  employees: ResellerEmployee[];
  employeeDraft: ResellerEmployeeDraft;
  canManage: boolean;
  isSaving: boolean;
  onProfileChange: (profile: ResellerProfile) => void;
  onDraftChange: (draft: ResellerEmployeeDraft) => void;
  onSavingChange: (saving: boolean) => void;
  onError: (message: string | null) => void;
  onReload: () => Promise<void>;
}) {
  const updateProfile = (patch: Partial<ResellerProfile>) => onProfileChange({ ...profile, ...patch });
  const updateDraft = (patch: Partial<typeof employeeDraft>) => onDraftChange({ ...employeeDraft, ...patch });
  const updatePermission = (key: string) => updateDraft({
    permissions: { ...employeeDraft.permissions, [key]: !employeeDraft.permissions[key] },
  });
  const toggleRestaurant = (restaurantId: string) => {
    const has = employeeDraft.restaurant_ids.includes(restaurantId);
    updateDraft({
      restaurant_ids: has
        ? employeeDraft.restaurant_ids.filter((id) => id !== restaurantId)
        : [...employeeDraft.restaurant_ids, restaurantId],
    });
  };
  const toggleAllRestaurants = () => {
    updateDraft({
      restaurant_ids: employeeDraft.restaurant_ids.length === restaurants.length
        ? []
        : restaurants.map((restaurant) => restaurant.id),
    });
  };
  const toggleGroup = (groupId: string) => {
    const has = employeeDraft.group_ids.includes(groupId);
    updateDraft({
      group_ids: has
        ? employeeDraft.group_ids.filter((id) => id !== groupId)
        : [...employeeDraft.group_ids, groupId],
    });
  };
  const toggleAllGroups = () => {
    updateDraft({
      group_ids: employeeDraft.group_ids.length === groups.length
        ? []
        : groups.map((group) => group.id),
    });
  };
  const pickLogo = async () => {
    if (!canManage) return;
    onError(null);
    try {
      const ImagePicker = await import('expo-image-picker');
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        onError('Photo library permission is required to add a logo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.35,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]?.base64) return;
      updateProfile({ logo_url: `data:image/jpeg;base64,${result.assets[0].base64}` });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not choose logo.');
    }
  };
  const saveProfile = async (complete = false) => {
    if (!resellerId) return;
    onSavingChange(true);
    onError(null);
    try {
      const saved = await saveResellerProfile(resellerId, profile, { complete });
      onProfileChange(saved);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save reseller profile.');
    } finally {
      onSavingChange(false);
    }
  };
  const addEmployee = async () => {
    if (!employeeDraft.name.trim()) {
      onError('Employee name is required.');
      return;
    }
    if (employeeDraft.password.length < 8) {
      onError('Employee password must be at least 8 characters.');
      return;
    }
    onSavingChange(true);
    onError(null);
    try {
      await createResellerEmployee(employeeDraft);
      onDraftChange({
        name: '',
        email: '',
        username: '',
        password: '11111111',
        restaurant_ids: [],
        group_ids: [],
        permissions: { ...DEFAULT_RESELLER_PERMISSIONS },
      });
      await onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not add reseller employee.');
    } finally {
      onSavingChange(false);
    }
  };

  return (
    <View style={styles.list}>
      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View>
            <Text style={styles.cardTitle}>Organization profile</Text>
            <Text style={styles.cardMeta}>Reseller-only details and branding.</Text>
          </View>
          {!isResellerProfileComplete(profile) && <Text style={styles.warningPill}>!</Text>}
        </View>
        <Pressable onPress={pickLogo} disabled={!canManage} style={styles.logoRow}>
          {profile.logo_url ? (
            <Image source={{ uri: profile.logo_url }} style={styles.logoPreview} />
          ) : (
            <View style={styles.logoPlaceholder}><Feather name="image" size={20} color={semanticColors.textMuted} /></View>
          )}
          <Text style={styles.secondaryButtonText}>{canManage ? 'Choose logo' : 'Logo'}</Text>
        </Pressable>
        <ProfileInput label="Organization name" value={profile.organization_name} editable={canManage} onChangeText={(value) => updateProfile({ organization_name: value })} />
        <ProfileInput label="Legal business name" value={profile.legal_business_name || ''} editable={canManage} onChangeText={(value) => updateProfile({ legal_business_name: value })} />
        <ProfileInput label="Business email" value={profile.business_email || ''} editable={canManage} onChangeText={(value) => updateProfile({ business_email: value })} />
        <ProfileInput label="Phone" value={profile.phone || ''} editable={canManage} onChangeText={(value) => updateProfile({ phone: value })} />
        <ProfileInput label="Website" value={profile.website || ''} editable={canManage} onChangeText={(value) => updateProfile({ website: value })} />
      </View>

      <View style={styles.profileCard}>
        <Text style={styles.cardTitle}>Default propagation</Text>
        <Text style={styles.cardMeta}>These defaults preselect restaurants when setup changes are applied.</Text>
        <ChoiceRow
          label="General changes"
          value={profile.default_general_propagation}
          options={[
            ['current_group', 'Current group'],
            ['current_restaurant', 'Current restaurant'],
            ['ask_every_time', 'Ask every time'],
          ]}
          disabled={!canManage}
          onChange={(value) => updateProfile({ default_general_propagation: value as ResellerProfile['default_general_propagation'] })}
        />
        <ChoiceRow
          label="Specified changes"
          value={profile.default_specified_propagation}
          options={[
            ['current_restaurant', 'Current restaurant'],
            ['ask_every_time', 'Ask every time'],
          ]}
          disabled={!canManage}
          onChange={(value) => updateProfile({ default_specified_propagation: value as ResellerProfile['default_specified_propagation'] })}
        />
        {canManage && (
          <Pressable disabled={isSaving} onPress={() => saveProfile(true)} style={[styles.primaryButton, isSaving && styles.disabledButton]}>
            <Text style={styles.primaryButtonText}>{isSaving ? 'Saving...' : 'Save profile'}</Text>
          </Pressable>
        )}
      </View>

      {canManage && (
        <View style={styles.profileCard}>
          <Text style={styles.cardTitle}>Reseller employees</Text>
          <Text style={styles.cardMeta}>Create a username/password and choose which restaurants they can oversee.</Text>
          <ProfileInput label="Name" value={employeeDraft.name} onChangeText={(value) => updateDraft({ name: value })} />
          <ProfileInput label="Email optional" value={employeeDraft.email} onChangeText={(value) => updateDraft({ email: value })} />
          <ProfileInput label="Username optional" value={employeeDraft.username} onChangeText={(value) => updateDraft({ username: value })} />
          <ProfileInput label="Temporary password" value={employeeDraft.password} onChangeText={(value) => updateDraft({ password: value })} />
          <View style={styles.chipRow}>
            {[
              ['edit_setup', 'Edit setup'],
              ['propagate_changes', 'Propagate'],
              ['manage_groups', 'Manage groups'],
            ].map(([key, label]) => (
              <FilterChip key={key} label={label} selected={Boolean(employeeDraft.permissions[key])} onPress={() => updatePermission(key)} />
            ))}
          </View>
          <Text style={styles.detailLabel}>Group access</Text>
          <Pressable onPress={toggleAllGroups} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>{employeeDraft.group_ids.length === groups.length ? 'Clear groups' : 'Choose all groups'}</Text>
          </Pressable>
          <View style={styles.restaurantChecklist}>
            {groups.map((group) => (
              <Pressable key={group.id} onPress={() => toggleGroup(group.id)} style={styles.checkRow}>
                <Feather name={employeeDraft.group_ids.includes(group.id) ? 'check-square' : 'square'} size={20} color={semanticColors.text} />
                <View style={[styles.groupDot, { backgroundColor: group.color }]} />
                <Text style={styles.checkText}>{group.name}</Text>
              </Pressable>
            ))}
            {groups.length === 0 && <Text style={styles.cardMeta}>Create a group first to assign group access.</Text>}
          </View>
          <Text style={styles.detailLabel}>Restaurant access</Text>
          <Pressable onPress={toggleAllRestaurants} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>{employeeDraft.restaurant_ids.length === restaurants.length ? 'Clear restaurants' : 'Choose all restaurants'}</Text>
          </Pressable>
          <View style={styles.restaurantChecklist}>
            {restaurants.map((restaurant) => (
              <Pressable key={restaurant.id} onPress={() => toggleRestaurant(restaurant.id)} style={styles.checkRow}>
                <Feather name={employeeDraft.restaurant_ids.includes(restaurant.id) ? 'check-square' : 'square'} size={20} color={semanticColors.text} />
                <Text style={styles.checkText}>{restaurant.name}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable disabled={isSaving} onPress={addEmployee} style={[styles.primaryButton, isSaving && styles.disabledButton]}>
            <Text style={styles.primaryButtonText}>{isSaving ? 'Saving...' : 'Add employee'}</Text>
          </Pressable>
          {employees.map((item) => (
            <View key={item.id} style={styles.employeeRow}>
              <View>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardMeta}>{item.username} · {item.restaurant_ids.length} restaurants · {item.group_ids.length} groups</Text>
              </View>
              <Text style={styles.countPill}>{item.status}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function ProfileInput({
  label,
  value,
  editable = true,
  onChangeText,
}: {
  label: string;
  value: string;
  editable?: boolean;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.detailLabel}>{label}</Text>
      <TextInput
        value={value}
        editable={editable}
        onChangeText={onChangeText}
        placeholderTextColor={color_pallet.ink[400]}
        style={[styles.input, !editable && styles.disabledButton]}
      />
    </View>
  );
}

function ChoiceRow({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map(([id, text]) => (
          <FilterChip key={id} label={text} selected={value === id} onPress={() => !disabled && onChange(id)} />
        ))}
      </View>
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
  profileCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: color_pallet.elevated.DEFAULT,
    borderWidth: 1,
    borderColor: semanticColors.border,
    gap: 14,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  warningPill: {
    ...typography.caption,
    color: color_pallet.amber[700],
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: color_pallet.amber[50],
  },
  logoRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: semanticColors.border,
  },
  logoPreview: {
    width: 42,
    height: 42,
    borderRadius: 10,
  },
  logoPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color_pallet.stone[100],
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  restaurantChecklist: {
    gap: 8,
  },
  checkRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: semanticColors.border,
  },
  checkText: {
    ...typography.bodySmall,
    color: semanticColors.text,
    fontWeight: '700',
    flex: 1,
  },
  employeeRow: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: semanticColors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
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
