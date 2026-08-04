export function createPrinterEndpointEditDraft(endpoint) {
  return {
    host: String(endpoint?.config?.host || ''),
    port: String(endpoint?.config?.port || 9100),
    reason: '',
  }
}

export function validatePrinterEndpointEditDraft(draft) {
  if (!String(draft?.host || '').trim()) return 'Printer IP is required'

  const port = Number(draft?.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return 'Port must be a whole number between 1 and 65535'
  }

  if (!String(draft?.reason || '').trim()) return 'Reason is required for the audit log'
  return ''
}

export function buildPrinterEndpointUpdate(endpoint, draft) {
  const validationError = validatePrinterEndpointEditDraft(draft)
  if (validationError) throw new Error(validationError)

  return {
    target_id: endpoint.target_id,
    name: endpoint.name,
    connection_type: endpoint.connection_type,
    priority: Number(endpoint.priority),
    agent_device_id: endpoint.agent_device_id || null,
    config: {
      ...(endpoint.config || {}),
      host: draft.host.trim(),
      port: Number(draft.port),
    },
    is_active: endpoint.is_active !== false,
    reason: draft.reason.trim(),
  }
}
