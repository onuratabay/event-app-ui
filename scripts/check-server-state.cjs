module.exports = async ({ mount, tap, act, text, storage }) => {
  const assert = require('node:assert/strict')
  const originalFetch = global.fetch
  const server = require('./mock-server.cjs')()
  global.fetch = server.fetch
  const sockets = require('./mock-socket.cjs')
  sockets.setAction(async (name, payload) => {
    if (name === 'chat:message') return server.saveMessage(payload.text)
    return {}
  })
  storage.clear(); storage.set('event-app:access-token', 'valid-session')
  const legacy = { user: { id: server.user.id, recommendationProfile: { equipmentByCity: { izmir: ['racket'] }, activitiesByPlace: {}, trip: { placeId: 'izmir', datePreset: 'week', dateFrom: '', dateTo: '' } } }, events: [] }
  storage.set('event-app:v1', JSON.stringify(legacy))
  let tree = await mount('Profile')
  assert(text(tree.toJSON()).includes('Sunucu Kullanıcısı'))
  assert(text(tree.toJSON()).includes('Sunucu profili'))
  assert.equal(storage.has('event-app:v1'), false)
  assert(server.preferences.recommendationProfile.equipmentByCity.izmir.includes('racket'))
  await act(async () => tree.unmount())
  server.user.bio = 'Başka cihazda güncellendi'
  tree = await mount('Profile')
  assert(text(tree.toJSON()).includes('Başka cihazda güncellendi'))
  await act(async () => tree.unmount())
  const oldWrites = server.requests.filter(r => r.method === 'PUT').length
  storage.set('event-app:v1', JSON.stringify({ ...legacy, user: { ...legacy.user, id: 'different-account' } }))
  tree = await mount('Profile')
  assert.equal(server.requests.filter(r => r.method === 'PUT').length, oldWrites, 'Do not migrate another account’s data')
  await act(async () => tree.unmount())
  assert(storage.has('event-app:v1'), 'Preserve another account’s legacy cache until that account signs in')
  storage.delete('event-app:v1')
  // Failed mutations must not appear saved in the UI or on another screen.
  const online = global.fetch
  tree = await mount('Discover')
  const HeartButton = require('../src/components/Expressive.tsx').HeartButton
  const heart = tree.root.findAllByType(HeartButton)[0]
  global.fetch = async (url, options) => url.endsWith('/favorite') ? { ok: false, status: 500, text: async () => 'failed' } : online(url, options)
  await act(async () => heart.props.onChange(true))
  assert.equal(tree.root.findAllByType(HeartButton)[0].props.saved, false)
  await act(async () => tree.unmount())
  global.fetch = online
  const nativeInterval = global.setInterval
  let intervals = 0
  global.setInterval = (...args) => { intervals++; return nativeInterval(...args) }
  tree = await mount('EventRoom', { eventId: server.events[0].id })
  global.setInterval = nativeInterval
  assert.equal(intervals, 0, 'Chat must not schedule background polling')
  const beforeRefresh = server.requests.filter(r => r.path.endsWith('/messages') && r.method === 'GET').length
  const refresh = tree.root.findAllByType('Pressable').find(n => n.props.accessibilityLabel === 'Mesajları yenile')
  await act(async () => refresh.props.onPress())
  assert.equal(server.requests.filter(r => r.path.endsWith('/messages') && r.method === 'GET').length, beforeRefresh + 1)
  const beforePush = server.requests.length
  await act(async () => sockets.instances.at(-1).receive('chat:message_created', { eventId: server.events[0].id, message: { id: 'push', text: 'Canlı mesaj', createdAt: new Date().toISOString(), user: server.user } }))
  assert(text(tree.toJSON()).includes('Canlı mesaj'))
  assert.equal(server.requests.length, beforePush, 'A socket message must not refetch REST history')
  const input = tree.root.findByType('TextInput')
  await act(async () => input.props.onChangeText('Sunucuda saklanan mesaj'))
  const send = tree.root.findAllByType('Pressable').find(n => n.props.accessibilityLabel === 'Mesaj gönder')
  await act(async () => send.props.onPress())
  await act(async () => tree.unmount())
  tree = await mount('EventRoom', { eventId: server.events[0].id })
  assert(text(tree.toJSON()).includes('Sunucuda saklanan mesaj'))
  await act(async () => tree.unmount())
  // An empty backend must render an empty feed, never demo events.
  server.events.splice(0)
  tree = await mount('Discover')
  assert(!text(tree.toJSON()).includes('Padel After Work'))
  await act(async () => tree.unmount())
  global.fetch = async () => { throw new Error('offline') }
  tree = await mount('Profile')
  assert(tree.root.findByType(require('../src/components/ErrorNotice.tsx').ErrorNotice).props.message.includes('Hesap verileri sunucudan yüklenemedi'))
  assert(!text(tree.toJSON()).includes('Sunucu profili'))
  await act(async () => tree.unmount())
  assert([...storage.keys()].every(key => key.includes('token')), 'Only session tokens remain locally')
  storage.clear(); global.fetch = originalFetch
  console.log('PASS: backend profile restoration, cross-device updates, owned legacy migration, account isolation, empty/offline states and token-only device storage.')
}
