const QUEUE_KEY = 'feedback_queue';

async function getItem(key: string): Promise<string | null> {
  return localStorage.getItem(key);
}

async function setItem(key: string, value: string): Promise<void> {
  localStorage.setItem(key, value);
}

async function removeItem(key: string): Promise<void> {
  localStorage.removeItem(key);
}

export { getItem, setItem, removeItem, QUEUE_KEY };
