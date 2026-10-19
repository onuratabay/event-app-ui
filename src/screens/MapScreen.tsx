import ActivityIndicator from "../components/LoadingSpinner";
import { palette } from "../theme/palette";
import { CategoryIcon, ClockIcon, CloseIcon, FilterIcon, LocationIcon, MyLocationIcon } from "../components/Icons";
import { useScreenActive } from '../native/useScreenActive'
import { useEventDeltas, patchApiEvent } from '../services/event-deltas'
import TopNavBar from "../components/TopNavBar"
import { useEffect, useMemo, useRef, useState } from "react"
import { AppState, StyleSheet, View } from "react-native"
import { getPreferences, putPreference } from "../api/client"
import * as Location from "expo-location"
import DiscoveryFilterSheet from "../map/DiscoveryFilterSheet"
import { apiDate, applyDiscoveryFilters, categoryVisual, dateRange, placeBounds, DEFAULT_FILTERS, filterError, type DiscoveryFilters, type MapPlace } from "../map/filters"
import MapView, { Marker, type Region } from "react-native-maps"
import { MAP_PROVIDER } from "../map/provider"
import { DARK_MAP_PROPS } from "../map/darkStyle"
import { useBottomNavInset } from "../components/BottomNav"
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg"
import { getApiErrorMessage, getMapEvents, getMapInterests, type ApiEvent } from "../api/client"
import { mapApiEventPreservingCover, participantCount, useStore } from "../native/Store"
import { Box, Label, Scroll, Touch } from "../native/UI"
import { COLORS, createIndex, densitySpots, INITIAL_REGION, isVisible, modeForZoom, regionForRadius, USER_LOCATION_RADIUS_KM, zoomForRegion } from "../map/model"
import type { NavigateFn } from "../types"

// Bottom edge of the top overlays (floating title bar + filter row); map content is framed below it.
const TOP_OVERLAY = 126

