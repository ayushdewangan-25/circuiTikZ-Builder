# CircuiTikZ Builder

A browser-based editor for drawing electrical circuits and getting ready-to-paste LaTeX code for them. You draw on a grid, and the editor writes the code using the [CircuiTikZ](https://ctan.org/pkg/circuitikz) package.

It needs no installation, build step, server or external libraries. The whole app is three files: `index.html`, `style.css` and `app.js`.

## Getting started

```bash
git clone https://github.com/ayushdewangan-25/circuiTikZ-Builder.git
cd circuiTikZ-Builder
```

Then open `index.html` in a modern browser (Chrome, Edge or Firefox). That's it.

You can also host the folder on any static web server, such as GitHub Pages.

## Features

### Drawing
- **Grid editor:** click a start point and an end point to place a component. Wires keep connecting from point to point until you press `Esc` or right-click.
- **Grid size:** 1, 0.5, 0.25, 0.2, 0.15 or 0.1 cm. One grid step equals the same distance in the generated LaTeX.
- **Alignment assist:** dashed guides appear when a terminal lines up with another one. A green ring shows when you land exactly on an existing terminal. Points snap to nearby terminals.
- **Wires follow moved parts:** when you move or rotate a component, wires attached to its terminals stay connected. They are re-routed with right-angle bends that avoid running along other wires.
- **Wire crossings** (*Output settings → Wire crossings*): wires that cross without connecting can be marked automatically with a **gap** in the lower wire or a **hop** (small semicircle) in the upper one. Horizontal wires go on top by default; each wire's *At crossings* option can put it on top or underneath. A junction dot on a crossing means the wires connect, so it gets no mark. The marks follow when you move things and appear in the LaTeX and in every export.
- **Editing:** select, drag to move, drag the end handles to stretch, rotate 90°, reverse direction, mirror, delete, undo and redo.
- **Selecting several parts:** drag a box on empty canvas, or `Shift`/`Ctrl`+click parts to add or remove them (`Ctrl`+`A` selects everything). Drag any selected part or use the arrow keys to move them together; attached wires follow. Copy, paste, delete and colour apply to the whole selection.
- **Arrow keys** move the selection by one grid step.
- **Copy and paste:** `Ctrl`+`C` / `Ctrl`+`X` / `Ctrl`+`V`. A paste lands at the mouse pointer, or 1 cm down-right of the previous one if the pointer hasn't moved. `Ctrl`+drag a part to drop a copy of it, as in Simulink. Copying a group box copies everything inside it, and numbered labels (`R_1`, `C_2`, …) get the next free number.
- **Zoom:** buttons, `Ctrl` + mouse wheel or trackpad pinch, keyboard shortcuts, and *Fit* (or `Space`) to show the whole circuit.

### Components
| Group | Components |
|---|---|
| Tools | Select, wire, current-path highlighter, arrow (filled-triangle, stealth or open end, at the end, start or both), signal arrow |
| Power electronics | MOSFET with anti-parallel diode, bidirectional switch (back-to-back MOSFETs), BDS common drain (two MOSFETs joined drain to drain), GaN BDS (single channel with two gates), GaNFET, transformer (n:1, with dot markings), diode, Zener diode, LED |
| Passive | Resistor, variable resistor, capacitor, inductor, fuse |
| Sources | DC voltage source, current source, AC source, battery, dependent voltage and current sources |
| Switches & meters | Open and closed switch, ammeter, voltmeter |
| Nodes & labels | Ground, junction dot, open terminal, text label, open voltage branch |
| Control blocks | Block, transform block (diagonal with two labels), PI block (with icon), multiplier, summing junction, modulator (carrier/PWM icon), inverter, motor, group box |

The MOSFET, bidirectional switch, BDS common drain, GaN BDS, GaNFET, transformer, inductor, capacitor and AC source use shapes copied exactly from a reference drawing. They are output as TikZ `pic`s, defined at the top of the generated code, so the pasted code needs no extra packages. Everything else uses standard CircuiTikZ components.

### Arrows
- **Arrow (`A`):** a straight arrow for voltages or annotations, black by default. Choose the end style (filled triangle, stealth or open) and whether the head is at the end, the start or both ends.
- **Signal arrow (`Q`):** see *Control block diagrams* below.

### Current-path highlighter
- **Highlighter tool (`H`):** click along a path to mark where current flows, the same way you draw a signal. Double-click, `Enter` or right-click finishes.
- Each highlight has its own colour, width (pt), style (solid or dashed with round dashes) and opacity. Highlights are drawn underneath the circuit and exported as translucent TikZ lines. To select a highlight lying under a wire, `Alt`+click it.

### Control block diagrams
- **Signal arrow tool (`Q`, under *Tools*):** click to start, then click to add corners. Right angles are inserted automatically. Double-click, `Enter` or right-click finishes the signal with an arrowhead. Any wire can also be given arrowheads or a start dot from its *Ends* option.
- **Blocks** are placed by their centre. You set each block's size, fill colour, drop shadow, dashed border or no border at all, rounded corners and labels yourself.
  - Labels are inserted as-is: use `$...$` for math and `\\` for a new line. For a PID controller, use a block labelled `PID`.
  - Summing junctions have a style (⊕, ⊗ or plain) and a sign (+/−) for each input side.
- **Moving blocks:** signals attached to a block follow it when it moves. Moving a group box also moves everything inside it.
- **Output:** plain TikZ. No extra TikZ libraries are needed, and shadows are drawn directly. `bm` / `amsmath` are added to the preamble automatically when your labels use `\bm` or `\text`.

### Per-component options
- Label, value, current and voltage annotations. Math mode is added automatically, so `R_1` becomes `$R_1$`.
- Which side the label goes on, terminal markers (`*-*`, `o-o`, …), colour, size (0.5× to 2.5×) and rotation.

### Output
- **LaTeX code** that updates live, with *Copy* and *Download .tex* buttons. You can choose:
  - a full `standalone` document or just the `circuitikz` environment
  - American or European symbol style
  - overall scale
  - line width (presets from 0.4 to 1.2 pt, or a custom value from 0.1 to 5 pt)
- **Editable code:** click *Edit code* to change the LaTeX directly. The diagram is rebuilt from the code as you type: change coordinates, labels, values, colours or options, or add new `\draw ... to[...] ...;` lines. *Done* (`Ctrl`+`Enter`) keeps the result, *Cancel* (`Esc`) restores the diagram as it was, and one *Undo* reverts the whole edit. The canvas is locked while you edit.
- **Diagram download** as a vector **PDF**, **SVG**, **PNG** (transparent background) or **JPG**, at 150, 300 or 600 dpi. Exports are true to size, with 1 grid step = 1 cm.
- **Templates:** voltage divider, RC low-pass filter, series RLC circuit, a 1Φ single-stage AC-DC converter (with MOSFET switches, and a version using GaN BDS / GaNFET switches), and two control block diagrams (an SPS current-control loop and induction-motor field-oriented control).
- **Auto-save:** your circuit and settings are kept in the browser's local storage.

## Keyboard shortcuts

Press `?` or click **Shortcuts** in the top bar to see the full list inside the app.

| Key | Action |
|---|---|
| `?` | Show the shortcut list |
| `S` | Select tool |
| `W` | Wire |
| `R` / `C` / `L` | Resistor / capacitor / inductor |
| `V` / `I` | Voltage / current source |
| `D` | Diode |
| `M` / `B` | MOSFET + diode / bidirectional switch |
| `X` | Transformer |
| `A` | Arrow |
| `H` | Current-path highlighter |
| `Q` / `K` / `J` | Signal arrow / block / summing junction |
| `G` / `N` / `T` | Ground / junction dot / text label |
| `Shift` + `R` | Rotate selected part 90° |
| `[` / `]` | Shrink / grow selected part |
| `Delete` / `Backspace` | Delete selected part |
| `Ctrl` + `Z` | Undo |
| `Ctrl` + `Y` or `Ctrl` + `Shift` + `Z` | Redo |
| `Ctrl` + `C` / `X` / `V` | Copy / cut / paste the selection |
| `Ctrl` + drag | Drag out a copy of a part (or of the whole selection) |
| `Shift` / `Ctrl` + click | Add a part to / remove it from the selection |
| `Ctrl` + `A` | Select everything |
| `←` `↑` `→` `↓` | Move the selection by one grid step |
| `Ctrl` + `+` / `-` / `0` | Zoom in / out / reset |
| `Space` | Fit the circuit to the view |
| `Alt` + click | Select the part underneath (e.g. a highlight under a wire) |
| `Esc` | Cancel the current placement, then go back to the Select tool |

## Using the generated code

With *Full standalone document* selected, the output compiles as is:

```bash
pdflatex circuit.tex
```

To put the circuit inside your own document, choose *circuitikz environment only*. Then add this to your preamble:

```latex
\usepackage[american]{circuitikz}   % or [european]
```

and paste the code where you want the figure, for example inside a `figure` environment.

## Notes and limitations

- **Image exports:** PDF/SVG/PNG/JPG exports are drawn from the on-screen preview. Fonts and label spacing are close to, but not the same as, the LaTeX output. For exact typesetting, compile the `.tex`.
- **Wire following:** only wires that end exactly on a terminal follow a moved part. A wire that a terminal merely sits on part-way along (a T-junction) stays where it is.
- **Transformer:** its terminals are fixed at 1 cm × 3 cm on the grid, so it can be rotated but not resized.
- **Older saved circuits:** PID blocks are converted to plain blocks, and VCC/VEE nodes (no longer available) are dropped when the page loads.
- **Editing the code:** the editor reads back the code it writes (circuitikz paths, the custom `pic`s, arrows, signals, blocks, highlights, nodes and labels). Statements it doesn't recognise are listed under the code and skipped. A part's label nodes are tied to the part by position, so if you move a part's main line but not its label, the label stays where it is as a free text label. Terminal dots (`*-o`, …) come back as separate junction dots / open terminals, which look the same.

## Project structure

```
index.html   page layout (component palette, canvas, properties, settings, output panels)
style.css    styling
app.js       editor logic, component shapes, LaTeX generator, file exports
```
