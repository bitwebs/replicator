# @web4/replicator

Replicate data structures easily using bitswarm

## Install

```js
npm install @web4/replicator
```

## Usage

You data structure has to support a .replicate() stream, then you can replicate
them using the bitswarm replicator.

```js
const Replicator = require('@web4/replicator')

const r = new Replicator()

r.add(aUnichain, {
  live: true // passed to .replicate
})
```

## API

#### `r = new Replicator([options])`

Make a new replicator. Options include:

```js
{
  bootstrap: [...], // optional set the DHT bootstrap servers
}
```

#### `promise = r.add(bitDataStructure, [options])`

Add a bit* data structure to replicate.

```js
{
  live: bool, // passed to .replicate
  upload: bool, // passed to .replicate
  download: bool, // passed to .replicate
  encrypt: bool, // passed to .replicate
  discoveryKey: <buf>, // optionally set your own discovery key
  announce: true, // should the swarm announce you?
  lookup: true, // should the swarm do lookups for you?
  keyPair: { publicKey, secretKey }, // noise keypair used for the connection
  onauthenticate (remotePublicKey, done) // the onauthenticate hook to verify remote key pairs
}
```

Promise resolves when the data structure has been fully added.


#### `promise = r.remove(bitDataStructure)`

Remove a data structure from replication.
Promise resolves when the data structure has been fully removed.

#### `r.swarm`

The associated bitswarm instance.

#### `r.on('discovery-key', (discoveryKey, remoteStream) => ...)`

Emitted when a remote asks for a discovery key of a data structure you are
not currently replicating.

#### `r = Replicator.replicate(bitDataStructure[s])`

Easy "one off" replication of one or more data structures.

## License

MIT
