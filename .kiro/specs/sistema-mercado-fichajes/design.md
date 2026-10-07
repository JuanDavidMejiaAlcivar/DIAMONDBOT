# Sistema de Mercado de Fichajes - Diseño de Reestructuración

## Overview

Este diseño presenta una reestructuración completa de la arquitectura de datos del sistema de mercado de fichajes, consolidando la información dispersa entre tres archivos JSON (`categorias.json`, `fichajes.json`, `solicitudes.json`) en una estructura centralizada y optimizada. El rediseño elimina duplicaciones, simplifica el acceso a datos, y mejora la mantenibilidad del sistema mediante dos nuevos archivos: `equipos.json` (información centralizada de equipos) y `transferencias.json` (historial consolidado).

La reestructuración incluye la refactorización completa de las funciones en `utils/db.js`, migración automática de datos existentes, y actualización de todos los comandos que interactúan con el sistema de fichajes.

## Glossary

- **Bug_Condition (C)**: La condición que genera el problema - cuando el sistema debe consultar datos dispersos entre múltiples archivos JSON y mantener sincronización manual
- **Property (P)**: El comportamiento deseado - consulta centralizada de datos desde una única fuente sin necesidad de sincronización
- **Preservation**: Funcionalidades existentes que deben mantenerse sin cambios (gestión de categorías, roles Discord, validaciones)
- **Archivo de Origen**: Los archivos JSON actuales que contienen datos fragmentados (`categorias.json`, `fichajes.json`, `solicitudes.json`)
- **Archivo Destino**: Los nuevos archivos JSON consolidados (`equipos.json`, `transferencias.json`)
- **Sincronización Manual**: Proceso actual de mantener consistencia entre `equipo.members` y `plantilla.miembros` mediante `sincronizarEquipoDesdePlantilla()`
- **Modelo Centralizado**: Nueva estructura donde cada equipo contiene toda su información en un único objeto
- **Miembro de Equipo**: Objeto que representa la relación entre un usuario Discord y un equipo, con propiedades: `discord_user_id`, `role` (DT, SUB_DT, PLAYER), `haxball_nick`, `joined_at`
- **Transferencia**: Registro histórico de cualquier movimiento de jugadores entre equipos o cambios de rol (fichajes, bajas, renuncias, asignaciones)

## Bug Details

### Bug Condition

El problema se manifiesta cuando el sistema debe gestionar información de equipos y sus miembros. La arquitectura actual fragmenta datos en tres archivos con estructuras inconsistentes, requiriendo sincronización manual constante y generando duplicación de información que complica las operaciones CRUD.

**Formal Specification:**
```
FUNCTION isBugCondition(operation)
  INPUT: operation of type DatabaseOperation
  OUTPUT: boolean
  
  RETURN operation.type IN ['READ', 'WRITE', 'UPDATE', 'DELETE']
         AND operation.entity IN ['equipo', 'miembro', 'transferencia']
         AND requiresMultipleFileAccess(operation)
         AND requiresManualSync(operation)
END FUNCTION
```

**Definición de funciones auxiliares:**
```
FUNCTION requiresMultipleFileAccess(operation)
  RETURN (operation.entity == 'equipo' AND mustReadFromCategorias() AND mustReadFromFichajes())
         OR (operation.entity == 'miembro' AND mustSyncBetweenFiles())
         OR (operation.entity == 'transferencia' AND mustWriteToMultipleArrays())
END FUNCTION

FUNCTION requiresManualSync(operation)
  RETURN operation.requiresCall('sincronizarEquipoDesdePlantilla')
         OR operation.duplicatesData
         OR operation.maintainsRedundantStructures
END FUNCTION
```

### Examples

**Ejemplo 1: Consulta de miembros de equipo**
- **Condición buggy**: `obtenerMiembro(userId)` debe leer `fichajes.json`, buscar en todas las plantillas, y luego sincronizar con `categorias.json`
- **Comportamiento actual**: Requiere 2 lecturas de archivo y búsqueda iterativa en arrays
- **Comportamiento esperado**: Una sola lectura de `equipos.json` con acceso directo al array `miembros`

**Ejemplo 2: Registro de nuevo fichaje**
- **Condición buggy**: `registrarMiembro()` escribe en `fichajes.plantillas[].miembros`, luego en `fichajes.fichados`, y finalmente llama `sincronizarEquipoDesdePlantilla()` para copiar a `categorias.equipos[].members`
- **Comportamiento actual**: 3 operaciones de escritura con duplicación de datos
- **Comportamiento esperado**: Una sola escritura agregando el miembro a `equipos.json` y un registro en `transferencias.json`

**Ejemplo 3: Actualización de nombre de equipo**
- **Condición buggy**: `actualizarEquipo()` actualiza `categorias.equipos[].nombre` y luego debe actualizar manualmente `fichajes.plantillas[].nombre`
- **Comportamiento actual**: 2 actualizaciones en diferentes archivos
- **Comportamiento esperado**: Una sola actualización en `equipos.json`

