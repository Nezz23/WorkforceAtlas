// Verified research context. Every item cites an official source opened on 2026-11-17; see docs/reference/context.md.
export type Source = { label: string; url: string };

const DATA_SOURCES: Source = { label: "OPM FWD, Data Sources", url: "https://data.opm.gov/resources/data-sources" };
const GETTING_STARTED: Source = { label: "OPM FWD, Getting Started", url: "https://data.opm.gov/info-and-help/getting-started" };
const WORKFORCE_CHANGES: Source = { label: "OPM FWD, Workforce Changes", url: "https://data.opm.gov/explore-data/analytics/workforce-changes" };
const DATA_DICTIONARY: Source = { label: "OPM FWD Data Dictionary", url: "https://data.opm.gov/FWD%20Data%20Dictionary.xlsx" };

export const COVERAGE: { text: string; source: Source }[] = [
  { text: "Covers federal civilian employees of the Executive branch, except USPS, the Postal Rate Commission, CIA, NSA, DIA, NGA, ODNI, the White House Office, the Office and Official Residence of the Vice President, Census Bureau temporary workers, State Department Foreign Service personnel, TVA, the Federal Reserve Board of Governors (CFPB is included), the PHS Commissioned Corps, non-appropriated fund employees, foreign nationals overseas, the Executive Residence, and the President's Intelligence Advisory Board.", source: DATA_SOURCES },
  { text: "Legislative branch is generally excluded; included are GPO, the Eisenhower Memorial Commission, the Financial Crisis Inquiry Commission, the Reagan Centennial Commission, MedPAC, the U.S.-China Economic and Security Review Commission, and USCIRF.", source: DATA_SOURCES },
  { text: "Judicial branch is generally excluded; the U.S. Tax Court is included.", source: DATA_SOURCES },
  { text: "Employment (Status) counts all active employees, in either a pay or non-pay status, as of the last day of each month.", source: DATA_SOURCES },
  { text: "Accessions include new hires, transfers, and rehires; separations include retirements, resignations, terminations, and deaths. Military personnel are excluded.", source: GETTING_STARTED },
];

