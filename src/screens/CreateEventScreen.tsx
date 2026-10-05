import { palette } from "../theme/palette";
import { CategoryIcon, ClockIcon, LocationIcon, UsersIcon, StarIcon } from "../components/Icons";
import { Alert, Platform } from "react-native";
import * as Location from "expo-location";
import { createEvent, dismissSuggestion, getActiveFriends, getUserSettings, type FriendUser, getMapInterests, getEnums, getApiErrorMessage, getSuggestions } from "../api/client";
import { mapApiEvent, UNLIMITED_PARTICIPANTS } from "../native/Store";
import { useEffect, useState } from "react";
import { Avatar, AtmoBackground, GlassCard, GlassInput, GlassTextarea } from "../components/GlassUI";
import { CameraIcon, CheckIcon, CloseIcon, GlobeIcon, ImageIcon, LockIcon, SearchIcon, UserPlusIcon } from "../components/Icons";
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
const pad2 = (value: number) => String(value).padStart(2, "0");
// New events start one hour from now; the date rolls over past midnight.
function defaultStart() {
  const start = new Date(Date.now() + 60 * 60 * 1000);
  return { date: `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`, time: `${pad2(start.getHours())}:${pad2(start.getMinutes())}` };
}
const hasLine = (text: string, line: string) => text.split("\n").some(item => item.trim() === line);
// Quick-add chips append their sentence to the textarea on its own line; tapping again removes it.
function toggleLine(text: string, line: string) {
  if (hasLine(text, line)) return text.split("\n").filter(item => item.trim() !== line).join("\n");
  return text.trimEnd() ? `${text.trimEnd()}\n${line}` : line;
}
function isPastStart(date: string, time: string) {
  const day = date.match(/^(\d{4})-(\d{2})-(\d{2})$/), clock = time.match(/^(\d{2}):(\d{2})$/);
  if (!day || !clock) return false;
  return new Date(+day[1], +day[2] - 1, +day[3], +clock[1], +clock[2]).getTime() <= Date.now();
}
const MIN_PARTICIPANTS = 2;
const MAX_PARTICIPANTS = 100;
const DURATIONS = [30, 60, 90, 120, 180];
const MAX_DURATION_MINUTES = 1440;
function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return [hours && `${hours} saat`, rest && `${rest} dk`].filter(Boolean).join(" ");
}
// Shows the stored YYYY-MM-DD date as dd/MM/yyyy.
const displayDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split("-").reverse().join("/") : date;
const INVITE_ONLY = "invite_only";
// "Önerilenler" is not offered to users; the remaining options get their own icon and copy.
const PRIVACY_OPTIONS: Record<string, { icon: typeof GlobeIcon; desc: string }> = {
  public: { icon: GlobeIcon, desc: "Herkes görebilir ve katılabilir." },
  [INVITE_ONLY]: { icon: UserPlusIcon, desc: "Yalnızca davet ettiğin arkadaşların görür." },
};
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
  // Personal suggestions are optional; the category defaults remain if they cannot load.
  const [personalSuggestions, setPersonalSuggestions] = useState<string[]>([]);
  useEffect(() => { void loadCatalog(); getSuggestions().then(result => setPersonalSuggestions(result.items)).catch(() => {}); }, []);
  const removeSuggestion = (text: string) => {
    const previous = personalSuggestions;
    setPersonalSuggestions(items => items.filter(item => item !== text));
    dismissSuggestion(text).then(result => setPersonalSuggestions(result.items)).catch(error => { setPersonalSuggestions(previous); Alert.alert('Öneri silinemedi', getApiErrorMessage(error)); });
  };
  const ACTIVITIES = activities.map(a => ({ label: a.name, icon: '✨' }));
  const LEVELS = levels.map(l => l.name);
  const PRIVACIES = visibilities.filter(v => PRIVACY_OPTIONS[v.enum]).map(v => ({ label: v.name, enum: v.enum, ...PRIVACY_OPTIONS[v.enum] }));
  const [canInvite, setCanInvite] = useState(false);
  const [friends, setFriends] = useState<FriendUser[] | null>(null);
  const [invitedIds, setInvitedIds] = useState<string[]>([]);
  useEffect(() => { getUserSettings().then(settings => setCanInvite(settings.canCreateInviteOnly)).catch(() => {}); }, []);
  const chooseInviteOnly = (label: string) => {
    setData(p => ({ ...p, privacy: label }));
    if (friends === null) getActiveFriends().then(result => setFriends(result.items.map(item => item.user))).catch(error => { setFriends([]); Alert.alert('Arkadaşlar yüklenemedi', getApiErrorMessage(error)); });
  };
  const toggleInvite = (id: string) => setInvitedIds(ids => ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id]);
  const [step, setStep] = useState(0);
  const [customDurationOpen, setCustomDurationOpen] = useState(false);
  const [customDuration, setCustomDuration] = useState({ hours: "", minutes: "" });
  const [data, setData] = useState(() => ({
    coverImage: "",
    activity: "",
    level: "",
    ...defaultStart(),
    durationMinutes: null as number | null,
    location: "",
    minParticipants: 2,
    maxParticipants: null as number | null,
    description: "",
    privacy: ""
  }));
  const findPlace = async () => {
    if (findingPlace || !data.location.trim()) return;
    setFindingPlace(true);
    try {
      if (Platform.OS === 'android' && !(await Location.requestForegroundPermissionsAsync()).granted) throw new Error('Konum izni gerekli.');
      const results = await Location.geocodeAsync(data.location);
      // Geocoding results also carry altitude/accuracy, which the API rejects as unknown fields.
      setPlaces(results.map(({ latitude, longitude }) => ({ latitude, longitude }))); setCoordinate(null);
      if (!results.length) Alert.alert('Konum bulunamadı', 'Şehir ve açık adresle tekrar ara.');
    } catch { Alert.alert('Konum aranamadı', 'Konum iznini ve bağlantını kontrol et.'); }
    finally { setFindingPlace(false); }
  };
  const publish = async () => {
    if (creating) return;
    const interest = activities.find(i => i.name === data.activity), level = levels.find(i => i.name === data.level), visibility = visibilities.find(i => i.name === data.privacy);
    const missing = [!interest && 'etkinlik türü', !level && 'seviye', !coordinate && 'konum', !visibility && 'görünürlük'].filter(Boolean);
    if (!interest || !level || !visibility || !coordinate) { Alert.alert('Eksik bilgi', `Şunları seç: ${missing.join(', ')}.`); return; }
    const inviteOnly = visibility.enum === INVITE_ONLY;
    if (inviteOnly && !invitedIds.length) { Alert.alert('Davet listesi boş', 'Davet etmek istediğin en az bir arkadaşını seç.'); setStep(8); return; }
    if (isPastStart(data.date, data.time)) { Alert.alert('Geçmiş tarih', 'Etkinlik zamanı geçmiş. Tarih ve saati ileri bir zamana güncelle.'); setStep(2); return; }
    if (data.description.trim().length < 10) { Alert.alert('Açıklama gerekli', 'Etkinliği en az 10 karakterle açıkla.'); return; }
    setCreating(true);
    try {
      const date = displayDate(data.date);
      const event = await createEvent({ interestId: interest.id, levelId: level.id, visibilityId: visibility.id, date, startTime: data.time, ...(data.durationMinutes ? { durationMinutes: data.durationMinutes } : {}), latitude: coordinate.latitude, longitude: coordinate.longitude, locationName: data.location.trim(), minParticipants: data.minParticipants, maxParticipants: data.maxParticipants ?? UNLIMITED_PARTICIPANTS, description: data.description.trim(), ...(inviteOnly ? { invitedUserIds: invitedIds } : {}), ...(data.coverImage ? { coverPhoto: data.coverImage } : {}) });
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
  const startsInPast = isPastStart(data.date, data.time);
  const customMinutes = (Number(customDuration.hours) || 0) * 60 + (Number(customDuration.minutes) || 0);
  const customDurationValid = customMinutes >= 1 && customMinutes <= MAX_DURATION_MINUTES;
  const isInviteOnly = visibilities.find(v => v.name === data.privacy)?.enum === INVITE_ONLY;
  const hasStickyBar = step === 8 && isInviteOnly || step === 3 && customDurationOpen || step === 2 || step === 4 || step === 5 || step === 6 || step === 7;
  // Re-entering create-event from its own tab would reset the unfinished draft.
  const navigateAway: NavigateFn = (screen, opts) => { if (screen !== "create-event") navigate(screen, opts); };
  const suggestions = personalSuggestions.length ? personalSuggestions : REQUIREMENTS_SUGGESTIONS[data.activity] || REQUIREMENTS_SUGGESTIONS.default;
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
                {[{ icon: <ClockIcon size={16} />, text: `${displayDate(data.date) || "Tarih"} · ${data.time || "Saat"}` },
                  { icon: <ClockIcon size={16} />, text: data.durationMinutes ? formatDuration(data.durationMinutes) : "Süre" },
                  { icon: <LocationIcon size={16} />, text: data.location || "Konum" },
                  { icon: <StarIcon size={16} />, text: data.level || "Seviye" },
                  { icon: <UsersIcon size={16} />, text: data.maxParticipants ? `${data.minParticipants}-${data.maxParticipants} kişi` : `En az ${data.minParticipants} kişi · sınırsız` },
                  { icon: <LockIcon size={16} />, text: data.privacy ? `${data.privacy}${invitedIds.length && isInviteOnly ? ` · ${invitedIds.length} davetli` : ""}` : "Gizlilik" }
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
              {startsInPast && <Label style={[[ui.textSm], { color: palette.error }]}>
                Geçmiş bir tarih veya saat seçemezsin.
              </Label>}
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
                {DURATIONS.map(minutes => <Touch key={minutes} onPress={() => { setCustomDurationOpen(false); setData(p => ({ ...p, durationMinutes: minutes })); setTimeout(next, 180); }} style={[[ui.p4, ui.rounded2xl, ui.textCenter, ui.border, !customDurationOpen && data.durationMinutes === minutes ? [ui.borderC8a44a50, ui.bgC8a44a10, ui.textC8a44a] : [ui.borderWhite8, ui.bgWhite004, ui.textWhite70]]]}>
                    <Label style={[[ui.textSm, ui.fontMedium]]}>{formatDuration(minutes)}</Label>
                  </Touch>)}
                <Touch onPress={() => setCustomDurationOpen(true)} style={[[ui.p4, ui.rounded2xl, ui.textCenter, ui.border, customDurationOpen || data.durationMinutes && !DURATIONS.includes(data.durationMinutes) ? [ui.borderC8a44a50, ui.bgC8a44a10, ui.textC8a44a] : [ui.borderWhite8, ui.bgWhite004, ui.textWhite70]]]}>
                    <Label style={[[ui.textSm, ui.fontMedium]]}>Özel süre</Label>
                  </Touch>
              </Box>
              {customDurationOpen && <Box style={[[ui.spaceY3], { marginTop: 24 }]}>
                  <Box style={[[ui.flex, ui.gap3]]}>
                    <GlassInput label="Saat" placeholder="0" keyboardType="number-pad" maxLength={2} value={customDuration.hours} onChangeText={hours => setCustomDuration(p => ({ ...p, hours: hours.replace(/\D/g, "") }))} />
                    <GlassInput label="Dakika" placeholder="0" keyboardType="number-pad" maxLength={2} value={customDuration.minutes} onChangeText={minutes => setCustomDuration(p => ({ ...p, minutes: minutes.replace(/\D/g, "") }))} />
                  </Box>
                  <Label style={[[ui.textXs], { color: customMinutes > MAX_DURATION_MINUTES ? palette.error : palette.muted }]}>
                    {customMinutes > MAX_DURATION_MINUTES ? "Süre en fazla 24 saat olabilir." : customDurationValid ? `Süre: ${formatDuration(customMinutes)}` : "Saat ve dakika gir."}
                  </Label>
                </Box>}
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
            value: data.minParticipants,
            display: `${data.minParticipants} kişi`,
            disabled: false,
            canDecrease: data.minParticipants > MIN_PARTICIPANTS,
            canIncrease: data.minParticipants < MAX_PARTICIPANTS - 1,
            change: (delta: number) => setData(p => {
              const min = Math.min(MAX_PARTICIPANTS - 1, Math.max(MIN_PARTICIPANTS, p.minParticipants + delta));
              // Max opens once min rises above 2 and must always stay above min.
              const max = min === MIN_PARTICIPANTS ? null : Math.max(min + 1, p.maxParticipants ?? 0);
              return { ...p, minParticipants: min, maxParticipants: max };
            })
          }, {
            label: "Maksimum",
            value: data.maxParticipants ?? 0,
            display: data.maxParticipants ? `${data.maxParticipants} kişi` : "Sınırsız",
            disabled: data.maxParticipants === null,
            canDecrease: data.maxParticipants !== null && data.maxParticipants > data.minParticipants + 1,
            canIncrease: data.maxParticipants !== null && data.maxParticipants < MAX_PARTICIPANTS,
            change: (delta: number) => setData(p => p.maxParticipants === null ? p : {
              ...p,
              maxParticipants: Math.min(MAX_PARTICIPANTS, Math.max(p.minParticipants + 1, p.maxParticipants + delta))
            })
          }].map(({
            label,
            value,
            display,
            disabled,
            canDecrease,
            canIncrease,
            change
          }) => <Box key={label} style={[[ui.glass, ui.rounded2xl, ui.p5], disabled && { opacity: .45 }]} glass>
                  <Box style={[[ui.flex, ui.itemsCenter, ui.justifyBetween, ui.mb3]]}>
                    <Label style={[[ui.textSm, ui.textWhite60]]}>{label}</Label>
                    <Label style={[[ui.fontDisplay, ui.text2xl, ui.fontLight, ui.textWhite]]}>
                      {display}
                    </Label>
                  </Box>
                  <Box style={[[ui.flex, ui.itemsCenter, ui.gap3]]}>
                    <Touch accessibilityLabel={`${label} azalt`} disabled={!canDecrease} onPress={() => change(-1)} style={[[ui.w10, ui.h10, ui.roundedXl, ui.glassStrong, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.textWhite70, ui.textXl, ui.fontLight]]} glass>
                      −
                    </Touch>
                    <Box style={[[ui.flex1, ui.h15, ui.roundedFull, ui.bgWhite10, ui.overflowHidden]]}>
                      <Box style={[[ui.hFull, ui.bgC8a44a, ui.roundedFull], {
                  width: `${value / MAX_PARTICIPANTS * 100}%`
                }]} />
                    </Box>
                    <Touch accessibilityLabel={`${label} artır`} disabled={!canIncrease} onPress={() => change(1)} style={[[ui.w10, ui.h10, ui.roundedXl, ui.glassStrong, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.textWhite70, ui.textXl, ui.fontLight]]} glass>
                      +
                    </Touch>
                  </Box>
                </Box>)}
              <Label style={[[ui.textXs, ui.textWhite40]]}>
                {data.maxParticipants === null ? "Maksimum sınırı belirlemek için minimumu 2'nin üzerine çıkar." : "Maksimum, minimumdan büyük olmalı."}
              </Label>

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
                  {suggestions.map(s => <Box key={s} style={[[ui.flex, ui.itemsCenter, ui.roundedXl, ui.border, hasLine(data.description, s) ? [ui.borderC8a44a50, ui.bgC8a44a10] : [ui.borderWhite10, ui.bgWhite004]]]}>
                      <Touch onPress={() => setData(p => ({
                  ...p,
                  description: toggleLine(p.description, s)
                }))} style={[[ui.py15, ui.px3, ui.textXs, hasLine(data.description, s) ? ui.textC8a44a : ui.textWhite55], { flexShrink: 1 }, personalSuggestions.length > 0 && { paddingRight: 0 }]}>
                        {s}
                      </Touch>
                      {personalSuggestions.length > 0 && <Touch accessibilityLabel={`${s} önerisini sil`} onPress={() => removeSuggestion(s)} hitSlop={8} style={{ paddingHorizontal: 8, alignSelf: "stretch", justifyContent: "center" }}>
                          <CloseIcon size={12} strokeWidth={2} style={{ color: palette.muted }} />
                        </Touch>}
                    </Box>)}
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
                {PRIVACIES.map(p => {
              const Icon = p.icon;
              const selected = data.privacy === p.label;
              const locked = p.enum === INVITE_ONLY && !canInvite;
              return <Touch key={p.label} disabled={locked} onPress={() => p.enum === INVITE_ONLY ? chooseInviteOnly(p.label) : selectAndNext("privacy", p.label)} style={[[ui.wFull, ui.p4, ui.rounded2xl, ui.flex, ui.itemsCenter, ui.gap4, ui.border, selected ? [ui.borderC8a44a50, ui.bgC8a44a10] : [ui.borderWhite8, ui.bgWhite004]]]}>
                      <Box style={[[ui.w10, ui.h10, ui.roundedXl, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.flexShrink0, selected ? [ui.textC8a44a] : [ui.textWhite35]], {
                  backgroundColor: selected ? "rgba(105,120,255,0.10)" : "rgba(255,255,255,0.05)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.07)"
                }]}>
                        <Icon size={18} strokeWidth={1.75} />
                      </Box>
                      <Box style={{ flex: 1, alignItems: "flex-start", justifyContent: "center" }}>
                        <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite85], { textAlign: "left" }]}>
                          {p.label}
                        </Label>
                        <Label style={[[ui.textXs, ui.textWhite40], { textAlign: "left" }]}>
                          {locked ? "Bu seçenek hesabında açık değil." : p.desc}
                        </Label>
                      </Box>
                    </Touch>;
            })}
              </Box>
              {isInviteOnly && <Box style={[[ui.spaceY3], { marginTop: 24 }]}>
                  <Label style={[[ui.textXs, ui.textWhite35, ui.uppercase, ui.trackingWider]]}>
                    Arkadaşlarını davet et{invitedIds.length ? ` · ${invitedIds.length} seçili` : ""}
                  </Label>
                  {friends === null ? <Label style={[[ui.textSm, ui.textWhite40]]}>Arkadaşların yükleniyor…</Label> : !friends.length ? <Label style={[[ui.textSm, ui.textWhite40]]}>Henüz aktif arkadaşın yok.</Label> : friends.map(friend => {
                const name = `${friend.firstName} ${friend.lastName}`.trim();
                const chosen = invitedIds.includes(friend.id);
                return <Touch key={friend.id} accessibilityLabel={`${name} davet et`} accessibilityState={{ selected: chosen }} onPress={() => toggleInvite(friend.id)} style={[[ui.wFull, ui.p3, ui.rounded2xl, ui.flex, ui.itemsCenter, ui.gap3, ui.border, chosen ? [ui.borderC8a44a50, ui.bgC8a44a10] : [ui.borderWhite8, ui.bgWhite004]]]}>
                        <Avatar uri={friend.profilePhoto || ""} name={name} size="sm" />
                        <Label style={[[ui.textSm, ui.textWhite85], { flex: 1, textAlign: "left" }]}>{name}</Label>
                        {chosen && <CheckIcon size={16} strokeWidth={2} style={{ color: palette.accent }} />}
                      </Touch>;
              })}
                </Box>}
            </Box>}
        </Box>
      </Scroll>

      {/* Sticky CTA for steps that need explicit continue */}
      {hasStickyBar && <StickyBar>
          <PrimaryButton onPress={step === 3 ? () => { setData(p => ({ ...p, durationMinutes: customMinutes })); next(); } : next} disabled={step === 8 && !invitedIds.length || step === 3 && !customDurationValid || step === 2 && (!data.date || !data.time || startsInPast) || step === 4 && !coordinate}>
            Devam Et
          </PrimaryButton>
        </StickyBar>}
      <BottomNav active="create-event" navigate={navigateAway} />
    </Box>;
}
