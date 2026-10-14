import { palette } from "../theme/palette";
import CityPicker from "../components/CityPicker";
import SignOutButton from "../components/SignOutButton";
import { updateProfile } from "../api/client";
import TopNavBar from "../components/TopNavBar";
import EditorialQuote from "../components/EditorialQuote";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccordionItem, AtmoBackground, Avatar, GlassCard, GlassInput, LockedField, ProgressStepper } from "../components/GlassUI";
import { ErrorNotice } from "../components/ErrorNotice";
import { CheckIcon, ChevronDownIcon, InstagramIcon, ScrollIcon, UsersIcon } from "../components/Icons";
import { ReferencePicker } from "../components/ReferencePicker";
import { registerForPush, type PushState } from "../services/push";
import { updateStoreUser, useStore } from "../native/Store";
import { RefreshControl } from "react-native";
import { clearSessionCache, getApiErrorMessage, getCurrentUser, getLegalDocuments, register, type ApiUser, type LegalDocumentSummary } from "../api/client";
import { useOpenLegal } from "../legal/links";
import { formatPhone, phoneDigits, PHONE_PREFIX } from "../content/phone";
import { Box, Label, Scroll, Touch } from "../native/UI";
import { ui } from "../theme/styles";
import { NavigateFn } from "../types";
interface Props {
  step: 1 | 2 | 3;
  navigate: NavigateFn;
}
const PRINCIPLES = [{
  title: "Saygılı ve nazik ol",
  desc: "Bu topluluk gerçek hayatta bağlantılar kurar. Diğer üyelerle iletişiminde saygılı, kapsayıcı ve nazik ol. Farklı görüşlere, yaşam tarzlarına ve kişisel sınırlara saygı göster."
}, {
  title: "Katıldığın etkinliklere git",
  desc: "Bir etkinliğe katılacağını söylediğinde diğer üyeler sana güvenerek plan yapar. Gelemeyeceksen mümkün olduğunca erken haber ver. Tekrarlanan habersiz katılmama davranışları güven skorunu etkileyebilir."
}, {
  title: "Diğer üyelerin gizliliğine saygı göster",
  desc: "Etkinliklerde öğrendiğin kişisel bilgileri, fotoğrafları veya konuşmaları izinsiz paylaşma. Topluluk içinde oluşan güveni koru."
}, {
  title: "Dürüst ve açık iletişim kur",
  desc: "Profil bilgilerinde, etkinliklerde ve diğer üyelerle iletişiminde kendini doğru şekilde ifade et. Yanıltıcı bilgi veya sahte kimlik kullanımına izin verilmez."
}, {
  title: "Taciz ve uygunsuz davranışlardan kaçın",
  desc: "Taciz, tehdit, ayrımcılık, istenmeyen iletişim veya diğer üyeleri rahatsız eden davranışlar toplulukta kabul edilmez."
}];
function formatBirthDate(value: string) {
  const legacyDate = value.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
  if (legacyDate) return `${legacyDate[3]}/${legacyDate[2]}/${legacyDate[1]}`;
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}
// The date picker works with YYYY-MM-DD; the form and API keep dd/MM/yyyy.
const toPickerDate = (value: string) => {
  const parts = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return parts ? `${parts[3]}-${parts[2]}-${parts[1]}` : "";
};
const isFutureDate = (value: string) => {
  const iso = toPickerDate(value);
  return !!iso && new Date(`${iso}T00:00:00`).getTime() > Date.now();
};
// Membership starts at 18 (the backend enforces the same rule).
const MIN_MEMBER_AGE = 18;
const isUnderAge = (value: string) => {
  const iso = toPickerDate(value);
  if (!iso || isFutureDate(value)) return false;
  const [year, month, day] = iso.split("-").map(Number);
  const now = new Date();
  const age = now.getFullYear() - year - (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day) ? 1 : 0);
  return age < MIN_MEMBER_AGE;
};
// Accounts waiting for an admin decision see what they submitted, locked, until they sign out;
// only fields they left empty stay open. The server profile is the source, so a reopened app shows the same.
// A profile_incomplete account is still filling the application (references, then profile), so it is not locked.
const WAITING_STATUSES = new Set(["reference_pending", "security_review", "passive"]);
function useApplicant() {
  const { data: store } = useStore();
  const waiting = !!store.user.id && WAITING_STATUSES.has(store.user.status || "");
  const [me, setMe] = useState<ApiUser | null>(null);
  useEffect(() => {
    if (!waiting) return;
    let active = true;
    getCurrentUser().then(user => { if (active) setMe(user); }).catch(() => {});
    return () => { active = false; };
  }, [waiting, store.user.id]);
  return { waiting, me, setMe };
}
/** Pull to refresh on the application pages: reloads the account (status) from the server. */
function usePullRefresh(extra?: () => Promise<void> | void) {
  const { setData: setStore } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      clearSessionCache("user");
      const me = await getCurrentUser();
      setStore(current => ({ ...current, user: updateStoreUser(current.user, me) }));
      await extra?.();
    } catch { /* The page keeps its current state; pulling again retries. */ }
    finally { setRefreshing(false); }
  };
  const control = <RefreshControl refreshing={refreshing} onRefresh={() => { void refresh(); }} tintColor={palette.accent} colors={[palette.accent]} progressBackgroundColor={palette.surface} progressViewOffset={84} />;
  return { refreshing, control };
}
function WaitingActions({ label, canSend, sending, notice, error, onSend, onBack }: { label: string; canSend: boolean; sending: boolean; notice: string | null; error: string | null; onSend: () => void; onBack: () => void }) {
  return <>
    {notice && <Label accessibilityLiveRegion="polite" style={[[ui.textXs, ui.mb2], { color: palette.success }]}>{notice}</Label>}
    {error && <Label accessibilityRole="alert" style={[[ui.textXs, ui.mb2], { color: palette.error }]}>{error}</Label>}
    <Touch onPress={onSend} disabled={!canSend || sending} disabledOpacity={1} style={[[ui.wFull, ui.py4, ui.rounded2xl, ui.fontSemibold, ui.textBase, ui.trackingWide], {
      color: canSend ? palette.text : "rgba(226,232,240,.62)", borderWidth: 1, borderColor: canSend ? "rgba(183,197,255,.5)" : "rgba(148,163,184,.22)",
    }]} gradient={canSend ? palette.actionGradient : ["#202b3d", "#182235", "#151f30"]}>
      {sending ? "Gönderiliyor…" : label}
    </Touch>
    <Touch onPress={onBack} style={[[ui.wFull, ui.py3, ui.textSm, ui.textWhite55, ui.textCenter]]}>Başvuru durumuma dön</Touch>
  </>;
}
function ConsentCheck({ checked, onToggle, label, children }: { checked: boolean; onToggle: () => void; label: string; children: ReactNode }) {
  return <Touch accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={label} onPress={onToggle} style={[[ui.mt3, ui.flex, ui.itemsStart, ui.gap3, ui.wFull, ui.textLeft]]}>
    <Box style={[[ui.mt05, ui.w5, ui.h5, ui.roundedMd, ui.flexShrink0, ui.border, ui.flex, ui.itemsCenter, ui.justifyCenter, checked ? [ui.bgC8a44a, ui.borderC8a44a] : [ui.borderWhite25, ui.bgWhite5]]]}>
      {checked && <CheckIcon size={12} strokeWidth={2.5} style={[[ui.text1a1200]]} />}
    </Box>
    <Label style={[[ui.flex1, ui.textSm, ui.textWhite55, ui.leadingRelaxed]]}>{children}</Label>
  </Touch>;
}

