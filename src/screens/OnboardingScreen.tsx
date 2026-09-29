import { updateProfile } from "../api/client";
import TopNavBar from "../components/TopNavBar";
import EditorialQuote from "../components/EditorialQuote";
import { useEffect, useRef, useState } from "react";
import { AccordionItem, AtmoBackground, Avatar, GlassCard, GlassInput, ProgressStepper } from "../components/GlassUI";
import { ErrorNotice } from "../components/ErrorNotice";
import { CheckIcon, ChevronDownIcon, InstagramIcon, KeyIcon, ScrollIcon, UsersIcon } from "../components/Icons";
import { ReferencePicker } from "../components/ReferencePicker";
import { useStore } from "../native/Store";
import { getApiErrorMessage, register } from "../api/client";
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

/* ---------- Sticky CTA bar ---------- */
function StickyBar({
  children
}: {
  children: React.ReactNode;
}) {
  return <Box style={[[ui.fixed, ui.bottom0, ui.left0, ui.right0, ui.px5, ui.pb8, ui.pt4, ui.z40], {}]} gradient={["#101827", "transparent"]} gradientDirection="up">
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
      backgroundColor: "rgba(200,164,74,0.10)",
      borderWidth: 1,
      borderColor: "rgba(200,164,74,0.18)",
      color: "#c8a44a"
    },
    violet: {
      backgroundColor: "rgba(124,112,240,0.10)",
      borderWidth: 1,
      borderColor: "rgba(124,112,240,0.18)",
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
    sifre: store.onboarding.sifre || ""
  });
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [principlesOpen, setPrinciplesOpen] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<number | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const continueRegistration = async () => {
    if (creating) return;
    setCreating(true); setCreateError(null);
    try {
      if (store.onboarding.accountId) { navigate("onboarding-2"); return; }
      const response = await register({ firstName: form.ad, lastName: form.soyad, email: form.email.trim(), phoneNumber: form.telefon.replace(/\s/g, ""), password: form.sifre, birthDate: form.dogum });
      const id = String((response.user as { id: string }).id);
      setStore(current => ({ ...current, onboarding: { ...form, sifre: "", accountId: id }, user: { ...current.user, id, name: `${form.ad} ${form.soyad}` } }));
      if (mounted.current) navigate("onboarding-2");
    } catch (cause) { if (mounted.current) setCreateError(getApiErrorMessage(cause, "Hesabın oluşturulamadı. Bağlantını ve bilgilerini kontrol et.")); }
    finally { if (mounted.current) setCreating(false); }
  };
  const allFilled = Object.values(form).every(v => v.trim().length > 0);
  const canContinue = Boolean(store.onboarding.accountId) || (allFilled && accepted);
  return <Box style={{
    flex: 1
  }}>
      <TopNavBar navigate={navigate} fallback="welcome" onBack={() => { setStore(current => ({ ...current, onboarding: { ...current.onboarding, ...form, sifre: "" } })); navigate("welcome", { back: true }); }} title="Üyelik Başvurusu" subtitle="Adım 1/3" />
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
              Devam ettiğinde hesabın oluşturulur. Sonraki adımda referans isteyebilirsin.
            </Label>
          </Box>

          {/* Form */}
          <Box style={[[ui.spaceY3]]} enter>
            <Box style={[[ui.grid, ui.gap3]]} columns={2}>
              <GlassInput label="Ad" placeholder="Adın" value={form.ad} onChangeText={e => setForm(p => ({
              ...p,
              ad: e
            }))} />
              <GlassInput label="Soyad" placeholder="Soyadın" value={form.soyad} onChangeText={e => setForm(p => ({
              ...p,
              soyad: e
            }))} />
            </Box>
            <GlassInput label="E-posta" placeholder="ornek@email.com" value={form.email} onChangeText={e => setForm(p => ({
            ...p,
            email: e
          }))} mode="email" />
            <GlassInput label="Telefon" placeholder="+90 5XX XXX XX XX" value={form.telefon} onChangeText={e => setForm(p => ({
            ...p,
            telefon: e
          }))} mode="tel" />
            <GlassInput label="Doğum Tarihi" placeholder="GG/AA/YYYY" value={form.dogum} onChangeText={e => setForm(p => ({
            ...p,
            dogum: formatBirthDate(e)
          }))} keyboardType="number-pad" maxLength={10} />
            <GlassInput label="Şifre" placeholder="En az 8 karakter ve özel karakter" value={form.sifre} onChangeText={e => setForm(p => ({
            ...p,
            sifre: e
          }))} secureTextEntry />
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

            {/* Accept checkbox */}
            <Touch onPress={() => setAccepted(!accepted)} style={[[ui.mt3, ui.flex, ui.itemsStart, ui.gap3, ui.wFull, ui.textLeft]]}>
              <Box style={[[ui.mt05, ui.w5, ui.h5, ui.roundedMd, ui.flexShrink0, ui.border, ui.flex, ui.itemsCenter, ui.justifyCenter, accepted ? [ui.bgC8a44a, ui.borderC8a44a] : [ui.borderWhite25, ui.bgWhite5]]]}>
                {accepted && <CheckIcon size={12} strokeWidth={2.5} style={[[ui.text1a1200]]} />}
              </Box>
              <Label style={[[ui.textSm, ui.textWhite55, ui.leadingRelaxed]]}>
                Topluluk ilkelerini okudum ve kabul ediyorum.
              </Label>
            </Touch>
          </Box>
        </Box>
      </Scroll>
      <StickyBar>
        {createError && <ErrorNotice title="Kayıt tamamlanamadı" message={createError} onDismiss={() => setCreateError(null)} />}
        <Touch onPress={() => void continueRegistration()} disabled={!canContinue || creating} disabledOpacity={1} style={[[ui.wFull, ui.py4, ui.rounded2xl, ui.fontSemibold, ui.textBase, ui.trackingWide], {
        color: canContinue ? "#1a1200" : "rgba(226,232,240,.62)",
        borderWidth: 1,
        borderColor: canContinue ? "rgba(242,216,137,.5)" : "rgba(148,163,184,.22)",
      }]} gradient={canContinue ? ["#c8a44a", "#dab96e", "#c09038"] : ["#202b3d", "#182235", "#151f30"]}>
          {creating ? "Hesap oluşturuluyor…" : "Devam Et"}
        </Touch>
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
  const [method, setMethod] = useState<"instagram" | "code" | "reference" | null>(null);
  const [instagram, setInstagram] = useState("");
  const [code, setCode] = useState("");
  const [codeValid, setCodeValid] = useState<boolean | null>(null);
  const validateCode = () => { setCodeValid(false); setSubmitError("Davet koduyla üyelik şu anda kullanılamıyor. Referans isteğiyle devam edebilirsin."); };
  const submitApplication = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (!store.onboarding.accountId) { navigate("onboarding-1"); return; }
      if (instagram.trim()) await updateProfile({ instagramUsername: instagram.replace(/^@/, "").trim() });
      navigate("onboarding-3");
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, "Bilgilerini kontrol edip tekrar dene."));
    } finally {
      setSubmitting(false);
    }
  };
  return <Box style={{
    flex: 1
  }}>
      <TopNavBar navigate={navigate} fallback="onboarding-1" title="Üyelik Başvurusu" subtitle="Adım 2/3" />
      <Scroll style={[[ui.flex, ui.flexCol, ui.flex1, ui.bg06060e, ui.pb40, ui.px5], { paddingTop: 84 }]}>
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
            <GlassCard onPress={() => setMethod(method === "instagram" ? null : "instagram")} style={[[ui.p4, method === "instagram" ? [ui.borderC8a44a35] : []]]}>
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
                  <GlassInput placeholder="@kullaniciadi" value={instagram} onChangeText={value => { const username = value.replace(/@/g, "").trim(); setInstagram(username ? `@${username}` : "") }} />
                </Touch>}
            </GlassCard>

            {/* Invite code */}
            <GlassCard onPress={() => setMethod(method === "code" ? null : "code")} style={[[ui.p4, method === "code" ? [ui.borderC8a44a35] : []]]}>
              <Box style={[[ui.flex, ui.itemsCenter, ui.gap3]]}>
                <IconBadge color="gold">
                  <KeyIcon size={18} />
                </IconBadge>
                <Box style={[[ui.flex1]]}>
                  <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite85]]}>
                    Davet Kodu
                  </Label>
                  <Label style={[[ui.textXs, ui.textWhite40]]}>
                    Kodunu gir
                  </Label>
                </Box>
                {codeValid === true && <Box style={[[ui.flex, ui.itemsCenter, ui.gap1, ui.textEmerald400]]}>
                    <CheckIcon size={14} strokeWidth={2} />
                    <Label style={[[ui.textXs]]}>Geçerli</Label>
                  </Box>}
                {method === "code" && codeValid !== true && <Box style={[[ui.w2, ui.h2, ui.roundedFull, ui.bgC8a44a]]} />}
              </Box>
              {method === "code" && <Touch onPress={e => e.stopPropagation()} style={[[ui.mt3, ui.flex, ui.gap2]]} enter>
                  <GlassInput placeholder="EVENT2026" value={code} onChangeText={e => {
                setCode(e);
                setCodeValid(null);
              }} style={[[ui.flex1, ui.uppercase, ui.trackingWidest]]} />
                  <Touch onPress={validateCode} style={[[ui.px4, ui.py3, ui.roundedXl, ui.textSm, ui.fontMedium, ui.text1a1200, ui.flexShrink0], {}]} gradient={["#c8a44a", "#c09038"]}>
                    Doğrula
                  </Touch>
                </Touch>}
              {codeValid === false && <Label style={[[ui.mt2, ui.textXs, ui.textRed400, ui.pl1]]}>
                  Geçersiz kod. Lütfen tekrar dene.
                </Label>}
            </GlassCard>

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

              <ReferencePicker />
            </GlassCard>
          </Box>
        </Box>
      </Scroll>
      <StickyBar>
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
        color: "#1a1200"
      }]} gradient={["#c8a44a", "#dab96e", "#c09038"]}>
          {submitting ? "Gönderiliyor..." : "Başvuruyu Gönder"}
        </Touch>
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
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const [stage, setStage] = useState<"waiting" | "simulating">("waiting");
  const handleSimulate = () => {
    setStage("simulating");
    timer.current = setTimeout(() => navigate("approval"), 1200);
  };
  const stages = [{
    label: "Başvuru Alındı",
    state: "done"
  }, {
    label: "Referans Bekleniyor",
    state: "current"
  }, {
    label: "Onay",
    state: "future"
  }];
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e]]}>
    <TopNavBar navigate={navigate} fallback="onboarding-2" onBack={() => { if (timer.current) clearTimeout(timer.current); navigate("onboarding-2", { back: true }); }} title="Üyelik Başvurusu" subtitle="Adım 3/3" />
    <Scroll style={[[ui.flex1, ui.flex, ui.flexCol, ui.itemsCenter, ui.justifyCenter, ui.px6], { paddingTop: 84 }]}>
      <AtmoBackground variant="violet" />

      <Box style={[[ui.relative, ui.wFull, ui.spaceY10]]}>
        {/* Hourglass */}
        <Box style={[[ui.flex, ui.justifyCenter]]} enter>
          <Box style={[[ui.relative]]}>
            <Box style={[[ui.w24, ui.h24, ui.roundedFull, ui.flex, ui.itemsCenter, ui.justifyCenter], {
            backgroundColor: "rgba(200,164,74,0.08)",
            borderWidth: 1,
            borderColor: "rgba(200,164,74,0.15)"
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
            Başvurunu{"\n"}inceliyoruz.
          </Label>
          <EditorialQuote>Topluluğun güvenli kalması bizim için çok önemli. Bu yüzden her başvuruyu dikkatle değerlendiriyoruz.</EditorialQuote>
          <Label style={[[ui.textSm, ui.textWhite35]]}>
            Yakında sana döneceğiz.
          </Label>
        </Box>

        {/* Timeline */}
        <GlassCard style={[[ui.p5]]} enter>
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
        </GlassCard>

        {/* Demo simulate */}
        <Box style={[[]]} enter>
          <Touch onPress={handleSimulate} disabled={stage === "simulating"} style={[[ui.wFull, ui.py3, ui.roundedXl, ui.textXs, ui.textWhite20, ui.border, ui.borderWhite8]]}>
            {stage === "simulating" ? "Onaylanıyor..." : "⚙ Onayı Simüle Et (Demo)"}
          </Touch>
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
