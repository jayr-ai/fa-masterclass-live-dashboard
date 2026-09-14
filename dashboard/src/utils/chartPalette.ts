/**
 * Chart data-mark colors — validated against the app's real dark-green chart
 * surface (#172114, pulled from the live sales-dashboard's --surface) via the
 * dataviz skill's validate_palette.js (all checks pass). Intentionally a
 * separate system from the --color-fa-* UI chrome tokens — data-encoding
 * colors and brand decoration serve different jobs.
 */
export const CATEGORICAL = [
  '#d95926', // 1 orange — primary series (e.g. Ads)
  '#3987e5', // 2 blue — secondary series (e.g. Organic)
  '#199e70', // 3 aqua
  '#c98500', // 4 yellow
  '#d55181', // 5 magenta
  '#008300', // 6 green
  '#9085e9', // 7 violet
  '#e66767', // 8 red
] as const

export const CHART_SURFACE = '#172114'
export const GRIDLINE = 'rgba(237, 237, 238, 0.1)'
export const AXIS_MUTED = '#8a9887'
export const TEXT_SECONDARY = '#a9b6a4'
