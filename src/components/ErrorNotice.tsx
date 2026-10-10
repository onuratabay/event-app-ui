import { CloseIcon } from "./Icons"
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

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
  const insets = useSafeAreaInsets()
  const show = useCallback((next: ActiveNotice) => setNotice(next), [])
  const hide = useCallback((id: symbol) => setNotice(current => current?.id === id ? null : current), [])
  useEffect(() => {
    if (!notice) return
    AccessibilityInfo.announceForAccessibility(`${notice.title}. ${notice.message}`)
    const timer = setTimeout(() => {
      hide(notice.id)
      notice.onDismiss?.()
    }, 3000)
    return () => clearTimeout(timer)
  }, [notice, hide])
  return (
    <NoticeContext.Provider value={{ show, hide }}>
      {children}
      {notice && <View pointerEvents="box-none" style={[styles.layer, { top: insets.top + 12 }]}>
        <View style={styles.card} accessibilityRole="alert">
          <Text allowFontScaling={false}style={styles.icon}>!</Text>
          <View style={styles.content}>
            <Text allowFontScaling={false}style={styles.title} numberOfLines={1}>{notice.title}</Text>
            <Text allowFontScaling={false}style={styles.message} numberOfLines={2}>{notice.message}</Text>
            {notice.onRetry && <Pressable accessibilityRole="button" onPress={() => {
              hide(notice.id)
              notice.onRetry?.()
            }} style={styles.retry}><Text allowFontScaling={false}style={styles.retryText}>Tekrar dene</Text></Pressable>}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Bildirimi kapat" onPress={() => {
            hide(notice.id)
            notice.onDismiss?.()
          }} style={styles.close}><CloseIcon size={18} style={{ color: "#f39baf" }} /></Pressable>
        </View>
      </View>}
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
  layer: { position: "absolute", top: 8, left: 0, right: 0, zIndex: 1000, elevation: 1000, paddingHorizontal: 16 },
  card: { width: "100%", maxWidth: 640, alignSelf: "center", flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: "rgba(232,162,142,.42)", backgroundColor: "rgba(36,27,32,.97)", shadowColor: "#000", shadowOpacity: .28, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  icon: { color: "#f0b3a2", includeFontPadding: false, fontFamily: "Outfit-SemiBold", fontSize: 17, textAlign: "center", width: 32, lineHeight: 32, backgroundColor: "rgba(232,162,142,.18)", borderRadius: 10 },
  content: { flex: 1, minWidth: 0 },
  title: { color: "#f5edef", includeFontPadding: false, fontFamily: "Outfit-SemiBold", fontSize: 14, lineHeight: 19 },
  message: { color: "#d2c5c9", includeFontPadding: false, fontFamily: "Outfit", fontSize: 13, lineHeight: 18, marginTop: 2 },
  close: { width: 32, height: 32, alignItems: "center", justifyContent: "center", marginTop: -4, marginRight: -4 },
  closeText: { color: "#d2c5c9", fontSize: 24, lineHeight: 28 },
  retry: { minHeight: 30, justifyContent: "flex-end", alignSelf: "flex-start", marginTop: 2 },
  retryText: { color: "#927dff", fontFamily: "Outfit-Medium", fontSize: 13 },
})
