import AsyncStorage from "@react-native-async-storage/async-storage"
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { Alert } from "react-native"
import { EVENTS, ME } from "../data"
import type { AppEvent, AppUser, ChatMessage } from "../types"
interface Data {
  user: AppUser
  events: AppEvent[]
  messages: Record<string, ChatMessage[]>
  onboarding: Record<string, string>
}
const initial: Data = { user: ME, events: EVENTS, messages: {}, onboarding: {} }
const Context = createContext<{
  data: Data
  setData: React.Dispatch<React.SetStateAction<Data>>
} | null>(null)
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState(initial),
    [ready, setReady] = useState(false)
  const queue = useRef(Promise.resolve())
  useEffect(() => {
    AsyncStorage.getItem("event-app:v1")
      .then((value) => {
        if (value) {
          const saved = JSON.parse(value)
          if (saved.user?.id === "me" && Array.isArray(saved.events))
            setData({ ...initial, ...saved })
        }
      })
      .catch(() =>
        Alert.alert("Kayıt açılamadı", "Uygulama örnek verilerle açılacak."),
      )
      .finally(() => setReady(true))
  }, [])
  useEffect(() => {
    if (ready)
      queue.current = queue.current
        .then(() => AsyncStorage.setItem("event-app:v1", JSON.stringify(data)))
        .catch(() => {
          Alert.alert(
            "Kaydedilemedi",
            "Değişiklikler bu oturumda kullanılabilir.",
          )
        })
  }, [data, ready])
  if (!ready) return null
  return (
    <Context.Provider value={{ data, setData }}>{children}</Context.Provider>
  )
}
export function useStore() {
  const store = useContext(Context)
  if (!store) throw new Error("StoreProvider missing")
  return store
}
