import {
  createManagerJobCode,
  fetchRestaurantJobCodes,
  updateManagerJobCode,
  type JobCode,
} from '@/api/timeClock';
import {
  fetchManagerStaff,
  updateManagerStaff,
  type StaffContact,
} from '@/api/employeeOps';
import { SmartTimeField } from '@/components/scheduling/SmartTimeField';
import {
  fetchDiscountRules,
  fetchCheckWorkflowSettings,
  fetchCloseoutSettings,
  fetchFloorPlan,
  fetchManagerControls,
  fetchMenuCategories,
  fetchRestaurantSetupConfig,
  fetchRestaurantSections,
  fetchTaxesCharges,
  fetchTipPayrollSettings,
  saveCloseoutSettings as saveRestaurantCloseoutSettings,
  saveCheckWorkflowSettings as saveRestaurantCheckWorkflowSettings,
  saveDiscountRules as saveRestaurantDiscountRules,
  saveFloorPlanTables,
  saveManagerControls as saveRestaurantManagerControls,
  saveMenuCategories as saveRestaurantMenuCategories,
  saveRestaurantSetupConfig,
  saveRestaurantSections,
  saveTaxesCharges as saveRestaurantTaxesCharges,
  saveTipPayrollSettings as saveRestaurantTipPayrollSettings,
  type CloseoutSettings,
  type CheckWorkflowSettings,
  type DiscountRule,
  type FloorPlanTable,
  type MenuCategory,
  type RolePermission,
  type ServiceCharge,
  type RestaurantSetupConfig,
  type TaxesChargesPayload,
  type TaxRate,
  type TipPayrollSettings,
  type TipRoleRule,
} from '@/api/restaurantSetup';
import ScanCatalog from '@/screens/ScanCatalog';
import { UiButton } from '@/components/ui/Button';
import { PublishControls } from '@/components/ui/PublishControls';
import { ScheduledChangesPanel } from '@/components/ui/ScheduledChangesPanel';
import { UiText } from '@/components/ui/Text';
import { scheduleChange, type ScheduledCommand } from '@/api/scheduledChanges';
import { registerManagerPushToken } from '@/notifications/pushNotifications';
import { palette, semanticColors, statusColors } from '@/styles/colors';
import { radius, spacing } from '@/styles/tokens';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { getOwnerRestaurant, type OwnerRestaurant } from '../../packages/supabase';

import {
  defaultTaxRate,
  defaultMenuCategories,
  defaultCloseoutSettings,
  defaultCheckWorkflowSettings,
  defaultTipPayrollSettings,
  slugRoleCode as roleCode,
  normalizeSectionNames,
  normalizeJobCodes,
  normalizeTaxRates,
  normalizeServiceCharges,
  normalizeMenuCategories,
  menuCategoriesPayload,
  normalizeDiscountRules,
  discountRulesPayload,
  discountRulesEntryError,
  normalizeRolePermissions,
  managerControlsPayload,
  normalizeCloseoutSettings,
  closeoutSettingsPayload,
  normalizeCheckWorkflowSettings,
  checkWorkflowSettingsPayload,
  normalizeTipPayrollSettings,
  tipPayrollPayload,
  taxesChargesPayload,
  MYRTLE_BEACH_CITY_LIMITS_TAX_PRESET,
  taxAppliesToOptions,
  taxPresetDraft,
  bankAccountError,
  collapseEntryWhitespace,
  digitsOnly,
  duplicateName,
  einError,
  emailError,
  emailListError,
  formatEinInput,
  formatUsPhoneInput,
  normalizeEmailInput,
  numberRangeError,
  parseEmailList,
  routingNumberError,
  sanitizeMoneyInput,
  sanitizePercentInput,
  sanitizeDecimalInput,
  usPhoneError,
} from '@shire/settings'

