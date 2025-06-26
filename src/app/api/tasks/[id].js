import clientPromise from "../../../lib/mongodb";
import { verifyToken } from "../../../lib/auth";
import { ObjectId } from "mongodb";

export default async function handler(req, res) {
  const { id } = req.query;
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ message: "Invalid token" });
  }

  const client = await clientPromise;
  const db = client.db();

  try {
    switch (req.method) {
      case "PUT":
        const { title, description, completed } = req.body;

        const updateData = {
          updatedAt: new Date(),
        };

        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (completed !== undefined) updateData.completed = completed;

        const result = await db.collection("tasks").findOneAndUpdate(
          {
            _id: new ObjectId(id),
            userId: new ObjectId(decoded.userId),
          },
          { $set: updateData },
          { returnDocument: "after" }
        );

        if (!result.value) {
          return res.status(404).json({ message: "Task not found" });
        }

        res.status(200).json(result.value);
        break;

      case "DELETE":
        const deleteResult = await db.collection("tasks").deleteOne({
          _id: new ObjectId(id),
          userId: new ObjectId(decoded.userId),
        });

        if (deleteResult.deletedCount === 0) {
          return res.status(404).json({ message: "Task not found" });
        }

        res.status(200).json({ message: "Task deleted successfully" });
        break;

      default:
        res.status(405).json({ message: "Method not allowed" });
    }
  } catch (error) {
    console.error("Task API error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
