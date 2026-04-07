import { useEffect, useRef } from 'react'
import { useRestaurantStore } from '../../host/stores/restaurantStore'
import {
  WALKTHROUGH_SCENES,
  START_SCENE_INDEX,
  getWalkthroughSnapshot,
  getWalkthroughCameras,
} from '../data/walkthroughDemo'

export function useSimulation() {
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    let currentIndex = START_SCENE_INDEX
    let timer: number | undefined

    const getWrappedSceneIndex = (nextIndex: number) => {
      const sceneCount = WALKTHROUGH_SCENES.length - START_SCENE_INDEX
      return ((nextIndex - START_SCENE_INDEX + sceneCount) % sceneCount) + START_SCENE_INDEX
    }

    const applyScene = (nextIndex: number) => {
      currentIndex = getWrappedSceneIndex(nextIndex)
      const snapshot = getWalkthroughSnapshot(currentIndex)
      const existingTheme = useRestaurantStore.getState().theme

      useRestaurantStore.setState({
        ...snapshot,
        theme: existingTheme,
        demoActive: true,
        demoStatus: { speed: 1.0, cameras: getWalkthroughCameras() },
        wsConnected: true,
        lastCvUpdate: new Date(),
        selectedTableId: null,
        selectedGuestId: null,
        selectedServerId: null,
        rightPanelCollapsed: false,
        undoHistory: [],
      })
    }

    const queueNextScene = () => {
      if (timer) {
        window.clearTimeout(timer)
      }

      timer = window.setTimeout(() => {
        applyScene(currentIndex + 1)
        queueNextScene()
      }, WALKTHROUGH_SCENES[currentIndex].autoAdvanceMs)
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault()
        applyScene(currentIndex + 1)
        queueNextScene()
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        applyScene(currentIndex - 1)
        queueNextScene()
      }

      if (event.key.toLowerCase() === 'r') {
        event.preventDefault()
        applyScene(START_SCENE_INDEX)
        queueNextScene()
      }
    }

    applyScene(START_SCENE_INDEX)
    queueNextScene()
    window.addEventListener('keydown', handleKeydown)

    return () => {
      if (timer) {
        window.clearTimeout(timer)
      }
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [])
}
