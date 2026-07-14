export type UiService = 'pos' | 'host'
export type UiPreviewMode = 'view' | 'edit'
export type UiComponentColorProperty = 'backgroundColor' | 'color' | 'borderColor'
export type UiComponentOverrides = Record<
  string,
  Partial<Record<UiComponentColorProperty, string>>
>

export type UiPreviewEditableProperty = {
  property: UiComponentColorProperty
  label: string
  value: string
  tokenKey: string | null
}

export type UiPreviewComponentSelection = {
  componentId: string
  label: string
  registered: boolean
  properties: UiPreviewEditableProperty[]
}

export type UiThemeToken = {
  key: string
  label: string
  group: string
  defaultValue: string
}

const token = (group: string, key: string, label: string, defaultValue: string): UiThemeToken => ({
  group,
  key,
  label,
  defaultValue,
})

const statusTokens = (
  prefix: string,
  group: string,
  values: Record<string, { fill?: string; border?: string; text?: string; dot?: string; tint?: string; ink?: string }>,
) => Object.entries(values).flatMap(([state, colors]) =>
  Object.entries(colors).map(([part, value]) =>
    token(group, `${prefix}${state}.${part}`, `${state.replace(/_/g, ' ')} ${part}`, value),
  ),
)

const POS_TOKENS: UiThemeToken[] = [
  token('Surfaces', 'canvas', 'Canvas', '#FAFAFA'),
  token('Surfaces', 'canvasEdge', 'Canvas edge', '#F4F1EE'),
  token('Surfaces', 'surface', 'Surface', '#FFFFFF'),
  token('Surfaces', 'surfaceSoft', 'Soft surface', '#F9F8F8'),
  token('Surfaces', 'surfaceRaised', 'Raised surface', '#FFFFFF'),
  token('Surfaces', 'surfaceGhost', 'Ghost surface', 'rgba(255,255,255,0.72)'),
  token('Surfaces', 'sunken', 'Sunken surface', '#F4F1EE'),
  token('Surfaces', 'floor', 'Floor', '#F2EEE4'),
  token('Surfaces', 'floorEdge', 'Floor edge', 'rgba(255,255,255,0.78)'),
  token('Surfaces', 'glow', 'Ambient glow', 'rgba(150,130,85,0.12)'),
  token('Surfaces', 'glowSoft', 'Soft glow', 'rgba(150,130,85,0.07)'),
  token('Surfaces', 'navActive', 'Active navigation', '#F1EBE5'),
  token('Text', 'ink', 'Primary text', '#1A1615'),
  token('Text', 'ink2', 'Secondary text', '#453F3D'),
  token('Text', 'ink3', 'Muted text', '#757170'),
  token('Text', 'inkOnDark', 'Text on dark', '#FFFFFF'),
  token('Text', 'inkOnTile', 'Text on tiles', '#1A1615'),
  token('Brand and actions', 'dark', 'Primary dark action', '#1A1615'),
  token('Brand and actions', 'accent', 'Accent', '#156CC2'),
  token('Brand and actions', 'accentInk', 'Accent text', '#156CC2'),
  token('Brand and actions', 'accentSoft', 'Soft accent', 'rgba(132,185,239,0.18)'),
  token('Brand and actions', 'accentLine', 'Accent border', 'rgba(21,108,194,0.40)'),
  token('Brand and actions', 'gold', 'Warning', '#CF8D13'),
  token('Brand and actions', 'rust', 'Danger', '#C9502E'),
  token('Brand and actions', 'cartTint', 'Cart tint', 'rgba(132,185,239,0.16)'),
  token('Brand and actions', 'cartLine', 'Cart border', 'rgba(21,108,194,0.36)'),
  token('Borders', 'line', 'Border', '#E4E2E2'),
  token('Borders', 'lineStrong', 'Strong border', 'rgba(26,22,21,0.16)'),
  ...statusTokens('state.', 'Order states', {
    available: { dot: '#4BA05A', tint: 'rgba(75,160,90,0.10)', ink: '#3C8150' },
    open: { dot: '#5087BE', tint: 'rgba(80,135,190,0.12)', ink: '#3D6A99' },
    sent: { dot: '#968255', tint: 'rgba(190,155,40,0.14)', ink: '#8A7019' },
    attention: { dot: '#B5654A', tint: 'rgba(181,101,74,0.14)', ink: '#8A4329' },
    pay: { dot: '#968255', tint: 'rgba(190,155,40,0.16)', ink: '#8A7019' },
    paid: { dot: '#4BA05A', tint: 'rgba(75,160,90,0.12)', ink: '#2C6B41' },
    neutral: { dot: '#AFAAA0', tint: 'rgba(175,170,160,0.16)', ink: '#827D6E' },
  }),
  ...statusTokens('table.', 'Table states', {
    available: { fill: 'rgba(75,160,90,0.15)', border: 'rgba(75,160,90,0.55)', text: '#3C8150' },
    occupied: { fill: 'rgba(80,135,190,0.13)', border: 'rgba(80,135,190,0.45)', text: '#3D6A99' },
    paying: { fill: 'rgba(190,155,40,0.16)', border: 'rgba(190,155,40,0.55)', text: '#8A7019' },
    paid: { fill: 'rgba(75,160,90,0.16)', border: 'rgba(75,160,90,0.60)', text: '#2C6B41' },
    attention: { fill: 'rgba(181,101,74,0.16)', border: 'rgba(181,101,74,0.58)', text: '#8A4329' },
    blocked: { fill: 'rgba(175,170,160,0.18)', border: 'rgba(175,170,160,0.60)', text: '#827D6E' },
  }),
  ...[
    ['#E2ECF5', '#2E567C', 'rgba(46,86,124,0.62)'],
    ['#EDE7F3', '#4B4068', 'rgba(75,64,104,0.58)'],
    ['#E4F0E8', '#2C6B41', 'rgba(44,107,65,0.58)'],
    ['#F7E7DE', '#8A4329', 'rgba(138,67,41,0.58)'],
    ['#E6E7F6', '#3D3E72', 'rgba(61,62,114,0.56)'],
    ['#F4E6DA', '#754D29', 'rgba(117,77,41,0.56)'],
    ['#E5F0F0', '#356060', 'rgba(53,96,96,0.56)'],
  ].flatMap(([tileColor, inkColor, captionColor], index) => [
    token('Menu categories', `category.${index}.tile`, `Category ${index + 1} tile`, tileColor),
    token('Menu categories', `category.${index}.ink`, `Category ${index + 1} text`, inkColor),
    token('Menu categories', `category.${index}.caption`, `Category ${index + 1} caption`, captionColor),
  ]),
]

