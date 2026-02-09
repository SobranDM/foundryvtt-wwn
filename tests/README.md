# WWN System Tests

This directory contains the test suite for the Worlds Without Number Foundry VTT system. The `foundry` folder in the repo is for API research/reference only and is not under test.

## Two-layer strategy

- **Node (unit tests)**: Pure logic that does not depend on Foundry globals. Run with `npm test`; coverage with `npm run test:coverage`.
- **Quench (in-Foundry)**: Integration tests that use real `game`, `Actor`, `Item`, etc. Run inside Foundry with the Quench module.

## Running Node tests

From the repo root:

```bash
pnpm install   # if not already done
pnpm test      # run unit tests
pnpm run test:coverage   # run with coverage (output in coverage/ and terminal summary)
```

Node tests live in `tests/node/*.spec.js` and cover:

- `module/helpers.js` – Handlebars helpers (eq, mod, add, counter, etc.)
- `module/insertionSort.js` – insertionSort and Object.byString
- `module/config.js` – WWN config shape
- `module/dice.js` – WwnDice.digestResult for types: above, below, check, skill, table (no instinct in Node)
- `module/utils/listener-funcs.js` – addEventListener (with jsdom)

## Running Quench tests

1. Install [Quench](https://foundryvtt.com/packages/quench) as a Foundry module (or from [Ethaks/FVTT-Quench](https://github.com/Ethaks/FVTT-Quench)).
2. Create or open a world using the WWN system.
3. Enable the Quench module for that world.
4. Launch the game and click the **Quench** button to open the test runner.
5. Select the **WWN** batches and run them.

Quench tests live in `tests/quench/register.js` and register batches for:

- Config (CONFIG.WWN)
- Dice (WwnDice.digestResult in Foundry, including instinct success)
- Party (party module API)
- Document classes (WwnActor, WwnItem, WWNCombat, WWNCombatant)
- Actor creation and prepareData (creates a test character)
- Item creation and WwnItem (creates a test weapon, defaultIcons)
- Chat (addChatMessageContextOptions, applyChatCardDamage)
- Combat (WWNCombat.FORMULA/GROUPS, creating Combat when a scene exists)

## Coverage

- **c8** reports coverage only for the **Node** test run. Use `npm run test:coverage`; reports are in `coverage/` (HTML) and in the terminal (text-summary).
- Coverage is scoped to the modules that have Node unit tests: `module/helpers.js`, `module/insertionSort.js`, `module/config.js`, `module/dice.js`, `module/utils/listener-funcs.js`, `module/effects.mjs`. Other module files (e.g. entity, sheets, dialogs) are Foundry-dependent and are not included in the coverage denominator.
- Quench tests run in the browser; they are not instrumented by c8. Integration coverage is tracked by test count and manual review.

## What is not tested here

- The `foundry` folder is not part of the test surface (research/docs only).
- Pixel-perfect or screenshot tests are not included; add Cypress/Playwright if you need e2e or visual regression.
