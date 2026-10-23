import { useEffect, useRef, useState } from "react"
import { showAlert } from "../components/AppDialog"
import { RefreshControl, StyleSheet } from "react-native"
import { getAdminStats, type AdminStats as AdminStatsData, deleteUserPermanently, lookupUserByEmail, type AdminUserLookup, decideApplication, decideInterest, decideReport, getAdminReports, getPendingInterests, type AdminReport, type PendingInterest, getApiErrorMessage, getApplicationDetail, getApplications, type ApplicationDecision, type ApplicationFilter, type ApplicationsPage, type MembershipApplication, type MembershipApplicationDetail } from "../api/client"
import TopNavBar from "../components/TopNavBar"
import AdminStats from "../components/AdminStats"
import CountBadge from "../components/CountBadge"
import { AtmoBackground } from "../components/GlassUI"
import { CheckIcon, ChevronDownIcon, SearchIcon } from "../components/Icons"
import LoadingSpinner from "../components/LoadingSpinner"
import { useStore } from "../native/Store"
import { Box, Field, Label, Picture, Scroll, Touch } from "../native/UI"
import { palette } from "../theme/palette"
import type { NavigateFn } from "../types"

const FILTERS: Array<[ApplicationFilter, string]> = [["pending", "Bekleyen"], ["review", "İncelemede"], ["incomplete", "Profil eksik"], ["approved", "Onaylı"], ["passive", "Pasif"], ["rejected", "Reddedilen"], ["all", "Tümü"]]
// Which tab still lists an account after a decision moves it to `status`.
const SHOWS: Record<ApplicationFilter, (status: string) => boolean> = {
  pending: status => status === "reference_pending" || status === "security_review",
  review: status => status === "security_review",
  incomplete: status => status === "profile_incomplete",
  approved: status => status === "approved",
  passive: status => status === "passive",
  rejected: status => status === "rejected",
  all: () => true,
}
const DONE: Record<ApplicationDecision, string> = { approve: "onaylandı", reject: "reddedildi", review: "incelemeye alındı", deactivate: "pasife alındı" }
const TARGET: Record<ApplicationDecision, string> = { approve: "approved", reject: "rejected", review: "security_review", deactivate: "passive" }
const BADGE: Record<string, { color: string; background: string }> = {
  approved: { color: palette.success, background: "rgba(111,208,182,.14)" },
  rejected: { color: palette.error, background: "rgba(243,155,175,.14)" },
  security_review: { color: "#fbbf24", background: "rgba(251,191,36,.14)" },
  passive: { color: "#fbbf24", background: "rgba(251,191,36,.14)" },
}
const STATUS_TR: Record<string, string> = { approved: "Onaylı", rejected: "Reddedildi", security_review: "İncelemede", reference_pending: "Onay bekliyor", profile_incomplete: "Profil eksik", suspended: "Askıda", passive: "Pasif" }
const REFERENCE_TR = { approved: "Onayladı", pending: "Yanıt bekleniyor", declined: "Reddetti" }
const appliedOn = (iso: string) => new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })

function DetailRow({ label, value }: { label: string; value: string }) {
  return <Box style={s.detailRow}><Label style={s.detailLabel}>{label}</Label><Label style={s.detailValue}>{value}</Label></Box>
}

