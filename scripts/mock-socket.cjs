const { EventEmitter } = require('node:events')
const instances = []
let action = async () => ({})
class FakeSocket extends EventEmitter {
  connected = false
  id = 'test-socket'
  any = new Set()
  connect() { if (!this.connected) { this.connected = true; super.emit('connect') }; return this }
  disconnect() { this.connected = false; super.emit('disconnect', 'test'); return this }
  onAny(fn) { this.any.add(fn); return this }
  offAny() { this.any.clear(); return this }
  timeout() { return { emit: (name, payload, ack) => { Promise.resolve().then(() => action(name, payload)).then(data => ack(null, { ok: true, data }), error => ack(error)) } } }
  receive(name, payload) { this.any.forEach(fn => fn(name, payload)) }
}
module.exports = { instances, setAction(fn) { action = fn }, io() { const socket = new FakeSocket(); instances.push(socket); return socket } }
