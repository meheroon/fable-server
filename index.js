const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Stripe = require("stripe");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;
const stripe = Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_dummy");

app.use(cors({
  origin: [process.env.CLIENT_URL || "http://localhost:3000"],
  credentials: true
}));
app.use(express.json());

const client = new MongoClient(process.env.DB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).send({ message: "Unauthorized access" });

  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).send({ message: "Forbidden access" });
    req.decoded = decoded;
    next();
  });
};

async function run() {
  await client.connect();

  const db = client.db("fableDB");
  const usersCollection = db.collection("users");
  const ebooksCollection = db.collection("ebooks");
  const bookmarksCollection = db.collection("bookmarks");
  const purchasesCollection = db.collection("purchases");
  const transactionsCollection = db.collection("transactions");

  const verifyAdmin = async (req, res, next) => {
    const user = await usersCollection.findOne({ email: req.decoded.email });
    if (user?.role !== "admin") return res.status(403).send({ message: "Admin only" });
    next();
  };

  const verifyWriter = async (req, res, next) => {
    const user = await usersCollection.findOne({ email: req.decoded.email });
    if (user?.role !== "writer" && user?.role !== "admin") {
      return res.status(403).send({ message: "Writer only" });
    }
    next();
  };

  // Admin seed
  const adminEmail = "admin@fable.com";
  const existingAdmin = await usersCollection.findOne({ email: adminEmail });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash("Admin@123", 10);
    await usersCollection.insertOne({
      name: "Fable Admin",
      email: adminEmail,
      password: hashedPassword,
      photo: "",
      role: "admin",
      wishlist: [],
      createdAt: new Date(),
    });
    console.log("Default admin created");
  }

  // JWT
  app.post("/jwt", async (req, res) => {
    const user = req.body;
    const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.send({ token });
  });

  // Register
  app.post("/register", async (req, res) => {
    const { name, email, password, role, photo } = req.body;

    if (!name || !email || !password) {
      return res.status(400).send({ message: "Name, email and password are required" });
    }

    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return res.status(409).send({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      name,
      email,
      password: hashedPassword,
      role: role || "user",
      photo: photo || "",
      wishlist: [],
      createdAt: new Date(),
    };

    const result = await usersCollection.insertOne(newUser);

    const token = jwt.sign(
      { email, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.send({ insertedId: result.insertedId, token, user: newUser });
  });

  // Login
  app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    const user = await usersCollection.findOne({ email });
    if (!user) return res.status(404).send({ message: "User not found" });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).send({ message: "Invalid password" });

    const token = jwt.sign(
      { email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.send({
      token,
      user: {
        name: user.name,
        email: user.email,
        photo: user.photo,
        role: user.role,
      },
    });
  });

  // Google login user save
  app.post("/social-login", async (req, res) => {
    const { name, email, photo, role } = req.body;

    let user = await usersCollection.findOne({ email });

    if (!user) {
      const newUser = {
        name,
        email,
        photo: photo || "",
        role: role || "user",
        wishlist: [],
        createdAt: new Date(),
        provider: "google",
      };

      await usersCollection.insertOne(newUser);
      user = newUser;
    }

    const token = jwt.sign(
      { email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.send({ token, user });
  });

  // User role
  app.get("/users/role/:email", verifyToken, async (req, res) => {
    const email = req.params.email;

    if (req.decoded.email !== email) {
      return res.status(403).send({ message: "Forbidden access" });
    }

    const user = await usersCollection.findOne({ email });
    res.send({ role: user?.role || "user" });
  });

  // Manage users - admin
  app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
    const users = await usersCollection.find().project({ password: 0 }).toArray();
    res.send(users);
  });

  app.patch("/users/role/:id", verifyToken, verifyAdmin, async (req, res) => {
    const { role } = req.body;

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { role } }
    );

    res.send(result);
  });

  app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
    const result = await usersCollection.deleteOne({
      _id: new ObjectId(req.params.id),
    });

    res.send(result);
  });

  // Browse ebooks with search/filter/sort/pagination
  app.get("/ebooks", async (req, res) => {
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
    if (availability) query.status = availability;

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

  app.get("/featured-ebooks", async (req, res) => {
    const ebooks = await ebooksCollection
      .find({ status: "published" })
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();

    res.send(ebooks);
  });

  app.get("/ebooks/:id", async (req, res) => {
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

  // Writer ebook APIs
  app.post("/ebooks", verifyToken, verifyWriter, async (req, res) => {
    const ebook = req.body;

    const newEbook = {
      ...ebook,
      price: Number(ebook.price),
      status: ebook.status || "published",
      soldCount: 0,
      createdAt: new Date(),
    };

    const result = await ebooksCollection.insertOne(newEbook);
    res.send(result);
  });

  app.get("/writer/ebooks/:email", verifyToken, verifyWriter, async (req, res) => {
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

  app.patch("/ebooks/:id", verifyToken, verifyWriter, async (req, res) => {
    const id = req.params.id;
    const updatedData = req.body;

    if (updatedData.price) updatedData.price = Number(updatedData.price);

    const result = await ebooksCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedData }
    );

    res.send(result);
  });

  app.patch("/ebooks/status/:id", verifyToken, verifyWriter, async (req, res) => {
    const { status } = req.body;

    const result = await ebooksCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status } }
    );

    res.send(result);
  });

  app.delete("/ebooks/:id", verifyToken, verifyWriter, async (req, res) => {
    const result = await ebooksCollection.deleteOne({
      _id: new ObjectId(req.params.id),
    });

    res.send(result);
  });

  // Admin all ebooks
  app.get("/admin/ebooks", verifyToken, verifyAdmin, async (req, res) => {
    const ebooks = await ebooksCollection.find().sort({ createdAt: -1 }).toArray();
    res.send(ebooks);
  });

  // Bookmarks
  app.post("/bookmarks", verifyToken, async (req, res) => {
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

  app.get("/bookmarks/:email", verifyToken, async (req, res) => {
    const email = req.params.email;

    if (req.decoded.email !== email) {
      return res.status(403).send({ message: "Forbidden access" });
    }

    const bookmarks = await bookmarksCollection.find({ userEmail: email }).toArray();
    res.send(bookmarks);
  });

  app.delete("/bookmarks/:id", verifyToken, async (req, res) => {
    const result = await bookmarksCollection.deleteOne({
      _id: new ObjectId(req.params.id),
    });

    res.send(result);
  });

  // Stripe checkout
  app.post("/create-checkout-session", verifyToken, async (req, res) => {
    const { ebookId, buyerEmail } = req.body;

    const ebook = await ebooksCollection.findOne({ _id: new ObjectId(ebookId) });

    if (!ebook) return res.status(404).send({ message: "Ebook not found" });

    if (ebook.writerEmail === buyerEmail) {
      return res.status(403).send({ message: "Writer cannot purchase own ebook" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: buyerEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: ebook.title,
            },
            unit_amount: Math.round(Number(ebook.price) * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        ebookId,
        buyerEmail,
        writerEmail: ebook.writerEmail,
      },
      success_url: `${process.env.CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/ebook/${ebookId}`,
    });

    res.send({ url: session.url });
  });

  app.post("/payment-success", verifyToken, async (req, res) => {
    const { sessionId } = req.body;

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return res.status(400).send({ message: "Payment not completed" });
    }

    const existingPayment = await purchasesCollection.findOne({
      transactionId: session.payment_intent,
    });

    if (existingPayment) {
      return res.send({ message: "Payment already saved" });
    }

    const ebookId = session.metadata.ebookId;
    const ebook = await ebooksCollection.findOne({ _id: new ObjectId(ebookId) });

    const purchase = {
      ebookId,
      ebookTitle: ebook.title,
      buyerEmail: session.metadata.buyerEmail,
      writerEmail: session.metadata.writerEmail,
      price: ebook.price,
      transactionId: session.payment_intent,
      status: "paid",
      purchaseDate: new Date(),
    };

    const result = await purchasesCollection.insertOne(purchase);

    await transactionsCollection.insertOne({
      transactionId: session.payment_intent,
      type: "purchase",
      email: session.metadata.buyerEmail,
      amount: ebook.price,
      ebookId,
      date: new Date(),
    });

    await ebooksCollection.updateOne(
      { _id: new ObjectId(ebookId) },
      { $inc: { soldCount: 1 } }
    );

    res.send(result);
  });

  // Purchase history
  app.get("/purchases/:email", verifyToken, async (req, res) => {
    const email = req.params.email;

    if (req.decoded.email !== email) {
      return res.status(403).send({ message: "Forbidden access" });
    }

    const purchases = await purchasesCollection
      .find({ buyerEmail: email })
      .sort({ purchaseDate: -1 })
      .toArray();

    res.send(purchases);
  });

  app.get("/writer/sales/:email", verifyToken, verifyWriter, async (req, res) => {
    const email = req.params.email;

    const sales = await purchasesCollection
      .find({ writerEmail: email })
      .sort({ purchaseDate: -1 })
      .toArray();

    res.send(sales);
  });

  // Admin analytics
  app.get("/admin/stats", verifyToken, verifyAdmin, async (req, res) => {
    const totalUsers = await usersCollection.countDocuments();
    const totalWriters = await usersCollection.countDocuments({ role: "writer" });
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
      totalEbooksSold,
      totalRevenue: revenueData[0]?.totalRevenue || 0,
    });
  });

  app.get("/admin/transactions", verifyToken, verifyAdmin, async (req, res) => {
    const transactions = await transactionsCollection
      .find()
      .sort({ date: -1 })
      .toArray();

    res.send(transactions);
  });

  app.get("/admin/monthly-sales", verifyToken, verifyAdmin, async (req, res) => {
    const data = await purchasesCollection
      .aggregate([
        {
          $group: {
            _id: { $month: "$purchaseDate" },
            sales: { $sum: "$price" },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id": 1 } },
      ])
      .toArray();

    res.send(data);
  });

  app.get("/admin/genre-stats", verifyToken, verifyAdmin, async (req, res) => {
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

  app.get("/top-writers", async (req, res) => {
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

  app.get("/", (req, res) => {
    res.send("Fable server is running");
  });

  console.log("MongoDB connected successfully");
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Fable server running on port ${port}`);
});