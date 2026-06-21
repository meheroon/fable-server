const { connectDB } = require("../config/db");

const verifyAdmin = async (req, res, next) => {
  const db = await connectDB();
  const usersCollection = db.collection("users");

  const user = await usersCollection.findOne({ email: req.decoded.email });

  if (user?.role !== "admin") {
    return res.status(403).send({ message: "Admin only" });
  }

  next();
};

module.exports = verifyAdmin;