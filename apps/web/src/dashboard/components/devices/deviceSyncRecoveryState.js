export const ACTIVE_RECOVERY_STATES = new Set(['inspecting', 'preparing', 'applying'])
export const isRecoveryActive = (run) => ACTIVE_RECOVERY_STATES.has(run?.status)

export function referenceDeviceBlocker(device, now = Date.now()) {
  if (device.status !== 'active') return 'Deactivated'
  if (!['android_tablet', 'waiter_handheld', 'fixed_terminal', 'desktop'].includes(device.device_type)) return 'Choose a POS check terminal'
  if (device.protocol_version !== 1) return 'App update required'
  const recent = (value) => Number.isFinite(Date.parse(value)) && now - Date.parse(value) <= 120_000
  if (!recent(device.last_seen_at)) return 'Offline or not recently seen'
  if (!recent(device.capability_reported_at)) return 'Waiting for current app capabilities'
  return null
}

export function recoverySelection(run) {
  const targets = run?.targets || []
  const ready = targets.filter((target) => target.state === 'ready')
  return {
    ready,
    excluded: targets.filter((target) => target.state !== 'ready'),
    canConfirm: run?.status === 'inspecting'
      && Boolean(run.preview_token)
      && ready.some((target) => target.device_id === run.reference_device_id)
      && ready.some((target) => target.device_id !== run.reference_device_id),
  }
}

export function recoveryError(error) {
  if (error?.status === 401) return 'Your sign-in needs to be refreshed before continuing.'
  if (error?.status === 403) return 'You do not have permission to recover device sync for this store.'
  if (error?.detail?.message) return error.detail.message
  if (typeof error?.detail === 'string') return error.detail
  return error?.message || 'The sync recovery service could not be reached. Check again.'
}

export const recoverySessionKey = (userId, restaurantId) =>
  `shire:device-sync:v1:${encodeURIComponent(userId)}:${encodeURIComponent(restaurantId)}`

const ambiguousFailure = (error) => !error?.status || error.status >= 500 || error.status === 408

// Keep orchestration independent of React: responses from a disposed store or
// account can never repopulate the next workspace. Only opaque run/request IDs
// and exact pending commands are persisted; local/financial state is not stored.
export function createRecoveryController({ restaurantId, userId, api, storage, uuid = () => crypto.randomUUID() }) {
  const key = recoverySessionKey(userId, restaurantId)
  const listeners = new Set()
  const requests = new Set()
  let alive = true
  let readGeneration = 0
  let saved = {}
  try { saved = JSON.parse(storage?.getItem(key) || '{}') || {} } catch { /* Empty session. */ }
  let state = {
    overview: null, run: null, loading: true, refreshing: false, busy: null,
    error: null, readError: null, pending: saved.pending || null,
  }
  const publish = (patch) => {
    if (!alive) return
    state = { ...state, ...patch }
    listeners.forEach((listener) => listener())
  }
  const persist = (patch) => {
    saved = { ...saved, ...patch }
    try { storage?.setItem(key, JSON.stringify(saved)) } catch { /* Server active_run also survives reload. */ }
  }
  const request = async (fn) => {
    const controller = new AbortController()
    requests.add(controller)
    try { return await fn(controller.signal) } finally { requests.delete(controller) }
  }
  const acceptRun = (run) => {
    if (!alive) return
    if (run?.restaurant_id !== restaurantId) throw new Error('The recovery response belongs to another store.')
    persist({ runId: run.id })
    publish({ run })
  }
  async function load() {
    if (!alive || state.busy || state.refreshing) return
    const generation = ++readGeneration
    publish({ refreshing: true })
    try {
      const overview = await request((signal) => api.overview(restaurantId, signal))
      if (!alive || generation !== readGeneration) return
      publish({ overview, readError: null })
      const runId = overview.active_run?.id || state.run?.id || saved.runId
      if (runId) {
        let run
        try {
          run = overview.active_run?.id === runId
            ? overview.active_run
            : await request((signal) => api.run(restaurantId, runId, signal))
        } catch (error) {
          if (error?.status !== 404 || overview.active_run) throw error
          // Expired/removed history must not strand a new recovery. Ambiguous
          // commands remain pending and still require their exact replay.
          if (alive && generation === readGeneration) {
            persist({ runId: null })
            publish({ run: null })
          }
          return
        }
        if (!alive || generation !== readGeneration) return
        acceptRun(run)
      }
    } catch (error) {
      if (alive && generation === readGeneration) publish({ readError: recoveryError(error) })
    } finally {
      if (alive && generation === readGeneration) publish({ loading: false, refreshing: false })
    }
  }
  async function refreshRun(runId = state.run?.id) {
    if (!alive || !runId || state.busy || state.refreshing) return
    const generation = ++readGeneration
    publish({ refreshing: true })
    try {
      const run = await request((signal) => api.run(restaurantId, runId, signal))
      if (!alive || generation !== readGeneration) return
      acceptRun(run)
      publish({ readError: null })
    } catch (error) {
      if (alive && generation === readGeneration) publish({ readError: recoveryError(error) })
    } finally {
      if (alive && generation === readGeneration) publish({ refreshing: false })
    }
  }
  async function execute(command) {
    if (!alive || state.busy) return
    ++readGeneration
    persist({ pending: command })
    publish({ busy: command.kind, pending: command, error: null, refreshing: false })
    try {
      const run = await request((signal) => command.kind === 'inspect'
        ? api.inspect(restaurantId, command.body, signal)
        : api[command.kind](restaurantId, command.runId, command.body, signal))
      if (!alive) return
      acceptRun(run)
      persist({ pending: null })
      publish({ pending: null, error: null, readError: null })
    } catch (error) {
      if (!alive) return
      const ambiguous = ambiguousFailure(error)
      if (!ambiguous) persist({ pending: null })
      publish({
        pending: ambiguous ? command : null,
        error: ambiguous
          ? `${recoveryError(error)} The request may have been accepted. Check the result using the same request.`
          : recoveryError(error),
        // A rejected preview is never retained as a confirmable selection.
        ...(command.kind === 'confirm' && !ambiguous && state.run
          ? { run: { ...state.run, preview_token: null } } : {}),
      })
    } finally {
      publish({ busy: null })
    }
  }
  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    getSnapshot: () => state,
    load,
    refreshRun,
    async inspect(referenceDeviceId) {
      if (!referenceDeviceId || isRecoveryActive(state.run) || state.pending || state.readError || state.overview?.enabled !== true) return
      return execute({ kind: 'inspect', body: { request_id: uuid(), reference_device_id: referenceDeviceId } })
    },
    async confirm(previewToken, reason) {
      if (state.pending || state.readError || !recoverySelection(state.run).canConfirm || !reason?.trim()
        || previewToken !== state.run.preview_token) return
      return execute({ kind: 'confirm', runId: state.run.id, body: { preview_token: previewToken, reason: reason.trim() } })
    },
    async cancel(reason) {
      if (state.pending || !isRecoveryActive(state.run) || !reason?.trim()) return
      return execute({ kind: 'cancel', runId: state.run.id, body: { reason: reason.trim() } })
    },
    retryPending() { return state.pending ? execute(state.pending) : load() },
    dispose() {
      alive = false
      ++readGeneration
      requests.forEach((controller) => controller.abort())
      requests.clear()
      listeners.clear()
    },
  }
}
