const bcrypt = require("bcryptjs");

const seedAdmin = async (usersCollection) => {
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
};

module.exports = seedAdmin;