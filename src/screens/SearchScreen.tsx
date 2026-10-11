import { palette } from "../theme/palette";
import { useBottomNavInset } from "../components/BottomNav";
import { CloseIcon } from "../components/Icons";
import { useEffect, useRef, useState } from "react";
import { TextInput } from "react-native";
import { AtmoBackground } from "../components/GlassUI";
import { ClockIcon, SearchIcon } from "../components/Icons";
import TopNavBar from "../components/TopNavBar";
import { EVENT_PHASE_LABEL, eventPhase, isLivePhase, mapApiEvent, useStore } from "../native/Store";
import { getApiErrorMessage, searchEventsByDate } from "../api/client";
import { apiDate, localDate } from "../map/filters";
import { GlassInput } from "../components/GlassUI";
import { Box, Field, Label, Picture, Scroll, Touch } from "../native/UI";
import { ui } from "../theme/styles";
import { AppEvent, NavigateFn } from "../types";
interface Props {
  navigate: NavigateFn;
}
const SUGGESTED = ["Padel maçı", "Kahve buluşması", "Hiking turu", "Fotoğraf yürüyüşü", "Elektronik müzik", "Yoga dersi", "Bisiklet turu", "Teknoloji buluşması"];
const RECENT = ["Padel After Work", "Sunday Hiking"];
function EventRow({
  event,
  onPress
}: {
  event: AppEvent;
  onPress: () => void;
}) {
  return <Touch onPress={onPress} style={[[ui.wFull, ui.flex, ui.itemsCenter, ui.gap3, ui.py3, ui.textLeft, ui.roundedXl, ui.px2, ui.Mx2]]}>
      <Box style={[[ui.w10, ui.h10, ui.roundedXl, ui.overflowHidden, ui.flexShrink0, ui.bgWhite5]]}>
        <Picture uri={event.coverImage} accessibilityLabel={event.title} style={[[ui.wFull, ui.hFull, ui.opacity80]]} />
      </Box>
      <Box style={[[ui.flex1, ui.minW0]]}>
        <Label style={[[ui.textSm, ui.textWhite80, ui.fontMedium]]} numberOfLines={1}>
          {event.title}
        </Label>
        <Box style={[[ui.flex, ui.itemsCenter, ui.gap2, ui.mt05]]}>
          <ClockIcon size={11} strokeWidth={1.75} style={[[ui.textWhite25]]} />
          <Label style={[[ui.textXs, ui.textWhite35]]} numberOfLines={1}>
            {event.date} · {event.location}
          </Label>
        </Box>
      </Box>
      <Label style={[[ui.text10px, ui.flexShrink0, isLivePhase(eventPhase(event)) ? [ui.textEmerald400] : [ui.textAmber400]]]}>
        {eventPhase(event) === "forming" ? "◌ Bekleniyor" : EVENT_PHASE_LABEL[eventPhase(event)]}
      </Label>
    </Touch>;
}
export default function SearchScreen({
  navigate
}: Props) {
  const navInset = useBottomNavInset();
  const {
    data: store,
    setData: setStore
  } = useStore();
  const [query, setQuery] = useState("");
  // Date range filter (YYYY-MM-DD). The start can never be before today; the end never before the start.
  const today = localDate(new Date());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateError, setDateError] = useState("");
  const [dateResults, setDateResults] = useState<AppEvent[] | null>(null);
  const [loadingDates, setLoadingDates] = useState(false);
  const chooseFrom = (value: string) => {
    if (value < today) { setDateError("Başlangıç tarihi bugünden önce olamaz."); return; }
    setDateError(""); setDateFrom(value);
    if (dateTo && dateTo < value) setDateTo("");
  };
  const chooseTo = (value: string) => {
    if (value < (dateFrom || today)) { setDateError(dateFrom ? "Bitiş tarihi başlangıçtan önce olamaz." : "Bitiş tarihi bugünden önce olamaz."); return; }
    setDateError(""); setDateTo(value);
  };
  const clearDates = () => { setDateFrom(""); setDateTo(""); setDateError(""); };
  const dateActive = Boolean(dateFrom || dateTo);
  // With a date range the server is asked (all events, not only the loaded ones).
  useEffect(() => {
    if (!dateActive) { setDateResults(null); return; }
    let active = true;
    setLoadingDates(true);
    searchEventsByDate(apiDate(dateFrom || today), dateTo ? apiDate(dateTo) : undefined).then(result => {
      if (!active) return;
      const found = result.items.map(mapApiEvent);
      // Keep them in the shared list so the detail screen can open them (not added to the Discover feed).
      setStore(p => ({ ...p, events: [...new Map([...p.events, ...found].map(event => [event.id, event])).values()] }));
      setDateResults(found);
    }).catch(error => { if (active) setDateError(getApiErrorMessage(error, "Etkinlikler aranamadı.")); })
      .finally(() => { if (active) setLoadingDates(false); });
    return () => { active = false; };
  }, [dateFrom, dateTo]);
  const EVENTS = dateResults ?? store.events;
  const searching = Boolean(query.trim()) || dateActive;
  // No autofocus: the keyboard opens only when the user taps the search box.
  const inputRef = useRef<TextInput>(null);
  const filtered = !searching ? [] : !query.trim() ? EVENTS : EVENTS.filter(e => e.title.toLowerCase().includes(query.toLowerCase()) || e.category.toLowerCase().includes(query.toLowerCase()) || e.location.toLowerCase().includes(query.toLowerCase()));
  const suggestions = query.trim() ? SUGGESTED.filter(s => s.toLowerCase().includes(query.toLowerCase())) : SUGGESTED;
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.flex, ui.flexCol, ui.overflowHidden]]}>
      <AtmoBackground />
      <TopNavBar navigate={navigate} fallback="discover" title="Ara" />

      {/* Search bar */}
      <Box style={[[ui.relative, ui.px5, ui.pb3, ui.flexShrink0], { paddingTop: 80 }]} enter>
        <Box style={[[ui.flex, ui.itemsCenter, ui.gap3, ui.rounded2xl, ui.px4, ui.py35], {
        backgroundColor: "rgba(255,255,255,0.07)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.11)"
      }]} glass>
          <SearchIcon size={16} strokeWidth={1.75} style={[[ui.flexShrink0, ui.textWhite30]]} />
          <Field ref={inputRef} value={query} onChangeText={e => setQuery(e)} placeholder="Etkinlik, aktivite veya konum ara..." style={[[ui.flex1, ui.bgTransparent, ui.textSm, ui.textWhite]]} />
          {query && <Touch onPress={() => setQuery("")} style={[[ui.flexShrink0, ui.w5, ui.h5, ui.roundedFull, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.textWhite30], {
          backgroundColor: "rgba(255,255,255,0.08)"
        }]}>
              <CloseIcon size={16} style={{ color: palette.muted }} />
            </Touch>}
        </Box>
      </Box>

      {/* Date range */}
      <Box style={[[ui.px5, ui.pb3, ui.flexShrink0]]}>
        <Box style={[[ui.flex, ui.gap3]]}>
          <GlassInput label="Başlangıç" mode="date" value={dateFrom} defaultValue={today} onChangeText={chooseFrom} />
          <GlassInput label="Bitiş" mode="date" value={dateTo} defaultValue={dateFrom || today} onChangeText={chooseTo} />
        </Box>
        {!!dateError && <Label style={[[ui.textXs, ui.mt15], { color: palette.error }]}>{dateError}</Label>}
        {dateActive && <Touch accessibilityLabel="Tarih filtresini temizle" onPress={clearDates} style={[[ui.textXs, ui.textWhite40, ui.mt15], { alignSelf: "flex-start", minHeight: 32, textAlign: "left" }]}>Tarih filtresini temizle</Touch>}
      </Box>

      <Scroll style={[[ui.flex1, ui.px5, ui.pb10], { paddingBottom: 40 + navInset }]}>
        {/* No query — recent + suggestions */}
        {!searching && <Box style={[[ui.spaceY6]]} enter>
            {/* Recent */}
            <Box>
              <Label style={[[ui.textXs, ui.textWhite25, ui.uppercase, ui.trackingWider, ui.mb3]]}>
                Son aramalar
              </Label>
              <Box style={[[ui.gapY1, ui.wFull]]}>
                {RECENT.map(r => <Touch key={r} onPress={() => setQuery(r)} style={[[ui.wFull, ui.flex, ui.itemsCenter, ui.gap3, ui.py25, ui.textLeft, ui.roundedXl, ui.px2]]}>
                    <Box style={[[ui.w7, ui.h7, ui.roundedLg, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.flexShrink0], {
                backgroundColor: "rgba(255,255,255,0.05)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.07)"
              }]}>
                      <ClockIcon size={13} strokeWidth={1.75} style={[[ui.textWhite25]]} />
                    </Box>
                    <Label style={[[ui.flex1, ui.textSm, ui.textWhite55, ui.textLeft]]}>{r}</Label>
                  </Touch>)}
              </Box>
            </Box>

            {/* Suggestions */}
            <Box>
              <Label style={[[ui.textXs, ui.textWhite25, ui.uppercase, ui.trackingWider, ui.mb3]]}>
                Önerilen aramalar
              </Label>
              <Box style={[[ui.flex, ui.flexWrap, ui.gap2]]}>
                {SUGGESTED.map(s => <Touch key={s} onPress={() => setQuery(s)} style={[[ui.px35, ui.py2, ui.roundedXl, ui.textSm, ui.textWhite55], {
              backgroundColor: "rgba(255,255,255,0.05)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)"
            }]}>
                    {s}
                  </Touch>)}
              </Box>
            </Box>

            {/* Category pills */}
            <Box>
              <Label style={[[ui.textXs, ui.textWhite25, ui.uppercase, ui.trackingWider, ui.mb3]]}>
                Kategoriler
              </Label>
              <Box style={[[ui.grid, ui.gap2]]} columns={2}>
                {[{
              label: "Spor & Aktivite",
              count: "84 etkinlik",
              color: "rgba(146,125,255,0.10)"
            }, {
              label: "Müzik & Sanat",
              count: "52 etkinlik",
              color: "rgba(105,120,255,0.10)"
            }, {
              label: "Yemek & Kahve",
              count: "38 etkinlik",
              color: "rgba(52,211,153,0.08)"
            }, {
              label: "Doğa & Outdoor",
              count: "61 etkinlik",
              color: "rgba(96,165,250,0.08)"
            }].map(cat => <Touch key={cat.label} style={[[ui.p35, ui.rounded2xl, ui.textLeft], {
              backgroundColor: cat.color,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.07)"
            }]}>
                    <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite75]]}>
                      {cat.label}
                    </Label>
                    <Label style={[[ui.textXs, ui.textWhite35, ui.mt05]]}>
                      {cat.count}
                    </Label>
                  </Touch>)}
              </Box>
            </Box>
          </Box>}

        {/* Results */}
        {searching && <Box style={[[]]} enter>
            {loadingDates && <Label style={[[ui.textXs, ui.textWhite35, ui.mb3]]}>Etkinlikler aranıyor…</Label>}
            {filtered.length > 0 ? <Box>
                <Label style={[[ui.textXs, ui.textWhite25, ui.uppercase, ui.trackingWider, ui.mb3]]}>
                  {filtered.length} etkinlik bulundu
                </Label>
                <Box style={[[]]}>
                  {filtered.map(event => <EventRow key={event.id} event={event} onPress={() => navigate("event-detail", {
              eventId: event.id
            })} />)}
                </Box>
              </Box> : <Box>
                {/* Query suggestions */}
                {suggestions.length > 0 && <Box style={[[ui.mb5]]}>
                    <Label style={[[ui.textXs, ui.textWhite25, ui.uppercase, ui.trackingWider, ui.mb3]]}>
                      Öneriler
                    </Label>
                    <Box style={[[ui.gapY1]]}>
                      {suggestions.map(s => <Touch key={s} onPress={() => setQuery(s)} style={[[ui.wFull, ui.flex, ui.itemsCenter, ui.gap3, ui.py25, ui.textLeft, ui.roundedXl, ui.px2, ui.Mx2]]}>
                          <SearchIcon size={13} strokeWidth={1.75} style={[[ui.textWhite20, ui.flexShrink0]]} />
                          <Label style={[[ui.textSm, ui.textWhite50]]}>
                            {s}
                          </Label>
                        </Touch>)}
                    </Box>
                  </Box>}
                <Box style={[[ui.textCenter, ui.py10]]}>
                  <Label style={[[ui.textSm, ui.textWhite25]]}>
                    {query.trim() ? `"${query}" için sonuç bulunamadı` : "Bu tarih aralığında etkinlik yok"}
                  </Label>
                  <Label style={[[ui.textXs, ui.textWhite15, ui.mt1]]}>
                    {query.trim() ? "Farklı bir kelime dene" : "Farklı tarihler seç"}
                  </Label>
                </Box>
              </Box>}
          </Box>}
      </Scroll>
    </Box>;
}
