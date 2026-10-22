import { Linking, Share, StyleSheet } from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { Box, Label, Touch } from '../native/UI'
import { palette } from '../theme/palette'

export type ShareTargetId = 'whatsapp' | 'telegram' | 'x' | 'facebook' | 'email' | 'copy' | 'more'
type Target = { id: ShareTargetId; name: string; color: string; glyph: React.ReactNode }

const W = '#ffffff'
// Simplified brand glyphs on a 24 grid, drawn white on each platform's own colour.
export const SHARE_TARGETS: Target[] = [
  { id: 'whatsapp', name: 'WhatsApp', color: '#25D366', glyph: <>
    <Path d="M12 3.2a8.8 8.8 0 0 0-7.6 13.2L3.2 20.8l4.5-1.2A8.8 8.8 0 1 0 12 3.2Z" fill="none" stroke={W} strokeWidth={1.8} strokeLinejoin="round" />
    <Path d="M9.2 7.6c.3 0 .6 0 .8.5l.8 1.9c.1.3 0 .5-.1.7l-.6.7c.6 1.2 1.6 2.2 2.8 2.8l.7-.6c.2-.2.4-.2.7-.1l1.9.8c.4.2.5.5.4.9-.2 1-1.1 1.6-2 1.5-3.3-.4-6.3-3.4-6.7-6.7-.1-.9.5-1.8 1.3-2.4Z" fill={W} />
  </> },
  { id: 'telegram', name: 'Telegram', color: '#229ED9', glyph: <>
    <Path d="M20.5 4.5 3.6 11.1c-.8.3-.8 1.4 0 1.7l4.1 1.4 1.6 5c.2.7 1.1.9 1.6.4l2.4-2.2 4.2 3.1c.6.4 1.4.1 1.6-.6l2.7-13.2c.2-.8-.6-1.5-1.3-1.2Z" fill={W} />
    <Path d="m8.2 14 8.5-6.1-6.6 7.3" fill="none" stroke="#229ED9" strokeWidth={1.3} strokeLinejoin="round" />
  </> },
  { id: 'x', name: 'X', color: '#0b0b0f', glyph: <>
    <Path d="M5 4.5h4.2L19 19.5h-4.2Z" fill={W} />
    <Path d="M18.6 4.5 13.4 10.4M10.6 13.6l-5.2 5.9" stroke={W} strokeWidth={1.9} strokeLinecap="round" />
  </> },
  { id: 'facebook', name: 'Facebook', color: '#1877F2', glyph:
    <Path d="M13.6 21v-7.4h2.5l.4-2.9h-2.9V8.9c0-.8.3-1.4 1.4-1.4h1.6V4.9c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.1H7.9v2.9h2.6V21Z" fill={W} /> },
  { id: 'email', name: 'E-posta', color: '#5b6cf0', glyph: <>
    <Rect x={3.5} y={6} width={17} height={12.5} rx={2.4} fill="none" stroke={W} strokeWidth={1.9} />
    <Path d="m4.5 7.5 7.5 5.8 7.5-5.8" fill="none" stroke={W} strokeWidth={1.9} strokeLinejoin="round" />
  </> },
  { id: 'copy', name: 'Bağlantıyı kopyala', color: palette.elevated, glyph:
    <Path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke={W} strokeWidth={1.9} strokeLinecap="round" /> },
  { id: 'more', name: 'Diğer', color: palette.elevated, glyph: <>
    <Circle cx={6.5} cy={12} r={1.7} fill={W} /><Circle cx={12} cy={12} r={1.7} fill={W} /><Circle cx={17.5} cy={12} r={1.7} fill={W} />
  </> },
]

/** The message every target sends: title, time, place and the guest link. */
/** "21 Ekim 23:40", the moment an invite stops working. */
export const inviteExpiry = (expiresAt: string) =>
  new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(expiresAt))
// The link sits on its own last line so WhatsApp and others build their event card (preview) from it.
export const shareMessage = (event: { title: string; date: string; time: string; location: string }, url: string, expiresAt?: string) =>
  `${event.title}\n${event.date} · ${event.time}\n${event.location}${expiresAt ? `\nDavet ${inviteExpiry(expiresAt)} tarihine kadar geçerli (24 saat).` : ""}\nMisafir olarak katıl:\n${url}`

const open = async (app: string, web?: string) => {
  try { await Linking.openURL(app) } catch { if (web) await Linking.openURL(web); else throw new Error('unavailable') }
}

/**
 * Opens one platform with the invite prefilled. Apps that are not installed fall back to their web
 * share page. Instagram and text messages have no reliable prefilled-text link; they are reached
 * through "Kartı paylaş" or "Diğer" (the system share sheet).
 * `copy` is handled by the caller.
 */
export async function shareTo(target: ShareTargetId, message: string, url: string, title: string) {
  const text = encodeURIComponent(message), link = encodeURIComponent(url)
  switch (target) {
    case 'whatsapp': return open(`whatsapp://send?text=${text}`, `https://wa.me/?text=${text}`)
    case 'telegram': return open(`tg://msg_url?url=${link}&text=${text}`, `https://t.me/share/url?url=${link}&text=${text}`)
    case 'x': return open(`twitter://post?message=${text}`, `https://x.com/intent/post?text=${text}`)
    case 'facebook': return Linking.openURL(`https://www.facebook.com/sharer/sharer.php?u=${link}`)
    case 'email': return Linking.openURL(`mailto:?subject=${encodeURIComponent(title)}&body=${text}`)
    default: await Share.share({ title, message })
  }
}

/** Three-by-three grid of round platform icons with their names. */
export function ShareTargetGrid({ disabled, onPick }: { disabled?: boolean; onPick: (target: ShareTargetId) => void }) {
  return <Box columns={3} style={s.grid}>
    {SHARE_TARGETS.map(target => <Touch key={target.id} accessibilityLabel={target.name} disabled={disabled} disabledOpacity={0.4} onPress={() => onPick(target.id)} style={s.item}>
      <Box style={[s.icon, { backgroundColor: target.color }, target.color === palette.elevated && s.neutral]}>
        <Svg width={26} height={26} viewBox="0 0 24 24">{target.glyph}</Svg>
      </Box>
      <Label style={s.name} numberOfLines={2}>{target.name}</Label>
    </Touch>)}
  </Box>
}

const s = StyleSheet.create({
  grid: { rowGap: 16, columnGap: 8 },
  item: { alignItems: 'center', gap: 6, minHeight: 0, justifyContent: 'flex-start' },
  icon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  neutral: { borderWidth: 1, borderColor: palette.glassBorder },
  name: { color: palette.text, fontSize: 11, lineHeight: 14, textAlign: 'center', fontFamily: 'Outfit-Medium' },
})
