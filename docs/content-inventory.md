# Content inventory

Source: `D:\@Samuel\Leavory\Leavory-home.pdf`, one full-length page. The complete text and visual layout were reviewed before implementation. No external company or product information was used.

| Original content                                                                        | New location / representation                                               |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| “Know exactly which vulnerabilities to fix first.”                                      | Hero H1, preserved verbatim                                                 |
| Pipeline results from Azure DevOps, GitHub, GitLab → what to fix today                  | Hero description and input-to-findings interface                            |
| Demo walkthrough with an engineer, not a sales bot                                      | Hero CTA and final demo copy                                                |
| Hero repositories, findings, severities and states                                      | Typed examples in `src/data/content.ts`, used in the hero and product views |
| Azure organization hierarchy, automatic discovery, no manual tags                       | Azure connected hierarchy; Platform discovery copy                          |
| Ready-made Azure Pipelines template; Trivy; SBOM and artifacts; no agents               | Azure pipeline diagram, explanatory text, workflow                          |
| One click back to projects, repositories and pipelines                                  | Azure explanatory benefit; no external example URLs are invented            |
| GitHub and GitLab equivalents in the same view, including migration/acquisition         | Azure footer and Connect step                                               |
| Four roles and exact feature associations                                               | Accessible role tabs and mobile selector                                    |
| Everything your security team needs, without the noise                                  | Product headline; condensed into sentences without changing meaning         |
| Tracking spreadsheets and scattered alerts → risk, context, recommendation              | Visual intelligence flow                                                    |
| Automatic discovery, AI explaining findings, continuously updated base                  | Platform capabilities, product interface                                    |
| Platform: dashboard, projects and DORA, repository health, pipelines, production images | Workspace sidebar, capabilities and Platform persona                        |
| Intelligence: vulnerability intelligence, impact analysis, AI-drafted remediation       | Intelligence flow, workspace, Security/Developer personas                   |
| 01 Connect, 02 Scan with Trivy, 03 Cross-reference, 04 Fix                              | Connected four-step workflow                                                |
| GitHub Actions and GitLab CI templates                                                  | Scan with Trivy description                                                 |
| OSV, NVD, GitHub Advisories, CVE.org, CISA KEV, EPSS                                    | Source rail and cross-reference step                                        |
| KEV active exploitation and EPSS probability                                            | Intelligence explanation and Security persona; no scores fabricated         |
| Dependency, version and manifest in remediation                                         | Remediation output fields, Developer persona, Fix step                      |
| Never reads source code; SaaS never touches repositories                                | Dedicated security section, preserved explicitly                            |
| Trivy, SAST, Sonar, secret scanning inside customer pipeline                            | Organization-boundary diagram                                               |
| Leavory receives results, SBOM and scan artifacts only                                  | Azure and security diagrams                                                 |
| See Leavory in action, platform selection, email, engineer contact                      | Final CTA and front-end-only demo form                                      |
| LinkedIn label and © 2026 Leavory                                                       | Footer; LinkedIn remains text because source URL is unavailable             |

## Exact example associations

| Repository      | Finding                        | Severity | State       |
| --------------- | ------------------------------ | -------- | ----------- |
| auth-service    | JWT token without expiration   | Critical | New         |
| infra-terraform | AWS access key committed       | Secret   | AI analyzed |
| checkout-web    | Dependency with unpatched CVE  | High     | New         |
| billing-service | Missing security header (CSP)  | Medium   | AI analyzed |
| mobile-gateway  | SQL injection in /orders       | High     | New         |
| payments-api    | Secret in environment variable | Critical | AI analyzed |

UI compositions are illustrative and labeled. Their grouping explains product concepts, not a verified scan or customer environment. No additional counts, CVE identifiers, package versions, risk scores, exploitation evidence for specific findings, DORA values, metrics, clients, certifications, testimonials or integrations have been introduced. Charts, bars, meters and remediation fields in the persona and workspace views are deliberately value-free (skeleton lines, no numbers).

## CTA consolidation

The original navigation and the “See everything”, “Explore platform”, “Explore intelligence”, role and workflow detail links now lead to real sections or panels within the landing page. There are no invented detail pages. The original theme control is omitted, because this design has a single deliberate red, black and white direction.

## Visual composition

Dark, quiet surfaces, tight display type and hairline structure; palette kept to #C62A3D, #D21E38, #1E1C1B, #FFFFFF.

| Section      | Composition                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Hero         | Centred two-tone H1 and lede (brand names with their marks); live flow: pipelines and public sources → Leavory → a ranked “Fix first” list |
| Sources      | Connects to · Built on · Cross-references, with the copy’s own source list                                                                 |
| Statement    | The PDF line about spreadsheets and scattered alerts, in two tones                                                                         |
| Capabilities | Three isometric figures with the PDF capabilities                                                                                          |
| Intelligence | Product window with the six PDF findings and the selected finding explained                                                                |
| Azure DevOps | The three PDF benefits as numbered cells; GitHub/GitLab line                                                                               |
| Platform     | Five capabilities in a row, each with an animated line icon                                                                                |
| Who it’s for | Four roles                                                                                                                                 |
| How it works | Four steps (Fix in red), each with a small figure                                                                                          |
| Security     | “Never reads your source code” with the organization-boundary diagram and a stamp                                                          |
| Demo         | Front-end-only form on a line field, with a stamp                                                                                          |

The hero detail text (“Tokens issued by this service never expire…”) is a generic, technically correct explanation of the finding type, not a claim about a real scan. The “6 / 3 / 3” tab counts are counts of the six example rows shown.

LinkedIn URL source: the current leavory.com site (Organization schema and footer).
