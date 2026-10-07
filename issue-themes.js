// Problem types owners describe in NHTSA complaints. Shared by phone.html,
// index.html (window.ISSUE_THEMES) and the Node scripts (require).
//
// re:    matched against complaint/recall text (lowercased); one complaint can hit several
// label: shown to users
// tip:   what to check before buying (premium report)
// Order matters only for bit positions in the cache, so append new themes at the end.
(function (root) {
  const ISSUE_THEMES = {
    stall: {
      label: 'Stalling / loss of power',
      tip: 'Ask if any stalling or fuel pump recall work was done, and watch for hesitation on a test drive.',
      re: /stall|loss of (motive )?power|lost (all )?(motive )?power|power loss|engine (shut|died|cut)|(shut|shuts|shutting) (off|down) while|dies while/,
    },
    oil: {
      label: 'Oil burning / oil dilution',
      tip: 'Check the oil level and whether it smells like gas, and ask for oil-change records.',
      re: /oil consumption|burn(s|ing)? (excessive )?oil|consum(es|ing) (excessive )?oil|oil dilution|(gas|fuel|gasoline) in (the )?oil|oil level (ris|increas)/,
    },
    engine: {
      label: 'Engine failure / knocking',
      tip: 'Listen for knocking on a cold start and ask whether the engine was ever replaced.',
      re: /engine (fail|seiz|blew|blown|knock|rod)|seized|rod knock|knocking|catastrophic|(replace|replaced|new) engine|engine replacement/,
    },
    trans: {
      label: 'Transmission slipping / rough shifting',
      tip: 'Test drive from a stop several times; feel for slipping, hesitation or hard shifts, and ask for transmission service records.',
      re: /transmission|shift(s|ing|ed)? (hard|harsh|rough|erratic)|hard shift|harsh shift|slip(s|ping)|\bcvt\b|jerk|lurch|clunk|won.?t (go into|shift)|stuck in gear/,
    },
    aeb: {
      label: 'Automatic braking false alarms',
      tip: 'Drive it on a busy road and see whether the collision system brakes or warns for no reason.',
      re: /phantom|emergency brak|collision (mitigation|avoidance|warning)|automatic(ally)? brak|brak(ed|es|ing) (for no|on its own|by itself)|\baeb\b|\bcmbs\b|\bfcw\b/,
    },
    electrical: {
      label: 'Dead battery / electrical faults',
      tip: 'Check battery age and test that every window, light and accessory works.',
      re: /dead battery|battery (die|died|dies|drain|dead|failure)|drain(s|ing)? the battery|electrical (problem|issue|failure|fault)|won.?t start|no.?start|starter/,
    },
    screen: {
      label: 'Infotainment / screen / camera',
      tip: 'Test the touchscreen, backup camera, Bluetooth and CarPlay/Android Auto.',
      re: /infotainment|touch ?screen|backup camera|rear ?view camera|radio|bluetooth|carplay|android auto|screen (went|goes|is) (black|blank)|frozen screen/,
    },
    steering: {
      label: 'Steering problems',
      tip: 'Check for a heavy, loose or notchy steering feel and any steering warning lights.',
      re: /steering/,
    },
    brakes: {
      label: 'Brake problems',
      tip: 'Check pedal feel and listen for grinding; ask when the brakes were last serviced.',
      re: /brake(s)? (fail|failed|grind|grinding|soft|spongy|went to the floor)|brake pedal|\babs\b|brake booster|vacuum pump/,
    },
    coolant: {
      label: 'Head gasket / coolant / overheating',
      tip: 'Ask if the head gasket was ever replaced, look for coolant loss or white exhaust smoke, and watch the temperature gauge on a long drive.',
      re: /coolant|overheat|water pump|radiator|head gasket/,
    },
    fuelleak: {
      label: 'Fuel leak / fuel smell',
      tip: 'Smell for fuel around the car and under the hood after a drive.',
      re: /fuel leak|gas leak|leaking (gas|fuel)|smell(s)? (of |like )?(gas|fuel|gasoline)|(fuel|gas) (odor|smell)/,
    },
    fire: {
      label: 'Fire / smoke',
      tip: 'Check that every fire-related recall was completed for this VIN.',
      re: /\bfire\b|caught fire|smoke|smoking|melted/,
    },
    airbag: {
      label: 'Airbags',
      tip: 'Make sure the airbag light goes off after startup and airbag recalls are done.',
      re: /air ?bag/,
    },
    glass: {
      label: 'Cracked windshield / wipers',
      tip: 'Look closely for windshield cracks and test the wipers.',
      re: /windshield|wiper/,
    },
    lights: {
      label: 'Headlights / lighting',
      tip: 'Check that every exterior light works, including headlights on high and low.',
      re: /headlight|head light|tail ?light|light(s)? (out|burn|fail)|bulb/,
    },
    body: {
      label: 'Doors, locks & liftgate',
      tip: 'Open and close every door, the trunk/liftgate and any sliding doors several times.',
      re: /door|\block(s|ed)?\b|latch|liftgate|tailgate|trunk/,
    },
    suspension: {
      label: 'Suspension problems',
      tip: 'Drive over bumps and at highway speed; listen for clunks and feel for shaking ("death wobble" on solid-axle Jeeps).',
      re: /suspension|death wobble|wobble|shock absorber|strut|control arm|ball joint|tie rod/,
    },
    leaks: {
      label: 'Water leaks / rust / paint',
      tip: 'Check carpets and the trunk for dampness, and look underneath for rust.',
      re: /water leak|leaks? water|sunroof|moonroof|\brust|corros|paint|peel/,
    },
    ac: {
      label: 'A/C failure',
      tip: 'Run the A/C on max and make sure it blows cold within a minute.',
      re: /a\/c|air condition|condenser|\bcompressor\b|no cold air|blows hot/,
    },
  };
  const KEYS = Object.keys(ISSUE_THEMES);

  // Bit flags of every theme a piece of text mentions
  function themeBits(text) {
    const t = String(text || '').toLowerCase();
    let bits = 0;
    KEYS.forEach((k, i) => { if (ISSUE_THEMES[k].re.test(t)) bits |= 1 << i; });
    return bits;
  }

  // "stall:261:1,oil:40:0" -> [{key, label, tip, count, recall}]
  function parseIssues(s) {
    if (!s) return [];
    return String(s).split(',').map(part => {
      const [key, count, recall] = part.split(':');
      const th = ISSUE_THEMES[key];
      return th ? { key, label: th.label, tip: th.tip, count: Number(count), recall: recall === '1' } : null;
    }).filter(Boolean);
  }

  const api = { ISSUE_THEMES, KEYS, themeBits, parseIssues };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GMCIssues = api;
})(typeof window !== 'undefined' ? window : this);
