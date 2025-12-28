/**
 * CPT Master Data
 * Contains CPT code definitions from the 2026 DHS Code List
 */

export interface CptMasterEntry {
  cpt: string;
  shortLabel: string;
  longDescription: string;
  section: string;
  category: string;
}

// CPT code data extracted from 2026 DHS Code List
// This is a subset of common codes - the full list is loaded from the Excel file
const CPT_MASTER_DATA: CptMasterEntry[] = [
  // Clinical Laboratory Services (80000 series)
  { cpt: "80047", shortLabel: "Basic metabolic panel", longDescription: "Basic metabolic panel with calcium, includes glucose, electrolytes, BUN, creatinine", section: "clinical_lab", category: "lab" },
  { cpt: "80048", shortLabel: "Basic metabolic panel", longDescription: "Basic metabolic panel without calcium", section: "clinical_lab", category: "lab" },
  { cpt: "80050", shortLabel: "General health panel", longDescription: "General health panel blood test", section: "clinical_lab", category: "lab" },
  { cpt: "80053", shortLabel: "Comprehensive metabolic panel", longDescription: "Comprehensive metabolic panel with 14 blood tests", section: "clinical_lab", category: "lab" },
  { cpt: "80061", shortLabel: "Lipid panel", longDescription: "Lipid panel cholesterol test", section: "clinical_lab", category: "lab" },
  { cpt: "80069", shortLabel: "Renal function panel", longDescription: "Renal function panel kidney test", section: "clinical_lab", category: "lab" },
  { cpt: "80074", shortLabel: "Hepatitis panel", longDescription: "Acute hepatitis panel blood test", section: "clinical_lab", category: "lab" },
  { cpt: "80076", shortLabel: "Hepatic function panel", longDescription: "Hepatic function panel liver test", section: "clinical_lab", category: "lab" },
  { cpt: "81001", shortLabel: "Urinalysis", longDescription: "Urinalysis with microscopy", section: "clinical_lab", category: "lab" },
  { cpt: "81003", shortLabel: "Urinalysis", longDescription: "Urinalysis automated without microscopy", section: "clinical_lab", category: "lab" },
  { cpt: "82270", shortLabel: "Blood occult test", longDescription: "Blood occult test fecal hemoglobin", section: "clinical_lab", category: "lab" },
  { cpt: "82274", shortLabel: "Blood occult test", longDescription: "Blood occult test fecal immunochemical", section: "clinical_lab", category: "lab" },
  { cpt: "82306", shortLabel: "Vitamin D test", longDescription: "Vitamin D 25-hydroxy blood test", section: "clinical_lab", category: "lab" },
  { cpt: "82947", shortLabel: "Glucose test", longDescription: "Glucose blood test", section: "clinical_lab", category: "lab" },
  { cpt: "83036", shortLabel: "Hemoglobin A1c", longDescription: "Hemoglobin A1c diabetes test", section: "clinical_lab", category: "lab" },
  { cpt: "84443", shortLabel: "Thyroid test TSH", longDescription: "Thyroid stimulating hormone TSH", section: "clinical_lab", category: "lab" },
  { cpt: "84439", shortLabel: "Thyroid test T4", longDescription: "Thyroxine free T4", section: "clinical_lab", category: "lab" },
  { cpt: "85025", shortLabel: "Complete blood count", longDescription: "Complete blood count CBC with differential", section: "clinical_lab", category: "lab" },
  { cpt: "85027", shortLabel: "Complete blood count", longDescription: "Complete blood count CBC automated", section: "clinical_lab", category: "lab" },
  { cpt: "86580", shortLabel: "TB skin test", longDescription: "Tuberculosis skin test intradermal", section: "clinical_lab", category: "lab" },
  { cpt: "87070", shortLabel: "Culture bacterial", longDescription: "Culture bacterial any source", section: "clinical_lab", category: "lab" },
  { cpt: "87081", shortLabel: "Culture screen", longDescription: "Culture screen for pathogens", section: "clinical_lab", category: "lab" },
  { cpt: "87086", shortLabel: "Urine culture", longDescription: "Urine culture bacterial colony count", section: "clinical_lab", category: "lab" },
  { cpt: "87491", shortLabel: "Chlamydia test", longDescription: "Chlamydia trachomatis amplified probe", section: "clinical_lab", category: "lab" },
  { cpt: "87591", shortLabel: "Gonorrhea test", longDescription: "Neisseria gonorrhoeae amplified probe", section: "clinical_lab", category: "lab" },
  { cpt: "87804", shortLabel: "Flu test rapid", longDescription: "Influenza virus rapid test", section: "clinical_lab", category: "lab" },
  { cpt: "87880", shortLabel: "Strep test rapid", longDescription: "Streptococcus group A rapid test", section: "clinical_lab", category: "lab" },
  { cpt: "88305", shortLabel: "Pathology tissue exam", longDescription: "Pathology tissue examination level 4", section: "pathology", category: "lab" },
  { cpt: "88342", shortLabel: "Immunohistochemistry", longDescription: "Immunohistochemistry each antibody", section: "pathology", category: "lab" },
  
  // Radiology/Imaging Services (70000 series)
  { cpt: "70030", shortLabel: "X-ray eye orbit", longDescription: "Radiologic examination eye for foreign body", section: "radiology", category: "radiology" },
  { cpt: "70100", shortLabel: "X-ray jaw", longDescription: "Radiologic examination mandible", section: "radiology", category: "radiology" },
  { cpt: "70110", shortLabel: "X-ray jaw complete", longDescription: "Radiologic examination mandible complete", section: "radiology", category: "radiology" },
  { cpt: "70140", shortLabel: "X-ray facial bones", longDescription: "Radiologic examination facial bones", section: "radiology", category: "radiology" },
  { cpt: "70150", shortLabel: "X-ray facial bones complete", longDescription: "Radiologic examination facial bones complete", section: "radiology", category: "radiology" },
  { cpt: "70160", shortLabel: "X-ray nasal bones", longDescription: "Radiologic examination nasal bones", section: "radiology", category: "radiology" },
  { cpt: "70200", shortLabel: "X-ray orbits", longDescription: "Radiologic examination orbits complete", section: "radiology", category: "radiology" },
  { cpt: "70210", shortLabel: "X-ray sinuses", longDescription: "Radiologic examination sinuses limited", section: "radiology", category: "radiology" },
  { cpt: "70220", shortLabel: "X-ray sinuses complete", longDescription: "Radiologic examination sinuses complete", section: "radiology", category: "radiology" },
  { cpt: "70250", shortLabel: "X-ray skull", longDescription: "Radiologic examination skull limited", section: "radiology", category: "radiology" },
  { cpt: "70260", shortLabel: "X-ray skull complete", longDescription: "Radiologic examination skull complete", section: "radiology", category: "radiology" },
  { cpt: "70336", shortLabel: "MRI temporomandibular joint", longDescription: "Magnetic resonance imaging temporomandibular joint", section: "radiology", category: "radiology" },
  { cpt: "70450", shortLabel: "CT head/brain", longDescription: "Computed tomography head or brain without contrast", section: "radiology", category: "radiology" },
  { cpt: "70460", shortLabel: "CT head/brain w/ contrast", longDescription: "Computed tomography head or brain with contrast", section: "radiology", category: "radiology" },
  { cpt: "70470", shortLabel: "CT head/brain w/wo contrast", longDescription: "Computed tomography head or brain without and with contrast", section: "radiology", category: "radiology" },
  { cpt: "70480", shortLabel: "CT orbit/ear", longDescription: "Computed tomography orbit sella or ear without contrast", section: "radiology", category: "radiology" },
  { cpt: "70490", shortLabel: "CT soft tissue neck", longDescription: "Computed tomography soft tissue neck without contrast", section: "radiology", category: "radiology" },
  { cpt: "70551", shortLabel: "MRI brain", longDescription: "Magnetic resonance imaging brain without contrast", section: "radiology", category: "radiology" },
  { cpt: "70553", shortLabel: "MRI brain w/wo contrast", longDescription: "Magnetic resonance imaging brain without and with contrast", section: "radiology", category: "radiology" },
  { cpt: "71045", shortLabel: "Chest X-ray", longDescription: "Radiologic examination chest single view", section: "radiology", category: "radiology" },
  { cpt: "71046", shortLabel: "Chest X-ray 2 views", longDescription: "Radiologic examination chest 2 views", section: "radiology", category: "radiology" },
  { cpt: "71047", shortLabel: "Chest X-ray 3 views", longDescription: "Radiologic examination chest 3 views", section: "radiology", category: "radiology" },
  { cpt: "71048", shortLabel: "Chest X-ray 4+ views", longDescription: "Radiologic examination chest 4 or more views", section: "radiology", category: "radiology" },
  { cpt: "71250", shortLabel: "CT chest", longDescription: "Computed tomography thorax without contrast", section: "radiology", category: "radiology" },
  { cpt: "71260", shortLabel: "CT chest w/ contrast", longDescription: "Computed tomography thorax with contrast", section: "radiology", category: "radiology" },
  { cpt: "71270", shortLabel: "CT chest w/wo contrast", longDescription: "Computed tomography thorax without and with contrast", section: "radiology", category: "radiology" },
  { cpt: "72040", shortLabel: "X-ray spine cervical", longDescription: "Radiologic examination spine cervical 2-3 views", section: "radiology", category: "radiology" },
  { cpt: "72050", shortLabel: "X-ray spine cervical complete", longDescription: "Radiologic examination spine cervical complete", section: "radiology", category: "radiology" },
  { cpt: "72070", shortLabel: "X-ray spine thoracic", longDescription: "Radiologic examination spine thoracic 2 views", section: "radiology", category: "radiology" },
  { cpt: "72100", shortLabel: "X-ray spine lumbar", longDescription: "Radiologic examination spine lumbosacral 2-3 views", section: "radiology", category: "radiology" },
  { cpt: "72110", shortLabel: "X-ray spine lumbar complete", longDescription: "Radiologic examination spine lumbosacral complete", section: "radiology", category: "radiology" },
  { cpt: "72141", shortLabel: "MRI spine cervical", longDescription: "Magnetic resonance imaging spinal canal cervical without contrast", section: "radiology", category: "radiology" },
  { cpt: "72148", shortLabel: "MRI spine lumbar", longDescription: "Magnetic resonance imaging spinal canal lumbar without contrast", section: "radiology", category: "radiology" },
  { cpt: "72192", shortLabel: "CT pelvis", longDescription: "Computed tomography pelvis without contrast", section: "radiology", category: "radiology" },
  { cpt: "72193", shortLabel: "CT pelvis w/ contrast", longDescription: "Computed tomography pelvis with contrast", section: "radiology", category: "radiology" },
  { cpt: "73030", shortLabel: "X-ray shoulder", longDescription: "Radiologic examination shoulder complete", section: "radiology", category: "radiology" },
  { cpt: "73070", shortLabel: "X-ray elbow", longDescription: "Radiologic examination elbow 2 views", section: "radiology", category: "radiology" },
  { cpt: "73110", shortLabel: "X-ray wrist", longDescription: "Radiologic examination wrist complete", section: "radiology", category: "radiology" },
  { cpt: "73130", shortLabel: "X-ray hand", longDescription: "Radiologic examination hand 2 views", section: "radiology", category: "radiology" },
  { cpt: "73140", shortLabel: "X-ray finger(s)", longDescription: "Radiologic examination finger(s) minimum 2 views", section: "radiology", category: "radiology" },
  { cpt: "73221", shortLabel: "MRI shoulder", longDescription: "Magnetic resonance imaging upper extremity joint without contrast", section: "radiology", category: "radiology" },
  { cpt: "73560", shortLabel: "X-ray knee", longDescription: "Radiologic examination knee 1-2 views", section: "radiology", category: "radiology" },
  { cpt: "73562", shortLabel: "X-ray knee 3 views", longDescription: "Radiologic examination knee 3 views", section: "radiology", category: "radiology" },
  { cpt: "73590", shortLabel: "X-ray lower leg", longDescription: "Radiologic examination tibia and fibula 2 views", section: "radiology", category: "radiology" },
  { cpt: "73600", shortLabel: "X-ray ankle", longDescription: "Radiologic examination ankle 2 views", section: "radiology", category: "radiology" },
  { cpt: "73610", shortLabel: "X-ray ankle 3 views", longDescription: "Radiologic examination ankle complete", section: "radiology", category: "radiology" },
  { cpt: "73620", shortLabel: "X-ray foot", longDescription: "Radiologic examination foot 2 views", section: "radiology", category: "radiology" },
  { cpt: "73630", shortLabel: "X-ray foot 3 views", longDescription: "Radiologic examination foot complete", section: "radiology", category: "radiology" },
  { cpt: "73721", shortLabel: "MRI knee", longDescription: "Magnetic resonance imaging lower extremity joint without contrast", section: "radiology", category: "radiology" },
  { cpt: "74018", shortLabel: "X-ray abdomen", longDescription: "Radiologic examination abdomen 1 view", section: "radiology", category: "radiology" },
  { cpt: "74019", shortLabel: "X-ray abdomen 2 views", longDescription: "Radiologic examination abdomen 2 views", section: "radiology", category: "radiology" },
  { cpt: "74150", shortLabel: "CT abdomen", longDescription: "Computed tomography abdomen without contrast", section: "radiology", category: "radiology" },
  { cpt: "74160", shortLabel: "CT abdomen w/ contrast", longDescription: "Computed tomography abdomen with contrast", section: "radiology", category: "radiology" },
  { cpt: "74170", shortLabel: "CT abdomen w/wo contrast", longDescription: "Computed tomography abdomen without and with contrast", section: "radiology", category: "radiology" },
  { cpt: "74176", shortLabel: "CT abdomen/pelvis", longDescription: "Computed tomography abdomen and pelvis without contrast", section: "radiology", category: "radiology" },
  { cpt: "74177", shortLabel: "CT abdomen/pelvis w/ contrast", longDescription: "Computed tomography abdomen and pelvis with contrast", section: "radiology", category: "radiology" },
  { cpt: "76700", shortLabel: "Ultrasound abdomen", longDescription: "Ultrasound abdominal real time with image documentation complete", section: "radiology", category: "radiology" },
  { cpt: "76705", shortLabel: "Ultrasound abdomen limited", longDescription: "Ultrasound abdominal real time with image documentation limited", section: "radiology", category: "radiology" },
  { cpt: "76770", shortLabel: "Ultrasound kidney", longDescription: "Ultrasound retroperitoneal real time complete", section: "radiology", category: "radiology" },
  { cpt: "76856", shortLabel: "Ultrasound pelvis", longDescription: "Ultrasound pelvic real time with image documentation complete", section: "radiology", category: "radiology" },
  { cpt: "76830", shortLabel: "Ultrasound transvaginal", longDescription: "Ultrasound transvaginal", section: "radiology", category: "radiology" },
  { cpt: "77065", shortLabel: "Mammography unilateral", longDescription: "Diagnostic mammography including computer-aided detection unilateral", section: "radiology", category: "radiology" },
  { cpt: "77066", shortLabel: "Mammography bilateral", longDescription: "Diagnostic mammography including computer-aided detection bilateral", section: "radiology", category: "radiology" },
  { cpt: "77067", shortLabel: "Mammography screening", longDescription: "Screening mammography bilateral including computer-aided detection", section: "radiology", category: "radiology" },
  
  // Evaluation and Management (99000 series)
  { cpt: "99202", shortLabel: "Office visit new patient", longDescription: "Office or other outpatient visit for evaluation and management of a new patient straightforward", section: "evaluation", category: "evaluation" },
  { cpt: "99203", shortLabel: "Office visit new patient", longDescription: "Office or other outpatient visit for evaluation and management of a new patient low complexity", section: "evaluation", category: "evaluation" },
  { cpt: "99204", shortLabel: "Office visit new patient", longDescription: "Office or other outpatient visit for evaluation and management of a new patient moderate complexity", section: "evaluation", category: "evaluation" },
  { cpt: "99205", shortLabel: "Office visit new patient", longDescription: "Office or other outpatient visit for evaluation and management of a new patient high complexity", section: "evaluation", category: "evaluation" },
  { cpt: "99211", shortLabel: "Office visit established", longDescription: "Office or other outpatient visit for evaluation and management of an established patient minimal", section: "evaluation", category: "evaluation" },
  { cpt: "99212", shortLabel: "Office visit established", longDescription: "Office or other outpatient visit for evaluation and management of an established patient straightforward", section: "evaluation", category: "evaluation" },
  { cpt: "99213", shortLabel: "Office visit established", longDescription: "Office or other outpatient visit for evaluation and management of an established patient low complexity", section: "evaluation", category: "evaluation" },
  { cpt: "99214", shortLabel: "Office visit established", longDescription: "Office or other outpatient visit for evaluation and management of an established patient moderate complexity", section: "evaluation", category: "evaluation" },
  { cpt: "99215", shortLabel: "Office visit established", longDescription: "Office or other outpatient visit for evaluation and management of an established patient high complexity", section: "evaluation", category: "evaluation" },
  { cpt: "99221", shortLabel: "Hospital admission", longDescription: "Initial hospital inpatient or observation care straightforward or low complexity", section: "evaluation", category: "evaluation" },
  { cpt: "99222", shortLabel: "Hospital admission", longDescription: "Initial hospital inpatient or observation care moderate complexity", section: "evaluation", category: "evaluation" },
  { cpt: "99223", shortLabel: "Hospital admission", longDescription: "Initial hospital inpatient or observation care high complexity", section: "evaluation", category: "evaluation" },
  { cpt: "99231", shortLabel: "Hospital visit", longDescription: "Subsequent hospital inpatient or observation care straightforward or low complexity", section: "evaluation", category: "evaluation" },
  { cpt: "99232", shortLabel: "Hospital visit", longDescription: "Subsequent hospital inpatient or observation care moderate complexity", section: "evaluation", category: "evaluation" },
  { cpt: "99233", shortLabel: "Hospital visit", longDescription: "Subsequent hospital inpatient or observation care high complexity", section: "evaluation", category: "evaluation" },
  { cpt: "99238", shortLabel: "Hospital discharge", longDescription: "Hospital inpatient or observation discharge day management 30 minutes or less", section: "evaluation", category: "evaluation" },
  { cpt: "99239", shortLabel: "Hospital discharge", longDescription: "Hospital inpatient or observation discharge day management more than 30 minutes", section: "evaluation", category: "evaluation" },
  { cpt: "99281", shortLabel: "ER visit", longDescription: "Emergency department visit self-limited or minor problem", section: "evaluation", category: "evaluation" },
  { cpt: "99282", shortLabel: "ER visit", longDescription: "Emergency department visit low to moderate severity", section: "evaluation", category: "evaluation" },
  { cpt: "99283", shortLabel: "ER visit", longDescription: "Emergency department visit moderate severity", section: "evaluation", category: "evaluation" },
  { cpt: "99284", shortLabel: "ER visit", longDescription: "Emergency department visit high severity", section: "evaluation", category: "evaluation" },
  { cpt: "99285", shortLabel: "ER visit", longDescription: "Emergency department visit high severity with threat to life or function", section: "evaluation", category: "evaluation" },
  { cpt: "99385", shortLabel: "Preventive visit new", longDescription: "Initial comprehensive preventive medicine evaluation adult 18-39 years", section: "evaluation", category: "evaluation" },
  { cpt: "99386", shortLabel: "Preventive visit new", longDescription: "Initial comprehensive preventive medicine evaluation adult 40-64 years", section: "evaluation", category: "evaluation" },
  { cpt: "99387", shortLabel: "Preventive visit new", longDescription: "Initial comprehensive preventive medicine evaluation adult 65 years and older", section: "evaluation", category: "evaluation" },
  { cpt: "99395", shortLabel: "Preventive visit established", longDescription: "Periodic comprehensive preventive medicine evaluation adult 18-39 years", section: "evaluation", category: "evaluation" },
  { cpt: "99396", shortLabel: "Preventive visit established", longDescription: "Periodic comprehensive preventive medicine evaluation adult 40-64 years", section: "evaluation", category: "evaluation" },
  { cpt: "99397", shortLabel: "Preventive visit established", longDescription: "Periodic comprehensive preventive medicine evaluation adult 65 years and older", section: "evaluation", category: "evaluation" },
  
  // Surgery (10000-69000 series)
  { cpt: "10060", shortLabel: "Incision abscess", longDescription: "Incision and drainage of abscess simple or single", section: "surgery", category: "surgery" },
  { cpt: "10061", shortLabel: "Incision abscess complex", longDescription: "Incision and drainage of abscess complicated or multiple", section: "surgery", category: "surgery" },
  { cpt: "10120", shortLabel: "Remove foreign body", longDescription: "Incision and removal of foreign body subcutaneous tissues simple", section: "surgery", category: "surgery" },
  { cpt: "10121", shortLabel: "Remove foreign body complex", longDescription: "Incision and removal of foreign body subcutaneous tissues complicated", section: "surgery", category: "surgery" },
  { cpt: "10140", shortLabel: "Incision hematoma", longDescription: "Incision and drainage of hematoma seroma or fluid collection", section: "surgery", category: "surgery" },
  { cpt: "10160", shortLabel: "Puncture aspiration", longDescription: "Puncture aspiration of abscess hematoma bulla or cyst", section: "surgery", category: "surgery" },
  { cpt: "11000", shortLabel: "Debridement skin", longDescription: "Debridement of extensive eczematous or infected skin", section: "surgery", category: "surgery" },
  { cpt: "11042", shortLabel: "Debridement wound", longDescription: "Debridement subcutaneous tissue first 20 sq cm or less", section: "surgery", category: "surgery" },
  { cpt: "11102", shortLabel: "Skin biopsy tangential", longDescription: "Tangential biopsy of skin single lesion", section: "surgery", category: "surgery" },
  { cpt: "11104", shortLabel: "Skin biopsy punch", longDescription: "Punch biopsy of skin single lesion", section: "surgery", category: "surgery" },
  { cpt: "11106", shortLabel: "Skin biopsy incisional", longDescription: "Incisional biopsy of skin single lesion", section: "surgery", category: "surgery" },
  { cpt: "11200", shortLabel: "Remove skin tags", longDescription: "Removal of skin tags multiple fibrocutaneous tags any area", section: "surgery", category: "surgery" },
  { cpt: "11300", shortLabel: "Shave skin lesion", longDescription: "Shaving of epidermal or dermal lesion trunk arms or legs", section: "surgery", category: "surgery" },
  { cpt: "11400", shortLabel: "Excision skin lesion", longDescription: "Excision benign lesion trunk arms or legs 0.5 cm or less", section: "surgery", category: "surgery" },
  { cpt: "11600", shortLabel: "Excision malignant lesion", longDescription: "Excision malignant lesion trunk arms or legs 0.5 cm or less", section: "surgery", category: "surgery" },
  { cpt: "11730", shortLabel: "Nail removal partial", longDescription: "Avulsion of nail plate partial or complete simple one", section: "surgery", category: "surgery" },
  { cpt: "11750", shortLabel: "Nail removal permanent", longDescription: "Excision of nail and nail matrix partial or complete permanent", section: "surgery", category: "surgery" },
  { cpt: "12001", shortLabel: "Repair wound simple", longDescription: "Simple repair of superficial wounds scalp neck axillae trunk extremities 2.5 cm or less", section: "surgery", category: "surgery" },
  { cpt: "12002", shortLabel: "Repair wound simple", longDescription: "Simple repair of superficial wounds 2.6 cm to 7.5 cm", section: "surgery", category: "surgery" },
  { cpt: "12011", shortLabel: "Repair wound face", longDescription: "Simple repair of superficial wounds face ears eyelids nose lips 2.5 cm or less", section: "surgery", category: "surgery" },
  { cpt: "17000", shortLabel: "Destroy skin lesion", longDescription: "Destruction premalignant lesions first lesion", section: "surgery", category: "surgery" },
  { cpt: "17110", shortLabel: "Destroy warts", longDescription: "Destruction of benign lesions other than skin tags or cutaneous vascular lesions up to 14", section: "surgery", category: "surgery" },
  { cpt: "20610", shortLabel: "Joint injection", longDescription: "Arthrocentesis aspiration or injection major joint or bursa", section: "surgery", category: "surgery" },
  { cpt: "29125", shortLabel: "Forearm splint", longDescription: "Application of short arm splint forearm to hand static", section: "surgery", category: "surgery" },
  { cpt: "29130", shortLabel: "Finger splint", longDescription: "Application of finger splint static", section: "surgery", category: "surgery" },
  { cpt: "29515", shortLabel: "Lower leg splint", longDescription: "Application of short leg splint calf to foot", section: "surgery", category: "surgery" },
  { cpt: "36415", shortLabel: "Blood draw venipuncture", longDescription: "Collection of venous blood by venipuncture", section: "surgery", category: "surgery" },
  { cpt: "43239", shortLabel: "Upper GI endoscopy biopsy", longDescription: "Esophagogastroduodenoscopy flexible transoral with biopsy", section: "surgery", category: "surgery" },
  { cpt: "45378", shortLabel: "Colonoscopy diagnostic", longDescription: "Colonoscopy flexible diagnostic including collection of specimen by brushing or washing", section: "surgery", category: "surgery" },
  { cpt: "45380", shortLabel: "Colonoscopy with biopsy", longDescription: "Colonoscopy flexible with biopsy single or multiple", section: "surgery", category: "surgery" },
  { cpt: "45385", shortLabel: "Colonoscopy polyp removal", longDescription: "Colonoscopy flexible with removal of tumor polyp or other lesion by snare technique", section: "surgery", category: "surgery" },
  { cpt: "49083", shortLabel: "Abdominal paracentesis", longDescription: "Abdominal paracentesis diagnostic or therapeutic with imaging guidance", section: "surgery", category: "surgery" },
  { cpt: "51701", shortLabel: "Catheter insertion", longDescription: "Insertion of non-indwelling bladder catheter", section: "surgery", category: "surgery" },
  { cpt: "51702", shortLabel: "Catheter insertion", longDescription: "Insertion of temporary indwelling bladder catheter simple", section: "surgery", category: "surgery" },
  { cpt: "57452", shortLabel: "Colposcopy", longDescription: "Colposcopy of the cervix including upper adjacent vagina", section: "surgery", category: "surgery" },
  { cpt: "57454", shortLabel: "Colposcopy with biopsy", longDescription: "Colposcopy of the cervix with biopsy and endocervical curettage", section: "surgery", category: "surgery" },
  { cpt: "62270", shortLabel: "Spinal puncture", longDescription: "Spinal puncture lumbar diagnostic", section: "surgery", category: "surgery" },
  { cpt: "64400", shortLabel: "Nerve block", longDescription: "Injection anesthetic agent trigeminal nerve branch", section: "surgery", category: "surgery" },
  { cpt: "64450", shortLabel: "Nerve block peripheral", longDescription: "Injection anesthetic agent other peripheral nerve or branch", section: "surgery", category: "surgery" },
  
  // Medicine (90000 series)
  { cpt: "90460", shortLabel: "Immunization admin", longDescription: "Immunization administration through 18 years first or only component", section: "medicine", category: "medicine" },
  { cpt: "90471", shortLabel: "Immunization admin", longDescription: "Immunization administration one vaccine percutaneous intradermal subcutaneous intramuscular", section: "medicine", category: "medicine" },
  { cpt: "90472", shortLabel: "Immunization admin each add", longDescription: "Immunization administration each additional vaccine", section: "medicine", category: "medicine" },
  { cpt: "90656", shortLabel: "Flu vaccine", longDescription: "Influenza virus vaccine trivalent split intramuscular", section: "medicine", category: "medicine" },
  { cpt: "90658", shortLabel: "Flu vaccine", longDescription: "Influenza virus vaccine trivalent split intramuscular", section: "medicine", category: "medicine" },
  { cpt: "90686", shortLabel: "Flu vaccine quadrivalent", longDescription: "Influenza virus vaccine quadrivalent split intramuscular", section: "medicine", category: "medicine" },
  { cpt: "90715", shortLabel: "Tdap vaccine", longDescription: "Tetanus diphtheria toxoids and acellular pertussis vaccine", section: "medicine", category: "medicine" },
  { cpt: "90732", shortLabel: "Pneumonia vaccine", longDescription: "Pneumococcal polysaccharide vaccine 23-valent", section: "medicine", category: "medicine" },
  { cpt: "90750", shortLabel: "Shingles vaccine", longDescription: "Zoster vaccine recombinant adjuvanted intramuscular", section: "medicine", category: "medicine" },
  { cpt: "92002", shortLabel: "Eye exam new patient", longDescription: "Ophthalmological services medical examination and evaluation intermediate new patient", section: "medicine", category: "medicine" },
  { cpt: "92004", shortLabel: "Eye exam new comprehensive", longDescription: "Ophthalmological services medical examination and evaluation comprehensive new patient", section: "medicine", category: "medicine" },
  { cpt: "92012", shortLabel: "Eye exam established", longDescription: "Ophthalmological services medical examination and evaluation intermediate established patient", section: "medicine", category: "medicine" },
  { cpt: "92014", shortLabel: "Eye exam established", longDescription: "Ophthalmological services medical examination and evaluation comprehensive established patient", section: "medicine", category: "medicine" },
  { cpt: "92507", shortLabel: "Speech therapy", longDescription: "Treatment of speech language voice communication or auditory processing disorder", section: "medicine", category: "medicine" },
  { cpt: "92557", shortLabel: "Hearing test comprehensive", longDescription: "Comprehensive audiometry threshold evaluation and speech recognition", section: "medicine", category: "medicine" },
  { cpt: "93000", shortLabel: "EKG complete", longDescription: "Electrocardiogram routine ECG with interpretation and report", section: "medicine", category: "medicine" },
  { cpt: "93005", shortLabel: "EKG tracing only", longDescription: "Electrocardiogram routine ECG tracing only without interpretation", section: "medicine", category: "medicine" },
  { cpt: "93010", shortLabel: "EKG interpretation", longDescription: "Electrocardiogram routine ECG interpretation and report only", section: "medicine", category: "medicine" },
  { cpt: "93015", shortLabel: "Cardiac stress test", longDescription: "Cardiovascular stress test using maximal or submaximal treadmill or bicycle", section: "medicine", category: "medicine" },
  { cpt: "93017", shortLabel: "Cardiac stress test tracing", longDescription: "Cardiovascular stress test tracing only without interpretation", section: "medicine", category: "medicine" },
  { cpt: "93306", shortLabel: "Echocardiogram complete", longDescription: "Echocardiography transthoracic real-time with image documentation 2D complete", section: "medicine", category: "medicine" },
  { cpt: "93307", shortLabel: "Echocardiogram limited", longDescription: "Echocardiography transthoracic real-time with image documentation 2D limited", section: "medicine", category: "medicine" },
  { cpt: "93880", shortLabel: "Carotid ultrasound", longDescription: "Duplex scan of extracranial arteries complete bilateral study", section: "medicine", category: "medicine" },
  { cpt: "93970", shortLabel: "Vascular ultrasound legs", longDescription: "Duplex scan of extremity veins complete bilateral study", section: "medicine", category: "medicine" },
  { cpt: "94010", shortLabel: "Spirometry", longDescription: "Spirometry including graphic record total and timed vital capacity", section: "medicine", category: "medicine" },
  { cpt: "94060", shortLabel: "Spirometry bronchodilator", longDescription: "Bronchodilation responsiveness spirometry pre and post bronchodilator", section: "medicine", category: "medicine" },
  { cpt: "94640", shortLabel: "Nebulizer treatment", longDescription: "Pressurized or nonpressurized inhalation treatment for acute airway obstruction", section: "medicine", category: "medicine" },
  { cpt: "94664", shortLabel: "Inhaler instruction", longDescription: "Demonstration or evaluation of patient utilization of aerosol generator nebulizer", section: "medicine", category: "medicine" },
  { cpt: "95004", shortLabel: "Allergy skin tests", longDescription: "Percutaneous tests with allergenic extracts immediate type reaction", section: "medicine", category: "medicine" },
  { cpt: "95115", shortLabel: "Allergy injection", longDescription: "Professional services for allergen immunotherapy single injection", section: "medicine", category: "medicine" },
  { cpt: "95117", shortLabel: "Allergy injections", longDescription: "Professional services for allergen immunotherapy two or more injections", section: "medicine", category: "medicine" },
  { cpt: "95165", shortLabel: "Allergy extract prep", longDescription: "Professional services for supervision of preparation and provision of antigen", section: "medicine", category: "medicine" },
  { cpt: "96360", shortLabel: "IV infusion hydration", longDescription: "Intravenous infusion hydration initial 31 minutes to 1 hour", section: "medicine", category: "medicine" },
  { cpt: "96365", shortLabel: "IV infusion therapy", longDescription: "Intravenous infusion for therapy prophylaxis or diagnosis initial up to 1 hour", section: "medicine", category: "medicine" },
  { cpt: "96372", shortLabel: "Injection therapeutic", longDescription: "Therapeutic prophylactic or diagnostic injection subcutaneous or intramuscular", section: "medicine", category: "medicine" },
  { cpt: "96374", shortLabel: "IV push medication", longDescription: "Therapeutic prophylactic or diagnostic injection intravenous push single or initial", section: "medicine", category: "medicine" },
  { cpt: "96375", shortLabel: "IV push medication add", longDescription: "Therapeutic injection intravenous push each additional sequential", section: "medicine", category: "medicine" },
  { cpt: "97110", shortLabel: "Therapeutic exercises", longDescription: "Therapeutic procedure one or more areas each 15 minutes therapeutic exercises", section: "medicine", category: "medicine" },
  { cpt: "97112", shortLabel: "Neuromuscular reeducation", longDescription: "Therapeutic procedure neuromuscular reeducation each 15 minutes", section: "medicine", category: "medicine" },
  { cpt: "97116", shortLabel: "Gait training", longDescription: "Therapeutic procedure gait training each 15 minutes", section: "medicine", category: "medicine" },
  { cpt: "97140", shortLabel: "Manual therapy", longDescription: "Manual therapy techniques one or more regions each 15 minutes", section: "medicine", category: "medicine" },
  { cpt: "97161", shortLabel: "PT evaluation low", longDescription: "Physical therapy evaluation low complexity", section: "medicine", category: "medicine" },
  { cpt: "97162", shortLabel: "PT evaluation moderate", longDescription: "Physical therapy evaluation moderate complexity", section: "medicine", category: "medicine" },
  { cpt: "97163", shortLabel: "PT evaluation high", longDescription: "Physical therapy evaluation high complexity", section: "medicine", category: "medicine" },
  { cpt: "97530", shortLabel: "Therapeutic activities", longDescription: "Therapeutic activities direct one-on-one contact each 15 minutes", section: "medicine", category: "medicine" },
  { cpt: "99406", shortLabel: "Smoking cessation", longDescription: "Smoking and tobacco use cessation counseling visit 3-10 minutes", section: "medicine", category: "medicine" },
  { cpt: "99407", shortLabel: "Smoking cessation", longDescription: "Smoking and tobacco use cessation counseling visit greater than 10 minutes", section: "medicine", category: "medicine" },
];

// Index for O(1) lookup by CPT code
const cptIndex = new Map<string, CptMasterEntry>();
CPT_MASTER_DATA.forEach(entry => {
  cptIndex.set(entry.cpt, entry);
});

/**
 * Get CPT master entry by code
 */
export function getCptMasterEntry(cpt: string): CptMasterEntry | undefined {
  return cptIndex.get(cpt);
}

/**
 * Get all CPT master entries
 */
export function getAllCptMasterEntries(): CptMasterEntry[] {
  return CPT_MASTER_DATA;
}

/**
 * Search CPT codes by partial code or description
 */
export function searchCptMaster(query: string, maxResults: number = 10): CptMasterEntry[] {
  const lowerQuery = query.toLowerCase();
  const results: CptMasterEntry[] = [];
  
  for (const entry of CPT_MASTER_DATA) {
    if (results.length >= maxResults) break;
    
    if (
      entry.cpt.includes(lowerQuery) ||
      entry.shortLabel.toLowerCase().includes(lowerQuery) ||
      entry.longDescription.toLowerCase().includes(lowerQuery)
    ) {
      results.push(entry);
    }
  }
  
  return results;
}
