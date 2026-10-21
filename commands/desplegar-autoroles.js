/**
 * /desplegar-autoroles
 *
 * Comando administrativo que despliega un panel de autoroles interactivo.
 * El bot reacciona con los emojis configurados; los usuarios reaccionan para
 * obtener el rol correspondiente y quitan la reacción para eliminarlo.
 *
 * Soporta hasta 10 roles por panel.
 * Formato del campo "config": "emoji | descripción"  (separador "|")
 * Ejemplo: "🎮 | Para jugadores activos de la liga"
 *
 * Discord permite máximo 25 opciones por comando.
 * 10 roles × 2 campos (rol + config) = 20 opciones → dentro del límite.
 *
 * Se pueden tener múltiples paneles activos en distintos canales.
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');
const { isAdmin, noPermissionEmbed } = require('../utils/permissions');
const { guardarAutoroles, parseEmoji } = require('../utils/autorolesManager');

// ── Construcción del comando ────────────────────────────────────────────────

const builder = new SlashCommandBuilder()
  .setName('desplegar-autoroles')
  .setDescription('[ADMIN] Despliega un panel de autoroles con reacciones de emojis (hasta 10 roles)');

/**
 * Añade las opciones para cada slot de rol.
 * Cada slot tiene:
 *   - rolN   → opción de rol de Discord
 *   - configN → string con formato "emoji | descripción"
 */
for (let i = 1; i <= 10; i++) {
  const req = i === 1; // Solo el primer slot es obligatorio
  builder
    .addRoleOption(opt =>
      opt
        .setName(`rol${i}`)
        .setDescription(`Rol ${i} a asignar`)
        .setRequired(req)
    )
    .addStringOption(opt =>
      opt
        .setName(`config${i}`)
        .setDescription(`Rol ${i}: "emoji | descripción"  Ej: 🎮 | Para jugadores activos`)
        .setRequired(req)
        .setMaxLength(150)
    );
}

// ── Ejecutor ────────────────────────────────────────────────────────────────

module.exports = {
  data: builder,

  async execute(interaction) {
    // Verificar permisos administrativos
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ embeds: [noPermissionEmbed()], ephemeral: true });
    }

    // ── Recolectar y validar entradas ────────────────────────────────────
    const entries  = [];
    const errores  = [];

    for (let i = 1; i <= 10; i++) {
      const rol       = interaction.options.getRole(`rol${i}`);
      const configStr = interaction.options.getString(`config${i}`);

      if (!rol || !configStr) continue;

      // Parsear "emoji | descripción"
      const separatorIdx = configStr.indexOf('|');
      if (separatorIdx === -1) {
        errores.push(`rol${i}: falta el separador "|" en el campo config.`);
        continue;
      }

      const emoji       = configStr.slice(0, separatorIdx).trim();
      const descripcion = configStr.slice(separatorIdx + 1).trim();

      if (!emoji) {
        errores.push(`rol${i}: el emoji no puede estar vacío.`);
        continue;
      }
      if (!descripcion) {
        errores.push(`rol${i}: la descripción no puede estar vacía.`);
        continue;
      }

      entries.push({
        role_id:     rol.id,
        role_name:   rol.name,
        emoji,
        descripcion,
      });
    }

    if (entries.length === 0) {
      return interaction.reply({
        content:
          '❌ Debes configurar al menos un rol.\n' +
          'Formato del campo config: `emoji | descripción`\n' +
          'Ejemplo: `🎮 | Para jugadores activos`',
        ephemeral: true,
      });
    }

    // Advertir sobre entradas con error de formato pero continuar con las válidas
    const formatoError = errores.length > 0
      ? `\n\n⚠️ **Entradas ignoradas por formato incorrecto:**\n${errores.map(e => `· ${e}`).join('\n')}`
      : '';

    // ── Construir embed del panel ────────────────────────────────────────
    const descripcionRoles = entries
      .map(e => `${e.emoji}  **<@&${e.role_id}>**\n> ${e.descripcion}`)
      .join('\n\n');

    const embed = new EmbedBuilder()
      .setColor(0x00bfa6)
      .setTitle('🎭  Autoroles — Diamonds League')
      .setDescription(
        '**Reacciona con el emoji del rol que deseas obtener.**\n' +
        'Quita tu reacción para eliminar el rol.\n\n' +
        '─────────────────────────────\n\n' +
        descripcionRoles +
        '\n\n─────────────────────────────'
      )
      .setFooter({ text: 'Diamonds League · Sistema de Autoroles' })
      .setTimestamp();

    // ── Diferir la respuesta (el bot puede tardar al reaccionar) ─────────
    await interaction.deferReply({ ephemeral: true });

    // ── Enviar el panel al canal ─────────────────────────────────────────
    let panelMessage;
    try {
      panelMessage = await interaction.channel.send({ embeds: [embed] });
    } catch (err) {
      return interaction.editReply({
        content: `❌ No se pudo enviar el panel: ${err.message}`,
      });
    }

    // ── El bot reacciona con cada emoji ─────────────────────────────────
    const emojisFallidos = [];
    for (const entry of entries) {
      try {
        const parsed = parseEmoji(entry.emoji);
        await panelMessage.react(parsed.reactWith);
      } catch (err) {
        console.error(`[AUTOROLES] Error reaccionando con "${entry.emoji}":`, err.message);
        emojisFallidos.push(entry.emoji);
      }
    }

    // ── Persistir la configuración ───────────────────────────────────────
    guardarAutoroles(panelMessage.id, {
      channel_id: interaction.channel.id,
      guild_id:   interaction.guild.id,
      roles: entries.map(e => ({
        emoji:       e.emoji,
        role_id:     e.role_id,
        descripcion: e.descripcion,
      })),
    });

    // ── Responder al admin ───────────────────────────────────────────────
    const emojiError = emojisFallidos.length > 0
      ? `\n\n⚠️ Emojis que no pudieron reaccionar (¿son de este servidor?): ${emojisFallidos.join(', ')}`
      : '';

    await interaction.editReply({
      content:
        `✅ **Panel de autoroles desplegado** en ${interaction.channel}.\n` +
        `Se configuraron **${entries.length}** rol(es).` +
        emojiError +
        formatoError,
    });
  },
};
