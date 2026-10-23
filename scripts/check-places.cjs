// Typing-ahead place search on the event location picker, and its fallback when the server has none.
module.exports = async ({ act, text, storage }) => {
  const assert = require('node:assert/strict')
  const React = require('react')
  const { create } = require('react-test-renderer')
  const LocationPicker = require('../src/events/LocationPicker.tsx').default
  const originalFetch = global.fetch
  const calls = []
  let available = true
  global.fetch = async url => {
    const parsed = new URL(url)
    calls.push(parsed.pathname + parsed.search)
    if (parsed.pathname === '/places/autocomplete') {
      if (!available) return { ok: false, status: 503, text: async () => '{"message":"Yer araması şu an kullanılamıyor."}' }
      const q = parsed.searchParams.get('q') || ''
      const items = 'kazım büfe'.startsWith(q.toLocaleLowerCase('tr')) ? [{ placeId: 'kazim-1', title: 'Kazım Büfe', subtitle: 'Kadıköy, İstanbul' }, { placeId: 'kazim-2', title: 'Kazım Büfe', subtitle: 'Çankaya, Ankara' }] : []
      return { ok: true, status: 200, json: async () => ({ items }) }
    }
    if (parsed.pathname === '/places/kazim-1') return { ok: true, status: 200, json: async () => ({ placeId: 'kazim-1', name: 'Kazım Büfe', address: 'Moda Cd., Kadıköy/İstanbul', latitude: 40.98, longitude: 29.02, city: 'İstanbul', district: 'Kadıköy' }) }
    return { ok: true, status: 200, json: async () => ({}) }
  }
  storage.set('event-app.access-token', 'places-test')
  const settle = (ms = 320) => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)) })
  let picked = null, venue = ''
  const render = () => React.createElement(LocationPicker, { value: picked, venue, defaultCity: 'Ankara', onChange: place => { picked = place }, onVenueChange: value => { venue = value } })
  let tree
  await act(async () => { tree = create(render()) })
  const search = () => tree.root.findAll(node => node.props.accessibilityLabel === 'Adres veya mekan ara' && typeof node.props.onChangeText === 'function')[0]
  await act(async () => search().props.onChangeText('K'))
  await settle()
  let content = text(tree.toJSON())
  assert(content.includes('Kazım Büfe') && content.includes('Kadıköy, İstanbul') && content.includes('Çankaya, Ankara'), 'Suggestions appear from the first letter, with their cities')
  assert(calls.some(call => call.startsWith('/places/autocomplete?q=K&')), 'The typed text is sent as it is typed')
  await act(async () => search().props.onChangeText('Kazım Büfe'))
  await settle()
  const istanbul = tree.root.findAllByType('Pressable').find(node => node.props.accessibilityLabel === 'Kazım Büfe, Kadıköy, İstanbul')
  await act(async () => istanbul.props.onPress())
  await settle(30)
  await act(async () => tree.update(render()))
  assert.deepEqual({ latitude: picked.latitude, longitude: picked.longitude, city: picked.city, district: picked.district }, { latitude: 40.98, longitude: 29.02, city: 'İstanbul', district: 'Kadıköy' }, 'Picking a venue sets the point, district and city')
  assert.equal(venue, 'Kazım Büfe', 'The venue name fills the meeting point')
  assert(text(tree.toJSON()).includes('Kadıköy, İstanbul') && !tree.root.findAllByType('Pressable').some(node => node.props.accessibilityLabel === 'Kazım Büfe, Çankaya, Ankara'), 'The suggestions close after a pick')
  const sessions = calls.filter(call => /session=/.test(call)).map(call => new URLSearchParams(call.split('?')[1]).get('session'))
  assert.equal(new Set(sessions).size, 1, 'Typing and the pick share one search session')
  await act(async () => tree.unmount())

  // Without server place search the field still works with the device geocoder ("Ara").
  available = false; picked = null; venue = ''
  await act(async () => { tree = create(render()) })
  await act(async () => search().props.onChangeText('Kazım'))
  await settle()
  assert(!text(tree.toJSON()).includes('Kadıköy, İstanbul'), 'No suggestions without the service')
  assert(tree.root.findAllByType('Pressable').some(node => node.props.accessibilityLabel === 'Ara'), 'The geocoder search stays available')
  await act(async () => tree.unmount())
  global.fetch = originalFetch
  storage.clear()
  console.log('PASS: typing-ahead place search (venues, districts, cities), pick fills point and venue, geocoder fallback.')
}
