import { useState } from "react"
import { StyleSheet } from "react-native"
import { Box, Label, Touch } from "../native/UI"
import { palette } from "../theme/palette"
import { localDate } from "../map/filters"
import { addDays, formatDay, lastSelectableDay, MONTHS, pickDay, todayIso, WEEKDAY_LONG, WEEKDAY_SHORT, WEEKDAYS, isoWeekday } from "./model"

const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`
function shiftMonth(first: string, delta: number) {
  const date = new Date(`${first}T12:00:00`)
  date.setMonth(date.getMonth() + delta, 1)
  return localDate(date)
}
function monthCells(first: string) {
  const lead = isoWeekday(first) - 1
  const date = new Date(`${first}T12:00:00`)
  const length = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const cells: Array<string | null> = Array.from({ length: lead }, () => null)
  for (let day = 0; day < length; day++) cells.push(addDays(first, day))
  while (cells.length % 7) cells.push(null)
  return cells
}

// Start and end are tapped in turn, like a hotel booking; tapping the start again makes it a single day.
export default function RangeCalendar({ startDate, endDate, onChange, now = new Date() }: { startDate: string; endDate: string; onChange: (range: { startDate: string; endDate: string }) => void; now?: Date }) {
  const today = todayIso(now), last = lastSelectableDay(now)
  const [month, setMonth] = useState(monthStart(startDate || today))
  const end = endDate || startDate
  const date = new Date(`${month}T12:00:00`)
  const canGoBack = month > monthStart(today), canGoForward = month < monthStart(last)
  return <Box style={s.wrap}>
    <Box style={s.summary}>
      {[{ label: "Başlangıç", value: startDate }, { label: "Bitiş", value: endDate || (startDate ? startDate : "") }].map((item, index) => <Box key={item.label} style={[s.summaryCell, index === 1 && !endDate && startDate ? s.summaryPending : null]}>
        <Label style={s.summaryLabel}>{item.label}</Label>
        <Label style={s.summaryValue}>{item.value ? formatDay(item.value) : "Seç"}</Label>
      </Box>)}
    </Box>
    <Box style={s.header}>
      <Touch accessibilityLabel="Önceki ay" disabled={!canGoBack} onPress={() => setMonth(shiftMonth(month, -1))} style={s.nav}><Label style={s.navText}>‹</Label></Touch>
      <Label style={s.month} accessibilityRole="header">{MONTHS[date.getMonth()]} {date.getFullYear()}</Label>
      <Touch accessibilityLabel="Sonraki ay" disabled={!canGoForward} onPress={() => setMonth(shiftMonth(month, 1))} style={s.nav}><Label style={s.navText}>›</Label></Touch>
    </Box>
    <Box style={s.row}>
      {WEEKDAYS.map(day => <Box key={day} style={s.cell}><Label style={s.weekday}>{WEEKDAY_SHORT[day]}</Label></Box>)}
    </Box>
    <Box style={s.grid}>
      {monthCells(month).map((day, index) => {
        if (!day) return <Box key={`empty-${index}`} style={s.cell} />
        const disabled = day < today || day > last
        const isStart = day === startDate, isEnd = !!startDate && day === end
        const inRange = !!startDate && day > startDate && day < end
        const edge = isStart || isEnd
        const label = `${formatDay(day)}, ${WEEKDAY_LONG[isoWeekday(day)]}${isStart ? ", başlangıç" : ""}${isEnd && end !== startDate ? ", bitiş" : ""}${disabled ? ", seçilemez" : ""}`
        return <Box key={day} style={[s.cell, (inRange || edge && startDate !== end) && s.band, isStart && startDate !== end && s.bandStart, isEnd && startDate !== end && s.bandEnd]}>
          <Touch accessibilityLabel={label} accessibilityState={{ selected: edge || inRange }} disabled={disabled} disabledOpacity={0.28} haptic={false} onPress={() => onChange(pickDay({ startDate, endDate }, day, now))} style={[s.day, edge && s.dayEdge, day === today && !edge && s.today]} gradient={edge ? palette.actionGradient : undefined}>
            <Label style={[s.dayText, edge && s.dayTextEdge, inRange && s.dayTextRange]}>{Number(day.slice(8))}</Label>
          </Touch>
        </Box>
      })}
    </Box>
    <Label style={s.hint}>{!startDate ? "Başlangıç gününe dokun." : !endDate ? "Bitiş gününe dokun. Tek gün için aynı güne tekrar dokunabilir ya da böyle bırakabilirsin." : "Yeni bir aralık için başlangıç gününe dokun."}</Label>
  </Box>
}

const s = StyleSheet.create({
  wrap: { gap: 10 },
  summary: { flexDirection: "row", gap: 10 },
  summaryCell: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: "rgba(8,11,24,.55)", paddingHorizontal: 12, paddingVertical: 9 },
  summaryPending: { borderStyle: "dashed" },
  summaryLabel: { color: palette.muted, fontSize: 11, lineHeight: 15, letterSpacing: 1, textTransform: "uppercase" },
  summaryValue: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 15, lineHeight: 21 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nav: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  navText: { color: palette.text, fontSize: 24, lineHeight: 28 },
  month: { color: palette.text, fontFamily: "Outfit-SemiBold", fontSize: 15, lineHeight: 20 },
  row: { flexDirection: "row" },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 4 },
  cell: { width: "14.2857%", alignItems: "center", justifyContent: "center", minHeight: 44 },
  weekday: { color: palette.muted, fontSize: 11, lineHeight: 15 },
  band: { backgroundColor: "rgba(105,120,255,.16)" },
  bandStart: { borderTopLeftRadius: 20, borderBottomLeftRadius: 20 },
  bandEnd: { borderTopRightRadius: 20, borderBottomRightRadius: 20 },
  day: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  dayEdge: { borderWidth: 1, borderColor: "rgba(183,197,255,.34)" },
  today: { borderWidth: 1, borderColor: "rgba(183,197,255,.28)" },
  dayText: { color: palette.text, fontSize: 14, lineHeight: 18, textAlign: "center" },
  dayTextEdge: { fontFamily: "Outfit-SemiBold" },
  dayTextRange: { color: palette.accent },
  hint: { color: palette.muted, fontSize: 12, lineHeight: 17 },
})
