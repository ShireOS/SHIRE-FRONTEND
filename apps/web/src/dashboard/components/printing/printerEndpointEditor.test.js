import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  buildPrinterEndpointUpdate,
  createPrinterEndpointEditDraft,
  validatePrinterEndpointEditDraft,
} from './printerEndpointEditor.js'

const endpoint = {
  id: 'endpoint-1',
  target_id: 'target-1',
  name: 'Kitchen Ethernet',
  connection_type: 'network',
  priority: 1,
  agent_device_id: null,
  config: { host: '192.168.1.50', port: 9100, timeout_seconds: 3 },
  is_active: true,
}

test('printer endpoint edit starts with the current network address', () => {
  assert.deepEqual(createPrinterEndpointEditDraft(endpoint), {
    host: '192.168.1.50',
    port: '9100',
    reason: '',
  })
})

test('printer endpoint edit preserves routing fields and unrelated path config', () => {
  assert.deepEqual(buildPrinterEndpointUpdate(endpoint, {
    host: '192.168.1.77',
    port: '9101',
    reason: 'Printer received a new DHCP reservation',
  }), {
    target_id: 'target-1',
    name: 'Kitchen Ethernet',
    connection_type: 'network',
    priority: 1,
    agent_device_id: null,
    config: { host: '192.168.1.77', port: 9101, timeout_seconds: 3 },
    is_active: true,
    reason: 'Printer received a new DHCP reservation',
  })
})

test('printer endpoint edit requires a valid port and an audit reason', () => {
  assert.equal(validatePrinterEndpointEditDraft({ host: '', port: 9100, reason: 'Changed' }), 'Printer IP is required')
  assert.equal(validatePrinterEndpointEditDraft({ host: '192.168.1.77', port: 70000, reason: 'Changed' }), 'Port must be a whole number between 1 and 65535')
  assert.equal(validatePrinterEndpointEditDraft({ host: '192.168.1.77', port: 9100, reason: '  ' }), 'Reason is required for the audit log')
})

test('printer path UI exposes an audited PUT edit action', async () => {
  const modal = await readFile(new URL('./PrinterEndpointEditModal.jsx', import.meta.url), 'utf8')
  const routingCard = await readFile(new URL('./ResilientPrintingCard.jsx', import.meta.url), 'utf8')
  const devicesPanel = await readFile(new URL('../devices/StoreDevicesPanel.jsx', import.meta.url), 'utf8')
  assert.match(modal, /Edit printer IP/)
  assert.match(modal, /method: 'PUT'/)
  assert.match(modal, /buildPrinterEndpointUpdate/)
  assert.match(routingCard, /title="Edit printer IP"/)
  assert.match(devicesPanel, />\s*Edit IP\s*</)
})