/** The expanded part of a card: everything needed to decide, loaded when the card opens. */
function ApplicationDetails({ item, detail, error, onRetry, busy, onReview }: { item: MembershipApplication; detail: MembershipApplicationDetail | null; error: string | null; onRetry: () => void; busy: boolean; onReview: () => void }) {
  const name = `${item.firstName} ${item.lastName}`.trim()
  if (error) return <Box style={s.details}><Label style={s.error}>{error}</Label><Touch onPress={onRetry} style={s.retry}><Label style={s.retryText}>Tekrar dene</Label></Touch></Box>
  if (!detail) return <Box style={[s.details, s.detailsLoading]}><LoadingSpinner /></Box>
  return <Box style={s.details}>
    <Box style={s.profile}>
      {detail.profilePhoto ? <Picture uri={detail.profilePhoto} accessibilityLabel={`${name} profil fotoğrafı`} style={s.photo} /> : <Box style={[s.photo, s.photoEmpty]}><Label style={s.photoInitial}>{item.firstName.slice(0, 1).toLocaleUpperCase("tr-TR")}</Label></Box>}
      <Label style={[s.detailValue, { flex: 1, textAlign: "left" }]}>{detail.bio?.trim() || "Biyografi eklenmemiş."}</Label>
    </Box>
    <Label style={s.section}>İletişim ve kimlik</Label>
    <DetailRow label="E-posta" value={detail.email} />
    <DetailRow label="Telefon" value={detail.phoneNumber} />
    <DetailRow label="Doğum tarihi" value={detail.age !== null ? `${detail.birthDate} (${detail.age})` : detail.birthDate} />
    <DetailRow label="Şehir" value={detail.city || "Belirtilmedi"} />
    <DetailRow label="Instagram" value={detail.instagramUsername ? `@${detail.instagramUsername}` : "Bağlanmamış"} />
    <Label style={s.section}>İlgi alanları</Label>
    <Box style={s.tags}>{detail.interests.length ? detail.interests.map(interest => <Label key={interest} style={s.tag}>{interest}</Label>) : <Label style={s.muted}>İlgi alanı seçmedi; onaylanamaz.</Label>}</Box>
    <Label style={s.section}>{`Referanslar · ${detail.approvedReferences} onaylı`}</Label>
    {detail.references.length ? detail.references.map(reference => <DetailRow key={reference.id} label={reference.name} value={REFERENCE_TR[reference.status]} />) : <Label style={s.muted}>Referans istemedi.</Label>}
    <Label style={s.section}>Yasal onaylar</Label>
    {detail.consents.documents.map(document => <DetailRow key={document.title} label={document.title} value={`Sürüm ${document.version}${document.acceptedAt ? ` · ${appliedOn(document.acceptedAt)}` : ""}`} />)}
    {detail.consents.pending.length > 0 && <Label style={s.warning}>Güncel sürümü onaylanmamış zorunlu metin var.</Label>}
    <DetailRow label="Ticari ileti izni" value={detail.consents.marketing ? "Verdi" : "Vermedi"} />
    {detail.history.length > 0 && <>
      <Label style={s.section}>Karar geçmişi</Label>
      {detail.history.map((entry, index) => <DetailRow key={index} label={`${STATUS_TR[entry.fromStatus] || entry.fromStatus} → ${STATUS_TR[entry.toStatus] || entry.toStatus}`} value={`${appliedOn(entry.createdAt)}${entry.adminName ? ` · ${entry.adminName}` : ""}`} />)}
    </>}
    <Touch accessibilityLabel={`${name} incelemeye al`} disabled={busy || item.status.enum === "security_review"} disabledOpacity={0.35} onPress={onReview} style={[s.action, s.neutral, s.reviewButton]}>
      <Label style={s.neutralText}>{item.status.enum === "security_review" ? "İncelemede" : "İncelemeye al"}</Label>
    </Touch>
  </Box>
}

function ApplicationCard({ item, busy, open, detail, detailError, onToggle, onRetryDetail, onDecide }: {
  item: MembershipApplication; busy: boolean; open: boolean; detail: MembershipApplicationDetail | null; detailError: string | null
  onToggle: () => void; onRetryDetail: () => void; onDecide: (decision: ApplicationDecision) => void
}) {
  const name = `${item.firstName} ${item.lastName}`.trim()
  const badge = BADGE[item.status.enum] || { color: palette.accent, background: palette.selected }
  return <Box style={[s.card, open && s.cardOpen]}>
    <Box style={s.cardHead}>
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Label style={s.name} numberOfLines={1}>{item.age !== null ? `${name}, ${item.age}` : name}</Label>
        <Label style={s.muted} numberOfLines={1}>{`Başvuru: ${appliedOn(item.createdAt)}`}</Label>
      </Box>
      <Label style={[s.badge, { color: badge.color, backgroundColor: badge.background }]}>{item.status.name}</Label>
    </Box>
    <Label style={s.line} numberOfLines={1}>{item.email}</Label>
    <Label style={s.muted} numberOfLines={1}>{[item.city, item.interests.length ? `${item.interests.length} ilgi alanı` : "İlgi alanı yok", `${item.approvedReferences} onaylı referans`].filter(Boolean).join(" · ")}</Label>
    <Box style={s.actions}>
      {/* An active member can be taken passive; a passive one is reactivated with an approval. */}
      {item.status.enum === "approved" ? <Touch accessibilityLabel={`${name} pasife al`} disabled={busy} disabledOpacity={0.35} onPress={() => onDecide("deactivate")} style={[s.action, s.passive]}>
        <Label style={s.passiveText}>{busy ? "…" : "Pasife al"}</Label>
      </Touch> : <Touch accessibilityLabel={`${name} onayla`} disabled={busy} disabledOpacity={0.35} onPress={() => onDecide("approve")} style={[s.action, s.approve]}>
        <Label style={s.approveText}>{busy ? "…" : item.status.enum === "passive" ? "Aktifleştir" : "Onayla"}</Label>
      </Touch>}
      <Touch accessibilityLabel={`${name} detayları`} accessibilityState={{ expanded: open }} onPress={onToggle} style={[s.action, s.neutral, open && s.neutralOpen]}>
        <Box style={s.toggle}><Label style={s.neutralText}>İncele</Label><ChevronDownIcon size={14} style={[{ color: palette.text }, open && { transform: [{ rotate: "180deg" }] }]} /></Box>
      </Touch>
      <Touch accessibilityLabel={`${name} reddet`} disabled={busy || item.status.enum === "rejected"} disabledOpacity={0.35} onPress={() => onDecide("reject")} style={[s.action, s.reject]}>
        <Label style={s.rejectText}>Reddet</Label>
      </Touch>
    </Box>
    {open && <ApplicationDetails item={item} detail={detail} error={detailError} onRetry={onRetryDetail} busy={busy} onReview={() => onDecide("review")} />}
  </Box>
}

