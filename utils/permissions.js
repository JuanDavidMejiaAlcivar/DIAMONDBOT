/**
 * Sistema centralizado de permisos de administración
 * Todos los comandos administrativos deben usar este módulo
 */

// IDs de roles administrativos autorizados
const ADMIN_ROLE_IDS = [
  '1293931224217288805', // Fundadora・
  '1549907589960302623', // Fundador・
  '1361168022668054691', // Owners・
  '1369009698891763874', // Admin Pub・
  '1305269515109535867'  // Staff・
];

// IDs de canales permitidos para comandos específicos
const COMMAND_CHANNELS = {
  fichar: '1306414535728431134',
  renunciar: '1365456249071730718',
  darDeBaja: '1365456249071730718',
  inscribirEquipo: '1441427488034001016',
  tickets: '1333868767649726484'
};

// IDs de roles de staff que pueden escribir durante un lock
const STAFF_ROLE_IDS = [
  ...ADMIN_ROLE_IDS,
  process.env.DT_ROLE_ID,
  process.env.SUBDT_ROLE_ID
].filter(Boolean);

/**
 * Verifica si un miembro tiene permisos administrativos
 * @param {GuildMember} member - Miembro de Discord a verificar
 * @returns {boolean} true si tiene alguno de los roles administrativos
 */
function isAdmin(member) {
  if (!member || !member.roles || !member.roles.cache) {
    return false;
  }
  
  // Verificar si tiene algún rol administrativo
  return ADMIN_ROLE_IDS.some(roleId => member.roles.cache.has(roleId));
}

/**
 * Verifica si un miembro es staff (admin o roles autorizados)
 * @param {GuildMember} member - Miembro de Discord a verificar
 * @returns {boolean} true si tiene alguno de los roles de staff
 */
function isStaff(member) {
  if (!member || !member.roles || !member.roles.cache) {
    return false;
  }
  
  return STAFF_ROLE_IDS.some(roleId => member.roles.cache.has(roleId));
}

/**
 * Verifica si el comando se ejecuta en el canal correcto
 * @param {CommandInteraction} interaction - Interacción del comando
 * @param {string} expectedChannelId - ID del canal esperado
 * @param {string} commandName - Nombre del comando (para mensaje personalizado)
 * @returns {Object} { isCorrect: boolean, reply: Object|null }
 */
function checkChannel(interaction, expectedChannelId, commandName = 'este comando') {
  const { EmbedBuilder } = require('discord.js');
  
  if (interaction.channelId !== expectedChannelId) {
    return {
      isCorrect: false,
      reply: {
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle('❌ Canal Incorrecto')
            .setDescription(
              `El comando \`/${commandName}\` solamente puede utilizarse en el canal correspondiente.\n\n` +
              `Por favor, dirígete al canal indicado para realizar esta acción.`
            )
        ],
        ephemeral: true
      }
    };
  }
  
  return { isCorrect: true, reply: null };
}

/**
 * Verifica si un miembro puede moderar a otro
 * Comprueba jerarquía de roles
 * @param {GuildMember} moderator - Moderador
 * @param {GuildMember} target - Usuario objetivo
 * @returns {Object} { canModerate: boolean, reason: string }
 */
function canModerate(moderator, target) {
  // No se puede moderar a uno mismo
  if (moderator.id === target.id) {
    return { canModerate: false, reason: 'No puedes aplicar acciones de moderación sobre ti mismo.' };
  }
  
  // No se puede moderar al dueño del servidor
  if (target.id === target.guild.ownerId) {
    return { canModerate: false, reason: 'No puedes moderar al dueño del servidor.' };
  }
  
  // Verificar jerarquía de roles
  if (moderator.roles.highest.position <= target.roles.highest.position) {
    return { canModerate: false, reason: 'No puedes moderar a alguien con un rol igual o superior al tuyo.' };
  }
  
  return { canModerate: true };
}

/**
 * Verifica si el bot puede moderar a un usuario
 * @param {Guild} guild - Servidor
 * @param {GuildMember} target - Usuario objetivo
 * @returns {Object} { canModerate: boolean, reason: string }
 */
function botCanModerate(guild, target) {
  const botMember = guild.members.me;
  
  if (!botMember) {
    return { canModerate: false, reason: 'No se pudo verificar al bot en el servidor.' };
  }
  
  // No se puede moderar al dueño
  if (target.id === guild.ownerId) {
    return { canModerate: false, reason: 'El bot no puede moderar al dueño del servidor.' };
  }
  
  // Verificar jerarquía
  if (botMember.roles.highest.position <= target.roles.highest.position) {
    return { canModerate: false, reason: 'El bot no tiene jerarquía suficiente para moderar a este usuario.' };
  }
  
  return { canModerate: true };
}

/**
 * Embed de error de permisos insuficientes
 * @returns {Object} Configuración del embed
 */
function noPermissionEmbed() {
  const { EmbedBuilder } = require('discord.js');
  return new EmbedBuilder()
    .setColor(0xEF5350)
    .setTitle('❌ Acceso Denegado')
    .setDescription(
      'No tienes permisos para utilizar este comando.\n\n' +
      '> Este comando está reservado exclusivamente para **administradores autorizados**.'
    )
    .setTimestamp();
}

module.exports = {
  ADMIN_ROLE_IDS,
  STAFF_ROLE_IDS,
  COMMAND_CHANNELS,
  isAdmin,
  isStaff,
  checkChannel,
  canModerate,
  botCanModerate,
  noPermissionEmbed
};
