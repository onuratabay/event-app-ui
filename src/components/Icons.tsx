import { Circle, Line, Path, Polygon, Polyline, Rect } from "react-native-svg"
import { Vector, type NativeStyleProp } from "../native/UI"
interface IconProps {
  size?: number
  style?: NativeStyleProp
  strokeWidth?: number
}
const defaults = {
  size: 20,
  strokeWidth: 1.75,
}
export function HeartIcon({
  size = defaults.size,
  style,
  strokeWidth = defaults.strokeWidth,
  filled = false,
}: IconProps & { filled?: boolean }) {
  return (
    <Vector
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={[style]}
    >
      <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
    </Vector>
  )
}
export function InstagramIcon({
  size = defaults.size,
  style,
  strokeWidth = defaults.strokeWidth,
}: IconProps) {
  return (
    <Vector
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={[style]}
    >
      <Rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <Circle cx="12" cy="12" r="4" />
      <Circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
    </Vector>
  )
}
export function KeyIcon({
  size = defaults.size,
  style,
  strokeWidth = defaults.strokeWidth,
}: IconProps) {
  return (
    <Vector
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={[style]}
    >
      <Circle cx="7.5" cy="15.5" r="5.5" />
      <Path d="M21 8.5l-8.44 8.44" />
      <Path d="M18 11.5l1.5-1.5" />
      <Path d="M15 14.5l1.5-1.5" />
    </Vector>
  )
}
export function UsersIcon({
  size = defaults.size,
  style,
  strokeWidth = defaults.strokeWidth,
}: IconProps) {
  return (
    <Vector
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={[style]}
    >
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <Circle cx="9" cy="7" r="4" />
      <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Vector>
  )
}
export function ScrollIcon({
  size = defaults.size,
  style,
  strokeWidth = defaults.strokeWidth,
}: IconProps) {
  return (
    <Vector
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={[style]}
    >
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Polyline points="14 2 14 8 20 8" />
      <Line x1="9" y1="13" x2="15" y2="13" />
      <Line x1="9" y1="17" x2="13" y2="17" />
    </Vector>
  )
}
export function CameraIcon({
  size = defaults.size,
  style,
  strokeWidth = defaults.strokeWidth,
}: IconProps) {
  return (
    <Vector
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={[style]}
    >
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Circle cx="12" cy="13" r="4" />
    </Vector>
  )
}
export function ImageIcon({
  size = defaults.size,
  style,
  strokeWidth = defaults.strokeWidth,
}: IconProps) {
  return (
    <Vector
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={[style]}
    >
      <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <Circle cx="8.5" cy="8.5" r="1.5" />
      <Polyline points="21 15 16 10 5 21" />
    </Vector>
  )
}
export function LocationIcon({
  size = defaults.size,
  style,
  strokeWidth = defaults.strokeWidth,
}: IconProps) {
  return (
    <Vector
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={[style]}
    >
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <Circle cx="12" cy="10" r="3" />
    </Vector>
  )
}
export function ClockIcon({
  size = defaults.size,
  style,
  strokeWidth = defaults.strokeWidth,
}: IconProps) {
  return (
    <Vector
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={[style]}
    >
      <Circle cx="12" cy="12" r="10" />
      <Polyline points="12 6 12 12 16 14" />
    </Vector>
  )
}
export function ChevronDownIcon({
  size = defaults.size,
  style,
  strokeWidth = defaults.strokeWidth,
}: IconProps) {
  return (
    <Vector
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={[style]}
    >
      <Polyline points="6 9 12 15 18 9" />
    </Vector>
  )
}
export function CheckIcon({
  size = defaults.size,
  style,
  strokeWidth = defaults.strokeWidth,
}: IconProps) {
  return (
    <Vector
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={[style]}
    >
      <Polyline points="20 6 9 17 4 12" />
    </Vector>
  )
}
export function SearchIcon({
  size = defaults.size,
  style,
  strokeWidth = defaults.strokeWidth,
}: IconProps) {
  return (
    <Vector
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={[style]}
    >
      <Circle cx="11" cy="11" r="8" />
      <Line x1="21" y1="21" x2="16.65" y2="16.65" />
    </Vector>
  )
}
export function ArrowLeftIcon({
  size = defaults.size,
  style,
  strokeWidth = defaults.strokeWidth,
}: IconProps) {
  return (
    <Vector
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={[style]}
    >
      <Line x1="19" y1="12" x2="5" y2="12" />
      <Polyline points="12 19 5 12 12 5" />
    </Vector>
  )
}
export function ShareIcon({
  size = defaults.size,
  style,
  strokeWidth = defaults.strokeWidth,
}: IconProps) {
  return (
    <Vector
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={[style]}
    >
      <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <Polyline points="16 6 12 2 8 6" />
      <Line x1="12" y1="2" x2="12" y2="15" />
    </Vector>
  )
}
export function BellIcon({
  size = defaults.size,
  style,
  strokeWidth = defaults.strokeWidth,
}: IconProps) {
  return (
    <Vector
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={[style]}
    >
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Vector>
  )
}
export function GlobeIcon({
  size = defaults.size,
  style,
  strokeWidth = defaults.strokeWidth,
}: IconProps) {
  return (
    <Vector
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={[style]}
    >
      <Circle cx="12" cy="12" r="10" />
      <Line x1="2" y1="12" x2="22" y2="12" />
      <Path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </Vector>
  )
}
export function LockIcon({
  size = defaults.size,
  style,
  strokeWidth = defaults.strokeWidth,
}: IconProps) {
  return (
    <Vector
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={[style]}
    >
      <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Vector>
  )
}
export function UserPlusIcon({
  size = defaults.size,
  style,
  strokeWidth = defaults.strokeWidth,
}: IconProps) {
  return (
    <Vector
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={[style]}
    >
      <Path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <Circle cx="8.5" cy="7" r="4" />
      <Line x1="20" y1="8" x2="20" y2="14" />
      <Line x1="23" y1="11" x2="17" y2="11" />
    </Vector>
  )
}
export function StarIcon({
  size = defaults.size,
  style,
  strokeWidth = defaults.strokeWidth,
  filled = false,
}: IconProps & {
  filled?: boolean
}) {
  return (
    <Vector
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={[style]}
    >
      <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </Vector>
  )
}
export function MessageIcon({
  size = defaults.size,
  style,
  strokeWidth = defaults.strokeWidth,
}: IconProps) {
  return (
    <Vector
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={[style]}
    >
      <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Vector>
  )
}

