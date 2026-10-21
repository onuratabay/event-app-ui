import EventShareSheet from "../components/EventShareSheet";
import { showAlert } from "../components/AppDialog";
import NotificationButton from "../components/NotificationButton";
import ActivityIndicator from "../components/LoadingSpinner";
import { palette } from "../theme/palette";
import { CategoryIcon } from "../components/Icons";
import { getApiErrorMessage, setFavorite } from "../api/client";
import { FlatList, Platform, RefreshControl, useWindowDimensions } from "react-native";
import { useState } from "react";
import { Line, Path, Polyline } from "react-native-svg";
import { BrandWordmark } from "../components/Brand";
import FeedHeaderBackdrop from "../components/FeedHeaderBackdrop";
import HeaderIconButton from "../components/HeaderIconButton";
import { HeartButton, RippleButton, SpringButton } from "../components/Expressive";
import FeedAdCard from "../ads/FeedAdCard";
import { adsModule, nativeUnitId, withAdSlots } from "../ads/ads";
import { AtmoBackground, FilterChip } from "../components/GlassUI";
import { CalendarIcon, SearchIcon, ClockIcon, LocationIcon, ShareIcon } from "../components/Icons";
import { eventPhase, isRoomReady, participantCount, useStore, type EventPhase } from "../native/Store";
import { Box, Label, Picture, Scroll, Sheet, Touch, Vector } from "../native/UI";
import { ui } from "../theme/styles";
import { AppEvent, NavigateFn } from "../types";
import * as Location from "expo-location";
import { isOpenForFeed, sortFeed, type SortOption } from "../discover/sort";
import DiscoverEmptyState from "../components/DiscoverEmptyState";
interface Props {
  navigate: NavigateFn;
}
const EventList = (FlatList || ((props: any) => <Scroll style={[[ui.flex1]]}>
  {(props.data || []).length
    ? props.data.map((item: AppEvent, index: number) => <Box key={item.id}>{props.renderItem({ item, index, separators: {} })}</Box>)
    : props.ListEmptyComponent}
  {props.ListFooterComponent}
</Scroll>)) as typeof FlatList;
const FILTERS = [{
  label: "Sana Özel",
  emoji: "✦"
}, {
  label: "Bugün"
}, {
  label: "Bu Hafta"
}, {
  label: "Yakınımda"
}, {
  label: "Padel"
}, {
  label: "Outdoor"
}, {
  label: "Sanat"
}, {
  label: "Konser"
}];
const SORT_OPTIONS: {
  value: SortOption;
  label: string;
  sub?: string;
}[] = [{
  value: "recommended",
  label: "Önerilen",
  sub: "Sana özel sıralama"
}, {
  value: "mine",
  label: "Senin etkinliklerin",
  sub: "Yalnızca oluşturduğun etkinlikler"
}, {
  value: "time-asc",
  label: "En Yakın Zaman",
  sub: "Önce bugün"
}, {
  value: "time-desc",
  label: "En Uzak Zaman",
  sub: "İleri tarihliler önce"
}, {
  value: "distance-near",
  label: "En Yakın Mesafe",
  sub: "Sana en yakın"
}, {
  value: "distance-far",
  label: "En Uzak Mesafe",
  sub: "Uzaktakiler önce"
}];