/* ---------- Sticky CTA bar ---------- */
function StickyBar({
  children
}: {
  children: React.ReactNode;
}) {
  return <Box style={[[ui.fixed, ui.bottom0, ui.left0, ui.right0, ui.px5, ui.pb8, ui.pt4, ui.z40], {}]} gradient={[palette.background, "transparent"]} gradientDirection="up">
      {children}
    </Box>;
}

/* ---------- Icon badge ---------- */
function IconBadge({
  children,
  color = "gold"
}: {
  children: React.ReactNode;
  color?: "gold" | "violet" | "neutral";
}) {
  const styles = {
    gold: {
      backgroundColor: "rgba(105,120,255,0.10)",
      borderWidth: 1,
      borderColor: "rgba(105,120,255,0.18)",
      color: palette.accent
    },
    violet: {
      backgroundColor: "rgba(146,125,255,0.10)",
      borderWidth: 1,
      borderColor: "rgba(146,125,255,0.18)",
      color: "#a09cf5"
    },
    neutral: {
      backgroundColor: "rgba(255,255,255,0.06)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.10)",
      color: "rgba(240,237,232,0.55)"
    }
  }[color];
  return <Box style={[[ui.w10, ui.h10, ui.roundedXl, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.flexShrink0], styles]}>
      {children}
    </Box>;
}