/** Interests members proposed while creating events: approve into the shared list or reject. Hidden when none wait. */
function PendingInterests({ reload }: { reload: number }) {
  const [items, setItems] = useState<PendingInterest[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => { let active = true; getPendingInterests().then(rows => { if (active) setItems(rows) }).catch(() => {}); return () => { active = false } }, [reload])
  const decide = async (item: PendingInterest, decision: "approved" | "rejected") => {
    setBusy(item.id)
    try { await decideInterest(item.id, decision); setItems(rows => rows.filter(row => row.id !== item.id)) }
    catch (cause) { showAlert("İşlem yapılamadı", getApiErrorMessage(cause)) }
    finally { setBusy(null) }
  }
  if (!items.length) return null
  return <Box style={{ gap: 8 }}>
    <Label style={s.section}>{`İlgi alanı önerileri · ${items.length}`}</Label>
    {items.map(item => <Box key={item.id} style={s.card}>
      <Label style={s.name}>{item.name}</Label>
      <Label style={s.muted}>{[item.proposedBy ? `Öneren: ${item.proposedBy}` : null, appliedOn(item.createdAt), item.hasLevels ? "Seviyeli" : "Seviyesiz", `${item.eventCount} etkinlik`].filter(Boolean).join(" · ")}</Label>
      <Box style={s.actions}>
        <Touch accessibilityLabel={`${item.name} ilgi alanını onayla`} disabled={busy === item.id} disabledOpacity={0.35} onPress={() => void decide(item, "approved")} style={[s.action, s.approve]}><Label style={s.approveText}>Onayla</Label></Touch>
        <Touch accessibilityLabel={`${item.name} ilgi alanını reddet`} disabled={busy === item.id} disabledOpacity={0.35} onPress={() => showAlert("Öneri reddedilsin mi?", `“${item.name}” ortak listeye eklenmez; bu adla açılmış etkinlikler aynen kalır.`, [{ text: "Vazgeç", style: "cancel" }, { text: "Reddet", style: "destructive", onPress: () => void decide(item, "rejected") }])} style={[s.action, s.reject]}><Label style={s.rejectText}>Reddet</Label></Touch>
      </Box>
    </Box>)}
  </Box>
}

