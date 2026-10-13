// Stateful API fixture: survives screen remounts, independent of device storage.
module.exports = function () {
  const { EVENTS } = require('../src/data.ts')
  const events = EVENTS.map(e => ({ id: e.id, owner: { id: 'host', firstName: 'Test', lastName: 'Host' }, interest: { id: 'padel', slug: 'padel', name: e.category }, level: { enum: 'beginner', name: e.level }, date: '01/10/2030', startTime: '18:30', durationMinutes: 60, latitude: 39.92, longitude: 32.85, locationName: e.location, minParticipants: 2, maxParticipants: 10, confirmedParticipantCount: 1, participants: [], coverPhoto: null, description: 'Sunucuda kayıtlı etkinlik', requirements: '', status: { enum: 'waiting_participants' }, isFavorite: false, viewerParticipationStatus: null }))
  const preferences = {}, messages = [], requests = [], notifications = []
  const user = { id: 'server-user', firstName: 'Sunucu', lastName: 'Kullanıcısı', city: 'Ankara', bio: 'Sunucu profili', profilePhoto: null }
  let interests = [{ id: 'padel', name: 'Padel' }]
  const suggestions = ['Su getir.', 'Raket gerekli.']
  const state = { createBlocked: false }
  const friends = [{ user: { id: 'friend-1', firstName: 'Ayşe', lastName: 'Arkadaş', profilePhoto: null } }]
  // "Etkinlik Takvimim" fixtures (test-only): availability records, pool candidates and sent pool invitations.
  const availabilities = [], poolInvites = []
  const candidates = [{ user: { id: 'cand-1', firstName: 'Ece', lastName: 'Aday', profilePhoto: null, rank: 4.6 }, match: { activity: 'Padel', level: 'Başlangıç', summary: ['Etkinlik saatinde müsait', 'Etkinlik konumu tercih ettiği bölgede'] } }]
  const invitations = [{ ...events[1], id: 'invite-1', owner: { id: 'inviter', firstName: 'Davet', lastName: 'Eden' }, viewerParticipationStatus: 'invited' }]
  // Versioned legal texts; every required one starts accepted so the consent gate stays closed unless a test opens it.
  const legalDocuments = [['terms', 'Kullanım Koşulları', true], ['community', 'Topluluk Kuralları', true], ['privacy', 'Gizlilik Politikası', true], ['kvkk', 'KVKK Aydınlatma Metni', true], ['marketing', 'Ticari Elektronik İleti İzni', false]]
    .map(([type, title, required]) => ({ type, title, required, version: 1, publishedAt: '2026-10-13T09:00:00+03:00', body: `${title} giriş paragrafı.\n\n## Topladığımız veriler\n- E-posta adresin diğer üyelere gösterilmez.\n- Rehberin saklanmaz.` }))
  const legal = { accepted: { terms: 1, community: 1, privacy: 1, kvkk: 1 }, marketing: false, posted: [] }
  const legalStatus = () => {
    const documents = legalDocuments.map(({ body: _body, ...doc }) => ({ ...doc, accepted: doc.type === 'marketing' ? legal.marketing : legal.accepted[doc.type] === doc.version, acceptedVersion: legal.accepted[doc.type] ?? null, acceptedAt: null }))
    return { documents, pending: documents.filter(doc => doc.required && !doc.accepted).map(doc => doc.type), marketing: legal.marketing }
  }
  const fetch = async (url, options = {}) => {
    const path = new URL(url).pathname, body = options.body ? JSON.parse(options.body) : null
    requests.push({ path, body, method: options.method || 'GET' })
    let result
    if (path === '/auth/me') { require('node:assert/strict').equal(options.method, 'POST'); result = user }
    else if (path === '/notifications') result = { items: notifications.map(row => ({ ...row })), unreadCount: notifications.filter(row => !row.readAt).length, nextCursor: null }
    else if (path === '/notifications/read-all') { notifications.forEach(row => row.readAt = new Date().toISOString()); result = { success: true } }
    else if (path.startsWith('/notifications/') && path.endsWith('/read')) { const row = notifications.find(row => row.id === path.split('/')[2]); if (row) row.readAt = new Date().toISOString(); result = { success: true } }
    else if (path === '/legal/documents') result = { items: legalDocuments.map(({ body: _body, ...doc }) => doc) }
    else if (path.startsWith('/legal/documents/')) result = legalDocuments.find(doc => doc.type === path.split('/').pop())
    else if (path === '/legal/consents/marketing') { legal.marketing = body.granted; result = legalStatus() }
    else if (path === '/legal/consents' && options.method === 'POST') { legal.posted.push(body.documents); body.documents.forEach(doc => { legal.accepted[doc.type] = doc.version }); result = legalStatus() }
    else if (path === '/legal/consents') result = legalStatus()
    else if (path === '/users/me/preferences') result = { ...preferences }
    else if (path.startsWith('/users/me/preferences/')) { preferences[path.split('/').pop()] = body.value; result = body.value }
    else if (path === '/users/me/profile') { Object.assign(user, body); result = { ...user } }
    else if (path === '/users/me/interests') { if (body) interests = body.interestIds.map(id => ({ id, name: 'Padel' })); result = interests }
    else if (path === '/interests') result = [{ id: 'padel', name: 'Padel', slug: 'padel', levels: [{ id: 'beginner', enum: 'beginner', name: 'Başlangıç' }] }, { id: 'kahve', name: 'Kahve', slug: 'kahve', levels: [] }]
    else if (path === '/enum-values') result = new URL(url).searchParams.get('group') === 'event_level' ? [{ id: 'beginner', enum: 'beginner', name: 'Başlangıç' }] : [{ id: 'public', enum: 'public', name: 'Herkese Açık' }, { id: 'recommended', enum: 'recommended', name: 'Önerilenler' }, { id: 'invite_only', enum: 'invite_only', name: 'Sadece Davet' }]
    else if (path === '/events/can-create') result = { canCreate: !state.createBlocked, message: state.createBlocked ? 'Yeni etkinlik açma hakkınız kalmadı. Daha fazlası için dükkana gidin.' : null }
    else if (path === '/users/me/settings') result = { canCreateInviteOnly: true }
    else if (path === '/friends') { require('node:assert/strict').equal(new URL(url).searchParams.get('active'), 'true'); result = { items: [...friends] } }
    else if (path === '/events/invitations') result = { items: [...invitations], total: invitations.length }
    else if (path === '/users/me/availability') { if (options.method === 'POST') { const record = { id: `availability-${availabilities.length + 1}`, status: 'active', ...body }; availabilities.unshift(record); result = { ...record } } else result = { items: availabilities.map(item => ({ ...item })) } }
    else if (path.startsWith('/users/me/availability/')) {
      const [, , , , id, action] = path.split('/'); const record = availabilities.find(item => item.id === id)
      if (options.method === 'DELETE') { availabilities.splice(availabilities.indexOf(record), 1); result = { message: 'Müsaitlik kaydı kaldırıldı.' } }
      else { if (action === 'pause') record.status = 'paused'; else if (action === 'resume') record.status = 'active'; else Object.assign(record, body); result = { ...record } }
    }
    else if (path === '/events/candidates/preview') result = { items: candidates.filter(item => !poolInvites.some(invite => invite.userId === item.user.id)) }
    else if (path.endsWith('/candidates')) result = { capacity: { confirmed: 1, max: 4, spotsLeft: 3 }, items: candidates.filter(item => !poolInvites.some(invite => invite.userId === item.user.id)) }
    else if (path.endsWith('/invitations') && body) { const expiresAt = new Date(Date.now() + 86400000).toISOString(); body.userIds.forEach(userId => poolInvites.push({ eventId: path.split('/')[2], userId, expiresAt })); result = { invited: body.userIds.length, expiresAt } }
    else if (path.startsWith('/events/invite-1/')) { const invite = invitations.splice(0, 1)[0]; result = { ...invite, viewerParticipationStatus: path.endsWith('/join') ? 'confirmed' : 'declined' } }
    else if (path.endsWith('/messages/read')) result = { eventId: path.split('/')[2], unreadCount: 0 }
    else if (path.endsWith('/messages')) { if (body) messages.push({ id: String(messages.length), text: body.text, user, createdAt: new Date().toISOString() }); result = body ? messages.at(-1) : { items: [...messages] } }
    else if (path === '/events/mine/suggestions') { if (body) suggestions.splice(suggestions.indexOf(body.text), 1); result = { items: [...suggestions] } }
    else if (path === '/events/rooms') result = []
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
  return { fetch, legal, legalDocuments, events, preferences, requests, notifications, user, saveMessage, suggestions, invitations, state, availabilities, poolInvites }
}
