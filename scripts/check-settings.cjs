const assert = require('node:assert/strict')
const React = require('react')
const { create, act } = require('react-test-renderer')
module.exports = async ({ storage, mount, text }) => {
  const { PreferencesProvider, usePreferences } = require('../src/native/preferences')
  const { SharedBlur } = require('../src/native/SharedBlur')
  const key = 'event-app:device-preferences:v1'
  let preferences, tree
  function Probe() { preferences = usePreferences(); return React.createElement(SharedBlur, { testID: 'effect' }) }
  const render = async () => { await act(async () => { tree = create(React.createElement(PreferencesProvider, null, React.createElement(Probe))) }) }
  storage.set(key, '{invalid')
  await render()
  assert.equal(preferences.ready, true)
  assert.deepEqual(preferences.values, { haptics: true, reduceTransparency: false })
  await act(async () => { await Promise.all([preferences.update({ haptics: false }), preferences.update({ reduceTransparency: true })]) })
  assert.deepEqual(JSON.parse(storage.get(key)), { haptics: false, reduceTransparency: true })
  assert.equal(tree.root.findAllByType('BlurView').length, 0, 'Reduced transparency removes native blur')
  await act(async () => tree.unmount())
  await render()
  assert.equal(preferences.values.haptics, false, 'Preference survives remount')
  const original = storage.set
  storage.set = () => { throw Error('disk full') }
  await act(async () => { await assert.rejects(preferences.update({ haptics: true })) })
  assert.equal(preferences.values.haptics, false, 'Failed saves do not claim success')
  storage.set = original
  await act(async () => { await preferences.update({ haptics: true, reduceTransparency: false }) })
  assert.equal(tree.root.findAllByType('BlurView').length, 1, 'Reset restores blur')
  await act(async () => tree.unmount())
  storage.delete(key)
  const settings = await mount('Settings')
  assert(text(settings.toJSON()).includes('Hesap ve güvenlik'))
  assert.equal(settings.root.findAllByType('Switch').length, 2)
  await act(async () => settings.unmount())
  console.log('PASS: settings screen, preference persistence, concurrent updates, invalid storage, failed saves and applied transparency.')
}
