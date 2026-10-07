const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/db');
const { hexAInt } = require('../utils/teamService');
const { getTeamEmoji } = require('../utils/emojiService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('plantilla')
    .setDescription('Muestra la plantilla completa de un equipo')
    .addStringOption(opt => 
      opt.setName('equipo')
         .setDescription('Nombre o abreviación del equipo')
         .setRequired(true)
         .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const equipos = db.obtenerEquipos();
    const filtered = equipos.filter(e => 
      e.nombre.toLowerCase().includes(focused) || 
      (e.abreviacion && e.abreviacion.toLowerCase().includes(focused))
    );
    await interaction.respond(
      filtered.slice(0, 25).map(e => ({
        name: `${e.nombre} (${e.abreviacion})`,
        value: e.id
      }))
    );
  },

  async execute(interaction) {
    const equipoId = interaction.options.getString('equipo');
    const equipo = db.obtenerEquipoPorId(equipoId);

    if (!equipo) {
      return interaction.reply({ content: 'Equipo no encontrado.', flags: 64 });
    }

    const categoria = db.obtenerCategoriaPorId(equipo.categoria_id);
    const nombreCategoria = categoria ? `${categoria.nombre} — ${categoria.descripcion}` : 'Desconocida';

    const color = hexAInt(equipo.color_primario || '#00bfa6');
    const plantilla = db.obtenerPlantilla(equipo.id);
    const jugadores = (plantilla?.miembros || []).filter((m) => m.role === 'PLAYER');
    const listaJugadores = jugadores.length > 0
      ? jugadores.map((m) => m.haxball_nick ? `<@${m.discord_user_id}> \`${m.haxball_nick}\`` : `<@${m.discord_user_id}>`).join('\n')
      : 'Sin jugadores registrados';
    const dt = (plantilla?.miembros || []).find((m) => m.role === 'DT');
    const subdt = (plantilla?.miembros || []).find((m) => m.role === 'SUB_DT');

    const emojiStr = getTeamEmoji(interaction.guild, equipo.id);

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`Plantilla de ${emojiStr}${equipo.nombre}`);
      
    if (equipo.escudo) {
      embed.setThumbnail(equipo.escudo);
    }

    embed.addFields(
        { name: 'Abreviación', value: equipo.abreviacion || '—', inline: true },
        { name: 'Categoría', value: nombreCategoria, inline: true },
        { name: '\u200b', value: '\u200b', inline: true },
        { name: 'Director Técnico', value: dt ? `<@${dt.discord_user_id}>` : '—', inline: true },
        { name: 'Sub-Director Técnico', value: subdt ? `<@${subdt.discord_user_id}>` : '—', inline: true },
        { name: `Jugadores (${jugadores.length})`, value: listaJugadores }
      )
      .setTimestamp();

    await interaction.reply({ 
      content: equipo.role_id ? `<@&${equipo.role_id}>` : '', 
      embeds: [embed] 
    });
  }
};
