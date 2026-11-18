# Tasneem Responsive Quality Standard

**Status: Mandatory project-wide engineering rule.** This standard applies to every current and future page, component, form, navigation element, popup, image, and content change. It must not be bypassed by a feature update.

## Brand and content invariants
- Preserve the approved Tasneem logo and dark-green / gold visual identity.
- Arabic remains the default language; English is secondary.
- Keep Hajj and Umrah ahead of general travel services in the information hierarchy.
- Responsive changes must not remove, conceal, or weaken business-critical content or functionality.

## Required viewport widths
Every release must be checked at CSS viewport widths: 320, 375, 430, 600, 768, 1024, 1280, 1440, and 1920 pixels.

## Required page coverage
At minimum test: /, /hajj.html, /umrah.html, /services.html, /about.html, /track.html, and /privacy.html. Test all forms, menus, search popovers, theme controls, ticker controls, floating actions, and keyboard focus states that exist on each page.

## Layout rules
- Use fluid sizing: Grid, Flexbox, percentages, rem, minmax(), clamp(), and content-based heights.
- Use shared design tokens and shared responsive CSS; avoid per-page conflicting breakpoints.
- Keep containers aligned to a consistent responsive gutter and a documented maximum content width.
- Ensure flex/grid children can shrink with min-width: 0.
- Images must preserve intrinsic aspect ratio or use an intentional aspect-ratio/object-fit treatment.
- Forms and controls must fit their parent, be touch-friendly, and use readable text sizes.
- Menus and popovers must remain within the viewport and be keyboard/touch accessible.
- No unintended horizontal page scrolling, clipping, overlap, cut-off text, distorted images, unexplained blank bands, or inconsistent card rhythm.
- Do not use overflow clipping to hide a real layout defect; diagnose and fix the offending element.

## Release acceptance checks
A release is not considered responsive-complete until:
1. All nine viewport widths have been exercised in a real browser.
2. All required pages have been checked at the required widths.
3. document.documentElement.scrollWidth equals window.innerWidth (except intentionally scrollable inner components such as a data table).
4. No visual clipping, overlap, overflow, image distortion, or unusable touch targets remain.
5. Forms, menus, popovers, navigation, and interactive controls have been functionally tested without submitting production test data.
6. The report records page, viewport, pass/fail, issue, fix, and evidence.
7. Production deployment is successful and the deployed version is rechecked.

## Future change gate
Every pull request or direct commit that changes page markup, CSS, fonts, images, or components must preserve this standard and include responsive checks. Re-test all affected pages, and run a full regression across all required pages before a major release. If browser testing is unavailable, explicitly mark the task **not accepted / not complete**; do not claim all-device success.