**Ejemplo 4: Historial de transferencias**
- **Condición buggy**: Datos duplicados en `categorias.transferHistory`, `fichajes.fichados`, y `fichajes.bajas`
- **Comportamiento actual**: Mismo evento registrado en 3 ubicaciones con campos redundantes
- **Comportamiento esperado**: Registro único en `transferencias.json` con tipo de acción diferenciado

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Gestión de categorías debe continuar funcionando con `categorias.json`
- Cálculo de cupos disponibles debe seguir la misma lógica
- Creación de roles, canales y emojis de Discord debe mantener el mismo comportamiento
- Validaciones de abreviaciones únicas deben seguir funcionando
- Funciones de normalización de nombres deben permanecer sin cambios
- Manejo de errores de permisos de Discord debe continuar igual
- Sistema de solicitudes de inscripción debe mantener su estructura

**Scope:**
Todas las operaciones que NO involucran la lectura/escritura de datos de equipos o miembros deben ser completamente inalteradas por esta reestructuración. Esto incluye:
- Comandos que solo consultan categorías (`/cupos`)
- Funciones de utilidad de Discord (formateo, permisos)
- Servicios auxiliares (emojiService, errorEmbeds)
- Proceso de aprobación/rechazo de solicitudes

## Hypothesized Root Cause

Basado en el análisis del código, las causas más probables del problema arquitectural son:

1. **Evolución Incremental Sin Planificación**: El sistema creció orgánicamente agregando funcionalidades sin rediseñar la arquitectura base
   - Inicialmente solo existía `categorias.json` con equipos básicos
   - Se agregó `fichajes.json` para gestionar plantillas sin refactorizar la estructura original
   - Se creó `solicitudes.json` para el proceso de inscripción sin integrarlo al modelo principal

2. **Separación de Responsabilidades Innecesaria**: Se asumió incorrectamente que equipos y plantillas debían estar en archivos separados
   - La "plantilla" es simplemente la lista de miembros del equipo, no una entidad separada
   - No existe justificación para mantener `equipo.members` y `plantilla.miembros` como estructuras independientes

3. **Duplicación de Historial**: El sistema registra transferencias en múltiples formatos sin consolidación
   - `categorias.transferHistory` contiene historial completo con campos genéricos
   - `fichajes.fichados` y `fichajes.bajas` separan artificialmente el mismo concepto
   - Esta separación complica consultas históricas y análisis de datos

4. **Falta de Normalización**: Los archivos JSON no siguen un diseño normalizado de base de datos
   - Redundancia de campos `team_nombre` que pueden obtenerse por referencia
   - Inconsistencia en nombres de propiedades (`user_id` vs `discord_user_id`)
   - Arrays separados para conceptos que deberían estar unidos

## Correctness Properties

Property 1: Bug Condition - Consulta Centralizada de Datos

_For any_ operación de base de datos que consulte información de equipos o miembros, el sistema rediseñado SHALL acceder únicamente a `equipos.json` para obtener toda la información necesaria sin requerir sincronización manual ni lectura de múltiples archivos.

**Validates: Requirements 2.1, 2.2, 2.4, 2.6**

Property 2: Preservation - Funcionalidad de Categorías y Discord

_For any_ operación que NO involucre datos de equipos o miembros (gestión de categorías, creación de roles Discord, validaciones de nombres), el sistema rediseñado SHALL producir exactamente el mismo comportamiento que el sistema original, preservando toda la funcionalidad existente.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

## Fix Implementation

### Changes Required

#### Archivo 1: Crear `data/equipos.json`

**Nuevo archivo**: `c:\Users\Juda\DiamondsBOT\data\equipos.json`

**Estructura JSON**:
```json
{
  "equipos": [
    {
      "id": "eq_8f8ad57b",
      "nombre": "Distrito Evolution",
      "abreviacion": "DIS",
      "color_primario": "#2A337A",
      "color_secundario": "#ECEDF8",
      "escudo": "https://cdn.discord...",
      "categoria_id": "d1",
      "role_id": "1557059444897095732",
      "channel_id": "1557059446293667952",
      "discord_emoji_id": "1557059451478085644",
      "created_at": "2026-10-06T15:58:20.197Z",
      "updated_at": "2026-10-06T15:58:22.153Z",
      "miembros": [
        {
          "discord_user_id": "1166181119113302036",
          "role": "DT",
          "haxball_nick": null,
          "joined_at": "2026-10-06T20:59:15.249Z"
        },
        {
          "discord_user_id": "1388288214774710427",
          "role": "PLAYER",
          "haxball_nick": "Kiyev",
          "joined_at": "2026-10-06T20:59:15.249Z"
        },
        {
          "discord_user_id": "1506006863290957937",
          "role": "PLAYER",
          "haxball_nick": "Juda67",
          "joined_at": "2026-10-06T16:57:08.974Z"
        }
      ]
    }
  ]
}
```

**Cambios específicos**:
1. **Eliminación de campos redundantes**: Remover `jugadores`, `director_tecnico_id`, `sub_director_tecnico_id` y `members` - toda la información va en `miembros`
2. **Array `miembros` unificado**: Contiene DT, SUB_DT y PLAYER en una sola estructura
3. **Consistencia en nombres**: Usar `discord_user_id` en todos lados (no `user_id`)

