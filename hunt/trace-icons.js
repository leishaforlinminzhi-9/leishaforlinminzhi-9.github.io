// The little pictures for the Trace card. Each one is flat artwork on a 64 x 64 canvas, returned as SVG markup
// (no ids, so the same icon can appear several times on a page).

export const ICONS = {
  // the wooden horse on wheels, with a bow and arrow above its back
  trojan: () => `
<path d="M9 30 Q2 34 4 45" fill="none" stroke="#6b4423" stroke-width="3.4" stroke-linecap="round"/>
<rect x="12" y="38" width="7" height="17" rx="2.5" fill="#b4733a"/><rect x="22" y="38" width="7" height="17" rx="2.5" fill="#b4733a"/>
<rect x="37" y="38" width="7" height="17" rx="2.5" fill="#b4733a"/><rect x="46.5" y="38" width="7" height="17" rx="2.5" fill="#b4733a"/>
<rect x="10" y="26.5" width="45" height="17" rx="7.5" fill="#c98b4a"/>
<path d="M36 33 C39.5 23 41.5 14.5 44.8 7.6 C48.8 5.4 53 6.8 56 9 C60 11.2 63.6 14.8 63.6 19 C63.6 22.2 60.6 23.8 58 22.4 C56 21.3 55 19.6 53 19.6 C53.2 24 55 28.5 55.5 34 Z" fill="#c98b4a"/>
<path d="M45.2 8.6 L48.2 0.6 L52.4 7.2 Z" fill="#d99a58"/>
<path d="M44.4 10.4 C42.2 16.5 40.4 22.5 38.2 30" stroke="#6b4423" stroke-width="2.9" stroke-linecap="round" fill="none"/>
<path d="M47 8.8 C49.6 5.6 53 6 54.8 8.6" stroke="#6b4423" stroke-width="2.3" stroke-linecap="round" fill="none"/>
<circle cx="57.4" cy="12.6" r="1.4" fill="#3a2118"/><circle cx="61.2" cy="17.8" r=".9" fill="#8a5a2b"/>
<path d="M21 29 V41 M32 29 V41 M43 29 V41" stroke="#a5642b" stroke-width="1.4" stroke-linecap="round"/>
<rect x="5" y="54.5" width="53" height="3.6" rx="1.8" fill="#6b4423"/>
<circle cx="15" cy="60.4" r="3.4" fill="#8a5a2b" stroke="#5a3a1c" stroke-width="1"/><circle cx="48" cy="60.4" r="3.4" fill="#8a5a2b" stroke="#5a3a1c" stroke-width="1"/>
<path d="M14.5 2.5 Q1.5 14.5 14.5 26.5" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".85"/>
<path d="M14.5 2.5 Q1.5 14.5 14.5 26.5" fill="none" stroke="#6b4423" stroke-width="3" stroke-linecap="round"/>
<path d="M14.5 2.5 V26.5" stroke="#6e6e6e" stroke-width="1.1"/>
<path d="M4.5 14.5 H31" stroke="#8b6b3d" stroke-width="1.9" stroke-linecap="round"/>
<path d="M30.5 10.8 L37.5 14.5 L30.5 18.2 Z" fill="#7b7b7b"/>
<path d="M4.5 14.5 L1.5 11.4 M4.5 14.5 L1.5 17.6 M8 14.5 L5.2 11.8 M8 14.5 L5.2 17.2" stroke="#d94f4f" stroke-width="1.5" stroke-linecap="round"/>`,

  // a girl with long copper-brown hair, side-swept see-through bangs and big clear glasses, a calm face, in a navy mock-neck
  // sweater, pointing at herself
  girl: () => `
<path d="M12 33 C11.4 12 20.6 3.6 32 3.6 C43.4 3.6 52.6 12 52 33 L54.4 56 C54.6 60.4 50.2 62.4 45.8 62.4 L18.2 62.4 C13.8 62.4 9.4 60.4 9.6 56 Z" fill="#a2512f"/>
<rect x="28" y="40" width="8" height="11" rx="3" fill="#eec3a4"/>
<path d="M7 64 C7 52 18 47.5 32 47.5 C46 47.5 57 52 57 64 Z" fill="#232f55"/>
<rect x="25.4" y="43.4" width="13.2" height="7.4" rx="3.4" fill="#2f3f70"/>
<path d="M11.8 34 L10 58 C10 61.2 16.6 62.2 18.8 58.5 L22 42 Z" fill="#a2512f"/>
<path d="M52.2 34 L54 58 C54 61.2 47.4 62.2 45.2 58.5 L42 42 Z" fill="#a2512f"/>
<path d="M14.4 41 L13.6 55 M17 43 L16.5 56 M49.6 41 L50.4 55 M47 43 L47.5 56" stroke="#86402a" stroke-width="1" stroke-linecap="round" fill="none"/>
<ellipse cx="32" cy="30.4" rx="13.3" ry="14.3" fill="#f5d4ba"/>
<path d="M27.2 7.6 C35 7.6 44.6 10.6 45.4 28 C42.8 23.6 38.8 21.8 34.6 22.2 C31 22.6 28.4 20.6 27 16.6 Z" fill="#a8582f"/>
<path d="M27.2 7.6 C19.6 8.6 18.6 18 19 29 C20.8 24.2 23.8 22 27.6 21.2 Z" fill="#a2512f"/>
<path d="M33 9.4 C39 10.6 42.4 14.4 43.2 21.4 M23.4 10.6 C21 14 20.4 18.6 20.6 23" stroke="#86402a" stroke-width=".9" stroke-linecap="round" fill="none" opacity=".8"/>
<path d="M19.8 21 C18.8 28 19 36 17.4 45 M44.2 21 C45.2 28 45 36 46.6 45" stroke="#a2512f" stroke-width="3.2" stroke-linecap="round" fill="none"/>
<rect x="20" y="26.4" width="11" height="9.2" rx="3.6" fill="#fff" fill-opacity=".16" stroke="#dcb8a1" stroke-width="1.7"/>
<rect x="33" y="26.4" width="11" height="9.2" rx="3.6" fill="#fff" fill-opacity=".16" stroke="#dcb8a1" stroke-width="1.7"/>
<path d="M31 29.2 H33" stroke="#d6b06a" stroke-width="1.3" stroke-linecap="round"/>
<path d="M23 30.2 Q25.5 28.7 28 30.2 M36 30.2 Q38.5 28.7 41 30.2" fill="none" stroke="#34211a" stroke-width=".9" stroke-linecap="round"/>
<ellipse cx="25.5" cy="31.1" rx="1.9" ry="1.2" fill="#34211a"/><ellipse cx="38.5" cy="31.1" rx="1.9" ry="1.2" fill="#34211a"/>
<path d="M30.9 36.4 Q32 37.8 33.1 36.4" fill="none" stroke="#d99a80" stroke-width="1.1" stroke-linecap="round"/>
<path d="M29.4 40.2 Q32 41 34.6 40.2" fill="none" stroke="#bf6b60" stroke-width="1.3" stroke-linecap="round"/>
<path d="M60 64 L47.5 55.5" stroke="#232f55" stroke-width="9.5" stroke-linecap="round"/>
<path d="M60 64 L47.5 55.5" stroke="#3a4a7c" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>
<circle cx="45" cy="53.5" r="4.9" fill="#f5d4ba"/>
<path d="M43.5 52.2 L33.2 50.6" stroke="#f5d4ba" stroke-width="3.7" stroke-linecap="round"/>
<path d="M43 56.2 L47.5 52.5" stroke="#e8bc9b" stroke-width="1" stroke-linecap="round"/>`,

  // a scoreboard that shows 12 : 12 (the score at which ultimate frisbee goes to "universe point", "uni")
  scoreboard: () => `
<rect x="13" y="42" width="5" height="17" rx="1.5" fill="#8a6a45"/><rect x="46" y="42" width="5" height="17" rx="1.5" fill="#8a6a45"/>
<rect x="8" y="57" width="16" height="4" rx="2" fill="#6b5236"/><rect x="40" y="57" width="16" height="4" rx="2" fill="#6b5236"/>
<rect x="3" y="9" width="58" height="37" rx="6" fill="#2d4a3e" stroke="#cfd8d3" stroke-width="2"/>
<rect x="8" y="13" width="14" height="3" rx="1.5" fill="#e5473b"/><rect x="42" y="13" width="14" height="3" rx="1.5" fill="#5fb0e6"/>
<rect x="7" y="20" width="10" height="21" rx="2" fill="#15221c"/><rect x="19" y="20" width="10" height="21" rx="2" fill="#15221c"/>
<rect x="35" y="20" width="10" height="21" rx="2" fill="#15221c"/><rect x="47" y="20" width="10" height="21" rx="2" fill="#15221c"/>
<g font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="16.5" fill="#fff" text-anchor="middle">
<text x="12" y="36.2">1</text><text x="24" y="36.2">2</text><text x="40" y="36.2">1</text><text x="52" y="36.2">2</text></g>
<rect x="7" y="30" width="10" height="1" fill="#2d4a3e"/><rect x="19" y="30" width="10" height="1" fill="#2d4a3e"/><rect x="35" y="30" width="10" height="1" fill="#2d4a3e"/><rect x="47" y="30" width="10" height="1" fill="#2d4a3e"/>
<circle cx="32" cy="26.2" r="1.9" fill="#fff"/><circle cx="32" cy="34.8" r="1.9" fill="#fff"/>`,

  // the referee's "travel" signal from the ultimate frisbee hand-signal chart: a faceless figure in a blue shirt, hair in a bun,
  // fists rolling round each other in front of the chest
  travel: () => `
<circle cx="32" cy="5" r="4.3" fill="#2a2220"/>
<path d="M28 26 H36 V33 H28 Z" fill="#cf9d77"/>
<path d="M9 66 C9 45 18 33.5 32 33.5 C46 33.5 55 45 55 66 Z" fill="#2e6fb7"/>
<path d="M25.5 33.8 Q32 40 38.5 33.8" fill="none" stroke="#25589a" stroke-width="1.6" stroke-linecap="round"/>
<ellipse cx="32" cy="18.4" rx="9.6" ry="10.6" fill="#e3b690"/>
<path d="M21.6 19.6 C19.8 3.6 44.2 3.6 42.4 19.6 C40 14.4 24 14.4 21.6 19.6 Z" fill="#2a2220"/>
<path d="M16.5 39 L11.5 47.5" stroke="#2e6fb7" stroke-width="8.5" stroke-linecap="round"/>
<path d="M47.5 39 L52.5 47.5" stroke="#2e6fb7" stroke-width="8.5" stroke-linecap="round"/>
<path d="M11.5 47.5 L24 50.5" stroke="#e3b690" stroke-width="5.6" stroke-linecap="round"/>
<path d="M52.5 47.5 L40 50.5" stroke="#e3b690" stroke-width="5.6" stroke-linecap="round"/>
<circle cx="26.2" cy="50.5" r="3.9" fill="#e3b690"/><circle cx="37.8" cy="50.5" r="3.9" fill="#e3b690"/>
<path d="M20.5 50.5 C22 42.5 42 42.5 43.5 50.5" fill="none" stroke="#39a0db" stroke-width="1.9" stroke-linecap="round"/>
<path d="M43.5 50.5 C42 58.5 22 58.5 20.5 50.5" fill="none" stroke="#39a0db" stroke-width="1.9" stroke-linecap="round" stroke-dasharray="5.5 3"/>
<path d="M43.5 54.4 L40.6 49.6 L46.4 49.6 Z" fill="#39a0db"/>
<path d="M20.5 46.6 L17.6 51.4 L23.4 51.4 Z" fill="#39a0db"/>`,

  // a suitcase with stickers, and a paper plane overhead
  suitcase: () => `
<path d="M23.5 25 V18.5 a4.5 4.5 0 0 1 4.5 -4.5 h8 a4.5 4.5 0 0 1 4.5 4.5 V25" fill="none" stroke="#1d5f5a" stroke-width="3.6" stroke-linecap="round"/>
<rect x="7" y="24" width="50" height="34" rx="7.5" fill="#34b0a8"/>
<rect x="18" y="24" width="5.5" height="34" fill="#238d86"/><rect x="40.5" y="24" width="5.5" height="34" fill="#238d86"/>
<rect x="28.5" y="36" width="7" height="5" rx="1.4" fill="#f3d27a" stroke="#c9a23c" stroke-width="1"/>
<path d="M12.4 47.5 c-3.2 -2.4 -2.2 -5.4 0 -5.4 c1 0 1.8 .6 2.2 1.4 c.4 -.8 1.2 -1.4 2.2 -1.4 c2.2 0 3.2 3 0 5.4 l-2.2 2 z" fill="#ee6f93"/>
<path d="M49.2 41.2 l1.4 2.9 3.2 .4 -2.3 2.2 .6 3.1 -2.9 -1.5 -2.9 1.5 .6 -3.1 -2.3 -2.2 3.2 -.4 z" fill="#ffd45a"/>
<circle cx="19" cy="60.4" r="2.6" fill="#33403f"/><circle cx="45" cy="60.4" r="2.6" fill="#33403f"/>
<path d="M44 12 L62 3 L52 20 L49.5 13.5 Z" fill="#fff" stroke="#9bb0c4" stroke-width="1.4" stroke-linejoin="round"/>
<path d="M49.5 13.5 L62 3" stroke="#9bb0c4" stroke-width="1.2"/>`,
};

export const ICON_NAMES = Object.keys(ICONS);