/* ========================================
   STEP 1
======================================== */
function Step1({
  navigate
}: {
  navigate: NavigateFn;
}) {
  const {
    data: store,
    setData: setStore
  } = useStore();
  const [form, setForm] = useState({
    ad: store.onboarding.ad || "",
    soyad: store.onboarding.soyad || "",
    email: store.onboarding.email || "",
    telefon: store.onboarding.telefon || "",
    dogum: formatBirthDate(store.onboarding.dogum || ""),
    sehir: store.onboarding.sehir || "",
    sifre: store.onboarding.sifre || ""
  });
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const { waiting, me, setMe } = useApplicant();
  const submitted = { ad: me?.firstName || "", soyad: me?.lastName || "", email: me?.email || "", telefon: me?.phoneNumber ? formatPhone(me.phoneNumber) : "", dogum: me?.birthDate || "", sehir: me?.city || "" };
  const locked = (key: keyof typeof submitted) => waiting && !!submitted[key];
  // Only fields left empty can be added while the application waits; valid values only.
  const additions: Partial<ApiUser> & { city?: string } = waiting ? Object.fromEntries(([
    ["ad", "firstName", form.ad.trim()], ["soyad", "lastName", form.soyad.trim()], ["email", "email", form.email.trim()],
    ["telefon", "phoneNumber", phoneDigits(form.telefon).length === 10 ? `+90${phoneDigits(form.telefon)}` : ""],
    ["dogum", "birthDate", form.dogum && !isFutureDate(form.dogum) && !isUnderAge(form.dogum) ? form.dogum : ""], ["sehir", "city", form.sehir],
  ] as const).filter(([key, , value]) => !locked(key) && !!value).map(([, field, value]) => [field, value])) : {};
  const [sending, setSending] = useState(false);
  const [sendNotice, setSendNotice] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const sendAdditions = async () => {
    if (sending || !Object.keys(additions).length) return;
    setSending(true); setSendError(null); setSendNotice(null);
    try { setMe(await updateProfile(additions)); setSendNotice("Eklediğin bilgiler başvuruna eklendi."); }
    catch (cause) { setSendError(getApiErrorMessage(cause, "Bilgiler gönderilemedi.")); }
    finally { setSending(false); }
  };
  const [principlesOpen, setPrinciplesOpen] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<number | null>(null);
  const openLegal = useOpenLegal();
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [documents, setDocuments] = useState<LegalDocumentSummary[] | null>(null);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [documentsAttempt, setDocumentsAttempt] = useState(0);
  // The versions shown here are the ones recorded as accepted.
  useEffect(() => {
    if (store.onboarding.accountId) return;
    let active = true;
    setDocumentsError(null);
    getLegalDocuments()
      .then(result => { if (active) setDocuments(result.items); })
      .catch(cause => { if (active) setDocumentsError(getApiErrorMessage(cause, "Sözleşme metinleri yüklenemedi.")); });
    return () => { active = false; };
  }, [documentsAttempt, store.onboarding.accountId]);
  const marketingDocument = documents?.find(doc => doc.type === "marketing");
  const acceptedDocuments = (documents ?? []).filter(doc => doc.required || (marketing && doc.type === "marketing")).map(({ type, version }) => ({ type, version }));
  const accepted = rulesAccepted && privacyAccepted && documents !== null;
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const continueRegistration = async () => {
    if (creating) return;
    setCreating(true); setCreateError(null);
    try {
      // Application order: account → references (step 2) → profile and interests → waiting for approval.
      if (store.onboarding.accountId || store.user.id) { navigate("onboarding-2"); return; }
      const response = await register({ firstName: form.ad, lastName: form.soyad, email: form.email.trim(), phoneNumber: `+90${phoneDigits(form.telefon)}`, password: form.sifre, birthDate: form.dogum, city: form.sehir, acceptedDocuments, marketingConsent: marketing && !!marketingDocument });
      const id = String((response.user as { id: string }).id);
      const status = (response.user as { status?: { enum: string } }).status?.enum;
      setStore(current => ({ ...current, onboarding: { ...form, sifre: "", accountId: id }, user: { ...current.user, id, name: `${form.ad} ${form.soyad}`, status } }));
      if (mounted.current) navigate("onboarding-2");
    } catch (cause) { if (mounted.current) setCreateError(getApiErrorMessage(cause, "Hesabın oluşturulamadı. Bağlantını ve bilgilerini kontrol et.")); }
    finally { if (mounted.current) setCreating(false); }
  };
  const allFilled = Object.values(form).every(v => v.trim().length > 0) && phoneDigits(form.telefon).length === 10 && !isFutureDate(form.dogum) && !isUnderAge(form.dogum);
  const canContinue = Boolean(store.onboarding.accountId) || (allFilled && accepted);
  return <Box style={{
    flex: 1
  }}>
      <TopNavBar navigate={navigate} fallback="welcome" onBack={() => { setStore(current => ({ ...current, onboarding: { ...current.onboarding, ...form, sifre: "" } })); navigate("welcome", { back: true }); }} title="Üyelik Başvurusu" floating />
      <Scroll style={[[ui.flex, ui.flexCol, ui.flex1, ui.bg06060e, ui.pb40, ui.px5], { paddingTop: 84 }]}>
        <AtmoBackground />

        <Box style={[[ui.relative, ui.spaceY8]]}>
          {/* Header */}
          <Box style={[[ui.gapY1]]} enter>
            <Box style={[[ui.flex, ui.itemsCenter, ui.justifyBetween, ui.mb4]]}>
              <ProgressStepper current={0} total={3} />
              <Label style={[[ui.textXs, ui.textWhite30]]}>Adım 1/3</Label>
            </Box>
            <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite]]}>
              Seninle tanışalım.
            </Label>
            <Label style={[[ui.textSm, ui.textWhite45]]}>
              {waiting ? "Başvurun alındı. Gönderdiğin bilgiler inceleme bitene kadar kilitli; boş kalan alanları ekleyip gönderebilirsin." : "Devam ettiğinde hesabın oluşturulur. Sonraki adımda referans isteyebilirsin."}
            </Label>
          </Box>

          {/* Form */}
          <Box style={[[ui.spaceY3]]} enter>
            {waiting && !me && <Label style={[[ui.textXs, ui.textWhite40]]}>Başvuru bilgilerin yükleniyor…</Label>}
            <Box style={[[ui.grid, ui.gap3]]} columns={2}>
              {locked("ad") ? <LockedField label="Ad" value={submitted.ad} /> : <GlassInput label="Ad" placeholder="Adın" autoCapitalize="words" autoCorrect={false} textContentType="givenName" autoComplete="given-name" value={form.ad} onChangeText={e => setForm(p => ({
              ...p,
              ad: e
            }))} />}
              {locked("soyad") ? <LockedField label="Soyad" value={submitted.soyad} /> : <GlassInput label="Soyad" placeholder="Soyadın" autoCapitalize="words" autoCorrect={false} textContentType="familyName" autoComplete="family-name" value={form.soyad} onChangeText={e => setForm(p => ({
              ...p,
              soyad: e
            }))} />}
            </Box>
            {locked("email") ? <LockedField label="E-posta" value={submitted.email} /> : <GlassInput label="E-posta" placeholder="ornek@email.com" value={form.email} onChangeText={e => setForm(p => ({
            ...p,
            email: e
          }))} mode="email" />}
            {locked("telefon") ? <LockedField label="Telefon" value={submitted.telefon} /> : <GlassInput label="Telefon" placeholder="+90 5XX XXX XX XX" value={form.telefon} onChangeText={e => setForm(p => ({
            ...p,
            telefon: formatPhone(e)
          }))} onFocus={() => { if (!form.telefon) setForm(p => ({ ...p, telefon: PHONE_PREFIX })); }} mode="tel" keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" maxLength={17} />}
            {locked("dogum") ? <LockedField label="Doğum Tarihi" value={submitted.dogum} /> : <GlassInput label="Doğum Tarihi" mode="date" defaultValue="2000-01-01" value={toPickerDate(form.dogum)} onChangeText={e => setForm(p => ({
            ...p,
            dogum: formatBirthDate(e)
          }))} />}
            {isFutureDate(form.dogum) && <Label style={[[ui.textXs], { color: palette.error }]}>
                Doğum tarihi gelecekte olamaz.
              </Label>}
            {isUnderAge(form.dogum) && <Label style={[[ui.textXs], { color: palette.error }]}>
                {`Üye olmak için en az ${MIN_MEMBER_AGE} yaşında olmalısın.`}
              </Label>}
            <Box>
              {locked("sehir") ? <LockedField label="Şehir" value={submitted.sehir} /> : <CityPicker value={form.sehir} onChange={sehir => setForm(p => ({ ...p, sehir }))} />}
            </Box>
            {!waiting && <GlassInput label="Şifre" placeholder="En az 8 karakter ve özel karakter" value={form.sifre} onChangeText={e => setForm(p => ({
            ...p,
            sifre: e
          }))} secureTextEntry />}
          </Box>

          {/* Community Principles */}
          <Box style={[[]]} enter>
            <GlassCard style={[[ui.overflowHidden]]}>
              <Touch onPress={() => setPrinciplesOpen(!principlesOpen)} style={[[ui.wFull, ui.flex, ui.itemsCenter, ui.justifyBetween, ui.p4]]}>
                <Box style={[[ui.flex, ui.itemsCenter, ui.gap3]]}>
                  <IconBadge color="gold">
                    <ScrollIcon size={18} />
                  </IconBadge>
                  <Box style={[[ui.textLeft]]}>
                    <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite85]]}>
                      Topluluk İlkeleri
                    </Label>
                    <Label style={[[ui.textXs, ui.textWhite40]]}>
                      5 ilke · Okumak için aç
                    </Label>
                  </Box>
                </Box>
                <ChevronDownIcon size={16} style={[[ui.textWhite30, principlesOpen ? [ui.rotate180] : []]]} />
              </Touch>

              {principlesOpen && <Box style={[[ui.px4, ui.pb4, ui.spaceY0, ui.borderT, ui.borderWhite8]]} enter>
                  {PRINCIPLES.map((p, i) => <AccordionItem key={i} title={p.title} open={openAccordion === i} onToggle={() => setOpenAccordion(openAccordion === i ? null : i)}>
                      {p.desc}
                    </AccordionItem>)}
                </Box>}
            </GlassCard>

            {/* Consents — versions come from the server and are recorded with the account */}
            {waiting ? <Label style={[[ui.mt3, ui.textXs, ui.textWhite40]]}>Sözleşmeleri başvururken onayladın.</Label> : <>
            <ConsentCheck checked={rulesAccepted} onToggle={() => setRulesAccepted(!rulesAccepted)} label="Kullanım Koşulları ve Topluluk Kuralları onayı">
              <Label accessibilityRole="link" onPress={() => openLegal("terms")} style={[[ui.textWhite85, ui.underline]]}>Kullanım Koşulları</Label>
              {" ve "}
              <Label accessibilityRole="link" onPress={() => openLegal("community")} style={[[ui.textWhite85, ui.underline]]}>Topluluk Kuralları</Label>
              'nı okudum ve kabul ediyorum.
            </ConsentCheck>
            <ConsentCheck checked={privacyAccepted} onToggle={() => setPrivacyAccepted(!privacyAccepted)} label="Gizlilik Politikası ve KVKK Aydınlatma Metni onayı">
              <Label accessibilityRole="link" onPress={() => openLegal("privacy")} style={[[ui.textWhite85, ui.underline]]}>Gizlilik Politikası</Label>
              {" ve "}
              <Label accessibilityRole="link" onPress={() => openLegal("kvkk")} style={[[ui.textWhite85, ui.underline]]}>KVKK Aydınlatma Metni</Label>
              'ni okudum.
            </ConsentCheck>
            {(!documents || marketingDocument) && <ConsentCheck checked={marketing} onToggle={() => setMarketing(!marketing)} label="Ticari elektronik ileti izni (isteğe bağlı)">
              Kampanya ve duyurular için{" "}
              <Label accessibilityRole="link" onPress={() => openLegal("marketing")} style={[[ui.textWhite85, ui.underline]]}>ticari elektronik ileti</Label>
              {" "}almak istiyorum. (İsteğe bağlı)
            </ConsentCheck>}
            {documentsError && !store.onboarding.accountId && <Box style={[[ui.mt3]]}>
                <ErrorNotice title="Metinler yüklenemedi" message={documentsError} onDismiss={() => setDocumentsError(null)} onRetry={() => setDocumentsAttempt(value => value + 1)} />
              </Box>}
            </>}
          </Box>
        </Box>
      </Scroll>
      <StickyBar>
        {waiting ? <WaitingActions label="Eklediklerimi gönder" canSend={Object.keys(additions).length > 0} sending={sending} notice={sendNotice} error={sendError} onSend={() => void sendAdditions()} onBack={() => navigate("onboarding-3", { reset: true })} /> : <>
        {createError && <ErrorNotice title="Kayıt tamamlanamadı" message={createError} onDismiss={() => setCreateError(null)} />}
        <Touch onPress={() => void continueRegistration()} disabled={!canContinue || creating} disabledOpacity={1} style={[[ui.wFull, ui.py4, ui.rounded2xl, ui.fontSemibold, ui.textBase, ui.trackingWide], {
        color: canContinue ? palette.text : "rgba(226,232,240,.62)",
        borderWidth: 1,
        borderColor: canContinue ? "rgba(183,197,255,.5)" : "rgba(148,163,184,.22)",
      }]} gradient={canContinue ? palette.actionGradient : ["#202b3d", "#182235", "#151f30"]}>
          {creating ? "Hesap oluşturuluyor…" : "Devam Et"}
        </Touch>
        </>}
      </StickyBar>
    </Box>;
}