const REPORT_STATUS: Record<AdminReport["status"], { label: string; color: string; background: string }> = {
  submitted: { label: "Yeni", color: palette.error, background: "rgba(243,155,175,.14)" },
  in_review: { label: "İncelemede", color: "#fbbf24", background: "rgba(251,191,36,.14)" },
  completed: { label: "Tamamlandı", color: palette.success, background: "rgba(111,208,182,.14)" },
}
/** Member reports: who reported whom and the reported message; review, complete, or take the member passive. */
function ReportsSection({ navigate, reload }: { navigate: NavigateFn; reload: number }) {
  const [filter, setFilter] = useState<"open" | "all">("open")
  const [data, setData] = useState<{ items: AdminReport[]; counts: { open: number; all: number } } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => { let active = true; getAdminReports(filter).then(result => { if (active && Array.isArray(result?.items) && result.counts) setData(result) }).catch(() => {}); return () => { active = false } }, [filter, reload])
  // One action settles it: this report and the other open ones about the same member/event close together and
  // leave the open list at once, so the same case never has to be handled twice.
  const act = async (report: AdminReport, action: "dismiss" | "deactivate") => {
    setBusy(report.id)
    try {
      const result = await decideReport(report.id, action)
      const closed = new Set(result.closed)
      setData(current => current && {
        counts: { ...current.counts, open: Math.max(0, current.counts.open - current.items.filter(row => closed.has(row.id) && row.status !== "completed").length) },
        items: filter === "open"
          ? current.items.filter(row => !closed.has(row.id))
          : current.items.map(row => closed.has(row.id) ? { ...row, status: "completed" as const, targetStatus: result.targetStatus ?? row.targetStatus } : row),
      })
    } catch (cause) { showAlert("İşlem yapılamadı", getApiErrorMessage(cause)) }
    finally { setBusy(null) }
  }
  const deactivate = (report: AdminReport) => showAlert("Üye pasife alınsın mı?", `${report.targetName ?? "Üye"} uygulamayı kullanamaz; "hesabın incelemede" sayfasını görür. Bu kişi hakkındaki açık şikayetler de kapanır. Başvurulardan aktifleştirerek geri alabilirsin.`, [
    { text: "Vazgeç", style: "cancel" },
    { text: "Pasife al ve kapat", style: "destructive", onPress: () => void act(report, "deactivate") },
  ])
  if (!data || !data.counts.all) return null
  return <Box style={{ gap: 8 }}>
    <Box style={[s.toggle, { justifyContent: "space-between" }]}>
      <Label style={s.section}>{`Şikayetler · ${data.counts.open} açık`}</Label>
      <Box style={[s.toggle, { gap: 6 }]}>
        {([["open", `Açık · ${data.counts.open}`], ["all", `Tümü · ${data.counts.all}`]] as const).map(([id, label]) => <Touch key={id} accessibilityRole="tab" accessibilityState={{ selected: filter === id }} onPress={() => setFilter(id)} style={[s.chip, filter === id && s.chipOn, { minHeight: 30 }]}>
          <Label style={[s.chipText, filter === id && s.chipTextOn, { fontSize: 12 }]}>{label}</Label>
        </Touch>)}
      </Box>
    </Box>
    {!data.items.length && <Box style={s.stateBox}><Label style={s.muted}>Açık şikayet yok.</Label></Box>}
    {data.items.map(report => {
      const badge = REPORT_STATUS[report.status]
      const target = report.targetType === "user" ? report.targetName ?? "Silinmiş üye" : `Etkinlik · ${report.eventTitle ?? "silinmiş"}`
      return <Box key={report.id} style={s.card}>
        <Box style={s.cardHead}>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Label style={s.name} numberOfLines={1}>{target}</Label>
            <Label style={s.muted} numberOfLines={1}>{`Şikayet eden: ${report.reporterName ?? "Silinmiş üye"} · ${appliedOn(report.createdAt)}`}</Label>
          </Box>
          <Label style={[s.badge, { color: badge.color, backgroundColor: badge.background }]}>{badge.label}</Label>
        </Box>
        <Label style={s.line} selectable>{report.description}</Label>
        {report.targetStatus === "passive" && <Label style={s.warning}>Üye pasife alındı.</Label>}
        <Box style={s.actions}>
          {report.targetType === "user" && report.targetName && <Touch accessibilityLabel={`${report.targetName} profilini aç`} onPress={() => navigate("profile", { userId: report.targetId })} style={[s.action, s.neutral]}><Label style={s.neutralText}>Profil</Label></Touch>}
          {report.status !== "completed" && <Touch accessibilityLabel="Şikayeti kapat" disabled={busy === report.id} disabledOpacity={0.35} onPress={() => void act(report, "dismiss")} style={[s.action, s.approve]}><Label style={s.approveText}>Kapat</Label></Touch>}
          {report.status !== "completed" && report.targetType === "user" && report.targetStatus !== "passive" && report.targetName && <Touch accessibilityLabel={`${report.targetName} pasife al ve kapat`} disabled={busy === report.id} disabledOpacity={0.35} onPress={() => deactivate(report)} style={[s.action, s.reject]}><Label style={s.rejectText}>Pasife al</Label></Touch>}
        </Box>
      </Box>
    })}
  </Box>
}

/**
 * Admin only: find a member by email and delete them for good, with everything that belongs to them. The
 * member's summary shows first so the admin sees who goes; the server refuses admins and the admin themself.
 */
