import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const menuPanel = await readFile(new URL('../MenuPanel.jsx', import.meta.url), 'utf8')
const workspace = await readFile(new URL('../../shared/components/MenuWorkspaceEditor.jsx', import.meta.url), 'utf8')
const app = await readFile(new URL('../AuthenticatedDashboardApp.jsx', import.meta.url), 'utf8')
const shell = await readFile(new URL('../shell/DashboardShell.jsx', import.meta.url), 'utf8')
const views = await readFile(new URL('../../shared/backOfficeView.ts', import.meta.url), 'utf8')

test('Menu exposes Organization and POS Menus while the sidebar POS Menus route remains', () => {
  assert.match(menuPanel, /\{ id: 'organization', label: 'Organization' \}/)
  assert.match(menuPanel, /\{ id: 'pos-menus', label: 'POS Menus' \}/)
  assert.match(shell, /\{ id: 'menu-workspace', label: 'POS Menus'/)
  assert.match(app, /activeTab === 'menu-workspace'/)
})

test('organization owns overall groups and POS Menus links to it instead of duplicating the editor', () => {
  assert.match(workspace, /function OrganizationEditor/)
  assert.match(workspace, /section = 'pos-menus'/)
  assert.match(workspace, /Group creation and assignment now live under Menu → Organization/)
  assert.match(workspace, /organizationSection \? \(/)
  assert.match(workspace, /<OrganizationEditor/)
})

test('the new surfaces reuse the existing menu permission', () => {
  assert.match(app, /canEditMenuItems=\{backOfficeAccess\.can\('menu\.edit_items'\)\}/)
  assert.match(menuPanel, /organization: 'pos_menu\.navigation', 'pos-menus': 'pos_menu\.navigation'/)
  assert.match(views, /'menu#organization': 'pos_menu\.navigation'/)
  assert.match(views, /'menu#pos-menus': 'pos_menu\.navigation'/)
  assert.match(app, /menuWorkspaceSectionRequested \? 'pos_menu\.navigation' : 'menu\.items'/)
})
