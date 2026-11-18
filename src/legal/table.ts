// The imported KVKK document stores each original row as three consecutive sections.
// Rebuild only complete, recognised rows; leave any other document format intact.
export const KVKK_COLUMNS = [
  "Kişisel Veri İşleme Amaçları",
  "Kişisel Veri İşlemenin Hukuki Sebebi",
  "İşlenen Kişisel Veriler",
] as const

export function parseKvkkTable(text: string) {
  const normalized = text.replace(/\r\n/g, "\n")
  const start = normalized.indexOf(`## ${KVKK_COLUMNS[0]}\n`)
  if (start < 0) return null
  const rest = normalized.slice(start)
  const end = rest.search(/^## 3\. /m)
  if (end < 0) return null
  const section = rest.slice(0, end)
  const parts = section.split(/^## (.+)\n/gm)
  if (parts[0].trim() || (parts.length - 1) % 6) return null
  const rows: string[][] = []
  for (let i = 1; i < parts.length; i += 6) {
    const row: string[] = []
    for (let col = 0; col < 3; col++) {
      if (parts[i + col * 2] !== KVKK_COLUMNS[col] || !parts[i + col * 2 + 1].trim()) return null
      row.push(parts[i + col * 2 + 1].trim())
    }
    rows.push(row)
  }
  if (!rows.length) return null
  return { before: normalized.slice(0, start).trim(), rows, after: rest.slice(end).trim() }
}
