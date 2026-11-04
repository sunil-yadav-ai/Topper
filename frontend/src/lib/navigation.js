export function getPostLoginPath(user) {
  if (user?.role === "admin") return "/admin";
  if (user?.username) return `/profile/${encodeURIComponent(user.username)}`;
  return "/search";
}
