import { usePathname } from "expo-router"
import { useEffect, useState } from "react"
import { StyleSheet } from "react-native"
import { acceptLegalDocuments, getApiErrorMessage, getLegalConsents, type LegalConsentStatus } from "../api/client"
import { useOptionalGuest } from "../guest/GuestSession"
import { useOpenLegal } from "../legal/links"
import { useNavigate } from "../native/navigation"
import { useStore } from "../native/Store"
import { Box, Label, Scroll, Touch } from "../native/UI"
import { palette } from "../theme/palette"
import SignOutButton from "./SignOutButton"

type Pending = LegalConsentStatus["documents"]

/**
 * When a required legal text gets a new version, a signed-in member must accept it before
 * continuing. Checked once per account and session; the legal page itself stays reachable.
 */
export default function LegalConsentGate() {
  const { data } = useStore()
  const pathname = usePathname()
  const navigate = useNavigate()
  const openLegal = useOpenLegal()
  const guest = useOptionalGuest()
  const userId = guest?.guest ? "" : data.user.id
  const [pending, setPending] = useState<Pending>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const apply = (status: LegalConsentStatus) => setPending(status.documents.filter(doc => status.pending.includes(doc.type)))
  useEffect(() => {
    setPending([]); setError(null)
    if (!userId) return
    let active = true
    // A failed check never blocks the app; the server still records the versions accepted at sign-up.
    getLegalConsents().then(status => { if (active) apply(status) }).catch(() => {})
    return () => { active = false }
  }, [userId])
  if (!userId || !pending.length || pathname === "/legal") return null
  const accept = async () => {
    if (busy) return
    setBusy(true); setError(null)
    try { apply(await acceptLegalDocuments(pending.map(({ type, version }) => ({ type, version })))) }
    catch (cause) {
      setError(getApiErrorMessage(cause, "Onayın kaydedilemedi. Tekrar dene."))
      // A newer version may have been published meanwhile; show that one instead.
      await getLegalConsents().then(apply).catch(() => {})
    }
    finally { setBusy(false) }
  }
  return <Box style={s.overlay}>
    <Scroll style={s.page}>
      <Label accessibilityRole="header" style={s.title}>Metinlerimizi güncelledik</Label>
      <Label style={s.body}>Devam etmek için aşağıdaki metinlerin yeni sürümlerini okuyup onaylaman gerekiyor.</Label>
      <Box style={s.card}>
        {pending.map(doc => <Touch key={doc.type} accessibilityRole="link" accessibilityLabel={`${doc.title} metnini oku`} onPress={() => openLegal(doc.type)} style={s.row}>
          <Box style={s.copy}><Label style={s.rowTitle}>{doc.title}</Label><Label style={s.rowDetail}>{`Sürüm ${doc.version} · Okumak için dokun`}</Label></Box>
          <Label style={s.chevron}>›</Label>
        </Touch>)}
      </Box>
      {error && <Label accessibilityRole="alert" style={s.error}>{error}</Label>}
      <Touch disabled={busy} onPress={() => void accept()} style={s.primary} gradient={palette.actionGradient}>
        <Label style={s.primaryLabel}>{busy ? "Kaydediliyor…" : "Okudum, kabul ediyorum"}</Label>
      </Touch>
      <Box style={s.signOut}><SignOutButton navigate={navigate} /></Box>
    </Scroll>
  </Box>
}

const s = StyleSheet.create({
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: palette.background, zIndex: 50 },
  page: { paddingTop: 72, paddingHorizontal: 20, paddingBottom: 40 },
  title: { color: palette.text, fontFamily: "Fraunces", fontSize: 30, fontStyle: "italic" },
  body: { color: palette.muted, fontSize: 14, lineHeight: 21, marginTop: 10 },
  card: { marginTop: 24, borderRadius: 20, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, minHeight: 64, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  copy: { flex: 1, gap: 4 },
  rowTitle: { color: palette.text, fontFamily: "Outfit-Medium", fontSize: 15 },
  rowDetail: { color: palette.muted, fontSize: 12 },
  chevron: { color: palette.accent, fontSize: 20 },
  error: { color: palette.error, fontSize: 13, lineHeight: 19, marginTop: 16 },
  primary: { marginTop: 24, minHeight: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  primaryLabel: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 15 },
  signOut: { alignItems: "center", marginTop: 12 },
})
