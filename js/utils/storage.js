/**
 * storage.js
 * -----------------------------------------------------------------------
 * Wrapper minimale attorno a localStorage. Nessun servizio deve chiamare
 * window.localStorage direttamente: passa sempre da qui, così una futura
 * evoluzione (es. sincronizzazione con la tabella "settings" su Supabase)
 * tocca solo questo file.
 */

function isStorageAvailable() {
  try {
    const testKey = "__sl_storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return true;
  } catch (error) {
    return false;
  }
}

const storageAvailable = isStorageAvailable();

export function getItem(key) {
  if (!storageAvailable) return null;
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn(`[storage] Lettura fallita per la chiave "${key}"`, error);
    return null;
  }
}

export function setItem(key, value) {
  if (!storageAvailable) return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`[storage] Scrittura fallita per la chiave "${key}"`, error);
    return false;
  }
}

export function removeItem(key) {
  if (!storageAvailable) return false;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`[storage] Rimozione fallita per la chiave "${key}"`, error);
    return false;
  }
}

export function getJSON(key) {
  const raw = getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`[storage] JSON non valido per la chiave "${key}"`, error);
    return null;
  }
}

export function setJSON(key, value) {
  try {
    return setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`[storage] Serializzazione fallita per la chiave "${key}"`, error);
    return false;
  }
}
