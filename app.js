'use strict';

const GRID = 40;
const SVGNS = 'http://www.w3.org/2000/svg';
const STORAGE_KEY = 'circuitikz-builder-v1';
// Figure units (from the reference Inkscape drawing): 20 u = 1 grid step = 1 cm.
const U_CM = 0.05;
const PX = GRID * U_CM;

// tex values are xcolor names that work without extra packages.
const COLORS = {
  black:  { name: 'Black',  css: '#222',               tex: '' },
  red:    { name: 'Red',    css: 'rgb(220,0,0)',       tex: 'red' },
  blue:   { name: 'Blue',   css: 'rgb(0,70,200)',      tex: 'blue' },
  green:  { name: 'Green',  css: 'rgb(0,128,0)',       tex: 'green!50!black' },
  orange: { name: 'Orange', css: 'rgb(240,128,0)',     tex: 'orange' },
  purple: { name: 'Purple', css: 'rgb(128,0,128)',     tex: 'violet' },
  teal:   { name: 'Teal',   css: 'rgb(0,128,128)',     tex: 'teal' },
  gray:   { name: 'Gray',   css: 'rgb(128,128,128)',   tex: 'gray' },
  brown:  { name: 'Brown',  css: 'rgb(191,128,64)',    tex: 'brown' },
};
function colorKey(el) {
  return COLORS[el.color] ? el.color : 'black';
}
const colorTex = (el) => COLORS[colorKey(el)].tex;

const SIZE_MIN = 0.5, SIZE_MAX = 2.5;
const elSize = (el) => el.size || 1;
// The transformer's terminals are tied to the grid, so only its position/rotation can change.
const canResize = (el) => !TYPES[el.type].xfmr && !TYPES[el.type].block && !TYPES[el.type].highlight
  && el.type !== 'wire' && el.type !== 'open';
// circuitikz's default bipole length, scaled per element via circuitikz/bipoles/length.
const CTZ_BIPOLE_CM = 1.4;

// tikz = circuitikz bipole / node name; pic = exact figure shape emitted as a TikZ pic
const TYPES = {
  wire:      { name: 'Wire',                tikz: 'short', key: 'w' },
  R:         { name: 'Resistor',            tikz: 'R',  prefix: 'R', key: 'r' },
  vR:        { name: 'Variable resistor',   tikz: 'vR', prefix: 'R' },
  C:         { name: 'Capacitor',           pic: 'fig-capacitor', prefix: 'C', key: 'c' },
  L:         { name: 'Inductor',            pic: 'fig-inductor',  prefix: 'L', key: 'l' },
  fuse:      { name: 'Fuse',                tikz: 'fuse', prefix: 'F' },
  V:         { name: 'Voltage source',      tikz: 'V',  prefix: 'V', key: 'v' },
  I:         { name: 'Current source',      tikz: 'I',  prefix: 'I', key: 'i' },
  sV:        { name: 'AC source',           pic: 'fig-acsource', prefix: 'V' },
  mosd:      { name: 'MOSFET + diode',      pic: 'fig-mosfet',   mirror: true, key: 'm' },
  bisw:      { name: 'Bidirectional switch', pic: 'fig-biswitch', mirror: true, key: 'b' },
  xfmr:      { name: 'Transformer',         node: true, xfmr: true, defLabel: 'n:1', key: 'x' },
  varrow:    { name: 'Arrow',               arrow: true, key: 'a' },
  cV:        { name: 'Dependent V source',  tikz: 'cV', prefix: 'V' },
  cI:        { name: 'Dependent I source',  tikz: 'cI', prefix: 'I' },
  battery:   { name: 'Battery',             tikz: 'battery1', prefix: 'B' },
  D:         { name: 'Diode',               tikz: 'D',  prefix: 'D', key: 'd' },
  zD:        { name: 'Zener diode',         tikz: 'zD', prefix: 'D' },
  leD:       { name: 'LED',                 tikz: 'leD', prefix: 'D' },
  nos:       { name: 'Switch (open)',       tikz: 'nos', prefix: 'S' },
  ncs:       { name: 'Switch (closed)',     tikz: 'ncs', prefix: 'S' },
  ammeter:   { name: 'Ammeter',             tikz: 'ammeter' },
  voltmeter: { name: 'Voltmeter',           tikz: 'voltmeter' },
  open:      { name: 'Open (voltage)',      tikz: 'open' },
  ground:    { name: 'Ground',              tikz: 'ground', node: true, key: 'g' },
  circ:      { name: 'Junction dot',        tikz: 'circ',   node: true, key: 'n' },
  ocirc:     { name: 'Open terminal',       tikz: 'ocirc',  node: true },
  text:      { name: 'Text label',          tikz: null,     node: true, key: 't', defLabel: 'Label' },
  // ---- control block diagrams (blocks are placed by their centre; size in cm)
  signal:    { name: 'Signal arrow',        signalTool: true, key: 'q' },
  blk:       { name: 'Block',               node: true, block: true, key: 'k',
               preset: { kind: 'text', w: 1.5, h: 1, fill: 'gray', shadow: true, label: 'Block' } },
  tblk:      { name: 'Transform block',     node: true, block: true,
               preset: { kind: 'transform', w: 1.25, h: 1.25, fill: 'yellow', shadow: true, label: '$dq$', label2: '$\\alpha\\beta$' } },
  piblk:     { name: 'PI block (icon)',     node: true, block: true,
               preset: { kind: 'pi', w: 1.5, h: 1.25, fill: 'blue', shadow: true, label: 'PI' } },
  mult:      { name: 'Multiplier',          node: true, block: true,
               preset: { kind: 'text', w: 0.5, h: 0.5, fill: 'white', shadow: true, label: '$\\times$' } },
  sum:       { name: 'Summing junction',    node: true, block: true, key: 'j',
               preset: { kind: 'sum', w: 0.5, h: 0.5, fill: 'white', sumStyle: 'plus', signS: '-' } },
  pwm:       { name: 'Modulator',           node: true, block: true,
               preset: { kind: 'pwm', w: 2.5, h: 3, fill: 'light', shadow: true, label: 'Modulator' } },
  inv:       { name: 'Inverter',            node: true, block: true,
               preset: { kind: 'inverter', w: 1.5, h: 2, fill: 'darkgray', shadow: true } },
  motor:     { name: 'Motor',               node: true, block: true,
               preset: { kind: 'text', shape: 'circle', w: 1, h: 1, fill: 'darkgray', shadow: true, label: 'IM' } },
  group:     { name: 'Group box',           node: true, block: true,
               preset: { kind: 'group', w: 5, h: 3, fill: 'light', dashed: true, rounded: true, label: 'Group' } },
  // Thick translucent stroke for marking current-flow paths; drawn behind everything but groups.
  hl:        { name: 'Highlighter',         highlight: true, key: 'h',
               preset: { hlColor: 'salmon', hlWidth: 5, hlStyle: 'solid', hlOpacity: 0.6 } },
};

const HL_COLORS = {
  salmon: { name: 'Salmon', rgb: [232, 120, 100] },
  red:    { name: 'Red',    rgb: [220, 40, 40] },
  orange: { name: 'Orange', rgb: [245, 150, 40] },
  yellow: { name: 'Yellow', rgb: [255, 210, 0] },
  green:  { name: 'Green',  rgb: [60, 170, 75] },
  blue:   { name: 'Blue',   rgb: [60, 130, 230] },
  purple: { name: 'Purple', rgb: [150, 80, 190] },
  gray:   { name: 'Gray',   rgb: [150, 150, 150] },
};
const HL_PX = 2.5; // preview px per pt, matching the exaggerated preview line widths
const hlRgb = (el) => (HL_COLORS[el.hlColor] || HL_COLORS.salmon).rgb;

// Block fills as exact RGB so the preview and the xcolor output match.
const FILLS = {
  none:     { name: 'None',       rgb: null },
  white:    { name: 'White',      rgb: [255, 255, 255] },
  light:    { name: 'Light gray', rgb: [236, 236, 236] },
  gray:     { name: 'Gray',       rgb: [217, 217, 217] },
  darkgray: { name: 'Dark gray',  rgb: [190, 190, 190] },
  blue:     { name: 'Blue',       rgb: [155, 200, 235] },
  lavender: { name: 'Lavender',   rgb: [204, 204, 255] },
  yellow:   { name: 'Yellow',     rgb: [255, 245, 155] },
  pink:     { name: 'Pink',       rgb: [255, 204, 204] },
  green:    { name: 'Green',      rgb: [204, 240, 204] },
};
const fillCss = (k) => (FILLS[k]?.rgb ? `rgb(${FILLS[k].rgb.join(',')})` : 'none');
const fillTex = (k) => {
  const c = FILLS[k]?.rgb;
  return c ? `{rgb,255:red,${c[0]};green,${c[1]};blue,${c[2]}}` : '';
};
const BLOCK_KINDS = ['text', 'transform', 'pi', 'pwm', 'inverter', 'group', 'sum'];
const SUM_STYLES = { plus: 'Circle with +', cross: 'Circle with ×', plain: 'Plain circle' };
const BLOCK_SHADOW = 0.07;            // cm, offset of the drop shadow
const SIG_HEAD = { len: 0.22, half: 0.085 }; // cm, signal arrowhead
const ICON_HEAD = 0.55;               // arrowheads inside block icons, relative to SIG_HEAD

const PALETTE = [
  { title: 'Tools',            items: ['select', 'wire', 'hl', 'varrow', 'signal'] },
  { title: 'Power electronics', items: ['mosd', 'bisw', 'xfmr', 'D', 'zD', 'leD'] },
  { title: 'Passive',          items: ['R', 'vR', 'C', 'L', 'fuse'] },
  { title: 'Sources',          items: ['V', 'I', 'sV', 'battery', 'cV', 'cI'] },
  { title: 'Switches & meters', items: ['nos', 'ncs', 'ammeter', 'voltmeter'] },
  { title: 'Nodes & labels',   items: ['ground', 'circ', 'ocirc', 'text', 'open'] },
  { title: 'Control blocks',   items: ['blk', 'tblk', 'piblk', 'mult', 'sum', 'pwm', 'inv', 'motor', 'group'] },
];

const FIELDS = {
  label:   ['Label',   'l=', 'e.g. R_1'],
  label2:  ['Second label', '', 'bottom-right text'],
  value:   ['Value',   'a=', 'e.g. 10\\,\\Omega'],
  current: ['Current', 'i=', 'e.g. i_1'],
  voltage: ['Voltage', 'v=', 'e.g. v_R'],
};

const TERMINALS = ['', '*-*', 'o-o', '*-', '-*', 'o-', '-o', '*-o', 'o-*'];
// Wires/signals may also end in an arrowhead ('>' at the end, '<' at the start).
const WIRE_TERMINALS = [...TERMINALS, '->', '<-', '<->', '*->', 'o->'];

// Template helper: a signal polyline with an arrowhead at its last point.
const SIG = (pts, extra = {}) => ['wire', pts[0], pts[pts.length - 1], {
  term: '->',
  ...(pts.length > 2 ? { via: pts.slice(1, -1).map(([x, y]) => ({ x, y })) } : {}),
  ...extra,
}];

const TEMPLATES = {
  divider: [
    ['V', [2, 6], [2, 2], { label: 'V_{in}' }],
    ['R', [2, 2], [6, 2], { label: 'R_1' }],
    ['R', [6, 2], [6, 6], { label: 'R_2' }],
    ['wire', [6, 6], [2, 6]],
    ['wire', [6, 2], [9, 2], { term: '*-o' }],
    ['open', [9, 2], [9, 6], { voltage: 'V_{out}' }],
    ['wire', [9, 6], [6, 6], { term: 'o-*' }],
    ['ground', [2, 6]],
  ],
  rc: [
    ['sV', [2, 6], [2, 2], { label: 'v_{in}' }],
    ['R', [2, 2], [6, 2], { label: 'R', value: '1\\,\\mathrm{k\\Omega}' }],
    ['C', [6, 2], [6, 6], { label: 'C', value: '100\\,\\mathrm{nF}' }],
    ['wire', [6, 6], [2, 6]],
    ['wire', [6, 2], [9, 2], { term: '*-o' }],
    ['open', [9, 2], [9, 6], { voltage: 'v_{out}' }],
    ['wire', [9, 6], [6, 6], { term: 'o-*' }],
    ['ground', [2, 6]],
  ],
  rlc: [
    ['V', [2, 6], [2, 2], { label: 'V_s' }],
    ['R', [2, 2], [5, 2], { label: 'R', value: '10\\,\\Omega', current: 'i' }],
    ['L', [5, 2], [8, 2], { label: 'L', value: '1\\,\\mathrm{mH}' }],
    ['C', [8, 2], [8, 6], { label: 'C', value: '1\\,\\mu\\mathrm{F}' }],
    ['wire', [8, 6], [2, 6]],
  ],
  dab: [
    ['sV', [1, 10], [1, 1]],
    ['wire', [1, 1], [5, 1]],
    ['wire', [1, 10], [5, 10]],
    ['bisw', [3, 1.5], [3, 3.5]], ['wire', [3, 3.5], [3, 7.5]], ['bisw', [3, 7.5], [3, 9.5]],
    ['bisw', [5, 1.5], [5, 3.5]], ['wire', [5, 3.5], [5, 7.5]], ['bisw', [5, 7.5], [5, 9.5]],
    ['wire', [3, 4], [6, 4]], ['L', [6, 4], [8, 4], { label: 'L' }], ['wire', [8, 4], [9, 4]],
    ['wire', [5, 7], [9, 7]],
    ['xfmr', [9, 4], { label: 'n:1' }],
    ['varrow', [8, 5], [8, 6], { label: 'v_{\\mathrm{pri}}', color: 'green', flip: true }],
    ['varrow', [11, 5], [11, 6], { label: 'v_{\\mathrm{sec}}', color: 'green' }],
    ['wire', [10, 4], [12, 4]],
    ['wire', [10, 7], [14, 7]],
    ['mosd', [12, 1], [12, 4]], ['wire', [12, 4], [12, 7.5]], ['mosd', [12, 7.5], [12, 9.5]],
    ['mosd', [14, 1.5], [14, 3.5]], ['wire', [14, 3.5], [14, 7.5]], ['mosd', [14, 7.5], [14, 9.5]],
    ['wire', [12, 1], [18, 1], { term: '-o' }],
    ['wire', [12, 10], [18, 10], { term: '-o' }],
    ['C', [16, 10], [16, 1], { label: 'C_o' }],
    ['varrow', [17, 2], [17, 9], { color: 'black' }],
    ['text', [18, 2], { label: '$+$' }],
    ['text', [18, 9], { label: '$-$' }],
    ...[[3, 1], [3, 10], [3, 4], [5, 7], [12, 4], [14, 7], [14, 1], [16, 1], [14, 10], [16, 10]]
      .map((p) => ['circ', p]),
    ...[[[3, 1], [3, 1.5]], [[5, 1], [5, 1.5]], [[3, 9.5], [3, 10]], [[5, 9.5], [5, 10]],
      [[14, 1], [14, 1.5]], [[12, 9.5], [12, 10]], [[14, 9.5], [14, 10]]]
      .map(([a, b]) => ['wire', a, b]),
  ],
};

// Settings a template applies along with its circuit, so it opens with the intended look.
const TEMPLATE_SETTINGS = {
  dab: { lineWidth: 1, gridStep: 0.5 },
  ctrlsps: { lineWidth: 0.8, gridStep: 0.25 },
  foc: { lineWidth: 0.8, gridStep: 0.25 },
};

// SPS current-control loop of the M-DAB charger.
TEMPLATES.ctrlsps = [
  ['group', [2.875, 2.875], { w: 5.75, h: 4.25, label: 'Current Reference generation' }],
  ['group', [10.25, 2.25], { w: 5.5, h: 3, label: 'Controller $\\longrightarrow$ Linearizer' }],
  ['text', [0.35, 2], { label: '$\\bm{P^*}$' }],
  SIG([[0.75, 2], [1.75, 2]], { term: '*->' }),
  ['blk', [2.5, 2], { w: 1.5, h: 1.25, label: '$\\displaystyle\\frac{\\sqrt{2}}{V_{rms}}$' }],
  SIG([[3.25, 2], [4.75, 2]], { label: 'I^*_{pk}' }),
  ['mult', [5, 2]],
  ['text', [0.35, 4], { label: '$\\bm{v_g}$', color: 'green' }],
  SIG([[0.75, 4], [1.75, 4]], { term: '*->', color: 'green' }),
  ['blk', [2.5, 4], { w: 1.5, h: 1, label: 'PLL' }],
  SIG([[3.25, 4], [5, 4], [5, 2.25]], { label: '\\sin(\\omega t)' }),
  ['wire', [5.75, 2], [5.25, 2]],
  SIG([[5.75, 2], [6.5, 2]], { label: 'i_g^*' }),
  ['sum', [6.75, 2]],
  ['text', [6.75, 4.45], { label: '$\\bm{i_g}$', color: 'red' }],
  SIG([[6.75, 4], [6.75, 2.25]], { term: '*->', color: 'red' }),
  SIG([[7, 2], [8, 2]]),
  ['piblk', [8.75, 2]],
  SIG([[9.5, 2], [10.5, 2]], { label: '\\sin\\varphi' }),
  ['blk', [11.5, 2], { w: 2, h: 1, label: '$\\sin^{-1}(\\cdot)$' }],
  ['wire', [13, 2], [12.5, 2]],
  SIG([[13, 2], [13.5, 2]], { label: '\\varphi' }),
  ['blk', [14.5, 2], { w: 2, h: 1, label: 'Rad. to\\\\Degree' }],
  SIG([[15.5, 2], [16.5, 2]], { label: '\\varphi^\\circ' }),
  ['pwm', [17.75, 2.25], { w: 2.5, h: 3.5, label: '$d=0.5$(VPS)\\\\Modulator' }],
  SIG([[19, 2], [20, 2]]),
  ['text', [20.6, 2], { label: '$\\bm{S_{1-8}}$' }],
];

