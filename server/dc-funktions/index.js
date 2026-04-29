const {
  handleMessageCreate: handleCountingMessageCreate,
  setCountingChannelForGuild,
  clearCountingForGuild,
  announceCountingStarted,
} = require('./games/counting');
const { handleMessageCreate: handleMinesweeperMessageCreate, setMinesweeperForGuild, resetMinesweeperForGuild } = require('./games/minesweeper');
const { handleMessageCreate: handleCustomCommandsMessageCreate } = require('./commands/custom-commands');
const { handleMessageCreate: handleAutoModerationMessageCreate } = require('./moderation/auto-moderation');
const { handleGuildMemberAdd: handleWelcomeGuildMemberAdd } = require('./community/welcome-messages');
const { handleMessageCreate: handleMusicPlayerMessageCreate } = require('./community/music-player');
const { fetchServerStatus, buildStatusEmbed } = require('./community/minecraft-status');

async function handleMessageCreate({ userId, message }) {
  // Sequential execution avoids race conditions when multiple features update shared state.
  await handleCountingMessageCreate({ userId, message });
  await handleMinesweeperMessageCreate({ userId, message });
  await handleCustomCommandsMessageCreate({ userId, message });
  await handleAutoModerationMessageCreate({ userId, message });
  await handleMusicPlayerMessageCreate({ userId, message });
}

async function handleInteractionCreate({ userId, interaction }) {
  if (!interaction?.isChatInputCommand?.()) {
    return;
  }

  // ── /mc scan ──────────────────────────────────────────────────────
  if (interaction.commandName === 'mc') {
    const subcommand = interaction.options?.getSubcommand?.(false);
    if (subcommand === 'scan') {
      const raw = interaction.options.getString('ip', true).trim();
      const edition = interaction.options.getString('edition', false) || 'java';

      // Split address:port
      let address = raw;
      let port = '';
      const lastColon = raw.lastIndexOf(':');
      if (lastColon > 0) {
        const maybPort = raw.slice(lastColon + 1);
        if (/^\d{1,5}$/.test(maybPort)) {
          address = raw.slice(0, lastColon);
          port = maybPort;
        }
      }

      await interaction.deferReply();

      try {
        const data = await fetchServerStatus(address, port, edition);
        const embed = buildStatusEmbed(data, address, port, edition);
        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Server konnte nicht erreicht werden.';
        await interaction.editReply({ content: `❌ Fehler: ${msg}` });
      }
      return;
    }
  }

  // ── /set game counting | minesweeper ──────────────────────────────
  if (interaction.commandName === 'set') {
    const group = interaction.options?.getSubcommandGroup?.(false);
    const subcommand = interaction.options?.getSubcommand?.(false);

    if (group !== 'game') return;

    const guildId = String(interaction.guildId || '').trim();
    const channelId = String(interaction.channelId || '').trim();
    if (!guildId || !channelId) {
      await interaction.reply({ content: 'Dieser Command funktioniert nur in einem Server-Channel.', ephemeral: true });
      return;
    }

    if (subcommand === 'counting-clear') {
      await clearCountingForGuild({ userId, guildId });
      await interaction.reply({ content: 'Counting wurde vollständig gelöscht (Channel, Score und letzter User).', ephemeral: true });
      return;
    }

    if (subcommand === 'counting') {
      await setCountingChannelForGuild({ userId, guildId, channelId, enable: true });
      try {
        await announceCountingStarted(interaction.channel);
      } catch { /* ignore */ }
      await interaction.reply({ content: `Counting wurde für diesen Channel aktiviert (${channelId}).`, ephemeral: true });
      return;
    }

    if (subcommand === 'minesweeper') {
      await interaction.deferReply({ ephemeral: true });
      await setMinesweeperForGuild({ userId, guildId, channelId, channel: interaction.channel });
      await interaction.editReply({ content: 'Minesweeper wurde in diesem Channel gestartet! 💣' });
      return;
    }

    return;
  }

  // ── /reset minesweeper ────────────────────────────────────────────
  if (interaction.commandName === 'reset') {
    const subcommand = interaction.options?.getSubcommand?.(false);

    if (subcommand === 'minesweeper') {
      const guildId = String(interaction.guildId || '').trim();
      if (!guildId) {
        await interaction.reply({ content: 'Dieser Command funktioniert nur in einem Server.', ephemeral: true });
        return;
      }
      await resetMinesweeperForGuild({ userId, guildId });
      await interaction.reply({ content: 'Minesweeper wurde vollständig zurückgesetzt (Spiel, Channel, alles).', ephemeral: true });
      return;
    }

    return;
  }
}

async function handleGuildMemberAdd({ userId, member }) {
  await handleWelcomeGuildMemberAdd({ userId, member });
}

module.exports = {
  handleMessageCreate,
  handleInteractionCreate,
  handleGuildMemberAdd,
};
