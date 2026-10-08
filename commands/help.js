const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle 
} = require('discord.js');
const { isAdmin } = require('../utils/permissions');

// Definir categorías y comandos
const CATEGORIES = {
  home: {
    emoji: '🏠',
    name: 'Inicio',
    description: 'Panel principal del sistema de ayuda'
  },
  general: {
    emoji: '🌟',
    name: 'General',
    description: 'Comandos generales disponibles para todos',
    commands: [
      { name: '/ping', description: 'Verifica el estado y latencia del bot' },
      { name: '/help', description: 'Muestra este panel de ayuda interactivo' },
      { name: '/cupos', description: 'Consulta los cupos disponibles por categoría' }
    ]
  },
  equipos: {
    emoji: '⚽',
    name: 'Equipos',
    description: 'Gestión de equipos y plantillas',
    commands: [
      { name: '/ver-equipos', description: 'Lista todos los equipos registrados en la liga' },
      { name: '/plantilla', description: 'Consulta la plantilla completa de un equipo' },
      { name: '/fichar', description: 'Envía una propuesta de fichaje a un jugador\n📍 Solo en canal de fichajes' },
      { name: '/dar-de-baja', description: 'Da de baja a un jugador de tu equipo\n📍 Solo en canal de bajas' },
      { name: '/renunciar', description: 'Renuncia voluntariamente a tu equipo actual\n📍 Solo en canal de bajas' },
      { name: '/asignar-nick', description: 'Cambia el nick de HaxBall de un miembro' },
      { name: '/asignar-subdt', description: 'Asigna el rol de Sub-Director Técnico' },
      { name: '/quitar-subdt', description: 'Quita el rol de Sub-Director Técnico' }
    ]
  },
  moderacion: {
    emoji: '🛡️',
    name: 'Moderación',
    description: 'Herramientas de moderación del servidor',
    adminOnly: true,
    commands: [
      { name: '/kick', description: 'Expulsa a un usuario del servidor' },
      { name: '/ban', description: 'Banea permanentemente a un usuario' },
      { name: '/desban', description: 'Retira el ban de un usuario usando su ID' },
      { name: '/mute', description: 'Silencia temporalmente a un usuario' },
      { name: '/desmute', description: 'Retira el silencio de un usuario' },
      { name: '/warn', description: 'Aplica una advertencia a un usuario' },
      { name: '/q-warn', description: 'Consulta las advertencias de un usuario' },
      { name: '/lock', description: 'Cierra el canal para usuarios normales' },
      { name: '/unlock', description: 'Desbloquea el canal' },
      { name: '/cls', description: 'Elimina mensajes del canal (1-100)' },
      { name: '/antiraid', description: 'Activa protección antiraid del servidor' },
      { name: '/q-antiraid', description: 'Desactiva el modo antiraid' }
    ]
  },
  administracion: {
    emoji: '⚙️',
    name: 'Administración',
    description: 'Comandos administrativos de la liga',
    adminOnly: true,
    commands: [
      { name: '/add-equipo', description: 'Registra un nuevo equipo directamente' },
      { name: '/asignar-categoria-equipos', description: 'Asigna categoría de canal para equipos de una división' },
      { name: '/edit-categorias', description: 'Gestiona las categorías de la liga' },
      { name: '/edit-equipo', description: 'Edita la información de un equipo' },
      { name: '/eliminate-equipo', description: 'Elimina permanentemente un equipo' },
      { name: '/inscribir-equipo', description: 'Gestiona solicitudes de inscripción\n📍 Solo en canal de inscripciones' },
      { name: '/tickets', description: 'Despliega el panel de tickets\n📍 Solo en canal de tickets' }
    ]
  },
  info: {
    emoji: 'ℹ️',
    name: 'Información',
    description: 'Acerca de Diamonds League',
    isInfo: true
  }
};

function createHomeEmbed() {
  return new EmbedBuilder()
    .setColor(0x1ABC9C)
    .setTitle('🤖 CENTRAL DE COMANDOS')
    .setDescription(
      '**Bienvenido al centro de ayuda de Diamonds League Bot**\n\n' +
      'Selecciona una categoría del menú desplegable para consultar los comandos disponibles y conocer cómo utilizarlos.\n\n' +
      '**Categorías Disponibles:**\n' +
      `${CATEGORIES.general.emoji} **${CATEGORIES.general.name}** — Comandos básicos\n` +
      `${CATEGORIES.equipos.emoji} **${CATEGORIES.equipos.name}** — Gestión de equipos\n` +
      `${CATEGORIES.moderacion.emoji} **${CATEGORIES.moderacion.name}** — Herramientas de moderación\n` +
      `${CATEGORIES.administracion.emoji} **${CATEGORIES.administracion.name}** — Panel administrativo\n` +
      `${CATEGORIES.info.emoji} **${CATEGORIES.info.name}** — Acerca del bot\n\n` +
      '> Usa el menú de abajo para navegar entre categorías'
    )
    .setFooter({ text: 'Diamonds League • Sistema de Ayuda Interactivo' })
    .setTimestamp();
}

