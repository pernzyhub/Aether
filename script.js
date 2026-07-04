import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const canvas = document.getElementById('matrix-canvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const columns = Math.floor(canvas.width / 20);
const drops = Array(columns).fill(1);
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789アイウエオカキクケコサシスセソタチツテト';

function drawMatrix() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.fillStyle = '#00ff41';
  ctx.font = '15px Courier New';
  
  for (let i = 0; i < drops.length; i++) {
    const text = chars[Math.floor(Math.random() * chars.length)];
    ctx.fillText(text, i * 20, drops[i] * 20);
    
    if (drops[i] * 20 > canvas.height && Math.random() > 0.975) {
      drops[i] = 0;
    }
    drops[i]++;
  }
}

setInterval(drawMatrix, 50);

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

const supabaseUrl = "https://wpilukuwehxphmorjxzd.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwaWx1a3V3ZWh4cGhtb3JqeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODgxNDMsImV4cCI6MjA5ODY2NDE0M30.PjBUX8c8ZU8YVYUuwb2ypGyfMtHg-jOPlFDausGDKZY";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function discordLogin() {
  await supabase.auth.signInWithOAuth({ provider: "discord" });
}

async function logout() {
  await supabase.auth.signOut();
  const userEl = document.getElementById("user");
  if (userEl) userEl.textContent = "Logged out.";
}

function toggleAdminDropdown() {
  const dropdown = document.getElementById("adminDropdown");
  dropdown.classList.toggle("open");
}

async function adminLogin() {
  const email = document.getElementById("adminEmail").value;
  const password = document.getElementById("adminPassword").value;
  const statusEl = document.getElementById("adminStatus");

  statusEl.textContent = "";
  statusEl.className = "status-text";

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    statusEl.textContent = "Login failed: " + error.message;
    statusEl.className = "status-text error";
  } else {
    const user = data.user;
    const role = user?.app_metadata?.role;
    if (role === "admin" || role === "superuser") {
      statusEl.textContent = "Welcome, Admin!";
      statusEl.className = "status-text success";
      setTimeout(() => {
        window.location.href = "/admin-dashboard.html";
      }, 1000);
    } else {
      statusEl.textContent = "Access denied. Not an admin.";
      statusEl.className = "status-text error";
    }
  }
}

supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    window.location.href = "/portal.html";
  }
});

window.addEventListener("load", async () => {
  const { data } = await supabase.auth.getSession();
  const userEl = document.getElementById("user");
  if (userEl) {
    userEl.textContent = JSON.stringify(data.session?.user || "Not logged in", null, 2);
  }
});

window.discordLogin = discordLogin;
window.logout = logout;
window.toggleAdminDropdown = toggleAdminDropdown;
window.adminLogin = adminLogin;
window.memberLogin = memberLogin;
