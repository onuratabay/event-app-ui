import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { getApiErrorMessage, getRatingForm, submitRatings, type RatingForm } from "../api/client";
import { useBottomNavInset } from "../components/BottomNav";
import { ErrorNotice } from "../components/ErrorNotice";
import { AtmoBackground, Avatar } from "../components/GlassUI";
import { CheckIcon, StarIcon } from "../components/Icons";
import TopNavBar from "../components/TopNavBar";
import { Box, Label, Scroll, Touch } from "../native/UI";
import { palette } from "../theme/palette";
import type { NavigateFn } from "../types";

/** The profile questions, in the order the profile shows them. */
const QUESTIONS = [
  { key: "punctuality", label: "Dakiklik & Güvenilirlik" },
  { key: "communication", label: "İletişim & Nezaket" },
  { key: "community", label: "Topluluk Uyumu" },
] as const;
type QuestionKey = typeof QUESTIONS[number]["key"];
type Answers = Partial<Record<QuestionKey, number>>;

/** Five stars; giving 3 fills the first three. */
function StarRating({ label, value, onChange, size = 28 }: { label: string; value: number; onChange: (value: number) => void; size?: number }) {
  return <Box style={s.stars} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 5, now: value, text: value ? `${value} yıldız` : "Puan verilmedi" }}>
    {[1, 2, 3, 4, 5].map(star => <Touch key={star} accessibilityLabel={`${label}: ${star} yıldız`} accessibilityState={{ selected: star <= value }} onPress={() => onChange(star)} style={s.star}>
      <StarIcon size={size} filled={star <= value} style={{ color: star <= value ? palette.accent : "rgba(185,195,255,.32)" }} />
    </Touch>)}
  </Box>;
}

/**
 * After an event ends every attendee rates the event (except its organizer) and any of the other
 * attendees they choose. Anyone they start rating needs all three questions answered before sending.
 */
