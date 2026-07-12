const DEFAULT_MIN_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 60000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getRandomMessageDelayMs() {
  const min = Number(process.env.WELCOME_MESSAGE_MIN_DELAY_MS) || DEFAULT_MIN_DELAY_MS;
  const max = Number(process.env.WELCOME_MESSAGE_MAX_DELAY_MS) || DEFAULT_MAX_DELAY_MS;
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  return lower + Math.floor(Math.random() * (upper - lower + 1));
}

export async function sendMessageWithRandomDelay(sendMessage, to, message) {
  const delayMs = getRandomMessageDelayMs();
  await wait(delayMs);
  return sendMessage(to, message);
}
