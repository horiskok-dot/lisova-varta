# Reference lock

Direct implementation of a field inspection tool. Design research uses the bundled Refero craft-details.md and color.md: semantic color roles, restrained product UI, labelled forms, visible keyboard focus and responsive touch controls.

Primary direction: a compact map workspace with a dark forest-green navigation rail, neutral light panels, thin borders, no marketing hero and no decorative imagery. Water blue, problem red and stale-check amber are semantic only. Green is reserved for primary actions and navigation. System sans-serif keeps Cyrillic offline. Coordinate grid is a functional fallback, not a fictional road map.

| Decision | Source | Purpose |
| --- | --- | --- |
| Map plus object list | User's field journal workflow | Select, inspect and update an object without navigating away |
| Neutral panels, one primary accent | Refero color.md sections 0–4 | Dense readable product UI |
| Water/problem/check markers with symbols | User types + Refero semantic color rules | Do not rely on color alone |
| Labelled native controls and focus-visible | Refero craft-details.md sections 1–2 | Keyboard and mobile use |
| Route limitation alongside the plan | Actual implementation constraint | Do not misrepresent straight-line ordering as road navigation |
| Explicit demo strip and local storage copy | Actual data and deployment behavior | Keep prototype evidence honest |

QA target: desktop map/list composition, mobile stacked layout, keyboard-accessible editor and explicit data/route limitations.
