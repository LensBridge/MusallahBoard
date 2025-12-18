const STORAGE_KEY = "mb-admin-session";

function readSession() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY));
  } catch (error) {
    console.warn("Unable to parse admin session", error);
    return null;
  }
}

export function getSession() {
  return readSession();
}

export function isAuthenticated() {
  const session = readSession();
  return Boolean(session?.token);
}

export function persistSession(session) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function requireAuth(redirectPath = "/signin/") {
  if (!isAuthenticated()) {
    window.location.replace(redirectPath);
  }
}