function createCategoryEmbed(categoryKey, isAdminUser) {
  const category = CATEGORIES[categoryKey];
  
  if (!category) return createHomeEmbed();
  
  // Si es la categoría info
  if (category.isInfo) {
    return new EmbedBuilder()
      .setColor(0x40E0D0)
      .setTitle(`${category.emoji} ${category.name}`)
      .setDescription(
        '**Diamonds League Bot**\n\n' +
        'Sistema de gestión integral para ligas de HaxBall.\n\n' +
        '**Características:**\n' +
        '• Gestión completa de equipos y plantillas\n' +
        '• Sistema de fichajes con confirmación\n' +
        '• Moderación avanzada\n' +
        '• Sistema de tickets\n' +
        '• Sistema de advertencias\n' +
        '• Gestión de categorías\n\n' +
        '**Versión:** 2.0\n' +
        '**Desarrollado por:** <@1506006863290957937>'+
        '**Desarrolado para:** Diamonds League'
      )
      .setFooter({ text: 'Usa el menú para volver al inicio o explorar otras categorías' })
      .setTimestamp();
  }
  
  const embed = new EmbedBuilder()
    .setColor(categoryKey === 'general' ? 0x40E0D0 : 
              categoryKey === 'equipos' ? 0x0E7C86 : 
              categoryKey === 'moderacion' ? 0x13315C : 
              0x0A2342)
    .setTitle(`${category.emoji} ${category.name}`)
    .setDescription(category.description);

  // Agregar comandos
  if (category.commands && category.commands.length > 0) {
    let commandsList = '';
    
    for (const cmd of category.commands) {
      commandsList += `**${cmd.name}**\n${cmd.description}\n\n`;
    }
    
    embed.addFields({ 
      name: '📋 Comandos Disponibles', 
      value: commandsList.trim() 
    });
  }

  // Agregar nota de permisos si es necesario
  if (category.adminOnly) {
    embed.addFields({
      name: '🔐 Restricción de Acceso',
      value: 'Los comandos de esta categoría están restringidos exclusivamente a **administradores autorizados**.',
      inline: false
    });
    
    if (!isAdminUser) {
      embed.setFooter({ text: '⚠️ No tienes acceso a estos comandos' });
    }
  }

  if (!embed.data.footer) {
    embed.setFooter({ text: 'Usa el menú para navegar entre categorías' });
  }
  
  embed.setTimestamp();
  
  return embed;
}

function createSelectMenu(currentCategory = 'home') {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('help_category_select')
      .setPlaceholder('📚 Selecciona una categoría...')
      .addOptions([
        {
          label: 'Inicio',
          description: 'Volver al panel principal',
          value: 'home',
          emoji: '🏠',
          default: currentCategory === 'home'
        },
        {
          label: CATEGORIES.general.name,
          description: CATEGORIES.general.description,
          value: 'general',
          emoji: CATEGORIES.general.emoji,
          default: currentCategory === 'general'
        },
        {
          label: CATEGORIES.equipos.name,
          description: CATEGORIES.equipos.description,
          value: 'equipos',
          emoji: CATEGORIES.equipos.emoji,
          default: currentCategory === 'equipos'
        },
        {
          label: CATEGORIES.moderacion.name,
          description: CATEGORIES.moderacion.description,
          value: 'moderacion',
          emoji: CATEGORIES.moderacion.emoji,
          default: currentCategory === 'moderacion'
        },
        {
          label: CATEGORIES.administracion.name,
          description: CATEGORIES.administracion.description,
          value: 'administracion',
          emoji: CATEGORIES.administracion.emoji,
          default: currentCategory === 'administracion'
        },
        {
          label: CATEGORIES.info.name,
          description: CATEGORIES.info.description,
          value: 'info',
          emoji: CATEGORIES.info.emoji,
          default: currentCategory === 'info'
        }
      ])
  );
}

function createButtonRow(messageId, userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`help_close_${messageId}_${userId}`)
      .setLabel('Cerrar')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Secondary)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Muestra el panel de ayuda interactivo con todos los comandos disponibles'),

  async execute(interaction) {
    const isAdminUser = isAdmin(interaction.member);
    
    const embed = createHomeEmbed();
    const selectMenu = createSelectMenu('home');
    const buttons = createButtonRow(interaction.id, interaction.user.id);

    const response = await interaction.reply({
      embeds: [embed],
      components: [selectMenu, buttons],
      fetchReply: true
    });

    // Crear collector para el select menu
    const selectCollector = response.createMessageComponentCollector({
      filter: i => i.customId === 'help_category_select' && i.user.id === interaction.user.id,
      time: 300000 // 5 minutos
    });

    selectCollector.on('collect', async i => {
      const category = i.values[0];
      const embed = createCategoryEmbed(category, isAdminUser);
      const selectMenu = createSelectMenu(category);
      const buttons = createButtonRow(response.id, interaction.user.id);

      await i.update({
        embeds: [embed],
        components: [selectMenu, buttons]
      });
    });

    selectCollector.on('end', () => {
      // Deshabilitar componentes cuando expire el collector
      const disabledSelect = createSelectMenu();
      disabledSelect.components[0].setDisabled(true);
      
      const disabledButtons = createButtonRow(response.id, interaction.user.id);
      disabledButtons.components[0].setDisabled(true);

      interaction.editReply({
        components: [disabledSelect, disabledButtons]
      }).catch(() => {});
    });

    // Crear collector para el botón de cerrar
    const buttonCollector = response.createMessageComponentCollector({
      filter: i => i.customId.startsWith('help_close_') && i.user.id === interaction.user.id,
      time: 300000
    });

    buttonCollector.on('collect', async i => {
      await i.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0x607D8B)
            .setDescription('✅ Panel de ayuda cerrado.')
        ],
        components: []
      });
      
      selectCollector.stop();
      buttonCollector.stop();
    });
  }
};