export function SparklesIcon({ size = 20, style, strokeWidth = 1.8 }: IconProps) {
  return <Vector width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}><Path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" /><Path d="M20 2v4M18 4h4" /></Vector>
}
export function CompassIcon({ size = 24, style, strokeWidth = 1.8 }: IconProps) {
  return <Vector width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}><Circle cx="12" cy="12" r="9" /><Path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z" /></Vector>
}
export function PlusIcon({ size = 24, style, strokeWidth = 1.8 }: IconProps) {
  return <Vector width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" style={style}><Path d="M12 5v14M5 12h14" /></Vector>
}

function LineSymbol({ path, size = 20, style, strokeWidth = 1.75 }: IconProps & { path: string }) {
  return <Vector width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}><Path d={path} /></Vector>
}
export function CloseIcon(props: IconProps) { return <LineSymbol {...props} path="M6 6l12 12M18 6 6 18" /> }
export function EditIcon(props: IconProps) { return <LineSymbol {...props} path="m15 5 4 4M4 20l5-1L20 8a2.8 2.8 0 0 0-4-4L5 15l-1 5Z" /> }
export function SendIcon(props: IconProps) { return <LineSymbol {...props} path="M12 19V5m-6 6 6-6 6 6" /> }
export function CategoryIcon({ name = "", ...props }: IconProps & { name?: string }) {
  const key = name.toLocaleLowerCase("tr-TR");
  const path = /kahve|coffee|yemek/.test(key) ? "M4 8h12v6a5 5 0 0 1-10 0V8m10 1h2a3 3 0 0 1 0 6h-2M5 21h14M8 3v2m4-2v2"
    : /bisiklet/.test(key) ? "M8 16a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm16 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 16l5-9 5 9H4m5-9h8l3 9M7 4h4m5 0h3l1 3"
    : /müzik|konser|dans/.test(key) ? "M9 18V5l11-2v13M9 18a3 3 0 1 1-3-3c2 0 3 1 3 3Zm11-2a3 3 0 1 1-3-3c2 0 3 1 3 3Z"
    : /sanat|resim|seramik/.test(key) ? "M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h4a4 4 0 0 0 4-4c0-3-4-6-9-6Zm-5 7h.01M10 6h.01m5 1h.01"
    : /yürüyüş|doğa|kamp|tırman/.test(key) ? "m2 20 7-15 5 10 3-6 5 11H2Zm4-9 3 3 3-3"
    : /tenis|padel|raket/.test(key) ? "M19 3c3 3 2 7-1 10s-7 4-10 1-2-7 1-10 7-4 10-1ZM8 14l-5 7m3-5 2 2M10 5l8 8m-6-10 9 8"
    : /yüzme|deniz/.test(key) ? "M2 16c3-3 4 3 7 0s4 3 7 0 4 3 6 0M2 21c3-3 4 3 7 0s4 3 7 0 4 3 6 0M7 12l5-5 5 5m-5-5L8 3m8 1a2 2 0 1 0 0 .01"
    : "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm4 5-3 5-5 3 3-5 5-3Z";
  return <LineSymbol {...props} path={path} />;
}
