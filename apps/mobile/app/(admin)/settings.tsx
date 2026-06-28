import {
  DEFAULT_REMOTE_TIME_CLOCK_POLICY,
  fetchManagerJobCodes,
  fetchManagerTimeClockPolicy,
  updateManagerJobCode,
  type JobCode,
  saveManagerTimeClockPolicy,
  type RemoteTimeClockPolicy,
  type RemoteTimeClockSettings,
} from '@/api/timeClock';
import {
  fetchManagerStaff,
  updateManagerStaff,
  type StaffContact,
} from '@/api/employeeOps';
import {
  fetchDiscountRules,
  fetchRestaurantSetupConfig,
  fetchRestaurantSections,
  fetchTaxesCharges,
  saveDiscountRules as saveRestaurantDiscountRules,
  saveRestaurantSetupConfig,
  saveRestaurantSections,
  saveTaxesCharges as saveRestaurantTaxesCharges,
  type DiscountRule,
  type DiscountRulesPayload,
  type ServiceCharge,
  type RestaurantSetupConfig,
  type TaxesChargesPayload,
  type TaxRate,
} from '@/api/restaurantSetup';
import { staleWhileRevalidate, writeCacheRecord } from '@/cache/staleWhileRevalidate';
import ScanCatalog from '@/screens/ScanCatalog';
import { UiButton } from '@/components/ui/Button';
import { UiText } from '@/components/ui/Text';
import { registerManagerPushToken } from '@/notifications/pushNotifications';
import { palette, semanticColors, statusColors } from '@/styles/colors';
import { radius, spacing } from '@/styles/tokens';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { getOwnerRestaurant, type OwnerRestaurant } from '../../packages/supabase';

const POLICY_CACHE_TTL_MS = 60_000;
const POLICY_MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const FALLBACK_ROLE_OPTIONS = ['manager', 'server', 'bartender', 'host', 'busser', 'runner', 'chef'];
const SERVICE_MODE_OPTIONS = [
  { id: 'dine_in', label: 'Dine-in' },
  { id: 'bar', label: 'Bar' },
  { id: 'counter_service', label: 'Counter' },
  { id: 'takeout', label: 'Takeout' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'catering', label: 'Catering' },
];
const GUEST_FLOW_OPTIONS = [
  { id: 'seat_first', label: 'Seat first' },
  { id: 'order_first', label: 'Order first' },
  { id: 'tab_first', label: 'Tab first' },
  { id: 'counter_pay', label: 'Counter pay' },
];
const TAX_APPLIES_TO_OPTIONS = [
  ['all', 'All sales'],
  ['food', 'Food'],
  ['alcohol', 'Alcohol'],
  ['non_alcohol', 'Non-alcohol'],
  ['merchandise', 'Merch'],
] as const;
const CHARGE_APPLIES_TO_OPTIONS = [
  ['all', 'All orders'],
  ['dine_in', 'Dine-in'],
  ['bar', 'Bar'],
  ['takeout', 'Takeout'],
  ['delivery', 'Delivery'],
  ['catering', 'Catering'],
  ['large_party', 'Large party'],
] as const;
const DISCOUNT_TYPE_OPTIONS = [
  ['discount', 'Discount'],
  ['comp', 'Comp'],
  ['promo', 'Promo'],
  ['employee_meal', 'Employee meal'],
  ['service_recovery', 'Recovery'],
] as const;
const DISCOUNT_APPLIES_TO_OPTIONS = [
  ['item', 'Item'],
  ['check', 'Check'],
  ['both', 'Both'],
] as const;
const DISCOUNT_VALUE_TYPE_OPTIONS = [
  ['percent', 'Percent'],
  ['fixed', 'Fixed $'],
  ['open', 'Open'],
] as const;
const DISCOUNT_TAX_BEHAVIOR_OPTIONS = [
  ['reduce_taxable_amount', 'Pre-tax'],
  ['apply_after_tax', 'After tax'],
  ['no_tax_impact', 'No tax impact'],
] as const;
const DISCOUNT_ROLE_OPTIONS = ['owner', 'manager', 'server', 'bartender', 'cashier', 'host', 'runner', 'busser'];
const DISCOUNT_SERVICE_OPTIONS = [
  ['dine_in', 'Dine-in'],
  ['bar', 'Bar'],
  ['counter_service', 'Counter'],
  ['takeout', 'Takeout'],
  ['delivery', 'Delivery'],
  ['catering', 'Catering'],
] as const;
const DAY_OPTIONS = [
  [0, 'Sun'],
  [1, 'Mon'],
  [2, 'Tue'],
  [3, 'Wed'],
  [4, 'Thu'],
  [5, 'Fri'],
  [6, 'Sat'],
] as const;

type LegalEdits = Required<Pick<
  RestaurantSetupConfig,
  | 'legal_business_name'
  | 'dba_name'
  | 'ein'
  | 'legal_contact_name'
  | 'legal_contact_title'
  | 'legal_contact_email'
  | 'legal_contact_phone'
  | 'tos_signature_data_url'
  | 'tos_signed_at'
>>;

type PaymentEdits = {
  bank_account_holder: string;
  bank_name: string;
  bank_routing_number: string;
  bank_account_number: string;
  payout_schedule: NonNullable<RestaurantSetupConfig['payout_schedule']>;
  refund_funding_source: NonNullable<RestaurantSetupConfig['refund_funding_source']>;
  batch_close_mode: NonNullable<RestaurantSetupConfig['batch_close_mode']>;
  batch_close_time: string;
  credit_card_tip_payout: NonNullable<RestaurantSetupConfig['credit_card_tip_payout']>;
  refund_approval_threshold: string;
};

type ServiceModelEdits = {
  service_modes: string[];
  default_guest_flow: string;
};

const DEFAULT_LEGAL: LegalEdits = {
  legal_business_name: '',
  dba_name: '',
  ein: '',
  legal_contact_name: '',
  legal_contact_title: '',
  legal_contact_email: '',
  legal_contact_phone: '',
  tos_signature_data_url: '',
  tos_signed_at: '',
};

const DEFAULT_PAYMENTS: PaymentEdits = {
  bank_account_holder: '',
  bank_name: '',
  bank_routing_number: '',
  bank_account_number: '',
  payout_schedule: 'daily',
  refund_funding_source: 'processor_balance',
  batch_close_mode: 'automatic',
  batch_close_time: '04:00',
  credit_card_tip_payout: 'payroll',
  refund_approval_threshold: '',
};

const DEFAULT_SERVICE_MODEL: ServiceModelEdits = {
  service_modes: ['dine_in'],
  default_guest_flow: 'seat_first',
};

const DEFAULT_TAX_RATE: TaxRate = {
  name: 'Sales Tax',
  rate: '',
  applies_to: 'all',
  is_default: true,
  is_inclusive: false,
  is_active: true,
};

const DEFAULT_DISCOUNT_RULE: DiscountRule = {
  name: 'Manager Comp',
  discount_type: 'discount',
  applies_to: 'check',
  value_type: 'percent',
  default_value: '',
  editable_by_employee: false,
  min_value: '',
  max_value: '',
  allowed_roles: ['owner', 'manager'],
  requires_manager_approval: false,
  tax_behavior: 'reduce_taxable_amount',
  reason_required: false,
  service_modes: [],
  days_of_week: [],
  is_active: true,
};

function normalizeSectionNames(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  ['Table', ...values].forEach((raw) => {
    const name = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!name) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(key === 'table' ? 'Table' : name);
  });
  return out.length > 0 ? out : ['Table'];
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function numberText(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return typeof value === 'string' ? sanitizeMoney(value).slice(0, 10) : '';
}

function normalizeTaxRates(rows: TaxRate[] | undefined): TaxRate[] {
  const normalized = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      ...row,
      id: row.id || null,
      name: String(row.name || '').trim(),
      rate: numberText(row.rate),
      applies_to: TAX_APPLIES_TO_OPTIONS.some(([value]) => value === row.applies_to) ? row.applies_to : 'all',
      is_default: Boolean(row.is_default),
      is_inclusive: Boolean(row.is_inclusive),
      is_active: row.is_active !== false,
    }))
    .filter((row) => row.name && row.is_active);
  if (normalized.length === 0) return [{ ...DEFAULT_TAX_RATE }];
  const hasDefault = normalized.some((row) => row.is_default);
  return normalized.map((row, index) => ({ ...row, is_default: row.is_default || (!hasDefault && index === 0) }));
}

