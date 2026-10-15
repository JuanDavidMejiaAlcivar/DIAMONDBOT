const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { isAdmin } = require('../utils/permissions');

// ─── Canales y configuración ──────────────────────────────────────────────────
const CANAL_FICHAJES   = '<#1306414535728431134>';
const CANAL_BAJAS      = '<#1365456249071730718>';
const CANAL_INSCRIPCION = '<#1441427488034001016>';
const CANAL_TICKETS    = '<#1333868767649726484>';

// ─── Todos los embeds del mensaje de bienvenida ───────────────────────────────

function embed_portada() {
  return new EmbedBuilder()
    .setColor(0x00BFA6)
    .setTitle('💎 BIENVENIDOS A DIAMONDS LEAGUE')
    .setDescription(
      '> *La liga competitiva de HaxBall mas cabrona.*\n\n' +
      '¡Hola a todos! Este mensaje explica **todo lo que necesitas saber** sobre cómo funciona el servidor, el bot, los equipos y la liga. ' +
      'Léelo con calma — te ahorrará muchas dudas más adelante.\n\n' +
      '**¿Qué es Diamonds League?**\n' +
      'Es una liga de HaxBall organizada con un sistema completo de equipos, fichajes, plantillas y moderación. ' +
      'Todo se gestiona a través de este bot, que automatiza los procesos para que la experiencia sea lo más profesional posible.\n\n' +
      '**¿Cómo participo?**\n' +
      '• Si quieres unirte a un equipo → espera una propuesta de fichaje de un Director Técnico\n' +
      '• Si quieres traer tu equipo → inscríbelo en ' + CANAL_INSCRIPCION + '\n' +
      '• Si tienes dudas → abre un ticket en ' + CANAL_TICKETS
    )
    .setImage('https://media.discordapp.net/attachments/1306414535728431134/banner_diamonds.png')
    .setFooter({ text: 'Diamonds League • Sistema completo de gestión' })
    .setTimestamp();
}

function embed_sistema_equipos() {
  return new EmbedBuilder()
    .setColor(0x0E7C86)
    .setTitle('⚽ SISTEMA DE EQUIPOS Y CATEGORÍAS')
    .setDescription(
      'La liga está organizada en **categorías** (divisiones). Cada categoría tiene un número limitado de cupos para equipos.\n\n' +
      '**¿Cómo están organizados los equipos?**\n' +
      'Cada equipo tiene:\n' +
      '• Un **Director Técnico (DT)** — máxima autoridad del equipo\n' +
      '• Un **Sub-Director Técnico (Sub-DT)** — puede gestionar el equipo junto al DT\n' +
      '• Una **plantilla de jugadores** con sus nicks de HaxBall\n' +
      '• Un **rol exclusivo** de Discord para el equipo\n' +
      '• Un **canal privado** solo para miembros del equipo\n' +
      '• Un **emoji personalizado** del equipo'
    )
    .addFields(
      {
        name: '📋 /ver-equipos',
        value: 'Muestra **todos los equipos registrados** en la liga con su categoría, color y estado actual. Perfecto para ver quiénes están participando.',
        inline: false
      },
      {
        name: '🏟️ /plantilla [equipo]',
        value: 'Muestra la **plantilla completa** de cualquier equipo: DT, Sub-DT y todos los jugadores con sus nicks de HaxBall.',
        inline: false
      },
      {
        name: '📊 /cupos',
        value: 'Muestra los **cupos disponibles** en cada categoría de la liga. Útil para saber en qué divisiones aún hay espacio para nuevos equipos.',
        inline: false
      }
    )
    .setFooter({ text: '⚙️ Los datos de equipos y plantillas se actualizan en tiempo real' });
}

