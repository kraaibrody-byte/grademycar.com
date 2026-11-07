// Models graded from NHTSA owner complaints, shared by fetch-nhtsa.js and grade-from-nhtsa.js.
//
// key:    make/model key in Firebase reliability/{make}/grades/{model}
// src:    NHTSA [make, model-name regex] pairs; every matching NHTSA model name for
//         a year is summed (BMW files the 3 Series as 328I, 330I XDRIVE, ...)
// sales:  rough US sales per model year, in thousands. Used to turn complaint counts
//         into a rate so popular cars aren't punished for being popular. Either one
//         number, or [[fromYear, thousands], ...] steps for models whose sales moved a
//         lot (sedans collapsed after ~2018, crossovers boomed). Rough is fine: good
//         and bad years differ 10-50x. Steps before 2005 were added when grading was
//         extended back to 2000; 2005-on figures were left as they were. Models added
//         2026-11-07 carry a published figure for every year instead.
// from/to: model years this nameplate is the same vehicle line (optional)
// skip:   model years inside from/to with almost no US sales, e.g. between generations (optional)
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
  { key: 'toyota/sequoia', src: [['toyota', /^SEQUOIA/]], sales: [[2000, 60], [2005, 15]] },
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
  { key: 'ford/explorer', src: [['ford', /^EXPLORER( HYBRID| HEV)?$/]], sales: [[2000, 400], [2005, 240], [2008, 130], [2011, 170], [2014, 210], [2016, 250], [2020, 230], [2022, 200]] },
  { key: 'ford/escape', src: [['ford', /^ESCAPE( HYBRID| HEV| PHEV)?$/]], sales: [[2005, 170], [2008, 190], [2013, 300], [2020, 180], [2022, 150]] },
  { key: 'ford/bronco', src: [['ford', /^BRONCO$/]], sales: 90, from: 2021 },
  { key: 'ford/mustang', src: [['ford', /^MUSTANG(?! MACH)/]], sales: [[2000, 150], [2005, 75]] },
  { key: 'ford/ranger', src: [['ford', /^RANGER/]], sales: [[2000, 230], [2003, 160], [2005, 70]] },
  { key: 'ford/edge', src: [['ford', /^EDGE$/]], sales: 120 },
  { key: 'ford/expedition', src: [['ford', /^EXPEDITION/]], sales: [[2000, 200], [2003, 150], [2005, 60]] },
  { key: 'ford/fusion', src: [['ford', /^FUSION/]], sales: [[2006, 150], [2010, 220], [2013, 300], [2017, 210], [2019, 160], [2020, 100]], to: 2020 },
  { key: 'ford/focus', src: [['ford', /^FOCUS( RS| ST)?$/]], sales: [[2005, 200], [2012, 240], [2015, 200], [2017, 160], [2018, 60]], to: 2018 },
  { key: 'ford/fiesta', src: [['ford', /^FIESTA$/]], sales: [[2011, 60], [2017, 40], [2019, 25]], from: 2011, to: 2019 },
  // Chevrolet
  { key: 'chevrolet/silverado', src: [['chevrolet', /^SILVERADO( 1500.*)?$/]], sales: 550 },
  { key: 'chevrolet/equinox', src: [['chevrolet', /^EQUINOX$/]], sales: [[2005, 100], [2010, 200], [2015, 280], [2018, 300], [2021, 190]] },
  { key: 'chevrolet/malibu', src: [['chevrolet', /^MALIBU/]], sales: [[2005, 150], [2008, 180], [2013, 200], [2016, 220], [2018, 150], [2020, 110]] },
  { key: 'chevrolet/tahoe', src: [['chevrolet', /^TAHOE/]], sales: [[2000, 200], [2005, 100]] },
  { key: 'chevrolet/traverse', src: [['chevrolet', /^TRAVERSE( LIMITED)?$/]], sales: 120, from: 2009 },
  { key: 'chevrolet/colorado', src: [['chevrolet', /^COLORADO/]], sales: 110 },
  { key: 'chevrolet/suburban', src: [['chevrolet', /^SUBURBAN( 1500)?$/]], sales: [[2000, 130], [2005, 50]] },
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
  { key: 'jeep/grand cherokee', src: [['jeep', /^GRAND CHEROKEE/]], sales: [[2000, 250], [2005, 200], [2008, 80], [2011, 140], [2014, 200], [2016, 220], [2020, 230]] },
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
  { key: 'subaru/forester', src: [['subaru', /^FORESTER/]], sales: [[2000, 50], [2005, 170]] },
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
  { key: 'dodge/durango', src: [['dodge', /^DURANGO( SRT)?$/]], sales: [[2000, 150], [2005, 65]] },
  { key: 'dodge/grand caravan', src: [['dodge', /^GRAND CARAVAN(?! CARGO)/]], sales: 120, to: 2020 },
  { key: 'dodge/journey', src: [['dodge', /^JOURNEY$/]], sales: 90, from: 2009, to: 2020 },
  { key: 'chrysler/200', src: [['chrysler', /^200$/]], sales: 120, from: 2011, to: 2017 },
  { key: 'chrysler/pacifica', src: [['chrysler', /^PACIFICA/]], sales: 100, from: 2017 },
  // GM trucks & SUVs
  { key: 'gmc/sierra', src: [['gmc', /^SIERRA( 1500.*| HYBRID)?$/]], sales: 200 },
  { key: 'gmc/yukon', src: [['gmc', /^YUKON/]], sales: [[2000, 120], [2005, 75]] },
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
  { key: 'lexus/gs', src: [['lexus', /^GS/]], sales: [[2000, 25], [2003, 15], [2006, 25], [2008, 12], [2010, 6], [2013, 18], [2016, 8], [2018, 4]], to: 2020 },
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
  // Added 2026-11-07. Sales are published US calendar-year figures for each year, in thousands,
  // used as that model year's sales (sources: GoodCarBadCar, Wikipedia, CarFigures). Years with
  // no supportable figure are left out through from/to.
  { key: 'ford/transit', src: [['ford', /^TRANSIT(?! CONNECT| VAN B| T-350 HD)/]], sales: [[2015, 118], [2016, 143], [2017, 127], [2018, 138], [2019, 154], [2020, 132], [2021, 100], [2022, 93], [2023, 121], [2024, 140]], from: 2015, to: 2024 },
  { key: 'ford/taurus', src: [['ford', /^TAURUS$/]], sales: [[2000, 382], [2001, 354], [2002, 333], [2003, 300], [2004, 248], [2005, 197], [2006, 175], [2007, 33], [2008, 53], [2009, 46], [2010, 69], [2011, 63], [2012, 74], [2013, 80], [2014, 63], [2015, 49], [2016, 44], [2017, 41], [2018, 40], [2019, 13]], from: 2000, to: 2019 },
  { key: 'nissan/titan', src: [['nissan', /^TITAN( CREW CAB| KING CAB)?$/]], sales: [[2004, 84], [2005, 87], [2006, 72], [2007, 66], [2008, 34], [2009, 19], [2010, 23], [2011, 22], [2012, 22], [2013, 16], [2014, 13], [2015, 12]], from: 2004, to: 2015 },
  { key: 'nissan/armada', src: [['nissan', /^ARMADA$/]], sales: [[2005, 40], [2006, 33], [2007, 32], [2008, 16], [2009, 10], [2010, 19], [2011, 18], [2012, 18], [2013, 14], [2014, 13], [2015, 13], [2016, 14], [2017, 36], [2018, 33], [2019, 32], [2020, 20], [2021, 23], [2022, 12], [2023, 21], [2024, 15]], from: 2005, to: 2024 },
  { key: 'nissan/xterra', src: [['nissan', /^XTERRA$/]], sales: [[2000, 89], [2001, 87], [2002, 80], [2003, 68], [2004, 67], [2005, 73], [2006, 62], [2007, 51], [2008, 34], [2009, 16], [2010, 21], [2011, 18], [2012, 17], [2013, 18], [2014, 17], [2015, 11]], from: 2000, to: 2015 },
  { key: 'gmc/canyon', src: [['gmc', /^CANYON/]], sales: [[2005, 35], [2006, 24], [2007, 21], [2008, 15], [2009, 10], [2010, 8], [2011, 10], [2012, 9], [2013, 1], [2014, 3], [2015, 30], [2016, 37], [2017, 31], [2018, 33], [2019, 33], [2020, 25], [2021, 24], [2022, 28], [2023, 22], [2024, 38]], from: 2005, to: 2024 },
  { key: 'chevrolet/impala', src: [['chevrolet', /^IMPALA/]], sales: [[2005, 246], [2006, 290], [2007, 311], [2008, 266], [2009, 166], [2010, 172], [2011, 171], [2012, 169], [2013, 157], [2014, 140], [2015, 117], [2016, 97], [2017, 76], [2018, 57], [2019, 45], [2020, 10]], from: 2005, to: 2020 },
  { key: 'chevrolet/corvette', src: [['chevrolet', /^CORVETTE/]], sales: [[2000, 31], [2001, 34], [2002, 33], [2003, 28], [2004, 35], [2005, 32], [2006, 37], [2007, 34], [2008, 27], [2009, 14], [2010, 13], [2011, 13], [2012, 14], [2013, 17], [2014, 35], [2015, 33], [2016, 30], [2017, 25], [2018, 19], [2019, 18], [2020, 22], [2021, 33], [2022, 38], [2023, 34], [2024, 33]], from: 2000, to: 2024 },
  { key: 'audi/q7', src: [['audi', /^(AUDI )?S?Q7/]], sales: [[2007, 21], [2008, 13], [2009, 7], [2010, 8], [2011, 9], [2012, 11], [2013, 16], [2014, 19], [2015, 19], [2016, 31], [2017, 38], [2018, 37], [2019, 35], [2020, 25], [2021, 25], [2022, 18], [2023, 26], [2024, 21]], from: 2007, to: 2024 },
  { key: 'audi/a3', src: [['audi', /^(AUDI )?(A3|S3|RS ?3)/]], sales: [[2006, 8], [2007, 6], [2008, 5], [2009, 4], [2010, 7], [2011, 7], [2012, 7], [2013, 1], [2014, 22], [2015, 36], [2016, 32], [2017, 24], [2018, 18], [2019, 10], [2020, 10], [2021, 2], [2022, 11], [2023, 14], [2024, 10]], from: 2006, to: 2024, skip: [2013, 2014] },
  { key: 'audi/a6', src: [['audi', /^(AUDI )?(A6|S6|RS ?6)/]], sales: [[2005, 18], [2006, 16], [2007, 12], [2008, 12], [2009, 7], [2010, 9], [2011, 11], [2012, 19], [2013, 22], [2014, 24], [2015, 23], [2016, 19], [2017, 16], [2018, 11], [2019, 18], [2020, 11], [2021, 10], [2022, 6], [2023, 8], [2024, 9]], from: 2005, to: 2024 },
  { key: 'bmw/x1', src: [['bmw', /^X1\b/]], sales: [[2013, 27], [2014, 23], [2015, 14], [2016, 28], [2017, 31], [2018, 29], [2019, 18], [2020, 14], [2021, 18], [2022, 7], [2023, 21], [2024, 27]], from: 2013, to: 2024 },
  { key: 'volvo/xc90', src: [['volvo', /^XC90/]], sales: [[2003, 36], [2004, 39], [2005, 36], [2006, 33], [2007, 31], [2008, 19], [2009, 11], [2010, 10], [2011, 11], [2012, 10], [2013, 7], [2014, 4], [2015, 13], [2016, 32], [2017, 31], [2018, 32], [2019, 36], [2020, 34], [2021, 39], [2022, 34], [2023, 40], [2024, 40]], from: 2003, to: 2024 },
  { key: 'volvo/xc60', src: [['volvo', /^XC60/]], sales: [[2010, 12], [2011, 13], [2012, 19], [2013, 20], [2014, 19], [2015, 26], [2016, 20], [2017, 23], [2018, 33], [2019, 31], [2020, 32], [2021, 42], [2022, 36], [2023, 40], [2024, 40]], from: 2010, to: 2024 },
  { key: 'porsche/cayenne', src: [['porsche', /^CAYENNE/]], sales: [[2005, 14], [2006, 11], [2007, 13], [2008, 11], [2009, 8], [2010, 8], [2011, 13], [2012, 16], [2013, 19], [2014, 16], [2015, 16], [2016, 15], [2017, 13], [2018, 11], [2019, 19], [2020, 18], [2021, 21], [2022, 21], [2023, 20], [2024, 21]], from: 2005, to: 2024 },
  { key: 'cadillac/xt5', src: [['cadillac', /^XT5$/]], sales: [[2017, 68], [2018, 61], [2019, 50], [2020, 35], [2021, 28], [2022, 27], [2023, 27], [2024, 26]], from: 2017, to: 2024 },
  { key: 'cadillac/srx', src: [['cadillac', /^SRX$/]], sales: [[2004, 30], [2005, 23], [2006, 22], [2007, 23], [2008, 16], [2009, 20], [2010, 51], [2011, 57], [2012, 57], [2013, 57], [2014, 54], [2015, 69], [2016, 22]], from: 2004, to: 2016 },
  { key: 'cadillac/cts', src: [['cadillac', /^CTS/]], sales: [[2005, 62], [2006, 55], [2007, 57], [2008, 59], [2009, 39], [2010, 46], [2011, 55], [2012, 52], [2013, 32], [2014, 31], [2015, 19], [2016, 16], [2017, 10], [2018, 11], [2019, 7]], from: 2005, to: 2019 },
  { key: 'lexus/gx', src: [['lexus', /^GX/]], sales: [[2005, 34], [2006, 25], [2007, 23], [2008, 16], [2009, 6], [2010, 16], [2011, 12], [2012, 11], [2013, 12], [2014, 23], [2015, 25], [2016, 25], [2017, 27], [2018, 27], [2019, 26], [2020, 29], [2021, 33], [2022, 30], [2023, 32], [2024, 31]], from: 2005, to: 2024 },
  { key: 'lexus/is', src: [['lexus', /^IS/]], sales: [[2005, 16], [2006, 54], [2007, 55], [2008, 49], [2009, 38], [2010, 34], [2011, 30], [2012, 28], [2013, 35], [2014, 52], [2015, 46], [2016, 37], [2017, 26], [2018, 23], [2019, 15], [2020, 14], [2021, 22], [2022, 21], [2023, 23], [2024, 19]], from: 2005, to: 2024 },
  { key: 'toyota/land cruiser', src: [['toyota', /^LAND CRUISER$/]], sales: [[2005, 5], [2006, 3], [2007, 3], [2008, 4], [2009, 2], [2010, 2], [2011, 2], [2012, 3], [2013, 3], [2014, 3], [2015, 3], [2016, 4], [2017, 3], [2018, 3], [2019, 4], [2020, 3], [2021, 4]], from: 2005, to: 2021 },
  { key: 'toyota/avalon', src: [['toyota', /^AVALON( HYBRID)?$/]], sales: [[2000, 104], [2001, 83], [2002, 69], [2003, 51], [2004, 36], [2005, 95], [2006, 89], [2007, 73], [2008, 43], [2009, 27], [2010, 28], [2011, 29], [2012, 30], [2013, 71], [2014, 67], [2015, 60], [2016, 48], [2017, 33], [2018, 34], [2019, 28], [2020, 18], [2021, 19], [2022, 12]], from: 2000, to: 2022 },
  { key: 'toyota/yaris', src: [['toyota', /^YARIS( HATCHBACK| IA| LIFTBACK)?$/]], sales: [[2007, 85], [2008, 102], [2009, 64], [2010, 40], [2011, 33], [2012, 31], [2013, 21], [2014, 13], [2015, 19], [2016, 17], [2017, 44], [2018, 27], [2019, 22], [2020, 6]], from: 2007, to: 2020 },
  { key: 'mitsubishi/outlander', src: [['mitsubishi', /^OUTLANDER( PHEV)?$/]], sales: [[2005, 12], [2006, 11], [2007, 23], [2008, 13], [2009, 10], [2010, 13], [2011, 10], [2012, 8], [2013, 12], [2014, 13], [2015, 19], [2016, 28], [2017, 35], [2018, 38], [2019, 38], [2020, 27], [2021, 34], [2022, 41], [2023, 43], [2024, 45]], from: 2005, to: 2024 },
  { key: 'jeep/liberty', src: [['jeep', /^LIBERTY/]], sales: [[2002, 171], [2003, 163], [2004, 167], [2005, 167], [2006, 134], [2007, 92], [2008, 67], [2009, 44], [2010, 50], [2011, 67], [2012, 75]], from: 2002, to: 2012 },
  { key: 'jeep/renegade', src: [['jeep', /^RENEGADE$/]], sales: [[2015, 61], [2016, 107], [2017, 103], [2018, 97], [2019, 77], [2020, 63], [2021, 47], [2022, 22], [2023, 9]], from: 2015, to: 2023 },
  { key: 'lincoln/navigator', src: [['lincoln', /^NAVIGATOR/]], sales: [[2000, 38], [2001, 32], [2002, 31], [2003, 39], [2004, 36], [2005, 26], [2006, 24], [2007, 24], [2008, 15], [2009, 8], [2010, 8], [2011, 8], [2012, 8], [2013, 9], [2014, 10], [2015, 12], [2016, 10], [2017, 11], [2018, 18], [2019, 19], [2020, 15], [2021, 16], [2022, 13], [2023, 18], [2024, 16]], from: 2000, to: 2024 },
  { key: 'land rover/range rover', src: [['land rover', /^RANGE ROVER( \(LWB\)| \(SWB\)| LWB| SWB)?( PHEV)?$/]], sales: [[2005, 13], [2006, 12], [2007, 12], [2008, 5], [2009, 7], [2010, 9], [2011, 10], [2012, 8], [2013, 12], [2014, 13], [2015, 18], [2016, 16], [2017, 17], [2018, 19], [2019, 19], [2020, 14], [2021, 17], [2022, 13], [2023, 16], [2024, 22]], from: 2005, to: 2024 },
  { key: 'chrysler/300', src: [['chrysler', /^300C?$/]], sales: [[2005, 144], [2006, 144], [2007, 121], [2008, 62], [2009, 39], [2010, 37], [2011, 36], [2012, 71], [2013, 58], [2014, 53], [2015, 53], [2016, 53], [2017, 51], [2018, 47], [2019, 29], [2020, 16], [2021, 17], [2022, 14], [2023, 13]], from: 2005, to: 2023 },
  { key: 'chrysler/town & country', src: [['chrysler', /^TOWN (&|AND) COUNTRY$/]], sales: [[2000, 101], [2001, 143], [2002, 126], [2003, 121], [2004, 144], [2005, 181], [2006, 159], [2007, 138], [2008, 118], [2009, 85], [2010, 112], [2011, 94], [2012, 112], [2013, 122], [2014, 138], [2015, 94], [2016, 63]], from: 2000, to: 2016 },
  { key: 'subaru/legacy', src: [['subaru', /^LEGACY/]], sales: [[2010, 39], [2011, 42], [2012, 47], [2013, 43], [2014, 52], [2015, 60], [2016, 65], [2017, 50], [2018, 40], [2019, 35], [2020, 27], [2021, 23], [2022, 23], [2023, 26], [2024, 20]], from: 2010, to: 2024 },
  { key: 'kia/sedona', src: [['kia', /^SEDONA/]], sales: [[2005, 53], [2006, 57], [2007, 40], [2008, 27], [2009, 27], [2010, 22], [2011, 24], [2012, 18], [2013, 7], [2014, 15], [2015, 37], [2016, 44], [2017, 24], [2018, 18], [2019, 16], [2020, 13], [2021, 15]], from: 2005, to: 2021 },
  { key: 'kia/rio', src: [['kia', /^RIO/]], sales: [[2001, 52], [2002, 51], [2003, 41], [2004, 39], [2005, 30], [2006, 28], [2007, 33], [2008, 37], [2009, 35], [2010, 25], [2011, 20], [2012, 40], [2013, 41], [2014, 36], [2015, 24], [2016, 29], [2017, 17], [2018, 23], [2019, 25], [2020, 24], [2021, 31], [2022, 27], [2023, 27]], from: 2001, to: 2023 },
  { key: 'dodge/dart', src: [['dodge', /^DART$/]], sales: [[2013, 83], [2014, 84], [2015, 87], [2016, 44]], from: 2013, to: 2016 },
  { key: 'honda/fit', src: [['honda', /^FIT$/]], sales: [[2007, 56], [2008, 80], [2009, 67], [2010, 54], [2011, 59], [2012, 49], [2013, 54], [2014, 59], [2015, 53], [2016, 57], [2017, 48], [2018, 35], [2019, 35], [2020, 32]], from: 2007, to: 2020 },
  { key: 'hyundai/accent', src: [['hyundai', /^ACCENT/]], sales: [[2005, 44], [2006, 35], [2007, 36], [2008, 50], [2009, 67], [2010, 52], [2011, 56], [2012, 61], [2013, 60], [2014, 63], [2015, 61], [2016, 80], [2017, 59], [2018, 29], [2019, 26], [2020, 16], [2021, 20], [2022, 18]], from: 2005, to: 2022 },
  { key: 'mini/cooper', src: [['mini', /^(COOPER( S| SE| JCW| WORKS)?( HARDTOP| CONVERTIBLE)?|HARDTOP( 2DR| 4DR)?|CONVERTIBLE|JCW( HARDTOP| CONVERTIBLE)?|JOHN COOPER WORKS)$/]], sales: [[2005, 41], [2006, 39], [2007, 42], [2008, 54], [2009, 45], [2010, 46], [2011, 42], [2012, 45], [2013, 45], [2014, 33], [2015, 42], [2016, 39], [2017, 32], [2018, 26], [2019, 22], [2020, 19], [2021, 23], [2022, 20], [2023, 21], [2024, 15]], from: 2005, to: 2024 },
  { key: 'mercedes-benz/s-class', src: [['mercedes-benz', /^S(-CLASS|\d{3})/]], sales: [[2005, 16], [2006, 31], [2007, 26], [2008, 18], [2009, 11], [2010, 14], [2011, 12], [2012, 12], [2013, 13], [2014, 25], [2015, 22], [2016, 19], [2017, 16], [2018, 15], [2019, 13], [2020, 9], [2021, 14], [2022, 16], [2023, 12], [2024, 9]], from: 2005, to: 2024 },
  { key: 'mercedes-benz/cla', src: [['mercedes-benz', /^CLA/]], sales: [[2014, 27], [2015, 30], [2016, 26], [2017, 21], [2018, 23], [2019, 13], [2020, 11], [2021, 7]], from: 2014, to: 2021 },
  { key: 'infiniti/g35', src: [['infiniti', /^G35/]], sales: [[2005, 69], [2006, 61], [2007, 72]], from: 2005, to: 2007 },
  { key: 'infiniti/g37', src: [['infiniti', /^G37/]], sales: [[2009, 47], [2010, 58], [2011, 58], [2012, 60], [2013, 40]], from: 2009, to: 2013 },
  { key: 'acura/tl', src: [['acura', /^TL$/]], sales: [[2000, 67], [2001, 69], [2002, 61], [2003, 57], [2004, 78], [2005, 78], [2006, 71], [2007, 58], [2008, 46], [2009, 34], [2010, 34], [2011, 31], [2012, 34], [2013, 24], [2014, 11]], from: 2000, to: 2014 },
];

const FIRST_YEAR = 2000;
const LAST_YEAR = 2024; // newer model years haven't had time to collect complaints

// Sales (thousands) for a model in a given model year
function salesFor(m, y) {
  if (typeof m.sales === 'number') return m.sales;
  let v = m.sales[0][1];
  for (const [from, k] of m.sales) if (y >= from) v = k;
  return v;
}

module.exports = { MODELS, FIRST_YEAR, LAST_YEAR, salesFor };
