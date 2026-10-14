// Legal texts, sign-up links, the settings consent toggle and the re-consent gate.
module.exports = async ({ mount, tap, act, text, storage }) => {
  const assert = require('node:assert/strict')
  const React = require('react')
  const { create } = require('react-test-renderer')
  const { StoreProvider } = require('../src/native/Store.tsx')
  const Gate = require('../src/components/LegalConsentGate.tsx').default
  const originalFetch = global.fetch
  const server = require('./mock-server.cjs')()
  global.fetch = server.fetch
  const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
  const links = tree => tree.root.findAll(node => node.type === 'Text' && typeof node.props.onPress === 'function')

  // The legal page renders the server text with its version, headings and bullets.
  storage.clear()
  let tree = await mount('Legal', { type: 'privacy' })
  await settle()
  for (const part of ['Gizlilik Politikası', 'Sürüm 1', 'Topladığımız veriler', 'Rehberin saklanmaz.']) assert(text(tree.toJSON()).includes(part), part)
  assert(server.requests.some(row => row.path === '/legal/documents/privacy'))
  await act(async () => tree.unmount())

  // The welcome page carries no legal footer or invite-code link; consents are given at sign-up.
  global.__testNavigations = []
  tree = await mount('Welcome')
  await settle()
  assert(!text(tree.toJSON()).includes('kabul etmiş olursun') && !text(tree.toJSON()).includes('Davet kodum var'), 'No legal footer and no invite-code link on the welcome page')
  {
    // Members get one quiet line: "Zaten üye misin? Giriş yap", never wrapped, opening sign-in.
    const loginLink = tree.root.findAllByType('Pressable').find(node => node.props.accessibilityLabel === 'Giriş Yap')
    assert(loginLink && text(loginLink).replace(/\s+/g, ' ').trim() === 'Zaten üye misin? Giriş yap', 'Sign-in is a single plain link')
    assert.equal(loginLink.findAll(node => node.type === 'Text' && node.props.numberOfLines === 1).length > 0, true, 'The link stays on one line')
    const flat = node => Object.assign({}, ...[].concat(node.props.style).flat(Infinity).filter(Boolean))
    const footnote = tree.root.findAll(node => node.type === 'Text' && text(node) === 'Referansla başlayan özel bir topluluk.')[0]
    assert(footnote && flat(footnote).fontSize <= 11, 'The community line reads as a footnote')
  }
  await act(async () => tree.unmount())

  // Settings lists every legal text and saves the optional marketing consent on the server.
  storage.set('event-app:access-token', 'valid-session')
  tree = await mount('Settings')
  await settle()
  for (const title of ['Kullanım Koşulları', 'Topluluk Kuralları', 'Gizlilik Politikası', 'KVKK Aydınlatma Metni']) assert(text(tree.toJSON()).includes(title), title)
  const marketing = tree.root.findAll(node => node.type === 'Switch' && node.props.accessibilityLabel === 'Kampanya ve duyurular')[0]
  assert(marketing && !marketing.props.disabled && marketing.props.value === false, 'Marketing consent loads switched off')
  await act(async () => marketing.props.onValueChange(true)); await settle()
  assert.equal(server.legal.marketing, true)
  assert(server.requests.some(row => row.path === '/legal/consents/marketing' && row.method === 'PUT' && row.body.granted === true))
  await act(async () => tree.unmount())

  // A new required version blocks the app until it is accepted; it is not shown on the legal page itself.
  server.legalDocuments.find(doc => doc.type === 'terms').version = 2
  global.__testPathname = '/legal'
  await act(async () => { tree = create(React.createElement(StoreProvider, null, React.createElement(Gate))) })
  await settle()
  assert(!text(tree.toJSON()).includes('Metinlerimizi güncelledik'), 'The legal page stays readable')
  await act(async () => tree.unmount())
  global.__testPathname = '/discover'
  await act(async () => { tree = create(React.createElement(StoreProvider, null, React.createElement(Gate))) })
  await settle()
  assert(text(tree.toJSON()).includes('Metinlerimizi güncelledik'), 'Pending terms open the consent gate')
  assert(text(tree.toJSON()).includes('Kullanım Koşulları'))
  assert(!text(tree.toJSON()).includes('Gizlilik Politikası'), 'Only documents with a new version are listed')
  await tap(tree, 'Okudum, kabul ediyorum'); await settle()
  assert.deepEqual(server.legal.posted.at(-1), [{ type: 'terms', version: 2 }])
  assert(!text(tree.toJSON()).includes('Metinlerimizi güncelledik'), 'Accepting closes the gate')
  await act(async () => tree.unmount())

  global.__testPathname = undefined
  global.__testNavigations = undefined
  storage.clear()
  global.fetch = originalFetch
  console.log('PASS: legal texts, sign-up links, marketing consent and re-consent gate.')
}
