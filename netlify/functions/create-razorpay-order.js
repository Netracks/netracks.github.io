const Razorpay = require('razorpay');

exports.handler = async (event) => {
    try {
        if (event.httpMethod !== 'POST') {
            return {
                statusCode: 405,
                body: JSON.stringify({ error: "Method Not Allowed" })
            };
        }

        // 🔥 Check ENV first
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            return {
                statusCode: 500,
                body: JSON.stringify({
                    error: "Missing Razorpay ENV variables"
                })
            };
        }

        const body = JSON.parse(event.body);

        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });

        const order = await razorpay.orders.create({
            amount: body.amount,
            currency: body.currency || "INR",
            receipt: `receipt_${Date.now()}`,
            notes: {
                userId: body.userId,
                plan: body.plan
            }
        });

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                orderId: order.id
            })
        };

    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: error.message,
                stack: error.stack   // 🔥 THIS WILL SHOW REAL ERROR
            })
        };
    }
};
