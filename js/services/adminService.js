export function createAdminService(config = {}) {
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