export const POLICY: { date: string; title: string; effect: string; source: Source }[] = [
  { date: "2025-01-20", title: "Presidential Memorandum: Hiring Freeze (FR 2025-01905)", effect: "Barred filling vacant civilian positions or creating new ones in the executive branch, with exemptions for immigration enforcement, national security, and public safety.", source: { label: "Federal Register 2025-01905", url: "https://www.federalregister.gov/documents/2025/01/28/2025-01905/hiring-freeze" } },
  { date: "2025-01-20", title: "OPM: Guidance on Probationary Periods, Administrative Leave and Details (revised 2025-03-04)", effect: "Directed agencies to report all probationary employees to OPM by January 24, 2025 and determine whether to retain them.", source: { label: "OPM CHCO memo", url: "https://www.opm.gov/chcoc/transmittals/2025/Guidance%20on%20Probationary%20Periods%20Administrative%20Leave%20and%20Details%20FINAL.pdf" } },
  { date: "2025-01-28", title: "OPM: Guidance Regarding Deferred Resignation Program", effect: "Offered employees deferred resignation effective September 30, 2025, with paid administrative leave until separation.", source: { label: "OPM memo, 28 Jan 2025", url: "https://www.opm.gov/media/3oaf3vs0/opm-guidance-memo-re-deferred-resignation-program-01-28-25-final.pdf" } },
  { date: "2025-02-11", title: "Executive Order 14210 (FR 2025-02762)", effect: "Required a plan limiting agencies to one hire per four departures and directed agencies to prepare large-scale reductions in force.", source: { label: "Federal Register 2025-02762", url: "https://www.federalregister.gov/documents/2025/02/14/2025-02762/implementing-the-presidents-department-of-government-efficiency-workforce-optimization-initiative" } },
  { date: "2025-02-12", title: "Deferred Resignation Program closed", effect: "OPM stopped accepting deferred resignations after 7:20 pm ET on February 12, 2025.", source: { label: "OPM, Fork in the Road", url: "https://www.opm.gov/about-us/fork/" } },
  { date: "2025-04-17", title: "Presidential Memorandum: Extension of Hiring Freeze", effect: "Extended the hiring freeze through July 15, 2025.", source: { label: "White House, 17 Apr 2025", url: "https://www.whitehouse.gov/presidential-actions/2025/04/extension-of-hiring-freeze/" } },
  { date: "2025-07-07", title: "Presidential Memorandum: Ensuring Accountability and Prioritizing Public Safety in Federal Hiring", effect: "Continued the bar on filling vacancies through October 15, 2025, while allowing hires approved in writing by senior agency leadership.", source: { label: "White House, 7 Jul 2025", url: "https://www.whitehouse.gov/presidential-actions/2025/07/ensuring-accountability-and-prioritizing-public-safety-in-federal-hiring/" } },
  { date: "2025-10-15", title: "Executive Order 14356: Ensuring Continued Accountability in Federal Hiring (FR 2025-19614)", effect: "Required agencies to fill vacancies only with approval of a Strategic Hiring Committee and under an Annual Staffing Plan.", source: { label: "White House, EO 14356", url: "https://www.whitehouse.gov/presidential-actions/2025/10/ensuring-continued-accountability-in-federal-hiring/" } },
  { date: "2025-11-12", title: "OPM CPM 2025-14: Programs Affected by the Lapse in Appropriations", effect: "Required agencies to rescind reduction-in-force notices issued between October 1 and November 12, 2025.", source: { label: "OPM CPM 2025-14", url: "https://www.opm.gov/chcoc/latest-memos/employee-pay-leave-benefits-and-other-human-resources-programs-affected-by-the-lapse-in-appropriations/" } },
  { date: "2026-03-09", title: "OPM final rule: Schedule Policy/Career (FR 2026-02375, published 2026-02-06)", effect: "Authorized agencies to move policy-influencing positions into Schedule Policy/Career, excepted from adverse action procedures and appeals.", source: { label: "Federal Register 2026-02375", url: "https://www.federalregister.gov/documents/2026/02/06/2026-02375/improving-performance-accountability-and-responsiveness-in-the-civil-service" } },
  { date: "2026-10-23", title: "OMB M-27-01 / OPM: Status of Documents Addressing RIFs During a Lapse", effect: "Rescinded the September 2025 OMB and OPM guidance on issuing RIF notices during a lapse in appropriations.", source: { label: "OMB M-27-01", url: "https://www.whitehouse.gov/wp-content/uploads/2026/10/M-27-01-Status-of-Documents-Addressing-RIFs-During-a-Lapse.pdf" } },
];

export const DRP: { text: string; source: Source }[] = [
  { text: "OPM offered deferred resignation on January 28, 2025, with resignation effective September 30, 2025 and paid administrative leave in the interim.", source: { label: "OPM memo, 28 Jan 2025", url: "https://www.opm.gov/media/3oaf3vs0/opm-guidance-memo-re-deferred-resignation-program-01-28-25-final.pdf" } },
  { text: "The original deadline was February 6, 2025; the program closed at 7:20 pm ET on February 12, 2025.", source: { label: "OPM, Fork in the Road", url: "https://www.opm.gov/about-us/fork/" } },
  { text: "Employees with a retirement date between October 1 and December 31, 2025 had their deferred resignation date extended to match it.", source: { label: "OPM, Fork in the Road FAQ", url: "https://www.opm.gov/about-us/fork/faq/" } },
  { text: "OPM reports 141,084 DRP separations processed in FWD and expects additional DRP actions to be processed over time.", source: WORKFORCE_CHANGES },
  { text: "In FY 2026 agencies may use agency-specific DRP agreements of up to six months, and agreements of up to 12 weeks in connection with performance or conduct issues; OPM will approve VERA requests through the end of CY 2026.", source: { label: "OPM bulletin: 2026 Agency-Specific DRP and VERA Guidance", url: "https://content.govdelivery.com/accounts/USOPM/bulletins/3ff4a7e" } },
];

export const REVISIONS: { text: string; source: Source } | null = {
  text: "OPM publishes available data on schedule; late agency submissions are included in future releases, and files are versioned, so figures for a given month can change after first publication.",
  source: { label: "OPM FWD, Data Quality", url: "https://data.opm.gov/resources/data-quality" },
};

export const PROBATIONARY: { text: string; source: Source } | null = {
  text: "The public FWD files cannot isolate probationary terminations: the data dictionary has no probationary-status, nature-of-action, or legal-authority field, only a summary separation category.",
  source: DATA_DICTIONARY,
};

