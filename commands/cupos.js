const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/db');
const { getTeamEmoji } = require('../utils/emojiService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cupos')
    .setDescription('Muestra las categorías y los cupos disponibles en Diamonds League'),

  async execute(interaction) {
    const categorias = db.obtenerCategorias();

    if (!categorias.length) {
      const embed = new EmbedBuilder()
        .setColor(0x455a64)
        .setTitle('Diamonds League')
        .setDescription('No hay categorías registradas actualmente.');
      return interaction.reply({ embeds: [embed] });
    }

    let currentIndex = 0;

    const generateEmbed = (index) => {
      const cat = categorias[index];
      const equipos = db.obtenerEquiposPorCategoria(cat.id);
      const registrados = equipos.length;
      const disponibles = db.cuposDisponibles(cat);
      const llena = db.categoriaLlena(cat);

      let color;
      if (llena) color = 0xef5350; // Rojo
      else if (registrados === 0) color = 0x455a64; // Gris
      else color = 0x00bfa6; // Verde Diamonds

      const titulo = llena
        ? `${cat.nombre} — Sin cupos`
        : `${cat.nombre} — ${cat.descripcion}`;

      const barraTotal = 12;
      const barraLlena = registrados > 0 ? Math.max(1, Math.round((registrados / cat.max_equipos) * barraTotal)) : 0;
      const barra = '█'.repeat(barraLlena) + '░'.repeat(barraTotal - barraLlena);

      let listaEquipos = 'Sin equipos registrados';
      if (equipos.length) {
         listaEquipos = equipos.map(e => `${getTeamEmoji(interaction.guild, e.id)}**${e.nombre}** ${e.abreviacion ? `(${e.abreviacion})` : ''}`).join('\n');
      }

      const estadoCupos = llena ? `Sin cupos disponibles` : `${disponibles} cupo${disponibles !== 1 ? 's' : ''} disponible${disponibles !== 1 ? 's' : ''}`;

      return new EmbedBuilder()
        .setColor(color)
        .setTitle('Información de Categoría')
        .setDescription(`**${titulo}**\n\n\`${barra}\`  ${registrados}/${cat.max_equipos}\n\n**Equipos Registrados:**\n${listaEquipos}\n\n**Estado:** ${estadoCupos}`)
        .setFooter({ text: `Categoría ${index + 1} de ${categorias.length}` })
        .setTimestamp();
    };

    const generateButtons = (index) => {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('prev_cat')
          .setLabel('Atras')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(index === 0),
        new ButtonBuilder()
          .setCustomId('next_cat')
          .setLabel('Adelante')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(index === categorias.length - 1)
      );
    };

    await interaction.reply({
      embeds: [generateEmbed(currentIndex)],
      components: categorias.length > 1 ? [generateButtons(currentIndex)] : [],
    });
    const message = await interaction.fetchReply();

    if (categorias.length > 1) {
      const collector = message.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 300000
      });

      collector.on('collect', async i => {
        if (i.customId === 'prev_cat') currentIndex--;
        if (i.customId === 'next_cat') currentIndex++;

        await i.update({
          embeds: [generateEmbed(currentIndex)],
          components: [generateButtons(currentIndex)]
        });
      });

      collector.on('end', () => {
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('prev_cat').setLabel('Atras').setStyle(ButtonStyle.Primary).setDisabled(true),
          new ButtonBuilder().setCustomId('next_cat').setLabel('Adelante').setStyle(ButtonStyle.Primary).setDisabled(true)
        );
        interaction.editReply({ components: [disabledRow] }).catch(() => {});
      });
    }
  },
};
