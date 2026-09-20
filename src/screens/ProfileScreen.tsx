import BackButton from "../components/BackButton";
import { Alert } from "react-native";
import { useState } from "react";
import { Circle, Path, Polyline } from "react-native-svg";
import { logout } from "../api/client";
import BottomNav from "../components/BottomNav";
import { ComingSoonCard } from "../components/Expressive";
import { AtmoBackground, Avatar, GlassCard, InterestChip, ScoreBadge } from "../components/GlassUI";
import { USERS } from "../data";
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
  onSave: (v: string) => void;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const save = () => {
    onSave(draft);
    setEditing(false);
  };
  if (editing) {
    return <Box style={[[]]} enter>
        {multiline ? <Field value={draft} onChangeText={e => setDraft(e)} autoFocus style={[[ui.wFull, ui.bgWhite8, ui.border, ui.borderC8a44a40, ui.roundedXl, ui.px3, ui.py25, ui.textSm, ui.textWhite80]]} multiline /> : <Field value={draft} onChangeText={e => setDraft(e)} autoFocus style={[[ui.wFull, ui.bgWhite8, ui.border, ui.borderC8a44a40, ui.roundedXl, ui.px3, ui.py25, ui.textSm, ui.textWhite80]]} />}
        <Box style={[[ui.flex, ui.gap2, ui.mt15]]}>
          <Touch onPress={save} style={[[ui.textXs, ui.px3, ui.py1, ui.roundedLg, ui.text1a1200, ui.fontMedium], {
          backgroundColor: "#c8a44a"
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
  return <Touch onPress={() => setEditing(true)} style={[[ui.relative]]}>
      <Label style={[[]]}>{value}</Label>
      <Label style={[[ui.ml2, ui.opacity0, ui.opacity60, ui.textC8a44a, ui.textXs]]}>
        ✎
      </Label>
    </Touch>;
}
export default function ProfileScreen({
  navigate,
  isOwn = true
}: Props) {
  const {
    data: store,
    resetSession,
    setData: setStore
  } = useStore();
  const EVENTS = store.events;
  const ME = store.user;
  const user = store.user;
  const setUser = (update: (u: typeof ME) => typeof ME) => setStore(p => ({
    ...p,
    user: update(p.user)
  }));
  const interests = new Set(store.user.interests);
  const [showReferences, setShowReferences] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const signOut = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      resetSession();
      navigate("welcome");
    } catch { Alert.alert("Çıkış yapılamadı", "Lütfen tekrar dene."); }
    finally { setLoggingOut(false); }
  };
  const update = (key: string, value: string) => setUser(prev => ({
    ...prev,
    [key]: value
  }));
  const toggleInterest = (i: string) => setStore(p => {
    const next = new Set(p.user.interests);
    if (next.has(i)) next.delete(i);else next.add(i);
    return {
      ...p,
      user: {
        ...p.user,
        interests: [...next]
      }
    };
  });
  const myEvents = EVENTS.filter(e => e.host.id === "me" || e.participants.some(p => p.id === "me"));
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.overflowHidden]]}>
      <AtmoBackground variant="violet" />

      <Scroll style={[[ui.relative, ui.hFull, ui.pb28]]}>
        {/* Header */}
        <Box style={[[ui.pt14, ui.px5, ui.pb5]]}>
          <BackButton navigate={navigate} fallback="discover" onPress={() => navigate("discover")} />
          <Box style={[[ui.flex, ui.itemsCenter, ui.justifyBetween, ui.mb6]]}>
            <Label style={[[ui.fontDisplay, ui.text2xl, ui.fontLight, ui.textWhite]]}>
              Profil
            </Label>
            {isOwn && <Box style={[[ui.flex, ui.itemsCenter, ui.gap2]]}>
                <Touch style={[[ui.textXs, ui.px3, ui.py15, ui.glass, ui.roundedXl, ui.textWhite25]]} glass>
                  ⚙ Ayarlar
                </Touch>
                <Touch
                  onPress={() => void signOut()}
                  disabled={loggingOut}
                  accessibilityLabel="Çıkış yap"
                  style={[[ui.textXs, ui.px3, ui.py15, ui.glass, ui.roundedXl, {
                    color: loggingOut ? "rgba(255,255,255,.25)" : "#c8a44a",
                  }]]}
                  glass
                >
                  {loggingOut ? "Çıkılıyor..." : "Çıkış"}
                </Touch>
                <Label style={[[ui.fixed, ui.Top2, ui.Right2, ui.px15, ui.py05, ui.roundedFull, ui.text8px, ui.fontBold, ui.trackingWide], {
              backgroundColor: "rgba(124,112,240,0.18)",
              borderWidth: 1,
              borderColor: "rgba(124,112,240,0.3)",
              color: "rgba(178,174,248,0.9)"
            }]}>
                  Yakında
                </Label>
              </Box>}
          </Box>

          {/* Profile header */}
          <Box style={[[ui.flex, ui.itemsStart, ui.gap4]]}>
            <Touch style={[[ui.relative]]} onPress={async () => {
            if (isOwn) {
              const uri = await selectPhoto();
              if (uri) update("avatar", uri);
            }
          }}>
              <Picture uri={user.avatar} accessibilityLabel={user.name} style={[[ui.w20, ui.h20, ui.rounded2xl]]} />
              {isOwn && <Box style={[[ui.fixed, ui.inset0, ui.rounded2xl, ui.bgBlack50, ui.opacity0, ui.opacity60, ui.flex, ui.itemsCenter, ui.justifyCenter]]}>
                  <Label style={[[ui.textXs, ui.textWhite]]}>✎</Label>
                </Box>}
            </Touch>

            <Box style={[[ui.flex1, ui.minW0]]}>
              {isOwn ? <Box style={[[ui.textXl, ui.fontDisplay, ui.fontLight, ui.textWhite]]}>
                  <InlineEditField value={user.name} onSave={v => update("name", v)} />
                </Box> : <Label style={[[ui.textXl, ui.fontDisplay, ui.fontLight, ui.textWhite]]}>
                  {user.name}
                </Label>}

              {isOwn ? <Box style={[[ui.textSm, ui.textWhite45, ui.mt05]]}>
                  <InlineEditField value={user.city} onSave={v => update("city", v)} />
                </Box> : <Label style={[[ui.textSm, ui.textWhite45, ui.mt05]]}>
                  {user.city}
                </Label>}

              {/* Instagram */}
              <Touch onPress={() => openExternal(`https://instagram.com/${user.instagram}`)} style={[[ui.mt15, ui.flex, ui.itemsCenter, ui.gap15, ui.textXs], {
              color: "rgba(200,164,74,0.8)"
            }]}>
                <Label>📸</Label>
                <Label>@{user.instagram}</Label>
                <Label style={[[ui.opacity60]]}>↗</Label>
                {isOwn && <Label style={[[ui.textWhite20, ui.text9px, ui.ml1]]}>
                    🔒
                  </Label>}
              </Touch>
            </Box>
          </Box>

          {/* Bio */}
          <Box style={[[ui.mt4]]}>
            {isOwn ? <Box style={[[ui.textSm, ui.textWhite55, ui.leadingRelaxed]]}>
                <InlineEditField value={user.bio} onSave={v => update("bio", v)} multiline />
              </Box> : <Label style={[[ui.textSm, ui.textWhite55, ui.leadingRelaxed]]}>
                {user.bio}
              </Label>}
          </Box>
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
                color: "#c8a44a"
              }]}>
                  {user.score.toFixed(1)}
                </Label>
              </Box>
              <Box style={[[ui.flex, ui.gap1]]}>
                {[1, 2, 3, 4, 5].map(i => <Label key={i} style={[[ui.textXl, i <= Math.round(user.score) ? [ui.opacity100] : [ui.opacity15]], {
                color: "#c8a44a"
              }]}>
                    ★
                  </Label>)}
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

        {/* References (own only) */}
        {isOwn && <Box style={[[ui.px5, ui.mb4]]}>
            <GlassCard style={[[ui.overflowHidden]]}>
              <Touch onPress={() => setShowReferences(!showReferences)} style={[[ui.wFull, ui.flex, ui.itemsCenter, ui.justifyBetween, ui.p4]]}>
                <Box style={[[ui.flex, ui.itemsCenter, ui.gap3]]}>
                  <Box style={[[ui.w9, ui.h9, ui.roundedXl, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.textSm], {
                backgroundColor: "rgba(124,112,240,0.12)",
                borderWidth: 1,
                borderColor: "rgba(124,112,240,0.2)"
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

              {showReferences && <Box style={[[ui.px4, ui.pb4, ui.spaceY3, ui.borderT, ui.borderWhite6]]} enter>
                  <Box>
                    <Label style={[[ui.textXs, ui.textWhite30, ui.mt3, ui.mb2]]}>
                      Referans olduğum kişiler
                    </Label>
                    <Box style={[[ui.spaceY2]]}>
                      {USERS.slice(0, 2).map(u => <Box key={u.id} style={[[ui.flex, ui.itemsCenter, ui.gap25]]}>
                          <Avatar uri={u.avatar} name={u.name} size="xs" />
                          <Label style={[[ui.textSm, ui.textWhite60]]}>
                            {u.name}
                          </Label>
                          <Label style={[[ui.mlAuto, ui.text10px, ui.textEmerald400, ui.px2, ui.py05, ui.roundedFull], {
                    backgroundColor: "rgba(52,211,153,0.10)"
                  }]}>
                            Onaylandı
                          </Label>
                        </Box>)}
                    </Box>
                  </Box>
                  <Box>
                    <Label style={[[ui.textXs, ui.textWhite30, ui.mb2]]}>
                      Bana referans olan kişiler
                    </Label>
                    <Box style={[[ui.flex, ui.itemsCenter, ui.gap25]]}>
                      <Avatar uri={USERS[2].avatar} name={USERS[2].name} size="xs" />
                      <Label style={[[ui.textSm, ui.textWhite60]]}>
                        {USERS[2].name}
                      </Label>
                      <Label style={[[ui.mlAuto, ui.text10px, ui.textEmerald400, ui.px2, ui.py05, ui.roundedFull], {
                  backgroundColor: "rgba(52,211,153,0.10)"
                }]}>
                        Onaylandı
                      </Label>
                    </Box>
                  </Box>
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
                      {event.host.id === "me" ? "Organizatör" : "Katılımcı"}
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
            <ComingSoonCard accent="gold" icon={<Vector width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(200,164,74,0.9)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
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

      <BottomNav active="profile" navigate={navigate} />
    </Box>;
}
