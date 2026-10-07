# 🚀 Guía Rápida de Inicio

## ✅ Sistema Completamente Implementado

Tu bot ahora cuenta con:
- ✅ 10 comandos de moderación nuevos
- ✅ Sistema centralizado de permisos
- ✅ Sistema de advertencias con 3 niveles
- ✅ Panel de ayuda interactivo rediseñado
- ✅ Protección en comandos administrativos

---

## 🎯 Iniciar el Bot (3 pasos)

### 1. Verificar que todo esté en orden
```bash
npm install
```

### 2. Comandos ya están registrados ✅
Los 27 comandos ya fueron registrados en Discord automáticamente.

### 3. Iniciar el bot
```bash
npm start
```

O en modo desarrollo (auto-reinicio):
```bash
npm run dev
```

---

## 🧪 Probar el Sistema

### 1. Comando de Ayuda
```
/help
```
Verás el panel interactivo con menú desplegable y navegación.

### 2. Comandos de Moderación (Solo Admins)
```
/kick @usuario razon:Spam
/ban @usuario razon:Toxicidad
/mute @usuario minutos:60 razon:Flood
/warn @usuario razon:Lenguaje inapropiado
/q-warn @usuario
/lock razon:Mantenimiento
/unlock
/cls cantidad:10
```

### 3. Sistema Antiraid (Solo Admins) 🚨
```
# Activar protección contra raids
/antiraid slowmode:30

# Desactivar cuando sea seguro
/q-antiraid
```

### 4. Verificar Permisos
Si un usuario sin permisos intenta usar `/kick`, verá:
```
❌ No tienes permisos para utilizar este comando.
Este comando está reservado exclusivamente para administradores.
```

---

## ⚠️ CONFIGURACIÓN IMPORTANTE - Intents

**ANTES DE USAR EL ANTIRAID:**

El sistema antiraid requiere que habilites el intent `MESSAGE CONTENT` en el Discord Developer Portal.

### Pasos Rápidos:
1. Ve a https://discord.com/developers/applications
2. Selecciona tu aplicación
3. Sección "Bot"
4. Activa **"MESSAGE CONTENT INTENT"**
5. Guarda y reinicia el bot

**📖 Guía completa:** Ver `IMPORTANTE_INTENTS.md`

**Sin este paso, el antiraid NO funcionará.**

---

## ⚙️ Configuración de Roles Administrativos

### Roles Actuales Autorizados
```
1293931224217288805
1549907589960302623
1361168022668054691
1369009698891763874
1305269515109535867
1557346515142443090
```

### Para Agregar/Quitar Roles
1. Abre `utils/permissions.js`
2. Modifica el array `ADMIN_ROLE_IDS`
3. Reinicia el bot

```javascript
const ADMIN_ROLE_IDS = [
  '1293931224217288805',
  '1549907589960302623',
  // ... tus roles aquí
];
```

---

## ⚠️ Sistema de 3 Advertencias

### Configuración Actual
**Modo:** Manual (solo notifica al staff)

### Para Cambiar el Comportamiento
1. Abre `utils/warnings.js`
2. Cambia la línea:
```javascript
const THREE_WARN_ACTION = 'manual';
```

**Opciones disponibles:**
- `'manual'` - Solo notifica (actual)
- `'mute'` - Silencia automáticamente
- `'kick'` - Expulsa automáticamente
- `'ban'` - Banea automáticamente

3. Reinicia el bot

---

## 📚 Comandos Disponibles

### General (Todos)
- `/ping` - Verificar latencia
- `/help` - Panel de ayuda interactivo
- `/cupos` - Ver cupos disponibles
- `/ver-equipos` - Listar equipos

### Equipos (DT/SUB-DT)
- `/plantilla` - Ver plantilla de equipo
- `/fichar` - Proponer fichaje
- `/dar-de-baja` - Dar de baja jugador
- `/renunciar` - Renunciar a equipo
- `/asignar-nick` - Cambiar nick
- `/asignar-subdt` - Asignar Sub-DT
- `/quitar-subdt` - Quitar Sub-DT

