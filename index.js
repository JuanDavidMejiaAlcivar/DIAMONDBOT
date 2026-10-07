require('dotenv').config();

const {
  Client,
  Collection,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
} = require('discord.js');
const fs   = require('node:fs');
const path = require('node:path');
const db   = require('./utils/db');
const { pendingEdits } = require('./utils/state');
const { crearEquipoCompleto, hexAInt } = require('./utils/teamService');
const { deleteTeamEmoji, getTeamEmoji } = require('./utils/emojiService');
const logger = require('./utils/logger');
const { crearTicket, reclamarTicket, cerrarTicketConRazon } = require('./utils/ticketSystem');

const DT_ROLE_ID       = process.env.DT_ROLE_ID ? process.env.DT_ROLE_ID.trim() : null;
const SUBDT_ROLE_ID    = process.env.SUBDT_ROLE_ID ? process.env.SUBDT_ROLE_ID.trim() : null;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    console.log(`✅  Comando cargado: /${command.data.name}`);
  } else {
    console.warn(`⚠️  El archivo ${file} no exporta {data, execute}. Se ignorará.`);
  }
}

client.on('interactionCreate', async (interaction) => {

  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
      // Log del comando ejecutado exitosamente (en segundo plano, no bloquea)
      logger.logCommand(client, interaction, interaction.commandName).catch(err => console.error('[LOGGER] Error en log de comando:', err));
    } catch (error) {
      console.error(`Error ejecutando /${interaction.commandName}:`, error);
      // Log del error (en segundo plano, no bloquea)
      logger.logCommand(client, interaction, interaction.commandName, {
        error: error.message || 'Error desconocido'
      }).catch(err => console.error('[LOGGER] Error en log de comando:', err));
      const msg = { content: 'Ocurrió un error al ejecutar este comando.', flags: 64 };
      if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
      else await interaction.reply(msg);
    }
    return;
  }

  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (!command?.autocomplete) return;
    try { await command.autocomplete(interaction); }
    catch (err) { console.error(`Error en autocomplete /${interaction.commandName}:`, err); }
    return;
  }

  if (interaction.isButton()) {
    const id = interaction.customId;
    console.log('[BUTTON] Botón detectado:', id);

    try {

      // ═══════════════════════════════════════════════════════════════════
      // SISTEMA DE TICKETS
      // ═══════════════════════════════════════════════════════════════════

      // Crear ticket
      if (id.startsWith('ticket_') && !id.includes('claim') && !id.includes('close') && !id.includes('confirm') && !id.includes('cancel')) {
        console.log('[TICKET] Intentando crear ticket, tipo:', id);
        const ticketType = id.replace('ticket_', '');
        
        // Verificar si el usuario ya tiene un ticket abierto
        const existingTicket = interaction.guild.channels.cache.find(
          ch => ch.name.startsWith('ticket-') && 
          ch.permissionOverwrites.cache.has(interaction.user.id)
        );

        if (existingTicket) {
          console.log('[TICKET] Usuario ya tiene ticket abierto');
          return interaction.reply({
            content: `❌ Ya tienes un ticket abierto: <#${existingTicket.id}>\n> Por favor, ciérralo antes de abrir otro.`,
            flags: 64 // ephemeral
          });
        }

        console.log('[TICKET] Deferring reply...');
        await interaction.deferReply({ flags: 64 }); // 64 = ephemeral

        try {
          console.log('[TICKET] Llamando a crearTicket...');
          const { channel, ticketNumber } = await crearTicket(
            interaction.guild,
            interaction.member,
            ticketType
          );

          console.log('[TICKET] Ticket creado, editando reply...');
          await interaction.editReply({
            content: `✅ Ticket creado exitosamente: <#${channel.id}>\n> Ticket #${ticketNumber}`
          });

          console.log(`[TICKET] Ticket #${ticketNumber} creado por ${interaction.user.tag}`);
        } catch (error) {
          console.error('[TICKET] Error creando ticket:', error);
          await interaction.editReply({
            content: `❌ Error al crear el ticket: ${error.message}\n> Por favor, contacta con un administrador.`
          });
        }
        return;
      }

      // Reclamar ticket
      if (id.startsWith('ticket_claim_')) {
        console.log('[TICKET] Intentando reclamar ticket');
        const ticketNumber = id.replace('ticket_claim_', '');
        
        // Verificar que sea admin/staff
        const { isAdmin } = require('./utils/permissions');
        if (!isAdmin(interaction.member)) {
          console.log('[TICKET] Usuario no es admin');
          return interaction.reply({
            content: '❌ Solo los administradores pueden reclamar tickets.',
            flags: 64 // ephemeral
          });
        }

        console.log('[TICKET] Admin verificado, deferring update...');
        await interaction.deferUpdate();

        try {
          console.log('[TICKET] Llamando a reclamarTicket...');
          await reclamarTicket(interaction, ticketNumber);
          
          // Extraer el creatorId del botón de cerrar original
          const originalCloseButton = interaction.message.components[0]?.components?.find(
            btn => btn.customId?.startsWith('ticket_close_')
          );
          const originalCreatorId = originalCloseButton?.customId?.split('_')[3];
          
          console.log('[TICKET] Creator ID extraído del botón original:', originalCreatorId);
          
          // Deshabilitar el botón de reclamar pero MANTENER el creatorId en el botón de cerrar
          const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`ticket_claim_${ticketNumber}`)
              .setLabel('Ticket Reclamado')
              .setEmoji('✅')
              .setStyle(ButtonStyle.Success)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId(`ticket_close_${ticketNumber}_${originalCreatorId}`)
              .setLabel('Cerrar Ticket')
              .setEmoji('🔒')
              .setStyle(ButtonStyle.Danger)
          );

          await interaction.message.edit({ components: [disabledRow] });
          
          console.log(`[TICKET] Ticket #${ticketNumber} reclamado por ${interaction.user.tag}`);
        } catch (error) {
          console.error('[TICKET] Error reclamando ticket:', error);
        }
        return;
      }

      // Cerrar ticket (mostrar modal para la razón)
      if (id.startsWith('ticket_close_') && !id.includes('confirm') && !id.includes('cancel')) {
        console.log('[TICKET] Intentando cerrar ticket');
        const parts = id.split('_');
        const ticketNumber = parts[2];
        const creatorId = parts[3];
        
        // Verificar que sea el creador o admin
        const { isAdmin } = require('./utils/permissions');
        const isCreator = interaction.user.id === creatorId;
        
        console.log('[TICKET] Es admin?', isAdmin(interaction.member), 'Es creador?', isCreator);
        
        if (!isAdmin(interaction.member) && !isCreator) {
          console.log('[TICKET] Usuario no autorizado para cerrar');
          return interaction.reply({
            content: '❌ Solo el creador del ticket o un administrador pueden cerrarlo.',
            flags: 64 // ephemeral
          });
        }

        // Crear modal para la razón
        const modal = new ModalBuilder()
          .setCustomId(`ticket_close_modal_${ticketNumber}_${creatorId}`)
          .setTitle('Cerrar Ticket');

        const reasonInput = new TextInputBuilder()
          .setCustomId('close_reason')
          .setLabel('Razón del cierre')
          .setPlaceholder('Describe brevemente por qué se cierra este ticket...')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMinLength(10)
          .setMaxLength(500);

        const row = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(row);

        try {
          console.log('[TICKET] Mostrando modal de cierre...');
          await interaction.showModal(modal);
        } catch (error) {
          console.error('[TICKET] Error mostrando modal:', error);
          await interaction.reply({
            content: '❌ Error al procesar la solicitud de cierre.',
            flags: 64 // ephemeral
          }).catch(() => {});
        }
        return;
      }

      // ═══════════════════════════════════════════════════════════════════
      // FIN SISTEMA DE TICKETS
      // ═══════════════════════════════════════════════════════════════════

      if (id.startsWith('sign_accept_') || id.startsWith('sign_reject_')) {
        const accepting = id.startsWith('sign_accept_');
        const requestId = id.slice(accepting ? 'sign_accept_'.length : 'sign_reject_'.length);
        const request = db.obtenerPropuesta(requestId);
        if (!request || request.status !== 'PENDING') {
          return interaction.reply({ content: 'Esta propuesta ya no está disponible o expiró.', flags: 64 });
        }
        if (interaction.user.id !== request.target_id) {
          return interaction.reply({ content: 'Solo el jugador invitado puede responder a esta propuesta.', flags: 64 });
        }
        if (!accepting) {
          db.actualizarPropuesta(requestId, { status: 'REJECTED', resolved_at: new Date().toISOString() });
          const rejected = new EmbedBuilder().setColor(0x607d8b).setTitle('🚫 Propuesta rechazada')
            .setDescription(`Has rechazado la propuesta de **${db.obtenerEquipoPorId(request.team_id)?.nombre || 'equipo'}**.`);
          await interaction.update({ embeds: [rejected], components: [] });
          
          const team = db.obtenerEquipoPorId(request.team_id);
          
          // Log de fichaje rechazado (en segundo plano, no bloquea)
          logger.logMember(
            client,
            interaction.user,
            'reject_fichaje',
            request.target_id,
            team?.nombre || 'Equipo desconocido',
            {}
          ).catch(err => console.error('[LOGGER] Error en log de fichaje rechazado:', err));
          
          try {
            const requester = await client.users.fetch(request.requested_by);
            const embedToRequester = new EmbedBuilder().setColor(0x607d8b).setTitle('🚫 Fichaje rechazado')
              .setDescription(`<@${request.target_id}> rechazó la propuesta de fichaje para **${team?.nombre || 'tu equipo'}**.`);
            if (team?.escudo) embedToRequester.setThumbnail(team.escudo);
            await requester.send({ embeds: [embedToRequester] });

            if (request.public_channel_id && request.public_message_id) {
              const pubChannel = await client.channels.fetch(request.public_channel_id).catch(() => null);
              if (pubChannel) {
                const pubMsg = await pubChannel.messages.fetch(request.public_message_id).catch(() => null);
                if (pubMsg) {
                  const rejectEmbed = new EmbedBuilder().setColor(0xef5350).setTitle('🚫 Fichaje rechazado').setDescription(`<@${request.target_id}> rechazó la propuesta de fichaje para **${team?.nombre || 'el equipo'}**.`);
                  if (team?.escudo) rejectEmbed.setThumbnail(team.escudo);
                  await pubMsg.edit({ embeds: [rejectEmbed] });
                }
              }
            }
          } catch (error) { console.error(`No se pudo notificar el rechazo del fichaje ${requestId}:`, error); }
          return;
        }

        await interaction.deferUpdate();
        const team = db.obtenerEquipoPorId(request.team_id);
        const currentRequester = db.obtenerMiembro(request.requested_by);
        const targetRecord = db.obtenerMiembro(request.target_id);
        if (!team || !currentRequester || currentRequester.inconsistent || currentRequester.team_id !== request.team_id || !['DT', 'SUB_DT'].includes(currentRequester.role)) {
          db.actualizarPropuesta(requestId, { status: 'CANCELLED', resolved_at: new Date().toISOString() });
          return interaction.editReply({ content: 'La propuesta ya no es válida porque cambió el cargo o el equipo de quien la envió.', embeds: [], components: [] });
        }
        if (targetRecord?.inconsistent || targetRecord) {
          db.actualizarPropuesta(requestId, { status: 'CANCELLED', resolved_at: new Date().toISOString() });
          const currentTeam = targetRecord?.team_id ? db.obtenerEquipoPorId(targetRecord.team_id) : null;
          return interaction.editReply({ content: targetRecord?.role === 'DT' || targetRecord?.role === 'SUB_DT'
            ? 'No se puede completar el fichaje porque ahora ocupas un cargo técnico.'
            : `No se puede completar el fichaje porque ya perteneces a ${currentTeam?.nombre || 'otro equipo'}.`, embeds: [], components: [] });
        }
        const guild = await client.guilds.fetch(request.guild_id).catch(() => null);
        const member = guild ? await guild.members.fetch(request.target_id).catch(() => null) : null;
        const teamRole = guild && team.role_id ? await guild.roles.fetch(team.role_id).catch(() => null) : null;
        if (!guild || !member || !teamRole) {
          db.actualizarPropuesta(requestId, { status: 'CANCELLED', resolved_at: new Date().toISOString() });
          return interaction.editReply({ content: 'No se pudo verificar el servidor, el jugador o el rol del equipo. Contacta a un administrador.', embeds: [], components: [] });
        }
        try {
          await member.roles.add(teamRole, `Fichaje aceptado; propuesta por ${request.requested_by}`);
          try {
            db.registrarMiembro(team.id, request.target_id, 'PLAYER', request.haxball_nick, request.requested_by);
          } catch (error) {
            await member.roles.remove(teamRole).catch(e => console.error('Error al revertir rol tras fallo de fichaje:', e));
            throw error;
          }
        } catch (error) {
          console.error(`Error completando propuesta de fichaje ${requestId}:`, error);
          db.actualizarPropuesta(requestId, { status: 'FAILED', resolved_at: new Date().toISOString() });
          return interaction.editReply({ content: 'No se pudo completar el fichaje. Revisa los permisos del bot e inténtalo más tarde.', embeds: [], components: [] });
        }
        // Apodo: fuera del bloque crítico, falla silenciosamente si el bot no tiene permisos
        try {
          const prefix = (team.abreviacion || team.nombre).substring(0, 10).trim();
          const nick = `${prefix} | ${request.haxball_nick}`.substring(0, 32);
          await member.setNickname(nick, 'Fichaje confirmado');
        } catch (e) {
          console.warn(`No se pudo cambiar apodo de ${request.target_id}:`, e.message);
        }
        db.actualizarPropuesta(requestId, { status: 'ACCEPTED', resolved_at: new Date().toISOString() });
        
        // Log de fichaje aceptado (en segundo plano, no bloquea)
        logger.logMember(
          client,
          interaction.user,
          'accept_fichaje',
          request.target_id,
          team.nombre,
          {
            role: 'PLAYER',
            haxball_nick: request.haxball_nick
          }
        ).catch(err => console.error('[LOGGER] Error en log de fichaje aceptado:', err));
        
        const teamColor = team.color_primario?.startsWith('#') ? hexAInt(team.color_primario) : 0x00bfa6;
        const accepted = new EmbedBuilder().setColor(teamColor).setTitle('🤝 Fichaje confirmado')
          .setDescription(`¡Felicidades! Ahora formas parte oficialmente de **${team.nombre}**.`)
          .addFields({ name: '🎮 Nick', value: request.haxball_nick, inline: true }, { name: '🛡️ Rol', value: 'Asignado correctamente', inline: true });
        if (team.escudo) accepted.setThumbnail(team.escudo);
        await interaction.editReply({ embeds: [accepted], components: [] });
        
        try {
          const requester = await client.users.fetch(request.requested_by);
          const embedRequester = new EmbedBuilder().setColor(teamColor).setTitle('🤝 Fichaje aceptado')
            .setDescription(`¡Excelentes noticias! <@${request.target_id}> ha aceptado la propuesta y ya forma parte de **${team.nombre}**.`)
            .addFields({ name: '🎮 Nick', value: request.haxball_nick, inline: true });
          if (team.escudo) embedRequester.setThumbnail(team.escudo);
          await requester.send({ embeds: [embedRequester] });

          if (request.public_channel_id && request.public_message_id) {
            const pubChannel = await client.channels.fetch(request.public_channel_id).catch(() => null);
            if (pubChannel) {
              const pubMsg = await pubChannel.messages.fetch(request.public_message_id).catch(() => null);
              if (pubMsg) {
                const accEmbed = new EmbedBuilder().setColor(teamColor).setTitle('🤝 Fichaje confirmado').setDescription(`<@${request.target_id}> ha aceptado la propuesta y ya forma parte de **${team.nombre}**.`).addFields({ name: '🎮 Nick', value: request.haxball_nick, inline: true });
                if (team.escudo) accEmbed.setThumbnail(team.escudo);
                await pubMsg.edit({ embeds: [accEmbed] });
              }
            }
          }
        } catch (error) { console.error(`No se pudo notificar el fichaje aceptado ${requestId}:`, error); }
        return;
      }

      if (id.startsWith('resign_cancel_')) {
        const userId = id.slice('resign_cancel_'.length);
        if (interaction.user.id !== userId) return interaction.reply({ content: 'Esta confirmación pertenece a otro usuario.', flags: 64 });
        return interaction.update({ content: 'Renuncia cancelada. No se realizaron cambios.', embeds: [], components: [] });
      }

      if (id.startsWith('resign_confirm_')) {
        const payload = id.slice('resign_confirm_'.length);
        const separator = payload.indexOf('_');
        const userId = payload.slice(0, separator);
        const teamId = payload.slice(separator + 1);
        if (interaction.user.id !== userId) return interaction.reply({ content: 'Esta confirmación pertenece a otro usuario.', flags: 64 });

        // Defer inmediatamente para evitar timeout de 3s de Discord
        await interaction.deferUpdate();

        const record = db.obtenerMiembro(userId);
        if (!record || record.inconsistent || record.role !== 'PLAYER' || record.team_id !== teamId) {
          return interaction.editReply({ content: 'Tu pertenencia al equipo cambió y no se pudo completar la renuncia. No se realizaron cambios.', embeds: [], components: [] });
        }
        const team = db.obtenerEquipoPorId(teamId);
        const role = team?.role_id ? await interaction.guild.roles.fetch(team.role_id).catch(() => null) : null;
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (!team || !role || !member || !member.roles.cache.has(role.id)) {
          return interaction.editReply({ content: 'No se pudo verificar el rol de equipo. No se realizaron cambios; contacta a un administrador.', embeds: [], components: [] });
        }
        try {
          await member.roles.remove(role, 'Renuncia voluntaria');
          db.quitarMiembro(teamId, userId, 'RESIGNED', userId);
        } catch (error) {
          console.error('Error procesando renuncia:', error);
          if (!member.roles.cache.has(role.id)) await member.roles.add(role).catch(e => console.error('Error reponiendo rol tras fallo de renuncia:', e));
          return interaction.editReply({ content: 'No se pudo completar la renuncia. No se realizaron cambios.', embeds: [], components: [] });
        }
        // Apodo: fuera del bloque crítico
        try {
          await member.setNickname(null, 'Renuncia del equipo');
        } catch (e) {
          console.warn(`No se pudo resetear apodo de ${userId}:`, e.message);
        }
        const teamColor2 = team.color_primario?.startsWith('#') ? hexAInt(team.color_primario) : 0x00bfa6;
        try {
          const embedRenuncia = new EmbedBuilder()
            .setColor(teamColor2)
            .setTitle('👋 Renuncia confirmada')
            .setDescription(`Has renunciado oficialmente a **${team.nombre}**.\n\nYa no formas parte de su plantilla y has quedado como jugador libre.`);
          if (team.escudo) embedRenuncia.setThumbnail(team.escudo);
          await interaction.user.send({ embeds: [embedRenuncia] });
        } catch (error) { console.error(`No se pudo enviar DM (renuncia) a ${userId}:`, error); }
        await require('./utils/rosterCommands').notifyDirector(
          interaction.guild,
          team,
          `<@${userId}> renunció oficialmente al equipo.\n\n**Equipo:** ${team.nombre}\nEl jugador ha sido dado de baja y quedó como agente libre.`,
          'aviso de renuncia al DT'
        );
        const renunciaFinalEmbed = new EmbedBuilder()
          .setColor(teamColor2)
          .setTitle('👋 Renuncia completada')
          .setDescription(
            `Tu renuncia ha sido procesada exitosamente.\n\n` +
            `🛡️ **Equipo:** \`${team.nombre}\`\n` +
            `📋 **Estado:** \`Agente Libre\`\n` +
            `🎮 **Apodo:** \`Restablecido al nombre de Discord\`\n\n` +
            `> *Ya no formas parte de la plantilla. Puedes recibir propuestas de otros equipos.*`
          )
          .setTimestamp();
        if (team.escudo) renunciaFinalEmbed.setThumbnail(team.escudo);
        return interaction.editReply({ content: '', embeds: [renunciaFinalEmbed], components: [] });
      }

      if (id.startsWith('del_cat_confirm_')) {
        const catId  = id.replace('del_cat_confirm_', '');
        const cat    = db.obtenerCategoriaPorId(catId);
        const result = db.eliminarCategoria(catId);
        const embed  = result.ok
          ? new EmbedBuilder().setColor(0x00bfa6).setTitle('Categoría eliminada').setDescription(`**${cat?.nombre}** fue eliminada correctamente.`).setTimestamp()
          : new EmbedBuilder().setColor(0xef5350).setTitle('No se pudo eliminar').setDescription(result.error).setTimestamp();
        return interaction.update({ embeds: [embed], components: [] });
      }

      if (id.startsWith('del_cat_cancel_')) {
        return interaction.update({
          embeds: [new EmbedBuilder().setColor(0x455a64).setTitle('Eliminación cancelada').setDescription('La categoría no fue modificada.')],
          components: [],
        });
      }

      if (id.startsWith('elim_confirm_')) {
        const equipoId = id.replace('elim_confirm_', '');
        const equipo   = db.obtenerEquipoPorId(equipoId);
        if (!equipo) return interaction.update({ content: 'El equipo ya no existe.', embeds: [], components: [] });

        const guild        = interaction.guild;
        const nombreEquipo = equipo.nombre;
        const cat          = db.obtenerCategoriaPorId(equipo.categoria_id);

        // Obtener plantilla del equipo para resetear apodos
        const plantilla = db.obtenerPlantilla(equipoId);
        const miembrosIds = plantilla?.miembros?.map(m => m.discord_user_id) || [];

        // Resetear apodos de todos los miembros del equipo
        for (const memberId of miembrosIds) {
          try {
            const member = await guild.members.fetch(memberId).catch(() => null);
            if (member) {
              await member.setNickname(null, `Equipo ${nombreEquipo} eliminado`).catch(err => {
                console.log(`No se pudo resetear apodo de ${memberId}:`, err.message);
              });
            }
          } catch (e) {
            console.log(`Error reseteando apodo de ${memberId}:`, e.message);
          }
        }

        for (const channelId of [equipo.channel_id]) {
          if (!channelId) continue;
          try { const c = await guild.channels.fetch(channelId).catch(() => null); if (c) await c.delete(); } catch (e) { console.error(e); }
        }
        for (const roleId of [equipo.role_id]) {
          if (!roleId) continue;
          try { const r = await guild.roles.fetch(roleId).catch(() => null); if (r) await r.delete(); } catch (e) { console.error(e); }
        }

        if (equipo.director_tecnico_id && DT_ROLE_ID) {
          try {
            const member = await guild.members.fetch(equipo.director_tecnico_id).catch(() => null);
            if (member) await member.roles.remove(DT_ROLE_ID);
          } catch (e) { console.error(e); }
        }

        if (equipo.sub_director_tecnico_id && SUBDT_ROLE_ID) {
          try {
            const member = await guild.members.fetch(equipo.sub_director_tecnico_id).catch(() => null);
            if (member) await member.roles.remove(SUBDT_ROLE_ID);
          } catch (e) { console.error(e); }
        }

        await deleteTeamEmoji(guild, equipo.discord_emoji_id);

        db.eliminarEquipoPorId(equipoId);

        // Log de equipo eliminado (en segundo plano, no bloquea)
        logger.logTeam(
          client,
          interaction.user,
          'delete',
          nombreEquipo,
          {
            categoria: cat?.nombre || 'Sin categoría',
            changes: `Rol eliminado, canal eliminado, ${miembrosIds.length} apodo(s) reseteados`
          }
        ).catch(err => console.error('[LOGGER] Error en log de eliminate-equipo:', err));

        return interaction.update({
          embeds: [
            new EmbedBuilder()
              .setColor(0x00bfa6)
              .setTitle('Equipo eliminado')
              .setDescription(
                `**${nombreEquipo}** ha sido eliminado permanentemente de Diamonds League.\n\n` +
                `Categoría\n${cat ? cat.nombre : '—'}\n\n` +
                `El rol del equipo, canal privado y apodos de ${miembrosIds.length} miembro(s) fueron eliminados.`
              )
              .setTimestamp(),
          ],
          components: [],
        });
      }

      if (id.startsWith('elim_cancel_')) {
        return interaction.update({
          embeds: [new EmbedBuilder().setColor(0x455a64).setTitle('Eliminación cancelada').setDescription('No se realizaron cambios.')],
          components: [],
        });
      }

      if (id.startsWith('edit_confirm|')) {
        const [, userId, equipoId] = id.split('|');
        if (interaction.user.id !== userId) {
          return interaction.reply({ content: 'Solo el administrador que inició esta acción puede confirmarla.', flags: 64 });
        }
        return client.commands.get('edit-equipo').applyConfirm(interaction, userId, equipoId);
      }

      if (id.startsWith('edit_cancel|')) {
        const [, userId, equipoId] = id.split('|');
        pendingEdits.delete(`${userId}|${equipoId}`);
        return client.commands.get('edit-equipo').applyCancel(interaction);
      }

      if (id.startsWith('appacc|')) {
        const solicitudId = id.replace('appacc|', '');

        const { isAdmin } = require('./utils/permissions');
        if (!isAdmin(interaction.member)) {
          return interaction.reply({ 
            content: '🔒 **Acceso denegado**\n\nSolo los administradores autorizados pueden gestionar las solicitudes de equipos.', 
            flags: 64 
          });
        }

        const solicitud = db.obtenerSolicitudPorId(solicitudId);
        if (!solicitud)                     return interaction.reply({ content: 'Solicitud no encontrada.',        flags: 64 });
        if (solicitud.status !== 'PENDING') return interaction.reply({ content: 'Esta solicitud ya fue procesada.', flags: 64 });

        const categoria = db.obtenerCategoriaPorId(solicitud.category_id);
        if (!categoria || db.categoriaLlena(categoria)) {
          return interaction.reply({ content: `La categoría **${categoria?.nombre || solicitud.category_id}** ya no tiene cupos disponibles.`, flags: 64 });
        }

        const conflictos = [];
        for (const pid of solicitud.players) {
          const eq = db.obtenerEquipoPorJugador(pid);
          if (eq) conflictos.push(`<@${pid}> ya pertenece a **${eq.nombre}**`);
        }
        if (solicitud.director_tecnico_id) {
          const eq = db.obtenerEquipoPorJugador(solicitud.director_tecnico_id);
          if (eq) conflictos.push(`DT <@${solicitud.director_tecnico_id}> ya pertenece a **${eq.nombre}**`);
        }
        if (solicitud.sub_director_tecnico_id) {
          const eq = db.obtenerEquipoPorJugador(solicitud.sub_director_tecnico_id);
          if (eq) conflictos.push(`Sub-DT <@${solicitud.sub_director_tecnico_id}> ya pertenece a **${eq.nombre}**`);
        }
        if (conflictos.length > 0) {
          return interaction.reply({ content: `No se puede aprobar. Los siguientes miembros ya tienen equipo:\n\n${conflictos.join('\n')}`, flags: 64 });
        }

        db.actualizarSolicitud(solicitudId, {
          status:      'APPROVED',
          reviewed_at: new Date().toISOString(),
          reviewed_by: interaction.user.id,
        });

        await interaction.deferUpdate();

        let result;
        try {
          result = await crearEquipoCompleto(
            interaction.guild,
            {
              nombre:                  solicitud.team_name,
              abreviacion:             solicitud.abbreviation,
              color_primario:          solicitud.primary_color,
              color_secundario:        solicitud.secondary_color,
              escudo_url:              solicitud.shield_url,
              categoria_id:            solicitud.category_id,
              jugadores:               solicitud.players,
              director_tecnico_id:     solicitud.director_tecnico_id     || null,
              sub_director_tecnico_id: solicitud.sub_director_tecnico_id || null,
            },
            client.user.id
          );
        } catch (err) {
          db.actualizarSolicitud(solicitudId, { status: 'PENDING', reviewed_at: null, reviewed_by: null });
          return interaction.followUp({ content: `Error al crear el equipo: ${err.message}`, flags: 64 });
        }

        const { equipo, rol, canal } = result;

        // Obtener nicks de HaxBall de la solicitud
        const playerNicks = solicitud.player_nicks || {};

        for (const playerId of solicitud.players) {
          try {
            const member = await interaction.guild.members.fetch(playerId).catch(() => null);
            if (member) {
              await member.roles.add(rol.id);
              
              // Actualizar nickname con formato: ABREVIACION | nick_haxball
              const haxballNick = playerNicks[playerId];
              if (haxballNick) {
                const newNickname = `${solicitud.abbreviation} | ${haxballNick}`;
                // Discord limita nicknames a 32 caracteres
                const finalNickname = newNickname.length > 32 ? newNickname.substring(0, 32) : newNickname;
                await member.setNickname(finalNickname).catch(err => {
                  console.error(`Error estableciendo nickname para ${playerId}:`, err.message);
                });
              }
            }
          } catch (err) { console.error(`Error asignando rol a jugador ${playerId}:`, err); }
        }

        if (solicitud.director_tecnico_id) {
          try {
            const member = await interaction.guild.members.fetch(solicitud.director_tecnico_id).catch(() => null);
            if (member) {
              await member.roles.add(rol.id).catch(console.error);
              if (DT_ROLE_ID) await member.roles.add(DT_ROLE_ID).catch(console.error);
              
              // Actualizar nickname del DT
              const haxballNick = playerNicks[solicitud.director_tecnico_id];
              if (haxballNick) {
                const newNickname = `${solicitud.abbreviation} | ${haxballNick}`;
                const finalNickname = newNickname.length > 32 ? newNickname.substring(0, 32) : newNickname;
                await member.setNickname(finalNickname).catch(err => {
                  console.error(`Error estableciendo nickname para DT:`, err.message);
                });
              }
            }
          } catch (err) { console.error('Error asignando rol a DT:', err); }
        }

        if (solicitud.sub_director_tecnico_id) {
          try {
            const member = await interaction.guild.members.fetch(solicitud.sub_director_tecnico_id).catch(() => null);
            if (member) {
              await member.roles.add(rol.id).catch(console.error);
              if (SUBDT_ROLE_ID) await member.roles.add(SUBDT_ROLE_ID).catch(console.error);
              
              // Actualizar nickname del Sub-DT
              const haxballNick = playerNicks[solicitud.sub_director_tecnico_id];
              if (haxballNick) {
                const newNickname = `${solicitud.abbreviation} | ${haxballNick}`;
                const finalNickname = newNickname.length > 32 ? newNickname.substring(0, 32) : newNickname;
                await member.setNickname(finalNickname).catch(err => {
                  console.error(`Error estableciendo nickname para Sub-DT:`, err.message);
                });
              }
            }
          } catch (err) { console.error('Error asignando rol a Sub-DT:', err); }
        }

        try { await canal.send(`*Canal de ${solicitud.team_name}*\n\n<@&${rol.id}>`); } catch (_) {}

        const catInfo     = db.obtenerCategoriaPorId(solicitud.category_id);
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`appacc|${solicitudId}`).setLabel('Aceptar solicitud').setStyle(ButtonStyle.Success).setDisabled(true),
          new ButtonBuilder().setCustomId(`apprej|${solicitudId}`).setLabel('Rechazar solicitud').setStyle(ButtonStyle.Danger).setDisabled(true)
        );

        const emojiStr = getTeamEmoji(interaction.guild, equipo.id);

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x00bfa6)
              .setTitle('Solicitud de inscripción — Aprobada')
              .setThumbnail(solicitud.shield_url)
              .setDescription(`${emojiStr}**${solicitud.team_name}**`)
              .addFields(
                { name: 'Categoría',    value: catInfo?.nombre || '—',          inline: true },
                { name: 'Estado',       value: 'Aprobada',                       inline: true },
                { name: 'Revisada por', value: `<@${interaction.user.id}>`,      inline: true },
                { name: 'Rol del equipo', value: `<@&${rol.id}>`,                inline: true },
              )
              .setTimestamp(),
          ],
          components: [disabledRow],
        });

        try {
          const applicant = await client.users.fetch(solicitud.applicant_id);
          await applicant.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0x00bfa6)
                .setTitle('Diamonds League — Solicitud aprobada')
                .setDescription(
                  `Tu solicitud de inscripción ha sido aprobada.\n\n` +
                  `Equipo\n${emojiStr}${solicitud.team_name}\n\n` +
                  `Categoría\n${catInfo?.nombre} — ${catInfo?.descripcion}\n\n` +
                  `Rol del equipo\n<@&${rol.id}>\n\n` +
                  `Canal privado\n<#${canal.id}>\n\n` +
                  `Los jugadores y el cuerpo técnico ya recibieron sus roles correspondientes.`
                )
                .setTimestamp(),
            ],
          });
        } catch (err) { console.error('Error enviando DM al solicitante:', err); }

        return;
      }

      if (id.startsWith('apprej|')) {
        const solicitudId = id.replace('apprej|', '');

        const { isAdmin } = require('./utils/permissions');
        if (!isAdmin(interaction.member)) {
          return interaction.reply({ 
            content: '🔒 **Acceso denegado**\n\nSolo los administradores autorizados pueden gestionar las solicitudes de equipos.', 
            flags: 64 
          });
        }

        const solicitud = db.obtenerSolicitudPorId(solicitudId);
        if (!solicitud)                     return interaction.reply({ content: 'Solicitud no encontrada.',        flags: 64 });
        if (solicitud.status !== 'PENDING') return interaction.reply({ content: 'Esta solicitud ya fue procesada.', flags: 64 });

        const modal = new ModalBuilder()
          .setCustomId(`apprejm|${solicitudId}`)
          .setTitle('Rechazar solicitud');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('reject_reason')
              .setLabel('Motivo del rechazo')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setMaxLength(500)
          )
        );

        return interaction.showModal(modal);
      }

      // ═══════════════════════════════════════════════════════════════
      // Sistema de Tickets - Cerrar ticket (DEBE IR PRIMERO)
      // ═══════════════════════════════════════════════════════════════
      if (id.startsWith('ticket_close_')) {
        const channelId = id.replace('ticket_close_', '');
        const channel = interaction.channel;

        if (channel.id !== channelId) {
          return interaction.reply({ content: 'Este botón no corresponde a este canal.', flags: 64 });
        }

        // Solo administradores o el creador del ticket pueden cerrarlo
        const isAdmin = interaction.member.permissions.has('Administrator');
        const isOwner = channel.topic === `Ticket de ${interaction.user.id}`;

        if (!isAdmin && !isOwner) {
          return interaction.reply({ content: 'Solo administradores o el creador del ticket pueden cerrarlo.', flags: 64 });
        }

        await interaction.reply({ content: '🔒 Cerrando ticket...' });

        try {
          // Crear transcript básico
          const messages = await channel.messages.fetch({ limit: 100 });
          const transcript = messages.reverse().map(m => 
            `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}`
          ).join('\n');

          // Enviar transcript al creador (opcional)
          const userId = channel.topic?.replace('Ticket de ', '');
          if (userId) {
            try {
              const user = await interaction.client.users.fetch(userId);
              await user.send({
                content: `Tu ticket **${channel.name}** ha sido cerrado.`,
                files: [{
                  attachment: Buffer.from(transcript, 'utf-8'),
                  name: `transcript-${channel.name}.txt`
                }]
              });
            } catch (err) {
              console.log('No se pudo enviar transcript al usuario:', err.message);
            }
          }

          setTimeout(() => channel.delete('Ticket cerrado'), 3000);
        } catch (error) {
          console.error('Error cerrando ticket:', error);
          await interaction.followUp({ content: 'Error al cerrar el ticket.', flags: 64 });
        }
        return;
      }

      // ═══════════════════════════════════════════════════════════════
      // Sistema de Tickets - Crear ticket
      // ═══════════════════════════════════════════════════════════════
      if (id.startsWith('ticket_')) {
        console.log('[TICKET BUTTON] Botón presionado:', id);
        
        const ticketType = id.replace('ticket_', '');
        
        // Tipos de tickets y sus emojis/nombres
        const ticketTypes = {
          'partner': { emoji: '🤝', name: 'Partner', color: 0x1ABC9C },
          'duda': { emoji: '💭', name: 'Duda/Sugerencia', color: 0x40E0D0 },
          'postulacion': { emoji: '📋', name: 'Postulación', color: 0x0E7C86 },
          'apelacion': { emoji: '⚖️', name: 'Apelar Sanción', color: 0x13315C },
          'queja': { emoji: '📢', name: 'Queja', color: 0x0A2342 }
        };
        const ticketInfo = ticketTypes[ticketType];
        
        if (!ticketInfo) {
          console.log('[TICKET BUTTON] Tipo de ticket no reconocido:', ticketType);
          return interaction.reply({ content: 'Tipo de ticket no válido.', flags: 64 });
        }

        console.log('[TICKET BUTTON] Tipo reconocido:', ticketInfo.name);

        // Responder INMEDIATAMENTE para evitar timeout
        await interaction.deferReply({ flags: 64 });
        
        console.log('[TICKET BUTTON] DeferReply enviado');

        try {
          const guild = interaction.guild;
          const member = interaction.member;

          // Verificar si el usuario ya tiene un ticket abierto
          const existingTicket = guild.channels.cache.find(
            c => c.name.startsWith('ticket-') && c.topic === `Ticket de ${member.id}`
          );

          if (existingTicket) {
            return interaction.editReply({
              content: `Ya tienes un ticket abierto: ${existingTicket}`
            });
          }

          // Normalizar nombre para el canal
          const username = member.user.username.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .substring(0, 20);

          // Crear canal de ticket
          const ticketChannel = await guild.channels.create({
            name: `ticket-${username}`,
            topic: `Ticket de ${member.id}`,
            parent: interaction.channel.parent, // Misma categoría que el canal de tickets
            permissionOverwrites: [
              {
                id: guild.id,
                deny: ['ViewChannel']
              },
              {
                id: member.id,
                allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles']
              },
              {
                id: guild.roles.cache.find(r => r.permissions.has('Administrator'))?.id || guild.roles.everyone.id,
                allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles']
              }
            ]
          });

          // Crear embed del ticket
          const ticketEmbed = new EmbedBuilder()
  .setColor(ticketInfo.color)
  .setTitle(`${ticketInfo.emoji}  Ticket: ${ticketInfo.name}`)
  .setDescription(
    `> 👤 **Creado por:** ${member}\n` +
    `> 🏷️ **Categoría:** ${ticketInfo.name}\n\n` +
    `Un miembro del staff te atenderá pronto.\n` +
    `Por favor, **explica tu situación con detalle**.\n\n` +
    `⚠️ *Los tickets sin motivo válido pueden resultar en sanciones.*`
  )
  .setThumbnail(member.user.displayAvatarURL())
  .setFooter({ text: '💠 Diamonds League • Soporte', iconURL: member.user.displayAvatarURL() })
  .setTimestamp();
          // Botón para cerrar ticket
          const closeButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
  .setCustomId(`ticket_close_${ticketChannel.id}`)
  .setLabel('Cerrar Ticket')
  .setEmoji('🔒')
  .setStyle(ButtonStyle.Secondary)
          );

          // Enviar mensaje inicial mencionando administradores
          const adminRole = guild.roles.cache.find(r => r.permissions.has('Administrator'));
          const mentionText = adminRole ? `${adminRole}` : '@Administradores';

          await ticketChannel.send({
            content: `${mentionText} ${member}`,
            embeds: [ticketEmbed],
            components: [closeButton]
          });

          console.log('[TICKET BUTTON] Canal creado:', ticketChannel.name);

          await interaction.editReply({
            content: `✅ Tu ticket ha sido creado: ${ticketChannel}`
          });

          console.log('[TICKET BUTTON] Respuesta enviada correctamente');

        } catch (error) {
          console.error('[TICKET BUTTON] Error creando ticket:', error);
          await interaction.editReply({
            content: 'Ocurrió un error al crear el ticket. Por favor, contacta a un administrador.'
          }).catch(err => console.error('[TICKET BUTTON] Error enviando mensaje de error:', err));
        }
        return;
      }

    } catch (error) {
      console.error('Error en interacción de botón:', error);
    }
  }

  if (interaction.isModalSubmit()) {
    const id = interaction.customId;

    // Handler para modal de cierre de ticket
    if (id.startsWith('ticket_close_modal_')) {
      console.log('[TICKET] ========================================');
      console.log('[TICKET] Procesando modal de cierre');
      console.log('[TICKET] ID completo del modal:', id);
      
      const parts = id.split('_');
      console.log('[TICKET] Partes del ID:', parts);
      
      const ticketNumber = parts[3];
      const creatorId = parts[4];
      const reason = interaction.fields.getTextInputValue('close_reason');

      console.log('[TICKET] Ticket Number:', ticketNumber);
      console.log('[TICKET] Creator ID extraído:', creatorId);
      console.log('[TICKET] Razón:', reason);
      console.log('[TICKET] Usuario que cierra:', interaction.user.tag);
      console.log('[TICKET] Guild:', interaction.guild.name);
      console.log('[TICKET] ========================================');

      await interaction.deferUpdate();

      try {
        console.log('[TICKET] Llamando a cerrarTicketConRazon...');
        await cerrarTicketConRazon(
          interaction.channel,
          interaction.user,
          reason,
          creatorId,
          interaction.guild
        );
        console.log(`[TICKET] ✅ Ticket #${ticketNumber} cerrado exitosamente por ${interaction.user.tag}`);
      } catch (error) {
        console.error('[TICKET] ❌ Error cerrando ticket:', error);
        await interaction.followUp({
          content: '❌ Error al cerrar el ticket. Por favor, contacta con un administrador.',
          flags: 64 // ephemeral
        }).catch(() => {});
      }
      return;
    }

    if (id.startsWith('apprejm|')) {
      const solicitudId = id.replace('apprejm|', '');
      const motivo      = interaction.fields.getTextInputValue('reject_reason');

      const solicitud = db.obtenerSolicitudPorId(solicitudId);
      if (!solicitud)                     return interaction.reply({ content: 'Solicitud no encontrada.',        flags: 64 });
      if (solicitud.status !== 'PENDING') return interaction.reply({ content: 'Esta solicitud ya fue procesada.', flags: 64 });

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
      } catch (err) { console.error('Error editando mensaje original:', err); }

      await interaction.reply({ content: 'Solicitud rechazada correctamente.', flags: 64 });

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
      } catch (err) { console.error('Error enviando DM al solicitante:', err); }
    }

    // ═══════════════════════════════════════════════════════════════
    // NUEVO: Handler para modal de nicks de HaxBall en inscripción
    // ═══════════════════════════════════════════════════════════════
    if (id.startsWith('inscripcion_nicks_')) {
      const inscribirCommand = client.commands.get('inscribir-equipo');
      if (inscribirCommand && inscribirCommand.handleModalSubmit) {
        try {
          await inscribirCommand.handleModalSubmit(interaction);
        } catch (error) {
          console.error('Error en modal de inscripción:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Ocurrió un error al procesar el formulario. Intenta nuevamente.', flags: 64 });
          }
        }
      }
      return;
    }
  }

});