// Field-oriented control of an induction machine.
const PID = { w: 1, h: 0.5, fill: 'lavender', label: 'PID' };
TEMPLATES.foc = [
  ['text', [0.35, 1], { label: '$\\omega_\\mathrm{m}^*$' }],
  SIG([[0.75, 1], [1.5, 1]]),
  ['sum', [1.75, 1], { sumStyle: 'plain' }],
  SIG([[2, 1], [2.5, 1]]),
  ['blk', [3, 1], PID],
  SIG([[3.5, 1], [4.25, 1]], { label: 'T_\\mathrm{m}^*' }),
  ['tblk', [4.75, 1], { w: 1, h: 1, label: '$T_\\mathrm{m}$', label2: '$i_{\\mathrm{s}q}$' }],
  SIG([[5.25, 1], [6.5, 1]], { label: 'i_{\\mathrm{s}q}^*' }),
  ['sum', [6.75, 1], { sumStyle: 'plain' }],
  SIG([[7, 1], [7.75, 1]]),
  ['blk', [8.25, 1], PID],
  SIG([[8.75, 1], [9.75, 1]], { label: 'v_q^*' }),
  ['text', [3.05, 2.25], { label: '$|\\psi_\\mathrm{r}|^*$' }],
  SIG([[3.75, 2.25], [4.25, 2.25]]),
  ['tblk', [4.75, 2.25], { w: 1, h: 1, label: '$|\\psi_\\mathrm{r}|$', label2: '$i_{\\mathrm{s}d}$' }],
  SIG([[5.25, 2.25], [6, 2.25]], { label: 'i_{\\mathrm{s}d}^*' }),
  ['sum', [6.25, 2.25], { sumStyle: 'plain' }],
  SIG([[6.5, 2.25], [7.75, 2.25]]),
  ['blk', [8.25, 2.25], PID],
  SIG([[8.75, 2.25], [9.75, 2.25]], { label: 'v_d^*' }),
  ['tblk', [10.25, 1.625], { w: 1, h: 2, label: '$dq$', label2: '$\\alpha\\beta$' }],
  SIG([[10.75, 1], [11.75, 1]], { label: 'v_\\alpha^*' }),
  SIG([[10.75, 2.25], [11.75, 2.25]], { label: 'v_\\beta^*' }),
  ['tblk', [12.25, 1.625], { w: 1, h: 2, label: '$\\alpha\\beta$', label2: '$abc$' }],
  SIG([[12.75, 1], [14, 1]], { label: 'v_a^*' }),
  SIG([[12.75, 1.625], [14, 1.625]], { label: 'v_b^*' }),
  SIG([[12.75, 2.25], [14, 2.25]], { label: 'v_c^*' }),
  ['blk', [14.75, 1.625], { w: 1.5, h: 2, fill: 'pink', label: 'PWM' }],
  SIG([[15.5, 1], [16.5, 1]], { label: 's_a' }),
  SIG([[15.5, 1.625], [16.5, 1.625]], { label: 's_b' }),
  SIG([[15.5, 2.25], [16.5, 2.25]], { label: 's_c' }),
  ['inv', [17.25, 1.625]],
  ['wire', [18, 1.25], [18.75, 1.25]],
  ['wire', [18, 1.625], [18.75, 1.625]],
  ['wire', [18, 2], [18.75, 2]],
  SIG([[18.75, 2], [18.75, 5.25], [17.75, 5.25]]),
  SIG([[19, 2], [19, 6], [17.75, 6]]),
  ['text', [18.3, 5], { label: '$i_{\\mathrm{s}a}$' }],
  ['text', [18.3, 5.75], { label: '$i_{\\mathrm{s}b}$' }],
  ['tblk', [17.25, 5.5], { w: 1, h: 1.5, label: '$\\alpha\\beta$', label2: '$abc$' }],
  SIG([[16.75, 5.25], [13.75, 5.25]]),
  SIG([[16.75, 6], [13.75, 6]]),
  ['text', [14.15, 4.98], { label: '$i_{\\mathrm{s}\\alpha}$' }],
  ['text', [14.15, 5.73], { label: '$i_{\\mathrm{s}\\beta}$' }],
  ['blk', [12.75, 5.5], { w: 2, h: 1.5, fill: 'yellow', label: 'Rotor flux\\\\estimation' }],
  ['circ', [14.5, 5.25]],
  ['circ', [15.25, 6]],
  SIG([[14.5, 5.25], [14.5, 4.5], [9.75, 4.5]]),
  SIG([[15.25, 6], [15.25, 3.5], [9.75, 3.5]]),
  ['tblk', [9, 4], { w: 1.5, h: 1.5, label: '$dq$', label2: '$\\alpha\\beta$' }],
  SIG([[8.25, 3.5], [6.75, 3.5], [6.75, 1.25]], { label: 'i_{\\mathrm{s}q}' }),
  SIG([[8.25, 4.5], [6.25, 4.5], [6.25, 2.5]], { label: 'i_{\\mathrm{s}d}' }),
  SIG([[11.75, 5.5], [9, 5.5], [9, 4.75]]),
  ['text', [11.45, 5.25], { label: '$\\varphi$' }],
  ['circ', [10.25, 5.5]],
  SIG([[10.25, 5.5], [10.25, 2.625]]),
  SIG([[19.25, 2], [19.25, 7], [1.75, 7], [1.75, 1.25]]),
  ['circ', [12.75, 7]],
  SIG([[12.75, 7], [12.75, 6.25]]),
  ['text', [13.25, 6.75], { label: '$\\omega_\\mathrm{m}$' }],
  ['motor', [19, 1.625]],
];

// ---------------------------------------------------------------- state
let state = { elements: [], nextId: 1 };
const settings = {
  style: 'american', fullDoc: true, scale: 1, autoLabel: true, lineWidth: 0.8, gridStep: 1,
  alignAssist: true,
};
const LINE_WIDTHS = [0.4, 0.6, 0.8, 1, 1.2];
const LW_MIN = 0.1, LW_MAX = 5;
// Element coordinates are stored in cm; these steps are exact in binary floating point.
const GRID_STEPS = [1, 0.5, 0.25];
const history = [];
let tool = 'select';
let selectedId = null;
let pending = null;   // first click of a two-terminal element
let sigPts = null;    // points of a signal arrow being drawn
let hover = null;
let drag = null;
let fieldSnap = null;

const $ = (id) => document.getElementById(id);
const svg = $('canvas');
const layerEls = $('layer-elements');
const layerOverlay = $('layer-overlay');
const propsBody = $('props-body');
const codeEl = $('code');

const samePt = (p, q) => !!p && !!q && p.x === q.x && p.y === q.y;
const getSel = () => state.elements.find((e) => e.id === selectedId) || null;

function svgNode(tag, attrs = {}) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

// Builds a label from LaTeX-ish source; sub/superscripts become shifted, smaller tspans.
function svgText(x, y, str, anchor, cls) {
  const t = svgNode('text', { x, y, 'text-anchor': anchor, 'dominant-baseline': 'middle', class: cls });
  const OFFSET = { '-1': 0.175, 0: 0, 1: -0.35 }; // downward shift, in em of the label's font
  let cur = 0;
  for (const r of labelRuns(str)) {
    const k = r.sh ? 0.7 : 1;
    const sp = svgNode('tspan', { dy: `${fmt((OFFSET[r.sh] - cur) / k)}em`, 'data-rise': -OFFSET[r.sh] });
    if (r.sh) sp.setAttribute('font-size', '70%');
    sp.textContent = r.t;
    t.appendChild(sp);
    cur = OFFSET[r.sh];
  }
  return t;
}

// ---------------------------------------------------------------- figure geometry
// Exact shapes traced from the reference drawing, in figure units (u).
// Bipole frame: axis along +x from start to end terminal, +y is the l= side (TikZ, y up).
// MOSFET is written in the drawing's own frame: x right, y up, drain on top, arrow at origin.
const MOSFET_FIG = [
  { k: 'line', p: [[0, -11.275], [0, 0], [-1.368, 0]] },
  { k: 'fill', p: [[-1.269, -1.965], [-4.296, 0], [-1.269, 1.96]] },
  { k: 'line', p: [[0, 10.028], [0, 7.162], [-4.297, 7.162]] },
  { k: 'line', p: [[0, -7.162], [-4.297, -7.162]] },
  { k: 'line', p: [[-4.297, -9.31], [-4.297, -5.013]] },
  { k: 'line', p: [[-4.297, -2.148], [-4.297, 2.151]] },
  { k: 'line', p: [[-4.297, 5.013], [-4.297, 9.312]] },
  { k: 'line', p: [[-6.445, -7.162], [-6.445, 7.15]] },
  { k: 'line', p: [[-6.445, -7.162], [-8.901, -7.162]] },
  { k: 'ring', c: [-10.027, -7.162], r: 1.222 },
  { k: 'line', p: [[0, -7.162], [5.729, -7.162], [5.729, 7.162], [0, 7.162]] },
  { k: 'line', p: [[2.865, -2.866], [8.594, -2.866], [5.729, 1.433]], close: true },
  { k: 'line', p: [[2.865, 1.433], [8.594, 1.433]] },
  { k: 'dot', c: [0, -7.162], r: 1.63 },
  { k: 'dot', c: [0, 7.162], r: 1.63 },
];

function mapPrims(prims, f, swapRadii = false) {
  return prims.map((q) => {
    const o = { ...q };
    if (q.p) o.p = q.p.map(f);
    if (q.c) o.c = f(q.c);
    if (swapRadii && q.rx) { o.rx = q.ry; o.ry = q.rx; }
    return o;
  });
}
const shiftFig = (prims, dy) => mapPrims(prims, ([x, y]) => [x, y + dy]);
const flipFig = (prims) => mapPrims(prims, ([x, y]) => [x, -y]);
// Drawing frame (start terminal on top) -> bipole frame, centring the axis extent at cy.
const fromFig = (prims, cy) => mapPrims(prims, ([x, y]) => [-(y - cy), x], true);
const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

function picShape(prims) {
  let hw = 0, ymin = 0, ymax = 0;
  const grow = ([x, y], rx = 0, ry = rx) => {
    hw = Math.max(hw, Math.abs(x) + rx);
    ymin = Math.min(ymin, y - ry);
    ymax = Math.max(ymax, y + ry);
  };
  for (const q of prims) {
    if (q.p) q.p.forEach((pt) => grow(pt));
    if (q.c) grow(q.c, q.r ?? q.rx, q.r ?? q.ry);
  }
  return { prims, hw, ymin, ymax };
}

const PICS = {
  'fig-mosfet': picShape(fromFig(MOSFET_FIG, -0.6235)),
  'fig-biswitch': picShape(fromFig([
    ...shiftFig(MOSFET_FIG, 9.656),
    ...shiftFig(flipFig(MOSFET_FIG), -9.656),
  ], 0)),
  'fig-inductor': picShape([{ k: 'fill', p: rect(-8.6, -2.867, 17.2, 5.733) }]),
  'fig-capacitor': picShape([
    { k: 'line', p: [[-1.207, -5.733], [-1.207, 5.733]] },
    { k: 'line', p: [[1.207, -5.733], [1.207, 5.733]] },
  ]),
  'fig-acsource': picShape(fromFig([
    { k: 'ellipse', c: [0, 0], rx: 7.794, ry: 7.564 },
    { k: 'curve', p: [[-3.897, 0], [-2.728, 4.964], [-1.17, 4.964], [0, 0], [1.166, -4.963], [2.727, -4.963], [3.897, 0]] },
  ], 0)),
  // Origin = top primary terminal; terminals at (0,0), (0,-3), (1,0), (1,-3) grid steps.
  'fig-transformer': { prims: [
    { k: 'line', p: [[0, 0], [0, -60]] },
    { k: 'line', p: [[20, 0], [20, -60]] },
    { k: 'fill', p: rect(-2.867, -38.6, 5.733, 17.2) },
    { k: 'fill', p: rect(17.133, -38.6, 5.733, 17.2) },
    { k: 'line', p: [[8.853, -38.6], [8.853, -21.4]] },
    { k: 'line', p: [[11.147, -38.6], [11.147, -21.4]] },
    { k: 'dot', c: [-6.07, -22.546], r: 1.146 },
    { k: 'dot', c: [26.07, -22.546], r: 1.146 },
  ] },
};
const DOT_R = 1.63;
const RING_R = 1.222;
const ARROW_HEAD = { len: 8.613, half: 2.308, overlap: 1.575 };

const fmt = (v, d = 3) => String(+v.toFixed(d));

function primsToSvg(prims) {
  const X = (x) => fmt(x * PX), Y = (y) => fmt(-y * PX);
  const P = ([x, y]) => `${X(x)} ${Y(y)}`;
  return prims.map((q) => {
    switch (q.k) {
      case 'line':    return `<path d="M${q.p.map(P).join(' L')}${q.close ? ' Z' : ''}"/>`;
      case 'fill':    return `<path class="fill nostroke" d="M${q.p.map(P).join(' L')} Z"/>`;
      case 'curve':   return `<path d="M${P(q.p[0])} C${q.p.slice(1).map(P).join(' ')}"/>`;
      case 'ellipse': return `<ellipse cx="${X(q.c[0])}" cy="${Y(q.c[1])}" rx="${fmt(q.rx * PX)}" ry="${fmt(q.ry * PX)}"/>`;
      case 'dot':     return `<circle class="fill nostroke" cx="${X(q.c[0])}" cy="${Y(q.c[1])}" r="${fmt(q.r * PX)}"/>`;
      case 'ring':    return `<circle class="hollow" cx="${X(q.c[0])}" cy="${Y(q.c[1])}" r="${fmt(q.r * PX)}"/>`;
      default:        return '';
    }
  }).join('');
}

const cm = (v) => fmt(v * U_CM, 4);

function primsToTikz(prims) {
  const C = ([x, y]) => `(${cm(x)},${cm(y)})`;
  return prims.map((q) => {
    switch (q.k) {
      case 'line':    return `\\draw ${q.p.map(C).join(' -- ')}${q.close ? ' -- cycle' : ''};`;
      case 'fill':    return `\\fill ${q.p.map(C).join(' -- ')} -- cycle;`;
      case 'ellipse': return `\\draw ${C(q.c)} ellipse [x radius=${cm(q.rx)}, y radius=${cm(q.ry)}];`;
      case 'dot':     return `\\fill ${C(q.c)} circle (${cm(q.r)});`;
      case 'ring':    return `\\draw[fill=white] ${C(q.c)} circle (${cm(q.r)});`;
      case 'curve': {
        let s = `\\draw ${C(q.p[0])}`;
        for (let i = 1; i + 2 < q.p.length; i += 3) s += ` .. controls ${C(q.p[i])} and ${C(q.p[i + 1])} .. ${C(q.p[i + 2])}`;
        return s + ';';
      }
      default:        return '';
    }
  });
}

