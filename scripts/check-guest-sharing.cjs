module.exports = async ({ act, text, storage, tap, audit }) => {
  const assert = require('node:assert/strict')
  const React = require('react')
  const { create } = require('react-test-renderer')
  const api = require('../src/api/client.ts')
  const { parseGuestCode } = require('../src/guest/links.ts')
  const { redirectSystemPath } = require('../app/+native-intent.tsx')
  const { GuestProvider, useGuest } = require('../src/guest/GuestSession.tsx')
  const GuestScreen = require('../src/screens/GuestEventScreen.tsx').default
  const ShareSheet = require('../src/components/EventShareSheet.tsx').default
  const Boundary = require('../src/guest/GuestRouteBoundary.tsx').default
  const { StoreProvider, useStore } = require('../src/native/Store.tsx')
  const Splash = require('../src/screens/SplashScreen.tsx').default
  const code = 'EWT-abcdefghijklmnopqrstuvwx'
  const event = { id: 'event-1', title: 'Padel buluşması', date: '01/10/2030', time: '18:30', location: 'Ankara', category: 'Padel', description: 'Birlikte oynayalım', requirements: '', minParticipants: 2, maxParticipants: 5, participantCount: 1, status: 'waiting_participants', hostName: 'Organizatör' }
  const originalFetch = global.fetch
  const requests = []
  let joined = false
  let memberApproved = true
  let holdJoin = false
  let finishHeldJoin
  const secondCode = 'EWT-' + 'z'.repeat(24)
  global.fetch = async (url, options = {}) => {
    const path = new URL(url).pathname
    requests.push({ path, ...options })
    let value = {}
    if (path.endsWith('/share')) value = { url: `https://ewent.app/e/${code}`, code, expiresAt: '2030-10-01T18:30:00Z', responsibilityAcceptedAt: new Date().toISOString() }
    else if (path === '/auth/me') value = { id: 'member', firstName: 'Üye', lastName: 'Test', status: { enum: memberApproved ? 'approved' : 'profile_incomplete' } }
    else if (path.startsWith('/guest/events/')) {
      if (path.endsWith('/join')) {
        if (holdJoin && options.method === 'POST') await new Promise(resolve => { finishHeldJoin = resolve })
        joined = options.method === 'POST'
        value = { session: 'a'.repeat(64), name: 'Ayşe', expiresAt: '2030-10-01T18:30:00Z', resumed: false }
      } else if (path.endsWith('/participation')) value = { joined, name: 'Ayşe', expiresAt: '2030-10-01T18:30:00Z' }
      else value = { event: { ...event, ...(path.includes(secondCode) ? { id: 'event-2', title: 'Tenis buluşması', participantCount: 1 } : { participantCount: joined ? 2 : 1 }) }, imageUrl: '' }
    }
    return { ok: true, status: 200, json: async () => value }
  }
  assert.equal(parseGuestCode(`https://ewent.app/e/${code}`), code)
  assert.equal(parseGuestCode(`/e/${code}`), code)
  assert.equal(parseGuestCode('11111111'), null, 'An event ID is not an authorized guest code')
  assert.equal(redirectSystemPath({ path: `https://ewent.app/e/${code}`, initial: true }), `/guest-event?code=${code}`)
  assert.equal(redirectSystemPath({ path: 'https://ewent.app/e/invalid', initial: true }), '/guest-entry')
  storage.clear(); storage.set('event-app.access-token', 'regular-member-token')
  const press = async (tree, label) => {
    const node = tree.root.findAllByType('Pressable').filter(node => text(node).includes(label)).sort((a, b) => text(a).length - text(b).length)[0]
    assert(node, label); await act(async () => { node.props.onPress({ stopPropagation() {} }); await new Promise(resolve => setTimeout(resolve, 20)) })
  }
  let tree
  await act(async () => { tree = create(React.createElement(ShareSheet, { event, onClose() {} })) })
  let copy = tree.root.findAllByType('Pressable').find(node => node.props.accessibilityLabel === 'Bağlantıyı kopyala')
  assert(copy.props.disabled, 'Sharing is disabled before responsibility consent')
  assert(!requests.some(row => row.path.endsWith('/share')))
  const checkbox = tree.root.findAllByType('Pressable').find(node => node.props.accessibilityRole === 'checkbox')
  await act(async () => checkbox.props.onPress())
  await press(tree, 'Bağlantıyı kopyala')
  assert.deepEqual(JSON.parse(requests.find(row => row.path.endsWith('/share')).body), { acceptResponsibility: true })
  assert.equal(global.__clipboard, `https://ewent.app/e/${code}`, 'Copy uses a personal HTTPS link')
  // Each platform opens directly with the invite prefilled; "Diğer" is the system share sheet.
  await press(tree, 'WhatsApp')
  assert(global.__openedUrl.startsWith('whatsapp://send?text=') && decodeURIComponent(global.__openedUrl).includes(`https://ewent.app/e/${code}`), 'WhatsApp opens with the invite prefilled')
  await press(tree, 'Diğer')
  assert(global.__lastShare.message.includes(`https://ewent.app/e/${code}`))
  assert.equal(requests.filter(row => row.path.endsWith('/share')).length, 1, 'The same panel reuses its accepted link')
  // "Kartı paylaş" captures the event card as an image and shares it with the invite text (iOS: one share).
  global.__capturedCard = false
  await act(async () => { tree.root.findAllByType('Pressable').find(node => node.props.accessibilityLabel === 'Kartı paylaş').props.onPress(); await new Promise(resolve => setTimeout(resolve, 120)) })
  assert(global.__capturedCard, 'The card is captured as an image')
  assert.equal(global.__lastShare.url, 'file:///tmp/ewent-card.png', 'The image is shared')
  assert(global.__lastShare.message.includes(`https://ewent.app/e/${code}`) && global.__lastShare.message.includes('24 saat'), 'with the invite link and its validity')
  assert(text(tree.toJSON()).includes('tarihine kadar geçerli'), 'The card and the screen show until when the invite works')
  assert.equal(requests.filter(row => row.path.endsWith('/share')).length, 1, 'The card reuses the accepted link')
  await act(async () => tree.unmount())

  global.__testParams = { code }
  global.__testPathname = '/guest-event'
  await act(async () => { tree = create(React.createElement(GuestProvider, null, React.createElement(GuestScreen))) })
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
  assert(text(tree.toJSON()).includes('Padel buluşması'))
  assert(!text(tree.toJSON()).includes('Giriş Yap'))
  const beforeAccountRequest = requests.length
  await assert.rejects(api.getCurrentUser(), /Misafir oturumunda/)
  assert.equal(requests.length, beforeAccountRequest, 'Hidden account routes cannot send a member API call in guest mode')
  const name = tree.root.findByType('TextInput')
  await act(async () => name.props.onChangeText('Ayşe'))
  await press(tree, 'Katıl')
  assert(text(tree.toJSON()).includes('Katıldın · Misafir Ayşe'))
  const saved = JSON.parse(storage.get('event-app:guest-token'))
  assert.equal(saved.code, code); assert.equal(saved.name, 'Ayşe')
  assert(requests.filter(row => row.path.startsWith('/guest/events/')).every(row => !row.headers.Authorization), 'Guest calls never reuse a member bearer token')
  assert.equal(storage.get('event-app.access-token'), 'regular-member-token', 'Guest credentials do not replace account credentials')
  await act(async () => tree.unmount())
  await act(async () => { tree = create(React.createElement(GuestProvider, null, React.createElement(GuestScreen))) })
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
  assert(text(tree.toJSON()).includes('Katıldın · Misafir Ayşe'), 'Guest sessions resume after reopening the app')
  assert.equal(requests.filter(row => row.path.endsWith('/join') && row.method === 'POST').length, 1, 'Resume never takes another place')
  await press(tree, 'Katılımı iptal et')
  assert(!JSON.parse(storage.get('event-app:guest-token')).session)
  await act(async () => tree.unmount())

  // Account startup and sockets remain suspended even with an existing member token.
  let capturedStore
  function CaptureStore() { capturedStore = useStore(); return React.createElement('Text', null, 'guest-store') }
  const beforeStartup = requests.length
  await act(async () => { tree = create(React.createElement(GuestProvider, null, React.createElement(StoreProvider, null, React.createElement(CaptureStore), React.createElement(Splash, { navigate() {} })))) })
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
  assert.equal(capturedStore.data.user.id, '', 'Guest mode never exposes the preserved member store')
  assert.equal(requests.length, beforeStartup, 'Member startup requests do not run under a guest session')
  assert.equal(require('../src/services/socket.ts').socketConnected(), false, 'Member socket is suspended in guest mode')
  assert.equal(storage.get('event-app.access-token'), 'regular-member-token', 'Guest startup does not accidentally log out the member')
  await act(async () => tree.unmount())

  // A response for the previous link cannot overwrite the currently active guest event.
  holdJoin = true
  global.__testParams = { code }
  await act(async () => { tree = create(React.createElement(GuestProvider, null, React.createElement(GuestScreen))) })
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
  await act(async () => tree.root.findByType('TextInput').props.onChangeText('Ayşe'))
  await press(tree, 'Katıl')
  assert(finishHeldJoin, 'The old event join is pending')
  global.__testParams = { code: secondCode }
  await act(async () => { tree.update(React.createElement(GuestProvider, null, React.createElement(GuestScreen))); await new Promise(resolve => setTimeout(resolve, 20)) })
  await act(async () => { finishHeldJoin(); await new Promise(resolve => setTimeout(resolve, 20)) })
  holdJoin = false
  assert.equal(JSON.parse(storage.get('event-app:guest-token')).code, secondCode, 'Old join results cannot reactivate the previous link')
  assert(!JSON.parse(storage.get('event-app:guest-token')).session, 'An old event session cannot be attached to the new event')
  assert(text(tree.toJSON()).includes('Tenis buluşması'))
  await act(async () => tree.unmount())

  // A direct link to an unrelated route is hidden until the guard returns to the guest event.
  global.__testPathname = '/discover'; global.__testNavigations = []; global.__testRootState = { key: 'root', index: 0, routes: [{ name: 'discover' }] }
  await act(async () => { tree = create(React.createElement(GuestProvider, null, React.createElement(Boundary, null, React.createElement('Text', null, 'UNRELATED-CONTENT')))) })
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
  assert(global.__testNavigations.includes('/guest-event'), 'Guest routes cannot enter Discover even through a direct link')
  const protectedView = tree.root.findAllByType('View').find(node => node.props.importantForAccessibility === 'no-hide-descendants')
  assert(protectedView && protectedView.props.pointerEvents === 'none', 'Blocked route content cannot be interacted with or exposed to accessibility')
  assert.equal(protectedView.props.style.opacity, 0, 'Blocked content is hidden before the redirect')
  await act(async () => tree.unmount())
  global.__testPathname = '/guest-event'
  await act(async () => { tree = create(React.createElement(GuestProvider, null, React.createElement(GuestScreen))) })
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
  memberApproved = false
  await press(tree, 'Üyeliğime dön')
  assert(storage.has('event-app:guest-token'), 'Unapproved member responses cannot remove the guest restriction')
  memberApproved = true
  await press(tree, 'Üyeliğime dön')
  assert.equal(JSON.parse(storage.get('event-app:guest-token')).active, false, 'Returning to a verified member suspends guest mode without losing an existing guest participation')
  assert.equal(storage.get('event-app.access-token'), 'regular-member-token')
  assert(global.__testNavigations.includes('/discover'))
  await act(async () => tree.unmount())
  let restoredGuest
  function CaptureGuest() { restoredGuest = useGuest(); return React.createElement('Text', null, 'guest-state') }
  await act(async () => { tree = create(React.createElement(GuestProvider, null, React.createElement(CaptureGuest))) })
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
  assert.equal(restoredGuest.guest, null, 'Reopening after member return does not force a guest route')
  await act(async () => tree.unmount())
  global.__testParams = undefined; global.__testPathname = undefined; global.__testRootState = undefined; global.__testNavigations = undefined
  global.__lastShare = undefined; global.__clipboard = undefined
  storage.clear(); global.fetch = originalFetch
  console.log('PASS: consent before sharing, personal HTTPS links, guest-only credentials, native event participation, persistent guest sessions and route isolation.')
}