/* ========================================
   STEP 2
======================================== */
function Step2({
  navigate
}: {
  navigate: NavigateFn;
}) {
  const { data: store, setData: setStore, refreshEvents } = useStore();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [method, setMethod] = useState<"instagram" | "reference" | null>(null);
  const [instagram, setInstagram] = useState("");
  const { waiting, me, setMe } = useApplicant();
  const instagramLocked = waiting && !!me?.instagramUsername;
  const newInstagram = instagramLocked ? "" : instagram.replace(/^@/, "").trim();
  const [sendNotice, setSendNotice] = useState<string | null>(null);
  const sendInstagram = async () => {
    if (submitting || !newInstagram) return;
    setSubmitting(true); setSubmitError(null); setSendNotice(null);
    try { setMe(await updateProfile({ instagramUsername: newInstagram })); setInstagram(""); setSendNotice("Instagram hesabın başvuruna eklendi."); }
    catch (error) { setSubmitError(getApiErrorMessage(error, "Instagram eklenemedi.")); }
    finally { setSubmitting(false); }
  };
  // Pull to refresh also reloads the reference requests; the picker reports when that ended.
  const [refreshSignal, setRefreshSignal] = useState(0);
  const referencesDone = useRef<(() => void) | null>(null);
  const pull = usePullRefresh(() => new Promise<void>(resolve => { referencesDone.current = resolve; setRefreshSignal(value => value + 1); }));
  const submitApplication = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (!store.onboarding.accountId && !store.user.id) { navigate("onboarding-1"); return; }
      if (instagram.trim()) await updateProfile({ instagramUsername: instagram.replace(/^@/, "").trim() });
      // References first, then the profile (interests) files the application; already filed ones just wait.
      navigate(store.user.status === "profile_incomplete" ? "interests" : "onboarding-3");
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, "Bilgilerini kontrol edip tekrar dene."));
    } finally {
      setSubmitting(false);
    }
  };
  return <Box style={{
    flex: 1
  }}>
      <TopNavBar navigate={navigate} fallback="onboarding-1" title="Üyelik Başvurusu" floating />
      <Scroll refreshControl={pull.control} style={[[ui.flex, ui.flexCol, ui.flex1, ui.bg06060e, ui.pb40, ui.px5], { paddingTop: 84 }]}>
        <AtmoBackground />

        <Box style={[[ui.relative, ui.spaceY8]]}>
          <Box style={[[ui.gapY1]]} enter>
            <Box style={[[ui.flex, ui.itemsCenter, ui.justifyBetween, ui.mb4]]}>
              <ProgressStepper current={1} total={3} />
              <Label style={[[ui.textXs, ui.textWhite30]]}>Adım 2/3</Label>
            </Box>
            <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite]]}>
              Seni biraz daha{"\n"}tanıyalım.
            </Label>
            <Label style={[[ui.textSm, ui.textWhite45]]}>
              Bize nasıl ulaştığını merak ediyoruz.
            </Label>
          </Box>

          <Box style={[[ui.spaceY3]]} enter>
            {/* Instagram */}
            {instagramLocked ? <GlassCard style={[[ui.p4]]}><LockedField label="Instagram" value={`@${me?.instagramUsername}`} /></GlassCard> : <GlassCard onPress={() => setMethod(method === "instagram" ? null : "instagram")} style={[[ui.p4, method === "instagram" ? [ui.borderC8a44a35] : []]]}>
              <Box style={[[ui.flex, ui.itemsCenter, ui.gap3]]}>
                <IconBadge color="violet">
                  <InstagramIcon size={18} />
                </IconBadge>
                <Box style={[[ui.flex1]]}>
                  <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite85]]}>
                    Instagram
                  </Label>
                  <Label style={[[ui.textXs, ui.textWhite40]]}>
                    Profilini bağla
                  </Label>
                </Box>
                {method === "instagram" && <Box style={[[ui.w2, ui.h2, ui.roundedFull, ui.bgC8a44a]]} />}
              </Box>
              {method === "instagram" && <Touch onPress={e => e.stopPropagation()} style={[[ui.mt3]]} enter>
                  <GlassInput placeholder="@kullaniciadi" accessibilityLabel="Instagram kullanıcı adı" autoCapitalize="none" autoCorrect={false} autoComplete="username" value={instagram} onChangeText={value => { const username = value.replace(/[@\s]/g, "").toLowerCase(); setInstagram(username ? `@${username}` : "") }} />
                </Touch>}
            </GlassCard>}

            {/* Reference */}
            <GlassCard style={[[ui.p4]]}>
              <Box style={[[ui.flex, ui.itemsCenter, ui.gap3]]}>
                <IconBadge color="neutral">
                  <UsersIcon size={18} />
                </IconBadge>
                <Box style={[[ui.flex1]]}>
                  <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite85]]}>
                    Üyeden Referans İste
                  </Label>
                  <Label style={[[ui.textXs, ui.textWhite40]]}>
                    Tanıdığın bir üye seni önerebilir
                  </Label>
                </Box>
              </Box>

              {/* A reference approved while this step is open moves the application on by itself. */}
              <ReferencePicker refreshSignal={refreshSignal} onRefreshed={() => { referencesDone.current?.(); referencesDone.current = null; }} onApproved={() => void submitApplication()} />
            </GlassCard>
          </Box>
        </Box>
      </Scroll>
      <StickyBar>
        {waiting ? <WaitingActions label="Eklediklerimi gönder" canSend={!!newInstagram} sending={submitting} notice={sendNotice} error={submitError} onSend={() => void sendInstagram()} onBack={() => navigate("onboarding-3", { reset: true })} /> : <>
        {submitError && (
          <Box style={[[ui.mb3]]}>
            <ErrorNotice
              title="Başvuru gönderilemedi"
              message={submitError}
              onDismiss={() => setSubmitError(null)}
              onRetry={() => void submitApplication()}
            />
          </Box>
        )}
        <Touch onPress={() => void submitApplication()} disabled={submitting} style={[[ui.wFull, ui.py4, ui.rounded2xl, ui.fontSemibold, ui.textBase, ui.trackingWide], {
        color: palette.text
      }]} gradient={palette.actionGradient}>
          {submitting ? "Gönderiliyor..." : store.user.status === "profile_incomplete" ? "Devam Et" : "Başvuruyu Gönder"}
        </Touch>
        </>}
      </StickyBar>
    </Box>;
}

