const express = require("express");
const { ObjectId } = require("mongodb");
const { connectDB } = require("../config/db");
const verifyToken = require("../middleware/verifyToken");
const verifyWriter = require("../middleware/verifyWriter");

const router = express.Router();

// Public browse ebooks with search/filter/sort/pagination
router.get("/ebooks", async (req, res) => {
  const db = await connectDB();
  const ebooksCollection = db.collection("ebooks");

  const {
    search = "",
    genre,
    minPrice,
    maxPrice,
    availability,
    sort = "newest",
    page = 1,
    limit = 8,
  } = req.query;

  const query = {};

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { writerName: { $regex: search, $options: "i" } },
    ];
  }

  if (genre) query.genre = genre;

  if (availability === "available") query.status = "published";
  if (availability === "sold") query.soldCount = { $gt: 0 };

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  let sortOption = { createdAt: -1 };
  if (sort === "price-low-high") sortOption = { price: 1 };
  if (sort === "price-high-low") sortOption = { price: -1 };

  const currentPage = Number(page);
  const perPage = Number(limit);
  const skip = (currentPage - 1) * perPage;

  const total = await ebooksCollection.countDocuments(query);

  const ebooks = await ebooksCollection
    .find(query)
    .sort(sortOption)
    .skip(skip)
    .limit(perPage)
    .toArray();

  res.send({
    ebooks,
    total,
    page: currentPage,
    totalPages: Math.ceil(total / perPage),
  });
});

// Featured ebooks for home page
router.get("/featured-ebooks", async (req, res) => {
  const db = await connectDB();
  const ebooksCollection = db.collection("ebooks");

  const ebooks = await ebooksCollection
    .find({ status: "published" })
    .sort({ createdAt: -1 })
    .limit(6)
    .toArray();

  res.send(ebooks);
});

// Single ebook details
router.get("/ebooks/:id", async (req, res) => {
  const db = await connectDB();
  const ebooksCollection = db.collection("ebooks");

  const id = req.params.id;

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: "Invalid ebook ID" });
  }

  const ebook = await ebooksCollection.findOne({ _id: new ObjectId(id) });

  if (!ebook) {
    return res.status(404).send({ message: "Ebook not found" });
  }

  res.send(ebook);
});

// Add ebook - writer/admin only
router.post("/ebooks", verifyToken, verifyWriter, async (req, res) => {
  const db = await connectDB();
  const ebooksCollection = db.collection("ebooks");

  const ebook = req.body;

  const newEbook = {
    title: ebook.title,
    description: ebook.description,
    content: ebook.content,
    price: Number(ebook.price),
    genre: ebook.genre,
    coverImage: ebook.coverImage,
    writerName: ebook.writerName,
    writerEmail: ebook.writerEmail,
    status: ebook.status || "published",
    soldCount: 0,
    createdAt: new Date(),
  };

  const result = await ebooksCollection.insertOne(newEbook);
  res.send(result);
});

// Writer own ebooks
router.get("/writer/ebooks/:email", verifyToken, verifyWriter, async (req, res) => {
  const db = await connectDB();
  const ebooksCollection = db.collection("ebooks");

  const email = req.params.email;

  if (req.decoded.email !== email && req.decoded.role !== "admin") {
    return res.status(403).send({ message: "Forbidden access" });
  }

  const ebooks = await ebooksCollection
    .find({ writerEmail: email })
    .sort({ createdAt: -1 })
    .toArray();

  res.send(ebooks);
});

// Edit ebook
router.patch("/ebooks/:id", verifyToken, verifyWriter, async (req, res) => {
  const db = await connectDB();
  const ebooksCollection = db.collection("ebooks");

  const id = req.params.id;
  const updatedData = req.body;

  if (updatedData.price) {
    updatedData.price = Number(updatedData.price);
  }

  const result = await ebooksCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: updatedData }
  );

  res.send(result);
});

// Publish / unpublish
router.patch("/ebooks/status/:id", verifyToken, verifyWriter, async (req, res) => {
  const db = await connectDB();
  const ebooksCollection = db.collection("ebooks");

  const { status } = req.body;

  const result = await ebooksCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { status } }
  );

  res.send(result);
});

// Delete ebook
router.delete("/ebooks/:id", verifyToken, verifyWriter, async (req, res) => {
  const db = await connectDB();
  const ebooksCollection = db.collection("ebooks");

  const result = await ebooksCollection.deleteOne({
    _id: new ObjectId(req.params.id),
  });

  res.send(result);
});

module.exports = router;