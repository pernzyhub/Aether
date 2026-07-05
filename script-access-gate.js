import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://wpilukuwehxphmorjxzd.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwaWx1a3V3ZWh4cGhtb3JqeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODgxNDMsImV4cCI6MjA5ODY2NDE0M30.PjBUX8c8ZU8YVYUuwb2ypGyfMtHg-jOPlFDausGDKZY";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const ACCESS_CODE = "AETHER2026"; // fallback

function saveAccessGate() {
  localStorage.setItem("aether_access_granted", "true");
}

function hasAccessGate() {
  return localStorage.getItem("aether_access_granted") === "true";
}

async function fetchAccessGateSetting() {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'access_gate')
      .single();
    if (error) return null;
    return data?.value || null;
  } catch (err) {
    return null;
  }
}

async function submitAccessCode() {
  const codeEl = document.getElementById("access-code");
  const code = (codeEl?.value || '').trim().toUpperCase();
  const statusEl = document.getElementById("access-gate-status");

  statusEl.textContent = "Checking code...";
  statusEl.className = "status-text";

  try {
    const setting = await fetchAccessGateSetting();
    const enabled = setting ? (setting.enabled === true) : (localStorage.getItem('aether_access_gate_enabled') === 'true');

    if (!enabled) {
      // Gate disabled globally, allow access
      saveAccessGate();
      statusEl.textContent = "Access gate disabled — redirecting...";
      statusEl.className = "status-text success";
      setTimeout(() => window.location.href = '/index.html', 400);
      return;
    }

    const expected = (setting && setting.access_code) || localStorage.getItem('aether_access_code') || ACCESS_CODE;

    if (code === (expected || '').toString().trim().toUpperCase()) {
      saveAccessGate();
      statusEl.textContent = "Access granted. Redirecting...";
      statusEl.className = "status-text success";
      setTimeout(() => window.location.href = "/index.html", 700);
      return;
    }

    statusEl.textContent = "Invalid access code.";
    statusEl.className = "status-text error";
  } catch (err) {
    statusEl.textContent = "Error checking access code.";
    statusEl.className = "status-text error";
  }
}

window.addEventListener("load", () => {
  window.setTimeout(async () => {
    try {
      const setting = await fetchAccessGateSetting();
      const enabled = setting ? (setting.enabled === true) : (localStorage.getItem('aether_access_gate_enabled') === 'true');

      if (!enabled || hasAccessGate()) {
        // If gate disabled globally or already granted locally, proceed to index
        window.location.href = "/index.html";
      }
    } catch (e) {
      if (hasAccessGate()) window.location.href = "/index.html";
    }
  }, 80);
});

window.submitAccessCode = submitAccessCode;
