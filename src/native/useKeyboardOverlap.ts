import { useEffect, useRef, useState, type RefObject } from "react"
import { Keyboard, type View } from "react-native"

/**
 * How much of `ref`'s view the open keyboard still covers, for bottom-pinned bars such as a chat composer.
 * The root's keyboard-avoiding view usually shrinks the screen already (then this is 0, nothing is added
 * twice); where it does not, the bar gets this much extra bottom space and stays above the keyboard.
 */
export function useKeyboardOverlap(ref: RefObject<View | null>) {
  const [overlap, setOverlap] = useState(0)
  const keyboardTop = useRef<number | null>(null)
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const measure = () => {
      const top = keyboardTop.current
      if (top === null) { setOverlap(0); return }
      ref.current?.measureInWindow((_x, y, _width, height) => {
        if (height) setOverlap(Math.max(0, Math.round(y + height - top)))
      })
    }
    // Measured once the keyboard is up and again after layout settles (the root may resize a moment later).
    const shown = Keyboard.addListener("keyboardDidShow", event => {
      keyboardTop.current = event.endCoordinates.screenY
      measure()
      timers.push(setTimeout(measure, 250))
    })
    const hidden = Keyboard.addListener("keyboardDidHide", () => { keyboardTop.current = null; setOverlap(0) })
    return () => { shown.remove(); hidden.remove(); timers.forEach(clearTimeout) }
  }, [ref])
  return overlap
}