#### Archivo 2: Crear `data/transferencias.json`

**Nuevo archivo**: `c:\Users\Juda\DiamondsBOT\data\transferencias.json`

**Estructura JSON**:
```json
{
  "transferencias": [
    {
      "id": "trans_a1b2c3d4",
      "discord_user_id": "1388288214774710427",
      "from_team_id": null,
      "to_team_id": "eq_984efed4",
      "action": "SIGNED",
      "role": "PLAYER",
      "haxball_nick": "kyiev",
      "performed_by": "1506006863290957937",
      "timestamp": "2026-10-06T14:29:30.244Z"
    },
    {
      "id": "trans_b2c3d4e5",
      "discord_user_id": "1166181119113302036",
      "from_team_id": "eq_3cd0b452",
      "to_team_id": null,
      "action": "RELEASED",
      "role": "PLAYER",
      "haxball_nick": null,
      "performed_by": "1506006863290957937",
      "timestamp": "2026-10-06T15:33:49.086Z"
    },
    {
      "id": "trans_c3d4e5f6",
      "discord_user_id": "1506006863290957937",
      "from_team_id": "eq_8f8ad57b",
      "to_team_id": null,
      "action": "RESIGNED",
      "role": "PLAYER",
      "haxball_nick": "Juda67",
      "performed_by": "1506006863290957937",
      "timestamp": "2026-10-06T16:02:31.822Z"
    },
    {
      "id": "trans_d4e5f6a7",
      "discord_user_id": "1166181119113302036",
      "from_team_id": "eq_3cd0b452",
      "to_team_id": "eq_3cd0b452",
      "action": "SUB_DT_ASSIGNED",
      "role": "SUB_DT",
      "haxball_nick": null,
      "performed_by": "1506006863290957937",
      "timestamp": "2026-10-06T15:29:57.208Z"
    }
  ]
}
```

**Cambios específicos**:
1. **ID único para cada transferencia**: Agregar campo `id` generado con UUID
2. **Consolidación de acciones**: Unificar SIGNED, RELEASED, RESIGNED, SUB_DT_ASSIGNED, SUB_DT_REMOVED en un solo array
3. **Campo `role` obligatorio**: Incluir el rol del miembro en el momento de la transferencia
4. **Nombre consistente**: Usar `discord_user_id` en lugar de `user_id`

#### Archivo 3: Modificar `data/categorias.json`

**Archivo existente**: `c:\Users\Juda\DiamondsBOT\data\categorias.json`

**Cambios específicos**:
1. **Eliminar array `equipos`**: Mover todos los equipos a `equipos.json`
2. **Eliminar array `transferHistory`**: Mover todo el historial a `transferencias.json`
3. **Mantener solo array `categorias`**: Este archivo solo debe contener la lista de categorías de la liga

**Estructura JSON resultante**:
```json
{
  "categorias": [
    {
      "id": "d1",
      "nombre": "D1",
      "descripcion": "Primera División",
      "max_equipos": 8
    },
    {
      "id": "d2",
      "nombre": "D2",
      "descripcion": "Segunda División",
      "max_equipos": 10
    }
  ]
}
```

#### Archivo 4: Refactorizar `utils/db.js`

**Archivo**: `c:\Users\Juda\DiamondsBOT\utils\db.js`

**Funciones a ELIMINAR** (obsoletas con la nueva arquitectura):
1. `plantillaVacia()` - Ya no existen plantillas separadas
2. `construirPlantillaDesdeEquipo()` - No hay construcción de plantillas
3. `aplicarPlantillaAlEquipo()` - No hay aplicación de plantillas
4. `sincronizarEquipoDesdePlantilla()` - **Esta es la función clave que causa el bug**, se elimina completamente
5. `leerFichajes()` - Se reemplaza con `leerEquipos()` y `leerTransferencias()`
6. `guardarFichajes()` - Se reemplaza con `guardarEquipos()` y `guardarTransferencias()`
7. `obtenerPlantilla()` - Ya no existen plantillas

**Funciones a CREAR**:
1. `leerEquipos()` - Lee y retorna el contenido de `equipos.json`
2. `guardarEquipos(datos)` - Escribe datos en `equipos.json`
3. `leerTransferencias()` - Lee y retorna el contenido de `transferencias.json`
4. `guardarTransferencias(datos)` - Escribe datos en `transferencias.json`
5. `registrarTransferencia(transferencia)` - Agrega una nueva transferencia al historial
6. `obtenerTransferenciasPorUsuario(userId)` - Consulta historial de un usuario
7. `obtenerTransferenciasPorEquipo(teamId)` - Consulta historial de un equipo

**Funciones a MODIFICAR** (cambios significativos):

1. **`obtenerEquipos()`**:
   - **Antes**: `return leerDatos().equipos`
   - **Después**: `return leerEquipos().equipos`

