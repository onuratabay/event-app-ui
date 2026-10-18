const assert = require('node:assert/strict')
const React = require('react')
const { create } = require('react-test-renderer')

module.exports = async function ({ act, text, audit, storage }) {
  const { WalkthroughRepository } = require('../src/walkthrough/repository.ts')
  const { emptyState, hasSeen, mergeState, placeCard, recordProgress } = require('../src/walkthrough/model.ts')
  const { GUIDES } = require('../src/walkthrough/config.ts')
  const clone = value => JSON.parse(JSON.stringify(value))
  const accounts = new Map()
  const remote = account => accounts.get(account) || emptyState()
  let offline = false
  const dependencies = (account, device = new Map()) => ({
    read: async key => device.get(key) || null,
    write: async (key, value) => device.set(key, value),
    get: async () => { if (offline) throw Error('offline'); return { accountId: account, state: clone(remote(account)) } },
    update: async action => {
      if (offline) throw Error('offline')
      const state = remote(account), granted = action.action === 'claim' && !hasSeen(state, action.id, action.kind)
      const next = recordProgress(state, action); accounts.set(account, next)
      return { accountId: account, state: clone(next), granted }
    },
  })
  const device = new Map(), first = new WalkthroughRepository('alice', dependencies('alice', device))
  await first.load()
  assert.equal(await first.claim('discover'), true, 'First visit is granted')
  assert(remote('alice').skippedGuides.includes('discover'), 'Reservation precedes presentation, so interruption cannot replay')
  assert.equal(await first.claim('discover'), false, 'Second visit is suppressed')
  await first.finish('discover', 'complete')
  assert.deepEqual(first.state.completedGuides, ['discover'])
  assert(!first.state.skippedGuides.includes('discover'))
  assert.equal(await first.claim('map'), true)
  await first.finish('map', 'skip')
  assert.equal(await first.claim('map'), false, 'Skip is terminal for automatic presentation')
  first.dispose()
  const relogin = new WalkthroughRepository('alice', dependencies('alice', device))
  await relogin.load()
  assert.equal(await relogin.claim('discover'), false, 'Sign out/in preserves progress')
  const otherDevice = new WalkthroughRepository('alice', dependencies('alice'))
  await otherDevice.load()
  assert.equal(await otherDevice.claim('map'), false, 'A clean second device reads skipped progress from the account')
  assert.equal(await otherDevice.claim('discover'), false, 'A clean second device reads completed progress')
  const bob = new WalkthroughRepository('bob', dependencies('bob', device)); await bob.load()
  assert.equal(await bob.claim('discover'), true, 'Accounts on one device are isolated')
  assert.notEqual(bob.key, relogin.key)
  assert.equal(await relogin.claim('participation', 'tip'), true)
  assert.equal(await otherDevice.claim('participation', 'tip'), false, 'Server claim prevents a second-device tip replay even with stale cache')
  assert.equal(await relogin.claim('checkin', 'tip'), true, 'A new contextual feature remains eligible')
  assert.equal(await relogin.claim('settings'), true)
  offline = true
  await relogin.finish('settings', 'complete')
  assert.equal(relogin.needsSync, true, 'Offline completion stays in the durable outbox')
  const offlineRestart = new WalkthroughRepository('alice', dependencies('alice', device)); await offlineRestart.load()
  assert.equal(offlineRestart.remoteReady, false)
  assert.equal(await offlineRestart.claim('search'), false, 'Unknown remote progress never authorizes autoplay offline')
  assert(offlineRestart.state.completedGuides.includes('settings'), 'Cached progress suppresses after an offline restart')
  offline = false
  await offlineRestart.refresh()
  assert(remote('alice').completedGuides.includes('settings'), 'Reconnect retries the stored completion')
  assert.equal(offlineRestart.needsSync, false)
  await offlineRestart.finish('map', 'complete')
  assert(remote('alice').completedGuides.includes('map'), 'Manual replay can complete a skipped guide without resetting other progress')
  const newer = mergeState(offlineRestart.state, { ...emptyState(), version: 9 })
  assert.equal(hasSeen(newer, 'map'), true, 'Version bumps do not replay existing guides')
  const mismatch = new WalkthroughRepository('alice', { ...dependencies('alice'), get: async () => ({ accountId: 'bob', state: emptyState() }) }); await mismatch.load()
  assert.equal(mismatch.remoteReady, false, 'An old session cannot hydrate from a different account')
  const corrupt = new WalkthroughRepository('alice', { ...dependencies('alice'), read: async () => '{bad json' }); await corrupt.load()
  assert(corrupt.state.completedGuides.includes('map'), 'Corrupt local storage does not erase remote progress')
  ;[relogin, otherDevice, bob, offlineRestart, mismatch, corrupt].forEach(repo => repo.dispose())

  for (const [w, h, top, bottom] of [[320, 568, 20, 0], [390, 844, 47, 34], [844, 390, 0, 21]]) {
    for (const frame of [null, { x: 8, y: top + 4, width: w - 16, height: 64 }, { x: w - 52, y: h - bottom - 78, width: 44, height: 44 }]) {
      const placement = placeCard(w, h, top, bottom, frame, 420)
      assert(placement.left >= 16 && placement.left + placement.width <= w - 15)
      assert(placement.top >= top + 12)
      assert(placement.top + Math.min(420, placement.maxHeight) <= h - bottom - 11)
    }
  }
  assert.equal(new Set(GUIDES.map(guide => guide.id)).size, GUIDES.length, 'Guide IDs are unique')
  assert(GUIDES.every(guide => guide.steps.length >= 2 && guide.steps.length <= 4))
  const Overlay = require('../src/walkthrough/WalkthroughOverlay.tsx').default
  let next = 0, back = 0, close = 0, overlay
  await act(async () => { overlay = create(React.createElement(Overlay, { presentation: { guide: GUIDES.find(g => g.id === 'discover'), index: 1, frame: { x: 20, y: 100, width: 200, height: 50 }, preview: false }, onNext: () => next++, onBack: () => back++, onClose: () => close++ })) })
  audit(overlay.toJSON())
  assert(text(overlay.toJSON()).includes('Sıralama sana uysun'))
  const press = label => overlay.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === label)[0].props.onPress()
  await act(async () => { press('Sonraki adım'); press('Önceki adım'); press('Rehberi geç ve kapat') })
  assert.deepEqual([next, back, close], [1, 1, 1])
  const progress = overlay.root.findAll(n => n.type === 'View' && n.props.accessibilityRole === 'progressbar')[0]
  assert.equal(progress.props.accessibilityValue.now, 2)
  await act(async () => overlay.root.findByType('Modal').props.onRequestClose())
  assert.equal(close, 2, 'Android back dismisses the guide')
  await act(async () => overlay.unmount())

  // Exercise the actual provider with measurable native host refs and account-backed HTTP mocks.
  const { StoreProvider, useStore } = require('../src/native/Store.tsx')
  const { Box } = require('../src/native/UI.tsx')
  const { WalkthroughProvider, useWalkthrough } = require('../src/walkthrough/WalkthroughProvider.tsx')
  const { useWalkthroughScreenBlocker } = require('../src/walkthrough/activity.ts')
  const ContextualTip = require('../src/walkthrough/ContextualTip.tsx').default
  const oldFetch = global.fetch, oldPath = global.__testPathname
  const account = '11111111-1111-4111-8111-111111111111'
  accounts.set(account, emptyState())
  let controls, blocked = false, showTip = false, missingTarget = false
  global.fetch = async (url, options = {}) => {
    const path = new URL(url).pathname
    if (path === '/users/me/walkthroughs') {
      const body = options.body ? await dependencies(account).update(JSON.parse(options.body)) : await dependencies(account).get()
      return { ok: true, status: 200, json: async () => body }
    }
    return { ok: true, status: 200, json: async () => ({ items: [], total: 0 }) }
  }
  storage.clear(); global.__testPathname = '/discover'
  function Harness() {
    const { setData } = useStore(); controls = useWalkthrough()
    useWalkthroughScreenBlocker(blocked)
    React.useEffect(() => { setData(data => ({ ...data, user: { ...data.user, id: account, status: 'approved' } })) }, [])
    return React.createElement(Box, null, React.createElement(ContextualTip, { id: 'references', when: showTip }), ...['discover-filters', 'discover-sort', 'discover-calendar', 'map-filters', 'map-location'].filter(id => !missingTarget || id !== 'map-location').map(id => React.createElement(Box, { key: id, walkthroughId: id, testID: id, style: { height: 44 } })))
  }
  const element = () => React.createElement(StoreProvider, null, React.createElement(WalkthroughProvider, null, React.createElement(Harness)))
  const options = { createNodeMock: () => ({ measureInWindow: callback => callback(20, 160, 250, 50), scrollTo() {}, focus() {} }) }
  const settle = ms => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)) })
  let tree
  try {
    await act(async () => { tree = create(element(), options) })
    await settle(1250)
    assert(tree.root.findAllByType('Modal').length, 'First screen visit automatically opens the provider tour')
    await act(async () => tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === 'Rehberi geç ve kapat')[0].props.onPress())
    assert(remote(account).skippedGuides.includes('discover'))
    await settle(1100)
    assert.equal(tree.root.findAllByType('Modal').length, 0, 'Skipped guide stays closed on its current screen')
    blocked = true; global.__testPathname = '/map'
    await act(async () => tree.update(element()))
    await settle(1100)
    assert.equal(tree.root.findAllByType('Modal').length, 0, 'Critical interaction defers first-visit guidance')
    blocked = false; await act(async () => tree.update(element()))
    await settle(1250)
    assert(tree.root.findAllByType('Modal').length, 'Deferred guide opens once the screen is idle')
    await act(async () => global.__testKeyboardListeners.keyboardDidShow())
    assert.equal(tree.root.findAllByType('Modal').length, 0, 'Keyboard pauses an open tour')
    await act(async () => global.__testKeyboardListeners.keyboardDidHide())
    await settle(30)
    assert(tree.root.findAllByType('Modal').length, 'Tour resumes at the same step after keyboard closes')
    await act(async () => tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === 'Sonraki adım')[0].props.onPress())
    await settle(30)
    await act(async () => tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === 'Rehberi bitir')[0].props.onPress())
    assert(remote(account).completedGuides.includes('map'), 'Final step records completion')
    global.__testPathname = '/discover'; await act(async () => tree.update(element())); await settle(1100)
    assert.equal(tree.root.findAllByType('Modal').length, 0, 'Revisiting a page does not restart its tour')
    await act(async () => controls.preview('discover')); await settle(30)
    assert(tree.root.findAllByType('Modal').length, 'Explicit manual replay remains available')
    await act(async () => tree.root.findByType('Modal').props.onRequestClose())
    showTip = true; await act(async () => tree.update(element())); await settle(2200)
    assert(tree.root.findAll(n => n.props.testID === 'walkthrough-tip-references').length, 'First visible feature use shows an inline tip')
    await act(async () => tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === 'İpucunu kapat')[0].props.onPress())
    await act(async () => tree.update(element())); await settle(2200)
    assert.equal(tree.root.findAll(n => n.props.testID === 'walkthrough-tip-references').length, 0, 'Dismissed contextual tip does not return')
    missingTarget = true; global.__testPathname = '/map'
    await act(async () => { controls.replayOnNextScreen('map'); tree.update(element()) }); await settle(1250)
    await act(async () => tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === 'Sonraki adım')[0].props.onPress())
    await settle(30)
    assert.equal(tree.root.findAllByType('Modal').length, 0, 'Missing native target is skipped without breaking the screen')
  } finally {
    if (tree) await act(async () => tree.unmount())
    global.fetch = oldFetch; global.__testPathname = oldPath; storage.clear()
  }
  console.log('PASS: walkthrough first visit, skip, completion, revisit, relogin, clean second device, account isolation, offline outbox, manual replay, contextual tips, critical-operation deferral, accessible native overlay and mobile/landscape placement.')
}
