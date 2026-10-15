/**
 * Responde de forma segura a una interacción, sin importar si
 * ya fue respondida, diferida o ni siquiera respondida.
 *
 * @param {Interaction} interaction
 * @param {Object}      opts – Opciones para reply/editReply/followUp
 */
async function safeReply(interaction, opts) {
  try {
    if (interaction.replied) {
      return await interaction.followUp({ ...opts, flags: opts.flags ?? 64 });
    }
    if (interaction.deferred) {
      return await interaction.editReply(opts);
    }
    return await interaction.reply({ ...opts, flags: opts.flags ?? 64 });
  } catch (err) {
    // Último recurso: si Discord rechaza todo, simplemente logueamos
    console.error('[safeReply] Error final al responder:', err.message);
    return null;
  }
}

module.exports = { safeReply };