client.on('guildMemberRemove', async (member) => {
  try {
    const record = db.obtenerMiembro(member.id);
    if (!record || record.inconsistent) return;
    const team = db.obtenerEquipoPorId(record.team_id);
    if (!team) return;

    if (record.role === 'PLAYER' || record.role === 'SUB_DT') {
      db.quitarMiembro(team.id, member.id, 'LEFT_SERVER', 'SYSTEM');
    } else {
      return;
    }

    await require('./utils/rosterCommands').notifyDirector(
      member.guild,
      team,
      `<@${member.id}> salió del servidor mientras pertenecía a **${team.nombre}**.\n\nEl jugador fue retirado de la plantilla y quedó como jugador libre.`,
      'aviso de salida del servidor al DT'
    );
  } catch (error) {
    console.error(`Error procesando la salida del servidor de ${member.id}:`, error);
  }
});

client.once('clientReady', (c) => {
  console.log(`\n🚀  Bot conectado como: ${c.user.tag}`);
  console.log(`📡  Sirviendo en ${c.guilds.cache.size} servidor(es)\n`);
});

// ═══════════════════════════════════════════════════════════════
// Sistema Antiraid - Protección Automática contra Spam
// ═══════════════════════════════════════════════════════════════
const { estaActivo, esSpam, tieneLinksSospechosos } = require('./utils/antiraid');
const { isStaff } = require('./utils/permissions');