function normalizeServiceCharges(rows: ServiceCharge[] | undefined): ServiceCharge[] {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      ...row,
      id: row.id || null,
      name: String(row.name || '').trim(),
      charge_type: (row.charge_type === 'fixed' ? 'fixed' : 'percentage') as ServiceCharge['charge_type'],
      amount: numberText(row.amount),
      applies_to: CHARGE_APPLIES_TO_OPTIONS.some(([value]) => value === row.applies_to) ? row.applies_to : 'all',
      taxable: row.taxable !== false,
      auto_apply: Boolean(row.auto_apply),
      is_tip: Boolean(row.is_tip),
      is_active: row.is_active !== false,
    }))
    .filter((row) => row.name && row.is_active);
}

function taxChargePayload(taxRates: TaxRate[], serviceCharges: ServiceCharge[]): TaxesChargesPayload {
  return {
    tax_rates: normalizeTaxRates(taxRates).map((row) => ({
      id: row.id || undefined,
      name: row.name,
      rate: row.rate === '' ? 0 : Number(row.rate),
      applies_to: row.applies_to,
      is_default: row.is_default,
      is_inclusive: row.is_inclusive,
      is_active: true,
    })),
    service_charges: normalizeServiceCharges(serviceCharges).map((row) => ({
      id: row.id || undefined,
      name: row.name,
      charge_type: row.charge_type,
      amount: row.amount === '' ? 0 : Number(row.amount),
      applies_to: row.applies_to,
      taxable: row.taxable,
      auto_apply: row.auto_apply,
      is_tip: row.is_tip,
      is_active: true,
    })),
  };
}

function normalizeStringList(values: unknown, allowed: string[]) {
  const raw = Array.isArray(values) ? values : [];
  return Array.from(new Set(raw.map(String).filter((value) => allowed.includes(value))));
}

function normalizeDays(values: unknown) {
  const raw = Array.isArray(values) ? values : [];
  return Array.from(new Set(raw.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))).sort((a, b) => a - b);
}

function normalizeDiscountRules(rows: DiscountRule[] | undefined): DiscountRule[] {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      ...row,
      id: row.id || null,
      name: String(row.name || '').trim(),
      discount_type: DISCOUNT_TYPE_OPTIONS.some(([value]) => value === row.discount_type) ? row.discount_type : 'discount',
      applies_to: DISCOUNT_APPLIES_TO_OPTIONS.some(([value]) => value === row.applies_to) ? row.applies_to : 'check',
      value_type: DISCOUNT_VALUE_TYPE_OPTIONS.some(([value]) => value === row.value_type) ? row.value_type : 'percent',
      default_value: numberText(row.default_value),
      editable_by_employee: Boolean(row.editable_by_employee),
      min_value: numberText(row.min_value),
      max_value: numberText(row.max_value),
      allowed_roles: normalizeStringList(row.allowed_roles, DISCOUNT_ROLE_OPTIONS),
      requires_manager_approval: Boolean(row.requires_manager_approval),
      tax_behavior: DISCOUNT_TAX_BEHAVIOR_OPTIONS.some(([value]) => value === row.tax_behavior) ? row.tax_behavior : 'reduce_taxable_amount',
      reason_required: Boolean(row.reason_required),
      service_modes: normalizeStringList(row.service_modes, DISCOUNT_SERVICE_OPTIONS.map(([value]) => value)),
      days_of_week: normalizeDays(row.days_of_week),
      is_active: row.is_active !== false,
    }))
    .map((row) => ({ ...row, allowed_roles: row.allowed_roles.length > 0 ? row.allowed_roles : ['owner', 'manager'] }))
    .filter((row) => row.name && row.is_active);
}

function discountRulesPayload(discountRules: DiscountRule[]): DiscountRulesPayload {
  return {
    discount_rules: normalizeDiscountRules(discountRules).map((row) => ({
      id: row.id || undefined,
      name: row.name,
      discount_type: row.discount_type,
      applies_to: row.applies_to,
      value_type: row.value_type,
      default_value: row.default_value === '' ? null : Number(row.default_value),
      editable_by_employee: row.editable_by_employee,
      min_value: row.editable_by_employee && row.min_value !== '' ? Number(row.min_value) : null,
      max_value: row.editable_by_employee && row.max_value !== '' ? Number(row.max_value) : null,
      allowed_roles: row.allowed_roles,
      requires_manager_approval: row.requires_manager_approval,
      tax_behavior: row.tax_behavior,
      reason_required: row.reason_required,
      service_modes: row.service_modes,
      days_of_week: row.days_of_week,
      is_active: true,
    })),
  };
}

function defaultServiceCharge(index: number): ServiceCharge {
  return {
    name: index === 0 ? 'Service Charge' : `Service Charge ${index + 1}`,
    charge_type: 'percentage',
    amount: '',
    applies_to: 'all',
    taxable: true,
    auto_apply: false,
    is_tip: false,
    is_active: true,
  };
}

function defaultDiscountRule(index: number): DiscountRule {
  return {
    ...DEFAULT_DISCOUNT_RULE,
    name: index === 0 ? DEFAULT_DISCOUNT_RULE.name : `Discount ${index + 1}`,
  };
}

function normalizeSetupConfig(config: RestaurantSetupConfig) {
  return {
    legal: {
      legal_business_name: textValue(config.legal_business_name),
      dba_name: textValue(config.dba_name),
      ein: textValue(config.ein),
      legal_contact_name: textValue(config.legal_contact_name),
      legal_contact_title: textValue(config.legal_contact_title),
      legal_contact_email: textValue(config.legal_contact_email),
      legal_contact_phone: textValue(config.legal_contact_phone),
      tos_signature_data_url: textValue(config.tos_signature_data_url),
      tos_signed_at: textValue(config.tos_signed_at),
    },
    payments: {
      bank_account_holder: textValue(config.bank_account_holder),
      bank_name: textValue(config.bank_name),
      bank_routing_number: textValue(config.bank_routing_number),
      bank_account_number: textValue(config.bank_account_number),
      payout_schedule: config.payout_schedule || DEFAULT_PAYMENTS.payout_schedule,
      refund_funding_source: config.refund_funding_source || DEFAULT_PAYMENTS.refund_funding_source,
      batch_close_mode: config.batch_close_mode || DEFAULT_PAYMENTS.batch_close_mode,
      batch_close_time: textValue(config.batch_close_time) || DEFAULT_PAYMENTS.batch_close_time,
      credit_card_tip_payout: config.credit_card_tip_payout || DEFAULT_PAYMENTS.credit_card_tip_payout,
      refund_approval_threshold: textValue(config.refund_approval_threshold),
    },
    serviceModel: {
      service_modes: Array.isArray(config.service_modes) && config.service_modes.length > 0
        ? config.service_modes.map(String)
        : DEFAULT_SERVICE_MODEL.service_modes,
      default_guest_flow: textValue(config.default_guest_flow) || DEFAULT_SERVICE_MODEL.default_guest_flow,
    },
  };
}

