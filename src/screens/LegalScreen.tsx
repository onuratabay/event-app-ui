import { useEffect, useState } from "react"
import { StyleSheet } from "react-native"
import { useRouter } from "expo-router"
import { getApiErrorMessage, getLegalDocument, type LegalDocumentType } from "../api/client"
import TopNavBar from "../components/TopNavBar"
import { AtmoBackground } from "../components/GlassUI"
import LoadingSpinner from "../components/LoadingSpinner"
import { LEGAL_TITLES } from "../legal/links"
import { Box, Label, Scroll, Touch } from "../native/UI"
import { palette } from "../theme/palette"
import type { NavigateFn } from "../types"

type Document = Awaited<ReturnType<typeof getLegalDocument>>

/** Server text format: "## " heading, "- " bullet, blank line between paragraphs. */
function Body({ text }: { text: string }) {
  return <Box style={s.body}>
    {text.split(/\n{2,}/).map((block, i) => {
      const lines = block.split("\n").filter(line => line.trim())
      return <Box key={i} style={s.block}>
        {lines.map((line, j) => line.startsWith("## ")
          ? <Label key={j} accessibilityRole="header" style={s.heading}>{line.slice(3)}</Label>
          : line.startsWith("- ")
            ? <Box key={j} style={s.bulletRow}><Label style={s.bullet}>•</Label><Label style={[s.paragraph, s.bulletText]}>{line.slice(2)}</Label></Box>
            : <Label key={j} style={s.paragraph}>{line}</Label>)}
      </Box>
    })}
  </Box>
}

export default function LegalScreen({ navigate, type }: { navigate: NavigateFn; type: LegalDocumentType }) {
  const router = useRouter()
  const [doc, setDoc] = useState<Document | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setError(null)
    getLegalDocument(type)
      .then(result => { if (active) setDoc(result) })
      .catch(cause => { if (active) setError(getApiErrorMessage(cause, "Metin yüklenemedi. Bağlantını kontrol edip tekrar dene.")) })
    return () => { active = false }
  }, [type, attempt])
  // Legal pages open above sign-up and settings; going back must keep that page as it was.
  const back = () => { if (router.canGoBack()) router.back(); else navigate("welcome", { reset: true }) }
  const updated = doc ? new Date(doc.publishedAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : ""
  return <Box style={s.screen}>
    <AtmoBackground variant="violet" />
    <TopNavBar navigate={navigate} fallback="welcome" onBack={back} backLabel="Geri" title={doc?.title || LEGAL_TITLES[type]} />
    {!doc && !error ? <Box style={s.center}><LoadingSpinner size="large" /></Box> : <Scroll style={s.page}>
      {error ? <Box style={s.errorBox}>
        <Label accessibilityRole="alert" style={s.error}>{error}</Label>
        <Touch onPress={() => setAttempt(value => value + 1)} style={s.retry}><Label style={s.retryLabel}>Tekrar dene</Label></Touch>
      </Box> : doc && <>
        <Label style={s.meta}>{`Sürüm ${doc.version} · ${updated}`}</Label>
        <Body text={doc.body} />
      </>}
    </Scroll>}
  </Box>
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  page: { paddingTop: 84, paddingHorizontal: 20, paddingBottom: 60 },
  meta: { color: palette.muted, fontSize: 12, marginBottom: 16 },
  body: { gap: 14 },
  block: { gap: 8 },
  heading: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 16, marginTop: 6 },
  paragraph: { color: "rgba(244,245,255,.78)", fontSize: 14, lineHeight: 22 },
  bulletRow: { flexDirection: "row", gap: 8 },
  bullet: { color: palette.accent, fontSize: 14, lineHeight: 22 },
  bulletText: { flex: 1 },
  errorBox: { gap: 14, paddingTop: 20 },
  error: { color: palette.error, fontSize: 14, lineHeight: 20 },
  retry: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center", paddingHorizontal: 18, borderRadius: 14, borderWidth: 1, borderColor: palette.border },
  retryLabel: { color: palette.text, fontFamily: "Outfit-Medium", fontSize: 14 },
})
