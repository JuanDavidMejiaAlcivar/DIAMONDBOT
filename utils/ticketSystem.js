const fs = require('node:fs');
const path = require('node:path');
const { PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const COUNTER_PATH = path.join(__dirname, '..', 'data', 'ticket-counter.json');

// Leer el contador actual
function getCounter() {
  if (!fs.existsSync(COUNTER_PATH)) {
    const initial = { counter: 700 };
    fs.writeFileSync(COUNTER_PATH, JSON.stringify(initial, null, 2), 'utf-8');
    return 700;
  }
  const data = JSON.parse(fs.readFileSync(COUNTER_PATH, 'utf-8'));
  return data.counter || 700;
}

// Incrementar y guardar el contador
function incrementCounter() {
  const current = getCounter();
  const next = current + 1;
  fs.writeFileSync(COUNTER_PATH, JSON.stringify({ counter: next }, null, 2), 'utf-8');
  return next;
}

// Configuración de tipos de tickets
const TICKET_TYPES = {
  partner: {
    name: 'Partner',
    emoji: '🤝',
    color: 0x5865F2,
    description: 'Propuesta de alianza o colaboración'
  },
  duda: {
    name: 'Duda/Sugerencia',
    emoji: '💭',
    color: 0x57F287,
    description: 'Pregunta o sugerencia para mejorar'
  },
  postulacion: {
    name: 'Postulación',
    emoji: '📋',
    color: 0xFEE75C,
    description: 'Postulación al equipo de staff'
  },
  apelacion: {
    name: 'Apelación',
    emoji: '⚖️',
    color: 0xEB459E,
    description: 'Apelación de sanción'
  },
  reporte: {
    name: 'Reporte',
    emoji: '📢',
    color: 0xED4245,
    description: 'Reporte de problema o usuario'
  },
  compra: {
    name: 'Compra',
    emoji: '🛒',
    color: 0x00D166,
    description: 'Compra en la tienda del servidor'
  }
};

// Crear un ticket
async function crearTicket(guild, member, ticketType) {
  const config = TICKET_TYPES[ticketType];
  if (!config) throw new Error('Tipo de ticket inválido');

  const ticketNumber = incrementCounter();
  const ticketName = `ticket-${ticketNumber}`;

  // Crear el canal
  const channel = await guild.channels.create({
    name: ticketName,
    type: ChannelType.GuildText,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: member.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks
        ]
      },
      {
        id: guild.members.me.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageMessages
        ]
      }
    ],
    reason: `Ticket #${ticketNumber} creado por ${member.user.tag}`
  });

  // Embed de bienvenida
  const welcomeEmbed = new EmbedBuilder()
    .setColor(config.color)
    .setTitle(`${config.emoji} ${config.name} • Ticket #${ticketNumber}`)
    .setDescription(
      `¡Hola <@${member.id}>! Gracias por abrir un ticket.\n\n` +
      `**Tipo:** ${config.description}\n\n` +
      `📝 **Por favor, describe tu consulta con el máximo detalle posible.**\n` +
      `⏱️ **Un miembro del staff te atenderá pronto.**\n\n` +
      `> Usa el botón "🔒 Cerrar Ticket" cuando tu consulta esté resuelta.`
    )
    .addFields(
      { name: '👤 Creado por', value: `<@${member.id}>`, inline: true },
      { name: '📅 Fecha', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
      { name: '🎫 Número', value: `#${ticketNumber}`, inline: true }
    )
    .setFooter({ text: 'Diamonds League • Sistema de Tickets' })
    .setTimestamp();

  // Botones
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_claim_${ticketNumber}`)
      .setLabel('Reclamar Ticket')
      .setEmoji('✋')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`ticket_close_${ticketNumber}`)
      .setLabel('Cerrar Ticket')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: `<@${member.id}>`,
    embeds: [welcomeEmbed],
    components: [row]
  });

  return { channel, ticketNumber };
}

// Reclamar un ticket
async function reclamarTicket(interaction, ticketNumber) {
  const claimEmbed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('✅ Ticket Reclamado')
    .setDescription(
      `Este ticket ha sido reclamado por <@${interaction.user.id}>.\n\n` +
      `El staff se encargará de atender tu consulta.`
    )
    .setTimestamp();

  await interaction.channel.send({ embeds: [claimEmbed] });

  // Actualizar permisos para que el reclamante pueda ver
  try {
    await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    });
  } catch (error) {
    console.error('[TICKET] Error actualizando permisos:', error);
  }

  return true;
}

// Cerrar un ticket
async function cerrarTicket(interaction, ticketNumber, closer) {
  // Mensaje de confirmación
  const confirmEmbed = new EmbedBuilder()
    .setColor(0xFEE75C)
    .setTitle('⚠️ Confirmar Cierre de Ticket')
    .setDescription(
      '¿Estás seguro de que deseas cerrar este ticket?\n\n' +
      '**Esta acción no se puede deshacer.**\n' +
      'El canal será eliminado en **5 segundos** después de confirmar.'
    )
    .setTimestamp();

  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_confirm_close_${ticketNumber}`)
      .setLabel('Sí, cerrar')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`ticket_cancel_close_${ticketNumber}`)
      .setLabel('No, cancelar')
      .setStyle(ButtonStyle.Secondary)
  );

  return interaction.reply({
    embeds: [confirmEmbed],
    components: [confirmRow],
    ephemeral: true
  });
}

// Confirmar cierre de ticket
async function confirmarCierreTicket(channel, closer) {
  const closeEmbed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('🔒 Ticket Cerrado')
    .setDescription(
      `Este ticket ha sido cerrado por <@${closer.id}>.\n\n` +
      `**El canal se eliminará en 5 segundos...**`
    )
    .setTimestamp();

  await channel.send({ embeds: [closeEmbed] });

  setTimeout(async () => {
    try {
      await channel.delete(`Ticket cerrado por ${closer.tag}`);
      console.log(`[TICKET] Canal ${channel.name} eliminado correctamente`);
    } catch (error) {
      console.error('[TICKET] Error eliminando canal:', error);
    }
  }, 5000);

  return true;
}

module.exports = {
  getCounter,
  incrementCounter,
  TICKET_TYPES,
  crearTicket,
  reclamarTicket,
  cerrarTicket,
  confirmarCierreTicket
};
