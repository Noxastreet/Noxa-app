export const VEHICLE_CATALOG_YEAR = 2026;

export type VehicleYearRange = {
  from: number;
  to: number | null;
};

export type VehicleCatalogGeneration = {
  id: string;
  label: string;
  yearRanges: VehicleYearRange[];
};

export type VehicleCatalogModel = {
  id: string;
  name: string;
  yearRanges: VehicleYearRange[];
  generations?: VehicleCatalogGeneration[];
};

export type VehicleCatalogMake = {
  id: string;
  name: string;
  popular?: boolean;
  models: VehicleCatalogModel[];
};

const current = (from: number): VehicleYearRange => ({ from, to: null });
const range = (from: number, to: number): VehicleYearRange => ({ from, to });

/**
 * Curated MVP catalog for the NOXA vehicle picker.
 *
 * Rules:
 * - This is intentionally not an exhaustive global vehicle database.
 * - Year ranges are production/model-year windows for picker guidance, not VIN certification.
 * - Discontinued/revived nameplates may have multiple ranges.
 * - Manual entry must remain available when a user's vehicle is missing.
 * - Generations are optional and can be expanded incrementally without changing the picker contract.
 */
export const vehicleCatalog: VehicleCatalogMake[] = [
  {
    id: "bmw",
    name: "BMW",
    popular: true,
    models: [
      { id: "1-series", name: "1 Series", yearRanges: [current(2004)] },
      { id: "2-series", name: "2 Series", yearRanges: [current(2014)] },
      {
        id: "3-series",
        name: "3 Series",
        yearRanges: [current(1975)],
        generations: [
          { id: "e30", label: "E30", yearRanges: [range(1982, 1994)] },
          { id: "e36", label: "E36", yearRanges: [range(1990, 2000)] },
          { id: "e46", label: "E46", yearRanges: [range(1997, 2006)] },
          { id: "e90", label: "E9x", yearRanges: [range(2004, 2013)] },
          { id: "f30", label: "F3x", yearRanges: [range(2011, 2019)] },
          { id: "g20", label: "G20/G21", yearRanges: [current(2018)] },
        ],
      },
      { id: "4-series", name: "4 Series", yearRanges: [current(2013)] },
      { id: "5-series", name: "5 Series", yearRanges: [current(1972)] },
      { id: "7-series", name: "7 Series", yearRanges: [current(1977)] },
      { id: "x1", name: "X1", yearRanges: [current(2009)] },
      { id: "x3", name: "X3", yearRanges: [current(2003)] },
      { id: "x5", name: "X5", yearRanges: [current(1999)] },
      { id: "z4", name: "Z4", yearRanges: [current(2002)] },
      { id: "m2", name: "M2", yearRanges: [current(2016)] },
      { id: "m3", name: "M3", yearRanges: [current(1986)] },
      { id: "m4", name: "M4", yearRanges: [current(2014)] },
    ],
  },
  {
    id: "mercedes-benz",
    name: "Mercedes-Benz",
    popular: true,
    models: [
      { id: "a-class", name: "A-Class", yearRanges: [current(1997)] },
      { id: "b-class", name: "B-Class", yearRanges: [current(2005)] },
      { id: "c-class", name: "C-Class", yearRanges: [current(1993)] },
      { id: "e-class", name: "E-Class", yearRanges: [current(1993)] },
      { id: "s-class", name: "S-Class", yearRanges: [current(1972)] },
      { id: "cla", name: "CLA", yearRanges: [current(2013)] },
      { id: "cls", name: "CLS", yearRanges: [range(2004, 2023)] },
      { id: "gla", name: "GLA", yearRanges: [current(2013)] },
      { id: "glc", name: "GLC", yearRanges: [current(2015)] },
      { id: "gle", name: "GLE", yearRanges: [current(2015)] },
      { id: "slk-slc", name: "SLK / SLC", yearRanges: [range(1996, 2020)] },
      { id: "amg-gt", name: "AMG GT", yearRanges: [current(2014)] },
    ],
  },
  {
    id: "audi",
    name: "Audi",
    popular: true,
    models: [
      { id: "a1", name: "A1", yearRanges: [current(2010)] },
      { id: "a3", name: "A3", yearRanges: [current(1996)] },
      { id: "a4", name: "A4", yearRanges: [current(1994)] },
      { id: "a5", name: "A5", yearRanges: [current(2007)] },
      { id: "a6", name: "A6", yearRanges: [current(1994)] },
      { id: "a7", name: "A7", yearRanges: [current(2010)] },
      { id: "a8", name: "A8", yearRanges: [current(1994)] },
      { id: "tt", name: "TT", yearRanges: [range(1998, 2023)] },
      { id: "q2", name: "Q2", yearRanges: [current(2016)] },
      { id: "q3", name: "Q3", yearRanges: [current(2011)] },
      { id: "q5", name: "Q5", yearRanges: [current(2008)] },
      { id: "q7", name: "Q7", yearRanges: [current(2005)] },
    ],
  },
  {
    id: "volkswagen",
    name: "Volkswagen",
    popular: true,
    models: [
      { id: "polo", name: "Polo", yearRanges: [current(1975)] },
      {
        id: "golf",
        name: "Golf",
        yearRanges: [current(1974)],
        generations: [
          { id: "mk2", label: "Mk2", yearRanges: [range(1983, 1992)] },
          { id: "mk3", label: "Mk3", yearRanges: [range(1991, 1998)] },
          { id: "mk4", label: "Mk4", yearRanges: [range(1997, 2006)] },
          { id: "mk5", label: "Mk5", yearRanges: [range(2003, 2009)] },
          { id: "mk6", label: "Mk6", yearRanges: [range(2008, 2012)] },
          { id: "mk7", label: "Mk7", yearRanges: [range(2012, 2020)] },
          { id: "mk8", label: "Mk8", yearRanges: [current(2019)] },
        ],
      },
      { id: "passat", name: "Passat", yearRanges: [current(1973)] },
      { id: "scirocco", name: "Scirocco", yearRanges: [range(1974, 1992), range(2008, 2017)] },
      { id: "beetle", name: "Beetle", yearRanges: [range(1997, 2019)] },
      { id: "up", name: "up!", yearRanges: [range(2011, 2023)] },
      { id: "t-roc", name: "T-Roc", yearRanges: [current(2017)] },
      { id: "tiguan", name: "Tiguan", yearRanges: [current(2007)] },
      { id: "touareg", name: "Touareg", yearRanges: [current(2002)] },
      { id: "touran", name: "Touran", yearRanges: [current(2003)] },
      { id: "arteon", name: "Arteon", yearRanges: [range(2017, 2024)] },
      { id: "id3", name: "ID.3", yearRanges: [current(2019)] },
      { id: "id4", name: "ID.4", yearRanges: [current(2020)] },
    ],
  },
  {
    id: "toyota",
    name: "Toyota",
    popular: true,
    models: [
      { id: "yaris", name: "Yaris", yearRanges: [current(1999)] },
      { id: "corolla", name: "Corolla", yearRanges: [current(1966)] },
      { id: "aygo", name: "Aygo", yearRanges: [range(2005, 2022)] },
      { id: "aygo-x", name: "Aygo X", yearRanges: [current(2022)] },
      { id: "auris", name: "Auris", yearRanges: [range(2006, 2018)] },
      { id: "c-hr", name: "C-HR", yearRanges: [current(2016)] },
      { id: "rav4", name: "RAV4", yearRanges: [current(1994)] },
      { id: "prius", name: "Prius", yearRanges: [current(1997)] },
      { id: "gt86", name: "GT86", yearRanges: [range(2012, 2021)] },
      { id: "gr86", name: "GR86", yearRanges: [current(2021)] },
      { id: "supra", name: "Supra", yearRanges: [range(1978, 2002), current(2019)] },
      { id: "celica", name: "Celica", yearRanges: [range(1970, 2006)] },
      { id: "mr2", name: "MR2", yearRanges: [range(1984, 2007)] },
      { id: "land-cruiser", name: "Land Cruiser", yearRanges: [current(1951)] },
    ],
  },
  {
    id: "honda",
    name: "Honda",
    popular: true,
    models: [
      { id: "civic", name: "Civic", yearRanges: [current(1972)] },
      { id: "jazz", name: "Jazz", yearRanges: [current(2001)] },
      { id: "accord", name: "Accord", yearRanges: [current(1976)] },
      { id: "cr-v", name: "CR-V", yearRanges: [current(1995)] },
      { id: "hr-v", name: "HR-V", yearRanges: [range(1998, 2006), current(2013)] },
      { id: "s2000", name: "S2000", yearRanges: [range(1999, 2009)] },
      { id: "integra", name: "Integra", yearRanges: [range(1985, 2006), current(2021)] },
      { id: "prelude", name: "Prelude", yearRanges: [range(1978, 2001), current(2025)] },
      { id: "nsx", name: "NSX", yearRanges: [range(1990, 2005), range(2016, 2022)] },
      { id: "cr-z", name: "CR-Z", yearRanges: [range(2010, 2016)] },
    ],
  },
  {
    id: "mazda",
    name: "Mazda",
    popular: true,
    models: [
      { id: "2", name: "Mazda2", yearRanges: [current(2002)] },
      { id: "3", name: "Mazda3", yearRanges: [current(2003)] },
      { id: "6", name: "Mazda6", yearRanges: [range(2002, 2024)] },
      { id: "cx-3", name: "CX-3", yearRanges: [range(2015, 2025)] },
      { id: "cx-30", name: "CX-30", yearRanges: [current(2019)] },
      { id: "cx-5", name: "CX-5", yearRanges: [current(2012)] },
      {
        id: "mx-5",
        name: "MX-5",
        yearRanges: [current(1989)],
        generations: [
          { id: "na", label: "NA", yearRanges: [range(1989, 1997)] },
          { id: "nb", label: "NB", yearRanges: [range(1998, 2005)] },
          { id: "nc", label: "NC", yearRanges: [range(2005, 2015)] },
          { id: "nd", label: "ND", yearRanges: [current(2015)] },
        ],
      },
      { id: "rx-7", name: "RX-7", yearRanges: [range(1978, 2002)] },
      { id: "rx-8", name: "RX-8", yearRanges: [range(2003, 2012)] },
      { id: "323", name: "323", yearRanges: [range(1977, 2003)] },
      { id: "626", name: "626", yearRanges: [range(1978, 2002)] },
    ],
  },
  {
    id: "nissan",
    name: "Nissan",
    popular: true,
    models: [
      { id: "micra", name: "Micra", yearRanges: [range(1982, 2023), current(2025)] },
      { id: "note", name: "Note", yearRanges: [current(2004)] },
      { id: "qashqai", name: "Qashqai", yearRanges: [current(2006)] },
      { id: "juke", name: "Juke", yearRanges: [current(2010)] },
      { id: "x-trail", name: "X-Trail", yearRanges: [current(2000)] },
      { id: "350z", name: "350Z", yearRanges: [range(2002, 2009)] },
      { id: "370z", name: "370Z", yearRanges: [range(2008, 2020)] },
      { id: "z", name: "Z", yearRanges: [current(2022)] },
      { id: "gt-r", name: "GT-R", yearRanges: [range(2007, 2025)] },
      { id: "silvia", name: "Silvia", yearRanges: [range(1965, 2002)] },
      { id: "primera", name: "Primera", yearRanges: [range(1990, 2007)] },
      { id: "patrol", name: "Patrol", yearRanges: [current(1951)] },
    ],
  },
  {
    id: "opel",
    name: "Opel",
    popular: true,
    models: [
      { id: "corsa", name: "Corsa", yearRanges: [current(1982)] },
      { id: "astra", name: "Astra", yearRanges: [current(1991)] },
      { id: "vectra", name: "Vectra", yearRanges: [range(1988, 2008)] },
      { id: "insignia", name: "Insignia", yearRanges: [range(2008, 2022)] },
      { id: "zafira", name: "Zafira", yearRanges: [range(1999, 2019)] },
      { id: "zafira-life", name: "Zafira Life", yearRanges: [current(2019)] },
      { id: "mokka", name: "Mokka", yearRanges: [current(2012)] },
      { id: "adam", name: "Adam", yearRanges: [range(2012, 2019)] },
      { id: "calibra", name: "Calibra", yearRanges: [range(1989, 1997)] },
      { id: "tigra", name: "Tigra", yearRanges: [range(1994, 2001), range(2004, 2009)] },
      { id: "meriva", name: "Meriva", yearRanges: [range(2003, 2017)] },
      { id: "omega", name: "Omega", yearRanges: [range(1986, 2003)] },
      { id: "grandland", name: "Grandland", yearRanges: [current(2017)] },
    ],
  },
  {
    id: "ford",
    name: "Ford",
    popular: true,
    models: [
      { id: "fiesta", name: "Fiesta", yearRanges: [range(1976, 2023)] },
      { id: "focus", name: "Focus", yearRanges: [range(1998, 2025)] },
      { id: "mondeo", name: "Mondeo", yearRanges: [range(1993, 2022)] },
      { id: "puma", name: "Puma", yearRanges: [range(1997, 2002), current(2019)] },
      { id: "kuga", name: "Kuga", yearRanges: [current(2008)] },
      { id: "mustang", name: "Mustang", yearRanges: [current(1964)] },
      { id: "ka", name: "Ka", yearRanges: [range(1996, 2021)] },
      { id: "escort", name: "Escort", yearRanges: [range(1968, 2002)] },
      { id: "sierra", name: "Sierra", yearRanges: [range(1982, 1993)] },
      { id: "ecosport", name: "EcoSport", yearRanges: [range(2003, 2023)] },
      { id: "s-max", name: "S-Max", yearRanges: [range(2006, 2023)] },
      { id: "ranger", name: "Ranger", yearRanges: [current(1982)] },
    ],
  },
  {
    id: "peugeot",
    name: "Peugeot",
    popular: true,
    models: [
      { id: "106", name: "106", yearRanges: [range(1991, 2003)] },
      { id: "205", name: "205", yearRanges: [range(1983, 1998)] },
      { id: "206", name: "206", yearRanges: [range(1998, 2012)] },
      { id: "207", name: "207", yearRanges: [range(2006, 2014)] },
      { id: "208", name: "208", yearRanges: [current(2012)] },
      { id: "306", name: "306", yearRanges: [range(1993, 2002)] },
      { id: "307", name: "307", yearRanges: [range(2001, 2008)] },
      { id: "308", name: "308", yearRanges: [current(2007)] },
      { id: "406", name: "406", yearRanges: [range(1995, 2004)] },
      { id: "407", name: "407", yearRanges: [range(2004, 2011)] },
      { id: "508", name: "508", yearRanges: [current(2010)] },
      { id: "2008", name: "2008", yearRanges: [current(2013)] },
      { id: "3008", name: "3008", yearRanges: [current(2008)] },
      { id: "5008", name: "5008", yearRanges: [current(2009)] },
      { id: "rcz", name: "RCZ", yearRanges: [range(2009, 2015)] },
    ],
  },
  {
    id: "renault",
    name: "Renault",
    popular: true,
    models: [
      { id: "clio", name: "Clio", yearRanges: [current(1990)] },
      { id: "megane", name: "Megane", yearRanges: [current(1995)] },
      { id: "twingo", name: "Twingo", yearRanges: [range(1992, 2024)] },
      { id: "laguna", name: "Laguna", yearRanges: [range(1994, 2015)] },
      { id: "scenic", name: "Scenic", yearRanges: [current(1996)] },
      { id: "captur", name: "Captur", yearRanges: [current(2013)] },
      { id: "kadjar", name: "Kadjar", yearRanges: [range(2015, 2022)] },
      { id: "austral", name: "Austral", yearRanges: [current(2022)] },
      { id: "arkana", name: "Arkana", yearRanges: [current(2019)] },
      { id: "espace", name: "Espace", yearRanges: [current(1984)] },
      { id: "kangoo", name: "Kangoo", yearRanges: [current(1997)] },
      { id: "19", name: "19", yearRanges: [range(1988, 1997)] },
    ],
  },
  {
    id: "citroen",
    name: "Citroen",
    popular: true,
    models: [
      { id: "c1", name: "C1", yearRanges: [range(2005, 2022)] },
      { id: "c2", name: "C2", yearRanges: [range(2003, 2009)] },
      { id: "c3", name: "C3", yearRanges: [current(2002)] },
      { id: "c4", name: "C4", yearRanges: [current(2004)] },
      { id: "c5", name: "C5", yearRanges: [range(2001, 2017)] },
      { id: "c5-x", name: "C5 X", yearRanges: [current(2021)] },
      { id: "saxo", name: "Saxo", yearRanges: [range(1996, 2003)] },
      { id: "xsara", name: "Xsara", yearRanges: [range(1997, 2006)] },
      { id: "berlingo", name: "Berlingo", yearRanges: [current(1996)] },
      { id: "c4-cactus", name: "C4 Cactus", yearRanges: [range(2014, 2020)] },
      { id: "c3-aircross", name: "C3 Aircross", yearRanges: [current(2017)] },
      { id: "c5-aircross", name: "C5 Aircross", yearRanges: [current(2017)] },
    ],
  },
  {
    id: "hyundai",
    name: "Hyundai",
    popular: true,
    models: [
      { id: "i10", name: "i10", yearRanges: [current(2007)] },
      { id: "i20", name: "i20", yearRanges: [current(2008)] },
      { id: "i30", name: "i30", yearRanges: [current(2007)] },
      { id: "accent", name: "Accent", yearRanges: [current(1994)] },
      { id: "elantra", name: "Elantra", yearRanges: [current(1990)] },
      { id: "tucson", name: "Tucson", yearRanges: [current(2004)] },
      { id: "santa-fe", name: "Santa Fe", yearRanges: [current(2000)] },
      { id: "kona", name: "Kona", yearRanges: [current(2017)] },
      { id: "coupe", name: "Coupe / Tiburon", yearRanges: [range(1996, 2008)] },
      { id: "veloster", name: "Veloster", yearRanges: [range(2011, 2022)] },
      { id: "ioniq", name: "Ioniq", yearRanges: [range(2016, 2022)] },
      { id: "ioniq-5", name: "Ioniq 5", yearRanges: [current(2021)] },
      { id: "ioniq-6", name: "Ioniq 6", yearRanges: [current(2022)] },
      { id: "getz", name: "Getz", yearRanges: [range(2002, 2011)] },
    ],
  },
  {
    id: "kia",
    name: "Kia",
    popular: true,
    models: [
      { id: "picanto", name: "Picanto", yearRanges: [current(2004)] },
      { id: "rio", name: "Rio", yearRanges: [range(2000, 2023)] },
      { id: "ceed", name: "Ceed", yearRanges: [current(2006)] },
      { id: "proceed", name: "ProCeed", yearRanges: [current(2008)] },
      { id: "stonic", name: "Stonic", yearRanges: [current(2017)] },
      { id: "sportage", name: "Sportage", yearRanges: [current(1993)] },
      { id: "sorento", name: "Sorento", yearRanges: [current(2002)] },
      { id: "stinger", name: "Stinger", yearRanges: [range(2017, 2023)] },
      { id: "soul", name: "Soul", yearRanges: [current(2008)] },
      { id: "niro", name: "Niro", yearRanges: [current(2016)] },
      { id: "ev6", name: "EV6", yearRanges: [current(2021)] },
      { id: "xceed", name: "XCeed", yearRanges: [current(2019)] },
    ],
  },
  {
    id: "alfa-romeo",
    name: "Alfa Romeo",
    models: [
      { id: "145", name: "145", yearRanges: [range(1994, 2000)] },
      { id: "146", name: "146", yearRanges: [range(1995, 2000)] },
      { id: "147", name: "147", yearRanges: [range(2000, 2010)] },
      { id: "156", name: "156", yearRanges: [range(1997, 2007)] },
      { id: "159", name: "159", yearRanges: [range(2005, 2011)] },
      { id: "166", name: "166", yearRanges: [range(1998, 2007)] },
      { id: "giulietta", name: "Giulietta", yearRanges: [range(2010, 2020)] },
      { id: "giulia", name: "Giulia", yearRanges: [current(2016)] },
      { id: "mito", name: "MiTo", yearRanges: [range(2008, 2018)] },
      { id: "brera", name: "Brera", yearRanges: [range(2005, 2010)] },
      { id: "gt", name: "GT", yearRanges: [range(2003, 2010)] },
      { id: "stelvio", name: "Stelvio", yearRanges: [current(2017)] },
      { id: "tonale", name: "Tonale", yearRanges: [current(2022)] },
      { id: "4c", name: "4C", yearRanges: [range(2013, 2020)] },
    ],
  },
];

export const popularVehicleMakes = vehicleCatalog.filter((make) => make.popular);

export function getVehicleMake(makeId: string) {
  return vehicleCatalog.find((make) => make.id === makeId) ?? null;
}

export function getVehicleModel(makeId: string, modelId: string) {
  return getVehicleMake(makeId)?.models.find((model) => model.id === modelId) ?? null;
}

export function getYearsForRanges(yearRanges: VehicleYearRange[]) {
  const years = new Set<number>();

  for (const yearRange of yearRanges) {
    const end = yearRange.to ?? VEHICLE_CATALOG_YEAR;
    for (let year = yearRange.from; year <= end; year += 1) {
      years.add(year);
    }
  }

  return [...years].sort((a, b) => b - a);
}

export function getVehicleModelYears(makeId: string, modelId: string) {
  const model = getVehicleModel(makeId, modelId);
  return model ? getYearsForRanges(model.yearRanges) : [];
}
