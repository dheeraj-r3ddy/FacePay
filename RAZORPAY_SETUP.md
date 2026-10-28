# Razorpay Test Mode Setup

FacePay uses Razorpay Standard Checkout in test mode after its existing facial-authentication step. Razorpay test payments do not move real money and do not replace a regulated UPI or bank authentication factor.

## Configure credentials

1. Create or sign in to a Razorpay account at https://razorpay.com.
2. Switch the dashboard to **Test Mode**.
3. Open **Account & Settings > API Keys** and generate test keys.
4. Put the values in the project `.env` file:

```env
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
FIREBASE_DATABASE_URL=https://facepay-2c2a2-default-rtdb.asia-southeast1.firebasedatabase.app
```

Never put `RAZORPAY_KEY_SECRET` in browser code or commit `.env`. Use `.env.example` as the template.

## Run and test

Start the app from the project directory:

```text
node server.js
```

Open http://localhost:3000/, sign in, choose a recipient or scan an existing FacePay QR, enter an amount, and complete face verification. The existing **Authorize & Pay** action then creates a Razorpay order and opens Checkout. Use Razorpay's test payment details in the Checkout window.

The backend exposes `GET /api/health`, `POST /api/payment/create-order`, `POST /api/payment/verify`, and `POST /api/payment/webhook`. Order creation validates the sender, recipient, INR amount, and prototype limit. The server verifies the Checkout HMAC and fetches the Razorpay payment before marking a transaction `SUCCESS`.

Verified transactions are retained in the existing `data/transactions.json` history and are also written to the existing Firebase Realtime Database under `Transactions/{transactionId}`. No FacePay balance is changed by Razorpay payments. Webhook events use the raw request body, `X-Razorpay-Signature`, and the event ID for duplicate protection.

## Webhooks and production work

Configure Razorpay webhooks to point to `/api/payment/webhook` and use the same webhook secret in `.env`. Enable payment authorized, captured, and failed events. Webhook state is authoritative for provider updates, and duplicate event IDs are ignored.

Before a live deployment, add real server-side authentication and authorization, use a production database transaction instead of JSON files, configure HTTPS and a protected webhook URL, validate Firebase security rules, add operational monitoring, and complete Razorpay's account and compliance requirements. Do not switch these settings to live mode until those controls are complete.