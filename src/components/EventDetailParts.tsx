import type { ComponentType, ReactElement, ReactNode } from "react";
import { StyleSheet, type ViewProps } from "react-native";
import MaskedViewBase from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import { Avatar, GlassCard } from "./GlassUI";
import { StarIcon } from "./Icons";
import { Box, Label, Picture, Touch } from "../native/UI";
import { isLivePhase, type EventPhase } from "../native/Store";
import { palette } from "../theme/palette";
import { ui } from "../theme/styles";

/**
 * The building blocks of the event detail page, shared by the member page (EventDetailScreen) and the guest page
 * (GuestEventScreen) so both look exactly the same; the guest page simply leaves out what a guest may not see.
 */

// The package's types still extend NativeMethods, which React Native 0.87+ no longer exports.
const MaskedView = MaskedViewBase as unknown as ComponentType<ViewProps & { maskElement: ReactElement }>;
// Every meta box has the same height; long values (location) wrap to two lines at most.
const META_BOX_HEIGHT = 112;

const PHASE_LABEL: Record<EventPhase, string> = { cancelled: "Etkinlik iptal edildi", closed: "Etkinlik sona erdi", started: "● Etkinlik başladı · Oda açık", active: "● Aktif · Oda açık", forming: "◌ Katılımcı Bekleniyor" };

/** The cover with its status on top. It fades to transparent so the animated backdrop shows through below it. */
export function EventCover({ uri, label, phase }: { uri: string; label: string; phase: EventPhase }) {
  return <Box style={[[ui.relative, ui.h72, ui.flexShrink0]]}>
    <MaskedView style={StyleSheet.absoluteFill} maskElement={<LinearGradient colors={["#000", "transparent"]} style={StyleSheet.absoluteFill} />}>
      <Picture uri={uri} accessibilityLabel={label} style={[[ui.wFull, ui.hFull]]} />
    </MaskedView>
    <Box style={[[ui.fixed, ui.bottom4, ui.left5]]}>
      <Box style={[[ui.px3, ui.py15, ui.roundedFull, ui.textXs, ui.fontMedium, isLivePhase(phase) ? [ui.bgEmerald50025, ui.border, ui.borderEmerald40040, ui.textEmerald300] : [ui.bgAmber50020, ui.border, ui.borderAmber40030, ui.textAmber300]]]}>
        {PHASE_LABEL[phase]}
      </Box>
    </Box>
  </Box>;
}

export function EventTitle({ title }: { title: string }) {
  return <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite, ui.mt1, ui.leadingTight]]}>{title}</Label>;
}

export type MetaItem = { icon: ReactNode; label: string; value: string; onPress?: () => void };
/** Date, place, duration, level… two per row, each box the same height. A box with onPress offers directions. */
export function EventMetaGrid({ items, walkthroughId }: { items: MetaItem[]; walkthroughId?: string }) {
  return <Box walkthroughId={walkthroughId} style={[[ui.mt4, ui.grid, ui.gap3]]} columns={2}>
    {items.map((item, i) => {
      const card = <GlassCard key={i} style={[[ui.p3], { height: META_BOX_HEIGHT }]}>
          <Box style={[[ui.flex, ui.itemsCenter, ui.justifyBetween, ui.mb1]]}>
            <Box style={[[ui.textWhite30]]}>{item.icon}</Box>
            {item.onPress ? <Label style={[[ui.text10px, ui.fontMedium], { color: palette.accent }]}>Yol tarifi ›</Label> : null}
          </Box>
          <Label style={[[ui.text10px, ui.textWhite30, ui.uppercase, ui.trackingWider]]}>{item.label}</Label>
          <Label numberOfLines={2} style={[[ui.textSm, ui.textWhite80, ui.mt05, ui.fontMedium]]}>{item.value}</Label>
        </GlassCard>;
      return item.onPress ? <Touch key={i} accessibilityLabel={`${item.label}: ${item.value}, yol tarifi al`} onPress={item.onPress}>{card}</Touch> : card;
    })}
  </Box>;
}

/**
 * "Katılımcılar" with the count; `children` are the people (members only), `footer` extra rows (invitations).
 * While the room is not open yet (`forming`), a bar shows how many are still needed.
 */
