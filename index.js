/**
 * DiamondsBOT – Archivo principal
 *
 * Responsabilidades:
 *   1. Inicializar el cliente de Discord
 *   2. Cargar comandos slash
 *   3. Delegar interacciones a los handlers correspondientes
 *   4. Sistema antiraid (messageCreate)
 *   5. Detección de salida de miembros (guildMemberRemove)
 */

require('dotenv').config();

const {
  Client,
  Collection,
  GatewayIntentBits,
  EmbedBuilder,
  Partials,
} = require('discord.js');
const fs   = require('node:fs');
const path = require('node:path');

// ── Utilidades ────────────────────────────────────────────────────────────
const db     = require('./utils/db');
const logger = require('./utils/logger');
const { estaActivo, esSpam, tieneLinksSospechosos } = require('./utils/antiraid');
const { isStaff } = require('./utils/permissions');

// ── Handlers ──────────────────────────────────────────────────────────────
const { handleButton } = require('./handlers/buttonHandler');
const { handleModal }  = require('./handlers/modalHandler');
const { safeReply }    = require('./handlers/safeReply');

// ── Autoroles ─────────────────────────────────────────────────────────────
const autoroles = require('./utils/autorolesManager');

// ═══════════════════════════════════════════════════════════════════════════
// Cliente de Discord
// ═══════════════════════════════════════════════════════════════════════════

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions, // ← necesario para autoroles
  ],
  partials: [
    Partials.Message,   // reacciones en mensajes viejos (bot reiniciado)
    Partials.Channel,
    Partials.Reaction,
  ],
});

