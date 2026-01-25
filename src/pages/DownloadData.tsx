import { Download } from "lucide-react";

const DATA_FILES = [
  { name: "CLFS_2026_Q1V1.xlsx", description: "Clinical Lab Fee Schedule 2026" },
  { name: "DMEPEN26_JAN.xlsx", description: "DME PEN Fee Schedule 2026" },
  { name: "DMEPOS26_JAN.xlsx", description: "DMEPOS Fee Schedule 2026" },
  { name: "ZIP5_JAN2026.xlsx", description: "ZIP to Locality Mapping 2026" },
  { name: "cpt-codes.xlsx", description: "CPT Codes Reference" },
  { name: "dhs-cpt-codes.xlsx", description: "DHS CPT Codes" },
  { name: "gpci_2026_by_locality.csv", description: "GPCI by Locality 2026 (CSV)" },
  { name: "gpci_2026_by_locality.xlsx", description: "GPCI by Locality 2026 (Excel)" },
  { name: "mpfs_2026_nonqp_national.xlsx", description: "MPFS National 2026" },
  { name: "opps_addendum_b_2025.xlsx", description: "OPPS Addendum B 2025" },
  { name: "PFREV4.txt", description: "PF Rev 4 Data" },
];

export default function DownloadData() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Benchmark Reference Data Files</h1>
        <p className="text-muted-foreground mb-8">
          Download source data files used for benchmark pricing calculations.
        </p>
        
        <ul className="space-y-3">
          {DATA_FILES.map((file) => (
            <li key={file.name}>
              <a
                href={`/data/${file.name}`}
                download
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
              >
                <Download className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">{file.name}</div>
                  <div className="text-sm text-muted-foreground">{file.description}</div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
