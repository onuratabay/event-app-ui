module.exports = async ({ storage }) => {
  const assert = require('node:assert/strict')
  const fake = require('./mock-socket.cjs')
  const manager = require('../src/services/socket.ts')
  const api = require('../src/api/client.ts')
  const sent = []
  fake.setAction(async (name, payload) => { sent.push({ name, payload }); return [] })
  storage.set('event-app:access-token', 'test-token')
  const before = fake.instances.length
  manager.startSocket('user'); manager.startSocket('user')
  assert.equal(fake.instances.length, before + 1, 'One connection per account, not one per consumer')
  const connection = fake.instances.at(-1)
  assert.equal(connection.options.reconnectionAttempts, undefined, 'Reconnection never gives up (a backend restart must not end realtime chat)')
  // A server-side disconnect (expired token) is not retried by socket.io itself: renew the token and reconnect.
  const states = []
  const stopStates = manager.onSocket('connection:changed', payload => states.push(payload.connected))
  connection.connect()
  storage.set('event-app:refresh-token', 'test-refresh')
  const fetchBefore = global.fetch
  global.fetch = async url => ({ ok: true, status: 200, json: async () => (String(url).endsWith('/auth/refresh') ? { accessToken: 'renewed-token', refreshToken: 'renewed-refresh' } : {}) })
  connection.connected = false; connection.emit('disconnect', 'io server disconnect')
  await new Promise(resolve => setTimeout(resolve, 20))
  global.fetch = fetchBefore
  assert.equal(storage.get('event-app:access-token'), 'renewed-token', 'The token is renewed after a server disconnect')
  assert.equal(connection.connected, true, 'The socket reconnects after renewing')
  assert.deepEqual(states.slice(-2), [false, true], 'Consumers are told when the connection drops and returns')
  stopStates()
  // Reported: live messages stopped until the app restarted. A failed refresh (network blip) after the
  // token expired used to end renewal for good; it must keep retrying and reconnect.
  {
    let refreshCalls = 0
    global.fetch = async url => {
      if (!String(url).endsWith('/auth/refresh')) return { ok: true, status: 200, json: async () => ({}) }
      if (++refreshCalls === 1) throw new TypeError('Network request failed')
      return { ok: true, status: 200, json: async () => ({ accessToken: 'second-token', refreshToken: 'second-refresh' }) }
    }
    connection.emit('auth:expired')
    await new Promise(resolve => setTimeout(resolve, 2600))
    global.fetch = fetchBefore
    assert(refreshCalls >= 2, 'A failed renewal is retried')
    assert.equal(connection.connected, true, 'The socket comes back after a failed renewal')
  }
  let received = 0
  const cleanup = manager.onSocket('chat:message_created', () => received++)
  connection.receive('chat:message_created', {})
  cleanup(); connection.receive('chat:message_created', {})
  assert.equal(received, 1, 'Unmounted listeners must not receive messages')
  const releases = Array.from({ length: 500 }, (_, index) => manager.watchEvent(String(index)))
  await new Promise(resolve => setTimeout(resolve, 60))
  assert.equal(sent.filter(row => row.name === 'event:watch_batch').length, 1, '500 watches must be batched, not 500 DB trips')
  releases.forEach(release => release())
  await new Promise(resolve => setTimeout(resolve, 60))
  assert.equal(sent.filter(row => row.name === 'event:unwatch_batch').length, 1)
  const requests = JSON.stringify(api.apiRequestCounts)
  const sendCount = sent.length
  await new Promise(resolve => setTimeout(resolve, 100))
  assert.equal(JSON.stringify(api.apiRequestCounts), requests, 'Idle does not create REST requests')
  assert.equal(sent.length, sendCount, 'Idle does not query through the socket either')
  manager.stopSocket()
  assert.equal(connection.connected, false)
  assert.equal(connection.eventNames().length, 0)
  assert.equal(connection.any.size, 0)
  await assert.rejects(manager.socketAction('chat:message', {}), /bağlantı/)
  storage.clear()
  console.log('PASS: singleton socket, batched subscriptions, listener cleanup, idle request silence, logout disconnect and no offline mutation buffering.')
}