// Mobile-named wrappers over the canonical payload builders. Mobile has no
// auto-gratuity UI, so that key is withheld from the taxes-charges payload.
function taxChargePayload(
  taxRates: TaxRate[],
  serviceCharges: ServiceCharge[],
  categoryAssignments?: TaxesChargesPayload['category_assignments'],
): TaxesChargesPayload {
  const payload = taxesChargesPayload(
    taxRates,
    serviceCharges,
    undefined,
    categoryAssignments,
  )
  return {
    tax_rates: payload.tax_rates as TaxRate[],
    service_charges: payload.service_charges as ServiceCharge[],
    ...(payload.category_assignments
      ? { category_assignments: payload.category_assignments }
      : {}),
  }
}
const closeoutPayload = closeoutSettingsPayload
const checkWorkflowPayload = checkWorkflowSettingsPayload

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
const taxAppliesToChoices = (currentValue: string) => taxAppliesToOptions(currentValue)
  .map((option) => [option.value, option.label] as const);
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
  ['percent', 'Percent %'],
  ['fixed', 'Fixed $'],
  // The custom-amount key: no preset value, staff type the figure on the POS,
  // capped by max_value.
  ['open', 'Custom'],
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
const MANAGER_PERMISSION_FIELDS = [
  ['can_refund', 'Refunds'],
  ['can_void', 'Voids'],
  ['can_comp', 'Comps'],
  ['can_discount', 'Discounts'],
  ['can_open_cash_drawer', 'Open drawer'],
  ['can_no_sale', 'No-sale'],
  ['can_paid_in_out', 'Paid in/out'],
  ['can_adjust_tips', 'Tip edits'],
  ['can_adjust_gratuity', 'Adjust gratuity'],
  ['can_edit_menu', 'Menu edits'],
  ['can_edit_employees', 'Employee edits'],
  ['can_edit_schedules', 'Schedule edits'],
  ['can_view_reports', 'Reports'],
  ['can_close_drawer', 'Close drawer'],
  ['can_close_day', 'Close day'],
  ['can_reopen_business_day', 'Reopen business day'],
  ['can_change_payment_settings', 'Payment settings'],
] as const;
const CASH_TRACKING_OPTIONS = [
  ['shared_drawer', 'Shared drawer'],
  ['per_terminal', 'Per terminal'],
  ['per_employee', 'Per employee'],
  ['no_cash', 'No cash'],
] as const;
const CHECKOUT_REPORT_OPTIONS = [
  ['none', 'None'],
  ['print', 'Print'],
  ['email', 'Email'],
  ['print_and_email', 'Print + email'],
] as const;
const EOD_BATCH_OPTIONS = [
  ['automatic', 'Automatic'],
  ['manual', 'Manual'],
  ['prompt_manager', 'Prompt manager'],
] as const;
const EOD_REPORT_OPTIONS = [
  ['sales_summary', 'Sales'],
  ['labor_summary', 'Labor'],
  ['cash_drawer_summary', 'Cash drawer'],
  ['tip_summary', 'Tips'],
  ['discounts_voids_refunds', 'Discounts/voids/refunds'],
  ['tax_summary', 'Taxes'],
] as const;
const ORDER_FIRE_MODE_OPTIONS = [
  ['manual', 'Manual fire'],
  ['immediate', 'Send now'],
  ['by_course', 'By course'],
] as const;
const TIP_DISTRIBUTION_OPTIONS = [
  ['individual', 'Individual'],
  ['pooled', 'Pooled'],
  ['role_based', 'Role-based'],
  ['sales_based', 'Sales-based'],
  ['hours_based', 'Hours-based'],
  ['points_based', 'Point-based'],
  ['role_shares', 'Role shares'],
] as const;
const CASH_TIP_OPTIONS = [
  ['not_tracked', 'Not tracked'],
  ['declared_by_employee', 'Employee declares'],
  ['declared_by_manager', 'Manager declares'],
  ['required_checkout', 'Required checkout'],
] as const;
const PAYROLL_EXPORT_OPTIONS = [
  ['daily', 'Daily'],
  ['weekly', 'Weekly'],
  ['biweekly', 'Biweekly'],
  ['semimonthly', 'Semimonthly'],
  ['monthly', 'Monthly'],
  ['manual', 'Manual'],
] as const;
const TIP_POOL_RESET_OPTIONS = [
  ['shift', 'Shift'],
  ['day', 'Day'],
  ['pay_period', 'Pay period'],
] as const;
const TIPOUT_BASIS_OPTIONS = [
  ['none', 'None'],
  ['sales', 'Sales'],
  ['tips', 'Tips'],
  ['hours', 'Hours'],
  ['points', 'Points'],
  ['custom', 'Custom'],
] as const;
const PERMISSION_TIER_OPTIONS = [
  ['owner', 'Owner'],
  ['manager', 'Manager'],
  ['normal', 'Normal'],
  ['limited', 'Limited'],
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

function textValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function validateDiscountRules(discountRules: DiscountRule[]) {
  const validationError = discountRulesEntryError(discountRules);
  if (validationError) throw new Error(validationError);
  return normalizeDiscountRules(discountRules);
}

function hasRequiredFloorTableFields(table: FloorPlanTable) {
  return Boolean((table.table_number || '').trim())
    && Number(table.capacity) > 0
    && Boolean(table.section_id || table.section_name);
}

function isFloorTableComplete(table: FloorPlanTable) {
  return hasRequiredFloorTableFields(table) && table.setup_complete === true;
}

function normalizeFloorTables(rows: FloorPlanTable[] | undefined): FloorPlanTable[] {
  return (Array.isArray(rows) ? rows : []).map((table) => ({
    ...table,
    table_number: table.table_number || '',
    capacity: Number(table.capacity) > 0 ? Number(table.capacity) : 0,
    section_id: table.section_id || null,
    section_name: table.section_name || null,
    setup_complete: Boolean(table.setup_complete) && hasRequiredFloorTableFields(table),
  }));
}

function floorTablePayload(table: FloorPlanTable): FloorPlanTable {
  const normalized = normalizeFloorTables([table])[0];
  return {
    ...normalized,
    table_number: normalized.table_number?.trim() || null,
    setup_complete: hasRequiredFloorTableFields(normalized),
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
      ein: formatEinInput(config.ein),
      legal_contact_name: textValue(config.legal_contact_name),
      legal_contact_title: textValue(config.legal_contact_title),
      legal_contact_email: normalizeEmailInput(config.legal_contact_email),
      legal_contact_phone: formatUsPhoneInput(config.legal_contact_phone),
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
  const [jobCodes, setJobCodes] = useState<JobCode[]>([]);
  const [staff, setStaff] = useState<StaffContact[]>([]);
  const [sectionEdits, setSectionEdits] = useState<string[]>(['Table']);
  const [floorSections, setFloorSections] = useState<{ id: string; name: string }[]>([]);
  const [floorTables, setFloorTables] = useState<FloorPlanTable[]>([]);
  const [legalEdits, setLegalEdits] = useState(DEFAULT_LEGAL);
  const [paymentEdits, setPaymentEdits] = useState(DEFAULT_PAYMENTS);
  const [paymentAccountConfirmation, setPaymentAccountConfirmation] = useState('');
  const [serviceModelEdits, setServiceModelEdits] = useState(DEFAULT_SERVICE_MODEL);
  const [taxRateEdits, setTaxRateEdits] = useState<TaxRate[]>([defaultTaxRate()]);
  const [taxCategoryAssignments, setTaxCategoryAssignments] = useState<TaxesChargesPayload['category_assignments']>();
  const [serviceChargeEdits, setServiceChargeEdits] = useState<ServiceCharge[]>([]);
  const [menuCategoryEdits, setMenuCategoryEdits] = useState<MenuCategory[]>(defaultMenuCategories());
  const [discountRuleEdits, setDiscountRuleEdits] = useState<DiscountRule[]>([]);
  const [rolePermissionEdits, setRolePermissionEdits] = useState<RolePermission[]>(normalizeRolePermissions([]));
  const [closeoutEdits, setCloseoutEdits] = useState<CloseoutSettings>(defaultCloseoutSettings());
  const [checkWorkflowEdits, setCheckWorkflowEdits] = useState<CheckWorkflowSettings>(defaultCheckWorkflowSettings());
  const [tipPayrollEdits, setTipPayrollEdits] = useState<TipPayrollSettings>(defaultTipPayrollSettings());
  const [jobCodeDraft, setJobCodeDraft] = useState<JobCode>({ id: '', code: '', label: '', permission_tier: 'normal', default_hourly_rate: '', is_tipped: false, tipout_role: null, sort_order: 100, is_active: true });
  const [rateEdits, setRateEdits] = useState<Record<string, string>>({});
  const [staffPayEdits, setStaffPayEdits] = useState<Record<string, string>>({});
  const [staffHoursEdits, setStaffHoursEdits] = useState<Record<string, string>>({});
  const [staffRoleEdits, setStaffRoleEdits] = useState<Record<string, string>>({});
  const [savingRateId, setSavingRateId] = useState<string | null>(null);
  const [savingStaffId, setSavingStaffId] = useState<string | null>(null);
  const [, setIsLoading] = useState(true);
  const [isRegisteringNotifications, setIsRegisteringNotifications] = useState(false);
  const [message, setMessage] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [sectionsMessage, setSectionsMessage] = useState('');
  const [floorTablesMessage, setFloorTablesMessage] = useState('');
  const [legalMessage, setLegalMessage] = useState('');
  const [paymentsMessage, setPaymentsMessage] = useState('');
  const [serviceModelMessage, setServiceModelMessage] = useState('');
  const [taxesMessage, setTaxesMessage] = useState('');
  const [menuCategoriesMessage, setMenuCategoriesMessage] = useState('');
  const [discountsMessage, setDiscountsMessage] = useState('');
  const [managerControlsMessage, setManagerControlsMessage] = useState('');
  const [closeoutMessage, setCloseoutMessage] = useState('');
  const [checkWorkflowMessage, setCheckWorkflowMessage] = useState('');
  const [tipPayrollMessage, setTipPayrollMessage] = useState('');
  const [isSavingSections, setIsSavingSections] = useState(false);
  const [isSavingFloorTables, setIsSavingFloorTables] = useState(false);
  const [isSavingLegal, setIsSavingLegal] = useState(false);
  const [isSavingPayments, setIsSavingPayments] = useState(false);
  const [isSavingServiceModel, setIsSavingServiceModel] = useState(false);
  const [isSavingTaxes, setIsSavingTaxes] = useState(false);
  const [isSavingMenuCategories, setIsSavingMenuCategories] = useState(false);
  const [isSavingDiscounts, setIsSavingDiscounts] = useState(false);
  const [isSavingManagerControls, setIsSavingManagerControls] = useState(false);
  const [isSavingCloseout, setIsSavingCloseout] = useState(false);
  const [isSavingCheckWorkflow, setIsSavingCheckWorkflow] = useState(false);
  const [isSavingTipPayroll, setIsSavingTipPayroll] = useState(false);

  const restaurantId = restaurant?.id;

  type Publication = { scheduledFor: string; timezone: string } | undefined;
  const scheduleRestaurantSave = async (
    publication: Publication,
    label: string,
    command: Omit<ScheduledCommand, 'target_type' | 'target_id'>,
    onScheduled: (message: string) => void = setMessage,
  ) => {
    if (!publication || !restaurantId) return false;
    const result = await scheduleChange({
      label,
      scheduledFor: publication.scheduledFor,
      timezone: publication.timezone,
      commands: [{ ...command, target_type: 'restaurant', target_id: restaurantId }],
    });
    const message = `${label} scheduled for ${new Date(result.scheduled_for).toLocaleString()}.`;
    setMessage(message);
    onScheduled(message);
    return true;
  };
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
        const [codes, staffRows, sectionRows, floorPlan, setupConfig, taxesCharges, menuCategoryData, discountData, managerControls, closeoutSettings, checkWorkflowSettings, tipPayrollSettings] = await Promise.all([
          fetchRestaurantJobCodes(ownerRestaurant.id).catch(() => []),
          fetchManagerStaff(ownerRestaurant.id),
          fetchRestaurantSections(ownerRestaurant.id).catch(() => []),
          fetchFloorPlan(ownerRestaurant.id).catch(() => ({ has_floor_plan: false, tables: [], total_tables: 0, total_capacity: 0 })),
          fetchRestaurantSetupConfig(ownerRestaurant.id).catch(() => ({})),
          fetchTaxesCharges(ownerRestaurant.id).catch(() => ({ tax_rates: [], service_charges: [] })),
          fetchMenuCategories(ownerRestaurant.id).catch(() => ({ categories: [] })),
          fetchDiscountRules(ownerRestaurant.id).catch(() => ({ discount_rules: [] })),
          fetchManagerControls(ownerRestaurant.id).catch(() => ({ role_permissions: [] })),
          fetchCloseoutSettings(ownerRestaurant.id).catch(() => defaultCloseoutSettings()),
          fetchCheckWorkflowSettings(ownerRestaurant.id).catch(() => defaultCheckWorkflowSettings()),
          fetchTipPayrollSettings(ownerRestaurant.id).catch(() => defaultTipPayrollSettings()),
        ]);
        if (cancelled) return;
        const normalizedSetup = normalizeSetupConfig(setupConfig);
        const normalizedCodes = normalizeJobCodes(codes);
        setJobCodes(normalizedCodes);
        setStaff(staffRows);
        setFloorSections(sectionRows.map((section) => ({ id: section.id, name: section.name })).filter((section) => section.id && section.name));
        setSectionEdits(normalizeSectionNames(sectionRows.map((section) => section.name)));
        setFloorTables(normalizeFloorTables(floorPlan.tables));
        setLegalEdits(normalizedSetup.legal);
        setPaymentEdits(normalizedSetup.payments);
        setPaymentAccountConfirmation(normalizedSetup.payments.bank_account_number);
        setServiceModelEdits(normalizedSetup.serviceModel);
        setTaxRateEdits(normalizeTaxRates(taxesCharges.tax_rates));
        setTaxCategoryAssignments(undefined);
        setServiceChargeEdits(normalizeServiceCharges(taxesCharges.service_charges));
        setMenuCategoryEdits(normalizeMenuCategories(menuCategoryData.categories));
        setDiscountRuleEdits(normalizeDiscountRules(discountData.discount_rules));
        setRolePermissionEdits(normalizeRolePermissions(managerControls.role_permissions, normalizedCodes));
        setCloseoutEdits(normalizeCloseoutSettings(closeoutSettings));
        setCheckWorkflowEdits(normalizeCheckWorkflowSettings(checkWorkflowSettings));
        setTipPayrollEdits(normalizeTipPayrollSettings(tipPayrollSettings, normalizedCodes));
        setRateEdits(Object.fromEntries(normalizedCodes.map((code) => [code.id, String(code.default_hourly_rate ?? '')])));
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

  const saveSections = async (publication?: Publication) => {
    if (!restaurantId) return;
    setIsSavingSections(true);
    setSectionsMessage('Saving sections...');
    try {
      const body = { sections: normalizeSectionNames(sectionEdits) };
      if (await scheduleRestaurantSave(publication, 'Restaurant sections', { method: 'PUT', path: `/restaurants/${restaurantId}/sections`, body }, setSectionsMessage)) return;
      const saved = await saveRestaurantSections(restaurantId, normalizeSectionNames(sectionEdits));
      setSectionEdits(normalizeSectionNames(saved.map((section) => section.name)));
      setFloorSections(saved.map((section) => ({ id: section.id, name: section.name })).filter((section) => section.id && section.name));
      setSectionsMessage('Restaurant sections saved.');
    } catch (err) {
      setSectionsMessage(err instanceof Error ? err.message : 'Could not save restaurant sections.');
    } finally {
      setIsSavingSections(false);
    }
  };

  const updateFloorTable = (tableId: string, patch: Partial<FloorPlanTable>) => {
    setFloorTables((current) => normalizeFloorTables(current.map((table) => {
      if (table.id !== tableId) return table;
      const section = patch.section_id !== undefined
        ? floorSections.find((item) => item.id === patch.section_id)
        : null;
      const nextTable = {
        ...table,
        ...patch,
        ...(patch.section_id !== undefined ? { section_name: section?.name || null } : {}),
      };
      return {
        ...nextTable,
        setup_complete: hasRequiredFloorTableFields(nextTable),
      };
    })));
  };

  const saveFloorTables = async (publication?: Publication) => {
    if (!restaurantId) return;
    setIsSavingFloorTables(true);
    setFloorTablesMessage('Saving table setup...');
    try {
      const prepared = normalizeFloorTables(floorTables).map(floorTablePayload);
      if (await scheduleRestaurantSave(publication, 'Table setup', { method: 'POST', path: `/restaurants/${restaurantId}/floor-plan/save`, body: { image_url: null, tables: prepared } }, setFloorTablesMessage)) return;
      await saveFloorPlanTables(restaurantId, prepared);
      setFloorTables(normalizeFloorTables(prepared));
      const unfinished = prepared.filter((table) => !isFloorTableComplete(table)).length;
      setFloorTablesMessage(unfinished > 0 ? `${unfinished} table${unfinished === 1 ? '' : 's'} still unfinished.` : 'All floor-plan tables are complete.');
    } catch (err) {
      setFloorTablesMessage(err instanceof Error ? err.message : 'Could not save table setup.');
    } finally {
      setIsSavingFloorTables(false);
    }
  };

  const saveLegal = async (publication?: Publication) => {
    if (!restaurantId) return;
    if (!legalEdits.legal_business_name.trim() || !legalEdits.legal_contact_name.trim()) {
      setLegalMessage('Legal business name and authorized signer are required.');
      return;
    }
    const validationError = einError(legalEdits.ein)
      || emailError(legalEdits.legal_contact_email)
      || usPhoneError(legalEdits.legal_contact_phone);
    if (validationError) {
      setLegalMessage(validationError);
      return;
    }
    if (!legalEdits.tos_signature_data_url || !legalEdits.tos_signed_at) {
      setLegalMessage('Sign the terms before saving legal setup.');
      return;
    }
    setIsSavingLegal(true);
    setLegalMessage('Saving legal setup...');
    try {
      const patch = {
        ...legalEdits,
        legal_business_name: collapseEntryWhitespace(legalEdits.legal_business_name),
        dba_name: collapseEntryWhitespace(legalEdits.dba_name),
        legal_contact_name: collapseEntryWhitespace(legalEdits.legal_contact_name),
        legal_contact_title: collapseEntryWhitespace(legalEdits.legal_contact_title),
        legal_contact_email: normalizeEmailInput(legalEdits.legal_contact_email),
        tos_version: 'shire-placeholder-tos-v1',
      };
      if (await scheduleRestaurantSave(publication, 'Legal setup', { method: 'PATCH', path: `/restaurants/${restaurantId}/setup-config`, body: { patch } }, setLegalMessage)) return;
      const saved = await saveRestaurantSetupConfig(restaurantId, patch);
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

  const savePayments = async (publication?: Publication) => {
    if (!restaurantId) return;
    if (!collapseEntryWhitespace(paymentEdits.bank_account_holder)) {
      setPaymentsMessage('Account holder is required.');
      return;
    }
    const validationError = routingNumberError(paymentEdits.bank_routing_number, true)
      || bankAccountError(paymentEdits.bank_account_number, true)
      || numberRangeError(paymentEdits.refund_approval_threshold, 'Refund approval threshold', { min: 0 });
    if (validationError) {
      setPaymentsMessage(validationError);
      return;
    }
    if (digitsOnly(paymentEdits.bank_account_number) !== digitsOnly(paymentAccountConfirmation)) {
      setPaymentsMessage('Account numbers do not match.');
      return;
    }
    setIsSavingPayments(true);
    setPaymentsMessage('Saving payment setup...');
    try {
      const patch = {
        ...paymentEdits,
        bank_account_holder: collapseEntryWhitespace(paymentEdits.bank_account_holder),
        bank_name: collapseEntryWhitespace(paymentEdits.bank_name),
        bank_routing_number: digitsOnly(paymentEdits.bank_routing_number, 9),
        bank_account_number: digitsOnly(paymentEdits.bank_account_number, 17),
      };
      if (await scheduleRestaurantSave(publication, 'Payment setup', { method: 'PATCH', path: `/restaurants/${restaurantId}/setup-config`, body: { patch } }, setPaymentsMessage)) return;
      const saved = await saveRestaurantSetupConfig(restaurantId, patch);
      const normalized = normalizeSetupConfig(saved).payments;
      setPaymentEdits(normalized);
      setPaymentAccountConfirmation(normalized.bank_account_number);
      setPaymentsMessage('Payment setup saved.');
    } catch (err) {
      setPaymentsMessage(err instanceof Error ? err.message : 'Could not save payment setup.');
    } finally {
      setIsSavingPayments(false);
    }
  };

  const saveServiceModel = async (publication?: Publication) => {
    if (!restaurantId) return;
    setIsSavingServiceModel(true);
    setServiceModelMessage('Saving service model...');
    try {
      const serviceModes = serviceModelEdits.service_modes.length > 0
        ? serviceModelEdits.service_modes
        : DEFAULT_SERVICE_MODEL.service_modes;
      const patch = { service_modes: serviceModes, default_guest_flow: serviceModelEdits.default_guest_flow };
      if (await scheduleRestaurantSave(publication, 'Service model', { method: 'PATCH', path: `/restaurants/${restaurantId}/setup-config`, body: { patch } }, setServiceModelMessage)) return;
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
      if (next.length === 0) return [defaultTaxRate()];
      if (!next.some((row) => row.is_default)) next[0] = { ...next[0], is_default: true };
      return next;
    });
  };

  const updateServiceCharge = (index: number, patch: Partial<ServiceCharge>) => {
    setServiceChargeEdits((current) => current.map((row, currentIndex) => (currentIndex === index ? { ...row, ...patch } : row)));
  };

  const saveTaxesCharges = async (publication?: Publication) => {
    if (!restaurantId) return;
    setIsSavingTaxes(true);
    setTaxesMessage('Saving taxes and charges...');
    try {
      const payload = taxChargePayload(taxRateEdits, serviceChargeEdits, taxCategoryAssignments);
      if (await scheduleRestaurantSave(publication, 'Taxes and charges', { method: 'PUT', path: `/restaurants/${restaurantId}/taxes-charges`, body: payload as unknown as Record<string, unknown> }, setTaxesMessage)) {
        setTaxCategoryAssignments(undefined);
        return;
      }
      const saved = await saveRestaurantTaxesCharges(restaurantId, payload);
      setTaxRateEdits(normalizeTaxRates(saved.tax_rates));
      setServiceChargeEdits(normalizeServiceCharges(saved.service_charges));
      setTaxCategoryAssignments(undefined);
      setTaxesMessage(saved.category_assignment_warnings?.length
        ? `Taxes saved. ${saved.category_assignment_warnings.join(' ')}`
        : 'Taxes and charges saved.');
    } catch (err) {
      setTaxesMessage(err instanceof Error ? err.message : 'Could not save taxes and charges.');
    } finally {
      setIsSavingTaxes(false);
    }
  };

  const applyMyrtleBeachTaxes = () => {
    Alert.alert(
      'Use Myrtle Beach city-limits rates?',
      'Only apply this inside Myrtle Beach city limits. This replaces the tax-rate draft and assigns Beer & Wine and Cocktails to their correct rates.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply',
          onPress: () => {
            const preset = taxPresetDraft(MYRTLE_BEACH_CITY_LIMITS_TAX_PRESET);
            setTaxRateEdits(preset.tax_rates as TaxRate[]);
            setTaxCategoryAssignments(preset.category_assignments);
            setTaxesMessage('Myrtle Beach rates ready. Save taxes to apply them.');
          },
        },
      ],
    );
  };

  const updateMenuCategory = (index: number, patch: Partial<MenuCategory>) => {
    setMenuCategoryEdits((current) => normalizeMenuCategories(current).map((row, currentIndex) => (
      currentIndex === index ? { ...row, ...patch } : row
    )));
  };

  const saveMenuCategories = async (publication?: Publication) => {
    if (!restaurantId) return;
    setIsSavingMenuCategories(true);
    setMenuCategoriesMessage('Saving menu categories...');
    try {
      const payload = menuCategoriesPayload(menuCategoryEdits);
      if (await scheduleRestaurantSave(publication, 'Menu categories', { method: 'PUT', path: `/restaurants/${restaurantId}/menu/categories`, body: payload as unknown as Record<string, unknown> }, setMenuCategoriesMessage)) return;
      const saved = await saveRestaurantMenuCategories(restaurantId, payload);
      setMenuCategoryEdits(normalizeMenuCategories(saved.categories));
      setMenuCategoriesMessage('Menu categories saved.');
    } catch (err) {
      setMenuCategoriesMessage(err instanceof Error ? err.message : 'Could not save menu categories.');
    } finally {
      setIsSavingMenuCategories(false);
    }
  };

  const updateDiscountRule = (index: number, patch: Partial<DiscountRule>) => {
    setDiscountRuleEdits((current) => current.map((row, currentIndex) => (currentIndex === index ? { ...row, ...patch } : row)));
  };

  const toggleListValue = <T extends string | number,>(values: T[], value: T) =>
    values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

  const saveDiscountRules = async (publication?: Publication) => {
    if (!restaurantId) return;
    setIsSavingDiscounts(true);
    setDiscountsMessage('Saving discounts...');
    try {
      validateDiscountRules(discountRuleEdits);
      const payload = discountRulesPayload(discountRuleEdits);
      if (await scheduleRestaurantSave(publication, 'Discounts', { method: 'PUT', path: `/restaurants/${restaurantId}/discount-rules`, body: payload as unknown as Record<string, unknown> }, setDiscountsMessage)) return;
      const saved = await saveRestaurantDiscountRules(restaurantId, payload);
      setDiscountRuleEdits(normalizeDiscountRules(saved.discount_rules));
      setDiscountsMessage('Discounts saved.');
    } catch (err) {
      setDiscountsMessage(err instanceof Error ? err.message : 'Could not save discounts.');
    } finally {
      setIsSavingDiscounts(false);
    }
  };

  const updateRolePermission = (index: number, patch: Partial<RolePermission>) => {
    setRolePermissionEdits((current) => current.map((row, currentIndex) => (currentIndex === index ? { ...row, ...patch } : row)));
  };

  const saveManagerControls = async (publication?: Publication) => {
    if (!restaurantId) return;
    setIsSavingManagerControls(true);
    setManagerControlsMessage('Saving manager controls...');
    try {
      const payload = managerControlsPayload(rolePermissionEdits, jobCodes);
      if (await scheduleRestaurantSave(publication, 'Manager controls', { method: 'PUT', path: `/restaurants/${restaurantId}/manager-controls`, body: payload as unknown as Record<string, unknown> }, setManagerControlsMessage)) return;
      const saved = await saveRestaurantManagerControls(restaurantId, payload);
      setRolePermissionEdits(normalizeRolePermissions(saved.role_permissions, jobCodes));
      setManagerControlsMessage('Manager controls saved.');
    } catch (err) {
      setManagerControlsMessage(err instanceof Error ? err.message : 'Could not save manager controls.');
    } finally {
      setIsSavingManagerControls(false);
    }
  };

  const updateCloseout = (patch: Partial<CloseoutSettings>) => {
    setCloseoutEdits((current) => ({ ...current, ...patch }));
  };

  const updateCheckWorkflow = (patch: Partial<CheckWorkflowSettings>) => {
    setCheckWorkflowEdits((current) => ({ ...current, ...patch }));
  };

  const saveCloseoutSettings = async (publication?: Publication) => {
    if (!restaurantId) return;
    const recipientsError = emailListError(closeoutEdits.eod_report_recipients);
    if (recipientsError) {
      setCloseoutMessage(recipientsError);
      return;
    }
    setIsSavingCloseout(true);
    setCloseoutMessage('Saving closeout settings...');
    try {
      const payload = closeoutPayload(closeoutEdits);
      if (await scheduleRestaurantSave(publication, 'Closeout settings', { method: 'PUT', path: `/restaurants/${restaurantId}/closeout-settings`, body: payload as unknown as Record<string, unknown> }, setCloseoutMessage)) return;
      const saved = await saveRestaurantCloseoutSettings(restaurantId, payload);
      setCloseoutEdits(normalizeCloseoutSettings(saved));
      setCloseoutMessage('Closeout settings saved.');
    } catch (err) {
      setCloseoutMessage(err instanceof Error ? err.message : 'Could not save closeout settings.');
    } finally {
      setIsSavingCloseout(false);
    }
  };

  const saveCheckWorkflow = async (publication?: Publication) => {
    if (!restaurantId) return;
    setIsSavingCheckWorkflow(true);
    setCheckWorkflowMessage('Saving check workflow settings...');
    try {
      const payload = checkWorkflowPayload(checkWorkflowEdits);
      if (await scheduleRestaurantSave(publication, 'Check workflow', { method: 'PUT', path: `/restaurants/${restaurantId}/check-workflow-settings`, body: payload as unknown as Record<string, unknown> }, setCheckWorkflowMessage)) return;
      const saved = await saveRestaurantCheckWorkflowSettings(restaurantId, payload);
      setCheckWorkflowEdits(normalizeCheckWorkflowSettings(saved));
      setCheckWorkflowMessage('Check workflow settings saved.');
    } catch (err) {
      setCheckWorkflowMessage(err instanceof Error ? err.message : 'Could not save check workflow settings.');
    } finally {
      setIsSavingCheckWorkflow(false);
    }
  };

  const updateTipPayroll = (patch: Partial<TipPayrollSettings>) => {
    setTipPayrollEdits((current) => ({ ...current, ...patch }));
  };

  const updateTipRule = (index: number, patch: Partial<TipRoleRule>) => {
    setTipPayrollEdits((current) => ({
      ...current,
      role_tip_rules: current.role_tip_rules.map((rule, currentIndex) => (currentIndex === index ? { ...rule, ...patch } : rule)),
    }));
  };

  const saveTipPayroll = async (publication?: Publication) => {
    if (!restaurantId) return;
    setIsSavingTipPayroll(true);
    setTipPayrollMessage('Saving tips and payroll...');
    try {
      const payload = tipPayrollPayload(tipPayrollEdits, jobCodes);
      if (await scheduleRestaurantSave(publication, 'Tips and payroll', { method: 'PUT', path: `/restaurants/${restaurantId}/tips-payroll-settings`, body: payload as unknown as Record<string, unknown> }, setTipPayrollMessage)) return;
      const saved = await saveRestaurantTipPayrollSettings(restaurantId, payload);
      setTipPayrollEdits(normalizeTipPayrollSettings(saved, jobCodes));
      setTipPayrollMessage('Tips and payroll saved.');
    } catch (err) {
      setTipPayrollMessage(err instanceof Error ? err.message : 'Could not save tips and payroll.');
    } finally {
      setIsSavingTipPayroll(false);
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

  const saveRoleRate = async (jobCode: JobCode, publication?: Publication) => {
    if (!restaurantId) return;
    const roleLabel = collapseEntryWhitespace(jobCode.label || jobCode.code);
    if (!roleLabel) {
      setMessage('Role name is required.');
      return;
    }
    if (duplicateName(jobCodes.filter((code) => code.id !== jobCode.id).map((code) => code.label || code.code), roleLabel)) {
      setMessage('That role name is already in use.');
      return;
    }
    const normalizedRoleCode = roleCode(jobCode.code || roleLabel);
    if (jobCodes.some((code) => code.id !== jobCode.id && roleCode(code.code || code.label) === normalizedRoleCode)) {
      setMessage('That role ID is already in use.');
      return;
    }
    const rawRate = String(jobCode.default_hourly_rate ?? rateEdits[jobCode.id ?? ''] ?? '');
    const parsed = Number(rawRate);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setMessage('Enter a valid hourly rate.');
      return;
    }
    setSavingRateId(jobCode.id || 'new');
    setMessage(`Saving ${jobCode.label || jobCode.code} role...`);
    try {
      const payload = {
        code: normalizedRoleCode,
        label: roleLabel,
        permission_tier: jobCode.permission_tier || 'normal',
        default_hourly_rate: parsed.toFixed(2),
        is_tipped: Boolean(jobCode.is_tipped),
        tipout_role: jobCode.tipout_role || null,
        sort_order: Number(jobCode.sort_order) || 0,
        is_active: jobCode.is_active !== false,
      };
      if (jobCode.id && await scheduleRestaurantSave(publication, `${jobCode.label || jobCode.code} role`, {
        method: 'PATCH',
        path: `/restaurants/${restaurantId}/job-codes/${jobCode.id}`,
        body: payload,
      })) return;
      const saved = jobCode.id
        ? await updateManagerJobCode(restaurantId, jobCode.id, payload)
        : await createManagerJobCode(restaurantId, payload);
      const normalized = normalizeJobCodes(jobCode.id ? jobCodes.map((code) => (code.id === saved.id ? saved : code)) : [...jobCodes, saved]);
      setJobCodes(normalized);
      setRateEdits(Object.fromEntries(normalized.map((code) => [code.id, String(code.default_hourly_rate ?? '')])));
      setTipPayrollEdits((current) => normalizeTipPayrollSettings(current, normalized));
      setRolePermissionEdits((current) => normalizeRolePermissions(current, normalized));
      setJobCodeDraft({ id: '', code: '', label: '', permission_tier: 'normal', default_hourly_rate: '', is_tipped: false, tipout_role: null, sort_order: Math.max(100, ...normalized.map((code) => Number(code.sort_order) || 0)) + 10, is_active: true });
      setMessage('Role saved.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save role.');
    } finally {
      setSavingRateId(null);
    }
  };

  const removeRoleRate = async (jobCode: JobCode) => {
    if (!restaurantId || !jobCode.id) return;
    setSavingRateId(jobCode.id);
    setMessage(`Removing ${jobCode.label || jobCode.code} role...`);
    try {
      await updateManagerJobCode(restaurantId, jobCode.id, {
        code: roleCode(jobCode.code || jobCode.label),
        label: jobCode.label || jobCode.code,
        permission_tier: jobCode.permission_tier || 'normal',
        default_hourly_rate: Number(jobCode.default_hourly_rate || rateEdits[jobCode.id] || 0).toFixed(2),
        is_tipped: Boolean(jobCode.is_tipped),
        tipout_role: jobCode.tipout_role || null,
        sort_order: Number(jobCode.sort_order) || 0,
        is_active: false,
      });
      const normalized = normalizeJobCodes(jobCodes.filter((code) => code.id !== jobCode.id));
      setJobCodes(normalized);
      setRateEdits(Object.fromEntries(normalized.map((code) => [code.id, String(code.default_hourly_rate ?? '')])));
      setTipPayrollEdits((current) => normalizeTipPayrollSettings(current, normalized));
      setRolePermissionEdits((current) => normalizeRolePermissions(current, normalized));
      setMessage('Role removed.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not remove role.');
    } finally {
      setSavingRateId(null);
    }
  };

  const saveStaffPay = async (person: StaffContact, publication?: Publication) => {
    const rawRate = staffPayEdits[person.id]?.trim() ?? '';
    const rawHours = staffHoursEdits[person.id]?.trim() ?? '';
    const role = staffRoleEdits[person.id]?.trim() || person.role || undefined;
    const jobCode = jobCodes.find((code) => code.code === role);
    const parsedRate = rawRate === '' ? null : Number(rawRate);
    const parsedHours = rawHours === '' ? null : Number(rawHours);
    if (parsedRate !== null && (!Number.isFinite(parsedRate) || parsedRate < 0)) {
      setMessage('Enter a valid employee hourly rate.');
      return;
    }
    const hoursError = numberRangeError(rawHours, 'Suggested weekly hours', { min: 0, max: 168 })
    if (hoursError) {
      setMessage(hoursError);
      return;
    }
    setSavingStaffId(person.id);
    setMessage(`Saving ${person.name || 'employee'} pay...`);
    try {
      const payPatch = buildPayPatch(person, parsedRate);
      const payload = {
        role,
        job_code_id: jobCode?.id || null,
        suggested_weekly_hours: parsedHours,
        ...payPatch,
      };
      if (publication && restaurantId) {
        const scheduled = await scheduleChange({
          label: `${person.name || 'Employee'} pay and role`,
          scheduledFor: publication.scheduledFor,
          timezone: publication.timezone,
          commands: [{ method: 'PATCH', path: `/waiters/${person.id}`, body: payload, target_type: 'employee', target_id: person.id, restaurant_id: restaurantId }],
        });
        setMessage(`${person.name || 'Employee'} pay and role scheduled for ${new Date(scheduled.scheduled_for).toLocaleString()}.`);
        return;
      }
      const saved = await updateManagerStaff(person.id, payload);
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

      <ScheduledChangesPanel />

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <UiText variant="title">Floor-plan tables</UiText>
            <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>
              Complete table numbers, sections, and seat counts after drawing the floor plan on desktop.
            </UiText>
          </View>
        </View>
        {floorTables.length === 0 ? (
          <View style={styles.messageCard}>
            <UiText variant="bodySmall" tone="muted">No floor-plan tables are saved yet.</UiText>
          </View>
        ) : (
          normalizeFloorTables(floorTables).map((table, index) => {
            const complete = isFloorTableComplete(table);
            return (
              <View key={table.id} style={[styles.floorTableRow, !complete && styles.floorTableRowIncomplete]}>
                <View style={styles.floorTableHeader}>
                  <UiText variant="body" style={styles.settingTitle}>
                    {table.table_number?.trim() || `Table ${index + 1}`}
                  </UiText>
                  <UiText variant="caption" tone={complete ? 'success' : 'danger'}>
                    {complete ? 'Ready' : 'Unfinished'}
                  </UiText>
                </View>
                <TextInput
                  value={table.table_number || ''}
                  onChangeText={(value) => updateFloorTable(table.id, { table_number: value })}
                  placeholder={`Table ${index + 1}`}
                  placeholderTextColor={palette.ink[400]}
                  style={styles.setupInput}
                />
                <View style={styles.choiceWrap}>
                  {floorSections.map((section) => {
                    const active = table.section_id === section.id;
                    return (
                      <Pressable
                        key={`${table.id}:${section.id}`}
                        onPress={() => updateFloorTable(table.id, { section_id: section.id })}
                        style={[styles.choicePill, active && styles.choicePillActive]}
                      >
                        <UiText variant="caption" style={active ? styles.choiceTextActive : styles.choiceText}>{section.name}</UiText>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  value={Number(table.capacity) > 0 ? String(table.capacity) : ''}
                  onChangeText={(value) => updateFloorTable(table.id, { capacity: Number(value.replace(/[^\d]/g, '').slice(0, 3) || 0) })}
                  placeholder="Seat count"
                  keyboardType="number-pad"
                  placeholderTextColor={palette.ink[400]}
                  style={styles.setupInput}
                />
              </View>
            );
          })
        )}
        {floorTables.length > 0 ? (
          <PublishControls label="Save table setup" busy={isSavingFloorTables} disabled={!restaurantId} onPublishNow={() => saveFloorTables()} onSchedule={(scheduledFor, timezone) => saveFloorTables({ scheduledFor, timezone })} />
        ) : null}
        {floorTablesMessage ? (
          <View style={styles.messageCard}>
            <UiText variant="bodySmall" tone="muted">{floorTablesMessage}</UiText>
          </View>
        ) : null}
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
                onChangeText={(value) => updateDiscountRule(index, { default_value: rule.value_type === 'percent' ? sanitizePercentInput(value) : sanitizeMoneyInput(value) })}
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
                  onChangeText={(value) => updateDiscountRule(index, { min_value: rule.value_type === 'percent' ? sanitizePercentInput(value) : sanitizeMoneyInput(value) })}
                  placeholder="Minimum"
                  keyboardType="decimal-pad"
                  placeholderTextColor={palette.ink[400]}
                  style={[styles.setupInput, styles.twoColumnInput]}
                />
                <TextInput
                  value={String(rule.max_value ?? '')}
                  onChangeText={(value) => updateDiscountRule(index, { max_value: rule.value_type === 'percent' ? sanitizePercentInput(value) : sanitizeMoneyInput(value) })}
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
          <PublishControls label="Save discounts" busy={isSavingDiscounts} disabled={!restaurantId} onPublishNow={() => saveDiscountRules()} onSchedule={(scheduledFor, timezone) => saveDiscountRules({ scheduledFor, timezone })} />
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
            <UiText variant="title">Manager controls</UiText>
            <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>
              Role permissions for POS actions like refunds, voids, comps, drawer access, and reports.
            </UiText>
          </View>
        </View>
        {rolePermissionEdits.map((role, index) => (
          <View key={role.role_key} style={styles.taxChargeRow}>
            <UiText variant="body" style={{ textTransform: 'capitalize' }}>{role.role_key.replace('_', ' ')}</UiText>
            <View style={styles.choiceWrap}>
              {MANAGER_PERMISSION_FIELDS.map(([field, label]) => {
                const active = Boolean(role[field]);
                return (
                  <Pressable
                    key={field}
                    onPress={() => updateRolePermission(index, { [field]: !active } as Partial<RolePermission>)}
                    style={[styles.choicePill, active && styles.choicePillActive]}
                  >
                    <UiText variant="caption" style={active ? styles.choiceTextActive : styles.choiceText}>{label}</UiText>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => updateRolePermission(index, { require_manager_pin_for_approval: !role.require_manager_pin_for_approval })}
                style={[styles.choicePill, role.require_manager_pin_for_approval && styles.choicePillActive]}
              >
                <UiText variant="caption" style={role.require_manager_pin_for_approval ? styles.choiceTextActive : styles.choiceText}>Approval PIN</UiText>
              </Pressable>
            </View>
            <View style={styles.twoColumnFields}>
              <TextInput
                value={String(role.refund_limit ?? '')}
                onChangeText={(value) => updateRolePermission(index, { refund_limit: sanitizeMoneyInput(value) })}
                placeholder="Refund limit"
                keyboardType="decimal-pad"
                placeholderTextColor={palette.ink[400]}
                style={[styles.setupInput, styles.twoColumnInput]}
              />
              <TextInput
                value={String(role.discount_limit_percent ?? '')}
                onChangeText={(value) => updateRolePermission(index, { discount_limit_percent: sanitizePercentInput(value) })}
                placeholder="Discount % limit"
                keyboardType="decimal-pad"
                placeholderTextColor={palette.ink[400]}
                style={[styles.setupInput, styles.twoColumnInput]}
              />
            </View>
          </View>
        ))}
        <PublishControls label="Save manager controls" busy={isSavingManagerControls} disabled={!restaurantId} onPublishNow={() => saveManagerControls()} onSchedule={(scheduledFor, timezone) => saveManagerControls({ scheduledFor, timezone })} />
        {managerControlsMessage ? (
          <View style={styles.messageCard}>
            <UiText variant="bodySmall" tone="muted">{managerControlsMessage}</UiText>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <UiText variant="title">Cash & closeout</UiText>
            <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>
              Cash drawers, server checkout requirements, and end-of-day close rules.
            </UiText>
          </View>
        </View>
        <ChoiceGroup
          label="Cash tracking"
          value={closeoutEdits.cash_tracking_mode}
          options={CASH_TRACKING_OPTIONS}
          onChange={(value) => updateCloseout({ cash_tracking_mode: value as CloseoutSettings['cash_tracking_mode'] })}
        />
        <View style={styles.twoColumnFields}>
          <TextInput
            value={String(closeoutEdits.cash_drop_threshold ?? '')}
            onChangeText={(value) => updateCloseout({ cash_drop_threshold: sanitizeMoneyInput(value) })}
            placeholder="Cash drop threshold"
            keyboardType="decimal-pad"
            placeholderTextColor={palette.ink[400]}
            style={[styles.setupInput, styles.twoColumnInput]}
          />
          <TextInput
            value={String(closeoutEdits.cash_variance_threshold ?? '')}
            onChangeText={(value) => updateCloseout({ cash_variance_threshold: sanitizeMoneyInput(value) })}
            placeholder="Variance threshold"
            keyboardType="decimal-pad"
            placeholderTextColor={palette.ink[400]}
            style={[styles.setupInput, styles.twoColumnInput]}
          />
        </View>
        <View style={styles.choiceWrap}>
          {[
            ['blind_drawer_close', 'Blind close'],
            ['allow_paid_in_out', 'Paid in/out'],
            ['require_manager_for_drawer_open', 'Manager drawer open'],
          ].map(([field, label]) => {
            const active = Boolean(closeoutEdits[field as keyof CloseoutSettings]);
            return (
              <Pressable
                key={field}
                onPress={() => updateCloseout({ [field]: !active } as Partial<CloseoutSettings>)}
                style={[styles.choicePill, active && styles.choicePillActive]}
              >
                <UiText variant="caption" style={active ? styles.choiceTextActive : styles.choiceText}>{label}</UiText>
              </Pressable>
            );
          })}
        </View>
        <ChoiceGroup
          label="Checkout report"
          value={closeoutEdits.server_checkout_report_delivery}
          options={CHECKOUT_REPORT_OPTIONS}
          onChange={(value) => updateCloseout({ server_checkout_report_delivery: value as CloseoutSettings['server_checkout_report_delivery'] })}
        />
        <View style={styles.choiceWrap}>
          {[
            ['server_require_all_checks_closed', 'Checks closed'],
            ['server_require_tabs_closed', 'Tabs closed'],
            ['server_require_credit_tips_reviewed', 'Credit tips'],
            ['deduct_credit_card_tips_from_cash_due', 'Deduct card tips'],
            ['server_require_tipout_entry', 'Tipout'],
            ['server_require_manager_approval', 'Manager approval'],
            ['allow_clockout_before_checkout', 'Clockout before checkout'],
          ].map(([field, label]) => {
            const active = Boolean(closeoutEdits[field as keyof CloseoutSettings]);
            return (
              <Pressable
                key={field}
                onPress={() => updateCloseout({ [field]: !active } as Partial<CloseoutSettings>)}
                style={[styles.choicePill, active && styles.choicePillActive]}
              >
                <UiText variant="caption" style={active ? styles.choiceTextActive : styles.choiceText}>{label}</UiText>
              </Pressable>
            );
          })}
        </View>
        <ChoiceGroup
          label="EOD batch close"
          value={closeoutEdits.eod_batch_close_mode}
          options={EOD_BATCH_OPTIONS}
          onChange={(value) => updateCloseout({ eod_batch_close_mode: value as CloseoutSettings['eod_batch_close_mode'] })}
        />
        <TextInput
          value={closeoutEdits.eod_report_recipients.join(',')}
          onChangeText={(value) => updateCloseout({ eod_report_recipients: value.split(',') })}
          onBlur={() => updateCloseout({ eod_report_recipients: parseEmailList(closeoutEdits.eod_report_recipients) })}
          placeholder="EOD report emails"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor={palette.ink[400]}
          style={styles.setupInput}
        />
        <View style={styles.choiceWrap}>
          <Pressable onPress={() => updateCloseout({ eod_email_on_close: !closeoutEdits.eod_email_on_close })} style={[styles.choicePill, closeoutEdits.eod_email_on_close && styles.choicePillActive]}>
            <UiText variant="caption" style={closeoutEdits.eod_email_on_close ? styles.choiceTextActive : styles.choiceText}>Email report on close</UiText>
          </Pressable>
          {(['pdf', 'xlsx'] as const).map((format) => {
            const active = closeoutEdits.eod_email_formats.includes(format);
            return <Pressable key={format} onPress={() => updateCloseout({ eod_email_formats: active ? closeoutEdits.eod_email_formats.filter((value) => value !== format) : [...closeoutEdits.eod_email_formats, format] })} style={[styles.choicePill, active && styles.choicePillActive]}><UiText variant="caption" style={active ? styles.choiceTextActive : styles.choiceText}>{format.toUpperCase()}</UiText></Pressable>;
          })}
          {[
            ['eod_require_drawers_closed', 'Drawers closed'],
            ['eod_require_servers_checked_out', 'Servers checked out'],
            ['eod_require_open_checks_resolved', 'Open checks'],
            ['eod_require_paid_outs_reviewed', 'Paid outs'],
            ['eod_require_tip_adjustments_reviewed', 'Tip edits'],
          ].map(([field, label]) => {
            const active = Boolean(closeoutEdits[field as keyof CloseoutSettings]);
            return (
              <Pressable
                key={field}
                onPress={() => updateCloseout({ [field]: !active } as Partial<CloseoutSettings>)}
                style={[styles.choicePill, active && styles.choicePillActive]}
              >
                <UiText variant="caption" style={active ? styles.choiceTextActive : styles.choiceText}>{label}</UiText>
              </Pressable>
            );
          })}
        </View>
        <UiText variant="caption" tone="muted">EOD reports</UiText>
        <View style={styles.choiceWrap}>
          {EOD_REPORT_OPTIONS.map(([value, label]) => {
            const active = closeoutEdits.eod_reports.includes(value);
            return (
              <Pressable
                key={value}
                onPress={() => updateCloseout({ eod_reports: toggleListValue(closeoutEdits.eod_reports, value) })}
                style={[styles.choicePill, active && styles.choicePillActive]}
              >
                <UiText variant="caption" style={active ? styles.choiceTextActive : styles.choiceText}>{label}</UiText>
              </Pressable>
            );
          })}
        </View>
        <PublishControls label="Save closeout" busy={isSavingCloseout} disabled={!restaurantId} onPublishNow={() => saveCloseoutSettings()} onSchedule={(scheduledFor, timezone) => saveCloseoutSettings({ scheduledFor, timezone })} />
        {closeoutMessage ? (
          <View style={styles.messageCard}>
            <UiText variant="bodySmall" tone="muted">{closeoutMessage}</UiText>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <UiText variant="title">Check workflow</UiText>
            <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>
              Split checks, seat numbers, tabs, preauth, transfers, and fire rules.
            </UiText>
          </View>
        </View>
        <ChoiceGroup
          label="Default fire mode"
          value={checkWorkflowEdits.default_order_fire_mode}
          options={ORDER_FIRE_MODE_OPTIONS}
          onChange={(value) => updateCheckWorkflow({ default_order_fire_mode: value as CheckWorkflowSettings['default_order_fire_mode'] })}
        />
        <View style={styles.twoColumnFields}>
          <TextInput
            value={String(checkWorkflowEdits.default_hold_minutes ?? '')}
            onChangeText={(value) => updateCheckWorkflow({ default_hold_minutes: value.replace(/[^\d]/g, '').slice(0, 3) || '1' })}
            placeholder="Default hold min"
            keyboardType="number-pad"
            placeholderTextColor={palette.ink[400]}
            style={[styles.setupInput, styles.twoColumnInput]}
          />
          <TextInput
            value={(checkWorkflowEdits.hold_preset_minutes || []).join(', ')}
            onChangeText={(value) => updateCheckWorkflow({
              hold_preset_minutes: value
                .split(',')
                .map((part) => Number(part.replace(/[^\d]/g, '')))
                .filter((minutes) => Number.isFinite(minutes) && minutes > 0)
                .slice(0, 8),
            })}
            placeholder="Hold presets"
            keyboardType="numbers-and-punctuation"
            placeholderTextColor={palette.ink[400]}
            style={[styles.setupInput, styles.twoColumnInput]}
          />
          <TextInput
            value={String(checkWorkflowEdits.default_preauth_amount ?? '')}
            onChangeText={(value) => updateCheckWorkflow({ default_preauth_amount: sanitizeMoneyInput(value) })}
            placeholder="Preauth amount"
            keyboardType="decimal-pad"
            placeholderTextColor={palette.ink[400]}
            style={[styles.setupInput, styles.twoColumnInput]}
          />
        </View>
        <UiText variant="caption" tone="muted">Seats & firing</UiText>
        <View style={styles.choiceWrap}>
          {[
            ['seat_numbers_enabled', 'Seat numbers'],
            ['seat_number_required', 'Seats required'],
            ['course_required', 'Course required'],
            ['allow_hold_and_fire', 'Hold/fire'],
            ['allow_manual_hold', 'Manual hold'],
            ['allow_item_seat_move', 'Move item seat'],
            ['allow_multi_item_seat_move', 'Multi-move items'],
            ['require_manager_for_item_move_after_send', 'Manager after send'],
            ['split_by_seat_enabled', 'Split by seat'],
            ['split_by_item_enabled', 'Split by item'],
          ].map(([field, label]) => {
            const active = Boolean(checkWorkflowEdits[field as keyof CheckWorkflowSettings]);
            return (
              <Pressable
                key={field}
                onPress={() => updateCheckWorkflow({ [field]: !active } as Partial<CheckWorkflowSettings>)}
                style={[styles.choicePill, active && styles.choicePillActive]}
              >
                <UiText variant="caption" style={active ? styles.choiceTextActive : styles.choiceText}>{label}</UiText>
              </Pressable>
            );
          })}
        </View>
        <UiText variant="caption" tone="muted">Tabs & preauth</UiText>
        <View style={styles.choiceWrap}>
          {[
            ['allow_bar_tabs', 'Bar tabs'],
            ['tab_name_required', 'Tab name'],
            ['card_preauth_required', 'Card preauth'],
            ['require_manager_for_reopen', 'Reopen approval'],
          ].map(([field, label]) => {
            const active = Boolean(checkWorkflowEdits[field as keyof CheckWorkflowSettings]);
            return (
              <Pressable
                key={field}
                onPress={() => updateCheckWorkflow({ [field]: !active } as Partial<CheckWorkflowSettings>)}
                style={[styles.choicePill, active && styles.choicePillActive]}
              >
                <UiText variant="caption" style={active ? styles.choiceTextActive : styles.choiceText}>{label}</UiText>
              </Pressable>
            );
          })}
        </View>
        <PublishControls label="Save check workflow" busy={isSavingCheckWorkflow} disabled={!restaurantId} onPublishNow={() => saveCheckWorkflow()} onSchedule={(scheduledFor, timezone) => saveCheckWorkflow({ scheduledFor, timezone })} />
        {checkWorkflowMessage ? (
          <View style={styles.messageCard}>
            <UiText variant="bodySmall" tone="muted">{checkWorkflowMessage}</UiText>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <UiText variant="title">Tips & payroll</UiText>
            <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>
              Tip pooling, cash declarations, role eligibility, and payroll export settings.
            </UiText>
          </View>
        </View>
        <ChoiceGroup
          label="Distribution"
          value={tipPayrollEdits.tip_distribution_mode}
          options={TIP_DISTRIBUTION_OPTIONS}
          onChange={(value) => updateTipPayroll({ tip_distribution_mode: value as TipPayrollSettings['tip_distribution_mode'] })}
        />
        <ChoiceGroup
          label="Cash tips"
          value={tipPayrollEdits.cash_tip_declaration_mode}
          options={CASH_TIP_OPTIONS}
          onChange={(value) => updateTipPayroll({ cash_tip_declaration_mode: value as TipPayrollSettings['cash_tip_declaration_mode'] })}
        />
        <ChoiceGroup
          label="Credit tips"
          value={tipPayrollEdits.credit_tip_payout_timing}
          options={[['payroll', 'Payroll'], ['nightly', 'Nightly']]}
          onChange={(value) => updateTipPayroll({ credit_tip_payout_timing: value as TipPayrollSettings['credit_tip_payout_timing'] })}
        />
        <View style={styles.twoColumnFields}>
          <TextInput
            value={tipPayrollEdits.payroll_provider || ''}
            onChangeText={(value) => updateTipPayroll({ payroll_provider: value })}
            placeholder="Payroll provider"
            placeholderTextColor={palette.ink[400]}
            style={[styles.setupInput, styles.twoColumnInput]}
          />
          <TextInput
            value={String(tipPayrollEdits.credit_card_fee_percent ?? '')}
            onChangeText={(value) => updateTipPayroll({ credit_card_fee_percent: sanitizePercentInput(value) })}
            placeholder="Card fee %"
            keyboardType="decimal-pad"
            placeholderTextColor={palette.ink[400]}
            style={[styles.setupInput, styles.twoColumnInput]}
          />
        </View>
        <ChoiceGroup
          label="Payroll export"
          value={tipPayrollEdits.payroll_export_frequency}
          options={PAYROLL_EXPORT_OPTIONS}
          onChange={(value) => updateTipPayroll({ payroll_export_frequency: value as TipPayrollSettings['payroll_export_frequency'] })}
        />
        <ChoiceGroup
          label="Pool reset"
          value={tipPayrollEdits.tip_pool_reset}
          options={TIP_POOL_RESET_OPTIONS}
          onChange={(value) => updateTipPayroll({ tip_pool_reset: value as TipPayrollSettings['tip_pool_reset'] })}
        />
        <ChoiceGroup
          label="Tipout basis"
          value={tipPayrollEdits.tipout_basis}
          options={TIPOUT_BASIS_OPTIONS}
          onChange={(value) => updateTipPayroll({ tipout_basis: value as TipPayrollSettings['tipout_basis'] })}
        />
        <View style={styles.choiceWrap}>
          {[
            ['tip_pooling_enabled', 'Tip pool'],
            ['tipout_sales_includes_tax', 'Sales include tax'],
            ['tipout_include_managers', 'Managers included'],
            ['require_tipout_at_checkout', 'Checkout tipout'],
            ['allow_manager_tip_adjustments', 'Manager edits'],
            ['auto_withhold_credit_card_fees', 'Withhold card fees'],
          ].map(([field, label]) => {
            const active = Boolean(tipPayrollEdits[field as keyof TipPayrollSettings]);
            return (
              <Pressable
                key={field}
                onPress={() => updateTipPayroll({ [field]: !active } as Partial<TipPayrollSettings>)}
                style={[styles.choicePill, active && styles.choicePillActive]}
              >
                <UiText variant="caption" style={active ? styles.choiceTextActive : styles.choiceText}>{label}</UiText>
              </Pressable>
            );
          })}
        </View>
        <UiText variant="caption" tone="muted">Role tip rules</UiText>
        {tipPayrollEdits.role_tip_rules.map((rule, index) => (
          <View key={rule.role_key || `tip-rule:${index}`} style={styles.taxChargeRow}>
            <UiText variant="body" style={styles.settingTitle}>{rule.role_key.replace(/_/g, ' ')}</UiText>
            <View style={styles.choiceWrap}>
              {[
                ['tip_eligible', 'Tip eligible'],
                ['contributes_to_pool', 'Contributes'],
                ['receives_from_pool', 'Receives'],
              ].map(([field, label]) => {
                const active = Boolean(rule[field as keyof TipRoleRule]);
                return (
                  <Pressable
                    key={`${rule.role_key}:${field}`}
                    onPress={() => updateTipRule(index, { [field]: !active } as Partial<TipRoleRule>)}
                    style={[styles.choicePill, active && styles.choicePillActive]}
                  >
                    <UiText variant="caption" style={active ? styles.choiceTextActive : styles.choiceText}>{label}</UiText>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.twoColumnFields}>
              <TextInput
                value={String(rule.pool_points ?? '')}
                onChangeText={(value) => updateTipRule(index, { pool_points: sanitizeDecimalInput(value, { decimalPlaces: 2, wholeDigits: 4 }) })}
                placeholder="Pool points"
                keyboardType="decimal-pad"
                placeholderTextColor={palette.ink[400]}
                style={[styles.setupInput, styles.twoColumnInput]}
              />
              <TextInput
                value={String(rule.tipout_percent ?? '')}
                onChangeText={(value) => updateTipRule(index, { tipout_percent: sanitizePercentInput(value) })}
                placeholder="Tipout %"
                keyboardType="decimal-pad"
                placeholderTextColor={palette.ink[400]}
                style={[styles.setupInput, styles.twoColumnInput]}
              />
            </View>
            <TextInput
              value={rule.tipout_target_role || ''}
              onChangeText={(value) => updateTipRule(index, { tipout_target_role: roleCode(value) || null })}
              placeholder="Tipout target role, e.g. bartender"
              autoCapitalize="none"
              placeholderTextColor={palette.ink[400]}
              style={styles.setupInput}
            />
          </View>
        ))}
        <TextInput
          value={tipPayrollEdits.notes || ''}
          onChangeText={(value) => updateTipPayroll({ notes: value })}
          placeholder="Payroll notes"
          placeholderTextColor={palette.ink[400]}
          multiline
          style={[styles.setupInput, styles.notesInput]}
        />
        <PublishControls label="Save tips & payroll" busy={isSavingTipPayroll} disabled={!restaurantId} onPublishNow={() => saveTipPayroll()} onSchedule={(scheduledFor, timezone) => saveTipPayroll({ scheduledFor, timezone })} />
        {tipPayrollMessage ? (
          <View style={styles.messageCard}>
            <UiText variant="bodySmall" tone="muted">{tipPayrollMessage}</UiText>
          </View>
        ) : null}
      </View>

      {message ? (
        <View style={styles.messageCard}>
          <UiText variant="bodySmall" tone="muted">{message}</UiText>
        </View>
      ) : null}

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
            onChangeText={(value) => setLegalEdits((current) => ({ ...current, ein: formatEinInput(value) }))}
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
            onBlur={() => setLegalEdits((current) => ({ ...current, legal_contact_email: normalizeEmailInput(current.legal_contact_email) }))}
            placeholder="Legal email"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={palette.ink[400]}
            style={[styles.setupInput, styles.twoColumnInput]}
          />
          <TextInput
            value={legalEdits.legal_contact_phone}
            onChangeText={(value) => setLegalEdits((current) => ({ ...current, legal_contact_phone: formatUsPhoneInput(value) }))}
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
          <PublishControls label="Save legal" busy={isSavingLegal} disabled={!restaurantId} onPublishNow={() => saveLegal()} onSchedule={(scheduledFor, timezone) => saveLegal({ scheduledFor, timezone })} />
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
            onChangeText={(value) => setPaymentEdits((current) => ({ ...current, bank_routing_number: digitsOnly(value, 9) }))}
            placeholder="Routing number"
            keyboardType="number-pad"
            placeholderTextColor={palette.ink[400]}
            style={[styles.setupInput, styles.twoColumnInput]}
          />
          <TextInput
            value={paymentEdits.bank_account_number}
            onChangeText={(value) => setPaymentEdits((current) => ({ ...current, bank_account_number: digitsOnly(value, 17) }))}
            placeholder="Account number"
            keyboardType="number-pad"
            secureTextEntry
            placeholderTextColor={palette.ink[400]}
            style={[styles.setupInput, styles.twoColumnInput]}
          />
        </View>
        <TextInput
          value={paymentAccountConfirmation}
          onChangeText={(value) => setPaymentAccountConfirmation(digitsOnly(value, 17))}
          placeholder="Confirm account number"
          keyboardType="number-pad"
          secureTextEntry
          placeholderTextColor={palette.ink[400]}
          style={styles.setupInput}
        />
        {paymentEdits.bank_account_number ? (
          <UiText variant="caption" tone="muted">Account ending in {paymentEdits.bank_account_number.slice(-4)}</UiText>
        ) : null}
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
          <SmartTimeField
            value={paymentEdits.batch_close_time}
            onChange={(value) => setPaymentEdits((current) => ({ ...current, batch_close_time: value }))}
            minuteStep={5}
            placeholder="Batch close time"
            style={styles.twoColumnInput}
          />
          <TextInput
            value={paymentEdits.refund_approval_threshold}
            onChangeText={(value) => setPaymentEdits((current) => ({ ...current, refund_approval_threshold: sanitizeMoneyInput(value) }))}
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
        <PublishControls label="Save payments" busy={isSavingPayments} disabled={!restaurantId} onPublishNow={() => savePayments()} onSchedule={(scheduledFor, timezone) => savePayments({ scheduledFor, timezone })} />
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
        <PublishControls label="Save service model" busy={isSavingServiceModel} disabled={!restaurantId} onPublishNow={() => saveServiceModel()} onSchedule={(scheduledFor, timezone) => saveServiceModel({ scheduledFor, timezone })} />
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
                options={taxAppliesToChoices(tax.applies_to)}
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
          label="Use Myrtle Beach city-limits rates"
          variant="secondary"
          disabled={isSavingTaxes}
          onPress={applyMyrtleBeachTaxes}
        />
        <UiButton
          label="Add tax rate"
          variant="secondary"
          disabled={isSavingTaxes}
          onPress={() => setTaxRateEdits((current) => [...normalizeTaxRates(current), { ...defaultTaxRate(), name: 'Additional Tax', is_default: false }])}
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
                onChangeText={(value) => updateServiceCharge(index, { amount: charge.charge_type === 'percentage' ? sanitizePercentInput(value) : sanitizeMoneyInput(value) })}
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
          <PublishControls label="Save taxes" busy={isSavingTaxes} disabled={!restaurantId} onPublishNow={() => saveTaxesCharges()} onSchedule={(scheduledFor, timezone) => saveTaxesCharges({ scheduledFor, timezone })} />
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
            <UiText variant="title">Menu categories</UiText>
            <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>
              Category names, optional tax overrides, and logical prep station defaults.
            </UiText>
          </View>
        </View>
        {normalizeMenuCategories(menuCategoryEdits).map((category, index) => (
          <View key={category.id || `${category.name}:${index}`} style={styles.taxChargeRow}>
            <TextInput
              value={category.name}
              onChangeText={(value) => updateMenuCategory(index, { name: value })}
              placeholder="Appetizers"
              placeholderTextColor={palette.ink[400]}
              style={styles.setupInput}
            />
            <ChoiceGroup
              label="Tax"
              value={category.tax_rate_id || ''}
              options={[['', 'Default'], ...normalizeTaxRates(taxRateEdits).map((rate) => [String(rate.id || ''), `${rate.name}${rate.rate ? ` ${rate.rate}%` : ''}`] as const)]}
              onChange={(value) => updateMenuCategory(index, { tax_rate_id: value || null })}
            />
            <TextInput
              value={category.routing_station_name || ''}
              onChangeText={(value) => updateMenuCategory(index, { routing_station_name: value, routing_station_id: null })}
              placeholder="Kitchen, Bar, Expo"
              placeholderTextColor={palette.ink[400]}
              style={styles.setupInput}
            />
            <ChoiceGroup
              label="Default course"
              value={category.default_course_type || ''}
              options={[
                ['', 'Default'],
                ['appetizer', 'App'],
                ['entree', 'Entree'],
                ['dessert', 'Dessert'],
                ['drink', 'Drink'],
                ['side', 'Side'],
                ['other', 'Other'],
                ['none', 'None'],
              ]}
              onChange={(value) => updateMenuCategory(index, { default_course_type: (value || null) as MenuCategory['default_course_type'] })}
            />
            <ChoiceGroup
              label="Fire"
              value={category.default_fire_mode || ''}
              options={[
                ['', 'Default'],
                ['inherit', 'Inherit'],
                ['immediate', 'Immediate'],
                ['hold', 'Hold'],
                ['manual', 'Manual'],
                ['by_course', 'By course'],
              ]}
              onChange={(value) => updateMenuCategory(index, { default_fire_mode: (value || null) as MenuCategory['default_fire_mode'] })}
            />
            <View style={styles.twoColumnFields}>
              <TextInput
                value={category.prep_time_minutes == null ? '' : String(category.prep_time_minutes)}
                onChangeText={(value) => updateMenuCategory(index, { prep_time_minutes: value.replace(/[^\d]/g, '').slice(0, 3) })}
                placeholder="Prep min"
                keyboardType="number-pad"
                placeholderTextColor={palette.ink[400]}
                style={[styles.setupInput, styles.twoColumnInput]}
              />
              <TextInput
                value={category.kds_display_group || ''}
                onChangeText={(value) => updateMenuCategory(index, { kds_display_group: value })}
                placeholder="KDS group"
                placeholderTextColor={palette.ink[400]}
                style={[styles.setupInput, styles.twoColumnInput]}
              />
            </View>
            <Pressable
              onPress={() => setMenuCategoryEdits((current) => normalizeMenuCategories(current).filter((_, currentIndex) => currentIndex !== index))}
              style={styles.removePill}
            >
              <UiText variant="caption" tone="danger">Remove</UiText>
            </Pressable>
          </View>
        ))}
        <View style={styles.sectionActions}>
          <UiButton
            label="Add category"
            variant="secondary"
            disabled={isSavingMenuCategories}
            onPress={() => setMenuCategoryEdits((current) => [...normalizeMenuCategories(current), { name: `Custom Category ${current.length + 1}`, tax_rate_id: null, routing_station_id: null, routing_station_name: 'Kitchen', default_course_type: null, default_fire_mode: 'inherit', prep_time_minutes: null, kds_display_group: '', is_active: true }])}
            style={styles.sectionActionButton}
          />
          <PublishControls label="Save categories" busy={isSavingMenuCategories} disabled={!restaurantId} onPublishNow={() => saveMenuCategories()} onSchedule={(scheduledFor, timezone) => saveMenuCategories({ scheduledFor, timezone })} />
        </View>
        {menuCategoriesMessage ? (
          <View style={styles.messageCard}>
            <UiText variant="bodySmall" tone="muted">{menuCategoriesMessage}</UiText>
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
          <PublishControls label="Save sections" busy={isSavingSections} disabled={!restaurantId} onPublishNow={() => saveSections()} onSchedule={(scheduledFor, timezone) => saveSections({ scheduledFor, timezone })} />
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
            <UiText variant="title">Role editor</UiText>
            <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>
              Define job codes, default wages, tipped status, and permission tier.
            </UiText>
          </View>
        </View>
        {jobCodes.length === 0 ? (
          <View style={styles.messageCard}>
            <UiText variant="bodySmall" tone="muted">No roles are available yet.</UiText>
          </View>
        ) : (
          jobCodes
            .filter((code) => code.is_active !== false)
            .map((code) => (
              <View key={code.id} style={styles.taxChargeRow}>
                <View style={styles.twoColumnFields}>
                  <TextInput
                    value={code.label || ''}
                    onChangeText={(value) => setJobCodes((current) => current.map((row) => (row.id === code.id ? { ...row, label: value } : row)))}
                    placeholder="Role label"
                    editable={!savingRateId}
                    placeholderTextColor={palette.ink[400]}
                    style={[styles.setupInput, styles.twoColumnInput]}
                  />
                  <TextInput
                    value={code.code || ''}
                    onChangeText={(value) => setJobCodes((current) => current.map((row) => (row.id === code.id ? { ...row, code: roleCode(value) } : row)))}
                    placeholder="role_code"
                    autoCapitalize="none"
                    editable={!savingRateId}
                    placeholderTextColor={palette.ink[400]}
                    style={[styles.setupInput, styles.twoColumnInput]}
                  />
                </View>
                <ChoiceGroup
                  label="Permission tier"
                  value={code.permission_tier || 'normal'}
                  options={PERMISSION_TIER_OPTIONS}
                  onChange={(value) => setJobCodes((current) => current.map((row) => (row.id === code.id ? { ...row, permission_tier: value } : row)))}
                />
                <View style={styles.choiceWrap}>
                  {[
                    ['is_tipped', 'Tipped role'],
                    ['is_active', 'Active'],
                  ].map(([field, label]) => {
                    const active = field === 'is_active' ? code.is_active !== false : Boolean(code.is_tipped);
                    return (
                      <Pressable
                        key={`${code.id}:${field}`}
                        onPress={() => setJobCodes((current) => current.map((row) => (row.id === code.id ? { ...row, [field]: !active } : row)))}
                        style={[styles.choicePill, active && styles.choicePillActive]}
                      >
                        <UiText variant="caption" style={active ? styles.choiceTextActive : styles.choiceText}>{label}</UiText>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  value={String(code.default_hourly_rate ?? rateEdits[code.id ?? ''] ?? '')}
                  onChangeText={(value) => {
                    const clean = sanitizeMoneyInput(value);
                    setRateEdits((current) => ({ ...current, [code.id ?? '']: clean }));
                    setJobCodes((current) => current.map((row) => (row.id === code.id ? { ...row, default_hourly_rate: clean } : row)));
                  }}
                  keyboardType="decimal-pad"
                  editable={!savingRateId}
                  placeholder="Default hourly rate"
                  placeholderTextColor={palette.ink[400]}
                  style={styles.setupInput}
                />
                <PublishControls label="Save role" busy={savingRateId === code.id} disabled={Boolean(savingRateId)} onPublishNow={() => saveRoleRate(code)} onSchedule={(scheduledFor, timezone) => saveRoleRate(code, { scheduledFor, timezone })} />
                <Pressable disabled={Boolean(savingRateId)} onPress={() => removeRoleRate(code)} style={[styles.removePill, Boolean(savingRateId) && styles.disabled]}>
                  <UiText variant="caption" tone="danger">Remove role</UiText>
                </Pressable>
              </View>
            ))
        )}
        <View style={styles.taxChargeRow}>
          <UiText variant="body" style={styles.settingTitle}>Add role</UiText>
          <View style={styles.twoColumnFields}>
            <TextInput
              value={jobCodeDraft.label}
              onChangeText={(value) => setJobCodeDraft((current) => ({ ...current, label: value, code: current.code || roleCode(value) }))}
              placeholder="Role label"
              editable={!savingRateId}
              placeholderTextColor={palette.ink[400]}
              style={[styles.setupInput, styles.twoColumnInput]}
            />
            <TextInput
              value={jobCodeDraft.code}
              onChangeText={(value) => setJobCodeDraft((current) => ({ ...current, code: roleCode(value) }))}
              placeholder="role_code"
              autoCapitalize="none"
              editable={!savingRateId}
              placeholderTextColor={palette.ink[400]}
              style={[styles.setupInput, styles.twoColumnInput]}
            />
          </View>
          <ChoiceGroup
            label="Permission tier"
            value={jobCodeDraft.permission_tier || 'normal'}
            options={PERMISSION_TIER_OPTIONS}
            onChange={(value) => setJobCodeDraft((current) => ({ ...current, permission_tier: value }))}
          />
          <Pressable
            onPress={() => setJobCodeDraft((current) => ({ ...current, is_tipped: !current.is_tipped }))}
            style={[styles.choicePill, jobCodeDraft.is_tipped && styles.choicePillActive]}
          >
            <UiText variant="caption" style={jobCodeDraft.is_tipped ? styles.choiceTextActive : styles.choiceText}>Tipped role</UiText>
          </Pressable>
          <TextInput
            value={String(jobCodeDraft.default_hourly_rate ?? '')}
            onChangeText={(value) => setJobCodeDraft((current) => ({ ...current, default_hourly_rate: sanitizeMoneyInput(value) }))}
            keyboardType="decimal-pad"
            editable={!savingRateId}
            placeholder="Default hourly rate"
            placeholderTextColor={palette.ink[400]}
            style={styles.setupInput}
          />
          <UiButton
            label={savingRateId === 'new' ? 'Adding...' : 'Add role'}
            disabled={Boolean(savingRateId) || !jobCodeDraft.label.trim()}
            onPress={() => saveRoleRate(jobCodeDraft)}
          />
        </View>
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
                    onChangeText={(value) => setStaffPayEdits((current) => ({ ...current, [person.id]: sanitizeMoneyInput(value) }))}
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
                    onChangeText={(value) => setStaffHoursEdits((current) => ({ ...current, [person.id]: sanitizeDecimalInput(value, { decimalPlaces: 2, wholeDigits: 3 }) }))}
                    keyboardType="decimal-pad"
                    editable={savingStaffId !== person.id}
                    placeholder="Unset"
                    placeholderTextColor={palette.ink[400]}
                    style={styles.payInput}
                  />
                </View>
                <PublishControls label="Save employee" busy={savingStaffId === person.id} disabled={Boolean(savingStaffId)} onPublishNow={() => saveStaffPay(person)} onSchedule={(scheduledFor, timezone) => saveStaffPay(person, { scheduledFor, timezone })} />
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

function ChoiceGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
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
  notesInput: {
    minHeight: 92,
    textAlignVertical: 'top',
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
  floorTableRow: {
    backgroundColor: semanticColors.surface,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing[3],
    padding: spacing[3],
  },
  floorTableRowIncomplete: {
    backgroundColor: statusColors.danger.bg,
    borderColor: statusColors.danger.border,
  },
  disabled: {
    opacity: 0.5,
  },
  floorTableHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[2],
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
