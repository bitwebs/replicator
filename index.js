const pump = require('pump')
const bitswarm = require('@web4/bitswarm')
const Protocol = require('@web4/bit-protocol')
const { EventEmitter } = require('events')

const promises = Symbol.for('unichain.promises')

class Event {
  constructor () {
    this.triggered = false
    this.fns = new Set()
  }

  on (fn) {
    if (this.triggered) return fn()
    this.fns.add(fn)
  }

  emit () {
    this.triggered = true
    for (const fn of this.fns) fn()
  }
}

module.exports = class Replicator extends EventEmitter {
  constructor (options = {}) {
    super()

    this.swarm = bitswarm({
      announceLocalAddress: !!options.announceLocalAddress,
      preferredPort: 49737,
      bootstrap: options.bootstrap,
      queue: {
        multiplex: true
      }
    })

    this.createStream = options.createStream || ((init) => new Protocol(init, options))
    this.swarm.on('connection', this._onconnection.bind(this))
    this.swarming = new Map()
    this.streams = new Set()
  }

  static replicate (chains, options) {
    const r = new Replicator({ createStream () { return null } })
    if (!Array.isArray(chains)) chains = [chains]

    for (const chain of chains) {
      r.add(chain, options).catch(() => {})
    }

    return r
  }

  get dht () {
    return this.swarm.network && this.swarm.network.discovery && this.swarm.network.discovery.dht
  }

  _onconnection (socket, info) {
    this.emit('connection', socket, info)

    let stream = this.createStream(info.client)

    for (const { chain, options, one } of this.swarming.values()) {
      stream = chain.replicate(info.client, { ...options, stream })
      one.emit()
    }

    this.emit('replication-stream', stream, info)

    pump(stream, socket, stream)
    stream.on('discovery-key', this._ondiscoverykey.bind(this, stream))

    this.streams.add(stream)
    stream.on('close', () => this.streams.delete(stream))
  }

  _ondiscoverykey (stream, discoveryKey) {
    const key = discoveryKey.toString('hex')

    if (!this.swarming.has(key)) {
      this.emit('discovery-key', discoveryKey, stream)
      return
    }

    const { chain, options, one } = this.swarming.get(key)
    chain.replicate(false, { ...options, stream })
    one.emit()
  }

  listen () {
    this.swarm.listen()
  }

  destroy () {
    return new Promise((resolve, reject) => {
      this.swarm.destroy((err) => {
        if (err) return reject(err)
        this.emit('close')
        resolve()
      })
    })
  }

  async add (chain, options = {}) {
    await ready(chain)

    const key = chain.discoveryKey.toString('hex')
    const { announce, lookup } = options
    const defaultLookup = lookup === undefined && announce === undefined
    const added = this.swarming.has(key)

    const one = new Event()
    const all = new Event()

    this.swarming.set(key, { chain, options, one, all })

    if (announce || lookup || defaultLookup) {
      this.swarm.join(chain.discoveryKey, { announce: !!announce, lookup: !!lookup || defaultLookup })
      this.swarm.flush(onflush)
    } else {
      onflush()
    }

    if (chain.timeouts) { // current timeout api support ...
      const { update, get } = chain.timeouts
      if (update) chain.timeouts.update = (cb) => one.on(() => update(cb))
      if (get) chain.timeouts.get = (cb) => all.on(() => get(cb))
    }

    if (!added) {
      for (const stream of this.streams) {
        chain.replicate(false, { ...options, stream })
        one.emit()
      }
    }

    this.emit('add', chain, options)

    function onflush () {
      one.emit()
      all.emit()
    }
  }

  async remove (chain) {
    await ready(chain)

    const key = chain.discoveryKey.toString('hex')

    if (!this.swarming.has(key)) return

    const { options } = this.swarming.get(key)
    this.swarming.delete(key)
    this.swarm.leave(chain.discoveryKey)

    this.emit('remove', chain, options)
  }
}

function ready (chain) {
  if (!chain.ready) return
  if (chain[promises]) return chain.ready()

  return new Promise((resolve, reject) => {
    const p = chain.ready((err) => {
      if (err) return reject(err)
      resolve()
    })

    if (p && typeof p.then === 'function') {
      p.then(resolve, reject)
    }
  })
}
