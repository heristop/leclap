import { WebHaptics, type HapticInput } from 'web-haptics'

/**
 * App-wide haptic feedback (web-haptics). Vibrates on supported devices and
 * falls back to a subtle audio click elsewhere, giving the UI a native, tactile
 * feel. Single shared instance; all calls are best-effort and never throw.
 */
let instance: WebHaptics | null = null

const get = (): WebHaptics | null => {
  if (typeof window === 'undefined') {
    return null
  }

  if (!instance) {
    instance = new WebHaptics()
    instance.setShowSwitch(false)
    instance.setDebug(false)
  }

  return instance
}

export const haptic = (input: HapticInput = 'selection'): void => {
  try {
    get()?.trigger(input).catch(() => {})
  } catch {
    /* haptics are a progressive enhancement — ignore failures */
  }
}

export const hapticsSupported = WebHaptics.isSupported
