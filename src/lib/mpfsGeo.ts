/**
 * MPFS Geographic mapping - Carrier/Locality to State
 * Based on Attachment A from PF25PD.pdf (Calendar Year 2025)
 */

export type MpfsGeo = {
  carrierNumber: string;
  localityCode: string;
  stateAbbrev: string;
  stateName: string;
  localityName: string;
};

// Carrier to state mapping from PF25PD Attachment A
// Format: carrier number (5 digits) -> state info
const carrierStateMap: Record<string, { abbrev: string; name: string }> = {
  // Alabama
  '01011': { abbrev: 'AL', name: 'ALABAMA' },
  // Alaska
  '02102': { abbrev: 'AK', name: 'ALASKA' },
  // Arizona
  '03102': { abbrev: 'AZ', name: 'ARIZONA' },
  // Arkansas
  '07102': { abbrev: 'AR', name: 'ARKANSAS' },
  // California (two carriers)
  '01112': { abbrev: 'CA', name: 'CALIFORNIA' }, // CA1 - Northern
  '01182': { abbrev: 'CA', name: 'CALIFORNIA' }, // CA2 - Southern
  // Colorado
  '04112': { abbrev: 'CO', name: 'COLORADO' },
  // Connecticut
  '13102': { abbrev: 'CT', name: 'CONNECTICUT' },
  // Delaware
  '12102': { abbrev: 'DE', name: 'DELAWARE' },
  // District of Columbia
  '12202': { abbrev: 'DC', name: 'DISTRICT OF COLUMBIA' },
  // Florida
  '09102': { abbrev: 'FL', name: 'FLORIDA' },
  // Georgia
  '01021': { abbrev: 'GA', name: 'GEORGIA' },
  // Hawaii
  '01212': { abbrev: 'HI', name: 'HAWAII' },
  // Idaho
  '02202': { abbrev: 'ID', name: 'IDAHO' },
  // Illinois
  '06102': { abbrev: 'IL', name: 'ILLINOIS' },
  // Indiana
  '08102': { abbrev: 'IN', name: 'INDIANA' },
  // Iowa
  '05102': { abbrev: 'IA', name: 'IOWA' },
  // Kansas
  '05202': { abbrev: 'KS', name: 'KANSAS' },
  // Kentucky
  '15102': { abbrev: 'KY', name: 'KENTUCKY' },
  // Louisiana
  '07202': { abbrev: 'LA', name: 'LOUISIANA' },
  // Maine
  '14112': { abbrev: 'ME', name: 'MAINE' },
  // Maryland
  '12302': { abbrev: 'MD', name: 'MARYLAND' },
  // Massachusetts
  '14212': { abbrev: 'MA', name: 'MASSACHUSETTS' },
  // Michigan
  '08202': { abbrev: 'MI', name: 'MICHIGAN' },
  // Minnesota
  '06202': { abbrev: 'MN', name: 'MINNESOTA' },
  // Mississippi
  '07302': { abbrev: 'MS', name: 'MISSISSIPPI' },
  // Missouri
  '05302': { abbrev: 'MO', name: 'MISSOURI' },
  // Montana
  '03202': { abbrev: 'MT', name: 'MONTANA' },
  // Nebraska
  '05402': { abbrev: 'NE', name: 'NEBRASKA' },
  // Nevada
  '01312': { abbrev: 'NV', name: 'NEVADA' },
  // New Hampshire
  '14312': { abbrev: 'NH', name: 'NEW HAMPSHIRE' },
  // New Jersey
  '12402': { abbrev: 'NJ', name: 'NEW JERSEY' },
  // New Mexico
  '04212': { abbrev: 'NM', name: 'NEW MEXICO' },
  // New York (multiple carriers)
  '13202': { abbrev: 'NY', name: 'NEW YORK' }, // NY2 - NYC area
  '13282': { abbrev: 'NY', name: 'NEW YORK' }, // NY1 - Upstate
  '13292': { abbrev: 'NY', name: 'NEW YORK' }, // NY3 - Queens
  // North Carolina
  '11502': { abbrev: 'NC', name: 'NORTH CAROLINA' },
  // North Dakota
  '03302': { abbrev: 'ND', name: 'NORTH DAKOTA' },
  // Ohio
  '15202': { abbrev: 'OH', name: 'OHIO' },
  // Oklahoma
  '04312': { abbrev: 'OK', name: 'OKLAHOMA' },
  // Oregon
  '02302': { abbrev: 'OR', name: 'OREGON' },
  // Pennsylvania
  '12502': { abbrev: 'PA', name: 'PENNSYLVANIA' },
  // Puerto Rico / Virgin Islands
  '09202': { abbrev: 'PR', name: 'PUERTO RICO' },
  // Rhode Island
  '14412': { abbrev: 'RI', name: 'RHODE ISLAND' },
  // South Carolina
  '11202': { abbrev: 'SC', name: 'SOUTH CAROLINA' },
  // South Dakota
  '03402': { abbrev: 'SD', name: 'SOUTH DAKOTA' },
  // Tennessee
  '10312': { abbrev: 'TN', name: 'TENNESSEE' },
  // Texas
  '04412': { abbrev: 'TX', name: 'TEXAS' },
  // Utah
  '03502': { abbrev: 'UT', name: 'UTAH' },
  // Vermont
  '14512': { abbrev: 'VT', name: 'VERMONT' },
  // Virginia
  '11302': { abbrev: 'VA', name: 'VIRGINIA' },
  // Washington
  '02402': { abbrev: 'WA', name: 'WASHINGTON' },
  // West Virginia
  '11402': { abbrev: 'WV', name: 'WEST VIRGINIA' },
  // Wisconsin
  '06302': { abbrev: 'WI', name: 'WISCONSIN' },
  // Wyoming
  '03602': { abbrev: 'WY', name: 'WYOMING' },
};

