import { palette } from "../theme/palette";
import { LockIcon } from "../components/Icons";
import { BrandWordmark } from "../components/Brand";
import { useSignedOutEntry } from "../native/session";
import { AtmoBackground } from "../components/GlassUI";
import { Box, Label, Picture, Touch } from "../native/UI";
import { ui } from "../theme/styles";
import { NavigateFn } from "../types";
import EditorialQuote from "../components/EditorialQuote";
import { Animated } from "react-native";
import { useEffect, useRef } from "react";
interface Props {
  navigate: NavigateFn;
}
function MotionSquares() {
  const x = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let subscription: { remove: () => void } | undefined;
    let mounted = true;
    // Expo Go'da sensörü kullan; test/önizleme ortamında eksik native modül
    // olduğunda açılış ekranı yine statik arka planla çalışmaya devam eder.
    let motion: typeof import("expo-sensors").DeviceMotion | undefined;
    try { motion = require("expo-sensors").DeviceMotion; } catch { return; }
    if (!motion) return;
    const deviceMotion = motion;
    void deviceMotion.isAvailableAsync().then(available => {
      if (!available || !mounted) return;
      deviceMotion.setUpdateInterval(50);
      subscription = deviceMotion.addListener(({ rotation }) => {
        x.setValue(Math.max(-1, Math.min(1, (rotation?.gamma || 0) / 0.45)));
        y.setValue(Math.max(-1, Math.min(1, (rotation?.beta || 0) / 0.45)));
      });
    }).catch(() => {});
    return () => { mounted = false; subscription?.remove(); };
  }, [x, y]);
  const squares = [
    { size: 172, top: "13%", left: "-20%", depth: 26, color: "rgba(146,125,255,.16)", angle: "-16deg" },
    { size: 128, top: "27%", left: "62%", depth: -20, color: "rgba(185,195,255,.14)", angle: "14deg" },
    { size: 102, top: "48%", left: "9%", depth: 16, color: "rgba(248,250,252,.10)", angle: "22deg" },
    { size: 154, top: "57%", left: "66%", depth: -28, color: "rgba(146,125,255,.12)", angle: "-9deg" },
    { size: 78, top: "72%", left: "37%", depth: 12, color: "rgba(185,195,255,.13)", angle: "18deg" },
  ];
  return <Box pointerEvents="none" style={[[ui.fixed, ui.inset0, ui.overflowHidden]]}>
    {squares.map((square, index) => <Animated.View key={index} style={{
      position: "absolute", top: square.top as `${number}%`, left: square.left as `${number}%`, width: square.size, height: square.size,
      borderRadius: 28, borderWidth: 1, borderColor: "rgba(183,197,255,.08)", backgroundColor: square.color,
      transform: [
        { perspective: 900 },
        { translateX: x.interpolate({ inputRange: [-1, 1], outputRange: [-square.depth, square.depth] }) },
        { translateY: y.interpolate({ inputRange: [-1, 1], outputRange: [-square.depth, square.depth] }) },
        { rotate: square.angle },
        { rotateX: y.interpolate({ inputRange: [-1, 1], outputRange: ["-7deg", "7deg"] }) },
        { rotateY: x.interpolate({ inputRange: [-1, 1], outputRange: ["7deg", "-7deg"] }) },
      ],
    }} />)}
  </Box>;
}
export default function WelcomeScreen({
  navigate
}: Props) {
  const checkingSession = useSignedOutEntry(navigate);
  if (checkingSession) return null;
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.flex, ui.flexCol, ui.overflowHidden]]}>
      <AtmoBackground variant="violet" />
      <MotionSquares />

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
      }]} gradient={["rgba(146,125,255,0.06)", "rgba(105,120,255,0.03)"]} glass enter />
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
      }]} gradient={["rgba(105,120,255,0.05)", "rgba(146,125,255,0.04)"]} glass enter />
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
      }]} gradient={["rgba(146,125,255,0.04)", "rgba(255,255,255,0.02)"]} enter />

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

      {/* Middle decorative element */}
      <Box style={[[ui.relative, ui.flex1, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.px8]]}>
        <Box style={[[ui.relative, ui.itemsCenter]]}>
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
        </Box>
      </Box>

      {/* Bottom content */}
      <Box style={[[ui.relative, ui.px8, ui.pb12, ui.spaceY8]]}>
        <Box style={[[ui.spaceY4]]} enter>
          <BrandWordmark />
          <Box style={{ position: "relative", zIndex: 5 }}>
            <Label adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={[[ui.fontDisplay, ui.text5xl, ui.textWhite], { fontStyle: "italic", lineHeight: 52, textShadowColor: "rgba(0,0,0,.45)", textShadowRadius: 12 }]}>Meet real</Label>
            <Label adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={[[ui.fontDisplay, ui.text5xl], { color: "#c7ceff", fontStyle: "italic", lineHeight: 52, textShadowColor: "rgba(0,0,0,.5)", textShadowRadius: 12 }]}>moments.</Label>
          </Box>
          <EditorialQuote>Gerçek bağlantılar, ortak deneyimler ve güven üzerine kurulmuş özel bir topluluk.</EditorialQuote>
        </Box>

        <Box style={[[ui.spaceY3]]} enter>
          <Touch onPress={() => navigate("onboarding-1")} style={[[ui.wFull, ui.py4, ui.rounded2xl, ui.textBase, ui.fontSemibold, ui.trackingWide], {
          color: palette.text
        }]} gradient={palette.actionGradient}>
            Üyelik Başvurusu Yap
          </Touch>

          <Touch onPress={() => navigate("login")} style={[[ui.wFull, ui.py35, ui.textSm, ui.textWhite50, ui.fontLight]]}>
            Zaten üye misin?{" "}
            <Label style={[[ui.textWhite70, ui.underline]]}>Giriş Yap</Label>
          </Touch>
        </Box>

        <Box style={[[ui.flex, ui.itemsCenter, ui.gap2]]}>
          <LockIcon size={15} style={{ color: palette.muted }} />
          <Label style={[[ui.textXs, ui.textWhite50]]}>Referansla başlayan özel bir topluluk.</Label>
        </Box>
      </Box>
    </Box>;
}
