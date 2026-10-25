import AsyncStorage from "@react-native-async-storage/async-storage"
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"

/** `backgroundDim`: 0 leaves the backdrop as designed; 1–5 fade its shapes and glow step by step. */
export const DEFAULT_PREFERENCES = { haptics: true, reduceTransparency: false, backgroundDim: 0 }
export type AppPreferences = typeof DEFAULT_PREFERENCES
const KEY = "event-app:device-preferences:v1"
const Preferences = createContext({
  values: DEFAULT_PREFERENCES, ready: false,
  update: async (_patch: Partial<AppPreferences>) => {},
})
/** Device-only presentation preferences; never stores account or event data. */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [values, setValues] = useState(DEFAULT_PREFERENCES)
  const [ready, setReady] = useState(false)
  const current = useRef(DEFAULT_PREFERENCES)
  const queue = useRef(Promise.resolve())
  useEffect(() => {
    let active = true
    AsyncStorage.getItem(KEY).then(raw => {
      if (!active || !raw) return
      const parsed = JSON.parse(raw)
      const next = { haptics: typeof parsed?.haptics === "boolean" ? parsed.haptics : true,
        reduceTransparency: typeof parsed?.reduceTransparency === "boolean" ? parsed.reduceTransparency : false,
        backgroundDim: Number.isInteger(parsed?.backgroundDim) ? Math.min(5, Math.max(0, parsed.backgroundDim)) : parsed?.dimBackground === true ? 3 : 0 }
      current.current = next; setValues(next)
    }).catch(() => {}).finally(() => { if (active) setReady(true) })
    return () => { active = false }
  }, [])
  const update = (patch: Partial<AppPreferences>) => {
    const job = queue.current.catch(() => {}).then(async () => {
      const next = { ...current.current, ...patch }
      await AsyncStorage.setItem(KEY, JSON.stringify(next))
      current.current = next; setValues(next)
    })
    queue.current = job
    return job
  }
  return <Preferences.Provider value={{ values, ready, update }}>{children}</Preferences.Provider>
}
export const usePreferences = () => useContext(Preferences)
