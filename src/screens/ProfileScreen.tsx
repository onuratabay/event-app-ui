import { palette } from "../theme/palette";
import CityPicker from "../components/CityPicker";
import { CalendarIcon, StarIcon } from "../components/Icons";
import TopNavBar from "../components/TopNavBar";
import { Alert, StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import { Circle, Path, Polyline } from "react-native-svg";
import { logout, updateProfile, setProfilePhoto, getMapInterests, setUserInterests, getApiErrorMessage } from "../api/client";
import { ComingSoonCard } from "../components/Expressive";
import { AtmoBackground, Avatar, GlassCard, InterestChip, ScoreBadge } from "../components/GlassUI";
import { InstagramIcon } from "../components/Icons";

import { selectPhoto } from "../native/media";
import { useStore } from "../native/Store";
import { Box, Field, Label, Picture, Scroll, Touch, Vector, openExternal } from "../native/UI";
import { ui } from "../theme/styles";
import { NavigateFn } from "../types";
interface Props {
  navigate: NavigateFn;
  isOwn?: boolean;
}
function InlineEditField({
  value,
  onSave,
  multiline = false
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const save = async () => { if (saving) return; setSaving(true); try { await onSave(draft); setEditing(false); } catch {} finally { setSaving(false); } };
  if (editing) {
    return <Box style={[[]]} enter>
        {multiline ? <Field value={draft} onChangeText={e => setDraft(e)} autoFocus style={[[ui.wFull, ui.bgWhite8, ui.border, ui.borderC8a44a40, ui.roundedXl, ui.px3, ui.py25, ui.textSm, ui.textWhite80]]} multiline /> : <Field value={draft} onChangeText={e => setDraft(e)} autoFocus style={[[ui.wFull, ui.bgWhite8, ui.border, ui.borderC8a44a40, ui.roundedXl, ui.px3, ui.py25, ui.textSm, ui.textWhite80]]} />}
        <Box style={[[ui.flex, ui.gap2, ui.mt15]]}>
          <Touch onPress={save} style={[[ui.textXs, ui.px3, ui.py1, ui.roundedLg, ui.text1a1200, ui.fontMedium], {
          backgroundColor: "#4d5bcb"
        }]}>
            Kaydet
          </Touch>
          <Touch onPress={() => {
          setDraft(value);
          setEditing(false);
        }} style={[[ui.textXs, ui.px3, ui.py1, ui.roundedLg, ui.textWhite40, ui.border, ui.borderWhite10]]}>
            İptal
          </Touch>
        </Box>
      </Box>;
  }
  // Touch centres its content by default; keep the value left-aligned with the line below it.
  return <Touch onPress={() => setEditing(true)} accessibilityLabel="Düzenle" style={[[ui.relative, ui.flex, ui.itemsCenter], { justifyContent: "flex-start", alignSelf: "flex-start", minHeight: 0 }]}>
      <Label style={[[]]} numberOfLines={1}>{value}</Label>
    </Touch>;
}
function InstagramField({ handle, onSave }: { handle: string; onSave: (handle: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(handle);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try { await onSave(draft.replace(/^@/, "").trim()); setEditing(false); } catch { /* update() already alerted */ } finally { setSaving(false); }
  };
  if (editing) return <Box style={[[ui.mt3, ui.flex, ui.itemsCenter, ui.gap2]]}>
      <Label style={profileInstagramStyles.handle}>@</Label>
      <Field value={draft} onChangeText={value => setDraft(value.replace(/^@/, "").replace(/\s/g, ""))} autoFocus autoCapitalize="none" autoCorrect={false} placeholder="kullanici_adi" accessibilityLabel="Instagram kullanıcı adı" style={[[ui.flex1, ui.bgWhite8, ui.border, ui.borderC8a44a40, ui.roundedXl, ui.px3, ui.py25, ui.textSm, ui.textWhite80]]} />
      <Touch onPress={save} disabled={saving} style={[[ui.textXs, ui.px3, ui.py1, ui.roundedLg, ui.text1a1200, ui.fontMedium], { backgroundColor: "#4d5bcb" }]}>Kaydet</Touch>
      <Touch onPress={() => { setDraft(handle); setEditing(false); }} style={[[ui.textXs, ui.px3, ui.py1, ui.roundedLg, ui.textWhite40, ui.border, ui.borderWhite10]]}>İptal</Touch>
    </Box>;
  // A saved handle can no longer be edited here; tapping it opens Instagram.
  if (handle) return <Touch accessibilityRole="link" accessibilityLabel={`Instagram profilini aç: @${handle}`} onPress={() => openExternal(`https://instagram.com/${handle}`)} style={profileInstagramStyles.link}>
      <InstagramIcon size={19} strokeWidth={1.8} style={profileInstagramStyles.icon} />
      <Label style={profileInstagramStyles.handle}>{`@${handle}`}</Label>
      <Label style={profileInstagramStyles.private}>Özel</Label>
    </Touch>;
  return <Touch accessibilityLabel="Instagram kullanıcı adı ekle" onPress={() => { setDraft(""); setEditing(true); }} style={profileInstagramStyles.link}>
      <InstagramIcon size={19} strokeWidth={1.8} style={profileInstagramStyles.icon} />
      <Label style={profileInstagramStyles.empty}>@ kullanıcı adını ekle</Label>
    </Touch>;
}
const ABOUT_LIMIT = 280;
// Counted and cut by characters (code points) so an emoji is never split in half at the limit.
const limitAbout = (text: string) => Array.from(text).slice(0, ABOUT_LIMIT).join("");
const QUICK_EMOJIS = ["😄", "😎", "🤩", "🎾", "🏃", "🚴", "⛰️", "☕", "🍕", "🎶", "🎨", "📸", "🐶", "✈️", "❤️", "✨"];
/** "About me" (stored as bio): a few fun facts other members read before meeting you. */
function AboutMe({ bio, isOwn, onSave }: { bio: string; isOwn: boolean; onSave: (bio: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(bio);
  const [saving, setSaving] = useState(false);
  if (!isOwn && !bio.trim()) return null;
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try { await onSave(draft.trim()); setEditing(false); } catch { /* update() already alerted */ } finally { setSaving(false); }
  };
  return <Box style={[[ui.px5, ui.mb4]]}>
      <GlassCard style={[[ui.p4]]}>
        <Label style={[[ui.textXs, ui.textWhite35, ui.uppercase, ui.trackingWider]]}>
          Benimle Tanışmadan Önce Bil ✦
        </Label>
        {editing ? <Box style={[[ui.mt3]]}>
            <Field value={draft} onChangeText={value => setDraft(limitAbout(value))} multiline autoFocus accessibilityLabel="Hakkımda" placeholder="Örn. Pazar kahvaltısı uzmanıyım, padelde backhand'im efsane, kedim Pamuk'un tek fan kulübüyüm." style={[[ui.wFull, ui.bgWhite8, ui.border, ui.borderC8a44a40, ui.roundedXl, ui.px3, ui.py25, ui.textSm, ui.textWhite80]]} />
            {/* Quick emoji row: keyboards often hide the emoji key, so one tap adds one here. */}
            <Scroll horizontal style={[[ui.mt2]]} keyboardShouldPersistTaps="always">
              <Box style={[[ui.flex, ui.gap1]]}>
                {QUICK_EMOJIS.map(emoji => <Touch key={emoji} accessibilityLabel={`${emoji} ekle`} onPress={() => setDraft(current => limitAbout(current + emoji))} style={{ width: 40, height: 40, minHeight: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)" }}>
                    <Label style={{ fontSize: 20 }}>{emoji}</Label>
                  </Touch>)}
              </Box>
            </Scroll>
            <Box style={[[ui.flex, ui.itemsCenter, ui.justifyBetween, ui.mt15]]}>
              <Box style={[[ui.flex, ui.gap2]]}>
                <Touch onPress={save} disabled={saving} style={[[ui.textXs, ui.px3, ui.py1, ui.roundedLg, ui.text1a1200, ui.fontMedium], { backgroundColor: "#4d5bcb" }]}>Kaydet</Touch>
                <Touch onPress={() => { setDraft(bio); setEditing(false); }} style={[[ui.textXs, ui.px3, ui.py1, ui.roundedLg, ui.textWhite40, ui.border, ui.borderWhite10]]}>İptal</Touch>
              </Box>
              <Label style={[[ui.textXs, ui.textWhite35]]}>{Array.from(draft).length}/{ABOUT_LIMIT}</Label>
            </Box>
          </Box> : bio.trim() ? isOwn
            // Only the owner can edit: tapping the text itself opens the editor.
            ? <Touch accessibilityLabel="Hakkımda yazısını düzenle" onPress={() => { setDraft(bio); setEditing(true); }} style={[[ui.mt2], { alignItems: "flex-start", justifyContent: "flex-start", minHeight: 0 }]}>
                <Label style={[[ui.textSm, ui.textWhite75, ui.leadingRelaxed]]}>{bio}</Label>
              </Touch>
            : <Label style={[[ui.textSm, ui.textWhite75, ui.leadingRelaxed, ui.mt2]]}>{bio}</Label>
          : <Touch accessibilityLabel="Hakkımda yazısı ekle" onPress={() => { setDraft(""); setEditing(true); }} style={[[ui.mt3, ui.p4, ui.roundedXl, ui.border, ui.borderDashed, ui.borderWhite15], { alignItems: "flex-start" }]}>
            <Label style={[[ui.textSm, ui.textWhite75, ui.fontMedium]]}>Kendini birkaç eğlenceli cümleyle anlat</Label>
            <Label style={[[ui.textXs, ui.textWhite40, ui.mt1, ui.leadingRelaxed]]}>Etkinlikte seninle tanışacak kişiler önce bunu okur. İlk izlenimi sen belirle.</Label>
          </Touch>}
      </GlassCard>
    </Box>;
}
export default function ProfileScreen({
  navigate,
  isOwn = true
}: Props) {
  const {
    data: store,
    resetSession,
    setData: setStore,
    loadReferences
  } = useStore();
  const EVENTS = store.events;
  const ME = store.user;
  const user = store.user;
  const interests = new Set(store.user.interests);
  const [showReferences, setShowReferences] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const signOut = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      resetSession();
      navigate("welcome", { reset: true });
    } catch { Alert.alert("Çıkış yapılamadı", "Lütfen tekrar dene."); }
    finally { setLoggingOut(false); }
  };
  // References come from the store: fetched on the first visit, then kept current by socket events.
  const references = (store.references || []).filter(item => item.status === 'approved');
  useEffect(() => { void loadReferences().catch(() => {}); }, []);
  const update = async (key: string, value: string) => {
    try {
      if (key === 'avatar') await setProfilePhoto(value);
      else if (key === 'name') {
        const parts = value.trim().split(/\s+/); const lastName = parts.pop() || '';
        await updateProfile({ firstName: parts.join(' '), lastName });
      } else await updateProfile({ [key === 'instagram' ? 'instagramUsername' : key]: key === 'instagram' ? value.replace(/^@/, '') : value });
      setStore(p => ({ ...p, user: { ...p.user, [key]: value } }));
    } catch (error) { Alert.alert('Profil kaydedilemedi', getApiErrorMessage(error)); throw error; }
  };
  const toggleInterest = async (interest: string) => {
    try {
      const catalog = await getMapInterests();
      const chosen = new Set(store.user.interests);
      if (chosen.has(interest)) chosen.delete(interest); else chosen.add(interest);
      const saved = await setUserInterests(catalog.filter(i => chosen.has(i.name)).map(i => i.id));
      setStore(p => ({ ...p, user: { ...p.user, interests: saved.map(i => i.name) } }));
    } catch (error) { Alert.alert('İlgi alanları kaydedilemedi', getApiErrorMessage(error)); }
  };
  const myEvents = EVENTS.filter(e => e.host.id === store.user.id || e.participants.some(p => p.id === store.user.id));
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.overflowHidden]]}>
      <AtmoBackground variant="violet" />
      <TopNavBar
        navigate={navigate}
        fallback="discover"
        onBack={() => navigate("discover")}
        backLabel="Geri"
        title="Profil"
        right={isOwn ? <Box style={profileNavStyles.actions}>
          <Touch
            accessibilityLabel="Ayarları aç"
            onPress={() => navigate("settings")}
            style={profileNavStyles.action}
          >
            <Label style={profileNavStyles.actionLabel}>Ayarlar</Label>
          </Touch>
          <Touch
            onPress={() => void signOut()}
            disabled={loggingOut}
            accessibilityLabel="Çıkış yap"
            style={[profileNavStyles.action, profileNavStyles.signOut]}
          >
            <Label style={[profileNavStyles.actionLabel, profileNavStyles.signOutLabel, loggingOut && profileNavStyles.disabled]}>
              {loggingOut ? "Bekle" : "Çıkış"}
            </Label>
          </Touch>
        </Box> : undefined}
      />

      <Scroll style={[[ui.relative, ui.hFull, ui.pb28], { paddingTop: 80 }]}>
        {/* Header */}
        <Box style={[[ui.pt4, ui.px5, ui.pb5]]}>
          {/* Profile header */}
          <Box style={[[ui.flex, ui.itemsCenter, ui.gap4]]}>
            <Touch style={[[ui.relative]]} onPress={async () => {
            if (isOwn) {
              const uri = await selectPhoto();
              if (uri) void update("avatar", uri).catch(() => {});
            }
          }}>
              <Picture uri={user.avatar} accessibilityLabel={user.name} style={[[ui.w20, ui.h20, ui.rounded2xl]]} />
            </Touch>

            <Box style={[[ui.flex1, ui.minW0]]}>
              {isOwn ? <Box style={[[ui.textXl, ui.fontDisplay, ui.fontLight, ui.textWhite]]}>
                  <InlineEditField value={user.name} onSave={v => update("name", v)} />
                </Box> : <Label style={[[ui.textXl, ui.fontDisplay, ui.fontLight, ui.textWhite]]}>
                  {user.name}
                </Label>}

              {isOwn ? <Box style={[[ui.mt05]]}>
                  <CityPicker compact value={user.city} onChange={city => { void update("city", city).catch(() => {}); }} />
                </Box> : <Label style={[[ui.textSm, ui.textWhite45, ui.mt05]]}>
                  {user.city}
                </Label>}

            </Box>
          </Box>

          {/* Instagram: own profile can add a missing handle; a saved handle only opens Instagram */}
          {isOwn ? <InstagramField handle={user.instagram.replace(/^@/, "")} onSave={handle => update("instagram", handle)} /> : user.instagram ? <Touch
            accessibilityRole="link"
            accessibilityLabel={`Instagram profilini aç: @${user.instagram.replace(/^@/, "")}`}
            onPress={() => openExternal(`https://instagram.com/${user.instagram.replace(/^@/, "")}`)}
            style={profileInstagramStyles.link}
          >
            <InstagramIcon size={19} strokeWidth={1.8} style={profileInstagramStyles.icon} />
            <Label style={profileInstagramStyles.handle}>@{user.instagram.replace(/^@/, "")}</Label>
            <Label style={profileInstagramStyles.external}>↗</Label>
          </Touch> : null}
        </Box>

        {/* Stats */}
        <Box style={[[ui.px5, ui.mb4]]}>
          <Box style={[[ui.grid, ui.gap3]]} columns={3}>
            {[{
            value: user.stats.attended,
            label: "Katıldığı"
          }, {
            value: user.stats.connections,
            label: "Bağlantı"
          }, {
            value: user.stats.organized,
            label: "Düzenlediği"
          }].map((s, i) => <GlassCard key={i} style={[[ui.p4, ui.textCenter]]}>
                <Label style={[[ui.fontDisplay, ui.text2xl, ui.fontLight, ui.textWhite]]}>
                  {s.value}
                </Label>
                <Label style={[[ui.textXs, ui.textWhite35, ui.mt05]]}>
                  {s.label}
                </Label>
              </GlassCard>)}
          </Box>
        </Box>

        {/* Event Score */}
        <Box style={[[ui.px5, ui.mb4]]}>
          <GlassCard style={[[ui.p5]]}>
            <Box style={[[ui.flex, ui.itemsCenter, ui.justifyBetween, ui.mb4]]}>
              <Box>
                <Label style={[[ui.textXs, ui.textWhite35, ui.uppercase, ui.trackingWider]]}>
                  Event Skoru
                </Label>
                <Label style={[[ui.fontDisplay, ui.text4xl, ui.fontLight, ui.mt1], {
                color: palette.accent
              }]}>
                  {user.score.toFixed(1)}
                </Label>
              </Box>
              <Box style={[[ui.flex, ui.gap1]]}>
                {[1, 2, 3, 4, 5].map(i => <StarIcon key={i} size={19} filled={i <= Math.round(user.score)} style={{ color: palette.accent, opacity: i <= Math.round(user.score) ? 1 : .25 }} />)}
              </Box>
            </Box>
            <Box style={[[ui.spaceY0]]}>
              <ScoreBadge score={user.scores.punctuality} label="Dakiklik & Güvenilirlik" />
              <ScoreBadge score={user.scores.communication} label="İletişim & Nezaket" />
              <ScoreBadge score={user.scores.community} label="Topluluk Uyumu" />
            </Box>
            <Label style={[[ui.textXs, ui.textWhite25, ui.mt3, ui.leadingRelaxed]]}>
              Birlikte etkinliğe gittiğin kişilerin sana verdiği puanlardan
              oluşur.
            </Label>
          </GlassCard>
        </Box>

        {/* About me (bio) */}
        <AboutMe bio={user.bio || ""} isOwn={isOwn} onSave={bio => update("bio", bio)} />

        {/* Interests */}
        <Box style={[[ui.px5, ui.mb4]]}>
          <GlassCard style={[[ui.p4]]}>
            <Label style={[[ui.textXs, ui.textWhite35, ui.uppercase, ui.trackingWider, ui.mb3]]}>
              İlgi Alanları
            </Label>
            <Box style={[[ui.flex, ui.flexWrap, ui.gap2]]}>
              {Array.from(interests).map(interest => <InterestChip key={interest} label={interest} selected onPress={() => isOwn && toggleInterest(interest)} />)}
              {isOwn && <Touch onPress={() => navigate("interests")} style={[[ui.px3, ui.py2, ui.roundedXl, ui.textXs, ui.border, ui.borderDashed, ui.borderWhite15, ui.textWhite30]]}>
                  + Ekle
                </Touch>}
            </Box>
          </GlassCard>
        </Box>

        {/* Availability calendar (own only) */}
        {isOwn && <Box style={[[ui.px5, ui.mb4]]}>
            <GlassCard onPress={() => navigate("availability")} accessibilityLabel="Etkinlik Takvimim" style={[[ui.wFull, ui.flex, ui.itemsCenter, ui.justifyBetween, ui.p4]]}>
              <Box style={[[ui.flex, ui.itemsCenter, ui.gap3, ui.flex1, ui.minW0]]}>
                <Box style={[[ui.w9, ui.h9, ui.roundedXl, ui.flex, ui.itemsCenter, ui.justifyCenter], {
              backgroundColor: "rgba(105,120,255,0.12)",
              borderWidth: 1,
              borderColor: "rgba(105,120,255,0.24)"
            }]}>
                  <CalendarIcon size={18} style={{ color: palette.accent }} />
                </Box>
                <Box style={[[ui.textLeft, ui.flex1, ui.minW0]]}>
                  <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite80]]}>
                    Etkinlik Takvimim
                  </Label>
                  <Label style={[[ui.textXs, ui.textWhite35]]}>
                    Müsait olduğun zamanlar · uygun etkinliklere davet al
                  </Label>
                </Box>
              </Box>
              <Label style={[[ui.textWhite30, ui.textSm]]}>›</Label>
            </GlassCard>
          </Box>}

        {/* References (own only) */}
        {isOwn && <Box style={[[ui.px5, ui.mb4]]}>
            <GlassCard style={[[ui.overflowHidden]]}>
              <Touch onPress={() => setShowReferences(!showReferences)} style={[[ui.wFull, ui.flex, ui.itemsCenter, ui.justifyBetween, ui.p4]]}>
                <Box style={[[ui.flex, ui.itemsCenter, ui.gap3]]}>
                  <Box style={[[ui.w9, ui.h9, ui.roundedXl, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.textSm], {
                backgroundColor: "rgba(146,125,255,0.12)",
                borderWidth: 1,
                borderColor: "rgba(146,125,255,0.2)"
              }]}>
                    🤝
                  </Box>
                  <Box style={[[ui.textLeft]]}>
                    <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite80]]}>
                      Referanslarım
                    </Label>
                    <Label style={[[ui.textXs, ui.textWhite35]]}>
                      Sadece sana görünür
                    </Label>
                  </Box>
                </Box>
                <Label style={[[ui.textWhite30, ui.textSm, showReferences ? [ui.rotate180] : []]]}>
                  ▾
                </Label>
              </Touch>

              {showReferences && <Box style={{ padding: 16 }}>
                {!references.length && <Label>Henüz onaylanmış referans yok.</Label>}
                {references.map(ref => <Label key={ref.id}>{ref.direction === 'incoming' ? ref.recipient.name : ref.requester.name} · Onaylandı</Label>)}
              </Box>}
            </GlassCard>
          </Box>}

        {/* Recent events */}
        <Box style={[[ui.px5, ui.mb4]]}>
          <GlassCard style={[[ui.p4]]}>
            <Label style={[[ui.textXs, ui.textWhite35, ui.uppercase, ui.trackingWider, ui.mb3]]}>
              Son Etkinlikler
            </Label>
            <Box style={[[ui.spaceY3]]}>
              {myEvents.slice(0, 3).map(event => <Touch key={event.id} onPress={() => navigate("event-detail", {
              eventId: event.id
            })} style={[[ui.wFull, ui.flex, ui.itemsCenter, ui.gap3, ui.textLeft]]}>
                  <Box style={[[ui.w10, ui.h10, ui.roundedXl, ui.overflowHidden, ui.flexShrink0], {
                backgroundColor: "rgba(255,255,255,0.05)"
              }]}>
                    <Picture uri={event.coverImage} accessibilityLabel="" style={[[ui.wFull, ui.hFull, ui.opacity70]]} />
                  </Box>
                  <Box style={[[ui.flex1, ui.minW0]]}>
                    <Label style={[[ui.textSm, ui.textWhite75, ui.fontMedium]]} numberOfLines={1}>
                      {event.title}
                    </Label>
                    <Label style={[[ui.textXs, ui.textWhite35]]}>
                      {event.date} ·{" "}
                      {event.host.id === store.user.id ? "Organizatör" : "Katılımcı"}
                    </Label>
                  </Box>
                  <Box style={[[ui.flex]]}>
                    {event.participants.slice(0, 3).map(p => <Picture key={p.id} uri={p.avatar} accessibilityLabel="" style={[[ui.w5, ui.h5, ui.roundedFull]]} />)}
                  </Box>
                </Touch>)}
            </Box>
          </GlassCard>
        </Box>
        {isOwn && <Box style={[[ui.px5, ui.mb4, ui.spaceY3]]}>
            <Label style={[[ui.textXs, ui.textWhite25, ui.uppercase, ui.trackingWider]]}>
              Sizinle Olacak
            </Label>
            <ComingSoonCard accent="gold" icon={<Vector width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(105,120,255,0.9)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <Circle cx="12" cy="8" r="7" />
                  <Polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                </Vector>} title="Rozetler ve Başarılar" subtitle="Etkinlik geçmişine göre özel rozetler kazan, topluluğa ilhamını yansıt." />
            <ComingSoonCard accent="violet" icon={<Vector width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(178,174,248,0.9)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <Circle cx="9" cy="7" r="4" />
                  <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </Vector>} title="Bağlantı Ağı" subtitle="Birlikte etkinliğe gittiğin kişileri keşfet, ortak çevreni gör." />
          </Box>}
      </Scroll>

      {/* Coming soon for profile */}

    </Box>;
}