// ---------------------------------------------------------------- symbols
// Static markup only (never user data). Drawn along +x, centred at origin.
function bipoleSymbol(type, style) {
  const eu = style === 'european';
  const diode = '<path class="fill" d="M-10 -10 L10 0 L-10 10 Z"/>';
  const meter = (ch) => `<circle r="14"/><text class="symtext" x="0" y="5">${ch}</text>`;
  switch (type) {
    case 'R':
      return eu
        ? { hw: 24, svg: '<rect x="-24" y="-8" width="48" height="16"/>' }
        : { hw: 24, svg: '<path d="M-24 0 L-20 -8 L-12 8 L-4 -8 L4 8 L12 -8 L20 8 L24 0"/>' };
    case 'vR':
      return { hw: 24, svg: bipoleSymbol('R', style).svg + '<path d="M-16 14 L16 -14 M16 -14 l-8 1.5 M16 -14 l-1.5 8"/>' };
    case 'fuse':
      return { hw: 20, svg: '<rect x="-20" y="-7" width="40" height="14"/><path d="M-20 0 H20"/>' };
    case 'V':
      return eu
        ? { hw: 16, svg: '<circle r="16"/><path d="M-16 0 H16"/>' }
        : { hw: 16, svg: '<circle r="16"/><path d="M5 0 H13 M9 -4 V4 M-13 0 H-5"/>' };
    case 'I':
      return eu
        ? { hw: 16, svg: '<circle r="16"/><path d="M0 -16 V16"/>' }
        : { hw: 16, svg: '<circle r="16"/><path d="M-9 0 H9 M9 0 l-5 -4 M9 0 l-5 4"/>' };
    case 'cV':
      return { hw: 16, svg: '<path d="M-16 0 L0 -16 L16 0 L0 16 Z"/><path d="M3 0 H9 M6 -3 V3 M-9 0 H-3"/>' };
    case 'cI':
      return { hw: 16, svg: '<path d="M-16 0 L0 -16 L16 0 L0 16 Z"/><path d="M-8 0 H8 M8 0 l-4 -3.5 M8 0 l-4 3.5"/>' };
    case 'battery':
      return { hw: 6, svg: '<path d="M-6 -8 V8"/><path d="M6 -16 V16"/>' };
    case 'D':
      return { hw: 10, svg: diode + '<path d="M10 -10 V10"/>' };
    case 'zD':
      return { hw: 10, svg: diode + '<path d="M5 -13 L10 -10 V10 L15 13"/>' };
    case 'leD':
      return { hw: 10, svg: diode + '<path d="M10 -10 V10"/><path d="M-2 -12 L6 -20 M6 -20 l-5 1 M6 -20 l-1 5 M5 -10 L13 -18 M13 -18 l-5 1 M13 -18 l-1 5"/>' };
    case 'nos':
      return { hw: 16, svg: '<path d="M-12 -1 L14 -14"/><circle class="hollow" cx="-14" r="2.5"/><circle class="hollow" cx="14" r="2.5"/>' };
    case 'ncs':
      return { hw: 16, svg: '<path d="M-12 -1 L16 -4"/><circle class="hollow" cx="-14" r="2.5"/><circle class="hollow" cx="14" r="2.5"/>' };
    case 'ammeter':
      return { hw: 14, svg: meter('A') };
    case 'voltmeter':
      return { hw: 14, svg: meter('V') };
    case 'open':
      return { hw: 0, svg: '', open: true };
    default:
      return { hw: 0, svg: '' };
  }
}

function nodeSymbol(type) {
  switch (type) {
    case 'ground': return '<path d="M0 0 V10 M-12 10 H12 M-7 15 H7 M-3 20 H3"/>';
    case 'circ':   return `<circle class="fill nostroke" r="${DOT_R * PX}"/>`;
    case 'ocirc':  return `<circle class="hollow" r="${RING_R * PX}"/>`;
    case 'text':   return '<circle class="ghost" r="3"/>';
    default:       return '';
  }
}

function termMark(c, x, y = 0) {
  if (c === '*') return `<circle class="fill nostroke" cx="${x}" cy="${y}" r="${DOT_R * PX}"/>`;
  if (c === 'o') return `<circle class="hollow" cx="${x}" cy="${y}" r="${RING_R * PX}"/>`;
  return '';
}

// Approximate LaTeX -> styled text runs for the preview and image exports.
const PRETTY = {
  Omega: 'Ω', ohm: 'Ω', omega: 'ω', mu: 'µ', micro: 'µ', alpha: 'α', beta: 'β', pi: 'π',
  theta: 'θ', phi: 'φ', varphi: 'φ', psi: 'ψ', Psi: 'Ψ', Delta: 'Δ', tau: 'τ', kilo: 'k',
  mega: 'M', milli: 'm', nano: 'n', pico: 'p', farad: 'F', henry: 'H', volt: 'V', ampere: 'A', hertz: 'Hz',
  infty: '∞', times: '×', cdot: '·', sqrt: '√', circ: '°', ast: '*', longrightarrow: '→',
  rightarrow: '→', to: '→', sin: 'sin', cos: 'cos', arcsin: 'arcsin', tan: 'tan', ln: 'ln', exp: 'exp',
};

// Reads a {...} group (or a single character) starting at i.
function texGroup(s, i) {
  while (s[i] === ' ') i++;
  if (s[i] !== '{') return s[i] ? { body: s[i], end: i + 1 } : null;
  for (let d = 0, j = i; j < s.length; j++) {
    if (s[j] === '{') d++;
    else if (s[j] === '}' && --d === 0) return { body: s.slice(i + 1, j), end: j + 1 };
  }
  return null;
}

// \frac{a}{b} -> a/b for the preview.
function expandFrac(s) {
  let i;
  while ((i = s.indexOf('\\frac')) >= 0) {
    const a = texGroup(s, i + 5), b = a && texGroup(s, a.end);
    s = b ? s.slice(0, i) + a.body + '/' + b.body + s.slice(b.end) : s.slice(0, i) + s.slice(i + 5);
  }
  return s;
}

// Splits a label into runs with sh = -1 (subscript), 0 (normal) or 1 (superscript).
function labelRuns(s) {
  s = expandFrac(s)
    .replace(/\\([a-zA-Z]+)/g, (m, name) => (name in PRETTY ? PRETTY[name] : m))
    .replace(/\\[,;:! ]/g, ' ')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/\$/g, '');
  const runs = [];
  const push = (t, sh) => {
    if (!t) return;
    const last = runs[runs.length - 1];
    if (last && last.sh === sh) last.t += t;
    else runs.push({ t, sh });
  };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if ((c === '_' || c === '^') && i + 1 < s.length) {
      let arg;
      if (s[i + 1] === '{') {
        let depth = 0, j = i + 1;
        for (; j < s.length; j++) {
          if (s[j] === '{') depth++;
          else if (s[j] === '}' && --depth === 0) break;
        }
        arg = s.slice(i + 2, j);
        i = j + 1;
      } else {
        arg = s[i + 1];
        i += 2;
      }
      push(arg.replace(/[{}_^]/g, ''), c === '_' ? -1 : 1);
    } else {
      if (c !== '{' && c !== '}') push(c, 0);
      i++;
    }
  }
  return runs;
}

// ---------------------------------------------------------------- drawing
// Filled arrowhead (px) with its tip at `tip`, pointing away from `from`.
function arrowHeadSvg(tip, from, k = 1) {
  const dx = tip.x - from.x, dy = tip.y - from.y, d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d, L = SIG_HEAD.len * GRID * k, W = SIG_HEAD.half * GRID * k;
  const bx = tip.x - ux * L, by = tip.y - uy * L;
  return `<path class="fill nostroke" d="M${fmt(tip.x)} ${fmt(tip.y)} L${fmt(bx - uy * W)} ${fmt(by + ux * W)} `
    + `L${fmt(bx + uy * W)} ${fmt(by - ux * W)} Z"/>`;
}

// Where a wire's label goes: above the first segment, or beside it if that segment is vertical.
function wireLabelSpot(p0, p1, gap) {
  const m = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  return p0.x === p1.x ? { p: { x: m.x + gap, y: m.y }, anchor: 'start' } : { p: { x: m.x, y: m.y - gap }, anchor: 'middle' };
}

const isBlock = (el) => !!TYPES[el.type]?.block;
const isRound = (el) => el.shape === 'circle' || el.kind === 'sum';
const blockRect = (el) => ({ x0: el.a.x - el.w / 2, x1: el.a.x + el.w / 2, y0: el.a.y - el.h / 2, y1: el.a.y + el.h / 2 });
function insideBlock(el, q) {
  const r = blockRect(el), e = 1e-6;
  return q.x >= r.x0 - e && q.x <= r.x1 + e && q.y >= r.y0 - e && q.y <= r.y1 + e;
}
// Groups first, then highlights, so both sit behind the circuit.
const orderedElements = () => [
  ...state.elements.filter((e) => e.kind === 'group'),
  ...state.elements.filter((e) => e.type === 'hl'),
  ...state.elements.filter((e) => e.kind !== 'group' && e.type !== 'hl'),
];

// Icon strokes in unit box coordinates (u right, v up); `arrow` puts a head on the last point.
function blockIcon(el) {
  switch (el.kind) {
    case 'transform': return [{ p: [[0, 0], [1, 1]] }];
    case 'pi': return [
      { p: [[0.18, 0.12], [0.18, 0.9]], arrow: true },
      { p: [[0.1, 0.2], [0.92, 0.2]], arrow: true },
      { p: [[0.18, 0.45], [0.8, 0.72]] },
    ];
    case 'pwm': {
      const tri = [], sq = [];
      for (let i = 0; i <= 6; i++) tri.push([0.1 + i * 0.12, i % 2 ? 0.52 : 0.32]);
      for (let i = 0; i < 3; i++) {
        const x = 0.1 + i * 0.24;
        sq.push([x, 0.08], [x, 0.22], [x + 0.12, 0.22], [x + 0.12, 0.08]);
      }
      sq.push([0.82, 0.08]);
      return [{ p: [[0.06, 0.42], [0.94, 0.42]], arrow: true }, { p: tri },
        { p: [[0.06, 0.15], [0.94, 0.15]], arrow: true }, { p: sq }];
    }
    case 'sum':
      if (el.sumStyle === 'plus') return [{ p: [[0, 0.5], [1, 0.5]] }, { p: [[0.5, 0], [0.5, 1]] }];
      if (el.sumStyle === 'cross') return [{ p: [[0.146, 0.146], [0.854, 0.854]] }, { p: [[0.146, 0.854], [0.854, 0.146]] }];
      return [];
    default: return [];
  }
}
// Sign label positions around a summing junction (unit box coords + text anchors).
const SUM_SIGNS = {
  signW: { u: 0, v: 1, svg: 'end', dy: -8, tex: 'south east' },
  signN: { u: 1, v: 1, svg: 'start', dy: -8, tex: 'south west' },
  signS: { u: 1, v: 0, svg: 'start', dy: 10, tex: 'north west' },
};

function roundRectPath(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  const k = r * 0.4477; // r * (1 - 0.5523): bezier handles for a quarter circle
  return `M${x + r} ${y} H${x + w - r} C${x + w - k} ${y} ${x + w} ${y + k} ${x + w} ${y + r} `
    + `V${y + h - r} C${x + w} ${y + h - k} ${x + w - k} ${y + h} ${x + w - r} ${y + h} `
    + `H${x + r} C${x + k} ${y + h} ${x} ${y + h - k} ${x} ${y + h - r} `
    + `V${y + r} C${x} ${y + k} ${x + k} ${y} ${x + r} ${y} Z`;
}

function drawBlock(el, g, withText = true) {
  const cx = el.a.x * GRID, cy = el.a.y * GRID, w = el.w * GRID, h = el.h * GRID;
  const x0 = cx - w / 2, y0 = cy - h / 2, sh = BLOCK_SHADOW * GRID;
  const round = isRound(el);
  // A group's body ignores the mouse so the blocks drawn on top of it stay clickable.
  const style = `${el.kind === 'group' ? 'class="nohit" ' : ''}style="fill:${fillCss(el.fill)};`
    + `${el.noBorder ? 'stroke:none;' : el.dashed ? 'stroke-dasharray:6 4;' : ''}"`;
  let html = '';
  if (el.shadow) {
    html += round
      ? `<circle class="nostroke" style="fill:#9a9a9a" cx="${cx + sh}" cy="${cy + sh}" r="${w / 2}"/>`
      : `<rect class="nostroke" style="fill:#9a9a9a" x="${x0 + sh}" y="${y0 + sh}" width="${w}" height="${h}"/>`;
  }
  if (round) html += `<circle ${style} cx="${cx}" cy="${cy}" r="${w / 2}"/>`;
  else if (el.rounded) html += `<path ${style} d="${roundRectPath(x0, y0, w, h, 0.2 * GRID)}"/>`;
  else html += `<rect ${style} x="${x0}" y="${y0}" width="${w}" height="${h}"/>`;

  const U = ([u, v]) => ({ x: x0 + u * w, y: y0 + (1 - v) * h });
  for (const s of blockIcon(el)) {
    const P = s.p.map(U);
    html += `<polyline points="${P.map((q) => `${fmt(q.x)},${fmt(q.y)}`).join(' ')}"/>`;
    if (s.arrow) html += arrowHeadSvg(P[P.length - 1], P[P.length - 2], ICON_HEAD);
  }
  if (el.kind === 'inverter') {
    const pic = PICS['fig-mosfet'];
    const k = Math.min(1.6, (0.7 * h) / (2 * pic.hw * PX), (0.8 * w) / ((pic.ymax - pic.ymin) * PX));
    html += `<g transform="translate(${cx} ${cy}) rotate(90) scale(${fmt(k)})">${primsToSvg(pic.prims)}</g>`;
  }
  // Groups are only grabbed by their border so blocks inside stay clickable.
  html += el.kind === 'group'
    ? `<rect class="hit hit-edge" x="${x0}" y="${y0}" width="${w}" height="${h}"/>`
    : `<rect class="hit" x="${x0}" y="${y0}" width="${w}" height="${h}"/>`;
  g.innerHTML = html;
  if (!withText) return;

  const cls = (s) => (/^\s*\$.*\$\s*$/.test(s) ? 'lbl' : 'lbl plain');
  const lines = (el.label || '').split(/\\\\/).map((s) => s.trim()).filter(Boolean);
  const block = (yTop, anchor = 'middle', x = cx) => lines.forEach((s, i) => g.appendChild(svgText(x, yTop + i * 18, s, anchor, cls(s))));
  switch (el.kind) {
    case 'transform': {
      const p1 = U([0.3, 0.7]), p2 = U([0.7, 0.3]);
      if (el.label) g.appendChild(svgText(p1.x, p1.y, el.label, 'middle', cls(el.label)));
      if (el.label2) g.appendChild(svgText(p2.x, p2.y, el.label2, 'middle', cls(el.label2)));
      break;
    }
    case 'pi': block(y0 + h + 14); break;
    case 'pwm': block(y0 + 14); break;
    case 'group': block(y0 - 12 - (lines.length - 1) * 18); break;
    case 'sum':
      for (const [k, s] of Object.entries(SUM_SIGNS)) {
        if (!el[k]) continue;
        const p = U([s.u, s.v]);
        g.appendChild(svgText(p.x, p.y + s.dy, el[k] === '-' ? '−' : '+', s.svg, 'lbl plain'));
      }
      break;
    case 'inverter': break;
    default: block(cy - ((lines.length - 1) * 18) / 2);
  }
}
function drawElement(el, selected, ghost = false) {
  const def = TYPES[el.type];
  const g = svgNode('g', { class: 'el' + (selected ? ' selected' : '') + (ghost ? ' ghost-el' : '') });
  g.style.setProperty('--c', COLORS[colorKey(el)].css);
  if (!ghost) g.dataset.id = el.id;

  if (def.block) {
    drawBlock(el, g);
    return g;
  }

  if (def.highlight) {
    const pts = [el.a, ...(el.via || []), el.b].map((q) => `${q.x * GRID},${q.y * GRID}`).join(' ');
    const w = el.hlWidth * HL_PX;
    const dash = el.hlStyle === 'dashed' ? `stroke-dasharray:${fmt(w * 1.2)} ${fmt(w * 2)};` : '';
    g.innerHTML = `<polyline class="hit" points="${pts}"/><polyline points="${pts}" style="stroke:rgb(${hlRgb(el).join(',')});`
      + `stroke-width:${fmt(w)}px;stroke-opacity:${el.hlOpacity};stroke-linecap:round;stroke-linejoin:round;${dash}"/>`;
    return g;
  }

  if (def.xfmr) {
    const x = el.a.x * GRID, y = el.a.y * GRID;
    const rot = el.rot || 0;
    const inner = svgNode('g', { transform: `translate(${x} ${y}) rotate(${90 * rot})` });
    inner.innerHTML = `<rect class="hit" x="-16" y="-4" width="${GRID + 32}" height="${3 * GRID + 8}"/>`
      + primsToSvg(PICS['fig-transformer'].prims);
    g.appendChild(inner);
    if (el.label) {
      const c = rot90({ x: 0.5 * GRID, y: 3 * GRID }, rot), d = rot90({ x: 0, y: 1 }, rot);
      const anchor = d.x > 0.5 ? 'start' : d.x < -0.5 ? 'end' : 'middle';
      g.appendChild(svgText(x + c.x + d.x * 8, y + c.y + d.y * 14, el.label, anchor, 'lbl'));
    }
    return g;
  }

  if (def.node) {
    const x = el.a.x * GRID, y = el.a.y * GRID;
    const k = elSize(el);
    const inner = svgNode('g', { transform: `translate(${x} ${y}) rotate(${90 * (el.rot || 0)}) scale(${k})` });
    inner.innerHTML = '<circle class="hit" r="14"/>' + nodeSymbol(el.type);
    g.appendChild(inner);
    const pos = { circ: [0, -14, 'middle'], ocirc: [0, -14, 'middle'], text: [0, 0, 'middle'] }[el.type];
    if (pos && el.label) {
      const t = svgText(x + pos[0] * k, y + pos[1] * k, el.label, pos[2], el.type === 'text' ? 'lbl plain' : 'lbl');
      if (el.type === 'text' && k !== 1) t.style.fontSize = `${15 * k}px`;
      g.appendChild(t);
    }
    return g;
  }

  const ax = el.a.x * GRID, ay = el.a.y * GRID, bx = el.b.x * GRID, by = el.b.y * GRID;
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const h = len / 2;
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const inner = svgNode('g', { transform: `translate(${mx} ${my}) rotate(${Math.atan2(dy, dx) * 180 / Math.PI})` });
  g.appendChild(inner);
  // Unit normal pointing to the "left" of the drawing direction (where circuitikz puts l=).
  const nx = dy / len, ny = -dx / len;
  const anchorFor = (vx) => (vx > 0.5 ? 'start' : vx < -0.5 ? 'end' : 'middle');
  const pad = Math.abs(ny) > 0.5 ? 9 : 4;
  const sg = el.flip ? -1 : 1;

  if (def.arrow) {
    const k = elSize(el);
    const { fill, stem, heads } = arrowParts(el, [-h, 0], [h, 0], PX * k);
    const xy = (pts) => pts.map((q) => q.map((v) => fmt(v)).join(',')).join(' ');
    inner.innerHTML = `<line class="hit" x1="${-h}" y1="0" x2="${h}" y2="0"/><polyline points="${xy(stem)}"/>`
      + heads.map((pts) => (fill
        ? `<polygon class="fill nostroke" points="${xy(pts)}"/>`
        : `<polyline points="${xy(pts)}"/>`)).join('');
    if (el.label) {
      const off = (ARROW_HEAD.half * k + 3) * PX + pad;
      g.appendChild(svgText(mx + sg * nx * off, my + sg * ny * off, el.label, anchorFor(sg * nx), 'lbl'));
    }
    return g;
  }

  const pic = def.pic && PICS[def.pic];

  if (el.type === 'wire') {
    // Wires/signals are drawn untransformed as a polyline through their bend points.
    inner.removeAttribute('transform');
    const P = [el.a, ...(el.via || []), el.b].map((q) => ({ x: q.x * GRID, y: q.y * GRID }));
    const pts = P.map((q) => `${q.x},${q.y}`).join(' ');
    const [ts, te] = (el.term || '-').split('-');
    inner.innerHTML = `<polyline class="hit" points="${pts}"/><polyline points="${pts}"/>`
      + termMark(ts, ax, ay) + termMark(te, bx, by)
      + (te === '>' ? arrowHeadSvg(P[P.length - 1], P[P.length - 2]) : '')
      + (ts === '<' ? arrowHeadSvg(P[0], P[1]) : '');
    const text = [el.label, el.current].filter((s) => s?.trim()).join('  ');
    if (text) {
      const { p, anchor } = wireLabelSpot(P[0], P[1], 6);
      g.appendChild(svgText(p.x, p.y + (anchor === 'start' ? 0 : -8), text, anchor, 'lbl'));
    }
    return g;
  }

  const sym = pic ? { hw: pic.hw * PX, svg: primsToSvg(pic.prims) } : bipoleSymbol(el.type, settings.style);
  const s = sym.hw > 0 ? Math.min(elSize(el), h / sym.hw) : 1;
  const hw = sym.hw * s;

  let html = `<line class="hit" x1="${-h}" y1="0" x2="${h}" y2="0"/>`;
  if (sym.open) html += `<line class="ghost" x1="${-h}" y1="0" x2="${h}" y2="0"/>`;
  else if (hw > 0) html += `<line x1="${-h}" y1="0" x2="${-hw}" y2="0"/><line x1="${hw}" y1="0" x2="${h}" y2="0"/>`;
  else html += `<line x1="${-h}" y1="0" x2="${h}" y2="0"/>`;
  if (sym.svg) html += `<g transform="scale(${s} ${pic && el.mirror ? -s : s})">${sym.svg}</g>`;
  const [ts, te] = (el.term || '-').split('-');
  html += termMark(ts, -h) + termMark(te, h);
  inner.innerHTML = html;

  let offPos, offNeg;
  if (pic) {
    offPos = ((el.mirror ? -pic.ymin : pic.ymax) + 3) * PX * s + pad;
    offNeg = ((el.mirror ? pic.ymax : -pic.ymin) + 3) * PX * s + pad;
  } else {
    offPos = offNeg = sym.hw > 0 ? 26 : 14;
  }
  const lOff = sg > 0 ? offPos : offNeg;
  if (el.label) g.appendChild(svgText(mx + sg * nx * lOff, my + sg * ny * lOff, el.label, anchorFor(sg * nx), 'lbl'));
  let below = sg > 0 ? offNeg : offPos;
  if (el.value) {
    g.appendChild(svgText(mx - sg * nx * below, my - sg * ny * below, el.value, anchorFor(-sg * nx), 'lbl'));
    below += 18;
  }
  if (el.voltage) {
    // An open branch has no symbol, so keep its voltage beside it rather than across the gap.
    const k = sym.open ? -1 : 1;
    g.appendChild(svgText(mx - k * nx * below, my - k * ny * below, 'v: ' + el.voltage, anchorFor(-k * nx), 'lbl'));
  }
  if (el.current) {
    const t = hw > 0 ? 0.5 + (hw + (h - hw) / 2) / len : 0.5;
    const arrow = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? '→' : '←') : (dy > 0 ? '↓' : '↑');
    g.appendChild(svgText(ax + dx * t + nx * 14, ay + dy * t + ny * 14, `${arrow} ${el.current}`, anchorFor(nx), 'lbl'));
  }
  return g;
}

