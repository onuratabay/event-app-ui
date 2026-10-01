import { useEffect } from 'react'
import { ApiEvent } from '../api/client'
import { onSocket, watchEvent } from './socket'
export function patchApiEvent(event: ApiEvent, patch: any): ApiEvent {
  if (event.id !== patch.eventId) return event
  return { ...event, ...(typeof patch.participantCount === 'number' ? { confirmedParticipantCount: patch.participantCount } : {}), ...(patch.status ? { status: { ...event.status, enum: patch.status } } : {}) }
}
export function useEventDeltas(ids: string[], patch: (value: any) => void) {
  const key = [...new Set(ids)].sort().slice(0, 500).join(',')
  useEffect(() => {
    const releases = key.split(',').filter(Boolean).map(watchEvent)
    const cleanups = ['event:summary', 'event:participant_count_changed', 'event:started', 'event:cancelled', 'event:ended', 'event:updated'].map(name => onSocket(name, patch))
    return () => { releases.forEach(release => release()); cleanups.forEach(cleanup => cleanup()) }
  }, [key])
}
