import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://wpilukuwehxphmorjxzd.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwaWx1a3V3ZWh4cGhtb3JqeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODgxNDMsImV4cCI6MjA5ODY2NDE0M30.PjBUX8c8ZU8YVYUuwb2ypGyfMtHg-jOPlFDausGDKZY";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function adminLogin(e) {
  e.preventDefault();
  const email = document.getElementById("admin-email").value;
  const password = document.getElementById("admin-password").value;
  const statusEl = document.getElementById("admin-login-status");

  statusEl.textContent = "Authenticating...";
  statusEl.className = "status-text";

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    statusEl.textContent = "Login failed: " + error.message;
    statusEl.className = "status-text error";
    return;
  }

  const user = data.user;
  if (user?.user_metadata?.role === "admin" || user?.user_metadata?.role === "superuser") {
    statusEl.textContent = "Welcome, Admin! Redirecting...";
    statusEl.className = "status-text success";
    setTimeout(() => {
      window.location.href = "/admin-dashboard.html";
    }, 1000);
  } else {
    await supabase.auth.signOut();
    statusEl.textContent = "Access denied. You are not an admin.";
    statusEl.className = "status-text error";
  }
}

window.addEventListener("load", async () => {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) {
    const role = data.session.user.user_metadata?.role;
    if (role === "admin" || role === "superuser") {
      window.location.href = "/admin-dashboard.html";
    }
  }
});

window.adminLogin = adminLogin;