// Locality descriptions by carrier + locality code
// Format: "carrier_locality" -> locality name
const localityDescriptions: Record<string, string> = {
  // Alabama
  '01011_00': 'ALABAMA',
  // Alaska
  '02102_01': 'ALASKA',
  // Arizona
  '03102_00': 'ARIZONA',
  // Arkansas
  '07102_13': 'ARKANSAS',
  // California - Northern (01112)
  '01112_05': 'SAN FRANCISCO, CA',
  '01112_06': 'SAN MATEO, CA',
  '01112_07': 'OAKLAND/BERKELEY, CA',
  '01112_09': 'SANTA CLARA, CA',
  '01112_51': 'NAPA, CA',
  '01112_52': 'MARIN COUNTY, CA',
  '01112_53': 'VALLEJO-FAIRFIELD, CA',
  '01112_54': 'BAKERSFIELD, CA',
  '01112_55': 'CHICO, CA',
  '01112_56': 'FRESNO, CA',
  '01112_57': 'HANFORD-CORCORAN, CA',
  '01112_58': 'MADERA, CA',
  '01112_59': 'MERCED, CA',
  '01112_60': 'MODESTO, CA',
  '01112_61': 'REDDING, CA',
  '01112_62': 'RIVERSIDE-SAN BERNARDINO, CA',
  '01112_63': 'SACRAMENTO, CA',
  '01112_64': 'SALINAS, CA',
  '01112_65': 'SAN BENITO COUNTY, CA',
  '01112_66': 'SANTA CRUZ, CA',
  '01112_67': 'SANTA ROSA, CA',
  '01112_68': 'STOCKTON-LODI, CA',
  '01112_69': 'VISALIA-PORTERVILLE, CA',
  '01112_70': 'YUBA CITY, CA',
  '01112_75': 'REST OF CALIFORNIA',
  // California - Southern (01182)
  '01182_17': 'VENTURA, CA',
  '01182_18': 'LOS ANGELES, CA',
  '01182_26': 'ANAHEIM/SANTA ANA, CA',
  '01182_71': 'EL CENTRO, CA',
  '01182_72': 'SAN DIEGO, CA',
  '01182_73': 'SAN LUIS OBISPO, CA',
  '01182_74': 'SANTA BARBARA, CA',
  '01182_75': 'REST OF CALIFORNIA',
  // Colorado
  '04112_01': 'COLORADO',
  // Connecticut
  '13102_00': 'CONNECTICUT',
  // Delaware
  '12102_01': 'DELAWARE',
  // DC
  '12202_01': 'DC + MD/VA SUBURBS',
  // Florida
  '09102_03': 'FORT LAUDERDALE, FL',
  '09102_04': 'MIAMI, FL',
  '09102_99': 'REST OF FLORIDA',
  // Georgia
  '01021_01': 'ATLANTA, GA',
  '01021_99': 'REST OF GEORGIA',
  // Hawaii
  '01212_01': 'HAWAII/GUAM',
  // Idaho
  '02202_00': 'IDAHO',
  // Illinois
  '06102_12': 'EAST ST. LOUIS, IL',
  '06102_15': 'SUBURBAN CHICAGO, IL',
  '06102_16': 'CHICAGO, IL',
  '06102_99': 'REST OF ILLINOIS',
  // Indiana
  '08102_00': 'INDIANA',
  // Iowa
  '05102_00': 'IOWA',
  // Kansas
  '05202_00': 'KANSAS',
  // Kentucky
  '15102_00': 'KENTUCKY',
  // Louisiana
  '07202_01': 'NEW ORLEANS, LA',
  '07202_99': 'REST OF LOUISIANA',
  // Maine
  '14112_03': 'SOUTHERN MAINE',
  '14112_99': 'REST OF MAINE',
  // Maryland
  '12302_01': 'BALTIMORE/SURR. CNTYS, MD',
  '12302_99': 'REST OF MARYLAND',
  // Massachusetts
  '14212_01': 'METROPOLITAN BOSTON',
  '14212_99': 'REST OF MASSACHUSETTS',
  // Michigan
  '08202_01': 'DETROIT, MI',
  '08202_99': 'REST OF MICHIGAN',
  // Minnesota
  '06202_00': 'MINNESOTA',
  // Mississippi
  '07302_00': 'MISSISSIPPI',
  // Missouri
  '05302_01': 'METROPOLITAN ST. LOUIS, MO',
  '05302_02': 'METROPOLITAN KANSAS CITY, MO',
  '05302_99': 'REST OF MISSOURI',
  // Montana
  '03202_01': 'MONTANA',
  // Nebraska
  '05402_00': 'NEBRASKA',
  // Nevada
  '01312_00': 'NEVADA',
  // New Hampshire
  '14312_40': 'NEW HAMPSHIRE',
  // New Jersey
  '12402_01': 'NORTHERN NJ',
  '12402_99': 'REST OF NEW JERSEY',
  // New Mexico
  '04212_05': 'NEW MEXICO',
  // New York
  '13202_01': 'MANHATTAN, NY',
  '13202_02': 'NYC SUBURBS/LONG I., NY',
  '13202_03': 'POUGHKPSIE/N NYC SUBURBS, NY',
  '13282_99': 'REST OF NEW YORK',
  '13292_04': 'QUEENS, NY',
  // North Carolina
  '11502_00': 'NORTH CAROLINA',
  // North Dakota
  '03302_01': 'NORTH DAKOTA',
  // Ohio
  '15202_00': 'OHIO',
  // Oklahoma
  '04312_00': 'OKLAHOMA',
  // Oregon
  '02302_01': 'PORTLAND, OR',
  '02302_99': 'REST OF OREGON',
  // Pennsylvania
  '12502_01': 'METROPOLITAN PHILADELPHIA, PA',
  '12502_99': 'REST OF PENNSYLVANIA',
  // Puerto Rico
  '09202_20': 'PUERTO RICO',
  '09202_50': 'VIRGIN ISLANDS',
  // Rhode Island
  '14412_01': 'RHODE ISLAND',
  // South Carolina
  '11202_01': 'SOUTH CAROLINA',
  // South Dakota
  '03402_02': 'SOUTH DAKOTA',
  // Tennessee
  '10312_35': 'TENNESSEE',
  // Texas
  '04412_09': 'BRAZORIA, TX',
  '04412_11': 'DALLAS, TX',
  '04412_15': 'GALVESTON, TX',
  '04412_18': 'HOUSTON, TX',
  '04412_20': 'BEAUMONT, TX',
  '04412_28': 'FORT WORTH, TX',
  '04412_31': 'AUSTIN, TX',
  '04412_99': 'REST OF TEXAS',
  // Utah
  '03502_09': 'UTAH',
  // Vermont
  '14512_50': 'VERMONT',
  // Virginia
  '11302_00': 'VIRGINIA',
  // Washington
  '02402_02': 'SEATTLE (KING CNTY), WA',
  '02402_99': 'REST OF WASHINGTON',
  // West Virginia
  '11402_16': 'WEST VIRGINIA',
  // Wisconsin
  '06302_00': 'WISCONSIN',
  // Wyoming
  '03602_21': 'WYOMING',
};

/**
 * Get geographic info for a carrier/locality combination
 */
export function getGeoForCarrierLocality(
  carrierNumber: string,
  localityCode: string
): MpfsGeo | null {
  const stateInfo = carrierStateMap[carrierNumber];
  if (!stateInfo) {
    return null;
  }

  const localityKey = `${carrierNumber}_${localityCode}`;
  const localityName = localityDescriptions[localityKey] || `Locality ${localityCode}`;

  return {
    carrierNumber,
    localityCode,
    stateAbbrev: stateInfo.abbrev,
    stateName: stateInfo.name,
    localityName,
  };
}

/**
 * Get state abbreviation for a carrier number (fallback when locality doesn't match)
 */
export function getStateForCarrier(carrierNumber: string): string | null {
  const stateInfo = carrierStateMap[carrierNumber];
  return stateInfo?.abbrev ?? null;
}

/**
 * Get all carriers for a state
 */
export function getCarriersForState(stateAbbrev: string): string[] {
  return Object.entries(carrierStateMap)
    .filter(([_, info]) => info.abbrev === stateAbbrev.toUpperCase())
    .map(([carrier]) => carrier);
}
