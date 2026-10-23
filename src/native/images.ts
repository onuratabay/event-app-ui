/** Existing project stock covers: presentation fallbacks, never server event data. */
const covers = {
  sport: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=900&h=600&fit=crop&auto=format",
  art: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=900&h=600&fit=crop&auto=format",
  outdoors: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=900&h=600&fit=crop&auto=format",
  music: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=900&h=600&fit=crop&auto=format",
  coffee: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=900&h=600&fit=crop&auto=format",
} as const
/** The stock cover that fits this activity, or null when none does (then only the generic fallback is left). */
export function matchingCover(category: string): string | null {
  const name = category.toLocaleLowerCase("tr-TR")
  if (/kahve|coffee|gastronomi|yemek/.test(name)) return covers.coffee
  if (/müzik|konser|music|dans/.test(name)) return covers.music
  if (/sanat|foto|art|seramik/.test(name)) return covers.art
  if (/padel|tenis|tennis|spor|yoga|fitness/.test(name)) return covers.sport
  if (/koş|doğa|yürüy|hiking|trek|bisiklet|kamp|outdoor|seyahat|gezi/.test(name)) return covers.outdoors
  return null
}
export function defaultEventCover(category: string): string {
  return matchingCover(category) ?? covers.outdoors
}
