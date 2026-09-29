import TopNavBar from "../components/TopNavBar";
import EditorialQuote from "../components/EditorialQuote";
import { useEffect, useState } from "react";
import { AtmoBackground, GlassCard } from "../components/GlassUI";
import { Box, Label, Touch } from "../native/UI";
import { ui } from "../theme/styles";
import { NavigateFn } from "../types";
interface Props {
  navigate: NavigateFn;
}
const STATS = [{
  value: "240+",
  label: "Etkinlik"
}, {
  value: "30+",
  label: "Kategori"
}, {
  value: "∞",
  label: "Bağlantı"
}];
export default function ApprovalScreen({
  navigate
}: Props) {
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    size: number;
    delay: number;
    color: string;
  }>>([]);
  useEffect(() => {
    const p = Array.from({
      length: 18
    }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: Math.random() * 6 + 3,
      delay: Math.random() * 2,
      color: Math.random() > 0.5 ? "rgba(200,164,74,0.7)" : "rgba(255,255,255,0.3)"
    }));
    setParticles(p);
  }, []);
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.flex, ui.flexCol, ui.itemsCenter, ui.justifyCenter, ui.px6, ui.overflowHidden]]}>
      <AtmoBackground variant="gold" />
      <TopNavBar navigate={navigate} fallback="onboarding-3" title="Başvuru Durumu" floating />

      {/* Particles */}
      {particles.map(p => <Box key={p.id} style={[[], {
      left: `${p.x}%`,
      bottom: "10%",
      width: p.size,
      height: p.size,
      backgroundColor: p.color
    }]} />)}

      <Box style={[[ui.relative, ui.wFull, ui.spaceY8]]}>
        {/* Success icon */}
        <Box style={[[ui.flex, ui.justifyCenter]]} enter>
          <Box style={[[ui.w28, ui.h28, ui.rounded3xl, ui.flex, ui.itemsCenter, ui.justifyCenter], {
          borderWidth: 1,
          borderColor: "rgba(200,164,74,0.3)"
        }]} gradient={["rgba(200,164,74,0.2)", "rgba(200,164,74,0.05)"]} glass>
            <Label style={[[ui.text5xl]]}>✦</Label>
          </Box>
        </Box>

        {/* Message */}
        <Box style={[[ui.textCenter, ui.spaceY3]]} enter>
          <Label style={[[ui.fontDisplay, ui.text4xl, ui.textWhite, ui.leadingTight], { fontStyle: "italic" }]}>
            Seni{"\n"}
            <Label style={{
            color: "#c8a44a"
          }}>
              bekliyorduk.
            </Label>
          </Label>
          <EditorialQuote>Seni aramıza aldık. Artık gerçek anlar yaşamanın, yeni insanlarla tanışmanın tam zamanı.</EditorialQuote>
        </Box>

        {/* Stats */}
        <Box style={[[ui.grid, ui.gap3]]} columns={3} enter>
          {STATS.map((s, i) => <GlassCard key={i} style={[[ui.p4, ui.textCenter]]}>
              <Label style={[[ui.fontDisplay, ui.text2xl, ui.fontLight], {
            color: "#c8a44a"
          }]}>
                {s.value}
              </Label>
              <Label style={[[ui.textXs, ui.textWhite40, ui.mt05]]}>
                {s.label}
              </Label>
            </GlassCard>)}
        </Box>

        {/* CTA */}
        <Touch onPress={() => navigate("interests")} style={[[ui.wFull, ui.py4, ui.rounded2xl, ui.textBase, ui.fontSemibold, ui.trackingWide], {
        color: "#1a1200"
      }]} gradient={["#c8a44a", "#dab96e", "#c09038"]} enter>
          Profilini Oluştur
        </Touch>
      </Box>
    </Box>;
}
