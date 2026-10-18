import { palette } from "../theme/palette";
import { CloseIcon } from "../components/Icons";
import TopNavBar from "../components/TopNavBar";
import SignOutButton from "../components/SignOutButton";
import { gatedScreen } from "../native/access";
import { useEffect, useState } from "react";
import { AtmoBackground, InterestChip } from "../components/GlassUI";
import { CameraIcon, ImageIcon } from "../components/Icons";
import { Alert } from "react-native";
import { completeProfile, getMapInterests, setUserInterests, setProfilePhoto, getApiErrorMessage } from "../api/client";
import { selectPhoto } from "../native/media";
import { updateStoreUser, useStore } from "../native/Store";
import { Box, Label, Picture, Scroll, Touch } from "../native/UI";
import { ui } from "../theme/styles";
import { NavigateFn } from "../types";
interface Props {
  navigate: NavigateFn;
}
/** The application needs at least three interests (the server checks it too). */
const MIN_INTERESTS = 3;
export default function InterestsScreen({
  navigate
}: Props) {
  const {
    data: store,
    setData: setStore,
    refreshEvents
  } = useStore();
  const [catalog, setCatalog] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => { getMapInterests().then(setCatalog).catch(error => Alert.alert('İlgi alanları yüklenemedi', getApiErrorMessage(error))); }, []);
  const INTERESTS = catalog.map(i => i.name);
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const interests = await setUserInterests(catalog.filter(i => selected.has(i.name)).map(i => i.id));
      if ((photo || '') !== store.user.avatar) await setProfilePhoto(photo || '');
      setStore(p => ({ ...p, user: { ...p.user, interests: interests.map(i => i.name), avatar: photo || '' } }));
      // Completing the profile (at least one interest) approves an account whose reference is approved;
      // one still waiting for its reference goes to the waiting page until it is.
      if (store.user.status === 'profile_incomplete') {
        const me = await completeProfile();
        setStore(p => ({ ...p, user: updateStoreUser(p.user, me) }));
        if (me.status?.enum !== 'approved') { navigate('onboarding-3', { reset: true }); return; }
        void refreshEvents().catch(() => {});
      } else if (gatedScreen(store.user.status)) { navigate('onboarding-3', { reset: true }); return; }
      navigate('discover', { reset: true });
    } catch (error) { Alert.alert('Profil kaydedilemedi', getApiErrorMessage(error)); }
    finally { setSaving(false); }
  };
  const ME = store.user;
  const [selected, setSelected] = useState<Set<string>>(new Set(ME.interests));
  const [photo, setPhoto] = useState<string | null>(ME.avatar);
  // The account may finish loading after this screen opens (e.g. a saved session); show its photo then.
  useEffect(() => { if (ME.avatar) setPhoto(current => current || ME.avatar); }, [ME.avatar]);
  const toggle = (interest: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(interest)) next.delete(interest);else next.add(interest);
      return next;
    });
  };
  const pickPhoto = async (camera = false) => {
    const uri = await selectPhoto(camera);
    if (uri) setPhoto(uri);
  };
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.flex, ui.flexCol, ui.overflowHidden]]}>
      <AtmoBackground variant="violet" />
      <TopNavBar navigate={navigate} fallback={gatedScreen(store.user.status) ? "onboarding-2" : "discover"} onBack={gatedScreen(store.user.status) ? () => navigate("onboarding-2", { back: true }) : () => navigate("discover", { back: true })} title="Profilini Tamamla" right={gatedScreen(store.user.status) ? <SignOutButton navigate={navigate} /> : undefined} />

      <Box style={[[ui.relative, ui.flex, ui.flexCol, ui.hFull]]}>
        {/* Header */}
        <Box style={[[ui.px6, ui.pb5, ui.flexShrink0], { paddingTop: 84 }]} enter>
          <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite]]}>
            Neler seni{"\n"}heyecanlandırır?
          </Label>
          <Label style={[[ui.textSm, ui.textWhite45, ui.mt2]]}>
            Sana en uygun etkinlikleri bulmak için en az {MIN_INTERESTS} ilgi alanı seç. Profil fotoğrafı isteğe bağlı.
          </Label>
        </Box>

        {/* Profile photo section */}
        <Box walkthroughId="interests-photo" style={[[ui.px6, ui.pb5, ui.flexShrink0]]} enter>
          <Box style={[[ui.rounded2xl, ui.p4, ui.flex, ui.itemsCenter, ui.gap4], {
          backgroundColor: "rgba(255,255,255,0.05)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.08)"
        }]}>
            {/* Avatar */}
            <Box style={[[ui.relative, ui.flexShrink0]]}>
              <Box style={[[ui.w16, ui.h16, ui.rounded2xl, ui.overflowHidden, ui.flex, ui.itemsCenter, ui.justifyCenter], {
              backgroundColor: photo ? "transparent" : "rgba(255,255,255,0.06)",
              borderWidth: 1,
              borderColor: photo ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.15)"
            }]}>
                {photo ? <Picture uri={photo} accessibilityLabel="Profil" style={[[ui.wFull, ui.hFull]]} /> : <CameraIcon size={22} style={[[ui.textWhite20]]} />}
              </Box>
              {/* A drawn × (not the text glyph) stays centred in its circle at every font size. */}
              {photo && <Touch accessibilityLabel="Profil fotoğrafını kaldır" hitSlop={10} onPress={() => setPhoto(null)} style={[[ui.fixed, ui.Top15, ui.Right15, ui.roundedFull, ui.bg06060e, ui.border, ui.borderWhite15, ui.flex, ui.itemsCenter, ui.justifyCenter], { width: 24, height: 24, minHeight: 24 }]}>
                  <CloseIcon size={12} strokeWidth={2.2} style={{ color: "rgba(244,245,255,.85)" }} />
                </Touch>}
            </Box>

            {/* Text + actions, vertically centred with the photo */}
            <Box style={[[ui.flex1, ui.minW0], { justifyContent: "center" }]}>
              <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite75]]}>
                {photo ? "Profil fotoğrafın eklendi" : "Profil fotoğrafı ekle"}
              </Label>
              <Label style={[[ui.textXs, ui.textWhite35, ui.mt05]]}>
                İsteğe bağlı, istersen atla
              </Label>

              {!photo && <Box style={[[ui.flex, ui.gap2, ui.mt25]]}>
                  <Touch onPress={() => pickPhoto(false)} style={[[ui.flex, ui.itemsCenter, ui.gap15, ui.px3, ui.py15, ui.roundedLg, ui.textXs, ui.fontMedium], {
                backgroundColor: "rgba(105,120,255,0.12)",
                borderWidth: 1,
                borderColor: "rgba(105,120,255,0.2)",
                color: palette.accent
              }]}>
                    <ImageIcon size={12} />
                    Galeriden
                  </Touch>
                  <Touch onPress={() => pickPhoto(true)} style={[[ui.flex, ui.itemsCenter, ui.gap15, ui.px3, ui.py15, ui.roundedLg, ui.textXs, ui.fontMedium], {
                backgroundColor: "rgba(255,255,255,0.06)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.09)",
                color: "rgba(240,237,232,0.5)"
              }]}>
                    <CameraIcon size={12} />
                    Çek
                  </Touch>
                </Box>}

              {/* Left-aligned with the texts above; Touch otherwise centres its label and adds 44px height. */}
              {photo && <Touch accessibilityLabel="Fotoğrafı değiştir" onPress={() => pickPhoto()} style={[[ui.mt2, ui.textXs, ui.textWhite35, ui.underline], { alignSelf: "flex-start", alignItems: "flex-start", minHeight: 0, textAlign: "left" }]}>
                  Değiştir
                </Touch>}
            </Box>
          </Box>
        </Box>

        {/* Divider */}
        <Box walkthroughId="interests-categories" style={[[ui.mx6, ui.mb4, ui.flex, ui.itemsCenter, ui.gap3, ui.flexShrink0]]}>
          <Box style={[[ui.flex1, ui.hPx], {
          backgroundColor: "rgba(255,255,255,0.07)"
        }]} />
          <Label style={[[ui.textXs, ui.textWhite25]]}>
            {selected.size < MIN_INTERESTS ? `${selected.size}/${MIN_INTERESTS} seçildi · en az ${MIN_INTERESTS}` : `${selected.size} seçildi`}
          </Label>
          <Box style={[[ui.flex1, ui.hPx], {
          backgroundColor: "rgba(255,255,255,0.07)"
        }]} />
        </Box>

        {/* Interest grid */}
        <Scroll style={[[ui.flex1, ui.px6, ui.pb4]]}>
          <Box style={[[ui.flex, ui.flexWrap, ui.gap25]]} enter>
            {INTERESTS.map(interest => <InterestChip key={interest} label={interest} selected={selected.has(interest)} onPress={() => toggle(interest)} />)}
          </Box>
        </Scroll>

        {/* Sticky CTA */}
        <Box style={[[ui.flexShrink0, ui.px6, ui.pb10, ui.pt4], {}]} gradient={[palette.background, "transparent"]} gradientDirection="up">
          <Touch onPress={save} disabled={saving || selected.size < MIN_INTERESTS || !catalog.length} style={[[ui.wFull, ui.py4, ui.rounded2xl, ui.textBase, ui.fontSemibold, ui.trackingWide], {
          color: selected.size >= MIN_INTERESTS ? palette.text : "rgba(255,255,255,0.25)"
        }]} gradient={selected.size >= MIN_INTERESTS ? palette.actionGradient : ["rgba(255,255,255,0.08)", "rgba(255,255,255,0.08)"]}>
            Kurulumu Tamamla
          </Touch>
        </Box>
      </Box>
    </Box>;
}
