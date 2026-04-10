const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
    });
}
const db = admin.database();

exports.handler = async (event) => {
    const sig = event.headers['stripe-signature'];
    let stripeEvent;

    try {
        stripeEvent = stripe.webhooks.constructEvent(
            event.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        return { statusCode: 400, body: `Webhook Error: ${err.message}` };
    }

    if (stripeEvent.type === 'checkout.session.completed') {
        const session = stripeEvent.data.object;
        const userId = session.client_reference_id;
        const plan = session.metadata.plan;
        const amount = session.amount_total / 100;

        const subscriptionRef = db.ref(`users/${userId}/subscription`);
        await subscriptionRef.set({
            plan: plan,
            active: true,
            purchasedAt: Date.now(),
            amount: amount,
            expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
            stripeSessionId: session.id
        });
    }

    return { statusCode: 200, body: 'Received' };
};