function embed_inscripciones() {
  return new EmbedBuilder()
    .setColor(0x1ABC9C)
    .setTitle('📝 CÓMO INSCRIBIR TU EQUIPO')
    .setDescription(
      '¿Tienes un equipo y quieres participar en la liga? El proceso es el siguiente:\n\n' +
      '**Paso 1 — Verifica los cupos**\n' +
      'Usa `/cupos` para asegurarte de que la categoría que quieres tiene espacio.\n\n' +
      '**Paso 2 — Envía la solicitud**\n' +
      'Ve al canal ' + CANAL_INSCRIPCION + ' y usa el comando `/inscribir-equipo`. Deberás proporcionar:\n' +
      '• Nombre del equipo y abreviación (ej: "Diamonds FC" → "DFC")\n' +
      '• Color principal del equipo (en formato hexadecimal, ej: `#00BFA6`)\n' +
      '• URL del escudo del equipo (imagen)\n' +
      '• Categoría en la que quieres inscribirte\n' +
      '• Lista de jugadores con sus nicks de HaxBall\n' +
      '• Director Técnico y Sub-DT (opcional)\n\n' +
      '**Paso 3 — Revisión por el Staff**\n' +
      'Tu solicitud llega al staff para revisión. Si todo está en orden, la **aprobarán** y el bot creará automáticamente:\n' +
      '✅ El rol del equipo\n' +
      '✅ El canal privado del equipo\n' +
      '✅ Los permisos correspondientes\n' +
      '✅ El emoji del equipo\n' +
      '✅ La plantilla en la base de datos\n\n' +
      '**Paso 4 — ¡A jugar!**\n' +
      'Una vez aprobado, el DT ya puede gestionar el equipo con todos los comandos disponibles.'
    )
    .addFields({
      name: '⚠️ Importante',
      value: 'Cada jugador solo puede pertenecer a **un equipo a la vez**. Si ya tienes equipo, deberás renunciar antes de unirte a otro.',
      inline: false
    })
    .setFooter({ text: '📍 Inscripciones solo en ' + CANAL_INSCRIPCION.replace('<', '').replace('>', '') });
}

function embed_fichajes() {
  return new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle('🤝 SISTEMA DE FICHAJES — CÓMO FICHAR JUGADORES')
    .setDescription(
      'El sistema de fichajes permite a los **Directores Técnicos** y **Sub-DTs** invitar jugadores a su equipo de forma oficial. Así funciona:\n\n' +
      '**¿Quién puede fichar?**\n' +
      '• El **Director Técnico (DT)** del equipo\n' +
      '• El **Sub-Director Técnico (Sub-DT)** del equipo\n\n' +
      '**¿A quién se puede fichar?**\n' +
      '• Solo a jugadores que sean **agentes libres** (sin equipo actualmente)\n' +
      '• El jugador debe estar en el servidor de Discord'
    )
    .addFields(
      {
        name: '📤 Paso 1 — Enviar propuesta: /fichar',
        value: 'El DT o Sub-DT va al canal ' + CANAL_FICHAJES + ' y usa `/fichar`. Debe indicar:\n' +
               '• `jugador` — La mención al usuario de Discord\n' +
               '• `nick_haxball` — El nick que usará en HaxBall\n\n' +
               'El bot enviará una **propuesta por DM** al jugador.',
        inline: false
      },
      {
        name: '📥 Paso 2 — El jugador decide',
        value: 'El jugador recibe un mensaje directo (DM) del bot con dos botones:\n' +
               '✅ **Aceptar** → Se une automáticamente al equipo\n' +
               '❌ **Rechazar** → Declina la oferta\n\n' +
               'Si acepta, el bot automáticamente:\n' +
               '• Le asigna el rol del equipo\n' +
               '• Lo registra en la plantilla\n' +
               '• Actualiza su apodo en Discord al formato `ABR | Nick`\n' +
               '• Notifica al DT que el fichaje fue aceptado',
        inline: false
      },
      {
        name: '🚫 ¿Qué impide un fichaje?',
        value: '• El jugador ya tiene equipo\n' +
               '• El jugador rechazó la propuesta\n' +
               '• El DT que envió la propuesta ya no tiene cargo\n' +
               '• La propuesta expiró o fue cancelada',
        inline: false
      }
    )
    .setFooter({ text: '📍 Fichajes solo en ' + CANAL_FICHAJES.replace('<', '').replace('>', '') });
}

function embed_bajas() {
  return new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle('🚪 BAJAS Y RENUNCIAS — SALIR DE UN EQUIPO')
    .setDescription(
      'Hay dos formas de salir de un equipo: **renuncia voluntaria** o **dar de baja** por parte del cuerpo técnico.\n\n' +
      '**⚠️ Ambas acciones son permanentes.** Una vez completadas, el jugador queda como agente libre.'
    )
    .addFields(
      {
        name: '👋 /renunciar — Salida voluntaria',
        value: 'Cualquier **jugador** puede renunciar a su equipo desde el canal ' + CANAL_BAJAS + '.\n\n' +
               'El bot pedirá confirmación. Si confirmas:\n' +
               '• Se te retira el rol del equipo\n' +
               '• Tu apodo vuelve a tu nombre de Discord\n' +
               '• Se notifica al DT\n' +
               '• Quedas como **agente libre** inmediatamente',
        inline: false
      },
      {
        name: '🔴 /dar-de-baja [jugador] — Baja por el DT',
        value: 'El **DT o Sub-DT** puede dar de baja a cualquier jugador de su equipo desde ' + CANAL_BAJAS + '.\n\n' +
               'Deberá indicar el motivo de la baja. El bot:\n' +
               '• Retira el rol del equipo al jugador\n' +
               '• Notifica al jugador por DM\n' +
               '• Registra la baja en el historial',
        inline: false
      },
      {
        name: '🔧 /asignar-nick [jugador] [nick]',
        value: 'El DT o Sub-DT puede **cambiar el nick de HaxBall** de cualquier jugador de su equipo. Actualiza tanto la base de datos como el apodo de Discord.',
        inline: false
      }
    )
    .setFooter({ text: '📍 Bajas y renuncias solo en ' + CANAL_BAJAS.replace('<', '').replace('>', '') });
}

