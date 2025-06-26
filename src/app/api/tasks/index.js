import clientPromise from "../../../lib/mongodb";
import { verifyToken } from "../../../lib/auth";
import { ObjectId } from "mongodb";

export default async function handler(req, res) {
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
      case "GET":
        const tasks = await db
          .collection("tasks")
          .find({ userId: new ObjectId(decoded.userId) })
          .sort({ createdAt: -1 })
          .toArray();

        res.status(200).json(tasks);
        break;

      case "POST":
        const { title, description } = req.body;

        if (!title) {
          return res.status(400).json({ message: "Title is required" });
        }

        const newTask = {
          title,
          description: description || "",
          completed: false,
          userId: new ObjectId(decoded.userId),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const result = await db.collection("tasks").insertOne(newTask);
        const task = await db
          .collection("tasks")
          .findOne({ _id: result.insertedId });

        res.status(201).json(task);
        break;

      default:
        res.status(405).json({ message: "Method not allowed" });
    }
  } catch (error) {
    console.error("Tasks API error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
