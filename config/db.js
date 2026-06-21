const { MongoClient, ServerApiVersion } = require("mongodb");

const client = new MongoClient(process.env.DB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;

const connectDB = async () => {
  if (!db) {
    await client.connect();
    db = client.db("fableDB");
    console.log("MongoDB connected successfully");
  }

  return db;
};

module.exports = { connectDB };