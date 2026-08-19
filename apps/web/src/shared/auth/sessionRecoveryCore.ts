interface SessionStorageLike {
  removeItem: (key: string) => void
}

interface SessionRecoveryOptions {
  storage: SessionStorageLike
  storageKey: string
  signOut: (options: { scope: 'local' }) => Promise<unknown>
  redirect: () => void
  onCleanupError?: (error: unknown) => void
}

export async function clearSessionAndRedirect({
  storage,
  storageKey,
  signOut,
  redirect,
  onCleanupError,
}: SessionRecoveryOptions): Promise<void> {
  storage.removeItem(storageKey)
  storage.removeItem(`${storageKey}-code-verifier`)

  try {
    await signOut({ scope: 'local' })
  } catch (error) {
    onCleanupError?.(error)
  } finally {
    redirect()
  }
}
