const fs = require('node:fs');
const path = require('node:path');
const { PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const COUNTER_PATH = path.join(__dirname, '..', 'data', 'ticket-counter.json');
const TICKET_CATEGORY_ID = '1310785348179202158'; // Categoría OBLIGATORIA para tickets
const MAIN_GUILD_ID = '1292979234888876042'; // Servidor principal

// Importar logger para logs
let logger;
try {
  logger = require('./logger');
} catch (err) {
  console.error('[TICKET] No se pudo cargar el módulo de logger:', err);
  logger = null;
}

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

  // VERIFICAR QUE ESTAMOS EN EL SERVIDOR PRINCIPAL
  if (guild.id !== MAIN_GUILD_ID) {
    throw new Error(`Los tickets solo están disponibles en el servidor principal de Diamonds League.`);
  }

  // VERIFICAR QUE LA CATEGORÍA EXISTE
  let category = null;
  try {
    category = await guild.channels.fetch(TICKET_CATEGORY_ID);
    console.log('[TICKET] Categoría encontrada:', category?.name, 'Tipo:', category?.type);
  } catch (error) {
    console.error('[TICKET] Error al buscar categoría:', error);
    throw new Error(`No se pudo encontrar la categoría de tickets (ID: ${TICKET_CATEGORY_ID}). Contacta con un administrador.`);
  }

  // Verificar que es una categoría (tipo 4 en Discord)
  if (!category || category.type !== ChannelType.GuildCategory) {
    console.error('[TICKET] Tipo de canal inválido:', category?.type, 'Esperado:', ChannelType.GuildCategory);
    throw new Error(`La categoría de tickets no está configurada correctamente. Contacta con un administrador.`);
  }

  console.log('[TICKET] Verificación exitosa - Servidor:', guild.name, '- Categoría:', category.name);

  const ticketNumber = incrementCounter();
  const ticketName = `ticket-${ticketNumber}`;

  // Obtener roles de admin para permisos y menciones
  const { ADMIN_ROLE_IDS } = require('./permissions');

  // Crear permisos base
  const permissionOverwrites = [
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
  ];

  // Agregar permisos para cada rol administrativo (solo si existe en el servidor)
  for (const roleId of ADMIN_ROLE_IDS) {
    // Verificar que el rol existe en el servidor
    const roleExists = guild.roles.cache.has(roleId);
    if (roleExists) {
      permissionOverwrites.push({
        id: roleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ManageMessages
        ]
      });
    } else {
      console.warn(`[TICKET] Rol administrativo ${roleId} no encontrado en el servidor, se omitirá`);
    }
  }

  // Crear el canal EN LA CATEGORÍA ESPECÍFICA
  const channel = await guild.channels.create({
    name: ticketName,
    type: ChannelType.GuildText,
    parent: TICKET_CATEGORY_ID,
    permissionOverwrites,
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

  // Botones - Solo reclamar y cerrar
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_claim_${ticketNumber}`)
      .setLabel('Reclamar Ticket')
      .setEmoji('✋')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`ticket_close_${ticketNumber}_${member.id}`)
      .setLabel('Cerrar Ticket')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger)
  );

  // Obtener menciones de roles de admin (solo los que existen en el servidor)
  const adminMentions = ADMIN_ROLE_IDS
    .filter(roleId => guild.roles.cache.has(roleId))
    .map(roleId => `<@&${roleId}>`)
    .join(' ');

  await channel.send({
    content: `<@${member.id}> ${adminMentions}\n\n> **Nuevo ticket creado** - Un miembro del staff atenderá pronto.`,
    embeds: [welcomeEmbed],
    components: [row]
  });

  // Log de ticket creado
  if (logger) {
    logger.logSystem(
      guild.client,
      member.user,
      'ticket_create',
      {
        description: `Ticket #${ticketNumber} creado`,
        channel: channel.id,
        stats: `Tipo: ${config.name}`
      }
    ).catch(err => console.error('[TICKET] Error en log:', err));
  }

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

  // Log de ticket reclamado
  if (logger) {
    logger.logSystem(
      interaction.client,
      interaction.user,
      'ticket_claim',
      {
        description: `Ticket #${ticketNumber} reclamado`,
        channel: interaction.channel.id,
        user: interaction.user.id
      }
    ).catch(err => console.error('[TICKET] Error en log:', err));
  }

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

