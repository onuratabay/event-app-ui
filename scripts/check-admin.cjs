// Admin panel: role gate, search, one-tap decisions; pending accounts wait until an admin approves.
module.exports = async ({ mount, tap, act, text, storage }) => {
  const assert = require('node:assert/strict')
  const originalFetch = global.fetch
  const server = require('./mock-server.cjs')()
  global.fetch = server.fetch
  const sockets = require('./mock-socket.cjs')
  const settle = (ms = 30) => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)) })
  const press = async (tree, label) => { const node = tree.root.findAllByType('Pressable').find(item => item.props.accessibilityLabel === label); assert(node, `Missing control: ${label}`); await act(async () => node.props.onPress?.({ stopPropagation() {} })) }
  const adminCalls = () => server.requests.filter(row => row.path.startsWith('/admin/'))
  storage.clear(); storage.set('event-app:access-token', 'valid-session')

  // A member never reaches the panel and the app sends no admin request.
  server.user.role = 'member'
  let tree = await mount('Settings')
  await settle()
  assert(!text(tree.toJSON()).includes('Üyelik başvuruları'), 'Members do not see the admin entry')
  await act(async () => tree.unmount())
  tree = await mount('Admin')
  await settle()
  assert(text(tree.toJSON()).includes('erişim yetkin yok'), 'Members are kept out of the admin page')
  assert.equal(adminCalls().length, 0, 'No admin request is sent for a member')
  await act(async () => tree.unmount())
  tree = await mount('Profile')
  await settle()
  assert(!tree.root.findAllByType('Pressable').some(node => node.props.accessibilityLabel === 'Admin panelini aç'), 'Members have no admin link on their profile')
  await act(async () => tree.unmount())

  // The admin sees the entry, lists pending applications with counts, searches and decides in one tap.
  server.user.role = 'admin'
  const navigations = []
  // Profile header: the admin link sits left of "Ayarlar" and opens the panel.
  tree = await mount('Profile', { navigate: screen => navigations.push(screen) })
  await settle()
  const headerLinks = tree.root.findAllByType('Pressable').map(node => node.props.accessibilityLabel).filter(label => label === 'Admin panelini aç' || label === 'Ayarları aç')
  assert.deepEqual(headerLinks, ['Admin panelini aç', 'Ayarları aç'], 'The admin link is left of Ayarlar')
  await press(tree, 'Admin panelini aç')
  assert.deepEqual(navigations.splice(0), ['admin'])
  await act(async () => tree.unmount())
  tree = await mount('Settings', { navigate: screen => navigations.push(screen) })
  await settle()
  await tap(tree, 'Üyelik başvuruları')
  assert.deepEqual(navigations, ['admin'])
  await act(async () => tree.unmount())
  tree = await mount('Admin')
  await settle()
  let content = text(tree.toJSON())
  assert(content.includes('Ada Yeni, 31') && content.includes('Can Deneme, 36'), 'Pending applications are listed with age')
  assert(content.includes('Bekleyen · 2') && content.includes('ada@example.com') && content.includes('1 onaylı referans'), 'Cards show contact, references and tab counts')
  const search = tree.root.findAll(node => node.props.accessibilityLabel === 'Başvurularda ara' && typeof node.props.onChangeText === 'function')[0]
  await act(async () => search.props.onChangeText('can'))
  await settle(350)
  content = text(tree.toJSON())
  assert(content.includes('Can Deneme') && !content.includes('Ada Yeni'), 'Search narrows the list')
  await act(async () => search.props.onChangeText(''))
  await settle(350)
  await press(tree, 'Ada Yeni onayla')
  await settle()
  const patch = server.requests.find(row => row.method === 'PATCH' && row.path === '/admin/applications/app-1')
  assert.deepEqual(patch.body, { decision: 'approve' }, 'Approve sends one decision')
  content = text(tree.toJSON())
  assert(content.includes('Ada Yeni onaylandı') && !content.includes('Ada Yeni, 31') && content.includes('Bekleyen · 1') && content.includes('Onaylı · 1'), 'An approved application leaves the pending list and counts move')
  // An approved member can be taken passive; it cuts access, so it asks first.
  server.applications.push({ ...server.applications[0], id: 'app-3', firstName: 'Ece', lastName: 'Aktif', email: 'ece@example.com', status: { enum: 'approved', name: 'Onaylı' } })
  await press(tree, 'Onaylı başvurular')
  await settle()
  await press(tree, 'Ece Aktif pasife al')
  assert(!server.requests.some(row => row.method === 'PATCH' && row.path === '/admin/applications/app-3'), 'Taking a member passive asks for confirmation first')
  assert(text(tree.toJSON()).includes('Pasif · 0'), 'There is a Pasif tab')
  await press(tree, 'Bekleyen başvurular')
  await settle()
  await press(tree, 'Can Deneme reddet')
  assert(!server.requests.some(row => row.method === 'PATCH' && row.path === '/admin/applications/app-2'), 'Rejecting asks for confirmation first')
  // "İncele" opens the card like an accordion with the details; the review decision lives inside.
  assert(!text(tree.toJSON()).includes('Yasal onaylar'), 'Details stay folded until İncele is pressed')
  await press(tree, 'Can Deneme detayları')
  await settle()
  content = text(tree.toJSON())
  assert(content.includes('Can buluşmaları seviyor.') && content.includes('Deniz Üye') && content.includes('Yasal onaylar') && content.includes('Gizlilik Politikası'), 'The open card shows bio, references and accepted legal texts')
  assert(server.requests.some(row => row.method === 'GET' && row.path === '/admin/applications/app-2'), 'Details load when the card opens')
  assert(tree.root.findAllByType('Pressable').find(item => item.props.accessibilityLabel === 'Can Deneme incelemeye al').props.disabled, 'An account already under review cannot be put under review again')
  assert(!server.requests.some(row => row.method === 'PATCH' && row.path === '/admin/applications/app-2'), 'Opening the details never changes the status')
  await press(tree, 'Can Deneme detayları')
  assert(!text(tree.toJSON()).includes('Yasal onaylar'), 'Pressing İncele again folds the card')
  await act(async () => tree.unmount())

  // Completing the profile files an application: the account waits instead of entering the app.
  server.user.role = 'member'
  server.user.status = { enum: 'profile_incomplete' }
  let destination
  global.fetch = async (url, options = {}) => {
    const path = new URL(url).pathname
    if (path === '/users/me/profile/complete') { server.user.status = { enum: 'reference_pending' }; return { ok: true, status: 200, json: async () => ({ ...server.user }) } }
    return server.fetch(url, options)
  }
  tree = await mount('Interests', { navigate: (screen, opts) => { destination = { screen, opts } } })
  await settle()
  await tap(tree, 'Padel')
  const saveButton = tree.root.findAllByType('Pressable').filter(node => /Kaydet|Tamamla|Devam/.test(text(node))).at(-1)
  assert(saveButton, 'Interests screen has a save button')
  await act(async () => saveButton.props.onPress?.({ stopPropagation() {} }))
  await settle()
  assert.deepEqual(destination, { screen: 'onboarding-3', opts: { reset: true } }, 'A completed profile waits for admin approval')
  await act(async () => tree.unmount())
  global.fetch = server.fetch

  // The waiting page opens the app as soon as the admin approves.
  destination = undefined
  tree = await mount('Onboarding', { step: 3, navigate: (screen, opts) => { destination = { screen, opts } } })
  await settle()
  assert(text(tree.toJSON()).includes('inceliyoruz'))
  await act(async () => { sockets.instances.at(-1).receive('account:status', { status: 'approved' }) })
  await settle()
  assert.deepEqual(destination, { screen: 'discover', opts: { reset: true } }, 'Approval opens the app without re-login')
  await act(async () => tree.unmount())

  // An unfinished application is not locked: the reference step continues to the profile.
  server.user.status = { enum: 'profile_incomplete' }
  destination = undefined
  tree = await mount('Onboarding', { step: 2, navigate: (screen, opts) => { destination = { screen, opts } } })
  await settle()
  content = text(tree.toJSON())
  assert(content.includes('Üyeden Referans İste') && !content.includes('Eklediklerimi gönder'), 'The reference step is shown, unlocked, while the application is unfinished')
  // Instagram is required, so its field is open from the start (no card to tap first).
  const instagramField = () => tree.root.findAll(node => node.type === 'TextInput' && node.props.accessibilityLabel === 'Instagram kullanıcı adı')[0]
  await act(async () => instagramField().props.onChangeText('Ada.Yeni '))
  assert.equal(instagramField().props.value, '@ada.yeni', 'The Instagram username is lowercased as typed')
  assert.equal(instagramField().props.autoCapitalize, 'none')
  await act(async () => instagramField().props.onChangeText(''))
  await tap(tree, 'Devam Et')
  await settle()
  assert.equal(destination, undefined, 'Without an Instagram handle the step does not continue')
  assert(text(tree.toJSON()).includes('Devam etmek için Instagram kullanıcı adını yaz'), 'It says the Instagram handle is needed')
  await act(async () => instagramField().props.onChangeText('ada.yeni'))
  await tap(tree, 'Devam Et')
  await settle()
  assert.equal(destination?.screen, 'interests', 'After references the profile completes the application')
  await act(async () => tree.unmount())

  // A reference approved while the step is open moves on by itself; one approved earlier does not bounce back.
  server.state.references.splice(0, server.state.references.length, { id: 'ref-x', status: 'pending', direction: 'outgoing', createdAt: '2026-10-14T10:00:00Z', requester: { id: server.user.id, name: 'Sunucu Kullanıcısı' }, recipient: { id: 'member-1', name: 'Deniz Üye' } })
  destination = undefined
  tree = await mount('Onboarding', { step: 2, navigate: (screen, opts) => { destination = { screen, opts } } })
  await settle()
  assert(text(tree.toJSON()).includes('Onay bekleniyor'), 'The pending request is listed')
  await act(async () => tree.root.findAll(node => node.type === 'TextInput' && node.props.accessibilityLabel === 'Instagram kullanıcı adı')[0].props.onChangeText('ada.yeni'))
  await act(async () => { sockets.instances.at(-1).receive('reference:updated', { id: 'ref-x', status: 'approved' }) })
  await settle()
  assert.equal(destination?.screen, 'interests', 'An approved reference continues to the profile step')
  await act(async () => tree.unmount())
  server.state.references[0].status = 'approved'
  destination = undefined
  tree = await mount('Onboarding', { step: 2, navigate: (screen, opts) => { destination = { screen, opts } } })
  await settle()
  assert.equal(destination, undefined, 'Coming back to the step with an approved reference stays on it')
  // Pull to refresh reloads the account and the reference requests.
  const before = server.requests.filter(row => row.path === '/references/requests').length
  const refreshControl = () => tree.root.findAll(node => node.props.refreshControl)[0]?.props.refreshControl
  const pullControl = refreshControl()
  assert(pullControl, 'The reference step can be pulled to refresh')
  await act(async () => { pullControl.props.onRefresh(); await new Promise(resolve => setTimeout(resolve, 30)) })
  assert(server.requests.filter(row => row.path === '/references/requests').length > before, 'Pulling down reloads the reference requests')
  assert.equal(refreshControl().props.refreshing, false, 'The spinner stops after the reload')
  await act(async () => tree.unmount())
  server.state.references.splice(0)

  // The waiting page: pulling down picks up an approval even without the live update.
  server.user.status = { enum: 'reference_pending' }
  destination = undefined
  tree = await mount('Onboarding', { step: 3, navigate: (screen, opts) => { destination = { screen, opts } } })
  await settle()
  server.user.status = { enum: 'approved' }
  await act(async () => { tree.root.findAll(node => node.props.refreshControl)[0].props.refreshControl.props.onRefresh(); await new Promise(resolve => setTimeout(resolve, 30)) })
  await settle()
  assert.deepEqual(destination, { screen: 'discover', opts: { reset: true } }, 'Pulling down on the waiting page opens the app once approved')
  await act(async () => tree.unmount())

  // Waiting: submitted answers are locked, empty ones stay open, and "send" waits for a new value.
  server.user.status = { enum: 'reference_pending' }
  tree = await mount('Onboarding', { step: 1 })
  await settle()
  const lockedLabels = tree.root.findAll(node => String(node.props.accessibilityLabel || '').endsWith(', kilitli') && node.type === 'View').map(node => node.props.accessibilityLabel)
  assert(lockedLabels.some(label => label.startsWith('Ad: Sunucu')) && lockedLabels.some(label => label.startsWith('Şehir: Ankara')), 'Submitted fields show locked')
  assert(!tree.root.findAll(node => node.type === 'TextInput' && node.props.secureTextEntry).length, 'No password field while waiting')
  const sendButton = () => tree.root.findAllByType('Pressable').find(node => text(node).includes('Eklediklerimi gönder'))
  assert.equal(sendButton().props.disabled, true, 'Nothing new, nothing to send')
  const emailField = tree.root.findAll(node => node.type === 'TextInput' && node.props.accessibilityLabel === 'E-posta')[0]
  assert(emailField, 'A field left empty stays editable')
  await act(async () => emailField.props.onChangeText('sunucu@example.com'))
  assert.equal(sendButton().props.disabled, false, 'Adding a value enables send')
  await act(async () => sendButton().props.onPress?.({ stopPropagation() {} }))
  await settle()
  assert.deepEqual(server.requests.filter(row => row.path === '/users/me/profile' && row.method === 'PATCH').at(-1).body, { email: 'sunucu@example.com' }, 'Only the added field is sent')
  assert(tree.root.findAll(node => node.props.accessibilityLabel === 'E-posta: sunucu@example.com, kilitli').length, 'A sent value locks too')
  await act(async () => tree.unmount())

  // Push: the waiting page asks once, the token is saved for the account and removed at sign-out.
  global.__testNotifications = {
    setNotificationHandler() {}, setNotificationChannelAsync: async () => {}, AndroidImportance: { HIGH: 4 },
    getPermissionsAsync: async () => ({ status: 'undetermined' }), requestPermissionsAsync: async () => ({ status: 'granted' }),
    getExpoPushTokenAsync: async () => ({ data: 'ExponentPushToken[test-device]' }),
  }
  tree = await mount('Onboarding', { step: 3 })
  await settle()
  assert.equal(server.pushTokens.get('ExponentPushToken[test-device]'), process.env.TEST_PLATFORM || 'ios', 'The device token is saved for the account')
  assert(text(tree.toJSON()).includes('Onaylandığında sana bildirim göndereceğiz'), 'The waiting page says a push will come')
  await act(async () => tree.unmount())
  await require('../src/api/client.ts').logout()
  assert(!server.pushTokens.has('ExponentPushToken[test-device]'), 'Signing out removes the device token')
  global.__testNotifications = undefined
  storage.set('event-app:access-token', 'valid-session')

  // Tapping "Sana uygun bir etkinlik oluşturuldu" opens that event, once the member's session is in.
  {
    const React = require('react')
    const { create } = require('react-test-renderer')
    const { StoreProvider } = require('../src/native/Store.tsx')
    const PushOpenHandler = require('../src/components/PushOpenHandler.tsx').default
    let tapped
    global.__testNotifications = { addNotificationResponseReceivedListener: handler => { tapped = handler; return { remove() {} } }, getLastNotificationResponseAsync: async () => null }
    server.user.status = { enum: 'approved' }
    global.__testNavigations = []
    let handler
    await act(async () => { handler = create(React.createElement(StoreProvider, null, React.createElement(PushOpenHandler))) })
    await settle()
    await act(async () => { tapped({ notification: { request: { content: { data: { type: 'pool_match', eventId: server.events[0].id } } } } }); await new Promise(resolve => setTimeout(resolve, 30)) })
    assert(global.__testNavigations.includes('/event-detail'), 'A pool match push opens the event')
    assert(server.requests.some(row => row.path === `/events/${server.events[0].id}`), 'The event is loaded before it opens')
    await act(async () => handler.unmount())
    global.__testNotifications = undefined; global.__testNavigations = undefined
  }

  // "Başvurunu inceliyoruz" is only for an application waiting for its reference; a review gets review copy.
  server.user.status = { enum: 'reference_pending' }
  tree = await mount('Onboarding', { step: 3 })
  await settle()
  content = text(tree.toJSON()).replace(/\s+/g, ' ')
  assert(content.includes('Başvurunu inceliyoruz.') && content.includes('Referans Bekleniyor'), 'Waiting for a reference shows the application page')
  await act(async () => tree.unmount())
  server.user.status = { enum: 'security_review' }
  tree = await mount('Onboarding', { step: 3 })
  await settle()
  content = text(tree.toJSON()).replace(/\s+/g, ' ')
  assert(content.includes('Hesabın incelemede.') && content.includes('Hesabını inceliyoruz') && !content.includes('Başvurunu inceliyoruz'), 'An account under review sees the review page')
  await act(async () => tree.unmount())

  // Passive: the same page with review copy, and an active session is sent there at once.
  server.user.status = { enum: 'passive' }
  tree = await mount('Onboarding', { step: 3 })
  await settle()
  content = text(tree.toJSON()).replace(/\s+/g, ' ')
  assert(content.includes('Hesabın incelemede.') && content.includes('Hesabın şu an pasif') && !content.includes('Referans Bekleniyor'), 'A passive member sees the review page')
  await act(async () => tree.unmount())
  const React = require('react')
  const { create } = require('react-test-renderer')
  const { StoreProvider } = require('../src/native/Store.tsx')
  const AccessGuard = require('../src/components/AccessGuard.tsx').default
  server.user.status = { enum: 'approved' }
  global.__testNavigations = []
  global.__testPathname = '/discover'
  let guard
  await act(async () => { guard = create(React.createElement(StoreProvider, null, React.createElement(AccessGuard))) })
  await settle()
  assert(!global.__testNavigations.length, 'An active member stays in the app')
  await act(async () => { sockets.instances.at(-1).receive('account:status', { status: 'passive' }) })
  await settle()
  assert(global.__testNavigations.includes('/onboarding-3'), 'Going passive moves the member to the review page')
  await act(async () => guard.unmount())
  global.__testPathname = undefined; global.__testNavigations = undefined

  delete server.user.role; delete server.user.status
  storage.clear()
  global.fetch = originalFetch
  console.log('PASS: admin role gate, application search and decisions, pending accounts wait for approval.')
}
