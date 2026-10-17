// Keyboard "next" between form fields: the order follows the screen, not the code.
module.exports = async ({ act }) => {
  const assert = require('node:assert/strict')
  const React = require('react')
  const { create } = require('react-test-renderer')
  const { Scroll, Field } = require('../src/native/UI.tsx')
  // Screen positions per field; "Ad" is declared last but sits at the top.
  const positions = { Ad: 10, Soyad: 80, 'E-posta': 150, Not: 220, Arama: 290 }
  const focused = []
  const createNodeMock = element => ({
    measureInWindow: callback => callback(0, positions[element.props.accessibilityLabel] ?? 0, 300, 44),
    focus: () => focused.push(element.props.accessibilityLabel),
  })
  const h = React.createElement
  let tree
  await act(async () => {
    tree = create(h(Scroll, null,
      h(Field, { accessibilityLabel: 'Soyad', value: '' }),
      h(Field, { accessibilityLabel: 'E-posta', value: '' }),
      h(Field, { accessibilityLabel: 'Not', value: '', multiline: true }),
      h(Field, { accessibilityLabel: 'Arama', value: '', returnKeyType: 'search', onSubmitEditing: () => focused.push('search-submitted') }),
      h(Field, { accessibilityLabel: 'Ad', value: '' }),
    ), { createNodeMock })
  })
  const input = label => tree.root.findAll(node => node.type === 'TextInput' && node.props.accessibilityLabel === label)[0]
  assert.equal(input('Ad').props.returnKeyType, 'next', 'Single-line fields show "next"')
  assert.equal(input('Ad').props.submitBehavior, 'submit', '"next" keeps the keyboard open')
  assert.equal(input('Not').props.returnKeyType, undefined, 'Multi-line fields keep Enter for new lines')
  assert.equal(input('Arama').props.returnKeyType, 'search', 'A field with its own return key keeps it')
  const submit = async label => act(async () => { input(label).props.onSubmitEditing?.({}); await new Promise(resolve => setTimeout(resolve, 0)) })
  await submit('Ad')
  assert.deepEqual(focused, ['Soyad'], '"next" goes to the field below on screen, whatever the code order')
  await submit('Soyad')
  assert.deepEqual(focused.at(-1), 'E-posta')
  global.__testKeyboardDismissed = false
  await submit('E-posta')
  assert.equal(focused.at(-1), 'Not', 'A multi-line field below is still a stop')
  await submit('Arama')
  assert.equal(focused.at(-1), 'search-submitted', 'A field with its own submit runs it instead of moving on')
  await act(async () => tree.unmount())
  console.log('PASS: keyboard "next" follows the on-screen order, skips nothing, and leaves search and multi-line fields alone.')
}
