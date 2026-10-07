# Bugfix Requirements Document

## Introduction

El sistema actual de mercado de fichajes presenta una arquitectura deficiente con dispersión de datos, duplicación de información y falta de centralización. Los datos de equipos, jugadores, técnicos y fichajes están fragmentados entre múltiples archivos JSON (`categorias.json`, `fichajes.json`, `solicitudes.json`) con estructuras inconsistentes que requieren sincronización manual constante. Esta arquitectura dificulta la gestión, consulta y mantenimiento de la información del sistema de transferencias.

Este bugfix rediseña completamente la arquitectura de datos para consolidar la información en una estructura JSON optimizada y centralizada, eliminando duplicaciones y simplificando el acceso a los datos.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN el sistema necesita acceder a información de un equipo THEN debe consultar datos dispersos entre `categorias.json` (equipo base), `fichajes.json` (plantilla/miembros) y `solicitudes.json` (historial de inscripción)

1.2 WHEN el sistema registra un miembro de equipo THEN duplica la información en dos ubicaciones: `equipo.members` en categorias.json y `plantilla.miembros` en fichajes.json, requiriendo llamadas a `sincronizarEquipoDesdePlantilla()`

1.3 WHEN el sistema guarda el historial de transferencias THEN almacena información redundante en tres lugares: `transferHistory` en categorias.json, `fichados` array en fichajes.json, y `bajas` array en fichajes.json

1.4 WHEN el sistema consulta los miembros de un equipo THEN debe leer `fichajes.json`, buscar la plantilla correspondiente, y sincronizar con `categorias.json` para obtener información completa

1.5 WHEN se crea un equipo THEN el sistema debe mantener manualmente la consistencia creando entradas en `categorias.json` (equipo) y `fichajes.json` (plantilla vacía)

1.6 WHEN el sistema necesita validar si un usuario pertenece a un equipo THEN debe buscar en las plantillas de `fichajes.json` en lugar de consultar directamente la estructura del equipo

1.7 WHEN se actualiza el nombre de un equipo THEN el sistema debe actualizar el dato en múltiples ubicaciones (equipo en categorias.json, plantilla en fichajes.json) manualmente

1.8 WHEN el sistema gestiona solicitudes de inscripción THEN almacena los datos en `solicitudes.json` sin estructura relacionada con el modelo final de equipos

### Expected Behavior (Correct)

2.1 WHEN el sistema necesita acceder a información de un equipo THEN SHALL consultar un único archivo `equipos.json` que contenga toda la información centralizada del equipo incluyendo técnicos y jugadores

2.2 WHEN el sistema registra un miembro de equipo THEN SHALL almacenar la información una sola vez en la estructura del equipo dentro de `equipos.json` sin necesidad de sincronización

2.3 WHEN el sistema guarda el historial de transferencias THEN SHALL almacenar todas las transferencias (fichajes y bajas) en un único array consolidado en `transferencias.json`

2.4 WHEN el sistema consulta los miembros de un equipo THEN SHALL acceder directamente al array `miembros` dentro del objeto equipo en `equipos.json`

2.5 WHEN se crea un equipo THEN el sistema SHALL agregar un único objeto equipo con toda su información (nombre, colores, DT, SUB_DT, jugadores) a `equipos.json`

2.6 WHEN el sistema necesita validar si un usuario pertenece a un equipo THEN SHALL buscar directamente en el array `miembros` del equipo en `equipos.json`

2.7 WHEN se actualiza el nombre de un equipo THEN el sistema SHALL actualizar únicamente el campo `nombre` en el objeto equipo en `equipos.json`

2.8 WHEN el sistema gestiona el historial de solicitudes THEN SHALL mantener el archivo `solicitudes.json` separado para el proceso de inscripción, pero una vez aprobado el equipo se crea en `equipos.json` con la estructura centralizada

### Unchanged Behavior (Regression Prevention)

3.1 WHEN el sistema lee categorías de la liga THEN el sistema SHALL CONTINUE TO leer las categorías desde `categorias.json` con su estructura actual (id, nombre, descripcion, max_equipos)

3.2 WHEN el sistema verifica cupos disponibles en una categoría THEN el sistema SHALL CONTINUE TO calcular la diferencia entre max_equipos y el número de equipos inscritos

3.3 WHEN el sistema crea roles y canales de Discord para un equipo THEN el sistema SHALL CONTINUE TO usar las mismas funciones de Discord.js con los mismos permisos

3.4 WHEN el sistema valida abreviaciones de equipo únicas THEN el sistema SHALL CONTINUE TO verificar que no existan abreviaciones duplicadas entre equipos

3.5 WHEN el sistema sincroniza emojis de equipos THEN el sistema SHALL CONTINUE TO usar el servicio de emojis con la misma lógica

3.6 WHEN el sistema formatea nombres para canales de Discord THEN el sistema SHALL CONTINUE TO normalizar y sanitizar los nombres usando la función `nombreACanal()`

3.7 WHEN el sistema maneja errores de permisos de Discord THEN el sistema SHALL CONTINUE TO proporcionar mensajes de error descriptivos sobre permisos faltantes

3.8 WHEN comandos de slash consultan información de equipos THEN el sistema SHALL CONTINUE TO funcionar correctamente con las nuevas funciones de lectura optimizadas de db.js
