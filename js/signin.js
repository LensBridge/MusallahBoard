import { persistSession, isAuthenticated } from "./auth.js";
import { createAuthService } from "./services/authService.js";

const adminConfig = window.__MB_ADMIN_CONFIG__ || {};
const authService = createAuthService(adminConfig.auth || {});

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const redirectPath = params.get("redirect") || "/admin/";

  if (isAuthenticated()) {
    window.location.replace(redirectPath);
    return;
  }

  const form = document.getElementById("signinForm");
  const statusEl = document.getElementById("formStatus");
  const submitBtn = form.querySelector("button[type=submit]");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    statusEl.textContent = "";
    statusEl.dataset.variant = "";

    const formData = new FormData(form);
    const email = formData.get("email");
    const password = formData.get("password");

    submitBtn.disabled = true;
    submitBtn.textContent = "Signing in...";

    try {
      const session = await authService.signIn({ email, password });
      persistSession(session);
      statusEl.textContent = "Signed in successfully. Redirecting...";
      statusEl.dataset.variant = "success";
      window.location.replace(redirectPath);
    } catch (error) {
      statusEl.textContent = error.message;
      statusEl.dataset.variant = "error";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Enter Dashboard";
    }
  });
});
