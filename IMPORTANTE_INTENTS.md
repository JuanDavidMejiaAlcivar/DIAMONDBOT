# ⚠️ CONFIGURACIÓN IMPORTANTE - Intents de Discord

## 🚨 ACCIÓN REQUERIDA

Para que el sistema antiraid funcione correctamente, **DEBES habilitar los intents privilegiados** en el Discord Developer Portal.

---

## 📋 Pasos para Habilitar Intents

### 1. Ve al Discord Developer Portal
```
https://discord.com/developers/applications
```

### 2. Selecciona tu Aplicación
- Busca y selecciona "Diamonds League Bot" (o como hayas nombrado tu aplicación)

### 3. Ve a la Sección "Bot"
- En el menú lateral izquierdo, haz clic en **"Bot"**

### 4. Desplázate a "Privileged Gateway Intents"
Encontrarás esta sección cerca del final de la página.

### 5. Activa los Siguientes Intents

#### ✅ MESSAGE CONTENT INTENT (REQUERIDO)
```
[ ✓ ] MESSAGE CONTENT INTENT
```

**¿Por qué?** El bot necesita leer el contenido de los mensajes para:
- Detectar spam
- Detectar links maliciosos
- Eliminar mensajes automáticamente
- Proteger el servidor durante raids

#### ✅ SERVER MEMBERS INTENT (Ya debería estar activo)
```
[ ✓ ] SERVER MEMBERS INTENT
```

**¿Por qué?** Para:
- Obtener información de miembros
- Expulsar usuarios
- Verificar permisos

### 6. Guarda los Cambios
Haz clic en **"Save Changes"** al final de la página.

### 7. Reinicia el Bot
```bash
# Detén el bot si está corriendo
# Luego reinicia con:
npm start
```

---

## 🔍 Verificar que Funciona

### Método 1: Logs de Inicio
Al iniciar el bot, deberías ver en la consola:
```
✅  Comando cargado: /antiraid
✅  Comando cargado: /q-antiraid
```

### Método 2: Probar Antiraid
```
1. Ejecuta: /antiraid
2. Envía un mensaje con spam (ejemplo: muchas URLs)
3. El bot debería eliminar el mensaje automáticamente
```

### Método 3: Revisar Estado
Si el bot no puede leer mensajes, verás errores en la consola como:
```
[ERROR] Missing Access (code: 50001)
```

---

## ❌ Qué Pasa si NO Habilitas los Intents

### Sin MESSAGE CONTENT INTENT:
- ❌ El antiraid **NO funcionará**
- ❌ No podrá detectar spam
- ❌ No podrá detectar links maliciosos
- ❌ Los comandos `/antiraid` y `/q-antiraid` no servirán
- ❌ Los bots maliciosos no serán bloqueados

### Con MESSAGE CONTENT INTENT:
- ✅ El antiraid funciona perfectamente
- ✅ Detección automática de spam
- ✅ Detección de links maliciosos
- ✅ Auto-expulsión de spammers
- ✅ Bloqueo de bots maliciosos

---

## 📸 Captura de Pantalla de Referencia

La sección "Privileged Gateway Intents" se ve así:

```
Privileged Gateway Intents
───────────────────────────────────────────────────

[ ✓ ] PRESENCE INTENT
      Allows your bot to receive presence updates

[ ✓ ] SERVER MEMBERS INTENT
      Allows your bot to receive member events

[ ✓ ] MESSAGE CONTENT INTENT          ← ESTE DEBES ACTIVAR
      Allows your bot to receive message content
```

---

## 🔐 Consideraciones de Privacidad

### ¿Es Seguro Habilitar MESSAGE CONTENT INTENT?

**SÍ**, es seguro porque:

1. **El bot solo lee mensajes cuando el antiraid está activo**
2. **No almacena contenido de mensajes**
3. **Solo verifica patrones de spam**
4. **No envía mensajes a servicios externos**
5. **El código es open-source y auditable**

### ¿Qué Puede Ver el Bot?

Con MESSAGE CONTENT INTENT habilitado, el bot puede:
- ✅ Leer el texto de los mensajes
- ✅ Detectar menciones y enlaces
- ✅ Ver emojis en mensajes

**NO puede:**
- ❌ Leer mensajes directos (DMs) sin invitación
- ❌ Leer mensajes en otros servidores
- ❌ Acceder a mensajes antiguos automáticamente
- ❌ Leer mensajes cuando el antiraid está desactivado (técnicamente puede, pero el código no lo hace)

---

## 🚀 Comandos que Requieren MESSAGE CONTENT INTENT

### Requieren el Intent:
- `/antiraid` - Sistema completo de protección
- Detección automática de spam
- Detección de links maliciosos
- Bloqueo de bots

### NO Requieren el Intent:
- `/kick`, `/ban`, `/desban` - Funcionan normalmente
- `/mute`, `/desmute` - Funcionan normalmente
- `/warn`, `/q-warn` - Funcionan normalmente
- `/lock`, `/unlock` - Funcionan normalmente
- `/cls` - Funciona normalmente
- Todos los comandos de equipos - Funcionan normalmente

---

## 📊 Estado de Intents del Bot

### Intents Configurados en el Código:
```javascript
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,              // ✅ Siempre activo
    GatewayIntentBits.GuildMembers,        // ✅ Ya configurado
    GatewayIntentBits.GuildMessages,       // ✅ NUEVO
    GatewayIntentBits.MessageContent       // ⚠️ REQUIERE ACTIVACIÓN
  ],
});
```

---

## 🆘 Solución de Problemas

### Error: "Missing Access"
**Causa:** El intent no está habilitado en el Developer Portal

**Solución:**
1. Ve a https://discord.com/developers/applications
2. Activa MESSAGE CONTENT INTENT
3. Guarda cambios
4. Reinicia el bot

### Error: "Disallowed Intents"
**Causa:** La aplicación no tiene permiso para usar intents privilegiados

**Solución:**
1. Verifica que tu bot no esté en más de 100 servidores
2. Si está en más de 100, necesitas solicitar verificación de Discord
3. Para bots pequeños, no debería haber problema

### El Bot no Detecta Spam
**Causa:** El intent está habilitado pero el antiraid no está activo

**Solución:**
1. Ejecuta `/antiraid` para activar el sistema
2. Verifica que el mensaje dice "Modo Antiraid Activado"
3. Prueba enviando un mensaje con spam

---

## ✅ Checklist Final

Antes de considerar el sistema completo:

- [ ] Abrí el Discord Developer Portal
- [ ] Seleccioné mi aplicación
- [ ] Fui a la sección "Bot"
- [ ] Encontré "Privileged Gateway Intents"
- [ ] Activé **MESSAGE CONTENT INTENT**
- [ ] Guardé los cambios
- [ ] Reinicié el bot
- [ ] Probé `/antiraid`
- [ ] El sistema detecta spam correctamente

---

## 🎯 Resumen

**PASO 1:** https://discord.com/developers/applications  
**PASO 2:** Selecciona tu bot  
**PASO 3:** Sección "Bot"  
**PASO 4:** Activa "MESSAGE CONTENT INTENT"  
**PASO 5:** Guarda y reinicia el bot  

**Sin este paso, el antiraid NO funcionará.**

---

**Última actualización:** Octubre 2026  
**Versión del bot:** 2.0  
**Estado requerido:** ⚠️ CONFIGURACIÓN PENDIENTE
