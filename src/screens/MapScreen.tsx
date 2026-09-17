import { useState } from "react";
import { G, Line, Path } from "react-native-svg";
import BottomNav from "../components/BottomNav";
import { FilterChip, GlassCard } from "../components/GlassUI";
import { useStore } from "../native/Store";
import { Box, Label, Scroll, Touch, Vector } from "../native/UI";
import { ui } from "../theme/styles";
import { NavigateFn } from "../types";
interface Props {
  navigate: NavigateFn;
}
const HEAT_ZONES = [{
  x: 30,
  y: 28,
  size: 120,
  intensity: "high",
  label: "Çankaya",
  events: 4
}, {
  x: 65,
  y: 42,
  size: 90,
  intensity: "medium",
  label: "Oran",
  events: 2
}, {
  x: 20,
  y: 55,
  size: 70,
  intensity: "low",
  label: "Bahçelievler",
  events: 1
}, {
  x: 72,
  y: 65,
  size: 100,
  intensity: "medium",
  label: "Çayyolu",
  events: 3
}, {
  x: 45,
  y: 72,
  size: 60,
  intensity: "low",
  label: "Gölbaşı",
  events: 1
}];
const MARKERS = [{
  x: 28,
  y: 25,
  emoji: "🎾",
  category: "Padel"
}, {
  x: 62,
  y: 38,
  emoji: "☕",
  category: "Kahve"
}, {
  x: 70,
  y: 62,
  emoji: "🎵",
  category: "Konser"
}, {
  x: 44,
  y: 68,
  emoji: "🥾",
  category: "Hiking"
}, {
  x: 35,
  y: 48,
  emoji: "📷",
  category: "Fotoğraf"
}];
const heatColor = {
  high: "rgba(200,164,74,0.22)",
  medium: "rgba(124,112,240,0.16)",
  low: "rgba(100,180,200,0.10)"
};
export default function MapScreen({
  navigate
}: Props) {
  const {
    data: store
  } = useStore();
  const EVENTS = store.events;
  const [activeFilter, setActiveFilter] = useState("Bugün");
  const [selectedZone, setSelectedZone] = useState<typeof HEAT_ZONES[0] | null>(null);
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.overflowHidden]]}>
      {/* Map placeholder */}
      <Box style={[[ui.fixed, ui.inset0], {}]} gradient={["#0d0d1f", "#080818", "#0a0a1a"]}>
        {/* Grid lines to suggest map grid */}
        <Vector viewBox="0 0 100 100" preserveAspectRatio="none" style={[[ui.fixed, ui.inset0, ui.wFull, ui.hFull, ui.opacity004]]}>
          {Array.from({
          length: 12
        }).map((_, i) => <G key={i}>
              <Line x1="0" y1={`${(i + 1) * 8.33}%`} x2="100%" y2={`${(i + 1) * 8.33}%`} stroke="white" strokeWidth="0.5" />
              <Line x1={`${(i + 1) * 8.33}%`} y1="0" x2={`${(i + 1) * 8.33}%`} y2="100%" stroke="white" strokeWidth="0.5" />
            </G>)}
        </Vector>

        {/* Road-like curves */}
        <Vector viewBox="0 0 100 100" preserveAspectRatio="none" style={[[ui.fixed, ui.inset0, ui.wFull, ui.hFull, ui.opacity007]]}>
          <Path d="M 10 20 Q 30 35 50 30 T 90 25" stroke="#c8a44a" strokeWidth="2" fill="none" />
          <Path d="M 5 50 Q 25 45 45 55 T 95 48" stroke="white" strokeWidth="1.5" fill="none" />
          <Path d="M 20 70 Q 45 65 65 72 T 95 68" stroke="white" strokeWidth="1" fill="none" />
          <Path d="M 35 10 Q 38 40 40 70 T 42 95" stroke="white" strokeWidth="1.5" fill="none" />
          <Path d="M 65 5 Q 68 35 70 60 T 72 95" stroke="white" strokeWidth="1" fill="none" />
        </Vector>

        {/* Heat blobs */}
        {HEAT_ZONES.map((zone, i) => <Touch key={i} onPress={() => setSelectedZone(zone)} style={[[ui.fixed], {
        left: `${zone.x}%`,
        top: `${zone.y}%`,
        transform: [{
          translateX: "-50%"
        }, {
          translateY: "-50%"
        }]
      }]}>
            <Box style={[[ui.roundedFull], {
          width: zone.size,
          height: zone.size
        }]} gradient={[heatColor[zone.intensity as keyof typeof heatColor], "transparent"]} enter />
          </Touch>)}

        {/* Event markers */}
        {MARKERS.map((marker, i) => <Touch onPress={() => {
        const e = EVENTS.find(e => e.category === marker.category) || EVENTS[i % EVENTS.length];
        navigate("event-detail", {
          eventId: e.id
        });
      }} key={i} style={[[ui.fixed, ui.flex, ui.flexCol, ui.itemsCenter, ui.gap05], {
        left: `${marker.x}%`,
        top: `${marker.y}%`,
        transform: [{
          translateX: "-50%"
        }, {
          translateY: "-50%"
        }]
      }]}>
            <Box style={[[ui.w8, ui.h8, ui.roundedFull, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.textSm], {
          backgroundColor: "rgba(6,6,14,0.85)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.15)"
        }]} glass>
              {marker.emoji}
            </Box>
            <Box style={[[ui.px15, ui.py05, ui.rounded, ui.text9px, ui.textWhite60, ui.fontMedium], {
          backgroundColor: "rgba(6,6,14,0.7)"
        }]} glass>
              {marker.category}
            </Box>
          </Touch>)}

        {/* User location */}
        <Box style={[[ui.fixed], {
        left: "48%",
        top: "45%",
        transform: [{
          translateX: "-50%"
        }, {
          translateY: "-50%"
        }]
      }]}>
          <Box style={[[ui.relative]]}>
            <Box style={[[ui.w4, ui.h4, ui.roundedFull, ui.bg7c70f0, ui.z10, ui.relative]]} />
            <Box style={[[ui.fixed, ui.inset0, ui.roundedFull, ui.bg7c70f030]]} enter />
          </Box>
        </Box>
      </Box>

      {/* Top overlay */}
      <Box style={[[ui.relative]]}>
        <Box style={[[ui.pt14, ui.px5, ui.pb3]]}>
          <Box style={[[ui.flex, ui.itemsCenter, ui.justifyBetween, ui.mb3]]}>
            <Label style={[[ui.fontDisplay, ui.text2xl, ui.fontLight, ui.textWhite]]}>
              Harita
            </Label>
            <Box style={[[ui.px3, ui.py15, ui.roundedFull, ui.textXs, ui.textWhite60], {
            backgroundColor: "rgba(6,6,14,0.7)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)"
          }]} glass>
              2 km içinde 4 etkinlik
            </Box>
          </Box>
          <Scroll style={[[ui.flex, ui.gap2]]} horizontal>
            {["Bugün", "Bu Hafta", "Padel", "Outdoor", "Konser", "Tüm"].map(f => <FilterChip key={f} label={f} selected={activeFilter === f} onPress={() => setActiveFilter(f)} />)}
          </Scroll>
        </Box>
      </Box>

      {/* Zone info tooltip */}
      {selectedZone && <Box style={[[ui.fixed, ui.top40, ui.left5, ui.right5]]} pointerEvents="none" enter>
          <GlassCard style={[[ui.p3]]}>
            <Box style={[[ui.flex, ui.itemsCenter, ui.justifyBetween]]}>
              <Box>
                <Label style={[[ui.textXs, ui.textWhite40]]}>
                  {selectedZone.label}
                </Label>
                <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite80]]}>
                  Bu bölgede {selectedZone.events} etkinlik var
                </Label>
              </Box>
              <Label style={[[ui.textXs, ui.px2, ui.py1, ui.roundedFull], {
            backgroundColor: selectedZone.intensity === "high" ? "rgba(200,164,74,0.15)" : selectedZone.intensity === "medium" ? "rgba(124,112,240,0.15)" : "rgba(100,180,200,0.10)",
            color: selectedZone.intensity === "high" ? "#c8a44a" : selectedZone.intensity === "medium" ? "#a8a0ff" : "#90c8d0"
          }]}>
                {selectedZone.intensity === "high" ? "Hareketli" : selectedZone.intensity === "medium" ? "Orta" : "Sakin"}
              </Label>
            </Box>
          </GlassCard>
        </Box>}

      {/* Bottom sheet - nearby events */}
      <Box style={[[ui.fixed, ui.bottom0, ui.left0, ui.right0, ui.pb28]]}>
        <Box style={[[ui.mx5, ui.rounded2xl, ui.p4], {
        backgroundColor: "rgba(8,8,20,0.85)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)"
      }]} glass>
          <Box style={[[ui.w8, ui.h1, ui.roundedFull, ui.bgWhite15, ui.mxAuto, ui.mb3]]} />
          <Label style={[[ui.textXs, ui.textWhite35, ui.mb3]]}>
            Yakınındaki etkinlikler
          </Label>
          <Box style={[[ui.spaceY2]]}>
            {EVENTS.slice(0, 3).map(event => <Touch key={event.id} onPress={() => navigate("event-detail", {
            eventId: event.id
          })} style={[[ui.wFull, ui.flex, ui.itemsCenter, ui.gap3, ui.textLeft]]}>
                <Box style={[[ui.w10, ui.h10, ui.roundedXl, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.textXl, ui.flexShrink0], {
              backgroundColor: "rgba(255,255,255,0.06)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)"
            }]}>
                  {event.categoryEmoji}
                </Box>
                <Box style={[[ui.flex1, ui.minW0]]}>
                  <Label style={[[ui.textSm, ui.textWhite80, ui.fontMedium]]} numberOfLines={1}>
                    {event.title}
                  </Label>
                  <Label style={[[ui.textXs, ui.textWhite35]]}>
                    {event.date} · {event.distance}
                  </Label>
                </Box>
                <Label style={[[ui.textXs, ui.px2, ui.py05, ui.roundedFull, ui.flexShrink0, event.isActive ? [ui.textEmerald400] : [ui.textAmber400]]]}>
                  {event.isActive ? "●" : "◌"}
                </Label>
              </Touch>)}
          </Box>
        </Box>
      </Box>

      <BottomNav active="map" navigate={navigate} />
    </Box>;
}
