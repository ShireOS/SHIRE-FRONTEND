const SETUP_DOMAIN_TAB_ALIASES = {
  menu_categories: 'menu',
}

export function setupTabWarnings(fallbackWarnings = {}, setupStatus = null) {
  if (!Array.isArray(setupStatus?.domains)) return fallbackWarnings

  return setupStatus.domains.reduce((warnings, domain) => {
    if (!domain || domain.complete !== false || !domain.id) return warnings

    const tabId = SETUP_DOMAIN_TAB_ALIASES[domain.id] || domain.id
    const messages = Array.isArray(domain.missing)
      ? domain.missing.filter(message => typeof message === 'string' && message.trim())
      : []
    const resolvedMessages = messages.length > 0
      ? messages
      : [`${domain.label || 'This section'} needs attention.`]

    warnings[tabId] = [...new Set([...(warnings[tabId] || []), ...resolvedMessages])]
    return warnings
  }, {})
}
