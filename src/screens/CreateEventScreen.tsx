import { useState } from "react";
import { AtmoBackground, GlassCard, GlassInput, GlassTextarea } from "../components/GlassUI";
import { ArrowLeftIcon, CameraIcon, GlobeIcon, ImageIcon, LockIcon, SearchIcon, UserPlusIcon } from "../components/Icons";
import { selectPhoto } from "../native/media";
import { useStore } from "../native/Store";
import { Box, Field, Label, Picture, Scroll, Touch } from "../native/UI";
import { ui } from "../theme/styles";
import { NavigateFn } from "../types";
function StickyBar({
  children
}: {
  children: React.ReactNode;
}) {
  return <Box style={[[ui.fixed, ui.bottom0, ui.left0, ui.right0, ui.px5, ui.pb8, ui.pt4, ui.z40], {}]} gradient={["#06060e", "transparent"]} gradientDirection="up">
      {children}
    </Box>;
}
function GoldBtn({
  onPress,
  disabled,
  children
}: {
  onPress?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return <Touch onPress={onPress} disabled={disabled} style={[[ui.wFull, ui.py4, ui.rounded2xl, ui.fontSemibold, ui.textBase, ui.trackingWide], {
    color: "#1a1200"
  }]} gradient={["#c8a44a", "#dab96e", "#c09038"]}>
      {children}
    </Touch>;
}
interface Props {
  navigate: NavigateFn;
}
const ACTIVITIES = [{
  icon: "🎾",
  label: "Padel"
}, {
  icon: "🎾",
  label: "Tenis"
}, {
  icon: "🏃",
  label: "Koşu"
}, {
  icon: "☕",
  label: "Kahve"
}, {
  icon: "🥾",
  label: "Hiking"
}, {
  icon: "🎵",
  label: "Konser"
}, {
  icon: "📷",
  label: "Fotoğrafçılık"
}, {
  icon: "✦",
  label: "Özel Etkinlik"
}];
const LEVELS = ["Başlangıç", "Orta", "İleri", "Tüm Seviyeler"];
const DURATIONS = ["30 dk", "1 saat", "1.5 saat", "2 saat", "3+ saat"];
const PRIVACY_ICONS = [GlobeIcon, LockIcon, UserPlusIcon];
const PRIVACIES = [{
  label: "Herkese Açık",
  desc: "Tüm üyeler görebilir"
}, {
  label: "Sadece Davetliler",
  desc: "Davet ettiğin kişiler"
}, {
  label: "Bağlantılarıma Öner",
  desc: "Bağlantıların görebilir"
}];
const REQUIREMENTS_SUGGESTIONS: {
  [key: string]: string[];
} = {
  Padel: ["Raketini yanında getir.", "Raket tesisten kiralanabilir.", "Sadece spor ayakkabını alıp gel."],
  Tenis: ["Raket gerekli.", "Tenis ayakkabısı zorunlu.", "Top temin edeceğim."],
  Koşu: ["Koşu ayakkabısı gerekli.", "Su şişesi getir."],
  Kahve: ["Merak yeter!", "Ödeme kişiye ayrı."],
  Hiking: ["Trek ayakkabısı gerekli.", "Minimum 1L su getir.", "Atıştırmalık al."],
  default: ["Rahat kıyafet yeterli."]
};
export default function CreateEventScreen({
  navigate
}: Props) {
  const {
    data: store,
    setData: setStore
  } = useStore();
  const EVENTS = store.events;
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    coverImage: "",
    activity: "",
    level: "",
    date: "",
    time: "",
    duration: "",
    location: "",
    minParticipants: 4,
    maxParticipants: 8,
    description: "",
    requirements: [] as string[],
    privacy: ""
  });
  const next = () => setStep(s => s + 1);
  const back = () => {
    if (step > 0) setStep(s => s - 1);else navigate("discover");
  };
  const selectAndNext = (key: string, value: string) => {
    setData(prev => ({
      ...prev,
      [key]: value
    }));
    setTimeout(next, 180);
  };
  const progressPct = step / 9 * 100;
  const suggestions = REQUIREMENTS_SUGGESTIONS[data.activity] || REQUIREMENTS_SUGGESTIONS.default;
  if (step === 9) {
    // Preview
    return <Scroll style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.flex, ui.flexCol, ui.pb20]]}>
        <AtmoBackground variant="gold" />
        <Box style={[[ui.relative, ui.pt14, ui.px5]]}>
          <Box style={[[ui.flex, ui.itemsCenter, ui.gap3, ui.mb6]]}>
            <Touch onPress={back} style={[[ui.textWhite40, ui.textSm]]}>
              ← Düzenle
            </Touch>
          </Box>
          <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite, ui.mb6]]}>
            Önizleme
          </Label>

          <GlassCard style={[[ui.overflowHidden, ui.mb4]]}>
            <Box style={[[ui.h48, ui.relative], {}]} gradient={["rgba(200,164,74,0.2)", "rgba(124,112,240,0.15)"]}>
              <Box style={[[ui.fixed, ui.inset0, ui.flex, ui.itemsCenter, ui.justifyCenter]]}>
                <Label style={[[ui.text7xl, ui.opacity30]]}>
                  {ACTIVITIES.find(a => a.label === data.activity)?.icon || "✦"}
                </Label>
              </Box>
              <Box style={[[ui.fixed, ui.bottom3, ui.left4]]}>
                <Label style={[[ui.textXs, ui.textWhite60]]}>
                  {data.activity}
                </Label>
              </Box>
            </Box>
            <Box style={[[ui.p4, ui.spaceY3]]}>
              <Label style={[[ui.fontDisplay, ui.textXl, ui.fontLight, ui.textWhite]]}>
                {data.activity || "Etkinlik Adı"}
              </Label>
              <Box style={[[ui.grid, ui.gap2, ui.textXs, ui.textWhite50]]} columns={2}>
                <Label>
                  ◷ {data.date || "Tarih"} · {data.time || "Saat"}
                </Label>
                <Label>⌛ {data.duration || "Süre"}</Label>
                <Label>◎ {data.location || "Konum"}</Label>
                <Label>◈ {data.level || "Seviye"}</Label>
                <Label>
                  👥 {data.minParticipants}-{data.maxParticipants} kişi
                </Label>
                <Label>🌍 {data.privacy || "Gizlilik"}</Label>
              </Box>
              {data.description && <Label style={[[ui.textSm, ui.textWhite55]]}>
                  {data.description}
                </Label>}
            </Box>
          </GlassCard>

          <Touch onPress={() => {
          const id = "event-" + Date.now();
          setStore(p => ({
            ...p,
            events: [{
              id,
              title: data.activity,
              category: data.activity,
              categoryEmoji: ACTIVITIES.find(a => a.label === data.activity)?.icon || "✦",
              date: data.date,
              time: data.time,
              location: data.location,
              distance: "0 km",
              level: data.level,
              currentParticipants: 1,
              minParticipants: data.minParticipants,
              maxParticipants: data.maxParticipants,
              host: p.user,
              participants: [p.user],
              coverImage: data.coverImage || EVENTS[0].coverImage,
              description: data.description,
              requirements: data.requirements,
              duration: data.duration,
              privacy: data.privacy,
              isActive: data.minParticipants <= 1,
              isSaved: false
            }, ...p.events]
          }));
          navigate("event-detail", {
            eventId: id
          });
        }} style={[[ui.wFull, ui.py4, ui.rounded2xl, ui.fontSemibold, ui.textBase, ui.mb4], {
          color: "#1a1200"
        }]} gradient={["#c8a44a", "#c09038"]}>
            Etkinliği Oluştur 🚀
          </Touch>
        </Box>
      </Scroll>;
  }
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.flex, ui.flexCol, ui.overflowHidden]]}>
      <AtmoBackground />

      {/* Progress bar */}
      <Box style={[[ui.fixed, ui.top0, ui.left0, ui.right0, ui.h05, ui.bgWhite8]]}>
        <Box style={[[ui.hFull], {
        width: `${progressPct}%`
      }]} gradient={["#c8a44a", "#dab96e"]} gradientDirection="right" />
      </Box>

      <Scroll style={[[ui.relative, ui.flex, ui.flexCol, ui.hFull, ui.pb28]]}>
        <Box style={[[ui.pt14, ui.px5]]}>
          <Box style={[[ui.flex, ui.itemsCenter, ui.gap3, ui.mb8]]}>
            <Touch onPress={back} style={[[ui.w8, ui.h8, ui.glass, ui.roundedXl, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.textWhite50]]} glass>
              <ArrowLeftIcon size={16} strokeWidth={1.5} />
            </Touch>
            <Label style={[[ui.textXs, ui.textWhite30]]}>{step + 1}/10</Label>
          </Box>

          {/* Step 0 - Activity */}
          {step === 0 && <Box style={[[]]} enter>
              <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite, ui.mb2]]}>
                Ne yapmak{"\n"}istiyorsun?
              </Label>
              <Label style={[[ui.textSm, ui.textWhite40, ui.mb6]]}>
                Seninle birlikte ne yapacağımızı anlat.
              </Label>
              <Box style={[[ui.grid, ui.gap3]]} columns={2}>
                {ACTIVITIES.map(a => <Touch key={a.label} onPress={() => selectAndNext("activity", a.label)} style={[[ui.p4, ui.rounded2xl, ui.textLeft, ui.border, data.activity === a.label ? [ui.borderC8a44a50, ui.bgC8a44a10] : [ui.borderWhite8, ui.bgWhite004]]]}>
                    <Label style={[[ui.text3xl, ui.mb2]]}>{a.icon}</Label>
                    <Label style={[[ui.textSm, ui.textWhite75, ui.fontMedium]]}>
                      {a.label}
                    </Label>
                  </Touch>)}
              </Box>
            </Box>}

          {/* Step 1 - Level */}
          {step === 1 && <Box style={[[]]} enter>
              <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite, ui.mb2]]}>
                Hangi seviyede{"\n"}oynamak istersin?
              </Label>
              <Label style={[[ui.textSm, ui.textWhite40, ui.mb6]]}>
                Sana uygun kişileri bulalım.
              </Label>
              <Box style={[[ui.spaceY3]]}>
                {LEVELS.map(level => <Touch key={level} onPress={() => selectAndNext("level", level)} style={[[ui.wFull, ui.p4, ui.rounded2xl, ui.textLeft, ui.flex, ui.itemsCenter, ui.justifyBetween, ui.border, data.level === level ? [ui.borderC8a44a50, ui.bgC8a44a10] : [ui.borderWhite8, ui.bgWhite004]]]}>
                    <Label style={[[ui.textBase, ui.textWhite80, ui.fontMedium]]}>
                      {level}
                    </Label>
                    {data.level === level && <Label style={[[ui.textC8a44a]]}>✓</Label>}
                  </Touch>)}
              </Box>
            </Box>}

          {/* Step 2 - Date & Time */}
          {step === 2 && <Box style={[[ui.spaceY5]]} enter>
              <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite, ui.mb2]]}>
                Ne zaman{"\n"}buluşuyorsunuz?
              </Label>
              <GlassInput label="Tarih" value={data.date} onChangeText={e => setData(p => ({
            ...p,
            date: e
          }))} mode="date" />
              <GlassInput label="Saat" value={data.time} onChangeText={e => setData(p => ({
            ...p,
            time: e
          }))} mode="time" />
              <Box style={[[ui.h4]]} />
            </Box>}

          {/* Step 3 - Duration */}
          {step === 3 && <Box style={[[]]} enter>
              <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite, ui.mb2]]}>
                Ne kadar{"\n"}vaktiniz var?
              </Label>
              <Label style={[[ui.textSm, ui.textWhite40, ui.mb6]]}>
                Tahminen ne kadar sürer?
              </Label>
              <Box style={[[ui.grid, ui.gap3]]} columns={3}>
                {DURATIONS.map(d => <Touch key={d} onPress={() => selectAndNext("duration", d)} style={[[ui.p4, ui.rounded2xl, ui.textCenter, ui.border, data.duration === d ? [ui.borderC8a44a50, ui.bgC8a44a10, ui.textC8a44a] : [ui.borderWhite8, ui.bgWhite004, ui.textWhite70]]]}>
                    <Label style={[[ui.textSm, ui.fontMedium]]}>{d}</Label>
                  </Touch>)}
              </Box>
            </Box>}

          {/* Step 4 - Location */}
          {step === 4 && <Box style={[[ui.spaceY5]]} enter>
              <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite, ui.mb2]]}>
                Nerede{"\n"}buluşacaksınız?
              </Label>
              <Box style={[[ui.relative]]}>
                <SearchIcon size={15} strokeWidth={1.5} style={[[ui.fixed, ui.left35, ui.top12, ui.TranslateY12, ui.textWhite25, ui.z10]]} />
                <Field placeholder="Adres veya mekan adı..." value={data.location} onChangeText={e => setData(p => ({
              ...p,
              location: e
            }))} style={[[ui.glass, ui.wFull, ui.roundedXl, ui.pl9, ui.pr4, ui.py35, ui.textWhite, ui.textSm]]} glass />
              </Box>

              <Box style={[[ui.spaceY2]]}>
                {["Çankaya Padel Merkezi", "Ulus Meydanı", "Oran Spor Kompleksi", "Çayyolu Venue"].map(loc => <Touch key={loc} onPress={() => {
              setData(p => ({
                ...p,
                location: loc
              }));
            }} style={[[ui.wFull, ui.flex, ui.itemsCenter, ui.gap3, ui.p3, ui.roundedXl, ui.textLeft, ui.border, ui.borderWhite6, ui.bgWhite003]]}>
                    <Label style={[[ui.textWhite40]]}>◎</Label>
                    <Label style={[[ui.textSm, ui.textWhite65]]}>{loc}</Label>
                  </Touch>)}
              </Box>

              {/* Map placeholder */}
              <Box style={[[ui.h40, ui.rounded2xl, ui.flex, ui.itemsCenter, ui.justifyCenter], {
            backgroundColor: "rgba(255,255,255,0.04)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.10)"
          }]}>
                <Box style={[[ui.textCenter, ui.flex, ui.flexCol, ui.itemsCenter, ui.gap2]]}>
                  <ImageIcon size={24} strokeWidth={1.2} style={[[ui.textWhite15]]} />
                  <Label style={[[ui.textXs, ui.textWhite25]]}>
                    Haritadan seç
                  </Label>
                </Box>
              </Box>

              <Box style={[[ui.h4]]} />
            </Box>}

          {/* Step 5 - Participants */}
          {step === 5 && <Box style={[[ui.spaceY6]]} enter>
              <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite, ui.mb2]]}>
                Kaç kişilik{"\n"}bir buluşma?
              </Label>
              <Label style={[[ui.textSm, ui.textWhite40]]}>
                Minimum dolunca etkinliğin hayata geçer.
              </Label>

              {[{
            label: "Minimum",
            key: "minParticipants",
            value: data.minParticipants
          }, {
            label: "Maksimum",
            key: "maxParticipants",
            value: data.maxParticipants
          }].map(({
            label,
            key,
            value
          }) => <Box key={key} style={[[ui.glass, ui.rounded2xl, ui.p5]]} glass>
                  <Box style={[[ui.flex, ui.itemsCenter, ui.justifyBetween, ui.mb3]]}>
                    <Label style={[[ui.textSm, ui.textWhite60]]}>{label}</Label>
                    <Label style={[[ui.fontDisplay, ui.text2xl, ui.fontLight, ui.textWhite]]}>
                      {value} kişi
                    </Label>
                  </Box>
                  <Box style={[[ui.flex, ui.itemsCenter, ui.gap3]]}>
                    <Touch onPress={() => setData(p => ({
                ...p,
                [key]: key === "minParticipants" ? Math.max(2, p.minParticipants - 1) : Math.max(p.minParticipants, p.maxParticipants - 1)
              }))} style={[[ui.w10, ui.h10, ui.roundedXl, ui.glassStrong, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.textWhite70, ui.textXl, ui.fontLight]]} glass>
                      −
                    </Touch>
                    <Box style={[[ui.flex1, ui.h15, ui.roundedFull, ui.bgWhite10, ui.overflowHidden]]}>
                      <Box style={[[ui.hFull, ui.bgC8a44a, ui.roundedFull], {
                  width: `${value / 50 * 100}%`
                }]} />
                    </Box>
                    <Touch onPress={() => setData(p => ({
                ...p,
                [key]: key === "minParticipants" ? Math.min(p.maxParticipants, p.minParticipants + 1) : Math.min(50, p.maxParticipants + 1)
              }))} style={[[ui.w10, ui.h10, ui.roundedXl, ui.glassStrong, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.textWhite70, ui.textXl, ui.fontLight]]} glass>
                      +
                    </Touch>
                  </Box>
                </Box>)}

              <Box style={[[ui.h4]]} />
            </Box>}

          {/* Step 6 - Cover */}
          {step === 6 && <Box style={[[ui.spaceY5]]} enter>
              <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite, ui.mb2]]}>
                Etkinliğine{"\n"}bir yüz ver.
              </Label>
              <Label style={[[ui.textSm, ui.textWhite40]]}>
                İstersen atla, sana uygun bir görsel seçeriz.
              </Label>

              <Touch style={[[ui.h52, ui.rounded2xl, ui.flex, ui.flexCol, ui.itemsCenter, ui.justifyCenter, ui.gap3], {
            backgroundColor: "rgba(255,255,255,0.04)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)"
          }]} onPress={async () => {
            const uri = await selectPhoto();
            if (uri) setData(p => ({
              ...p,
              coverImage: uri
            }));
          }}>
                {data.coverImage && <Picture uri={data.coverImage} style={{
              width: "100%",
              height: 130,
              borderRadius: 16
            }} />}
                <CameraIcon size={28} strokeWidth={1.2} style={[[ui.textWhite20]]} />
                <Label style={[[ui.textSm, ui.textWhite35]]}>
                  Fotoğraf yükle
                </Label>
              </Touch>

              <Box style={[[ui.grid, ui.gap2]]} columns={3}>
                {["https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=200&h=120&fit=crop", "https://images.unsplash.com/photo-1551632811-561732d1e306?w=200&h=120&fit=crop", "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=120&fit=crop"].map((src, i) => <Touch key={i} style={[[ui.h20, ui.roundedXl, ui.overflowHidden]]} onPress={() => setData(p => ({
              ...p,
              coverImage: src
            }))}>
                    <Picture uri={src} accessibilityLabel="" style={[[ui.wFull, ui.hFull, ui.opacity60]]} />
                  </Touch>)}
              </Box>

              <Box style={[[ui.h4]]} />
            </Box>}

          {/* Step 7 - Requirements */}
          {step === 7 && <Box style={[[ui.spaceY5]]} enter>
              <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite, ui.mb2]]}>
                Katılımcılara{"\n"}ne söylemek istersin?
              </Label>
              <Label style={[[ui.textSm, ui.textWhite40]]}>
                Gereksinim varsa yaz, yoksa geçebilirsin.
              </Label>

              <GlassTextarea placeholder="Katılımcılara ne söylemek istersin?" value={data.description} onChangeText={e => setData(p => ({
            ...p,
            description: e
          }))} />

              <Box>
                <Label style={[[ui.textXs, ui.textWhite35, ui.mb2, ui.uppercase, ui.trackingWider]]}>
                  Hızlı ekle
                </Label>
                <Box style={[[ui.flex, ui.flexWrap, ui.gap2]]}>
                  {suggestions.map(s => <Touch key={s} onPress={() => {
                if (!data.requirements.includes(s)) {
                  setData(p => ({
                    ...p,
                    requirements: [...p.requirements, s]
                  }));
                }
              }} style={[[ui.px3, ui.py15, ui.roundedXl, ui.textXs, ui.border, data.requirements.includes(s) ? [ui.borderC8a44a50, ui.bgC8a44a10, ui.textC8a44a] : [ui.borderWhite10, ui.bgWhite004, ui.textWhite55]]]}>
                      {s}
                    </Touch>)}
                </Box>
              </Box>

              <Box style={[[ui.h4]]} />
            </Box>}

          {/* Step 8 - Privacy */}
          {step === 8 && <Box style={[[]]} enter>
              <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite, ui.mb2]]}>
                Bu etkinlik{"\n"}kime açık?
              </Label>
              <Label style={[[ui.textSm, ui.textWhite40, ui.mb6]]}>
                Kapıyı ne kadar aralık bırakmak istersin?
              </Label>
              <Box style={[[ui.spaceY3]]}>
                {PRIVACIES.map((p, i) => {
              const Icon = PRIVACY_ICONS[i];
              return <Touch key={p.label} onPress={() => selectAndNext("privacy", p.label)} style={[[ui.wFull, ui.p4, ui.rounded2xl, ui.textLeft, ui.flex, ui.itemsCenter, ui.gap4, ui.border, data.privacy === p.label ? [ui.borderC8a44a50, ui.bgC8a44a10] : [ui.borderWhite8, ui.bgWhite004]]]}>
                      <Box style={[[ui.w10, ui.h10, ui.roundedXl, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.flexShrink0, data.privacy === p.label ? [ui.textC8a44a] : [ui.textWhite35]], {
                  backgroundColor: data.privacy === p.label ? "rgba(200,164,74,0.10)" : "rgba(255,255,255,0.05)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.07)"
                }]}>
                        <Icon size={18} strokeWidth={1.4} />
                      </Box>
                      <Box>
                        <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite85]]}>
                          {p.label}
                        </Label>
                        <Label style={[[ui.textXs, ui.textWhite40]]}>
                          {p.desc}
                        </Label>
                      </Box>
                    </Touch>;
            })}
              </Box>
            </Box>}
        </Box>
      </Scroll>

      {/* Sticky CTA for steps that need explicit continue */}
      {(step === 2 || step === 4 || step === 5 || step === 6 || step === 7) && <StickyBar>
          <GoldBtn onPress={next} disabled={step === 2 && (!data.date || !data.time) || step === 4 && !data.location}>
            Devam Et
          </GoldBtn>
        </StickyBar>}
    </Box>;
}
