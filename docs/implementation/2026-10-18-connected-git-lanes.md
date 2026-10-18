# Connected Git Graph lanes

## Goal

Make branch paths read like VS Code Git Graph: one continuous lane through every row, smooth turns between lanes, and stable branch colors.

## Implementation notes

- Each row reuses the previous row's outgoing edge so both halves reconstruct one center-to-center path.
- Lane changes use a vertical-tangent cubic Bezier: both control points keep the source and target x, so the curve leaves and enters rows straight down. Handles sit at 80% of the rise to get a tight rounded turn.
- Graph metrics are 16px lane pitch and offset, 24px row height, 4px node radius, 2px stroke, and a 4px background-colored shadow.
- Extra parent edges inherit the target branch color; first-parent edges keep the commit lane color.
- The uncommitted-changes marker uses the HEAD lane and connects downward to its commit.
- Ref pills use a neutral translucent gray background (`rgba(128,128,128,0.14)`) with normal foreground text, a colored icon block on the left, and a colored border only for the checked-out branch.
- Remote names render inside the same pill, after the branch name, separated by a hairline divider and set in italics, matching `.gitRefHeadRemote`. This keeps `main` and `origin/main` visually grouped without tinting the whole label.
- Branches receive distinct stable palette colours for the icon block; tag badges keep the warning colour block.
- Curve segments are painted in two passes per row: every background-colored shadow first, then every colored chord. Painting them interleaved let each shadow nick the previous segment's end and produced a dashed look.
- Each graph row clips to its own bounds (`overflow: hidden`), so a row's shadow cannot cover the previous row's line tail at 24px boundaries.
- Curve chords overlap by 2px at each end and sample the cubic 10 times; the overlap closes the wedge gap where two rotated rects meet at an angle.
- The first-parent spine always keeps the leftmost lane. When a first parent was reserved on a lane further right, that reservation is pulled back into the current lane and the right lane curves in, instead of letting the whole later history inherit the branch column's indentation.

## Verification

- `npm run typecheck`
- `npm test -- --reporter=dot`: 12 files, 38 tests
- Real Paseo check on MyWeChat history and the 208-commit fixture, including the working-tree row.
- Zoomed screenshot check that vertical lanes and cubic turns render as solid strokes, with no row-boundary dashes.
- Side-by-side visual comparison with reference screenshots on the same repository.

## Deferred

- The renderer uses React Native views rather than SVG because the Paseo plugin runtime does not expose an SVG component.
- Lane allocation still uses the existing `paseo-git-tree`-derived layout rather than a full branch-allocation algorithm.
- A VS Code extension cannot be installed directly into Paseo; this remains a locally adapted Paseo plugin.
