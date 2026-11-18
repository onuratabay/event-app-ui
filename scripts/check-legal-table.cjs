// Focused check of the imported document and both renderers, without the full app suite.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.join(__dirname, '..')
function loadTs(file, extra = '', mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8') + extra, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(code, { module, exports: module.exports, require: id => id in mocks ? mocks[id] : require(id) })
  return module.exports
}
const parser = loadTs(path.join(root, 'src/legal/table.ts'))
const migration = path.join(root, '../vibe-us/src/database/migrations/1792010000000-ImportProvidedLegalDocuments.ts')
const { documents } = loadTs(migration, '\nexport const documents = DOCUMENTS;')
const doc = documents.find(d => d.type === 'kvkk')
const table = parser.parseKvkkTable(doc.body)
assert(table)
assert.equal(table.rows.length, 8)
assert(table.rows.every(row => row.length === 3))
const rebuilt = [table.before, ...table.rows.flatMap(row => row.map((cell, col) => `## ${parser.KVKK_COLUMNS[col]}\n\n${cell}`)), table.after].join('\n\n')
assert.equal(rebuilt, doc.body.trim(), 'All source wording, bullets and row associations survive unchanged')
assert.equal(parser.parseKvkkTable(doc.body.replace('## İşlenen Kişisel Veriler', '## Beklenmeyen başlık')), null)
assert.equal(parser.parseKvkkTable(doc.body.slice(0, doc.body.indexOf('## 3.'))), null)
assert.equal(parser.parseKvkkTable('## Sıradan metin\n\nParagraf'), null)

async function web(document, pathname = '/kvkk') {
  const elements = { title: {}, stamp: {}, content: { querySelector: () => true } }
  const context = {
    location: { pathname },
    document: { getElementById: id => elements[id], querySelectorAll: () => [], body: { classList: { add() {} } } },
    fetch: async () => ({ ok: true, json: async () => ({ ...document, publishedAt: '2026-11-15' }) }),
  }
  vm.runInNewContext(fs.readFileSync(path.join(root, '../ewent-app-web/assets/legal.js'), 'utf8'), context)
  await new Promise(resolve => setImmediate(resolve))
  return elements.content.innerHTML
}
;(async () => {
  const html = await web(doc)
  assert.equal((html.match(/<th scope="col">/g) || []).length, 3)
  assert.equal((html.match(/<td>/g) || []).length, 24)
  assert.equal((html.match(/<tr>/g) || []).length, 9)
  assert(html.includes('##') === false)
  const hostile = await web({ ...doc, body: doc.body.replace('KVKK m. 5/2-c', '<script>alert(1)</script>') })
  assert(!hostile.includes('<script>'))
  assert(hostile.includes('&lt;script&gt;'))
  const privacy = await web(documents[0], '/gizlilik')
  assert(!privacy.includes('<table'))

  const React = require('react')
  global.IS_REACT_ACT_ENVIRONMENT = true
  const { act, create } = require('react-test-renderer')
  const host = tag => props => React.createElement(tag, props, props.children)
  const native = loadTs(path.join(root, 'src/screens/LegalScreen.tsx'), '', {
    'react-native': { ScrollView: host('ScrollView'), StyleSheet: { create: x => x } },
    'expo-router': {}, '../api/client': {}, '../components/TopNavBar': {},
    '../components/GlassUI': {}, '../components/LoadingSpinner': {}, '../legal/links': {},
    '../legal/table': parser, '../native/UI': { Box: host('View'), Label: host('Text') },
    '../theme/palette': { palette: {} },
  })
  let tree
  await act(async () => { tree = create(React.createElement(native.Body, { text: doc.body, type: 'kvkk' })) })
  assert.equal(tree.root.findAllByType('ScrollView').filter(n => n.props.horizontal).length, 1)
  const collect = node => typeof node === 'string' ? node : (node?.children || []).map(collect).join('\n')
  const output = collect(tree.toJSON())
  for (const row of table.rows) for (const cell of row) for (const line of cell.split('\n').filter(Boolean)) {
    assert(output.includes(line.replace(/^- /, '')), 'Every mobile cell remains readable')
  }
  await act(async () => tree.unmount())
  console.log('PASS: original eight rows / 24 cells, exact text preservation, malformed input fallback, web escaping and native horizontal table.')
})().catch(error => { console.error(error); process.exitCode = 1 })
