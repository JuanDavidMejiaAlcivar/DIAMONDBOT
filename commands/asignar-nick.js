const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');
const { db, getOperator, card } = require('../utils/rosterCommands');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('asignar-nick')
    .setDescription('Asigna o cambia el nick de HaxBall de un jugador de tu equipo')
    .addUserOption(opt =>
      opt.setName('jugador')
        .setDescription('Jugador al que se le asignará el nick')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('nick_haxball')
        .setDescription('Nick del jugador en HaxBall')
        .setRequired(true)
        .setMaxLength(50)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    // Verificar que quien ejecuta el comando es DT o Sub-DT
    const operator = getOperator(interaction, true);
    if (operator.error) {
      return interaction.editReply({
        embeds: [card('Sin permisos', operator.error, [], 0xef5350)]
      });
    }

    const { team_id, role } = operator;
    const team = db.obtenerEquipoPorId(team_id);

    if (!team) {
      return interaction.editReply({
        embeds: [card('Error', 'No se pudo encontrar tu equipo en el sistema.', [], 0xef5350)]
      });
    }

    // Obtener jugador objetivo
    const targetUser = interaction.options.getUser('jugador');
    const newNick = interaction.options.getString('nick_haxball').trim();

    if (targetUser.bot) {
      return interaction.editReply({
        embeds: [card('Usuario inválido', 'No puedes asignar un nick a un bot.', [], 0xef5350)]
      });
    }

    if (targetUser.id === interaction.user.id) {
      return interaction.editReply({
        embeds: [card(
          'Acción no permitida',
          'No puedes asignarte un nick a ti mismo. Solicita a otro miembro del cuerpo técnico que lo haga.',
          [],
          0xffa726
        )]
      });
    }

    // Verificar que el jugador pertenece al equipo
    const targetRecord = db.obtenerMiembro(targetUser.id);
    
    if (!targetRecord || targetRecord.inconsistent) {
      return interaction.editReply({
        embeds: [card(
          'Jugador no encontrado',
          `**${targetUser.username}** no está registrado en ningún equipo del sistema.`,
          [],
          0xef5350
        )]
      });
    }

    if (targetRecord.team_id !== team_id) {
      const otherTeam = db.obtenerEquipoPorId(targetRecord.team_id);
      return interaction.editReply({
        embeds: [card(
          'Jugador de otro equipo',
          `**${targetUser.username}** pertenece a **${otherTeam?.nombre || 'otro equipo'}**, no a tu equipo.`,
          [],
          0xef5350
        )]
      });
    }

    // Guardar el nick anterior para mostrar en el mensaje
    const oldNick = targetRecord.haxball_nick || 'Sin nick asignado';

    // Actualizar el nick en la base de datos
    try {
      // Usar registrarMiembro para actualizar el nick manteniendo el rol
      db.registrarMiembro(team_id, targetUser.id, targetRecord.role, newNick, null);
    } catch (error) {
      console.error('Error asignando nick:', error);
      return interaction.editReply({
        embeds: [card(
          'Error',
          'No se pudo asignar el nick. Intenta nuevamente o contacta a un administrador.',
          [],
          0xef5350
        )]
      });
    }

    // Intentar actualizar el nickname de Discord con el formato: ABREVIACION | nick
    const discordNick = `${team.abreviacion || team.nombre.substring(0, 10)} | ${newNick}`.substring(0, 32);
    
    try {
      const member = await interaction.guild.members.fetch(targetUser.id);
      await member.setNickname(discordNick, `Nick de HaxBall asignado por ${interaction.user.tag}`);
    } catch (error) {
      console.warn(`No se pudo cambiar el nickname de Discord de ${targetUser.id}:`, error.message);
      // No es crítico, continuamos
    }

    // Embed de confirmación
    const teamColor = team.color_primario?.startsWith('#') 
      ? parseInt(team.color_primario.replace('#', ''), 16) 
      : 0x00bfa6;

    const successEmbed = new EmbedBuilder()
      .setColor(teamColor)
      .setTitle('✅ Nick de HaxBall asignado')
      .setDescription(`El nick de **${targetUser.username}** ha sido actualizado correctamente.`)
      .addFields(
        { name: '👤 Jugador', value: `<@${targetUser.id}>`, inline: true },
        { name: '🎮 Nick anterior', value: `\`${oldNick}\``, inline: true },
        { name: '🎮 Nick nuevo', value: `\`${newNick}\``, inline: true },
        { name: '🛡️ Equipo', value: team.nombre, inline: true },
        { name: '📋 Formato Discord', value: `\`${discordNick}\``, inline: true },
        { name: '👔 Asignado por', value: `<@${interaction.user.id}> (${role === 'DT' ? 'Director Técnico' : 'Sub-Director Técnico'})`, inline: false }
      )
      .setTimestamp();

    if (team.escudo) {
      successEmbed.setThumbnail(team.escudo);
    }

    await interaction.editReply({ embeds: [successEmbed] });

    // Notificar al jugador por DM
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(teamColor)
        .setTitle('🎮 Nick de HaxBall actualizado')
        .setDescription(
          `Tu nick de HaxBall en **${team.nombre}** ha sido actualizado.\n\n` +
          `**Nick anterior:** \`${oldNick}\`\n` +
          `**Nick nuevo:** \`${newNick}\`\n\n` +
          `Tu nickname de Discord también fue actualizado a: \`${discordNick}\``
        )
        .setFooter({ text: `Asignado por ${interaction.user.tag}` })
        .setTimestamp();

      if (team.escudo) dmEmbed.setThumbnail(team.escudo);

      await targetUser.send({ embeds: [dmEmbed] });
    } catch (error) {
      console.warn(`No se pudo enviar DM a ${targetUser.id}:`, error.message);
      // No es crítico
    }
  },
};
