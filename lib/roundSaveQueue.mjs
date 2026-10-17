// The custom server runs in a single Node process. Keep the queue across dev reloads.
// Multiple server processes would require a distributed lock or Mongo transactions.
const queues = globalThis.gmlRoundSaveQueues ??= new Map();

export async function serializeRoundSave(roundId, save) {
  const key = String(roundId);
  const previous = queues.get(key) || Promise.resolve();
  const pending = previous.then(save);
  const settled = pending.then(() => {}, () => {});
  queues.set(key, settled);
  try {
    return await pending;
  } finally {
    if (queues.get(key) === settled) queues.delete(key);
  }
}
