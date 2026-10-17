import { useState } from "react"
import { StyleSheet } from "react-native"
import type { AdminStats as Stats } from "../api/client"
import { Box, Label, Touch } from "../native/UI"
import { palette } from "../theme/palette"

const fmt = (value: number) => value.toLocaleString("tr-TR")
const pct = (part: number, whole: number) => whole ? `%${Math.round(part / whole * 100)}` : "—"
const score = (value: number | null) => value === null ? "—" : `${value.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} / 5`
const dayLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

const USER_STATUS: Array<[string, string]> = [["approved", "Onaylı"], ["reference_pending", "Onay bekliyor"], ["security_review", "İncelemede"], ["profile_incomplete", "Profil eksik"], ["passive", "Pasif"], ["rejected", "Reddedildi"], ["suspended", "Askıda"]]
const EVENT_STATUS: Array<[string, string]> = [["waiting_participants", "Katılımcı bekliyor"], ["started", "Başladı"], ["closed", "Tamamlandı"], ["cancelled", "İptal"]]
const VISIBILITY: Array<[string, string]> = [["public", "Herkese açık"], ["recommended", "Önerilen"], ["invite_only", "Davetli"]]
const CANCEL: Array<[string, string]> = [["insufficient_participants", "Yetersiz katılım"], ["owner_request", "Organizatör iptali"]]
const PARTICIPANT: Array<[string, string]> = [["confirmed", "Katıldı"], ["invited", "Davetli"], ["waitlisted", "Yedek liste"], ["declined", "Ayrıldı / reddetti"]]
const REPORT: Array<[string, string]> = [["submitted", "Yeni"], ["in_review", "İncelemede"], ["completed", "Sonuçlandı"]]
const REFERENCE: Array<[string, string]> = [["pending", "Yanıt bekliyor"], ["approved", "Onaylandı"], ["declined", "Reddedildi"]]
const rows = (counts: Record<string, number>, labels: Array<[string, string]>) => labels.map(([key, name]) => ({ name, count: counts[key] ?? 0 }))

/** A headline number with its context line. */
function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return <Box style={s.tile} accessible accessibilityLabel={`${label}: ${value}${note ? `, ${note}` : ""}`}>
    <Label style={s.tileLabel} numberOfLines={1}>{label}</Label>
    <Label style={s.tileValue} numberOfLines={1}>{value}</Label>
    {note ? <Label style={s.tileNote} numberOfLines={2}>{note}</Label> : null}
  </Box>
}

/** Label/value line inside a card. */
function Line({ label, value }: { label: string; value: string }) {
  return <Box style={s.line}><Label style={s.lineLabel}>{label}</Label><Label style={s.lineValue}>{value}</Label></Box>
}

/** Horizontal bars for a breakdown; shares are against the largest row, the value is written beside it. */
function Bars({ items, total }: { items: Array<{ name: string; count: number }>; total?: number }) {
  const shown = items.filter(item => item.count > 0)
  if (!shown.length) return <Label style={s.empty}>Henüz veri yok.</Label>
  const max = Math.max(...shown.map(item => item.count))
  return <Box style={{ gap: 10 }}>
    {shown.map(item => <Box key={item.name} style={{ gap: 4 }} accessible accessibilityLabel={`${item.name}: ${item.count}`}>
      <Box style={s.line}>
        <Label style={s.lineLabel} numberOfLines={1}>{item.name}</Label>
        <Label style={s.lineValue}>{total ? `${fmt(item.count)} · ${pct(item.count, total)}` : fmt(item.count)}</Label>
      </Box>
      <Box style={s.track}><Box style={[s.bar, { width: `${Math.max(2, item.count / max * 100)}%` }]} /></Box>
    </Box>)}
  </Box>
}

