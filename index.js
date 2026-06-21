const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(
  cors({
    origin: [process.env.CLIENT_URL],
    credentials: true,
  })
);
app.use(express.json());

// MongoDB URI
// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const uri = process.env.DB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// JWT middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }

    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    const db = client.db("fableDB");

    const usersCollection = db.collection("users");
    const ebooksCollection = db.collection("ebooks");
    const purchasesCollection = db.collection("purchases");
    const bookmarksCollection = db.collection("bookmarks");
    const transactionsCollection = db.collection("transactions");

    // Admin seed
    const adminEmail = "admin@fable.com";
    const existingAdmin = await usersCollection.findOne({ email: adminEmail });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash("Admin@123", 10);

      await usersCollection.insertOne({
        name: "Fable Admin",
        email: adminEmail,
        password: hashedPassword,
        role: "admin",
        photo: "",
        createdAt: new Date(),
      });

      console.log("Default admin created");
    }

    // JWT create
    app.post("/jwt", async (req, res) => {
      const user = req.body;

      const token = jwt.sign(user, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });

      res.send({ token });
    });

    // Register user
    app.post("/register", async (req, res) => {
      const { name, email, password, role, photo } = req.body;

      if (!name || !email || !password) {
        return res.status(400).send({ message: "Required fields missing" });
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

      res.send({
        insertedId: result.insertedId,
        message: "User registered successfully",
      });
    });

    // Login user
    app.post("/login", async (req, res) => {
      const { email, password } = req.body;

      const user = await usersCollection.findOne({ email });

      if (!user) {
        return res.status(404).send({ message: "User not found" });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).send({ message: "Invalid password" });
      }

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

    // Get user role
    app.get("/users/role/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      const user = await usersCollection.findOne({ email });

      res.send({ role: user?.role || "user" });
    });

    // Get all users - admin later protect করব
    app.get("/users", verifyToken, async (req, res) => {
      const users = await usersCollection
        .find()
        .project({ password: 0 })
        .toArray();

      res.send(users);
    });

    // Update user role
    app.patch("/users/role/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role } }
      );

      res.send(result);
    });

    // Delete user
    app.delete("/users/:id", verifyToken, async (req, res) => {
      const id = req.params.id;

      const result = await usersCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    // test route
    app.get("/", (req, res) => {
      res.send("Fable server is running");
    });

    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error(error);
  }
}

run();

app.listen(port, () => {
  console.log(`Fable server running on port ${port}`);
});