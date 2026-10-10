import { useEffect, useState, type ReactNode } from 'react'
import { Keyboard, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { palette, alpha } from '../theme/palette'

/** Place after the page's Scroll: takes its own safe-area space, never covers content. */
export default function BottomActions({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const [keyboard, setKeyboard] = useState(() => Keyboard.isVisible?.() ?? false)
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboard(true))
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(false))
    return () => { show.remove(); hide.remove() }
  }, [])
  if (keyboard) return null
  return <View testID="bottom-actions" style={[styles.bar, style]}>{children}</View>
}
const styles = StyleSheet.create({ bar: { flexShrink: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, gap: 10, backgroundColor: alpha(palette.background, .82), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border } })
