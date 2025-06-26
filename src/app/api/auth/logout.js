export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  res.setHeader("Set-Cookie", "token=; Path=/; HttpOnly; Max-Age=0");
  res.status(200).json({ message: "Logout successful" });
}
