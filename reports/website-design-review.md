# Public clinic website design review

Updated 4 November 2026. This change covers the public clinic pages and portal welcome screen. The authenticated portal, API contracts, and booking handoff retain their existing implementation.

## Direction and implementation

Applied **The printed annual**, the `editorial-report` direction from `design-taste-frontend`, seed **1207747127**. The existing Inter typeface and clinic blue palette were retained. No redraws. The composition uses a photographic masthead, an approximately 42% column axis, large service rows, and alternating white and pale blue surfaces.

Idea: **HIMS's connected journey from consultation to diagnostics to released reports becomes an editorial sequence, with a working service picker beside the opening statement.** This is a clear healthcare journey rather than a unique clinic story; the fictional clinic has no approved real location, team photography, or brand history to build that story from.

The working element is the homepage service picker. Choosing a service updates its sample fee and opens the existing booking form with that service selected. The portal preview opens the existing demo portal. No new network layer or dependencies were added.

Changes include readable 16px body text, larger controls, responsive navigation, simpler page titles, visible focus, reduced-motion support, and a compact WebP hero. The route-change focus now uses `preventScroll` so sticky navigation does not cover the page title.

## Visual review

The before inspection reported 13 failing design rules. Screenshots and machine measurements are stored under `.taste-skill/before`, `.taste-skill/after`, and `.taste-skill/final`.

ROUND 1
Seen in one second: A clinic interior and a large connected-care statement.
Idea (one sentence): The consultation-to-report journey becomes an editorial sequence.
Live thing: A service picker with a matching fee and booking handoff.
Layout words by section: hero=masthead / services=photo rows / portal=split / doctors=directory / booking=sequence / questions=disclosures.
Scores: design 7.5 · usability 7 · creativity 7 · content 7.5 → overall 6.0
Caps applied: The initial inspector run still reported a failing label above the title.
Top three problems (most visible first), each with the screenshot it shows in and the fix:
1. Mobile booking sits below the opening screen (`after/mobile-fold.jpg`): shorten the masthead and add a direct opening booking action.
2. The wordmark subtitle is too small (`after/desktop-fold.jpg`): give the clinic brand sufficient CSS specificity and a 13px subtitle.
3. The masthead repeats a clinic label immediately before the title (`after/desktop-fold.jpg`): remove the redundant caption and keep the illustration disclosure in the image credits.

ROUND 2
Seen in one second: Connected care with an immediate visit-planning action.
Idea (one sentence): The consultation-to-report journey becomes an editorial sequence.
Live thing: Selecting a service opens the correct existing booking.
Layout words by section: hero=masthead / services=photo rows / portal=split / doctors=directory / booking=sequence / questions=disclosures.
Scores: design 7.5 · usability 7.5 · creativity 7 · content 7.5 → overall 6.0
Caps applied: Redundant clinician labels and their relationship to the directory action were still flagged.
Top three problems (most visible first), each with the screenshot it shows in and the fix:
1. Some subpage titles scroll behind sticky navigation (`page-review/services-390.png`): preserve focus without its implicit scroll and add a regression check.
2. The header overflows at 320px: let the brand subtitle wrap within its own column.
3. Clinician labels compete with initials and the directory action (`final/tablet-page-01.jpg`): remove redundant labels and move the directory-wide action after the profiles.

ROUND 3
Seen in one second: A clinic experience with a clear visit-planning path.
Idea (one sentence): The consultation-to-report journey becomes an editorial sequence.
Live thing: The fee and selected booking service agree; closing the form restores focus.
Layout words by section: hero=masthead / services=photo rows / portal=split / doctors=directory / booking=sequence / questions=disclosures.
Scores: design 7.5 · usability 8 · creativity 7 · content 7.5 → overall 7.6
Caps applied: None. The final production inspection reports **0 failures and 3 warnings**. These scores are a self-review, not an independent evaluation.
Top three remaining limitations:
1. The clinic identity and service story are illustrative. Real clinic-approved content would make the design more distinctive.
2. Typography retains separate roles for the brand, initials, date, headings, controls, and body; the inspector flags the resulting size count. Body text remains 16px, with no text below 13px on the public homepage.
3. There is no clinical video. A licensed University of Vermont laboratory clip was inspected and omitted because this fictional clinic has no supplied process footage; short image and section transitions supply motion without a continuous clinical loop.

