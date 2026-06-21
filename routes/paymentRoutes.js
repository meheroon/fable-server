const express = require("express");
const Stripe = require("stripe");
const { ObjectId } = require("mongodb");
const { connectDB } = require("../config/db");
const verifyToken = require("../middleware/verifyToken");
const verifyWriter = require("../middleware/verifyWriter");

const router = express.Router();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

router.post("/create-checkout-session", verifyToken, async (req, res) => {
  const db = await connectDB();
  const ebooksCollection = db.collection("ebooks");

  const { ebookId, buyerEmail } = req.body;

  const ebook = await ebooksCollection.findOne({
    _id: new ObjectId(ebookId),
  });

  if (!ebook) {
    return res.status(404).send({ message: "Ebook not found" });
  }

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

router.post("/payment-success", verifyToken, async (req, res) => {
  const db = await connectDB();

  const ebooksCollection = db.collection("ebooks");
  const purchasesCollection = db.collection("purchases");
  const transactionsCollection = db.collection("transactions");

  const { sessionId } = req.body;

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid") {
    return res.status(400).send({ message: "Payment not completed" });
  }

  const existingPurchase = await purchasesCollection.findOne({
    transactionId: session.payment_intent,
  });

  if (existingPurchase) {
    return res.send({ message: "Payment already saved" });
  }

  const ebookId = session.metadata.ebookId;

  const ebook = await ebooksCollection.findOne({
    _id: new ObjectId(ebookId),
  });

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

router.get("/purchases/:email", verifyToken, async (req, res) => {
  const db = await connectDB();
  const purchasesCollection = db.collection("purchases");

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

router.get("/writer/sales/:email", verifyToken, verifyWriter, async (req, res) => {
  const db = await connectDB();
  const purchasesCollection = db.collection("purchases");

  const email = req.params.email;

  if (req.decoded.email !== email && req.decoded.role !== "admin") {
    return res.status(403).send({ message: "Forbidden access" });
  }

  const sales = await purchasesCollection
    .find({ writerEmail: email })
    .sort({ purchaseDate: -1 })
    .toArray();

  res.send(sales);
});
router.get("/purchases/check/:email/:ebookId", verifyToken, async (req, res) => {
  const db = await connectDB();
  const purchasesCollection = db.collection("purchases");

  const { email, ebookId } = req.params;

  if (req.decoded.email !== email) {
    return res.status(403).send({ message: "Forbidden access" });
  }

  const purchase = await purchasesCollection.findOne({
    buyerEmail: email,
    ebookId,
    status: "paid",
  });

  res.send({
    purchased: !!purchase,
  });
});

module.exports = router;