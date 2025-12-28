/**
 * MPFS Geographic Mapping
 * Maps CMS carrier numbers and locality codes to state abbreviations
 * Based on PF25PD Attachment A
 */

export interface GeoInfo {
  stateAbbrev: string;
  stateName: string;
  localityName: string;
}

/**
 * Carrier/Locality to State mapping from PF25PD Attachment A
 * Format: carrierNumber + localityCode -> GeoInfo
 */
const CARRIER_LOCALITY_MAP: Record<string, GeoInfo> = {
  // Alabama
  '1011200': { stateAbbrev: 'AL', stateName: 'Alabama', localityName: 'Alabama' },
  
  // Alaska
  '0210201': { stateAbbrev: 'AK', stateName: 'Alaska', localityName: 'Alaska' },
  
  // Arizona
  '0310200': { stateAbbrev: 'AZ', stateName: 'Arizona', localityName: 'Arizona' },
  
  // Arkansas
  '0710213': { stateAbbrev: 'AR', stateName: 'Arkansas', localityName: 'Arkansas' },
  
  // California - Region 1 (Northern)
  '0111205': { stateAbbrev: 'CA', stateName: 'California', localityName: 'San Francisco, CA' },
  '0111206': { stateAbbrev: 'CA', stateName: 'California', localityName: 'San Mateo, CA' },
  '0111207': { stateAbbrev: 'CA', stateName: 'California', localityName: 'Oakland/Berkeley, CA' },
  '0111209': { stateAbbrev: 'CA', stateName: 'California', localityName: 'Santa Clara, CA' },
  '0111251': { stateAbbrev: 'CA', stateName: 'California', localityName: 'Napa' },
  '0111252': { stateAbbrev: 'CA', stateName: 'California', localityName: 'San Francisco-Oakland-Hayward (Marin County)' },
  '0111253': { stateAbbrev: 'CA', stateName: 'California', localityName: 'Vallejo-Fairfield' },
  '0111254': { stateAbbrev: 'CA', stateName: 'California', localityName: 'Bakersfield' },
  '0111255': { stateAbbrev: 'CA', stateName: 'California', localityName: 'Chico' },
  '0111256': { stateAbbrev: 'CA', stateName: 'California', localityName: 'Fresno' },
  '0111257': { stateAbbrev: 'CA', stateName: 'California', localityName: 'Hanford-Corcoran' },
  '0111258': { stateAbbrev: 'CA', stateName: 'California', localityName: 'Madera' },
  '0111259': { stateAbbrev: 'CA', stateName: 'California', localityName: 'Merced' },
  '0111260': { stateAbbrev: 'CA', stateName: 'California', localityName: 'Modesto' },
  '0111261': { stateAbbrev: 'CA', stateName: 'California', localityName: 'Redding' },
  '0111262': { stateAbbrev: 'CA', stateName: 'California', localityName: 'Riverside-San Bernardino-Ontario' },
  '0111263': { stateAbbrev: 'CA', stateName: 'California', localityName: 'Sacramento-Roseville-Arden-Arcade' },
  '0111264': { stateAbbrev: 'CA', stateName: 'California', localityName: 'Salinas' },
  '0111265': { stateAbbrev: 'CA', stateName: 'California', localityName: 'San Jose-Sunnyvale-Santa Clara (San Benito Cnty)' },
  '0111266': { stateAbbrev: 'CA', stateName: 'California', localityName: 'Santa Cruz-Watsonville' },
  '0111267': { stateAbbrev: 'CA', stateName: 'California', localityName: 'Santa Rosa' },
  '0111268': { stateAbbrev: 'CA', stateName: 'California', localityName: 'Stockton-Lodi' },
  '0111269': { stateAbbrev: 'CA', stateName: 'California', localityName: 'Visalia-Porterville' },
  '0111270': { stateAbbrev: 'CA', stateName: 'California', localityName: 'Yuba City' },
  
  // California - Region 2 (Southern)
  '0118217': { stateAbbrev: 'CA', stateName: 'California', localityName: 'Ventura, CA' },
  '0118218': { stateAbbrev: 'CA', stateName: 'California', localityName: 'Los Angeles, CA' },
  '0118226': { stateAbbrev: 'CA', stateName: 'California', localityName: 'Anaheim/Santa Ana, CA' },
  '0118271': { stateAbbrev: 'CA', stateName: 'California', localityName: 'El Centro' },
  '0118272': { stateAbbrev: 'CA', stateName: 'California', localityName: 'San Diego-Carlsbad' },
  '0118273': { stateAbbrev: 'CA', stateName: 'California', localityName: 'San Luis Obispo-Paso Robles-Arroyo Grande' },
  '0118274': { stateAbbrev: 'CA', stateName: 'California', localityName: 'Santa Maria-Santa Barbara' },
  '0118275': { stateAbbrev: 'CA', stateName: 'California', localityName: 'Rest of State' },
  
  // Colorado
  '0411201': { stateAbbrev: 'CO', stateName: 'Colorado', localityName: 'Colorado' },
  
  // Connecticut
  '1310200': { stateAbbrev: 'CT', stateName: 'Connecticut', localityName: 'Connecticut' },
  
  // Delaware
  '1210201': { stateAbbrev: 'DE', stateName: 'Delaware', localityName: 'Delaware' },
  
  // DC
  '1220201': { stateAbbrev: 'DC', stateName: 'District of Columbia', localityName: 'DC + MD/VA Suburbs' },
  
  // Florida
  '0910203': { stateAbbrev: 'FL', stateName: 'Florida', localityName: 'Fort Lauderdale, FL' },
  '0910204': { stateAbbrev: 'FL', stateName: 'Florida', localityName: 'Miami, FL' },
  '0910299': { stateAbbrev: 'FL', stateName: 'Florida', localityName: 'Rest of Florida' },
  
  // Georgia
  '1021201': { stateAbbrev: 'GA', stateName: 'Georgia', localityName: 'Atlanta, GA' },
  '1021299': { stateAbbrev: 'GA', stateName: 'Georgia', localityName: 'Rest of Georgia' },
  
  // Hawaii
  '0121201': { stateAbbrev: 'HI', stateName: 'Hawaii', localityName: 'Hawaii/Guam' },
  
  // Idaho
  '0220200': { stateAbbrev: 'ID', stateName: 'Idaho', localityName: 'Idaho' },
  
  // Illinois
  '0610212': { stateAbbrev: 'IL', stateName: 'Illinois', localityName: 'East St. Louis, IL' },
  '0610215': { stateAbbrev: 'IL', stateName: 'Illinois', localityName: 'Suburban Chicago, IL' },
  '0610216': { stateAbbrev: 'IL', stateName: 'Illinois', localityName: 'Chicago, IL' },
  '0610299': { stateAbbrev: 'IL', stateName: 'Illinois', localityName: 'Rest of Illinois' },
  
  // Indiana
  '0810200': { stateAbbrev: 'IN', stateName: 'Indiana', localityName: 'Indiana' },
  
  // Iowa
  '0510200': { stateAbbrev: 'IA', stateName: 'Iowa', localityName: 'Iowa' },
  
  // Kansas
  '0520200': { stateAbbrev: 'KS', stateName: 'Kansas', localityName: 'Kansas' },
  
  // Kentucky
  '1510200': { stateAbbrev: 'KY', stateName: 'Kentucky', localityName: 'Kentucky' },
  
  // Louisiana
  '0720201': { stateAbbrev: 'LA', stateName: 'Louisiana', localityName: 'New Orleans, LA' },
  '0720299': { stateAbbrev: 'LA', stateName: 'Louisiana', localityName: 'Rest of Louisiana' },
  
  // Maine
  '1411203': { stateAbbrev: 'ME', stateName: 'Maine', localityName: 'Southern Maine' },
  '1411299': { stateAbbrev: 'ME', stateName: 'Maine', localityName: 'Rest of Maine' },
  
  // Maryland
  '1230201': { stateAbbrev: 'MD', stateName: 'Maryland', localityName: 'Baltimore/Surr. Cntys, MD' },
  '1230299': { stateAbbrev: 'MD', stateName: 'Maryland', localityName: 'Rest of Maryland' },
  
  // Massachusetts
  '1421201': { stateAbbrev: 'MA', stateName: 'Massachusetts', localityName: 'Metropolitan Boston' },
  '1421299': { stateAbbrev: 'MA', stateName: 'Massachusetts', localityName: 'Rest of Massachusetts' },
  
  // Michigan
  '0820201': { stateAbbrev: 'MI', stateName: 'Michigan', localityName: 'Detroit, MI' },
  '0820299': { stateAbbrev: 'MI', stateName: 'Michigan', localityName: 'Rest of Michigan' },
  
  // Minnesota
  '0620200': { stateAbbrev: 'MN', stateName: 'Minnesota', localityName: 'Minnesota' },
  
  // Mississippi
  '0730200': { stateAbbrev: 'MS', stateName: 'Mississippi', localityName: 'Mississippi' },
  
  // Missouri
  '0530201': { stateAbbrev: 'MO', stateName: 'Missouri', localityName: 'Metropolitan St. Louis, MO' },
  '0530202': { stateAbbrev: 'MO', stateName: 'Missouri', localityName: 'Metropolitan Kansas City, MO' },
  '0530299': { stateAbbrev: 'MO', stateName: 'Missouri', localityName: 'Rest of Missouri' },
  
  // Montana
  '0320201': { stateAbbrev: 'MT', stateName: 'Montana', localityName: 'Montana' },
  
  // Nebraska
  '0540200': { stateAbbrev: 'NE', stateName: 'Nebraska', localityName: 'Nebraska' },
  
  // Nevada
  '0131200': { stateAbbrev: 'NV', stateName: 'Nevada', localityName: 'Nevada' },
  
  // New Hampshire
  '1431240': { stateAbbrev: 'NH', stateName: 'New Hampshire', localityName: 'New Hampshire' },
  
  // New Jersey
  '1240201': { stateAbbrev: 'NJ', stateName: 'New Jersey', localityName: 'Northern NJ' },
  '1240299': { stateAbbrev: 'NJ', stateName: 'New Jersey', localityName: 'Rest of New Jersey' },
  
  // New Mexico
  '0421205': { stateAbbrev: 'NM', stateName: 'New Mexico', localityName: 'New Mexico' },
  
  // New York - Region 1
  '1328299': { stateAbbrev: 'NY', stateName: 'New York', localityName: 'Rest of New York' },
  
  // New York - Region 2
  '1320201': { stateAbbrev: 'NY', stateName: 'New York', localityName: 'Manhattan, NY' },
  '1320202': { stateAbbrev: 'NY', stateName: 'New York', localityName: 'NYC Suburbs/Long I., NY' },
  '1320203': { stateAbbrev: 'NY', stateName: 'New York', localityName: 'Poughkpsie/N NYC Suburbs, NY' },
  
  // New York - Region 3
  '1329204': { stateAbbrev: 'NY', stateName: 'New York', localityName: 'Queens, NY' },
  
  // North Carolina
  '1150200': { stateAbbrev: 'NC', stateName: 'North Carolina', localityName: 'North Carolina' },
  
  // North Dakota
  '0330201': { stateAbbrev: 'ND', stateName: 'North Dakota', localityName: 'North Dakota' },
  
  // Ohio
  '1520200': { stateAbbrev: 'OH', stateName: 'Ohio', localityName: 'Ohio' },
  
  // Oklahoma
  '0431200': { stateAbbrev: 'OK', stateName: 'Oklahoma', localityName: 'Oklahoma' },
  
  // Oregon
  '0230201': { stateAbbrev: 'OR', stateName: 'Oregon', localityName: 'Portland, OR' },
  '0230299': { stateAbbrev: 'OR', stateName: 'Oregon', localityName: 'Rest of Oregon' },
  
  // Pennsylvania
  '1250201': { stateAbbrev: 'PA', stateName: 'Pennsylvania', localityName: 'Metropolitan Philadelphia, PA' },
  '1250299': { stateAbbrev: 'PA', stateName: 'Pennsylvania', localityName: 'Rest of Pennsylvania' },
  
  // Puerto Rico/Virgin Islands
  '0920220': { stateAbbrev: 'PR', stateName: 'Puerto Rico', localityName: 'Puerto Rico' },
  '0920250': { stateAbbrev: 'VI', stateName: 'Virgin Islands', localityName: 'Virgin Islands' },
  
  // Rhode Island
  '1441201': { stateAbbrev: 'RI', stateName: 'Rhode Island', localityName: 'Rhode Island' },
  
  // South Carolina
  '1120201': { stateAbbrev: 'SC', stateName: 'South Carolina', localityName: 'South Carolina' },
  
  // South Dakota
  '0340202': { stateAbbrev: 'SD', stateName: 'South Dakota', localityName: 'South Dakota' },
  
  // Tennessee
  '1031235': { stateAbbrev: 'TN', stateName: 'Tennessee', localityName: 'Tennessee' },
  
  // Texas
  '0441209': { stateAbbrev: 'TX', stateName: 'Texas', localityName: 'Brazoria, TX' },
  '0441211': { stateAbbrev: 'TX', stateName: 'Texas', localityName: 'Dallas, TX' },
  '0441215': { stateAbbrev: 'TX', stateName: 'Texas', localityName: 'Galveston, TX' },
  '0441218': { stateAbbrev: 'TX', stateName: 'Texas', localityName: 'Houston, TX' },
  '0441220': { stateAbbrev: 'TX', stateName: 'Texas', localityName: 'Beaumont, TX' },
  '0441228': { stateAbbrev: 'TX', stateName: 'Texas', localityName: 'Fort Worth, TX' },
  '0441231': { stateAbbrev: 'TX', stateName: 'Texas', localityName: 'Austin, TX' },
  '0441299': { stateAbbrev: 'TX', stateName: 'Texas', localityName: 'Rest of Texas' },
  
  // Utah
  '0350209': { stateAbbrev: 'UT', stateName: 'Utah', localityName: 'Utah' },
  
  // Vermont
  '1451250': { stateAbbrev: 'VT', stateName: 'Vermont', localityName: 'Vermont' },
  
  // Virginia
  '1130200': { stateAbbrev: 'VA', stateName: 'Virginia', localityName: 'Virginia' },
  
  // Washington
  '0240202': { stateAbbrev: 'WA', stateName: 'Washington', localityName: 'Seattle (King Cnty), WA' },
  '0240299': { stateAbbrev: 'WA', stateName: 'Washington', localityName: 'Rest of Washington' },
  
  // West Virginia
  '1140216': { stateAbbrev: 'WV', stateName: 'West Virginia', localityName: 'West Virginia' },
  
  // Wisconsin
  '0630200': { stateAbbrev: 'WI', stateName: 'Wisconsin', localityName: 'Wisconsin' },
  
  // Wyoming
  '0360221': { stateAbbrev: 'WY', stateName: 'Wyoming', localityName: 'Wyoming' },
};