/** Thirty daily columns; tapping one shows that day, otherwise the period total is shown. */
function DailyChart({ title, days, values }: { title: string; days: string[]; values: number[] }) {
  const [picked, setPicked] = useState<number | null>(null)
  const max = Math.max(1, ...values)
  const total = sum(values)
  return <Box style={s.card}>
    <Box style={s.chartHead}>
      <Label style={s.cardTitle}>{title}</Label>
      <Label style={s.chartValue}>{picked === null ? `30 gün · ${fmt(total)}` : `${dayLabel(days[picked])} · ${fmt(values[picked])}`}</Label>
    </Box>
    <Box style={s.chart}>
      {/* Faint guide at the maximum, labelled with its value. */}
      <Box style={s.guide} pointerEvents="none"><Label style={s.guideLabel}>{fmt(max)}</Label></Box>
      {values.map((value, index) => <Touch key={days[index]} haptic={false} accessibilityLabel={`${dayLabel(days[index])}: ${value}`}
        onPress={() => setPicked(current => current === index ? null : index)} style={s.column}>
        <Box style={[s.columnBar, { height: value ? `${Math.max(4, value / max * 100)}%` : 2 }, !value && s.columnZero, picked === index && s.columnPicked]} />
      </Touch>)}
    </Box>
    <Box style={s.axis}><Label style={s.axisLabel}>{dayLabel(days[0])}</Label><Label style={s.axisLabel}>Bugün</Label></Box>
  </Box>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <Box style={{ gap: 10 }}><Label style={s.section}>{title}</Label>{children}</Box>
}
function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return <Box style={s.card}>{title ? <Label style={s.cardTitle}>{title}</Label> : null}{children}</Box>
}