2. **`obtenerEquipoPorId(id)`**:
   - **Antes**: `return leerDatos().equipos.find((e) => e.id === id) || null`
   - **Después**: `return leerEquipos().equipos.find((e) => e.id === id) || null`

3. **`obtenerEquiposPorCategoria(categoria_id)`**:
   - **Antes**: `return leerDatos().equipos.filter((e) => e.categoria_id === categoria_id)`
   - **Después**: `return leerEquipos().equipos.filter((e) => e.categoria_id === categoria_id)`

4. **`obtenerEquipoPorNombre(nombre)`**:
   - **Antes**: `return leerDatos().equipos.find(...)`
   - **Después**: `return leerEquipos().equipos.find(...)`

5. **`obtenerEquipoPorAbreviacion(abreviacion)`**:
   - **Antes**: `return leerDatos().equipos.find(...)`
   - **Después**: `return leerEquipos().equipos.find(...)`

6. **`obtenerEquipoPorJugador(userId)`**:
   - **Antes**: Busca en `fichajes.plantillas[].miembros`
   - **Después**: Busca directamente en `equipos.equipos[].miembros`
   ```javascript
   const equipos = leerEquipos().equipos;
   return equipos.find(eq => 
     eq.miembros.some(m => mismoId(m.discord_user_id, userId))
   ) || null;
   ```

7. **`obtenerMiembro(userId)`**:
   - **Antes**: Busca en plantillas de `fichajes.json`
   - **Después**: Busca directamente en equipos
   ```javascript
   const equipos = leerEquipos().equipos;
   for (const equipo of equipos) {
     const miembro = equipo.miembros.find(m => mismoId(m.discord_user_id, userId));
     if (miembro) {
       return { team_id: equipo.id, ...miembro };
     }
   }
   return null;
   ```

8. **`registrarMiembro(teamId, userId, role, haxballNick, performedBy)`**:
   - **Antes**: Escribe en fichajes.plantillas, luego en fichajes.fichados, luego llama `sincronizarEquipoDesdePlantilla()`
   - **Después**: Escribe directamente en equipos.miembros y registra en transferencias
   ```javascript
   const datos = leerEquipos();
   const equipo = datos.equipos.find(e => e.id === teamId);
   if (!equipo) throw new Error(`Equipo inexistente: ${teamId}`);

   // Verificar que no esté en otro equipo
   const ocupado = datos.equipos.find(e => 
     e.id !== teamId && e.miembros.some(m => mismoId(m.discord_user_id, userId))
   );
   if (ocupado) throw new Error(`Usuario ${userId} ya pertenece a ${ocupado.nombre}`);

   // Agregar o actualizar miembro
   const existente = equipo.miembros.find(m => mismoId(m.discord_user_id, userId));
   const miembro = {
     discord_user_id: String(userId),
     role,
     haxball_nick: haxballNick ?? existente?.haxball_nick ?? null,
     joined_at: existente?.joined_at || new Date().toISOString()
   };
   
   equipo.miembros = equipo.miembros.filter(m => !mismoId(m.discord_user_id, userId));
   equipo.miembros.push(miembro);
   equipo.updated_at = new Date().toISOString();
   
   guardarEquipos(datos);

   // Registrar en historial de transferencias
   if (performedBy) {
     registrarTransferencia({
       discord_user_id: String(userId),
       from_team_id: null,
       to_team_id: teamId,
       action: 'SIGNED',
       role,
       haxball_nick: miembro.haxball_nick,
       performed_by: performedBy
     });
   }

   return { team_id: teamId, ...miembro };
   ```

9. **`quitarMiembro(teamId, userId, action, performedBy)`**:
   - **Antes**: Modifica plantilla en fichajes.json, agrega a bajas, llama sincronización
   - **Después**: Modifica directamente equipo.miembros y registra transferencia
   ```javascript
   const datos = leerEquipos();
   const equipo = datos.equipos.find(e => e.id === teamId);
   if (!equipo) throw new Error(`Equipo inexistente: ${teamId}`);

   const miembro = equipo.miembros.find(m => mismoId(m.discord_user_id, userId));
   if (!miembro) throw new Error(`Usuario ${userId} no pertenece al equipo`);

   equipo.miembros = equipo.miembros.filter(m => !mismoId(m.discord_user_id, userId));
   equipo.updated_at = new Date().toISOString();
   
   guardarEquipos(datos);

   // Registrar en historial
   registrarTransferencia({
     discord_user_id: String(userId),
     from_team_id: teamId,
     to_team_id: null,
     action,
     role: miembro.role,
     haxball_nick: miembro.haxball_nick,
     performed_by: performedBy
   });

   return { role: miembro.role, member: miembro };
   ```

