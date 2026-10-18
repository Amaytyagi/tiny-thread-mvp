const express = require('express');
const bodyParser = require('body-parser');
const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
});

const sendQueue = new Queue('send-queue', { connection: redis });

const tenants = {};
const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'tiny-thread-dev-token';

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'tiny-thread-mvp',
    message: 'Instagram marketing AI MVP is running.'
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.status(403).send('Verification failed');
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const body = req.body || {};
  if (!body.entry) return;

  for (const entry of body.entry) {
    if (entry.messaging) {
      for (const event of entry.messaging) {
        const senderId = event.sender && event.sender.id;
        const text = event.message && event.message.text;
        if (senderId && text) {
          await sendQueue.add('process-inbound', { senderId, text });
        }
      }
    }

    if (entry.changes) {
      for (const change of entry.changes) {
        const value = change.value || {};
        const commentText = value.message || value.text || '';
        const commenterId = value.from ? value.from.id : value.from_id;
        const igId = value.ig_id || value.page_id;

        if (commenterId && commentText && /join|info|yes|interested|hello/i.test(commentText)) {
          const tenant = Object.values(tenants).find((t) => String(t.igAccountId) === String(igId));
          if (tenant) {
            await sendQueue.add('send-dm', {
              tenantId: tenant.tenantId,
              recipientId: commenterId,
              reason: 'comment_opt_in',
              commentText
            });
          }
        }
      }
    }
  }
});

app.post('/onboard', (req, res) => {
  const { tenantName, pageAccessToken, igAccountId } = req.body || {};

  if (!tenantName || !pageAccessToken || !igAccountId) {
    return res.status(400).json({
      ok: false,
      error: 'tenantName, pageAccessToken, and igAccountId are required.'
    });
  }

  const tenantId = uuidv4();
  tenants[tenantId] = {
    tenantId,
    name: tenantName,
    pageAccessToken,
    igAccountId
  };

  return res.status(200).json({ ok: true, tenantId, tenant: tenants[tenantId] });
});

app.listen(PORT, () => {
  console.log(`tiny-thread-mvp API running on port ${PORT}`);
});
