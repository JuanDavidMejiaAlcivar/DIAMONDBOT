const { EmbedBuilder } = require('discord.js');

/**
 * Crea un embed de error personalizado y visualmente rico.
 * @param {string} titulo - Título del error
 * @param {string} descripcion - Descripción detallada
 * @param {Array}  campos - Campos adicionales [{name, value}]
 */
function errorEmbed(titulo, descripcion, campos = []) {
  const embed = new EmbedBuilder()
    .setColor(0xef5350)
    .setTitle(`❌ ${titulo}`)
    .setDescription(descripcion)
    .setTimestamp();
  if (campos.length) embed.addFields(campos);
  return embed;
}

/**
 * Crea un embed de advertencia (acción no permitida pero no crítica).
 */
function warnEmbed(titulo, descripcion, campos = []) {
  const embed = new EmbedBuilder()
    .setColor(0xffa726)
    .setTitle(`⚠️ ${titulo}`)
    .setDescription(descripcion)
    .setTimestamp();
  if (campos.length) embed.addFields(campos);
  return embed;
}

/**
 * Responde con un embed de error ephemeral.
 */
async function replyError(interaction, titulo, descripcion, campos = []) {
  const embed = errorEmbed(titulo, descripcion, campos);
  const opts = { embeds: [embed], flags: 64 };
  if (interaction.deferred || interaction.replied) return interaction.editReply({ embeds: [embed], components: [] });
  return interaction.reply(opts);
}

/**
 * Responde con un embed de advertencia ephemeral.
 */
async function replyWarn(interaction, titulo, descripcion, campos = []) {
  const embed = warnEmbed(titulo, descripcion, campos);
  const opts = { embeds: [embed], flags: 64 };
  if (interaction.deferred || interaction.replied) return interaction.editReply({ embeds: [embed], components: [] });
  return interaction.reply(opts);
}

module.exports = { errorEmbed, warnEmbed, replyError, replyWarn };