10. **`asignarSubDt(teamId, userId, performedBy)`**:
    - **Antes**: Modifica plantilla y llama sincronización
    - **Después**: Modifica directamente miembro.role en equipo
    ```javascript
    const datos = leerEquipos();
    const equipo = datos.equipos.find(e => e.id === teamId);
    if (!equipo) throw new Error(`Equipo inexistente: ${teamId}`);
    
    if (equipo.miembros.some(m => m.role === 'SUB_DT')) {
      throw new Error('El equipo ya tiene Sub-Director Técnico.');
    }
    
    const miembro = equipo.miembros.find(m => mismoId(m.discord_user_id, userId));
    if (!miembro) throw new Error('El usuario no pertenece a la plantilla.');
    
    miembro.role = 'SUB_DT';
    equipo.updated_at = new Date().toISOString();
    
    guardarEquipos(datos);

    // Registrar cambio de rol
    registrarTransferencia({
      discord_user_id: String(userId),
      from_team_id: teamId,
      to_team_id: teamId,
      action: 'SUB_DT_ASSIGNED',
      role: 'SUB_DT',
      haxball_nick: miembro.haxball_nick,
      performed_by: performedBy
    });

    return miembro;
    ```

11. **`quitarSubDt(teamId, userId, performedBy)`**:
    - Similar a `asignarSubDt`, modifica role directamente y registra transferencia con action='SUB_DT_REMOVED'

12. **`crearEquipo(datos_equipo)`**:
    - **Antes**: Crea en categorias.json, luego crea plantilla en fichajes.json, luego sincroniza
    - **Después**: Crea directamente en equipos.json con array miembros inicializado
    ```javascript
    const datos = leerEquipos();
    const id = `eq_${randomUUID().slice(0, 8)}`;
    const ahora = new Date().toISOString();
    
    const equipo = {
      id,
      ...datos_equipo,
      miembros: datos_equipo.miembros || [],
      created_at: ahora,
      updated_at: ahora
    };
    
    datos.equipos.push(equipo);
    guardarEquipos(datos);
    
    return equipo;
    ```

13. **`actualizarEquipo(id, campos)`**:
    - **Antes**: Actualiza en categorias.json, luego actualiza plantilla si cambió el nombre
    - **Después**: Actualiza directamente en equipos.json
    ```javascript
    const datos = leerEquipos();
    const idx = datos.equipos.findIndex(e => e.id === id);
    if (idx === -1) return null;
    
    datos.equipos[idx] = {
      ...datos.equipos[idx],
      ...campos,
      updated_at: new Date().toISOString()
    };
    
    guardarEquipos(datos);
    return datos.equipos[idx];
    ```

14. **`eliminarEquipoPorId(id)`**:
    - **Antes**: Elimina de categorias.json y plantilla de fichajes.json
    - **Después**: Elimina solo de equipos.json
    ```javascript
    const datos = leerEquipos();
    const idx = datos.equipos.findIndex(e => e.id === id);
    if (idx === -1) return false;
    
    datos.equipos.splice(idx, 1);
    guardarEquipos(datos);
    
    return true;
    ```

15. **`agregarHistorial(entry)`**:
    - **Antes**: Agrega a fichajes.fichados o fichajes.bajas según action
    - **Después**: Llama a `registrarTransferencia(entry)` directamente

**Funciones que NO cambian** (solo leen categorias.json):
- `leerDatos()` - Ahora solo lee categorias.json que tiene solo las categorías
- `guardarDatos()` - Solo guarda categorias.json
- `obtenerCategorias()`
- `obtenerCategoriaPorId()`
- `obtenerCategoriaPorNombre()`
- `crearCategoria()`
- `editarCategoria()`
- `eliminarCategoria()`
- `cuposDisponibles()`
- `categoriaLlena()`

**Funciones de solicitudes que NO cambian**:
- `leerSolicitudes()`
- `guardarSolicitudes()`
- `obtenerSolicitudPorId()`
- `crearSolicitud()`
- `actualizarSolicitud()`
- `solicitudPendientePorNombre()`

#### Archivo 5: Script de migración `utils/migration.js`

**Nuevo archivo**: `c:\Users\Juda\DiamondsBOT\utils\migration.js`

**Propósito**: Script ejecutable una sola vez que migra datos de la estructura antigua a la nueva

**Funcionalidad**:
1. Leer `categorias.json` y extraer array `equipos`
2. Leer `fichajes.json` y extraer arrays `plantillas`, `fichados`, `bajas`
3. Consolidar equipos + plantillas → `equipos.json`
4. Consolidar fichados + bajas + transferHistory → `transferencias.json`
5. Limpiar `categorias.json` dejando solo categorías
6. Crear backups de archivos originales con timestamp
7. Validar integridad de datos migrados

