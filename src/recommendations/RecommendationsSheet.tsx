import { palette } from "../theme/palette";
import { useEventDeltas, patchApiEvent } from '../services/event-deltas'
import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, type ScrollView, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from "react-native"
import * as Location from "expo-location"
import { getApiErrorMessage, getMapEvents, putPreference } from "../api/client"
import { FilterChip, GlassInput } from "../components/GlassUI"
import HeaderIconButton from "../components/HeaderIconButton"
import { SparklesIcon } from "../components/Icons"
import { apiDate, dateRange, filterError, localDate, placeBounds, type MapPlace } from "../map/filters"
import { mapApiEvent, useStore } from "../native/Store"
import { Box, Label, Scroll, Touch } from "../native/UI"
import type { NavigateFn } from "../types"
import { ACTIVITIES, EQUIPMENT, initialProfile, PLACES, recommend, recommendationFilters, targetActivities, type RecommendationProfile } from "./model"

export default function RecommendationsSheet({ onClose, navigate }: { onClose: () => void; navigate: NavigateFn }) {
  const { data, setData } = useStore()
  const [profile, setProfile] = useState(() => data.user.recommendationProfile || initialProfile(data.user.interests))
  const [results, setResults] = useState<ReturnType<typeof recommend> | null>(null)
  useEventDeltas(results?.map(row => row.event.id) || [], patch => setResults(previous => previous?.map(row => ({ ...row, event: patchApiEvent(row.event, patch) })).filter(row => !['cancelled', 'closed'].includes(row.event.status.enum) && row.event.confirmedParticipantCount < row.event.maxParticipants) || null))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [partial, setPartial] = useState(false)
  const request = useRef<AbortController | null>(null)
  const scroll = useRef<ScrollView>(null)
  const location = PLACES.find(place => place.id === profile.trip.placeId) || PLACES[0]
  const cityName = location.city === "izmir" ? "İzmir" : "Ankara"
  const activities = targetActivities(profile)
  const update = (change: (previous: RecommendationProfile) => RecommendationProfile) => {
    request.current?.abort(); request.current = null
    setBusy(false); setResults(null); setError(null); setProfile(change)
  }
  useEffect(() => {
    if (data.user.recommendationProfile) void find()
    return () => request.current?.abort()
  }, [])
  async function find() {
    if (!activities.length) { setError("Bu yer için yapmak istediğin etkinlikleri veya şehirdeki ekipmanını seç."); return }
    const dummy = { name: location.name, latitude: 0, longitude: 0 }
    const invalid = filterError(recommendationFilters(profile, dummy))
    if (invalid) { setError(invalid); return }
    request.current?.abort()
    const controller = new AbortController(); request.current = controller
    setBusy(true); setError(null); setResults(null)
    const savedRange = dateRange(recommendationFilters(profile, dummy))
    const savedProfile: RecommendationProfile = { ...profile, trip: { ...profile.trip, datePreset: "custom", dateFrom: savedRange.from, dateTo: savedRange.to } }
    try {
      await putPreference("recommendationProfile", savedProfile)
      if (controller.signal.aborted) return
      setData(current => ({ ...current, user: { ...current.user, recommendationProfile: savedProfile } }))
      let place: MapPlace
      if ("latitude" in location) place = { name: location.name, latitude: location.latitude, longitude: location.longitude }
      else {
        if (Platform.OS === "android") {
          const permission = await Location.requestForegroundPermissionsAsync()
          if (!permission.granted) throw new Error("Bu bölgeyi bulmak için konum izni gerekiyor. Şehir seçimiyle de devam edebilirsin.")
        }
        const [coordinate] = await Location.geocodeAsync(location.query)
        if (!coordinate) throw new Error("Bölgenin konumu bulunamadı. Şehir seçimiyle tekrar dene.")
        place = { name: location.name, latitude: coordinate.latitude, longitude: coordinate.longitude }
      }
      if (controller.signal.aborted) return
      const filters = recommendationFilters(profile, place)
      const range = dateRange(filters)
      const response = await getMapEvents(controller.signal, { dateFrom: apiDate(range.from), dateTo: apiDate(range.to), ...placeBounds(place, filters.radiusKm) })
      if (controller.signal.aborted) return
      setResults(recommend(response.items, profile, place)); setPartial(response.truncated)
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error && (cause.message.startsWith("Bu bölgeyi") || cause.message.startsWith("Bölgenin")) ? cause.message : getApiErrorMessage(cause, "Öneriler yüklenemedi. Tekrar dene."))
    } finally { if (request.current === controller) setBusy(false) }
  }
  const toggle = (values: string[], id: string) => values.includes(id) ? values.filter(value => value !== id) : [...values, id]
  const period = profile.trip.datePreset === "week" ? "Haftaya" : profile.trip.datePreset === "today" ? "Bugün" : profile.trip.datePreset === "tomorrow" ? "Yarın" : "Seçtiğin tarihlerde"
  return <Modal transparent visible animationType="slide" onRequestClose={onClose}>
    <View style={s.backdrop}><Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Önerileri kapat" onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.keyboard}>
        <Box style={s.panel}>
          <Box style={s.row}><SparklesIcon size={24} style={{ color: "#c7ceff" }} /><Box style={{ flex: 1 }}><Label style={s.title}>Sana özel</Label><Label style={s.hint}>Planına, tercihlerine ve ekipmanına göre</Label></Box><HeaderIconButton label="Önerileri kapat" onPress={onClose}><Label style={s.text}>✕</Label></HeaderIconButton></Box>
          <Scroll ref={scroll} style={s.scroll} keyboardShouldPersistTaps="handled">
            <Label style={s.section}>Nerede olacaksın?</Label>
            <Box style={s.wrap}>{PLACES.map(place => <FilterChip solid key={place.id} label={place.name} selected={profile.trip.placeId === place.id} onPress={() => update(previous => ({ ...previous, trip: { ...previous.trip, placeId: place.id } }))} />)}</Box>
            <Label style={s.section}>Ne zaman?</Label>
            <Box style={s.wrap}>{([["today", "Bugün"], ["tomorrow", "Yarın"], ["week", "Haftaya"], ["custom", "Tarih seç"]] as const).map(([id, label]) => <FilterChip solid key={id} label={label} selected={profile.trip.datePreset === id} onPress={() => update(previous => ({ ...previous, trip: { ...previous.trip, datePreset: id, dateFrom: previous.trip.dateFrom || localDate(new Date()), dateTo: previous.trip.dateTo || localDate(new Date()) } }))} />)}</Box>
            {profile.trip.datePreset === "custom" && <Box style={s.row}><Box style={{ flex: 1 }}><GlassInput label="Başlangıç" mode="date" value={profile.trip.dateFrom} onChangeText={dateFrom => update(previous => ({ ...previous, trip: { ...previous.trip, dateFrom } }))} /></Box><Box style={{ flex: 1 }}><GlassInput label="Bitiş" mode="date" value={profile.trip.dateTo} onChangeText={dateTo => update(previous => ({ ...previous, trip: { ...previous.trip, dateTo } }))} /></Box></Box>}
            <Label style={s.section}>{cityName}’de nelerin var?</Label>
            <Label style={s.hint}>Ekipmanını bulunduğu şehir için kaydet. Her şehir ayrı hatırlanır.</Label>
            <Box style={s.wrap}>{EQUIPMENT.map(item => <FilterChip solid key={item.id} label={item.label} selected={(profile.equipmentByCity[location.city] || []).includes(item.id)} onPress={() => update(previous => ({ ...previous, equipmentByCity: { ...previous.equipmentByCity, [location.city]: toggle(previous.equipmentByCity[location.city] || [], item.id) } }))} />)}</Box>
            <Label style={s.section}>{location.name} için ne yapmak istersin?</Label>
            <Box style={s.wrap}>{ACTIVITIES.map(item => <FilterChip solid key={item.id} label={item.label} selected={(profile.activitiesByPlace[location.id] || []).includes(item.id)} onPress={() => update(previous => ({ ...previous, activitiesByPlace: { ...previous.activitiesByPlace, [location.id]: toggle(previous.activitiesByPlace[location.id] || [], item.id) } }))} />)}</Box>
            <Label style={s.hint}>Tür seçmezsen kaydettiğin ekipmana uygun etkinlikleri ararım. Tercihlerin hesabına kaydedilir; diğer cihazlarında da kullanılır.</Label>
            {results && <Box style={s.results} onLayout={event => scroll.current?.scrollTo({ y: event.nativeEvent.layout.y, animated: true })}>
              <Label style={s.resultTitle}>{results.length ? `${period} ${location.name} için sana özel ${results.length}${activities.length === 1 ? ` ${activities[0].label.toLocaleLowerCase("tr-TR")}` : ""} etkinlik buldum.` : "Bu planla eşleşen etkinlik henüz yok."}</Label>
              {!results.length && <Label style={s.hint}>Tarihi, yeri veya etkinlik tercihlerini değiştirerek tekrar deneyebilirsin.</Label>}
              {results.map(({ event, reason }) => <Touch key={event.id} style={s.card} onPress={() => {
                setData(current => ({ ...current, events: [mapApiEvent(event), ...current.events.filter(item => item.id !== event.id)] }))
                onClose(); navigate("event-detail", { eventId: event.id })
              }}><Label style={s.text}>{event.interest.name} →</Label><Label style={s.hint}>{event.date} · {event.startTime}</Label><Label style={s.reason}>{reason}</Label></Touch>)}
              {partial && <Label style={s.hint}>Bu öneriler yüklenen ilk 2.000 etkinlik içinden seçildi.</Label>}
            </Box>}
          </Scroll>
          {error && <Label style={s.error}>{error}</Label>}
          <Touch disabled={busy} onPress={() => void find()} style={s.submit}>{busy ? <ActivityIndicator color="#f4f5ff" /> : <Label style={s.submitText}>Kaydet ve önerileri bul</Label>}</Touch>
        </Box>
      </KeyboardAvoidingView>
    </View>
  </Modal>
}
const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", paddingTop: 48, backgroundColor: "#00000088" }, keyboard: { maxHeight: "94%" }, panel: { backgroundColor: palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 34, gap: 14, maxHeight: "100%" },
  row: { flexDirection: "row", gap: 12, alignItems: "center" }, title: { color: "#f4f5ff", fontFamily: "Fraunces", fontSize: 28 }, hint: { color: "#c0bacd", fontSize: 12, lineHeight: 18 }, section: { color: "#f4f5ff", fontFamily: "Outfit-SemiBold", fontSize: 17, marginTop: 18, marginBottom: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 6 }, scroll: { flexShrink: 1 }, text: { color: "#f4f5ff", fontFamily: "Outfit-SemiBold", fontSize: 15 }, results: { marginTop: 20, gap: 10 }, resultTitle: { color: "#c7ceff", fontFamily: "Outfit-SemiBold", fontSize: 20, lineHeight: 27 }, card: { backgroundColor: palette.surface, borderRadius: 16, padding: 14, gap: 6 }, reason: { color: "#b9c3ff", fontSize: 12, lineHeight: 18 }, error: { color: "#f3aa91", fontSize: 12 }, submit: { minHeight: 50, padding: 15, backgroundColor: "#4d5bcb", borderRadius: 17, alignItems: "center", justifyContent: "center" }, submitText: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 15 },
})