const profileNavStyles = StyleSheet.create({
  actions: { flexDirection: "row", alignItems: "center", gap: 6 },
  action: {
    width: 64,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  signOut: {},
  actionLabel: {
    color: palette.text,
    fontFamily: "Outfit-SemiBold",
    fontSize: 12,
    lineHeight: 16,
  },
  signOutLabel: { color: "#b9c3ff" },
  disabled: { opacity: 0.45 },
});

const profileInstagramStyles = StyleSheet.create({
  link: {
    alignSelf: "flex-start",
    minHeight: 44,
    marginTop: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    backgroundColor: "rgba(105,120,255,.09)",
    borderWidth: 1,
    borderColor: "rgba(105,120,255,.22)",
  },
  icon: { color: "#b9c3ff" },
  handle: {
    color: "#f2d889",
    fontFamily: "Outfit-SemiBold",
    fontSize: 14,
    lineHeight: 19,
    textDecorationLine: "underline",
  },
  external: { color: "rgba(183,197,255,.72)", fontSize: 14 },
  empty: { color: "rgba(226,232,240,.55)", fontFamily: "Outfit-Medium", fontSize: 14, lineHeight: 19 },
  private: {
    marginLeft: 2,
    color: "rgba(226,232,240,.48)",
    fontFamily: "Outfit-Medium",
    fontSize: 10,
    lineHeight: 14,
    textTransform: "uppercase",
    letterSpacing: .7,
  },
});
