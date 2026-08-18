import type { VehicleCatalogMake, VehicleYearRange } from "./vehicleCatalog";

const current = (from: number): VehicleYearRange => ({ from, to: null });
const range = (from: number, to: number): VehicleYearRange => ({ from, to });

/**
 * Third curated MVP batch focused on common European-market cars and
 * enthusiast nameplates that were not covered by the first two batches.
 */
export const vehicleCatalogPhase3: VehicleCatalogMake[] = [
  {
    id: "abarth",
    name: "Abarth",
    models: [
      { id: "500", name: "500", yearRanges: [range(2008, 2016)] },
      { id: "595", name: "595", yearRanges: [range(2012, 2024)] },
      { id: "695", name: "695", yearRanges: [range(2009, 2024)] },
      { id: "124-spider", name: "124 Spider", yearRanges: [range(2016, 2020)] },
    ],
  },
  {
    id: "bentley",
    name: "Bentley",
    models: [
      { id: "continental-gt", name: "Continental GT", yearRanges: [current(2003)] },
      { id: "flying-spur", name: "Flying Spur", yearRanges: [current(2005)] },
      { id: "bentayga", name: "Bentayga", yearRanges: [current(2015)] },
      { id: "mulsanne", name: "Mulsanne", yearRanges: [range(2010, 2020)] },
    ],
  },
  {
    id: "chevrolet",
    name: "Chevrolet",
    models: [
      { id: "aveo", name: "Aveo", yearRanges: [current(2002)] },
      { id: "spark", name: "Spark", yearRanges: [range(2005, 2022)] },
      { id: "cruze", name: "Cruze", yearRanges: [range(2008, 2023)] },
      { id: "malibu", name: "Malibu", yearRanges: [range(1964, 1983), range(1997, 2025)] },
      { id: "camaro", name: "Camaro", yearRanges: [range(1966, 2002), range(2009, 2024)] },
      { id: "corvette", name: "Corvette", yearRanges: [current(1953)] },
      { id: "captiva", name: "Captiva", yearRanges: [current(2006)] },
      { id: "trax", name: "Trax", yearRanges: [current(2013)] },
      { id: "tahoe", name: "Tahoe", yearRanges: [current(1994)] },
    ],
  },
  {
    id: "chrysler",
    name: "Chrysler",
    models: [
      { id: "300", name: "300", yearRanges: [range(2004, 2023)] },
      { id: "pt-cruiser", name: "PT Cruiser", yearRanges: [range(2000, 2010)] },
      { id: "crossfire", name: "Crossfire", yearRanges: [range(2003, 2008)] },
      { id: "voyager", name: "Voyager", yearRanges: [range(1988, 2016), current(2019)] },
      { id: "pacifica", name: "Pacifica", yearRanges: [range(2003, 2007), current(2016)] },
    ],
  },
  {
    id: "dodge",
    name: "Dodge",
    models: [
      { id: "challenger", name: "Challenger", yearRanges: [range(1970, 1974), range(1977, 1983), range(2008, 2023)] },
      { id: "charger", name: "Charger", yearRanges: [range(1966, 1987), range(2005, 2023)] },
      { id: "viper", name: "Viper", yearRanges: [range(1992, 2010), range(2013, 2017)] },
      { id: "durango", name: "Durango", yearRanges: [current(1998)] },
      { id: "journey", name: "Journey", yearRanges: [range(2008, 2020)] },
      { id: "ram", name: "Ram", yearRanges: [range(1981, 2010)] },
    ],
  },
  {
    id: "ds-automobiles",
    name: "DS Automobiles",
    models: [
      { id: "ds-3", name: "DS 3", yearRanges: [current(2015)] },
      { id: "ds-4", name: "DS 4", yearRanges: [range(2015, 2018), current(2021)] },
      { id: "ds-5", name: "DS 5", yearRanges: [range(2015, 2018)] },
      { id: "ds-7", name: "DS 7", yearRanges: [current(2017)] },
      { id: "ds-9", name: "DS 9", yearRanges: [current(2020)] },
    ],
  },
  {
    id: "ferrari",
    name: "Ferrari",
    models: [
      { id: "360", name: "360", yearRanges: [range(1999, 2005)] },
      { id: "f430", name: "F430", yearRanges: [range(2004, 2009)] },
      { id: "458", name: "458 Italia / Spider", yearRanges: [range(2009, 2015)] },
      { id: "488", name: "488 GTB / Spider", yearRanges: [range(2015, 2019)] },
      { id: "f8", name: "F8 Tributo / Spider", yearRanges: [range(2019, 2023)] },
      { id: "roma", name: "Roma", yearRanges: [current(2020)] },
      { id: "portofino", name: "Portofino", yearRanges: [range(2017, 2023)] },
      { id: "812", name: "812 Superfast / GTS", yearRanges: [range(2017, 2024)] },
      { id: "sf90", name: "SF90 Stradale / Spider", yearRanges: [current(2019)] },
      { id: "purosangue", name: "Purosangue", yearRanges: [current(2022)] },
    ],
  },
  {
    id: "genesis",
    name: "Genesis",
    models: [
      { id: "g70", name: "G70", yearRanges: [current(2017)] },
      { id: "g80", name: "G80", yearRanges: [current(2016)] },
      { id: "g90", name: "G90", yearRanges: [current(2016)] },
      { id: "gv60", name: "GV60", yearRanges: [current(2021)] },
      { id: "gv70", name: "GV70", yearRanges: [current(2020)] },
      { id: "gv80", name: "GV80", yearRanges: [current(2020)] },
    ],
  },
  {
    id: "infiniti",
    name: "Infiniti",
    models: [
      { id: "g", name: "G Series", yearRanges: [range(1991, 2015)] },
      { id: "q30", name: "Q30", yearRanges: [range(2015, 2019)] },
      { id: "q50", name: "Q50", yearRanges: [current(2013)] },
      { id: "q60", name: "Q60", yearRanges: [range(2013, 2022)] },
      { id: "q70", name: "Q70", yearRanges: [range(2013, 2019)] },
      { id: "ex-qx50", name: "EX / QX50", yearRanges: [current(2007)] },
      { id: "fx-qx70", name: "FX / QX70", yearRanges: [range(2003, 2017)] },
      { id: "qx80", name: "QX80", yearRanges: [current(2013)] },
    ],
  },
  {
    id: "jaguar",
    name: "Jaguar",
    models: [
      { id: "xe", name: "XE", yearRanges: [range(2015, 2024)] },
      { id: "xf", name: "XF", yearRanges: [range(2007, 2024)] },
      { id: "xj", name: "XJ", yearRanges: [range(1968, 2019)] },
      { id: "x-type", name: "X-Type", yearRanges: [range(2001, 2009)] },
      { id: "s-type", name: "S-Type", yearRanges: [range(1999, 2007)] },
      { id: "f-type", name: "F-Type", yearRanges: [range(2013, 2024)] },
      { id: "e-pace", name: "E-Pace", yearRanges: [current(2017)] },
      { id: "f-pace", name: "F-Pace", yearRanges: [current(2016)] },
      { id: "i-pace", name: "I-Pace", yearRanges: [range(2018, 2024)] },
    ],
  },
  {
    id: "land-rover",
    name: "Land Rover",
    models: [
      { id: "defender", name: "Defender", yearRanges: [range(1983, 2016), current(2020)] },
      { id: "discovery", name: "Discovery", yearRanges: [current(1989)] },
      { id: "discovery-sport", name: "Discovery Sport", yearRanges: [current(2014)] },
      { id: "freelander", name: "Freelander", yearRanges: [range(1997, 2014)] },
      { id: "range-rover", name: "Range Rover", yearRanges: [current(1970)] },
      { id: "range-rover-sport", name: "Range Rover Sport", yearRanges: [current(2005)] },
      { id: "range-rover-evoque", name: "Range Rover Evoque", yearRanges: [current(2011)] },
      { id: "range-rover-velar", name: "Range Rover Velar", yearRanges: [current(2017)] },
    ],
  },
  {
    id: "lamborghini",
    name: "Lamborghini",
    models: [
      { id: "diablo", name: "Diablo", yearRanges: [range(1990, 2001)] },
      { id: "murcielago", name: "Murcielago", yearRanges: [range(2001, 2010)] },
      { id: "gallardo", name: "Gallardo", yearRanges: [range(2003, 2013)] },
      { id: "aventador", name: "Aventador", yearRanges: [range(2011, 2022)] },
      { id: "huracan", name: "Huracan", yearRanges: [range(2014, 2024)] },
      { id: "revuelto", name: "Revuelto", yearRanges: [current(2023)] },
      { id: "urus", name: "Urus", yearRanges: [current(2018)] },
    ],
  },
  {
    id: "lancia",
    name: "Lancia",
    models: [
      { id: "ypsilon", name: "Ypsilon", yearRanges: [current(1995)] },
      { id: "delta", name: "Delta", yearRanges: [range(1979, 1999), range(2008, 2014)] },
      { id: "thema", name: "Thema", yearRanges: [range(1984, 1994), range(2011, 2014)] },
      { id: "thesis", name: "Thesis", yearRanges: [range(2001, 2009)] },
      { id: "musa", name: "Musa", yearRanges: [range(2004, 2012)] },
    ],
  },
  {
    id: "lotus",
    name: "Lotus",
    models: [
      { id: "elise", name: "Elise", yearRanges: [range(1996, 2021)] },
      { id: "exige", name: "Exige", yearRanges: [range(2000, 2021)] },
      { id: "evora", name: "Evora", yearRanges: [range(2009, 2021)] },
      { id: "emira", name: "Emira", yearRanges: [current(2022)] },
      { id: "eletre", name: "Eletre", yearRanges: [current(2023)] },
      { id: "emeya", name: "Emeya", yearRanges: [current(2024)] },
    ],
  },
  {
    id: "maserati",
    name: "Maserati",
    models: [
      { id: "3200-gt", name: "3200 GT", yearRanges: [range(1998, 2002)] },
      { id: "coupe", name: "Coupe", yearRanges: [range(2002, 2007)] },
      { id: "granturismo", name: "GranTurismo", yearRanges: [range(2007, 2019), current(2023)] },
      { id: "grancabrio", name: "GranCabrio", yearRanges: [range(2010, 2019), current(2024)] },
      { id: "ghibli", name: "Ghibli", yearRanges: [range(1967, 1973), range(1992, 1998), range(2013, 2024)] },
      { id: "quattroporte", name: "Quattroporte", yearRanges: [range(1963, 2023)] },
      { id: "levante", name: "Levante", yearRanges: [range(2016, 2024)] },
      { id: "grecale", name: "Grecale", yearRanges: [current(2022)] },
      { id: "mc20", name: "MC20", yearRanges: [current(2020)] },
    ],
  },
  {
    id: "saab",
    name: "Saab",
    models: [
      { id: "900", name: "900", yearRanges: [range(1978, 1998)] },
      { id: "9000", name: "9000", yearRanges: [range(1984, 1998)] },
      { id: "9-3", name: "9-3", yearRanges: [range(1998, 2014)] },
      { id: "9-5", name: "9-5", yearRanges: [range(1997, 2012)] },
      { id: "9-7x", name: "9-7X", yearRanges: [range(2005, 2009)] },
    ],
  },
];
