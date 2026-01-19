export function createAuthService(config = {}) {
  return new ApiAuthService(config.baseUrl);
}

class ApiAuthService {
  constructor(baseUrl = "") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async signIn(credentials) {
    if (!this.baseUrl) {
      throw new Error("Auth API base URL not configured.");
    }
    return this.request("/signin", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  }

  async request(path, options = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      credentials: "include",
      ...options,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Auth request failed with status ${response.status}`);
    }

    return response.json();
  }
}