function embed_cuerpo_tecnico() {
  return new EmbedBuilder()
    .setColor(0xF39C12)
    .setTitle('👔 CUERPO TÉCNICO — DT Y SUB-DT')
    .setDescription(
      'El cuerpo técnico de cada equipo tiene poderes especiales para gestionar la plantilla. Así funciona la jerarquía:'
    )
    .addFields(
      {
        name: '🏆 Director Técnico (DT)',
        value: '• Máxima autoridad del equipo\n' +
               '• Puede fichar jugadores\n' +
               '• Puede dar de baja jugadores\n' +
               '• Puede asignar y quitar el Sub-DT\n' +
               '• Puede cambiar nicks de HaxBall\n' +
               '• Recibe notificaciones de renuncias y salidas del servidor',
        inline: false
      },
      {
        name: '🥈 Sub-Director Técnico (Sub-DT)',
        value: '• Asistente del DT\n' +
               '• Puede fichar jugadores\n' +
               '• Puede dar de baja jugadores\n' +
               '• Puede cambiar nicks de HaxBall\n' +
               '• **No puede** asignar o quitar el Sub-DT',
        inline: false
      },
      {
        name: '⚙️ /asignar-subdt [usuario]',
        value: 'El **DT** asigna a un miembro de su equipo como Sub-DT. Solo puede haber un Sub-DT por equipo.',
        inline: true
      },
      {
        name: '⚙️ /quitar-subdt',
        value: 'El **DT** retira el cargo de Sub-DT a quien lo tenga actualmente.',
        inline: true
      }
    )
    .setFooter({ text: 'Los cargos técnicos se asignan automáticamente al aprobar la inscripción' });
}

function embed_tickets() {
  return new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('🎫 SISTEMA DE TICKETS — SOPORTE Y ATENCIÓN')
    .setDescription(
      'El sistema de tickets es la forma oficial de comunicarse con el staff para asuntos que requieren atención personalizada.\n\n' +
      '**¿Dónde abro un ticket?**\n' +
      'Ve al canal ' + CANAL_TICKETS + ' y haz clic en el botón del tipo de ticket que necesitas.'
    )
    .addFields(
      {
        name: '🤝 Partner',
        value: 'Para propuestas de alianza o colaboración con el servidor.',
        inline: true
      },
      {
        name: '💭 Duda / Sugerencia',
        value: 'Para preguntas generales o ideas para mejorar la liga.',
        inline: true
      },
      {
        name: '📋 Postulación',
        value: 'Para postularte como miembro del equipo de staff.',
        inline: true
      },
      {
        name: '⚖️ Apelación',
        value: 'Para apelar una sanción (ban, mute, warn) que consideres injusta.',
        inline: true
      },
      {
        name: '📢 Reporte',
        value: 'Para reportar un problema, una conducta inapropiada o un bug.',
        inline: true
      },
      {
        name: '🛒 Compra',
        value: 'Para gestionar una compra en la tienda del servidor.',
        inline: true
      },
      {
        name: '🔄 ¿Cómo funciona un ticket?',
        value: '1. Haces clic en el botón → Se crea un canal privado tuyo y del staff\n' +
               '2. El staff lo **reclama** y te atiende\n' +
               '3. Cuando se resuelve, el ticket se **cierra** y el canal se elimina\n' +
               '4. Recibes un DM con el resumen del cierre',
        inline: false
      }
    )
    .setFooter({ text: 'Solo puedes tener un ticket abierto a la vez' });
}

