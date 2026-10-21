import { palette } from "../theme/palette";
import { LockIcon } from "../components/Icons";
import { BrandWordmark } from "../components/Brand";
import { useSignedOutEntry } from "../native/session";
import { AtmoBackground } from "../components/GlassUI";
import { Box, Label, Picture, Touch } from "../native/UI";
import { ui } from "../theme/styles";
import { NavigateFn } from "../types";
import EditorialQuote from "../components/EditorialQuote";
import { useSafeAreaInsets } from "react-native-safe-area-context";
interface Props {
  navigate: NavigateFn;
}
export default function WelcomeScreen({
  navigate
}: Props) {
  const checkingSession = useSignedOutEntry(navigate);
  // Android draws edge to edge: the bottom block keeps clear of the system navigation bar.
  const safeBottom = useSafeAreaInsets().bottom;
  if (checkingSession) return null;
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.flex, ui.flexCol, ui.overflowHidden]]}>
      <AtmoBackground variant="violet" />

      {/* Premium animated background */}
      <Box style={[[ui.fixed, ui.inset0, ui.overflowHidden]]}>
        {/* Thin light ray */}
        <Box style={[[ui.fixed, ui.top0, ui.left35_0], {
        width: 1,
        height: "60%",
        transform: [{
          rotate: "15deg"
        }, {
          translateX: "-50%"
        }]
      }]} gradient={["transparent", "rgba(105,120,255,0.12)", "transparent"]} enter gradientDirection="down" />
        <Box style={[[ui.fixed, ui.top0, ui.right28], {
        width: 1,
        height: "45%",
        transform: [{
          rotate: "-8deg"
        }]
      }]} gradient={["transparent", "rgba(146,125,255,0.10)", "transparent"]} enter gradientDirection="down" />

        {/* Floating micro-dots */}
        {[{
        left: "15%",
        top: "25%",
        delay: "0s",
        color: "rgba(105,120,255,0.4)"
      }, {
        left: "78%",
        top: "18%",
        delay: "1.2s",
        color: "rgba(255,255,255,0.2)"
      }, {
        left: "55%",
        top: "42%",
        delay: "2.5s",
        color: "rgba(146,125,255,0.3)"
      }, {
        left: "22%",
        top: "65%",
        delay: "0.8s",
        color: "rgba(105,120,255,0.25)"
      }, {
        left: "85%",
        top: "55%",
        delay: "3.1s",
        color: "rgba(255,255,255,0.15)"
      }].map((dot, i) => <Box key={i} style={[[ui.fixed, ui.roundedFull], {
        left: dot.left as `${number}%`,
        top: dot.top as `${number}%`,
        width: 3,
        height: 3,
        backgroundColor: dot.color
      }]} enter />)}
      </Box>

      {/* Bottom fade */}
      <Box style={[[ui.fixed, ui.inset0], {}]} gradient={["rgba(8,11,24,0.12)", "transparent", "rgba(8,11,24,0.72)", "rgba(8,11,24,0.98)"]} gradientDirection="down" />

      {/* Upper part: the brand, headline and quote sit centred in the free space, over the glass shapes. */}
      <Box style={[[ui.relative, ui.flex1, ui.flexCol, ui.justifyCenter, ui.px8], { paddingTop: 56 }]}>
        <Box style={[[ui.relative]]}>
          {/* Glass floating shapes */}
          <Box style={[[ui.fixed, ui.Top8, ui.Right12, ui.w28, ui.h28, ui.rounded2xl, ui.rotate12, ui.opacity40], {
          backgroundColor: "rgba(105,120,255,0.08)",
          borderWidth: 1,
          borderColor: "rgba(105,120,255,0.15)"
      }]} glass />
          <Box style={[[ui.fixed, ui.Bottom4, ui.Left8, ui.w20, ui.h20, ui.roundedFull, ui.opacity30], {
          backgroundColor: "rgba(146,125,255,0.10)",
          borderWidth: 1,
          borderColor: "rgba(146,125,255,0.15)"
      }]} glass />
          <Box style={[[ui.spaceY4]]} enter>
            <BrandWordmark />
            <Box style={{ position: "relative", zIndex: 5 }}>
              <Label adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={[[ui.fontDisplay, ui.text5xl, ui.textWhite], { fontStyle: "italic", lineHeight: 52, textShadowColor: "rgba(0,0,0,.45)", textShadowRadius: 12 }]}>Meet real</Label>
              <Label adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={[[ui.fontDisplay, ui.text5xl], { color: "#c7ceff", fontStyle: "italic", lineHeight: 52, textShadowColor: "rgba(0,0,0,.5)", textShadowRadius: 12 }]}>moments.</Label>
            </Box>
            <EditorialQuote>Gerçek bağlantılar, ortak deneyimler ve güven üzerine kurulmuş özel bir topluluk.</EditorialQuote>
          </Box>
        </Box>
      </Box>

      {/* Lower part: the actions and the footnote, clear of Android's system navigation bar. */}
      <Box style={[[ui.relative, ui.px8, ui.spaceY8], { paddingBottom: 48 + safeBottom }]}>
        <Box style={[[ui.spaceY3]]} enter>
          <Touch onPress={() => navigate("onboarding-1")} style={[[ui.wFull, ui.py4, ui.rounded2xl, ui.textBase, ui.fontSemibold, ui.trackingWide], {
          color: palette.text
        }]} gradient={palette.actionGradient}>
            Üyelik Başvurusu Yap
          </Touch>

          {/* One quiet line for members: the application stays the main action. */}
          <Touch accessibilityLabel="Giriş Yap" onPress={() => navigate("login")} style={[[ui.wFull, ui.flex, ui.itemsCenter, ui.justifyCenter], { minHeight: 44 }]}>
            <Label numberOfLines={1} style={[[ui.textSm, ui.textWhite50]]}>
              Zaten üye misin?{" "}
              <Label style={[[ui.textSm, ui.fontSemibold], { color: palette.accent }]}>Giriş yap</Label>
            </Label>
          </Touch>
        </Box>

        {/* Footnote: small, faint and centred under the actions. */}
        <Box accessible accessibilityLabel="Referansla başlayan özel bir topluluk." style={[[ui.flex, ui.itemsCenter, ui.justifyCenter], { gap: 5, marginTop: -12 }]}>
          <LockIcon size={10} style={{ color: "rgba(226,232,240,.32)" }} />
          <Label style={{ fontSize: 11, lineHeight: 14, letterSpacing: 0.3, color: "rgba(226,232,240,.38)" }}>Referansla başlayan özel bir topluluk.</Label>
        </Box>
      </Box>
    </Box>;
}
