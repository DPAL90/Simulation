# UI & Simulation Change Instructions

## Current Functional Areas
- Intersection phase logic (NS/EW + yellow + all-red)
- Lane count and spawn controls
- Vehicle movement and signal compliance
- Bicycle path and pedestrian path movement
- Emergency traffic handling (ambulance/police)

## UI/UX Constraints
- Keep layout simple and readable.
- Avoid adding extra controls unless explicitly requested.
- Preserve current color/style direction unless asked to redesign.
- Do not introduce visual clutter.

## When Requesting UI Changes
Include:
- Exact element(s) to change
- Expected behavior before/after
- Any fixed values (sizes, defaults, labels)
- Screenshot reference (optional)

## Acceptance Checks
- Controls still apply correctly.
- Signal states remain accurate.
- Vehicles/pedestrians do not overlap incorrectly.
- Canvas rendering remains smooth.