// ═══════════════════════════════════════════════════════════════════════════
// Carga de comandos slash
// ═══════════════════════════════════════════════════════════════════════════

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  try {
    const command = require(path.join(commandsPath, file));
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      console.log(`✅  Comando cargado: /${command.data.name}`);
    } else {
      console.warn(`⚠️  El archivo ${file} no exporta {data, execute}. Se ignorará.`);
    }
  } catch (err) {
    console.error(`❌  Error cargando comando ${file}:`, err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Manejo de interacciones
// ═══════════════════════════════════════════════════════════════════════════

client.on('interactionCreate', async (interaction) => {

  // ── Comandos slash ──────────────────────────────────────────────────────
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);

      // Log del comando (en segundo plano)
      logger.logCommand(client, interaction, interaction.commandName)
        .catch(err => console.error('[LOGGER] Error en log de comando:', err.message));
    } catch (error) {
      console.error(`Error ejecutando /${interaction.commandName}:`, error);

      // Log del error (en segundo plano)
      logger.logCommand(client, interaction, interaction.commandName, {
        error: error.message || 'Error desconocido',
      }).catch(err => console.error('[LOGGER] Error en log:', err.message));

      await safeReply(interaction, {
        content: '❌ Ocurrió un error al ejecutar este comando.',
        flags: 64,
      });
    }
    return;
  }

  // ── Autocomplete ────────────────────────────────────────────────────────
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (!command?.autocomplete) return;
    try {
      await command.autocomplete(interaction);
    } catch (err) {
      console.error(`Error en autocomplete /${interaction.commandName}:`, err.message);
    }
    return;
  }

  // ── Botones ─────────────────────────────────────────────────────────────
  if (interaction.isButton()) {
    return handleButton(interaction, client);
  }

  // ── Modals ──────────────────────────────────────────────────────────────
  if (interaction.isModalSubmit()) {
    return handleModal(interaction, client);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Detección de salida de miembros del servidor
// ═══════════════════════════════════════════════════════════════════════════

client.on('guildMemberRemove', async (member) => {
  try {
    const record = db.obtenerMiembro(member.id);
    if (!record || record.inconsistent) return;

    const team = db.obtenerEquipoPorId(record.team_id);
    if (!team) return;

    // Solo dar de baja a jugadores y Sub-DTs
    if (record.role !== 'PLAYER' && record.role !== 'SUB_DT') return;

    db.quitarMiembro(team.id, member.id, 'LEFT_SERVER', 'SYSTEM');

    await require('./utils/rosterCommands').notifyDirector(
      member.guild,
      team,
      `<@${member.id}> salió del servidor mientras pertenecía a **${team.nombre}**.\n\nEl jugador fue retirado de la plantilla y quedó como jugador libre.`,
      'aviso de salida del servidor al DT'
    );
  } catch (error) {
    console.error(`Error procesando salida del servidor de ${member.id}:`, error.message);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Bot listo
// ═══════════════════════════════════════════════════════════════════════════

client.once('clientReady', (c) => {
  console.log(`\n🚀  Bot conectado como: ${c.user.tag}`);
  console.log(`📡  Sirviendo en ${c.guilds.cache.size} servidor(es)\n`);
});

// ═══════════════════════════════════════════════════════════════════════════
// Sistema Antiraid – Protección automática contra spam
// ═══════════════════════════════════════════════════════════════════════════

client.on('messageCreate', async (message) => {
  // Ignorar mensajes del bot y DMs
  if (message.author.id === client.user.id) return;
  if (!message.guild) return;

  // Verificar si el antiraid está activo
  if (!estaActivo()) return;

  // El staff no es afectado
  if (isStaff(message.member)) return;

  // Bloquear todos los bots durante antiraid
  if (message.author.bot) {
    try {
      await message.delete();
      console.log(`[ANTIRAID] Mensaje de bot bloqueado: ${message.author.tag}`);
    } catch (error) {
      console.error('[ANTIRAID] Error eliminando mensaje de bot:', error.message);
    }
    return;
  }

  // Detectar spam
  if (esSpam(message.content)) {
    await _handleAntiraidAction(message, 'Spam detectado durante modo antiraid', '🚨 Usuario Expulsado por Spam', '⚠️ Spam Detectado');
    return;
  }

  // Detectar links sospechosos
  if (tieneLinksSospechosos(message.content)) {
    await _handleAntiraidAction(message, 'Link sospechoso/malicioso detectado durante modo antiraid', '🚨 Usuario Expulsado por Link Malicioso', '⚠️ Link Sospechoso Detectado');
    return;
  }
});

/**
 * Acción centralizada del antiraid: eliminar mensaje, kick, y notificar.
 */
async function _handleAntiraidAction(message, kickReason, expelTitle, warnTitle) {
  try {
    await message.delete();

    try {
      await message.member.kick(kickReason);

      const embed = new EmbedBuilder()
        .setColor(0xEF5350)
        .setTitle(expelTitle)
        .setDescription(
          `**${message.author.tag}** fue expulsado automáticamente.\n\n` +
          `**Canal:** ${message.channel}\n` +
          `**Razón:** ${kickReason}`
        )
        .setTimestamp();

      await message.channel.send({ embeds: [embed] });
      console.log(`[ANTIRAID] Usuario expulsado: ${message.author.tag} — ${kickReason}`);
    } catch (kickError) {
      console.error('[ANTIRAID] No se pudo expulsar:', kickError.message);

      const warnEmbed = new EmbedBuilder()
        .setColor(0xF39C12)
        .setTitle(warnTitle)
        .setDescription(
          `Mensaje eliminado de ${message.author}.\n\n` +
          `Staff: revisar y tomar acción si es necesario.`
        )
        .setTimestamp();

      await message.channel.send({ embeds: [warnEmbed] }).catch(() => {});
    }
  } catch (error) {
    console.error('[ANTIRAID] Error procesando acción:', error.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Sistema de Autoroles – Asignación y retirada de roles por reacción
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Manejo centralizado de reacciones para autoroles.
 * @param {import('discord.js').MessageReaction} reaction
 * @param {import('discord.js').User} user
 * @param {'add'|'remove'} action
 */
async function _handleAutorolReaction(reaction, user, action) {
  if (user.bot) return;

  // Resolver partials (mensaje viejo / bot reiniciado)
  try {
    if (reaction.partial)         await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();
  } catch (err) {
    console.error('[AUTOROLES] Error resolviendo partial:', err.message);
    return;
  }

  const config = autoroles.obtenerAutorolesPorMensaje(reaction.message.id);
  if (!config) return;

  const entry = autoroles.encontrarEntradaPorEmoji(config, reaction);
  if (!entry) return;

  try {
    const guild  = reaction.message.guild;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    if (action === 'add') {
      await member.roles.add(entry.role_id);
      console.log(`[AUTOROLES] Rol <@&${entry.role_id}> asignado a ${user.tag}`);
    } else {
      await member.roles.remove(entry.role_id);
      console.log(`[AUTOROLES] Rol <@&${entry.role_id}> retirado de ${user.tag}`);
    }
  } catch (err) {
    console.error(`[AUTOROLES] Error al ${action === 'add' ? 'asignar' : 'retirar'} rol:`, err.message);
  }
}

client.on('messageReactionAdd', (reaction, user) =>
  _handleAutorolReaction(reaction, user, 'add')
);

client.on('messageReactionRemove', (reaction, user) =>
  _handleAutorolReaction(reaction, user, 'remove')
);

// ═══════════════════════════════════════════════════════════════════════════
// Login
// ═══════════════════════════════════════════════════════════════════════════

client.login(process.env.TOKEN);
