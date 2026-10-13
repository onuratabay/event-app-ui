import { palette } from "../theme/palette";
import { useBottomNavInset } from "../components/BottomNav";
import { CloseIcon } from "../components/Icons";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, TextInput } from "react-native";
import { AtmoBackground } from "../components/GlassUI";
import { ClockIcon, SearchIcon } from "../components/Icons";
import TopNavBar from "../components/TopNavBar";
import { EVENT_PHASE_LABEL, eventPhase, isLivePhase, mapApiEvent, useStore } from "../native/Store";
import { getApiErrorMessage, getMapInterests, getUserInterests, searchEvents } from "../api/client";
import { apiDate, localDate } from "../map/filters";
import { FilterChip, GlassInput } from "../components/GlassUI";
import { Box, Field, Label, Picture, Scroll, Touch } from "../native/UI";
import { ui } from "../theme/styles";
import { AppEvent, NavigateFn } from "../types";
interface Props {
  navigate: NavigateFn;
}
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
  // Results belong to the filter they were fetched for; a newer filter never shows older (or unfiltered) rows.
  const [results, setResults] = useState<{ key: string; events: AppEvent[] } | null>(null);
  // Interest filter: several can be picked; the user's own interests are listed first.
  const [interests, setInterests] = useState<Array<{ id: string; name: string }>>([]);
  const [interestIds, setInterestIds] = useState<string[]>([]);
  // The user's own interests come first, matched by id (names can differ by language), so the events
  // they are most likely to join are one tap away. Store names are a fallback until the ids arrive.
  const [myInterestIds, setMyInterestIds] = useState<string[]>([]);
  useEffect(() => {
    getMapInterests().then(rows => setInterests(rows.map(({ id, name }) => ({ id, name })))).catch(() => {});
    getUserInterests().then(rows => setMyInterestIds(rows.map(row => row.id))).catch(() => {});
  }, []);
  const myNames = new Set(store.user.interests.map(name => name.toLocaleLowerCase("tr")));
  const isMine = (interest: { id: string; name: string }) => myInterestIds.includes(interest.id) || myNames.has(interest.name.toLocaleLowerCase("tr"));
  const interestOptions = [...interests].sort((a, b) => Number(isMine(b)) - Number(isMine(a)));
  const toggleInterest = (id: string) => setInterestIds(ids => ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id]);
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
  const interestActive = interestIds.length > 0;
  const filterActive = dateActive || interestActive;
  const filterKey = filterActive ? `${dateFrom}|${dateTo}|${interestIds.join(",")}` : "";
  // With a date range or interests the server is asked (all upcoming events, not only the loaded ones).
  useEffect(() => {
    if (!filterActive) return;
    let active = true;
    searchEvents(apiDate(dateFrom || today), dateTo ? apiDate(dateTo) : undefined, interestIds).then(result => {
      if (!active) return;
      const found = result.items.map(mapApiEvent);
      // Keep them in the shared list so the detail screen can open them (not added to the Discover feed).
      setStore(p => ({ ...p, events: [...new Map([...p.events, ...found].map(event => [event.id, event])).values()] }));
      setResults({ key: filterKey, events: found });
    }).catch(error => { if (active) { setDateError(getApiErrorMessage(error, "Etkinlikler aranamadı.")); setResults({ key: filterKey, events: [] }); } });
    return () => { active = false; };
  }, [filterKey]);
  // While a filter's results are on their way nothing is listed: no flash of the unfiltered list.
  const loadingDates = filterActive && results?.key !== filterKey;
  const EVENTS = !filterActive ? store.events : loadingDates ? [] : results!.events;
  const searching = Boolean(query.trim()) || filterActive;
  // No autofocus: the keyboard opens only when the user taps the search box.
  const inputRef = useRef<TextInput>(null);
  const filtered = !searching ? [] : !query.trim() ? EVENTS : EVENTS.filter(e => e.title.toLowerCase().includes(query.toLowerCase()) || e.category.toLowerCase().includes(query.toLowerCase()) || e.location.toLowerCase().includes(query.toLowerCase()));
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

      {/* Interests */}
      {interestOptions.length > 0 && <Box style={[[ui.pb3, ui.flexShrink0]]}>
        <Box style={[[ui.flex, ui.itemsCenter, ui.px5, ui.mb2], { justifyContent: "space-between" }]}>
          <Label style={[[ui.textXs, ui.textWhite40, ui.uppercase, ui.trackingWider]]}>İlgi alanı</Label>
          {interestActive && <Touch accessibilityLabel="İlgi alanı filtresini temizle" onPress={() => setInterestIds([])} style={[[ui.textXs, ui.textWhite40], { minHeight: 28, justifyContent: "center" }]}>Temizle</Touch>}
        </Box>
        <Scroll horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
          {interestOptions.map(interest => <FilterChip key={interest.id} label={interest.name} selected={interestIds.includes(interest.id)} onPress={() => toggleInterest(interest.id)} />)}
        </Scroll>
      </Box>}

      <Scroll style={[[ui.flex1, ui.px5, ui.pb10], { paddingBottom: 40 + navInset }]}>
        {/* No query — hint */}
        {!searching && <Box style={[[ui.textCenter, ui.py10]]} enter>
            <Label style={[[ui.textSm, ui.textWhite25]]}>
              Etkinlik, aktivite veya konum ara
            </Label>
            <Label style={[[ui.textXs, ui.textWhite15, ui.mt1]]}>
              Ya da yukarıdan bir tarih aralığı veya ilgi alanı seç
            </Label>
          </Box>}

        {/* Results */}
        {searching && <Box style={[[]]} enter>
            {loadingDates ? <Box style={[[ui.py10], { alignItems: "center", gap: 10 }]}>
                <ActivityIndicator color={palette.accent} />
                <Label style={[[ui.textXs, ui.textWhite35]]}>Etkinlikler aranıyor…</Label>
              </Box> : filtered.length > 0 ? <Box>
                <Label style={[[ui.textXs, ui.textWhite25, ui.uppercase, ui.trackingWider, ui.mb3]]}>
                  {filtered.length} etkinlik bulundu
                </Label>
                <Box style={[[]]}>
                  {filtered.map(event => <EventRow key={event.id} event={event} onPress={() => navigate("event-detail", {
              eventId: event.id
            })} />)}
                </Box>
              </Box> : <Box>
                <Box style={[[ui.textCenter, ui.py10]]}>
                  <Label style={[[ui.textSm, ui.textWhite25]]}>
                    {query.trim() ? `"${query}" için sonuç bulunamadı` : interestActive && !dateActive ? "Bu ilgi alanında yaklaşan etkinlik yok" : interestActive ? "Bu tarih ve ilgi alanında etkinlik yok" : "Bu tarih aralığında etkinlik yok"}
                  </Label>
                  <Label style={[[ui.textXs, ui.textWhite15, ui.mt1]]}>
                    {query.trim() ? "Farklı bir kelime dene" : interestActive ? "Başka bir ilgi alanı ya da tarih seç" : "Farklı tarihler seç"}
                  </Label>
                </Box>
              </Box>}
          </Box>}
      </Scroll>
    </Box>;
}
