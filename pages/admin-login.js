if (user?.user_metadata?.role === "admin" || user?.user_metadata?.role === "superuser") {
  document.getElementById("status").textContent = "Welcome, Admin!";
  window.location.href = "/admin-dashboard"; // ✅ Next.js route
} else {
  document.getElementById("status").textContent = "Access denied. Not an admin.";
}
