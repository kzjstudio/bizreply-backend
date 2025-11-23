#!/usr/bin/env node
/**
 * Instagram Webhook & Messaging Test Helper
 *
 * Provides utilities to:
 *  - Generate X-Hub-Signature-256 for a sample payload
 *  - POST a simulated webhook event to local server
 *  - Display instructions for real-world testing
 *
 * Usage:
 *  node scripts/instagram-test.js signature      # Show signature for sample payload
 *  node scripts/instagram-test.js post           # POST sample event to /api/instagram/webhook
 *  node scripts/instagram-test.js help           # Show help
 *
 * Requires environment variables:
 *  INSTAGRAM_APP_SECRET   (for signature generation)
 *  INSTAGRAM_VERIFY_TOKEN (webhook verification token)
 *  INSTAGRAM_PAGE_ACCESS_TOKEN (for sending manual message tests - optional here)
 */

import crypto from 'crypto';
import fetch from 'node-fetch';

const APP_SECRET = process.env.INSTAGRAM_APP_SECRET || 'dev_secret';
const WEBHOOK_URL = process.env.INSTAGRAM_WEBHOOK_URL || 'http://localhost:3000/api/instagram/webhook';

const samplePayload = {
  object: 'page',
  entry: [
    {
      id: 'TEST_PAGE_ID',
      time: Date.now(),
      messaging: [
        {
          sender: { id: 'TEST_USER_PSID' },
          recipient: { id: 'TEST_PAGE_ID' },
          timestamp: Date.now(),
          message: {
            mid: 'm_test_mid',
            text: 'Hello, do you have any promotions today?'
          }
        }
      ]
    }
  ]
};

function generateSignature(bodyBuffer) {
  return (
    'sha256=' +
    crypto
      .createHmac('sha256', APP_SECRET)
      .update(bodyBuffer)
      .digest('hex')
  );
}

async function postSample() {
  const bodyStr = JSON.stringify(samplePayload);
  const buf = Buffer.from(bodyStr, 'utf8');
  const signature = generateSignature(buf);

  console.log('POSTing sample webhook event...');
  console.log('Signature:', signature);

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': signature
    },
    body: bodyStr
  });

  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Response Body:', text);
}

function showSignature() {
  const bodyStr = JSON.stringify(samplePayload);
  const sig = generateSignature(Buffer.from(bodyStr));
  console.log('Sample Payload Signature (X-Hub-Signature-256):');
  console.log(sig);
}

function help() {
  console.log(`Instagram Test Helper
Commands:
  signature   Generate signature for sample payload
  post        Send sample payload to local webhook
  help        Show this help text

Environment overrides:
  INSTAGRAM_WEBHOOK_URL (default: ${WEBHOOK_URL})
  INSTAGRAM_APP_SECRET  (default: dev_secret)

Manual Webhook Verification Test (GET):
  curl "http://localhost:3000/api/instagram/webhook?hub.mode=subscribe&hub.verify_token=$INSTAGRAM_VERIFY_TOKEN&hub.challenge=12345"

Manual Send (requires real PSID & page token):
  curl -X POST "https://graph.facebook.com/v18.0/me/messages" \
    -H "Authorization: Bearer $INSTAGRAM_PAGE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"recipient":{"id":"REAL_USER_PSID"},"message":{"text":"Test reply"}}'
`);
}

const cmd = process.argv[2];

(async () => {
  switch (cmd) {
    case 'signature':
      showSignature();
      break;
    case 'post':
      await postSample();
      break;
    case 'help':
    default:
      help();
      break;
  }
})();
