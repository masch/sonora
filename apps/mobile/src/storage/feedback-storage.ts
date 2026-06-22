import SqliteStorage from 'expo-sqlite/kv-store';

const QUEUE_KEY = 'feedback_queue';

async function getItem(key: string): Promise<string | null> {
  return SqliteStorage.getItem(key);
}

async function setItem(key: string, value: string): Promise<void> {
  return SqliteStorage.setItem(key, value);
}

async function removeItem(key: string): Promise<void> {
  return SqliteStorage.removeItem(key);
}

export { getItem, setItem, removeItem, QUEUE_KEY };
