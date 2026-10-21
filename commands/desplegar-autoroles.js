/**
 * /desplegar-autoroles
 *
 * Comando administrativo que despliega un panel de autoroles interactivo.
 * El bot reacciona con los emojis configurados; los usuarios reaccionan para
 * obtener el rol correspondiente y quitan la reacción para eliminarlo.
 *
 * Soporta hasta 5 pares (rol, emoji, descripción) por panel.
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
  .setDescription('[ADMIN] Despliega un panel de autoroles con reacciones de emojis');

// Opciones para hasta 5 roles
for (let i = 1; i <= 5; i++) {
  const req = i === 1; // Solo el primero es obligatorio
  builder
    .addRoleOption(opt =>
      opt.setName(`rol${i}`)
        .setDescription(`Rol ${i} a asignar`)
        .setRequired(req)
    )
    .addStringOption(opt =>
      opt.setName(`emoji${i}`)
        .setDescription(`Emoji para el rol ${i} (Unicode o <:nombre:id>)`)
        .setRequired(req)
    )
    .addStringOption(opt =>
      opt.setName(`descripcion${i}`)
        .setDescription(`Descripción del rol ${i}`)
        .setRequired(req)
        .setMaxLength(120)
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

    // ── Recolectar entradas ──────────────────────────────────────────────
    const entries = [];

    for (let i = 1; i <= 5; i++) {
      const rol        = interaction.options.getRole(`rol${i}`);
      const emojiStr   = interaction.options.getString(`emoji${i}`);
      const descripcion = interaction.options.getString(`descripcion${i}`);

      if (!rol || !emojiStr || !descripcion) continue;

      entries.push({
        role_id:     rol.id,
        role_name:   rol.name,
        emoji:       emojiStr.trim(),
        descripcion: descripcion.trim(),
      });
    }

    if (entries.length === 0) {
      return interaction.reply({
        content: '❌ Debes configurar al menos un rol con su emoji y descripción.',
        ephemeral: true,
      });
    }

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

    // ── Diferir la respuesta (por si tarda en reaccionar) ───────────────
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
    const advertencia = emojisFallidos.length > 0
      ? `\n\n⚠️ Los siguientes emojis no pudieron añadirse como reacción (¿están en este servidor?): ${emojisFallidos.join(', ')}`
      : '';

    await interaction.editReply({
      content:
        `✅ **Panel de autoroles desplegado** en ${interaction.channel}.\n` +
        `Se configuraron **${entries.length}** rol(es).` +
        advertencia,
    });
  },
};
