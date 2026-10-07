// Models graded from NHTSA owner complaints, shared by fetch-nhtsa.js and grade-from-nhtsa.js.
//
// key:    make/model key in Firebase reliability/{make}/grades/{model}
// src:    NHTSA [make, model-name regex] pairs; every matching NHTSA model name for
//         a year is summed (BMW files the 3 Series as 328I, 330I XDRIVE, ...)
// sales:  rough US sales per model year, in thousands. Used to turn complaint counts
//         into a rate so popular cars aren't punished for being popular. Either one
//         number, or [[fromYear, thousands], ...] steps for models whose sales moved a
//         lot (sedans collapsed after ~2018, crossovers boomed). Rough is fine: good
//         and bad years differ 10-50x.
// from/to: model years this nameplate is the same vehicle line (optional)
// ev:     electric; engine/transmission become motor & battery / drivetrain

const MODELS = [
  // Toyota
  { key: 'toyota/camry', src: [['toyota', /^CAMRY( HYBRID| HV)?$/]], sales: [[2005, 420], [2018, 330], [2020, 300]] },
  { key: 'toyota/corolla', src: [['toyota', /^COROLLA( HYBRID| IM| HATCHBACK)?$/]], sales: [[2005, 300], [2014, 330], [2020, 250]] },
  { key: 'toyota/prius', src: [['toyota', /^PRIUS( PLUG-IN( HYBRID)?| PRIME)?$/]], sales: 110 },
  { key: 'toyota/rav4', src: [['toyota', /^RAV4( HYBRID| PRIME)?$/]], sales: [[2005, 160], [2013, 250], [2016, 350], [2019, 430]] },
  { key: 'toyota/highlander', src: [['toyota', /^HIGHLANDER( HYBRID| HV)?$/]], sales: [[2005, 130], [2014, 150], [2017, 215], [2020, 250]] },
  { key: 'toyota/sienna', src: [['toyota', /^SIENNA( HYBRID)?$/]], sales: 100 },
  { key: 'toyota/tacoma', src: [['toyota', /^TACOMA/]], sales: 220 },
  { key: 'toyota/tundra', src: [['toyota', /^TUNDRA/]], sales: 110 },
  { key: 'toyota/4runner', src: [['toyota', /^4RUNNER$/]], sales: 110 },
  { key: 'toyota/sequoia', src: [['toyota', /^SEQUOIA/]], sales: 15 },
  { key: 'toyota/venza', src: [['toyota', /^VENZA/]], sales: 30 },
  { key: 'toyota/c-hr', src: [['toyota', /^C-HR$/]], sales: 45, from: 2018 },
  // Honda
  { key: 'honda/civic', src: [['honda', /^CIVIC/]], sales: [[2005, 320], [2016, 340], [2020, 230]] },
  { key: 'honda/accord', src: [['honda', /^ACCORD( HYBRID| PLUG[- ]IN HYBRID| V6| FHEV| SEDAN| COUPE)?$/]], sales: [[2005, 360], [2018, 280], [2020, 200]] },
  { key: 'honda/cr-v', src: [['honda', /^CR-V/]], sales: [[2005, 200], [2012, 290], [2015, 350], [2017, 380]] },
  { key: 'honda/hr-v', src: [['honda', /^HR-V$/]], sales: 90, from: 2016 },
  { key: 'honda/pilot', src: [['honda', /^PILOT$/]], sales: 140 },
  { key: 'honda/odyssey', src: [['honda', /^ODYSSEY$/]], sales: 110 },
  { key: 'honda/passport', src: [['honda', /^PASSPORT$/]], sales: 45, from: 2019 },
  { key: 'honda/ridgeline', src: [['honda', /^RIDGELINE$/]], sales: 35 },
  // Ford
  { key: 'ford/f-150', src: [['ford', /^F-?150/]], sales: 650 },
  { key: 'ford/explorer', src: [['ford', /^EXPLORER( HYBRID| HEV)?$/]], sales: [[2005, 240], [2008, 130], [2011, 170], [2014, 210], [2016, 250], [2020, 230], [2022, 200]] },
  { key: 'ford/escape', src: [['ford', /^ESCAPE( HYBRID| HEV| PHEV)?$/]], sales: [[2005, 170], [2008, 190], [2013, 300], [2020, 180], [2022, 150]] },
  { key: 'ford/bronco', src: [['ford', /^BRONCO$/]], sales: 90, from: 2021 },
  { key: 'ford/mustang', src: [['ford', /^MUSTANG(?! MACH)/]], sales: 75 },
  { key: 'ford/ranger', src: [['ford', /^RANGER/]], sales: 70 },
  { key: 'ford/edge', src: [['ford', /^EDGE$/]], sales: 120 },
  { key: 'ford/expedition', src: [['ford', /^EXPEDITION/]], sales: 60 },
  { key: 'ford/fusion', src: [['ford', /^FUSION/]], sales: [[2006, 150], [2010, 220], [2013, 300], [2017, 210], [2019, 160], [2020, 100]], to: 2020 },
  { key: 'ford/focus', src: [['ford', /^FOCUS( RS| ST)?$/]], sales: [[2005, 200], [2012, 240], [2015, 200], [2017, 160], [2018, 60]], to: 2018 },
  { key: 'ford/fiesta', src: [['ford', /^FIESTA$/]], sales: [[2011, 60], [2017, 40], [2019, 25]], from: 2011, to: 2019 },
  // Chevrolet
  { key: 'chevrolet/silverado', src: [['chevrolet', /^SILVERADO( 1500.*)?$/]], sales: 550 },
  { key: 'chevrolet/equinox', src: [['chevrolet', /^EQUINOX$/]], sales: [[2005, 100], [2010, 200], [2015, 280], [2018, 300], [2021, 190]] },
  { key: 'chevrolet/malibu', src: [['chevrolet', /^MALIBU/]], sales: [[2005, 150], [2008, 180], [2013, 200], [2016, 220], [2018, 150], [2020, 110]] },
  { key: 'chevrolet/tahoe', src: [['chevrolet', /^TAHOE/]], sales: 100 },
  { key: 'chevrolet/traverse', src: [['chevrolet', /^TRAVERSE( LIMITED)?$/]], sales: 120, from: 2009 },
  { key: 'chevrolet/colorado', src: [['chevrolet', /^COLORADO/]], sales: 110 },
  { key: 'chevrolet/suburban', src: [['chevrolet', /^SUBURBAN( 1500)?$/]], sales: 50 },
  { key: 'chevrolet/blazer', src: [['chevrolet', /^BLAZER$/]], sales: 85, from: 2019 },
  { key: 'chevrolet/trailblazer', src: [['chevrolet', /^TRAILBLAZER$/]], sales: 70, from: 2021 },
  { key: 'chevrolet/camaro', src: [['chevrolet', /^CAMARO/]], sales: 70, from: 2010 },
  { key: 'chevrolet/cruze', src: [['chevrolet', /^CRUZE/]], sales: [[2011, 230], [2014, 270], [2017, 180], [2018, 140], [2019, 80]], from: 2011, to: 2019 },
  // Nissan
  { key: 'nissan/altima', src: [['nissan', /^ALTIMA( HYBRID| HEV)?$/]], sales: [[2005, 300], [2018, 210], [2020, 130]] },
  { key: 'nissan/rogue', src: [['nissan', /^ROGUE( SELECT)?$/]], sales: [[2008, 110], [2014, 310], [2017, 400], [2022, 250]], from: 2008 },
  { key: 'nissan/sentra', src: [['nissan', /^SENTRA/]], sales: [[2005, 120], [2013, 210], [2020, 130]] },
  { key: 'nissan/pathfinder', src: [['nissan', /^PATHFINDER( HYBRID)?$/]], sales: 70 },
  { key: 'nissan/kicks', src: [['nissan', /^KICKS$/]], sales: 65, from: 2018 },
  { key: 'nissan/frontier', src: [['nissan', /^FRONTIER/]], sales: 70 },
  { key: 'nissan/murano', src: [['nissan', /^MURANO( HYBRID)?$/]], sales: 80 },
  { key: 'nissan/maxima', src: [['nissan', /^MAXIMA$/]], sales: [[2005, 60], [2019, 35], [2021, 25]] },
  { key: 'nissan/versa', src: [['nissan', /^VERSA/]], sales: 110, from: 2007 },
  // Jeep
  { key: 'jeep/grand cherokee', src: [['jeep', /^GRAND CHEROKEE/]], sales: [[2005, 200], [2008, 80], [2011, 140], [2014, 200], [2016, 220], [2020, 230]] },
  { key: 'jeep/wrangler', src: [['jeep', /^WRANGLER/]], sales: [[2005, 80], [2008, 100], [2012, 140], [2015, 200], [2018, 230], [2022, 180]] },
  { key: 'jeep/cherokee', src: [['jeep', /^CHEROKEE$/]], sales: [[2014, 180], [2016, 200], [2018, 170], [2020, 120], [2022, 40]], from: 2014 },
  { key: 'jeep/compass', src: [['jeep', /^COMPASS$/]], sales: [[2007, 30], [2012, 45], [2015, 60], [2017, 90], [2018, 135], [2022, 120]], from: 2007 },
  { key: 'jeep/gladiator', src: [['jeep', /^GLADIATOR/]], sales: 60, from: 2020 },
  // Hyundai / Kia
  { key: 'hyundai/elantra', src: [['hyundai', /^ELANTRA( HYBRID| HEV| N-LINE| N)?$/]], sales: [[2005, 110], [2011, 200], [2019, 150], [2021, 130]] },
  { key: 'hyundai/tucson', src: [['hyundai', /^TUCSON/]], sales: 130 },
  { key: 'hyundai/santa fe', src: [['hyundai', /^SANTA FE( SPORT| XL| HYBRID| HEV| PHEV| PLUG-IN HYBRID)?$/]], sales: 120 },
  { key: 'hyundai/sonata', src: [['hyundai', /^SONATA/]], sales: [[2005, 150], [2011, 220], [2016, 200], [2018, 120], [2020, 90]] },
  { key: 'hyundai/palisade', src: [['hyundai', /^PALISADE$/]], sales: 85, from: 2020 },
  { key: 'hyundai/kona', src: [['hyundai', /^KONA$/]], sales: 80, from: 2018 },
  { key: 'kia/sorento', src: [['kia', /^SORENTO/]], sales: 100 },
  { key: 'kia/sportage', src: [['kia', /^SPORTAGE/]], sales: 85 },
  { key: 'kia/telluride', src: [['kia', /^TELLURIDE$/]], sales: 85, from: 2020 },
  { key: 'kia/forte', src: [['kia', /^FORTE/]], sales: 110, from: 2010 },
  { key: 'kia/soul', src: [['kia', /^SOUL$/]], sales: 110, from: 2010 },
  { key: 'kia/optima', src: [['kia', /^OPTIMA/]], sales: [[2005, 50], [2011, 140], [2016, 100], [2019, 90]], to: 2020 },
  { key: 'kia/seltos', src: [['kia', /^SELTOS$/]], sales: 55, from: 2021 },
  { key: 'kia/carnival', src: [['kia', /^CARNIVAL$/]], sales: 40, from: 2022 },
  // Subaru / Mazda
  { key: 'subaru/outback', src: [['subaru', /^OUTBACK/]], sales: 160 },
  { key: 'subaru/forester', src: [['subaru', /^FORESTER/]], sales: 170 },
  { key: 'subaru/crosstrek', src: [['subaru', /CROSSTREK/]], sales: 130, from: 2013 },
  { key: 'subaru/ascent', src: [['subaru', /^ASCENT$/]], sales: 65, from: 2019 },
  { key: 'subaru/impreza', src: [['subaru', /^IMPREZA( WAGON)?$/]], sales: 70 },
  { key: 'subaru/wrx', src: [['subaru', /^(IMPREZA )?WRX/]], sales: 30 },
  { key: 'mazda/cx-5', src: [['mazda', /^CX-5$/]], sales: 140, from: 2013 },
  { key: 'mazda/mazda3', src: [['mazda', /^(MAZDA)?3( SPORT)?$/]], sales: [[2005, 100], [2017, 75], [2019, 55], [2021, 40]] },
  { key: 'mazda/cx-9', src: [['mazda', /^CX-9$/]], sales: 30, from: 2007, to: 2023 },
  { key: 'mazda/mazda6', src: [['mazda', /^(MAZDA)?6$/]], sales: [[2005, 50], [2018, 30], [2020, 20]], to: 2021 },
  // Tesla
  { key: 'tesla/model 3', src: [['tesla', /^MODEL 3/]], sales: [[2017, 2], [2018, 140], [2019, 160], [2020, 100], [2021, 120], [2022, 210], [2023, 220], [2024, 190]], from: 2017, ev: true },
  { key: 'tesla/model y', src: [['tesla', /^MODEL Y/]], sales: [[2020, 65], [2021, 190], [2022, 250], [2023, 390], [2024, 370]], from: 2020, ev: true },
  { key: 'tesla/model s', src: [['tesla', /^MODEL S/]], sales: 30, from: 2012, ev: true },
  { key: 'tesla/model x', src: [['tesla', /^MODEL X/]], sales: 25, from: 2016, ev: true },
  // Stellantis
  { key: 'dodge/ram', src: [['dodge', /^RAM 1500/], ['ram', /^(RAM )?1500/]], sales: 450 },
  { key: 'dodge/charger', src: [['dodge', /^CHARGER( SRT)?$/]], sales: 85, from: 2006 },
  { key: 'dodge/challenger', src: [['dodge', /^CHALLENGER/]], sales: 55, from: 2008 },
  { key: 'dodge/durango', src: [['dodge', /^DURANGO( SRT)?$/]], sales: 65 },
  { key: 'dodge/grand caravan', src: [['dodge', /^GRAND CARAVAN(?! CARGO)/]], sales: 120, to: 2020 },
  { key: 'dodge/journey', src: [['dodge', /^JOURNEY$/]], sales: 90, from: 2009, to: 2020 },
  { key: 'chrysler/200', src: [['chrysler', /^200$/]], sales: 120, from: 2011, to: 2017 },
  { key: 'chrysler/pacifica', src: [['chrysler', /^PACIFICA/]], sales: 100, from: 2017 },
  // GM trucks & SUVs
  { key: 'gmc/sierra', src: [['gmc', /^SIERRA( 1500.*| HYBRID)?$/]], sales: 200 },
  { key: 'gmc/yukon', src: [['gmc', /^YUKON/]], sales: 75 },
  { key: 'gmc/acadia', src: [['gmc', /^ACADIA/]], sales: 90, from: 2007 },
  { key: 'gmc/terrain', src: [['gmc', /^TERRAIN$/]], sales: 90, from: 2010 },
  { key: 'buick/enclave', src: [['buick', /^ENCLAVE$/]], sales: 50, from: 2008 },
  { key: 'buick/encore', src: [['buick', /^ENCORE$/]], sales: 80, from: 2013 },
  { key: 'cadillac/escalade', src: [['cadillac', /^ESCALADE/]], sales: 30 },
  // Volkswagen / Audi
  { key: 'volkswagen/jetta', src: [['volkswagen', /^JETTA/]], sales: [[2005, 110], [2011, 160], [2015, 130], [2017, 110], [2020, 90]] },
  { key: 'volkswagen/tiguan', src: [['volkswagen', /^TIGUAN/]], sales: 75, from: 2009 },
  { key: 'volkswagen/atlas', src: [['volkswagen', /^ATLAS$/]], sales: 70, from: 2018 },
  { key: 'volkswagen/passat', src: [['volkswagen', /^PASSAT$/]], sales: [[2005, 50], [2012, 110], [2016, 70], [2018, 50], [2020, 30]], to: 2022 },
  { key: 'volkswagen/golf', src: [['volkswagen', /^GOLF( R| GTI|\/GTI| SPORTWAGEN)?$/]], sales: 50 },
  { key: 'audi/a4', src: [['audi', /^(AUDI )?A4/]], sales: 35 },
  { key: 'audi/q5', src: [['audi', /^(AUDI )?S?Q5/]], sales: 60, from: 2009 },
  // Luxury
  { key: 'lexus/rx', src: [['lexus', /^RX/]], sales: 105 },
  { key: 'lexus/es', src: [['lexus', /^ES/]], sales: 60 },
  { key: 'lexus/nx', src: [['lexus', /^NX/]], sales: 60, from: 2015 },
  { key: 'bmw/3 series', src: [['bmw', /^(3\d\d[A-Z]*|3 SERIES|M3)\b/]], sales: 60 },
  { key: 'bmw/5 series', src: [['bmw', /^(5\d\d[A-Z]*|5 SERIES|M5)\b/]], sales: 45 },
  { key: 'bmw/x3', src: [['bmw', /^X3\b/]], sales: 60 },
  { key: 'bmw/x5', src: [['bmw', /^X5\b/]], sales: 50 },
  { key: 'mercedes-benz/c-class', src: [['mercedes-benz', /^C(-CLASS|\d{3})\b/]], sales: 70 },
  { key: 'mercedes-benz/e-class', src: [['mercedes-benz', /^E(-CLASS|\d{3})\b/]], sales: 50 },
  { key: 'mercedes-benz/glc', src: [['mercedes-benz', /^GLC/]], sales: 60, from: 2016 },
  { key: 'mercedes-benz/gle', src: [['mercedes-benz', /^(GLE|ML)/]], sales: 45 },
  { key: 'acura/mdx', src: [['acura', /^MDX/]], sales: 55 },
  { key: 'acura/rdx', src: [['acura', /^RDX$/]], sales: 50, from: 2007 },
  { key: 'acura/tlx', src: [['acura', /^TLX/]], sales: 30, from: 2015 },
];

const FIRST_YEAR = 2005;
const LAST_YEAR = 2024; // newer model years haven't had time to collect complaints

// Sales (thousands) for a model in a given model year
function salesFor(m, y) {
  if (typeof m.sales === 'number') return m.sales;
  let v = m.sales[0][1];
  for (const [from, k] of m.sales) if (y >= from) v = k;
  return v;
}

module.exports = { MODELS, FIRST_YEAR, LAST_YEAR, salesFor };
