import { Alert, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useEffect, useState } from "react"
import { palette } from "../theme/palette"
import { GlassFill } from "./GlassFill"
import { Box, Label, Picture, Touch } from "../native/UI"
import { getApiErrorMessage, getFriendsOf, removeFriend, type FriendUser } from "../api/client"

/**
 * A member's connections in a bottom sheet. On your own profile each friend can be removed;
 * a friend's list is read-only. Tapping a person opens their profile.
 */
export default function ConnectionsSheet({ userId, title, canRemove, onClose, onOpenProfile, onRemoved }: {
  userId: string
  title: string
  canRemove: boolean
  onClose: () => void
  onOpenProfile: (userId: string) => void
  onRemoved?: (userId: string) => void
}) {
  const { height } = useWindowDimensions()
  const [people, setPeople] = useState<FriendUser[] | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    let active = true
    getFriendsOf(userId).then(result => { if (active) setPeople(result.items.map(item => item.user)) })
      .catch(cause => { if (active) { setPeople([]); setError(getApiErrorMessage(cause, "Bağlantılar yüklenemedi.")) } })
    return () => { active = false }
  }, [userId])
  const remove = (person: FriendUser) => Alert.alert("Arkadaşlıktan çıkar", `${person.firstName} ${person.lastName} arkadaş listenden çıkarılsın mı?`, [
    { text: "Vazgeç", style: "cancel" },
    { text: "Çıkar", style: "destructive", onPress: () => {
      const previous = people
      setPeople(rows => (rows || []).filter(row => row.id !== person.id)); onRemoved?.(person.id)
      removeFriend(person.id).catch(cause => { setPeople(previous); Alert.alert("Çıkarılamadı", getApiErrorMessage(cause)) })
    } },
  ])
  return <Modal transparent visible animationType="slide" statusBarTranslucent onRequestClose={onClose}>
    <Box style={s.backdrop}>
      <Pressable accessibilityLabel="Bağlantıları kapat" onPress={onClose} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={["bottom"]} style={s.sheet}><GlassFill kind="sheet" topRadius={24} />
        <Box style={s.header}>
          <Label style={s.title} numberOfLines={1}>{title}{people ? ` · ${people.length}` : ""}</Label>
          <Touch accessibilityLabel="Bağlantıları kapat" onPress={onClose} style={s.close}><Label style={s.closeLabel}>Kapat</Label></Touch>
        </Box>
        <ScrollView style={{ maxHeight: Math.round(height * 0.65) }} contentContainerStyle={{ gap: 4, paddingBottom: 8 }}>
          {people === null ? <Label style={s.note}>Bağlantılar yükleniyor…</Label>
            : error ? <Label style={s.note}>{error}</Label>
            : !people.length ? <Label style={s.note}>Henüz bağlantı yok.</Label>
            : people.map(person => {
              const name = `${person.firstName} ${person.lastName}`.trim()
              return <Box key={person.id} style={s.row}>
                <Touch accessibilityLabel={`${name} profilini aç`} onPress={() => { onClose(); onOpenProfile(person.id) }} style={s.person}>
                  {person.profilePhoto ? <Picture uri={person.profilePhoto} accessibilityLabel={name} style={s.avatar} />
                    : <Box style={[s.avatar, s.initial]}><Label style={s.initialLabel}>{name.charAt(0).toLocaleUpperCase("tr")}</Label></Box>}
                  <Label style={s.name} numberOfLines={1}>{name}</Label>
                </Touch>
                {canRemove ? <Touch accessibilityLabel={`${name} arkadaşlıktan çıkar`} onPress={() => remove(person)} style={s.remove}><Label style={s.removeLabel}>Çıkar</Label></Touch> : null}
              </Box>
            })}
        </ScrollView>
      </SafeAreaView>
    </Box>
  </Modal>
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,.55)" },
  sheet: { backgroundColor: palette.glassSheet, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  header: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { flex: 1, fontFamily: "Outfit-SemiBold", fontSize: 16, lineHeight: 22, color: palette.text },
  close: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  closeLabel: { fontFamily: "Outfit", fontSize: 15, lineHeight: 20, color: palette.muted },
  note: { paddingVertical: 24, textAlign: "center", color: palette.muted, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  person: { flex: 1, minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, justifyContent: "flex-start" },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  initial: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(146,125,255,.16)" },
  initialLabel: { color: palette.accent, fontFamily: "Outfit-SemiBold", fontSize: 15, lineHeight: 18 },
  name: { flex: 1, minWidth: 0, color: palette.text, fontSize: 14, lineHeight: 18, includeFontPadding: false },
  remove: { minHeight: 36, paddingHorizontal: 12, borderRadius: 10, justifyContent: "center", borderWidth: 1, borderColor: "rgba(243,155,175,.35)" },
  removeLabel: { color: palette.error, fontFamily: "Outfit-SemiBold", fontSize: 13, lineHeight: 17 },
})