/* ─── Sort sheet ─── */
function SortSheet({
  current,
  onChange,
  onClose
}: {
  current: SortOption;
  onChange: (v: SortOption) => void;
  onClose: () => void;
}) {
  return <Sheet onClose={onClose} style={[[ui.fixed, ui.inset0, ui.z90, ui.flex, ui.flexCol, ui.justifyEnd]]}>
      <Box style={[[ui.fixed, ui.inset0], {
      backgroundColor: "rgba(0,0,0,0.5)"
    }]} glass />
      <Touch onPress={e => e.stopPropagation()} style={[[ui.relative, ui.roundedT28px, ui.overflowHidden], {
      backgroundColor: palette.glassSheet,
      borderWidth: 1,
      borderColor: palette.glassBorder,
      borderBottomWidth: 0,
      borderBottomColor: "transparent"
    }]} glass enter>
        <Box style={[[ui.fixed, ui.inset0], {}]} gradient={["rgba(255,255,255,0.03)", "transparent"]} pointerEvents="none" />
        <Box style={[[ui.relative, ui.px5, ui.pt4, ui.pb10]]}>
          <Box style={[[ui.w10, ui.h1, ui.roundedFull, ui.bgWhite15, ui.mxAuto, ui.mb5]]} />
          <Label style={[[ui.textXs, ui.textWhite30, ui.uppercase, ui.trackingWidest, ui.mb4]]}>
            Sıralama
          </Label>
          <Box style={[[ui.spaceY15]]}>
            {SORT_OPTIONS.map(opt => <Touch key={opt.value} onPress={() => {
            onChange(opt.value);
            onClose();
          }} style={[[ui.wFull, ui.flex, ui.itemsCenter, ui.justifyBetween, ui.px4, ui.py35, ui.rounded2xl, ui.textLeft], {
            backgroundColor: current === opt.value ? "rgba(105,120,255,0.10)" : "rgba(255,255,255,0.04)",
            borderWidth: 1,
            borderColor: current === opt.value ? "rgba(105,120,255,0.25)" : "rgba(255,255,255,0.07)"
          }]}>
                <Box>
                  <Label style={[[ui.textSm, ui.fontMedium, current === opt.value ? [ui.textC8a44a] : [ui.textWhite70]]]}>
                    {opt.label}
                  </Label>
                  {opt.sub && <Label style={[[ui.textXs, ui.textWhite30, ui.mt05]]}>
                      {opt.sub}
                    </Label>}
                </Box>
                {current === opt.value && <Vector width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={palette.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <Polyline points="20 6 9 17 4 12" />
                  </Vector>}
              </Touch>)}
          </Box>
        </Box>
      </Touch>
    </Sheet>;
}

/* ─── Event card ─── */
// The card shows no status text; screen readers still hear the event's state.
const PHASE_A11Y: Record<EventPhase, string> = { started: "başladı", active: "aktif", forming: "katılımcı bekleniyor", cancelled: "iptal edildi", closed: "sona erdi" };
function EventCard({
  event,
  onPress,
  onShare
}: {
  event: AppEvent;
  onPress: () => void;
  onShare: () => void;
  index: number;
}) {
  const {
    data: store,
    setData
  } = useStore();
  // My own events say "Sen" instead of my name, so they stand out in the feed.
  const mine = !!store.user.id && event.host.id === store.user.id;
  const saved = event.isSaved;
  // Optimistic: the heart flips at once and the request runs in the background (no loader, taps never blocked).
  const setSaved = (value: boolean) => {
    setData(p => ({ ...p, events: p.events.map(e => e.id === event.id ? { ...e, isSaved: value } : e) }));
    const { done, isLatest } = setFavorite(event.id, value);
    done.catch(error => {
      // Only the newest tap decides; a failed older request is superseded by the later one.
      if (!isLatest()) return;
      setData(p => ({ ...p, events: p.events.map(e => e.id === event.id ? { ...e, isSaved: !value } : e) }));
      showAlert('Favori kaydedilemedi', getApiErrorMessage(error));
    });
  };
  const progress = event.currentParticipants / event.minParticipants;
  // Still gathering people only while below the minimum; status turns "started" later, at the start time.
  const isForming = !isRoomReady(event) && !['cancelled', 'closed'].includes(event.status || '');
  const phase = eventPhase(event);
  return <Box style={[[], {}]}>
      <RippleButton onPress={onPress} accessibilityLabel={`${event.title}, ${PHASE_A11Y[phase]}`} rippleColor="rgba(255,255,255,0.06)" style={[[ui.wFull, ui.textLeft, ui.rounded2xl, ui.overflowHidden], {
      backgroundColor: palette.glassCard,
      borderWidth: 1,
      borderColor: palette.glassBorder
    }]} glass>
        {/* Cover */}
        <Box style={[[ui.relative, ui.h44, ui.overflowHidden, ui.bgGray900]]}>
          <Picture uri={event.coverImage} accessibilityLabel={event.title} style={[[ui.wFull, ui.hFull], {
          opacity: isForming ? 0.65 : 1
        }]} />
          <Box style={[[ui.fixed, ui.inset0], {}]} gradient={["rgba(8,11,24,0.9)", "transparent"]} gradientDirection="up" />

          {/* Action buttons */}
          <Touch onPress={e => e.stopPropagation()} style={[[ui.fixed, ui.top3, ui.right3, ui.flex, ui.gap2]]}>
            <SpringButton onPress={onShare} style={[[ui.w11, ui.h11, ui.roundedFull, ui.flex, ui.itemsCenter, ui.justifyCenter], {
            backgroundColor: "rgba(0,0,0,0.45)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)"
          }]} glass>
              <ShareIcon size={19} strokeWidth={1.75} style={[[ui.textWhite65]]} />
            </SpringButton>
            <Box style={[[ui.w11, ui.h11, ui.roundedFull, ui.flex, ui.itemsCenter, ui.justifyCenter], {
            backgroundColor: "rgba(0,0,0,0.45)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)"
          }]} glass>
              <HeartButton saved={saved} onChange={setSaved} size={14} />
            </Box>
          </Touch>

          {/* Category */}
          <Box style={[[ui.fixed, ui.bottom3, ui.left3]]}>
            <Box style={[[ui.flex, ui.itemsCenter, ui.gap2]]}><CategoryIcon name={event.category} size={15} style={{ color: "#b9c3ff" }} /><Label style={[[ui.textXs, ui.textWhite70, ui.fontMedium]]}>{event.category}</Label></Box>
          </Box>
        </Box>

        {/* Content */}
        <Box style={[[ui.p4]]}>
          <Label style={[[ui.fontDisplay, ui.textLg, ui.fontLight, ui.textWhite, ui.leadingTight]]}>
            {event.title}
          </Label>

          <Box style={[[ui.mt2, ui.flex, ui.flexWrap, ui.gapX3, ui.gapY1]]}>
            <Box style={[[ui.textXs, ui.textWhite45, ui.flex, ui.itemsCenter, ui.gap15]]}>
              <ClockIcon size={11} strokeWidth={1.75} style={[[ui.textC8a44a55]]} />
              {event.date} · {event.time}
            </Box>
            <Box style={[[ui.textXs, ui.textWhite45, ui.flex, ui.itemsCenter, ui.gap15]]}>
              <LocationIcon size={11} strokeWidth={1.75} style={[[ui.textC8a44a55]]} />
              {event.location}
            </Box>
            <Label style={[[ui.textXs, ui.textWhite25]]}>
              {event.distance}
            </Label>
          </Box>

          <Box style={[[ui.mt3, ui.flex, ui.itemsCenter, ui.justifyBetween]]}>
            <Box style={[[ui.flex, ui.itemsCenter, ui.gap2]]}>
              <Box style={[[ui.flex]]}>
                {event.participants.slice(0, 3).map(p => <Picture key={p.id} uri={p.avatar} accessibilityLabel={p.name} style={[[ui.w6, ui.h6, ui.roundedFull]]} />)}
                {event.participants.length > 3 && <Box style={[[ui.w6, ui.h6, ui.roundedFull, ui.bgWhite10, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.text9px, ui.textWhite40]]}>
                    +{event.participants.length - 3}
                  </Box>}
              </Box>
              <Label style={[[ui.textXs, ui.textWhite40]]}>
                {participantCount(event.currentParticipants, event.maxParticipants)} kişi
              </Label>
            </Box>
            {event.level ? <Label style={[[ui.textXs, ui.textWhite40]]}>{event.level}</Label> : null}
          </Box>

          {isForming && <Box style={[[ui.mt3]]}>
              <Box style={[[ui.h1, ui.roundedFull, ui.bgWhite6, ui.overflowHidden]]}>
                <Box style={[[ui.hFull, ui.roundedFull], {
              width: `${Math.min(progress * 100, 100)}%`
            }]} gradient={["#4d5bcb", "#6651c9"]} gradientDirection="right" />
              </Box>
              <Label style={[[ui.textXs, ui.textAmber30060, ui.mt1]]}>
                Aktif olmak için{" "}
                {Math.max(0, event.minParticipants - event.currentParticipants)} kişi daha
                gerekiyor
              </Label>
            </Box>}

          <Box style={[[ui.mt3, ui.flex, ui.itemsCenter, ui.gap2, ui.pt3, ui.borderT, ui.borderWhite5]]}>
            {mine ? <Box style={{ width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(105,120,255,.22)" }}>
                <Label style={{ color: palette.accent, fontSize: 8, lineHeight: 10, fontFamily: "Outfit-SemiBold" }}>Sen</Label>
              </Box> : <Picture uri={event.host.avatar} accessibilityLabel={event.host.name} style={[[ui.w5, ui.h5, ui.roundedFull]]} />}
            {mine ? <Label style={[[ui.textXs], { color: palette.accent, fontFamily: "Outfit-SemiBold" }]}>Sen düzenliyorsun</Label> : <Label style={[[ui.textXs, ui.textWhite30]]}>
              <Label style={[[ui.textWhite45]]}>{event.host.name}</Label>{" "}
              düzenliyor
            </Label>}
          </Box>
        </Box>
      </RippleButton>
    </Box>;
}

/* ─── Sort icon ─── */
function SortIcon({
  active
}: {
  active: boolean;
}) {
  return <Vector width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="4" y1="6" x2="20" y2="6" />
      <Line x1="7" y1="12" x2="17" y2="12" />
      <Line x1="10" y1="18" x2="14" y2="18" />
    </Vector>;
}
export default function DiscoverScreen({
  navigate
}: Props) {
  // Three 44pt actions per side; the wordmark shrinks on narrow phones so it stays centered.
  const { width: screenWidth } = useWindowDimensions();
  const wordmarkWidth = Math.max(64, Math.min(104, screenWidth - 2 * (12 + 132)));
  const {
    data: store, refreshFeed, loadMoreFeedEvents, moreFeedEvents
  } = useStore();
  // Only the feed's own events; the shared list also holds joined/favourite events for Rooms.
  const feedIds = new Set(store.feedIds);
  const [activeFilter, setActiveFilter] = useState("Sana Özel");
  const [sortBy, setSortBy] = useState<SortOption>("recommended");
  // "Senin etkinliklerin": the user's own events, which come from their own list (the feed may leave them out).
  const EVENTS = sortBy === "mine"
    ? store.events.filter(event => !!store.user.id && event.host.id === store.user.id)
    // An invite-only event you organize or accepted shows at once (the next feed load brings it too).
    : store.events.filter(event => feedIds.has(event.id) || event.inviteOnly && (event.joined || !!store.user.id && event.host.id === store.user.id));
  // Distance sorts use where the user is right now; asked only when such a sort is chosen.
  const [deviceLocation, setDeviceLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const chooseSort = async (next: SortOption) => {
    if (next !== "distance-near" && next !== "distance-far") { setSortBy(next); return; }
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) { showAlert("Konum izni gerekli", "Mesafeye göre sıralamak için konum iznine ihtiyacımız var."); return; }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setDeviceLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      setSortBy(next);
    } catch { showAlert("Konum alınamadı", "Konum servislerini açıp tekrar dene."); }
  };
  const [sortOpen, setSortOpen] = useState(false);
  const [shareEvent, setShareEvent] = useState<AppEvent | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const visibleEvents = EVENTS.filter(e => isOpenForFeed(e)).filter(e => {
    if (activeFilter === "Padel" || activeFilter === "Konser") return e.category === activeFilter;
    if (activeFilter === "Outdoor") return ["Hiking", "Koşu", "Outdoor"].includes(e.category);
    if (activeFilter === "Sanat") return ["Fotoğraf", "Fotoğrafçılık", "Sanat"].includes(e.category);
    const parts = e.date.split('/').map(Number);
    const day = new Date(parts[2], parts[1] - 1, parts[0]);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (activeFilter === "Bugün") return day.getTime() === today.getTime();
    if (activeFilter === "Bu Hafta") return day >= today && day.getTime() < today.getTime() + 7 * 86400000;
    if (activeFilter === "Yakınımda") return parseFloat(e.distance.replace(",", ".")) <= 5;
    return true;
  });
  const sortedEvents = sortFeed(visibleEvents, sortBy, { interests: store.user.interests, location: deviceLocation });
  const isCustomSort = sortBy !== "recommended";
  // Native ads sit between event cards (see withAdSlots); where ads cannot run (Expo Go, no ad unit) the list is events only.
  const feedItems = withAdSlots(sortedEvents, !!adsModule() && !!nativeUnitId());
  // Pull down reloads only the feed (/events); account and personal lists load elsewhere.
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const pullToRefresh = async () => {
    if (pullRefreshing) return;
    setPullRefreshing(true);
    try { await refreshFeed(); } catch { /* The store already shows a retryable error notice. */ }
    finally { setPullRefreshing(false); }
  };
  const handleLoadMore = async () => {
    if (loadingMore || !moreFeedEvents) return;
    setLoadingMore(true);
    try { await loadMoreFeedEvents(); }
    finally { setLoadingMore(false); }
  };
  // Every tab press opens a fresh Discover page, so nothing fades in from transparent: header, filters and
  // cards show on the first frame (a 400 ms fade on each made the switch look like a one-second blank).
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.overflowHidden]]}>
      <AtmoBackground />

      <Box style={[[ui.relative, ui.hFull, ui.flex, ui.flexCol, ui.overflowHidden]]}>
        {/* Events */}
        <EventList
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: 112, paddingHorizontal: 20, paddingBottom: 112, flexGrow: visibleEvents.length ? 0 : 1 }}
          data={feedItems}
          keyExtractor={item => item.id}
          renderItem={({ item: event, index }) => "ad" in event ? <FeedAdCard /> : <Box style={{ marginBottom: 16 }}><EventCard event={event} index={index} onPress={() => navigate("event-detail", {
            eventId: event.id
          })} onShare={() => setShareEvent(event)} /></Box>}
          ListEmptyComponent={!store.feedLoaded ? <ActivityIndicator color={palette.accent} style={{ paddingVertical: 48 }} /> : <DiscoverEmptyState interests={store.user.interests} filterLabel={sortBy === "mine" ? "Senin etkinliklerin" : activeFilter !== "Sana Özel" && EVENTS.some(isOpenForFeed) ? activeFilter : undefined}
            onClearFilter={() => { setActiveFilter("Sana Özel"); setSortBy("recommended"); }} onCreate={activity => navigate("create-event", activity ? { activity } : undefined)} />}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={palette.accent} style={{ paddingVertical: 20 }} /> : null}
          // The app-wide event loader (ApiLoadingOverlay) covers the refresh, so the native spinner is hidden:
          // transparent on iOS, and on Android parked above the screen so its circle never slides in.
          refreshControl={<RefreshControl refreshing={pullRefreshing} onRefresh={() => { void pullToRefresh(); }} tintColor="transparent" colors={["transparent"]} progressBackgroundColor="transparent" progressViewOffset={Platform.OS === "android" ? -200 : 112} />}
          onEndReached={() => { void handleLoadMore(); }}
          onEndReachedThreshold={0.45}
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          updateCellsBatchingPeriod={40}
          windowSize={7}
          removeClippedSubviews={Platform.OS === "android"}
          showsVerticalScrollIndicator={false}
        />

        {/* Symmetric action groups keep the wordmark at the screen center. */}
        <Box style={[[ui.fixed, ui.top0, ui.left0, ui.right0, ui.z40]]}>
        <FeedHeaderBackdrop />
        <Box style={{ height: 68, paddingHorizontal: 12, flexDirection: "row", alignItems: "center" }}>
          <Box style={{ width: 132, flexDirection: "row" }}>
            <HeaderIconButton plain label="Ara" onPress={() => navigate("search")}><SearchIcon size={20} strokeWidth={1.8} style={{ color: "#f4f5ff" }} /></HeaderIconButton>
            <HeaderIconButton walkthroughId="discover-sort" plain label="Sıralama ve filtre" selected={isCustomSort} onPress={() => setSortOpen(true)}>
              <Box style={{ color: isCustomSort ? "#c7ceff" : "#f4f5ff" }}><SortIcon active={isCustomSort} /></Box>
            </HeaderIconButton>
          </Box>
          <Box pointerEvents="none" style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <BrandWordmark width={wordmarkWidth} />
          </Box>
          <Box style={{ width: 132, flexDirection: "row", justifyContent: "flex-end" }}>
            <HeaderIconButton walkthroughId="discover-calendar" plain label="Etkinlik Takvimim" onPress={() => navigate("availability")}><CalendarIcon size={20} strokeWidth={1.8} style={{ color: "#f4f5ff" }} /></HeaderIconButton>
            <NotificationButton onPress={() => navigate("notifications")} />
          </Box>
        </Box>

        {/* Filter row */}
        <Box walkthroughId="discover-filters" style={[[ui.px5, ui.pb3]]}>
          <Box style={[[ui.flex, ui.itemsCenter, ui.gap2]]}>
            {/* Scrollable filters */}
            <Scroll style={[[ui.flex, ui.gap2, ui.pb05, ui.flex1, ui.minW0]]} horizontal>
              {FILTERS.map(f => <FilterChip key={f.label} label={f.label} emoji={f.emoji} selected={activeFilter === f.label} onPress={() => setActiveFilter(f.label)} />)}
            </Scroll>
          </Box>

        </Box>
        </Box>
      </Box>

      {/* Sort sheet */}
      {sortOpen && <SortSheet current={sortBy} onChange={next => { void chooseSort(next); }} onClose={() => setSortOpen(false)} />}

      {/* Share sheet — z above everything */}
      {shareEvent && <EventShareSheet event={shareEvent} onClose={() => setShareEvent(null)} />}

    </Box>;
}