**Pseudocódigo**:
```javascript
function migrarDatos() {
  // 1. Crear backups
  backupFile('categorias.json', `categorias.backup.${timestamp}.json`);
  backupFile('fichajes.json', `fichajes.backup.${timestamp}.json`);

  // 2. Leer datos antiguos
  const categorias = leerJSON('categorias.json');
  const fichajes = leerJSON('fichajes.json');

  // 3. Construir equipos consolidados
  const equiposNuevos = [];
  for (const equipo of categorias.equipos) {
    const plantilla = fichajes.plantillas.find(p => p.team_id === equipo.id);
    const equipoConsolidado = {
      ...equipo,
      miembros: plantilla?.miembros || []
    };
    delete equipoConsolidado.jugadores;
    delete equipoConsolidado.director_tecnico_id;
    delete equipoConsolidado.sub_director_tecnico_id;
    delete equipoConsolidado.members;
    equiposNuevos.push(equipoConsolidado);
  }

  // 4. Consolidar transferencias
  const transferenciasNuevas = [];
  
  // Agregar desde transferHistory
  for (const trans of categorias.transferHistory || []) {
    transferenciasNuevas.push({
      id: `trans_${randomUUID().slice(0, 8)}`,
      discord_user_id: trans.user_id,
      from_team_id: trans.from_team_id || null,
      to_team_id: trans.to_team_id || null,
      action: trans.action,
      role: inferRole(trans),
      haxball_nick: trans.haxball_nick || null,
      performed_by: trans.performed_by,
      timestamp: trans.timestamp
    });
  }

  // Agregar desde fichajes.fichados
  for (const fichado of fichajes.fichados || []) {
    if (!yaExiste(transferenciasNuevas, fichado)) {
      transferenciasNuevas.push({
        id: `trans_${randomUUID().slice(0, 8)}`,
        discord_user_id: fichado.user_id,
        from_team_id: null,
        to_team_id: fichado.team_id,
        action: 'SIGNED',
        role: fichado.role || 'PLAYER',
        haxball_nick: fichado.haxball_nick,
        performed_by: fichado.performed_by,
        timestamp: fichado.timestamp
      });
    }
  }

  // Agregar desde fichajes.bajas
  for (const baja of fichajes.bajas || []) {
    if (!yaExiste(transferenciasNuevas, baja)) {
      transferenciasNuevas.push({
        id: `trans_${randomUUID().slice(0, 8)}`,
        discord_user_id: baja.user_id,
        from_team_id: baja.team_id,
        to_team_id: null,
        action: baja.motivo,
        role: baja.role || 'PLAYER',
        haxball_nick: baja.haxball_nick,
        performed_by: baja.performed_by,
        timestamp: baja.timestamp
      });
    }
  }

  // 5. Ordenar por timestamp
  transferenciasNuevas.sort((a, b) => 
    new Date(a.timestamp) - new Date(b.timestamp)
  );

  // 6. Escribir nuevos archivos
  escribirJSON('equipos.json', { equipos: equiposNuevos });
  escribirJSON('transferencias.json', { transferencias: transferenciasNuevas });

  // 7. Limpiar categorias.json
  escribirJSON('categorias.json', {
    categorias: categorias.categorias
  });

  // 8. Validar
  validarIntegridad(equiposNuevos, transferenciasNuevas);

  console.log('✅ Migración completada exitosamente');
}
```

#### Archivos de comandos a actualizar

**Comandos que requieren actualización**:

1. **`commands/fichar.js`**:
   - Cambiar llamadas a funciones de `db.js` actualizadas
   - No requiere cambios en lógica, solo adaptación a nuevas funciones

2. **`commands/plantilla.js`**:
   - Cambiar de `obtenerPlantilla()` a acceder directamente `equipo.miembros`
   - Actualizar formato de visualización si es necesario

3. **`commands/dar-de-baja.js`**:
   - Usar `quitarMiembro()` actualizado
   - No requiere cambios significativos

4. **`commands/renunciar.js`**:
   - Usar `quitarMiembro()` actualizado con action='RESIGNED'

5. **`commands/add-equipo.js`**:
   - Usar `crearEquipo()` actualizado
   - Pasar miembros iniciales en el objeto datos_equipo

6. **`commands/inscribir-equipo.js`**:
   - Cambiar creación de equipo desde solicitud aprobada
   - Construir array `miembros` desde la solicitud

7. **`commands/asignar-subdt.js`**:
   - Usar `asignarSubDt()` actualizado

8. **`commands/quitar-subdt.js`**:
   - Usar `quitarSubDt()` actualizado

9. **`commands/edit-equipo.js`**:
   - Usar `actualizarEquipo()` actualizado

10. **`commands/eliminate-equipo.js`**:
    - Usar `eliminarEquipoPorId()` actualizado

11. **`commands/ver-equipos.js`**:
    - Usar `obtenerEquipos()` actualizado

**Utilidades que requieren actualización**:

1. **`utils/teamService.js`**:
   - Revisar todas las funciones que usan el sistema de fichajes
   - Actualizar para usar nuevas funciones de `db.js`

2. **`utils/rosterCommands.js`**:
   - Si contiene lógica de plantillas, actualizar a usar `equipo.miembros`

## Testing Strategy

### Validation Approach

La estrategia de validación sigue un enfoque de tres fases: primero ejecutar el script de migración en un entorno de prueba para verificar la consolidación de datos, luego validar que todas las operaciones CRUD funcionan correctamente con la nueva estructura, y finalmente confirmar que las funcionalidades no relacionadas (preservation) permanecen inalteradas.

### Exploratory Bug Condition Checking