function renderCanvas() {
  layerEls.replaceChildren(...orderedElements().map((el) => drawElement(el, el.id === selectedId)));
  renderOverlay();
}

function renderOverlay() {
  const items = [];
  const sel = getSel();
  if (settings.alignAssist) items.push(...alignGuides());
  if (sigPts) {
    const pts = [...sigPts];
    const last = pts[pts.length - 1];
    if (hover && !samePt(hover, last)) {
      if (hover.x !== last.x && hover.y !== last.y) pts.push({ x: hover.x, y: last.y });
      pts.push(hover);
    }
    const P = pts.map((q) => ({ x: q.x * GRID, y: q.y * GRID }));
    let ghostSig;
    if (TYPES[tool]?.highlight && pts.length > 1) {
      ghostSig = drawElement({
        type: 'hl', a: pts[0], b: pts[pts.length - 1], via: pts.slice(1, -1), ...clone(TYPES.hl.preset),
      }, false, true);
    } else {
      ghostSig = svgNode('g', { class: 'el ghost-el' });
      ghostSig.innerHTML = `<polyline points="${P.map((q) => `${q.x},${q.y}`).join(' ')}"/>`
        + (P.length > 1 ? arrowHeadSvg(P[P.length - 1], P[P.length - 2]) : '');
    }
    items.push(ghostSig, svgNode('circle', { class: 'pending-dot', cx: P[0].x, cy: P[0].y, r: 5 }));
  }
  if (pending && hover && TYPES[tool] && !samePt(pending, hover)) {
    items.push(drawElement({ type: tool, a: pending, b: hover }, false, true));
  }
  if (pending) items.push(svgNode('circle', { class: 'pending-dot', cx: pending.x * GRID, cy: pending.y * GRID, r: 5 }));
  if (hover) items.push(svgNode('circle', { class: 'cursor-dot', cx: hover.x * GRID, cy: hover.y * GRID, r: 7 }));
  if (sel && tool === 'select' && sel.b) {
    for (const k of ['a', 'b']) {
      const c = svgNode('circle', { class: 'handle', cx: sel[k].x * GRID, cy: sel[k].y * GRID, r: 6 });
      c.dataset.handle = k;
      items.push(c);
    }
  }
  layerOverlay.replaceChildren(...items);
}

// ---------------------------------------------------------------- LaTeX output
function math(s) {
  s = s.trim();
  return s.includes('$') ? s : `$${s}$`;
}
// pgfkeys splits on top-level commas / equals signs, so brace those values.
const kv = (s) => (/[,=]/.test(s) ? `{${s}}` : s);

function segSpec(el) {
  const opts = [TYPES[el.type].tikz];
  const l = el.flip ? 'l_' : 'l', a = el.flip ? 'a^' : 'a';
  // Wire labels are placed as separate nodes, not as circuitikz l= options.
  if (el.label?.trim() && el.type !== 'wire') opts.push(`${l}=` + kv(math(el.label)));
  if (el.value?.trim())   opts.push(`${a}=` + kv(math(el.value)));
  if (el.current?.trim()) opts.push('i=' + kv(math(el.current)));
  if (el.voltage?.trim()) opts.push('v=' + kv(math(el.voltage)));
  if (el.type === 'wire' && opts.length === 1) return '--';
  return `to[${opts.join(', ')}]`;
}

const pt = ([x, y]) => `(${fmt(x, 4)},${fmt(y, 4)})`;

function labelNode([x, y], [nx, ny], text, color = '') {
  const anchor = nx > 0.5 ? 'west' : nx < -0.5 ? 'east' : ny > 0 ? 'south' : 'north';
  return `\\node[anchor=${anchor}${color ? `, text=${color}` : ''}] at ${pt([x, y])} {${text}};`;
}

// Direction, normal (l= side) and midpoint of a two-terminal element in TikZ coordinates.
function frame(A, B) {
  const dx = B[0] - A[0], dy = B[1] - A[1];
  const len = Math.hypot(dx, dy);
  const u = [dx / len, dy / len];
  return { len, u, n: [-u[1], u[0]], m: [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], ang: Math.atan2(dy, dx) * 180 / Math.PI };
}
const along = (p, v, k) => [p[0] + v[0] * k, p[1] + v[1] * k];

function picTex(el, A, B) {
  const def = TYPES[el.type];
  const pic = PICS[def.pic];
  const col = colorTex(el);
  const o = col ? `[${col}]` : '';
  const { len, u, n, m, ang } = frame(A, B);
  const hw = pic.hw * U_CM;
  const s = Math.min(elSize(el), len / 2 / hw);
  const lead = len / 2 - hw * s;
  const out = [];
  if (lead > 1e-4) {
    out.push(`\\draw${o} ${pt(A)} -- ${pt(along(A, u, lead))};`);
    out.push(`\\draw${o} ${pt(B)} -- ${pt(along(B, u, -lead))};`);
  }
  const opts = col ? [`color=${col}`] : [];
  if (Math.abs(ang) > 1e-6) opts.push(`rotate=${fmt(ang, 4)}`);
  if (el.mirror) opts.push('yscale=-1');
  if (Math.abs(s - 1) > 1e-9) opts.push(`scale=${fmt(s, 4)}`);
  out.push(`\\pic${opts.length ? `[${opts.join(', ')}]` : ''} at ${pt(m)} {${def.pic}};`);

  const extPos = el.mirror ? -pic.ymin : pic.ymax;
  const extNeg = el.mirror ? pic.ymax : -pic.ymin;
  const place = (side, text) => {
    const off = ((side > 0 ? extPos : extNeg) + 3) * U_CM * s;
    out.push(labelNode(along(m, n, side * off), [side * n[0], side * n[1]], text, col));
  };
  const sg = el.flip ? -1 : 1;
  if (el.label?.trim()) place(sg, math(el.label));
  if (el.value?.trim()) place(-sg, math(el.value));
  return out;
}

// Arrow end shapes in figure units: tip at the origin pointing along +x; the stem stops `back` short of the tip.
const ARROW_ENDS = (() => {
  const L = ARROW_HEAD.len, W = ARROW_HEAD.half;
  return {
    tri:     { name: 'Filled triangle', fill: true, back: L - ARROW_HEAD.overlap, pts: [[0, 0], [-L, W], [-L, -W]] },
    stealth: { name: 'Stealth', fill: true, back: 0.6 * L,
               pts: [[0, 0], [-1.15 * L, 1.35 * W], [-0.65 * L, 0], [-1.15 * L, -1.35 * W]] },
    open:    { name: 'Open', fill: false, back: 0, pts: [[-L, 1.3 * W], [0, 0], [-L, -1.3 * W]] },
  };
})();
const ARROW_SIDES = { end: 'At the end', start: 'At the start', both: 'Both ends' };

// Stem and head outlines of an arrow from A to B ([x, y] points); `unit` = length of one figure unit.
function arrowParts(el, A, B, unit) {
  const shape = ARROW_ENDS[el.arrowHead] || ARROW_ENDS.tri;
  const side = el.arrowEnds in ARROW_SIDES ? el.arrowEnds : 'end';
  const len = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
  const u = [(B[0] - A[0]) / len, (B[1] - A[1]) / len];
  const head = (tip, d) => shape.pts.map(([a, c]) =>
    [tip[0] + (a * d[0] - c * d[1]) * unit, tip[1] + (a * d[1] + c * d[0]) * unit]);
  const atEnd = side !== 'start', atStart = side !== 'end';
  const s0 = atStart ? shape.back * unit : 0, s1 = atEnd ? shape.back * unit : 0;
  return {
    fill: shape.fill,
    stem: [[A[0] + u[0] * s0, A[1] + u[1] * s0], [B[0] - u[0] * s1, B[1] - u[1] * s1]],
    heads: [atEnd && head(B, u), atStart && head(A, [-u[0], -u[1]])].filter(Boolean),
  };
}

function arrowTex(el, A, B) {
  const col = colorTex(el);
  const o = col ? `[${col}]` : '';
  const { n, m } = frame(A, B);
  const k = elSize(el);
  const { fill, stem, heads } = arrowParts(el, A, B, U_CM * k);
  const out = [
    `\\draw${o} ${stem.map(pt).join(' -- ')};`,
    ...heads.map((pts) => (fill
      ? `\\fill${o} ${pts.map(pt).join(' -- ')} -- cycle;`
      : `\\draw${o} ${pts.map(pt).join(' -- ')};`)),
  ];
  if (el.label?.trim()) {
    const sg = el.flip ? -1 : 1;
    const off = (ARROW_HEAD.half * k + 3) * U_CM;
    out.push(labelNode(along(m, n, sg * off), [sg * n[0], sg * n[1]], math(el.label), col));
  }
  return out;
}

function nodeTex(el, p) {
  const label = el.label?.trim();
  const col = colorTex(el);
  const o = col ? `[${col}]` : '';
  const sc = elSize(el) !== 1 ? `scale=${fmt(elSize(el), 3)}` : '';
  const nodeOpts = (...xs) => xs.filter(Boolean).join(', ');
  switch (el.type) {
    case 'text': {
      const opts = nodeOpts(col && `text=${col}`, sc);
      return `\\node${opts ? `[${opts}]` : ''} at ${p} {${label || ''}};`;
    }
    default:
      return `\\draw${o} ${p} node[${nodeOpts(TYPES[el.type].tikz, el.rot && `rotate=${-90 * el.rot}`, sc)}] {};`;
  }
}

// Screen-clockwise quarter turns of an offset (canvas y points down).
function rot90({ x, y }, k) {
  for (let i = 0; i < ((k % 4) + 4) % 4; i++) [x, y] = [-y, x];
  return { x, y };
}
const canRotate = (el) => !!el.b || TYPES[el.type].xfmr || el.type === 'ground';

function elPoints(e) {
  if (TYPES[e.type].xfmr) {
    return [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 3 }, { x: 1, y: 3 }]
      .map((o) => rot90(o, e.rot || 0))
      .map((o) => ({ x: e.a.x + o.x, y: e.a.y + o.y }));
  }
  if (isBlock(e)) {
    // Corners, edge midpoints and centre: used for alignment, bounds and fitting.
    const r = blockRect(e);
    return [r.x0, e.a.x, r.x1].flatMap((x) => [r.y0, e.a.y, r.y1].map((y) => ({ x, y })));
  }
  return e.b ? [e.a, e.b] : [e.a];
}

function markerTex(kind, p, col = '', k = 1) {
  return kind === '*'
    ? `\\fill${col ? `[${col}]` : ''} ${pt(p)} circle (${cm(DOT_R * k)});`
    : `\\draw[${col ? `${col}, ` : ''}fill=white] ${pt(p)} circle (${cm(RING_R * k)});`;
}

// Filled arrowhead with its tip at `tip`, pointing away from `from` (TikZ coords).
function headTex(tip, from, k, o) {
  const { u, n } = frame(from, tip);
  const base = along(tip, u, -SIG_HEAD.len * k), w = SIG_HEAD.half * k;
  return `\\fill${o} ${pt(tip)} -- ${pt(along(base, n, w))} -- ${pt(along(base, n, -w))} -- cycle;`;
}

function signalTex(el, T, o) {
  const pts = [el.a, ...(el.via || []), el.b].map(T);
  const [ts, te] = (el.term || '-').split('-');
  const n = pts.length, line = pts.slice();
  // Stop the line inside the head so its round cap doesn't poke out of the tip.
  if (te === '>') line[n - 1] = along(pts[n - 1], frame(pts[n - 2], pts[n - 1]).u, -SIG_HEAD.len / 2);
  if (ts === '<') line[0] = along(pts[0], frame(pts[1], pts[0]).u, -SIG_HEAD.len / 2);
  const out = [`\\draw${o} ${line.map(pt).join(' -- ')};`];
  if (te === '>') out.push(headTex(pts[n - 1], pts[n - 2], 1, o));
  if (ts === '<') out.push(headTex(pts[0], pts[1], 1, o));
  return out;
}

