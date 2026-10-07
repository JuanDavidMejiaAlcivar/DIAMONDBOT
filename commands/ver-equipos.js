const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/db');
const { hexAInt } = require('../utils/teamService');
const { getTeamEmoji } = require('../utils/emojiService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ver-equipos')
    .setDescription('Muestra todos los equipos registrados divididos con botones para navegar'),

  async execute(interaction) {
    const equipos = db.obtenerEquipos();
    if (equipos.length === 0) {
      return interaction.reply({ content: 'No hay equipos registrados.', flags: 64 });
    }

    let currentIndex = 0;

    const generateEmbed = (index) => {
      const equipo = equipos[index];
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
        .setTitle(`${emojiStr}${equipo.nombre}`)
        .setDescription(`**Abreviación:** ${equipo.abreviacion || '—'}`);
        
      if (equipo.escudo) {
        embed.setThumbnail(equipo.escudo);
      }
      
      embed.addFields(
          { name: 'Categoría', value: nombreCategoria, inline: true },
          { name: 'Director Técnico', value: dt ? `<@${dt.discord_user_id}>` : '—', inline: true },
          { name: 'Sub-Director Técnico', value: subdt ? `<@${subdt.discord_user_id}>` : '—', inline: true },
          { name: `Jugadores (${jugadores.length})`, value: listaJugadores }
        )
        .setFooter({ text: `Equipo ${index + 1} de ${equipos.length}` })
        .setTimestamp();
        
      return embed;
    };

    const generateButtons = (index) => {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('prev_equipo')
          .setLabel('Atras')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(index === 0),
        new ButtonBuilder()
          .setCustomId('next_equipo')
          .setLabel('Adelante')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(index === equipos.length - 1)
      );
    };

    await interaction.reply({
      embeds: [generateEmbed(currentIndex)],
      components: equipos.length > 1 ? [generateButtons(currentIndex)] : [],
    });
    const message = await interaction.fetchReply();

    if (equipos.length > 1) {
      const collector = message.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 300000
      });

      collector.on('collect', async i => {
        if (i.customId === 'prev_equipo') currentIndex--;
        if (i.customId === 'next_equipo') currentIndex++;

        await i.update({
          embeds: [generateEmbed(currentIndex)],
          components: [generateButtons(currentIndex)]
        });
      });

      collector.on('end', () => {
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('prev_equipo').setLabel('Atras').setStyle(ButtonStyle.Primary).setDisabled(true),
          new ButtonBuilder().setCustomId('next_equipo').setLabel('Adelante').setStyle(ButtonStyle.Primary).setDisabled(true)
        );
        interaction.editReply({ components: [disabledRow] }).catch(() => {});
      });
    }
  }
};
