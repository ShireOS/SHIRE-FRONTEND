// Hook for running the AI scheduling engine

import { useState, useCallback } from 'react'
import { scheduleApi } from '../api/scheduleApi'
import type { ScheduleRun } from '../types/api'

interface UseSchedulingEngineResult {
  runScheduler: (
    restaurantId: string,
    weekStartDate: string
  ) => Promise<ScheduleRun>
  isRunning: boolean
  error: Error | null
  progress: number // 0-100
}

/**
 * Hook for running the AI scheduling engine
 * Handles polling for completion status
 */
export function useSchedulingEngine(): UseSchedulingEngineResult {
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [progress, setProgress] = useState(0)

  const runScheduler = useCallback(
    async (restaurantId: string, weekStartDate: string): Promise<ScheduleRun> => {
      setIsRunning(true)
      setError(null)
      setProgress(0)

      try {
        // Start the scheduling run
        const run = await scheduleApi.runScheduler(restaurantId, weekStartDate)

        if (run.run_status === 'failed') {
          throw new Error(run.error_message || 'Scheduling failed')
        }

        if (run.run_status === 'completed') {
          setProgress(100)
          setIsRunning(false)
          return run
        }

        // Poll for completion
        setProgress(20)
        const result = await pollForCompletion(run.id)
        setProgress(100)
        setIsRunning(false)
        return result
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Failed to run scheduler')
        setError(error)
        setIsRunning(false)
        setProgress(0)
        throw error
      }
    },
    []
  )

  return { runScheduler, isRunning, error, progress }
}

/**
 * Poll for schedule run completion
 * Checks status every 2 seconds, max 30 times (1 minute)
 */
async function pollForCompletion(runId: string): Promise<ScheduleRun> {
  const MAX_POLLS = 30
  const POLL_INTERVAL = 2000 // 2 seconds

  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL)

    const status = await scheduleApi.getSchedulerStatus(runId)

    if (status.run_status === 'completed') {
      return status
    }

    if (status.run_status === 'failed') {
      throw new Error(status.error_message || 'Scheduling run failed')
    }

    // Still running, continue polling
  }

  throw new Error('Scheduling run timed out')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
