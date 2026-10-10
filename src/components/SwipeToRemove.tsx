import { useMemo, useRef, type ReactNode } from 'react'
import { Animated, PanResponder } from 'react-native'

/** Horizontal gesture only: vertical scrolling and ordinary button taps remain available. */
export default function SwipeToRemove({ children, onRemove, disabled }: { children: ReactNode; onRemove: () => void; disabled?: boolean }) {
  const x = useRef(new Animated.Value(0)).current
  const callback = useRef(onRemove); callback.current = onRemove
  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => !disabled && Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderMove: (_, g) => x.setValue(Math.max(-80, Math.min(80, g.dx))),
    onPanResponderRelease: (_, g) => {
      Animated.spring(x, { toValue: 0, useNativeDriver: true }).start()
      if (Math.abs(g.dx) >= 60) callback.current()
    },
    onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(),
  }), [disabled, x])
  return <Animated.View {...responder.panHandlers} style={{ transform: [{ translateX: x }] }}>{children}</Animated.View>
}
