# Bugfix Requirements Document

## Introduction

El comando `/fichar` actualmente verifica la disponibilidad de un jugador consultando únicamente la base de datos JSON (`fichajes.json`), sin considerar los roles de Discord del usuario. Esto causa un problema crítico: cuando un administrador remueve manualmente el rol de equipo de un jugador en Discord, el sistema sigue considerándolo como miembro activo del equipo porque el registro JSON no se actualizó. Como resultado, el jugador no puede ser fichado por ningún equipo a pesar de no tener rol activo.

Este bug afecta la gestión del mercado de fichajes y genera inconsistencias entre el estado real en Discord y los registros internos del sistema.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN un jugador tiene registro en fichajes.json pero no tiene ningún rol de equipo en Discord THEN el sistema rechaza las propuestas de fichaje indicando que el jugador "ya forma parte de un equipo"

1.2 WHEN se ejecuta `/fichar` sobre un usuario THEN el sistema verifica disponibilidad usando únicamente `db.obtenerMiembro(target.id)` sin validar los roles de Discord actuales

1.3 WHEN un administrador remueve manualmente el rol de equipo de un jugador THEN el registro en fichajes.json permanece sin cambios, causando inconsistencia de datos

### Expected Behavior (Correct)

2.1 WHEN un jugador no tiene ningún rol de equipo en Discord THEN el sistema SHALL permitir que reciba propuestas de fichaje independientemente del estado del JSON

2.2 WHEN se ejecuta `/fichar` sobre un usuario THEN el sistema SHALL verificar primero los roles de Discord del usuario antes de consultar la base de datos JSON

2.3 WHEN un jugador tiene registro en fichajes.json pero no tiene rol de equipo en Discord THEN el sistema SHALL considerar al jugador como "libre" y disponible para fichar

2.4 WHEN un jugador no tiene ningún rol de equipo en Discord THEN el sistema SHALL poder limpiar automáticamente registros obsoletos en fichajes.json o marcarlos como inválidos

### Unchanged Behavior (Regression Prevention)

3.1 WHEN un jugador tiene un rol de equipo activo en Discord y registro en fichajes.json THEN el sistema SHALL CONTINUE TO rechazar propuestas de fichaje indicando que el jugador ya tiene equipo

3.2 WHEN un jugador es director técnico (DT) o subdirector técnico (SUB_DT) THEN el sistema SHALL CONTINUE TO rechazar propuestas de fichaje con el mensaje apropiado

3.3 WHEN un jugador es fichado exitosamente THEN el sistema SHALL CONTINUE TO crear el registro en fichajes.json, asignar el rol de Discord y notificar públicamente

3.4 WHEN un bot o el mismo usuario intenta ficharse THEN el sistema SHALL CONTINUE TO rechazar la operación con el mensaje de error apropiado

3.5 WHEN el comando `/fichar` se ejecuta fuera del canal designado THEN el sistema SHALL CONTINUE TO rechazar la operación indicando el canal correcto
