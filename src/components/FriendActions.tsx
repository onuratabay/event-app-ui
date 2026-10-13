import { Alert, StyleSheet } from "react-native"
import { useState } from "react"
import { palette } from "../theme/palette"
import { Box, Label, Touch } from "../native/UI"
import { acceptFriendRequest, cancelFriendRequest, declineFriendRequest, getApiErrorMessage, removeFriend, sendFriendRequest, type FriendRelationship } from "../api/client"
import { UserPlusIcon } from "./Icons"

type Status = FriendRelationship["status"]

/**
 * Friend button on another member's profile. A sent request cannot be sent again, only withdrawn;
 * an incoming one is approved or declined here. Changes show at once and roll back on failure.
 */
export default function FriendActions({ userId, name, relation, onChange }: {
  userId: string
  name: string
  relation: FriendRelationship
  onChange: (next: FriendRelationship) => void
}) {
  const [busy, setBusy] = useState(false)
  const run = async (next: Partial<FriendRelationship> & { status: Status }, action: () => Promise<unknown>) => {
    if (busy) return
    const previous = relation
    setBusy(true); onChange({ ...relation, ...next })
    try { await action() }
    catch (error) { onChange(previous); Alert.alert("İşlem tamamlanamadı", getApiErrorMessage(error)) }
    finally { setBusy(false) }
  }
  const first = name.split(" ")[0] || "Bu üye"
  const unfriend = () => Alert.alert("Arkadaşlıktan çıkar", `${name} arkadaş listenden çıkarılsın mı?`, [
    { text: "Vazgeç", style: "cancel" },
    { text: "Çıkar", style: "destructive", onPress: () => void run({ status: "none", canRequest: true, friendCount: Math.max(0, relation.friendCount - 1) }, () => removeFriend(userId)) },
  ])
  if (relation.status === "friends") return <Box style={s.row}>
    <Box style={[s.pill, s.friends]}><Label style={[s.pillLabel, { color: palette.success }]}>✓ Arkadaşsınız</Label></Box>
    <Touch accessibilityLabel="Arkadaşlıktan çıkar" disabled={busy} onPress={unfriend} style={s.secondary}>
      <Label style={[s.secondaryLabel, { color: palette.error }]}>Arkadaşlıktan çıkar</Label>
    </Touch>
  </Box>
  if (relation.status === "outgoing") return <Box style={s.row}>
    <Box style={s.pill}><Label style={s.pillLabel}>İstek gönderildi</Label></Box>
    <Touch accessibilityLabel="Arkadaşlık isteğini geri çek" disabled={busy} onPress={() => void run({ status: "none", canRequest: true }, () => cancelFriendRequest(userId))} style={s.secondary}>
      <Label style={s.secondaryLabel}>İsteği geri çek</Label>
    </Touch>
  </Box>
  if (relation.status === "incoming") return <Box style={{ gap: 8 }}>
    <Label style={s.hint}>{first} sana arkadaşlık isteği gönderdi.</Label>
    <Box style={s.row}>
      <Touch accessibilityLabel="Arkadaşlık isteğini kabul et" disabled={busy} onPress={() => void run({ status: "friends", friendCount: relation.friendCount + 1 }, () => acceptFriendRequest(userId))} style={s.primary} gradient={palette.actionGradient}>
        <Label style={s.primaryLabel}>Kabul et</Label>
      </Touch>
      <Touch accessibilityLabel="Arkadaşlık isteğini reddet" disabled={busy} onPress={() => void run({ status: "none", canRequest: false }, () => declineFriendRequest(userId))} style={s.secondary}>
        <Label style={s.secondaryLabel}>Reddet</Label>
      </Touch>
    </Box>
  </Box>
  if (!relation.canRequest) return <Label style={s.hint}>Birlikte bir etkinliğe katıldığınızda {first} kişisine arkadaşlık isteği gönderebilirsin.</Label>
  return <Box style={s.row}>
    <Touch accessibilityLabel="Arkadaşlık isteği gönder" disabled={busy} onPress={() => void run({ status: "outgoing", canRequest: false }, () => sendFriendRequest(userId))} style={s.primary} gradient={palette.actionGradient}>
      <UserPlusIcon size={17} strokeWidth={1.9} style={{ color: palette.text }} />
      <Label style={s.primaryLabel}>Arkadaş ekle</Label>
    </Touch>
  </Box>
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  primary: { minHeight: 44, paddingHorizontal: 18, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryLabel: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 14, lineHeight: 18 },
  secondary: { minHeight: 44, paddingHorizontal: 16, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: palette.border, backgroundColor: "rgba(255,255,255,.04)" },
  secondaryLabel: { color: palette.accent, fontFamily: "Outfit-SemiBold", fontSize: 14, lineHeight: 18 },
  pill: { minHeight: 36, paddingHorizontal: 14, borderRadius: 12, justifyContent: "center", backgroundColor: palette.selected },
  friends: { backgroundColor: "rgba(111,208,182,.12)" },
  pillLabel: { color: palette.accent, fontFamily: "Outfit-SemiBold", fontSize: 13, lineHeight: 17 },
  hint: { color: palette.muted, fontFamily: "Outfit", fontSize: 13, lineHeight: 18 },
})
