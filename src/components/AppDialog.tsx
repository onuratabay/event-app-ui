import { useEffect, useState } from "react"
import { Alert, Modal, Pressable, StyleSheet, View, type AlertButton, type AlertOptions } from "react-native"
import { GlassFill } from "./GlassFill"
import { Label, Touch } from "../native/UI"
import { palette } from "../theme/palette"

/**
 * The app's own alert, called exactly like `Alert.alert(title, message, buttons)`: a frosted glass card on the
 * midnight backdrop instead of the system dialog. Several alerts queue up. It opens in its own window, so it
 * also shows above open sheets. Without a mounted host (screens rendered alone, e.g. in tests) the system
 * alert is used.
 */
type Dialog = { id: number; title: string; message?: string; buttons: AlertButton[]; onDismiss?: () => void }
let push: ((dialog: Dialog) => void) | null = null
let nextId = 1
export function showAlert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
  if (!push) { Alert.alert(title, message, buttons, options); return }
  push({ id: nextId++, title, message, buttons: buttons?.length ? buttons : [{ text: "Tamam" }], onDismiss: options?.onDismiss })
}

export default function AppDialogHost() {
  const [queue, setQueue] = useState<Dialog[]>([])
  useEffect(() => {
    const add = (dialog: Dialog) => setQueue(current => [...current, dialog])
    push = add
    return () => { if (push === add) push = null }
  }, [])
  const dialog = queue[0]
  if (!dialog) return null
  const close = (button?: AlertButton) => {
    setQueue(current => current.filter(item => item.id !== dialog.id))
    button?.onPress?.()
  }
  // Outside tap / Android back count as the cancel button; a single-button notice just closes.
  const cancel = dialog.buttons.find(button => button.style === "cancel") ?? (dialog.buttons.length === 1 ? dialog.buttons[0] : undefined)
  const dismiss = () => { if (cancel) close(cancel); else if (dialog.onDismiss) { close(); dialog.onDismiss() } }
  // Cancel first (left / top), like the system dialog.
  const ordered = [...dialog.buttons].sort((a, b) => Number(b.style === "cancel") - Number(a.style === "cancel"))
  const stacked = ordered.length > 2
  return <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
    <Pressable accessibilityLabel="Kapat" style={s.backdrop} onPress={dismiss}>
      <Pressable accessibilityRole="alert" style={s.card} onPress={() => {}}>
        <GlassFill kind="sheet" radius={24} />
        <Label style={s.title} accessibilityRole="header">{dialog.title}</Label>
        {dialog.message ? <Label style={s.message}>{dialog.message}</Label> : null}
        <View style={[s.actions, stacked && s.stacked]}>
          {ordered.map((button, index) => {
            const kind = button.style === "cancel" ? "cancel" : button.style === "destructive" ? "destructive" : "confirm"
            return <Touch key={`${button.text}-${index}`} accessibilityLabel={button.text} onPress={() => close(button)} style={[s.button, !stacked && s.flex, s[kind]]}>
              <Label style={[s.text, s[`${kind}Text`]]} numberOfLines={2}>{button.text || "Tamam"}</Label>
            </Touch>
          })}
        </View>
      </Pressable>
    </Pressable>
  </Modal>
}

const s = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, backgroundColor: "rgba(0,0,0,.6)" },
  card: { width: "100%", maxWidth: 360, gap: 10, padding: 22, borderRadius: 24, overflow: "hidden", backgroundColor: palette.glassSheet, borderWidth: 1, borderColor: palette.glassBorder },
  title: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 18, lineHeight: 24, textAlign: "center" },
  message: { color: palette.muted, fontSize: 14, lineHeight: 20, textAlign: "center" },
  actions: { flexDirection: "row", gap: 10, marginTop: 10 },
  stacked: { flexDirection: "column" },
  flex: { flex: 1 },
  button: { minHeight: 48, paddingHorizontal: 12, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  text: { fontSize: 15, lineHeight: 20, textAlign: "center" },
  cancel: { backgroundColor: "rgba(255,255,255,.06)", borderColor: palette.border },
  cancelText: { color: palette.text, fontFamily: "Outfit-Medium" },
  confirm: { backgroundColor: palette.selected, borderColor: "rgba(105,120,255,.45)" },
  confirmText: { color: palette.text, fontFamily: "Outfit-SemiBold" },
  destructive: { backgroundColor: "rgba(239,68,68,.12)", borderColor: "rgba(239,68,68,.4)" },
  destructiveText: { color: palette.error, fontFamily: "Outfit-SemiBold" },
})
