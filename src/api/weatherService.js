/**
 * =====================================================
 * Weather Service (best-effort)
 * =====================================================
 * The backend exposes no weather endpoint, so the kiosk
 * fetches OpenWeatherMap directly using the API key saved
 * during setup. Any failure degrades gracefully to null —
 * the TopBar simply hides the weather chip.
 * =====================================================
 */

const OWM_BASE = 'https://api.openweathermap.org/data/2.5/weather';

/**
 * @param {{latitude:number,longitude:number,city:string}} location
 * @param {string} apiKey  OpenWeatherMap key (from setup cookie)
 * @returns {Promise<{temp:number,condition:string,city:string}|null>}
 */
export async function getWeather(location, apiKey) {
  if (!apiKey || !location?.latitude) return null;
  try {
    const url =
      `${OWM_BASE}?lat=${location.latitude}&lon=${location.longitude}` +
      `&units=metric&appid=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const d = await res.json();
    return {
      temp: Math.round(d.main?.temp ?? 0),
      condition: d.weather?.[0]?.main || d.weather?.[0]?.description || 'Clear',
      city: location.city || d.name || '',
    };
  } catch {
    return null;
  }
}
