/**
 * MPFS Geographic mapping - Carrier/Locality to State
 * Based on Attachment A from PF25PD.pdf
 */

export type MpfsGeo = {
  carrierNumber: string;
  localityCode: string;
  stateAbbrev: string;
  stateName: string;
  localityName: string;
};

// Carrier to state mapping from PF25PD Attachment A
const carrierStateMap: Record<string, { abbrev: string; name: string }> = {
  '01011': { abbrev: 'AL', name: 'ALABAMA' },
  '01021': { abbrev: 'GA', name: 'GEORGIA' },
  '07102': { abbrev: 'AR', name: 'ARKANSAS' },
  '04212': { abbrev: 'NM', name: 'NEW MEXICO' },
  '04312': { abbrev: 'OK', name: 'OKLAHOMA' },
  '05302': { abbrev: 'MO', name: 'MISSOURI' },
  '07202': { abbrev: 'LA', name: 'LOUISIANA' },
  '12102': { abbrev: 'DE', name: 'DELAWARE' },
  '12202': { abbrev: 'DC', name: 'DISTRICT OF COLUMBIA' },
  '09102': { abbrev: 'FL', name: 'FLORIDA' },
  '08102': { abbrev: 'IN', name: 'INDIANA' },
  '05102': { abbrev: 'IA', name: 'IOWA' },
  '05202': { abbrev: 'KS', name: 'KANSAS' },
  '05402': { abbrev: 'NE', name: 'NEBRASKA' },
  '15102': { abbrev: 'KY', name: 'KENTUCKY' },
  '03202': { abbrev: 'MT', name: 'MONTANA' },
  '13282': { abbrev: 'NY', name: 'NEW YORK' },
  '13202': { abbrev: 'NY', name: 'NEW YORK' },
  '13292': { abbrev: 'NY', name: 'NEW YORK' },
  '12402': { abbrev: 'NJ', name: 'NEW JERSEY' },
  '03302': { abbrev: 'ND', name: 'NORTH DAKOTA' },
  '03402': { abbrev: 'SD', name: 'SOUTH DAKOTA' },
  '03602': { abbrev: 'WY', name: 'WYOMING' },
  '02402': { abbrev: 'WA', name: 'WASHINGTON' },
  '02102': { abbrev: 'AK', name: 'ALASKA' },
  '03102': { abbrev: 'AZ', name: 'ARIZONA' },
  '01312': { abbrev: 'NV', name: 'NEVADA' },
  '04112': { abbrev: 'CO', name: 'COLORADO' },
  '01212': { abbrev: 'HI', name: 'HAWAII' },
  '02302': { abbrev: 'OR', name: 'OREGON' },
  '12502': { abbrev: 'PA', name: 'PENNSYLVANIA' },
  '14412': { abbrev: 'RI', name: 'RHODE ISLAND' },
  '11202': { abbrev: 'SC', name: 'SOUTH CAROLINA' },
  '04412': { abbrev: 'TX', name: 'TEXAS' },
  '12302': { abbrev: 'MD', name: 'MARYLAND' },
  '03502': { abbrev: 'UT', name: 'UTAH' },
  '06302': { abbrev: 'WI', name: 'WISCONSIN' },
  '06102': { abbrev: 'IL', name: 'ILLINOIS' },
  '08202': { abbrev: 'MI', name: 'MICHIGAN' },
  '09202': { abbrev: 'PR', name: 'PUERTO RICO' },
  '01182': { abbrev: 'CA', name: 'CALIFORNIA' },
  '01112': { abbrev: 'CA', name: 'CALIFORNIA' },
  '02202': { abbrev: 'ID', name: 'IDAHO' },
  '10312': { abbrev: 'TN', name: 'TENNESSEE' },
  '11502': { abbrev: 'NC', name: 'NORTH CAROLINA' },
  '13102': { abbrev: 'CT', name: 'CONNECTICUT' },
  '06202': { abbrev: 'MN', name: 'MINNESOTA' },
  '07302': { abbrev: 'MS', name: 'MISSISSIPPI' },
  '11302': { abbrev: 'VA', name: 'VIRGINIA' },
  '15202': { abbrev: 'OH', name: 'OHIO' },
  '11402': { abbrev: 'WV', name: 'WEST VIRGINIA' },
  '14112': { abbrev: 'ME', name: 'MAINE' },
  '14212': { abbrev: 'MA', name: 'MASSACHUSETTS' },
  '14312': { abbrev: 'NH', name: 'NEW HAMPSHIRE' },
  '14512': { abbrev: 'VT', name: 'VERMONT' },
};

// Locality descriptions by carrier + locality code
const localityDescriptions: Record<string, string> = {
  '01021_01': 'ATLANTA, GA',
  '01021_99': 'REST OF GEORGIA',
  '09102_03': 'FORT LAUDERDALE, FL',
  '09102_04': 'MIAMI, FL',
  '09102_99': 'REST OF FLORIDA',
  '05302_01': 'METROPOLITAN ST. LOUIS, MO',
  '05302_02': 'METROPOLITAN KANSAS CITY, MO',
  '05302_99': 'REST OF MISSOURI',
  '07202_01': 'NEW ORLEANS, LA',
  '07202_99': 'REST OF LOUISIANA',
  '12202_01': 'DC + MD/VA SUBURBS',
  '13282_99': 'REST OF NEW YORK',
  '13202_01': 'MANHATTAN, NY',
  '13202_02': 'NYC SUBURBS/LONG I., NY',
  '13202_03': 'POUGHKPSIE/N NYC SUBURBS, NY',
  '12402_01': 'NORTHERN NJ',
  '12402_99': 'REST OF NEW JERSEY',
  '02402_02': 'SEATTLE (KING CNTY), WA',
  '02402_99': 'REST OF WASHINGTON',
  '02302_01': 'PORTLAND, OR',
  '02302_99': 'REST OF OREGON',
  '12502_01': 'METROPOLITAN PHILADELPHIA, PA',
  '12502_99': 'REST OF PENNSYLVANIA',
  '04412_09': 'BRAZORIA, TX',
  '04412_11': 'DALLAS, TX',
  '04412_15': 'GALVESTON, TX',
  '04412_18': 'HOUSTON, TX',
  '04412_20': 'BEAUMONT, TX',
  '04412_28': 'FORT WORTH, TX',
  '04412_31': 'AUSTIN, TX',
  '04412_99': 'REST OF TEXAS',
  '12302_01': 'BALTIMORE/SURR. CNTYS, MD',
  '12302_99': 'REST OF MARYLAND',
  '06102_12': 'EAST ST. LOUIS, IL',
  '06102_15': 'SUBURBAN CHICAGO, IL',
  '06102_16': 'CHICAGO, IL',
  '06102_99': 'REST OF ILLINOIS',
  '08202_01': 'DETROIT, MI',
  '08202_99': 'REST OF MICHIGAN',
  '01182_17': 'VENTURA, CA',
  '01182_18': 'LOS ANGELES, CA',
  '01112_05': 'SAN FRANCISCO, CA',
  '01112_06': 'SAN MATEO, CA',
  '01112_07': 'OAKLAND/BERKELEY, CA',
  '01112_09': 'SANTA CLARA, CA',
  '14112_03': 'SOUTHERN MAINE',
  '14112_99': 'REST OF MAINE',
  '14212_01': 'METROPOLITAN BOSTON',
  '14212_99': 'REST OF MASSACHUSETTS',
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
