const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('🏓 Muestra la latencia del bot y de la API de Discord'),

  async execute(interaction) {
    await interaction.reply({
      content: '🏓 Calculando ping...',
    });
    const sent = await interaction.fetchReply();

    const roundTrip = sent.createdTimestamp - interaction.createdTimestamp;

    const apiPing = Math.round(interaction.client.ws.ping);

    let color;
    if (roundTrip < 100) color = 0x2ecc71;
    else if (roundTrip < 250) color = 0xf1c40f;
    else color = 0xe74c3c;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle('🏓  Pong!')
      .addFields(
        {
          name: '⏱️ Latencia Bot',
          value: `\`${roundTrip} ms\``,
          inline: true,
        },
        {
          name: '💡 API Discord',
          value: `\`${apiPing} ms\``,
          inline: true,
        }
      )
      .setFooter({ text: `Solicitado por ${interaction.user.username}` })
      .setTimestamp();

    await interaction.editReply({ content: '', embeds: [embed] });
  },
};