function DeleteMemberSection() {
  const [email, setEmail] = useState("")
  const [found, setFound] = useState<AdminUserLookup | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim())
  const find = async () => {
    if (!validEmail || busy) return
    setBusy(true); setError(null); setNotice(null); setFound(null)
    try { setFound(await lookupUserByEmail(email)) }
    catch (cause) { setError(getApiErrorMessage(cause, "Üye aranamadı.")) }
    finally { setBusy(false) }
  }
  const remove = async (user: AdminUserLookup) => {
    setBusy(true); setError(null)
    try {
      await deleteUserPermanently(user.id, user.email)
      setFound(null); setEmail("")
      setNotice(`${user.firstName} ${user.lastName} (${user.email}) ve tüm verileri kalıcı olarak silindi.`)
    } catch (cause) { setError(getApiErrorMessage(cause, "Üye silinemedi.")) }
    finally { setBusy(false) }
  }
  const confirm = (user: AdminUserLookup) => showAlert("Üye kalıcı olarak silinsin mi?",
    `${user.firstName} ${user.lastName} (${user.email}) silinecek. Profili, mesajları, katılımları ve düzenlediği ${user.ownedEvents} etkinlik (diğer katılımcılar dahil) kaldırılır. Bu işlem geri alınamaz.`, [
    { text: "Vazgeç", style: "cancel" },
    { text: "Kalıcı olarak sil", style: "destructive", onPress: () => void remove(user) },
  ])
  return <Box style={{ gap: 10 }}>
    <Label style={s.section}>Üyeyi kalıcı olarak sil</Label>
    <Label style={s.muted}>Silmek istediğin üyenin e-posta adresini yaz. Önce kim olduğunu göreceksin; silme işlemi onaydan sonra yapılır ve geri alınamaz.</Label>
    <Box style={s.search}>
      <SearchIcon size={16} style={{ color: palette.muted }} />
      <Field accessibilityLabel="Silinecek üyenin e-posta adresi" placeholder="uye@ornek.com" value={email} onChangeText={value => { setEmail(value); setFound(null); setError(null); setNotice(null) }} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" returnKeyType="search" onSubmitEditing={() => void find()} style={s.searchField} />
    </Box>
    <Touch accessibilityRole="button" disabled={!validEmail || busy} disabledOpacity={0.35} onPress={() => void find()} style={[s.action, s.neutral, { flex: 0 }]}>
      <Label style={s.neutralText}>{busy && !found ? "Aranıyor…" : "Üyeyi bul"}</Label>
    </Touch>
    {error && <Box style={s.stateBox}><Label accessibilityRole="alert" style={s.error}>{error}</Label></Box>}
    {notice && <Box style={s.notice} accessibilityLiveRegion="polite"><CheckIcon size={15} style={{ color: palette.success }} /><Label style={s.noticeText}>{notice}</Label></Box>}
    {found && <Box style={s.card}>
      <Box style={s.cardHead}>
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Label style={s.name} numberOfLines={1}>{`${found.firstName} ${found.lastName}`}</Label>
          <Label style={s.muted} numberOfLines={1} selectable>{found.email}</Label>
        </Box>
        {found.status && <Label style={[s.badge, { color: (BADGE[found.status] ?? BADGE.security_review).color, backgroundColor: (BADGE[found.status] ?? BADGE.security_review).background }]}>{STATUS_TR[found.status] ?? found.status}</Label>}
      </Box>
      <DetailRow label="Telefon" value={found.phoneNumber || "—"} />
      <DetailRow label="Şehir" value={found.city || "—"} />
      <DetailRow label="Kayıt tarihi" value={appliedOn(found.createdAt)} />
      <DetailRow label="Düzenlediği etkinlik" value={String(found.ownedEvents)} />
      <DetailRow label="Katıldığı etkinlik" value={String(found.participations)} />
      {found.role === "admin" ? <Label style={s.warning}>Bu bir yönetici hesabı; buradan silinemez.</Label>
        : <Touch accessibilityLabel={`${found.firstName} ${found.lastName} kalıcı olarak sil`} disabled={busy} disabledOpacity={0.35} onPress={() => confirm(found)} style={[s.action, s.reject, { flex: 0 }]}>
          <Label style={s.rejectText}>{busy ? "Siliniyor…" : "Kalıcı olarak sil"}</Label>
        </Touch>}
    </Box>}
  </Box>
}