const HOST_TOKENS: UiThemeToken[] = [
  token('Surfaces', 'background', 'Background', '#F8F5EE'),
  token('Surfaces', 'backgroundDark', 'Dark background', '#181612'),
  token('Surfaces', 'surface.level1', 'Surface level 1', '#FFFEFA'),
  token('Surfaces', 'surface.level2', 'Surface level 2', '#FDFAF4'),
  token('Surfaces', 'surface.level3', 'Surface level 3', '#F8F5EE'),
  token('Surfaces', 'surface.level4', 'Surface level 4', '#F2EEE4'),
  token('Text', 'text.primary', 'Primary text', '#181612'),
  token('Text', 'text.secondary', 'Secondary text', '#4B463C'),
  token('Text', 'text.muted', 'Muted text', '#827D6E'),
  token('Text', 'text.inverse', 'Inverse text', '#FFFFFF'),
  token('Brand and actions', 'accent', 'Accent', '#322D23'),
  token('Brand and actions', 'accentLight', 'Soft accent', 'rgba(50,45,35,0.06)'),
  token('Brand and actions', 'gold', 'Gold', '#968255'),
  token('Brand and actions', 'white', 'White', '#FFFFFF'),
  token('Brand and actions', 'black', 'Black', '#000000'),
  ...statusTokens('status.', 'Table states', {
    available: { fill: 'rgba(75,160,90,0.15)', border: 'rgba(75,160,90,0.55)', text: '#3C8150' },
    occupied: { fill: 'rgba(80,135,190,0.13)', border: 'rgba(80,135,190,0.45)', text: '#3D6A99' },
    dirty: { fill: 'rgba(140,110,75,0.13)', border: 'rgba(140,110,75,0.45)', text: '#7A5F40' },
    reserved: { fill: 'rgba(45,120,210,0.15)', border: 'rgba(45,120,210,0.55)', text: '#2D69B3' },
  }),
  ...statusTokens('', 'Other states', {
    needsServer: { fill: 'rgba(190,155,40,0.16)', border: 'rgba(190,155,40,0.55)', text: '#8A7019' },
    blocked: { fill: 'rgba(175,170,160,0.18)', border: 'rgba(175,170,160,0.60)', text: '#827D6E' },
  }),
  token('Glass', 'glass.tint', 'Glass tint', '#FFFEFA'),
  token('Glass', 'glass.border', 'Glass border', 'rgba(30,28,24,0.06)'),
  token('Glass', 'glass.borderSubtle', 'Subtle glass border', 'rgba(30,28,24,0.04)'),
  token('Glass', 'glass.shadow', 'Glass shadow', 'rgba(30,28,24,0.08)'),
  token('Glass', 'glass.innerHighlight', 'Inner highlight', 'rgba(255,255,255,0.80)'),
  token('Borders', 'border.default', 'Default border', 'rgba(30,28,24,0.08)'),
  token('Borders', 'border.subtle', 'Subtle border', 'rgba(30,28,24,0.05)'),
  token('Borders', 'border.strong', 'Strong border', 'rgba(30,28,24,0.14)'),
  token('Borders', 'border.warm', 'Warm border', 'rgba(30,28,24,0.08)'),
]

export const UI_THEME_TOKENS: Record<UiService, UiThemeToken[]> = {
  pos: POS_TOKENS,
  host: HOST_TOKENS,
}

export function defaultUiTheme(service: UiService): Record<string, string> {
  return Object.fromEntries(UI_THEME_TOKENS[service].map((item) => [item.key, item.defaultValue]))
}

export function effectiveUiTheme(
  service: UiService,
  overrides: Record<string, string> | null | undefined,
): Record<string, string> {
  return { ...defaultUiTheme(service), ...(overrides || {}) }
}

export function groupUiThemeTokens(service: UiService): Array<{ group: string; tokens: UiThemeToken[] }> {
  const groups = new Map<string, UiThemeToken[]>()
  for (const item of UI_THEME_TOKENS[service]) {
    groups.set(item.group, [...(groups.get(item.group) || []), item])
  }
  return [...groups].map(([group, tokens]) => ({ group, tokens }))
}
