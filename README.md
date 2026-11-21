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
- **Grid size:** 1 cm, 0.5 cm or 0.25 cm. One grid step equals the same distance in the generated LaTeX.
- **Alignment assist:** dashed guides appear when a terminal lines up with another one. A green ring shows when you land exactly on an existing terminal. Points snap to nearby terminals.
- **Wires follow moved parts:** when you move or rotate a component, wires attached to its terminals stay connected. They are re-routed with right-angle bends that avoid running along other wires.
- **Editing:** select, drag to move, drag the end handles to stretch, rotate 90°, reverse direction, mirror, delete and undo.
- **Zoom:** buttons, `Ctrl` + mouse wheel or trackpad pinch, keyboard shortcuts, and *Fit* to show the whole circuit.

### Components
| Group | Components |
|---|---|
| Power electronics | MOSFET with anti-parallel diode, bidirectional switch (back-to-back MOSFETs), transformer (n:1, with dot markings), voltage arrow |
| Passive | Resistor, variable resistor, capacitor, inductor, fuse |
| Sources | DC voltage source, current source, AC source, battery, dependent voltage and current sources |
| Semiconductors | Diode, Zener diode, LED |
| Switches & meters | Open and closed switch, lamp, ammeter, voltmeter |
| Nodes & labels | Ground, junction dot, open terminal, VCC, VEE, text label, open voltage branch |

The power-electronics parts, inductor, capacitor and AC source use shapes copied exactly from a reference drawing. They are output as TikZ `pic`s, defined at the top of the generated code, so the pasted code needs no extra packages. Everything else uses standard CircuiTikZ components.

### Per-component options
- Label, value, current and voltage annotations. Math mode is added automatically, so `R_1` becomes `$R_1$`.
- Which side the label goes on, terminal markers (`*-*`, `o-o`, …), colour, size (0.5× to 2.5×) and rotation.

### Output
- **LaTeX code** that updates live, with *Copy* and *Download .tex* buttons. You can choose:
  - a full `standalone` document or just the `circuitikz` environment
  - American or European symbol style
  - overall scale
  - line width (0.4 to 1.2 pt)
- **Diagram download** as a vector **PDF**, **SVG**, **PNG** (transparent background) or **JPG**, at 150, 300 or 600 dpi. Exports are true to size, with 1 grid step = 1 cm.
- **Templates:** voltage divider, RC low-pass filter, series RLC circuit, and an AC–DC dual active bridge.
- **Auto-save:** your circuit and settings are kept in the browser's local storage.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `S` | Select tool |
| `W` | Wire |
| `R` / `C` / `L` | Resistor / capacitor / inductor |
| `V` / `I` | Voltage / current source |
| `D` | Diode |
| `M` / `B` | MOSFET + diode / bidirectional switch |
| `X` | Transformer |
| `A` | Voltage arrow |
| `G` / `N` / `T` | Ground / junction dot / text label |
| `Shift` + `R` | Rotate selected part 90° |
| `[` / `]` | Shrink / grow selected part |
| `Delete` / `Backspace` | Delete selected part |
| `Ctrl` + `Z` | Undo |
| `Ctrl` + `+` / `-` / `0` | Zoom in / out / reset |
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

## Project structure

```
index.html   page layout (component palette, canvas, properties, settings, output panels)
style.css    styling
app.js       editor logic, component shapes, LaTeX generator, file exports
```
