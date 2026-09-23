// Stateful API fixture: survives screen remounts, independent of device storage.
module.exports = function () {
  const { EVENTS } = require('../src/data.ts')
  const events = EVENTS.map(e => ({ id: e.id, owner: { id: 'host', firstName: 'Test', lastName: 'Host' }, interest: { id: 'padel', slug: 'padel', name: e.category }, level: { enum: 'beginner', name: e.level }, date: '01/10/2030', startTime: '18:30', durationMinutes: 60, latitude: 39.92, longitude: 32.85, locationName: e.location, minParticipants: 2, maxParticipants: 10, confirmedParticipantCount: 1, participants: [], coverPhoto: null, description: 'Sunucuda kayıtlı etkinlik', requirements: '', status: { enum: 'waiting_participants' }, isFavorite: false, viewerParticipationStatus: null }))
  const preferences = {}, messages = [], requests = []
  const user = { id: 'server-user', firstName: 'Sunucu', lastName: 'Kullanıcısı', city: 'Ankara', bio: 'Sunucu profili', profilePhoto: null }
  let interests = [{ id: 'padel', name: 'Padel' }]
  const fetch = async (url, options = {}) => {
    const path = new URL(url).pathname, body = options.body ? JSON.parse(options.body) : null
    requests.push({ path, body, method: options.method || 'GET' })
    let result
    if (path === '/auth/me') { require('node:assert/strict').equal(options.method, 'POST'); result = user }
    else if (path === '/users/me/preferences') result = { ...preferences }
    else if (path.startsWith('/users/me/preferences/')) { preferences[path.split('/').pop()] = body.value; result = body.value }
    else if (path === '/users/me/profile') { Object.assign(user, body); result = { ...user } }
    else if (path === '/users/me/interests') { if (body) interests = body.interestIds.map(id => ({ id, name: 'Padel' })); result = interests }
    else if (path === '/interests') result = [{ id: 'padel', name: 'Padel', slug: 'padel' }]
    else if (path === '/enum-values') result = new URL(url).searchParams.get('group') === 'event_level' ? [{ id: 'beginner', enum: 'beginner', name: 'Başlangıç' }] : [{ id: 'public', enum: 'public', name: 'Herkese Açık' }]
    else if (path.endsWith('/messages')) { if (body) messages.push({ id: String(messages.length), text: body.text, user, createdAt: new Date().toISOString() }); result = body ? messages.at(-1) : { items: [...messages] } }
    else if (path === '/events' && body) { const event = { ...events[0], ...body, id: 'created-on-server', owner: user }; events.unshift(event); result = event }
    else if (path === '/events' || ['/events/mine','/events/participating','/events/favorites'].includes(path)) result = { items: [...events], total: events.length }
    else if (path.startsWith('/events/')) {
      const [, , id, action] = path.split('/'); const event = events.find(e => e.id === id)
      if (action === 'join') { event.viewerParticipationStatus = 'confirmed'; event.participants = [user] }
      if (action === 'leave') { event.viewerParticipationStatus = null; event.participants = [] }
      if (action === 'favorite') event.isFavorite = options.method === 'PUT'
      result = { ...event }
    } else result = { items: [], total: 0 }
    return { ok: true, status: 200, json: async () => result }
  }
  const saveMessage = text => { const message = { id: String(messages.length), text, user, createdAt: new Date().toISOString() }; messages.push(message); return message }
  return { fetch, events, preferences, requests, user, saveMessage }
}
