# Tasks: Implement Round of 16 (Group Stage) & FIFA Single-Elimination Knockout Bracket

## Phase 1: Format & Engine Infrastructure
- [x] Update `src/utils/db.ts` and `src/components/TournamentWizard.tsx` to support `'round_16'` format option.
- [x] Add `generateRoundOf16GroupFixtures` and `generateFIFAKnockoutBracket` in `src/utils/formatEngine.ts`.
- [x] Implement group auto-assignment into Group A, B, C, D (4 teams per group, 16 teams total).

## Phase 2: Tournament Lifecycle & Auto-Seeding
- [x] Update `handleActivateTournament` in `src/app/page.tsx` for `'round_16'`.
- [x] Implement auto-check/generation in `src/components/Fixtures.tsx` to transition completed group stage into FIFA Knockout Quarter-Finals.

## Phase 3: Group Standings UI & Qualification Styling
- [x] Update `src/components/PointsTable.tsx` to include `GA` column and sort tiebreakers (Points DESC -> GD DESC -> GF DESC).
- [x] Add green border/accent (`#10B981` / emerald) and qualification badges to the top 2 teams in Group A, B, C, D.

## Phase 4: Visual Knockout Bracket
- [x] Build `src/components/KnockoutBracket.tsx` visualizer component showing QF -> SF -> Final bracket.
- [x] Integrate Knockout Bracket into `Fixtures.tsx` and `PointsTable.tsx`.

## Phase 5: Verification & Testing
- [x] Test round-of-16 tournament creation, team group assignment, fixture generation, score entries, table updates, bracket seeding, and progression to champion.
- [x] Run build command (`npm run build`) to ensure zero errors.
