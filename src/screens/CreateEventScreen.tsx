import ContextualTip from "../walkthrough/ContextualTip"
import { showAlert } from "../components/AppDialog"
import { ContinueButton } from "../components/ContinueButton";
import { useWalkthroughAutostartBlocker, useWalkthroughScreenBlocker } from "../walkthrough/activity"
import { palette } from "../theme/palette";
import { CategoryIcon, ClockIcon, LocationIcon, UsersIcon, StarIcon } from "../components/Icons";
;
import { canCreateEvent, createEvent, getEvent, inviteEventCandidates, dismissSuggestion, getActiveFriends, type FriendUser, getMapInterests, getEnums, getApiErrorMessage, type InterestLevel, getSuggestions, getMyProposedInterests, proposeInterest, getInterestImages } from "../api/client";
import { isUnlimitedCapacity, mapApiEvent, UNLIMITED_PARTICIPANTS } from "../native/Store";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, TextInput, View, type ViewInstance } from "react-native";
import { Avatar, AtmoBackground, Checkbox, GlassCard, GlassFill, GlassInput, GlassTextarea } from "../components/GlassUI";
import { CameraIcon, CloseIcon, GlobeIcon, ImageIcon, LockIcon, PlusIcon, UserPlusIcon } from "../components/Icons";
import { selectPhoto } from "../native/media";
import { useStore } from "../native/Store";
import { Box, Field, Label, Picture, Scroll, Touch, Reveal } from "../native/UI";
import { ui } from "../theme/styles";
import { NavigateFn } from "../types";
import TopNavBar from "../components/TopNavBar";
import { useBottomNavInset } from "../components/BottomNav";
import { DURATIONS, MAX_DURATION_MINUTES, formatDuration } from "../events/duration";
import { matchingCover } from "../native/images";
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
  public: { icon: GlobeIcon, desc: "Topluluk üyeleri görebilir ve katılabilir." },
  [INVITE_ONLY]: { icon: UserPlusIcon, desc: "Yalnızca sen ve davet ettiğin kişiler görebilir." },
};
const REQUIREMENTS_SUGGESTIONS: {
  [key: string]: string[];
} = {
  Padel: ["Raketini yanında getir.", "Raket tesisten kiralanabilir.", "Sadece spor ayakkabını alıp gel."],
  Tenis: ["Raket gerekli.", "Tenis ayakkabısı zorunlu.", "Top temin edeceğim."],
  Koşu: ["Koşu ayakkabısı gerekli.", "Su şişesi getir."],
  Kahve: ["Merak yeter!", "Herkes kendi hesabını öder."],
  Hiking: ["Yürüyüş ayakkabısı gerekli.", "En az 1 litre su getir.", "Atıştırmalık al."],
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
  const [activities, setActivities] = useState<Array<{ id: string; name: string; slug?: string; levels?: InterestLevel[]; status?: string; requiresCover?: boolean; featured?: boolean }>>([]);
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
  const loadCatalog = () => Promise.all([getMapInterests(), getEnums('event_visibility'), getMyProposedInterests().catch(() => [])]).then(([a, v, mine]) => { const own = Array.isArray(mine) ? mine : []; setActivities([...a, ...own.filter(item => !a.some(row => row.id === item.id))]); setVisibilities(v); }).catch(error => showAlert('Seçenekler yüklenemedi', getApiErrorMessage(error)));
  // Personal suggestions are optional; the category defaults remain if they cannot load.
  const [personalSuggestions, setPersonalSuggestions] = useState<string[]>([]);
  useEffect(() => { void loadCatalog(); getSuggestions().then(result => setPersonalSuggestions(result.items)).catch(() => {}); }, []);
  const removeSuggestion = (text: string) => {
    const previous = personalSuggestions;
    setPersonalSuggestions(items => items.filter(item => item !== text));
    dismissSuggestion(text).then(result => setPersonalSuggestions(result.items)).catch(error => { setPersonalSuggestions(previous); showAlert('Öneri silinemedi', getApiErrorMessage(error)); });
  };
  // Featured activities are big tiles; the rest open as small chips under "Diğer". Both arrive most-used first.
  // Your own pending proposals count as featured so you find what you just added.
  const isFeatured = (a: (typeof activities)[number]) => a.featured !== false || a.status === "pending";
  const ACTIVITIES = activities.filter(isFeatured).map(a => ({ label: a.name, slug: a.slug }));
  const OTHER_ACTIVITIES = activities.filter(a => !isFeatured(a)).map(a => ({ label: a.name, slug: a.slug }));
  const PRIVACIES = visibilities.filter(v => PRIVACY_OPTIONS[v.enum]).map(v => ({ label: v.name, enum: v.enum, ...PRIVACY_OPTIONS[v.enum] }));
  // The server also enforces the limit on create; a failed check does not block the form.
  const [createBlocked, setCreateBlocked] = useState<string | null>(null);
  useEffect(() => { canCreateEvent().then(result => setCreateBlocked(result.canCreate ? null : result.message || "Şu an yeni etkinlik oluşturamazsın.")).catch(() => {}); }, []);
  const [friends, setFriends] = useState<FriendUser[] | null>(null);
  const [invitedIds, setInvitedIds] = useState<string[]>([]);
  // Invite-only is open to everyone. The friends list loads here and is shown on the preview, under
  // "Uygun kişilerden davet et"; everyone picked gets an invitation to accept or decline.
  const chooseInviteOnly = (label: string) => {
    setData(p => ({ ...p, privacy: label }));
    if (friends === null) getActiveFriends().then(result => setFriends(result.items.map(item => item.user))).catch(error => { setFriends([]); showAlert('Arkadaşlar yüklenemedi', getApiErrorMessage(error)); });
  };
  // Many friends: searched by first/last name and scrolled inside their own panel.
  const [friendQuery, setFriendQuery] = useState("");
  const friendNeedle = friendQuery.trim().toLocaleLowerCase("tr");
  const shownFriends = !friends ? [] : !friendNeedle ? friends : friends.filter(friend => `${friend.firstName} ${friend.lastName}`.toLocaleLowerCase("tr").includes(friendNeedle));
  const toggleInvite = (id: string) => setInvitedIds(ids => ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id]);
  const [step, setStep] = useState(0);
  // Counts level taps: each one scrolls the "how many people" section into view.
  // Counts taps on "Sınır yok / Sınır koy": each one scrolls their explanation (under the buttons) into view.
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
    // "Sınır yok" until the organizer chooses "Sınır koy" (offered from a minimum of 2; the maximum starts at the minimum).
    maxParticipants: null as number | null,
    description: "",
    privacy: ""
  }));
  const levels = activities.find(a => a.name === data.activity)?.levels ?? [];
  const LEVELS = levels.map(l => l.name);
  // Step 1 always follows: the level (only for interests with levels) and how many people.
  const chooseActivity = (activity: string) => {
    setData(p => ({ ...p, activity, level: p.activity === activity ? p.level : "" }));
    setTimeout(() => setStep(1), 180);
  };
  // "Yeni ilgi alanı": a member may propose one that is not in the list; they decide whether levels are asked.
  const [proposalOpen, setProposalOpen] = useState(false);
  const [othersOpen, setOthersOpen] = useState(false);
  // A copied event (or a back-step) with a "Diğer" activity keeps that list open so the choice stays visible.
  const otherChosen = OTHER_ACTIVITIES.some(a => a.label === data.activity);
  const showOthers = othersOpen || otherChosen;
  // The chosen option stays; a set limit never drops below the minimum (equal = exactly that many).
  const setMinimum = (value: number) => setData(p => {
    const min = Math.min(MAX_PARTICIPANTS, Math.max(MIN_PARTICIPANTS, value));
    return { ...p, minParticipants: min, maxParticipants: p.maxParticipants === null ? null : Math.max(min, p.maxParticipants) };
  });
  // "Diğer" opens with a filter; the list keeps the server's most-used-first order.
  const [otherQuery, setOtherQuery] = useState("");
  const fold = (value: string) => value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i");
  // "Diğer" lists only the activities that have no card above; most used first.
  const filteredOthers = OTHER_ACTIVITIES.filter(a => fold(a.label).includes(fold(otherQuery.trim())));
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
      if (interest.existing) showAlert("Bu ilgi alanı zaten var", `“${interest.name}” seçildi.`);
      chooseActivity(interest.name);
    } catch (error) { showAlert("İlgi alanı eklenemedi", getApiErrorMessage(error)); }
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
    }).catch(error => showAlert("Etkinlik bilgileri yüklenemedi", getApiErrorMessage(error)));
  }, [activities, visibilities, copyFromEventId]);
  // Opened from an idea on an empty Discover: the activity is picked as soon as the catalog loads.
  const appliedInitial = useRef(false);
  useEffect(() => {
    if (appliedInitial.current || !initialActivity || !activities.length) return;
    appliedInitial.current = true;
    const match = activities.find(a => a.name.toLocaleLowerCase("tr") === initialActivity.toLocaleLowerCase("tr"));
    if (match) chooseActivity(match.name);
  }, [activities, initialActivity]);
  // The server asked for a cover this list did not mark (e.g. an outdated catalog): the cover step then requires it.
  const [coverDemanded, setCoverDemanded] = useState<string | null>(null);
  const publish = async () => {
    if (creating) return;
    const interest = activities.find(i => i.name === data.activity), level = levels.find(i => i.name === data.level), visibility = visibilities.find(i => i.name === data.privacy);
    const needsLevel = levels.length > 0;
    const missing = [!interest && 'etkinlik türü', needsLevel && !level && 'seviye', !place && 'konum', !visibility && 'görünürlük'].filter(Boolean);
    if (!interest || needsLevel && !level || !visibility || !place) { showAlert('Eksik bilgi', `Şunları seç: ${missing.join(', ')}.`); return; }
    const inviteOnly = visibility.enum === INVITE_ONLY;
    // Invitees may be friends or people from the availability pool; pool picks need no friendship.
    if (inviteOnly && !invitedIds.length && !poolIds.length) { showAlert('Davet listesi boş', 'Uygun kişilerden ya da arkadaşlarından en az bir kişi seç.'); return; }
    if (isPastStart(data.date, data.time)) { showAlert('Geçmiş tarih', 'Etkinlik zamanı geçmiş. Tarih ve saati ileri bir zamana güncelle.'); setStep(2); return; }
    if (data.description.trim().length < MIN_DESCRIPTION_LENGTH) { showAlert('Açıklama gerekli', `Etkinliği en az ${MIN_DESCRIPTION_LENGTH} karakterle açıkla.`); setStep(4); return; }
    setCreating(true);
    try {
      const date = displayDate(data.date);
      const event = await createEvent({ clientRequestId: creationRequestId.current, interestId: interest.id, ...(level ? { levelId: level.id } : {}), visibilityId: visibility.id, date, startTime: data.time, ...(data.durationMinutes ? { durationMinutes: data.durationMinutes } : {}), latitude: place.latitude, longitude: place.longitude, locationName: placeLabel(data.location, place), minParticipants: data.minParticipants, maxParticipants: data.maxParticipants ?? UNLIMITED_PARTICIPANTS, description: data.description.trim(), ...(inviteOnly ? { invitedUserIds: invitedIds } : {}), ...(data.coverImage ? (data.coverImage.startsWith("/photos/") && copyFromEventId ? { coverFromEventId: copyFromEventId } : { coverPhoto: data.coverImage }) : {}) });
      // The creator sees the new event at the top of Discover right away (an invite-only one too: its
      // organizer and the members who accept see it there, nobody else).
      setStore(p => ({ ...p, events: [mapApiEvent(event), ...p.events.filter(e => e.id !== event.id)], feedIds: [event.id, ...p.feedIds.filter(id => id !== event.id)] }));
      // Friends picked on the preview were invited with the event; the pool invite skips them.
      const poolInvites = inviteOnly ? poolIds.filter(id => !invitedIds.includes(id)) : poolIds;
      // The event already exists here; a failed invite must not look like a failed creation.
      if (poolInvites.length) await inviteEventCandidates(event.id, poolInvites).catch(error => showAlert('Etkinlik oluşturuldu', `Davetler gönderilemedi: ${getApiErrorMessage(error)} Etkinlik detayındaki "Davet et" ile tekrar deneyebilirsin.`));
      // The creation flow leaves history entirely; back from the new event's detail goes home.
      navigate('event-detail', { eventId: event.id, aboveHome: true });
    } catch (error) {
      const message = getApiErrorMessage(error);
      if (!data.coverImage && /kapak fotoğrafı/i.test(message)) { setCoverDemanded(data.activity); setStep(5); }
      showAlert('Etkinlik oluşturulamadı', message);
    }
    finally { setCreating(false); }
  };
  const next = () => setStep(s => s + 1);
  const back = () => {
    if (step > 0) setStep(s => s - 1);else navigate("discover", { back: true });
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
  const chosenActivity = activities.find(a => a.name === data.activity);
  // A cover is required when the activity has no picture to fall back on: no stock image on the server and
  // no fitting cover in the app (the generic fallback does not count). So any newly added interest without a
  // photo, member-proposed or not, asks for one. The server's own `requiresCover` is honoured too.
  const [noStockCover, setNoStockCover] = useState<Record<string, boolean>>({});
  const needsStockCheck = !!chosenActivity && !matchingCover(chosenActivity.name);
  useEffect(() => {
    const target = chosenActivity;
    if (!target || !needsStockCheck || target.id in noStockCover) return;
    getInterestImages(target.id).then(images => setNoStockCover(map => ({ ...map, [target.id]: !images.length }))).catch(() => {});
  }, [chosenActivity?.id, needsStockCheck]);
  const coverRequired = coverDemanded === data.activity || !!chosenActivity?.requiresCover || (needsStockCheck && !!chosenActivity && noStockCover[chosenActivity.id] === true);
  const missingCover = coverRequired && !data.coverImage;
  // The message to participants is required (the server asks for at least 10 characters).
  const descriptionLength = data.description.trim().length;
  const descriptionValid = descriptionLength >= MIN_DESCRIPTION_LENGTH;
  // No step continues while one of its required fields is empty.
  const stepIncomplete = step === 1 && levels.length > 0 && !data.level || step === 2 && (!data.date || !data.time || startsInPast || !durationChosen) || step === 3 && !place || step === 4 && !descriptionValid || step === 5 && missingCover;
  const missingInvitees = isInviteOnly && !invitedIds.length && !poolIds.length;
  const hasStickyBar = step === 1 || step === 2 || step === 3 || step === 4 || step === 5;
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

          {/* Invite-only: your friends can be picked too; each gets an invitation to accept or decline. */}
          {isInviteOnly && <Box style={[[ui.spaceY3, ui.mb4]]}>
              <Label style={[[ui.textXs, ui.textWhite35, ui.uppercase, ui.trackingWider]]}>
                Arkadaşlarından davet et{invitedIds.length ? ` · ${invitedIds.length} seçili` : ""}
              </Label>
              <Label style={[[ui.textXs, ui.textWhite40]]}>Seçtiğin arkadaşlarına etkinlik oluşturulunca davet gider; kabul ederlerse katılımcı olurlar.</Label>
              {friends === null ? <Label style={[[ui.textSm, ui.textWhite40]]}>Arkadaşların yükleniyor…</Label> : !friends.length ? <Label style={[[ui.textSm, ui.textWhite40]]}>Henüz aktif arkadaşın yok.</Label> : <>
              <Field accessibilityLabel="Arkadaşlarında ara" placeholder="Ad veya soyad ara" value={friendQuery} onChangeText={setFriendQuery} autoCapitalize="words" autoCorrect={false} returnKeyType="search" glass />
              {!shownFriends.length ? <Label style={[[ui.textSm, ui.textWhite40]]}>Bu isimde bir arkadaşın yok.</Label> : <Scroll style={{ maxHeight: 320 }} nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
              {shownFriends.map(friend => {
            const name = `${friend.firstName} ${friend.lastName}`.trim();
            const chosen = invitedIds.includes(friend.id);
            return <Touch key={friend.id} accessibilityRole="checkbox" accessibilityLabel={`${name} davet et`} accessibilityState={{ checked: chosen }} onPress={() => toggleInvite(friend.id)} style={[[ui.wFull, ui.p3, ui.rounded2xl, ui.flex, ui.itemsCenter, ui.gap3, ui.border, chosen ? [ui.borderC8a44a50] : [ui.borderWhite8]]]}><GlassFill radius={16} tint={chosen ? "rgba(105,120,255,.16)" : undefined} />
                    <Checkbox checked={chosen} />
                    <Avatar uri={friend.profilePhoto || ""} name={name} size="sm" />
                    <Label style={[[ui.textSm, ui.textWhite85], { flex: 1, textAlign: "left" }]}>{name}</Label>
                  </Touch>;
          })}
              </Scroll>}
              </>}
            </Box>}

          {missingCover && <Label style={[[ui.textXs, ui.mb3], { color: palette.error }]}>
              Yeni bir ilgi alanı seçtin; kapak fotoğrafı yüklemeden etkinlik oluşturamazsın.
            </Label>}
          {missingInvitees && <Label style={[[ui.textXs, ui.mb3], { color: palette.error }]}>
              Sadece davetlilere açık bir etkinlik için uygun kişilerden ya da arkadaşlarından en az bir kişi seç.
            </Label>}
          <Touch onPress={publish} disabled={creating || missingInvitees || missingCover} style={[[ui.wFull, ui.py4, ui.rounded2xl, ui.fontSemibold, ui.textBase, ui.mb4], {
          color: palette.text
        }, (missingInvitees || missingCover) && { opacity: .45 }]} gradient={["#4d5bcb", "#6651c9"]}>
            {(() => { const count = new Set([...poolIds, ...(isInviteOnly ? invitedIds : [])]).size; return count ? `Etkinliği Oluştur · ${count} kişiyi davet et` : "Etkinliği Oluştur"; })()}
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

      {/* The sticky "Devam Et" bar covers 176pt at the bottom: content scrolled into view stops above it. */}
      <Scroll scrollEnabled={!mapTouched} floatingBottom={hasStickyBar ? 176 : undefined} style={[[ui.relative, ui.flex, ui.flexCol, ui.hFull, ui.pb28], { paddingTop: 80 }, hasStickyBar && { paddingBottom: 176 }]}>
        <Box style={[[ui.pt4, ui.px5]]}>
          {copiedFrom && <Box style={[[ui.mb4, ui.p3, ui.roundedXl, ui.border, ui.borderC8a44a30, ui.bgC8a44a10]]}>
              <Label style={[[ui.textXs, ui.textWhite80, ui.leadingRelaxed]]}>İptal ettiğin etkinliğin bilgileri dolduruldu. Tarihi ve dilediğin alanları güncelleyip yeni etkinlik olarak oluştur.</Label>
            </Box>}

          {/* Step 0 - Activity */}
          {step === 0 && <Box style={[[]]} enter><Box walkthroughId="create-activity">
              <Label style={[[ui.fontDisplay, ui.text2xl, ui.fontLight, ui.textWhite, ui.mb1]]}>
                Ne yapmak istiyorsun?
              </Label>
              <Label style={[[ui.textSm, ui.textWhite40, ui.mb4]]}>
                Birlikte yapmak istediğin aktiviteyi seç.
              </Label></Box>
              {/* Three columns of the featured activities, ending with "Diğer" (the full list, its search and proposals). */}
              <Box style={[[ui.grid, ui.gap2]]} columns={3}>
                {!activities.length && <Touch onPress={loadCatalog}>Seçenekleri yeniden yükle</Touch>}
              {ACTIVITIES.map(a => <Touch key={a.label} onPress={() => chooseActivity(a.label)} style={[s.tile, data.activity === a.label ? [ui.borderC8a44a50] : [ui.borderWhite8]]}><GlassFill radius={14} tint={data.activity === a.label ? "rgba(105,120,255,.16)" : undefined} />
                    <CategoryIcon name={a.label} slug={a.slug} size={22} style={{ color: palette.accent }} />
                    <Label numberOfLines={2} style={s.tileLabel}>
                      {a.label}
                    </Label>
                  </Touch>)}
                {activities.length > 0 && <Touch accessibilityLabel="Diğer aktiviteler" accessibilityState={{ expanded: showOthers }} onPress={() => setOthersOpen(open => !open)} style={[s.tile, showOthers ? [ui.borderC8a44a50] : [ui.borderWhite8]]}><GlassFill radius={14} tint={showOthers ? "rgba(105,120,255,.16)" : undefined} />
                    <Label style={{ fontSize: 18, lineHeight: 22, color: palette.accent }}>•••</Label>
                    <Label numberOfLines={2} style={s.tileLabel}>{otherChosen ? data.activity : "Diğer"}</Label>
                  </Touch>}
              </Box>
              {showOthers && <Reveal><Box style={[[ui.mt4, ui.spaceY3]]} enter>
                <GlassInput label="Diğer aktivitelerde ara" placeholder="Örn. Kamp, Satranç, Karaoke" value={otherQuery} maxLength={40} onChangeText={setOtherQuery} />
                <Box style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {filteredOthers.map(a => {
                    const selected = data.activity === a.label;
                    return <Touch key={a.label} accessibilityLabel={a.label} accessibilityState={{ selected }} onPress={() => chooseActivity(a.label)} style={[{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 }, selected ? [ui.borderC8a44a50] : [ui.borderWhite8]]}><GlassFill radius={12} tint={selected ? "rgba(105,120,255,.16)" : undefined} />
                      <CategoryIcon name={a.label} slug={a.slug} size={16} style={{ color: palette.accent }} />
                      <Label style={[[ui.textXs, selected ? ui.textC8a44a : ui.textWhite75, ui.fontMedium]]}>{a.label}</Label>
                    </Touch>;
                  })}
                  {/* Always last: propose a new interest; a typed search carries over as its name. */}
                  <Touch accessibilityLabel="Yeni ilgi alanı ekle" accessibilityState={{ expanded: proposalOpen }} onPress={() => { if (!proposalOpen && otherQuery.trim()) setProposalName(otherQuery.trim()); setProposalOpen(open => !open); }} style={[{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderStyle: "dashed" }, proposalOpen ? [ui.borderC8a44a50] : [ui.borderWhite10]]}><GlassFill radius={12} tint={proposalOpen ? "rgba(105,120,255,.16)" : undefined} />
                    <PlusIcon size={16} style={{ color: palette.accent }} />
                    <Label style={[[ui.textXs, ui.textWhite75, ui.fontMedium]]}>{otherQuery.trim() && !filteredOthers.length ? `"${otherQuery.trim()}" ekle` : "Yeni ilgi alanı"}</Label>
                  </Touch>
                </Box>
                </Box></Reveal>}
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

          {/* Step 1 - Level (only for interests with levels) and how many people, on one screen; "Devam Et" goes on. */}
          {step === 1 && <Box style={[[ui.spaceY5]]} enter>
              {levels.length > 0 && <Box>
              <Label style={[[ui.fontDisplay, ui.text2xl, ui.fontLight, ui.textWhite, ui.mb1]]}>
                Hangi seviyede oynanacak?
              </Label>
              <Label style={[[ui.textSm, ui.textWhite40, ui.mb3]]}>
                Katılımcılar buna göre katılır.
              </Label>
              {/* One row: signal bars show the level at a glance; the line below says who it suits. */}
              <Box style={{ flexDirection: "row", gap: 8 }} accessibilityRole="radiogroup">
                {levels.map(level => {
                  const selected = data.level === level.name;
                  const bars = LEVEL_BARS[level.enum] ?? 0;
                  return <Touch key={level.id} accessibilityRole="radio" accessibilityLabel={level.name} accessibilityState={{ selected }} onPress={() => setData(prev => ({ ...prev, level: level.name }))} style={[s.levelPill, selected ? [ui.borderC8a44a50] : [ui.borderWhite8]]}><GlassFill radius={14} tint={selected ? "rgba(105,120,255,.18)" : undefined} />
                    <Box style={s.bars}>
                      {[1, 2, 3].map(n => <Box key={n} style={[s.bar, { height: 4 + n * 4, backgroundColor: bars === 0 || n <= bars ? (selected ? palette.accent : "rgba(185,195,255,.45)") : "rgba(255,255,255,.10)" }]} />)}
                    </Box>
                    <Label numberOfLines={2} style={[s.levelLabel, { color: selected ? palette.accent : "rgba(241,245,249,.8)" }]}>{level.name}</Label>
                  </Touch>;
                })}
              </Box>
              <Label style={[[ui.textXs, ui.textWhite40], { marginTop: 8, minHeight: 16 }]}>
                {LEVEL_HINTS[levels.find(level => level.name === data.level)?.enum ?? ""] ?? "Bir seviye seç."}
              </Label>
              </Box>}

              <Box>
              <Label style={[[ui.fontDisplay, ui.text2xl, ui.fontLight, ui.textWhite, ui.mb1]]}>
                Kaç kişilik bir buluşma?
              </Label>
              <Label style={[[ui.textSm, ui.textWhite40, ui.mb3]]}>
                Minimuma ulaşınca sohbet odası açılır.
              </Label>
              {/* One card: the activity's usual formats as one-tap presets, then exact steppers for the minimum and the
                  optional maximum (tap a number to type it). */}
              <Box style={[[ui.glass, ui.rounded2xl], s.countCard]} glass>
                <Box style={s.presets}>
                  {countPresets(activities.find(a => a.name === data.activity)?.slug).map(([count, hint]) => {
                    const selected = data.minParticipants === count;
                    return <Touch key={count} accessibilityLabel={`${count} kişi${hint ? `, ${hint}` : ""}`} accessibilityState={{ selected }} onPress={() => setMinimum(count)} style={[s.preset, selected && s.presetActive]}>
                      <Label style={[s.presetCount, selected && { color: palette.accent }]}>{count}</Label>
                      {hint ? <Label numberOfLines={1} style={s.presetHint}>{hint}</Label> : null}
                    </Touch>;
                  })}
                </Box>
                <Box style={s.divider} />
                <CountStepper label="Minimum" value={data.minParticipants} min={MIN_PARTICIPANTS} max={MAX_PARTICIPANTS} onChange={setMinimum} />
                <Box style={s.divider} />
                <Box style={[[ui.flex, ui.itemsCenter, ui.justifyBetween]]}>
                  <Label style={[[ui.textSm, ui.textWhite60]]}>Maksimum</Label>
                  <Box style={s.segment}>
                    {([[false, "Sınır yok"], [true, "Sınır koy"]] as const).map(([limited, label]) => {
                      const selected = (data.maxParticipants !== null) === limited;
                      return <Touch key={label} accessibilityState={{ selected }} onPress={() => setData(p => ({ ...p, maxParticipants: limited ? Math.max(p.minParticipants, p.maxParticipants ?? 0) : null }))} style={[s.segmentItem, selected && s.segmentActive]}>
                        <Label style={[[ui.textXs, ui.fontMedium], { color: selected ? palette.accent : palette.muted }]}>{label}</Label>
                      </Touch>;
                    })}
                  </Box>
                </Box>
                {data.maxParticipants !== null && <CountStepper label="En fazla" value={data.maxParticipants} min={data.minParticipants} max={MAX_PARTICIPANTS}
                  onChange={value => setData(p => p.maxParticipants === null ? p : { ...p, maxParticipants: Math.min(MAX_PARTICIPANTS, Math.max(p.minParticipants, value)) })} />}
              </Box>
              <Label style={[[ui.textXs, ui.textWhite40], { marginTop: 8 }]}>
                {data.maxParticipants === null ? "Etkinlik başlayana kadar yeni katılımcılar katılabilir." : data.maxParticipants === data.minParticipants ? `Tam ${data.minParticipants} kişilik: dolunca katılım kapanır.` : `${data.minParticipants} kişide etkinlik başlar, ${data.maxParticipants} kişide katılım kapanır.`}
              </Label>
              </Box>
            </Box>}

          {/* Step 2 - Date, time & duration */}
          {step === 2 && <Box style={[[ui.spaceY5]]} enter>
              <Label style={[[ui.fontDisplay, ui.text2xl, ui.fontLight, ui.textWhite]]}>
                Ne zaman buluşuyorsunuz?
              </Label>
              <Box style={[[ui.flex, ui.gap3]]}>
              <GlassInput label="Tarih" value={data.date} onChangeText={e => setData(p => ({
            ...p,
            date: e
          }))} mode="date" />
              <GlassInput label="Başlangıç saati" value={data.time} onChangeText={e => setData(p => ({
            ...p,
            time: e
          }))} mode="time" />
              </Box>
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

          {/* Step 4 - Message to participants (how many people is asked with the level, step 1) */}
          {step === 4 && <Box style={[[ui.spaceY6]]} enter>
              <Box>
                <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite, ui.mb2]]}>
                  Katılımcılara ne{"\n"}söylemek istersin?
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
              {/* Required (new interest without stock images): a clear warning. Optional: we pick one for you. */}
              {coverRequired ? <Box accessibilityRole="alert" style={[[ui.rounded2xl, ui.p4], { borderWidth: 1, borderColor: missingCover ? "rgba(239,68,68,.45)" : "rgba(111,208,182,.4)", backgroundColor: missingCover ? "rgba(239,68,68,.10)" : "rgba(111,208,182,.08)", gap: 4 }]}>
                  <Label style={[[ui.textSm, ui.fontSemibold], { color: missingCover ? palette.error : palette.success }]}>{missingCover ? "Kapak fotoğrafı zorunlu" : "Kapak fotoğrafı eklendi"}</Label>
                  <Label style={[[ui.textXs, ui.textWhite60]]}>Bu yeni ilgi alanı için hazır görselimiz yok. Devam etmek için bir fotoğraf yüklemelisin.</Label>
                </Box> : <Box style={[[ui.rounded2xl, ui.p4], { borderWidth: 1, borderColor: "rgba(105,120,255,.3)", backgroundColor: "rgba(105,120,255,.08)", gap: 4 }]}>
                  <Label style={[[ui.textSm, ui.fontSemibold], { color: "#c7ceff" }]}>İsteğe bağlı</Label>
                  <Label style={[[ui.textXs, ui.textWhite60]]}>Fotoğraf yüklemezsen senin yerine biz etkinliğine uygun bir kapak görseli seçeriz.</Label>
                </Box>}

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
                Etkinliği kimlerin görebileceğini ve katılabileceğini seç.
              </Label>
              <Box style={[[ui.spaceY3]]}>
                {PRIVACIES.map(p => {
              const Icon = p.icon;
              const selected = data.privacy === p.label;
              return <Touch key={p.label} onPress={() => { if (p.enum === INVITE_ONLY) { chooseInviteOnly(p.label); setTimeout(next, 180); } else selectAndNext("privacy", p.label); }} style={[[ui.wFull, ui.p4, ui.rounded2xl, ui.flex, ui.itemsCenter, ui.gap4, ui.border, selected ? [ui.borderC8a44a50] : [ui.borderWhite8]]]}><GlassFill radius={16} tint={selected ? "rgba(105,120,255,.16)" : undefined} />
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
          <PrimaryButton onPress={step === 2 && customDurationOpen ? () => { setData(p => ({ ...p, durationMinutes: customMinutes })); next(); } : next} disabled={stepIncomplete}>
            Devam Et
          </PrimaryButton>
        </StickyBar>}
    </Box>;
}

/** Signal bars per level (0 = all levels, every bar lit) and who each level suits. */
const LEVEL_BARS: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3, all: 0 };
const LEVEL_HINTS: Record<string, string> = {
  beginner: "Yeni başlayanlar ve kuralları öğrenenler için; tempo rahat.",
  intermediate: "Düzenli yapanlar için; temel teknik oturmuş, oyun akıcı.",
  advanced: "Deneyimliler için; tempo ve rekabet yüksek.",
  all: "Her seviyeden katılımcı gelebilir; herkese uygun bir buluşma.",
};

/** Usual group sizes per activity (count, format), so most organizers pick theirs in one tap. */
const COUNT_PRESETS: Record<string, Array<[number, string]>> = {
  "hali-saha": [[10, "5'e 5"], [12, "6'ya 6"], [14, "7'ye 7"]],
  basketbol: [[6, "3'e 3"], [8, "4'e 4"], [10, "5'e 5"]],
  voleybol: [[8, "4'e 4"], [12, "6'ya 6"]],
  "plaj-voleybolu": [[4, "2'ye 2"], [8, "4'e 4"]],
  padel: [[4, "Çiftler"]],
  tenis: [[2, "Tekler"], [4, "Çiftler"]],
  squash: [[2, "Tekler"], [4, "Rotasyon"]],
  "masa-tenisi": [[2, "Tekler"], [4, "Çiftler"]],
  badminton: [[2, "Tekler"], [4, "Çiftler"]],
  pickleball: [[4, "Çiftler"]],
  "bowling-bilardo": [[4, "Bir şerit"], [6, ""], [8, "İki şerit"]],
  paintball: [[6, "3'e 3"], [10, "5'e 5"]],
  "go-kart": [[4, ""], [6, ""], [10, "Yarış"]],
  dart: [[2, "Tekler"], [4, "Çiftler"]],
  "kutu-oyunlari": [[3, ""], [4, ""], [6, ""]],
  quiz: [[4, "Bir takım"], [6, "Bir takım"]],
};
const DEFAULT_PRESETS: Array<[number, string]> = [[2, ""], [4, ""], [6, ""], [8, ""], [10, ""]];
const countPresets = (slug?: string) => (slug && COUNT_PRESETS[slug]) || DEFAULT_PRESETS;

/** An exact count: − and + step by one; tapping the number opens the keypad to type it (clamped on done). */
function CountStepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const typed = parseInt(draft, 10);
    if (!Number.isNaN(typed)) onChange(Math.min(max, Math.max(min, typed)));
    setDraft(null);
  };
  return <View style={cs.row}>
    <Label style={cs.label}>{label}</Label>
    <View style={cs.controls}>
      <Touch accessibilityLabel={`${label} azalt`} disabled={value <= min} onPress={() => onChange(value - 1)} style={[cs.step, value <= min && cs.stepDisabled]}>
        <Label style={cs.stepText}>−</Label>
      </Touch>
      {draft === null
        ? <Touch accessibilityLabel={`${label}: ${value} kişi. Elle girmek için dokun`} onPress={() => setDraft(String(value))} style={cs.valueBox}>
            <Label style={cs.value}>{value}</Label>
          </Touch>
        : <View style={[cs.valueBox, cs.valueEditing]}>
            <TextInput autoFocus value={draft} onChangeText={text => setDraft(text.replace(/\D/g, "").slice(0, 3))} onBlur={commit} onSubmitEditing={commit}
              keyboardType="number-pad" returnKeyType="done" selectTextOnFocus maxLength={3} style={[cs.value, cs.input]} accessibilityLabel={`${label} kişi sayısı`} />
          </View>}
      <Touch accessibilityLabel={`${label} artır`} disabled={value >= max} onPress={() => onChange(value + 1)} style={[cs.step, value >= max && cs.stepDisabled]}>
        <Label style={cs.stepText}>+</Label>
      </Touch>
    </View>
  </View>;
}

