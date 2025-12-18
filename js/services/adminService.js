import { EVENTS, POSTERS } from "../data.js";

export function createAdminService(config = {}) {
  const useMock = config.useMock ?? !config.apiBase;
  if (useMock) {
    return new MockAdminService();
  }
  return new ApiAdminService(config.apiBase);
}

class ApiAdminService {
  constructor(baseUrl = "") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.mode = "api";
  }

  getMode() {
    return this.mode;
  }

  async fetchEvents() {
    return this.request("/events");
  }

  async fetchPosters() {
    return this.request("/posters");
  }

  async createEvent(payload) {
    return this.request("/events", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateEvent(id, payload) {
    return this.request(`/events/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async deleteEvent(id) {
    return this.request(`/events/${id}`, { method: "DELETE" });
  }

  async clearPastEvents() {
    return this.request("/events/past", { method: "DELETE" });
  }

  async createPoster(payload) {
    return this.request("/posters", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updatePoster(id, payload) {
    return this.request(`/posters/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async deletePoster(id) {
    return this.request(`/posters/${id}`, { method: "DELETE" });
  }

  async simulateSync() {
    try {
      return await this.request("/sync", { method: "POST" });
    } catch (error) {
      console.warn("Sync endpoint not available; returning timestamp only.", error);
      return {
        syncedAt: Date.now(),
        events: 0,
        posters: 0,
      };
    }
  }

  async request(path, options = {}) {
    if (!this.baseUrl) {
      throw new Error("API base URL not configured.");
    }
    const response = await fetch(`${this.baseUrl}${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Request failed with status ${response.status}`);
    }

    if (response.status === 204) {
      return {};
    }
    return response.json();
  }
}

class MockAdminService {
  constructor() {
    this.mode = "mock";
    this.events = deepClone(EVENTS).map((event) => ({
      ...event,
      audience: event.audience || "both",
    }));
    this.posters = deepClone(POSTERS).map((poster) => ({
      ...poster,
      audience: poster.audience || "both",
      startDate: poster.startDate || "",
      endDate: poster.endDate || "",
    }));
  }

  getMode() {
    return this.mode;
  }

  async fetchEvents() {
    return deepClone(this.events);
  }

  async fetchPosters() {
    return deepClone(this.posters);
  }

  async createEvent(payload) {
    const newEvent = {
      id: createId(),
      ...payload,
    };
    this.events.push(newEvent);
    return deepClone(newEvent);
  }

  async updateEvent(id, payload) {
    this.events = this.events.map((event) =>
      event.id === id
        ? {
            ...event,
            ...payload,
            id,
          }
        : event
    );
    return deepClone(this.events.find((event) => event.id === id));
  }

  async deleteEvent(id) {
    this.events = this.events.filter((event) => event.id !== id);
    return { success: true };
  }

  async clearPastEvents(reference = Date.now()) {
    this.events = this.events.filter((event) => event.endTimestamp >= reference);
    return deepClone(this.events);
  }

  async createPoster(payload) {
    const newPoster = {
      id: createId(),
      ...payload,
    };
    this.posters.push(newPoster);
    return deepClone(newPoster);
  }

  async updatePoster(id, payload) {
    this.posters = this.posters.map((poster) =>
      poster.id === id
        ? {
            ...poster,
            ...payload,
            id,
          }
        : poster
    );
    return deepClone(this.posters.find((poster) => poster.id === id));
  }

  async deletePoster(id) {
    this.posters = this.posters.filter((poster) => poster.id !== id);
    return { success: true };
  }

  async simulateSync() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          syncedAt: Date.now(),
          events: this.events.length,
          posters: this.posters.length,
        });
      }, 600);
    });
  }
}

function deepClone(data) {
  return JSON.parse(JSON.stringify(data));
}

function createId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}
