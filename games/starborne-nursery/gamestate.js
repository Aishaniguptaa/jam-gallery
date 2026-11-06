// The one place Starborne Nursery's saved state lives: the Caretaker's name, given on first
// launch. Everything else in the game is derived from tuning.js, so nothing else is stored.

const STORAGE_KEY = 'starborne-nursery:caretaker';
const DEFAULT_NAME = 'Caretaker';
const MAX_NAME_LENGTH = 16;

// localStorage can throw: Safari private mode, a sandboxed frame, or a file:// page. A save
// that silently does nothing is fine here — the jam has no save feature — but a crash is not.
function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    return null;
  }
}

function writeStored(name) {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch (err) {
    // No storage available. The name still lives in memory for this session.
  }
}

// Trim, collapse runs of spaces, and cap the length so a pasted essay can't break the layout.
function clean(name) {
  return String(name == null ? '' : name)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

let caretakerName = clean(readStored()) || DEFAULT_NAME;
let named = caretakerName !== DEFAULT_NAME;

export const GameState = {
  // The Caretaker's name. Never empty: an unnamed Caretaker is simply called "Caretaker".
  get caretakerName() {
    return caretakerName;
  },

  // True once the player has given a name, this session or a previous one.
  get isNamed() {
    return named;
  },

  // The name a fresh session starts with, used to prefill the prompt. Empty when unnamed.
  get storedName() {
    return named ? caretakerName : '';
  },

  setName(name) {
    const cleaned = clean(name);
    if (cleaned === '') return caretakerName;

    caretakerName = cleaned;
    named = true;
    writeStored(caretakerName);
    return caretakerName;
  },
};
