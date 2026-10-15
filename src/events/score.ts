/** Rating averages show at most two decimals with a Turkish comma: 4,67 · 4,5 · 5. */
export function formatScore(score: number) {
  return String(Math.round(score * 100) / 100).replace(".", ",")
}
