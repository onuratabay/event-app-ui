import { getCurrentUser, hasSession, logout } from "../api/client";
import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import { AtmoBackground } from "../components/GlassUI";
import { Box, Label } from "../native/UI";
import { ui } from "../theme/styles";
import { NavigateFn } from "../types";
interface Props {
  navigate: NavigateFn;
}
export default function SplashScreen({
  navigate
}: Props) {
  const orbit = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    const resolveDestination = async () => {
      let destination: "discover" | "login" | "welcome" = "welcome";
      try {
        if (await hasSession()) {
          await getCurrentUser();
          destination = "discover";
        }
      } catch {
        // A stale local token must never open an empty authenticated feed.
        await logout().catch(() => {});
        destination = "login";
      }
      const wait = Math.max(0, 2850 - (Date.now() - startedAt));
      timer = setTimeout(() => { if (active) navigate(destination); }, wait);
    };
    void resolveDestination();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [navigate]);
  useEffect(() => {
    // The lightweight native-host test shim does not implement animation loops.
    if (typeof Animated.loop !== "function") return;
    const orbitAnimation = Animated.loop(Animated.timing(orbit, { toValue: 1, duration: 4200, easing: Easing.linear, useNativeDriver: true }));
    const pulseAnimation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    orbitAnimation.start();
    pulseAnimation.start();
    return () => { orbitAnimation.stop(); pulseAnimation.stop(); };
  }, [orbit, pulse]);
  const spin = orbit.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const coreScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [.96, 1.06] });
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.overflowHidden]]}>
      <AtmoBackground variant="violet" />

      <Box style={[[ui.relative, ui.flex, ui.flexCol, ui.itemsCenter, ui.gap4]]} enter>
        <Animated.View style={{ width: 184, height: 184, alignItems: "center", justifyContent: "center", transform: [{ rotate: spin }] }}>
          {[["🏃", -64, -52], ["🎨", 64, -45], ["☕", 54, 66], ["🎵", -66, 52]].map(([icon, x, y]) => <Box key={String(icon)} style={[[ui.fixed, ui.w11, ui.h11, ui.roundedFull, ui.flex, ui.itemsCenter, ui.justifyCenter], {
            transform: [{ translateX: x as number }, { translateY: y as number }],
            backgroundColor: "rgba(255,255,255,.10)",
            borderWidth: 1,
            borderColor: "rgba(226, 200, 117, .32)",
          }]} glass>
              <Label style={{ fontSize: 21, lineHeight: 28 }}>{icon}</Label>
            </Box>)}
          <Box style={[[ui.fixed, ui.roundedFull, ui.border, ui.borderWhite8], { width: 128, height: 128 }]} />
        </Animated.View>
        <Animated.View style={{ position: "absolute", top: 58, transform: [{ scale: coreScale }] }}>
          <Box style={[[ui.w20, ui.h20, ui.rounded28px, ui.flex, ui.itemsCenter, ui.justifyCenter], {
            backgroundColor: "rgba(105,120,255,.16)", borderWidth: 1, borderColor: "rgba(183,197,255,.42)",
          }]} glass>
            <Label style={[[ui.fontDisplay, ui.text2xl, ui.textWhite90]]}>✦</Label>
          </Box>
        </Animated.View>
        <Box style={[[ui.textCenter]]}>
          <Label style={[[ui.fontDisplay, ui.text2xl, ui.fontLight, ui.textWhite90], { lineHeight: 34, paddingVertical: 2 }]}>
            Yeni anlar yaklaşıyor.
          </Label>
          <Label style={[[ui.textSm, ui.textWhite45, ui.mt1]]}>Etkinlikler, insanlar ve iyi bir başlangıç.</Label>
          <Box style={[[ui.mt2, ui.hPx, ui.w24, ui.mxAuto], {}]} gradient={["transparent", "rgba(105,120,255,0.6)", "transparent"]} gradientDirection="right" />
        </Box>
      </Box>
    </Box>;
}