function embed_moderacion() {
  return new EmbedBuilder()
    .setColor(0x2C3E50)
    .setTitle('🛡️ MODERACIÓN — NORMAS Y SANCIONES')
    .setDescription(
      'El servidor cuenta con un sistema completo de moderación. El staff dispone de los siguientes herramientas:\n\n' +
      '**¿Qué puede hacer el staff?**'
    )
    .addFields(
      {
        name: '⚠️ /warn [usuario] [razón]',
        value: 'Aplica una **advertencia formal** al usuario. Las advertencias quedan registradas en el sistema.',
        inline: false
      },
      {
        name: '🔇 /mute [usuario] [duración] [razón]',
        value: 'Silencia temporalmente al usuario. No podrá escribir ni hablar por el tiempo indicado.',
        inline: false
      },
      {
        name: '👢 /kick [usuario] [razón]',
        value: 'Expulsa al usuario del servidor. Puede volver si tiene enlace de invitación.',
        inline: false
      },
      {
        name: '🔨 /ban [usuario] [razón]',
        value: 'Banea permanentemente al usuario. Solo el staff puede desbanear con `/desban`.',
        inline: false
      },
      {
        name: '🧹 /cls [cantidad]',
        value: 'Elimina entre 1 y 100 mensajes del canal actual de forma masiva.',
        inline: false
      },
      {
        name: '🔒 /lock / /unlock',
        value: 'Cierra o abre el canal para que los usuarios normales no puedan escribir.',
        inline: false
      },
      {
        name: '🚨 Sistema Antiraid',
        value: 'El bot incluye protección antiraid automática:\n' +
               '• `/antiraid` — Activa el modo antiraid (bloquea bots y detecta spam/links maliciosos)\n' +
               '• `/q-antiraid` — Desactiva el modo antiraid\n\n' +
               'En modo antiraid, cualquier mensaje de bot o con spam/links sospechosos provoca la **expulsión automática** del usuario.',
        inline: false
      }
    )
    .setFooter({ text: 'Puedes apelar cualquier sanción abriendo un ticket de Apelación' });
}

function embed_reglas_liga() {
  return new EmbedBuilder()
    .setColor(0xE67E22)
    .setTitle('📜 REGLAS GENERALES DE LA LIGA')
    .setDescription(
      'Para mantener una competencia justa y un ambiente sano, se aplican las siguientes reglas:'
    )
    .addFields(
      {
        name: '1️⃣ Lealtad de equipo',
        value: 'Un jugador solo puede pertenecer a **un equipo a la vez**. No se permiten dobles registros.',
        inline: false
      },
      {
        name: '2️⃣ Responsabilidad del DT',
        value: 'El Director Técnico es responsable del comportamiento de su equipo dentro y fuera del campo.',
        inline: false
      },
      {
        name: '3️⃣ Nicks oficiales',
        value: 'En los partidos oficiales, cada jugador **debe** usar exactamente el nick de HaxBall registrado en el sistema. De lo contrario, el partido puede ser invalidado.',
        inline: false
      },
      {
        name: '4️⃣ Respeto mutuo',
        value: 'El irrespeto, insultos o toxicidad dentro del servidor puede resultar en sanciones (warn, mute, ban) y penalizaciones para el equipo.',
        inline: false
      },
      {
        name: '5️⃣ Uso correcto de los canales',
        value: 'Cada acción tiene su canal correspondiente:\n' +
               '• Fichajes → ' + CANAL_FICHAJES + '\n' +
               '• Bajas y renuncias → ' + CANAL_BAJAS + '\n' +
               '• Inscripciones → ' + CANAL_INSCRIPCION + '\n' +
               '• Soporte → ' + CANAL_TICKETS,
        inline: false
      },
      {
        name: '6️⃣ Inscripciones y cupos',
        value: 'Los cupos por categoría son limitados. El staff se reserva el derecho de rechazar inscripciones que no cumplan con los requisitos o cuya presentación sea incompleta.',
        inline: false
      }
    )
    .setFooter({ text: 'El desconocimiento de las reglas no exime de su cumplimiento' });
}