export default function RateEventScreen({ navigate, eventId }: { navigate: NavigateFn; eventId: string }) {
  const navInset = useBottomNavInset();
  const [form, setForm] = useState<RatingForm | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [eventScore, setEventScore] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answers>>({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    let active = true;
    if (!eventId) { setLoadError("Etkinlik bulunamadı."); return; }
    getRatingForm(eventId).then(result => { if (active) { setForm(result); setSubmitted(result.submitted); } })
      .catch(cause => { if (active) setLoadError(getApiErrorMessage(cause, "Puanlama yüklenemedi.")); });
    return () => { active = false; };
  }, [eventId]);
  const answer = (userId: string, key: QuestionKey, value: number) => setAnswers(current => ({ ...current, [userId]: { ...current[userId], [key]: value } }));
  const clear = (userId: string) => setAnswers(current => { const next = { ...current }; delete next[userId]; return next; });
  const started = Object.entries(answers).filter(([, row]) => QUESTIONS.some(q => row[q.key]));
  const incomplete = (form?.participants ?? []).filter(person => started.some(([id, row]) => id === person.id && QUESTIONS.some(q => !row[q.key])));
  const needsEventScore = !!form && !form.isOwner && !eventScore;
  const missing = [
    needsEventScore ? "etkinlik puanı" : "",
    ...incomplete.map(person => `${person.firstName} için tüm sorular`),
    form?.isOwner && !started.length ? "en az bir katılımcı" : "",
  ].filter(Boolean);
  const send = async () => {
    if (!form || sending || missing.length) return;
    setSending(true); setSendError(null);
    try {
      await submitRatings(eventId, {
        ...(form.isOwner ? {} : { eventScore }),
        participants: started.map(([userId, row]) => ({ userId, punctuality: row.punctuality!, communication: row.communication!, community: row.community! })),
      });
      setSubmitted(true);
    } catch (cause) { setSendError(getApiErrorMessage(cause, "Puanlama gönderilemedi.")); }
    finally { setSending(false); }
  };
  const subtitle = form ? `${form.event.title} · ${new Date(`${form.event.date}T00:00:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}` : undefined;
  return <Box style={s.root}>
    <AtmoBackground />
    <TopNavBar navigate={navigate} fallback="notifications" title="Puanlama" subtitle={subtitle} />
    <Scroll style={[s.scroll, { paddingBottom: 40 + navInset }]}>
      {loadError && <ErrorNotice title="Puanlama açılamadı" message={loadError} />}
      {!form && !loadError && <Label style={s.muted}>Puanlama yükleniyor…</Label>}
      {form && submitted && <Box style={s.card}>
        <Box style={s.doneIcon}><CheckIcon size={22} style={{ color: palette.success }} /></Box>
        <Label style={s.title}>Puanlaman alındı</Label>
        <Label style={s.muted}>Teşekkürler! Puanlar katılımcıların profillerine yansıdı.</Label>
        <Touch onPress={() => navigate("notifications", { back: true })} style={s.secondary}>Bildirimlere dön</Touch>
      </Box>}
      {form && !submitted && <>
        {!form.isOwner && <Box style={s.card}>
          <Label style={s.heading}>Etkinlik</Label>
          <Label style={s.title}>Etkinliği genel olarak nasıl buldun?</Label>
          <StarRating label="Etkinlik puanı" value={eventScore} onChange={setEventScore} size={34} />
        </Box>}
        <Box walkthroughId="rating-people" style={s.section}>
          <Label style={s.heading}>Katılımcılar</Label>
          <Label style={s.muted}>İstediğin katılımcıları puanlayabilirsin. Puanlamaya başladığın her kişi için üç sorunun hepsini yanıtlaman gerekir.</Label>
        </Box>
        {!form.participants.length && <Label style={s.muted}>Puanlanacak başka katılımcı yok.</Label>}
        {form.participants.map(person => {
          const row = answers[person.id] ?? {};
          const name = `${person.firstName} ${person.lastName}`.trim();
          const touched = QUESTIONS.some(q => row[q.key]);
          const done = QUESTIONS.every(q => row[q.key]);
          return <Box key={person.id} style={[s.card, touched && !done && s.cardPending]}>
            <Box style={s.person}>
              <Avatar uri={person.profilePhoto || ""} name={name} size="md" />
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Label style={s.name} numberOfLines={1}>{name}</Label>
                <Label style={s.caption}>{person.isOwner ? "Düzenleyen" : "Katılımcı"}{done ? " · Tamamlandı" : touched ? " · Eksik sorular var" : ""}</Label>
              </Box>
              {touched && <Touch accessibilityLabel={`${name} puanlarını temizle`} onPress={() => clear(person.id)} style={s.clear}>Temizle</Touch>}
            </Box>
            {QUESTIONS.map(q => <Box key={q.key} style={s.question}>
              <Label style={[s.questionLabel, touched && !row[q.key] && { color: palette.error }]}>{q.label}</Label>
              <StarRating label={`${name} – ${q.label}`} value={row[q.key] ?? 0} onChange={value => answer(person.id, q.key, value)} size={24} />
            </Box>)}
          </Box>;
        })}
        {sendError && <ErrorNotice title="Gönderilemedi" message={sendError} onDismiss={() => setSendError(null)} />}
        {!!missing.length && <Label style={s.hint}>Göndermeden önce: {missing.join(", ")}.</Label>}
        <Touch walkthroughId="rating-submit" disabled={sending || !!missing.length} onPress={() => void send()} gradient={["#4d5bcb", "#6651c9"]} style={[s.primary, (sending || !!missing.length) && { opacity: .45 }]}>{sending ? "Gönderiliyor…" : "Puanlamayı gönder"}</Touch>
      </>}
    </Scroll>
  </Box>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background, overflow: "hidden" },
  scroll: { flex: 1, paddingHorizontal: 20, paddingTop: 80, gap: 12 },
  card: { padding: 16, borderRadius: 18, gap: 10, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  cardPending: { borderColor: "rgba(243,155,175,.45)" },
  section: { gap: 4, marginTop: 8 },
  heading: { color: palette.muted, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", textAlign: "left" },
  title: { color: palette.text, fontSize: 16, fontFamily: "Outfit-SemiBold", textAlign: "left" },
  muted: { color: palette.muted, fontSize: 13, lineHeight: 19, textAlign: "left" },
  caption: { color: palette.muted, fontSize: 11, textAlign: "left", marginTop: 2 },
  hint: { color: palette.error, fontSize: 12, lineHeight: 18, textAlign: "left" },
  person: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { color: palette.text, fontSize: 15, fontFamily: "Outfit-Medium", textAlign: "left" },
  clear: { paddingHorizontal: 10, paddingVertical: 6, color: palette.muted, fontSize: 12 },
  question: { gap: 4, paddingTop: 4 },
  questionLabel: { color: "rgba(244,245,255,.72)", fontSize: 13, textAlign: "left" },
  stars: { flexDirection: "row", alignItems: "center", gap: 4 },
  star: { padding: 4 },
  doneIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: palette.selected },
  primary: { paddingVertical: 14, borderRadius: 16, color: palette.text, fontSize: 15, fontFamily: "Outfit-SemiBold", marginTop: 4 },
  secondary: { paddingVertical: 12, borderRadius: 14, color: palette.text, fontSize: 14, backgroundColor: "rgba(255,255,255,.06)" },
});
