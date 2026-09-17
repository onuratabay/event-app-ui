import { useState } from "react";
import { AccordionItem, AtmoBackground, Avatar, GlassCard, GlassInput, ProgressStepper } from "../components/GlassUI";
import { CheckIcon, ChevronDownIcon, InstagramIcon, KeyIcon, ScrollIcon, UsersIcon } from "../components/Icons";
import { CONTACT_MEMBERS } from "../data";
import { useStore } from "../native/Store";
import { Box, Label, Scroll, Touch } from "../native/UI";
import { ui } from "../theme/styles";
import { NavigateFn } from "../types";
interface Props {
  step: 1 | 2 | 3;
  navigate: NavigateFn;
}
const PRINCIPLES = [{
  title: "Saygılı ve nazik ol",
  desc: "Event App gerçek hayatta bağlantılar kuran bir topluluktur. Diğer üyelerle iletişiminde saygılı, kapsayıcı ve nazik ol. Farklı görüşlere, yaşam tarzlarına ve kişisel sınırlara saygı göster."
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

/* ---------- Sticky CTA bar ---------- */
function StickyBar({
  children
}: {
  children: React.ReactNode;
}) {
  return <Box style={[[ui.fixed, ui.bottom0, ui.left0, ui.right0, ui.px5, ui.pb8, ui.pt4, ui.z40], {}]} gradient={["#06060e", "transparent"]} gradientDirection="up">
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
    dogum: store.onboarding.dogum || ""
  });
  const [principlesOpen, setPrinciplesOpen] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<number | null>(null);
  const [accepted, setAccepted] = useState(false);
  const allFilled = Object.values(form).every(v => v.trim().length > 0);
  const canContinue = allFilled && accepted;
  return <Box style={{
    flex: 1
  }}>
      <Scroll style={[[ui.flex, ui.flexCol, ui.flex1, ui.bg06060e, ui.pt14, ui.pb40, ui.px5]]}>
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
              Birkaç bilgi, sana daha iyi bir deneyim sunmamızı sağlar.
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
            <GlassInput label="Doğum Tarihi" value={form.dogum} onChangeText={e => setForm(p => ({
            ...p,
            dogum: e
          }))} mode="date" />
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
        <Touch onPress={() => {
        setStore(p => ({
          ...p,
          onboarding: form,
          user: {
            ...p.user,
            name: form.ad + " " + form.soyad
          }
        }));
        navigate("onboarding-2");
      }} disabled={!canContinue} style={[[ui.wFull, ui.py4, ui.rounded2xl, ui.fontSemibold, ui.textBase, ui.trackingWide], {
        color: canContinue ? "#1a1200" : "rgba(255,255,255,0.25)"
      }]} gradient={canContinue ? ["#c8a44a", "#dab96e", "#c09038"] : ["rgba(255,255,255,0.08)", "rgba(255,255,255,0.08)"]}>
          Devam Et
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
  const [method, setMethod] = useState<"instagram" | "code" | "reference" | null>(null);
  const [instagram, setInstagram] = useState("");
  const [code, setCode] = useState("");
  const [codeValid, setCodeValid] = useState<boolean | null>(null);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [referenceState, setReferenceState] = useState<"idle" | "sent" | "waiting" | "approved">("idle");
  const [selectedContact, setSelectedContact] = useState<number | null>(null);
  const validateCode = () => setCodeValid(code.toUpperCase() === "EVENT2026");
  const sendReference = (i: number) => {
    setSelectedContact(i);
    setReferenceState("sent");
    setTimeout(() => setReferenceState("waiting"), 1200);
    setTimeout(() => setReferenceState("approved"), 3000);
    setContactsOpen(false);
  };
  return <Box style={{
    flex: 1
  }}>
      <Scroll style={[[ui.flex, ui.flexCol, ui.flex1, ui.bg06060e, ui.pt14, ui.pb40, ui.px5]]}>
        <AtmoBackground />

        <Box style={[[ui.relative, ui.spaceY8]]}>
          <Box style={[[ui.gapY1]]} enter>
            <Box style={[[ui.flex, ui.itemsCenter, ui.justifyBetween, ui.mb4]]}>
              <ProgressStepper current={1} total={3} />
              <Label style={[[ui.textXs, ui.textWhite30]]}>Adım 2/3</Label>
            </Box>
            <Touch onPress={() => navigate("onboarding-1")} style={[[ui.textXs, ui.textWhite30, ui.mb2, ui.flex, ui.itemsCenter, ui.gap1]]}>
              ← Geri
            </Touch>
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
                  <GlassInput placeholder="@kullaniciadi" value={instagram} onChangeText={e => setInstagram(e)} />
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

              <Box style={[[ui.mt3]]}>
                {referenceState === "idle" && <Touch onPress={() => setContactsOpen(true)} style={[[ui.wFull, ui.py25, ui.roundedXl, ui.textSm, ui.fontMedium, ui.textWhite60], {
                backgroundColor: "rgba(255,255,255,0.05)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.09)"
              }]}>
                    Üye Seç
                  </Touch>}
                {referenceState === "sent" && <Box style={[[ui.flex, ui.itemsCenter, ui.gap2, ui.textAmber400, ui.py1]]} enter>
                    <Label style={[[ui.textSm]]}>İstek gönderildi...</Label>
                  </Box>}
                {referenceState === "waiting" && <Box style={[[ui.flex, ui.itemsCenter, ui.gap25, ui.py1]]} enter>
                    <Avatar uri={CONTACT_MEMBERS[selectedContact!].avatar} name={CONTACT_MEMBERS[selectedContact!].name} size="xs" />
                    <Label style={[[ui.textSm, ui.textAmber30080]]}>
                      {CONTACT_MEMBERS[selectedContact!].name} onay bekliyor
                    </Label>
                  </Box>}
                {referenceState === "approved" && <Box style={[[ui.flex, ui.itemsCenter, ui.gap25, ui.py1]]} enter>
                    <Avatar uri={CONTACT_MEMBERS[selectedContact!].avatar} name={CONTACT_MEMBERS[selectedContact!].name} size="xs" />
                    <Box style={[[ui.flex, ui.itemsCenter, ui.gap15, ui.textEmerald400]]}>
                      <CheckIcon size={14} strokeWidth={2} />
                      <Label style={[[ui.textSm, ui.fontMedium]]}>
                        {CONTACT_MEMBERS[selectedContact!].name} onayladı
                      </Label>
                    </Box>
                  </Box>}

                {contactsOpen && <Box style={[[ui.mt3, ui.spaceY2]]} enter>
                    <Label style={[[ui.textXs, ui.textWhite35, ui.mb2]]}>
                      Event App üyeleri
                    </Label>
                    {CONTACT_MEMBERS.map((user, i) => <Touch key={user.id} onPress={() => sendReference(i)} style={[[ui.wFull, ui.flex, ui.itemsCenter, ui.gap3, ui.p25, ui.roundedXl, ui.textLeft], {
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.07)"
                }]}>
                        <Avatar uri={user.avatar} name={user.name} size="sm" />
                        <Box>
                          <Label style={[[ui.textSm, ui.textWhite80, ui.fontMedium]]}>
                            {user.name}
                          </Label>
                          <Label style={[[ui.textXs, ui.textWhite40]]}>
                            {user.interests.slice(0, 2).join(" · ")}
                          </Label>
                        </Box>
                      </Touch>)}
                  </Box>}
              </Box>
            </GlassCard>
          </Box>
        </Box>
      </Scroll>
      <StickyBar>
        <Touch onPress={() => navigate("onboarding-3")} style={[[ui.wFull, ui.py4, ui.rounded2xl, ui.fontSemibold, ui.textBase, ui.trackingWide], {
        color: "#1a1200"
      }]} gradient={["#c8a44a", "#dab96e", "#c09038"]}>
          Başvuruyu Gönder
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
  const [stage, setStage] = useState<"waiting" | "simulating">("waiting");
  const handleSimulate = () => {
    setStage("simulating");
    setTimeout(() => navigate("approval"), 1200);
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
  return <Scroll style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.flex, ui.flexCol, ui.itemsCenter, ui.justifyCenter, ui.px6]]}>
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
          <Label style={[[ui.fontDisplay, ui.text4xl, ui.fontLight, ui.textWhite]]}>
            Başvurunu{"\n"}inceliyoruz.
          </Label>
          <Label style={[[ui.textSm, ui.textWhite50, ui.leadingRelaxed, ui.maxWXs, ui.mxAuto]]}>
            Topluluğun güvenli kalması bizim için çok önemli. Bu yüzden her
            başvuruyu dikkatle değerlendiriyoruz.
          </Label>
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
    </Scroll>;
}
export default function OnboardingScreen({
  step,
  navigate
}: Props) {
  if (step === 1) return <Step1 navigate={navigate} />;
  if (step === 2) return <Step2 navigate={navigate} />;
  return <Step3 navigate={navigate} />;
}
