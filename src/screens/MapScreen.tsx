import BackButton from "../components/BackButton"
import { useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, AppState, StyleSheet, View } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as Location from "expo-location"
import DiscoveryFilterSheet from "../map/DiscoveryFilterSheet"
import { apiDate, applyDiscoveryFilters, categoryVisual, dateRange, placeBounds, DEFAULT_FILTERS, filterError, type DiscoveryFilters, type MapPlace } from "../map/filters"
import MapView, { Marker, type Region } from "react-native-maps"
import Svg, { Path } from "react-native-svg"
import BottomNav from "../components/BottomNav"
import { FilterChip } from "../components/GlassUI"
import { getApiErrorMessage, getMapEvents, getMapInterests, type ApiEvent } from "../api/client"
import { mapApiEvent, useStore } from "../native/Store"
import { Box, Label, Scroll, Touch } from "../native/UI"
import { COLORS, createIndex, densityPaths, INITIAL_REGION, isVisible, modeForZoom, zoomForRegion } from "../map/model"
import type { NavigateFn } from "../types"

const MODE_LABELS = { heat: "Yoğunluk", cluster: "Etkinlik kümeleri", event: "Etkinlikler" }
export default function MapScreen({ navigate }: { navigate: NavigateFn }) {
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
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
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
  const [panelHeight, setPanelHeight] = useState(190)
  const [selected, setSelected] = useState<ApiEvent[]>([])
  const centered = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(null)
    getMapEvents(controller.signal, JSON.parse(queryKey)).then(result => {
      if (controller.signal.aborted) return
      setEvents(result.items); setTruncated(result.truncated)
    }).catch(cause => {
      if (!controller.signal.aborted) setError(getApiErrorMessage(cause, "Etkinlikler yüklenemedi. Tekrar dene."))
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [retry, queryKey])
  useEffect(() => {
    const controller = new AbortController()
    getMapInterests(controller.signal).then(items => { if (!controller.signal.aborted && Array.isArray(items)) setInterests(items) }).catch(() => {})
    return () => controller.abort()
  }, [retry])
  useEffect(() => {
    alive.current = true
    AsyncStorage.getItem("event-app:map-filters").then(saved => {
      if (!saved || interacted.current || !alive.current) return
      try { const value = JSON.parse(saved); if (!filterError(value)) setFilters(value) } catch { /* Ignore obsolete preferences. */ }
    }).catch(() => {})
    const timer = setInterval(() => setNow(new Date()), 60000)
    const subscription = AppState.addEventListener("change", state => { if (state === "active") { setNow(new Date()); void locate(false) } })
    void locate(false)
    return () => { alive.current = false; clearInterval(timer); subscription.remove() }
  }, [])
  const applyFilters = (value: DiscoveryFilters) => {
    interacted.current = true
    filterRevision.current++
    setFilters(value); setSelected([]); setFilterOpen(false)
    void AsyncStorage.setItem("event-app:map-filters", JSON.stringify(value)).catch(() => setLocationError("Filtre bu oturumda uygulandı; cihazına kaydedilemedi."))
    if (value.place && ready) {
      centered.current = true
      const latitudeDelta = value.radiusKm * 2.5 / 111
      map.current?.animateToRegion({ latitude: value.place.latitude, longitude: value.place.longitude, latitudeDelta, longitudeDelta: latitudeDelta / Math.cos(value.place.latitude * Math.PI / 180) }, 450)
    }
  }
  async function locate(requestPermission: boolean) {
    if (locationBusy.current) return
    locationBusy.current = true
    const revision = filterRevision.current
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
      let name = "Bulunduğun konum"
      try { const [address] = await Location.reverseGeocodeAsync(position.coords); name = address?.city || address?.region || name } catch { /* Coordinates remain usable without a city label. */ }
      if (!alive.current) return
      const place = { name, latitude: position.coords.latitude, longitude: position.coords.longitude }
      setNearby(place)
      if (requestPermission && revision === filterRevision.current) applyFilters({ ...filterRef.current, place, radiusKm: 15 })

    } catch { if (alive.current) setLocationError("Konum alınamadı. Sana göre filtresinden şehir seçebilirsin.") }
    finally { locationBusy.current = false; if (timeout) clearTimeout(timeout); if (alive.current) setLocating(false) }
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
  const density = useMemo(() => mode === "heat" ? densityPaths(filtered, region, size.width, size.height) : [], [filtered, region, size, mode])
  const visible = useMemo(() => filtered.filter(event => isVisible(event, region)), [filtered, region])
  const heatOpacity = Math.max(0, Math.min(1, (11 - zoom) / 0.65))
  const markerOpacity = Math.max(0, Math.min(1, (zoom - 10.35) / 0.65))
  useEffect(() => {
    if (!ready || centered.current) return
    const place = filters.place || (!interacted.current ? nearby : null)
    if (place) {
      const delta = (filters.place ? filters.radiusKm : 15) * 2.5 / 111
      map.current?.animateToRegion({ latitude: place.latitude, longitude: place.longitude, latitudeDelta: delta, longitudeDelta: delta / Math.cos(place.latitude * Math.PI / 180) }, 450)
      centered.current = true
    } else if (filtered.length) {
      centered.current = true
      map.current?.fitToCoordinates(filtered.map(event => ({ latitude: event.latitude, longitude: event.longitude })), {
        edgePadding: { top: 150, right: 50, bottom: 30, left: 50 }, animated: true,
      })
    }
  }, [ready, filtered, filters.place, filters.radiusKm, nearby])
  const zoomBy = (factor: number) => map.current?.animateToRegion({ ...region,
    latitudeDelta: Math.min(120, Math.max(0.0002, region.latitudeDelta * factor)),
    longitudeDelta: Math.min(350, Math.max(0.0002, region.longitudeDelta * factor)),
  }, 350)
  const openEvent = (event: ApiEvent) => {
    setData(current => ({ ...current, events: [mapApiEvent(event), ...current.events.filter(item => item.id !== event.id)] }))
    navigate("event-detail", { eventId: event.id })
  }
  return <Box style={s.root}>
    <View style={[StyleSheet.absoluteFill, { bottom: panelHeight + 96 }]} onLayout={event => setSize(event.nativeEvent.layout)}>
      <MapView ref={map} testID="event-map" style={StyleSheet.absoluteFill} initialRegion={INITIAL_REGION}
        userInterfaceStyle="dark" rotateEnabled={false} pitchEnabled={false} showsCompass={false}
        showsPointsOfInterests={false} showsBuildings={false} toolbarEnabled={false}
        onMapReady={() => setReady(true)} onRegionChange={setRegion} onRegionChangeComplete={setRegion}
        onPress={() => setSelected([])} legalLabelInsets={{ top: 0, left: 8, right: 8, bottom: 4 }}>
        {markerOpacity > 0 && clusters.map(feature => {
          const [longitude, latitude] = feature.geometry.coordinates
          const props = feature.properties
          const isCluster = "cluster" in props && props.cluster
          const event = !isCluster ? filtered.find(item => item.id === props.eventId) : undefined
          const count = isCluster ? Number(props.point_count) : 1
          return <Marker key={isCluster ? `cluster-${props.cluster_id}` : String(props.eventId)} coordinate={{ latitude, longitude }} opacity={markerOpacity}
            tracksViewChanges={true} zIndex={isCluster ? 2 : 3}
            onPress={press => {
              press.stopPropagation()
              if (isCluster) {
                const id = Number(props.cluster_id)
                if (zoom >= 17) {
                  const ids = new Set(index.getLeaves(id, Infinity).map(point => point.properties.eventId))
                  setSelected(filtered.filter(item => ids.has(item.id)))
                } else {
                  const target = Math.min(19, index.getClusterExpansionZoom(id))
                  const scale = 2 ** (zoom - target)
                  map.current?.animateToRegion({ latitude, longitude, latitudeDelta: region.latitudeDelta * scale, longitudeDelta: region.longitudeDelta * scale }, 400)
                }
              } else if (event) setSelected([event])
            }}>
            <View style={{ alignItems: "center" }}><View style={[s.pin, isCluster && s.cluster, { backgroundColor: isCluster ? "#e9ac60" : categoryVisual(event?.interest.name || "").color }]}>
              <Label style={s.pinText}>{isCluster ? String(count) : categoryVisual(event?.interest.name || "").icon}</Label>
            </View>
            {!isCluster && zoom >= 14 && <View style={s.pinLabel}><Label style={s.pinLabelText}>{event?.interest.name} · {event?.startTime}</Label></View>}
            </View>
          </Marker>
        })}
      </MapView>
      {mode === "heat" && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: heatOpacity }]}>
        <Svg width={size.width} height={size.height}>{density.filter(path => path.d).map((path, i) => <Path key={i} d={path.d} fill={path.color} opacity={path.opacity} />)}</Svg>
      </View>}
    </View>
    <Box pointerEvents="box-none" style={s.top}>
      <Box style={s.heading}><BackButton navigate={navigate} fallback="discover" onPress={() => navigate("discover")} /><Label style={s.title}>Harita</Label><Label style={s.badge}>{visible.length} etkinlik görünümde</Label></Box>
      <Scroll horizontal style={s.filters}>
        <FilterChip solid label="✦ Sana göre" selected={filterOpen || !!filters.place || !!filters.timeFrom || !!filters.interestIds.length || filters.datePreset !== "all"} onPress={() => { interacted.current = true; setFilterOpen(true) }} />
        {([["today", "Bugün"], ["tomorrow", "Yarın"], ["week", "Haftaya"]] as const).map(([id, label]) => <FilterChip solid key={id} label={label} selected={filters.datePreset === id} onPress={() => applyFilters({ ...filters, datePreset: id })} />)}
        <FilterChip solid label={locating ? "Konum alınıyor…" : nearby ? `${nearby.name} yakınında` : "⌖ Yakınımda"} selected={!!nearby && filters.place?.latitude === nearby.latitude && filters.place?.longitude === nearby.longitude} onPress={() => void locate(true)} />
        <FilterChip solid label={now.getHours() < 22 ? "Bu akşam" : "Yarın sabah"} selected={false} onPress={() => applyFilters({ ...filters, datePreset: now.getHours() < 22 ? "today" : "tomorrow", timeFrom: now.getHours() < 22 ? "18:00" : "08:00", timeTo: now.getHours() < 22 ? "23:59" : "12:00" })} />
      </Scroll>
      <Scroll horizontal style={s.filters}><FilterChip solid label="Tüm türler" selected={!filters.interestIds.length} onPress={() => applyFilters({ ...filters, interestIds: [] })} />{categories.map(item => <FilterChip solid key={item.id} label={`${categoryVisual(item.name).icon} ${item.name}`} selected={filters.interestIds.includes(item.id)} onPress={() => applyFilters({ ...filters, interestIds: filters.interestIds.includes(item.id) ? filters.interestIds.filter(id => id !== item.id) : [...filters.interestIds, item.id] })} />)}</Scroll>
    </Box>
    <Box style={s.controls}>
      <Touch accessibilityLabel="Yakınlaştır" onPress={() => zoomBy(0.5)} style={s.control}><Label style={s.controlText}>+</Label></Touch>
      <Touch accessibilityLabel="Uzaklaştır" onPress={() => zoomBy(2)} style={s.control}><Label style={s.controlText}>−</Label></Touch>
      <Touch accessibilityLabel="Tüm etkinlikleri göster" disabled={!filtered.length} onPress={() => map.current?.fitToCoordinates(filtered.map(event => ({ latitude: event.latitude, longitude: event.longitude })), { edgePadding: { top: 150, right: 50, bottom: 30, left: 50 }, animated: true })} style={s.control}><Label style={s.controlText}>◎</Label></Touch>
    </Box>
    <Box style={s.bottom}>
      <Box style={s.panel} onLayout={event => setPanelHeight(event.nativeEvent.layout.height)}>
        <Box style={s.heading}><Label style={s.panelTitle}>{MODE_LABELS[mode]}</Label><Label style={s.muted}>Otomatik görünüm</Label></Box>
        <Box style={s.legend}>
          {mode === "heat" ? ["Seyrek", "Orta", "Yoğun", "Çok yoğun"].map((label, i) => <Box key={label} style={s.legendItem}><View style={[s.dot, { backgroundColor: COLORS[i] }]} /><Label style={s.muted}>{label}</Label></Box>) : <Scroll horizontal style={s.filters}>{categories.filter(item => filtered.some(event => event.interest.id === item.id)).map(item => <Box key={item.id} style={s.legendItem}><Label>{categoryVisual(item.name).icon}</Label><Label style={s.muted}>{item.name}</Label></Box>)}</Scroll>}

        </Box>
        <Touch onPress={() => setFilterOpen(true)}><Label style={s.gold}>{filters.place ? `${filters.place.name} · ${filters.radiusKm} km` : "Her yerde"} · {filters.datePreset === "all" ? "Yaklaşan" : `${range.from}${range.to && range.to !== range.from ? ` → ${range.to}` : ""}`}{filters.timeFrom ? ` · ${filters.timeFrom}–${filters.timeTo}` : ""}  Düzenle</Label></Touch>
        {locationError && <Touch onPress={() => { setLocationError(null); setFilterOpen(true) }}><Label style={s.error}>{locationError}</Label></Touch>}
        {loading ? <Box style={s.legendItem}><ActivityIndicator color="#dcb95d" /><Label style={s.muted}>Etkinlikler yükleniyor…</Label></Box>
          : error ? <Touch onPress={() => setRetry(value => value + 1)}><Label style={s.error}>{error} Yenile ↻</Label></Touch>
          : !filtered.length ? <Label style={s.muted}>Bu filtrelerde konumu kayıtlı etkinlik bulunamadı.</Label>
          : <Label style={s.muted}>{mode === "heat" ? "Yakınlaşarak kümeleri keşfet. Renkler bu görünümdeki göreli yoğunluğu gösterir." : mode === "cluster" ? "Sayılar etkinlik adedidir. Kümeye dokunarak yakınlaş." : "Noktaya dokunarak etkinliği seç. Aynı konumdakiler sayılı gösterilir."}</Label>}
        {truncated && <Label style={s.error}>İlk 2.000 etkinlik gösteriliyor; yoğunluk tüm veriyi kapsamıyor.</Label>}
        {selected.length > 0 && <Scroll style={s.selection}>{selected.map(event => <Touch key={event.id} onPress={() => openEvent(event)} style={s.eventRow}><Box style={{ flex: 1 }}><Label style={s.panelTitle}>{event.interest.name}</Label><Label style={s.muted}>{event.date} · {event.startTime}</Label></Box><Label style={s.gold}>Detay →</Label></Touch>)}</Scroll>}
      </Box>
    </Box>
    <BottomNav active="map" navigate={navigate} />
    {filterOpen && <DiscoveryFilterSheet value={filters} categories={categories} onApply={applyFilters} onClose={() => setFilterOpen(false)} />}
  </Box>
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#06060e" },
  top: { position: "absolute", top: 16, left: 16, right: 16, gap: 8 },
  heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  title: { fontFamily: "Fraunces", color: "#fff", fontSize: 32 },
  badge: { color: "#ddd", backgroundColor: "#10101eed", borderRadius: 20, padding: 10, fontSize: 11 },
  filters: { flexGrow: 0, flexDirection: "row", gap: 6 },
  controls: { position: "absolute", right: 16, top: "32%", gap: 8 },
  control: { width: 44, height: 44, borderRadius: 16, backgroundColor: "#242336", borderWidth: 1.5, borderColor: "#68647b", alignItems: "center", justifyContent: "center" },
  controlText: { fontSize: 25, color: "#dcb95d" },
  pinLabel: { marginTop: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9, backgroundColor: "#171523ee" },
  pinLabelText: { fontFamily: "Outfit-Medium", fontSize: 10, color: "#f0ede8" },
  pin: { minWidth: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: "#fff", alignItems: "center", justifyContent: "center", paddingHorizontal: 7 },
  cluster: { minWidth: 44, height: 44, borderRadius: 22, borderColor: "#181823", borderWidth: 3 },
  pinText: { fontFamily: "Outfit-SemiBold", fontSize: 19, color: "#151320" },
  bottom: { position: "absolute", bottom: 88, left: 16, right: 16 },
  panel: { borderRadius: 22, padding: 16, gap: 12, backgroundColor: "#11111f", borderWidth: 1, borderColor: "#ffffff1a" },
  panelTitle: { fontFamily: "Outfit-SemiBold", color: "#f0ede8", fontSize: 15 },
  muted: { color: "#ddd9e8", fontSize: 11, lineHeight: 16 },
  legend: { flexDirection: "row", gap: 14, flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  error: { color: "#f3aa91", fontSize: 12 },
  selection: { maxHeight: 128 },
  eventRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderColor: "#ffffff1a" },
  gold: { color: "#dcb95d", fontSize: 12 },
})