/**
 * Carrier number to state abbreviation mapping (first 5 digits)
 * Used as fallback when exact carrier+locality not found
 */
const CARRIER_TO_STATE: Record<string, string> = {
  '01018': 'AL',
  '02102': 'AK',
  '03102': 'AZ',
  '07102': 'AR',
  '01112': 'CA', '01182': 'CA',
  '04112': 'CO',
  '13102': 'CT',
  '12102': 'DE',
  '12202': 'DC',
  '09102': 'FL',
  '10212': 'GA',
  '01212': 'HI',
  '02202': 'ID',
  '06102': 'IL',
  '08102': 'IN',
  '05102': 'IA',
  '05202': 'KS',
  '15102': 'KY',
  '07202': 'LA',
  '14112': 'ME',
  '12302': 'MD',
  '14212': 'MA',
  '08202': 'MI',
  '06202': 'MN',
  '07302': 'MS',
  '05302': 'MO',
  '03202': 'MT',
  '05402': 'NE',
  '01312': 'NV',
  '14312': 'NH',
  '12402': 'NJ',
  '04212': 'NM',
  '13202': 'NY', '13282': 'NY', '13292': 'NY',
  '11502': 'NC',
  '03302': 'ND',
  '15202': 'OH',
  '04312': 'OK',
  '02302': 'OR',
  '12502': 'PA',
  '09202': 'PR',
  '14412': 'RI',
  '11202': 'SC',
  '03402': 'SD',
  '10312': 'TN',
  '04412': 'TX',
  '03502': 'UT',
  '14512': 'VT',
  '11302': 'VA',
  '02402': 'WA',
  '11402': 'WV',
  '06302': 'WI',
  '03602': 'WY',
};