function embed_resumen_comandos() {
  return new EmbedBuilder()
    .setColor(0x00BFA6)
    .setTitle('📋 RESUMEN RÁPIDO DE COMANDOS')
    .setDescription('Aquí tienes una referencia rápida de todos los comandos según quién puede usarlos:')
    .addFields(
      {
        name: '👥 Todos los usuarios',
        value:
          '`/ping` — Estado del bot\n' +
          '`/help` — Panel de ayuda interactivo\n' +
          '`/ver-equipos` — Lista de equipos\n' +
          '`/plantilla` — Plantilla de un equipo\n' +
          '`/cupos` — Cupos disponibles por categoría\n' +
          '`/renunciar` — Renunciar a tu equipo (' + CANAL_BAJAS + ')\n' +
          '`/inscribir-equipo` — Inscribir equipo (' + CANAL_INSCRIPCION + ')',
        inline: false
      },
      {
        name: '👔 DT y Sub-DT de equipo',
        value:
          '`/fichar` — Proponer fichaje a un jugador (' + CANAL_FICHAJES + ')\n' +
          '`/dar-de-baja` — Dar de baja a un jugador (' + CANAL_BAJAS + ')\n' +
          '`/asignar-nick` — Cambiar nick HaxBall de un miembro\n' +
          '`/asignar-subdt` — Asignar Sub-DT *(solo DT)*\n' +
          '`/quitar-subdt` — Quitar Sub-DT *(solo DT)*',
        inline: false
      },
      {
        name: '🛡️ Staff / Administradores',
        value:
          '`/kick` `/ban` `/desban` `/mute` `/desmute` — Moderación\n' +
          '`/warn` `/q-warn` — Advertencias\n' +
          '`/lock` `/unlock` `/cls` — Control de canales\n' +
          '`/antiraid` `/q-antiraid` — Protección antiraid\n' +
          '`/add-equipo` — Añadir equipo manual\n' +
          '`/edit-equipo` — Editar equipo\n' +
          '`/eliminate-equipo` — Eliminar equipo\n' +
          '`/edit-categorias` — Gestionar categorías\n' +
          '`/asignar-categoria-equipos` — Asignar categoría de canal\n' +
          '`/tickets` — Desplegar panel de tickets\n' +
          '`/reset-bot` — Reinicio de emergencia ⚠️',
        inline: false
      }
    )
    .setFooter({ text: '💡 Usa /help para el panel de ayuda interactivo completo' })
    .setTimestamp();
}

function embed_cierre() {
  return new EmbedBuilder()
    .setColor(0x00BFA6)
    .setTitle('🌟 ¡BIENVENIDOS A DIAMONDS LEAGUE!')
    .setDescription(
      '> *Donde la competencia se hace con pasión y la organización marca la diferencia.*\n\n' +
      'Si tienes alguna duda que no quedó resuelta en este mensaje, recuerda que puedes:\n\n' +
      '📬 Abrir un ticket en ' + CANAL_TICKETS + '\n' +
      '❓ Usar `/help` para el panel de ayuda interactivo\n\n' +
      '¡Gracias por estar todos aqui y que sigamos creciendo!⚽💎'
    )
    .setFooter({ text: 'Diamonds League Bot • Desarrollado para Diamonds League' })
    .setTimestamp();
}

// ─── Comando ──────────────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Publica el mensaje completo de bienvenida y presentación del bot [Solo administradores]')
    .addChannelOption(opt =>
      opt.setName('canal')
        .setDescription('Canal donde publicar el mensaje (por defecto: el canal actual)')
        .setRequired(false)
    ),

  async execute(interaction) {
    // Solo admins pueden usar este comando
    if (!isAdmin(interaction.member)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle('❌ Acceso denegado')
            .setDescription('Solo los **administradores** pueden publicar el mensaje de bienvenida.')
        ],
        flags: 64
      });
    }

    // Canal objetivo (si se especificó, usar ese; si no, el canal actual)
    const canalDestino = interaction.options.getChannel('canal') || interaction.channel;

    // Verificar que el bot puede enviar mensajes ahí
    if (!canalDestino.permissionsFor(interaction.guild.members.me).has('SendMessages')) {
      return interaction.reply({
        content: `❌ No tengo permisos para enviar mensajes en ${canalDestino}.`,
        flags: 64
      });
    }

    // Responder ephemeral inmediatamente para no expirar la interacción
    await interaction.reply({
      content: `⏳ Publicando el mensaje de bienvenida en ${canalDestino}...`,
      flags: 64
    });

    const embeds = [
      embed_portada(),
      embed_sistema_equipos(),
      embed_inscripciones(),
      embed_fichajes(),
      embed_bajas(),
      embed_cuerpo_tecnico(),
      embed_tickets(),
      embed_moderacion(),
      embed_reglas_liga(),
      embed_resumen_comandos(),
      embed_cierre(),
    ];

    try {
      // Enviamos cada embed en su propio mensaje para no superar el límite de 6000 chars por mensaje
      for (const embed of embeds) {
        await canalDestino.send({ embeds: [embed] });
      }

      await interaction.editReply({
        content: `✅ Mensaje de bienvenida publicado correctamente en ${canalDestino}.`
      });
    } catch (error) {
      console.error('[WELCOME] Error publicando mensaje:', error);
      await interaction.editReply({
        content: `❌ Error al publicar el mensaje: ${error.message}`
      });
    }
  }
};
