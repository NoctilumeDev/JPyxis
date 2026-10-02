# Independent product manager review

Reviewed head: `333bcec65ef1e636100a0abe4fae9c6b0fd56d4b`.
Actual rendered source: `8aa073c5f06c718511cced38d7c59376db05bed1`.
The supplied source inventory binds all three rendered UI asset blobs to the review head.

Verdict: the observed 1440px desktop direction meets the user's product and visual intent. No P0/P1 was found in this bounded product review. Two confirmed P2 defects prevent acceptance of the complete candidate: inadequate narrow-window safety and a fractional media-query gap. The desktop direction can be preserved while those two defects are repaired. This report does not grant user final visual sign-off or merge authorization.

## Product goal and scope

The user is a Java/Spring Boot developer inspecting Python execution at a workstation. The central relationship between Request, Control Binding, Execution and Host Decision is product information. At the supported workstation width it should remain horizontally visible; below a content-driven minimum width the existing read-only presentation should provide a safe observation surface. No mobile control architecture is needed.

This independent review used a separate browser tab against the existing empty actual session on port 8766. I resized and captured the view without installing, activating, invoking, closing or exporting. The existing business session was not mutated. The temporary viewport override was reset and the review tab was closed. The original main preview on port 8765 was untouched.

I read `design-qa.md` and the tester's independent report and summary. I also opened the task-provided native 1440px UNKNOWN, held, six-request and lifecycle images for visual comparison. Those supplied images are contextual evidence of actual states, not a new independent execution of those states. No source files were modified.

## Captured review steps

All accepted screenshots below were saved by the browser and opened at native resolution. Corresponding DOM and geometry JSON files share each screenshot's stem. The initial default-viewport capture `01-desktop-first-display` is retained but excluded from the accepted set because it was not the agreed 1440x900 desktop inspection target.

| Step | View and evidence | Health |
| --- | --- | --- |
| 1 | `02-desktop-1440.png`: actual empty homepage at 1440x900 CSS pixels | Healthy desktop direction; no horizontal overflow |
| 2 | `03-boundary-1024.png`: empty four-stage inspection at 1024px | Readable, longest decision word fits; candidate minimum needs real UNKNOWN confirmation after repair |
| 3 | `04-boundary-1000.png`: empty inspection at 1000px | Longest decision word fits narrowly, insufficient safety margin for choosing a new supported minimum |
| 4 | `05-boundary-960.png`: empty inspection at 960px | P2; WITHHELD already has 1px internal overflow and request mode wraps |
| 5 | `06-boundary-800.png`: user's failing width | P2 reproduced independently; WITHHELD clipped and document horizontally overflows |
| 6 | `07-readonly-390.png`: existing safe presentation | Healthy fallback: notice visible, operation controls hidden, zero document horizontal overflow |
| 7 | `08-old-boundary-767.png`, `fractional-boundary.json`: effective CSS width between 767 and 767.5 | P2 reproduced independently; both old adjacent media queries false, notice absent, operational controls visible |

## Findings and minimum repair

1. **P2: the operating desktop layout remains active below its readable content width.** At 800px, the decision content box is 105.09px, WITHHELD requires approximately 141px, its internal overflow is 36px, and the document horizontal overflow is 8px. The word is visibly clipped in Step 5. Technical values also fragment into small pieces. At 960px, Step 4 already records a 1px internal overflow. This is a defect in the agreed safe fallback, not optional polish.

   At 1000px the empty decision content box is 149.09px; at 1024px it is 154.38px. I recommend **1024 CSS pixels as the conservative minimum operating width**, with the existing safe read-only presentation for narrower windows. The extra margin matters when a scrollbar or a real UNKNOWN request introduces longer content. Keep the existing 1440px tracks, type sizes, semantic colors, arrows and flat surfaces. Do not shorten WITHHELD, shrink its type, hide the decision, or compress the four-stage layout further. The exact 1024px real UNKNOWN state remains a required post-fix check rather than a currently established acceptance claim.

2. **P2: a fractional CSS width can fall between the old adjacent breakpoints.** At requested 767px, the independent DOM reports `innerWidth=767`, while `(width > 767px)` and `(width < 767.5px)` are true. Both `(max-width:767px)` and `(min-width:768px)` are false. Step 7 shows the desktop notice absent, install/close controls visible and the same clipped decision. A viewport API request for a fractional width itself was rejected because that API accepts integer dimensions; the browser's actual fractional CSS width supplies the reproduced boundary case.

   Edit the existing media rules into a continuous partition: read-only when `width < 1024px`, bounded intermediate desktop presentation when `1024px <= width <= 1120px`, existing wider desktop rules above that. Use equivalent gap-free media syntax if project support requires it. This repair belongs in the existing breakpoint rules; no final override block or another mobile layout is necessary.

**P3 copy suggestion, optional:** the current sentence says the product is designed for desktop inspection but does not state why controls disappear in a narrow desktop window. Add a short instruction such as “Read-only view. Widen this window to use controls.” to the existing notice. This directly explains the user's next action. No additional menu, modal, tab, swipe interaction or product flow is needed.

No other P3 redesign is required. The supplied task evidence shows a clean right directory with short labels and an obvious selected row; full realization coordinates and the retained request pin are available centrally. Keep that division of work.

## Desktop strengths and limits

In Step 1, the white center and matching navy rails are cohesive. Request is neutral, Control Binding and Host Decision have authority/decision wine, Execution uses navy, and boundary/selection gold is restrained. Control Binding has more width without overwhelming the chain. The strong main title and quieter eyebrow/slogan have distinct levels. Stage arrows preserve the direction of authority and computation. Results are flat text on white surfaces rather than extra colored cards. The receipt entry remains visible on the agreed desktop first screen.

The supplied held and UNKNOWN screenshots keep the four responsibilities visibly distinct, including held authorization and a withheld Java decision. The supplied six-request image shows right directory rows with even rhythm and short version/request labels. These contextual images support retaining the desktop design; they do not substitute for measuring the repaired source.

The tester separately exercised menus, dual-directory navigation, real invocations, cutover, crash, rollback, receipt export and process shutdown. I did not repeat those mutation tests. My direct browser review is the empty-state/read-only boundary flow. No screen-reader session or exhaustive browser/zoom matrix was performed, and screenshots alone do not establish assistive-technology compliance.

## Post-fix acceptance checks

1. Build and run the committed repaired assets, with a source banner and exact asset inventory. Keep the old failed evidence and raw receipts.
2. At 1440x900, check first homepage display and direct Lifecycle-to-Overview return. Confirm the title, four columns, arrows, current route/selected request, receipt entry and both rail alignments have not drifted. Include actual held and UNKNOWN states; preserve the four-stage relationship.
3. At 1024px and just above, inspect actual UNKNOWN/WITHHELD as well as empty state. Verify no horizontal overflow in the document or decision, no per-character fragmentation of technical fields, and operating controls remain reachable.
4. At 1023px and the effective fractional boundary just below 1024px, confirm the read-only notice and no mutation/selector controls. Also recheck original 767px, 800px and 390px counterexamples with zero document horizontal overflow.
5. Update the current visible homepage preview to the verified repaired source. A source change in Git alone is not a preview sync; confirm the visible source banner and actual assets.
6. After those observed defects are closed, obtain the independent bounded P2 recheck and leave user final visual sign-off distinct from CI and this report. No merge is authorized by this review.

The implementation should be a small breakpoint and notice edit. A redesign of the wide homepage would introduce unrelated product risk.
