# Implementation Plan

## Overview
Este plan de implementación reestructura la arquitectura de datos del sistema de mercado de fichajes, eliminando la fragmentación de datos entre múltiples archivos JSON y la necesidad de sincronización manual. El plan sigue el workflow de bugfix con pruebas exploratorias antes de implementar el fix.

---

## Phase 1: Exploratory Testing (BEFORE Fix)

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Multiple File Access and Manual Sync
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Test that operations like `registrarMiembro()`, `obtenerMiembro()`, and `actualizarEquipo()` require multiple file accesses and synchronization calls
  - Create test file `tests/bugCondition.test.js` that instruments file system operations
  - Test implementation details from Bug Condition in design:
    - Trace `registrarMiembro()` and verify it writes to `fichajes.json` twice (plantillas + fichados) and calls `sincronizarEquipoDesdePlantilla()`
    - Trace `obtenerMiembro()` and verify it reads `fichajes.json` and iterates over all plantillas
    - Trace `actualizarEquipo()` with name change and verify it modifies both `categorias.json` and `fichajes.json`
    - Trace transfer operations and verify data is duplicated in `categorias.transferHistory`, `fichajes.fichados`, and `fichajes.bajas`
  - The test assertions should match the Expected Behavior Properties from design:
    - After fix: operations should access only one file per entity type
    - After fix: no synchronization calls should be required
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found:
    - Count of file operations per function call
    - Number of sync calls required
    - Evidence of data duplication
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.1, 2.2, 2.4, 2.6_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Refactored Functionality
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (operations that don't involve equipos/miembros data)
  - Create test file `tests/preservation.test.js`
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - Test that `obtenerCategorias()` returns correct category list
    - Test that `cuposDisponibles(categoria_id)` calculates available slots correctly
    - Test that `crearCategoria()` adds category to categorias.json only
    - Test that `leerSolicitudes()` and `crearSolicitud()` work correctly
    - Test that Discord role/channel creation utilities function as expected
    - Test that validation functions (abreviación única, nombre único) work correctly
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

---

## Phase 2: Data Migration and File Creation

- [ ] 3. Create new data structure files

  - [ ] 3.1 Create `data/equipos.json`
    - Create new file with consolidated team structure
    - Schema: `{ "equipos": [] }`
    - Each equipo contains:
      - All existing team fields (id, nombre, abreviacion, colores, escudo, categoria_id, role_id, channel_id, discord_emoji_id, timestamps)
      - Unified `miembros` array (replaces jugadores, director_tecnico_id, sub_director_tecnico_id, members)
      - Each miembro has: discord_user_id, role (DT/SUB_DT/PLAYER), haxball_nick, joined_at
    - Initialize as empty array (will be populated by migration script)
    - _Bug_Condition: C(X) = operations require access to single consolidated file_
    - _Expected_Behavior: All team data accessible from one location without sync_
    - _Preservation: Does not affect categorias, solicitudes, or Discord utilities_
    - _Requirements: 2.1, 2.2_

  - [ ] 3.2 Create `data/transferencias.json`
    - Create new file with consolidated transfer history
    - Schema: `{ "transferencias": [] }`
    - Each transferencia contains:
      - id (unique identifier)
      - discord_user_id
      - from_team_id (null for signings)
      - to_team_id (null for releases/resignations)
      - action (SIGNED, RELEASED, RESIGNED, SUB_DT_ASSIGNED, SUB_DT_REMOVED)
      - role (DT, SUB_DT, PLAYER)
      - haxball_nick
      - performed_by
      - timestamp
    - Initialize as empty array (will be populated by migration script)
    - _Bug_Condition: C(X) = no more duplication across multiple arrays_
    - _Expected_Behavior: Single source of truth for all transfer history_
    - _Preservation: Does not affect existing functionality_
    - _Requirements: 2.3_

  - [ ] 3.3 Create migration script `utils/migration.js`
    - Implement data migration from old structure to new structure
    - Create timestamped backups before migration:
      - `categorias.backup.[timestamp].json`
      - `fichajes.backup.[timestamp].json`
    - Read existing data:
      - `categorias.json` → extract equipos array and transferHistory
      - `fichajes.json` → extract plantillas, fichados, bajas
    - Consolidate equipos:
      - Merge equipo from categorias with matching plantilla from fichajes
      - Map plantilla.miembros → equipo.miembros
      - Remove obsolete fields (jugadores, director_tecnico_id, sub_director_tecnico_id, members)
      - Ensure discord_user_id consistency (convert all to strings)
    - Consolidate transferencias:
      - Merge transferHistory + fichados + bajas
      - Generate unique IDs for each transferencia
      - Deduplicate entries (same user, team, timestamp)
      - Sort by timestamp ascending
      - Normalize field names (user_id → discord_user_id)
    - Write new files:
      - `equipos.json` with consolidated teams
      - `transferencias.json` with consolidated history
    - Update `categorias.json`:
      - Remove equipos array
      - Remove transferHistory array
      - Keep only categorias array
    - Validation checks:
      - Verify all teams were migrated
      - Verify all miembros were preserved
      - Verify all transfers were consolidated
      - Compare counts and log any discrepancies
    - Add rollback function in case of validation failure
    - _Bug_Condition: Migration eliminates multi-file data duplication_
    - _Expected_Behavior: All data successfully consolidated with integrity preserved_
    - _Preservation: Original data backed up and restorable_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 3.4 Execute migration script
    - Run `node utils/migration.js` to migrate existing data
    - Verify backup files were created
    - Review migration logs for any warnings or errors
    - Manually inspect new files to confirm data integrity:
      - Check that equipos.json contains all teams with miembros
      - Check that transferencias.json has complete history
      - Check that categorias.json only has categorias array
    - Keep backup files in case rollback is needed
    - _Bug_Condition: Data successfully migrated from fragmented to consolidated structure_
    - _Expected_Behavior: New files populated with correct data_
    - _Preservation: Original backups available for rollback_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

---

## Phase 3: Refactor Database Layer

- [ ] 4. Refactor `utils/db.js`

  - [ ] 4.1 Add new file I/O functions
    - Implement `leerEquipos()` to read `data/equipos.json`
    - Implement `guardarEquipos(datos)` to write to `data/equipos.json`
    - Implement `leerTransferencias()` to read `data/transferencias.json`
    - Implement `guardarTransferencias(datos)` to write to `data/transferencias.json`
    - Add error handling for file operations
    - _Bug_Condition: New functions access single consolidated files_
    - _Expected_Behavior: Clean separation of data access by entity type_
    - _Preservation: Existing leerDatos/guardarDatos for categorias unchanged_
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 4.2 Implement transfer history functions
    - Implement `registrarTransferencia(transferencia)`:
      - Generate unique ID with `trans_${randomUUID().slice(0, 8)}`
      - Add timestamp if not provided
      - Append to transferencias array
      - Save to file
    - Implement `obtenerTransferenciasPorUsuario(userId)`:
      - Filter transfers by discord_user_id
      - Return sorted by timestamp descending
    - Implement `obtenerTransferenciasPorEquipo(teamId)`:
      - Filter transfers by from_team_id or to_team_id
      - Return sorted by timestamp descending
    - _Bug_Condition: Centralized transfer logging_
    - _Expected_Behavior: Single function to record all transfer types_
    - _Preservation: Does not affect solicitudes or categoria functions_
    - _Requirements: 2.3_

  - [ ] 4.3 Remove obsolete functions
    - Delete `plantillaVacia()` (no longer needed)
    - Delete `construirPlantillaDesdeEquipo()` (no longer needed)
    - Delete `aplicarPlantillaAlEquipo()` (no longer needed)
    - Delete `sincronizarEquipoDesdePlantilla()` (THIS IS THE KEY BUG - remove completely)
    - Delete `leerFichajes()` (replaced by leerEquipos/leerTransferencias)
    - Delete `guardarFichajes()` (replaced by guardarEquipos/guardarTransferencias)
    - Delete `obtenerPlantilla()` (replaced by direct access to equipo.miembros)
    - Update any internal references to deleted functions
    - _Bug_Condition: Removal of sync function eliminates manual data synchronization_
    - _Expected_Behavior: No synchronization needed with consolidated structure_
    - _Preservation: Does not remove any categoria or solicitud functions_
    - _Requirements: 2.1, 2.2, 2.4_

  - [ ] 4.4 Refactor team query functions
    - Update `obtenerEquipos()`: Change from `leerDatos().equipos` to `leerEquipos().equipos`
    - Update `obtenerEquipoPorId(id)`: Change to read from equipos.json
    - Update `obtenerEquiposPorCategoria(categoria_id)`: Change to read from equipos.json
    - Update `obtenerEquipoPorNombre(nombre)`: Change to read from equipos.json
    - Update `obtenerEquipoPorAbreviacion(abreviacion)`: Change to read from equipos.json
    - Update `obtenerEquipoPorJugador(userId)`: 
      - Change to search directly in `equipos.equipos[].miembros`
      - Use `miembros.some(m => mismoId(m.discord_user_id, userId))`
    - All functions now access single consolidated file
    - _Bug_Condition: Single file access for all team queries_
    - _Expected_Behavior: Faster queries, no multi-file reads_
    - _Preservation: Function signatures unchanged, only internal implementation_
    - _Requirements: 2.1, 2.2, 2.6_

  - [ ] 4.5 Refactor member query functions
    - Update `obtenerMiembro(userId)`:
      - Read equipos.json once
      - Iterate through equipos and search in miembros array
      - Return `{ team_id: equipo.id, ...miembro }` when found
      - Return null if not found
      - Remove dependency on fichajes.json
    - _Bug_Condition: Direct member search in consolidated structure_
    - _Expected_Behavior: Single file read for member lookup_
    - _Preservation: Return format unchanged_
    - _Requirements: 2.1, 2.2_

  - [ ] 4.6 Refactor member registration function
    - Update `registrarMiembro(teamId, userId, role, haxballNick, performedBy)`:
      - Read equipos.json
      - Find target equipo by teamId
      - Verify user not in another equipo
      - Add or update member in equipo.miembros array
      - Set joined_at timestamp if new member
      - Update equipo.updated_at
      - Save to equipos.json
      - Call `registrarTransferencia()` with action='SIGNED'
      - Remove all calls to `sincronizarEquipoDesdePlantilla()`
      - Remove writes to fichajes.fichados
    - _Bug_Condition: Single write operation to add member_
    - _Expected_Behavior: Member added without sync, transfer logged separately_
    - _Preservation: Function signature unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 4.7 Refactor member removal function
    - Update `quitarMiembro(teamId, userId, action, performedBy)`:
      - Read equipos.json
      - Find equipo and member
      - Remove from equipo.miembros array
      - Update equipo.updated_at
      - Save to equipos.json
      - Call `registrarTransferencia()` with provided action (RELEASED/RESIGNED)
      - Remove all calls to `sincronizarEquipoDesdePlantilla()`
      - Remove writes to fichajes.bajas
    - _Bug_Condition: Single write operation to remove member_
    - _Expected_Behavior: Member removed without sync, transfer logged separately_
    - _Preservation: Function signature unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 4.8 Refactor Sub-DT assignment functions
    - Update `asignarSubDt(teamId, userId, performedBy)`:
      - Read equipos.json
      - Find equipo and member
      - Verify no existing SUB_DT in equipo
      - Change member.role to 'SUB_DT'
      - Update equipo.updated_at
      - Save to equipos.json
      - Call `registrarTransferencia()` with action='SUB_DT_ASSIGNED'
      - Remove sync calls
    - Update `quitarSubDt(teamId, userId, performedBy)`:
      - Similar process changing role from SUB_DT to PLAYER
      - Call `registrarTransferencia()` with action='SUB_DT_REMOVED'
    - _Bug_Condition: Role changes without sync_
    - _Expected_Behavior: Direct role modification in consolidated structure_
    - _Preservation: Function signatures unchanged_
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 4.9 Refactor team CRUD functions
    - Update `crearEquipo(datos_equipo)`:
      - Read equipos.json
      - Generate unique ID
      - Create equipo with miembros array (from datos_equipo.miembros or empty)
      - Add created_at and updated_at timestamps
      - Append to equipos array
      - Save to equipos.json
      - Remove creation of plantilla in fichajes.json
      - Remove sync calls
    - Update `actualizarEquipo(id, campos)`:
      - Read equipos.json
      - Find equipo by id
      - Merge campos into equipo
      - Update updated_at timestamp
      - Save to equipos.json
      - Remove update to fichajes.json
    - Update `eliminarEquipoPorId(id)`:
      - Read equipos.json
      - Remove equipo from array
      - Save to equipos.json
      - Remove deletion from fichajes.json
    - _Bug_Condition: Single file operations for team CRUD_
    - _Expected_Behavior: No multi-file coordination needed_
    - _Preservation: Function signatures unchanged_
    - _Requirements: 2.1, 2.2, 2.4_

  - [ ] 4.10 Update historical tracking function
    - Update `agregarHistorial(entry)`:
      - Change to call `registrarTransferencia(entry)`
      - Remove writes to fichajes.fichados or fichajes.bajas
    - _Bug_Condition: Unified transfer logging_
    - _Expected_Behavior: Single function for all transfer types_
    - _Preservation: Maintains transfer history functionality_
    - _Requirements: 2.3_

---

## Phase 4: Update Commands

- [ ] 5. Update command files to use refactored db.js

  - [ ] 5.1 Update `/fichar` command (`commands/fichar.js`)
    - Review all calls to db functions
    - Ensure uses updated `registrarMiembro()` (already compatible)
    - Test that fichajes work correctly with new structure
    - Verify error handling still works
    - _Bug_Condition: Command uses single-file operations_
    - _Expected_Behavior: Signing players works identically to before_
    - _Preservation: Command behavior unchanged from user perspective_
    - _Requirements: 2.1, 2.2, 2.5_

  - [ ] 5.2 Update `/plantilla` command (`commands/plantilla.js`)
    - Change from `obtenerPlantilla(teamId)` to `obtenerEquipoPorId(teamId)`
    - Access `equipo.miembros` directly instead of plantilla.miembros
    - Update display formatting if needed
    - Ensure DT, SUB_DT, and PLAYER roles display correctly
    - _Bug_Condition: Direct access to consolidated miembros_
    - _Expected_Behavior: Roster display works identically_
    - _Preservation: Command output format unchanged_
    - _Requirements: 2.1, 2.2, 2.5_

  - [ ] 5.3 Update `/dar-de-baja` command (`commands/dar-de-baja.js`)
    - Verify uses updated `quitarMiembro()` with action='RELEASED'
    - Test that releases work correctly
    - Verify transfer is logged in transferencias.json
    - _Bug_Condition: Single operation for release_
    - _Expected_Behavior: Player release works identically_
    - _Preservation: Command behavior unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [ ] 5.4 Update `/renunciar` command (`commands/renunciar.js`)
    - Verify uses updated `quitarMiembro()` with action='RESIGNED'
    - Test that resignations work correctly
    - Verify transfer is logged in transferencias.json
    - _Bug_Condition: Single operation for resignation_
    - _Expected_Behavior: Player resignation works identically_
    - _Preservation: Command behavior unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [ ] 5.5 Update `/add-equipo` command (`commands/add-equipo.js`)
    - Verify uses updated `crearEquipo()`
    - Ensure miembros array is initialized with DT if provided
    - Test team creation flow
    - Verify no plantilla creation happens separately
    - _Bug_Condition: Team created with consolidated structure_
    - _Expected_Behavior: Team creation works identically_
    - _Preservation: Command behavior unchanged_
    - _Requirements: 2.1, 2.2, 2.5_

  - [ ] 5.6 Update `/inscribir-equipo` command (`commands/inscribir-equipo.js`)
    - Review solicitud approval flow
    - Ensure equipo is created with miembros from solicitud
    - Build miembros array from solicitud.director_tecnico and solicitud.jugadores
    - Map each to correct role (DT for director, PLAYER for jugadores)
    - Test inscripción approval process
    - _Bug_Condition: Inscription creates consolidated team_
    - _Expected_Behavior: Inscription process works identically_
    - _Preservation: Command behavior unchanged_
    - _Requirements: 2.1, 2.2, 2.5_

  - [ ] 5.7 Update `/asignar-subdt` command (`commands/asignar-subdt.js`)
    - Verify uses updated `asignarSubDt()`
    - Test Sub-DT assignment
    - Verify transfer is logged
    - _Bug_Condition: Role change without sync_
    - _Expected_Behavior: Assignment works identically_
    - _Preservation: Command behavior unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [ ] 5.8 Update `/quitar-subdt` command (`commands/quitar-subdt.js`)
    - Verify uses updated `quitarSubDt()`
    - Test Sub-DT removal
    - Verify transfer is logged
    - _Bug_Condition: Role change without sync_
    - _Expected_Behavior: Removal works identically_
    - _Preservation: Command behavior unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [ ] 5.9 Update `/edit-equipo` command (`commands/edit-equipo.js`)
    - Verify uses updated `actualizarEquipo()`
    - Test team updates (name, colors, shield, etc.)
    - Verify no plantilla update happens
    - _Bug_Condition: Single file update_
    - _Expected_Behavior: Team editing works identically_
    - _Preservation: Command behavior unchanged_
    - _Requirements: 2.1, 2.2, 2.5_

  - [ ] 5.10 Update `/eliminate-equipo` command (`commands/eliminate-equipo.js`)
    - Verify uses updated `eliminarEquipoPorId()`
    - Test team deletion
    - Verify no plantilla deletion happens separately
    - _Bug_Condition: Single file deletion_
    - _Expected_Behavior: Team deletion works identically_
    - _Preservation: Command behavior unchanged_
    - _Requirements: 2.1, 2.2, 2.5_

  - [ ] 5.11 Update `/ver-equipos` command (`commands/ver-equipos.js`)
    - Verify uses updated `obtenerEquipos()`
    - Test team listing
    - Ensure display format unchanged
    - _Bug_Condition: Reads from single consolidated file_
    - _Expected_Behavior: Team listing works identically_
    - _Preservation: Command behavior unchanged_
    - _Requirements: 2.1, 2.2, 2.5_

---

## Phase 5: Update Utility Services

- [ ] 6. Update utility services

  - [ ] 6.1 Review and update `utils/teamService.js`
    - Review all functions that interact with fichajes system
    - Update any direct file access to use new db.js functions
    - Test team-related utility functions
    - Verify no broken references to removed functions
    - _Bug_Condition: Service uses consolidated data access_
    - _Expected_Behavior: All utility functions work correctly_
    - _Preservation: Utility function signatures unchanged_
    - _Requirements: 2.1, 2.2, 2.5_

  - [ ] 6.2 Review and update `utils/rosterCommands.js`
    - Check for any plantilla-related logic
    - Update to use equipo.miembros directly
    - Test roster utility functions
    - _Bug_Condition: Utilities use consolidated structure_
    - _Expected_Behavior: Roster utilities work correctly_
    - _Preservation: Utility behavior unchanged_
    - _Requirements: 2.1, 2.2, 2.5_

---

## Phase 6: Validation and Testing

- [ ] 7. Final validation and testing

  - [ ] 7.1 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Single File Access Without Sync
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify operations now:
      - Access only one file per entity type (equipos.json, transferencias.json)
      - Do not call `sincronizarEquipoDesdePlantilla()` (function should not exist)
      - Do not duplicate data across files
    - Document that file operation counts are now optimal
    - _Requirements: 2.1, 2.2, 2.4, 2.6_

  - [ ] 7.2 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Refactored Functionality
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions):
      - Categoría management unchanged
      - Cupos calculation unchanged
      - Solicitudes system unchanged
      - Discord utilities unchanged
      - Validation functions unchanged
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ] 7.3 Integration testing
    - Test complete user flows:
      - Create team → add players → view roster → release player
      - Player signs → player resigns
      - Assign Sub-DT → remove Sub-DT
      - Edit team details
      - Delete team
    - Verify data consistency across operations
    - Check that transferencias.json logs all movements correctly
    - Verify no data duplication exists
    - Test concurrent operations (if applicable)
    - _Bug_Condition: All flows work with consolidated structure_
    - _Expected_Behavior: Complete system operates correctly_
    - _Preservation: All user-facing functionality preserved_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ] 7.4 Performance verification
    - Measure query performance for common operations:
      - Time to get member by user ID
      - Time to get all teams
      - Time to get team roster
    - Compare with baseline if available
    - Expected improvement due to single-file access
    - _Bug_Condition: Performance improved or maintained_
    - _Expected_Behavior: Faster queries with consolidated data_
    - _Preservation: No performance degradation_
    - _Requirements: 2.6_

  - [ ] 7.5 Data integrity verification
    - Compare backup files with migrated data:
      - All teams accounted for
      - All members accounted for
      - All transfers accounted for
    - Verify no data loss during migration
    - Check for any orphaned data
    - Verify all relationships preserved (team-member, team-category)
    - _Bug_Condition: Migration preserved all data_
    - _Expected_Behavior: 100% data integrity_
    - _Preservation: No data lost in refactoring_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise
  - Review implementation completeness
  - Confirm bug is fixed: no more multi-file access or manual sync required
  - Confirm preservation: all non-refactored functionality works correctly
  - Ready for production deployment

