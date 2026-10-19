import { useEffect, useState, type ReactNode } from "react"
import { StyleSheet, View } from "react-native"

/**
 * One layer above the app's screens and its bottom menu bar, in the same window: panels shown here use the
 * same coordinates and safe-area insets as the bar, so they line up with it on every phone. (A separate
 * Modal window starts at a different bottom edge on some Android phones.)
 */
let show: ((node: ReactNode) => void) | null = null
export default function OverlayHost() {
  const [node, setNode] = useState<ReactNode>(null)
  useEffect(() => {
    show = setNode
    return () => { if (show === setNode) show = null }
  }, [])
  return node ? <View style={[StyleSheet.absoluteFill, { zIndex: 1000, elevation: 1000 }]} pointerEvents="box-none">{node}</View> : null
}
/** Whether a host is mounted (screens rendered on their own, e.g. in tests, draw panels inline instead). */
export const hasOverlayHost = () => show !== null
/** Shows `node` in the overlay layer while the calling component is mounted. */
export function useOverlay(node: ReactNode) {
  useEffect(() => { show?.(node) })
  useEffect(() => () => show?.(null), [])
}
