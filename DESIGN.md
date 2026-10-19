# Interface direction · 0.5

Build target: the existing Forest Watch product and its forest-green brand. This is a direct usability revision of that product, not a new marketing page. The primary task is finding a place, reading the map and recording an inspection on desktop or Android.

## Reference lock

Live Refero tools were unavailable. Research used Refero's bundled typography, icons and craft-details references, together with the existing deployed interface and the user's mobile/desktop requirement. The dominant direction is a practical cartographic workspace: white working surfaces, forest-green navigation, a large satellite map, and clear source/status distinctions.

Preserve: the forest palette, source attribution, map geometry, offline journal and existing inspection workflows. Borrow from the craft references: neutral system typography, a limited type scale, consistent outline icons, accessible search, visible keyboard focus, large touch targets, and contained dialog scrolling. No bitmap imagery is needed; the map is the main media and the logo is editable SVG.

| Decision | Reference / constraint | Role and reason |
| --- | --- | --- |
| Shield, pine and amber watch point | Forest Watch identity and fire-preparedness topic | A clear brand symbol that works as a launcher icon; amber belongs to the logo, not routine actions. |
| Map before sources and route planning | Primary field workflow; existing page review | The useful working area appears before supporting information. |
| Desktop map with an adjacent object panel | Existing product target | See geography and the journal together. |
| Mobile bottom navigation and map/object switch | Touch and mobile craft reference; narrow viewport | Primary actions stay reachable; two narrow columns never compete. |
| Neutral sans typography and tabular counts | Typography reference, sections 0, 2, 10 and 12 | Scan labels and counts without waiting for external fonts. |
| 24px-grid outline icon system | Icons reference | Same stroke, size and color semantics throughout the interface. |
| Keyboard location search, focus and menus | Craft-details, focus/forms/accessibility | Search with arrows, Enter and Escape; retain touch and keyboard access to all utilities. |
| Full-height mobile editor | Craft-details touch/modal guidance | Readable 16px fields and reachable save controls without page scroll leaking underneath. |

## Verification target

Inspect desktop, a 390px phone viewport, a 320px narrow phone and tablet widths. Check map visibility, object switching, menu actions, keyboard place selection, expanded map, editor scrolling, focus, overflow and offline shell assets. App packaging must use the same logo and interface for web, Windows and Android.

Verification evidence: rendered browser views at 320, 390, 768 and 900px, plus the packaged Windows app. Narrow-form truncation and an unwanted initial fragment scroll were fixed during QA. See `QA.md` for the exact coverage and native-device limitation.
