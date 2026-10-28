// Malfoid's animated avatar: an original layered SVG bust with expressions,
// blinking, idle sway and a talking mouth. Exposes window.MalfoidAvatar.mount(el).
(function () {
  const C = {
    hair: "#e8d9ab", hairShade: "#c7b07a", hairDeep: "#a48c58", hairLight: "#f8efcf",
    skin: "#f7e6d8", skinShade: "#ebcdb9", blush: "#ec8f9a", lip: "#d99a95",
    iris: "#3f7158", irisLight: "#86b79c", pupil: "#17271f", lash: "#3b2b23", brow: "#b0925c",
    robe: "#16181b", robeShade: "#0c0d0f", lining: "#1e4f34", liningLight: "#2c6c48",
    silver: "#c7cdd1", jumper: "#45484c", jumperShade: "#36393c", shirt: "#f1f0ea", shirtShade: "#d6d5cd",
    tie: "#1e4f34", ribbon: "#1f5a3a", ribbonShade: "#143d27", gem: "#2fa165", choker: "#1d1e20",
    mouth: "#6e2f37", teeth: "#fbf7f2",
  };

  // Brow transforms (rotate deg around the inner end, lift px), lid drop px,
  // iris look offset, closed-mouth path, blush opacity.
  const EXPRESSIONS = {
    smug:      { bl: [-3, 0],  br: [6, -5],  lid: 5, look: [0, 0],  blush: 0.12, mouth: "M188,246 C195,248 205,247 214,240" },
    annoyed:   { bl: [10, 3],  br: [-10, 3], lid: 4, look: [0, 0],  blush: 0,    mouth: "M190,247 C196,244 204,244 210,247" },
    flustered: { bl: [-9, -3], br: [9, -3],  lid: 0, look: [-5, 1], blush: 0.9,  mouth: "M191,246 C194,243 197,248 200,245 C203,242 206,247 209,244" },
    sulking:   { bl: [4, 2],   br: [-4, 2],  lid: 6, look: [5, 3],  blush: 0.45, mouth: "M192,248 C196,243 204,243 208,248" },
    soft:      { bl: [-2, -2], br: [2, -2],  lid: 2, look: [0, 0],  blush: 0.35, mouth: "M190,243 C196,249 204,249 210,243" },
  };

  // Open-mouth shapes for talking: [rx, ry, teeth?]
  const MOUTHS = { small: [5, 2.6, false], mid: [6.5, 4.6, true], wide: [7.5, 6.6, true], ee: [8.5, 2.8, true] };

  function eye(cx, side) {
    // side: -1 for the viewer's left eye, +1 for the right. Negative x = inner corner, positive = outer.
    const m = (x) => cx + side * x;
    const shape = `M${m(-20)},193 C${m(-14)},178 ${m(10)},172 ${m(24)},184 C${m(20)},198 ${m(-6)},205 ${m(-20)},193 Z`;
    const lash = `M${m(-19)},191 C${m(-14)},176 ${m(10)},167 ${m(25)},180 L${m(33)},175 L${m(28)},186 C${m(13)},175 ${m(-11)},179 ${m(-19)},191 Z`;
    const lidFill = `M${m(-36)},150 L${m(36)},150 L${m(36)},181 L${m(25)},180 C${m(10)},167 ${m(-14)},176 ${m(-19)},191 L${m(-36)},191 Z`;
    const ix = cx + side * 2;
    const id = side < 0 ? "L" : "R";
    return `
      <clipPath id="eyeclip${id}"><path d="${shape}"/></clipPath>
      <g class="eye">
        <g clip-path="url(#eyeclip${id})">
          <path d="${shape}" fill="#fdfbf8"/>
          <path d="${shape}" fill="${C.skinShade}" opacity=".45" transform="translate(0,-7)"/>
          <g class="iris">
            <ellipse cx="${ix}" cy="190" rx="12.5" ry="14.5" fill="url(#irisGrad)"/>
            <ellipse cx="${ix}" cy="190" rx="12.5" ry="14.5" fill="none" stroke="${C.pupil}" stroke-width="1.5" opacity=".75"/>
            <ellipse cx="${ix}" cy="191" rx="5.5" ry="7.5" fill="${C.pupil}"/>
            <path d="M${ix - 9},184 C${ix - 4},178 ${ix + 4},178 ${ix + 9},184" fill="none" stroke="#10201a" stroke-width="3" opacity=".5"/>
            <ellipse cx="${ix - 4.5}" cy="185" rx="3.4" ry="4.2" fill="#fff"/>
            <circle cx="${ix + 5}" cy="196" r="1.6" fill="#fff" opacity=".85"/>
            <path d="M${ix - 7},199 C${ix - 3},202 ${ix + 3},202 ${ix + 7},199" fill="none" stroke="#b6e0c8" stroke-width="1.6" opacity=".6"/>
          </g>
          <g class="lid"><path d="${lidFill}" fill="${C.skin}"/></g>
        </g>
        <g class="lid"><path d="${lash}" fill="${C.lash}"/></g>
        <path d="M${m(-14)},201 C${m(-3)},206 ${m(12)},203 ${m(21)},194" fill="none" stroke="${C.lash}" stroke-width="1.1" opacity=".5" stroke-linecap="round"/>
        <path d="M${m(-19)},177 C${m(-6)},167 ${m(12)},166 ${m(24)},174" fill="none" stroke="#d9b3a0" stroke-width="1.3" opacity=".9"/>
      </g>`;
  }

  const SVG = `
<svg viewBox="40 52 320 448" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Malfoid">
  <defs>
    <radialGradient id="irisGrad" cx=".5" cy=".62" r=".6">
      <stop offset="0" stop-color="${C.irisLight}"/><stop offset=".55" stop-color="${C.iris}"/><stop offset="1" stop-color="#22402f"/>
    </radialGradient>
    <linearGradient id="hairGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.hairLight}"/><stop offset=".35" stop-color="${C.hair}"/><stop offset="1" stop-color="${C.hairShade}"/>
    </linearGradient>
    <linearGradient id="hairBackGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.hairShade}"/><stop offset="1" stop-color="${C.hairDeep}"/>
    </linearGradient>
    <linearGradient id="skinGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.skin}"/><stop offset="1" stop-color="#f1d9c7"/>
    </linearGradient>
    <linearGradient id="robeGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1f2226"/><stop offset="1" stop-color="${C.robeShade}"/>
    </linearGradient>
    <radialGradient id="blushGrad"><stop offset="0" stop-color="${C.blush}" stop-opacity=".9"/><stop offset="1" stop-color="${C.blush}" stop-opacity="0"/></radialGradient>
    <pattern id="tieStripes" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-40)">
      <rect width="14" height="14" fill="${C.tie}"/><rect y="5" width="14" height="2.2" fill="${C.silver}"/><rect y="9" width="14" height="1" fill="${C.silver}" opacity=".7"/>
    </pattern>
  </defs>

  <g class="breath">
    <!-- back hair -->
    <g class="hair-back">
      <path d="M200,66 C116,66 96,140 102,222 C108,300 84,380 66,468 C60,500 66,530 76,552 L324,552 C334,530 340,500 334,468 C316,380 292,300 298,222 C304,140 284,66 200,66 Z" fill="url(#hairBackGrad)"/>
    </g>

    <!-- body -->
    <g class="body">
      <path d="M48,560 C50,430 84,352 150,326 L200,346 L250,326 C316,352 350,430 352,560 Z" fill="url(#robeGrad)"/>
      <path d="M150,326 C120,380 112,460 116,560 L146,560 C140,470 150,392 178,338 Z" fill="${C.lining}"/>
      <path d="M250,326 C280,380 288,460 284,560 L254,560 C260,470 250,392 222,338 Z" fill="${C.lining}"/>
      <path d="M150,326 C121,380 113,460 117,560" fill="none" stroke="${C.liningLight}" stroke-width="2"/>
      <path d="M250,326 C279,380 287,460 283,560" fill="none" stroke="${C.liningLight}" stroke-width="2"/>
      <path d="M133,410 C140,430 132,450 140,470 M128,480 C136,500 128,520 134,540" fill="none" stroke="${C.silver}" stroke-width="1.2" opacity=".55"/>
      <path d="M267,410 C260,430 268,450 260,470 M272,480 C264,500 272,520 266,540" fill="none" stroke="${C.silver}" stroke-width="1.2" opacity=".55"/>
      <!-- jumper -->
      <path d="M178,338 C160,400 150,480 146,560 L254,560 C250,480 240,400 222,338 L200,420 Z" fill="${C.jumper}"/>
      <path d="M178,338 L200,420 L222,338 L216,338 L200,404 L184,338 Z" fill="${C.lining}"/>
      <path d="M183,338 L200,410 L217,338" fill="none" stroke="${C.silver}" stroke-width="1.4" opacity=".8"/>
      <!-- shirt + tie -->
      <path d="M184,322 L200,404 L216,322 Z" fill="${C.shirt}"/>
      <path d="M182,318 L172,346 L196,340 Z" fill="${C.shirt}" stroke="${C.shirtShade}" stroke-width="1"/>
      <path d="M218,318 L228,346 L204,340 Z" fill="${C.shirt}" stroke="${C.shirtShade}" stroke-width="1"/>
      <path d="M194,336 L206,336 L209,346 L200,352 L191,346 Z" fill="url(#tieStripes)"/>
      <path d="M192,350 L208,350 L214,404 L200,418 L186,404 Z" fill="url(#tieStripes)"/>
      <!-- crest -->
      <g transform="translate(262,452)">
        <path d="M-15,-17 L15,-17 L15,3 C15,14 6,19 0,22 C-6,19 -15,14 -15,3 Z" fill="${C.lining}" stroke="${C.silver}" stroke-width="1.4"/>
        <path d="M5,-9 C-6,-11 -7,-2 0,0 C7,2 6,11 -5,9" fill="none" stroke="${C.silver}" stroke-width="2.2" stroke-linecap="round"/>
      </g>
    </g>

    <!-- neck + choker -->
    <path d="M181,250 L181,320 C188,330 212,330 219,320 L219,250 Z" fill="url(#skinGrad)"/>
    <path d="M181,262 C190,280 210,280 219,262 L219,282 C210,290 190,290 181,282 Z" fill="${C.skinShade}" opacity=".7"/>
    <path d="M180,300 C190,308 210,308 220,300 L220,307 C210,315 190,315 180,307 Z" fill="${C.choker}"/>
    <path d="M182,303 C192,310 208,310 218,303" fill="none" stroke="${C.silver}" stroke-width=".8" stroke-dasharray="2 2" opacity=".7"/>
    <path d="M200,308 L206,315 L200,324 L194,315 Z" fill="${C.gem}" stroke="${C.silver}" stroke-width="1.2"/>
    <path d="M198,313 L201,311 L202,316 Z" fill="#bff0d2" opacity=".8"/>

    <g class="head">
      <!-- ribbon + braid behind the right ear -->
      <g class="ribbon">
        <path d="M266,150 C286,136 300,146 296,160 C290,170 276,166 268,160 Z" fill="${C.ribbon}"/>
        <path d="M268,162 C276,178 282,206 276,236 L286,230 C290,204 284,176 272,160 Z" fill="${C.ribbonShade}"/>
        <path d="M268,160 C282,170 292,192 296,214 L302,206 C296,186 286,168 270,156 Z" fill="${C.ribbon}"/>
        <circle cx="268" cy="158" r="5" fill="${C.ribbonShade}"/>
      </g>

      <!-- ears + hoops -->
      <path d="M141,176 C131,172 128,190 134,202 C138,210 144,208 145,200 Z" fill="${C.skinShade}"/>
      <path d="M259,176 C269,172 272,190 266,202 C262,210 256,208 255,200 Z" fill="${C.skinShade}"/>
      <circle class="hoop" cx="138" cy="217" r="9" fill="none" stroke="${C.silver}" stroke-width="2"/>
      <circle class="hoop" cx="262" cy="217" r="9" fill="none" stroke="${C.silver}" stroke-width="2"/>

      <!-- face -->
      <path d="M140,150 C140,104 168,84 200,84 C232,84 260,104 260,150 C260,180 258,206 250,228 C238,256 218,272 200,280 C182,272 162,256 150,228 C142,206 140,180 140,150 Z" fill="url(#skinGrad)"/>
      <path d="M150,226 C162,252 182,268 200,276 C218,268 238,252 250,226 C238,258 220,272 200,278 C180,272 162,258 150,226 Z" fill="${C.skinShade}" opacity=".6"/>

      <!-- blush -->
      <g class="blush">
        <ellipse cx="160" cy="222" rx="17" ry="9" fill="url(#blushGrad)"/>
        <ellipse cx="240" cy="222" rx="17" ry="9" fill="url(#blushGrad)"/>
        <path d="M153,221 l5,-4 M160,222 l5,-4 M234,221 l5,-4 M241,222 l5,-4" stroke="${C.blush}" stroke-width="1.3" stroke-linecap="round" opacity=".8"/>
      </g>

      ${eye(171, -1)}
      ${eye(229, 1)}

      <!-- nose -->
      <path d="M201,214 C203,222 203,227 198,230" fill="none" stroke="${C.skinShade}" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M197,231 L201,231" stroke="#d3ab95" stroke-width="1.4" stroke-linecap="round"/>

      <!-- mouth -->
      <g class="mouth" transform="translate(0,6)">
        <path class="mouth-closed" d="${EXPRESSIONS.smug.mouth}" fill="none" stroke="${C.lip}" stroke-width="2.4" stroke-linecap="round"/>
        <g class="mouth-open" display="none">
          <ellipse class="mo-shape" cx="200" cy="245" rx="6" ry="4" fill="${C.mouth}"/>
          <rect class="mo-teeth" x="193" y="240" width="14" height="2.6" rx="1.2" fill="${C.teeth}"/>
          <path class="mo-lip" d="M195,251 C198,252.5 202,252.5 205,251" stroke="${C.lip}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".8"/>
        </g>
      </g>

      <!-- front hair: crown and side-swept fringe -->
      <path d="M138,198 C124,118 152,66 200,62 C252,60 282,110 268,198 C262,160 252,132 236,118 C214,104 184,106 166,120 C150,134 142,160 138,198 Z" fill="url(#hairGrad)"/>
      <path d="M150,120 C168,92 214,84 246,108 C262,124 268,150 266,176 C258,160 250,150 242,146 C246,166 248,190 246,212 C238,186 228,166 214,154 C214,166 210,178 204,186 C202,170 196,156 186,146 C180,158 170,166 158,170 C162,156 160,144 154,136 C150,150 146,162 142,172 C142,150 144,132 150,120 Z" fill="url(#hairGrad)"/>
      <path d="M186,146 C196,128 222,120 242,146 M214,154 C222,138 236,132 246,140" fill="none" stroke="${C.hairShade}" stroke-width="1.4" opacity=".75"/>
      <path d="M154,136 C162,122 176,116 190,118" fill="none" stroke="${C.hairShade}" stroke-width="1.2" opacity=".6"/>
      <path d="M156,96 C176,80 204,76 230,86" fill="none" stroke="${C.hairLight}" stroke-width="6" stroke-linecap="round" opacity=".85"/>
      <path d="M150,112 C170,96 198,90 224,98" fill="none" stroke="${C.hairLight}" stroke-width="2.5" stroke-linecap="round" opacity=".6"/>

      <!-- braid along the right side -->
      <g class="braid">
        <ellipse cx="254" cy="128" rx="8" ry="6" fill="${C.hair}" stroke="${C.hairDeep}" stroke-width="1" transform="rotate(35 254 128)"/>
        <ellipse cx="261" cy="139" rx="8" ry="6" fill="${C.hair}" stroke="${C.hairDeep}" stroke-width="1" transform="rotate(50 261 139)"/>
        <ellipse cx="266" cy="151" rx="7.5" ry="5.5" fill="${C.hair}" stroke="${C.hairDeep}" stroke-width="1" transform="rotate(65 266 151)"/>
      </g>

      <!-- brows (drawn over the fringe, as in anime art) -->
      <g class="brow brow-l"><path d="M150,163 C158,156 175,154 190,158 C176,156 161,158 150,165 Z" fill="${C.brow}" stroke="${C.brow}" stroke-width="1" stroke-linejoin="round"/></g>
      <g class="brow brow-r"><path d="M250,163 C242,156 225,154 210,158 C224,156 239,158 250,165 Z" fill="${C.brow}" stroke="${C.brow}" stroke-width="1" stroke-linejoin="round"/></g>
    </g>

    <!-- side locks in front of the shoulders -->
    <g class="lock lock-l">
      <path d="M142,150 C128,210 122,270 130,318 C138,368 126,420 104,482 C124,472 142,442 152,402 C164,352 156,302 154,254 C152,214 150,180 151,156 Z" fill="url(#hairGrad)"/>
      <path d="M138,240 C126,300 136,352 124,420" fill="none" stroke="${C.hairLight}" stroke-width="1.5" opacity=".6"/>
      <path d="M146,190 C136,240 142,290 146,330 C150,370 138,410 122,452" fill="none" stroke="${C.hairShade}" stroke-width="2" opacity=".8"/>
      <path d="M154,176 C150,220 156,262 156,300" fill="none" stroke="${C.hairLight}" stroke-width="2" opacity=".7"/>
    </g>
    <g class="lock lock-r">
      <path d="M258,150 C272,210 278,270 270,318 C262,368 274,420 296,482 C276,472 258,442 248,402 C236,352 244,302 246,254 C248,214 250,180 249,156 Z" fill="url(#hairGrad)"/>
      <path d="M262,240 C274,300 264,352 276,420" fill="none" stroke="${C.hairLight}" stroke-width="1.5" opacity=".6"/>
      <path d="M254,190 C264,240 258,290 254,330 C250,370 262,410 278,452" fill="none" stroke="${C.hairShade}" stroke-width="2" opacity=".8"/>
      <path d="M246,176 C250,220 244,262 244,300" fill="none" stroke="${C.hairLight}" stroke-width="2" opacity=".7"/>
    </g>
  </g>
</svg>`;

  const CSS = `
  .mav svg { width: 100%; height: 100%; display: block; overflow: visible; }
  .mav .breath { animation: mav-breathe 4.6s ease-in-out infinite; transform-origin: 200px 560px; }
  .mav .head { animation: mav-sway 8s ease-in-out infinite; transform-origin: 200px 300px; transform-box: view-box; }
  .mav .lock-l { animation: mav-lock 5.5s ease-in-out infinite; transform-origin: 152px 160px; transform-box: view-box; }
  .mav .lock-r { animation: mav-lock 6.2s ease-in-out infinite reverse; transform-origin: 248px 160px; transform-box: view-box; }
  .mav .hoop { animation: mav-hoop 3.4s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 0; }
  .mav .lid { transition: transform .11s ease-out; }
  .mav .iris { transition: transform .35s ease; }
  .mav .brow { transition: transform .3s ease; transform-box: fill-box; }
  .mav .brow-l { transform-origin: 100% 50%; }
  .mav .brow-r { transform-origin: 0% 50%; }
  .mav .blush { transition: opacity .5s ease; }
  @keyframes mav-breathe { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
  @keyframes mav-sway { 0%,100% { transform: rotate(-.8deg) } 50% { transform: rotate(.9deg) } }
  @keyframes mav-lock { 0%,100% { transform: rotate(-.9deg) } 50% { transform: rotate(1.1deg) } }
  @keyframes mav-hoop { 0%,100% { transform: rotate(-6deg) } 50% { transform: rotate(6deg) } }
  @media (prefers-reduced-motion: reduce) { .mav .breath, .mav .head, .mav .lock-l, .mav .lock-r, .mav .hoop { animation: none } }
  `;

  function mount(el) {
    if (!document.getElementById("mav-style")) {
      const st = document.createElement("style");
      st.id = "mav-style";
      st.textContent = CSS;
      document.head.append(st);
    }
    el.classList.add("mav");
    el.innerHTML = SVG;
    const q = (s) => el.querySelectorAll(s);
    const lids = q(".lid"), irises = q(".iris");
    const browL = el.querySelector(".brow-l"), browR = el.querySelector(".brow-r");
    const blush = el.querySelector(".blush");
    const closed = el.querySelector(".mouth-closed"), open = el.querySelector(".mouth-open");
    const moShape = el.querySelector(".mo-shape"), moTeeth = el.querySelector(".mo-teeth");

    let expr = EXPRESSIONS.smug, exprName = "smug", blinking = false, glance = [0, 0];

    const setLids = (px) => lids.forEach((l) => (l.style.transform = `translateY(${px}px)`));
    const setLook = () => irises.forEach((i) => (i.style.transform = `translate(${expr.look[0] + glance[0]}px, ${expr.look[1] + glance[1]}px)`));

    function setExpression(name) {
      const e = EXPRESSIONS[String(name).toLowerCase()];
      if (!e) return;
      expr = e;
      exprName = String(name).toLowerCase();
      browL.style.transform = `translateY(${e.bl[1]}px) rotate(${e.bl[0]}deg)`;
      browR.style.transform = `translateY(${e.br[1]}px) rotate(${e.br[0]}deg)`;
      blush.style.opacity = e.blush;
      closed.setAttribute("d", e.mouth);
      if (!blinking) setLids(e.lid);
      setLook();
    }

    function setMouth(shape) {
      const m = MOUTHS[shape];
      if (!m) { open.setAttribute("display", "none"); closed.removeAttribute("display"); return; }
      closed.setAttribute("display", "none");
      open.removeAttribute("display");
      moShape.setAttribute("rx", m[0]);
      moShape.setAttribute("ry", m[1]);
      moShape.setAttribute("cy", 244 + m[1] * 0.35);
      moTeeth.setAttribute("visibility", m[2] ? "visible" : "hidden");
      moTeeth.setAttribute("y", 244 + m[1] * 0.35 - m[1] + 0.4);
      moTeeth.setAttribute("width", m[0] * 1.6);
      moTeeth.setAttribute("x", 200 - m[0] * 0.8);
    }

    function blink() {
      blinking = true;
      setLids(17);
      setTimeout(() => { blinking = false; setLids(expr.lid); }, 130);
    }
    (function blinkLoop() {
      setTimeout(() => { blink(); if (Math.random() < 0.2) setTimeout(blink, 260); blinkLoop(); }, 2200 + Math.random() * 3800);
    })();
    (function glanceLoop() {
      setTimeout(() => {
        glance = Math.random() < 0.55 ? [0, 0] : [(Math.random() - 0.5) * 6, (Math.random() - 0.5) * 2.5];
        setLook();
        glanceLoop();
      }, 1800 + Math.random() * 3000);
    })();

    setExpression("smug");
    return { setExpression, setMouth, blink, get expression() { return exprName; } };
  }

  window.MalfoidAvatar = { mount, expressions: Object.keys(EXPRESSIONS) };
})();
