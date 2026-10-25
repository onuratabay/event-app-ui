import { palette } from "../theme/palette";
import { claimSavedGuestParticipation } from "../guest/GuestSession";
import { showAlert } from "../components/AppDialog";
import { useWalkthroughAutostartBlocker } from "../walkthrough/activity";
import CityPicker from "../components/CityPicker";
import SignOutButton from "../components/SignOutButton";
import { updateProfile } from "../api/client";
import TopNavBar, { NavAction } from "../components/TopNavBar";
import EditorialQuote from "../components/EditorialQuote";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccordionItem, AtmoBackground, Avatar, GlassCard, GlassInput, LockedField, ProgressStepper } from "../components/GlassUI";
import { ErrorNotice } from "../components/ErrorNotice";
import { CheckIcon, ChevronDownIcon, EyeIcon, EyeOffIcon, InstagramIcon, ScrollIcon, UsersIcon } from "../components/Icons";
import { ReferencePicker } from "../components/ReferencePicker";
import { registerForPush, type PushState } from "../services/push";
import { updateStoreUser, useStore } from "../native/Store";
import { RefreshControl, StyleSheet, View, type ViewInstance } from "react-native";
import { clearSessionCache, logout, getApiErrorMessage, getCurrentUser, getLegalDocuments, login, redeemAccessCode, register, sendRegisterEmailCode, verifyRegisterEmail, type ApiUser, type LegalDocumentSummary } from "../api/client";
import { useOpenLegal } from "../legal/links";
import { gatedScreen } from "../native/access";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ContinueButton } from "../components/ContinueButton";
import { formatLocalPhone, formatPhone, PHONE_COUNTRY_CODE, phoneDigits } from "../content/phone";
import { GlassFill, INPUT_FROST } from "../components/GlassFill";
import { useKeyboardVisible } from "../components/BottomNav";
import { Box, Label, Scroll, Touch, useScrollAnchor } from "../native/UI";
import { ui } from "../theme/styles";
import { NavigateFn, type Screen as AppScreen } from "../types";
import { pastedCode } from "../native/pasteCode";
import { PASSWORD_ERROR, PASSWORD_HINT, PASSWORD_RULES, isStrongPassword, passwordRules } from "../content/password";
interface Props {
  step: 1 | 2 | 3;
  navigate: NavigateFn;
}
const PRINCIPLES = [{
  title: "Saygılı ve nazik ol",
  desc: "Bu topluluk gerçek hayatta bağlantılar kurar. Diğer üyelerle iletişiminde saygılı, kapsayıcı ve nazik ol. Farklı görüşlere, yaşam tarzlarına ve kişisel sınırlara saygı göster."
}, {
  title: "Katıldığın etkinliklere git",
  desc: "Bir etkinliğe katılacağını söylediğinde diğer üyeler sana güvenerek plan yapar. Gelemeyeceksen katılımını iptal et ve düzenleyene mümkün olduğunca erken haber ver."
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

/* ---------- Event invite code ---------- */
/**
 * One code field for both kinds of codes: an event invite (EWT-… or its link) opens that event as a guest;
 * any other code is a seasonal access code (e.g. EVENT2026) that opens the screen it was set up for, and may
 * approve the membership.
 */
/** "Çıkış" on every application step: ends the session (if any) and goes back to the welcome screen. */
function ExitAction({ navigate }: { navigate: NavigateFn }) {
  const { resetSession } = useStore();
  const [busy, setBusy] = useState(false);
  const exit = async () => {
    if (busy) return;
    setBusy(true);
    try { await logout(); } catch {}
    resetSession();
    setBusy(false);
    navigate("welcome", { reset: true });
  };
  return <NavAction label="Başvurudan çık" disabled={busy} onPress={() => showAlert("Çıkış yap", "Başvurundan çıkıp ilk ekrana döneceksin. Telefon numaran ve şifrenle giriş yaparak kaldığın yerden devam edebilirsin.", [{ text: "Vazgeç", style: "cancel" }, { text: "Çıkış yap", style: "destructive", onPress: () => void exit() }])}>Çıkış</NavAction>;
}

const INSTAGRAM_REQUIRED = "Devam etmek için Instagram kullanıcı adını yaz.";

/** Where a valid code leads; "Devam Et" opens it. */
type CodeResult = { kind: "access"; target: AppScreen };

/**
 * A member's reference code (REF-…, made on their profile) entered inside the reference card. Redeeming
 * it records that member's approved reference; "Devam Et" then moves the application on.
 */
function ReferenceCodeField({ done, onResult }: { done: boolean; onResult: (result: CodeResult | null) => void }) {
  const { setData: setStore } = useStore();
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const redeem = async () => {
    const code = input.trim().toUpperCase();
    if (!/^REF-/.test(code)) { setError("Referans kodu REF- ile başlar. Kodu üyenin profilinden al."); return; }
    setBusy(true); setError("");
    try {
      const redeemed = await redeemAccessCode(code);
      setStore(current => ({ ...current, user: { ...current.user, status: redeemed.status } }));
      onResult({ kind: "access", target: redeemed.target as AppScreen });
    }
    catch (cause) { setError(getApiErrorMessage(cause, "Bu kod geçerli değil veya süresi dolmuş.")); }
    finally { setBusy(false); }
  };
  const filled = !!input.trim();
  return <Box style={[[ui.mt3]]}>
    <Box style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
      <Box style={{ flex: 1, minWidth: 0 }}><GlassInput label="Referans kodun var mı?" accessibilityLabel="Referans kodu" placeholder="REF-…" value={input} onChangeText={text => { setInput(text.toUpperCase()); setError(""); if (done) onResult(null); }} autoCapitalize="characters" autoCorrect={false} returnKeyType="go" onSubmitEditing={() => void redeem()} /></Box>
      <Box style={{ zIndex: 2, elevation: 2, flexShrink: 0 }}><Touch accessibilityLabel="Referans kodunu ekle" disabled={busy || !filled} disabledOpacity={0.7} onPress={() => void redeem()} glass
        style={{ minHeight: 52, paddingHorizontal: 20, borderRadius: 16, borderWidth: 1, borderColor: filled ? "rgba(105,120,255,.55)" : palette.glassBorder, backgroundColor: filled ? palette.selected : palette.glass, color: filled ? palette.accent : palette.text, fontFamily: "Outfit-SemiBold", fontSize: 15 }}>{busy ? "…" : "Ekle"}</Touch></Box>
    </Box>
    {error ? <Label accessibilityRole="alert" style={[[ui.textXs, ui.mt15], { color: palette.error }]}>{error}</Label>
      : done ? <Label accessibilityRole="alert" style={[[ui.textXs, ui.mt15], { color: palette.success }]}>Referansın eklendi. Devam edebilirsin.</Label>
      : <Label style={[[ui.textXs, ui.mt15, ui.textWhite40]]}>Üye, kodu profilindeki “Referans kodu oluştur” ile alır.</Label>}
  </Box>;
}

/* ---------- Community principles + agreements ---------- */
/**
 * One card for everything to read and accept before applying: the five principles, then the legal
 * consents (with links to each text). The header shows whether the required consents are given.
 * Opening it (by hand, or automatically once the password is entered) scrolls it into view.
 */
function AgreementsCard({ open, onToggle, status, done, children }: { open: boolean; onToggle: () => void; status: string; done: boolean; children: ReactNode }) {
  const anchor = useScrollAnchor();
  const ref = useRef<ViewInstance | null>(null);
  useEffect(() => { if (open) anchor?.(ref.current); }, [open]);
  return <View ref={ref} collapsable={false}>
    <GlassCard style={[[ui.overflowHidden]]}>
      <Touch onPress={onToggle} accessibilityState={{ expanded: open }} style={[[ui.wFull, ui.flex, ui.itemsCenter, ui.justifyBetween, ui.p4]]}>
        <Box style={[[ui.flex, ui.itemsCenter, ui.gap3], { flex: 1, minWidth: 0 }]}>
          <IconBadge color="gold">
            <ScrollIcon size={18} />
          </IconBadge>
          <Box style={[[ui.textLeft], { flex: 1, minWidth: 0 }]}>
            <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite85]]}>Topluluk İlkeleri ve Sözleşmeler</Label>
            <Label style={[[ui.textXs], { color: done ? palette.success : "rgba(241,245,249,.45)" }]}>{status}</Label>
          </Box>
        </Box>
        <ChevronDownIcon size={16} style={[[ui.textWhite30, open ? [ui.rotate180] : []]]} />
      </Touch>
      {open && <Box style={[[ui.px4, ui.pb4, ui.borderT, ui.borderWhite8]]} enter>{children}</Box>}
    </GlassCard>
  </View>;
}
function SectionLabel({ children }: { children: ReactNode }) {
  return <Label style={[[ui.textXs, ui.textWhite40, ui.uppercase], { letterSpacing: 1.2, marginTop: 16, marginBottom: 2 }]}>{children}</Label>;
}