const cs = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  label: { color: "rgba(241,245,249,.6)", fontSize: 14 },
  controls: { flexDirection: "row", alignItems: "center", gap: 8 },
  step: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.06)", borderWidth: 1, borderColor: "rgba(255,255,255,.10)" },
  stepDisabled: { opacity: 0.35 },
  stepText: { color: palette.text, fontSize: 20, lineHeight: 24 },
  valueBox: { minWidth: 64, height: 40, paddingHorizontal: 8, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(105,120,255,.35)", backgroundColor: "rgba(105,120,255,.10)" },
  valueEditing: { borderColor: palette.blue },
  value: { color: palette.text, fontFamily: "Fraunces", fontSize: 20, lineHeight: 26 },
  // A single-line input with a line height sits low on iOS; drop it so the digits and cursor stay centred.
  input: { minWidth: 40, height: 38, padding: 0, lineHeight: undefined, textAlign: "center", textAlignVertical: "center" },
});

const s = StyleSheet.create({
  tile: { alignItems: "center", justifyContent: "center", gap: 6, minHeight: 72, paddingHorizontal: 4, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  tileLabel: { color: "rgba(241,245,249,.8)", fontSize: 11, lineHeight: 14, fontFamily: "Outfit-Medium", textAlign: "center" },
  levelPill: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 14, borderWidth: 1 },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 3, height: 16 },
  bar: { width: 5, borderRadius: 2 },
  levelLabel: { fontSize: 12, lineHeight: 15, fontFamily: "Outfit-SemiBold", textAlign: "center" },
  countCard: { padding: 16, gap: 12 },
  presets: { flexDirection: "row", gap: 8 },
  preset: { flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center", gap: 2, paddingHorizontal: 4, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,.08)", backgroundColor: "rgba(255,255,255,.04)" },
  presetActive: { borderColor: "rgba(105,120,255,.55)", backgroundColor: "rgba(105,120,255,.16)" },
  presetCount: { color: palette.text, fontFamily: "Fraunces", fontSize: 18, lineHeight: 22 },
  presetHint: { color: palette.muted, fontSize: 10, lineHeight: 12 },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,.08)" },
  segment: { flexDirection: "row", padding: 3, borderRadius: 12, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)" },
  segmentItem: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9 },
  segmentActive: { backgroundColor: "rgba(105,120,255,.18)" },
});
