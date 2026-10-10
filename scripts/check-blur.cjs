const assert = require('node:assert/strict')
const React = require('react')
const { create, act } = require('react-test-renderer')
const { Platform } = require('react-native')
module.exports = async () => {
  const { BlurSurface, SharedBlur } = require('../src/native/SharedBlur')
  let tree
  const screen = name => React.createElement(BlurSurface, {
    overlay: React.createElement('View', { testID: 'overlay' }),
  }, React.createElement('View', { key: name, testID: name },
    React.createElement(SharedBlur, { intensity: 38, style: { position: 'absolute' } })))
  await act(async () => { tree = create(screen('splash')) })
  await act(async () => { tree.update(screen('welcome')) })
  assert.equal(tree.root.findAllByType('BlurTargetView').length, 0)
  assert.equal(tree.root.findAllByType('BlurView').length, Platform.OS === 'android' ? 0 : 1)
  assert.equal(tree.root.findAllByProps({ testID: 'overlay' }).length, 1)
  assert.equal(tree.root.findAllByProps({ testID: 'welcome' }).length, 1)
  await act(async () => tree.unmount())
  console.log(`PASS: ${Platform.OS} blur fallback and screen replacement preserve content/overlay.`)
}
