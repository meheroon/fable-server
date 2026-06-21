const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { connectDB } = require("./config/db");
const seedAdmin = require("./utils/seedAdmin");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");

const ebookRoutes = require("./routes/ebookRoutes");
const bookmarkRoutes = require("./routes/bookmarkRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: [process.env.CLIENT_URL || "http://localhost:3000"],
    credentials: true,
  })
);

app.use(express.json());

app.use(authRoutes);
app.use(userRoutes);
app.use(ebookRoutes);
app.use(bookmarkRoutes);
app.use(paymentRoutes);
app.use(adminRoutes);
app.get("/", (req, res) => {
  res.send("Fable server is running");
});

const startServer = async () => {
  try {
    const db = await connectDB();
    await seedAdmin(db.collection("users"));

    app.listen(port, () => {
      console.log(`Fable server running on port ${port}`);
    });
  } catch (error) {
    console.error("Server failed to start:", error);
  }
};

startServer();