import { hasSession } from "../api/client";
import { useEffect } from "react";
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
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    hasSession().then(session => {
      const wait = Math.max(0, 850 - (Date.now() - startedAt));
      timer = setTimeout(() => { if (active) navigate(session ? "discover" : "welcome"); }, wait);
    }).catch(() => { timer = setTimeout(() => { if (active) navigate("welcome"); }, 850); });
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [navigate]);
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.overflowHidden]]}>
      <AtmoBackground variant="violet" />

      {/* Rotating glass ring */}
      <Box style={[[ui.fixed, ui.w72, ui.h72, ui.roundedFull, ui.border, ui.borderWhite5]]} enter />
      <Box style={[[ui.fixed, ui.w52, ui.h52, ui.roundedFull, ui.border, ui.borderWhite8]]} enter />

      {/* Refraction circle */}
      <Box style={[[ui.fixed, ui.w40, ui.h40, ui.roundedFull], {}]} gradient={["rgba(200,164,74,0.15)", "rgba(124,112,240,0.08)", "transparent"]} enter />

      {/* Logo */}
      <Box style={[[ui.relative, ui.flex, ui.flexCol, ui.itemsCenter, ui.gap3]]} enter>
        <Box style={[[ui.w20, ui.h20, ui.rounded28px, ui.flex, ui.itemsCenter, ui.justifyCenter], {
        backgroundColor: "rgba(255,255,255,0.07)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)"
      }]} glass>
          <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite90]]}>
            E
          </Label>
        </Box>
        <Box style={[[ui.textCenter]]}>
          <Label style={[[ui.fontDisplay, ui.text2xl, ui.fontLight, ui.tracking03em, ui.textWhite90, ui.uppercase]]}>
            Birlikte, gerçekten.
          </Label>
          <Box style={[[ui.mt2, ui.hPx, ui.w24, ui.mxAuto], {}]} gradient={["transparent", "rgba(200,164,74,0.6)", "transparent"]} gradientDirection="right" />
        </Box>
      </Box>
    </Box>;
}