---

## Requirements Validation

This implementation plan validates the following requirements from the design:

**Bug Condition Requirements** (Fixed by consolidated structure):
- 2.1: Arquitectura Centralizada ✓
- 2.2: Modelo de Datos Unificado ✓
- 2.3: Historial Consolidado ✓
- 2.4: Eliminación de Sincronización Manual ✓
- 2.5: Compatibilidad de Comandos ✓
- 2.6: Rendimiento Mejorado ✓

**Preservation Requirements** (Unchanged functionality):
- 3.1: Gestión de Categorías ✓
- 3.2: Cálculo de Cupos ✓
- 3.3: Roles y Canales Discord ✓
- 3.4: Validaciones ✓
- 3.5: Normalización ✓
- 3.6: Manejo de Errores Discord ✓
- 3.7: Sistema de Solicitudes ✓
- 3.8: Funciones Auxiliares ✓

---

## Implementation Notes

### Critical Points
1. **Migration is irreversible** - Always keep backups before running migration script
2. **Test on backup data first** - Run migration on copy of data before production
3. **Exploration tests will fail** - This is expected and confirms the bug exists
4. **No sync function** - Complete removal of `sincronizarEquipoDesdePlantilla()` is the key fix
5. **Single source of truth** - Each entity type has one canonical file

### Dependencies
- Tasks must be executed in order due to dependencies
- Migration (Phase 2) must complete before refactoring (Phase 3)
- Database refactoring (Phase 3) must complete before command updates (Phase 4)
- All implementation must complete before final validation (Phase 6)

### Rollback Plan
If issues arise during implementation:
1. Stop using new code
2. Restore backup files created by migration script
3. Revert code changes from git
4. Investigate issue before retrying
