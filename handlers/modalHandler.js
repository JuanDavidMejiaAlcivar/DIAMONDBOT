/**
 * Handler centralizado para todas las interacciones de modals.
 * Extraído de index.js para mantener el archivo principal limpio.
 */

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const db = require('../utils/db');
const { cerrarTicketConRazon } = require('../utils/ticketSystem');
const { safeReply } = require('./safeReply');

/**
 * Maneja todas las interacciones de modal submit.
 * @param {ModalSubmitInteraction} interaction
 * @param {Client} client
 */
async function handleModal(interaction, client) {
  const id = interaction.customId;

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // CIERRE DE TICKET
    // ═══════════════════════════════════════════════════════════════════════
    if (id.startsWith('ticket_close_modal_')) {
      return await handleTicketCloseModal(interaction);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RECHAZO DE SOLICITUD DE INSCRIPCIÓN
    // ═══════════════════════════════════════════════════════════════════════
    if (id.startsWith('apprejm|')) {
      return await handleSolicitudRechazoModal(interaction, client);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MODAL DE NICKS DE HAXBALL EN INSCRIPCIÓN
    // ═══════════════════════════════════════════════════════════════════════
    if (id.startsWith('inscripcion_nicks_')) {
      return await handleInscripcionNicksModal(interaction, client);
    }

  } catch (error) {
    if (error?.code === 10062) {
      console.warn('[MODAL] Interacción expirada (10062), ignorando:', id);
      return;
    }
    console.error('[MODAL] Error no capturado en handler de modal:', error);
    await safeReply(interaction, {
      content: '❌ Ocurrió un error inesperado al procesar el formulario.',
      flags: 64,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Handlers individuales
// ═══════════════════════════════════════════════════════════════════════════

async function handleTicketCloseModal(interaction) {
  const parts = interaction.customId.split('_');
  // ticket_close_modal_TICKETNUMBER_CREATORID
  const ticketNumber = parts[3];
  const creatorId = parts[4];
  const reason = interaction.fields.getTextInputValue('close_reason');

  console.log(`[TICKET] Cierre de ticket #${ticketNumber} por ${interaction.user.tag}, razón: ${reason}`);

  // Defer primero para no expirar el token de 3 segundos
  const deferred = await interaction.deferUpdate().catch(err => {
    if (err?.code === 10062) {
      console.warn('[TICKET] Modal de cierre expirado (10062), ignorando.');
      return null;
    }
    throw err;
  });

  // Si la interacción estaba expirada, no continuamos
  if (deferred === null) return;

  try {
    await cerrarTicketConRazon(
      interaction.channel,
      interaction.user,
      reason,
      creatorId,
      interaction.guild
    );
    console.log(`[TICKET] ✅ Ticket #${ticketNumber} cerrado exitosamente`);
  } catch (error) {
    console.error('[TICKET] ❌ Error cerrando ticket:', error);
    await interaction.followUp({
      content: '❌ Error al cerrar el ticket. Por favor, contacta con un administrador.',
      flags: 64,
    }).catch(() => {});
  }
}

async function handleSolicitudRechazoModal(interaction, client) {
  const solicitudId = interaction.customId.replace('apprejm|', '');
  const motivo      = interaction.fields.getTextInputValue('reject_reason');

  const solicitud = db.obtenerSolicitudPorId(solicitudId);
  if (!solicitud) {
    return safeReply(interaction, { content: 'Solicitud no encontrada.', flags: 64 });
  }
  if (solicitud.status !== 'PENDING') {
    return safeReply(interaction, { content: 'Esta solicitud ya fue procesada.', flags: 64 });
  }

  db.actualizarSolicitud(solicitudId, {
    status:           'REJECTED',
    reviewed_at:      new Date().toISOString(),
    reviewed_by:      interaction.user.id,
    rejection_reason: motivo,
  });

  const disabledRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`appacc|${solicitudId}`).setLabel('Aceptar solicitud').setStyle(ButtonStyle.Success).setDisabled(true),
    new ButtonBuilder().setCustomId(`apprej|${solicitudId}`).setLabel('Rechazar solicitud').setStyle(ButtonStyle.Danger).setDisabled(true)
  );

  // Editar el mensaje original de la solicitud
  try {
    const reviewChannel = await interaction.guild.channels.fetch(solicitud.review_channel_id).catch(() => null);
    if (reviewChannel) {
      const originalMsg = await reviewChannel.messages.fetch(solicitud.message_id).catch(() => null);
      if (originalMsg) {
        await originalMsg.edit({
          embeds: [
            new EmbedBuilder()
              .setColor(0xef5350)
              .setTitle('Solicitud de inscripción — Rechazada')
              .setDescription(`**${solicitud.team_name}**`)
              .addFields(
                { name: 'Estado',       value: 'Rechazada',                   inline: true },
                { name: 'Revisada por', value: `<@${interaction.user.id}>`,   inline: true },
                { name: 'Motivo',       value: motivo }
              )
              .setTimestamp(),
          ],
          components: [disabledRow],
        });
      }
    }
  } catch (err) {
    console.error('Error editando mensaje original de solicitud:', err.message);
  }

  await safeReply(interaction, { content: 'Solicitud rechazada correctamente.', flags: 64 });

  // DM al solicitante
  try {
    const catInfo   = db.obtenerCategoriaPorId(solicitud.category_id);
    const applicant = await client.users.fetch(solicitud.applicant_id);
    await applicant.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xef5350)
          .setTitle('Diamonds League — Solicitud rechazada')
          .setDescription(
            `Tu solicitud de inscripción no fue aprobada.\n\n` +
            `Equipo\n${solicitud.team_name}\n\n` +
            `Categoría\n${catInfo?.nombre || '—'}\n\n` +
            `Motivo\n${motivo}`
          )
          .setTimestamp(),
      ],
    });
  } catch (err) {
    console.error('Error enviando DM al solicitante:', err.message);
  }
}

async function handleInscripcionNicksModal(interaction, client) {
  const inscribirCommand = client.commands.get('inscribir-equipo');
  if (inscribirCommand && inscribirCommand.handleModalSubmit) {
    try {
      await inscribirCommand.handleModalSubmit(interaction);
    } catch (error) {
      console.error('Error en modal de inscripción:', error);
      await safeReply(interaction, {
        content: 'Ocurrió un error al procesar el formulario. Intenta nuevamente.',
        flags: 64,
      });
    }
  }
}

module.exports = { handleModal };
