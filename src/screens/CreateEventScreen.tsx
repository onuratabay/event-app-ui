import ContextualTip from "../walkthrough/ContextualTip"
import { ContinueButton } from "../components/ContinueButton";
import { useWalkthroughAutostartBlocker, useWalkthroughScreenBlocker } from "../walkthrough/activity"
import { palette } from "../theme/palette";
import { CategoryIcon, ClockIcon, LocationIcon, UsersIcon, StarIcon } from "../components/Icons";
import { Alert } from "react-native";
import { canCreateEvent, createEvent, getEvent, inviteEventCandidates, dismissSuggestion, getActiveFriends, getUserSettings, type FriendUser, getMapInterests, getEnums, getApiErrorMessage, type InterestLevel, getSuggestions, getMyProposedInterests, proposeInterest } from "../api/client";
import { isUnlimitedCapacity, mapApiEvent, UNLIMITED_PARTICIPANTS } from "../native/Store";
import { useEffect, useRef, useState } from "react";
import { Avatar, AtmoBackground, GlassCard, GlassFill, GlassInput, GlassTextarea } from "../components/GlassUI";
import { CameraIcon, CheckIcon, CloseIcon, GlobeIcon, ImageIcon, LockIcon, PlusIcon, UserPlusIcon } from "../components/Icons";
import { selectPhoto } from "../native/media";
import { useStore } from "../native/Store";
import { Box, Field, Label, Picture, Scroll, Touch, Reveal } from "../native/UI";
import { ui } from "../theme/styles";
import { NavigateFn } from "../types";
import TopNavBar from "../components/TopNavBar";
import { useBottomNavInset } from "../components/BottomNav";
import { DURATIONS, MAX_DURATION_MINUTES, formatDuration } from "../events/duration";
import PoolCandidatesPicker from "../availability/PoolCandidatesPicker";
import LocationPicker, { placeLabel, type PickedPlace } from "../events/LocationPicker";
/** Same minimum as the server's description rule. */
const MIN_DESCRIPTION_LENGTH = 10;
function StickyBar({
  children
}: {
  children: React.ReactNode;
}) {
  // Sits above the global bottom bar; drops to the edge while the keyboard hides the bar.
  const inset = useBottomNavInset();
  return <Box style={[[ui.fixed, ui.left0, ui.right0, ui.px5, ui.pt4, ui.z40], { bottom: inset, paddingBottom: 8 }]} gradient={[palette.background, "transparent"]} gradientDirection="up">
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
  return <ContinueButton onPress={onPress} disabled={disabled}>{children}</ContinueButton>;
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
// Custom duration minutes accept digits only and never exceed 59.
const clampMinutes = (text: string) => {
  const digits = text.replace(/\D/g, "");
  return digits && Number(digits) > 59 ? "59" : digits;
};
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
  navigate,
  initialActivity,
  copyFromEventId
}: Props & { initialActivity?: string; copyFromEventId?: string }) {
  const {
    data: store,
    setData: setStore
  } = useStore();
  const [activities, setActivities] = useState<Array<{ id: string; name: string; levels?: InterestLevel[]; status?: string; requiresCover?: boolean }>>([]);
  const [visibilities, setVisibilities] = useState<Array<{ id: string; name: string; enum: string }>>([]);
  const [creating, setCreating] = useState(false);
  // One id per creation attempt, kept across retries: if a slow request timed out but the server created the
  // event, pressing "Oluştur" again returns that event instead of creating a second one.
  const creationRequestId = useRef(`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);
  // People from the private availability pool to invite once the event exists.
  const [poolIds, setPoolIds] = useState<string[]>([]);
  // The meeting point is picked on the map; `data.location` is the optional venue name typed next to it.
  const [place, setPlace] = useState<PickedPlace | null>(null);
  const [mapTouched, setMapTouched] = useState(false);
  useWalkthroughScreenBlocker(creating || mapTouched);
  // The shared list plus your own proposals still waiting for an admin (usable only in your events).
  const loadCatalog = () => Promise.all([getMapInterests(), getEnums('event_visibility'), getMyProposedInterests().catch(() => [])]).then(([a, v, mine]) => { const own = Array.isArray(mine) ? mine : []; setActivities([...a, ...own.filter(item => !a.some(row => row.id === item.id))]); setVisibilities(v); }).catch(error => Alert.alert('Seçenekler yüklenemedi', getApiErrorMessage(error)));
  // Personal suggestions are optional; the category defaults remain if they cannot load.
  const [personalSuggestions, setPersonalSuggestions] = useState<string[]>([]);
  useEffect(() => { void loadCatalog(); getSuggestions().then(result => setPersonalSuggestions(result.items)).catch(() => {}); }, []);
  const removeSuggestion = (text: string) => {
    const previous = personalSuggestions;
    setPersonalSuggestions(items => items.filter(item => item !== text));
    dismissSuggestion(text).then(result => setPersonalSuggestions(result.items)).catch(error => { setPersonalSuggestions(previous); Alert.alert('Öneri silinemedi', getApiErrorMessage(error)); });
  };
  const ACTIVITIES = activities.map(a => ({ label: a.name, icon: '✨' }));
  const PRIVACIES = visibilities.filter(v => PRIVACY_OPTIONS[v.enum]).map(v => ({ label: v.name, enum: v.enum, ...PRIVACY_OPTIONS[v.enum] }));
  // The server also enforces the limit on create; a failed check does not block the form.
  const [createBlocked, setCreateBlocked] = useState<string | null>(null);
  useEffect(() => { canCreateEvent().then(result => setCreateBlocked(result.canCreate ? null : result.message || "Şu an yeni etkinlik oluşturamazsın.")).catch(() => {}); }, []);
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
  useWalkthroughAutostartBlocker(step > 0);
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
    // No maximum while the minimum is 2; above it "Sınır koy" is the default (see the minimum card).
    maxParticipants: null as number | null,
    description: "",
    privacy: ""
  }));
  const levels = activities.find(a => a.name === data.activity)?.levels ?? [];
  const LEVELS = levels.map(l => l.name);
  // Interests without levels skip the level step (step 1) entirely.
  const chooseActivity = (activity: string, levelsKnown?: boolean) => {
    const hasLevels = levelsKnown ?? !!activities.find(a => a.name === activity)?.levels?.length;
    setData(p => ({ ...p, activity, level: p.activity === activity ? p.level : "" }));
    setTimeout(() => setStep(hasLevels ? 1 : 2), 180);
  };
  // "Yeni ilgi alanı": a member may propose one that is not in the list; they decide whether levels are asked.
  const [proposalOpen, setProposalOpen] = useState(false);
  const [proposalName, setProposalName] = useState("");
  const [proposalLevels, setProposalLevels] = useState<boolean | null>(null);
  const [proposing, setProposing] = useState(false);
  const submitProposal = async () => {
    if (proposing || proposalName.trim().length < 2 || proposalLevels === null) return;
    setProposing(true);
    try {
      const interest = await proposeInterest(proposalName.trim(), proposalLevels);
      setActivities(list => list.some(row => row.id === interest.id) ? list : [...list, interest]);
      setProposalOpen(false); setProposalName(""); setProposalLevels(null);
      if (interest.existing) Alert.alert("Bu ilgi alanı zaten var", `“${interest.name}” seçildi.`);
      chooseActivity(interest.name, interest.levels.length > 0);
    } catch (error) { Alert.alert("İlgi alanı eklenemedi", getApiErrorMessage(error)); }
    finally { setProposing(false); }
  };
  // Opened from a cancelled event: its details fill the form once the catalogs load, and the
  // organizer lands on the date step to set a new time before creating the event again.
  const appliedCopy = useRef(false);
  const [copiedFrom, setCopiedFrom] = useState(false);
  useEffect(() => {
    if (appliedCopy.current || !copyFromEventId || !activities.length || !visibilities.length) return;
    appliedCopy.current = true;
    getEvent(copyFromEventId).then(source => {
      const activity = activities.find(a => a.id === source.interest.id);
      const level = activity?.levels?.find(l => l.enum === source.level?.enum);
      const visibility = visibilities.find(v => v.enum === source.visibility?.enum && PRIVACY_OPTIONS[v.enum]);
      const sourceDate = source.date.split("/").reverse().join("-");
      const keepTime = !isPastStart(sourceDate, source.startTime);
      setData(p => ({
        ...p,
        // Only the organizer's own cover is kept; a default cover is picked again for the new event.
        coverImage: source.coverPhotoIsDefault ? "" : source.coverPhoto || "",
        activity: activity?.name || "",
        level: level?.name || "",
        ...(keepTime ? { date: sourceDate, time: source.startTime } : {}),
        durationMinutes: source.durationMinutes,
        location: source.locationName || "",
        minParticipants: Math.max(MIN_PARTICIPANTS, source.minParticipants),
        maxParticipants: isUnlimitedCapacity(source.maxParticipants) ? null : source.maxParticipants,
        description: source.description || "",
      }));
      setPlace({ latitude: source.latitude, longitude: source.longitude, city: "", district: "", address: "" });
      if (visibility) { if (visibility.enum === INVITE_ONLY) chooseInviteOnly(visibility.name); else setData(p => ({ ...p, privacy: visibility.name })); }
      setCopiedFrom(true);
      setStep(activity ? 2 : 0);
    }).catch(error => Alert.alert("Etkinlik bilgileri yüklenemedi", getApiErrorMessage(error)));
  }, [activities, visibilities, copyFromEventId]);
  // Opened from an idea on an empty Discover: the activity is picked as soon as the catalog loads.
  const appliedInitial = useRef(false);
  useEffect(() => {
    if (appliedInitial.current || !initialActivity || !activities.length) return;
    appliedInitial.current = true;
    const match = activities.find(a => a.name.toLocaleLowerCase("tr") === initialActivity.toLocaleLowerCase("tr"));
    if (match) chooseActivity(match.name);
  }, [activities, initialActivity]);
  const publish = async () => {
    if (creating) return;
    const interest = activities.find(i => i.name === data.activity), level = levels.find(i => i.name === data.level), visibility = visibilities.find(i => i.name === data.privacy);
    const needsLevel = levels.length > 0;
    const missing = [!interest && 'etkinlik türü', needsLevel && !level && 'seviye', !place && 'konum', !visibility && 'görünürlük'].filter(Boolean);
    if (!interest || needsLevel && !level || !visibility || !place) { Alert.alert('Eksik bilgi', `Şunları seç: ${missing.join(', ')}.`); return; }
    const inviteOnly = visibility.enum === INVITE_ONLY;
    // Invitees may be friends or people from the availability pool; pool picks need no friendship.
    if (inviteOnly && !invitedIds.length && !poolIds.length) { Alert.alert('Davet listesi boş', 'Arkadaşlarından ya da aşağıdaki takvim havuzundan en az bir kişi seç.'); return; }
    if (isPastStart(data.date, data.time)) { Alert.alert('Geçmiş tarih', 'Etkinlik zamanı geçmiş. Tarih ve saati ileri bir zamana güncelle.'); setStep(2); return; }
    if (data.description.trim().length < MIN_DESCRIPTION_LENGTH) { Alert.alert('Açıklama gerekli', `Etkinliği en az ${MIN_DESCRIPTION_LENGTH} karakterle açıkla.`); setStep(4); return; }
    setCreating(true);
    try {
      const date = displayDate(data.date);
      const event = await createEvent({ clientRequestId: creationRequestId.current, interestId: interest.id, ...(level ? { levelId: level.id } : {}), visibilityId: visibility.id, date, startTime: data.time, ...(data.durationMinutes ? { durationMinutes: data.durationMinutes } : {}), latitude: place.latitude, longitude: place.longitude, locationName: placeLabel(data.location, place), minParticipants: data.minParticipants, maxParticipants: data.maxParticipants ?? UNLIMITED_PARTICIPANTS, description: data.description.trim(), ...(inviteOnly ? { invitedUserIds: invitedIds } : {}), ...(data.coverImage ? (data.coverImage.startsWith("/photos/") && copyFromEventId ? { coverFromEventId: copyFromEventId } : { coverPhoto: data.coverImage }) : {}) });
      // The creator sees the new event at the top of Discover right away.
      setStore(p => ({ ...p, events: [mapApiEvent(event), ...p.events.filter(e => e.id !== event.id)], feedIds: [event.id, ...p.feedIds.filter(id => id !== event.id)] }));
      // The event already exists here; a failed invite must not look like a failed creation.
      if (poolIds.length) await inviteEventCandidates(event.id, poolIds).catch(error => Alert.alert('Etkinlik oluşturuldu', `Davetler gönderilemedi: ${getApiErrorMessage(error)} Etkinlik detayındaki "+ Kişi ekle" ile tekrar deneyebilirsin.`));
      // The creation flow leaves history entirely; back from the new event's detail goes home.
      navigate('event-detail', { eventId: event.id, aboveHome: true });
    } catch (error) { Alert.alert('Etkinlik oluşturulamadı', getApiErrorMessage(error)); }
    finally { setCreating(false); }
  };
  const next = () => setStep(s => s + 1);
  const back = () => {
    if (step === 2 && !levels.length) setStep(0);else if (step > 0) setStep(s => s - 1);else navigate("discover", { back: true });
  };
  const selectAndNext = (key: string, value: string) => {
    setData(prev => ({
      ...prev,
      [key]: value
    }));
    setTimeout(next, 180);
  };
  const progressPct = step / 7 * 100;
  const startsInPast = isPastStart(data.date, data.time);
  const customMinutes = (Number(customDuration.hours) || 0) * 60 + (Number(customDuration.minutes) || 0);
  const customDurationValid = customMinutes >= 1 && customMinutes <= MAX_DURATION_MINUTES;
  // Date/time and duration share one step; a duration (quick or valid custom) is still required.
  const durationChosen = customDurationOpen ? customDurationValid : !!data.durationMinutes;
  const isInviteOnly = visibilities.find(v => v.name === data.privacy)?.enum === INVITE_ONLY;
  // A new (member-proposed) interest has no default covers: uploading one is required.
  const coverRequired = !!activities.find(a => a.name === data.activity)?.requiresCover;
  const missingCover = coverRequired && !data.coverImage;
  // The message to participants is required (the server asks for at least 10 characters).
  const descriptionLength = data.description.trim().length;
  const descriptionValid = descriptionLength >= MIN_DESCRIPTION_LENGTH;
  // No step continues while one of its required fields is empty.
  const stepIncomplete = step === 2 && (!data.date || !data.time || startsInPast || !durationChosen) || step === 3 && !place || step === 4 && !descriptionValid || step === 5 && missingCover;
  const missingInvitees = isInviteOnly && !invitedIds.length && !poolIds.length;
  const hasStickyBar = step === 6 && isInviteOnly || step === 2 || step === 3 || step === 4 || step === 5;
  const suggestions = personalSuggestions.length ? personalSuggestions : REQUIREMENTS_SUGGESTIONS[data.activity] || REQUIREMENTS_SUGGESTIONS.default;
  if (createBlocked) {
    return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e]]}>
      <AtmoBackground />
      <TopNavBar navigate={navigate} fallback="discover" title="Etkinlik Oluştur" />
      <Box style={[[ui.flex1, ui.px5, ui.justifyCenter, ui.spaceY5]]}>
        <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite]]}>
          Etkinlik{"\n"}oluşturamıyorsun
        </Label>
        <Label style={[[ui.textSm, ui.textWhite55]]}>{createBlocked}</Label>
        <PrimaryButton onPress={() => navigate("discover")}>Keşfet'e dön</PrimaryButton>
      </Box>
    </Box>;
  }
  if (step === 7) {
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
                  { icon: <LocationIcon size={16} />, text: placeLabel(data.location, place) || "Konum" },
                  ...(data.level ? [{ icon: <StarIcon size={16} />, text: data.level }] : []),
                  { icon: <UsersIcon size={16} />, text: data.maxParticipants ? data.maxParticipants === data.minParticipants ? `Tam ${data.minParticipants} kişi` : `${data.minParticipants}-${data.maxParticipants} kişi` : `En az ${data.minParticipants} kişi` },
                  { icon: <LockIcon size={16} />, text: data.privacy ? `${data.privacy}${invitedIds.length && isInviteOnly ? ` · ${invitedIds.length} davetli` : ""}` : "Gizlilik" }
                ].map((item, index) => <Box key={index} style={[[ui.flex, ui.itemsCenter, ui.gap2]]}>{item.icon}<Label style={{ flexShrink: 1 }}>{item.text}</Label></Box>)}
              </Box>
              {data.description && <Label style={[[ui.textSm, ui.textWhite55]]}>
                  {data.description}
                </Label>}
            </Box>
          </GlassCard>

          {(() => {
            const interest = activities.find(i => i.name === data.activity), level = levels.find(i => i.name === data.level);
            if (!interest || !place || levels.length > 0 && !level || isPastStart(data.date, data.time)) return null;
            return <PoolCandidatesPicker selected={poolIds} onChange={setPoolIds} draft={{ interestId: interest.id, ...(level ? { levelId: level.id } : {}), date: displayDate(data.date), startTime: data.time, ...(data.durationMinutes ? { durationMinutes: data.durationMinutes } : {}), latitude: place.latitude, longitude: place.longitude }} />;
          })()}

          {missingCover && <Label style={[[ui.textXs, ui.mb3], { color: palette.error }]}>
              Yeni bir ilgi alanı seçtin; kapak fotoğrafı yüklemeden etkinlik oluşturamazsın.
            </Label>}
          {missingInvitees && <Label style={[[ui.textXs, ui.mb3], { color: palette.error }]}>
              Sadece davetlilere açık bir etkinlik için arkadaşlarından ya da yukarıdaki takvim havuzundan en az bir kişi seç.
            </Label>}
          <Touch onPress={publish} disabled={creating || missingInvitees || missingCover} style={[[ui.wFull, ui.py4, ui.rounded2xl, ui.fontSemibold, ui.textBase, ui.mb4], {
          color: palette.text
        }, (missingInvitees || missingCover) && { opacity: .45 }]} gradient={["#4d5bcb", "#6651c9"]}>
            {poolIds.length ? `Etkinliği Oluştur · ${poolIds.length} kişiyi davet et` : "Etkinliği Oluştur"}
          </Touch>
        </Box>
      </Scroll>
    </Box>;
  }
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.flex, ui.flexCol, ui.overflowHidden]]}>
      <AtmoBackground />
      <TopNavBar navigate={navigate} fallback="discover" onBack={back} walkthroughId="create-progress" title="Etkinlik Oluştur" subtitle={`${step + 1}/8`} />

      {/* Progress bar */}
      <Box style={[[ui.fixed, ui.top0, ui.left0, ui.right0, ui.h05, ui.bgWhite8]]}>
        <Box style={[[ui.hFull], {
        width: `${progressPct}%`
      }]} gradient={["#4d5bcb", "#6651c9"]} gradientDirection="right" />
      </Box>

      <Scroll scrollEnabled={!mapTouched} style={[[ui.relative, ui.flex, ui.flexCol, ui.hFull, ui.pb28], { paddingTop: 80 }, hasStickyBar && { paddingBottom: 176 }]}>
        <Box style={[[ui.pt4, ui.px5]]}>
          {copiedFrom && <Box style={[[ui.mb4, ui.p3, ui.roundedXl, ui.border, ui.borderC8a44a30, ui.bgC8a44a10]]}>
              <Label style={[[ui.textXs, ui.textWhite80, ui.leadingRelaxed]]}>İptal ettiğin etkinliğin bilgileri dolduruldu. Tarihi ve dilediğin alanları güncelleyip yeni etkinlik olarak oluştur.</Label>
            </Box>}

          {/* Step 0 - Activity */}
          {step === 0 && <Box style={[[]]} enter><Box walkthroughId="create-activity">
              <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite, ui.mb2]]}>
                Ne yapmak{"\n"}istiyorsun?
              </Label>
              <Label style={[[ui.textSm, ui.textWhite40, ui.mb6]]}>
                Seninle birlikte ne yapacağımızı anlat.
              </Label></Box>
              <Box style={[[ui.grid, ui.gap3]]} columns={2}>
                {!activities.length && <Touch onPress={loadCatalog}>Seçenekleri yeniden yükle</Touch>}
              {ACTIVITIES.map(a => <Touch key={a.label} onPress={() => chooseActivity(a.label)} style={[[ui.p4, ui.rounded2xl, ui.textLeft, ui.border, data.activity === a.label ? [ui.borderC8a44a50] : [ui.borderWhite8]]]}><GlassFill radius={16} tint={data.activity === a.label ? "rgba(105,120,255,.16)" : undefined} />
                    <CategoryIcon name={a.label} size={28} style={{ color: palette.accent, marginBottom: 12 }} />
                    <Label style={[[ui.textSm, ui.textWhite75, ui.fontMedium]]}>
                      {a.label}
                    </Label>
                  </Touch>)}
                {activities.length > 0 && <Touch accessibilityLabel="Yeni ilgi alanı ekle" onPress={() => setProposalOpen(open => !open)} style={[[ui.p4, ui.rounded2xl, ui.textLeft, ui.border, proposalOpen ? [ui.borderC8a44a50] : [ui.borderWhite8]], { borderStyle: "dashed" }]}><GlassFill radius={16} tint={proposalOpen ? "rgba(105,120,255,.16)" : undefined} />
                    <PlusIcon size={28} style={{ color: palette.accent, marginBottom: 12 }} />
                    <Label style={[[ui.textSm, ui.textWhite75, ui.fontMedium]]}>Yeni ilgi alanı</Label>
                  </Touch>}
              </Box>
              {proposalOpen && <Reveal><Box style={[[ui.mt4, ui.p4, ui.rounded2xl, ui.border, ui.borderWhite10, ui.spaceY3], { backgroundColor: palette.surface }]} enter>
                  <GlassInput label="İlgi alanının adı" placeholder="Örn. Okçuluk" value={proposalName} maxLength={40} onChangeText={setProposalName} />
                  <Label style={[[ui.textSm, ui.textWhite60, ui.fontMedium]]}>Katılımcılara seviye sorulsun mu?</Label>
                  <Box style={[[ui.flex, ui.gap3]]}>
                    {([[true, "Evet, seviye sorulsun"], [false, "Hayır, gerek yok"]] as const).map(([value, label]) => <Touch key={label} accessibilityState={{ selected: proposalLevels === value }} onPress={() => setProposalLevels(value)} style={[[ui.flex1, ui.p3, ui.rounded2xl, ui.textCenter, ui.border, ui.textSm, proposalLevels === value ? [ui.borderC8a44a50, ui.textC8a44a] : [ui.borderWhite8, ui.textWhite70]]]}><GlassFill radius={16} tint={proposalLevels === value ? "rgba(105,120,255,.16)" : undefined} />{label}</Touch>)}
                  </Box>
                  {proposalLevels && <Label style={[[ui.textXs, ui.textWhite40]]}>Diğer etkinliklerdeki seviyeler (Başlangıç, Orta, İleri…) bu ilgi alanında da seçilebilir olur.</Label>}
                  <Label style={[[ui.textXs, ui.textWhite40]]}>Yönetici onaylayana kadar yalnızca senin etkinliklerinde kullanılır. Hazır görseli olmadığından kapak fotoğrafı yüklemen gerekecek.</Label>
                  <PrimaryButton onPress={() => void submitProposal()} disabled={proposing || proposalName.trim().length < 2 || proposalLevels === null}>{proposing ? "Ekleniyor…" : "Ekle ve seç"}</PrimaryButton>
                </Box></Reveal>}
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
                {LEVELS.map(level => <Touch key={level} onPress={() => selectAndNext("level", level)} style={[[ui.wFull, ui.p4, ui.rounded2xl, ui.textLeft, ui.flex, ui.itemsCenter, ui.justifyBetween, ui.border, data.level === level ? [ui.borderC8a44a50] : [ui.borderWhite8]]]}><GlassFill radius={16} tint={data.level === level ? "rgba(105,120,255,.16)" : undefined} />
                    <Label style={[[ui.textBase, ui.textWhite80, ui.fontMedium]]}>
                      {level}
                    </Label>
                    {data.level === level && <Label style={[[ui.textC8a44a]]}>✓</Label>}
                  </Touch>)}
              </Box>
            </Box>}

          {/* Step 2 - Date, time & duration */}
          {step === 2 && <Box style={[[ui.spaceY5]]} enter>
              <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite, ui.mb2]]}>
                Ne zaman{"\n"}buluşuyorsunuz?
              </Label>
              <GlassInput label="Tarih" value={data.date} onChangeText={e => setData(p => ({
            ...p,
            date: e
          }))} mode="date" />
              <GlassInput label="Başlangıç saati" value={data.time} onChangeText={e => setData(p => ({
            ...p,
            time: e
          }))} mode="time" />
              {startsInPast && <Label style={[[ui.textSm], { color: palette.error }]}>
                Geçmiş bir tarih veya saat seçemezsin.
              </Label>}

              <Box>
                <Label style={[[ui.textSm, ui.textWhite60, ui.fontMedium]]}>
                  Ne kadar sürecek?
                </Label>
                <Label style={[[ui.textXs, ui.textWhite40, ui.mb3]]}>
                  Tahminen ne kadar vaktiniz var?
                </Label>
                <Box style={[[ui.grid, ui.gap3]]} columns={3}>
                  {DURATIONS.map(minutes => <Touch key={minutes} onPress={() => { setCustomDurationOpen(false); setData(p => ({ ...p, durationMinutes: minutes })); }} style={[[ui.p4, ui.rounded2xl, ui.textCenter, ui.border, !customDurationOpen && data.durationMinutes === minutes ? [ui.borderC8a44a50, ui.textC8a44a] : [ui.borderWhite8, ui.textWhite70]]]}><GlassFill radius={16} tint={!customDurationOpen && data.durationMinutes === minutes ? "rgba(105,120,255,.16)" : undefined} />
                      <Label style={[[ui.textSm, ui.fontMedium]]}>{formatDuration(minutes)}</Label>
                    </Touch>)}
                  <Touch onPress={() => setCustomDurationOpen(true)} style={[[ui.p4, ui.rounded2xl, ui.textCenter, ui.border, customDurationOpen || data.durationMinutes && !DURATIONS.includes(data.durationMinutes) ? [ui.borderC8a44a50, ui.textC8a44a] : [ui.borderWhite8, ui.textWhite70]]]}><GlassFill radius={16} tint={customDurationOpen || data.durationMinutes && !DURATIONS.includes(data.durationMinutes) ? "rgba(105,120,255,.16)" : undefined} />
                      <Label style={[[ui.textSm, ui.fontMedium]]}>Özel süre</Label>
                    </Touch>
                </Box>
                {customDurationOpen && <Reveal><Box style={[[ui.spaceY3], { marginTop: 16 }]}>
                    <Box style={[[ui.flex, ui.gap3]]}>
                      <GlassInput label="Saat" accessibilityLabel="Süre saat" placeholder="0" keyboardType="number-pad" maxLength={2} value={customDuration.hours} onChangeText={hours => setCustomDuration(p => ({ ...p, hours: hours.replace(/\D/g, "") }))} />
                      <GlassInput label="Dakika" placeholder="0" keyboardType="number-pad" maxLength={2} value={customDuration.minutes} onChangeText={minutes => setCustomDuration(p => ({ ...p, minutes: clampMinutes(minutes) }))} />
                    </Box>
                    <Label style={[[ui.textXs], { color: customMinutes > MAX_DURATION_MINUTES ? palette.error : palette.muted }]}>
                      {customMinutes > MAX_DURATION_MINUTES ? "Süre en fazla 24 saat olabilir." : customDurationValid ? `Süre: ${formatDuration(customMinutes)}` : "Saat ve dakika gir."}
                    </Label>
                  </Box></Reveal>}
              </Box>
              <Box style={[[ui.h4]]} />
            </Box>}

          {/* Step 3 - Location */}
          {step === 3 && <Box style={[[ui.spaceY5]]} enter>
              <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite, ui.mb2]]}>
                Nerede{"\n"}buluşacaksınız?
              </Label>
              <LocationPicker value={place} venue={data.location} defaultCity={store.user.city} onChange={setPlace}
                onVenueChange={location => setData(p => ({ ...p, location }))} onMapTouch={setMapTouched} />
            </Box>}

          {/* Step 4 - Participants & message */}
          {step === 4 && <Box style={[[ui.spaceY6]]} enter>
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
            canDecrease: data.minParticipants > MIN_PARTICIPANTS,
            canIncrease: data.minParticipants < MAX_PARTICIPANTS,
            change: (delta: number) => setData(p => {
              const min = Math.min(MAX_PARTICIPANTS, Math.max(MIN_PARTICIPANTS, p.minParticipants + delta));
              // The maximum field appears once the minimum is above 2, with "Sınır koy" chosen (starting at the
              // minimum); back at 2 it hides and the event has no maximum. A set limit never drops below the minimum.
              const max = min === MIN_PARTICIPANTS ? null
                : p.minParticipants === MIN_PARTICIPANTS ? min
                : p.maxParticipants === null ? null : Math.max(min, p.maxParticipants);
              return { ...p, minParticipants: min, maxParticipants: max };
            })
          }, {
            label: "Maksimum",
            value: data.maxParticipants ?? 0,
            display: data.maxParticipants ? `${data.maxParticipants} kişi` : "",
            // Shown only when the organizer chose to set a limit.
            hidden: data.maxParticipants === null,
            canDecrease: data.maxParticipants !== null && data.maxParticipants > data.minParticipants,
            canIncrease: data.maxParticipants !== null && data.maxParticipants < MAX_PARTICIPANTS,
            change: (delta: number) => setData(p => p.maxParticipants === null ? p : {
              ...p,
              maxParticipants: Math.min(MAX_PARTICIPANTS, Math.max(p.minParticipants, p.maxParticipants + delta))
            })
          }].filter(card => !("hidden" in card && card.hidden)).map(({
            label,
            value,
            display,
            canDecrease,
            canIncrease,
            change
          }) => <Box key={label} style={[[ui.glass, ui.rounded2xl, ui.p5]]} glass>
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
              {/* Above a minimum of 2 the maximum is optional: no limit, or a cap (equal to the minimum = exactly that many). */}
              {data.minParticipants > MIN_PARTICIPANTS && <Box>
                <Label style={[[ui.textSm, ui.textWhite60, ui.mb2]]}>Maksimum katılımcı</Label>
                <Box style={[[ui.flex, ui.gap3]]}>
                  {([[false, "Sınır yok"], [true, "Sınır koy"]] as const).map(([limited, label]) => {
                    const selected = (data.maxParticipants !== null) === limited;
                    return <Touch key={label} accessibilityState={{ selected }} onPress={() => setData(p => ({ ...p, maxParticipants: limited ? p.maxParticipants ?? p.minParticipants : null }))} style={[[ui.flex1, ui.p3, ui.rounded2xl, ui.textCenter, ui.border, ui.textSm, selected ? [ui.borderC8a44a50, ui.bgC8a44a10, ui.textC8a44a] : [ui.borderWhite8, ui.bgWhite004, ui.textWhite70]]]}>{label}</Touch>;
                  })}
                </Box>
              </Box>}
              <Label style={[[ui.textXs, ui.textWhite40]]}>
                {data.minParticipants === MIN_PARTICIPANTS ? "Etkinlik minimum katılımcı sayısına göre ilerler. Maksimum belirlemek için minimumu 2'nin üzerine çıkar." : data.maxParticipants === null ? "Sınır yok: minimum dolunca etkinlik hayata geçer, isteyenler katılmaya devam edebilir." : data.maxParticipants === data.minParticipants ? `Tam ${data.minParticipants} kişilik: ${data.minParticipants} kişi dolunca katılım kapanır.` : `${data.minParticipants} kişi dolunca etkinlik hayata geçer; ${data.maxParticipants} kişide katılım kapanır.`}
              </Label>

              {/* Participants and the message to them share one step. */}
              <Box>
                <Label style={[[ui.textSm, ui.textWhite60, ui.fontMedium]]}>
                  Katılımcılara ne söylemek istersin?
                </Label>
                <Label style={[[ui.textXs, ui.textWhite40]]}>
                  Zorunlu: etkinliği ve varsa gereksinimleri en az {MIN_DESCRIPTION_LENGTH} karakterle anlat.
                </Label>
              </Box>
              <GlassTextarea placeholder="Katılımcılara ne söylemek istersin?" value={data.description} onChangeText={e => setData(p => ({
            ...p,
            description: e
          }))} />
              <Label accessibilityLiveRegion="polite" style={[[ui.textXs], { color: descriptionValid ? palette.muted : palette.error, marginTop: -16 }]}>
                {descriptionValid ? `${descriptionLength} karakter` : `En az ${MIN_DESCRIPTION_LENGTH} karakter yaz (${descriptionLength}/${MIN_DESCRIPTION_LENGTH}).`}
              </Label>

              <Box>
                <Label style={[[ui.textXs, ui.textWhite35, ui.mb2, ui.uppercase, ui.trackingWider]]}>
                  Hızlı ekle
                </Label>
                <Box style={[[ui.flex, ui.flexWrap, ui.gap2]]}>
                  {/* Chips never exceed the row: long suggestions wrap left-aligned and the × stays inside. */}
                  {suggestions.map(s => <Box key={s} style={[[ui.flex, ui.itemsCenter, ui.roundedXl, ui.border, hasLine(data.description, s) ? [ui.borderC8a44a50, ui.bgC8a44a10] : [ui.borderWhite10, ui.bgWhite004]], { maxWidth: "100%" }]}>
                      <Touch onPress={() => setData(p => ({
                  ...p,
                  description: toggleLine(p.description, s)
                }))} style={[[ui.py15, ui.px3, ui.textXs, hasLine(data.description, s) ? ui.textC8a44a : ui.textWhite55], { flexShrink: 1, alignItems: "flex-start", textAlign: "left" }, personalSuggestions.length > 0 && { paddingRight: 0 }]}>
                        {s}
                      </Touch>
                      {personalSuggestions.length > 0 && <Touch accessibilityLabel={`${s} önerisini sil`} onPress={() => removeSuggestion(s)} hitSlop={8} style={{ paddingHorizontal: 8, alignSelf: "stretch", justifyContent: "center", flexShrink: 0 }}>
                          <CloseIcon size={12} strokeWidth={2} style={{ color: palette.muted }} />
                        </Touch>}
                    </Box>)}
                </Box>
              </Box>

              <Box style={[[ui.h4]]} />
            </Box>}

          {/* Step 5 - Cover */}
          {step === 5 && <Box style={[[ui.spaceY5]]} enter>
              <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite, ui.mb2]]}>
                Etkinliğine{"\n"}bir yüz ver.
              </Label>
              <Label style={[[ui.textSm], { color: missingCover ? palette.error : "rgba(255,255,255,.4)" }]}>
                {coverRequired ? "Yeni bir ilgi alanı için hazır görselimiz yok; kapak fotoğrafı yüklemen zorunlu." : "İstersen atla, sana uygun bir görsel seçeriz."}
              </Label>

              <Touch style={[[ui.h52, ui.rounded2xl, ui.flex, ui.flexCol, ui.itemsCenter, ui.justifyCenter, ui.gap3], {
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)"
          }]} onPress={async () => {
            const uri = await selectPhoto();
            if (uri) setData(p => ({
              ...p,
              coverImage: uri
            }));
          }}>
                <GlassFill radius={16} />
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

          {/* Step 6 - Privacy */}
          {step === 6 && <Box style={[[]]} enter>
              <ContextualTip id="privacy" />
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
              return <Touch key={p.label} disabled={locked} onPress={() => p.enum === INVITE_ONLY ? chooseInviteOnly(p.label) : selectAndNext("privacy", p.label)} style={[[ui.wFull, ui.p4, ui.rounded2xl, ui.flex, ui.itemsCenter, ui.gap4, ui.border, selected ? [ui.borderC8a44a50] : [ui.borderWhite8]]]}><GlassFill radius={16} tint={selected ? "rgba(105,120,255,.16)" : undefined} />
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
                    Arkadaşlarını davet et{invitedIds.length ? ` · ${invitedIds.length} seçili` : " · isteğe bağlı"}
                  </Label>
                  <Label style={[[ui.textXs, ui.textWhite40]]}>Arkadaş olman gerekmeyen, bu etkinliğe uygun kişileri bir sonraki adımda takvim havuzundan da davet edebilirsin.</Label>
                  {friends === null ? <Label style={[[ui.textSm, ui.textWhite40]]}>Arkadaşların yükleniyor…</Label> : !friends.length ? <Label style={[[ui.textSm, ui.textWhite40]]}>Henüz aktif arkadaşın yok.</Label> : friends.map(friend => {
                const name = `${friend.firstName} ${friend.lastName}`.trim();
                const chosen = invitedIds.includes(friend.id);
                return <Touch key={friend.id} accessibilityLabel={`${name} davet et`} accessibilityState={{ selected: chosen }} onPress={() => toggleInvite(friend.id)} style={[[ui.wFull, ui.p3, ui.rounded2xl, ui.flex, ui.itemsCenter, ui.gap3, ui.border, chosen ? [ui.borderC8a44a50] : [ui.borderWhite8]]]}><GlassFill radius={16} tint={chosen ? "rgba(105,120,255,.16)" : undefined} />
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
          <PrimaryButton onPress={step === 2 && customDurationOpen ? () => { setData(p => ({ ...p, durationMinutes: customMinutes })); next(); } : next} disabled={stepIncomplete}>
            Devam Et
          </PrimaryButton>
        </StickyBar>}
    </Box>;
}
