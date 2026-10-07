# 🛡️ Guía de Administración - Diamonds League Bot

## 📋 Índice
- [Sistema de Permisos](#sistema-de-permisos)
- [Comandos de Moderación](#comandos-de-moderación)
- [Comandos de Administración](#comandos-de-administración)
- [Sistema de Advertencias](#sistema-de-advertencias)
- [Sistema de Ayuda Interactivo](#sistema-de-ayuda-interactivo)
- [Configuración](#configuración)

---

## 🔐 Sistema de Permisos

### Roles Administrativos Autorizados

Los siguientes roles tienen acceso completo a todos los comandos administrativos y de moderación:

```
1293931224217288805
1549907589960302623
1361168022668054691
1369009698891763874
1305269515109535867
1557346515142443090
```

### Roles de Staff

Los roles de staff pueden escribir en canales bloqueados con `/lock`:

- Todos los roles administrativos
- Rol de Reviewer
- Rol de Director Técnico (DT)
- Rol de Sub-Director Técnico (SUB-DT)

### Modificar Roles Administrativos

Para agregar o eliminar roles administrativos, edita el archivo:
```
utils/permissions.js
```

Y modifica el array `ADMIN_ROLE_IDS`.

---

## 🛡️ Comandos de Moderación

### `/kick`
**Descripción:** Expulsa a un usuario del servidor

**Parámetros:**
- `usuario` (requerido) - Usuario a expulsar
- `razon` (opcional) - Razón de la expulsión

**Características:**
- Verifica jerarquía de roles
- Notifica al usuario por DM antes de expulsarlo
- Registra la acción

**Ejemplo:**
```
/kick usuario:@Usuario razon:Spam reiterado
```

---

### `/ban`
**Descripción:** Banea permanentemente a un usuario

**Parámetros:**
- `usuario` (requerido) - Usuario a banear
- `razon` (opcional) - Razón del ban
- `eliminar_mensajes` (opcional) - Días de mensajes a eliminar (0-7)

**Características:**
- Verifica jerarquía de roles
- Notifica al usuario por DM
- Permite eliminar historial de mensajes
- Funciona incluso si el usuario ya no está en el servidor

**Ejemplo:**
```
/ban usuario:@Usuario razon:Toxicidad extrema eliminar_mensajes:7
```

---

### `/desban`
**Descripción:** Retira el ban de un usuario usando su ID

**Parámetros:**
- `user_id` (requerido) - ID del usuario (17-19 dígitos)
- `razon` (opcional) - Razón del desban

**Características:**
- Funciona con usuarios que no están en el servidor
- Valida que el ID sea correcto
- Verifica que el ban exista antes de intentar removerlo

**Ejemplo:**
```
/desban user_id:123456789012345678 razon:Apelación aceptada
```

---

### `/mute`
**Descripción:** Silencia temporalmente a un usuario

**Parámetros:**
- `usuario` (requerido) - Usuario a silenciar
- `minutos` (requerido) - Duración (1-40320 minutos = 28 días)
- `razon` (opcional) - Razón del silencio

**Características:**
- Usa el sistema de timeout nativo de Discord
- Notifica al usuario por DM
- Muestra timestamp de finalización
- Valida duración máxima

**Ejemplo:**
```
/mute usuario:@Usuario minutos:60 razon:Flood
```

---

### `/desmute`
**Descripción:** Retira el silencio de un usuario

**Parámetros:**
- `usuario` (requerido) - Usuario a desmutear

**Características:**
- Verifica que el usuario tenga timeout activo
- Notifica al usuario por DM
- Verifica jerarquía de roles

**Ejemplo:**
```
/desmute usuario:@Usuario
```

---

### `/warn`
**Descripción:** Aplica una advertencia a un usuario

**Parámetros:**
- `usuario` (requerido) - Usuario a advertir
- `razon` (requerido) - Razón de la advertencia

**Características:**
- Almacena advertencias persistentemente
- Notifica al usuario por DM
- **Al llegar a 3 advertencias:** Envía alerta al staff
- Numera las advertencias automáticamente

**Ejemplo:**
```
/warn usuario:@Usuario razon:Lenguaje inapropiado
```

**Sistema de 3 Advertencias:**

Cuando un usuario alcanza exactamente 3 advertencias activas:
1. El bot envía una alerta automática al canal
2. El mensaje indica que se requiere acción administrativa
3. La acción a tomar está configurada en `utils/warnings.js`

Configuración actual: `manual` (solo notifica, no aplica sanción automática)

Opciones disponibles:
- `manual` - Solo notifica al staff
- `mute` - Silencia automáticamente al usuario
- `kick` - Expulsa automáticamente al usuario
- `ban` - Banea automáticamente al usuario

---

### `/q-warn`
**Descripción:** Consulta las advertencias de un usuario

**Parámetros:**
- `usuario` (requerido) - Usuario a consultar
- `incluir_inactivas` (opcional) - Mostrar advertencias removidas

**Características:**
- Muestra advertencias activas
- Historial completo con fechas
- Indica moderador que aplicó cada advertencia
- Muestra ID de cada advertencia para referencia
- Límite de 10 advertencias más recientes en pantalla

**Ejemplo:**
```
/q-warn usuario:@Usuario incluir_inactivas:true
```

---

### `/lock`
**Descripción:** Cierra el canal actual para usuarios normales

**Parámetros:**
- `razon` (opcional) - Razón del cierre

**Características:**
- Impide enviar mensajes a usuarios normales
- El staff autorizado puede seguir escribiendo
- Deshabilita reacciones y hilos
- Muestra mensaje informativo

**Ejemplo:**
```
/lock razon:Mantenimiento del canal
```

---

### `/unlock`
**Descripción:** Desbloquea el canal actual

**Características:**
- Restaura permisos a su estado original
- Verifica que el canal esté bloqueado antes de desbloquearlo
- Muestra confirmación visual

**Ejemplo:**
```
/unlock
```

---

### `/cls`
**Descripción:** Elimina mensajes del canal

**Parámetros:**
- `cantidad` (requerido) - Mensajes a eliminar (1-100)

**Características:**
- Elimina hasta 100 mensajes a la vez
- Solo elimina mensajes de menos de 14 días
- Informa si hay mensajes muy antiguos que no se pueden eliminar
- Muestra estadísticas de eliminación

**Ejemplo:**
```
/cls cantidad:50
```

**Limitaciones de Discord:**
- Solo se pueden eliminar mensajes de menos de 14 días
- Máximo 100 mensajes por ejecución

---

## ⚙️ Comandos de Administración

### `/add-equipo`
**Descripción:** Registra un nuevo equipo directamente

**Restricción:** Solo administradores autorizados

**Parámetros:**
- `nombreequipo` - Nombre completo del equipo
- `abreviacion` - Abreviación (ej: BSC)
- `color_primario` - Color hex (ej: #00BFA6)
- `color_secundario` - Color hex secundario
- `escudo` - Imagen del escudo
- `categoria` - Categoría donde se registrará
- `director_tecnico` - Usuario que será DT
- `sub_director_tecnico` (opcional) - Usuario que será Sub-DT

**Características:**
- Crea rol del equipo automáticamente
- Crea canal privado del equipo
- Asigna roles de DT y SUB-DT
- Valida colores hexadecimales
- Verifica cupos disponibles

---

### `/edit-categorias`
**Descripción:** Gestiona las categorías de la liga

**Restricción:** Solo administradores autorizados

**Subcomandos:**

#### `crear`
Crea una nueva categoría
- `nombre` - Nombre de la categoría
- `descripcion` - Descripción
- `cupos` - Cantidad máxima de equipos

#### `editar`
Edita una categoría existente
- `categoria` - Categoría a editar
- `nombre` (opcional) - Nuevo nombre
- `descripcion` (opcional) - Nueva descripción
- `max_equipos` (opcional) - Nuevo límite

#### `eliminar`
Elimina una categoría
- `categoria` - Categoría a eliminar
- Requiere confirmación mediante botones
- No permite eliminar si tiene equipos

---

### `/edit-equipo`
**Descripción:** Edita la información de un equipo

**Restricción:** Solo administradores autorizados

**Características:**
- Actualiza nombre, abreviación, colores
- Cambia escudo
- Mueve a otra categoría
- Requiere confirmación para cambios importantes

---

### `/eliminate-equipo`
**Descripción:** Elimina permanentemente un equipo

**Restricción:** Solo administradores autorizados

**Características:**
- Requiere confirmación mediante botones
- Solo el administrador que inició puede confirmar
- Elimina rol y canal del equipo
- Remueve roles de DT y SUB-DT
- Acción irreversible

---

### `/tickets`
**Descripción:** Despliega el panel de tickets

**Restricción:** Solo administradores autorizados

**Características:**
- Panel visual con botones interactivos
- Colores de la paleta turquesa/marino
- 5 tipos de tickets disponibles

---

## ⚠️ Sistema de Advertencias

### Almacenamiento

Las advertencias se guardan en:
```
data/warnings.json
```

### Estructura de una advertencia

```json
{
  "id": "warn_abc12345",
  "user_id": "123456789012345678",
  "guild_id": "987654321098765432",
  "moderator_id": "111222333444555666",
  "reason": "Razón de la advertencia",
  "timestamp": "2026-10-07T12:00:00.000Z",
  "active": true
}
```

### Gestión de Advertencias

#### Consultar advertencias
```javascript
const { getUserWarnings } = require('./utils/warnings');
const warnings = getUserWarnings(userId, guildId);
```

#### Añadir advertencia
```javascript
const { addWarning } = require('./utils/warnings');
const result = addWarning(userId, guildId, moderatorId, reason);
```

#### Limpiar advertencias
```javascript
const { clearUserWarnings } = require('./utils/warnings');
const count = clearUserWarnings(userId, guildId);
```

### Configuración de 3 Advertencias

Edita `utils/warnings.js`:

```javascript
const THREE_WARN_ACTION = 'manual'; // Cambiar a: 'mute', 'kick', 'ban'
```

---

## 📚 Sistema de Ayuda Interactivo

### `/help`
**Descripción:** Panel de ayuda interactivo con navegación

**Características:**
- Menú desplegable para seleccionar categorías
- Embeds con colores de la paleta turquesa/marino
- Muestra/oculta comandos según permisos del usuario
- Botón para cerrar el panel
- Auto-desactiva componentes después de 5 minutos

### Categorías del Panel

1. **🏠 Inicio** - Panel principal
2. **🌟 General** - Comandos básicos
3. **⚽ Equipos** - Gestión de equipos
4. **🛡️ Moderación** - Herramientas de moderación (solo admins)
5. **⚙️ Administración** - Panel administrativo (solo admins)
6. **ℹ️ Información** - Acerca del bot

### Personalización

Para agregar/modificar categorías o comandos, edita:
```
commands/help.js
```

En el objeto `CATEGORIES`.

---

## 🔧 Configuración

### Variables de Entorno (.env)

```env
TOKEN=tu_token_de_discord
CLIENT_ID=id_de_tu_aplicacion
GUILD_ID=id_de_tu_servidor
REVIEW_CHANNEL_ID=canal_de_revision
REVIEWER_ROLE_ID=rol_revisor
DT_ROLE_ID=rol_director_tecnico
SUBDT_ROLE_ID=rol_subdirector_tecnico
COMMANDS_CHANNEL_ID=canal_de_comandos
```

### Archivos de Configuración

#### Permisos Administrativos
```
utils/permissions.js
```
- `ADMIN_ROLE_IDS` - IDs de roles administrativos
- `STAFF_ROLE_IDS` - IDs de roles de staff

#### Advertencias
```
utils/warnings.js
```
- `THREE_WARN_ACTION` - Acción al llegar a 3 advertencias

#### Base de Datos
```
data/categorias.json - Categorías y equipos
data/solicitudes.json - Solicitudes de inscripción
data/fichajes.json - Sistema de fichajes
data/warnings.json - Advertencias
```

---

## 🚀 Iniciar el Bot

### Desarrollo
```bash
npm run dev
```

### Producción
```bash
npm start
```

### Registrar Comandos
```bash
npm run deploy
```

---

## ⚡ Características de Seguridad

### Verificaciones Automáticas

✅ Permisos del usuario ejecutando el comando
✅ Jerarquía de roles (moderador vs objetivo)
✅ Jerarquía del bot
✅ Permisos del bot en el servidor
✅ Validación de IDs de Discord
✅ Validación de parámetros
✅ Prevención de auto-moderación
✅ Protección del dueño del servidor

### Manejo de Errores

- Mensajes de error claros y específicos
- Respuestas efímeras para comandos administrativos
- Logs detallados en consola
- Reverción automática en caso de fallo

### Notificaciones

- DM al usuario afectado (cuando sea posible)
- Embeds informativos con colores distintivos
- Timestamps y referencias temporales
- Registro de moderador responsable

---

## 📊 Jerarquía de Comandos

### Acceso Público
- `/ping`
- `/help`
- `/cupos`
- `/ver-equipos`
- `/plantilla`

### Directores Técnicos
- `/fichar`
- `/dar-de-baja`
- `/asignar-nick`
- `/asignar-subdt`
- `/quitar-subdt`

### Administradores
- Todos los comandos de moderación
- Todos los comandos administrativos
- Sistema de advertencias
- Gestión de equipos y categorías

---

## 🎨 Paleta de Colores

Los embeds usan la siguiente paleta turquesa/marino:

```javascript
0x1ABC9C - Turquesa principal
0x40E0D0 - Turquesa claro (éxito)
0x0E7C86 - Verde azulado
0x13315C - Azul marino
0x0A2342 - Azul marino profundo
0xEF5350 - Rojo (errores)
0xF39C12 - Naranja (advertencias)
0x607D8B - Gris (neutral)
```

---

## 📞 Soporte

Para reportar problemas o sugerir mejoras:
1. Revisa esta guía primero
2. Verifica los logs del bot
3. Consulta con el equipo de desarrollo

---

**Versión:** 2.0  
**Última actualización:** Octubre 2026  
**Desarrollado para:** Diamonds League
