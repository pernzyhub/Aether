import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://wpilukuwehxphmorjxzd.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwaWx1a3V3ZWh4cGhtb3JqeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODgxNDMsImV4cCI6MjA5ODY2NDE0M30.PjBUX8c8ZU8YVYUuwb2ypGyfMtHg-jOPlFDausGDKZY";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const ACCESS_CODE = "AETHER2026";

function saveAccessGate() {
  localStorage.setItem("aether_access_granted", "true");
}

function hasAccessGate() {
  return localStorage.getItem("aether_access_granted") === "true";
}

async function submitAccessCode() {
  const code = document.getElementById("access-code").value.trim().toUpperCase();
  const statusEl = document.getElementById("access-gate-status");

  statusEl.textContent = "Checking code...";
  statusEl.className = "status-text";

  if (code === ACCESS_CODE) {
    saveAccessGate();
    statusEl.textContent = "Access granted. Redirecting...";
    statusEl.className = "status-text success";
    setTimeout(() => {
      window.location.href = "/index.html";
    }, 700);
    return;
  }

  statusEl.textContent = "Invalid access code.";
  statusEl.className = "status-text error";
}

window.addEventListener("load", () => {
  window.setTimeout(async () => {
    if (hasAccessGate()) {
      window.location.href = "/index.html";
    }
  }, 80);
});

window.submitAccessCode = submitAccessCode;
