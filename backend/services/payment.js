import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RZ_KEY_ID,
  key_secret: process.env.RZ_SECRET,
});

export async function createOrder(amount) {
  return await razorpay.orders.create({
    amount: amount * 100, // paise
    currency: "INR",
    receipt: `rcpt_${Date.now()}`
  });
}