// Labels are OPM's own: each FWD file carries a description column beside the category code. OPM publishes no longer
// definition per code (data dictionary checked 2026-11-17), so none is invented here.
const FWD_FILES: Source = { label: "OPM FWD files, category description field", url: "https://data.opm.gov/get-data/data-downloads" };
export const CODES: { code: string; dataset: "separations" | "accessions"; label: string; definition: string; source: Source }[] = [
  { code: "SA", dataset: "separations", label: "TRANSFER OUT - INDIVIDUAL TRANSFER", definition: "", source: FWD_FILES },
  { code: "SB", dataset: "separations", label: "TRANSFER OUT - MASS TRANSFER", definition: "", source: FWD_FILES },
  { code: "SC", dataset: "separations", label: "QUIT", definition: "", source: FWD_FILES },
  { code: "SD", dataset: "separations", label: "RETIREMENT - VOLUNTARY", definition: "", source: FWD_FILES },
  { code: "SE", dataset: "separations", label: "RETIREMENT - EARLY OUT", definition: "", source: FWD_FILES },
  { code: "SG", dataset: "separations", label: "RETIREMENT - OTHER", definition: "", source: FWD_FILES },
  { code: "SH", dataset: "separations", label: "REDUCTION IN FORCE (RIF)", definition: "", source: FWD_FILES },
  { code: "SJ", dataset: "separations", label: "TERMINATION (EXPIRED APPT/OTHER)", definition: "", source: FWD_FILES },
  { code: "SL", dataset: "separations", label: "OTHER SEPARATION", definition: "", source: FWD_FILES },
  { code: "AA", dataset: "accessions", label: "TRANSFER IN - INDIVIDUAL TRANSFER", definition: "", source: FWD_FILES },
  { code: "AB", dataset: "accessions", label: "TRANSFER IN - MASS TRANSFER", definition: "", source: FWD_FILES },
  { code: "AC", dataset: "accessions", label: "NEW HIRE - COMPETITIVE SERVICE APPOINTMENT", definition: "", source: FWD_FILES },
  { code: "AD", dataset: "accessions", label: "NEW HIRE - EXCEPTED SERVICE APPOINTMENT", definition: "", source: FWD_FILES },
  { code: "AE", dataset: "accessions", label: "NEW HIRE - SENIOR EXECUTIVE SERVICE (SES) APPT", definition: "", source: FWD_FILES },
];

export const CROSSCHECKS: { claim: string; ours: string; official: string; source: Source; match: boolean | null }[] = [
  { claim: "DRP separations", ours: "141,053 excluding transfers (141,093 including)", official: "141,084", source: WORKFORCE_CHANGES, match: false },
  { claim: "Change in federal employees since January 20, 2025", ours: "-258,108", official: "-258,108 (accessions 250,147 minus separations 508,255)", source: WORKFORCE_CHANGES, match: true },
  { claim: "September 2025 separations", ours: "120,540 incl. transfers (119,461 excl.)", official: "none published", source: WORKFORCE_CHANGES, match: null },
  { claim: "September 2025 DRP-flagged separations", ours: "96,165", official: "none published", source: WORKFORCE_CHANGES, match: null },
  { claim: "Headcount, December 2025, and change in 2025", ours: "2,074,649; −10.3%", official: "2,074,649; −10.3% (Pew, from OPM data)", source: { label: "Pew Research Center, 13 Mar 2026", url: "https://www.pewresearch.org/short-reads/2026/03/13/federal-workforce-shrank-10-in-trumps-first-year-back-in-office/" }, match: true },
  { claim: "New hires and separations, calendar 2025", ours: "112,197 hires; 342,768 separations (current OPM files, transfers excluded)", official: "116,912; 348,219 (Pew, files as of March 2026)", source: { label: "Pew Research Center, 13 Mar 2026", url: "https://www.pewresearch.org/short-reads/2026/03/13/federal-workforce-shrank-10-in-trumps-first-year-back-in-office/" }, match: false },
  { claim: "Headcount, September 2026", ours: "2,017,021", official: "2,017,021", source: { label: "OPM FWD, Workforce Size & Composition", url: "https://data.opm.gov/explore-data/analytics/workforce-size-and-composition" }, match: true },
];
