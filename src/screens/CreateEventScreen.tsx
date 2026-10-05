import { palette } from "../theme/palette";
import { CategoryIcon, ClockIcon, LocationIcon, UsersIcon, StarIcon } from "../components/Icons";
import { Alert, Platform } from "react-native";
import * as Location from "expo-location";
import { createEvent, getMapInterests, getEnums, getApiErrorMessage } from "../api/client";
import { mapApiEvent } from "../native/Store";
import { useEffect, useState } from "react";
import { AtmoBackground, GlassCard, GlassInput, GlassTextarea } from "../components/GlassUI";
import { CameraIcon, GlobeIcon, ImageIcon, LockIcon, SearchIcon, UserPlusIcon } from "../components/Icons";
import { selectPhoto } from "../native/media";
import { useStore } from "../native/Store";
import { Box, Field, Label, Picture, Scroll, Touch } from "../native/UI";
import { ui } from "../theme/styles";
import { NavigateFn } from "../types";
import TopNavBar from "../components/TopNavBar";
import BottomNav from "../components/BottomNav";
// Keeps the sticky CTA above the bottom navigation bar.
const NAV_CLEARANCE = 74;
function StickyBar({
  children
}: {
  children: React.ReactNode;
}) {
  return <Box style={[[ui.fixed, ui.left0, ui.right0, ui.px5, ui.pt4, ui.z40], { bottom: NAV_CLEARANCE, paddingBottom: 8 }]} gradient={[palette.background, "transparent"]} gradientDirection="up">
      {children}
    </Box>;
}
function PrimaryButton({
  onPress,
  disabled,
  children
}: {
  onPress?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return <Touch onPress={onPress} disabled={disabled} disabledOpacity={1} style={[[ui.wFull, ui.py4, ui.rounded2xl, ui.fontSemibold, ui.textBase, ui.trackingWide], {
    color: disabled ? "rgba(226,232,240,.62)" : palette.text,
    borderWidth: 1,
    borderColor: disabled ? "rgba(148,163,184,.22)" : "rgba(183,197,255,.24)",
  }]} gradient={disabled ? ["#202b3d", "#182235", "#151f30"] : palette.actionGradient}>
      {children}
    </Touch>;
}
interface Props {
  navigate: NavigateFn;
}
const DURATIONS = ["30 dk", "1 saat", "1.5 saat", "2 saat", "3+ saat"];
const PRIVACY_ICONS = [GlobeIcon, LockIcon, UserPlusIcon];
const REQUIREMENTS_SUGGESTIONS: {
  [key: string]: string[];
} = {
  Padel: ["Raketini yanında getir.", "Raket tesisten kiralanabilir.", "Sadece spor ayakkabını alıp gel."],
  Tenis: ["Raket gerekli.", "Tenis ayakkabısı zorunlu.", "Top temin edeceğim."],
  Koşu: ["Koşu ayakkabısı gerekli.", "Su şişesi getir."],
  Kahve: ["Merak yeter!", "Ödeme kişiye ayrı."],
  Hiking: ["Trek ayakkabısı gerekli.", "Minimum 1L su getir.", "Atıştırmalık al."],
  default: ["Rahat kıyafet yeterli."]
};
export default function CreateEventScreen({
  navigate
}: Props) {
  const {
    data: store,
    setData: setStore
  } = useStore();
  const [activities, setActivities] = useState<Array<{ id: string; name: string }>>([]);
  const [levels, setLevels] = useState<Array<{ id: string; name: string }>>([]);
  const [visibilities, setVisibilities] = useState<Array<{ id: string; name: string; enum: string }>>([]);
  const [creating, setCreating] = useState(false);
  const [places, setPlaces] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [coordinate, setCoordinate] = useState<{ latitude: number; longitude: number } | null>(null);
  const [findingPlace, setFindingPlace] = useState(false);
  const loadCatalog = () => Promise.all([getMapInterests(), getEnums('event_level'), getEnums('event_visibility')]).then(([a, l, v]) => { setActivities(a); setLevels(l); setVisibilities(v); }).catch(error => Alert.alert('Seçenekler yüklenemedi', getApiErrorMessage(error)));
  useEffect(() => { void loadCatalog(); }, []);
  const ACTIVITIES = activities.map(a => ({ label: a.name, icon: '✨' }));
  const LEVELS = levels.map(l => l.name);
  const PRIVACIES = visibilities.map(v => ({ label: v.name, desc: '' }));
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    coverImage: "",
    activity: "",
    level: "",
    date: "",
    time: "",
    duration: "",
    location: "",
    minParticipants: 4,
    maxParticipants: 8,
    description: "",
    requirements: [] as string[],
    privacy: ""
  });
  const findPlace = async () => {
    if (findingPlace || !data.location.trim()) return;
    setFindingPlace(true);
    try {
      if (Platform.OS === 'android' && !(await Location.requestForegroundPermissionsAsync()).granted) throw new Error('Konum izni gerekli.');
      const results = await Location.geocodeAsync(data.location);
      setPlaces(results); setCoordinate(null);
      if (!results.length) Alert.alert('Konum bulunamadı', 'Şehir ve açık adresle tekrar ara.');
    } catch { Alert.alert('Konum aranamadı', 'Konum iznini ve bağlantını kontrol et.'); }
    finally { setFindingPlace(false); }
  };
  const publish = async () => {
    if (creating) return;
    const interest = activities.find(i => i.name === data.activity), level = levels.find(i => i.name === data.level), visibility = visibilities.find(i => i.name === data.privacy);
    if (!interest || !level || !visibility || !coordinate) { Alert.alert('Eksik bilgi', 'Etkinlik türünü, seviyeyi, konumu ve görünürlüğü seç.'); return; }
    if (data.description.trim().length < 10) { Alert.alert('Açıklama gerekli', 'Etkinliği en az 10 karakterle açıkla.'); return; }
    setCreating(true);
    try {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date.split('-').reverse().join('/') : data.date;
      const durations: Record<string, number> = { '30 dk': 30, '1 saat': 60, '1.5 saat': 90, '2 saat': 120, '3+ saat': 180 };
      const event = await createEvent({ interestId: interest.id, levelId: level.id, visibilityId: visibility.id, date, startTime: data.time, durationMinutes: durations[data.duration], ...coordinate, locationName: data.location.trim(), minParticipants: data.minParticipants, maxParticipants: data.maxParticipants, description: data.description.trim(), requirements: data.requirements.join('\n'), ...(data.coverImage ? { coverPhoto: data.coverImage } : {}) });
      setStore(p => ({ ...p, events: [mapApiEvent(event), ...p.events.filter(e => e.id !== event.id)] }));
      navigate('event-detail', { eventId: event.id });
    } catch (error) { Alert.alert('Etkinlik oluşturulamadı', getApiErrorMessage(error)); }
    finally { setCreating(false); }
  };
  const next = () => setStep(s => s + 1);
  const back = () => {
    if (step > 0) setStep(s => s - 1);else navigate("discover");
  };
  const selectAndNext = (key: string, value: string) => {
    setData(prev => ({
      ...prev,
      [key]: value
    }));
    setTimeout(next, 180);
  };
  const progressPct = step / 9 * 100;
  const hasStickyBar = step === 2 || step === 4 || step === 5 || step === 6 || step === 7;
  // Re-entering create-event from its own tab would reset the unfinished draft.
  const navigateAway: NavigateFn = (screen, opts) => { if (screen !== "create-event") navigate(screen, opts); };
  const suggestions = REQUIREMENTS_SUGGESTIONS[data.activity] || REQUIREMENTS_SUGGESTIONS.default;
  if (step === 9) {
    // Preview
    return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e]]}>
      <TopNavBar navigate={navigate} fallback="discover" onBack={back} title="Etkinlik Önizlemesi" />
      <Scroll style={[[ui.flex1, ui.pb28], { paddingTop: 80 }]}>
        <AtmoBackground variant="gold" />
        <Box style={[[ui.relative, ui.pt4, ui.px5]]}>
          <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite, ui.mb6]]}>
            Önizleme
          </Label>

          <GlassCard style={[[ui.overflowHidden, ui.mb4]]}>
            <Box style={[[ui.h48, ui.relative], {}]} gradient={["rgba(105,120,255,0.2)", "rgba(146,125,255,0.15)"]}>
              <Box style={[[ui.fixed, ui.inset0, ui.flex, ui.itemsCenter, ui.justifyCenter]]}>
                {data.coverImage ? <Picture uri={data.coverImage} style={{ width: "100%", height: "100%" }} /> : <CategoryIcon name={data.activity} size={64} style={{ color: palette.accent, opacity: .5 }} />}
              </Box>
              <Box style={[[ui.fixed, ui.bottom3, ui.left4]]}>
                <Label style={[[ui.textXs, ui.textWhite60]]}>
                  {data.activity}
                </Label>
              </Box>
            </Box>
            <Box style={[[ui.p4, ui.spaceY3]]}>
              <Label style={[[ui.fontDisplay, ui.textXl, ui.fontLight, ui.textWhite]]}>
                {data.activity || "Etkinlik Adı"}
              </Label>
              <Box style={[[ui.grid, ui.gap2, ui.textXs, ui.textWhite50]]} columns={2}>
                {[{ icon: <ClockIcon size={16} />, text: `${data.date || "Tarih"} · ${data.time || "Saat"}` },
                  { icon: <ClockIcon size={16} />, text: data.duration || "Süre" },
                  { icon: <LocationIcon size={16} />, text: data.location || "Konum" },
                  { icon: <StarIcon size={16} />, text: data.level || "Seviye" },
                  { icon: <UsersIcon size={16} />, text: `${data.minParticipants}-${data.maxParticipants} kişi` },
                  { icon: <LockIcon size={16} />, text: data.privacy || "Gizlilik" }
                ].map((item, index) => <Box key={index} style={[[ui.flex, ui.itemsCenter, ui.gap2]]}>{item.icon}<Label style={{ flexShrink: 1 }}>{item.text}</Label></Box>)}
              </Box>
              {data.description && <Label style={[[ui.textSm, ui.textWhite55]]}>
                  {data.description}
                </Label>}
            </Box>
          </GlassCard>

          <Touch onPress={publish} disabled={creating} style={[[ui.wFull, ui.py4, ui.rounded2xl, ui.fontSemibold, ui.textBase, ui.mb4], {
          color: palette.text
        }]} gradient={["#4d5bcb", "#6651c9"]}>
            Etkinliği Oluştur
          </Touch>
        </Box>
      </Scroll>
      <BottomNav active="create-event" navigate={navigateAway} />
    </Box>;
  }
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.flex, ui.flexCol, ui.overflowHidden]]}>
      <AtmoBackground />
      <TopNavBar navigate={navigate} fallback="discover" onBack={back} title="Etkinlik Oluştur" subtitle={`${step + 1}/10`} />

      {/* Progress bar */}
      <Box style={[[ui.fixed, ui.top0, ui.left0, ui.right0, ui.h05, ui.bgWhite8]]}>
        <Box style={[[ui.hFull], {
        width: `${progressPct}%`
      }]} gradient={["#4d5bcb", "#6651c9"]} gradientDirection="right" />
      </Box>

      <Scroll style={[[ui.relative, ui.flex, ui.flexCol, ui.hFull, ui.pb28], { paddingTop: 80 }, hasStickyBar && { paddingBottom: 176 }]}>
        <Box style={[[ui.pt4, ui.px5]]}>

          {/* Step 0 - Activity */}
          {step === 0 && <Box style={[[]]} enter>
              <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite, ui.mb2]]}>
                Ne yapmak{"\n"}istiyorsun?
              </Label>
              <Label style={[[ui.textSm, ui.textWhite40, ui.mb6]]}>
                Seninle birlikte ne yapacağımızı anlat.
              </Label>
              <Box style={[[ui.grid, ui.gap3]]} columns={2}>
                {!activities.length && <Touch onPress={loadCatalog}>Seçenekleri yeniden yükle</Touch>}
              {ACTIVITIES.map(a => <Touch key={a.label} onPress={() => selectAndNext("activity", a.label)} style={[[ui.p4, ui.rounded2xl, ui.textLeft, ui.border, data.activity === a.label ? [ui.borderC8a44a50, ui.bgC8a44a10] : [ui.borderWhite8, ui.bgWhite004]]]}>
                    <CategoryIcon name={a.label} size={28} style={{ color: palette.accent, marginBottom: 12 }} />
                    <Label style={[[ui.textSm, ui.textWhite75, ui.fontMedium]]}>
                      {a.label}
                    </Label>
                  </Touch>)}
              </Box>
            </Box>}

          {/* Step 1 - Level */}
          {step === 1 && <Box style={[[]]} enter>
              <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite, ui.mb2]]}>
                Hangi seviyede{"\n"}oynamak istersin?
              </Label>
              <Label style={[[ui.textSm, ui.textWhite40, ui.mb6]]}>
                Sana uygun kişileri bulalım.
              </Label>
              <Box style={[[ui.spaceY3]]}>
                {LEVELS.map(level => <Touch key={level} onPress={() => selectAndNext("level", level)} style={[[ui.wFull, ui.p4, ui.rounded2xl, ui.textLeft, ui.flex, ui.itemsCenter, ui.justifyBetween, ui.border, data.level === level ? [ui.borderC8a44a50, ui.bgC8a44a10] : [ui.borderWhite8, ui.bgWhite004]]]}>
                    <Label style={[[ui.textBase, ui.textWhite80, ui.fontMedium]]}>
                      {level}
                    </Label>
                    {data.level === level && <Label style={[[ui.textC8a44a]]}>✓</Label>}
                  </Touch>)}
              </Box>
            </Box>}

          {/* Step 2 - Date & Time */}
          {step === 2 && <Box style={[[ui.spaceY5]]} enter>
              <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite, ui.mb2]]}>
                Ne zaman{"\n"}buluşuyorsunuz?
              </Label>
              <GlassInput label="Tarih" value={data.date} onChangeText={e => setData(p => ({
            ...p,
            date: e
          }))} mode="date" />
              <GlassInput label="Saat" value={data.time} onChangeText={e => setData(p => ({
            ...p,
            time: e
          }))} mode="time" />
              <Box style={[[ui.h4]]} />
            </Box>}

          {/* Step 3 - Duration */}
          {step === 3 && <Box style={[[]]} enter>
              <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite, ui.mb2]]}>
                Ne kadar{"\n"}vaktiniz var?
              </Label>
              <Label style={[[ui.textSm, ui.textWhite40, ui.mb6]]}>
                Tahminen ne kadar sürer?
              </Label>
              <Box style={[[ui.grid, ui.gap3]]} columns={3}>
                {DURATIONS.map(d => <Touch key={d} onPress={() => selectAndNext("duration", d)} style={[[ui.p4, ui.rounded2xl, ui.textCenter, ui.border, data.duration === d ? [ui.borderC8a44a50, ui.bgC8a44a10, ui.textC8a44a] : [ui.borderWhite8, ui.bgWhite004, ui.textWhite70]]]}>
                    <Label style={[[ui.textSm, ui.fontMedium]]}>{d}</Label>
                  </Touch>)}
              </Box>
            </Box>}

          {/* Step 4 - Location */}
          {step === 4 && <Box style={[[ui.spaceY5]]} enter>
              <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite, ui.mb2]]}>
                Nerede{"\n"}buluşacaksınız?
              </Label>
              <Box style={[[ui.relative]]}>
                <SearchIcon size={15} strokeWidth={1.75} style={[[ui.fixed, ui.left35, ui.top12, ui.TranslateY12, ui.textWhite25, ui.z10]]} />
                <Field placeholder="Adres veya mekan adı..." value={data.location} onChangeText={e => { setCoordinate(null); setPlaces([]); setData(p => ({ ...p, location: e })); }} style={[[ui.glass, ui.wFull, ui.roundedXl, ui.pl9, ui.pr4, ui.py35, ui.textWhite, ui.textSm]]} glass />
              </Box>

              <Box style={[[ui.h4]]} />
              <Touch onPress={findPlace} disabled={findingPlace}><Label>{findingPlace ? 'Konum aranıyor…' : 'Adresi bul'}</Label></Touch>
              {places.map((place, index) => <Touch key={index} onPress={() => setCoordinate(place)} style={{ padding: 12, backgroundColor: '#11162a', borderRadius: 12 }}><Label>{coordinate === place ? '✓ ' : ''}{data.location} · {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}</Label></Touch>)}
            </Box>}

          {/* Step 5 - Participants */}
          {step === 5 && <Box style={[[ui.spaceY6]]} enter>
              <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite, ui.mb2]]}>
                Kaç kişilik{"\n"}bir buluşma?
              </Label>
              <Label style={[[ui.textSm, ui.textWhite40]]}>
                Minimum dolunca etkinliğin hayata geçer.
              </Label>

              {[{
            label: "Minimum",
            key: "minParticipants",
            value: data.minParticipants
          }, {
            label: "Maksimum",
            key: "maxParticipants",
            value: data.maxParticipants
          }].map(({
            label,
            key,
            value
          }) => <Box key={key} style={[[ui.glass, ui.rounded2xl, ui.p5]]} glass>
                  <Box style={[[ui.flex, ui.itemsCenter, ui.justifyBetween, ui.mb3]]}>
                    <Label style={[[ui.textSm, ui.textWhite60]]}>{label}</Label>
                    <Label style={[[ui.fontDisplay, ui.text2xl, ui.fontLight, ui.textWhite]]}>
                      {value} kişi
                    </Label>
                  </Box>
                  <Box style={[[ui.flex, ui.itemsCenter, ui.gap3]]}>
                    <Touch onPress={() => setData(p => ({
                ...p,
                [key]: key === "minParticipants" ? Math.max(2, p.minParticipants - 1) : Math.max(p.minParticipants, p.maxParticipants - 1)
              }))} style={[[ui.w10, ui.h10, ui.roundedXl, ui.glassStrong, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.textWhite70, ui.textXl, ui.fontLight]]} glass>
                      −
                    </Touch>
                    <Box style={[[ui.flex1, ui.h15, ui.roundedFull, ui.bgWhite10, ui.overflowHidden]]}>
                      <Box style={[[ui.hFull, ui.bgC8a44a, ui.roundedFull], {
                  width: `${value / 50 * 100}%`
                }]} />
                    </Box>
                    <Touch onPress={() => setData(p => ({
                ...p,
                [key]: key === "minParticipants" ? Math.min(p.maxParticipants, p.minParticipants + 1) : Math.min(50, p.maxParticipants + 1)
              }))} style={[[ui.w10, ui.h10, ui.roundedXl, ui.glassStrong, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.textWhite70, ui.textXl, ui.fontLight]]} glass>
                      +
                    </Touch>
                  </Box>
                </Box>)}

              <Box style={[[ui.h4]]} />
            </Box>}

          {/* Step 6 - Cover */}
          {step === 6 && <Box style={[[ui.spaceY5]]} enter>
              <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite, ui.mb2]]}>
                Etkinliğine{"\n"}bir yüz ver.
              </Label>
              <Label style={[[ui.textSm, ui.textWhite40]]}>
                İstersen atla, sana uygun bir görsel seçeriz.
              </Label>

              <Touch style={[[ui.h52, ui.rounded2xl, ui.flex, ui.flexCol, ui.itemsCenter, ui.justifyCenter, ui.gap3], {
            backgroundColor: "rgba(255,255,255,0.04)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)"
          }]} onPress={async () => {
            const uri = await selectPhoto();
            if (uri) setData(p => ({
              ...p,
              coverImage: uri
            }));
          }}>
                {data.coverImage && <Picture uri={data.coverImage} style={{
              width: "100%",
              height: 130,
              borderRadius: 16
            }} />}
                <CameraIcon size={28} strokeWidth={1.75} style={[[ui.textWhite20]]} />
                <Label style={[[ui.textSm, ui.textWhite35]]}>
                  Fotoğraf yükle
                </Label>
              </Touch>



              <Box style={[[ui.h4]]} />
            </Box>}

          {/* Step 7 - Requirements */}
          {step === 7 && <Box style={[[ui.spaceY5]]} enter>
              <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite, ui.mb2]]}>
                Katılımcılara{"\n"}ne söylemek istersin?
              </Label>
              <Label style={[[ui.textSm, ui.textWhite40]]}>
                Gereksinim varsa yaz, yoksa geçebilirsin.
              </Label>

              <GlassTextarea placeholder="Katılımcılara ne söylemek istersin?" value={data.description} onChangeText={e => setData(p => ({
            ...p,
            description: e
          }))} />

              <Box>
                <Label style={[[ui.textXs, ui.textWhite35, ui.mb2, ui.uppercase, ui.trackingWider]]}>
                  Hızlı ekle
                </Label>
                <Box style={[[ui.flex, ui.flexWrap, ui.gap2]]}>
                  {suggestions.map(s => <Touch key={s} onPress={() => {
                if (!data.requirements.includes(s)) {
                  setData(p => ({
                    ...p,
                    requirements: [...p.requirements, s]
                  }));
                }
              }} style={[[ui.px3, ui.py15, ui.roundedXl, ui.textXs, ui.border, data.requirements.includes(s) ? [ui.borderC8a44a50, ui.bgC8a44a10, ui.textC8a44a] : [ui.borderWhite10, ui.bgWhite004, ui.textWhite55]]]}>
                      {s}
                    </Touch>)}
                </Box>
              </Box>

              <Box style={[[ui.h4]]} />
            </Box>}

          {/* Step 8 - Privacy */}
          {step === 8 && <Box style={[[]]} enter>
              <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite, ui.mb2]]}>
                Bu etkinlik{"\n"}kime açık?
              </Label>
              <Label style={[[ui.textSm, ui.textWhite40, ui.mb6]]}>
                Kapıyı ne kadar aralık bırakmak istersin?
              </Label>
              <Box style={[[ui.spaceY3]]}>
                {PRIVACIES.map((p, i) => {
              const Icon = PRIVACY_ICONS[i % PRIVACY_ICONS.length];
              return <Touch key={p.label} onPress={() => selectAndNext("privacy", p.label)} style={[[ui.wFull, ui.p4, ui.rounded2xl, ui.textLeft, ui.flex, ui.itemsCenter, ui.gap4, ui.border, data.privacy === p.label ? [ui.borderC8a44a50, ui.bgC8a44a10] : [ui.borderWhite8, ui.bgWhite004]]]}>
                      <Box style={[[ui.w10, ui.h10, ui.roundedXl, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.flexShrink0, data.privacy === p.label ? [ui.textC8a44a] : [ui.textWhite35]], {
                  backgroundColor: data.privacy === p.label ? "rgba(105,120,255,0.10)" : "rgba(255,255,255,0.05)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.07)"
                }]}>
                        <Icon size={18} strokeWidth={1.75} />
                      </Box>
                      <Box>
                        <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite85]]}>
                          {p.label}
                        </Label>
                        <Label style={[[ui.textXs, ui.textWhite40]]}>
                          {p.desc}
                        </Label>
                      </Box>
                    </Touch>;
            })}
              </Box>
            </Box>}
        </Box>
      </Scroll>

      {/* Sticky CTA for steps that need explicit continue */}
      {hasStickyBar && <StickyBar>
          <PrimaryButton onPress={next} disabled={step === 2 && (!data.date || !data.time) || step === 4 && !coordinate}>
            Devam Et
          </PrimaryButton>
        </StickyBar>}
      <BottomNav active="create-event" navigate={navigateAway} />
    </Box>;
}
