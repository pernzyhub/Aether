import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://wpilukuwehxphmorjxzd.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwaWx1a3V3ZWh4cGhtb3JqeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODgxNDMsImV4cCI6MjA5ODY2NDE0M30.PjBUX8c8ZU8YVYUuwb2ypGyfMtHg-jOPlFDausGDKZY"; // replace with your real anon key
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user;

      if (!u) {
        // Not logged in → back to admin login
        window.location.href = "/admin-login";
      } else if (u.user_metadata?.role !== "admin" && u.user_metadata?.role !== "superuser") {
        // Logged in but not admin → back to landing
        window.location.href = "/";
      } else {
        setUser(u);
      }
      setLoading(false);
    }
    loadUser();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) return <p style={{ textAlign: "center" }}>Loading...</p>;

  if (!user) return null;

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: "40px", textAlign: "center" }}>
      <h1>Admin Dashboard</h1>
      <p>Welcome back, {user.user_metadata?.full_name || user.email}!</p>

      <div style={{ marginTop: "30px" }}>
        <h2>Portal Options</h2>
        <button
          style={{
            padding: "10px 20px",
            margin: "10px",
            background: "#5865f2",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
          onClick={() => window.location.href = "/community"}
        >
          Community Area
        </button>
        <button
          style={{
            padding: "10px 20px",
            margin: "10px",
            background: "#ff4444",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
          onClick={logout}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
