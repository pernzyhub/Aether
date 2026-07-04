import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://wpilukuwehxphmorjxzd.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwaWx1a3V3ZWh4cGhtb3JqeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODgxNDMsImV4cCI6MjA5ODY2NDE0M30.PjBUX8c8ZU8YVYUuwb2ypGyfMtHg-jOPlFDausGDKZY"; // replace with your real anon key
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  async function handleLogin(e) {
    e.preventDefault();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setStatus("Login failed: " + error.message);
    } else {
      const user = data.user;
      if (user?.user_metadata?.role === "admin" || user?.user_metadata?.role === "superuser") {
        setStatus("Welcome, Admin!");
        window.location.href = "/admin-dashboard"; // ✅ Next.js route
      } else {
        setStatus("Access denied. Not an admin.");
      }
    }
  }

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: "40px", textAlign: "center" }}>
      <h1>Administrator Access</h1>
      <p>This section is reserved for superusers. Please log in with your admin credentials.</p>

      <form onSubmit={handleLogin} style={{ marginTop: "20px" }}>
        <div>
          <label>Email:</label><br />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ padding: "8px", width: "250px", marginBottom: "10px" }}
          />
        </div>
        <div>
          <label>Password:</label><br />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ padding: "8px", width: "250px", marginBottom: "10px" }}
          />
        </div>
        <button
          type="submit"
          style={{
            padding: "10px 20px",
            background: "#ff4444",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Admin Login
        </button>
      </form>

      <p style={{ marginTop: "20px", color: "#ffd700" }}>{status}</p>
    </div>
  );
}
