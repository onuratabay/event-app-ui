import ActivityIndicator from "../components/LoadingSpinner";
import { palette } from "../theme/palette";
import { CategoryIcon } from "../components/Icons";
import { getApiErrorMessage, setFavorite } from "../api/client";
import { Alert, FlatList, Platform, RefreshControl } from "react-native";
import { useState } from "react";
import { Line, Path, Polyline } from "react-native-svg";
import RecommendationsSheet from "../recommendations/RecommendationsSheet";
import { BrandWordmark } from "../components/Brand";
import FeedHeaderBackdrop from "../components/FeedHeaderBackdrop";
import HeaderIconButton from "../components/HeaderIconButton";
import { HeartButton, RippleButton, SpringButton } from "../components/Expressive";
import { AtmoBackground, FilterChip } from "../components/GlassUI";
import { BellIcon, SearchIcon, SparklesIcon, ClockIcon, LocationIcon, ShareIcon } from "../components/Icons";
import { copyEvent, shareEvent as shareNativeEvent } from "../native/media";
import { EVENT_PHASE_LABEL, eventPhase, isLivePhase, isRoomReady, participantCount, useStore } from "../native/Store";
import { Box, Label, Picture, Scroll, Sheet, Touch, Vector } from "../native/UI";
import { ui } from "../theme/styles";
import { AppEvent, NavigateFn } from "../types";
import * as Location from "expo-location";
import { isOpenForFeed, sortFeed, type SortOption } from "../discover/sort";
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

