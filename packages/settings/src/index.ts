// @shire/settings — the single source of truth for restaurant settings
// normalizers, defaults, payload builders, and option lists shared by the web
// setup panel, web onboarding, and the mobile admin settings screen.
//
// Convention: normalize*(unknown) → editable state (numbers stay strings);
// *Payload(state) → API PUT body (strings become numbers/nulls). Surfaces
// must not fork these — fix drift here.

export * from './types'
export * from './helpers'
export * from './options'
export * from './sections'
export * from './taxPresets'
export * from './discounts'
export * from './roles'
export * from './closeout'
export * from './checkWorkflow'
export * from './tipsPolicy'
export * from './tipsPayroll'
export * from './menuCategories'
