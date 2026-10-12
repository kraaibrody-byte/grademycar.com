// Problem types owners describe in NHTSA complaints. Shared by phone.html,
// index.html (window.ISSUE_THEMES) and the Node scripts (require).
//
// re:    matched against complaint/recall text (lowercased); one complaint can hit several
// label: shown to users
// tip:   what to check before buying (premium report)
// drivetrain: engine/transmission problem; these lead under the grade (see headlineIssue)
// subs:  for broad themes, the specific causes. When one clearly dominates a model year's
//        complaints (see dominantSub), that year shows its label and tip instead, so a
//        2018 Accord says "Blown head gasket" and a 2019 RAV4 "Overheating / coolant leaks".
// Order matters only for bit positions in the cache, so append new themes at the end.
(function (root) {
  const ISSUE_THEMES = {
    stall: {
      label: 'Stalling / loss of power',
      drivetrain: true,
      tip: 'Ask if any stalling or fuel pump recall work was done, and watch for hesitation on a test drive.',
      re: /stall|loss of (motive )?power|lost (all )?(motive )?power|power loss|engine (shut|died|cut)|(shut|shuts|shutting) (off|down) while|dies while/,
    },
    oil: {
      label: 'Oil burning / oil dilution',
      drivetrain: true,
      tip: 'Check the oil level and whether it smells like gas, and ask for oil-change records.',
      re: /oil consumption|burn(s|ing)? (excessive )?oil|consum(es|ing) (excessive )?oil|oil dilution|(gas|fuel|gasoline) in (the )?oil|oil level (ris|increas)/,
      subs: [
        { key: 'dilution', label: 'Oil dilution (fuel in the oil)', tip: 'Check whether the oil smells like gas or the level is above full, and ask whether the dealer software update was done.',
          re: /oil dilution|(gas|fuel|gasoline) in (the )?oil|oil level (ris|increas)|oil (smells|smelled) (of|like) (gas|fuel)/ },
        { key: 'burning', label: 'Oil burning', tip: 'Ask how often it needs oil topped up between changes, and look for blue exhaust smoke.',
          re: /oil consumption|burn(s|ing)? (excessive )?oil|consum(es|ing) (excessive )?oil/ },
      ],
    },
    engine: {
      label: 'Engine failure / knocking',
      drivetrain: true,
      tip: 'Listen for knocking on a cold start and ask whether the engine was ever replaced.',
      re: /engine (fail|seiz|blew|blown|knock|rod)|seized|rod knock|knocking|catastrophic|(replace|replaced|new) engine|engine replacement/,
    },
    trans: {
      label: 'Transmission slipping / rough shifting',
      drivetrain: true,
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
      label: 'Power steering failure / steering faults',
      tip: 'Check for a heavy, loose or notchy steering feel and any steering warning lights.',
      re: /steering/,
    },
    brakes: {
      label: 'Brake problems',
      tip: 'Check pedal feel and listen for grinding; ask when the brakes were last serviced.',
      re: /brake(s)? (fail|failed|grind|grinding|soft|spongy|went to the floor)|brake pedal|\babs\b|brake booster|vacuum pump/,
    },
    coolant: {
      label: 'Cooling system / overheating',
      drivetrain: true,
      tip: 'Look for coolant loss or white exhaust smoke, ask about cooling-system repairs, and watch the temperature gauge on a long drive.',
      re: /coolant|overheat|water pump|radiator|head gasket/,
      subs: [
        { key: 'gasket', label: 'Blown head gasket', tip: 'Ask if the head gasket was ever replaced, look for coolant loss or white exhaust smoke, and watch the temperature gauge on a long drive.',
          re: /head gasket/ },
        { key: 'leak', label: 'Overheating / coolant leaks', tip: 'Check the coolant level and look for leaks or crusty residue around the engine, and watch the temperature gauge on a long drive.',
          re: /overheat|coolant (leak|loss)|leak(s|ing|ed)? (of )?coolant|losing coolant|low coolant/ },
        { key: 'pump', label: 'Water pump failure', tip: 'Ask whether the water pump was replaced, and look for coolant drips near the front of the engine.',
          re: /water pump|coolant pump/ },
      ],
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

  // The cause behind most of a theme's complaints, or null when none clearly leads.
  // counts: {subKey: complaints mentioning it}; total: all of the theme's complaints.
  // It has to cover most complaints that name a cause, and a good share of all of them.
  function dominantSub(theme, counts, total) {
    const subs = ISSUE_THEMES[theme]?.subs;
    if (!subs) return null;
    const named = subs.reduce((n, s) => n + (counts[s.key] || 0), 0);
    const best = subs.map(s => [s.key, counts[s.key] || 0]).sort((a, b) => b[1] - a[1])[0];
    return best && best[1] >= 10 && best[1] >= 0.6 * named && best[1] >= 0.25 * total ? best[0] : null;
  }

  // "stall:261:1,coolant:399:0:gasket" -> [{key, label, tip, count, recall, sub}]
  // (the optional 4th part is the dominant cause, whose label and tip replace the theme's)
  function parseIssues(s) {
    if (!s) return [];
    return String(s).split(',').map(part => {
      const [key, count, recall, subKey] = part.split(':');
      const th = ISSUE_THEMES[key];
      if (!th) return null;
      const sub = subKey && th.subs ? th.subs.find(x => x.key === subKey) : null;
      return { key, label: (sub || th).label, tip: (sub || th).tip, count: Number(count), recall: recall === '1', ...(sub ? { sub: subKey } : {}) };
    }).filter(Boolean);
  }

  // The one problem shown under the grade, as {key, label, count, recall, heading} or null.
  // Grades are mostly engine + transmission, so the worst drivetrain problem leads; a
  // recalled one counts half since the fix was usually free. Otherwise fall back to the
  // most-reported problem. (Not fire: its pattern also catches "smoke", so it can't
  // headline on its own without someone reading the complaints.)
  const MIN_HEADLINE = 10;
  function headlineIssue(issues) {
    issues = issues || [];
    const weight = i => i.count * (i.recall ? 0.5 : 1);
    const dt = issues.filter(i => ISSUE_THEMES[i.key].drivetrain && i.count >= MIN_HEADLINE)
      .sort((a, b) => weight(b) - weight(a))[0];
    if (dt) return { ...dt, heading: 'Top engine/transmission problem' };
    return issues[0] ? { ...issues[0], heading: 'Most complaints' } : null;
  }

  const api = { ISSUE_THEMES, KEYS, themeBits, parseIssues, headlineIssue, dominantSub };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GMCIssues = api;
})(typeof window !== 'undefined' ? window : this);
