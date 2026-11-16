# Razorpay webhook setup (Gather backend)

## Frontend changes
No frontend change is required to receive or verify Razorpay webhooks. Razorpay calls the backend directly. The existing frontend payment checkout and `/api/payments/capture` flow can remain as-is. The webhook is an additional server-side reconciliation path.

## Environment
Set these values in your local `.env` (do not commit or share `.env`):

```env
PAYMENT_MODE=razorpay
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=your_api_key_secret
RAZORPAY_WEBHOOK_SECRET=your_separate_webhook_secret
```

`RAZORPAY_WEBHOOK_SECRET` is the secret configured for this webhook in the Razorpay Dashboard. It is not the API Key Secret.

## Local testing
1. Start the backend from the `backend` directory: `npm run dev`.
2. Expose port 5000 using a tunnel, for example: `ngrok http 5000`.
3. In Razorpay Test Mode, open Account & Settings -> Webhooks and add:
   `https://YOUR-NGROK-HOST/api/payments/webhook`
4. Use the exact same webhook secret in Razorpay and `RAZORPAY_WEBHOOK_SECRET`.
5. Subscribe to `payment.captured` and `payment.failed`. `payment.captured` is the event used to confirm a Gather booking. `order.paid` is not needed for this implementation.
6. Complete a test payment and inspect the backend logs and the booking in MongoDB.

## What the handler does
- Verifies `X-Razorpay-Signature` against the exact raw request body using HMAC-SHA256.
- Records webhook event IDs to avoid duplicate processing.
- For `payment.captured`, matches the Razorpay order ID to a pending booking, checks amount/currency, and calls the existing atomic booking confirmation function.
- If the booking was cancelled or the event sold out while payment completed, it attempts a refund rather than issuing tickets.
- For `payment.failed`, records failure time/reason while leaving the booking pending so the user can retry.

## Notes
- The webhook route is mounted before `express.json()` because signature verification requires the original raw body.
- Keep your Razorpay API key secret and webhook secret on the backend only. Never add them to React/Vite environment variables.
- Test in Razorpay Test Mode before configuring a production endpoint.
- Review webhook delivery attempts in the Razorpay Dashboard if the endpoint returns non-2xx responses.