function wireLabelTex(el, T, col) {
  const text = el.label?.trim();
  if (!text) return [];
  const p0 = T(el.a), p1 = T(el.via?.[0] || el.b);
  const m = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
  const vertical = Math.abs(p0[0] - p1[0]) < 1e-9;
  const at = vertical ? [m[0] + 0.05, m[1]] : [m[0], m[1] + 0.03];
  return [`\\node[anchor=${vertical ? 'west' : 'south'}${col ? `, text=${col}` : ''}] at ${pt(at)} {${math(text)}};`];
}

function blockTex(el, T, usedPics) {
  const r = blockRect(el);
  const [X0, Y0] = T({ x: r.x0, y: r.y1 }), [X1, Y1] = T({ x: r.x1, y: r.y0 });
  const W = X1 - X0, H = Y1 - Y0, C = T(el.a);
  const col = colorTex(el), round = isRound(el), s = BLOCK_SHADOW;
  const o = col ? `[${col}]` : '';
  const out = [];
  if (el.shadow) {
    out.push(round
      ? `\\fill[black!40] ${pt([C[0] + s, C[1] - s])} circle (${fmt(el.w / 2, 4)});`
      : `\\fill[black!40] ${pt([X0 + s, Y0 - s])} rectangle ${pt([X1 + s, Y1 - s])};`);
  }
  const fill = fillTex(el.fill);
  const corners = !round && el.rounded && 'rounded corners=0.2cm';
  const shape = round ? `${pt(C)} circle (${fmt(el.w / 2, 4)})` : `${pt([X0, Y0])} rectangle ${pt([X1, Y1])}`;
  if (el.noBorder) {
    if (fill) out.push(`\\fill[${[`fill=${fill}`, corners].filter(Boolean).join(', ')}] ${shape};`);
  } else {
    const opts = [col, fill && `fill=${fill}`, el.dashed && 'dashed', corners].filter(Boolean);
    out.push(`\\draw${opts.length ? `[${opts.join(', ')}]` : ''} ${shape};`);
  }

  const U = ([u, v]) => [X0 + u * W, Y0 + v * H];
  for (const sk of blockIcon(el)) {
    const P = sk.p.map(U);
    out.push(`\\draw${o} ${P.map(pt).join(' -- ')};`);
    if (sk.arrow) out.push(headTex(P[P.length - 1], P[P.length - 2], ICON_HEAD, o));
  }
  if (el.kind === 'inverter') {
    usedPics.add('fig-mosfet');
    const pic = PICS['fig-mosfet'];
    const k = Math.min(1.6, (0.7 * el.h) / (2 * pic.hw * U_CM), (0.8 * el.w) / ((pic.ymax - pic.ymin) * U_CM));
    out.push(`\\pic[${[col && `color=${col}`, 'rotate=-90', `scale=${fmt(k, 4)}`].filter(Boolean).join(', ')}] at ${pt(C)} {fig-mosfet};`);
  }

  const node = (p, text, anchor) => `\\node[${['align=center', anchor && `anchor=${anchor}`, col && `text=${col}`]
    .filter(Boolean).join(', ')}] at ${pt(p)} {${text}};`;
  const label = el.label?.trim();
  switch (el.kind) {
    case 'transform':
      if (label) out.push(node(U([0.3, 0.7]), label));
      if (el.label2?.trim()) out.push(node(U([0.7, 0.3]), el.label2.trim()));
      break;
    case 'pi': if (label) out.push(node([C[0], Y0 - 0.05], label, 'north')); break;
    case 'pwm': if (label) out.push(node([C[0], Y1 - 0.05], label, 'north')); break;
    case 'group': if (label) out.push(node([C[0], Y1 + 0.05], label, 'south')); break;
    case 'sum':
      for (const [k, sg] of Object.entries(SUM_SIGNS)) {
        if (el[k]) out.push(`\\node[anchor=${sg.tex}, inner sep=1pt${col ? `, text=${col}` : ''}] at ${pt(U([sg.u, sg.v]))} {$${el[k]}$};`);
      }
      break;
    case 'inverter': break;
    default: if (label) out.push(node(C, label));
  }
  return out;
}

function generateTex() {
  const els = state.elements;
  const body = [];
  const markers = [];
  const usedPics = new Set();
  if (els.length) {
    const pts = els.flatMap((e) => [...elPoints(e), ...(e.via || [])]);
    const minX = Math.min(...pts.map((p) => p.x));
    const maxY = Math.max(...pts.map((p) => p.y));
    // Canvas y grows downwards, TikZ y grows upwards.
    const T = (p) => [p.x - minX, maxY - p.y];
    const P = (p) => pt(T(p));
    let path = null, last = null, pathCol = '';
    const flush = () => {
      if (path) body.push(path + ';');
      path = null;
      last = null;
    };
    const push = (lines) => body.push(...lines.map((l) => '  ' + l));
    const labels = [];
    for (const el of orderedElements()) {
      const def = TYPES[el.type];
      const col = colorTex(el);
      if (def.block) {
        flush();
        push(blockTex(el, T, usedPics));
        continue;
      }
      if (def.highlight) {
        flush();
        const [r, g, b] = hlRgb(el), w = el.hlWidth;
        const opts = [`draw={rgb,255:red,${r};green,${g};blue,${b}}`, `line width=${fmt(w, 2)}pt`,
          `draw opacity=${fmt(el.hlOpacity, 2)}`, 'line cap=round', 'line join=round',
          el.hlStyle === 'dashed' && `dash pattern=on ${fmt(w * 1.2, 2)}pt off ${fmt(w * 2, 2)}pt`].filter(Boolean);
        push([`\\draw[${opts.join(', ')}] ${[el.a, ...(el.via || []), el.b].map(P).join(' -- ')};`]);
        continue;
      }
      if (def.node) {
        flush();
        const label = el.label?.trim();
        if (def.xfmr) {
          usedPics.add('fig-transformer');
          const rot = el.rot || 0;
          const opts = [...(col ? [`color=${col}`] : []), ...(rot ? [`rotate=${-90 * rot}`] : [])];
          push([`\\pic${opts.length ? `[${opts.join(', ')}]` : ''} at ${P(el.a)} {fig-transformer};`]);
          if (label) {
            const c = rot90({ x: 0.5, y: 3.05 }, rot), d = rot90({ x: 0, y: 1 }, rot);
            const anchor = d.y > 0.5 ? 'north' : d.y < -0.5 ? 'south' : d.x > 0 ? 'west' : 'east';
            push([`\\node[anchor=${anchor}${col ? `, text=${col}` : ''}] at ${P({ x: el.a.x + c.x, y: el.a.y + c.y })} {${math(label)}};`]);
          }
        } else if (el.type === 'circ' || el.type === 'ocirc') {
          markers.push(markerTex(el.type === 'circ' ? '*' : 'o', T(el.a), col, elSize(el)));
          if (label) push([`\\node[anchor=south${col ? `, text=${col}` : ''}] at ${pt(along(T(el.a), [0, 1], 0.1))} {${math(label)}};`]);
        } else {
          push([nodeTex(el, P(el.a))]);
        }
        continue;
      }
      const A = T(el.a), B = T(el.b);
      const [ts, te] = (el.term || '-').split('-');
      if (ts === '*' || ts === 'o') markers.push(markerTex(ts, A, col));
      if (te === '*' || te === 'o') markers.push(markerTex(te, B, col));
      if (el.type === 'wire') labels.push(...wireLabelTex(el, T, col));
      if (el.type === 'wire' && (ts === '<' || te === '>')) {
        flush();
        push(signalTex(el, T, col ? `[${col}]` : ''));
        continue;
      }
      if (def.pic) {
        flush();
        usedPics.add(def.pic);
        push(picTex(el, A, B));
        continue;
      }
      if (def.arrow) {
        flush();
        push(arrowTex(el, A, B));
        continue;
      }
      const via = (el.via || []).map((v) => `-- ${P(v)} `).join('');
      const seg = `${via}${segSpec(el)} ${P(el.b)}`;
      const sized = el.type !== 'wire' && elSize(el) !== 1;
      const dopts = [col, sized && `circuitikz/bipoles/length=${fmt(CTZ_BIPOLE_CM * elSize(el), 3)}cm`]
        .filter(Boolean).join(', ');
      if (path && samePt(last, el.a) && pathCol === dopts) path += `\n        ${seg}`;
      else {
        flush();
        path = `  \\draw${dopts ? `[${dopts}]` : ''} ${P(el.a)} ${seg}`;
        pathCol = dopts;
      }
      last = el.b;
    }
    flush();
    body.push(...labels.map((l) => '  ' + l));
    body.push(...markers.map((l) => '  ' + l));
  } else {
    body.push('  % Draw a circuit on the canvas to generate code');
  }

  if (usedPics.size) {
    const defs = [...usedPics].flatMap((name) => [
      `    ${name}/.pic={`,
      ...primsToTikz(PICS[name].prims).map((l) => '      ' + l),
      '    },',
    ]);
    body.unshift('  % Component shapes (1 figure unit = 0.05 cm)', '  \\tikzset{', ...defs, '  }');
  }

  const allText = els.map((e) => [e.label, e.label2, e.value, e.current, e.voltage].join(' ')).join(' ');
  const usesSI = /\\(si|SI|qty|unit|num)\b/.test(allText);
  const extraPkgs = [
    ...(usesSI ? ['siunitx'] : []),
    ...(/\\(text|boldsymbol|dfrac|tfrac)\b/.test(allText) ? ['amsmath'] : []),
    ...(/\\bm\b/.test(allText) ? ['bm'] : []),
  ];
  const envOpts = [
    ...(settings.scale !== 1 ? [`scale=${settings.scale}`, 'transform shape'] : []),
    `line width=${settings.lineWidth}pt`,
    // Round caps close the notches where separately drawn thick lines meet at corners.
    'line cap=round',
  ];
  const env = [`\\begin{circuitikz}[${envOpts.join(', ')}]`, ...body, '\\end{circuitikz}'];

  if (!settings.fullDoc) {
    return [`% Preamble: \\usepackage[${settings.style}]{circuitikz}` + extraPkgs.map((p) => `, \\usepackage{${p}}`).join(''), ...env, ''].join('\n');
  }
  return [
    '\\documentclass[border=10pt]{standalone}',
    `\\usepackage[${settings.style}]{circuitikz}`,
    ...extraPkgs.map((p) => `\\usepackage{${p}}`),
    '\\begin{document}',
    ...env,
    '\\end{document}',
    '',
  ].join('\n');
}

function renderCode() {
  codeEl.value = generateTex();
}

// ---------------------------------------------------------------- properties panel
function fieldsFor(el) {
  const def = TYPES[el.type];
  if (def.block) {
    if (el.kind === 'transform') return ['label', 'label2'];
    return el.kind === 'sum' || el.kind === 'inverter' ? [] : ['label'];
  }
  if (def.node) return el.type === 'ground' ? [] : ['label'];
  if (def.highlight) return [];
  if (el.type === 'wire') return ['label', 'current'];
  if (el.type === 'open') return ['label', 'voltage'];
  if (def.arrow) return ['label'];
  if (def.pic) return ['label', 'value'];
  return ['label', 'value', 'current', 'voltage'];
}

function renderProps() {
  propsBody.replaceChildren();
  const el = getSel();
  if (!el) {
    const p = document.createElement('p');
    p.className = 'muted note';
    p.textContent = 'Pick the Select tool (S) and click an element to edit its labels, terminals and direction.';
    propsBody.append(p);
    return;
  }
  const def = TYPES[el.type];

  const title = document.createElement('div');
  title.className = 'props-title';
  title.textContent = def.name + ' ';
  if (def.tikz || def.pic) {
    const code = document.createElement('code');
    code.textContent = def.tikz || def.pic;
    title.append(code);
  }
  propsBody.append(title);

  const fields = fieldsFor(el);
  if (fields.length) {
    const note = document.createElement('p');
    note.className = 'muted note';
    note.textContent = def.block
      ? 'Inserted as-is; use $...$ for math and \\\\ for a new line.'
      : el.type === 'text'
        ? 'Inserted as-is; use $...$ for math.'
        : 'Math mode is added automatically unless you type $...$ yourself.';
    propsBody.append(note);
  }

  for (const key of fields) {
    const [name, opt, placeholder] = FIELDS[key];
    const label = document.createElement('label');
    const span = document.createElement('span');
    span.textContent = def.node || el.type === 'wire' ? name : `${name} (${opt})`;
    const input = document.createElement('input');
    input.type = 'text';
    input.spellcheck = false;
    input.value = el[key] || '';
    input.placeholder = el.type === 'text' || def.block ? 'any LaTeX text' : placeholder;
    input.dataset.field = key;
    input.addEventListener('focus', () => { fieldSnap = JSON.stringify(state); });
    input.addEventListener('input', () => {
      if (fieldSnap) { pushHistory(fieldSnap); fieldSnap = null; }
      el[key] = input.value;
      renderCanvas();
      renderCode();
      save();
    });
    label.append(span, input);
    propsBody.append(label);
  }

  const commit = (key, value) => {
    snapshot();
    el[key] = value;
    renderCanvas();
    renderCode();
    save();
  };
  const addSelect = (key, text, options) => {
    const label = document.createElement('label');
    const span = document.createElement('span');
    span.textContent = text;
    const select = document.createElement('select');
    for (const [value, name] of options) {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = name;
      select.append(o);
    }
    select.value = el[key] || options[0][0];
    select.addEventListener('change', () => commit(key, select.value));
    label.append(span, select);
    propsBody.append(label);
  };
  const addCheck = (key, text) => {
    const label = document.createElement('label');
    label.className = 'check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!el[key];
    input.addEventListener('change', () => commit(key, input.checked));
    label.append(input, document.createTextNode(' ' + text));
    propsBody.append(label);
  };

  const addNum = (key, text, min, max, step, after) => {
    const label = document.createElement('label');
    const span = document.createElement('span');
    span.textContent = text;
    const input = document.createElement('input');
    Object.assign(input, { type: 'number', min, max, step, value: el[key] });
    input.addEventListener('focus', () => { fieldSnap = JSON.stringify(state); });
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      if (!Number.isFinite(v) || v < min || v > max) return;
      if (fieldSnap) { pushHistory(fieldSnap); fieldSnap = null; }
      el[key] = v;
      after?.();
      renderCanvas();
      renderCode();
      save();
    });
    label.append(span, input);
    propsBody.append(label);
  };

  if (def.highlight) {
    addSelect('hlColor', 'Colour', Object.entries(HL_COLORS).map(([k, c]) => [k, c.name]));
    addNum('hlWidth', 'Width (pt)', 0.5, 40, 0.5);
    addSelect('hlStyle', 'Style', [['solid', 'Solid'], ['dashed', 'Dashed']]);
    addNum('hlOpacity', 'Opacity (0–1)', 0.05, 1, 0.05);
  } else {
    const colorOptions = Object.entries(COLORS).map(([k, c]) => [k, c.name]);
    const defName = COLORS[colorKey({ type: el.type })].name;
    addSelect('color', 'Colour', [['', `Default (${defName})`], ...colorOptions]);
  }
  if (def.arrow) {
    addSelect('arrowHead', 'Arrow end', Object.entries(ARROW_ENDS).map(([k, s]) => [k, s.name]));
    addSelect('arrowEnds', 'Arrowhead at', Object.entries(ARROW_SIDES));
  }
  if (!def.node && !def.arrow && !def.highlight) {
    const terms = el.type === 'wire' ? WIRE_TERMINALS : TERMINALS;
    addSelect('term', el.type === 'wire' ? 'Ends' : 'Terminals', terms.map((t) => [t, t || 'none']));
  }
  if (def.block) {
    const syncRound = () => { if (isRound(el)) el.h = el.w; };
    addNum('w', isRound(el) ? 'Diameter (cm)' : 'Width (cm)', 0.25, 40, 0.25, syncRound);
    if (!isRound(el)) addNum('h', 'Height (cm)', 0.25, 40, 0.25);
    addSelect('fill', 'Fill', Object.entries(FILLS).map(([k, f]) => [k, f.name]));
    if (el.kind === 'sum') {
      addSelect('sumStyle', 'Style', Object.entries(SUM_STYLES));
      const signs = [['', 'none'], ['+', '+'], ['-', '−']];
      addSelect('signW', 'Sign (left)', signs);
      addSelect('signN', 'Sign (top)', signs);
      addSelect('signS', 'Sign (bottom)', signs);
    }
    addCheck('shadow', 'Drop shadow');
    addCheck('noBorder', 'No border');
    addCheck('dashed', 'Dashed border');
    if (!isRound(el)) addCheck('rounded', 'Rounded corners');
  }
  if (!def.node && !def.highlight && el.type !== 'wire') addCheck('flip', 'Label on the other side');
  if (def.mirror) addCheck('mirror', 'Mirror (gate on the other side)');
  if (canResize(el)) {
    const label = document.createElement('label');
    const span = document.createElement('span');
    span.textContent = 'Size';
    const range = document.createElement('input');
    range.type = 'range';
    range.min = SIZE_MIN;
    range.max = SIZE_MAX;
    range.step = 0.1;
    range.value = elSize(el);
    range.dataset.field = 'size';
    const out = document.createElement('button');
    out.className = 'size-out';
    out.title = 'Reset to 1×';
    out.textContent = `${elSize(el).toFixed(1)}×`;
    range.addEventListener('pointerdown', () => { fieldSnap = JSON.stringify(state); });
    range.addEventListener('focus', () => { fieldSnap = JSON.stringify(state); });
    range.addEventListener('input', () => {
      if (fieldSnap) { pushHistory(fieldSnap); fieldSnap = null; }
      setSize(el, Number(range.value));
      out.textContent = `${elSize(el).toFixed(1)}×`;
    });
    out.addEventListener('click', () => {
      snapshot();
      setSize(el, 1);
      range.value = 1;
      out.textContent = '1.0×';
    });
    label.append(span, range, out);
    propsBody.append(label);
  }

  const row = document.createElement('div');
  row.className = 'row';
  if (canRotate(el)) {
    const rot = document.createElement('button');
    rot.textContent = 'Rotate 90°';
    rot.title = 'Rotate clockwise (Shift+R)';
    rot.addEventListener('click', rotateSelected);
    row.append(rot);
  }
  if (!def.node) {
    const rev = document.createElement('button');
    rev.textContent = 'Reverse direction';
    rev.addEventListener('click', () => {
      snapshot();
      [el.a, el.b] = [el.b, el.a];
      if (el.via) el.via.reverse();
      refresh();
    });
    row.append(rev);
  }
  const del = document.createElement('button');
  del.className = 'danger';
  del.textContent = 'Delete';
  del.addEventListener('click', deleteSelected);
  row.append(del);
  propsBody.append(row);
}