The inspector's optical margin warning compares an outer brand edge with inset button content. The page and header use the same centered container: 1280px at a 1440px viewport, with 80px outer margins. Form controls and the `data-ui` portal preview retain functional borders. Source-lint shadow exceptions apply only to removing an inherited brand shadow and the floating mobile menu.

## Images and credits

All final assets are local under `public/images`. Attribution is available in the website footer's **Image credits & illustrations** disclosure; machine-readable source records are in `public/images/credits.json`. No bundled atmospheric photographs were used. Clinician initials replace fabricated portraits; the existing fictional names and profiles remain.

| Asset | Title and creator | License and source |
| --- | --- | --- |
| `clinic-concept.webp` | Imaginary sunlit clinic interior, generated with the built-in image-generation tool | AI-generated concept illustration, identified in alt text and footer. Original retained under the global generated-images folder. |
| `consultation.jpg` | *Telemedicine Consult*, Intel Free Press | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/), [Wikimedia Commons source](https://commons.wikimedia.org/wiki/File:Telemedicine_Consult.jpg). Original downloaded file retained; responsive presentation crops its view. |
| `laboratory.jpg` | *NABL Accredited Clinical Pathology Laboratory in Kharghar Navi Mumbai Diagnostic Services*, Goleisureintl | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), [Wikimedia Commons source](https://commons.wikimedia.org/wiki/File:NABL_Accredited_Clinical_Pathology_Laboratory_in_Kharghar_Navi_Mumbai_Diagnostic_Services.jpg). |
| `ultrasound.jpg` | *A modern medical ultrasound scanner*, Harrison Keely | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), [Wikimedia Commons source](https://commons.wikimedia.org/wiki/File:A_modern_medical_ultrasound_scanner.jpg). |

The service images illustrate healthcare settings; they do not identify the demo clinic's staff or equipment. Replace fictional clinicians, illustrative fees, hours, and the concept interior with approved clinic content before a real launch.

Generated hero prompt, using the built-in tool:

> Create one photorealistic architectural editorial photograph for a fictional contemporary outpatient clinic website, no text, no logos, no people, landscape 3:2. A bright, quietly welcoming consultation waiting lounge in Metro Manila: natural daylight through tall windows, pale blue upholstered chairs, white painted walls, restrained warm light oak reception joinery, one broad-leaf tropical plant, frosted glass consultation door, subtle medical setting. Clean and credible modest clinic, not a luxury hotel. Strong horizontal composition with chairs and windows on the right, reception counter on left, soft morning sunlight and real material textures. Camera eye level, straight architecture lines, 35mm lens, fine grain, calm editorial art direction, blue and white dominate with restrained oak warmth. No decorative shapes, no graphics, no glowing effects. This is a conceptual illustration of an imaginary clinic, not an existing facility.

## Validation and limits

- Production build: `npm.cmd run build -- --outDir=.taste-skill/production`. TypeScript and Vite pass; the existing `dist` directory is preserved.
- ESLint: `npm.cmd run lint` passes.
- Unit suite: five existing tests pass.
- Browser coverage: **22 tests pass**, covering the existing portal and public-website suites plus the new service-picker check and route-focus regression assertion; all requests use mocks or browser-only demo data.
- Additional production checks: **32 page/viewport checks pass** across eight public routes at 1440px, 768px, 390px, and 320px, testing overflow, image loading, headings, and title visibility below the header. Reduced motion passes and no browser runtime errors were found. All external requests are blocked.
- Final skill inspection targets the production preview at 1440px, 768px, and 390px. Review measurements in `.taste-skill/final/report.json` and viewport check evidence in `.taste-skill/page-review/checks.json`.

No live login, database write, clinic booking, email delivery, password change, or payment was performed. Mock and demo checks do not establish live backend behavior. No environment configuration or related project was changed.