**Goal**: Demostrar que la estructura actual REQUIERE sincronización manual y acceso a múltiples archivos, confirmando el bug antes de implementar el fix.

**Test Plan**: Escribir tests que traceen las llamadas a funciones durante operaciones comunes y cuenten cuántas lecturas/escrituras de archivo se realizan. Ejecutar estos tests en el código UNFIXED para evidenciar el problema.

**Test Cases**:
1. **Test de Registro de Miembro**: Llamar `registrarMiembro()` y verificar que:
   - Se escribe en `fichajes.json` (plantillas)
   - Se escribe en `fichajes.json` (fichados)
   - Se llama `sincronizarEquipoDesdePlantilla()`
   - Se lee y escribe `categorias.json`
   - **Total: 2 archivos modificados, 3 operaciones de escritura**

2. **Test de Consulta de Miembro**: Llamar `obtenerMiembro(userId)` y verificar que:
   - Se lee `fichajes.json` completo
   - Se itera sobre todas las plantillas
   - **Total: Búsqueda O(n) donde n = número de equipos**

3. **Test de Actualización de Nombre**: Llamar `actualizarEquipo(id, { nombre })` y verificar que:
   - Se actualiza en `categorias.json`
   - Se busca y actualiza en `fichajes.json`
   - **Total: 2 archivos modificados**

4. **Test de Historial Fragmentado**: Verificar que una sola transferencia genera registros en:
   - `categorias.transferHistory`
   - `fichajes.fichados` o `fichajes.bajas`
   - **Total: Duplicación de información**

**Expected Counterexamples**:
- Operaciones simples requieren múltiples lecturas/escrituras de archivo
- Necesidad constante de llamar `sincronizarEquipoDesdePlantilla()`
- Datos duplicados en diferentes arrays y archivos

### Fix Checking

**Goal**: Verificar que todas las operaciones con la nueva estructura requieren solo UN archivo y NO necesitan sincronización.

**Pseudocode:**
```
FOR ALL operation IN ['registrarMiembro', 'quitarMiembro', 'obtenerMiembro', 'actualizarEquipo'] DO
  result := executeOperation_FIXED(operation)
  ASSERT fileAccessCount(result) == 1
  ASSERT NOT callsSync(result)
  ASSERT correctData(result)
END FOR
```

**Test Cases**:
1. **Test de Registro de Miembro (Fixed)**: Verificar que:
   - Se modifica solo `equipos.json` (agregar a miembros)
   - Se agrega registro a `transferencias.json`
   - NO se llama sincronización
   - **Total: 2 operaciones atómicas en archivos independientes**

2. **Test de Consulta de Miembro (Fixed)**: Verificar que:
   - Se lee `equipos.json` una vez
   - Búsqueda directa en `equipo.miembros`
   - **Total: 1 lectura, acceso O(1) al equipo si se indexa**

3. **Test de Actualización de Nombre (Fixed)**: Verificar que:
   - Se modifica solo `equipos.json`
   - **Total: 1 archivo modificado**

4. **Test de Migración Completa**: Ejecutar script de migración y verificar:
   - Todos los equipos se migraron correctamente
   - Todos los miembros están en sus equipos
   - Todas las transferencias se consolidaron sin duplicados
   - Archivos backup se crearon correctamente

### Preservation Checking

**Goal**: Verificar que operaciones no relacionadas con equipos/miembros producen exactamente el mismo resultado antes y después de la reestructuración.

**Pseudocode:**
```
FOR ALL operation WHERE NOT involucraEquiposOMiembros(operation) DO
  result_old := executeOperation_ORIGINAL(operation)
  result_new := executeOperation_FIXED(operation)
  ASSERT result_old == result_new
END FOR
```

**Testing Approach**: Property-based testing es recomendado porque:
- Genera automáticamente casos de prueba para operaciones de categorías
- Detecta edge cases en cálculos de cupos
- Verifica que servicios de Discord se comportan igual

**Test Plan**: Ejecutar operaciones en ambas versiones (antes y después del fix) y comparar resultados exactos.

**Test Cases**:
1. **Test de Gestión de Categorías**: Verificar que `crearCategoria()`, `editarCategoria()`, `eliminarCategoria()` funcionan exactamente igual
2. **Test de Cupos Disponibles**: Verificar que `cuposDisponibles()` y `categoriaLlena()` retornan los mismos valores
3. **Test de Solicitudes**: Verificar que todo el flujo de solicitudes (crear, actualizar, aprobar, rechazar) funciona igual
4. **Test de Validaciones**: Verificar que validaciones de nombres únicos, abreviaciones, etc. funcionan igual

### Unit Tests

**Categorías de pruebas unitarias**:

1. **Tests de funciones de lectura/escritura**:
   - `leerEquipos()` debe retornar objeto con array equipos
   - `guardarEquipos()` debe escribir JSON válido
   - `leerTransferencias()` debe retornar objeto con array transferencias
   - `guardarTransferencias()` debe escribir JSON válido

