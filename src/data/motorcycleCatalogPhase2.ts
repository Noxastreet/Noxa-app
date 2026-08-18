import type { VehicleCatalogMake, VehicleYearRange } from "./vehicleCatalog";

const current = (from: number): VehicleYearRange => ({ from, to: null });
const range = (from: number, to: number): VehicleYearRange => ({ from, to });

/** Additional high-confidence motorcycle makes for the shared MVP picker. */
export const motorcycleCatalogPhase2: VehicleCatalogMake[] = [
  {
    id: "harley-davidson",
    name: "Harley-Davidson",
    models: [
      { id: "sportster-iron-883", name: "Iron 883", yearRanges: [range(2009, 2022)] },
      { id: "sportster-s", name: "Sportster S", yearRanges: [current(2021)] },
      { id: "nightster", name: "Nightster", yearRanges: [current(2022)] },
      { id: "street-bob", name: "Street Bob", yearRanges: [current(2006)] },
      { id: "fat-bob", name: "Fat Bob", yearRanges: [current(2008)] },
      { id: "fat-boy", name: "Fat Boy", yearRanges: [current(1990)] },
      { id: "low-rider-s", name: "Low Rider S", yearRanges: [current(2016)] },
      { id: "road-king", name: "Road King", yearRanges: [current(1994)] },
      { id: "street-glide", name: "Street Glide", yearRanges: [current(2006)] },
      { id: "pan-america", name: "Pan America", yearRanges: [current(2021)] },
    ],
  },
  {
    id: "husqvarna",
    name: "Husqvarna",
    models: [
      { id: "svartpilen-125", name: "Svartpilen 125", yearRanges: [current(2021)] },
      { id: "svartpilen-401", name: "Svartpilen 401", yearRanges: [current(2018)] },
      { id: "vitpilen-401", name: "Vitpilen 401", yearRanges: [current(2018)] },
      { id: "norden-901", name: "Norden 901", yearRanges: [current(2022)] },
      { id: "701-supermoto", name: "701 Supermoto", yearRanges: [current(2016)] },
      { id: "701-enduro", name: "701 Enduro", yearRanges: [current(2016)] },
    ],
  },
  {
    id: "indian",
    name: "Indian Motorcycle",
    models: [
      { id: "scout", name: "Scout", yearRanges: [current(2015)] },
      { id: "scout-bobber", name: "Scout Bobber", yearRanges: [current(2018)] },
      { id: "chief", name: "Chief", yearRanges: [range(1999, 2003), current(2009)] },
      { id: "chief-bobber", name: "Chief Bobber", yearRanges: [current(2022)] },
      { id: "springfield", name: "Springfield", yearRanges: [current(2016)] },
      { id: "challenger", name: "Challenger", yearRanges: [current(2020)] },
      { id: "ftr", name: "FTR", yearRanges: [current(2019)] },
    ],
  },
  {
    id: "moto-guzzi",
    name: "Moto Guzzi",
    models: [
      { id: "v7", name: "V7", yearRanges: [range(1967, 1976), current(2008)] },
      { id: "v9", name: "V9", yearRanges: [current(2016)] },
      { id: "v85-tt", name: "V85 TT", yearRanges: [current(2019)] },
      { id: "v100-mandello", name: "V100 Mandello", yearRanges: [current(2022)] },
      { id: "griso", name: "Griso", yearRanges: [range(2005, 2016)] },
      { id: "stelvio", name: "Stelvio", yearRanges: [range(2008, 2016), current(2024)] },
    ],
  },
  {
    id: "mv-agusta",
    name: "MV Agusta",
    models: [
      { id: "brutale-800", name: "Brutale 800", yearRanges: [current(2012)] },
      { id: "dragster", name: "Dragster", yearRanges: [current(2014)] },
      { id: "f3-675", name: "F3 675", yearRanges: [current(2012)] },
      { id: "f3-800", name: "F3 800", yearRanges: [current(2013)] },
      { id: "turismo-veloce", name: "Turismo Veloce", yearRanges: [current(2015)] },
      { id: "superveloce", name: "Superveloce", yearRanges: [current(2020)] },
    ],
  },
  {
    id: "benelli",
    name: "Benelli",
    models: [
      { id: "bn-125", name: "BN 125", yearRanges: [current(2018)] },
      { id: "leoncino-500", name: "Leoncino 500", yearRanges: [current(2017)] },
      { id: "502c", name: "502C", yearRanges: [current(2019)] },
      { id: "trk-502", name: "TRK 502", yearRanges: [current(2017)] },
      { id: "trk-702", name: "TRK 702", yearRanges: [current(2023)] },
      { id: "752s", name: "752S", yearRanges: [current(2019)] },
    ],
  },
  {
    id: "cfmoto",
    name: "CFMOTO",
    models: [
      { id: "300nk", name: "300NK", yearRanges: [current(2019)] },
      { id: "450nk", name: "450NK", yearRanges: [current(2023)] },
      { id: "450sr", name: "450SR", yearRanges: [current(2022)] },
      { id: "650nk", name: "650NK", yearRanges: [current(2012)] },
      { id: "700cl-x", name: "700CL-X", yearRanges: [current(2021)] },
      { id: "800mt", name: "800MT", yearRanges: [current(2022)] },
    ],
  },
  {
    id: "gasgas",
    name: "GASGAS",
    models: [
      { id: "sm-700", name: "SM 700", yearRanges: [current(2022)] },
      { id: "es-700", name: "ES 700", yearRanges: [current(2022)] },
      { id: "ec-250", name: "EC 250", yearRanges: [current(2021)] },
      { id: "ec-300", name: "EC 300", yearRanges: [current(2021)] },
      { id: "mc-250f", name: "MC 250F", yearRanges: [current(2021)] },
      { id: "mc-450f", name: "MC 450F", yearRanges: [current(2021)] },
    ],
  },
  {
    id: "zero",
    name: "Zero Motorcycles",
    models: [
      { id: "s", name: "S", yearRanges: [current(2010)] },
      { id: "sr-f", name: "SR/F", yearRanges: [current(2019)] },
      { id: "sr-s", name: "SR/S", yearRanges: [current(2020)] },
      { id: "fx", name: "FX", yearRanges: [current(2013)] },
      { id: "dsr-x", name: "DSR/X", yearRanges: [current(2023)] },
    ],
  },
];
