const express = require("express");
const { ObjectId } = require("mongodb");
const { connectDB } = require("../config/db");
const verifyToken = require("../middleware/verifyToken");

const router = express.Router();

router.post("/bookmarks", verifyToken, async (req, res) => {
  const db = await connectDB();
  const bookmarksCollection = db.collection("bookmarks");

  const bookmark = req.body;

  const exists = await bookmarksCollection.findOne({
    userEmail: bookmark.userEmail,
    ebookId: bookmark.ebookId,
  });

  if (exists) {
    return res.status(409).send({ message: "Already bookmarked" });
  }

  const result = await bookmarksCollection.insertOne({
    ...bookmark,
    createdAt: new Date(),
  });

  res.send(result);
});

router.get("/bookmarks/:email", verifyToken, async (req, res) => {
  const db = await connectDB();
  const bookmarksCollection = db.collection("bookmarks");

  const email = req.params.email;

  if (req.decoded.email !== email) {
    return res.status(403).send({ message: "Forbidden access" });
  }

  const bookmarks = await bookmarksCollection
    .find({ userEmail: email })
    .toArray();

  res.send(bookmarks);
});

router.delete("/bookmarks/:id", verifyToken, async (req, res) => {
  const db = await connectDB();
  const bookmarksCollection = db.collection("bookmarks");

  const result = await bookmarksCollection.deleteOne({
    _id: new ObjectId(req.params.id),
  });

  res.send(result);
});

module.exports = router;