/** Card for an event picked on the map: what, when, where, how full, and one clear action. */
function EventMapCard({ event, width, onOpen }: { event: ApiEvent; width: number; onOpen: () => void }) {
  const missing = Math.max(0, event.minParticipants - event.confirmedParticipantCount)
  return <Touch accessibilityLabel={`${event.interest.name}, ${event.date} ${event.startTime}, detayı aç`} onPress={onOpen} style={[s.card, { width }]}>
    <Box style={[s.cardIcon, { backgroundColor: categoryVisual(event.interest.name).color }]}><CategoryIcon name={event.interest.name} size={22} style={{ color: palette.text }} /></Box>
    <Box style={s.cardBody}>
      <Label style={s.cardTitle} numberOfLines={1}>{event.interest.name}{event.level ? ` · ${event.level.name}` : ""}</Label>
      <Box style={s.cardMeta}><ClockIcon size={12} style={{ color: palette.muted }} /><Label style={s.cardMetaText}>{`${event.date} · ${event.startTime}`}</Label></Box>
      {event.locationName ? <Box style={s.cardMeta}><LocationIcon size={12} style={{ color: palette.muted }} /><Label style={s.cardMetaText} numberOfLines={1}>{event.locationName}</Label></Box> : null}
      <Box style={s.cardFooter}>
        <Label style={s.cardCount}>{`${participantCount(event.confirmedParticipantCount, event.maxParticipants)} kişi`}{missing > 0 ? <Label style={s.cardHint}>{` · ${missing} kişi daha gerekiyor`}</Label> : null}</Label>
        <Label style={s.cardCta}>Detay →</Label>
      </Box>
    </Box>
  </Touch>
}
/** Compact card for an event currently in view; the strip under the map scrolls through them. */
function EventMiniCard({ event, onOpen }: { event: ApiEvent; onOpen: () => void }) {
  return <Touch accessibilityLabel={`${event.interest.name}, ${event.date} ${event.startTime}, detayı aç`} onPress={onOpen} style={s.mini}>
    <Box style={[s.miniIcon, { backgroundColor: categoryVisual(event.interest.name).color }]}><CategoryIcon name={event.interest.name} size={17} style={{ color: palette.text }} /></Box>
    <Box style={s.cardBody}>
      <Label style={s.miniTitle} numberOfLines={1}>{event.interest.name}{event.level ? ` · ${event.level.name}` : ""}</Label>
      <Label style={s.miniMeta} numberOfLines={1}>{`${event.date.slice(0, 5)} · ${event.startTime} · ${participantCount(event.confirmedParticipantCount, event.maxParticipants)} kişi`}</Label>
      {event.locationName ? <Label style={s.miniMeta} numberOfLines={1}>{event.locationName}</Label> : null}
    </Box>
  </Touch>
}
const MAX_MINI_CARDS = 40
const MINI_WIDTH = 220
const startKey = (event: ApiEvent) => `${event.date.split("/").reverse().join("-")} ${event.startTime}`
export default function MapScreen({ navigate }: { navigate: NavigateFn }) {
  const screenActive = useScreenActive()
  const loadedQuery = useRef('')
  const activeRef = useRef(screenActive); activeRef.current = screenActive
  const map = useRef<MapView>(null)
  const { setData } = useStore()
  const [events, setEvents] = useState<ApiEvent[]>([])
  const [region, setRegion] = useState<Region>(INITIAL_REGION)
  const [size, setSize] = useState({ width: 390, height: 760 })
  const [filters, setFilters] = useState<DiscoveryFilters>(DEFAULT_FILTERS)
  const [filterOpen, setFilterOpen] = useState(false)
  const [interests, setInterests] = useState<Array<{ id: string; name: string }>>([])
  const [now, setNow] = useState(() => new Date())
  const [nearby, setNearby] = useState<MapPlace | null>(null)
  const [initialLocationResolved, setInitialLocationResolved] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [showUser, setShowUser] = useState(false)
  const [panelHeight, setPanelHeight] = useState(56)
  const navInset = useBottomNavInset()
  // Overlays frame the map: camera moves keep events clear of the top bar and the bottom panel.
  const panelTop = navInset + 12 + panelHeight
  const edgePadding = { top: TOP_OVERLAY + 24, right: 48, bottom: panelTop + 24, left: 48 }
  const interacted = useRef(false)
  const alive = useRef(true)
  const filterRef = useRef(filters)
  filterRef.current = filters
  const filterRevision = useRef(0)
  const locationBusy = useRef(false)
  const range = dateRange(filters, now)
  const queryKey = JSON.stringify({ dateFrom: apiDate(range.from), dateTo: apiDate(range.to), interestIds: filters.interestIds, ...placeBounds(filters.place, filters.radiusKm) })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [retry, setRetry] = useState(0)
  const [ready, setReady] = useState(false)
  const [selected, setSelected] = useState<ApiEvent[]>([])
  useEventDeltas(screenActive ? events.map(event => event.id) : [], patch => {
    setEvents(previous => previous.map(event => patchApiEvent(event, patch)))
    setSelected(previous => previous.map(event => patchApiEvent(event, patch)))
  })
  const centered = useRef(false)
  useEffect(() => {
    const signature = `${queryKey}:${retry}`
    if (!screenActive || loadedQuery.current === signature) return
    const controller = new AbortController()
    setLoading(true); setError(null)
    getMapEvents(controller.signal, JSON.parse(queryKey)).then(result => {
      if (controller.signal.aborted) return
      loadedQuery.current = signature
      setEvents(result.items); setTruncated(result.truncated)
    }).catch(cause => {
      if (!controller.signal.aborted) setError(getApiErrorMessage(cause, "Etkinlikler yüklenemedi. Tekrar dene."))
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [retry, queryKey, screenActive])
  useEffect(() => {
    const controller = new AbortController()
    getMapInterests(controller.signal).then(items => { if (!controller.signal.aborted && Array.isArray(items)) setInterests(items) }).catch(() => {})
    return () => controller.abort()
  }, [retry])
  useEffect(() => {
    alive.current = true
    getPreferences().then(preferences => {
      const saved = preferences.mapFilters
      if (!saved || interacted.current || !alive.current) return
      try { const value = saved; if (!filterError(value)) setFilters(value) } catch { /* Ignore obsolete preferences. */ }
    }).catch(() => { if (alive.current) setLocationError("Kayıtlı filtrelerin yüklenemedi. Bağlantını kontrol et.") })
    const timer = setInterval(() => { if (activeRef.current) setNow(new Date()) }, 60000)
    const subscription = AppState.addEventListener("change", state => { if (state === "active" && activeRef.current) { setNow(new Date()); void locate(false) } })
    void locate(false)
    return () => { alive.current = false; clearInterval(timer); subscription.remove() }
  }, [])
  const applyFilters = (value: DiscoveryFilters) => {
    interacted.current = true
    filterRevision.current++
    setFilters(value); setSelected([]); setFilterOpen(false)
    void putPreference("mapFilters", value).catch(() => setLocationError("Filtre bu oturumda uygulandı; hesabına kaydedilemedi. Tekrar uygula."))
    if (value.place && ready) {
      centered.current = true
      map.current?.animateToRegion(regionForRadius(value.place, value.radiusKm, size), 450)
    }
  }
  async function locate(requestPermission: boolean) {
    if (locationBusy.current) return
    locationBusy.current = true
    setLocating(true); setLocationError(null)
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      const permission = requestPermission ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync()
      if (!permission.granted) {
        if (requestPermission) setLocationError("Konum izni verilmedi. Sana göre filtresinden şehir veya mekân seçebilirsin.")
        return
      }
      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("timeout")), 12000) }),
      ])
      if (!alive.current) return
      const place = { name: "Bulunduğun konum", latitude: position.coords.latitude, longitude: position.coords.longitude }
      setNearby(place); setShowUser(true)
      // The locate button moves the camera to the user; it never changes the filters behind their back.
      if (requestPermission && activeRef.current) { centered.current = true; map.current?.animateToRegion(regionForRadius(place, USER_LOCATION_RADIUS_KM, size), 450) }

    } catch { if (alive.current) setLocationError("Konum alınamadı. Sana göre filtresinden şehir seçebilirsin.") }
    finally { locationBusy.current = false; if (timeout) clearTimeout(timeout); if (alive.current) { setLocating(false); setInitialLocationResolved(true) } }
  }
  const filtered = useMemo(() => applyDiscoveryFilters(events, filters, now), [events, filters, now])
  const categories = useMemo(() => [...new Map([...interests, ...events.map(event => event.interest)].map(item => [item.id, item])).values()], [events, interests])
  const zoom = zoomForRegion(region, size.width)
  const mode = modeForZoom(zoom)
  const index = useMemo(() => createIndex(filtered), [filtered])
  const clusters = useMemo(() => index.getClusters([
    region.longitude - region.longitudeDelta / 2, Math.max(-85, region.latitude - region.latitudeDelta / 2),
    region.longitude + region.longitudeDelta / 2, Math.min(85, region.latitude + region.latitudeDelta / 2),
  ], Math.floor(zoom)), [index, region, zoom])
  const density = useMemo(() => mode === "heat" ? densitySpots(filtered, region, size.width, size.height) : [], [filtered, region, size, mode])
  const visible = useMemo(() => filtered.filter(event => isVisible(event, region)), [filtered, region])
  // Soonest first, so the strip reads like an agenda for the area on screen.
  const strip = useMemo(() => [...visible].sort((a, b) => startKey(a).localeCompare(startKey(b))).slice(0, MAX_MINI_CARDS), [visible])
  const heatOpacity = Math.max(0, Math.min(1, (11 - zoom) / 0.65))
  const markerOpacity = Math.max(0, Math.min(1, (zoom - 10.35) / 0.65))
  // The strip lists only events whose pins are on screen; with no pins (wide heat view or an empty area) it stays hidden.
  const showStrip = markerOpacity > 0 && strip.length > 0 && !loading && !error
  const statusLine = loading || !!error || !filtered.length
  const showLegend = mode === "heat" && !loading && !error && filtered.length > 0
  useEffect(() => {
    if (!screenActive || !ready || centered.current) return
    const requestedPlace = interacted.current ? filters.place : null
    const place = requestedPlace || nearby || (initialLocationResolved ? filters.place : null)
    if (place) {
      const radiusKm = place === nearby ? USER_LOCATION_RADIUS_KM : filters.radiusKm
      map.current?.animateToRegion(regionForRadius(place, radiusKm, size), 450)
      centered.current = true
    } else if (initialLocationResolved && filtered.length) {
      centered.current = true
      map.current?.fitToCoordinates(filtered.map(event => ({ latitude: event.latitude, longitude: event.longitude })), { edgePadding, animated: true })
    }
  }, [screenActive, ready, filtered, filters.place, filters.radiusKm, nearby, initialLocationResolved, size])
  const openEvent = (event: ApiEvent) => {
    setData(current => ({ ...current, events: [mapApiEventPreservingCover(event, current.events.find(item => item.id === event.id)), ...current.events.filter(item => item.id !== event.id)] }))
    navigate("event-detail", { eventId: event.id })
  }
  const selectedIds = new Set(selected.map(event => event.id))
  // Every active choice in the sheet counts: date, activities, time and place.
  const advancedCount = (filters.place ? 1 : 0) + (filters.timeFrom ? 1 : 0) + (filters.datePreset !== "all" ? 1 : 0) + (filters.interestIds.length ? 1 : 0)
  const anyFilter = advancedCount > 0 || filters.interestIds.length > 0 || filters.datePreset !== "all"
  const clearFilters = () => applyFilters({ ...DEFAULT_FILTERS, interestIds: [] })
  const summary = [filters.place ? `${filters.place.name} · ${filters.radiusKm} km` : "Her yerde",
    filters.datePreset === "custom" ? `${range.from}${range.to && range.to !== range.from ? ` → ${range.to}` : ""}` : "",
    filters.timeFrom ? `${filters.timeFrom}–${filters.timeTo}` : ""].filter(Boolean).join(" · ")
  const cardWidth = Math.min(360, size.width - 64)
  return <Box style={s.root}>
    {/* The map owns the entire canvas. Every control below is an overlay layer. */}
    <View style={StyleSheet.absoluteFill} onLayout={event => setSize(event.nativeEvent.layout)}>
      <MapView ref={map} provider={MAP_PROVIDER} testID="event-map" style={StyleSheet.absoluteFill} initialRegion={INITIAL_REGION} {...DARK_MAP_PROPS}
        rotateEnabled={false} pitchEnabled={false} showsCompass={false}
        showsUserLocation={showUser} showsMyLocationButton={false} showsBuildings={false} showsTraffic={false} toolbarEnabled={false}
        onMapReady={() => setReady(true)} onRegionChange={setRegion} onRegionChangeComplete={setRegion}
        onPanDrag={() => { centered.current = true }}
        onPress={() => setSelected([])} legalLabelInsets={{ top: 0, left: 8, right: 8, bottom: navInset + 8 }}>
        {markerOpacity > 0 && clusters.map(feature => {
          const [longitude, latitude] = feature.geometry.coordinates
          const props = feature.properties
          const isCluster = "cluster" in props && props.cluster
          const event = !isCluster ? filtered.find(item => item.id === props.eventId) : undefined
          const count = isCluster ? Number(props.point_count) : 1
          const active = !!event && selectedIds.has(event.id)
          return <Marker key={isCluster ? `cluster-${props.cluster_id}` : String(props.eventId)} coordinate={{ latitude, longitude }} opacity={markerOpacity}
            tracksViewChanges={true} zIndex={active ? 4 : isCluster ? 2 : 3}
            onPress={press => {
              press.stopPropagation()
              if (isCluster) {
                const id = Number(props.cluster_id)
                if (zoom >= 17) {
                  const ids = new Set(index.getLeaves(id, Infinity).map(point => point.properties.eventId))
                  setSelected(filtered.filter(item => ids.has(item.id)))
                } else {
                  centered.current = true
                  const target = Math.min(19, index.getClusterExpansionZoom(id))
                  const scale = 2 ** (zoom - target)
                  map.current?.animateToRegion({ latitude, longitude, latitudeDelta: region.latitudeDelta * scale, longitudeDelta: region.longitudeDelta * scale }, 400)
                }
              } else if (event) setSelected([event])
            }}>
            <View style={{ alignItems: "center" }}><View style={[s.pin, isCluster && s.cluster, active && s.pinActive, { backgroundColor: isCluster ? palette.blue : categoryVisual(event?.interest.name || "").color }]}>
              {isCluster ? <Label style={s.pinText}>{String(count)}</Label> : <CategoryIcon name={event?.interest.name} size={active ? 22 : 18} style={{ color: palette.text }} />}
            </View>
            {!isCluster && (zoom >= 14 || active) && <View style={s.pinLabel}><Label style={s.pinLabelText}>{event?.interest.name} · {event?.startTime}</Label></View>}
            </View>
          </Marker>
        })}
      </MapView>
      {mode === "heat" && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: heatOpacity }]}>
        <Svg width={size.width} height={size.height}>
          <Defs>
            <RadialGradient id="heat-bloom" cx="50%" cy="50%" rx="50%" ry="50%">
              {/* Same blue–violet scale as the legend, so the heat layer stays calm on the dark map. */}
              <Stop offset="0%" stopColor="#d2c3ff" stopOpacity=".7" />
              <Stop offset="30%" stopColor="#927dff" stopOpacity=".5" />
              <Stop offset="56%" stopColor="#628dcd" stopOpacity=".32" />
              <Stop offset="78%" stopColor="#436b9e" stopOpacity=".16" />
              <Stop offset="100%" stopColor="#436b9e" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          {density.map((spot, i) => <Circle key={`${i}-${spot.x}-${spot.y}`} cx={spot.x} cy={spot.y} r={spot.radius} fill="url(#heat-bloom)" />)}
        </Svg>
      </View>}
    </View>
    <TopNavBar navigate={navigate} fallback="discover" title="Harita" subtitle={summary} floating />

    {/* Top row under the title, as in map apps: filters on the left, my location on the right. */}
    <Box pointerEvents="box-none" style={s.top}>
      <Box walkthroughId="map-filters">
        <Touch accessibilityLabel={advancedCount ? `Filtreler, ${advancedCount} aktif` : "Filtreler"} onPress={() => { interacted.current = true; setFilterOpen(true) }} glass style={[s.filterButton, advancedCount > 0 && s.filterButtonOn]}>
          <FilterIcon size={16} style={{ color: advancedCount ? palette.accent : palette.text }} />
          <Label style={[s.filterText, advancedCount > 0 && { color: palette.accent }]}>Filtreler</Label>
          {advancedCount > 0 && <Box style={s.badge}><Label style={s.badgeText}>{String(advancedCount)}</Label></Box>}
        </Touch>
      </Box>
      <Touch walkthroughId="map-location" accessibilityLabel="Konumuma git" disabled={locating} onPress={() => void locate(true)} style={[s.control, s.controlSolo]}>
        {locating ? <ActivityIndicator color={palette.accent} /> : <MyLocationIcon size={19} filled={showUser} style={{ color: showUser ? palette.accent : palette.text }} />}
      </Touch>
    </Box>

    {/* Bottom: the picked event(s) as large cards; otherwise the events in view as a strip of small cards. */}
    <Box pointerEvents="box-none" onLayout={event => setPanelHeight(event.nativeEvent.layout.height)} style={[s.bottom, { bottom: navInset + 12 }]}>
      {selected.length > 0 ? <Box style={s.selection}>
        <Box style={s.selectionHead}>
          <Label style={s.selectionTitle}>{selected.length > 1 ? `Bu noktada ${selected.length} etkinlik` : "Seçilen etkinlik"}</Label>
          <Touch accessibilityLabel="Seçimi kapat" onPress={() => setSelected([])} style={s.closeButton}><CloseIcon size={16} style={{ color: palette.muted }} /></Touch>
        </Box>
        <Scroll horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + 10} decelerationRate="fast" style={s.cards}>
          {selected.map(event => <EventMapCard key={event.id} event={event} width={cardWidth} onOpen={() => openEvent(event)} />)}
        </Scroll>
      </Box> : <Box style={s.selection}>
        {showStrip && <>
          <Box style={s.selectionHead}>
            <Label style={s.selectionTitle}>{visible.length === filtered.length ? `${visible.length} etkinlik bu alanda` : `${visible.length} etkinlik bu alanda · toplam ${filtered.length}`}</Label>
          </Box>
          <Scroll horizontal showsHorizontalScrollIndicator={false} snapToInterval={MINI_WIDTH + 8} decelerationRate="fast" style={s.cards}>
            {strip.map(event => <EventMiniCard key={event.id} event={event} onOpen={() => openEvent(event)} />)}
          </Scroll>
        </>}
        {(statusLine || showLegend || truncated || locationError) && <Box glass style={s.status}>
          {statusLine && <Box style={s.statusRow}>
            {loading ? <><ActivityIndicator color={palette.accent} /><Label style={s.statusText}>Etkinlikler yükleniyor…</Label></>
              : error ? <><Label style={[s.statusText, s.errorText]} numberOfLines={2}>{error}</Label><Touch onPress={() => setRetry(value => value + 1)} style={s.statusAction}><Label style={s.statusActionText}>Tekrar dene</Label></Touch></>
              : <><Label style={s.statusText}>Bu filtrelerde etkinlik yok</Label>{anyFilter && <Touch onPress={clearFilters} style={s.statusAction}><Label style={s.statusActionText}>Filtreleri temizle</Label></Touch>}</>}
          </Box>}
          {showLegend && <Box style={s.legend}>
            <Label style={s.legendText}>Yoğunluk</Label>
            <Label style={s.legendText}>Az</Label>
            {COLORS.map(color => <View key={color} style={[s.legendBar, { backgroundColor: color }]} />)}
            <Label style={s.legendText}>Çok</Label>
          </Box>}
          {truncated && <Label style={s.note}>En fazla 500 etkinlik gösteriliyor; tarih veya bölgeyi daralt.</Label>}
          {locationError && <Touch onPress={() => setLocationError(null)}><Label style={[s.note, s.errorText]}>{locationError}</Label></Touch>}
        </Box>}
      </Box>}
    </Box>
    {filterOpen && <DiscoveryFilterSheet value={filters} categories={categories} events={events} nearby={nearby} onApply={applyFilters} onClose={() => setFilterOpen(false)} />}
  </Box>
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  top: { position: "absolute", top: TOP_OVERLAY - 44, left: 16, right: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  // Same look as the search screen's chips (FilterChip).
  filterButton: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: palette.glassBorder, backgroundColor: palette.glass },
  filterButtonOn: { backgroundColor: palette.selected, borderColor: "rgba(105,120,255,.38)" },
  filterText: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 13 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: palette.blue, alignItems: "center", justifyContent: "center" },
  badgeText: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 11, lineHeight: 14 },
  control: { width: 44, height: 44, backgroundColor: "rgba(17,22,42,.94)", borderWidth: 1, borderColor: palette.border, alignItems: "center", justifyContent: "center" },
  controlSolo: { borderRadius: 22 },
  pinLabel: { marginTop: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9, backgroundColor: "rgba(8,11,24,.92)", borderWidth: 1, borderColor: palette.border },
  pinLabelText: { fontFamily: "Outfit-Medium", fontSize: 10, color: palette.text },
  pin: { minWidth: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: "rgba(244,245,255,.9)", alignItems: "center", justifyContent: "center", paddingHorizontal: 7 },
  pinActive: { minWidth: 46, height: 46, borderRadius: 23, borderWidth: 3, borderColor: palette.accent },
  cluster: { minWidth: 42, height: 42, borderRadius: 21, borderColor: "rgba(185,195,255,.55)", borderWidth: 3 },
  pinText: { fontFamily: "Outfit-SemiBold", fontSize: 16, color: palette.text },
  bottom: { position: "absolute", left: 16, right: 16 },
  status: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, gap: 8, backgroundColor: "rgba(12,17,34,.92)", borderWidth: 1, borderColor: palette.border },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 28 },
  statusCount: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 18 },
  statusText: { flex: 1, color: palette.muted, fontSize: 13 },
  statusAction: { minHeight: 32, paddingHorizontal: 10, borderRadius: 10, justifyContent: "center", backgroundColor: palette.selected },
  statusActionText: { color: palette.accent, fontFamily: "Outfit-SemiBold", fontSize: 12 },
  errorText: { color: palette.error },
  legend: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendText: { color: palette.muted, fontSize: 11 },
  legendBar: { width: 22, height: 6, borderRadius: 3 },
  note: { color: palette.muted, fontSize: 11, lineHeight: 16 },
  selection: { gap: 8 },
  selectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 },
  selectionTitle: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 13, textShadowColor: "rgba(0,0,0,.6)", textShadowRadius: 6 },
  closeButton: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(12,17,34,.92)", borderWidth: 1, borderColor: palette.border },
  cards: { flexGrow: 0, flexDirection: "row", gap: 10 },
  card: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 20, backgroundColor: "rgba(17,22,42,.97)", borderWidth: 1, borderColor: "rgba(105,120,255,.35)" },
  cardIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1, minWidth: 0, gap: 4 },
  cardTitle: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 15 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardMetaText: { flex: 1, color: palette.muted, fontSize: 12 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 },
  cardCount: { flex: 1, color: palette.text, fontSize: 12, fontFamily: "Outfit-Medium" },
  cardHint: { color: "rgba(251,191,36,.85)", fontSize: 12 },
  cardCta: { color: palette.accent, fontFamily: "Outfit-SemiBold", fontSize: 13 },
  mini: { width: MINI_WIDTH, flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 16, backgroundColor: "rgba(17,22,42,.95)", borderWidth: 1, borderColor: palette.border },
  miniIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  miniTitle: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 13 },
  miniMeta: { color: palette.muted, fontSize: 11 },
})