// ---------------------------------------------------------------- editing
function setSize(el, v) {
  v = Math.min(SIZE_MAX, Math.max(SIZE_MIN, Math.round(v * 10) / 10));
  if (v === 1) delete el.size;
  else el.size = v;
  renderCanvas();
  renderCode();
  save();
}

function resizeSelected(delta) {
  const el = getSel();
  if (!el || !canResize(el)) return;
  snapshot();
  setSize(el, elSize(el) + delta);
  renderProps();
}
function pushHistory(snap) {
  history.push(snap);
  if (history.length > 100) history.shift();
}
const snapshot = () => pushHistory(JSON.stringify(state));

function undo() {
  if (!history.length) return;
  state = JSON.parse(history.pop());
  if (!getSel()) selectedId = null;
  pending = null;
  refresh();
}

function refresh() {
  renderCanvas();
  renderCode();
  renderProps();
  save();
}

function nextLabel(prefix) {
  const re = new RegExp(`^${prefix}_\\{?(\\d+)\\}?$`);
  let max = 0;
  for (const e of state.elements) {
    const m = re.exec(e.label || '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  const n = max + 1;
  return n < 10 ? `${prefix}_${n}` : `${prefix}_{${n}}`;
}

function addElement(partial) {
  snapshot();
  const def = TYPES[partial.type];
  const el = {
    id: state.nextId++, label: '', value: '', current: '', voltage: '', term: '',
    ...(def.preset ? clone(def.preset) : {}), ...partial,
  };
  if (!el.label && def.defLabel) el.label = def.defLabel;
  if (!el.label && def.prefix && settings.autoLabel) el.label = nextLabel(def.prefix);
  state.elements.push(el);
  if (el.type !== 'wire') selectedId = el.id;
  refresh();
  if (el.type === 'text') {
    const input = propsBody.querySelector('input[data-field="label"]');
    if (input) { input.focus(); input.select(); }
  }
}

// ---------------------------------------------------------------- wire following
// Orientation of segment p-q: horizontal, vertical or diagonal.
const orient = (p, q) => (p.y === q.y && p.x !== q.x ? 'h' : p.x === q.x && p.y !== q.y ? 'v' : 'd');

// Segments and terminal points of every element except `skipId`, for collision checks.
function obstacles(skipId) {
  const segs = [], pts = [];
  for (const e of state.elements) {
    if (e.id === skipId) continue;
    pts.push(...elPoints(e));
    if (!e.b) continue;
    const L = [e.a, ...(e.via || []), e.b];
    for (let i = 0; i < L.length - 1; i++) segs.push([L[i], L[i + 1]]);
  }
  return { segs, pts };
}

// True if an orthogonal path runs along another segment or through another terminal.
function blocked(path, obs) {
  for (let i = 0; i < path.length - 1; i++) {
    const p = path[i], q = path[i + 1];
    const [k, o] = p.x === q.x ? ['x', 'y'] : ['y', 'x'];
    const lo = Math.min(p[o], q[o]), hi = Math.max(p[o], q[o]);
    for (const [s, t] of obs.segs) {
      if (s[k] !== p[k] || t[k] !== p[k]) continue;
      if (Math.min(hi, Math.max(s[o], t[o])) - Math.max(lo, Math.min(s[o], t[o])) > 1e-9) return true;
    }
    if (obs.pts.some((r) => r[k] === p[k] && r[o] > lo + 1e-9 && r[o] < hi - 1e-9)) return true;
  }
  return false;
}

// Bend points from fixed end F to moved end M so each end keeps leaving in its original direction.
function route(F, M, oF, oM, obs) {
  if (F.x === M.x || F.y === M.y || oF === 'd' || oM === 'd') return [];
  if (oF !== oM) return oF === 'h' ? [{ x: M.x, y: F.y }] : [{ x: F.x, y: M.y }];
  // Z-route: try bend lines nearest the midpoint first, then fall back to an L at either end.
  const k = oF === 'h' ? 'x' : 'y';
  const make = (v) => (k === 'x' ? [{ x: v, y: F.y }, { x: v, y: M.y }] : [{ x: F.x, y: v }, { x: M.x, y: v }]);
  const step = settings.gridStep;
  const lo = Math.min(F[k], M[k]), hi = Math.max(F[k], M[k]), mid = (lo + hi) / 2;
  const interior = [];
  for (let v = Math.floor(lo / step) * step + step; v < hi - 1e-9; v += step) if (v > lo + 1e-9) interior.push(v);
  interior.sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid) || Math.abs(p - M[k]) - Math.abs(q - M[k]));
  for (const v of [...interior, F[k], M[k]]) {
    if (!blocked(simplify([F, ...make(v), M]), obs)) return make(v);
  }
  return make(interior[0] ?? F[k]);
}

// Drops repeated and collinear points.
function simplify(pts) {
  const out = [];
  for (const p of pts) {
    if (out.length && samePt(out[out.length - 1], p)) continue;
    if (out.length >= 2) {
      const a = out[out.length - 2], b = out[out.length - 1];
      if ((a.x === b.x && b.x === p.x) || (a.y === b.y && b.y === p.y)) out.pop();
    }
    out.push(p);
  }
  return out;
}

const clone = (v) => JSON.parse(JSON.stringify(v));

// Wires whose ends sit on any of `pts` (terminals of the part about to move).
function attachedWires(el, pts) {
  // Blocks have no fixed terminals: any wire end on or inside the block counts.
  const touches = isBlock(el) ? (q) => insideBlock(el, q) : (q) => pts.some((p) => samePt(p, q));
  const list = [];
  for (const w of state.elements) {
    if (w.type !== 'wire' || w.id === el.id) continue;
    const ends = ['a', 'b'].filter((k) => touches(w[k]));
    if (ends.length) list.push({ w, ends, orig: clone({ a: w.a, b: w.b, via: w.via }) });
  }
  return list;
}

function rerouteWire(w, o, ends, map) {
  const L = [o.a, ...(o.via || []), o.b];
  let path;
  if (ends.length === 2) {
    path = L.map(map);
  } else {
    const atA = ends[0] === 'a';
    const F = atA ? o.b : o.a, M = map(atA ? o.a : o.b);
    const first = orient(L[0], L[1]), lastSeg = orient(L[L.length - 2], L[L.length - 1]);
    path = simplify([F, ...route(F, M, atA ? lastSeg : first, atA ? first : lastSeg, obstacles(w.id)), M]);
    if (atA) path.reverse();
  }
  w.a = path[0];
  w.b = path[path.length - 1];
  if (path.length > 2) w.via = path.slice(1, -1);
  else delete w.via;
}

const followWires = (list, map) => list.forEach((at) => rerouteWire(at.w, at.orig, at.ends, map));
const dropEmptyWires = () => {
  state.elements = state.elements.filter((e) => !(e.type === 'wire' && !e.via && samePt(e.a, e.b)));
};

function rotateSelected() {
  const el = getSel();
  if (!el || !canRotate(el)) return;
  snapshot();
  const oldPts = elPoints(el);
  const wires = attachedWires(el, oldPts);
  const onGrid = (p) => [p.x, p.y].every((v) => Math.abs(v / settings.gridStep - Math.round(v / settings.gridStep)) < 1e-9);
  if (el.b) {
    // Turn about the midpoint; fall back to the start terminal if that would leave the grid.
    const about = (c) => (q) => {
      const d = rot90({ x: q.x - c.x, y: q.y - c.y }, 1);
      return { x: c.x + d.x, y: c.y + d.y };
    };
    let t = about({ x: (el.a.x + el.b.x) / 2, y: (el.a.y + el.b.y) / 2 });
    if (!onGrid(t(el.a))) t = about(el.a);
    el.a = t(el.a);
    el.b = t(el.b);
    if (el.via) el.via = el.via.map(t);
  } else {
    const rot = el.rot || 0;
    if (TYPES[el.type].xfmr) {
      // Keep the transformer's centre fixed.
      const c = rot90({ x: 0.5, y: 1.5 }, rot), c2 = rot90({ x: 0.5, y: 1.5 }, rot + 1);
      const a = { x: el.a.x + c.x - c2.x, y: el.a.y + c.y - c2.y };
      if (onGrid(a)) el.a = a;
    }
    el.rot = (rot + 1) % 4;
  }
  // Shift back onto the canvas if the turn pushed part of it past the top/left edge.
  const pts = elPoints(el);
  const sx = Math.max(0, -Math.min(...pts.map((p) => p.x)));
  const sy = Math.max(0, -Math.min(...pts.map((p) => p.y)));
  for (const k of ['a', 'b']) if (el[k]) el[k] = { x: el[k].x + sx, y: el[k].y + sy };
  if (el.via) el.via = el.via.map((q) => ({ x: q.x + sx, y: q.y + sy }));
  const newPts = elPoints(el);
  followWires(wires, (q) => newPts[oldPts.findIndex((o) => samePt(o, q))] || q);
  dropEmptyWires();
  refresh();
}

function deleteSelected() {
  if (selectedId == null) return;
  snapshot();
  state.elements = state.elements.filter((e) => e.id !== selectedId);
  selectedId = null;
  refresh();
}

function select(id) {
  selectedId = id;
  renderCanvas();
  renderProps();
}

function loadTemplate(name) {
  const tpl = TEMPLATES[name];
  if (!tpl) return;
  snapshot();
  state.elements = [];
  state.nextId = 1;
  for (const [type, a, b, extra] of tpl) {
    const isNode = TYPES[type].node;
    state.elements.push({
      id: state.nextId++, type, label: '', value: '', current: '', voltage: '', term: '',
      ...(TYPES[type].preset ? clone(TYPES[type].preset) : {}),
      a: { x: a[0], y: a[1] },
      ...(isNode ? {} : { b: { x: b[0], y: b[1] } }),
      ...(isNode ? b : extra),
    });
  }
  selectedId = null;
  pending = null;
  const tplSettings = TEMPLATE_SETTINGS[name];
  if (tplSettings) {
    Object.assign(settings, tplSettings);
    syncLineWidthUI();
    applyLineWidth();
    $('opt-grid').value = String(settings.gridStep);
    applyGrid();
  }
  refresh();
}

// ---------------------------------------------------------------- tools & palette
const HINTS = {
  select: 'Click to select, drag to move, drag the blue handles to stretch. Shift+R rotates, [ ] resize, Del deletes.',
  node: 'Click a grid point to place.',
  bipole: 'Click the start point, then the end point. Right-click / Esc cancels.',
  wire: 'Click points to draw connected wires. Right-click / Esc to stop.',
  xfmr: 'Click the top primary terminal; terminals sit 1 cm apart horizontally and 3 cm vertically. Shift+R rotates.',
  signal: 'Click to start, click to add corners (right angles are added for you); double-click, Enter or right-click finishes with an arrow. Esc cancels.',
  highlight: 'Click along the current path (right angles are added for you); double-click, Enter or right-click finishes. Set colour, width, dashes and opacity in Properties. Alt+click selects a highlight lying under a wire.',
  block: 'Click to place the block centre. Set size, fill and labels in Properties; moving it drags connected signals along.',
};

function addSignalPoint(p) {
  if (!sigPts) {
    sigPts = [p];
  } else {
    const last = sigPts[sigPts.length - 1];
    if (samePt(p, last)) { finishSignal(); return; }
    if (p.x !== last.x && p.y !== last.y) sigPts.push({ x: p.x, y: last.y });
    sigPts.push(p);
  }
  renderOverlay();
}

function finishSignal() {
  const pts = sigPts ? simplify(sigPts) : [];
  sigPts = null;
  if (pts.length >= 2) {
    const via = pts.length > 2 ? { via: pts.slice(1, -1) } : {};
    if (TYPES[tool].highlight) addElement({ type: 'hl', a: pts[0], b: pts[pts.length - 1], ...via });
    else addElement({ type: 'wire', a: pts[0], b: pts[pts.length - 1], term: '->', ...via });
  }
  renderOverlay();
}

function setTool(t) {
  tool = t;
  pending = null;
  sigPts = null;
  document.querySelectorAll('.tool').forEach((b) => b.classList.toggle('active', b.dataset.tool === t));
  svg.classList.toggle('placing', t !== 'select');
  $('status-tool').textContent = t === 'select' ? 'Select' : TYPES[t].name;
  $('status-hint').textContent = t === 'select' ? HINTS.select : t === 'wire' ? HINTS.wire
    : TYPES[t].signalTool ? HINTS.signal : TYPES[t].highlight ? HINTS.highlight : TYPES[t].block ? HINTS.block
    : TYPES[t].xfmr ? HINTS.xfmr : TYPES[t].node ? HINTS.node : HINTS.bipole;
  renderOverlay();
}

function iconSvg(t) {
  const s = svgNode('svg', { viewBox: '-32 -22 64 44', width: 56, height: 38 });
  const g = svgNode('g', { class: 'el' });
  if (t === 'select') {
    g.innerHTML = '<path class="fill" d="M-6 -15 L-6 11 L0 5 L5 15 L9 13 L4 3 L12 3 Z"/>';
  } else if (t === 'text') {
    g.innerHTML = '<text class="symtext" x="0" y="5">Aa</text>';
  } else if (TYPES[t].xfmr) {
    g.innerHTML = `<g transform="scale(0.3) translate(-20 -60)">${primsToSvg(PICS['fig-transformer'].prims)}</g>`;
  } else if (TYPES[t].arrow) {
    g.innerHTML = '<line x1="-26" y1="0" x2="12" y2="0"/><path class="fill nostroke" d="M26 0 L9 -4.6 L9 4.6 Z"/>';
  } else if (TYPES[t].highlight) {
    g.innerHTML = '<polyline points="-26,8 -2,8 -2,-6 26,-6" style="stroke:rgb(232,120,100);stroke-width:9px;'
      + 'stroke-opacity:0.6;stroke-linecap:round;stroke-linejoin:round"/><polyline points="-26,8 -2,8 -2,-6 26,-6"/>';
  } else if (TYPES[t].signalTool) {
    g.innerHTML = '<polyline points="-26,8 -2,8 -2,-6 16,-6"/>' + arrowHeadSvg({ x: 26, y: -6 }, { x: 0, y: -6 });
  } else if (TYPES[t].block) {
    const p = TYPES[t].preset;
    const inner = svgNode('g', { transform: `scale(${fmt(Math.min(52 / (p.w * GRID), 32 / (p.h * GRID), 1.6))})` });
    drawBlock({ ...clone(p), type: t, a: { x: 0, y: 0 } }, inner, false);
    g.appendChild(inner);
  } else if (TYPES[t].pic) {
    // Switches are shown upright, as they are usually drawn.
    const pic = PICS[TYPES[t].pic];
    const upright = !!TYPES[t].mirror;
    const hw = pic.hw * PX;
    const k = Math.min(1, (upright ? 19 : 26) / hw);
    const end = (upright ? 21 : 30) / k;
    g.innerHTML = `<g transform="${upright ? 'rotate(90) ' : ''}scale(${k})">`
      + `<line x1="${-end}" y1="0" x2="${-hw}" y2="0"/><line x1="${hw}" y1="0" x2="${end}" y2="0"/>`
      + primsToSvg(pic.prims) + '</g>';
  } else if (TYPES[t].node) {
    const dy = t === 'ground' ? -10 : 0;
    g.innerHTML = `<g transform="translate(0 ${dy})">${nodeSymbol(t)}</g>`;
  } else {
    const sym = bipoleSymbol(t, settings.style);
    const wire = sym.open
      ? '<line class="ghost" x1="-28" y1="0" x2="28" y2="0"/><circle class="hollow" cx="-28" r="3"/><circle class="hollow" cx="28" r="3"/>'
      : sym.hw > 0
        ? `<line x1="-30" y1="0" x2="${-sym.hw}" y2="0"/><line x1="${sym.hw}" y1="0" x2="30" y2="0"/>`
        : '<line x1="-30" y1="0" x2="30" y2="0"/>';
    g.innerHTML = wire + sym.svg;
  }
  s.appendChild(g);
  return s;
}

