import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { palette } from "../theme/palette"
import { Box, Label, Picture, Touch } from "../native/UI"
import type { AppEvent } from "../types"

/** A list of events in a bottom sheet (e.g. the ended events the user attended); tapping one opens it. */
export default function EventsSheet({ title, events, error, emptyText, onClose, onOpen }: {
  title: string
  events: AppEvent[] | null
  error?: string
  emptyText: string
  onClose: () => void
  onOpen: (eventId: string) => void
}) {
  const { height } = useWindowDimensions()
  return <Modal transparent visible animationType="slide" statusBarTranslucent onRequestClose={onClose}>
    <Box style={s.backdrop}>
      <Pressable accessibilityLabel="Listeyi kapat" onPress={onClose} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={["bottom"]} style={s.sheet}>
        <Box style={s.header}>
          <Label style={s.title} numberOfLines={1}>{title}{events ? ` · ${events.length}` : ""}</Label>
          <Touch accessibilityLabel="Listeyi kapat" onPress={onClose} style={s.close}><Label style={s.closeLabel}>Kapat</Label></Touch>
        </Box>
        <ScrollView style={{ maxHeight: Math.round(height * 0.65) }} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
          {events === null ? <Label style={s.note}>Etkinlikler yükleniyor…</Label>
            : error ? <Label style={s.note}>{error}</Label>
            : !events.length ? <Label style={s.note}>{emptyText}</Label>
            : events.map(event => <Touch key={event.id} accessibilityLabel={`${event.title} etkinliğini aç`} onPress={() => { onClose(); onOpen(event.id) }} style={s.row}>
              <Picture uri={event.coverImage} accessibilityLabel="" style={s.cover} />
              <Box style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Label style={s.name} numberOfLines={1}>{event.title}</Label>
                <Label style={s.meta} numberOfLines={1}>{event.date}{event.location ? ` · ${event.location}` : ""}</Label>
              </Box>
              <Label style={s.arrow}>›</Label>
            </Touch>)}
        </ScrollView>
      </SafeAreaView>
    </Box>
  </Modal>
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,.55)" },
  sheet: { backgroundColor: palette.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  header: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { flex: 1, fontFamily: "Outfit-SemiBold", fontSize: 16, lineHeight: 22, color: palette.text },
  close: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  closeLabel: { fontFamily: "Outfit", fontSize: 15, lineHeight: 20, color: palette.muted },
  note: { paddingVertical: 24, textAlign: "center", color: palette.muted, fontSize: 14, lineHeight: 20 },
  row: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12, justifyContent: "flex-start" },
  cover: { width: 48, height: 48, borderRadius: 12 },
  name: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 14, lineHeight: 18 },
  meta: { color: palette.muted, fontFamily: "Outfit", fontSize: 12, lineHeight: 16 },
  arrow: { color: "rgba(255,255,255,.3)", fontSize: 22, lineHeight: 24 },
})
