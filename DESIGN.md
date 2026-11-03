# Pitstop — Pit Wall Theme

## Authority and scope
The user-supplied Stitch screen (project 16173377657770390233, screen 393172416e1a4820bbd60718f11890ac) and its exported code/image in design-reference/stitch-pit-wall are the visual reference. The theme is adapted onto the existing functional Next.js components. Prototype data, racing-specific UI copy, simulated telemetry, demo event handlers, and obsolete two-tier Soul behavior are not product requirements.

## Product identity
Name: Pitstop. Tagline: Multiple Minds. One Team. One Goal. Keep the existing orange/blue/cyan knot logo and square profile images.

## Palette
- Canvas: #0B0E14; navigation rails: #090B10.
- Panel/secondary: #121620; cards: #161B26; popovers: #181E2B.
- Text: #E2E8F0; secondary text: #A0ADBF.
- Primary action: #FF4500 with #07090E text for contrast.
- Selected secondary control: #FFB5A0 with #3B0900 text.
- Status/focus: #00DAF3; warnings: yellow; destructive actions: #FFB4AB.
- Borders: #30394C. Prefer a single border over decorative shadows.

## Typography and components
Chivo for message bodies and forms; Space Grotesk for headings, brand, and shared action buttons; JetBrains Mono for code, recipient controls, and compact metadata. Fonts are self-hosted under public/fonts with SIL OFL licenses. Heading sizes remain restrained for the operating interface. Body messages retain their current line length, wrapping, and content-fitting bubbles.

Keep the existing collapsible three-pane layout, keyboard shortcuts, responsive drawer behavior, and reduced-motion handling. Navigation actions and composer selections use orange accents. Cards use dark layered surfaces, clear spacing, modest corner radii, and square avatars. Do not add fake token counters, latency figures, decorative status claims, or racing terminology that obscures existing actions.

## Verification limits
The exported Stitch image was inspected. Live localhost browser access was denied by the browser permission policy during this session; do not work around that denial using another browser surface. Build/type checks, contrast calculations, and existing functional tests can run independently of browser access. A live visual review remains necessary when access is restored.

## Composition update after preview review
The interactive Stitch preview was opened in the user’s Chrome profile. Project selection, roster collapse, the memory drawer, and the agent registration dialog were inspected. Pitstop now uses the same stronger panel hierarchy: branded navigation header and primary action, an active-project switcher, full-width message search, actual Project Memory capacity and revision, a framed user profile, a two-line session header, a 320px agent roster with structured connection/activity sections, a wider recipient composer, and framed memory content. Labels and telemetry continue to describe real Pitstop data. New navigation controls reuse the existing project-open and memory actions.