/* ─── Share sheet ─── */
const SHARE_PLATFORMS = [{
  label: "WhatsApp",
  color: "#25D366",
  icon: <Vector width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <Path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
        <Path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.12 1.529 5.845L.057 23.617a.5.5 0 0 0 .63.63l5.772-1.472A11.947 11.947 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.944 9.944 0 0 1-5.073-1.388l-.364-.216-3.768.961.977-3.672-.236-.38A9.952 9.952 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
      </Vector>
}, {
  label: "Facebook",
  color: "#1877F2",
  icon: <Vector width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <Path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </Vector>
}, {
  label: "X",
  color: "#000000",
  icon: <Vector width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <Path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 5.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </Vector>
}, {
  label: "Mail",
  color: "#6B7280",
  icon: <Vector width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <Polyline points="22,6 12,13 2,6" />
      </Vector>
}];
function ShareSheet({
  event,
  onClose
}: {
  event: AppEvent;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    setCopied(await copyEvent(event));
    setTimeout(() => setCopied(false), 2000);
  };
  return <Sheet onClose={onClose} style={[[ui.fixed, ui.inset0, ui.z100, ui.flex, ui.flexCol, ui.justifyEnd]]}>
      <Box style={[[ui.fixed, ui.inset0], {
      backgroundColor: "rgba(0,0,0,0.6)"
    }]} glass />

      <Touch onPress={e => e.stopPropagation()} style={[[ui.relative, ui.roundedT28px, ui.overflowHidden], {
      backgroundColor: "rgba(10,10,22,0.92)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.10)",
      borderBottomWidth: 0,
      borderBottomColor: "transparent"
    }]} glass enter>
        {/* Liquid glass shimmer on sheet */}
        <Box style={[[ui.fixed, ui.inset0], {}]} gradient={["rgba(255,255,255,0.04)", "transparent", "rgba(105,120,255,0.03)"]} pointerEvents="none" />

        <Box style={[[ui.relative, ui.px5, ui.pt4, ui.pb10]]}>
          {/* Handle */}
          <Box style={[[ui.w10, ui.h1, ui.roundedFull, ui.bgWhite15, ui.mxAuto, ui.mb5]]} />

          {/* Event preview card */}
          <Box style={[[ui.rounded2xl, ui.overflowHidden, ui.mb5], {
          backgroundColor: palette.surface,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.09)"
        }]}>
            <Box style={[[ui.relative, ui.h28, ui.overflowHidden]]}>
              <Picture uri={event.coverImage} accessibilityLabel={event.title} style={[[ui.wFull, ui.hFull, ui.opacity80]]} />
              <Box style={[[ui.fixed, ui.inset0], {}]} gradient={["rgba(8,11,24,0.82)", "transparent"]} gradientDirection="up" />
              <Box style={[[ui.fixed, ui.bottom3, ui.left3]]}>
                <Label style={[[ui.fontDisplay, ui.textBase, ui.fontLight, ui.textWhite]]}>
                  {event.title}
                </Label>
                <Label style={[[ui.textXs, ui.textWhite50, ui.mt05]]}>
                  {event.date} · {event.time} · {event.location}
                </Label>
              </Box>
              <Box style={[[ui.fixed, ui.top3, ui.right3, ui.px2, ui.py05, ui.roundedFull, ui.text10px, ui.fontMedium, isLivePhase(eventPhase(event)) ? [ui.bgEmerald50020, ui.border, ui.borderEmerald40030, ui.textEmerald300] : [ui.bgAmber50015, ui.border, ui.borderAmber40025, ui.textAmber300]]]}>
                {eventPhase(event) === "forming" ? "◌ Bekleniyor" : EVENT_PHASE_LABEL[eventPhase(event)]}
              </Box>
            </Box>
          </Box>

          {/* Platform buttons */}
          <Box style={[[ui.grid, ui.gap3, ui.mb4]]} columns={4}>
            {SHARE_PLATFORMS.map(p => <Touch onPress={() => shareNativeEvent(event)} key={p.label} style={[[ui.flex, ui.flexCol, ui.itemsCenter, ui.gap2]]}>
                <Box style={[[ui.w14, ui.h14, ui.rounded2xl, ui.flex, ui.itemsCenter, ui.justifyCenter], {
              backgroundColor: `${p.color}20`,
              borderWidth: 1,
              borderColor: `${p.color}30`,
              color: p.color
            }]}>
                  {p.icon}
                </Box>
                <Label style={[[ui.text11px, ui.textWhite40]]}>{p.label}</Label>
              </Touch>)}
          </Box>

          {/* Copy link */}
          <Touch onPress={handleCopy} style={[[ui.wFull, ui.flex, ui.itemsCenter, ui.gap3, ui.px4, ui.py35, ui.rounded2xl], {
          backgroundColor: palette.surface,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.09)"
        }]}>
            <Box style={[[ui.w9, ui.h9, ui.roundedXl, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.flexShrink0], {
            backgroundColor: "rgba(105,120,255,0.10)",
            borderWidth: 1,
            borderColor: "rgba(105,120,255,0.15)"
          }]}>
              {copied ? <Vector width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={palette.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <Polyline points="20 6 9 17 4 12" />
                </Vector> : <Vector width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={palette.accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <Path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </Vector>}
            </Box>
            <Box style={[[ui.flex1, ui.textLeft, ui.minW0]]}>
              <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite70]]}>
                {copied ? "Kopyalandı!" : "Bağlantıyı Kopyala"}
              </Label>
              <Label style={[[ui.textXs, ui.textWhite25]]} numberOfLines={1}>
                Paylaşılabilir etkinlik bağlantısı
              </Label>
            </Box>
          </Touch>
        </Box>
      </Touch>
    </Sheet>;
}

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
      backgroundColor: "rgba(10,10,22,0.92)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.10)",
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
    setData
  } = useStore();
  const saved = event.isSaved;
  // Optimistic: the heart flips at once and the request runs in the background (no loader, taps never blocked).
  const setSaved = (value: boolean) => {
    setData(p => ({ ...p, events: p.events.map(e => e.id === event.id ? { ...e, isSaved: value } : e) }));
    const { done, isLatest } = setFavorite(event.id, value);
    done.catch(error => {
      // Only the newest tap decides; a failed older request is superseded by the later one.
      if (!isLatest()) return;
      setData(p => ({ ...p, events: p.events.map(e => e.id === event.id ? { ...e, isSaved: !value } : e) }));
      Alert.alert('Favori kaydedilemedi', getApiErrorMessage(error));
    });
  };
  const progress = event.currentParticipants / event.minParticipants;
  // Still gathering people only while below the minimum; status turns "started" later, at the start time.
  const isForming = !isRoomReady(event) && !['cancelled', 'closed'].includes(event.status || '');
  const fillRate = event.maxParticipants ? event.currentParticipants / event.maxParticipants : 0;
  const excitement = event.isActive && fillRate >= .7 ? "high" : event.isActive || fillRate >= .45 ? "medium" : "low";
  const energy = excitement === "high"
    ? { label: "Yüksek enerji", color: "#b9c3ff", border: "rgba(105,120,255,.25)", background: "rgba(105,120,255,.17)" }
    : excitement === "medium"
      ? { label: "Canlanıyor", color: "#a9a5ff", border: "rgba(160,156,245,.28)", background: "rgba(146,125,255,.13)" }
      : { label: "Sakin akış", color: "rgba(226,232,240,.68)", border: "rgba(226,232,240,.16)", background: "rgba(255,255,255,.06)" };
  return <Box style={[[], {}]} enter>
      <RippleButton onPress={onPress} rippleColor="rgba(255,255,255,0.06)" style={[[ui.wFull, ui.textLeft, ui.rounded2xl, ui.overflowHidden], {
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border
    }]} glass>
        {/* Cover */}
        <Box style={[[ui.relative, ui.h44, ui.overflowHidden, ui.bgGray900]]}>
          <Picture uri={event.coverImage} accessibilityLabel={event.title} style={[[ui.wFull, ui.hFull], {
          opacity: isForming ? 0.65 : 1
        }]} />
          <Box style={[[ui.fixed, ui.inset0], {}]} gradient={["rgba(8,11,24,0.9)", "transparent"]} gradientDirection="up" />

          {/* Status */}
          <Box style={[[ui.fixed, ui.top3, ui.left3]]}>
            <Box style={[[ui.px25, ui.py1, ui.roundedFull, ui.textXs, ui.fontMedium, isLivePhase(eventPhase(event)) ? [ui.textEmerald300] : [ui.textAmber300]], {
            backgroundColor: isLivePhase(eventPhase(event)) ? "rgba(52,211,153,0.15)" : "rgba(251,191,36,0.12)",
            borderWidth: 1,
            borderColor: isLivePhase(eventPhase(event)) ? "rgba(52,211,153,0.25)" : "rgba(251,191,36,0.2)"
          }]} glass>
              {EVENT_PHASE_LABEL[eventPhase(event)]}
            </Box>
          </Box>

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
            <Label style={[[ui.text10px, ui.px2, ui.py05, ui.roundedFull, ui.fontMedium], {
            backgroundColor: energy.background,
            color: energy.color,
            borderWidth: 1,
            borderColor: energy.border
          }]}>
              {energy.label}{event.level ? ` · ${event.level}` : ""}
            </Label>
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
            <Picture uri={event.host.avatar} accessibilityLabel={event.host.name} style={[[ui.w5, ui.h5, ui.roundedFull]]} />
            <Label style={[[ui.textXs, ui.textWhite30]]}>
              <Label style={[[ui.textWhite45]]}>{event.host.name}</Label>{" "}
              düzenliyor
            </Label>
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
  return <Vector width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="4" y1="6" x2="20" y2="6" />
      <Line x1="7" y1="12" x2="17" y2="12" />
      <Line x1="10" y1="18" x2="14" y2="18" />
    </Vector>;
}
export default function DiscoverScreen({
  navigate
}: Props) {
  const {
    data: store, refreshFeed, loadMoreFeedEvents, moreFeedEvents
  } = useStore();
  // Only the feed's own events; the shared list also holds joined/favourite events for Rooms.
  const feedIds = new Set(store.feedIds);
  const EVENTS = store.events.filter(event => feedIds.has(event.id));
  const [recommendationsOpen, setRecommendationsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState("Sana Özel");
  const [sortBy, setSortBy] = useState<SortOption>("recommended");
  // Distance sorts use where the user is right now; asked only when such a sort is chosen.
  const [deviceLocation, setDeviceLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const chooseSort = async (next: SortOption) => {
    if (next !== "distance-near" && next !== "distance-far") { setSortBy(next); return; }
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) { Alert.alert("Konum izni gerekli", "Mesafeye göre sıralamak için konum iznine ihtiyacımız var."); return; }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setDeviceLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      setSortBy(next);
    } catch { Alert.alert("Konum alınamadı", "Konum servislerini açıp tekrar dene."); }
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
  const sortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label ?? "Önerilen";
  const isCustomSort = sortBy !== "recommended";
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
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.overflowHidden]]}>
      <AtmoBackground />

      <Box style={[[ui.relative, ui.hFull, ui.flex, ui.flexCol, ui.overflowHidden]]}>
        {/* Events */}
        <EventList
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: isCustomSort ? 160 : 112, paddingHorizontal: 20, paddingBottom: 112, flexGrow: visibleEvents.length ? 0 : 1 }}
          data={sortedEvents}
          keyExtractor={event => event.id}
          renderItem={({ item: event, index }) => <Box style={{ marginBottom: 16 }}><EventCard event={event} index={index} onPress={() => navigate("event-detail", {
            eventId: event.id
          })} onShare={() => setShareEvent(event)} /></Box>}
          ListEmptyComponent={<Box style={{ padding: 20, gap: 12 }}><Label>Henüz gösterilecek etkinlik yok.</Label><Touch onPress={() => { void refreshFeed().catch(() => {}); }}><Label>Yenile</Label></Touch></Box>}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={palette.accent} style={{ paddingVertical: 20 }} /> : null}
          refreshControl={<RefreshControl refreshing={pullRefreshing} onRefresh={() => { void pullToRefresh(); }} tintColor={palette.accent} colors={[palette.accent]} progressBackgroundColor={palette.surface} progressViewOffset={isCustomSort ? 160 : 112} />}
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
        <Box style={{ height: 68, paddingHorizontal: 12, flexDirection: "row", alignItems: "center" }} enter>
          <Box style={{ width: 88, flexDirection: "row" }}>
            <HeaderIconButton plain label="Ara" onPress={() => navigate("search")}><SearchIcon size={20} strokeWidth={1.8} style={{ color: "#f4f5ff" }} /></HeaderIconButton>
            <HeaderIconButton plain label="Sıralama ve filtre" selected={isCustomSort} onPress={() => setSortOpen(true)}>
              <Box style={{ color: isCustomSort ? "#c7ceff" : "#f4f5ff" }}><SortIcon active={isCustomSort} /></Box>
            </HeaderIconButton>
          </Box>
          <Box pointerEvents="none" style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <BrandWordmark width={104} />
          </Box>
          <Box style={{ width: 88, flexDirection: "row" }}>
            <HeaderIconButton plain label="Sana özel öneriler" onPress={() => setRecommendationsOpen(true)}><SparklesIcon size={20} strokeWidth={1.8} style={{ color: "#c7ceff" }} /></HeaderIconButton>
            <HeaderIconButton plain label="Bildirimler" onPress={() => navigate("notifications")}><BellIcon size={20} strokeWidth={1.8} style={{ color: "#f4f5ff" }} /></HeaderIconButton>
          </Box>
        </Box>

        {/* Filter row + sort */}
        <Box style={[[ui.px5, ui.pb3]]} enter>
          {isCustomSort && <Box glass style={[[ui.flex, ui.itemsCenter, ui.justifyBetween, ui.px3, ui.roundedXl, ui.mb2], {
            width: 156,
            height: 44,
            backgroundColor: "rgba(105,120,255,.13)",
            borderWidth: 1,
            borderColor: "rgba(185,195,255,.32)",
          }]}>
            <Label style={[[ui.text10px, ui.fontMedium, ui.textC8a44a70]]} numberOfLines={1}>{sortLabel}</Label>
            <Touch accessibilityLabel="Sıralamayı temizle" onPress={() => setSortBy("recommended")} style={[[ui.text10px, ui.textWhite55], { paddingLeft: 8 }]}>Temizle</Touch>
          </Box>}
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
      {shareEvent && <ShareSheet event={shareEvent} onClose={() => setShareEvent(null)} />}

      {recommendationsOpen && <RecommendationsSheet navigate={navigate} onClose={() => setRecommendationsOpen(false)} />}
    </Box>;
}
