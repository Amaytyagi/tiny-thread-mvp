# tiny-thread-mvp

Minimal Instagram marketing AI MVP for thetiny._.thread.

## What this includes
- Express webhook server for Instagram messages and comments
- Redis-backed job queue for outbound DMs
- Basic AI-powered DM reply with OpenAI
- Safe opt-in flow using comment-to-DM behavior

## Local development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and set your values:
   ```env
   PORT=3000
   WEBHOOK_VERIFY_TOKEN=change-me
   REDIS_URL=redis://localhost:6379
   GRAPH_VERSION=v19.0
   OPENAI_API_KEY=your_openai_key_here
   ```

4. Start Redis locally (optional if you already have Redis):
   ```bash
   docker run --name tiny-redis -p 6379:6379 -d redis
   ```

5. Start the app and worker in separate terminals:
   ```bash
   npm start
   ```

   ```bash
   npm run worker
   ```

6. Expose the app with ngrok and configure the Meta webhook URL:
   ```bash
   ngrok http 3000
   ```
   Then set the callback URL to:
   ```text
   https://<your-ngrok-url>/webhook
   ```

7. Use the onboard route to register a tenant:
   ```bash
   curl -X POST http://localhost:3000/onboard \
     -H "Content-Type: application/json" \
     -d '{
       "tenantName": "thetiny._.thread",
       "pageAccessToken": "YOUR_PAGE_ACCESS_TOKEN",
       "igAccountId": "YOUR_INSTAGRAM_ACCOUNT_ID"
     }'
   ```

## Notes
- This is a safe-first MVP for Instagram DM marketing.
- Use comment-to-DM and opt-in flows to stay compliant with Instagram rules.
- For production, replace the in-memory tenant store with PostgreSQL and add Meta app review, OAuth, and webhook verification.
