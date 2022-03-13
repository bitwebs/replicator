const unichain = require('@web4/unichain')
const ram = require('random-access-memory')
const { get, append, test } = require('./helpers')

test('basic', async function (t, replicator, clone) {
  const chain = unichain(ram)

  replicator.add(chain, { announce: true, lookup: false })

  await append(chain, 'test')

  const chainClone = unichain(ram, chain.key)

  clone.add(chainClone, { lookup: true, announce: false })

  t.same(await get(chainClone, 0), Buffer.from('test'))
})

test('multi chain swarm', async function (t, replicator, clone) {
  const a = unichain(ram)
  const b = unichain(ram)

  replicator.add(a, { announce: true, lookup: false })
  replicator.add(b, { announce: true, lookup: false })

  await append(a, 'a test')
  await append(b, 'b test')

  const aClone = unichain(ram, a.key)
  const bClone = unichain(ram, b.key)

  clone.add(bClone, { lookup: true, announce: false })
  clone.add(aClone, { lookup: true, announce: false })

  t.same(await get(aClone, 0), Buffer.from('a test'))
  t.same(await get(bClone, 0), Buffer.from('b test'))
})

test('multi chain swarm higher latency', async function (t, replicator, clone) {
  const a = unichain(ram)
  const b = unichain(ram)

  replicator.add(a, { announce: true, lookup: false })

  await append(a, 'a test')
  await append(b, 'b test')

  const aClone = unichain(ram, a.key)
  const bClone = unichain(ram, b.key)

  clone.add(bClone, { lookup: true, announce: false })
  clone.add(aClone, { lookup: true, announce: false })

  replicator.on('discovery-key', function () {
    replicator.add(b, { announce: true, lookup: false })
  })

  t.same(await get(aClone, 0), Buffer.from('a test'))
  t.same(await get(bClone, 0), Buffer.from('b test'))
})
