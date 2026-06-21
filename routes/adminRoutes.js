const express = require("express");
const { ObjectId } = require("mongodb");
const { connectDB } = require("../config/db");
const verifyToken = require("../middleware/verifyToken");
const verifyAdmin = require("../middleware/verifyAdmin");

const router = express.Router();

router.get("/admin/ebooks", verifyToken, verifyAdmin, async (req, res) => {
  const db = await connectDB();
  const ebooksCollection = db.collection("ebooks");

  const ebooks = await ebooksCollection
    .find()
    .sort({ createdAt: -1 })
    .toArray();

  res.send(ebooks);
});

router.patch("/admin/ebooks/status/:id", verifyToken, verifyAdmin, async (req, res) => {
  const db = await connectDB();
  const ebooksCollection = db.collection("ebooks");

  const { status } = req.body;

  const result = await ebooksCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { status } }
  );

  res.send(result);
});

router.delete("/admin/ebooks/:id", verifyToken, verifyAdmin, async (req, res) => {
  const db = await connectDB();
  const ebooksCollection = db.collection("ebooks");

  const result = await ebooksCollection.deleteOne({
    _id: new ObjectId(req.params.id),
  });

  res.send(result);
});

router.get("/admin/transactions", verifyToken, verifyAdmin, async (req, res) => {
  const db = await connectDB();
  const transactionsCollection = db.collection("transactions");

  const transactions = await transactionsCollection
    .find()
    .sort({ date: -1 })
    .toArray();

  res.send(transactions);
});

router.get("/admin/stats", verifyToken, verifyAdmin, async (req, res) => {
  const db = await connectDB();

  const usersCollection = db.collection("users");
  const ebooksCollection = db.collection("ebooks");
  const purchasesCollection = db.collection("purchases");

  const totalUsers = await usersCollection.countDocuments();
  const totalWriters = await usersCollection.countDocuments({ role: "writer" });
  const totalEbooks = await ebooksCollection.countDocuments();
  const totalEbooksSold = await purchasesCollection.countDocuments();

  const revenueData = await purchasesCollection
    .aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$price" },
        },
      },
    ])
    .toArray();

  res.send({
    totalUsers,
    totalWriters,
    totalEbooks,
    totalEbooksSold,
    totalRevenue: revenueData[0]?.totalRevenue || 0,
  });
});

router.get("/admin/monthly-sales", verifyToken, verifyAdmin, async (req, res) => {
  const db = await connectDB();
  const purchasesCollection = db.collection("purchases");

  const data = await purchasesCollection
    .aggregate([
      {
        $group: {
          _id: { $month: "$purchaseDate" },
          sales: { $sum: "$price" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray();

  res.send(data);
});

router.get("/admin/genre-stats", verifyToken, verifyAdmin, async (req, res) => {
  const db = await connectDB();
  const ebooksCollection = db.collection("ebooks");

  const data = await ebooksCollection
    .aggregate([
      {
        $group: {
          _id: "$genre",
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();

  res.send(data);
});

router.get("/top-writers", async (req, res) => {
  const db = await connectDB();
  const purchasesCollection = db.collection("purchases");

  const writers = await purchasesCollection
    .aggregate([
      {
        $group: {
          _id: "$writerEmail",
          totalSales: { $sum: "$price" },
          soldBooks: { $sum: 1 },
        },
      },
      { $sort: { totalSales: -1 } },
      { $limit: 3 },
    ])
    .toArray();

  res.send(writers);
});

module.exports = router;