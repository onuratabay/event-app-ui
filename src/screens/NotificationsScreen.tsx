import { ReferenceNotifications } from "../components/ReferenceNotifications";
import { AtmoBackground } from "../components/GlassUI";
import { ArrowLeftIcon, CheckIcon } from "../components/Icons";
import { Box, Label, Picture, Scroll, Touch } from "../native/UI";
import { ui } from "../theme/styles";
import { NavigateFn } from "../types";
interface Props {
  navigate: NavigateFn;
}
const NOTIFS: Array<{ id: number; type: string; title: string; body: string; time: string; unread: boolean; avatar: string | null }> = [];
const TYPE_ICONS: Record<string, {
  bg: string;
  color: string;
  symbol: string;
}> = {
  join: {
    bg: "rgba(124,112,240,0.12)",
    color: "#a09cf5",
    symbol: "→"
  },
  active: {
    bg: "rgba(52,211,153,0.10)",
    color: "#6ee7b7",
    symbol: "●"
  },
  reference: {
    bg: "rgba(200,164,74,0.12)",
    color: "#c8a44a",
    symbol: "✦"
  },
  reminder: {
    bg: "rgba(96,165,250,0.10)",
    color: "#93c5fd",
    symbol: "◷"
  },
  score: {
    bg: "rgba(200,164,74,0.10)",
    color: "#c8a44a",
    symbol: "★"
  }
};
export default function NotificationsScreen({
  navigate
}: Props) {
  const unreadCount = NOTIFS.filter(n => n.unread).length;
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.flex, ui.flexCol, ui.overflowHidden]]}>
      <AtmoBackground />

      {/* Header */}
      <Box style={[[ui.relative, ui.pt14, ui.px5, ui.pb4, ui.flexShrink0]]} enter>
        <Box style={[[ui.flex, ui.itemsCenter, ui.justifyBetween]]}>
          <Box style={[[ui.flex, ui.itemsCenter, ui.gap3]]}>
            <Touch accessibilityLabel="Geri git" onPress={() => navigate("discover", { back: true })} style={[[ui.w9, ui.h9, ui.glass, ui.roundedXl, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.textWhite50]]} glass>
              <ArrowLeftIcon size={20} strokeWidth={1.8} />
            </Touch>
            <Box>
              <Label style={[[ui.fontDisplay, ui.text2xl, ui.fontLight, ui.textWhite]]}>
                Bildirimler
              </Label>
              {unreadCount > 0 && <Label style={[[ui.textXs, ui.textWhite35]]}>
                  {unreadCount} yeni bildirim
                </Label>}
            </Box>
          </Box>
          <Touch style={[[ui.textXs, ui.textWhite30]]}>Tümünü oku</Touch>
        </Box>
      </Box>

      {/* List */}
      <Scroll style={[[ui.flex1, ui.px5, ui.pb10, ui.spaceY2]]} enter>
        <ReferenceNotifications />
        {NOTIFS.map(notif => {
        const style = TYPE_ICONS[notif.type];
        return <Box key={notif.id} style={[[ui.flex, ui.itemsStart, ui.gap3, ui.p4, ui.rounded2xl], {
          backgroundColor: notif.unread ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
          borderWidth: 1,
          borderColor: notif.unread ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)"
        }]} glass>
              {/* Icon / avatar */}
              <Box style={[[ui.flexShrink0, ui.relative]]}>
                {notif.avatar ? <Picture uri={notif.avatar} accessibilityLabel="" style={[[ui.w10, ui.h10, ui.roundedFull]]} /> : <Box style={[[ui.w10, ui.h10, ui.roundedFull, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.textSm, ui.fontMedium], {
              backgroundColor: style.bg,
              color: style.color
            }]}>
                    {style.symbol}
                  </Box>}
                {notif.unread && <Box style={[[ui.fixed, ui.Top05, ui.Right05, ui.w25, ui.h25, ui.roundedFull, ui.bgC8a44a, ui.border2, ui.border06060e]]} />}
              </Box>

              {/* Content */}
              <Box style={[[ui.flex1, ui.minW0]]}>
                <Label style={[[ui.textSm, ui.fontMedium, ui.leadingSnug, notif.unread ? [ui.textWhite85] : [ui.textWhite55]]]}>
                  {notif.title}
                </Label>
                <Label style={[[ui.textXs, ui.textWhite35, ui.mt05, ui.leadingRelaxed]]}>
                  {notif.body}
                </Label>
                <Label style={[[ui.text10px, ui.textWhite20, ui.mt15]]}>
                  {notif.time}
                </Label>
              </Box>

              {/* Action for reference */}
              {notif.type === "reference" && notif.unread && <Box style={[[ui.flex, ui.flexCol, ui.gap15, ui.flexShrink0, ui.ml1]]}>
                  <Touch style={[[ui.w8, ui.h8, ui.roundedXl, ui.flex, ui.itemsCenter, ui.justifyCenter], {
              backgroundColor: "rgba(52,211,153,0.15)",
              borderWidth: 1,
              borderColor: "rgba(52,211,153,0.25)"
            }]}>
                    <CheckIcon size={14} strokeWidth={2} style={[[ui.textEmerald400]]} />
                  </Touch>
                  <Touch style={[[ui.w8, ui.h8, ui.roundedXl, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.textWhite25], {
              backgroundColor: "rgba(255,255,255,0.05)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.07)"
            }]}>
                    <Label style={[[ui.textSm, ui.leadingNone]]}>×</Label>
                  </Touch>
                </Box>}
            </Box>;
      })}
      </Scroll>
    </Box>;
}