/* ---------- Sticky CTA bar ---------- */
/**
 * Names start with a capital letter in every word ("ayşe nur" → "Ayşe Nur", Turkish İ/I); the rest is left as typed.
 * Applied when the field is left and on submit, never while typing: changing the text under an Android keyboard's
 * ongoing composition made it re-insert the lowercase letter ("Aa").
 */
export const capitalizeWords = (value: string) => value.replace(/(^|[\s'-])(\p{L})/gu, (_match, before: string, letter: string) => before + letter.toLocaleUpperCase("tr-TR"));

function StickyBar({
  children
}: {
  children: React.ReactNode;
}) {
  const safeBottom = useSafeAreaInsets().bottom;
  // With the keyboard open the bar sits right on it: the home-indicator space is not needed, so the
  // bar stays low and covers less of the form.
  const keyboardOpen = useKeyboardVisible();
  return <Box style={[[ui.fixed, ui.bottom0, ui.left0, ui.right0, ui.px5, ui.pt4, ui.z40], { paddingBottom: keyboardOpen ? 12 : 32 + safeBottom }]} gradient={[palette.background, "transparent"]} gradientDirection="up">
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
    setData: setStore,
    refreshMyEvents
  } = useStore();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    ad: store.onboarding.ad || "",
    soyad: store.onboarding.soyad || "",
    email: store.onboarding.email || "",
    // The number box holds only the digits after +90 (a draft saved in the old "+90 …" format converts).
    telefon: formatLocalPhone(store.onboarding.telefon || ""),
    dogum: formatBirthDate(store.onboarding.dogum || ""),
    sehir: store.onboarding.sehir || "",
    sifre: store.onboarding.sifre || ""
  });
  const mounted = useRef(true);
  useWalkthroughAutostartBlocker(Object.values(form).some(value => !!value));
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
  // Once the password is in, the agreements card opens (and scrolls into view) by itself, once.
  const autoOpened = useRef(false);
  const openAgreementsAfterPassword = (password: string) => {
    if (autoOpened.current || !password.trim()) return;
    autoOpened.current = true;
    setPrinciplesOpen(true);
  };
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
  // Email check before the account exists: "Devam Et" sends a 6-digit code (2 minutes); only the right code
  // lets the account be created. The proof stays usable for 30 minutes (the server signs it) for this address.
  const [emailCheck, setEmailCheck] = useState<{ email: string; expiresAt: number; resendAt: number } | null>(null);
  const [emailCode, setEmailCode] = useState("");
  const [emailProof, setEmailProof] = useState<{ email: string; token: string; at: number } | null>(null);
  const [checkNow, setCheckNow] = useState(Date.now());
  useEffect(() => {
    if (!emailCheck) return;
    const timer = setInterval(() => setCheckNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [emailCheck]);
  const typedEmail = form.email.trim().toLowerCase();
  const codeSecondsLeft = emailCheck ? Math.max(0, Math.ceil((emailCheck.expiresAt - checkNow) / 1000)) : 0;
  const resendSecondsLeft = emailCheck ? Math.max(0, Math.ceil((emailCheck.resendAt - checkNow) / 1000)) : 0;
  const sendEmailCode = async () => {
    const result = await sendRegisterEmailCode(typedEmail, `+90${phoneDigits(form.telefon)}`, form.sifre);
    const now = Date.now();
    setEmailCode(""); setCheckNow(now);
    setEmailCheck({ email: typedEmail, expiresAt: Date.parse(result.expiresAt) || now + 120_000, resendAt: now + result.resendAfter * 1000 });
  };
  const continueRegistration = async () => {
    if (creating) return;
    setCreating(true); setCreateError(null);
    try {
      // Application order: email code → account → references (step 2) → profile and interests → waiting for approval.
      if (store.onboarding.accountId || store.user.id) { navigate("onboarding-2"); return; }
      if (!isStrongPassword(form.sifre)) { setCreateError(PASSWORD_ERROR); return; }
      const proof = emailProof && emailProof.email === typedEmail && Date.now() - emailProof.at < 25 * 60_000 ? emailProof.token : null;
      if (proof) { await createAccount(proof); return; }
      try { await sendEmailCode(); }
      catch (cause) {
        // Email or phone already has an account: an application that stopped half way continues with the same
        // phone and password; otherwise the server's message says which one is taken.
        if (!(cause instanceof Error && /^API 409:/.test(cause.message))) throw cause;
        const phoneNumber = `+90${phoneDigits(form.telefon)}`;
        let response;
        try { response = await login(phoneNumber, form.sifre); }
        catch { throw new Error(`API 409: ${JSON.stringify({ message: `${getApiErrorMessage(cause, "Bu e-posta veya telefon zaten kayıtlı.")} Daha önce başvuru yaptıysan aynı telefon ve şifreyle kaldığın yerden devam edebilirsin; şifreni hatırlamıyorsan girişteki “Şifremi unuttum”u kullan.` })}`); }
        enterAccount(response);
      }
    } catch (cause) { if (mounted.current) setCreateError(getApiErrorMessage(cause, "Doğrulama kodu gönderilemedi. Bağlantını ve e-posta adresini kontrol et.")); }
    finally { if (mounted.current) setCreating(false); }
  };
  const confirmEmailCode = async () => {
    if (creating || !emailCheck) return;
    if (emailCode.length !== 6) { setCreateError("E-postana gelen 6 haneli kodu gir."); return; }
    setCreating(true); setCreateError(null);
    try {
      const { emailVerificationToken } = await verifyRegisterEmail(emailCheck.email, emailCode);
      setEmailProof({ email: emailCheck.email, token: emailVerificationToken, at: Date.now() });
      setEmailCheck(null);
      await createAccount(emailVerificationToken);
    } catch (cause) { if (mounted.current) setCreateError(getApiErrorMessage(cause, "Kod doğrulanamadı. Tekrar dene.")); }
    finally { if (mounted.current) setCreating(false); }
  };
  const createAccount = async (emailVerificationToken: string) => {
    {
      const phoneNumber = `+90${phoneDigits(form.telefon)}`;
      let response;
      try {
        response = await register({ firstName: capitalizeWords(form.ad.trim()), lastName: capitalizeWords(form.soyad.trim()), email: form.email.trim(), phoneNumber, password: form.sifre, birthDate: form.dogum, city: form.sehir, acceptedDocuments, marketingConsent: marketing && !!marketingDocument, emailVerificationToken });
      } catch (cause) {
        // The account may already exist from an attempt that stopped half way (the server saved it, the
        // app never heard back). The same phone and password prove it is theirs: continue that application.
        if (!(cause instanceof Error && /^API 409:/.test(cause.message))) throw cause;
        try { response = await login(phoneNumber, form.sifre); }
        catch { throw new Error(`API 409: ${JSON.stringify({ message: "Bu e-posta veya telefonla başlamış bir başvuru var. Aynı şifreyi girersen kaldığın yerden devam edersin; şifreni hatırlamıyorsan girişteki “Şifremi unuttum” ile yenileyebilirsin." })}`); }
      }
      enterAccount(response);
      // An event joined on this device as a guest moves to the new account (best effort, in the background).
      void claimSavedGuestParticipation().then(eventId => { if (eventId) void refreshMyEvents().catch(() => {}); }).catch(() => {});
    }
  };
  const enterAccount = (response: Awaited<ReturnType<typeof register>>) => {
    {
      const id = String((response.user as { id: string }).id);
      const status = (response.user as { status?: { enum: string } }).status?.enum;
      setStore(current => ({ ...current, onboarding: { ...form, sifre: "", accountId: id }, user: { ...current.user, id, name: `${form.ad} ${form.soyad}`, status } }));
      // A resumed account that is already further along goes where its status belongs.
      const next = status && status !== "profile_incomplete" ? gatedScreen(status, response.user as { instagramUsername?: string | null }) ?? "discover" : "onboarding-2";
      if (mounted.current) navigate(next);
    }
  };
  const passwordOk = isStrongPassword(form.sifre);
  const allFilled = Object.values(form).every(v => v.trim().length > 0) && phoneDigits(form.telefon).length === 10 && !isFutureDate(form.dogum) && !isUnderAge(form.dogum) && passwordOk;
  const canContinue = Boolean(store.onboarding.accountId) || (allFilled && accepted);
  return <Box style={{
    flex: 1
  }}>
      <TopNavBar navigate={navigate} fallback="welcome" onBack={() => { setStore(current => ({ ...current, onboarding: { ...current.onboarding, ...form, sifre: "" } })); navigate("welcome", { back: true }); }} title="Üyelik Başvurusu" floating />
      {/* keyboardReveal: the field being typed in is scrolled above the keyboard. */}
      <Scroll keyboardReveal style={[[ui.flex, ui.flexCol, ui.flex1, ui.bg06060e, ui.pb40, ui.px5], { paddingTop: 84 }]}>
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
            {/* Names: the keyboard starts each word with a capital. No autoCorrect={false} here: on Android it sends
                "no suggestions", and some keyboards (e.g. Samsung) then also skip the automatic capital. */}
            <Box walkthroughId="application-fields" style={[[ui.grid, ui.gap3]]} columns={2}>
              {locked("ad") ? <LockedField label="Ad" value={submitted.ad} /> : <GlassInput label="Ad" placeholder="Adın" autoCapitalize="words" textContentType="givenName" autoComplete="given-name" value={form.ad} onChangeText={e => setForm(p => ({
              ...p,
              ad: e
            }))} onEndEditing={() => setForm(p => ({ ...p, ad: capitalizeWords(p.ad) }))} />}
              {locked("soyad") ? <LockedField label="Soyad" value={submitted.soyad} /> : <GlassInput label="Soyad" placeholder="Soyadın" autoCapitalize="words" textContentType="familyName" autoComplete="family-name" value={form.soyad} onChangeText={e => setForm(p => ({
              ...p,
              soyad: e
            }))} onEndEditing={() => setForm(p => ({ ...p, soyad: capitalizeWords(p.soyad) }))} />}
            </Box>
            {locked("email") ? <LockedField label="E-posta" value={submitted.email} /> : <GlassInput label="E-posta" placeholder="ornek@email.com" value={form.email} onChangeText={e => setForm(p => ({
            ...p,
            email: e
          }))} mode="email" />}
            {/* Two boxes: the fixed country code, then the number. */}
            {locked("telefon") ? <LockedField label="Telefon" value={submitted.telefon} /> : <Box>
              <Label style={passwordStyles.label}>Telefon</Label>
              <Box style={phoneStyles.row}>
                <Box accessibilityLabel="Ülke kodu +90" style={phoneStyles.code}>
                  <GlassFill radius={16} {...INPUT_FROST} />
                  <Box style={phoneStyles.codeInner}><Label style={phoneStyles.codeText}>{PHONE_COUNTRY_CODE}</Label></Box>
                </Box>
                <GlassInput accessibilityLabel="Telefon numarası" placeholder="5XX XXX XX XX" value={form.telefon} onChangeText={e => setForm(p => ({
                ...p,
                telefon: formatLocalPhone(e)
              }))} mode="tel" keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel-national" maxLength={13} />
              </Box>
            </Box>}
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
            {/* Same as sign-in: the eye button shows or hides what was typed. */}
            {!waiting && <Box>
              <Label style={passwordStyles.label}>Şifre</Label>
              <Box style={passwordStyles.wrap}>
                <GlassInput accessibilityLabel="Şifre" placeholder={PASSWORD_HINT} value={form.sifre} onChangeText={e => setForm(p => ({
                ...p,
                sifre: e
              }))} onEndEditing={event => openAgreementsAfterPassword(event.nativeEvent.text ?? form.sifre)} secureTextEntry={!showPassword} autoComplete="new-password" textContentType="newPassword" autoCapitalize="none" autoCorrect={false} style={passwordStyles.input} />
                <Touch accessibilityLabel={showPassword ? "Şifreyi gizle" : "Şifreyi göster"} onPress={() => setShowPassword(value => !value)} style={passwordStyles.toggle}>
                  {showPassword ? <EyeOffIcon style={passwordStyles.icon} /> : <EyeIcon style={passwordStyles.icon} />}
                </Touch>
              </Box>
              {/* The rules, checked as the password is typed (the server checks the same before sending the code). */}
              {!!form.sifre && <Box style={passwordRuleStyles.row} accessibilityLiveRegion="polite">
                {PASSWORD_RULES.map(([key, text]) => {
                  const ok = passwordRules(form.sifre)[key];
                  return <Label key={key} style={[passwordRuleStyles.rule, { color: ok ? palette.success : palette.muted }]}>{`${ok ? "✓" : "○"} ${text}`}</Label>;
                })}
              </Box>}
            </Box>}
          </Box>

          {/* Principles and every consent live in one card; it opens by itself once the password is in. */}
          <Box walkthroughId="application-consent" enter>
            <AgreementsCard open={principlesOpen} onToggle={() => setPrinciplesOpen(!principlesOpen)} done={waiting || accepted}
              status={waiting ? "Sözleşmeleri başvururken onayladın." : accepted ? "Onaylandı ✓" : `${PRINCIPLES.length} ilke · 2 zorunlu onay`}>
              <SectionLabel>İlkeler</SectionLabel>
              {PRINCIPLES.map((p, i) => <AccordionItem key={i} title={p.title} open={openAccordion === i} onToggle={() => setOpenAccordion(openAccordion === i ? null : i)}>
                  {p.desc}
                </AccordionItem>)}
              {/* Consents — versions come from the server and are recorded with the account */}
              {!waiting && <>
                <SectionLabel>Onaylar</SectionLabel>
                <ConsentCheck checked={rulesAccepted} onToggle={() => setRulesAccepted(!rulesAccepted)} label="Kullanım Koşulları ve Topluluk Kuralları onayı">
                  <Label accessibilityRole="link" onPress={() => openLegal("terms")} style={[[ui.textWhite85, ui.underline]]}>Kullanım Koşulları</Label>
                  {" ve "}
                  <Label accessibilityRole="link" onPress={() => openLegal("community")} style={[[ui.textWhite85, ui.underline]]}>Topluluk Kuralları</Label>
                  'nı kabul ediyorum.
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
              </>}
            </AgreementsCard>
            {documentsError && !store.onboarding.accountId && <Box style={[[ui.mt3]]}>
                <ErrorNotice title="Metinler yüklenemedi" message={documentsError} onDismiss={() => setDocumentsError(null)} onRetry={() => setDocumentsAttempt(value => value + 1)} />
              </Box>}
          </Box>
        </Box>
      </Scroll>
      <StickyBar>
        {waiting ? <WaitingActions label="Eklediklerimi gönder" canSend={Object.keys(additions).length > 0} sending={sending} notice={sendNotice} error={sendError} onSend={() => void sendAdditions()} onBack={() => navigate("onboarding-3", { reset: true })} /> : <>
        {createError && <ErrorNotice title="Kayıt tamamlanamadı" message={createError} onDismiss={() => setCreateError(null)} />}
        {emailCheck ? <Box style={emailCodeStyles.panel}>
            {/* Its own frosted card: the bar's fade alone let the form behind show through the taller panel. */}
            <GlassFill kind="sheet" radius={24} />
            <Label style={emailCodeStyles.title}>E-postanı doğrula</Label>
            <Label style={emailCodeStyles.hint}>{`${emailCheck.email} adresine 6 haneli bir kod gönderdik. Gelen kutunu ve spam klasörünü kontrol et.`}</Label>
            <GlassInput label="Doğrulama kodu" accessibilityLabel="E-posta doğrulama kodu" value={emailCode} onChangeText={value => { setEmailCode(value.replace(/\D/g, "").slice(0, 6)); setCreateError(null); }}
              keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} placeholder="••••••" returnKeyType="done" onSubmitEditing={() => void confirmEmailCode()} />
            <Box style={emailCodeStyles.timerRow}>
              <Label style={[emailCodeStyles.timer, !codeSecondsLeft && emailCodeStyles.expired, { flex: 1 }]} accessibilityLiveRegion="polite">
                {codeSecondsLeft ? `Kod ${Math.floor(codeSecondsLeft / 60)}:${String(codeSecondsLeft % 60).padStart(2, "0")} içinde geçersiz olacak.` : "Kodun süresi doldu. Yeni kod iste."}
              </Label>
              {/* The code copied from the email goes into the field with one tap. */}
              <Touch accessibilityLabel="Kodu yapıştır" onPress={() => void pastedCode().then(value => { if (value) { setEmailCode(value); setCreateError(null); } else setCreateError("Panoda 6 haneli bir kod yok. Koda e-postada dokunup kopyala."); })} style={emailCodeStyles.link}>
                <Label style={emailCodeStyles.linkText}>Kodu yapıştır</Label>
              </Touch>
            </Box>
            <ContinueButton onPress={() => void confirmEmailCode()} disabled={creating || !codeSecondsLeft || emailCode.length !== 6}>
              {creating ? "Hesap oluşturuluyor…" : "Doğrula ve devam et"}
            </ContinueButton>
            <Box style={emailCodeStyles.links}>
              <Touch accessibilityLabel="Kodu tekrar gönder" disabled={creating || resendSecondsLeft > 0} onPress={() => { setCreateError(null); void sendEmailCode().catch(cause => setCreateError(getApiErrorMessage(cause, "Kod gönderilemedi."))); }} style={emailCodeStyles.link}>
                <Label style={[emailCodeStyles.linkText, resendSecondsLeft > 0 && emailCodeStyles.linkMuted]}>{resendSecondsLeft > 0 ? `Tekrar gönder (${resendSecondsLeft} sn)` : "Kodu tekrar gönder"}</Label>
              </Touch>
              <Touch accessibilityLabel="E-postayı değiştir" disabled={creating} onPress={() => { setEmailCheck(null); setEmailCode(""); setCreateError(null); }} style={emailCodeStyles.link}>
                <Label style={emailCodeStyles.linkText}>E-postayı değiştir</Label>
              </Touch>
            </Box>
          </Box>
        : <ContinueButton onPress={() => void continueRegistration()} disabled={!canContinue || creating}>
          {creating ? (store.onboarding.accountId ? "Hesap oluşturuluyor…" : "Kod gönderiliyor…") : "Devam Et"}
        </ContinueButton>}
        </>}
      </StickyBar>
    </Box>;
}

const passwordRuleStyles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 4, marginTop: 8 },
  rule: { fontSize: 12, lineHeight: 17 },
});
const emailCodeStyles = StyleSheet.create({
  panel: { gap: 10, padding: 16, borderRadius: 24, overflow: "hidden", backgroundColor: palette.glassSheet, borderWidth: 1, borderColor: palette.glassBorder },
  title: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 16, lineHeight: 22 },
  hint: { color: palette.muted, fontSize: 13, lineHeight: 18 },
  timerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  timer: { color: palette.muted, fontSize: 12, lineHeight: 17 },
  expired: { color: palette.error },
  links: { flexDirection: "row", justifyContent: "space-between" },
  link: { minHeight: 40, justifyContent: "center", paddingHorizontal: 4 },
  linkText: { color: palette.accent, fontFamily: "Outfit-Medium", fontSize: 13 },
  linkMuted: { color: palette.muted },
});

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
  const [instagram, setInstagram] = useState("");
  const { waiting, me, setMe } = useApplicant();
  const instagramLocked = waiting && !!me?.instagramUsername;
  const newInstagram = instagramLocked ? "" : instagram.replace(/^@/, "").trim();
  // Instagram is required to continue: a handle already on the account (coming back to this step) counts.
  useEffect(() => { if (!waiting && me?.instagramUsername) setInstagram(current => current || `@${me.instagramUsername}`); }, [waiting, me?.instagramUsername]);
  const instagramValid = /^[a-z0-9._]{1,30}$/.test(newInstagram);
  const [codeResult, setCodeResult] = useState<CodeResult | null>(null);
  const canContinue = instagramLocked || instagramValid || !!codeResult;
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
    if (codeResult) {
      if (instagramValid) await updateProfile({ instagramUsername: newInstagram }).catch(() => {});
      // A member's reference code (REF-…) counts as their reference: the application goes on as usual.
      if ((codeResult.target as string) === "reference") navigate(store.user.status === "profile_incomplete" ? "interests" : store.user.status === "approved" ? "discover" : "onboarding-3", store.user.status === "approved" ? { reset: true } : undefined);
      else navigate(codeResult.target, { reset: true });
      return;
    }
    // Also when an approved reference moves the step on by itself: the Instagram handle comes first.
    if (!canContinue) { setSubmitError(INSTAGRAM_REQUIRED); return; }
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
      <TopNavBar navigate={navigate} fallback="onboarding-1" title="Üyelik Başvurusu" right={<ExitAction navigate={navigate} />} floating />
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
              Instagram kullanıcı adını ekle, istersen tanıdığın bir üyeden referans iste.
            </Label>
          </Box>

          <Box style={[[ui.spaceY3]]} enter>
            {/* Instagram */}
            {/* Required, so it is always open with the field shown (a closed card was easy to miss). */}
            {instagramLocked ? <GlassCard walkthroughId="reference-instagram" style={[[ui.p4]]}><LockedField label="Instagram" value={`@${me?.instagramUsername}`} /></GlassCard> : <GlassCard walkthroughId="reference-instagram" style={[[ui.p4, ui.borderC8a44a35]]}>
              <Box style={[[ui.flex, ui.itemsCenter, ui.gap3]]}>
                <IconBadge color="violet">
                  <InstagramIcon size={18} />
                </IconBadge>
                <Box style={[[ui.flex1]]}>
                  <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite85]]}>
                    Instagram
                  </Label>
                  <Label style={[[ui.textXs, ui.textWhite40]]}>
                    Zorunlu · Kullanıcı adını ekle
                  </Label>
                </Box>
              </Box>
              <Box style={[[ui.mt3]]}>
                  <GlassInput placeholder="@kullaniciadi" accessibilityLabel="Instagram kullanıcı adı" autoCapitalize="none" autoCorrect={false} autoComplete="username" value={instagram} onChangeText={value => { const username = value.replace(/[@\s]/g, "").toLowerCase(); setInstagram(username ? `@${username}` : "") }} />
                  {!!newInstagram && !instagramValid && <Label style={[[ui.textXs, ui.mt15], { color: palette.error }]}>Kullanıcı adı yalnızca harf, rakam, nokta ve alt çizgi içerebilir (en fazla 30 karakter).</Label>}
                  {!canContinue && !newInstagram && submitError === INSTAGRAM_REQUIRED && <Label accessibilityRole="alert" style={[[ui.textXs, ui.mt15], { color: palette.error }]}>{INSTAGRAM_REQUIRED}</Label>}
                </Box>
                <Label style={[[ui.textXs, ui.textWhite30, ui.mt3, { fontStyle: "italic" }]]}>Instagram kullanıcı adını başvurunu değerlendirirken kullanıyoruz. Hesabının şifresini istemiyoruz.</Label>
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
                    Uygulamayı kullanan arkadaşından referans istemek için onu ekle
                  </Label>
                </Box>
              </Box>

              {/* A reference approved while this step is open moves the application on by itself. */}
              <ReferencePicker refreshSignal={refreshSignal} onRefreshed={() => { referencesDone.current?.(); referencesDone.current = null; }} onApproved={() => void submitApplication()} />
              <ReferenceCodeField done={(codeResult?.target as string) === "reference"} onResult={setCodeResult} />
            </GlassCard>

          </Box>
        </Box>
      </Scroll>
      <StickyBar>
        {waiting ? <WaitingActions label="Eklediklerimi gönder" canSend={!!newInstagram} sending={submitting} notice={sendNotice} error={submitError} onSend={() => void sendInstagram()} onBack={() => navigate("onboarding-3", { reset: true })} /> : <>
        {submitError && submitError !== INSTAGRAM_REQUIRED && (
          <Box style={[[ui.mb3]]}>
            <ErrorNotice
              title="Başvuru gönderilemedi"
              message={submitError}
              onDismiss={() => setSubmitError(null)}
              onRetry={() => void submitApplication()}
            />
          </Box>
        )}
        <ContinueButton onPress={() => void submitApplication()} disabled={submitting} dimmed={!canContinue}>
          {submitting ? "Gönderiliyor..." : codeResult || store.user.status === "profile_incomplete" ? "Devam Et" : "Başvuruyu Gönder"}
        </ContinueButton>
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
  const { data: store, refreshEvents, loadReferences } = useStore();
  // The middle step names what the application waits for: a reference only if one was asked for and is
  // still open; otherwise the team reviews it (admin approval).
  useEffect(() => { void loadReferences().catch(() => {}); }, []);
  const awaitingReference = !!store.references?.some(row => row.direction === "outgoing" && row.status === "pending");
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
  // "Başvurunu inceliyoruz": the application waits for its reference (approved the moment it is) or,
  // without one, for an admin; that middle step is the current one.
  const current = 1;
  // Accounts an admin put under review, or took passive (later also rating rules), see the same page
  // with review copy instead of the application timeline.
  const passive = store.user.status === "passive" || store.user.status === "security_review";
  const takenPassive = store.user.status === "passive";
  const stages = ["Başvuru Alındı", awaitingReference ? "Referans Bekleniyor" : "Başvuru İnceleniyor", "Onay"].map((label, i) => ({
    label,
    state: i < current ? "done" : i === current ? "current" : "future"
  }));
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e]]}>
    <TopNavBar navigate={navigate} fallback="onboarding-2" onBack={() => navigate("onboarding-2", { back: true })} title="Üyelik Başvurusu" right={<ExitAction navigate={navigate} />} floating />
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
        <Box walkthroughId="application-status" style={[[ui.textCenter, ui.spaceY3]]} enter>
          <Label style={[[ui.fontDisplay, ui.text4xl, ui.textWhite], { fontStyle: "italic" }]}>
            {passive ? "Hesabın\nincelemede." : "Başvurunu\ninceliyoruz."}
          </Label>
          <EditorialQuote>{passive ? "Topluluğun güvende kalması için hesapları zaman zaman yeniden değerlendiriyoruz." : "Başvurunun durumunu buradan takip edebilirsin. Onaylı bir üyeden referansın varsa başvuruna ekleyebilirsin."}</EditorialQuote>
          <Label style={[[ui.textSm, ui.textWhite35]]}>
            {passive ? (push === "granted" ? "İnceleme bitince sana bildirim göndereceğiz." : "İncelemenin sonucunu bu ekrandan takip edebilirsin.") : push === "granted" ? "Onaylandığında sana bildirim göndereceğiz." : "Başvurunun güncel durumunu bu ekrandan takip edebilirsin."}
          </Label>
          {push === "denied" && <Label style={[[ui.textXs, ui.textWhite35]]}>
              Bildirimler kapalı. Onayı uygulamayı açtığında göreceksin; bildirimleri telefonunun ayarlarından açabilirsin.
            </Label>}
        </Box>

        {/* Passive: what the review means; otherwise the application timeline */}
        {passive ? <GlassCard walkthroughId="application-progress" style={[[ui.p5, ui.spaceY3]]} enter>
            <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite]]}>{takenPassive ? "Hesabın şu an pasif" : "Hesabını inceliyoruz"}</Label>
            <Label style={[[ui.textXs, ui.textWhite55, ui.leadingRelaxed]]}>İnceleme sürerken etkinliklere katılamaz, etkinlik oluşturamaz ve mesaj gönderemezsin.</Label>
            <Label style={[[ui.textXs, ui.textWhite55, ui.leadingRelaxed]]}>Hesabın yeniden etkinleştirildiğinde uygulamayı kullanmaya devam edebilirsin.</Label>
          </GlassCard> : <GlassCard walkthroughId="application-progress" style={[[ui.p5]]} enter>
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
// Password field with the sign-in page's show/hide button; the label matches the other register fields.
const passwordStyles = StyleSheet.create({
  label: { fontSize: 13, color: "rgba(241,245,249,.72)", marginBottom: 6, letterSpacing: 1.2, textTransform: "uppercase" },
  wrap: { position: "relative", justifyContent: "center" },
  input: { paddingRight: 56 },
  toggle: { position: "absolute", right: 4, top: 0, bottom: 0, width: 48, alignItems: "center", justifyContent: "center" },
  icon: { color: "#c7ceff" },
});
// Phone: a fixed "+90" box beside the number field, matching the other register fields.
const phoneStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  code: { width: 72, borderRadius: 16 },
  codeInner: { flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 16, borderWidth: 1, borderColor: palette.glassBorder },
  codeText: { color: palette.text, fontSize: 16, fontFamily: "Outfit-Medium" },
});
