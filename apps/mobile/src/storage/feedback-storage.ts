import { appStorage } from './app-storage';

const QUEUE_KEY = 'feedback_queue';

async function getItem(key: string): Promise<string | null> {
  return appStorage.getItem(key);
}

async function setItem(key: string, value: string): Promise<void> {
  return appStorage.setItem(key, value);
}

async function removeItem(key: string): Promise<void> {
  return appStorage.removeItem(key);
}

export { getItem, setItem, removeItem, QUEUE_KEY };