2. **Tests de operaciones CRUD de equipos**:
   - `crearEquipo()` debe generar ID único y timestamps
   - `actualizarEquipo()` debe actualizar updated_at
   - `eliminarEquipoPorId()` debe remover equipo correctamente
   - `obtenerEquipoPorId()` debe retornar equipo o null

3. **Tests de gestión de miembros**:
   - `registrarMiembro()` debe agregar miembro al array
   - `quitarMiembro()` debe remover miembro del array
   - `obtenerMiembro()` debe encontrar miembro en cualquier equipo
   - `asignarSubDt()` debe cambiar role a SUB_DT
   - `quitarSubDt()` debe cambiar role a PLAYER

4. **Tests de transferencias**:
   - `registrarTransferencia()` debe generar ID único
   - `obtenerTransferenciasPorUsuario()` debe filtrar por usuario
   - `obtenerTransferenciasPorEquipo()` debe filtrar por equipo

5. **Tests de validaciones**:
   - No permitir registrar miembro en dos equipos simultáneamente
   - No permitir asignar SUB_DT si ya existe uno
   - Validar que userId sea string

6. **Tests de migración**:
   - Migrar equipo simple sin miembros
   - Migrar equipo con DT, SUB_DT y jugadores
   - Migrar historial sin duplicados
   - Validar que backups se crean correctamente

### Property-Based Tests

**Propiedades invariantes del sistema**:

1. **Property: Unicidad de miembros**:
   - _For any_ usuario con `discord_user_id` válido, el usuario SHALL pertenecer a máximo un equipo a la vez
   - Generador: Crear múltiples equipos y usuarios aleatorios, intentar registrar mismo usuario en varios equipos
   - Verificación: Llamar `obtenerMiembro(userId)` debe retornar máximo un equipo

2. **Property: Consistencia de roles**:
   - _For any_ equipo, el equipo SHALL tener máximo un DT y máximo un SUB_DT
   - Generador: Crear equipos aleatorios con diferentes combinaciones de miembros
   - Verificación: Contar miembros con role='DT' y role='SUB_DT', debe ser ≤ 1 para cada uno

3. **Property: Integridad referencial de transferencias**:
   - _For any_ transferencia con `to_team_id` no nulo, el equipo referenciado SHALL existir en `equipos.json`
   - Generador: Crear transferencias aleatorias
   - Verificación: Para cada `to_team_id` y `from_team_id`, validar que `obtenerEquipoPorId()` retorna equipo válido

4. **Property: Preservación de cupos**:
   - _For any_ categoría, después de cualquier operación de equipos, el número de equipos en esa categoría SHALL ser ≤ max_equipos
   - Generador: Crear categorías con límites aleatorios, intentar agregar equipos
   - Verificación: `cuposDisponibles()` debe ser ≥ 0 siempre

5. **Property: Timestamp ordering**:
   - _For any_ secuencia de operaciones, los `updated_at` de equipos y `timestamp` de transferencias SHALL estar ordenados cronológicamente
   - Generador: Ejecutar secuencia aleatoria de operaciones CRUD
   - Verificación: Timestamps de modificaciones sucesivas deben ser crecientes

### Integration Tests

**Tests de flujo completo**:

1. **Test: Flujo completo de inscripción de equipo**:
   - Crear solicitud con `crearSolicitud()`
   - Aprobar con `actualizarSolicitud()`
   - Crear equipo desde solicitud con `crearEquipo()`
   - Verificar que equipo existe en `equipos.json`
   - Verificar que miembros iniciales están registrados
   - Verificar que no se creó plantilla separada

2. **Test: Flujo de fichaje de jugador**:
   - Crear equipo con DT
   - Fichar jugador con `registrarMiembro()`
   - Verificar que jugador está en `equipo.miembros`
   - Verificar que transferencia se registró en `transferencias.json`
   - Intentar fichar mismo jugador en otro equipo (debe fallar)

3. **Test: Flujo de cambios de rol**:
   - Crear equipo con jugadores
   - Asignar SUB_DT con `asignarSubDt()`
   - Verificar cambio de rol
   - Quitar SUB_DT con `quitarSubDt()`
   - Verificar que vuelve a ser PLAYER
   - Verificar que ambas operaciones se registraron en transferencias

4. **Test: Flujo de migración y validación**:
   - Ejecutar script de migración con datos de prueba
   - Verificar que todos los equipos migraron
   - Ejecutar operaciones CRUD en datos migrados
   - Verificar que comandos funcionan correctamente
   - Comparar resultados con sistema antiguo

5. **Test: Flujo de eliminación de equipo**:
   - Crear equipo con miembros
   - Registrar transferencias
   - Eliminar equipo con `eliminarEquipoPorId()`
   - Verificar que equipo ya no existe
   - Verificar que transferencias históricas se mantienen
   - Verificar que usuarios quedan libres para fichar en otros equipos

6. **Test: Flujo de consulta de historial**:
   - Crear múltiples transferencias para un usuario
   - Consultar con `obtenerTransferenciasPorUsuario()`
   - Verificar que retorna historial completo ordenado
   - Consultar transferencias de un equipo
   - Verificar que incluye fichajes y bajas del equipo
