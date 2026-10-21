import type { TouchProps } from "../native/UI"
import { Touch } from "../native/UI"
import { HeartIcon } from "./Icons"
export function SpringButton(props: TouchProps) {
  return <Touch {...props} />
}
export function RippleButton(props: TouchProps) {
  return <Touch {...props} />
}
export function HeartButton({
  saved,
  onChange,
  size = 14,
}: {
  saved: boolean
  onChange: (saved: boolean) => void
  size?: number
}) {
  return (
    <Touch
      accessibilityLabel={saved ? "Kaydı kaldır" : "Etkinliği kaydet"}
      onPress={(e) => {
        e.stopPropagation()
        onChange(!saved)
      }}
      style={{
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <HeartIcon
        size={size + 4}
        strokeWidth={1.8}
        filled={saved}
        style={{ color: saved ? "#c7ceff" : "rgba(241,245,249,.78)" }}
      />
    </Touch>
  )
}