/** Admin overview: members, events, participation, engagement and moderation from GET /admin/stats. */
export default function AdminStats({ stats }: { stats: Stats }) {
  const { users, events, participation, engagement, moderation, series } = stats
  const updated = new Date(stats.generatedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
  return <Box style={{ gap: 20 }}>
    <Box columns={2} style={{ gap: 10 }}>
      <Tile label="Toplam üye" value={fmt(users.total)} note={`${fmt(users.byStatus.approved ?? 0)} onaylı · bu hafta +${fmt(users.new7d)}`} />
      <Tile label="Aktif kullanıcı" value={fmt(users.active.week)} note={`Son 7 gün · bugün ${fmt(users.active.day)}, 30 gün ${fmt(users.active.month)}`} />
      <Tile label="Aktif etkinlik" value={fmt(events.active)} note={`${fmt(events.upcoming)} yaklaşan · bugün ${fmt(events.today)}`} />
      <Tile label="Toplam etkinlik" value={fmt(events.total)} note={`Bu hafta +${fmt(events.created7d)} · 30 gün +${fmt(events.created30d)}`} />
    </Box>
    {events.overdue > 0 && <Box style={s.warning} accessibilityRole="alert">
      <Label style={s.warningText}>{`${fmt(events.overdue)} etkinliğin başlama saati geçti ama hâlâ "katılımcı bekliyor" görünüyor. Zamanlanmış etkinlik işleri çalışmıyor olabilir.`}</Label>
    </Box>}

    <Section title="Üyeler">
      <DailyChart title="Yeni kayıtlar" days={series.days} values={series.registrations} />
      <Card title="Durum dağılımı"><Bars items={rows(users.byStatus, USER_STATUS)} total={users.total} /></Card>
      <Card title="Aktiflik">
        <Line label="Son 24 saat" value={fmt(users.active.day)} />
        <Line label="Son 7 gün" value={`${fmt(users.active.week)} · ${pct(users.active.week, users.total)}`} />
        <Line label="Son 30 gün" value={`${fmt(users.active.month)} · ${pct(users.active.month, users.total)}`} />
        <Label style={s.footnote}>Kayıt, etkinlik oluşturma ya da katılma, mesaj, favori, puanlama, bildirim okuma veya uygulamayı açıp bildirim kaydını yenileyen üyeler.</Label>
      </Card>
      <Card title="Profil ve izinler">
        <Line label="Profil fotoğrafı" value={`${fmt(users.withPhoto)} · ${pct(users.withPhoto, users.total)}`} />
        <Line label="Instagram bağlı" value={`${fmt(users.withInstagram)} · ${pct(users.withInstagram, users.total)}`} />
        <Line label="Bildirim izni (push)" value={`${fmt(users.withPush)} · ${pct(users.withPush, users.total)}`} />
        <Line label="Cihazlar" value={`iOS ${fmt(users.pushTokens.ios)} · Android ${fmt(users.pushTokens.android)}`} />
        <Line label="Ticari ileti izni" value={`${fmt(users.marketingConsent)} · ${pct(users.marketingConsent, users.total)}`} />
        <Line label="Kilitli hesap" value={fmt(users.locked)} />
        <Line label="Yönetici" value={fmt(users.admins)} />
      </Card>
      <Card title="Yaş grupları"><Bars items={users.ageBuckets} total={users.total} /></Card>
      <Card title="Şehirler"><Bars items={users.topCities} total={users.total} /></Card>
      <Card title="En çok seçilen ilgi alanları"><Bars items={users.topInterests} /></Card>
    </Section>

    <Section title="Etkinlikler">
      <DailyChart title="Oluşturulan etkinlikler" days={series.days} values={series.events} />
      <Card title="Durum dağılımı"><Bars items={rows(events.byStatus, EVENT_STATUS)} total={events.total} /></Card>
      <Card title="Doluluk">
        <Line label="Ortalama katılımcı" value={events.avgConfirmed === null ? "—" : events.avgConfirmed.toLocaleString("tr-TR")} />
        <Line label="Ortalama doluluk" value={events.fillRate === null ? "—" : `%${Math.round(events.fillRate * 100)}`} />
        <Line label="Minimuma ulaşan" value={`${fmt(events.reachedMinimum)} / ${fmt(events.notCancelled)}`} />
        <Line label="Ücretli etkinlik" value={fmt(events.paid)} />
        <Label style={s.footnote}>İptal edilenler hariç; doluluk sınırsız kontenjanlı etkinlikleri saymaz.</Label>
      </Card>
      <Card title="İptal nedenleri"><Bars items={rows(events.cancellations, CANCEL)} /></Card>
      <Card title="Görünürlük"><Bars items={rows(events.byVisibility, VISIBILITY)} total={events.total} /></Card>
      <Card title="En çok etkinlik açılan ilgi alanları"><Bars items={events.topInterests} /></Card>
    </Section>

    <Section title="Katılım">
      <Card title="Katılım kayıtları"><Bars items={rows(participation.byStatus, PARTICIPANT)} /></Card>
      <Card>
        <Line label="Misafir katılımı" value={`${fmt(participation.guests)} · ${fmt(participation.activeGuests)} geçerli`} />
        <Line label="Paylaşım linki" value={fmt(participation.shareLinks)} />
        <Line label="Giriş (check-in)" value={fmt(participation.checkins)} />
        <Line label="Favoriye eklenen" value={fmt(participation.favorites)} />
        <Line label="Takvim havuzu" value={`${fmt(engagement.availability.active)} etkin · ${fmt(engagement.availability.paused)} durdurulmuş`} />
      </Card>
    </Section>

    <Section title="Etkileşim">
      <DailyChart title="Mesajlar (oda + direkt)" days={series.days} values={series.messages} />
      <Card>
        <Line label="Oda mesajı" value={`${fmt(engagement.eventMessages)} · bu hafta ${fmt(engagement.eventMessages7d)}`} />
        <Line label="Duyuru" value={fmt(engagement.announcements)} />
        <Line label="Misafir mesajı" value={fmt(engagement.guestMessages)} />
        <Line label="Direkt mesaj" value={`${fmt(engagement.directMessages)} · ${fmt(engagement.conversations)} sohbet`} />
        <Line label="Bağlantı (arkadaşlık)" value={`${fmt(engagement.friendships)} · ${fmt(engagement.friendRequests)} bekleyen istek`} />
      </Card>
      <Card title="Puanlar">
        <Line label="Etkinlik puanı" value={`${score(engagement.avgEventScore)} · ${fmt(engagement.reviews)} değerlendirme`} />
        <Line label="Katılımcı puanı" value={`${score(engagement.avgParticipantScore)} · ${fmt(engagement.participantRatings)} puan`} />
      </Card>
    </Section>

    <Section title="Moderasyon">
      <Card title="Şikayetler"><Bars items={rows(moderation.reports, REPORT)} /></Card>
      <Card>
        <Line label="Etkinlik şikayeti" value={fmt(moderation.reportTargets.event ?? 0)} />
        <Line label="Üye şikayeti" value={fmt(moderation.reportTargets.user ?? 0)} />
        <Line label="Bekleyen ilgi alanı önerisi" value={fmt(moderation.interestProposals)} />
        <Line label="Etkin ilgi alanı" value={fmt(moderation.interests)} />
      </Card>
      <Card title="Referans istekleri"><Bars items={rows(moderation.references, REFERENCE)} /></Card>
    </Section>
    <Label style={s.updated}>{`Son güncelleme ${updated} · yenilemek için aşağı çek`}</Label>
  </Box>
}

const s = StyleSheet.create({
  tile: { minHeight: 112, padding: 14, gap: 4, borderRadius: 18, borderWidth: 1, borderColor: palette.glassBorder, backgroundColor: palette.glassCard },
  tileLabel: { color: palette.muted, fontSize: 12, fontFamily: "Outfit-Medium" },
  tileValue: { color: palette.text, fontSize: 30, lineHeight: 36, fontFamily: "Outfit-SemiBold", fontVariant: ["tabular-nums"] },
  tileNote: { color: palette.muted, fontSize: 11, lineHeight: 15 },
  warning: { padding: 12, borderRadius: 14, borderWidth: 1, borderColor: "rgba(251,191,36,.4)", backgroundColor: "rgba(251,191,36,.1)" },
  warningText: { color: "#fbbf24", fontSize: 13, lineHeight: 19 },
  section: { color: "rgba(241,245,249,.6)", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  card: { padding: 14, gap: 8, borderRadius: 18, borderWidth: 1, borderColor: palette.glassBorder, backgroundColor: palette.glassCard },
  cardTitle: { color: palette.text, fontSize: 14, fontFamily: "Outfit-SemiBold" },
  line: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  lineLabel: { flexShrink: 1, color: palette.muted, fontSize: 13 },
  lineValue: { color: palette.text, fontSize: 13, fontFamily: "Outfit-Medium", fontVariant: ["tabular-nums"], textAlign: "right" },
  track: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,.06)", overflow: "hidden" },
  bar: { height: 6, borderRadius: 3, backgroundColor: palette.blue },
  empty: { color: palette.muted, fontSize: 12 },
  footnote: { color: "rgba(146,157,184,.8)", fontSize: 11, lineHeight: 16, marginTop: 2 },
  chartHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  chartValue: { color: palette.text, fontSize: 13, fontFamily: "Outfit-Medium", fontVariant: ["tabular-nums"] },
  chart: { height: 96, flexDirection: "row", alignItems: "flex-end", gap: 2, paddingTop: 14 },
  guide: { position: "absolute", left: 0, right: 0, top: 14, borderTopWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,.12)" },
  guideLabel: { position: "absolute", right: 0, top: -14, color: palette.muted, fontSize: 10 },
  column: { flex: 1, height: "100%", minHeight: 0, justifyContent: "flex-end" },
  columnBar: { width: "100%", borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: palette.blue },
  columnZero: { backgroundColor: "rgba(255,255,255,.1)" },
  columnPicked: { backgroundColor: palette.accent },
  axis: { flexDirection: "row", justifyContent: "space-between" },
  axisLabel: { color: palette.muted, fontSize: 10 },
  updated: { color: palette.muted, fontSize: 11, textAlign: "center" },
})