/**
 * Get geographic info for a carrier/locality combination
 */
export function getGeoForCarrierLocality(carrierNumber: string, localityCode: string): GeoInfo | null {
  // Try exact match first (carrier + locality as single key)
  const exactKey = carrierNumber + localityCode;
  if (CARRIER_LOCALITY_MAP[exactKey]) {
    return CARRIER_LOCALITY_MAP[exactKey];
  }
  
  // Try carrier number only (for entries that don't specify locality in map key)
  if (CARRIER_LOCALITY_MAP[carrierNumber]) {
    return CARRIER_LOCALITY_MAP[carrierNumber];
  }
  
  // Fallback: try to determine state from carrier number
  const carrier5 = carrierNumber.substring(0, 5);
  const stateAbbrev = CARRIER_TO_STATE[carrier5];
  if (stateAbbrev) {
    return {
      stateAbbrev,
      stateName: stateAbbrev, // Just use abbreviation as fallback
      localityName: `Locality ${localityCode}`,
    };
  }
  
  return null;
}

/**
 * Get all localities for a given state
 */
export function getLocalitiesForState(stateAbbrev: string): GeoInfo[] {
  const localities: GeoInfo[] = [];
  for (const [key, info] of Object.entries(CARRIER_LOCALITY_MAP)) {
    if (info.stateAbbrev === stateAbbrev) {
      localities.push(info);
    }
  }
  return localities;
}

/**
 * Get carrier numbers for a given state
 */
export function getCarriersForState(stateAbbrev: string): string[] {
  const carriers: string[] = [];
  for (const [key, info] of Object.entries(CARRIER_LOCALITY_MAP)) {
    if (info.stateAbbrev === stateAbbrev) {
      // Key is carrier + locality, extract carrier (first 5 chars typically)
      const carrier = key.substring(0, 5);
      if (!carriers.includes(carrier)) {
        carriers.push(carrier);
      }
    }
  }
  return carriers;
}
