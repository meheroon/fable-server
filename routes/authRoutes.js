const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { connectDB } = require("../config/db");

const router = express.Router();

router.post("/jwt", async (req, res) => {
  const user = req.body;

  const token = jwt.sign(user, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.send({ token });
});

router.post("/register", async (req, res) => {
  const db = await connectDB();
  const usersCollection = db.collection("users");

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

  res.send({
    insertedId: result.insertedId,
    token,
    user: {
      name,
      email,
      role: newUser.role,
      photo: newUser.photo,
    },
  });
});

router.post("/login", async (req, res) => {
  const db = await connectDB();
  const usersCollection = db.collection("users");

  const { email, password } = req.body;

  const user = await usersCollection.findOne({ email });

  if (!user) {
    return res.status(404).send({ message: "User not found" });
  }

  const isValid = await bcrypt.compare(password, user.password);

  if (!isValid) {
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

router.post("/social-login", async (req, res) => {
  const db = await connectDB();
  const usersCollection = db.collection("users");

  const { name, email, photo, role } = req.body;

  let user = await usersCollection.findOne({ email });

  if (!user) {
    const newUser = {
      name,
      email,
      photo: photo || "",
      role: role || "user",
      wishlist: [],
      provider: "google",
      createdAt: new Date(),
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

module.exports = router;