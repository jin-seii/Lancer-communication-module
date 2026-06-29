# Agent Instructions: Lancer Communicator

## Project Snapshot
- FoundryVTT module (minimum v12, verified v13).
- Runtime entrypoint is [lancer-communicator/module.json](lancer-communicator/module.json), which loads [lancer-communicator/modules/main.js](lancer-communicator/modules/main.js).
- There is no build pipeline, test suite, or linter config in this repository.

## Validate Changes
- Validate by running the module inside Foundry and exercising the changed UI/flow manually.
- For diagnostics, enable debug mode in settings (`debugMode`) and inspect browser console logs prefixed with `Lancer Communicator | DEBUG`.
- When changing compatibility logic, verify behavior in both v12 and v13 code paths.

## Code Architecture
- [lancer-communicator/modules/main.js](lancer-communicator/modules/main.js): Foundry hooks (`init`, `ready`), chat command handling (`/lcm`), control button injection, and startup wiring.
- [lancer-communicator/modules/communicator.js](lancer-communicator/modules/communicator.js): Core message/dialog logic, socket listeners, audio/typing behavior, and DOM rendering.
- [lancer-communicator/modules/settings.js](lancer-communicator/modules/settings.js): All `game.settings.register(...)` declarations.
- [lancer-communicator/modules/api.js](lancer-communicator/modules/api.js): Public API exposed via `game.modules.get('lancer-communicator').api`.
- [lancer-communicator/lang/en.json](lancer-communicator/lang/en.json), [lancer-communicator/lang/ru.json](lancer-communicator/lang/ru.json), [lancer-communicator/lang/pt.json](lancer-communicator/lang/pt.json): Localization dictionaries.
- [lancer-communicator/styles/lancer-communicator.css](lancer-communicator/styles/lancer-communicator.css): UI styles and CSS variables.

## Working Conventions
- Keep module id stable and consistent: `lancer-communicator`.
- Keep initialization split: registration in `init`, runtime wiring in `ready`.
- Preserve v12/v13 branching behavior in control button logic.
- Keep communicator state centralized in static members on `LancerCommunicator`.
- Reuse localized strings via `game.i18n.localize(...)` for user-facing text.

## i18n Rule (Required)
- Any new or changed user-facing string must be updated in all locale files:
  - [lancer-communicator/lang/en.json](lancer-communicator/lang/en.json)
  - [lancer-communicator/lang/ru.json](lancer-communicator/lang/ru.json)
  - [lancer-communicator/lang/pt.json](lancer-communicator/lang/pt.json)
- Prefer existing key namespaces (`LANCER.Settings`, `LANCER.Settings.Warnings`, etc.) instead of creating ad-hoc keys.

## Settings Rule
- New settings must be registered in [lancer-communicator/modules/settings.js](lancer-communicator/modules/settings.js), including scope/type/default.
- If runtime logic depends on cached settings, refresh cache before use.

## Risk Areas To Treat Carefully
- Version-dependent token control injection in [lancer-communicator/modules/main.js](lancer-communicator/modules/main.js).
- Any `innerHTML` rendering in [lancer-communicator/modules/communicator.js](lancer-communicator/modules/communicator.js): sanitize user input.
- Audio timing logic and timeout behavior in communicator audio helpers.

## Useful References
- Feature overview and usage examples: [README.md](README.md)
- Goal context for this fork: [GOALS.md](GOALS.md)