function buildSignatureDataUrl(name: string) {
  const safeName = name.trim() || 'Authorized signer';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="180" viewBox="0 0 640 180"><rect width="640" height="180" fill="#ffffff"/><text x="32" y="104" fill="#151313" font-size="42" font-family="Brush Script MT, cursive">${safeName.replace(/[<>&"]/g, '')}</text><line x1="28" y1="132" x2="612" y2="132" stroke="#8C8581" stroke-width="2"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export default function OwnerSettings() {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<OwnerRestaurant | null>(null);
  const [policy, setPolicy] = useState<RemoteTimeClockPolicy | null>(null);
  const [jobCodes, setJobCodes] = useState<JobCode[]>([]);
  const [staff, setStaff] = useState<StaffContact[]>([]);
  const [sectionEdits, setSectionEdits] = useState<string[]>(['Table']);
  const [legalEdits, setLegalEdits] = useState(DEFAULT_LEGAL);
  const [paymentEdits, setPaymentEdits] = useState(DEFAULT_PAYMENTS);
  const [serviceModelEdits, setServiceModelEdits] = useState(DEFAULT_SERVICE_MODEL);
  const [taxRateEdits, setTaxRateEdits] = useState<TaxRate[]>([{ ...DEFAULT_TAX_RATE }]);
  const [serviceChargeEdits, setServiceChargeEdits] = useState<ServiceCharge[]>([]);
  const [discountRuleEdits, setDiscountRuleEdits] = useState<DiscountRule[]>([]);
  const [rateEdits, setRateEdits] = useState<Record<string, string>>({});
  const [staffPayEdits, setStaffPayEdits] = useState<Record<string, string>>({});
  const [staffHoursEdits, setStaffHoursEdits] = useState<Record<string, string>>({});
  const [staffRoleEdits, setStaffRoleEdits] = useState<Record<string, string>>({});
  const [savingRateId, setSavingRateId] = useState<string | null>(null);
  const [savingStaffId, setSavingStaffId] = useState<string | null>(null);
  const [freshness, setFreshness] = useState<'fresh' | 'stale' | 'miss' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegisteringNotifications, setIsRegisteringNotifications] = useState(false);
  const [message, setMessage] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [sectionsMessage, setSectionsMessage] = useState('');
  const [legalMessage, setLegalMessage] = useState('');
  const [paymentsMessage, setPaymentsMessage] = useState('');
  const [serviceModelMessage, setServiceModelMessage] = useState('');
  const [taxesMessage, setTaxesMessage] = useState('');
  const [discountsMessage, setDiscountsMessage] = useState('');
  const [isSavingSections, setIsSavingSections] = useState(false);
  const [isSavingLegal, setIsSavingLegal] = useState(false);
  const [isSavingPayments, setIsSavingPayments] = useState(false);
  const [isSavingServiceModel, setIsSavingServiceModel] = useState(false);
  const [isSavingTaxes, setIsSavingTaxes] = useState(false);
  const [isSavingDiscounts, setIsSavingDiscounts] = useState(false);

  const restaurantId = restaurant?.id;
  const settings = policy?.remote_time_clock || DEFAULT_REMOTE_TIME_CLOCK_POLICY.remote_time_clock;
  const roleOptions = Array.from(new Set([
    ...jobCodes.map((code) => code.code || code.label).filter(Boolean),
    ...staff.map((person) => person.role).filter(Boolean),
    ...FALLBACK_ROLE_OPTIONS,
  ])).map(String);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getOwnerRestaurant()
      .then(async (ownerRestaurant) => {
        if (cancelled) return;
        setRestaurant(ownerRestaurant);
        if (!ownerRestaurant?.id) return;
        const result = await staleWhileRevalidate<RemoteTimeClockPolicy>({
          namespace: 'manager-time-clock-policy',
          version: 1,
          parts: [ownerRestaurant.id],
          ttlMs: POLICY_CACHE_TTL_MS,
          maxStaleMs: POLICY_MAX_STALE_MS,
          fetcher: () => fetchManagerTimeClockPolicy(ownerRestaurant.id),
          onRevalidate: setPolicy,
        });
        if (cancelled) return;
        setPolicy(result.data);
        setFreshness(result.freshness);
        const [codes, staffRows, sectionRows, setupConfig, taxesCharges, discountData] = await Promise.all([
          fetchManagerJobCodes().catch(() => []),
          fetchManagerStaff(ownerRestaurant.id),
          fetchRestaurantSections(ownerRestaurant.id).catch(() => []),
          fetchRestaurantSetupConfig(ownerRestaurant.id).catch(() => ({})),
          fetchTaxesCharges(ownerRestaurant.id).catch(() => ({ tax_rates: [], service_charges: [] })),
          fetchDiscountRules(ownerRestaurant.id).catch(() => ({ discount_rules: [] })),
        ]);
        if (cancelled) return;
        const normalizedSetup = normalizeSetupConfig(setupConfig);
        setJobCodes(codes);
        setStaff(staffRows);
        setSectionEdits(normalizeSectionNames(sectionRows.map((section) => section.name)));
        setLegalEdits(normalizedSetup.legal);
        setPaymentEdits(normalizedSetup.payments);
        setServiceModelEdits(normalizedSetup.serviceModel);
        setTaxRateEdits(normalizeTaxRates(taxesCharges.tax_rates));
        setServiceChargeEdits(normalizeServiceCharges(taxesCharges.service_charges));
        setDiscountRuleEdits(normalizeDiscountRules(discountData.discount_rules));
        setRateEdits(Object.fromEntries(codes.map((code) => [code.id, String(code.default_hourly_rate ?? '')])));
        setStaffPayEdits(Object.fromEntries(staffRows.map((person) => [person.id, stringifyPayRate(person)])));
        setStaffHoursEdits(Object.fromEntries(staffRows.map((person) => [person.id, String(person.suggested_weekly_hours ?? '')])));
        setStaffRoleEdits(Object.fromEntries(staffRows.map((person) => [person.id, String(person.role || '')])));
      })
      .catch((err) => {
        if (!cancelled) setMessage(err instanceof Error ? err.message : 'Could not load settings.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSetting = (patch: Partial<RemoteTimeClockSettings>) => {
    setPolicy((current) => {
      const base = current || DEFAULT_REMOTE_TIME_CLOCK_POLICY;
      const nextSettings = {
        ...base.remote_time_clock,
        ...patch,
      };
      if (!nextSettings.enabled) nextSettings.allow_manual_entries = false;
      return {
        ...base,
        restaurant_id: restaurantId || base.restaurant_id,
        remote_time_clock: nextSettings,
      };
    });
  };

  const savePolicy = async () => {
    if (!restaurantId) return;
    setIsSaving(true);
    setMessage('Saving remote clock settings...');
    try {
      const saved = await saveManagerTimeClockPolicy(restaurantId, settings);
      setPolicy(saved);
      setFreshness('fresh');
      await writeCacheRecord(
        { namespace: 'manager-time-clock-policy', version: 1, parts: [restaurantId] },
        saved,
        POLICY_CACHE_TTL_MS,
      ).catch(() => undefined);
      setMessage('Remote clock settings saved.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save remote clock settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveSections = async () => {
    if (!restaurantId) return;
    setIsSavingSections(true);
    setSectionsMessage('Saving sections...');
    try {
      const saved = await saveRestaurantSections(restaurantId, normalizeSectionNames(sectionEdits));
      setSectionEdits(normalizeSectionNames(saved.map((section) => section.name)));
      setSectionsMessage('Restaurant sections saved.');
    } catch (err) {
      setSectionsMessage(err instanceof Error ? err.message : 'Could not save restaurant sections.');
    } finally {
      setIsSavingSections(false);
    }
  };

  const saveLegal = async () => {
    if (!restaurantId) return;
    if (!legalEdits.legal_business_name.trim() || !legalEdits.legal_contact_name.trim()) {
      setLegalMessage('Legal business name and authorized signer are required.');
      return;
    }
    setIsSavingLegal(true);
    setLegalMessage('Saving legal setup...');
    try {
      const signedAt = legalEdits.tos_signed_at || new Date().toISOString();
      const signature = legalEdits.tos_signature_data_url || buildSignatureDataUrl(legalEdits.legal_contact_name);
      const saved = await saveRestaurantSetupConfig(restaurantId, {
        ...legalEdits,
        tos_signature_data_url: signature,
        tos_signed_at: signedAt,
        tos_version: 'shire-placeholder-tos-v1',
      });
      setLegalEdits(normalizeSetupConfig(saved).legal);
      setLegalMessage('Legal setup saved.');
    } catch (err) {
      setLegalMessage(err instanceof Error ? err.message : 'Could not save legal setup.');
    } finally {
      setIsSavingLegal(false);
    }
  };

  const signLegalTerms = () => {
    const signedAt = new Date().toISOString();
    setLegalEdits((current) => ({
      ...current,
      tos_signature_data_url: buildSignatureDataUrl(current.legal_contact_name || current.legal_business_name),
      tos_signed_at: signedAt,
    }));
    setLegalMessage(`Signed ${new Date(signedAt).toLocaleString()}. Save legal setup to sync.`);
  };

  const savePayments = async () => {
    if (!restaurantId) return;
    setIsSavingPayments(true);
    setPaymentsMessage('Saving payment setup...');
    try {
      const saved = await saveRestaurantSetupConfig(restaurantId, paymentEdits);
      setPaymentEdits(normalizeSetupConfig(saved).payments);
      setPaymentsMessage('Payment setup saved.');
    } catch (err) {
      setPaymentsMessage(err instanceof Error ? err.message : 'Could not save payment setup.');
    } finally {
      setIsSavingPayments(false);
    }
  };

  const saveServiceModel = async () => {
    if (!restaurantId) return;
    setIsSavingServiceModel(true);
    setServiceModelMessage('Saving service model...');
    try {
      const serviceModes = serviceModelEdits.service_modes.length > 0
        ? serviceModelEdits.service_modes
        : DEFAULT_SERVICE_MODEL.service_modes;
      const saved = await saveRestaurantSetupConfig(restaurantId, {
        service_modes: serviceModes,
        default_guest_flow: serviceModelEdits.default_guest_flow,
      });
      setServiceModelEdits(normalizeSetupConfig(saved).serviceModel);
      setServiceModelMessage('Service model saved.');
    } catch (err) {
      setServiceModelMessage(err instanceof Error ? err.message : 'Could not save service model.');
    } finally {
      setIsSavingServiceModel(false);
    }
  };

  const updateTaxRate = (index: number, patch: Partial<TaxRate>) => {
    setTaxRateEdits((current) => normalizeTaxRates(current).map((row, currentIndex) => {
      const updated = currentIndex === index ? { ...row, ...patch } : row;
      if (patch.is_default && currentIndex !== index) return { ...updated, is_default: false };
      return updated;
    }));
  };

  const removeTaxRate = (index: number) => {
    setTaxRateEdits((current) => {
      const next = normalizeTaxRates(current).filter((_, currentIndex) => currentIndex !== index);
      if (next.length === 0) return [{ ...DEFAULT_TAX_RATE }];
      if (!next.some((row) => row.is_default)) next[0] = { ...next[0], is_default: true };
      return next;
    });
  };

  const updateServiceCharge = (index: number, patch: Partial<ServiceCharge>) => {
    setServiceChargeEdits((current) => current.map((row, currentIndex) => (currentIndex === index ? { ...row, ...patch } : row)));
  };

  const saveTaxesCharges = async () => {
    if (!restaurantId) return;
    setIsSavingTaxes(true);
    setTaxesMessage('Saving taxes and charges...');
    try {
      const saved = await saveRestaurantTaxesCharges(restaurantId, taxChargePayload(taxRateEdits, serviceChargeEdits));
      setTaxRateEdits(normalizeTaxRates(saved.tax_rates));
      setServiceChargeEdits(normalizeServiceCharges(saved.service_charges));
      setTaxesMessage('Taxes and charges saved.');
    } catch (err) {
      setTaxesMessage(err instanceof Error ? err.message : 'Could not save taxes and charges.');
    } finally {
      setIsSavingTaxes(false);
    }
  };

  const updateDiscountRule = (index: number, patch: Partial<DiscountRule>) => {
    setDiscountRuleEdits((current) => current.map((row, currentIndex) => (currentIndex === index ? { ...row, ...patch } : row)));
  };

  const toggleListValue = <T extends string | number,>(values: T[], value: T) =>
    values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

  const saveDiscountRules = async () => {
    if (!restaurantId) return;
    setIsSavingDiscounts(true);
    setDiscountsMessage('Saving discounts...');
    try {
      const saved = await saveRestaurantDiscountRules(restaurantId, discountRulesPayload(discountRuleEdits));
      setDiscountRuleEdits(normalizeDiscountRules(saved.discount_rules));
      setDiscountsMessage('Discounts saved.');
    } catch (err) {
      setDiscountsMessage(err instanceof Error ? err.message : 'Could not save discounts.');
    } finally {
      setIsSavingDiscounts(false);
    }
  };

  const toggleServiceMode = (modeId: string) => {
    setServiceModelEdits((current) => {
      const selected = current.service_modes.includes(modeId);
      const nextModes = selected
        ? current.service_modes.filter((mode) => mode !== modeId)
        : [...current.service_modes, modeId];
      return {
        ...current,
        service_modes: nextModes.length > 0 ? nextModes : DEFAULT_SERVICE_MODEL.service_modes,
      };
    });
  };

  const saveRoleRate = async (jobCode: JobCode) => {
    const rawRate = rateEdits[jobCode.id] ?? '';
    const parsed = Number(rawRate);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setMessage('Enter a valid hourly rate.');
      return;
    }
    setSavingRateId(jobCode.id);
    setMessage(`Saving ${jobCode.label || jobCode.code} rate...`);
    try {
      const saved = await updateManagerJobCode(jobCode.id, {
        default_hourly_rate: parsed.toFixed(2),
      });
      setJobCodes((current) => current.map((code) => (code.id === saved.id ? saved : code)));
      setRateEdits((current) => ({ ...current, [saved.id]: String(saved.default_hourly_rate ?? parsed.toFixed(2)) }));
      setMessage('Role rate saved.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save role rate.');
    } finally {
      setSavingRateId(null);
    }
  };

  const saveStaffPay = async (person: StaffContact) => {
    const rawRate = staffPayEdits[person.id]?.trim() ?? '';
    const rawHours = staffHoursEdits[person.id]?.trim() ?? '';
    const role = staffRoleEdits[person.id]?.trim() || person.role || undefined;
    const parsedRate = rawRate === '' ? null : Number(rawRate);
    const parsedHours = rawHours === '' ? null : Number(rawHours);
    if (parsedRate !== null && (!Number.isFinite(parsedRate) || parsedRate < 0)) {
      setMessage('Enter a valid employee hourly rate.');
      return;
    }
    if (parsedHours !== null && (!Number.isFinite(parsedHours) || parsedHours < 0)) {
      setMessage('Enter valid weekly hours.');
      return;
    }
    setSavingStaffId(person.id);
    setMessage(`Saving ${person.name || 'employee'} pay...`);
    try {
      const payPatch = buildPayPatch(person, parsedRate);
      const saved = await updateManagerStaff(person.id, {
        role,
        suggested_weekly_hours: parsedHours,
        ...payPatch,
      });
      setStaff((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      setStaffPayEdits((current) => ({ ...current, [saved.id]: stringifyPayRate(saved) }));
      setStaffHoursEdits((current) => ({ ...current, [saved.id]: String(saved.suggested_weekly_hours ?? '') }));
      setStaffRoleEdits((current) => ({ ...current, [saved.id]: String(saved.role || '') }));
      setMessage('Employee pay saved.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save employee pay.');
    } finally {
      setSavingStaffId(null);
    }
  };

  const enableNotifications = async () => {
    if (!restaurantId) return;
    setIsRegisteringNotifications(true);
    setNotificationMessage('Requesting notifications...');
    try {
      const token = await registerManagerPushToken(restaurantId);
      setNotificationMessage(token ? 'Notifications are enabled on this device.' : 'Notifications were not enabled on this device.');
    } catch (err) {
      setNotificationMessage(err instanceof Error ? err.message : 'Could not enable notifications.');
    } finally {
      setIsRegisteringNotifications(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <UiText variant="eyebrow" tone="muted">Settings</UiText>
        <UiText variant="h2" style={styles.title}>Operations</UiText>
        <UiText variant="bodySmall" tone="muted" style={styles.subtitle}>
          {restaurant?.name || 'Restaurant'} controls for employee tools.
        </UiText>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <UiText variant="title">Discounts & comps</UiText>
            <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>
              Preset POS rules for promos, comps, employee meals, and service recovery.
            </UiText>
          </View>
        </View>
        {discountRuleEdits.length === 0 ? (
          <View style={styles.messageCard}>
            <UiText variant="bodySmall" tone="muted">No discount rules configured.</UiText>
          </View>
        ) : null}
        {discountRuleEdits.map((rule, index) => (
          <View key={rule.id || `discount:${index}`} style={styles.taxChargeRow}>
            <TextInput
              value={rule.name}
              onChangeText={(value) => updateDiscountRule(index, { name: value })}
              placeholder="Manager Comp"
              placeholderTextColor={palette.ink[400]}
              style={styles.setupInput}
            />
            <ChoiceGroup
              label="Category"
              value={rule.discount_type}
              options={DISCOUNT_TYPE_OPTIONS}
              onChange={(value) => updateDiscountRule(index, { discount_type: value as DiscountRule['discount_type'] })}
            />
            <View style={styles.twoColumnFields}>
              <ChoiceGroup
                label="Applies to"
                value={rule.applies_to}
                options={DISCOUNT_APPLIES_TO_OPTIONS}
                onChange={(value) => updateDiscountRule(index, { applies_to: value as DiscountRule['applies_to'] })}
              />
              <ChoiceGroup
                label="Value type"
                value={rule.value_type}
                options={DISCOUNT_VALUE_TYPE_OPTIONS}
                onChange={(value) => updateDiscountRule(index, { value_type: value as DiscountRule['value_type'] })}
              />
            </View>
            <View style={styles.twoColumnFields}>
              <TextInput
                value={String(rule.default_value ?? '')}
                editable={rule.value_type !== 'open'}
                onChangeText={(value) => updateDiscountRule(index, { default_value: sanitizeMoney(value).slice(0, 10) })}
                placeholder={rule.value_type === 'fixed' ? 'Default $' : 'Default %'}
                keyboardType="decimal-pad"
                placeholderTextColor={palette.ink[400]}
                style={[styles.setupInput, styles.twoColumnInput]}
              />
              <ChoiceGroup
                label="Tax"
                value={rule.tax_behavior}
                options={DISCOUNT_TAX_BEHAVIOR_OPTIONS}
                onChange={(value) => updateDiscountRule(index, { tax_behavior: value as DiscountRule['tax_behavior'] })}
              />
            </View>
            <View style={styles.choiceWrap}>
              {[
                ['editable_by_employee', 'Editable', rule.editable_by_employee],
                ['requires_manager_approval', 'Approval', rule.requires_manager_approval],
                ['reason_required', 'Reason', rule.reason_required],
              ].map(([field, label, active]) => (
                <Pressable
                  key={String(field)}
                  onPress={() => updateDiscountRule(index, { [field as keyof DiscountRule]: !active } as Partial<DiscountRule>)}
                  style={[styles.choicePill, active && styles.choicePillActive]}
                >
                  <UiText variant="caption" style={active ? styles.choiceTextActive : styles.choiceText}>{label}</UiText>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setDiscountRuleEdits((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                style={styles.removePill}
              >
                <UiText variant="caption" tone="danger">Remove</UiText>
              </Pressable>
            </View>
            {rule.editable_by_employee ? (
              <View style={styles.twoColumnFields}>
                <TextInput
                  value={String(rule.min_value ?? '')}
                  onChangeText={(value) => updateDiscountRule(index, { min_value: sanitizeMoney(value).slice(0, 10) })}
                  placeholder="Minimum"
                  keyboardType="decimal-pad"
                  placeholderTextColor={palette.ink[400]}
                  style={[styles.setupInput, styles.twoColumnInput]}
                />
                <TextInput
                  value={String(rule.max_value ?? '')}
                  onChangeText={(value) => updateDiscountRule(index, { max_value: sanitizeMoney(value).slice(0, 10) })}
                  placeholder="Maximum"
                  keyboardType="decimal-pad"
                  placeholderTextColor={palette.ink[400]}
                  style={[styles.setupInput, styles.twoColumnInput]}
                />
              </View>
            ) : null}
            <UiText variant="caption" tone="muted">Allowed roles</UiText>
            <View style={styles.choiceWrap}>
              {DISCOUNT_ROLE_OPTIONS.map((role) => {
                const active = rule.allowed_roles.includes(role);
                return (
                  <Pressable
                    key={role}
                    onPress={() => updateDiscountRule(index, { allowed_roles: toggleListValue(rule.allowed_roles, role) })}
                    style={[styles.choicePill, active && styles.choicePillActive]}
                  >
                    <UiText variant="caption" style={active ? styles.choiceTextActive : styles.choiceText}>{role}</UiText>
                  </Pressable>
                );
              })}
            </View>
            <UiText variant="caption" tone="muted">Availability</UiText>
            <View style={styles.choiceWrap}>
              {DISCOUNT_SERVICE_OPTIONS.map(([value, label]) => {
                const active = rule.service_modes.includes(value);
                return (
                  <Pressable
                    key={value}
                    onPress={() => updateDiscountRule(index, { service_modes: toggleListValue(rule.service_modes, value) })}
                    style={[styles.choicePill, active && styles.choicePillActive]}
                  >
                    <UiText variant="caption" style={active ? styles.choiceTextActive : styles.choiceText}>{label}</UiText>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.choiceWrap}>
              {DAY_OPTIONS.map(([value, label]) => {
                const active = rule.days_of_week.includes(value);
                return (
                  <Pressable
                    key={value}
                    onPress={() => updateDiscountRule(index, { days_of_week: toggleListValue(rule.days_of_week, value).sort((a, b) => a - b) })}
                    style={[styles.choicePill, active && styles.choicePillActive]}
                  >
                    <UiText variant="caption" style={active ? styles.choiceTextActive : styles.choiceText}>{label}</UiText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        <View style={styles.sectionActions}>
          <UiButton
            label="Add discount"
            variant="secondary"
            disabled={isSavingDiscounts}
            onPress={() => setDiscountRuleEdits((current) => [...current, defaultDiscountRule(current.length)])}
            style={styles.sectionActionButton}
          />
          <UiButton
            label={isSavingDiscounts ? 'Saving...' : 'Save discounts'}
            disabled={isSavingDiscounts || !restaurantId}
            onPress={saveDiscountRules}
            style={styles.sectionActionButton}
          />
        </View>
        <View style={styles.sectionActions}>
          {[
            { ...DEFAULT_DISCOUNT_RULE, name: 'Manager Comp', discount_type: 'comp' as const, applies_to: 'both' as const, value_type: 'open' as const, editable_by_employee: true, max_value: '100', reason_required: true },
            { ...DEFAULT_DISCOUNT_RULE, name: 'Employee Meal', discount_type: 'employee_meal' as const, applies_to: 'item' as const, default_value: '50' },
            { ...DEFAULT_DISCOUNT_RULE, name: 'Service Recovery', discount_type: 'service_recovery' as const, applies_to: 'check' as const, value_type: 'fixed' as const, default_value: '20', reason_required: true },
          ].filter((template) => !discountRuleEdits.some((rule) => rule.name.toLowerCase() === template.name.toLowerCase())).map((template) => (
            <UiButton
              key={template.name}
              label={template.name}
              variant="secondary"
              disabled={isSavingDiscounts}
              onPress={() => setDiscountRuleEdits((current) => [...current, template])}
              style={styles.sectionActionButton}
            />
          ))}
        </View>
        {discountsMessage ? (
          <View style={styles.messageCard}>
            <UiText variant="bodySmall" tone="muted">{discountsMessage}</UiText>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <UiText variant="title">Remote clock-in</UiText>
            <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>
              Disabled restaurants hide remote clock controls from employees.
            </UiText>
          </View>
          <Switch
            value={settings.enabled}
            onValueChange={(enabled) => updateSetting({ enabled, allow_manual_entries: enabled && settings.allow_manual_entries })}
            disabled={isLoading || isSaving}
          />
        </View>

        <SettingRow
          title="Manual hours"
          body="Allow employees to submit past work hours for manager approval."
          value={settings.enabled && settings.allow_manual_entries}
          disabled={!settings.enabled || isSaving}
          onValueChange={(allow_manual_entries) => updateSetting({ allow_manual_entries })}
        />
        <SettingRow
          title="Manager mention required"
          body="Employees choose one admin to notify; all admins can still review."
          value={settings.require_manager_mention}
          disabled={!settings.enabled || isSaving}
          onValueChange={(require_manager_mention) => updateSetting({ require_manager_mention })}
        />

        {freshness === 'stale' && (
          <View style={styles.warningCard}>
            <UiText variant="bodySmall" tone="warning">Showing cached settings while syncing.</UiText>
          </View>
        )}
        {message ? (
          <View style={styles.messageCard}>
            <UiText variant="bodySmall" tone="muted">{message}</UiText>
          </View>
        ) : null}
        <UiButton
          label={isSaving ? 'Saving...' : 'Save remote clock settings'}
          disabled={isSaving || isLoading || !restaurantId}
          onPress={savePolicy}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <UiText variant="title">Business & legal</UiText>
            <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>
              Legal entity details and the placeholder Shire terms signature from Stage 1 onboarding.
            </UiText>
          </View>
        </View>
        <TextInput
          value={legalEdits.legal_business_name}
          onChangeText={(value) => setLegalEdits((current) => ({ ...current, legal_business_name: value }))}
          placeholder="Legal business name"
          placeholderTextColor={palette.ink[400]}
          style={styles.setupInput}
        />
        <TextInput
          value={legalEdits.dba_name}
          onChangeText={(value) => setLegalEdits((current) => ({ ...current, dba_name: value }))}
          placeholder="DBA / trade name"
          placeholderTextColor={palette.ink[400]}
          style={styles.setupInput}
        />
        <View style={styles.twoColumnFields}>
          <TextInput
            value={legalEdits.ein}
            onChangeText={(value) => setLegalEdits((current) => ({ ...current, ein: value }))}
            placeholder="EIN"
            placeholderTextColor={palette.ink[400]}
            style={[styles.setupInput, styles.twoColumnInput]}
          />
          <TextInput
            value={legalEdits.legal_contact_title}
            onChangeText={(value) => setLegalEdits((current) => ({ ...current, legal_contact_title: value }))}
            placeholder="Signer title"
            placeholderTextColor={palette.ink[400]}
            style={[styles.setupInput, styles.twoColumnInput]}
          />
        </View>
        <TextInput
          value={legalEdits.legal_contact_name}
          onChangeText={(value) => setLegalEdits((current) => ({ ...current, legal_contact_name: value }))}
          placeholder="Authorized signer"
          placeholderTextColor={palette.ink[400]}
          style={styles.setupInput}
        />
        <View style={styles.twoColumnFields}>
          <TextInput
            value={legalEdits.legal_contact_email}
            onChangeText={(value) => setLegalEdits((current) => ({ ...current, legal_contact_email: value }))}
            placeholder="Legal email"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={palette.ink[400]}
            style={[styles.setupInput, styles.twoColumnInput]}
          />
          <TextInput
            value={legalEdits.legal_contact_phone}
            onChangeText={(value) => setLegalEdits((current) => ({ ...current, legal_contact_phone: value }))}
            placeholder="Legal phone"
            keyboardType="phone-pad"
            placeholderTextColor={palette.ink[400]}
            style={[styles.setupInput, styles.twoColumnInput]}
          />
        </View>
        <View style={styles.termsBox}>
          <UiText variant="caption" tone="muted">Placeholder Shire Terms of Service</UiText>
          <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>
            By signing, the authorized representative confirms the setup information is accurate and authorizes Shire to configure restaurant operations before final production terms replace this placeholder.
          </UiText>
          <UiText variant="caption" tone={legalEdits.tos_signed_at ? 'success' : 'warning'} style={{ marginTop: spacing[2] }}>
            {legalEdits.tos_signed_at ? `Signed ${new Date(legalEdits.tos_signed_at).toLocaleString()}` : 'Not signed yet'}
          </UiText>
        </View>
        <View style={styles.sectionActions}>
          <UiButton
            label="Sign terms"
            variant="secondary"
            disabled={isSavingLegal}
            onPress={signLegalTerms}
            style={styles.sectionActionButton}
          />
          <UiButton
            label={isSavingLegal ? 'Saving...' : 'Save legal'}
            disabled={isSavingLegal || !restaurantId}
            onPress={saveLegal}
            style={styles.sectionActionButton}
          />
        </View>
        {legalMessage ? (
          <View style={styles.messageCard}>
            <UiText variant="bodySmall" tone="muted">{legalMessage}</UiText>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <UiText variant="title">Payments & processing</UiText>
            <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>
              Bank account readiness and defaults for refunds, tips, and batch close.
            </UiText>
          </View>
        </View>
        <TextInput
          value={paymentEdits.bank_account_holder}
          onChangeText={(value) => setPaymentEdits((current) => ({ ...current, bank_account_holder: value }))}
          placeholder="Account holder"
          placeholderTextColor={palette.ink[400]}
          style={styles.setupInput}
        />
        <TextInput
          value={paymentEdits.bank_name}
          onChangeText={(value) => setPaymentEdits((current) => ({ ...current, bank_name: value }))}
          placeholder="Bank name"
          placeholderTextColor={palette.ink[400]}
          style={styles.setupInput}
        />
        <View style={styles.twoColumnFields}>
          <TextInput
            value={paymentEdits.bank_routing_number}
            onChangeText={(value) => setPaymentEdits((current) => ({ ...current, bank_routing_number: value.replace(/\D/g, '').slice(0, 9) }))}
            placeholder="Routing number"
            keyboardType="number-pad"
            placeholderTextColor={palette.ink[400]}
            style={[styles.setupInput, styles.twoColumnInput]}
          />
          <TextInput
            value={paymentEdits.bank_account_number}
            onChangeText={(value) => setPaymentEdits((current) => ({ ...current, bank_account_number: value.replace(/\D/g, '').slice(0, 17) }))}
            placeholder="Account number"
            keyboardType="number-pad"
            placeholderTextColor={palette.ink[400]}
            style={[styles.setupInput, styles.twoColumnInput]}
          />
        </View>
        <ChoiceGroup
          label="Payout schedule"
          value={paymentEdits.payout_schedule}
          options={[['daily', 'Daily'], ['weekly', 'Weekly'], ['manual', 'Manual']]}
          onChange={(value) => setPaymentEdits((current) => ({ ...current, payout_schedule: value as typeof paymentEdits.payout_schedule }))}
        />
        <ChoiceGroup
          label="Refund funding"
          value={paymentEdits.refund_funding_source}
          options={[['processor_balance', 'Processor balance'], ['bank_account', 'Bank account']]}
          onChange={(value) => setPaymentEdits((current) => ({ ...current, refund_funding_source: value as typeof paymentEdits.refund_funding_source }))}
        />
        <ChoiceGroup
          label="Batch close"
          value={paymentEdits.batch_close_mode}
          options={[['automatic', 'Automatic'], ['manual', 'Manual']]}
          onChange={(value) => setPaymentEdits((current) => ({ ...current, batch_close_mode: value as typeof paymentEdits.batch_close_mode }))}
        />
        <View style={styles.twoColumnFields}>
          <TextInput
            value={paymentEdits.batch_close_time}
            onChangeText={(value) => setPaymentEdits((current) => ({ ...current, batch_close_time: value.slice(0, 5) }))}
            placeholder="Batch close time"
            placeholderTextColor={palette.ink[400]}
            style={[styles.setupInput, styles.twoColumnInput]}
          />
          <TextInput
            value={paymentEdits.refund_approval_threshold}
            onChangeText={(value) => setPaymentEdits((current) => ({ ...current, refund_approval_threshold: sanitizeMoney(value) }))}
            placeholder="Refund approval over $"
            keyboardType="decimal-pad"
            placeholderTextColor={palette.ink[400]}
            style={[styles.setupInput, styles.twoColumnInput]}
          />
        </View>
        <ChoiceGroup
          label="Credit card tips paid"
          value={paymentEdits.credit_card_tip_payout}
          options={[['nightly', 'Nightly'], ['payroll', 'Payroll']]}
          onChange={(value) => setPaymentEdits((current) => ({ ...current, credit_card_tip_payout: value as typeof paymentEdits.credit_card_tip_payout }))}
        />
        <UiButton
          label={isSavingPayments ? 'Saving...' : 'Save payments'}
          disabled={isSavingPayments || !restaurantId}
          onPress={savePayments}
        />
        {paymentsMessage ? (
          <View style={styles.messageCard}>
            <UiText variant="bodySmall" tone="muted">{paymentsMessage}</UiText>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <UiText variant="title">Service model</UiText>
            <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>
              Select every service style this location operates and the default guest flow.
            </UiText>
          </View>
        </View>
        <View style={styles.choiceWrap}>
          {SERVICE_MODE_OPTIONS.map((option) => {
            const active = serviceModelEdits.service_modes.includes(option.id);
            return (
              <Pressable
                key={option.id}
                onPress={() => toggleServiceMode(option.id)}
                style={[styles.choicePill, active && styles.choicePillActive]}
              >
                <UiText variant="caption" style={active ? styles.choiceTextActive : styles.choiceText}>
                  {option.label}
                </UiText>
              </Pressable>
            );
          })}
        </View>
        <ChoiceGroup
          label="Default guest flow"
          value={serviceModelEdits.default_guest_flow}
          options={GUEST_FLOW_OPTIONS.map((option) => [option.id, option.label])}
          onChange={(value) => setServiceModelEdits((current) => ({ ...current, default_guest_flow: value }))}
        />
        <UiButton
          label={isSavingServiceModel ? 'Saving...' : 'Save service model'}
          disabled={isSavingServiceModel || !restaurantId}
          onPress={saveServiceModel}
        />
        {serviceModelMessage ? (
          <View style={styles.messageCard}>
            <UiText variant="bodySmall" tone="muted">{serviceModelMessage}</UiText>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <UiText variant="title">Taxes & charges</UiText>
            <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>
              Tax categories and service fees used by POS totals, refunds, closeout, and reports.
            </UiText>
          </View>
        </View>
        <UiText variant="caption" tone="muted">Tax rates</UiText>
        {normalizeTaxRates(taxRateEdits).map((tax, index) => (
          <View key={tax.id || `tax:${index}`} style={styles.taxChargeRow}>
            <TextInput
              value={tax.name}
              onChangeText={(value) => updateTaxRate(index, { name: value })}
              placeholder="Sales Tax"
              placeholderTextColor={palette.ink[400]}
              style={styles.setupInput}
            />
            <View style={styles.twoColumnFields}>
              <TextInput
                value={String(tax.rate ?? '')}
                onChangeText={(value) => updateTaxRate(index, { rate: sanitizeMoney(value).slice(0, 10) })}
                placeholder="Rate %"
                keyboardType="decimal-pad"
                placeholderTextColor={palette.ink[400]}
                style={[styles.setupInput, styles.twoColumnInput]}
              />
              <ChoiceGroup
                label="Applies to"
                value={tax.applies_to}
                options={TAX_APPLIES_TO_OPTIONS}
                onChange={(value) => updateTaxRate(index, { applies_to: value as TaxRate['applies_to'] })}
              />
            </View>
            <View style={styles.choiceWrap}>
              <Pressable
                onPress={() => updateTaxRate(index, { is_default: true })}
                style={[styles.choicePill, tax.is_default && styles.choicePillActive]}
              >
                <UiText variant="caption" style={tax.is_default ? styles.choiceTextActive : styles.choiceText}>Default</UiText>
              </Pressable>
              <Pressable
                onPress={() => updateTaxRate(index, { is_inclusive: !tax.is_inclusive })}
                style={[styles.choicePill, tax.is_inclusive && styles.choicePillActive]}
              >
                <UiText variant="caption" style={tax.is_inclusive ? styles.choiceTextActive : styles.choiceText}>Included</UiText>
              </Pressable>
              <Pressable onPress={() => removeTaxRate(index)} style={styles.removePill}>
                <UiText variant="caption" tone="danger">Remove</UiText>
              </Pressable>
            </View>
          </View>
        ))}
        <UiButton
          label="Add tax rate"
          variant="secondary"
          disabled={isSavingTaxes}
          onPress={() => setTaxRateEdits((current) => [...normalizeTaxRates(current), { ...DEFAULT_TAX_RATE, name: 'Additional Tax', is_default: false }])}
        />

        <UiText variant="caption" tone="muted">Service charges</UiText>
        {serviceChargeEdits.length === 0 ? (
          <View style={styles.messageCard}>
            <UiText variant="bodySmall" tone="muted">No service charges configured.</UiText>
          </View>
        ) : null}
        {serviceChargeEdits.map((charge, index) => (
          <View key={charge.id || `charge:${index}`} style={styles.taxChargeRow}>
            <TextInput
              value={charge.name}
              onChangeText={(value) => updateServiceCharge(index, { name: value })}
              placeholder="Service Charge"
              placeholderTextColor={palette.ink[400]}
              style={styles.setupInput}
            />
            <View style={styles.twoColumnFields}>
              <ChoiceGroup
                label="Type"
                value={charge.charge_type}
                options={[['percentage', 'Percent'], ['fixed', 'Fixed $']]}
                onChange={(value) => updateServiceCharge(index, { charge_type: value as ServiceCharge['charge_type'] })}
              />
              <TextInput
                value={String(charge.amount ?? '')}
                onChangeText={(value) => updateServiceCharge(index, { amount: sanitizeMoney(value).slice(0, 10) })}
                placeholder={charge.charge_type === 'fixed' ? 'Amount' : 'Rate %'}
                keyboardType="decimal-pad"
                placeholderTextColor={palette.ink[400]}
                style={[styles.setupInput, styles.twoColumnInput]}
              />
            </View>
            <ChoiceGroup
              label="Applies to"
              value={charge.applies_to}
              options={CHARGE_APPLIES_TO_OPTIONS}
              onChange={(value) => updateServiceCharge(index, { applies_to: value as ServiceCharge['applies_to'] })}
            />
            <View style={styles.choiceWrap}>
              {[
                ['taxable', 'Taxable', charge.taxable],
                ['auto_apply', 'Auto apply', charge.auto_apply],
                ['is_tip', 'Gratuity', charge.is_tip],
              ].map(([field, label, active]) => (
                <Pressable
                  key={String(field)}
                  onPress={() => updateServiceCharge(index, { [field as keyof ServiceCharge]: !active } as Partial<ServiceCharge>)}
                  style={[styles.choicePill, active && styles.choicePillActive]}
                >
                  <UiText variant="caption" style={active ? styles.choiceTextActive : styles.choiceText}>{label}</UiText>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setServiceChargeEdits((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                style={styles.removePill}
              >
                <UiText variant="caption" tone="danger">Remove</UiText>
              </Pressable>
            </View>
          </View>
        ))}
        <View style={styles.sectionActions}>
          <UiButton
            label="Add charge"
            variant="secondary"
            disabled={isSavingTaxes}
            onPress={() => setServiceChargeEdits((current) => [...current, defaultServiceCharge(current.length)])}
            style={styles.sectionActionButton}
          />
          <UiButton
            label={isSavingTaxes ? 'Saving...' : 'Save taxes'}
            disabled={isSavingTaxes || !restaurantId}
            onPress={saveTaxesCharges}
            style={styles.sectionActionButton}
          />
        </View>
        {taxesMessage ? (
          <View style={styles.messageCard}>
            <UiText variant="bodySmall" tone="muted">{taxesMessage}</UiText>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <UiText variant="title">Restaurant sections</UiText>
            <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>
              Sections are restaurant areas such as Bar, Patio, Outdoor, or Main Dining. Floor-plan tables use these categories, and unassigned tables default to Table.
            </UiText>
          </View>
        </View>
        {normalizeSectionNames(sectionEdits).map((section, index) => (
          <View key={`${index}:${index === 0 ? 'default' : section}`} style={styles.sectionRow}>
            <TextInput
              value={section}
              editable={index !== 0 && !isSavingSections}
              onChangeText={(value) => {
                const next = normalizeSectionNames(sectionEdits);
                next[index] = index === 0 ? 'Table' : value;
                setSectionEdits(next);
              }}
              placeholder="Bar, Patio, Outdoor"
              placeholderTextColor={palette.ink[400]}
              style={[styles.sectionInput, index === 0 && styles.sectionInputDisabled]}
            />
            <Pressable
              disabled={index === 0 || isSavingSections}
              onPress={() => setSectionEdits((current) => normalizeSectionNames(current).filter((_, currentIndex) => currentIndex !== index))}
              style={[styles.sectionRemoveButton, (index === 0 || isSavingSections) && styles.sectionRemoveButtonDisabled]}
            >
              <UiText variant="caption" tone={index === 0 ? 'muted' : 'danger'}>Remove</UiText>
            </Pressable>
          </View>
        ))}
        <View style={styles.sectionActions}>
          <UiButton
            label="Add section"
            disabled={isSavingSections}
            onPress={() => setSectionEdits((current) => {
              const normalized = normalizeSectionNames(current);
              return [...normalized, `New Section ${normalized.length}`];
            })}
            style={styles.sectionActionButton}
          />
          <UiButton
            label={isSavingSections ? 'Saving...' : 'Save sections'}
            disabled={isSavingSections || !restaurantId}
            onPress={saveSections}
            style={styles.sectionActionButton}
          />
        </View>
        {sectionsMessage ? (
          <View style={styles.messageCard}>
            <UiText variant="bodySmall" tone="muted">{sectionsMessage}</UiText>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <UiText variant="title">Role rates</UiText>
            <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>
              Clocked labor uses these role rates unless an employee has a personal override.
            </UiText>
          </View>
        </View>
        {jobCodes.length === 0 ? (
          <View style={styles.messageCard}>
            <UiText variant="bodySmall" tone="muted">Role rates are not available yet.</UiText>
          </View>
        ) : (
          jobCodes
            .filter((code) => code.is_active !== false)
            .map((code) => (
              <View key={code.id} style={styles.rateRow}>
                <View style={{ flex: 1 }}>
                  <UiText variant="body" style={styles.settingTitle}>{code.label || code.code}</UiText>
                  <UiText variant="caption" tone="muted" style={{ marginTop: spacing[1] }}>
                    {code.is_tipped ? 'Tipped role' : 'Hourly role'}
                  </UiText>
                </View>
                <TextInput
                  value={rateEdits[code.id] ?? ''}
                  onChangeText={(value) => setRateEdits((current) => ({ ...current, [code.id]: value }))}
                  keyboardType="decimal-pad"
                  editable={!savingRateId}
                  placeholder="0.00"
                  placeholderTextColor={palette.ink[400]}
                  style={styles.rateInput}
                />
                <UiButton
                  label={savingRateId === code.id ? '...' : 'Save'}
                  disabled={Boolean(savingRateId)}
                  onPress={() => saveRoleRate(code)}
                  style={styles.rateButton}
                />
              </View>
            ))
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <UiText variant="title">Employee pay</UiText>
            <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>
              Edit each person&apos;s role, hourly override, and weekly hour target.
            </UiText>
          </View>
        </View>
        {staff.length === 0 ? (
          <View style={styles.messageCard}>
            <UiText variant="bodySmall" tone="muted">No active employees returned yet.</UiText>
          </View>
        ) : (
          staff.map((person) => (
            <View key={person.id} style={styles.staffPayRow}>
              <View style={styles.staffPayHeader}>
                <View style={styles.staffAvatar}>
                  <UiText variant="caption" style={styles.staffAvatarText}>
                    {(person.name || person.email || '?').slice(0, 1).toUpperCase()}
                  </UiText>
                </View>
                <View style={{ flex: 1 }}>
                  <UiText variant="body" style={styles.settingTitle}>{person.name || person.email || 'Employee'}</UiText>
                  <UiText variant="caption" tone="muted" style={{ marginTop: spacing[1] }}>
                    {person.email || person.employee_login_id || 'Staff account'}
                  </UiText>
                </View>
              </View>
              <View style={styles.roleChoices}>
                {roleOptions.map((role) => {
                  const active = (staffRoleEdits[person.id] || person.role || '') === role;
                  return (
                    <Pressable
                      key={`${person.id}:${role}`}
                      onPress={() => setStaffRoleEdits((current) => ({ ...current, [person.id]: role }))}
                      style={[styles.rolePill, active && styles.rolePillActive]}
                    >
                      <UiText variant="caption" style={active ? styles.rolePillTextActive : styles.rolePillText}>
                        {role}
                      </UiText>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.staffPayFields}>
                <View style={styles.staffPayField}>
                  <UiText variant="caption" tone="muted">Hourly override</UiText>
                  <TextInput
                    value={staffPayEdits[person.id] ?? ''}
                    onChangeText={(value) => setStaffPayEdits((current) => ({ ...current, [person.id]: sanitizeMoney(value) }))}
                    keyboardType="decimal-pad"
                    editable={savingStaffId !== person.id}
                    placeholder={roleRateForPerson(person, jobCodes) || 'Role rate'}
                    placeholderTextColor={palette.ink[400]}
                    style={styles.payInput}
                  />
                </View>
                <View style={styles.staffPayField}>
                  <UiText variant="caption" tone="muted">Target hrs/wk</UiText>
                  <TextInput
                    value={staffHoursEdits[person.id] ?? ''}
                    onChangeText={(value) => setStaffHoursEdits((current) => ({ ...current, [person.id]: sanitizeMoney(value).slice(0, 5) }))}
                    keyboardType="decimal-pad"
                    editable={savingStaffId !== person.id}
                    placeholder="Unset"
                    placeholderTextColor={palette.ink[400]}
                    style={styles.payInput}
                  />
                </View>
                <UiButton
                  label={savingStaffId === person.id ? 'Saving...' : 'Save'}
                  disabled={Boolean(savingStaffId)}
                  onPress={() => saveStaffPay(person)}
                  style={styles.staffPayButton}
                />
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <UiText variant="title">Notifications</UiText>
            <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>
              Receive manager alerts for remote-clock requests, schedule changes, and staff messages.
            </UiText>
          </View>
        </View>
        {notificationMessage ? (
          <View style={styles.messageCard}>
            <UiText variant="bodySmall" tone="muted">{notificationMessage}</UiText>
          </View>
        ) : null}
        <UiButton
          label={isRegisteringNotifications ? 'Enabling...' : 'Enable notifications'}
          disabled={isRegisteringNotifications || !restaurantId}
          onPress={enableNotifications}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <UiText variant="title">Staff chats</UiText>
            <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>
              Start a DM, create a group chat, or post an announcement from admin.
            </UiText>
          </View>
        </View>
        <UiButton label="Open chats" onPress={() => router.push('/(admin)/messages' as never)} />
      </View>

      <View style={styles.scanSection}>
        <View style={styles.header}>
          <UiText variant="eyebrow" tone="muted">Setup scans</UiText>
          <UiText variant="h2" style={styles.title}>Scan catalog</UiText>
        </View>
        <ScanCatalog embedded />
      </View>
    </ScrollView>
  );
}

function SettingRow({
  title,
  body,
  value,
  disabled,
  onValueChange,
}: {
  title: string;
  body: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => !disabled && onValueChange(!value)}
      style={[styles.settingRow, disabled && styles.settingRowDisabled]}
    >
      <View style={{ flex: 1 }}>
        <UiText variant="body" style={styles.settingTitle}>{title}</UiText>
        <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>{body}</UiText>
      </View>
      <Switch value={value} disabled={disabled} onValueChange={onValueChange} />
    </Pressable>
  );
}

function ChoiceGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<readonly [string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.choiceGroup}>
      <UiText variant="caption" tone="muted">{label}</UiText>
      <View style={styles.choiceWrap}>
        {options.map(([optionValue, optionLabel]) => {
          const active = value === optionValue;
          return (
            <Pressable
              key={optionValue}
              onPress={() => onChange(optionValue)}
              style={[styles.choicePill, active && styles.choicePillActive]}
            >
              <UiText variant="caption" style={active ? styles.choiceTextActive : styles.choiceText}>
                {optionLabel}
              </UiText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: semanticColors.background,
    flex: 1,
  },
  content: {
    gap: spacing[4],
    paddingBottom: 120,
  },
  header: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
  },
  title: {
    color: palette.ink[900],
    marginTop: spacing[1],
  },
  subtitle: {
    marginTop: spacing[1],
  },
  card: {
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing[4],
    marginHorizontal: spacing[4],
    padding: spacing[4],
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[3],
  },
  settingRow: {
    alignItems: 'center',
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[3],
  },
  settingRowDisabled: {
    opacity: 0.55,
  },
  settingTitle: {
    color: palette.ink[900],
    fontFamily: 'Inter_600SemiBold',
  },
  rateRow: {
    alignItems: 'center',
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[3],
  },
  rateInput: {
    backgroundColor: semanticColors.surface,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: palette.ink[900],
    fontFamily: 'Inter_600SemiBold',
    minWidth: 88,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    textAlign: 'right',
  },
  rateButton: {
    minWidth: 72,
  },
  setupInput: {
    backgroundColor: semanticColors.surface,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: palette.ink[900],
    fontFamily: 'Inter_600SemiBold',
    minHeight: 44,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  twoColumnFields: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  twoColumnInput: {
    flex: 1,
    minWidth: 150,
  },
  termsBox: {
    backgroundColor: semanticColors.surface,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[3],
  },
  choiceGroup: {
    gap: spacing[2],
  },
  choiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  choicePill: {
    backgroundColor: semanticColors.surface,
    borderColor: semanticColors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  choicePillActive: {
    backgroundColor: palette.sky[50],
    borderColor: palette.sky[300],
  },
  choiceText: {
    color: palette.ink[600],
  },
  choiceTextActive: {
    color: palette.sky[700],
    fontFamily: 'Inter_700Bold',
  },
  taxChargeRow: {
    backgroundColor: semanticColors.surface,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing[3],
    padding: spacing[3],
  },
  removePill: {
    alignItems: 'center',
    borderColor: statusColors.danger.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  sectionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
  },
  sectionInput: {
    backgroundColor: semanticColors.surface,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: palette.ink[900],
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    minHeight: 44,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  sectionInputDisabled: {
    color: palette.ink[500],
    opacity: 0.75,
  },
  sectionRemoveButton: {
    alignItems: 'center',
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 84,
    paddingHorizontal: spacing[3],
  },
  sectionRemoveButtonDisabled: {
    opacity: 0.45,
  },
  sectionActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  sectionActionButton: {
    flexGrow: 1,
  },
  warningCard: {
    backgroundColor: statusColors.warning.bg,
    borderColor: statusColors.warning.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[3],
  },
  messageCard: {
    backgroundColor: semanticColors.surface,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[3],
  },
  staffPayRow: {
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing[3],
    padding: spacing[3],
  },
  staffPayHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[3],
  },
  staffAvatar: {
    alignItems: 'center',
    backgroundColor: '#ffe4da',
    borderRadius: radius.pill,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  staffAvatarText: {
    color: '#ff6f4d',
    fontFamily: 'Inter_700Bold',
  },
  roleChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  rolePill: {
    backgroundColor: semanticColors.surface,
    borderColor: semanticColors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  rolePillActive: {
    backgroundColor: '#fff0ea',
    borderColor: '#ffd1c3',
  },
  rolePillText: {
    color: palette.ink[600],
    textTransform: 'capitalize',
  },
  rolePillTextActive: {
    color: '#d55232',
    fontFamily: 'Inter_700Bold',
    textTransform: 'capitalize',
  },
  staffPayFields: {
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    flexDirection: 'row',
    gap: spacing[3],
  },
  staffPayField: {
    flex: 1,
    gap: spacing[1],
    minWidth: 120,
  },
  payInput: {
    backgroundColor: semanticColors.surface,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: palette.ink[900],
    fontFamily: 'Inter_600SemiBold',
    minHeight: 44,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  staffPayButton: {
    minWidth: 84,
  },
  scanSection: {
    gap: spacing[3],
  },
});

function sanitizeMoney(value: string) {
  return value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 8);
}

function stringifyPayRate(person: StaffContact) {
  const value = person.hourly_rate ?? person.pay_rate ?? person.default_hourly_rate;
  return value === null || value === undefined ? '' : String(value);
}

function buildPayPatch(person: StaffContact, value: number | null) {
  if ('hourly_rate' in person) return { hourly_rate: value };
  if ('pay_rate' in person) return { pay_rate: value };
  if ('default_hourly_rate' in person) return { default_hourly_rate: value };
  return { hourly_rate: value };
}

function roleRateForPerson(person: StaffContact, jobCodes: JobCode[]) {
  const role = String(person.role || '').toLowerCase();
  const jobCode = jobCodes.find((code) => (
    String(code.code || '').toLowerCase() === role ||
    String(code.label || '').toLowerCase() === role ||
    String(code.id) === String(person.job_code_id || '')
  ));
  const value = jobCode?.default_hourly_rate;
  return value === null || value === undefined || value === '' ? '' : `$${value}`;
}
