const { connectDB } = require("../config/db");

const verifyWriter = async (req, res, next) => {
  const db = await connectDB();
  const usersCollection = db.collection("users");

  const user = await usersCollection.findOne({ email: req.decoded.email });

  if (user?.role !== "writer" && user?.role !== "admin") {
    return res.status(403).send({ message: "Writer only" });
  }

  next();
};

module.exports = verifyWriter;