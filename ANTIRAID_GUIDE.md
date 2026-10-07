# 🚨 Guía del Sistema Antiraid

## 📋 Descripción General

El sistema antiraid de Diamonds League Bot protege tu servidor contra ataques masivos de spam, bots maliciosos y raids coordinados.

---

## 🛡️ Características

### Protecciones Automáticas

✅ **Verificación Máxima**
- Nivel de verificación elevado al máximo
- Requiere número de teléfono verificado para nuevos miembros

✅ **Modo Lento Global**
- Aplica cooldown configurable en todos los canales de texto
- Previene spam masivo de mensajes

✅ **Bloqueo de Bots**
- Todos los bots (excepto el bot de la liga) no pueden enviar mensajes
- Previene ataques de bots maliciosos

✅ **Detección de Spam**
- URLs/links repetidos (más de 3 en un mensaje)
- Mensajes muy largos con repetición
- Menciones masivas (más de 5 menciones)
- Emojis excesivos (más de 10)
- MAYÚSCULAS excesivas

✅ **Detección de Links Maliciosos**
- Discord nitro falso
- Steam phishing
- URLs acortadas sospechosas
- Dominios de phishing conocidos

✅ **Acción Automática**
- Eliminación inmediata del mensaje
- Expulsión automática del usuario
- Notificación al staff

---

## 🎯 Comandos

### `/antiraid`
**Descripción:** Activa el modo de protección antiraid

**Parámetros:**
- `slowmode` (opcional) - Segundos de modo lento (0-21600)
  - Por defecto: 10 segundos
  - Recomendado para raid ligero: 5-10s
  - Recomendado para raid severo: 30-60s

**Ejemplo:**
```
/antiraid slowmode:30
```

**Lo que hace:**
1. Eleva verificación al nivel máximo
2. Aplica modo lento en todos los canales de texto
3. Bloquea entrada de nuevos miembros
4. Activa detección automática de spam
5. Bloquea mensajes de bots externos

---

### `/q-antiraid`
**Descripción:** Desactiva el modo antiraid y restaura la normalidad

**No requiere parámetros**

**Ejemplo:**
```
/q-antiraid
```

**Lo que hace:**
1. Restaura nivel de verificación original
2. Remueve modo lento de todos los canales
3. Permite entrada de nuevos miembros
4. Desactiva detección automática
5. Restaura funcionamiento de bots

---

## 🚀 Cómo Usar en un Raid

### Paso 1: Detectar el Raid
Señales de un raid:
- Múltiples usuarios uniéndose rápidamente
- Spam coordinado en varios canales
- Bots enviando mensajes maliciosos
- Links de phishing repetidos
- Menciones masivas

### Paso 2: Activar Antiraid Inmediatamente
```
/antiraid slowmode:30
```

### Paso 3: Verificar Activación
El bot confirmará:
- ✅ Nivel de verificación elevado
- ✅ Modo lento aplicado
- ✅ Restricciones activas
- ✅ Protección automática activada

### Paso 4: Monitorear
- El bot expulsará automáticamente spammers
- Recibirás notificaciones de acciones tomadas
- Los miembros legítimos verán anuncio del antiraid

### Paso 5: Limpiar Manualmente (Si es necesario)
Mientras el antiraid está activo:
```
/ban @raider razon:Participación en raid
/kick @spammer razon:Spam durante raid
/cls cantidad:100
```

### Paso 6: Desactivar Cuando Sea Seguro
```
/q-antiraid
```

---

## 📊 Detección Automática

### Ejemplos de Spam Detectado

❌ **URLs repetidas:**
```
https://fake-nitro.com https://fake-nitro.com https://fake-nitro.com https://fake-nitro.com
```

❌ **Menciones masivas:**
```
@user1 @user2 @user3 @user4 @user5 @user6 @user7 RAID!!!
```

❌ **Mensajes repetitivos:**
```
SPAM SPAM SPAM SPAM SPAM SPAM SPAM SPAM SPAM SPAM
SPAM SPAM SPAM SPAM SPAM SPAM SPAM SPAM SPAM SPAM
(+ muchas líneas más)
```

❌ **Emojis excesivos:**
```
🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥
```

❌ **MAYÚSCULAS excesivas:**
```
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
```

### Dominios Maliciosos Bloqueados

- `discord.gift`
- `discordnitro`
- `discord-nitro`
- `steamcommunity-com`
- `steam-community`
- `free-nitro`
- `dlscord`
- `discrod`
- Variantes con caracteres especiales

---

## ⚙️ Configuración Técnica

### Archivo de Estado
```
data/antiraid-state.json
```

Contiene:
- Estado actual (activo/inactivo)
- Fecha y hora de activación
- Usuario que lo activó
- Nivel de verificación original
- Canales afectados

### Niveles de Verificación

Discord tiene 5 niveles:
- **0:** Sin restricciones
- **1:** Email verificado
- **2:** Registrado hace +5 minutos
- **3:** Miembro del servidor hace +10 minutos
- **4:** Número de teléfono verificado (MÁXIMO - usado por antiraid)

### Permisos Necesarios del Bot

El bot necesita:
- ✅ `Gestionar Servidor` - Para cambiar nivel de verificación
- ✅ `Gestionar Canales` - Para aplicar slowmode
- ✅ `Expulsar Miembros` - Para expulsar spammers
- ✅ `Gestionar Mensajes` - Para eliminar spam

---

## 🔍 Logs y Monitoreo

