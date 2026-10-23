import { useEffect, useState } from "react"
import { ActivityIndicator, StyleSheet } from "react-native"
import { clearSessionCache, getApiErrorMessage, getCurrentUser, setProfilePhoto, updateProfile, type ApiUser } from "../api/client"
import { Box, Field, Label, Touch } from "../native/UI"
import { selectPhoto } from "../native/media"
import { updateStoreUser, useStore } from "../native/Store"
import { palette } from "../theme/palette"
import CityPicker from "./CityPicker"
import { Avatar } from "./GlassUI"
import { CameraIcon, LockIcon } from "./Icons"

/** "+905321234567" → "+90 532 123 45 67"; anything else is shown as it is. */
function formatPhone(phone: string) {
  const match = /^\+90(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(phone)
  return match ? `+90 ${match.slice(1).join(" ")}` : phone
}

function Locked({ label, value }: { label: string; value: string }) {
  return <Box style={s.locked} accessibilityLabel={`${label}: ${value}, değiştirilemez`}>
    <Box style={s.lockedCopy}>
      <Label style={s.label}>{label}</Label>
      <Label style={s.lockedValue} numberOfLines={1}>{value}</Label>
    </Box>
    <LockIcon size={16} style={{ color: palette.muted }} />
  </Box>
}

/**
 * Settings › Hesap: photo, first and last name and city can be changed here. Email, mobile number and
 * Instagram are shown read-only; the server refuses to change them too, since they can be used to take
 * over an account.
 */
export default function AccountProfileForm() {
  const { setData } = useStore()
  const [me, setMe] = useState<ApiUser | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [city, setCity] = useState("")
  /** A newly picked photo (data URI) waiting for "Kaydet". */
  const [photo, setPhoto] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const fill = (user: ApiUser) => { setMe(user); setFirstName(user.firstName || ""); setLastName(user.lastName || ""); setCity(user.city || ""); setPhoto(null) }
  useEffect(() => {
    let active = true
    getCurrentUser().then(user => { if (active) fill(user) }).catch(cause => { if (active) setLoadError(getApiErrorMessage(cause, "Bilgilerin yüklenemedi.")) })
    return () => { active = false }
  }, [])

  if (!me) return <Box style={s.form}>
    {loadError ? <Label accessibilityRole="alert" style={s.error}>{loadError}</Label> : <ActivityIndicator color={palette.accent} />}
  </Box>

  const changes: Partial<ApiUser> = {}
  if (firstName.trim() !== (me.firstName || "")) changes.firstName = firstName.trim()
  if (lastName.trim() !== (me.lastName || "")) changes.lastName = lastName.trim()
  if (city !== (me.city || "")) changes.city = city
  const valid = firstName.trim().length >= 2 && lastName.trim().length >= 2 && !!city
  const ready = valid && (Object.keys(changes).length > 0 || !!photo) && !saving
  const edit = (apply: () => void) => { apply(); setError(null); setSaved(false) }

  const pickPhoto = async () => {
    const uri = await selectPhoto()
    if (uri) edit(() => setPhoto(uri))
  }
  const save = async () => {
    if (!ready) return
    setSaving(true); setError(null); setSaved(false)
    try {
      if (photo) await setProfilePhoto(photo)
      if (Object.keys(changes).length) await updateProfile(changes)
      clearSessionCache("user")
      const fresh = await getCurrentUser()
      setData(current => ({ ...current, user: updateStoreUser(current.user, fresh) }))
      fill(fresh)
      setSaved(true)
    } catch (cause) { setError(getApiErrorMessage(cause, "Bilgilerin kaydedilemedi.")) }
    finally { setSaving(false) }
  }

  const name = `${firstName} ${lastName}`.trim()
  return <Box style={s.form}>
    <Box style={s.photoRow}>
      <Avatar uri={photo || me.profilePhoto || ""} name={name || "Profil fotoğrafı"} size="xl" />
      <Touch accessibilityRole="button" accessibilityLabel="Profil fotoğrafını değiştir" onPress={() => void pickPhoto()} style={s.photoButton}>
        <CameraIcon size={16} style={{ color: palette.accent }} />
        <Label style={s.photoLabel}>{photo ? "Başka fotoğraf seç" : "Fotoğrafı değiştir"}</Label>
      </Touch>
    </Box>

    <Label style={s.label}>Ad</Label>
    <Field accessibilityLabel="Ad" placeholder="Ad" placeholderTextColor={palette.muted} value={firstName} onChangeText={value => edit(() => setFirstName(value))} autoCapitalize="words" textContentType="givenName" style={s.input} />
    {!!firstName && firstName.trim().length < 2 && <Label style={s.error}>Ad en az 2 karakter olmalı.</Label>}
    <Label style={s.label}>Soyad</Label>
    <Field accessibilityLabel="Soyad" placeholder="Soyad" placeholderTextColor={palette.muted} value={lastName} onChangeText={value => edit(() => setLastName(value))} autoCapitalize="words" textContentType="familyName" style={s.input} />
    {!!lastName && lastName.trim().length < 2 && <Label style={s.error}>Soyad en az 2 karakter olmalı.</Label>}
    <CityPicker value={city} onChange={value => edit(() => setCity(value))} />

    <Box style={s.lockedGroup}>
      <Locked label="E-posta" value={me.email || "—"} />
      <Locked label="Cep telefonu" value={me.phoneNumber ? formatPhone(me.phoneNumber) : "—"} />
      <Locked label="Instagram" value={me.instagramUsername ? `@${me.instagramUsername}` : "Eklenmedi"} />
    </Box>
    <Label style={s.note}>Güvenliğin için e-posta, cep telefonu ve Instagram hesabın değiştirilemez. Bu bilgiler hesabının sana ait olduğunu doğrulamak için kullanılır.</Label>

    {error && <Label accessibilityRole="alert" style={s.error}>{error}</Label>}
    {saved && <Label accessibilityLiveRegion="polite" style={s.saved}>Bilgilerin güncellendi.</Label>}
    <Touch disabled={!ready} accessibilityState={{ disabled: !ready }} onPress={() => void save()} style={[s.primary, !ready && s.primaryDisabled]}>
      <Label style={s.primaryLabel}>{saving ? "Kaydediliyor…" : "Kaydet"}</Label>
    </Touch>
  </Box>
}

const s = StyleSheet.create({
  form: { gap: 10, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 4 },
  photoButton: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: palette.glassBorder, backgroundColor: palette.glass },
  photoLabel: { color: palette.accent, fontFamily: "Outfit-Medium", fontSize: 14 },
  label: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.background, paddingHorizontal: 14, color: palette.text, fontSize: 15 },
  lockedGroup: { marginTop: 6, borderRadius: 14, borderWidth: 1, borderColor: palette.border, overflow: "hidden" },
  locked: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border, backgroundColor: "rgba(255,255,255,.03)" },
  lockedCopy: { flex: 1, minWidth: 0, gap: 2 },
  lockedValue: { color: "rgba(244,245,255,.6)", fontSize: 15 },
  note: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  error: { color: palette.error, fontSize: 13, lineHeight: 19 },
  saved: { color: palette.success, fontSize: 13, lineHeight: 19 },
  primaryDisabled: { opacity: .45 },
  primary: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#4d5bcb" },
  primaryLabel: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 15 },
})
