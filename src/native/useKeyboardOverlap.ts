import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import { Keyboard, Platform, type ViewInstance } from "react-native"

/**
 * How much of `ref`'s view the open keyboard still covers, for bottom-pinned bars such as a chat composer.
 * The root's keyboard-avoiding view usually shrinks the screen already (then this is 0, nothing is added
 * twice); where it does not, the bar gets this much extra bottom space and stays above the keyboard.
 * Give `onLayout` to the same view: it measures again whenever the root resizes the screen.
 */
export function useKeyboardOverlap(ref: RefObject<ViewInstance | null>) {
  const [overlap, setOverlap] = useState(0)
  const keyboardTop = useRef<number | null>(null)
  const measure = useCallback(() => {
    const top = keyboardTop.current
    if (top === null) { setOverlap(0); return }
    ref.current?.measureInWindow((_x, y, _width, height) => {
      if (height) setOverlap(Math.max(0, Math.round(y + height - top)))
    })
  }, [ref])
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const shown = Keyboard.addListener("keyboardDidShow", event => {
      keyboardTop.current = event.endCoordinates.screenY
      // iOS has already made room by now (the root moves on keyboardWillShow). Android's root shrinks on
      // this same event: measuring now would count the keyboard twice and lift the bar to the top of the
      // screen. There the screen's next layout measures it; the timer covers a root that never resizes.
      if (Platform.OS === "ios") measure()
      timers.push(setTimeout(measure, 250))
    })
    const hidden = Keyboard.addListener("keyboardDidHide", () => { keyboardTop.current = null; setOverlap(0) })
    return () => { shown.remove(); hidden.remove(); timers.forEach(clearTimeout) }
  }, [measure])
  return { overlap, onLayout: measure }
}
