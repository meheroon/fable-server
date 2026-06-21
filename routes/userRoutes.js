const express = require("express");
const { ObjectId } = require("mongodb");
const { connectDB } = require("../config/db");
const verifyToken = require("../middleware/verifyToken");
const verifyAdmin = require("../middleware/verifyAdmin");

const router = express.Router();

router.get("/users/role/:email", verifyToken, async (req, res) => {
  const db = await connectDB();
  const usersCollection = db.collection("users");

  const email = req.params.email;

  if (req.decoded.email !== email) {
    return res.status(403).send({ message: "Forbidden access" });
  }

  const user = await usersCollection.findOne({ email });

  res.send({ role: user?.role || "user" });
});

router.get("/users", verifyToken, verifyAdmin, async (req, res) => {
  const db = await connectDB();
  const usersCollection = db.collection("users");

  const users = await usersCollection.find().project({ password: 0 }).toArray();

  res.send(users);
});

router.patch("/users/role/:id", verifyToken, verifyAdmin, async (req, res) => {
  const db = await connectDB();
  const usersCollection = db.collection("users");

  const { role } = req.body;

  const result = await usersCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { role } }
  );

  res.send(result);
});

router.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
  const db = await connectDB();
  const usersCollection = db.collection("users");

  const result = await usersCollection.deleteOne({
    _id: new ObjectId(req.params.id),
  });

  res.send(result);
});

module.exports = router;