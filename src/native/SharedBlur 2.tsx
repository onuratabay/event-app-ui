import { BlurTargetView, BlurView, type BlurViewProps } from "expo-blur"
import { createContext, useContext, useRef, type ReactNode, type RefObject } from "react"
import { View } from "react-native"

const BlurTarget = createContext<RefObject<View | null> | undefined>(undefined)
/** One capture surface serves all glass treatments, including Android's native blur. */
export function BlurSurface({ children, overlay }: { children: ReactNode; overlay?: ReactNode }) {
  const target = useRef<View | null>(null)
  return <BlurTarget.Provider value={target}>
    <BlurTargetView ref={target} collapsable={false} style={{ flex: 1 }}>{children}</BlurTargetView>
    {overlay}
  </BlurTarget.Provider>
}
export function SharedBlur(props: BlurViewProps) {
  const target = useContext(BlurTarget)
  return <BlurView {...props} blurTarget={target} blurMethod={target ? "dimezisBlurView" : "none"} blurReductionFactor={4} />
}
