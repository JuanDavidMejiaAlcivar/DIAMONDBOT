const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const { isAdmin, noPermissionEmbed } = require('../utils/permissions');
const db = require('../utils/db');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('asignar-categoria-equipos')
    .setDescription('Asigna la categoría de canal donde se crearán los equipos de una división')
    .addStringOption(option =>
      option
        .setName('division')
        .setDescription('Nombre de la división/categoría de la liga')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addChannelOption(option =>
      option
        .setName('categoria')
        .setDescription('Categoría de canal donde se crearán los equipos de esta división')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildCategory)
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const categorias = db.obtenerCategorias();
    
    const filtered = categorias
      .filter(cat => cat.nombre.toLowerCase().includes(focusedValue))
      .slice(0, 25)
      .map(cat => ({
        name: `${cat.nombre} (${cat.cupos_totales} cupos)`,
        value: cat.id
      }));

    await interaction.respond(filtered);
  },

  async execute(interaction) {
    // Verificar permisos administrativos
    if (!isAdmin(interaction.member)) {
      return interaction.reply({
        embeds: [noPermissionEmbed()],
        ephemeral: true
      });
    }

    const divisionId = interaction.options.getString('division');
    const categoriaCanal = interaction.options.getChannel('categoria');

    // Verificar que la división existe
    const division = db.obtenerCategoriaPorId(divisionId);
    if (!division) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle('❌ División No Encontrada')
            .setDescription('La división especificada no existe en el sistema.')
        ],
        ephemeral: true
      });
    }

    // Verificar que es una categoría
    if (categoriaCanal.type !== ChannelType.GuildCategory) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle('❌ Canal Inválido')
            .setDescription('Debes seleccionar una **categoría de canal**, no un canal normal.')
        ],
        ephemeral: true
      });
    }

    await interaction.deferReply();

    try {
      // Actualizar la categoría en la base de datos
      const categoriaActual = division.category_channel_id;
      
      const resultado = db.editarCategoria(divisionId, {
        category_channel_id: categoriaCanal.id
      });

      if (!resultado.ok) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xEF5350)
              .setTitle('❌ Error')
              .setDescription(resultado.error)
          ]
        });
      }

      // Log de la asignación
      logger.logCategory(
        interaction.client,
        interaction.user,
        'assign_channel',
        division.nombre,
        {
          categoria_anterior: categoriaActual || 'Sin categoría',
          categoria_nueva: categoriaCanal.name,
          categoria_id: categoriaCanal.id
        }
      ).catch(err => console.error('[LOGGER] Error en log:', err));

      // Embed de confirmación
      const successEmbed = new EmbedBuilder()
        .setColor(0x00BFA6)
        .setTitle('✅ Categoría de Canal Asignada')
        .setDescription(
          `La categoría de canal para los equipos de **${division.nombre}** ha sido configurada exitosamente.`
        )
        .addFields(
          {
            name: '🏆 División',
            value: division.nombre,
            inline: true
          },
          {
            name: '📂 Categoría de Canal',
            value: `${categoriaCanal.name}\n\`${categoriaCanal.id}\``,
            inline: true
          },
          {
            name: '📊 Estado',
            value: `${division.equipos?.length || 0}/${division.cupos_totales} equipos`,
            inline: true
          }
        )
        .addFields({
          name: '📝 ¿Qué significa esto?',
          value: 
            '> Cuando se cree un equipo para esta división usando `/add-equipo`, ' +
            'su canal privado se creará automáticamente dentro de la categoría especificada.\n\n' +
            '> Esto mantiene organizados los canales por división/categoría.'
        })
        .setFooter({ text: `Configurado por ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [successEmbed] });

    } catch (error) {
      console.error('Error asignando categoría de equipos:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor(0xEF5350)
        .setTitle('❌ Error')
        .setDescription(
          'Ocurrió un error al asignar la categoría de canal.\n\n' +
          `**Detalles:** ${error.message}`
        );

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};