function buildPalette() {
  const pal = $('palette');
  pal.replaceChildren();
  for (const group of PALETTE) {
    const h = document.createElement('h3');
    h.textContent = group.title;
    const grid = document.createElement('div');
    grid.className = 'group';
    for (const t of group.items) {
      const btn = document.createElement('button');
      btn.className = 'tool' + (t === tool ? ' active' : '');
      btn.dataset.tool = t;
      const name = t === 'select' ? 'Select' : TYPES[t].name;
      const key = t === 'select' ? 's' : TYPES[t].key;
      btn.title = key ? `${name} (${key.toUpperCase()})` : name;
      const label = document.createElement('span');
      label.textContent = name;
      btn.append(iconSvg(t), label);
      btn.addEventListener('click', () => setTool(t));
      grid.append(btn);
    }
    pal.append(h, grid);
  }
}

// ---------------------------------------------------------------- zoom
const CANVAS_W = 2400, CANVAS_H = 1600;
const ZOOM_MIN = 0.25, ZOOM_MAX = 4, ZOOM_STEP = 1.2;
const scroller = $('canvas-scroll');
let zoom = 1;

// Keeps the canvas point under `anchor` (client coords, default: view centre) fixed on screen.
function setZoom(z, anchor) {
  z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));
  const r = scroller.getBoundingClientRect();
  const ax = anchor ? anchor.clientX - r.left : scroller.clientWidth / 2;
  const ay = anchor ? anchor.clientY - r.top : scroller.clientHeight / 2;
  const ux = (scroller.scrollLeft + ax) / zoom, uy = (scroller.scrollTop + ay) / zoom;
  zoom = z;
  svg.setAttribute('width', CANVAS_W * zoom);
  svg.setAttribute('height', CANVAS_H * zoom);
  scroller.scrollLeft = ux * zoom - ax;
  scroller.scrollTop = uy * zoom - ay;
  $('zoom-level').textContent = `${Math.round(zoom * 100)}%`;
}

function zoomToFit() {
  const pts = state.elements.flatMap(elPoints);
  if (!pts.length) { setZoom(1); scroller.scrollTo(0, 0); return; }
  const x0 = Math.min(...pts.map((p) => p.x)) - 1, x1 = Math.max(...pts.map((p) => p.x)) + 1;
  const y0 = Math.min(...pts.map((p) => p.y)) - 1, y1 = Math.max(...pts.map((p) => p.y)) + 1;
  setZoom(Math.min(scroller.clientWidth / ((x1 - x0) * GRID), scroller.clientHeight / ((y1 - y0) * GRID)));
  scroller.scrollLeft = Math.max(0, x0) * GRID * zoom;
  scroller.scrollTop = Math.max(0, y0) * GRID * zoom;
}

$('zoom-in').addEventListener('click', () => setZoom(zoom * ZOOM_STEP));
$('zoom-out').addEventListener('click', () => setZoom(zoom / ZOOM_STEP));
$('zoom-level').addEventListener('click', () => setZoom(1));
$('zoom-fit').addEventListener('click', zoomToFit);

// Ctrl+wheel and trackpad pinch (reported as Ctrl+wheel) zoom around the cursor.
scroller.addEventListener('wheel', (e) => {
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  setZoom(zoom * Math.exp(-e.deltaY * 0.002), e);
}, { passive: false });

// ---------------------------------------------------------------- mouse & keyboard
// Terminal points other parts can line up with; the element being dragged is left out.
function alignAnchors() {
  const skip = new Set(drag
    ? [selectedId, ...drag.attached.map((at) => at.w.id), ...drag.carried.map((c) => c.e.id)]
    : []);
  const pts = state.elements.filter((e) => !skip.has(e.id)).flatMap(elPoints);
  if (sigPts) pts.push(...sigPts);
  if (pending) pts.push(pending);
  return pts;
}

function eventToGrid(e) {
  const r = svg.getBoundingClientRect();
  const raw = { x: (e.clientX - r.left) / (GRID * zoom), y: (e.clientY - r.top) / (GRID * zoom) };
  const step = settings.gridStep;
  const p = { x: Math.round(raw.x / step) * step, y: Math.round(raw.y / step) * step };
  // Pull towards nearby terminal coordinates, which may be off-grid after switching grid size.
  if (settings.alignAssist && drag?.mode !== 'move') {
    const tol = 8 / (GRID * zoom);
    const anchors = alignAnchors();
    for (const k of ['x', 'y']) {
      let best = tol;
      for (const q of anchors) {
        const d = Math.abs(q[k] - raw[k]);
        if (d < best) { best = d; p[k] = q[k]; }
      }
    }
  }
  return { x: Math.max(0, p.x), y: Math.max(0, p.y) };
}

function alignGuides() {
  const sel = getSel();
  let active;
  if (drag && sel) active = drag.mode === 'move' ? elPoints(sel) : [sel[drag.mode]];
  else if (hover && tool !== 'select') active = [hover];
  else return [];
  const anchors = alignAnchors();
  const out = [];
  const seen = new Set();
  for (const p of active) {
    for (const [k, o] of [['x', 'y'], ['y', 'x']]) {
      let best = null;
      for (const q of anchors) {
        if (q[k] !== p[k] || q[o] === p[o]) continue;
        if (!best || Math.abs(q[o] - p[o]) < Math.abs(best[o] - p[o])) best = q;
      }
      if (!best || seen.has(k + p[k])) continue;
      seen.add(k + p[k]);
      const lo = Math.min(best[o], p[o]) * GRID - 12, hi = Math.max(best[o], p[o]) * GRID + 12;
      const c = p[k] * GRID;
      out.push(svgNode('line', k === 'x'
        ? { class: 'guide', x1: c, y1: lo, x2: c, y2: hi }
        : { class: 'guide', x1: lo, y1: c, x2: hi, y2: c }));
      out.push(svgNode('circle', { class: 'guide-pt', cx: best.x * GRID, cy: best.y * GRID, r: 3 }));
    }
    if (anchors.some((q) => samePt(q, p))) {
      out.push(svgNode('circle', { class: 'snap-ring', cx: p.x * GRID, cy: p.y * GRID, r: 9 }));
    }
  }
  return out;
}

$('opt-align').addEventListener('change', (e) => {
  settings.alignAssist = e.target.checked;
  renderOverlay();
  save();
});

function applyGrid() {
  const s = settings.gridStep * GRID;
  const pattern = $('grid');
  pattern.setAttribute('width', s);
  pattern.setAttribute('height', s);
  const r = s < 20 ? 1.1 : 1.6;
  pattern.innerHTML = [[0, 0], [s, 0], [0, s], [s, s]]
    .map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#c3cad4"/>`).join('');
}

$('opt-grid').addEventListener('change', (e) => {
  settings.gridStep = Number(e.target.value);
  applyGrid();
  save();
});

function startDrag(mode, p) {
  const el = getSel();
  if (!el) return;
  const attached = attachedWires(el, mode === 'move' ? elPoints(el) : [el[mode]]);
  // Dragging an end of an already routed wire re-routes that wire too, keeping it orthogonal.
  if (el.type === 'wire' && mode !== 'move' && el.via) {
    attached.push({ w: el, ends: [mode], orig: clone({ a: el.a, b: el.b, via: el.via }) });
  }
  // A group box carries every non-wire element that lies fully inside it.
  const carried = mode === 'move' && el.kind === 'group'
    ? state.elements
      .filter((e) => e !== el && e.type !== 'wire' && elPoints(e).every((q) => insideBlock(el, q)))
      .map((e) => ({ e, orig: clone({ a: e.a, b: e.b, via: e.via }) }))
    : [];
  drag = {
    mode, start: p, a: { ...el.a }, b: el.b ? { ...el.b } : null, via: el.via ? clone(el.via) : null,
    attached, carried, snap: JSON.stringify(state), moved: false,
    bounds: [...elPoints(el), ...(el.via || []), ...carried.flatMap((c) => elPoints(c.e))],
  };
}

svg.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  const p = eventToGrid(e);

  if (tool === 'select') {
    const handle = e.target.closest('[data-handle]');
    if (handle && getSel()) { startDrag(handle.dataset.handle, p); return; }
    const g = e.target.closest('[data-id]');
    if (g && e.altKey) {
      // Alt+click cycles through overlapping parts, e.g. a highlight lying under a wire.
      const ids = [...new Set(document.elementsFromPoint(e.clientX, e.clientY)
        .map((n) => n.closest('[data-id]')).filter(Boolean).map((n) => Number(n.dataset.id)))];
      if (ids.length > 1) {
        const i = ids.indexOf(selectedId);
        select(ids[i < 0 ? 1 : (i + 1) % ids.length]);
        startDrag('move', p);
        return;
      }
    }
    if (g) {
      select(Number(g.dataset.id));
      startDrag('move', p);
    } else {
      select(null);
    }
    return;
  }

  if (TYPES[tool].signalTool || TYPES[tool].highlight) { addSignalPoint(p); return; }
  if (TYPES[tool].node) { addElement({ type: tool, a: p }); return; }
  if (!pending) { pending = p; renderOverlay(); return; }
  if (samePt(pending, p)) return;
  addElement({ type: tool, a: pending, b: p });
  pending = tool === 'wire' ? p : null;
  renderOverlay();
});

svg.addEventListener('mousemove', (e) => {
  const p = eventToGrid(e);
  if (!samePt(p, hover)) {
    hover = p;
    $('status-pos').textContent = `x ${p.x}, y ${p.y} cm`;
    if (!drag) renderOverlay();
  }
});

svg.addEventListener('mouseleave', () => {
  hover = null;
  $('status-pos').textContent = '';
  renderOverlay();
});

svg.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (sigPts) { finishSignal(); return; }
  pending = null;
  renderOverlay();
});

window.addEventListener('mousemove', (e) => {
  if (!drag) return;
  const el = getSel();
  if (!el) return;
  const p = eventToGrid(e);
  let na = el.a, nb = el.b, map;
  if (drag.mode === 'move') {
    const ddx = Math.max(p.x - drag.start.x, -Math.min(...drag.bounds.map((q) => q.x)));
    const ddy = Math.max(p.y - drag.start.y, -Math.min(...drag.bounds.map((q) => q.y)));
    map = (q) => ({ x: q.x + ddx, y: q.y + ddy });
    na = map(drag.a);
    if (drag.b) nb = map(drag.b);
  } else {
    const old = drag[drag.mode];
    map = (q) => (samePt(q, old) ? p : q);
    if (drag.mode === 'a') na = p;
    else nb = p;
  }
  if (samePt(na, el.a) && (!nb || samePt(nb, el.b))) return;
  if (!drag.moved) { pushHistory(drag.snap); drag.moved = true; }
  el.a = na;
  if (nb) el.b = nb;
  if (drag.mode === 'move' && drag.via) el.via = drag.via.map(map);
  for (const { e: c, orig } of drag.carried) {
    c.a = map(orig.a);
    if (orig.b) c.b = map(orig.b);
    if (orig.via) c.via = orig.via.map(map);
  }
  followWires(drag.attached, map);
  renderCanvas();
  renderCode();
});

window.addEventListener('mouseup', () => {
  if (!drag) return;
  const el = getSel();
  if (el && el.b && !el.via && samePt(el.a, el.b)) {
    // Collapsed to zero length: cancel the whole drag, including any wires that followed.
    state = JSON.parse(drag.snap);
    if (drag.moved) history.pop();
    renderCanvas();
    renderCode();
  } else if (drag.moved) {
    dropEmptyWires();
    if (!getSel()) selectedId = null;
    renderCanvas();
    renderCode();
    save();
  }
  drag = null;
});

document.addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
  // Dropdowns and checkboxes have no undo of their own, so only text fields keep Ctrl+Z.
  const textEntry = document.activeElement?.matches?.('textarea, input[type="text"], input[type="number"]');
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    if (textEntry) return;
    e.preventDefault();
    undo();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && ['=', '+', '-', '0'].includes(e.key)) {
    e.preventDefault();
    if (e.key === '0') setZoom(1);
    else setZoom(e.key === '-' ? zoom / ZOOM_STEP : zoom * ZOOM_STEP);
    return;
  }
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.shiftKey && e.key.toLowerCase() === 'r') {
    rotateSelected();
    return;
  }
  if (e.key === '[' || e.key === ']') {
    resizeSelected(e.key === ']' ? 0.1 : -0.1);
    return;
  }
  if (e.key === ' ') {
    // Also stops a focused button from being clicked by the space bar.
    e.preventDefault();
    zoomToFit();
    return;
  }
  if (e.key === 'Enter' && sigPts) {
    finishSignal();
    return;
  }
  if (e.key === 'Escape') {
    if (sigPts) { sigPts = null; renderOverlay(); }
    else if (pending) { pending = null; renderOverlay(); }
    else { setTool('select'); select(null); }
    return;
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId != null) {
    e.preventDefault();
    deleteSelected();
    return;
  }
  const k = e.key.toLowerCase();
  if (k === 's') { setTool('select'); return; }
  const t = Object.keys(TYPES).find((name) => TYPES[name].key === k);
  if (t) setTool(t);
});

// ---------------------------------------------------------------- top bar, settings, output
$('btn-undo').addEventListener('click', undo);

$('btn-clear').addEventListener('click', () => {
  if (!state.elements.length || !confirm('Clear the whole circuit?')) return;
  snapshot();
  state.elements = [];
  selectedId = null;
  pending = null;
  refresh();
});

$('template').addEventListener('change', (e) => {
  loadTemplate(e.target.value);
  e.target.value = '';
});

$('opt-style').addEventListener('change', (e) => {
  settings.style = e.target.value;
  buildPalette();
  refresh();
});
$('opt-doc').addEventListener('change', (e) => {
  settings.fullDoc = e.target.value === 'full';
  renderCode();
  save();
});
$('opt-scale').addEventListener('input', (e) => {
  const v = parseFloat(e.target.value);
  settings.scale = Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : 1;
  renderCode();
  save();
});
$('opt-autolabel').addEventListener('change', (e) => {
  settings.autoLabel = e.target.checked;
  save();
});
$('opt-linewidth').addEventListener('change', (e) => {
  const custom = $('opt-linewidth-custom');
  if (e.target.value === 'custom') {
    custom.hidden = false;
    custom.value = settings.lineWidth;
    custom.focus();
    return;
  }
  custom.hidden = true;
  setLineWidth(Number(e.target.value));
});
$('opt-linewidth-custom').addEventListener('input', (e) => {
  const v = parseFloat(e.target.value);
  if (Number.isFinite(v) && v >= LW_MIN && v <= LW_MAX) setLineWidth(Math.round(v * 100) / 100);
});

function setLineWidth(v) {
  settings.lineWidth = v;
  applyLineWidth();
  renderCode();
  save();
}

function syncLineWidthUI() {
  const preset = LINE_WIDTHS.includes(settings.lineWidth);
  $('opt-linewidth').value = preset ? String(settings.lineWidth) : 'custom';
  $('opt-linewidth-custom').hidden = preset;
  $('opt-linewidth-custom').value = settings.lineWidth;
}

// Preview strokes are exaggerated relative to print so thin settings stay visible on screen.
function applyLineWidth() {
  document.documentElement.style.setProperty('--lw', `${Math.max(1, settings.lineWidth * 2.5)}px`);
}

$('btn-copy').addEventListener('click', async () => {
  const btn = $('btn-copy');
  try {
    await navigator.clipboard.writeText(codeEl.value);
  } catch {
    codeEl.select();
    document.execCommand('copy');
  }
  btn.textContent = 'Copied!';
  setTimeout(() => { btn.textContent = 'Copy code'; }, 1200);
});

$('btn-download').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([codeEl.value], { type: 'text/x-tex' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'circuit.tex';
  a.click();
  URL.revokeObjectURL(url);
});

// ---------------------------------------------------------------- diagram export
const PT_PER_PX = 72 / 2.54 / GRID;
const STYLE_PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-opacity', 'opacity',
  'font-family', 'font-size', 'font-style', 'font-weight', 'text-anchor', 'dominant-baseline'];

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Draws the circuit (no grid, selection or hit areas) into an off-screen SVG so styles and boxes can be measured.
function renderForExport() {
  if (!state.elements.length) {
    alert('Nothing to export yet – draw a circuit first.');
    return null;
  }
  const host = svgNode('svg', { width: CANVAS_W, height: CANVAS_H });
  host.setAttribute('style', 'position:absolute;left:-100000px;top:0');
  const layer = svgNode('g');
  for (const el of orderedElements()) layer.appendChild(drawElement(el, false));
  host.appendChild(layer);
  document.body.appendChild(host);
  layer.querySelectorAll('.hit, .ghost').forEach((n) => n.remove());
  const bb = layer.getBBox(), pad = 8;
  return { host, layer, x: bb.x - pad, y: bb.y - pad, w: bb.width + 2 * pad, h: bb.height + 2 * pad };
}

