import { useEffect, useState } from "react"
import { Image, StyleSheet, Text, View } from "react-native"
import type { NativeAd } from "react-native-google-mobile-ads"
import { Box } from "../native/UI"
import { palette } from "../theme/palette"
import { adsModule, nativeUnitId, prepareAds } from "./ads"

/**
 * A native ad drawn like a feed event card: same size, corners and glass surface, with a clear
 * "Reklam" label (required by AdMob, and keeps it distinguishable from events). Renders nothing until
 * an ad has loaded, and nothing at all where ads are unavailable (Expo Go, no ad unit, no fill).
 */
export default function FeedAdCard() {
  const [ad, setAd] = useState<NativeAd | null>(null)
  useEffect(() => {
    let active = true
    let loaded: NativeAd | null = null
    void (async () => {
      const ads = adsModule(), unit = nativeUnitId()
      if (!ads || !unit || !(await prepareAds())) return
      try {
        // Landscape media fills the card's cover like an event photo; Google's AdChoices icon sits top right,
        // clear of our "Reklam" label on the left.
        loaded = await ads.NativeAd.createForAdRequest(unit, { startVideoMuted: true, aspectRatio: 2 /* LANDSCAPE */, adChoicesPlacement: 1 /* TOP_RIGHT */ })
        if (active) setAd(loaded); else loaded.destroy()
      } catch { /* No fill or a network error: the slot simply stays empty. */ }
    })()
    return () => { active = false; loaded?.destroy() }
  }, [])
  const ads = adsModule()
  if (!ad || !ads) return null
  const { NativeAdView, NativeAsset, NativeAssetType, NativeMediaView } = ads
  // The rounded glass surface lives on a plain view: NativeAdView is native and does not clip the
  // media view to its own corners on iOS, so the outer box does the clipping, like EventCard's.
  return <Box style={s.card} glass>
    <NativeAdView nativeAd={ad} style={s.adView}>
      <View style={s.media}>
        {ad.mediaContent ? <NativeMediaView resizeMode="cover" style={StyleSheet.absoluteFill} /> : null}
        <View style={s.badge}><Text style={s.badgeText}>Reklam</Text></View>
      </View>
      <View style={s.body}>
        <View style={s.row}>
          {ad.icon ? <NativeAsset assetType={NativeAssetType.ICON}><Image source={{ uri: ad.icon.url }} style={s.icon} /></NativeAsset> : null}
          {ad.advertiser ? <NativeAsset assetType={NativeAssetType.ADVERTISER}><Text style={s.advertiser} numberOfLines={1}>{ad.advertiser}</Text></NativeAsset> : null}
        </View>
        <NativeAsset assetType={NativeAssetType.HEADLINE}><Text style={s.headline} numberOfLines={2}>{ad.headline}</Text></NativeAsset>
        {ad.body ? <NativeAsset assetType={NativeAssetType.BODY}><Text style={s.text} numberOfLines={2}>{ad.body}</Text></NativeAsset> : null}
        {ad.callToAction ? <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}><Text style={s.cta}>{ad.callToAction}</Text></NativeAsset> : null}
      </View>
    </NativeAdView>
  </Box>
}
const s = StyleSheet.create({
  card: { marginBottom: 16, borderRadius: 16, overflow: "hidden", backgroundColor: palette.glassCard, borderWidth: 1, borderColor: palette.glassBorder },
  adView: { width: "100%" },
  media: { height: 176, overflow: "hidden", backgroundColor: "#111827" },
  badge: { position: "absolute", top: 12, left: 12, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: "rgba(0,0,0,.55)", borderWidth: 1, borderColor: "rgba(255,255,255,.18)" },
  badgeText: { color: palette.text, fontSize: 11, fontFamily: "Outfit-SemiBold", letterSpacing: 0.3 },
  body: { padding: 16, gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  icon: { width: 20, height: 20, borderRadius: 5 },
  advertiser: { flexShrink: 1, color: "rgba(241,245,249,.55)", fontSize: 12, fontFamily: "Outfit-Medium" },
  headline: { color: palette.text, fontFamily: "Fraunces", fontSize: 18, lineHeight: 23 },
  text: { color: "rgba(241,245,249,.55)", fontSize: 13, lineHeight: 19 },
  cta: { alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, overflow: "hidden", backgroundColor: palette.blue, color: palette.text, fontSize: 13, fontFamily: "Outfit-SemiBold" },
})
