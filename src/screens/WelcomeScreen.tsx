import { AtmoBackground } from "../components/GlassUI";
import { Box, Label, Picture, Touch } from "../native/UI";
import { ui } from "../theme/styles";
import { NavigateFn } from "../types";
interface Props {
  navigate: NavigateFn;
}
export default function WelcomeScreen({
  navigate
}: Props) {
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.flex, ui.flexCol, ui.overflowHidden]]}>
      <AtmoBackground variant="violet" />

      {/* Premium animated background */}
      <Box style={[[ui.fixed, ui.inset0, ui.overflowHidden]]}>
        {/* Slow drifting glass planes */}
        <Box style={[[ui.fixed], {
        top: "8%",
        left: "-10%",
        width: "70%",
        height: "40%",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.04)",
        borderRadius: 90,
        transform: [{
          rotate: "-12deg"
        }]
      }]} gradient={["rgba(124,112,240,0.06)", "rgba(200,164,74,0.03)"]} glass enter />
        <Box style={[[ui.fixed], {
        top: "30%",
        right: "-15%",
        width: "55%",
        height: "35%",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.03)",
        borderRadius: 90,
        transform: [{
          rotate: "8deg"
        }]
      }]} gradient={["rgba(200,164,74,0.05)", "rgba(124,112,240,0.04)"]} glass enter />
        <Box style={[[ui.fixed], {
        bottom: "20%",
        left: "5%",
        width: "45%",
        height: "28%",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.03)",
        borderRadius: 90,
        transform: [{
          rotate: "20deg"
        }]
      }]} gradient={["rgba(124,112,240,0.04)", "rgba(255,255,255,0.02)"]} enter />

        {/* Thin light ray */}
        <Box style={[[ui.fixed, ui.top0, ui.left35_0], {
        width: 1,
        height: "60%",
        transform: [{
          rotate: "15deg"
        }, {
          translateX: "-50%"
        }]
      }]} gradient={["transparent", "rgba(200,164,74,0.12)", "transparent"]} enter gradientDirection="down" />
        <Box style={[[ui.fixed, ui.top0, ui.right28], {
        width: 1,
        height: "45%",
        transform: [{
          rotate: "-8deg"
        }]
      }]} gradient={["transparent", "rgba(124,112,240,0.10)", "transparent"]} enter gradientDirection="down" />

        {/* Floating micro-dots */}
        {[{
        left: "15%",
        top: "25%",
        delay: "0s",
        color: "rgba(200,164,74,0.4)"
      }, {
        left: "78%",
        top: "18%",
        delay: "1.2s",
        color: "rgba(255,255,255,0.2)"
      }, {
        left: "55%",
        top: "42%",
        delay: "2.5s",
        color: "rgba(124,112,240,0.3)"
      }, {
        left: "22%",
        top: "65%",
        delay: "0.8s",
        color: "rgba(200,164,74,0.25)"
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
      <Box style={[[ui.fixed, ui.inset0], {}]} gradient={["rgba(6,6,14,0.2)", "transparent", "rgba(6,6,14,0.75)", "rgba(6,6,14,1)"]} gradientDirection="down" />

      {/* Top logo area */}
      <Box style={[[ui.relative, ui.pt16, ui.px8]]} enter>
        <Box style={[[ui.flex, ui.itemsCenter, ui.gap25]]}>
          <Box style={[[ui.w8, ui.h8, ui.roundedXl, ui.flex, ui.itemsCenter, ui.justifyCenter], {
          backgroundColor: "rgba(255,255,255,0.08)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.12)"
        }]}>
            <Label style={[[ui.fontDisplay, ui.textSm, ui.fontLight, ui.textWhite80]]}>
              E
            </Label>
          </Box>
          <Label style={[[ui.textSm, ui.tracking02em, ui.textWhite40, ui.uppercase, ui.fontLight]]}>
            Event App
          </Label>
        </Box>
      </Box>

      {/* Middle decorative element */}
      <Box style={[[ui.relative, ui.flex1, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.px8]]}>
        <Box style={[[ui.relative]]}>
          {/* Glass floating shapes */}
          <Box style={[[ui.fixed, ui.Top8, ui.Right12, ui.w28, ui.h28, ui.rounded2xl, ui.rotate12, ui.opacity40], {
          backgroundColor: "rgba(200,164,74,0.08)",
          borderWidth: 1,
          borderColor: "rgba(200,164,74,0.15)"
        }]} glass />
          <Box style={[[ui.fixed, ui.Bottom4, ui.Left8, ui.w20, ui.h20, ui.roundedFull, ui.opacity30], {
          backgroundColor: "rgba(124,112,240,0.10)",
          borderWidth: 1,
          borderColor: "rgba(124,112,240,0.15)"
        }]} glass />
        </Box>
      </Box>

      {/* Bottom content */}
      <Box style={[[ui.relative, ui.px8, ui.pb12, ui.spaceY8]]}>
        <Box style={[[ui.spaceY4]]} enter>
          <Label style={[[ui.fontDisplay, ui.text5xl, ui.fontLight, ui.textWhite]]}>
            Meet real{"\n"}
            <Label style={[[ui.notItalic], {
            color: "#c8a44a"
          }]}>
              moments.
            </Label>
          </Label>
          <Label style={[[ui.textBase, ui.textWhite50, ui.leadingRelaxed, ui.fontLight, ui.maxWXs]]}>
            Gerçek bağlantılar, ortak deneyimler ve güven üzerine kurulmuş özel
            bir topluluk.
          </Label>
        </Box>

        <Box style={[[ui.spaceY3]]} enter>
          <Touch onPress={() => navigate("onboarding-1")} style={[[ui.wFull, ui.py4, ui.rounded2xl, ui.textBase, ui.fontSemibold, ui.trackingWide], {
          color: "#1a1200"
        }]} gradient={["#c8a44a", "#dab96e", "#c09038"]}>
            Üyelik Başvurusu Yap
          </Touch>

          <Touch onPress={() => navigate("login")} style={[[ui.wFull, ui.py35, ui.textSm, ui.textWhite50, ui.fontLight]]}>
            Zaten üye misin?{" "}
            <Label style={[[ui.textWhite70, ui.underline]]}>Giriş Yap</Label>
          </Touch>
        </Box>

        {/* Social proof */}
        <Box style={[[ui.flex, ui.itemsCenter, ui.gap4]]} enter>
          <Box style={[[ui.flex]]}>
            {["https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop&auto=format", "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=60&h=60&fit=crop&auto=format", "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60&h=60&fit=crop&auto=format", "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=60&h=60&fit=crop&auto=format"].map((src, i) => <Picture key={i} uri={src} accessibilityLabel="" style={[[ui.w7, ui.h7, ui.roundedFull]]} />)}
          </Box>
          <Label style={[[ui.textXs, ui.textWhite35, ui.leadingTight]]}>
            <Label style={[[ui.textWhite55, ui.fontMedium]]}>240+</Label> üye
            {"\n"}
            Ankara'da aktif topluluk
          </Label>
        </Box>
      </Box>
    </Box>;
}