/** Admin only: search membership applications and approve, reject or review them in one tap. */
export default function AdminScreen({ navigate }: { navigate: NavigateFn }) {
  const { data } = useStore()
  const isAdmin = data.user.role === "admin"
  const [filter, setFilter] = useState<ApplicationFilter>("pending")
  const [query, setQuery] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState<ApplicationsPage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  // Two tabs: the statistics overview (default) and the membership applications.
  const [tab, setTab] = useState<"overview" | "applications" | "delete">("overview")
  const [stats, setStats] = useState<AdminStatsData | null>(null)
  const [statsError, setStatsError] = useState<string | null>(null)
  const loadStats = async () => {
    if (!isAdmin) return
    setStatsError(null)
    try {
      const result = await getAdminStats()
      // An older server (or a partial answer) has no statistics yet; say so instead of drawing nothing.
      if (!result?.users || !result.events || !result.series) throw new Error("İstatistikler bu sunucu sürümünde henüz yok.")
      setStats(result)
    }
    catch (cause) {
      if (cause instanceof Error && /^API 403:/.test(cause.message)) setForbidden(true)
      else setStatsError(getApiErrorMessage(cause, "İstatistikler yüklenemedi."))
    }
  }
  useEffect(() => { if (tab === "overview") void loadStats() }, [tab, isAdmin])
  // One card is open at a time; its details load on first open and are kept until the account changes.
  const [openId, setOpenId] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, MembershipApplicationDetail>>({})
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({})
  const loadDetail = (id: string) => {
    setDetailErrors(current => { const next = { ...current }; delete next[id]; return next })
    getApplicationDetail(id)
      .then(detail => setDetails(current => ({ ...current, [id]: detail })))
      .catch(cause => setDetailErrors(current => ({ ...current, [id]: getApiErrorMessage(cause, "Ayrıntılar yüklenemedi.") })))
  }
  const toggle = (id: string) => {
    const next = openId === id ? null : id
    setOpenId(next)
    if (next && !details[next]) loadDetail(next)
  }
  const request = useRef(0)
  // Searching waits until typing pauses.
  useEffect(() => { const timer = setTimeout(() => setSearch(query), 300); return () => clearTimeout(timer) }, [query])
  const load = async (nextPage = 1) => {
    if (!isAdmin) return
    const id = ++request.current
    setLoading(true); setError(null)
    try {
      const result = await getApplications({ status: filter, q: search, page: nextPage })
      if (id !== request.current) return
      setPage(current => nextPage > 1 && current ? { ...result, items: [...current.items, ...result.items.filter(item => !current.items.some(row => row.id === item.id))] } : result)
    } catch (cause) {
      if (id !== request.current) return
      if (cause instanceof Error && /^API 403:/.test(cause.message)) setForbidden(true)
      else setError(getApiErrorMessage(cause, "Başvurular yüklenemedi."))
    } finally { if (id === request.current) setLoading(false) }
  }
  useEffect(() => { void load(1) }, [filter, search, isAdmin, attempt])
  // Pull to refresh reloads the current tab and the counts.
  const [pulling, setPulling] = useState(false)
  const pullRefresh = async () => { setPulling(true); try { await (tab === "overview" ? loadStats() : load(1)) } finally { setPulling(false) } }

  const decide = (item: MembershipApplication, decision: ApplicationDecision) => {
    const name = `${item.firstName} ${item.lastName}`.trim()
    const run = async () => {
      setBusyId(item.id); setNotice(null)
      try {
        const updated = await decideApplication(item.id, decision)
        const from = item.status.enum, to = updated.status.enum || TARGET[decision]
        setPage(current => {
          if (!current) return current
          const counts = { ...current.counts }
          for (const [tab] of FILTERS) counts[tab] += (SHOWS[tab](to) ? 1 : 0) - (SHOWS[tab](from) ? 1 : 0)
          const keep = SHOWS[filter](to)
          return { ...current, counts, total: current.total - (keep ? 0 : 1), items: keep ? current.items.map(row => row.id === item.id ? updated : row) : current.items.filter(row => row.id !== item.id) }
        })
        setNotice(`${name} ${DONE[decision]}.`)
        // The status changed: refresh the open details (history) on the next open.
        setDetails(current => { const next = { ...current }; delete next[item.id]; return next })
        if (openId === item.id) loadDetail(item.id)
      } catch (cause) { showAlert("İşlem yapılamadı", getApiErrorMessage(cause)) }
      finally { setBusyId(null) }
    }
    // Rejecting and taking a member passive cut access, so they ask first; approve and review are one tap.
    if (decision === "reject") showAlert("Başvuru reddedilsin mi?", `${name} artık giriş yapamaz.`, [{ text: "Vazgeç", style: "cancel" }, { text: "Reddet", style: "destructive", onPress: () => void run() }])
    else if (decision === "deactivate") showAlert("Üye pasife alınsın mı?", `${name} uygulamayı kullanamaz; "hesabın incelemede" sayfasını görür. Aktifleştirerek geri alabilirsin.`, [{ text: "Vazgeç", style: "cancel" }, { text: "Pasife al", style: "destructive", onPress: () => void run() }])
    else void run()
  }

  const blocked = !isAdmin || forbidden
  return <Box style={s.screen}>
    <AtmoBackground />
    <TopNavBar navigate={navigate} fallback="settings" title="Yönetim" subtitle={page && !blocked ? `${page.counts.pending} onay bekliyor` : undefined} />
    {blocked ? <Box style={s.center}><Label style={s.title}>Bu sayfaya erişim yetkin yok</Label><Label style={s.muted}>Üyelik başvurularını yalnızca yöneticiler yönetebilir.</Label></Box> : <Scroll style={s.page} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => { void pullRefresh() }} tintColor={palette.accent} colors={[palette.accent]} progressBackgroundColor={palette.surface} progressViewOffset={84} />}>
      <Box style={s.tabs} accessibilityRole="tablist">
        {([["overview", "Genel bakış"], ["applications", "Başvurular"], ["delete", "Üye sil"]] as const).map(([id, label]) => <Touch walkthroughId={id === "overview" ? "admin-overview" : id === "applications" ? "admin-applications" : undefined} key={id} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: tab === id }} onPress={() => setTab(id)} style={[s.tab, tab === id && s.tabOn]}>
          <Box style={s.tabLabel}>
            <Label style={[s.chipText, tab === id && s.chipTextOn]}>{label}</Label>
            {id === "applications" && <CountBadge count={page?.counts.pending ?? 0} />}
          </Box>
        </Touch>)}
      </Box>
      {tab === "overview" ? <>
        {statsError && <Box style={s.stateBox}><Label style={s.error}>{statsError}</Label><Touch onPress={() => void loadStats()} style={s.retry}><Label style={s.retryText}>Tekrar dene</Label></Touch></Box>}
        {!stats && !statsError && <Box style={s.stateBox}><LoadingSpinner /></Box>}
        {stats && <AdminStats stats={stats} />}
      </> : tab === "delete" ? <DeleteMemberSection /> : <>
      <ReportsSection navigate={navigate} reload={attempt + (pulling ? 1 : 0)} />
      <PendingInterests reload={attempt + (pulling ? 1 : 0)} />
      <Box style={s.search}>
        <SearchIcon size={16} style={{ color: palette.muted }} />
        <Field accessibilityLabel="Başvurularda ara" placeholder="Ad, e-posta, telefon veya Instagram" value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={s.searchField} />
      </Box>
      <Scroll horizontal showsHorizontalScrollIndicator={false} style={s.filters}>
        {FILTERS.map(([id, label]) => <Touch key={id} accessibilityRole="tab" accessibilityState={{ selected: filter === id }} accessibilityLabel={`${label} başvurular`} onPress={() => setFilter(id)} style={[s.chip, filter === id && s.chipOn]}>
          <Label style={[s.chipText, filter === id && s.chipTextOn]}>{page ? `${label} · ${page.counts[id]}` : label}</Label>
        </Touch>)}
      </Scroll>
      {notice && <Box style={s.notice} accessibilityLiveRegion="polite"><CheckIcon size={15} style={{ color: palette.success }} /><Label style={s.noticeText}>{notice}</Label></Box>}
      {error && <Box style={s.stateBox}><Label style={s.error}>{error}</Label><Touch onPress={() => setAttempt(value => value + 1)} style={s.retry}><Label style={s.retryText}>Tekrar dene</Label></Touch></Box>}
      {!page && loading && <Box style={s.stateBox}><LoadingSpinner /></Box>}
      {page && !page.items.length && !loading && <Box style={s.stateBox}><Label style={s.muted}>{search.trim() ? `"${search.trim()}" için başvuru bulunamadı.` : filter === "pending" ? "Onay bekleyen başvuru yok." : "Bu sekmede kimse yok."}</Label></Box>}
      {page?.items.map(item => <ApplicationCard key={item.id} item={item} busy={busyId === item.id} open={openId === item.id} detail={details[item.id] || null} detailError={detailErrors[item.id] || null}
        onToggle={() => toggle(item.id)} onRetryDetail={() => loadDetail(item.id)} onDecide={decision => decide(item, decision)} />)}
      {page?.hasMore && <Touch disabled={loading} onPress={() => void load(page.page + 1)} style={s.more}><Label style={s.retryText}>{loading ? "Yükleniyor…" : "Daha fazla göster"}</Label></Touch>}
      </>}
    </Scroll>}
  </Box>
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  page: { paddingTop: 84, paddingHorizontal: 16, paddingBottom: 48, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 32 },
  title: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 17, textAlign: "center" },
  search: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  searchField: { flex: 1, color: palette.text, fontSize: 14, paddingVertical: 12 },
  filters: { flexGrow: 0, flexDirection: "row", gap: 8 },
  chip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, justifyContent: "center", borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  chipOn: { backgroundColor: palette.selected, borderColor: "rgba(105,120,255,.38)" },
  chipText: { color: palette.text, fontFamily: "Outfit-Medium", fontSize: 13 },
  chipTextOn: { color: palette.accent, fontFamily: "Outfit-SemiBold" },
  notice: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, backgroundColor: "rgba(111,208,182,.1)" },
  noticeText: { flex: 1, color: palette.success, fontSize: 13 },
  stateBox: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, gap: 10, alignItems: "flex-start" },
  error: { color: palette.error, fontSize: 13 },
  retry: { minHeight: 36, justifyContent: "center" },
  retryText: { color: palette.accent, fontFamily: "Outfit-SemiBold", fontSize: 13 },
  card: { padding: 14, borderRadius: 18, borderWidth: 1, borderColor: palette.border, backgroundColor: "rgba(17,22,42,.95)", gap: 6 },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  name: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 16 },
  badge: { overflow: "hidden", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, fontSize: 11, fontFamily: "Outfit-SemiBold" },
  line: { color: "rgba(244,245,255,.8)", fontSize: 13 },
  muted: { color: palette.muted, fontSize: 12, lineHeight: 17 },
  actions: { flexDirection: "row", gap: 8, marginTop: 6 },
  action: { flex: 1, minHeight: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  approve: { backgroundColor: "rgba(111,208,182,.16)", borderColor: "rgba(111,208,182,.45)" },
  approveText: { color: palette.success, fontFamily: "Outfit-SemiBold", fontSize: 14 },
  neutral: { backgroundColor: palette.surface, borderColor: palette.border },
  neutralText: { color: palette.text, fontFamily: "Outfit-Medium", fontSize: 14 },
  passive: { backgroundColor: "rgba(251,191,36,.1)", borderColor: "rgba(251,191,36,.4)" },
  passiveText: { color: "#fbbf24", fontFamily: "Outfit-SemiBold", fontSize: 14 },
  reject: { backgroundColor: "rgba(243,155,175,.1)", borderColor: "rgba(243,155,175,.4)" },
  rejectText: { color: palette.error, fontFamily: "Outfit-SemiBold", fontSize: 14 },
  cardOpen: { borderColor: "rgba(105,120,255,.38)" },
  toggle: { flexDirection: "row", alignItems: "center", gap: 4 },
  neutralOpen: { backgroundColor: palette.selected, borderColor: "rgba(105,120,255,.38)" },
  details: { marginTop: 10, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border, gap: 6 },
  detailsLoading: { alignItems: "center", paddingVertical: 16 },
  profile: { flexDirection: "row", alignItems: "center", gap: 12 },
  photo: { width: 56, height: 56, borderRadius: 28 },
  photoEmpty: { backgroundColor: palette.selected, alignItems: "center", justifyContent: "center" },
  photoInitial: { color: palette.accent, fontFamily: "Outfit-SemiBold", fontSize: 20 },
  section: { color: "rgba(241,245,249,.6)", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginTop: 8 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  detailLabel: { flexShrink: 1, color: palette.muted, fontSize: 13 },
  detailValue: { flexShrink: 1, color: palette.text, fontSize: 13, textAlign: "right" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { overflow: "hidden", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, fontSize: 12, color: palette.accent, backgroundColor: palette.selected },
  warning: { color: "#fbbf24", fontSize: 12 },
  reviewButton: { flex: 0, marginTop: 10 },
  tabs: { flexDirection: "row", padding: 4, gap: 4, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  tab: { flex: 1, minHeight: 40, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  tabOn: { backgroundColor: palette.selected },
  tabLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  more: { alignSelf: "center", minHeight: 44, paddingHorizontal: 16, justifyContent: "center" },
})
