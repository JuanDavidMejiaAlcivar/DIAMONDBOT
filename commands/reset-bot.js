const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const db = require('../utils/db');

// IDs de los únicos usuarios autorizados para usar este comando
const AUTHORIZED_USERS = ['1506006863290957937', '1166181119113302036'];

// Rutas de archivos de datos
const DATA_DIR = path.join(__dirname, '..', 'data');

// IDs de roles generales
const DT_ROLE_ID = process.env.DT_ROLE_ID ? process.env.DT_ROLE_ID.trim() : null;
const SUBDT_ROLE_ID = process.env.SUBDT_ROLE_ID ? process.env.SUBDT_ROLE_ID.trim() : null;

function crearEstructuraInicial() {
  return {
    categorias: {
      categorias: [],
      equipos: [],
      transferHistory: []
    },
    fichajes: {
      plantillas: [],
      propuestas: [],
      fichados: [],
      bajas: []
    },
    solicitudes: {
      solicitudes: []
    },
    warnings: {
      warnings: []
    },
    antiraid: {
      activo: false,
      activado_por: null,
      activado_en: null
    }
  };
}

async function limpiarDiscord(guild) {
  const resultados = {
    rolesEliminados: 0,
    canalesEliminados: 0,
    rolesQuitados: 0,
    apodosReseteados: 0,
    errores: []
  };

  try {
    // Leer equipos antes de eliminar la base de datos
    const equipos = db.obtenerEquipos();
    const plantillas = db.leerFichajes().plantillas;

    // 1. Eliminar roles y canales de equipos
    for (const equipo of equipos) {
      // Eliminar rol del equipo
      if (equipo.discord_role_id) {
        try {
          const role = await guild.roles.fetch(equipo.discord_role_id).catch(() => null);
          if (role) {
            await role.delete('Reset del bot');
            resultados.rolesEliminados++;
          }
        } catch (err) {
          resultados.errores.push(`Error eliminando rol ${equipo.nombre}: ${err.message}`);
        }
      }

      // Eliminar canal del equipo
      if (equipo.discord_channel_id) {
        try {
          const channel = await guild.channels.fetch(equipo.discord_channel_id).catch(() => null);
          if (channel) {
            await channel.delete('Reset del bot');
            resultados.canalesEliminados++;
          }
        } catch (err) {
          resultados.errores.push(`Error eliminando canal ${equipo.nombre}: ${err.message}`);
        }
      }
    }

    // 2. Quitar roles de DT y Sub-DT de todos los miembros
    if (DT_ROLE_ID || SUBDT_ROLE_ID) {
      const members = await guild.members.fetch().catch(() => new Map());
      
      for (const [, member] of members) {
        if (member.user.bot) continue;

        try {
          let cambios = false;
          
          if (DT_ROLE_ID && member.roles.cache.has(DT_ROLE_ID)) {
            await member.roles.remove(DT_ROLE_ID);
            cambios = true;
          }
          
          if (SUBDT_ROLE_ID && member.roles.cache.has(SUBDT_ROLE_ID)) {
            await member.roles.remove(SUBDT_ROLE_ID);
            cambios = true;
          }
          
          if (cambios) {
            resultados.rolesQuitados++;
          }
        } catch (err) {
          resultados.errores.push(`Error quitando roles a ${member.user.tag}: ${err.message}`);
        }
      }
    }

    // 3. Resetear apodos de todos los miembros que estaban en plantillas
    const usuariosConApodo = new Set();
    for (const plantilla of plantillas) {
      for (const miembro of plantilla.miembros || []) {
        if (miembro.discord_user_id) {
          usuariosConApodo.add(miembro.discord_user_id);
        }
      }
    }

    for (const userId of usuariosConApodo) {
      try {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member && member.nickname) {
          await member.setNickname(null, 'Reset del bot');
          resultados.apodosReseteados++;
        }
      } catch (err) {
        resultados.errores.push(`Error reseteando apodo de ${userId}: ${err.message}`);
      }
    }

  } catch (error) {
    resultados.errores.push(`Error general: ${error.message}`);
  }

  return resultados;
}

