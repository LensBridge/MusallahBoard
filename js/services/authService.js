export function createAuthService(config = {}) {
  const useMock = config.useMock ?? !config.baseUrl;
  if (useMock) {
    return new MockAuthService();
  }
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

class MockAuthService {
  async signIn(credentials) {
    const email = credentials?.email?.trim();
    const password = credentials?.password?.trim();
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!email || !password) {
          reject(new Error("Enter both email and password to continue."));
          return;
        }
        resolve({
          token: "mock-token",
          issuedAt: Date.now(),
          user: {
            email,
            name: email.split("@")[0] || "Admin",
          },
        });
      }, 400);
    });
  }
}