// Copies computed styles onto the clone so the SVG renders the same outside this page.
function inlineStyles(src, dst) {
  const cs = getComputedStyle(src);
  dst.removeAttribute('class');
  dst.removeAttribute('data-id');
  dst.setAttribute('style', STYLE_PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';'));
  [...src.children].forEach((c, i) => inlineStyles(c, dst.children[i]));
}

function svgMarkup(r) {
  const clone = r.layer.cloneNode(true);
  inlineStyles(r.layer, clone);
  const body = new XMLSerializer().serializeToString(clone);
  return `<svg xmlns="${SVGNS}" width="${fmt(r.w / GRID)}cm" height="${fmt(r.h / GRID)}cm" `
    + `viewBox="${fmt(r.x, 2)} ${fmt(r.y, 2)} ${fmt(r.w, 2)} ${fmt(r.h, 2)}">${body}</svg>`;
}

async function exportRaster(r, type) {
  const k = Number($('opt-dpi').value) / 2.54 / GRID;
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgMarkup(r));
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(r.w * k);
  canvas.height = Math.round(r.h * k);
  const ctx = canvas.getContext('2d');
  if (type === 'jpg') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((res) => canvas.toBlob(res, type === 'jpg' ? 'image/jpeg' : 'image/png', 0.95));
  downloadBlob(blob, `circuit.${type}`);
}

// ---- minimal vector PDF writer (standard Type1 fonts, so nothing needs embedding)
const PDF_FONTS = ['Times-Italic', 'Times-Roman', 'Helvetica-Bold', 'Helvetica', 'Symbol'];
const SYMBOL_CHARS = {
  'Ω': 'W', 'ω': 'w', 'α': 'a', 'β': 'b', 'π': 'p', 'θ': 'q', 'φ': 'f', 'Δ': 'D', 'τ': 't',
  '∞': '\xA5', '→': '\xAE', '←': '\xAC', '↑': '\xAD', '↓': '\xAF',
  '√': '\xD6', 'ψ': 'y', 'Ψ': 'Y',
};
const n3 = (v) => fmt(v, 3);

function pdfColor(css) {
  const m = /rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[, /]+([\d.]+))?/.exec(css || '');
  if (!m || (m[4] !== undefined && Number(m[4]) === 0)) return null;
  return [m[1], m[2], m[3]].map((v) => n3(v / 255)).join(' ');
}

// SVG path data -> PDF path operators (absolute M/L/C, with H/V/S/Q/T converted; arcs become lines).
function pathOps(d) {
  const toks = d.match(/[a-zA-Z]|-?(?:\d*\.\d+|\d+\.?)/g) || [];
  const out = [];
  let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, lc = null, lq = null;
  const num = () => parseFloat(toks[i++]);
  const isCmd = (t) => /^[a-zA-Z]$/.test(t);
  const curve = (c1, c2, e) => {
    out.push(`${n3(c1[0])} ${n3(c1[1])} ${n3(c2[0])} ${n3(c2[1])} ${n3(e[0])} ${n3(e[1])} c`);
    [x, y] = e;
  };
  while (i < toks.length) {
    if (isCmd(toks[i])) cmd = toks[i++];
    const rel = cmd !== cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    const C = cmd.toUpperCase();
    if (C === 'Z') {
      out.push('h');
      [x, y] = [sx, sy];
      lc = lq = null;
      if (i < toks.length && !isCmd(toks[i])) i++;
      continue;
    }
    if (C === 'M') {
      x = ox + num(); y = oy + num(); sx = x; sy = y;
      out.push(`${n3(x)} ${n3(y)} m`);
      cmd = rel ? 'l' : 'L';
      lc = lq = null;
    } else if (C === 'L' || C === 'H' || C === 'V') {
      if (C !== 'V') x = ox + num();
      if (C !== 'H') y = oy + num();
      out.push(`${n3(x)} ${n3(y)} l`);
      lc = lq = null;
    } else if (C === 'C' || C === 'S') {
      const c1 = C === 'C' ? [ox + num(), oy + num()] : lc ? [2 * x - lc[0], 2 * y - lc[1]] : [x, y];
      const c2 = [ox + num(), oy + num()];
      curve(c1, c2, [ox + num(), oy + num()]);
      lc = c2;
      lq = null;
    } else if (C === 'Q' || C === 'T') {
      const q = C === 'Q' ? [ox + num(), oy + num()] : lq ? [2 * x - lq[0], 2 * y - lq[1]] : [x, y];
      const e = [ox + num(), oy + num()];
      curve([x + (2 / 3) * (q[0] - x), y + (2 / 3) * (q[1] - y)], [e[0] + (2 / 3) * (q[0] - e[0]), e[1] + (2 / 3) * (q[1] - e[1])], e);
      lq = q;
      lc = null;
    } else if (C === 'A') {
      i += 5;
      x = ox + num(); y = oy + num();
      out.push(`${n3(x)} ${n3(y)} l`);
      lc = lq = null;
    } else {
      i++;
    }
  }
  return out;
}

function ellipseOps(cx, cy, rx, ry) {
  const k = 0.5523;
  return [
    `${n3(cx + rx)} ${n3(cy)} m`,
    `${n3(cx + rx)} ${n3(cy + k * ry)} ${n3(cx + k * rx)} ${n3(cy + ry)} ${n3(cx)} ${n3(cy + ry)} c`,
    `${n3(cx - k * rx)} ${n3(cy + ry)} ${n3(cx - rx)} ${n3(cy + k * ry)} ${n3(cx - rx)} ${n3(cy)} c`,
    `${n3(cx - rx)} ${n3(cy - k * ry)} ${n3(cx - k * rx)} ${n3(cy - ry)} ${n3(cx)} ${n3(cy - ry)} c`,
    `${n3(cx + k * rx)} ${n3(cy - ry)} ${n3(cx + rx)} ${n3(cy - k * ry)} ${n3(cx + rx)} ${n3(cy)} c`,
    'h',
  ];
}

function geometryOps(node) {
  const A = (n) => parseFloat(node.getAttribute(n)) || 0;
  switch (node.tagName) {
    case 'line': return [`${n3(A('x1'))} ${n3(A('y1'))} m`, `${n3(A('x2'))} ${n3(A('y2'))} l`];
    case 'rect': return [`${n3(A('x'))} ${n3(A('y'))} ${n3(A('width'))} ${n3(A('height'))} re`];
    case 'circle': return ellipseOps(A('cx'), A('cy'), A('r'), A('r'));
    case 'ellipse': return ellipseOps(A('cx'), A('cy'), A('rx'), A('ry'));
    case 'path': return pathOps(node.getAttribute('d') || '');
    case 'polyline':
    case 'polygon': {
      const v = (node.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number);
      const ops = [];
      for (let j = 0; j + 1 < v.length; j += 2) ops.push(`${n3(v[j])} ${n3(v[j + 1])} ${j ? 'l' : 'm'}`);
      if (node.tagName === 'polygon') ops.push('h');
      return ops;
    }
    default: return [];
  }
}

function textOps(node, cs) {
  const fill = pdfColor(cs.fill);
  if (!fill || !node.textContent) return [];
  const sans = /sans-serif/i.test(cs.fontFamily);
  const base = sans ? (Number(cs.fontWeight) >= 600 ? 3 : 4) : cs.fontStyle === 'italic' ? 1 : 2;
  const size = parseFloat(cs.fontSize);
  const bb = node.getBBox();
  // getBBox is the em box; the baseline sits about 78% of the way down it.
  const ops = [`${fill} rg`, 'BT', `1 0 0 -1 ${n3(bb.x)} ${n3(bb.y + bb.height * 0.78)} Tm`];
  const parts = node.children.length ? [...node.children] : [node];
  for (const part of parts) {
    const pSize = part === node ? size : parseFloat(getComputedStyle(part).fontSize);
    const rise = (parseFloat(part.getAttribute('data-rise')) || 0) * size;
    const runs = [];
    for (let ch of part.textContent) {
      if (ch === '−') ch = '-';
      let font = base, code = ch;
      if (SYMBOL_CHARS[ch]) { font = 5; code = SYMBOL_CHARS[ch]; } else if (ch.charCodeAt(0) > 255) code = '?';
      if (runs.length && runs[runs.length - 1].font === font) runs[runs.length - 1].s += code;
      else runs.push({ font, s: code });
    }
    ops.push(`${n3(rise)} Ts`);
    for (const r of runs) ops.push(`/F${r.font} ${n3(pSize)} Tf (${r.s.replace(/[\\()]/g, '\\$&')}) Tj`);
  }
  ops.push('ET');
  return ops;
}

function pdfContent(r) {
  const k = PT_PER_PX;
  const ops = [`${n3(k)} 0 0 ${n3(-k)} ${n3(-r.x * k)} ${n3((r.y + r.h) * k)} cm`];
  const CAP = { butt: 0, round: 1, square: 2 }, JOIN = { miter: 0, round: 1, bevel: 2 };
  const alphas = new Map(); // opacity -> ExtGState name
  for (const node of r.layer.querySelectorAll('line, path, rect, circle, ellipse, polyline, polygon, text')) {
    const cs = getComputedStyle(node);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const m = node.getCTM();
    ops.push('q', `${n3(m.a)} ${n3(m.b)} ${n3(m.c)} ${n3(m.d)} ${n3(m.e)} ${n3(m.f)} cm`);
    const alpha = n3((parseFloat(cs.opacity) || 1) * (parseFloat(cs.strokeOpacity) || 1));
    if (alpha !== '1') {
      if (!alphas.has(alpha)) alphas.set(alpha, `GS${alphas.size + 1}`);
      ops.push(`/${alphas.get(alpha)} gs`);
    }
    if (node.tagName === 'text') {
      ops.push(...textOps(node, cs));
    } else {
      const fill = pdfColor(cs.fill), stroke = pdfColor(cs.stroke);
      const sw = parseFloat(cs.strokeWidth) || 0;
      if (fill) ops.push(`${fill} rg`);
      if (stroke && sw > 0) {
        const dash = cs.strokeDasharray && cs.strokeDasharray !== 'none'
          ? cs.strokeDasharray.split(/[\s,]+/).map((v) => n3(parseFloat(v))).join(' ') : '';
        ops.push(`${stroke} RG`, `${n3(sw)} w`, `${CAP[cs.strokeLinecap] ?? 1} J`, `${JOIN[cs.strokeLinejoin] ?? 1} j`, `[${dash}] 0 d`);
      }
      ops.push(...geometryOps(node));
      const doStroke = stroke && sw > 0;
      ops.push(fill && doStroke ? 'B' : fill ? 'f' : doStroke ? 'S' : 'n');
    }
    ops.push('Q');
  }
  return { content: ops.join('\n'), alphas };
}

function buildPdf(r) {
  const { content, alphas } = pdfContent(r);
  const gs = alphas.size
    ? ` /ExtGState << ${[...alphas].map(([a, name]) => `/${name} << /CA ${a} /ca ${a} >>`).join(' ')} >>` : '';
  const objs = [null,
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n3(r.w * PT_PER_PX)} ${n3(r.h * PT_PER_PX)}] `
      + `/Resources << /Font << ${PDF_FONTS.map((_, j) => `/F${j + 1} ${5 + j} 0 R`).join(' ')} >>${gs} >> /Contents 4 0 R >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    ...PDF_FONTS.map((f) => `<< /Type /Font /Subtype /Type1 /BaseFont /${f}${f === 'Symbol' ? '' : ' /Encoding /WinAnsiEncoding'} >>`),
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  for (let j = 1; j < objs.length; j++) {
    offsets[j] = pdf.length;
    pdf += `${j} 0 obj\n${objs[j]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length}\n0000000000 65535 f \n`
    + offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
    + `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // Every character is below 256, so one char = one byte.
  return new Blob([Uint8Array.from(pdf, (c) => c.charCodeAt(0) & 0xff)], { type: 'application/pdf' });
}

async function exportDiagram(type) {
  const r = renderForExport();
  if (!r) return;
  try {
    if (type === 'svg') downloadBlob(new Blob([svgMarkup(r)], { type: 'image/svg+xml' }), 'circuit.svg');
    else if (type === 'pdf') downloadBlob(buildPdf(r), 'circuit.pdf');
    else await exportRaster(r, type);
  } finally {
    r.host.remove();
  }
}

document.querySelectorAll('[data-export]').forEach((b) => {
  b.addEventListener('click', () => exportDiagram(b.dataset.export));
});

// ---------------------------------------------------------------- persistence
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, settings }));
  } catch { /* storage full or disabled */ }
}

function load() {
  let data;
  try {
    data = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return;
  }
  if (!data || typeof data !== 'object') return;

  const isPt = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.y >= 0;
  const str = (v) => (typeof v === 'string' ? v : '');
  const sign = (v) => (v === '+' || v === '-' ? v : '');
  const size = (v, d) => (typeof v === 'number' && v >= 0.25 && v <= 40 ? v : d);
  const blockFields = (e) => {
    const p = TYPES[e.type].preset;
    return {
      kind: p.kind, ...(p.shape ? { shape: p.shape } : {}),
      w: size(e.w, p.w), h: p.shape === 'circle' ? size(e.w, p.w) : size(e.h, p.h),
      fill: e.fill in FILLS ? e.fill : p.fill,
      shadow: e.shadow === true, dashed: e.dashed === true, rounded: e.rounded === true, noBorder: e.noBorder === true,
      label2: str(e.label2),
      ...(p.kind === 'sum'
        ? { sumStyle: e.sumStyle in SUM_STYLES ? e.sumStyle : 'plus', signW: sign(e.signW), signN: sign(e.signN), signS: sign(e.signS) }
        : {}),
    };
  };
  if (Array.isArray(data.state?.elements)) {
    state.elements = data.state.elements
      .map((e) => (e?.type === 'pid' ? { ...e, type: 'blk' } : e)) // PID block was merged into Block
      .filter((e) => e && Number.isInteger(e.id) && TYPES[e.type] && isPt(e.a) && (TYPES[e.type].node || isPt(e.b)))
      .map((e) => ({
        id: e.id, type: e.type, a: { x: e.a.x, y: e.a.y },
        ...(TYPES[e.type].node ? {} : { b: { x: e.b.x, y: e.b.y } }),
        label: str(e.label), value: str(e.value), current: str(e.current), voltage: str(e.voltage),
        term: WIRE_TERMINALS.includes(e.term) ? e.term : '',
        flip: e.flip === true, mirror: e.mirror === true,
        ...([1, 2, 3].includes(e.rot) ? { rot: e.rot } : {}),
        ...(typeof e.size === 'number' && e.size >= SIZE_MIN && e.size <= SIZE_MAX && e.size !== 1 ? { size: e.size } : {}),
        ...((e.type === 'wire' || e.type === 'hl') && Array.isArray(e.via) && e.via.length && e.via.length <= 32 && e.via.every(isPt)
          ? { via: e.via.map((q) => ({ x: q.x, y: q.y })) } : {}),
        ...(e.color in COLORS ? { color: e.color } : {}),
        ...(TYPES[e.type].block ? blockFields(e) : {}),
        ...(TYPES[e.type].arrow ? {
          arrowHead: e.arrowHead in ARROW_ENDS ? e.arrowHead : 'tri',
          arrowEnds: e.arrowEnds in ARROW_SIDES ? e.arrowEnds : 'end',
        } : {}),
        ...(TYPES[e.type].highlight ? {
          hlColor: e.hlColor in HL_COLORS ? e.hlColor : 'salmon',
          hlWidth: typeof e.hlWidth === 'number' && e.hlWidth >= 0.5 && e.hlWidth <= 40 ? e.hlWidth : 5,
          hlStyle: e.hlStyle === 'dashed' ? 'dashed' : 'solid',
          hlOpacity: typeof e.hlOpacity === 'number' && e.hlOpacity >= 0.05 && e.hlOpacity <= 1 ? e.hlOpacity : 0.6,
        } : {}),
      }));
    state.nextId = Math.max(0, ...state.elements.map((e) => e.id)) + 1;
  }
  const s = data.settings || {};
  if (s.style === 'american' || s.style === 'european') settings.style = s.style;
  if (typeof s.fullDoc === 'boolean') settings.fullDoc = s.fullDoc;
  if (typeof s.scale === 'number' && s.scale > 0 && s.scale <= 10) settings.scale = s.scale;
  if (typeof s.autoLabel === 'boolean') settings.autoLabel = s.autoLabel;
  if (typeof s.lineWidth === 'number' && s.lineWidth >= LW_MIN && s.lineWidth <= LW_MAX) settings.lineWidth = s.lineWidth;
  if (GRID_STEPS.includes(s.gridStep)) settings.gridStep = s.gridStep;
  if (typeof s.alignAssist === 'boolean') settings.alignAssist = s.alignAssist;
}

// ---------------------------------------------------------------- init
load();
$('opt-style').value = settings.style;
$('opt-doc').value = settings.fullDoc ? 'full' : 'env';
$('opt-scale').value = settings.scale;
$('opt-autolabel').checked = settings.autoLabel;
syncLineWidthUI();
$('opt-grid').value = String(settings.gridStep);
$('opt-align').checked = settings.alignAssist;
applyGrid();
applyLineWidth();
buildPalette();
setTool('select');
refresh();