function resetearBaseDatos() {
  const estructura = crearEstructuraInicial();
  
  try {
    // Resetear cada archivo
    fs.writeFileSync(
      path.join(DATA_DIR, 'categorias.json'),
      JSON.stringify(estructura.categorias, null, 2),
      'utf-8'
    );
    
    fs.writeFileSync(
      path.join(DATA_DIR, 'fichajes.json'),
      JSON.stringify(estructura.fichajes, null, 2),
      'utf-8'
    );
    
    fs.writeFileSync(
      path.join(DATA_DIR, 'solicitudes.json'),
      JSON.stringify(estructura.solicitudes, null, 2),
      'utf-8'
    );
    
    fs.writeFileSync(
      path.join(DATA_DIR, 'warnings.json'),
      JSON.stringify(estructura.warnings, null, 2),
      'utf-8'
    );
    
    fs.writeFileSync(
      path.join(DATA_DIR, 'antiraid-state.json'),
      JSON.stringify(estructura.antiraid, null, 2),
      'utf-8'
    );
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset-bot')
    .setDescription('Reinicia la configuración del sistema'),

  async execute(interaction) {
    // Verificar autorización
    if (!AUTHORIZED_USERS.includes(interaction.user.id)) {
      const noAuthEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Acceso Denegado')
        .setDescription('No tienes permisos para ejecutar este comando.')
        .setTimestamp();

      return interaction.reply({ embeds: [noAuthEmbed], ephemeral: true });
    }

    // Crear embed de advertencia
    const warningEmbed = new EmbedBuilder()
      .setColor(0xFF4500)
      .setTitle('⚠️ Confirmar Reinicio')
      .setDescription(
        '**Vas a reiniciar el sistema completo del bot.**\n\n' +
        '**Se eliminará:**\n' +
        '• Todos los equipos y categorías\n' +
        '• Todos los roles y canales de equipos\n' +
        '• Roles de DT y Sub-DT de todos los usuarios\n' +
        '• Apodos de todos los miembros de plantillas\n' +
        '• Fichajes, solicitudes y advertencias\n' +
        '• Historial completo\n\n' +
        '> Esta acción es irreversible.'
      )
      .setFooter({ text: '⏳ Tienes 60 segundos para confirmar' })
      .setTimestamp();

    // Crear botones de confirmación
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`reset_confirm_${interaction.id}_${interaction.user.id}`)
        .setLabel('Confirmar')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`reset_cancel_${interaction.id}_${interaction.user.id}`)
        .setLabel('Cancelar')
        .setStyle(ButtonStyle.Secondary)
    );

    const response = await interaction.reply({
      embeds: [warningEmbed],
      components: [row],
      ephemeral: true,
      fetchReply: true
    });

    // Crear collector para los botones
    const collector = response.createMessageComponentCollector({
      filter: i => 
        (i.customId.startsWith('reset_confirm_') || i.customId.startsWith('reset_cancel_')) &&
        i.user.id === interaction.user.id,
      time: 60000 // 60 segundos
    });

    collector.on('collect', async i => {
      if (i.customId.startsWith('reset_confirm_')) {
        // Ejecutar el reset
        await i.update({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFFA500)
              .setTitle('⏳ Procesando...')
              .setDescription('Eliminando datos y limpiando Discord...')
              .setTimestamp()
          ],
          components: []
        });

        // Limpiar Discord (roles, canales, apodos)
        const resultadosDiscord = await limpiarDiscord(interaction.guild);

        // Resetear base de datos
        const resultadoDB = resetearBaseDatos();

        if (resultadoDB.success) {
          const successEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Reinicio Completado')
            .setDescription(
              '**El sistema ha sido reiniciado exitosamente.**\n\n' +
              '**Resultados de la limpieza:**\n' +
              `• Roles eliminados: **${resultadosDiscord.rolesEliminados}**\n` +
              `• Canales eliminados: **${resultadosDiscord.canalesEliminados}**\n` +
              `• Roles de DT/Sub-DT quitados: **${resultadosDiscord.rolesQuitados}**\n` +
              `• Apodos reseteados: **${resultadosDiscord.apodosReseteados}**\n` +
              `• Base de datos: **Reseteada**\n\n` +
              (resultadosDiscord.errores.length > 0 
                ? `⚠️ **Advertencias:** ${resultadosDiscord.errores.length} error(es) menor(es)\n\n` 
                : '') +
              '> El sistema está listo para comenzar de nuevo.'
            )
            .setFooter({ text: `Ejecutado por ${interaction.user.tag}` })
            .setTimestamp();

          await i.editReply({
            embeds: [successEmbed],
            components: []
          });

          // Log en consola
          console.log(`[RESET-BOT] Sistema reseteado por ${interaction.user.tag} (${interaction.user.id})`);
          console.log(`[RESET-BOT] Roles eliminados: ${resultadosDiscord.rolesEliminados}, Canales: ${resultadosDiscord.canalesEliminados}, Roles quitados: ${resultadosDiscord.rolesQuitados}, Apodos: ${resultadosDiscord.apodosReseteados}`);
          if (resultadosDiscord.errores.length > 0) {
            console.log(`[RESET-BOT] Errores:`, resultadosDiscord.errores);
          }
          
        } else {
          const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Error')
            .setDescription(
              `Ocurrió un error al resetear la base de datos.\n\n` +
              `**Error:** ${resultadoDB.error}`
            )
            .setTimestamp();

          await i.editReply({
            embeds: [errorEmbed],
            components: []
          });

          console.error(`[RESET-BOT] Error: ${resultadoDB.error}`);
        }

      } else if (i.customId.startsWith('reset_cancel_')) {
        // Cancelar el reset
        const cancelEmbed = new EmbedBuilder()
          .setColor(0x607D8B)
          .setTitle('❌ Cancelado')
          .setDescription('Operación cancelada. No se realizaron cambios.')
          .setTimestamp();

        await i.update({
          embeds: [cancelEmbed],
          components: []
        });

        console.log(`[RESET-BOT] Cancelado por ${interaction.user.tag} (${interaction.user.id})`);
      }

      collector.stop();
    });

    collector.on('end', (collected, reason) => {
      if (reason === 'time') {
        // Timeout
        const timeoutEmbed = new EmbedBuilder()
          .setColor(0x607D8B)
          .setTitle('⏱️ Tiempo Agotado')
          .setDescription('La confirmación expiró. No se realizaron cambios.')
          .setTimestamp();

        interaction.editReply({
          embeds: [timeoutEmbed],
          components: []
        }).catch(() => {});
      }
    });
  }
};
