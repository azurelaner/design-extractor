(() => {
  if (window.__dxPicker) { window.__dxPicker.stop(); return; }

  const MAX_NODES = 400;
  const STATE_RE = /:(hover|focus-visible|focus-within|focus|active|visited|checked|disabled|target|placeholder-shown|open)\b/g;
  const SKIP = /webkit|moz-|app-region|-(block|inline)-(start|end)|^(block|inline)-size|^(min|max)-(block|inline)|border-(start|end)-(start|end)-radius|^overflow-(block|inline)|^perspective|^transform-origin|^animation-|^transition-|^scroll-|^math-|^text-emphasis|^-/;

  // Longhands que o Chrome expande: emite o shorthand e descarta as partes.
  const SHORTHANDS = [
    ["border-radius", /radius$/],
    ["padding", /^padding-/],
    ["margin", /^margin-/],
    ["border-width", /^border-\w+-width$/],
    ["border-style", /^border-\w+-style$/],
    ["border-color", /^border-\w+-color$/],
    ["gap", /^(row|column)-gap$/],
    ["overflow", /^overflow-(x|y)$/],
    ["white-space", /^text-wrap-(mode|style)$|^white-space-collapse$/],
    ["transition", /^transition-/],
    ["animation", /^animation-/],
  ];
  const PSEUDO_PROPS = ["content", "position", "inset", "width", "height", "background-color", "background-image", "border", "border-radius", "box-shadow", "transform", "opacity", "filter", "backdrop-filter", "color", "font-family", "font-size", "font-weight", "mix-blend-mode", "z-index", "mask-image", "clip-path", "transition"];
  const EMPTY = new Set(["none", "auto", "normal", "0px", "rgba(0, 0, 0, 0)", "static", "0s", "", "all", "0px none rgb(0, 0, 0)", "matrix(1, 0, 0, 1, 0, 0)", "1"]);

  // ---------- varredura das folhas de estilo (uma vez só) ----------
  const stateRules = [], fontFaces = [], keyframes = new Map();
  (function collect() {
    const walk = (rules, cond) => {
      for (const r of rules) {
        try {
          if (r.styleSheet) { walk(r.styleSheet.cssRules, cond); continue; }      // @import
          if (r.selectorText) {
            if (r.selectorText.match(STATE_RE)) stateRules.push({ r, cond });
            continue;
          }
          if (r.name && r.cssRules) { keyframes.set(r.name, r); continue; }        // @keyframes
          if (r.style && r.cssText.startsWith("@font-face")) { fontFaces.push(r); continue; }
          if (r.cssRules) walk(r.cssRules, [cond, r.conditionText].filter(Boolean).join(" and "));
        } catch { /* regra cross-origin ou exótica */ }
      }
    };
    for (const sheet of document.styleSheets) {
      try { walk(sheet.cssRules, ""); } catch { /* folha cross-origin: inacessível */ }
    }
  })();

  const stateCache = new WeakMap();
  function statesFor(el) {
    if (stateCache.has(el)) return stateCache.get(el);
    const found = [];
    for (const { r, cond } of stateRules) {
      for (const part of r.selectorText.split(",")) {
        STATE_RE.lastIndex = 0;
        const states = [...part.matchAll(STATE_RE)].map((m) => m[1]);
        if (!states.length) continue;
        const bare = part.replace(STATE_RE, "").trim();
        try { if (!bare || !el.matches(bare)) continue; } catch { continue; }
        found.push({ states, cond, sel: part.trim(), decls: r.style.cssText });
        break;
      }
    }
    stateCache.set(el, found);
    return found;
  }

  function pseudosFor(el) {
    return ["::before", "::after"].map((p) => {
      const cs = getComputedStyle(el, p);
      if (cs.content === "none" || !cs.content) return null;
      const decorative = cs.content === '""' || cs.content === "''";
      const decls = PSEUDO_PROPS.map((k) => [k, cs.getPropertyValue(k)])
        .filter(([k, v]) => v && (k === "content" || !EMPTY.has(v)))
        .filter(([k]) => !(decorative && /^(color|font-)/.test(k)))
        .map(([k, v]) => `${k}: ${v}`);
      return { p, decls };
    }).filter(Boolean);
  }

  // ---------- defaults do user-agent, medidos num iframe limpo ----------
  const sandbox = document.createElement("iframe");
  sandbox.style.cssText = "position:fixed;left:-9999px;width:0;height:0;border:0";
  const defaultsCache = new Map();
  function defaultsFor(tag) {
    if (!defaultsCache.has(tag)) {
      const doc = sandbox.contentDocument;
      const probe = doc.createElement(tag);
      doc.body.appendChild(probe);
      const cs = getComputedStyle(probe), out = {};
      for (const p of cs) out[p] = cs.getPropertyValue(p);
      for (const [sh] of SHORTHANDS) out[sh] = cs.getPropertyValue(sh);
      probe.remove();
      defaultsCache.set(tag, out);
    }
    return defaultsCache.get(tag);
  }

  function styleAttr(el) {
    const cs = getComputedStyle(el);
    const def = defaultsFor(el.tagName.toLowerCase());
    const out = [], drop = [];
    for (const [sh, longhands] of SHORTHANDS) {
      const v = cs.getPropertyValue(sh);
      if (!v) continue;                    // lados diferentes: o Chrome devolve "", mantém os longhands
      drop.push(longhands);
      if (v !== def[sh]) out.push(`${sh}: ${v}`);
    }
    const inFlow = cs.position === "static" || cs.position === "relative";
    for (const p of cs) {
      if (p.startsWith("--") || SKIP.test(p) || drop.some((re) => re.test(p))) continue;
      const v = cs.getPropertyValue(p);
      if (!v || v === def[p]) continue;
      if (inFlow && v === "0px" && /^(top|right|bottom|left)$/.test(p)) continue;
      out.push(`${p}: ${v}`);
    }
    return out.sort().join("; ");
  }

  const selectorOf = (el) =>
    el.tagName.toLowerCase() +
    (el.id ? `#${el.id}` : "") +
    (typeof el.className === "string" && el.className.trim()
      ? "." + el.className.trim().split(/\s+/).join(".") : "");

  // ---------- extração ----------
  function extract(root) {
    document.documentElement.appendChild(sandbox);
    const clone = root.cloneNode(true);
    const origs = [root, ...root.querySelectorAll("*")];
    const clones = [clone, ...clone.querySelectorAll("*")];
    const fonts = new Set(), colors = new Set(), shadows = new Set(), anims = new Set();
    const states = [], pseudos = [];
    const n = Math.min(origs.length, MAX_NODES);

    // Animações rodando envenenam os estilos computados (opacity: 0.994...). Lê o `animation`
    // antes, congela a subárvore e mede o estado base — os @keyframes vão à parte.
    const running = [];
    for (let i = 0; i < n; i++) {
      const cs = getComputedStyle(origs[i]);
      running[i] = cs.animationName === "none" ? null : { shorthand: cs.animation, names: cs.animationName.split(", ") };
    }
    const freeze = document.createElement("style");
    freeze.textContent = "[data-dx-freeze],[data-dx-freeze] *{animation-name:none !important}";
    document.head.appendChild(freeze);
    root.setAttribute("data-dx-freeze", "");

    for (let i = 0; i < n; i++) {
      const o = origs[i], c = clones[i];
      if (o.tagName === "SCRIPT" || o.tagName === "STYLE" || o.tagName === "NOSCRIPT") { c.remove(); continue; }
      c.setAttribute("style", styleAttr(o));
      if (o.tagName === "IMG") c.setAttribute("src", o.currentSrc || o.src);
      const cs = getComputedStyle(o);
      fonts.add(`${cs.fontFamily} ${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight}`);
      colors.add(cs.color);
      if (cs.backgroundColor !== "rgba(0, 0, 0, 0)") colors.add(cs.backgroundColor);
      if (cs.backgroundImage !== "none") colors.add(cs.backgroundImage);
      if (cs.boxShadow !== "none") shadows.add(cs.boxShadow);
      if (cs.textShadow !== "none") shadows.add(`text: ${cs.textShadow}`);
      if (running[i]) {
        c.style.animation = running[i].shorthand;
        running[i].names.forEach((a) => anims.add(a));
      }
      const sel = selectorOf(o);
      for (const s of statesFor(o)) states.push(s);
      for (const ps of pseudosFor(o)) pseudos.push({ ...ps, sel });
    }
    root.removeAttribute("data-dx-freeze");
    freeze.remove();
    const truncated = origs.length > MAX_NODES;
    for (let i = MAX_NODES; i < clones.length; i++) clones[i].remove();
    sandbox.remove();

    const box = root.getBoundingClientRect();
    const families = [...fonts].map((f) => f.split(",")[0].replace(/["']/g, "").trim());
    const faces = fontFaces.filter((r) =>
      families.some((f) => r.style.fontFamily.replace(/["']/g, "").toLowerCase().includes(f.toLowerCase())));
    const usedKeyframes = [...anims].map((a) => keyframes.get(a)).filter(Boolean);

    const section = (title, body) => (body ? `\n## ${title}\n${body}\n` : "");
    const css = (body) => "```css\n" + body + "\n```";

    return [
      "Recrie este componente exatamente como especificado abaixo.",
      "",
      `Origem: ${location.href}`,
      `Seletor: ${selectorOf(root)}`,
      `Tamanho renderizado: ${Math.round(box.width)}x${Math.round(box.height)}px`,
      truncated ? `(subárvore truncada em ${MAX_NODES} nós)` : "",
      "",
      "## HTML (estilos computados inline)",
      "```html",
      clone.outerHTML,
      "```",
      section("Estados interativos", states.length && css(
        states.map((s) => (s.cond ? `@media ${s.cond} { ${s.sel} { ${s.decls} } }` : `${s.sel} { ${s.decls} }`)).join("\n"))),
      section("Pseudo-elementos", pseudos.length && css(
        pseudos.map((p) => `${p.sel}${p.p} { ${p.decls.join("; ")} }`).join("\n"))),
      section("Animações", usedKeyframes.length && css(usedKeyframes.map((k) => k.cssText).join("\n"))),
      section("Fontes", faces.length && css(faces.map((f) => f.cssText).join("\n"))),
      "## Tokens",
      `Tipografia: ${[...fonts].slice(0, 8).join(" | ")}`,
      `Cores: ${[...colors].slice(0, 16).join(" | ")}`,
      shadows.size ? `Sombras: ${[...shadows].slice(0, 6).join(" | ")}` : "",
    ].filter(Boolean).join("\n");
  }

  // ---------- overlay (shadow DOM: o CSS da página não vaza pra cá) ----------
  const host = document.createElement("div");
  host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none";
  const sh = host.attachShadow({ mode: "open" });
  sh.innerHTML = `<style>
    .card, .card * { font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; }
    .box, .pad { position: fixed; pointer-events: none; box-sizing: border-box; }
    .box { border: 1px solid #3b82f6; background: rgba(59,130,246,.12); }
    .pad { background: rgba(16,185,129,.18); }
    .card { position: fixed; max-width: 320px; padding: 10px 12px; border-radius: 10px;
      background: #0b0f19f2; color: #e5e7eb; box-shadow: 0 10px 40px #0009;
      border: 1px solid #ffffff1f; backdrop-filter: blur(6px); }
    .sel { color: #93c5fd; font-weight: 600; word-break: break-all; margin-bottom: 6px; }
    .row { display: flex; align-items: baseline; gap: 6px; color: #9ca3af; margin-top: 3px; }
    .row > span { flex: none; }
    .row b { color: #e5e7eb; font-weight: 500; flex: 1; min-width: 0; overflow-wrap: anywhere; }
    .sw { width: 12px; height: 12px; border-radius: 3px; border: 1px solid #ffffff40; flex: none; }
    .chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
    .chip { padding: 2px 7px; border-radius: 999px; background: #3b82f629; color: #93c5fd;
      border: 1px solid #3b82f64d; font-size: 11px; }
    .chip.ps { background: #a855f729; color: #d8b4fe; border-color: #a855f74d; }
    .hint { margin-top: 8px; padding-top: 7px; border-top: 1px solid #ffffff1a; color: #6b7280; font-size: 11px; }
    .ok { background: #052e16f7; border-color: #16a34a; }
    .ok .sel { color: #4ade80; }
  </style>
  <div class="box"></div><div class="pad"></div>
  <div class="card"><div class="sel"></div><div class="body"></div><div class="chips"></div>
  <div class="hint">clique copia · ↑ pai · ↓ filho · ESC sai</div></div>`;
  document.documentElement.appendChild(host);
  const $ = (s) => sh.querySelector(s);
  const [boxEl, padEl, cardEl, selEl, bodyEl, chipsEl] =
    [".box", ".pad", ".card", ".sel", ".body", ".chips"].map($);

  const px = (v) => parseFloat(v) || 0;
  const short = (v, n = 44) => (v.length > n ? v.slice(0, n - 1) + "…" : v);

  function row(label, value, swatches, max) {
    const d = document.createElement("div");
    d.className = "row";
    for (const c of swatches || []) {
      const s = document.createElement("span");
      s.className = "sw";
      s.style.background = c;
      d.appendChild(s);
    }
    const t = document.createElement("span");
    t.textContent = label ? `${label} ` : "";
    const b = document.createElement("b");
    b.textContent = short(value, max || 44);
    d.append(t, b);
    return d;
  }

  let target = null, mouse = { x: 0, y: 0 };

  function setTarget(el) {
    if (!el || el === target) return;
    target = el;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    Object.assign(boxEl.style, { top: r.top + "px", left: r.left + "px", width: r.width + "px", height: r.height + "px" });
    Object.assign(padEl.style, {
      top: r.top + px(cs.borderTopWidth) + px(cs.paddingTop) + "px",
      left: r.left + px(cs.borderLeftWidth) + px(cs.paddingLeft) + "px",
      width: Math.max(0, r.width - px(cs.borderLeftWidth) - px(cs.borderRightWidth) - px(cs.paddingLeft) - px(cs.paddingRight)) + "px",
      height: Math.max(0, r.height - px(cs.borderTopWidth) - px(cs.borderBottomWidth) - px(cs.paddingTop) - px(cs.paddingBottom)) + "px",
    });

    selEl.textContent = short(selectorOf(el), 60);
    bodyEl.textContent = "";
    bodyEl.append(
      row("", `${Math.round(r.width)} × ${Math.round(r.height)} · ${cs.display}${cs.position !== "static" ? " · " + cs.position : ""}`),
      row("", `${cs.color}  ${cs.backgroundColor}`, [cs.color, cs.backgroundColor]),
      row("", `${cs.fontFamily.split(",")[0].replace(/["']/g, "")} ${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight}`),
      row("box", `pad ${cs.padding || "-"} · radius ${cs.borderRadius} · border ${cs.borderWidth} ${cs.borderStyle}`, null, 70),
    );
    if (cs.boxShadow !== "none") bodyEl.append(row("shadow", cs.boxShadow, null, 70));
    if (cs.transitionDuration !== "0s") bodyEl.append(row("anim", cs.transition, null, 70));

    chipsEl.textContent = "";
    const seen = new Set();
    for (const s of statesFor(el)) for (const st of s.states) {
      if (seen.has(st)) continue;
      seen.add(st);
      const c = document.createElement("span");
      c.className = "chip";
      c.textContent = ":" + st;
      chipsEl.appendChild(c);
    }
    for (const p of pseudosFor(el)) {
      const c = document.createElement("span");
      c.className = "chip ps";
      c.textContent = p.p;
      chipsEl.appendChild(c);
    }
    if (cs.animationName !== "none") {
      const c = document.createElement("span");
      c.className = "chip ps";
      c.textContent = "@" + cs.animationName;
      chipsEl.appendChild(c);
    }
    placeCard();
  }

  function placeCard() {
    const w = cardEl.offsetWidth, h = cardEl.offsetHeight;
    const x = mouse.x + 18 + w > innerWidth ? Math.max(8, mouse.x - 18 - w) : mouse.x + 18;
    const y = mouse.y + 18 + h > innerHeight ? Math.max(8, mouse.y - 18 - h) : mouse.y + 18;
    cardEl.style.left = x + "px";
    cardEl.style.top = y + "px";
  }

  const onMove = (e) => {
    mouse = { x: e.clientX, y: e.clientY };
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && el !== host) setTarget(el);
    else placeCard();
  };
  const onKey = (e) => {
    if (e.key === "Escape") { swallow(e); return stop(); }
    if (!target) return;
    if (e.key === "ArrowUp" && target.parentElement && target.parentElement !== document.documentElement) { swallow(e); setTarget(target.parentElement); }
    else if (e.key === "ArrowDown" && target.firstElementChild) { swallow(e); setTarget(target.firstElementChild); }
    else if (e.key === "Enter") { swallow(e); copy(); }
  };
  const onClick = (e) => { swallow(e); copy(); };
  const swallow = (e) => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); };

  function copy() {
    if (!target) return;
    const text = extract(target);
    const ok = () => done(text.length);
    navigator.clipboard.writeText(text).then(ok, () => {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      ok();
    });
  }

  function done(len) {
    detach();
    boxEl.remove(); padEl.remove();
    cardEl.classList.add("ok");
    selEl.textContent = "✓ design copiado";
    bodyEl.textContent = "";
    bodyEl.append(row("", `${len.toLocaleString()} caracteres no clipboard`));
    chipsEl.textContent = "";
    $(".hint").textContent = "cole em qualquer agente de IA";
    setTimeout(() => host.remove(), 1800);
    window.__dxPicker = null;
  }
  function detach() {
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("mousedown", swallow, true);
    document.removeEventListener("mouseup", swallow, true);
    document.removeEventListener("keydown", onKey, true);
  }
  function stop() { detach(); host.remove(); window.__dxPicker = null; }

  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("mousedown", swallow, true);
  document.addEventListener("mouseup", swallow, true);
  document.addEventListener("keydown", onKey, true);
  window.__dxPicker = { stop, setTarget };
  window.__dxExtract = extract; // usado pelo test.html
})();
