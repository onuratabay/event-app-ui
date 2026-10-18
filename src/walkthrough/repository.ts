import { emptyState, hasSeen, mergeState, parseState, recordProgress, WALKTHROUGH_VERSION, type ProgressAction, type WalkthroughState } from "./model"

type Reply = { accountId: string; state: WalkthroughState; granted?: boolean }
interface Dependencies {
  read: (key: string) => Promise<string | null>
  write: (key: string, value: string) => Promise<void>
  get: () => Promise<Reply>
  update: (action: ProgressAction) => Promise<Reply>
}
/** One instance per account/session. Local storage can suppress, but never authorize autoplay. */
export class WalkthroughRepository {
  state = emptyState()
  remoteReady = false
  private pending: ProgressAction[] = []
  private writes = Promise.resolve()
  private syncing: Promise<void> | null = null
  private disposed = false
  private listeners = new Set<() => void>()
  readonly key: string
  get needsSync() { return this.pending.length > 0 }
  constructor(readonly accountId: string, private readonly deps: Dependencies) { this.key = `event-app:walkthroughs:${accountId}:v1` }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private emit() { if (!this.disposed) this.listeners.forEach(listener => listener()) }
  private save() {
    const value = JSON.stringify({ accountId: this.accountId, state: this.state, pending: this.pending })
    this.writes = this.writes.catch(() => {}).then(() => this.deps.write(this.key, value)).catch(() => {})
    return this.writes
  }
  private accept(reply: Reply) {
    if (reply.accountId !== this.accountId) throw new Error("Rehber hesabı değişti")
    this.state = mergeState(this.state, parseState(reply.state)); this.emit()
  }
  async load() {
    try {
      const raw = await this.deps.read(this.key)
      const cached = raw ? JSON.parse(raw) : null
      if (cached?.accountId === this.accountId) {
        this.state = mergeState(this.state, parseState(cached.state))
        this.pending = Array.isArray(cached.pending) ? cached.pending.filter((a: ProgressAction) => a && typeof a.id === "string" && /^[a-z][a-z0-9-]{0,63}$/.test(a.id) && ["guide", "tip"].includes(a.kind) && ["complete", "skip"].includes(a.action) && Number.isInteger(a.version) && a.version > 0 && a.version <= 10000).slice(0, 256) : []
        this.emit()
      }
    } catch { /* Corrupt cache must not reset server progress. */ }
    await this.refresh()
  }
  async refresh() {
    if (this.disposed) return
    try { this.accept(await this.deps.get()); if (this.disposed) return; this.remoteReady = true; await this.flush(); await this.save(); this.emit() }
    catch { /* Unknown remote state: defer automatic guides, leave the app usable. */ }
  }
  async claim(id: string, kind: "guide" | "tip" = "guide") {
    if (this.disposed || !this.remoteReady || hasSeen(this.state, id, kind)) return false
    try {
      const reply = await this.deps.update({ id, kind, action: "claim", version: WALKTHROUGH_VERSION })
      this.accept(reply); await this.save()
      return !this.disposed && reply.granted === true
    } catch { return false }
  }
  async finish(id: string, action: "complete" | "skip") {
    if (this.disposed) return
    const progress: ProgressAction = { id, kind: "guide", action, version: WALKTHROUGH_VERSION }
    this.state = recordProgress(this.state, progress)
    this.pending = [...this.pending.filter(item => item.id !== id || item.action === "complete" && action === "skip"), progress]
    this.emit(); await this.save(); await this.flush()
  }
  flush() {
    if (this.syncing) return this.syncing
    this.syncing = (async () => {
      while (this.pending.length && !this.disposed) {
        const action = this.pending[0]
        try {
          this.accept(await this.deps.update(action))
          this.pending = this.pending.filter(item => item !== action)
          await this.save()
        } catch { break }
      }
    })().finally(() => { this.syncing = null })
    return this.syncing
  }
  dispose() { this.disposed = true; this.listeners.clear() }
}