/* ========================================
   STEP 3
======================================== */
function Step3({
  navigate
}: {
  navigate: NavigateFn;
}) {
  const { data: store, refreshEvents } = useStore();
  // The waiting page is where a push notification is worth asking for: we tell them when they are approved.
  const [push, setPush] = useState<PushState | null>(null);
  useEffect(() => { void registerForPush(true).then(setPush); }, []);
  // Pulling down reloads the status, so an approval shows even if the live update was missed.
  const pull = usePullRefresh();
  // An admin approval arrives over the socket (or on the next status load) and opens the app.
  useEffect(() => {
    if (store.user.status !== "approved") return;
    void refreshEvents().catch(() => {});
    navigate("discover", { reset: true });
  }, [store.user.status]);
  // "Başvurunu inceliyoruz" is only for an application waiting for its reference (it is approved the
  // moment the reference is); the reference step is the current one.
  const current = 1;
  // Accounts an admin put under review, or took passive (later also rating rules), see the same page
  // with review copy instead of the application timeline.
  const passive = store.user.status === "passive" || store.user.status === "security_review";
  const takenPassive = store.user.status === "passive";
  const stages = ["Başvuru Alındı", "Referans Bekleniyor", "Onay"].map((label, i) => ({
    label,
    state: i < current ? "done" : i === current ? "current" : "future"
  }));
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e]]}>
    <TopNavBar navigate={navigate} fallback="onboarding-2" onBack={() => navigate("onboarding-2", { back: true })} title="Üyelik Başvurusu" floating />
    <Scroll refreshControl={pull.control} style={[[ui.flex1, ui.flex, ui.flexCol, ui.itemsCenter, ui.justifyCenter, ui.px6], { paddingTop: 84 }]}>
      <AtmoBackground variant="violet" />

      <Box style={[[ui.relative, ui.wFull, ui.spaceY10]]}>
        {/* Hourglass */}
        <Box style={[[ui.flex, ui.justifyCenter]]} enter>
          <Box style={[[ui.relative]]}>
            <Box style={[[ui.w24, ui.h24, ui.roundedFull, ui.flex, ui.itemsCenter, ui.justifyCenter], {
            backgroundColor: "rgba(105,120,255,0.08)",
            borderWidth: 1,
            borderColor: "rgba(105,120,255,0.15)"
          }]} glass enter>
              <Label style={[[ui.text4xl]]} glass enter>
                ⏳
              </Label>
            </Box>
            <Box style={[[ui.fixed, ui.inset0, ui.roundedFull, ui.border, ui.borderC8a44a10]]} enter />
            <Box style={[[ui.fixed, ui.inset2, ui.roundedFull, ui.border, ui.borderWhite5]]} enter />
          </Box>
        </Box>

        {/* Text */}
        <Box style={[[ui.textCenter, ui.spaceY3]]} enter>
          <Label style={[[ui.fontDisplay, ui.text4xl, ui.textWhite], { fontStyle: "italic" }]}>
            {passive ? "Hesabın\nincelemede." : "Başvurunu\ninceliyoruz."}
          </Label>
          <EditorialQuote>{passive ? "Topluluğun güvende kalması için hesapları zaman zaman yeniden değerlendiriyoruz." : "Topluluğun güvenli kalması bizim için çok önemli. Bu yüzden her başvuruyu dikkatle değerlendiriyoruz."}</EditorialQuote>
          <Label style={[[ui.textSm, ui.textWhite35]]}>
            {passive ? (push === "granted" ? "İnceleme bitince sana bildirim göndereceğiz." : "İnceleme bitince sana haber vereceğiz.") : push === "granted" ? "Onaylandığında sana bildirim göndereceğiz." : "Yakında sana döneceğiz."}
          </Label>
          {push === "denied" && <Label style={[[ui.textXs, ui.textWhite35]]}>
              Bildirimler kapalı. Onayı uygulamayı açtığında göreceksin; bildirimleri telefonunun ayarlarından açabilirsin.
            </Label>}
        </Box>

        {/* Passive: what the review means; otherwise the application timeline */}
        {passive ? <GlassCard style={[[ui.p5, ui.spaceY3]]} enter>
            <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite]]}>{takenPassive ? "Hesabın şu an pasif" : "Hesabını inceliyoruz"}</Label>
            <Label style={[[ui.textXs, ui.textWhite55, ui.leadingRelaxed]]}>İnceleme sürerken etkinliklere katılamaz, etkinlik oluşturamaz ve mesaj gönderemezsin.</Label>
            <Label style={[[ui.textXs, ui.textWhite55, ui.leadingRelaxed]]}>Hesabın yeniden aktifleştirildiğinde uygulama kendiliğinden açılır; tekrar giriş yapman gerekmez.</Label>
          </GlassCard> : <GlassCard style={[[ui.p5]]} enter>
          <Box style={[[ui.spaceY0]]}>
            {stages.map((s, i) => <Box key={i} style={[[ui.flex, ui.itemsStart, ui.gap3]]}>
                <Box style={[[ui.flex, ui.flexCol, ui.itemsCenter]]}>
                  <Box style={[[ui.w6, ui.h6, ui.roundedFull, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.textXs, ui.fontSemibold, ui.flexShrink0, s.state === "done" ? [ui.bgC8a44a, ui.text1a1200] : s.state === "current" ? [ui.glassStrong, ui.border, ui.borderC8a44a50, ui.textWhite] : [ui.glass, ui.textWhite25]]]} glass>
                    {s.state === "done" ? <CheckIcon size={12} strokeWidth={2.5} /> : i + 1}
                  </Box>
                  {i < stages.length - 1 && <Box style={[[ui.wPx, ui.h8, ui.my1, s.state === "done" ? [ui.bgC8a44a40] : [ui.bgWhite10]]]} />}
                </Box>
                <Box style={[[ui.pt05]]}>
                  <Label style={[[ui.textSm, ui.fontMedium, s.state === "future" ? [ui.textWhite25] : s.state === "current" ? [ui.textWhite] : [ui.textC8a44a]]]}>
                    {s.label}
                  </Label>
                  {s.state === "current" && <Label style={[[ui.textXs, ui.textWhite35, ui.mt05]]}>
                      Şu anda bu aşamadasın
                    </Label>}
                </Box>
              </Box>)}
          </Box>
        </GlassCard>}

        <Box style={[[ui.flex, ui.justifyCenter]]}>
          <SignOutButton navigate={navigate} />
        </Box>
      </Box>
    </Scroll>
  </Box>;
}
export default function OnboardingScreen({
  step,
  navigate
}: Props) {
  if (step === 1) return <Step1 navigate={navigate} />;
  if (step === 2) return <Step2 navigate={navigate} />;
  return <Step3 navigate={navigate} />;
}
