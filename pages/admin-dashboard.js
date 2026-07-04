import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://wpilukuwehxphmorjxzd.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwaWx1a3V3ZWh4cGhtb3JqeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODgxNDMsImV4cCI6MjA5ODY2NDE0M30.PjBUX8c8ZU8YVYUuwb2ypGyfMtHg-jOPlFDausGDKZY"; // replace with your real anon key
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function AdminDashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user;
      if (!u) {
        window.location.href = "/admin-login"; // redirect if not logged in
      } else if (u.user_metadata?.role !== "admin" && u.user_metadata?.role !== "superuser") {
        window.location.href = "/"; // redirect non-admins to landing
      } else {
        setUser(u);
      }
    }
    loadUser();
  }, []);

  if (!user) return <p>Loading...</p>;

  return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <h1>Admin Dashboard</h1>
      <p>Welcome back, {user.user_metadata?.full_name || user.email}!</p>
      <p>Here you can manage community settings, rewards, and more.</p>
      <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}>
        Logout
      </button>
    </div>
  );
}
