export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return true
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    const message = (error as { message: string }).message.toLowerCase()
    if (message.includes('signal is aborted')) {
      return true
    }
  }

  return false
}
