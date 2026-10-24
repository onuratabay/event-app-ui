import { palette } from "../theme/palette";
import { CheckIcon } from "../components/Icons";
import TopNavBar from "../components/TopNavBar";
import EditorialQuote from "../components/EditorialQuote";
import { AtmoBackground, GlassCard } from "../components/GlassUI";
import { Box, Label, Touch } from "../native/UI";
import { ui } from "../theme/styles";
import { NavigateFn } from "../types";
interface Props {
  navigate: NavigateFn;
}
const STATS = [{ value: "Güven", label: "Referansla başlayan" }, { value: "İlgi", label: "Ortak tutkular" }, { value: "Deneyim", label: "Gerçek bağlantılar" }];
export default function ApprovalScreen({
  navigate
}: Props) {
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.flex, ui.flexCol, ui.itemsCenter, ui.justifyCenter, ui.px6, ui.overflowHidden]]}>
      <AtmoBackground variant="gold" />
      <TopNavBar navigate={navigate} fallback="onboarding-3" title="Başvuru Durumu" floating />

      <Box style={[[ui.relative, ui.wFull, ui.spaceY8]]}>
        {/* Success icon */}
        <Box style={[[ui.flex, ui.justifyCenter]]} enter>
          <Box style={[[ui.w28, ui.h28, ui.rounded3xl, ui.flex, ui.itemsCenter, ui.justifyCenter], {
          borderWidth: 1,
          borderColor: "rgba(105,120,255,0.3)"
        }]} gradient={["rgba(105,120,255,0.2)", "rgba(105,120,255,0.05)"]} glass>
            <CheckIcon size={40} style={{ color: palette.accent }} />
          </Box>
        </Box>

        {/* Message */}
        <Box style={[[ui.textCenter, ui.spaceY3]]} enter>
          <Label style={[[ui.fontDisplay, ui.text4xl, ui.textWhite, ui.leadingTight], { fontStyle: "italic" }]}>
            Seni{"\n"}
            <Label style={{
            color: palette.accent
          }}>
              bekliyorduk.
            </Label>
          </Label>
          <EditorialQuote>Hoş geldin. Profilini tamamla, ilgi alanlarını paylaş ve yeni buluşmaları keşfet.</EditorialQuote>
        </Box>

        {/* Stats */}
        <Box style={[[ui.flex, ui.wFull, ui.gap2], { flexWrap: "nowrap" }]} enter>
          {STATS.map((s, i) => <GlassCard key={i} style={[[ui.flex1, ui.p3, ui.textCenter], { minWidth: 0 }]}>
              <Label style={[[ui.fontDisplay, ui.textBase, ui.fontLight], {
            color: palette.accent
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
        color: palette.text
      }]} gradient={palette.actionGradient} enter>
          Profilini Oluştur
        </Touch>
      </Box>
    </Box>;
}
