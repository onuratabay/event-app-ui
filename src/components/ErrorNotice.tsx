import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"

type Notice = {
  title?: string
  message: string
  onDismiss?: () => void
  onRetry?: () => void
}
type ActiveNotice = Notice & { id: symbol }
const NoticeContext = createContext<{
  show: (notice: ActiveNotice) => void
  hide: (id: symbol) => void
} | null>(null)

export function ErrorNoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<ActiveNotice | null>(null)
  const show = useCallback((next: ActiveNotice) => setNotice(next), [])
  const hide = useCallback((id: symbol) => setNotice(current => current?.id === id ? null : current), [])
  useEffect(() => {
    if (!notice) return
    AccessibilityInfo.announceForAccessibility(`${notice.title}. ${notice.message}`)
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const startTimer = (duration: number) => {
      if (!active) return
      timer = setTimeout(() => {
        hide(notice.id)
        notice.onDismiss?.()
      }, duration)
    }
    void AccessibilityInfo.getRecommendedTimeoutMillis(2000).then(startTimer, () => startTimer(2000))
    return () => { active = false; if (timer) clearTimeout(timer) }
  }, [notice, hide])
  return (
    <NoticeContext.Provider value={{ show, hide }}>
      {notice && (
        <View style={styles.card} accessibilityRole="alert">
          <View style={styles.row}>
            <Text style={styles.icon}>!</Text>
            <View style={styles.content}>
              <Text style={styles.title}>{notice.title}</Text>
              <ScrollView style={styles.messageArea} nestedScrollEnabled>
                <Text style={styles.message}>{notice.message}</Text>
              </ScrollView>
              {notice.onRetry && <Pressable accessibilityRole="button" onPress={() => {
                hide(notice.id)
                notice.onRetry?.()
              }} style={styles.retry}><Text style={styles.retryText}>Tekrar dene</Text></Pressable>}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Bildirimi kapat" onPress={() => {
              hide(notice.id)
              notice.onDismiss?.()
            }} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>
          </View>
        </View>
      )}
      {children}
    </NoticeContext.Provider>
  )
}

export function ErrorNotice({ title = "Bir şey ters gitti", message, onDismiss, onRetry }: Notice) {
  const context = useContext(NoticeContext)
  const callbacks = useRef({ onDismiss, onRetry })
  callbacks.current = { onDismiss, onRetry }
  const show = context?.show
  const hide = context?.hide
  const retryEnabled = Boolean(onRetry)
  useEffect(() => {
    if (!show || !hide) return
    const id = Symbol("notice")
    show({ id, title, message, onDismiss: () => callbacks.current.onDismiss?.(),
      onRetry: retryEnabled ? () => callbacks.current.onRetry?.() : undefined })
    return () => hide(id)
  }, [title, message, show, hide, retryEnabled])
  return null
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 8, marginBottom: 8, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: "#6b4038", backgroundColor: "#241b20" },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  icon: { color: "#e8a28e", fontFamily: "Outfit-SemiBold", fontSize: 18, textAlign: "center", width: 28, lineHeight: 28, backgroundColor: "#442c2a", borderRadius: 8 },
  content: { flex: 1, minWidth: 0 },
  title: { color: "#f5edef", fontFamily: "Outfit-SemiBold", fontSize: 14, lineHeight: 20 },
  messageArea: { maxHeight: 110, marginTop: 3 },
  message: { color: "#d2c5c9", fontFamily: "Outfit", fontSize: 13, lineHeight: 19 },
  close: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: -8, marginRight: -8 },
  closeText: { color: "#d2c5c9", fontSize: 26 },
  retry: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  retryText: { color: "#dab96e", fontFamily: "Outfit-Medium", fontSize: 13 },
})
