export interface AuthHydrationLease {
  signal: AbortSignal
  isCurrent: () => boolean
  cancel: () => void
}

export interface AuthHydrationCoordinator {
  begin: () => AuthHydrationLease
  invalidate: () => void
}

/**
 * Owns the lifetime of account-scoped hydration work. Starting a request
 * aborts its predecessor, and a lease can commit only while it is still the
 * active generation.
 */
export function createAuthHydrationCoordinator(): AuthHydrationCoordinator {
  let generation = 0
  let activeController: AbortController | null = null

  const invalidate = () => {
    generation += 1
    activeController?.abort()
    activeController = null
  }

  return {
    begin() {
      invalidate()
      const requestGeneration = generation
      const controller = new AbortController()
      activeController = controller

      return {
        signal: controller.signal,
        isCurrent: () => (
          generation === requestGeneration
          && activeController === controller
          && !controller.signal.aborted
        ),
        cancel: () => {
          if (activeController !== controller) return
          invalidate()
        },
      }
    },
    invalidate,
  }
}
