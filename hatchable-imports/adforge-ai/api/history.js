import { db } from "hatchable";

export const access = "user";
export const methods = ["GET"];

export default async function (req, res) {
  const { rows } = await db.query(
    "SELECT id, product_name, platform, objective, created_at, result FROM creations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30",
    [req.user.id]
  );
  res.json(rows);
}