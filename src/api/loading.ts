type Listener = (pending: number) => void

const listeners = new Set<Listener>()
let pending = 0

function emit() { listeners.forEach(listener => listener(pending)) }

export const apiLoading = {
  begin() { pending += 1; emit() },
  end() { pending = Math.max(0, pending - 1); emit() },
  subscribe(listener: Listener) {
    listeners.add(listener)
    listener(pending)
    return () => listeners.delete(listener)
  },
}
