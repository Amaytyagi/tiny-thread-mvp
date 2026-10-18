const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const axios = require('axios');
const OpenAI = require('openai');
require('dotenv').config();

const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

const tenants = {};

async function sendIGMessage(pageAccessToken, igAccountId, recipientId, text) {
  const version = process.env.GRAPH_VERSION || 'v19.0';
  const url = `https://graph.facebook.com/${version}/${igAccountId}/messages`;

  try {
    const response = await axios.post(
      url,
      {
        recipient: { id: recipientId },
        message: { text }
      },
      {
        params: {
          access_token: pageAccessToken
        },
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('sendIGMessage failed:', error.response?.data || error.message);
    throw error;
  }
}

async function generateReply(text) {
  const prompt = `You are a helpful Instagram sales helper for handmade designer candles and crochet products from thetiny._.thread. Keep the message short, warm, persuasive, and sales-focused. User message: ${text}`;

  if (!process.env.OPENAI_API_KEY) {
    return 'Hi! Thanks for reaching out. We make handmade designer candles and crochet pieces. Reply YES to get our product list and prices.';
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a helpful Instagram marketing assistant for a handcrafted candle and crochet brand.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 180,
    temperature: 0.8
  });

  return completion.choices?.[0]?.message?.content || 'Hi! We have handmade candles and crochet pieces. Reply YES to get our latest collection and prices.';
}

const worker = new Worker(
  'send-queue',
  async (job) => {
    const { name, data } = job;

    if (name === 'send-dm') {
      const tenant = Object.values(tenants)[0];
      if (!tenant) return;

      const welcomeMessage = 'Hi! Thanks for your comment. We are thetiny._.thread, handmade designer candles and crochet pieces. Want our latest collection and prices? Reply YES to opt in.';
      await sendIGMessage(tenant.pageAccessToken, tenant.igAccountId, data.recipientId, welcomeMessage);
      return;
    }

    if (name === 'process-inbound') {
      const tenant = Object.values(tenants)[0];
      if (!tenant) return;

      const text = data.text || '';
      const replyText = /^yes|^yep|^sure|^okay/i.test(text)
        ? await generateReply(text)
        : 'Thanks for your message! We make handcrafted candles and crochet items. Tell us what you like and we will help you choose the best piece.';

      await sendIGMessage(tenant.pageAccessToken, tenant.igAccountId, data.senderId, replyText);
    }
  },
  { connection: redis }
);

worker.on('failed', (job, err) => {
  console.error('Worker failed for job', job && job.id, err);
});

module.exports = { tenants };