// Cerrar ticket y enviar DM
async function cerrarTicketConRazon(channel, closer, reason, creatorId, guild) {
  console.log('[TICKET-CLOSE] Iniciando cierre de ticket');
  console.log('[TICKET-CLOSE] Creator ID recibido:', creatorId);
  console.log('[TICKET-CLOSE] Closer:', closer.tag);
  console.log('[TICKET-CLOSE] Razón:', reason);
  
  try {
    // Buscar al creador del ticket
    console.log('[TICKET-CLOSE] Intentando buscar al creador...');
    const creator = await guild.members.fetch(creatorId).catch(err => {
      console.error('[TICKET-CLOSE] Error al buscar creador:', err.message);
      return null;
    });
    
    if (!creator) {
      console.error('[TICKET-CLOSE] No se pudo encontrar al creador del ticket');
    } else {
      console.log('[TICKET-CLOSE] Creador encontrado:', creator.user.tag);
      
      // Embed para el DM
      const dmEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🔒 Tu Ticket Ha Sido Cerrado')
        .setDescription(
          `Tu ticket **${channel.name}** ha sido cerrado.\n\n` +
          `**Cerrado por:** <@${closer.id}> (${closer.tag})\n` +
          `**Razón:** ${reason}\n\n` +
          `Si necesitas más ayuda, puedes abrir otro ticket.`
        )
        .setFooter({ text: 'Diamonds League • Sistema de Tickets' })
        .setTimestamp();

      try {
        console.log('[TICKET-CLOSE] Intentando enviar DM...');
        await creator.send({ embeds: [dmEmbed] });
        console.log(`[TICKET-CLOSE] ✅ DM enviado exitosamente a ${creator.user.tag}`);
      } catch (error) {
        console.error('[TICKET-CLOSE] ❌ No se pudo enviar DM:', error.message);
        console.error('[TICKET-CLOSE] Posible causa: Usuario tiene DMs deshabilitados o bloqueó al bot');
      }
    }

    // Mensaje de cierre en el canal
    const closeEmbed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🔒 Ticket Cerrado')
      .setDescription(
        `**Cerrado por:** <@${closer.id}>\n` +
        `**Razón:** ${reason}\n\n` +
        `**El canal se eliminará en 5 segundos...**`
      )
      .setTimestamp();

    await channel.send({ embeds: [closeEmbed] });

    // Log de ticket cerrado
    if (logger) {
      logger.logSystem(
        guild.client,
        closer,
        'ticket_close',
        {
          description: `Ticket ${channel.name} cerrado`,
          channel: channel.id,
          stats: `Razón: ${reason}\nCreador: <@${creatorId}>`
        }
      ).catch(err => console.error('[TICKET] Error en log:', err));
    }

    // Eliminar el canal después de 5 segundos
    setTimeout(async () => {
      try {
        await channel.delete(`Ticket cerrado por ${closer.tag} - Razón: ${reason}`);
        console.log(`[TICKET] Canal ${channel.name} eliminado correctamente`);
      } catch (error) {
        console.error('[TICKET] Error eliminando canal:', error);
      }
    }, 5000);

    return true;
  } catch (error) {
    console.error('[TICKET] Error en cerrarTicketConRazon:', error);
    throw error;
  }
}

module.exports = {
  getCounter,
  incrementCounter,
  TICKET_TYPES,
  crearTicket,
  reclamarTicket,
  cerrarTicketConRazon
};
