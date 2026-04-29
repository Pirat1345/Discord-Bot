async function getDiscordErrorMessage(response) {
  const raw = await response.text();

  try {
    const body = JSON.parse(raw);
    const msg = String(body?.message || '').trim();
    const code = body?.code ? ` (Code ${body.code})` : '';
    if (msg) {
      return `${msg}${code}`;
    }
  } catch {
    // keep raw fallback below
  }

  const text = String(raw || '').trim();
  return text ? text.slice(0, 300) : `HTTP ${response.status}`;
}

async function fetchGuildRest(guildId, token) {
  return fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

async function cleanupGuildByRest(guildId, token) {
  const guildResponse = await fetchGuildRest(guildId, token);
  if (!guildResponse.ok) {
    const text = await getDiscordErrorMessage(guildResponse);
    throw new Error(`Server konnte nicht geladen werden: ${text}`);
  }

  const channelsResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!channelsResponse.ok) {
    const text = await getDiscordErrorMessage(channelsResponse);
    throw new Error(`Kanaele konnten nicht geladen werden: ${text}`);
  }

  const rolesResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!rolesResponse.ok) {
    const text = await getDiscordErrorMessage(rolesResponse);
    throw new Error(`Rollen konnten nicht geladen werden: ${text}`);
  }

  const channels = await channelsResponse.json();
  const roles = await rolesResponse.json();

  const deletableChannels = Array.isArray(channels) ? channels.filter((entry) => entry?.id && entry.id !== guildId) : [];
  const deletableRoles = Array.isArray(roles)
    ? roles.filter((entry) => entry?.id && !entry.managed && entry.id !== guildId)
    : [];

  const channelDeleteResults = [];
  for (const channel of deletableChannels) {
    const response = await fetch(`https://discord.com/api/v10/channels/${channel.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await getDiscordErrorMessage(response);
      throw new Error(`Kanal ${channel.name || channel.id} konnte nicht geloescht werden: ${text}`);
    }

    channelDeleteResults.push(channel.id);
  }

  const roleDeleteResults = [];
  for (const role of deletableRoles) {
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles/${role.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await getDiscordErrorMessage(response);
      throw new Error(`Rolle ${role.name || role.id} konnte nicht geloescht werden: ${text}`);
    }

    roleDeleteResults.push(role.id);
  }

  return {
    deleted_channels: channelDeleteResults.length,
    deleted_roles: roleDeleteResults.length,
  };
}

module.exports = {
  cleanupGuildByRest,
};
