function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendDiscordMessageViaRest(token, channelId, message, repeatCount = 1, respectRateLimit = false) {
  const repeat = Math.max(1, Number.parseInt(String(repeatCount || '1'), 10) || 1);
  const useRateLimitMode = Boolean(respectRateLimit);
  const sentIds = [];

  for (let i = 0; i < repeat; i += 1) {
    let sent = false;
    let attempts = 0;

    while (!sent) {
      attempts += 1;

      const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: message }),
      });

      if (response.ok) {
        const payload = await response.json();
        sentIds.push(payload.id);
        sent = true;
        continue;
      }

      const raw = await response.text();
      let parsed = null;

      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }

      const retryAfterSeconds = Number(parsed?.retry_after);
      const isRateLimited = response.status === 429;

      if (useRateLimitMode && isRateLimited && attempts < 20) {
        const waitMs = Number.isFinite(retryAfterSeconds)
          ? Math.max(100, Math.ceil(retryAfterSeconds * 1000) + 150)
          : 1000;
        await wait(waitMs);
        continue;
      }

      const errorBody = parsed ? JSON.stringify(parsed) : raw;
      const err = new Error(`Discord API error: ${errorBody}`);
      err.statusCode = response.status;
      throw err;
    }
  }

  return {
    sentIds,
    sentCount: sentIds.length,
  };
}

async function sendDiscordDmViaRest(token, userId, message, repeatCount = 1, respectRateLimit = false) {
  // Step 1: Open/get DM channel
  const dmChannelResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
    method: 'POST',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ recipient_id: userId }),
  });

  if (!dmChannelResponse.ok) {
    const raw = await dmChannelResponse.text();
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
    const errorBody = parsed ? JSON.stringify(parsed) : raw;
    const err = new Error(`DM channel could not be opened: ${errorBody}`);
    err.statusCode = dmChannelResponse.status;
    throw err;
  }

  const dmChannel = await dmChannelResponse.json();
  const channelId = dmChannel.id;

  // Step 2: Send message(s) to the DM channel
  return sendDiscordMessageViaRest(token, channelId, message, repeatCount, respectRateLimit);
}

module.exports = {
  sendDiscordMessageViaRest,
  sendDiscordDmViaRest,
};