client.on('messageCreate', async (message) => {
  // Ignorar mensajes del bot mismo
  if (message.author.id === client.user.id) return;

  // Ignorar mensajes en DM
  if (!message.guild) return;

  // Verificar si el antiraid está activo
  if (!estaActivo()) return;

  // El staff no es afectado por el antiraid
  if (isStaff(message.member)) return;

  // BLOQUEAR TODOS LOS BOTS cuando antiraid está activo
  if (message.author.bot) {
    try {
      await message.delete();
      console.log(`[ANTIRAID] Mensaje de bot bloqueado: ${message.author.tag}`);
    } catch (error) {
      console.error('[ANTIRAID] Error eliminando mensaje de bot:', error);
    }
    return;
  }

  // Detectar spam
  if (esSpam(message.content)) {
    try {
      await message.delete();
      
      // Intentar expulsar al usuario
      try {
        await message.member.kick('Spam detectado durante modo antiraid');
        
        // Notificar en el canal
        const embed = new EmbedBuilder()
          .setColor(0xEF5350)
          .setTitle('🚨 Usuario Expulsado por Spam')
          .setDescription(
            `**${message.author.tag}** fue expulsado automáticamente por spam.\n\n` +
            `**Canal:** ${message.channel}\n` +
            `**Razón:** Detección automática de spam durante modo antiraid`
          )
          .setTimestamp();
        
        await message.channel.send({ embeds: [embed] });
        console.log(`[ANTIRAID] Usuario expulsado por spam: ${message.author.tag}`);
      } catch (kickError) {
        console.error('[ANTIRAID] No se pudo expulsar al spammer:', kickError);
        
        // Si no se puede expulsar, al menos notificar
        const warnEmbed = new EmbedBuilder()
          .setColor(0xF39C12)
          .setTitle('⚠️ Spam Detectado')
          .setDescription(
            `Mensaje de spam eliminado de ${message.author}.\n\n` +
            `Staff: revisar y tomar acción si es necesario.`
          )
          .setTimestamp();
        
        await message.channel.send({ embeds: [warnEmbed] }).catch(() => {});
      }
    } catch (error) {
      console.error('[ANTIRAID] Error procesando spam:', error);
    }
    return;
  }

  // Detectar links sospechosos
  if (tieneLinksSospechosos(message.content)) {
    try {
      await message.delete();
      
      // Intentar expulsar
      try {
        await message.member.kick('Link sospechoso/malicioso detectado durante modo antiraid');
        
        const embed = new EmbedBuilder()
          .setColor(0xEF5350)
          .setTitle('🚨 Usuario Expulsado por Link Malicioso')
          .setDescription(
            `**${message.author.tag}** fue expulsado automáticamente.\n\n` +
            `**Canal:** ${message.channel}\n` +
            `**Razón:** Link sospechoso/malicioso detectado durante modo antiraid`
          )
          .setTimestamp();
        
        await message.channel.send({ embeds: [embed] });
        console.log(`[ANTIRAID] Usuario expulsado por link malicioso: ${message.author.tag}`);
      } catch (kickError) {
        console.error('[ANTIRAID] No se pudo expulsar por link malicioso:', kickError);
        
        const warnEmbed = new EmbedBuilder()
          .setColor(0xF39C12)
          .setTitle('⚠️ Link Sospechoso Detectado')
          .setDescription(
            `Link potencialmente malicioso eliminado de ${message.author}.\n\n` +
            `Staff: revisar y tomar acción.`
          )
          .setTimestamp();
        
        await message.channel.send({ embeds: [warnEmbed] }).catch(() => {});
      }
    } catch (error) {
      console.error('[ANTIRAID] Error procesando link malicioso:', error);
    }
    return;
  }
});

client.login(process.env.TOKEN);
