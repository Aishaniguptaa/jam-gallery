// events.js — DRAFT flight-phase event pool for project-forager; the makers own every word here and approve, rewrite, or cut each one before ship.
// COSTS follow the makers' rule: MATERIAL is spent only on an option that fixes or builds something (a
// weld, a seal, a rebuild), because material is the ship's stock of building stuff. Every other option
// costs FUEL when the ship is doing the work, and FOOD when the crew pays instead. No flight option
// charges credits: credits are a Plan/Colony currency.
// TIME follows the makers' second rule: an action does not cost months just for existing. The flight
// clock advances in the GAP between events (eventGapMonths in tuning.js). A `months` field appears here
// only where the waiting IS the choice — a quarantine, a detour, drifting for a transfer window. Reeling
// a crew member back in takes an afternoon, not three months.
// NOTE FOR THE MAKERS: no option here ever GAINS a resource, including "strip its tanks" on the derelict.

export const flightEvents = [
  {
    id: 'fuel-leak',
    phase: 'flight',
    text: 'A fuel line ruptures in the aft ring. The leak is slow but constant, and every hour in flight drains the tanks.',
    options: [
      { label: 'Weld the line from spare hull plate', deltas: { material: -35 } },
      { label: 'Burn the reserve tank and reroute the drive', deltas: { fuel: -40 } },
      { label: 'Run the pumps at half pressure', deltas: { fuel: -15, food: -25 } },
    ],
  },
  {
    id: 'contagion',
    phase: 'flight',
    text: 'A fever is spreading through the lower decks. The medics want it contained before it reaches the flight crew.',
    options: [
      { label: 'Quarantine the deck and continue the burn', deltas: { food: -30 }, months: 4 },
      { label: 'Break open the medical reserve', deltas: { food: -55 } },
      { label: 'Keep the schedule and let it burn through', deltas: { food: -80 } },
    ],
  },
  {
    id: 'debris-field',
    phase: 'flight',
    text: 'The long-range array finds a debris field across the approach lane. There is no way around it, only through it.',
    options: [
      { label: 'Burn hard and thread the field at speed', deltas: { fuel: -35 } },
      { label: 'Take the wide arc around the field', deltas: { fuel: -10, food: -20 }, months: 3 },
      { label: 'Hold the centre line and brace for impact', deltas: { fuel: -65 } },
    ],
  },
  {
    id: 'nav-drift',
    phase: 'flight',
    text: 'A clock fault has the nav computer drifting off true. Every day uncorrected costs you the next transfer window.',
    options: [
      { label: 'Fire the main drive and correct now', deltas: { fuel: -45 } },
      { label: 'Buy a corrected bearing from a comm buoy', deltas: { money: -140 } },
      { label: 'Recompute by hand and drift for the window', deltas: { food: -25, fuel: -15 }, months: 4 },
    ],
  },
  {
    id: 'airlock-accident',
    phase: 'flight',
    text: 'An airlock cycles early during an EVA. Two crew are on the wrong side of the outer door.',
    options: [
      { label: 'Blow the hatch and try to reel them in', deltas: { fuel: -80 } },
      { label: 'Cycle the lock by the book; they will not last', deltas: { food: -40, fuel: -20 } },
    ],
  },
  {
    id: 'derelict',
    phase: 'flight',
    text: 'A silent ship drifts off the lane, running lights dark. Its tanks may still be full.',
    options: [
      { label: 'Board it and strip its tanks', deltas: { food: -25, fuel: -15 } },
      { label: 'Skim its tanks with a remote drone', deltas: { fuel: -15, food: -10 } },
      { label: 'Burn wide and pass it in the dark', deltas: { fuel: -30 } },
    ],
  },
  {
    id: 'coolant-shortage',
    phase: 'flight',
    text: 'The coolant loop is running dry. Without it the reactor will not hold full output for long.',
    options: [
      { label: 'Ration ship power to the crew quarters', deltas: { fuel: -20, food: -20 } },
      { label: 'Run the reactor hot and watch the gauges', deltas: { fuel: -60 } },
      { label: 'Jettison the non-essential decks', deltas: { fuel: -85 } },
    ],
  },
  {
    id: 'water-recycler',
    phase: 'flight',
    text: 'The water recycler tears loose during a routine flush. The storage bay is venting to vacuum.',
    options: [
      { label: 'Seal the bay and reroute the lines', deltas: { material: -40 } },
      { label: 'Flush the system and rebuild it in place', deltas: { material: -45 } },
      { label: 'Abandon the bay and seal it off', deltas: { food: -50, material: -20 } },
    ],
  },
  {
    id: 'gravity-slingshot',
    phase: 'flight',
    text: 'A gas giant sits across your approach, close enough to slingshot around. The well is tight and the window is brief.',
    options: [
      { label: 'Slingshot the well at full speed', deltas: { fuel: -45 } },
      { label: 'Burn clear of the well and fly straight', deltas: { fuel: -35 } },
      { label: 'Take the long way around the planet', deltas: { food: -20, fuel: -10 }, months: 4 },
    ],
  },
  {
    id: 'hull-breach',
    phase: 'flight',
    text: 'The hull opens along a seam. Atmosphere is venting and the breach is widening faster than the crew can weld it.',
    options: [
      { label: 'Seal the section and cut the crew inside loose', deltas: { fuel: -35, food: -30 } },
      { label: 'Weld it from inside the venting section', deltas: { material: -60, food: -30 } },
      { label: 'Hold pressure and push for the planet', deltas: { fuel: -50 }, kills: true },
    ],
  },
];