### Consola del Bot
El bot registra todas las acciones:
```
[ANTIRAID] Usuario expulsado por spam: BadUser#1234
[ANTIRAID] Usuario expulsado por link malicioso: Phisher#5678
[ANTIRAID] Mensaje de bot bloqueado: SpamBot#9999
```

### Notificaciones en Discord
El bot envía embeds cuando:
- Se expulsa un usuario por spam
- Se detecta un link malicioso
- Se bloquea un bot

---

## 🛠️ Personalización

### Modificar Detección de Spam
Edita `utils/antiraid.js`:

```javascript
// Cambiar umbral de URLs
if (urls && urls.length > 3) return true; // Cambiar "3" al número deseado

// Cambiar umbral de menciones
if (mentions && mentions.length > 5) return true; // Cambiar "5"

// Cambiar umbral de emojis
if (emojis && emojis.length > 10) return true; // Cambiar "10"
```

### Agregar Dominios Maliciosos
Edita `utils/antiraid.js`:

```javascript
const suspiciousDomains = [
  'discord.gift',
  'discordnitro',
  // ... agregar más aquí
  'tu-dominio-sospechoso.com'
];
```

### Cambiar Acción Automática
En `index.js`, puedes cambiar de expulsión a ban:

```javascript
// Cambiar de kick a ban
await message.member.ban({ reason: 'Spam detectado durante modo antiraid' });
```

---

## ⚠️ Limitaciones

### Lo que NO puede hacer el antiraid:
- ❌ Prevenir usuarios con permisos de administrador
- ❌ Proteger contra raids de cuentas verificadas antiguas
- ❌ Detectar 100% de todos los tipos de spam
- ❌ Revertir daños ya causados antes de activarlo

### Recomendaciones Adicionales:
- Activa el antiraid **inmediatamente** al detectar un raid
- No esperes a que sea demasiado tarde
- Mantén un equipo de moderación activo
- Usa los comandos de moderación manual cuando sea necesario
- Considera crear un rol "Miembro Verificado" para acceso a canales sensibles

---

## 🆘 Solución de Problemas

### El antiraid no se activa
**Problema:** Error al ejecutar `/antiraid`

**Soluciones:**
1. Verifica que el bot tenga el permiso `Gestionar Servidor`
2. Verifica que el rol del bot esté lo suficientemente alto
3. Revisa la consola por errores específicos

### Los spammers no son expulsados
**Problema:** Mensajes se eliminan pero usuarios no se expulsan

**Causa:** El bot no tiene el permiso `Expulsar Miembros` o el usuario tiene rol protegido

**Solución:** Verifica permisos del bot y jerarquía de roles

### El antiraid no detecta spam
**Problema:** Algunos mensajes de spam pasan sin detectar

**Solución:** 
1. El spam puede no cumplir los criterios de detección
2. Ajusta los umbrales en `utils/antiraid.js`
3. Usa comandos manuales `/kick` o `/ban`

### No puedo desactivar el antiraid
**Problema:** `/q-antiraid` no funciona

**Solución:**
1. Verifica que seas administrador
2. Si persiste, edita manualmente `data/antiraid-state.json`:
```json
{
  "active": false
}
```
3. Restaura configuraciones manualmente en Discord

---

## 📈 Mejores Prácticas

### Antes de un Evento Grande
1. Informa a tu comunidad sobre el antiraid
2. Ten lista una lista de roles confiables
3. Prepara un canal de anuncios
4. Asegúrate que el staff conoce los comandos

### Durante un Raid
1. ✅ Activa `/antiraid` inmediatamente
2. ✅ Notifica al staff en canal privado
3. ✅ Monitorea la consola del bot
4. ✅ Usa comandos manuales cuando sea necesario
5. ✅ Documenta usernames/IDs de raiders

### Después del Raid
1. ✅ Revisa logs del bot
2. ✅ Verifica que todos los raiders fueron removidos
3. ✅ Desactiva `/q-antiraid`
4. ✅ Informa a la comunidad que todo volvió a la normalidad
5. ✅ Considera ajustar configuraciones de seguridad permanentes

---

## 🔐 Seguridad Adicional

### Configuraciones Recomendadas de Discord

**Moderación:**
- Activar AutoMod de Discord
- Configurar filtros de contenido
- Habilitar verificación de email

**Roles:**
- Crear rol "Verificado" para acceso completo
- Restringir canales sensibles
- Usar permisos de canal correctamente

**Invitaciones:**
- Limitar quién puede crear invitaciones
- Desactivar invitaciones temporales si es posible
- Monitorear uso de invitaciones

---

## 📞 Soporte

Si encuentras problemas con el sistema antiraid:

1. Revisa esta guía completa
2. Verifica los permisos del bot
3. Revisa la consola por errores
4. Consulta con el equipo de desarrollo

---

## 🎯 Resumen Rápido

**Para Activar:**
```
/antiraid slowmode:30
```

**Para Desactivar:**
```
/q-antiraid
```

**Protecciones Activas:**
- 🚫 Bloqueo de entrada de nuevos miembros
- 🐌 Modo lento en todos los canales
- 🤖 Bloqueo de bots externos
- 🗑️ Auto-eliminación de spam
- 👢 Auto-expulsión de spammers
- 🔗 Detección de links maliciosos

**Staff No Afectado:**
- ✅ Admins pueden enviar mensajes normalmente
- ✅ Admins no tienen slowmode
- ✅ Comandos del bot funcionan para admins

---

**Versión:** 2.0  
**Última actualización:** Octubre 2026  
**Sistema:** Activo y funcional
