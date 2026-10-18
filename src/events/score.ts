/** Rating averages show at most one decimal with a Turkish comma: 4,6 · 4,5 · 5 (4,67 rounds to 4,7). */
export function formatScore(score: number) {
  return String(Math.round(score * 10) / 10).replace(".", ",")
}
