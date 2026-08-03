export const SERVER_RECEIPT_SECTION_IDS = ['tax', 'sales', 'tenders', 'tips', 'checks']

export const SERVER_RECEIPT_PRESETS = {
  minimal: [],
  standard: ['tax', 'sales', 'tenders', 'tips'],
  detailed: ['tax', 'sales', 'tenders', 'tips', 'checks'],
}

export const DEFAULT_SERVER_RECEIPT_TEMPLATE = {
  size: 'medium',
  sections: [...SERVER_RECEIPT_PRESETS.standard],
}

export function normalizeServerReceiptTemplate(value) {
  const source = value && typeof value === 'object' ? value : {}
  const size = source.size === 'compact' || source.size === 'large' ? source.size : 'medium'
  const requested = new Set(
    Array.isArray(source.sections)
      ? source.sections.map(String)
      : DEFAULT_SERVER_RECEIPT_TEMPLATE.sections,
  )
  return {
    size,
    sections: SERVER_RECEIPT_SECTION_IDS.filter((section) => requested.has(section)),
  }
}

export function serverReceiptPresetFor(template) {
  const normalized = normalizeServerReceiptTemplate(template)
  for (const [preset, sections] of Object.entries(SERVER_RECEIPT_PRESETS)) {
    if (normalized.sections.length === sections.length && normalized.sections.every((section, index) => section === sections[index])) {
      return preset
    }
  }
  return 'custom'
}

export function toggleServerReceiptSection(template, section) {
  const normalized = normalizeServerReceiptTemplate(template)
  const selected = new Set(normalized.sections)
  if (selected.has(section)) selected.delete(section)
  else selected.add(section)
  return {
    ...normalized,
    sections: SERVER_RECEIPT_SECTION_IDS.filter((candidate) => selected.has(candidate)),
  }
}