export function EventParticipantsCard({ count, forming, walkthroughId, children, footer }: {
  count: string; forming?: { current: number; minimum: number }; walkthroughId?: string; children?: ReactNode; footer?: ReactNode;
}) {
  return <GlassCard walkthroughId={walkthroughId} style={[[ui.p4]]}>
    <Box style={[[ui.flex, ui.itemsCenter, ui.justifyBetween, children ? ui.mb3 : null]]}>
      <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite70]]}>Katılımcılar</Label>
      <Box style={[[ui.flex, ui.itemsCenter, ui.gap3]]}>
        <Label style={[[ui.textSm, ui.fontSemibold, ui.textWhite]]}>{count}</Label>
      </Box>
    </Box>
    {children ? <Box style={[[ui.flex, ui.itemsCenter, ui.gap2, ui.flexWrap]]}>{children}</Box> : null}
    {footer}
    {forming && <Box style={[[ui.mt3]]}>
        <Box style={[[ui.h1, ui.roundedFull, ui.bgWhite8, ui.overflowHidden]]}>
          <Box style={[[ui.hFull, ui.roundedFull], { width: `${forming.current / forming.minimum * 100}%` }]} gradient={["#4d5bcb", "#6651c9"]} gradientDirection="right" />
        </Box>
        <Label style={[[ui.textXs, ui.textAmber30060, ui.mt15]]}>
          Odanın açılması için{" "}{Math.max(0, forming.minimum - forming.current)} kişi daha gerekiyor
        </Label>
        <Label style={[[ui.textXs, ui.textWhite45, ui.mt2]]}>
          Etkinlik minimum katılımcı sayısına ulaştığında oda açılacak ({forming.current}/{forming.minimum}).
        </Label>
      </Box>}
  </GlassCard>;
}

/** A titled text card ("Açıklama"). */
export function EventTextCard({ title, text }: { title: string; text: string }) {
  return <GlassCard style={[[ui.p4]]}>
    <Label style={[[ui.textXs, ui.textWhite35, ui.uppercase, ui.trackingWider, ui.mb2]]}>{title}</Label>
    <Label style={[[ui.textSm, ui.textWhite65, ui.leadingRelaxed]]}>{text}</Label>
  </GlassCard>;
}

export function EventRequirementsCard({ items }: { items: string[] }) {
  if (!items.length) return null;
  return <GlassCard style={[[ui.p4]]}>
    <Label style={[[ui.textXs, ui.textWhite35, ui.uppercase, ui.trackingWider, ui.mb2]]}>Gereksinimler</Label>
    <Box style={[[ui.spaceY15]]}>
      {items.map((req, i) => <Box key={i} style={[[ui.flex, ui.itemsCenter, ui.gap2]]}>
          <Label style={[[ui.w15, ui.h15, ui.roundedFull, ui.bgC8a44a60, ui.flexShrink0]]} />
          <Label style={[[ui.textSm, ui.textWhite60]]}>{req}</Label>
        </Box>)}
    </Box>
  </GlassCard>;
}

/** "Düzenleyen": photo, name (a link when onPress is given) and, for members, the score line. */
export function EventHostCard({ name, avatar, onPress, score }: { name: string; avatar: string; onPress?: () => void; score?: string }) {
  const title = <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite85]]}>{name}</Label>;
  return <GlassCard style={[[ui.p4]]}>
    <Label style={[[ui.textXs, ui.textWhite35, ui.uppercase, ui.trackingWider, ui.mb3]]}>Düzenleyen</Label>
    <Box style={[[ui.flex, ui.itemsCenter, ui.gap3]]}>
      <Avatar uri={avatar} name={name} size="md" />
      <Box style={[[ui.flex1]]}>
        {onPress ? <Touch accessibilityRole="link" accessibilityLabel={`${name} profilini aç`} onPress={onPress} style={{ alignSelf: "flex-start", justifyContent: "flex-start", minHeight: 0 }}>{title}</Touch> : title}
        {score ? <Box style={[[ui.flex, ui.itemsCenter, ui.gap1, ui.mt05]]}>
          <StarIcon size={14} style={{ color: palette.accent }} />
          <Label style={[[ui.textXs, ui.textWhite40], { flexShrink: 1 }]} numberOfLines={1}>{score}</Label>
        </Box> : null}
      </Box>
    </Box>
  </GlassCard>;
}

/** The participation row under the title: small chips (Katıl, İptal Et, Odaya Katıl…) and the joined badge. */
export const detailStyles = StyleSheet.create({
  hostRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 32 },
  hostBadge: {
    flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999, backgroundColor: "rgba(111,208,182,.12)", borderWidth: 1, borderColor: "rgba(111,208,182,.30)",
  },
  hostBadgeText: { color: palette.success, fontSize: 11, fontFamily: "Outfit-Medium" },
  rowActions: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 8 },
  roomChip: {
    minHeight: 32, paddingHorizontal: 14, borderRadius: 999,
    color: palette.text, fontSize: 12, fontFamily: "Outfit-SemiBold",
  },
  countText: { color: "rgba(241,245,249,.55)", fontSize: 12, fontFamily: "Outfit-Medium" },
  neutralChip: {
    minHeight: 32, paddingHorizontal: 12, borderRadius: 999,
    backgroundColor: palette.elevated, borderWidth: 1, borderColor: palette.border,
    color: palette.text, fontSize: 12, fontFamily: "Outfit-Medium",
  },
  cancelChip: {
    minHeight: 32, paddingHorizontal: 12, borderRadius: 999,
    backgroundColor: palette.elevated, borderWidth: 1, borderColor: palette.border,
    color: palette.error, fontSize: 12, fontFamily: "Outfit-Medium",
  },
});