### Moderación (Solo Admins) 🛡️
- `/kick` - Expulsar usuario
- `/ban` - Banear usuario
- `/desban` - Desbanear por ID
- `/mute` - Silenciar temporalmente
- `/desmute` - Quitar silencio
- `/warn` - Aplicar advertencia
- `/q-warn` - Ver advertencias
- `/lock` - Bloquear canal
- `/unlock` - Desbloquear canal
- `/cls` - Limpiar mensajes
- `/antiraid` - Activar protección antiraid 🚨
- `/q-antiraid` - Desactivar antiraid ✅

### Administración (Solo Admins) ⚙️
- `/add-equipo` - Registrar equipo
- `/edit-categorias` - Gestionar categorías
- `/edit-equipo` - Editar equipo
- `/eliminate-equipo` - Eliminar equipo
- `/inscribir-equipo` - Revisar solicitudes
- `/tickets` - Panel de tickets

---

## 🎨 Colores de los Embeds

Los embeds usan la paleta turquesa/marino:

```
🟢 Verde Turquesa (0x1ABC9C) - Principal
🔵 Azul Claro (0x40E0D0) - Éxito
🔵 Verde Azulado (0x0E7C86) - Acciones
🔵 Azul Marino (0x13315C) - Moderación
🔵 Azul Oscuro (0x0A2342) - Administración
🔴 Rojo (0xEF5350) - Errores
🟠 Naranja (0xF39C12) - Advertencias
⚪ Gris (0x607D8B) - Neutral
```

---

## 🔍 Verificar que Todo Funciona

### 1. Bot Online
El bot debe mostrar estado "Online" en Discord.

### 2. Comandos Visibles
Al escribir `/` en el servidor, deben aparecer todos los comandos.

### 3. Permisos Correctos
Solo usuarios con roles administrativos verán los comandos de moderación/admin.

### 4. Archivos Creados
Verifica que existan:
```
✅ utils/permissions.js
✅ utils/warnings.js
✅ data/warnings.json
✅ commands/kick.js
✅ commands/ban.js
✅ commands/desban.js
✅ commands/mute.js
✅ commands/desmute.js
✅ commands/warn.js
✅ commands/q-warn.js
✅ commands/lock.js
✅ commands/unlock.js
✅ commands/cls.js
✅ commands/help.js (actualizado)
```

---

## 📖 Documentación Completa

Para información detallada de cada comando:
```
Ver: ADMIN_GUIDE.md
```

---

## 🐛 Solución de Problemas

### Comandos no aparecen
```bash
npm run deploy
```

### Bot no responde
1. Verifica que el token en `.env` sea correcto
2. Verifica que el bot tenga permisos en el servidor
3. Revisa la consola por errores

### Error de permisos
1. Verifica que tu usuario tenga uno de los roles administrativos
2. Verifica los IDs en `utils/permissions.js`
3. Reinicia el bot después de cambios

### Advertencias no se guardan
1. Verifica que existe `data/warnings.json`
2. Verifica permisos de escritura en la carpeta `data/`
3. Revisa la consola por errores

---

## 📞 Recursos Adicionales

- **Guía Completa:** `ADMIN_GUIDE.md`
- **Configuración:** `.env`
- **Permisos:** `utils/permissions.js`
- **Advertencias:** `utils/warnings.js`

---

## ✅ Checklist de Verificación

Antes de usar en producción:

- [ ] Bot está online
- [ ] Comandos aparecen en Discord
- [ ] `/help` muestra panel interactivo
- [ ] Roles administrativos configurados correctamente
- [ ] Probado `/kick` con usuario de prueba
- [ ] Probado `/warn` y `/q-warn`
- [ ] Sistema de 3 advertencias configurado
- [ ] Paleta de colores se ve correctamente

---

## 🎉 ¡Listo para Usar!

Tu bot está completamente configurado y listo para moderar Diamonds League.

**Recuerda:**
- Los comandos de moderación son potentes - úsalos con responsabilidad
- Todas las acciones quedan registradas
- Los usuarios reciben notificaciones por DM cuando es posible
- El sistema valida permisos automáticamente

---

**Versión:** 2.0  
**Estado:** ✅ Producción  
**Comandos:** 29 totales  
**Sistema:** Completo y funcional  
**Antiraid:** Disponible 🚨
