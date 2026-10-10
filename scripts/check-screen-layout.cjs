const assert = require('node:assert/strict')
const React = require('react')
const { create, act } = require('react-test-renderer')
const { StyleSheet, Platform } = require('react-native')

module.exports = async () => {
  const Screen = require('../src/native/Screen').default
  const { Box, Scroll, Label } = require('../src/native/UI')
  let tree
  await act(async () => {
    tree = create(React.createElement(Screen, {
      style: { position: 'absolute', top: 0, bottom: 0, height: '100%', backgroundColor: 'navy' },
      background: React.createElement(Box, { testID: 'full-background' }),
    }, React.createElement(Scroll, {
      style: { paddingHorizontal: 24, paddingVertical: 16 },
      contentContainerStyle: { paddingBottom: 48 },
    }, React.createElement(Label, null, 'Content'))))
  })
  const safe = tree.root.findAllByType('View').find(node => node.props.edges)
  assert.deepEqual(safe.props.edges, ['top', 'right', 'bottom', 'left'])
  assert.equal(safe.findAll(node => node.props.testID === 'full-background').length, 0,
    'Background must not be clipped to the content safe area')
  const keyboard = tree.root.findAllByType('KeyboardAvoidingView')
  assert.equal(keyboard.length, 1, 'One keyboard owner per screen')
  assert.equal(keyboard[0].props.behavior, Platform.OS === 'ios' ? 'padding' : 'height')
  const scroll = tree.root.findByType('ScrollView')
  const content = StyleSheet.flatten(scroll.props.contentContainerStyle)
  assert.equal(content.paddingHorizontal, 24)
  assert.equal(content.paddingVertical, 16)
  assert.equal(content.paddingBottom, 48, 'Explicit scroll clearance is preserved')
  assert.equal(scroll.props.automaticallyAdjustKeyboardInsets, false, 'Avoid double keyboard insets')
  await act(async () => tree.unmount())
  console.log('PASS: full-window background, four safe edges, single keyboard owner and scroll content spacing.')
}
