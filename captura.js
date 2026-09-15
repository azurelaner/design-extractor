/*
  Captura de referência de site: ESTRUTURA, MOVIMENTO e BUILD, rolando de verdade.

  Irmão do paleta.js (o sistema de cor por área) e do extrair.js (o CSS de UM
  componente). Existe porque print de página inteira mente: não dispara lazy-load,
  animação por rolagem nem pin, e devolve galeria vazia.

  O que sai em <pasta>/<slug>/:
    d-intro-a/b/c.jpg  abertura aos 250, 1250 e 2650 ms (preloader, intro)
    d-00-dobra.jpg     a dobra depois de a rede assentar
    d-NN-rolagem.jpg   um quadro por passo de ~900px, rolando pela RODA do mouse
                       (Lenis e rolagem virtual respondem à roda, não a scrollTo)
    m-*.jpg            o mesmo no celular (390x844 @2x)
    relatorio.json     rede por tipo, libs no window, assinaturas no JS baixado,
                       tokens do :root, keyframes, recursos CSS, fixos e sticky,
                       ScrollTriggers, seções, escala tipográfica, botões, LCP
                       headless e transbordo lateral no celular
    dom.html, texto.txt, js/, css/   pra entender COMO foi feito

  Uso:
    node captura.js <pasta-saida> <slug>=<url> [<slug>=<url> ...]

  Site com portão (botão "Entrar" depois do preloader e rolagem presa até o clique):
    CLICAR=Entrar node captura.js ...
  Tenta pelo nome acessível; se o texto vier partido em letras (efeito de hover),
  clica no centro do botão achado pelo texto.

  Resumo legível de uma captura:  node captura-resumo.js <pasta-saida> <slug>

  ⚠️ js/, css/, dom.html e texto.txt são material de TERCEIRO: servem pra estudar a
  técnica, não pra copiar nem redistribuir. Rode numa pasta fora do seu repositório
  e guarde só os prints e o relatorio.json que for usar.
  ⚠️ LCP e tempos saem de Chromium headless sem GPU: servem pra comparar sites entre
  si na mesma máquina, não como número de campo.
*/

const path = require("path");
const fs = require("fs");
const { carregarPlaywright, opcoesDeLancamento } = require("./navegador");

function morrer(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// --- coleta dentro da página ------------------------------------------------
const META = () => {
  const descr = (el) => {
    if (!el || !el.tagName) return String(el);
    const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
    return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${cls ? "." + cls : ""}`;
  };
  const g = window;
  const nomes = ["gsap", "ScrollTrigger", "ScrollSmoother", "SplitText", "Flip", "Observer", "CustomEase", "Draggable", "MorphSVGPlugin", "DrawSVGPlugin", "MotionPathPlugin", "Lenis", "lenis", "THREE", "barba", "swup", "Swiper", "Splide", "Flickity", "LocomotiveScroll", "SplitType", "Splitting", "anime", "jQuery", "AOS", "lottie", "bodymovin", "PIXI", "Webflow", "elementorFrontend", "wp", "__NEXT_DATA__", "__NUXT__", "React", "Vue", "Alpine", "Motion", "rive", "Matter", "p5", "Typed", "Rellax", "simpleParallax", "ScrollReveal", "Vimeo", "YT", "Plyr", "Hls"];
  const libs = {};
  for (const n of nomes) if (typeof g[n] !== "undefined") libs[n] = (g[n] && g[n].version) || true;
  if (g.gsap) {
    try {
      const tw = g.gsap.globalTimeline.getChildren(true, true, true);
      libs.gsapTweens = tw.length;
      libs.gsapAmostra = tw.slice(0, 50).map((t) => ({
        alvos: (t.targets ? t.targets() : []).slice(0, 2).map(descr),
        vars: Object.keys(t.vars || {}).filter((k) => !/^on[A-Z]/.test(k)).slice(0, 10),
        dur: t.duration ? +t.duration().toFixed(2) : null,
        st: !!t.scrollTrigger,
      }));
    } catch (e) { libs.gsapErro = String(e); }
  }
  if (g.ScrollTrigger && g.ScrollTrigger.getAll) {
    try {
      libs.scrollTriggers = g.ScrollTrigger.getAll().slice(0, 60).map((st) => ({
        trigger: descr(st.trigger), pin: !!st.pin, scrub: st.vars.scrub, start: String(st.vars.start || ""), end: String(st.vars.end || ""), toggle: st.vars.toggleActions || "",
      }));
    } catch {}
  }
  const tokens = {};
  const recursos = {};
  const keyframes = [];
  const mediaQueries = new Set();
  const testes = { "animation-timeline": /animation-timeline/, "view-timeline/scroll()": /view\(|scroll\(\)|view-timeline|scroll-timeline/, "clip-path": /clip-path/, "mix-blend-mode": /mix-blend-mode/, "backdrop-filter": /backdrop-filter/, "mask-image": /mask(-image)?:/, "@property": /@property/, "text-stroke": /text-stroke/, "container-queries": /@container/, "clamp()": /clamp\(/, "svh/dvh": /\d(s|d|l)vh/, "grid-template-areas": /grid-template-areas/, sticky: /position:\s*sticky/, "filter:blur": /filter:\s*blur/, "scroll-snap": /scroll-snap/, "font-variation": /font-variation-settings/, "text-wrap:balance": /text-wrap:\s*(balance|pretty)/, "gradient-text": /background-clip:\s*text/, "view-transition": /view-transition/, "perspective/3d": /perspective|rotate3d|preserve-3d/ };
  for (const folha of document.styleSheets) {
    let regras;
    try { regras = folha.cssRules; } catch { recursos["(css cross-origin ilegível)"] = (recursos["(css cross-origin ilegível)"] || 0) + 1; continue; }
    const varrer = (lista) => {
      for (const r of lista || []) {
        const txt = r.cssText || "";
        if (r.type === 7) keyframes.push(r.name);
        if (r.type === 4) mediaQueries.add(r.conditionText || (r.media && r.media.mediaText));
        for (const [k, re] of Object.entries(testes)) if (re.test(txt)) recursos[k] = (recursos[k] || 0) + 1;
        if (r.style && r.selectorText && /^(:root|html|body)/.test(r.selectorText)) {
          for (const p of r.style) if (p.startsWith("--")) tokens[p] = r.style.getPropertyValue(p).trim();
        }
        if (r.cssRules) varrer(r.cssRules);
      }
    };
    varrer(regras);
  }
  const fixos = [...document.querySelectorAll("body *")]
    .filter((el) => { const s = getComputedStyle(el); return (s.position === "fixed" || s.position === "sticky") && s.display !== "none"; })
    .slice(0, 30)
    .map((el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return { el: descr(el), pos: s.position, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), pe: s.pointerEvents, blend: s.mixBlendMode, z: s.zIndex, texto: (el.innerText || "").trim().slice(0, 60) }; });
  const fontes = [...new Set([...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.family.replace(/["']/g, "")} ${f.weight} ${f.style}`))];
  return {
    url: location.href,
    titulo: document.title,
    descricao: (document.querySelector('meta[name="description"]') || {}).content || "",
    generator: (document.querySelector('meta[name="generator"]') || {}).content || "",
    htmlClasses: document.documentElement.className.slice(0, 200),
    bodyClasses: document.body.className.slice(0, 200),
    lang: document.documentElement.lang,
    alturaDoc: document.documentElement.scrollHeight,
    larguraDoc: document.documentElement.scrollWidth,
    cursorBody: getComputedStyle(document.body).cursor,
    libs,
    scripts: [...document.scripts].map((s) => s.src || `inline:${s.textContent.length}c ${s.type || ""}`.trim()),
    estilos: [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href),
    fontes,
    tokens,
    recursosCSS: recursos,
    keyframes: [...new Set(keyframes)],
    mediaQueries: [...mediaQueries].slice(0, 40),
    fixos,
    canvas: [...document.querySelectorAll("canvas")].map((c) => ({ el: descr(c), w: c.width, h: c.height, engine: c.dataset.engine || "" })),
    videos: [...document.querySelectorAll("video")].map((v) => ({ src: v.currentSrc || v.src || (v.querySelector("source") || {}).src || "", autoplay: v.autoplay, loop: v.loop, muted: v.muted, poster: v.poster, w: v.videoWidth, h: v.videoHeight })),
    iframes: [...document.querySelectorAll("iframe")].map((f) => f.src),
    svgs: document.querySelectorAll("svg").length,
    imgs: document.querySelectorAll("img").length,
    animacoesCSS: document.getAnimations().slice(0, 40).map((a) => ({ nome: a.animationName || a.transitionProperty || a.constructor.name, alvo: descr(a.effect && a.effect.target), dur: a.effect && a.effect.getTiming ? a.effect.getTiming().duration : null, iter: a.effect && a.effect.getTiming ? a.effect.getTiming().iterations : null })),
  };
};

const ESBOCO = () => {
  const descr = (el) => {
    if (!el || !el.tagName) return String(el);
    const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
    return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${cls ? "." + cls : ""}`;
  };
  const sy = scrollY;
  const textoProprio = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" ").replace(/\s+/g, " ").trim();
  const visivel = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 1 && r.height > 1 && s.display !== "none" && s.visibility !== "hidden"; };

  // Desce pelos invólucros de filho único até achar o nó cujos filhos são as seções.
  let no = document.body;
  for (let d = 0; d < 10; d++) {
    const filhos = [...no.children].filter((k) => visivel(k) && k.getBoundingClientRect().height > 60);
    const hNo = no.getBoundingClientRect().height || 1;
    const grandes = filhos.filter((k) => k.getBoundingClientRect().height > 0.7 * hNo);
    if (filhos.length === 1) { no = filhos[0]; continue; }
    if (grandes.length === 1 && filhos.length <= 4) { no = grandes[0]; continue; }
    break;
  }
  const secoes = [...no.children].filter((k) => visivel(k) && k.getBoundingClientRect().height >= 100).map((el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return {
      el: descr(el),
      topo: Math.round(r.top + sy),
      altura: Math.round(r.height),
      fundo: s.backgroundColor + (s.backgroundImage !== "none" ? " | " + s.backgroundImage.slice(0, 80) : ""),
      titulos: [...el.querySelectorAll("h1,h2,h3,h4")].slice(0, 6).map((h) => { const t = getComputedStyle(h); return { tag: h.tagName, texto: h.innerText.replace(/\s+/g, " ").trim().slice(0, 90), fonte: t.fontFamily.split(",")[0].replace(/["']/g, ""), tam: t.fontSize, peso: t.fontWeight, ls: t.letterSpacing, lh: t.lineHeight, tt: t.textTransform, cor: t.color }; }),
      amostra: (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 280),
      imgs: el.querySelectorAll("img").length,
      videos: el.querySelectorAll("video").length,
      canvas: el.querySelectorAll("canvas").length,
    };
  });

  const escala = new Map();
  for (const el of document.querySelectorAll("body *")) {
    const t = textoProprio(el);
    if (!t || !visivel(el)) continue;
    const s = getComputedStyle(el);
    const chave = [s.fontFamily.split(",")[0].replace(/["']/g, ""), s.fontSize, s.fontWeight, s.fontStyle, s.letterSpacing, s.textTransform].join(" | ");
    if (!escala.has(chave)) escala.set(chave, { n: 0, amostra: t.slice(0, 50), tag: el.tagName.toLowerCase(), lh: s.lineHeight, cor: s.color });
    escala.get(chave).n++;
  }
  const tipos = [...escala.entries()].sort((a, b) => parseFloat(b[0].split(" | ")[1]) - parseFloat(a[0].split(" | ")[1])).slice(0, 32).map(([k, v]) => ({ estilo: k, ...v }));

  const botoes = new Map();
  for (const el of document.querySelectorAll("a, button")) {
    const t = (el.innerText || "").trim();
    if (!t || t.length > 40 || !visivel(el)) continue;
    const s = getComputedStyle(el);
    const temFundo = s.backgroundColor !== "rgba(0, 0, 0, 0)" && s.backgroundColor !== "transparent";
    const temBorda = parseFloat(s.borderTopWidth) > 0;
    if (!temFundo && !temBorda) continue;
    const chave = [s.backgroundColor, s.color, s.borderTopWidth, s.borderTopColor, s.borderRadius].join("|");
    if (!botoes.has(chave)) botoes.set(chave, { texto: t, fundo: s.backgroundColor, cor: s.color, borda: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`, raio: s.borderRadius, padding: s.padding, fonte: `${s.fontFamily.split(",")[0]} ${s.fontSize} ${s.fontWeight} ${s.textTransform} ls:${s.letterSpacing}`, n: 0 });
    botoes.get(chave).n++;
  }

  const nav = document.querySelector("header nav, nav, header");
  return {
    raizDasSecoes: descr(no),
    secoes,
    tipos,
    botoes: [...botoes.values()].slice(0, 10),
    nav: nav ? (nav.innerText || "").replace(/\s+/g, " ").trim().slice(0, 300) : "",
    alturaDoc: document.documentElement.scrollHeight,
  };
};

const LCP = () => new Promise((res) => {
  let v = null;
  try {
    new PerformanceObserver((l) => { const e = l.getEntries(); v = e[e.length - 1]; }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch {}
  setTimeout(() => res(v ? { ms: Math.round(v.startTime), el: v.element ? v.element.tagName + "." + (v.element.className || "").toString().slice(0, 40) : "", url: v.url || "" } : null), 200);
});

// Indício, não prova: nome de lib no bundle minificado pode ser só dependência morta.
const ASSINATURAS = {
  gsap: /gsap|GreenSock/, ScrollTrigger: /ScrollTrigger/, SplitText: /SplitText/, Lenis: /lenis|Lenis/, three: /WebGLRenderer|THREE\./, ogl: /\bogl\b|new Renderer\(\{/,
  barba: /barba/, swup: /swup/i, swiper: /swiper/i, splide: /splide/i, splitType: /SplitType|split-type/, splitting: /Splitting/, "framer-motion": /framer-motion|motion\/react|useScroll|useTransform/,
  lottie: /lottie|bodymovin/, locomotive: /locomotive/i, rive: /@rive-app|\brive\b/, pixi: /PIXI|pixi\.js/, jquery: /jQuery/, aos: /\bAOS\b|aos-animate/, elementor: /elementor/i,
  react: /react-dom|__REACT|createElement\(/, vue: /__vue__|createApp|Vue\./, svelte: /svelte/, astro: /astro/i, vite: /vite|import\.meta/, next: /__NEXT_DATA__|next\/router/, nuxt: /__NUXT__/,
  intersectionObserver: /IntersectionObserver/, rAF: /requestAnimationFrame/, shaders: /gl_FragColor|precision (highp|mediump) float/, customCursor: /cursor/i, marquee: /marquee/i,
};

async function capturar(navegador, slug, url, saida) {
  const dir = path.join(saida, slug);
  fs.mkdirSync(path.join(dir, "js"), { recursive: true });
  fs.mkdirSync(path.join(dir, "css"), { recursive: true });
  const rede = [];
  const erros = [];
  const shot = async (pg, nome) => { try { await pg.screenshot({ path: path.join(dir, nome + ".jpg"), type: "jpeg", quality: 72 }); } catch (e) { erros.push(`shot ${nome}: ${e.message}`); } };
  const clicar = async (p) => {
    if (!process.env.CLICAR) return;
    const vp = p.viewportSize();
    try {
      await p.getByRole("button", { name: new RegExp(process.env.CLICAR, "i") }).first().click({ timeout: 6000 });
    } catch {
      const alvo = await p.evaluate((txt) => {
        const limpo = (s) => s.replace(/\s+/g, "").toLowerCase();
        const b = [...document.querySelectorAll("button, a, [role=button]")].find((el) => limpo(el.innerText || "").replace(/(.)\1/g, "$1").includes(txt.toLowerCase()));
        if (!b) return null;
        const r = b.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }, process.env.CLICAR);
      const x = alvo ? alvo.x : vp.width / 2, y = alvo ? alvo.y : vp.height * 0.574;
      await p.mouse.click(x, y).catch((e) => erros.push("clicar: " + e.message.slice(0, 120)));
      erros.push(`clicar: nome acessível falhou, cliquei em ${Math.round(x)},${Math.round(y)}`);
    }
    await espera(2800);
  };

  // --- DESKTOP ---
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36" });
  const pg = await ctx.newPage();
  let nJs = 0, nCss = 0;
  pg.on("requestfinished", async (req) => {
    try {
      const resp = await req.response();
      const tam = await req.sizes().then((s) => s.responseBodySize).catch(() => 0);
      const tipo = req.resourceType();
      rede.push({ url: req.url(), tipo, tam, status: resp ? resp.status() : 0 });
      if ((tipo === "script" && nJs < 40) || (tipo === "stylesheet" && nCss < 20)) {
        const corpo = await resp.body().catch(() => null);
        if (corpo && corpo.length < 4e6) {
          const base = req.url().split("?")[0].split("/").pop().replace(/[^a-z0-9._-]/gi, "_").slice(-70) || "sem-nome";
          if (tipo === "script") fs.writeFileSync(path.join(dir, "js", `${String(nJs++).padStart(2, "0")}-${base}`), corpo);
          else fs.writeFileSync(path.join(dir, "css", `${String(nCss++).padStart(2, "0")}-${base}`), corpo);
        }
      }
    } catch {}
  });
  pg.on("console", (m) => { if (m.type() === "error") erros.push("console: " + m.text().slice(0, 200)); });
  pg.on("pageerror", (e) => erros.push("pageerror: " + e.message.slice(0, 200)));

  const t0 = Date.now();
  await pg.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  const tDcl = Date.now() - t0;
  await espera(250); await shot(pg, "d-intro-a-0250ms");
  await espera(1000); await shot(pg, "d-intro-b-1250ms");
  await espera(1400); await shot(pg, "d-intro-c-2650ms");
  try { await pg.waitForLoadState("networkidle", { timeout: 25000 }); } catch { erros.push("networkidle estourou 25s"); }
  const tIdle = Date.now() - t0;
  await clicar(pg);
  await espera(1800);
  await shot(pg, "d-00-dobra");
  const meta = await pg.evaluate(META);
  const lcp = await pg.evaluate(LCP);

  await pg.mouse.move(720, 450);
  const passos = [];
  let yAnt = -1, iguais = 0;
  const virtual = meta.alturaDoc <= 920;
  const MAX = virtual ? 14 : 30;
  for (let i = 1; i <= MAX; i++) {
    for (let k = 0; k < 6; k++) { await pg.mouse.wheel(0, 150); await espera(45); }
    await espera(1150);
    const y = await pg.evaluate(() => Math.round(window.scrollY || (document.scrollingElement || {}).scrollTop || 0));
    await shot(pg, `d-${String(i).padStart(2, "0")}-rolagem`);
    passos.push({ i, y });
    if (!virtual) {
      if (y === yAnt) { iguais++; if (iguais >= 2) break; } else iguais = 0;
    }
    yAnt = y;
  }
  const esboco = await pg.evaluate(ESBOCO);
  const metaFim = await pg.evaluate(META);
  fs.writeFileSync(path.join(dir, "dom.html"), await pg.content());
  fs.writeFileSync(path.join(dir, "texto.txt"), await pg.evaluate(() => document.body.innerText));
  await ctx.close();

  // --- CELULAR ---
  const ctxM = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" });
  const pm = await ctxM.newPage();
  const passosM = [];
  let transbordo = null;
  try {
    await pm.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    try { await pm.waitForLoadState("networkidle", { timeout: 20000 }); } catch {}
    await clicar(pm);
    await espera(1800);
    await shot(pm, "m-00-dobra");
    transbordo = await pm.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, alturaDoc: document.documentElement.scrollHeight }));
    let yA = -1, ig = 0;
    for (let i = 1; i <= 16; i++) {
      await pm.evaluate(() => window.scrollBy(0, 760));
      await espera(900);
      let y = await pm.evaluate(() => Math.round(window.scrollY));
      if (y === yA) { await pm.mouse.wheel(0, 760).catch(() => {}); await espera(900); y = await pm.evaluate(() => Math.round(window.scrollY)); }
      await shot(pm, `m-${String(i).padStart(2, "0")}-rolagem`);
      passosM.push({ i, y });
      if (y === yA) { ig++; if (ig >= 2) break; } else ig = 0;
      yA = y;
    }
  } catch (e) { erros.push("celular: " + e.message.slice(0, 200)); }
  await ctxM.close();

  // --- assinaturas no JS baixado ---
  const achados = {};
  for (const f of fs.readdirSync(path.join(dir, "js"))) {
    const txt = fs.readFileSync(path.join(dir, "js", f), "utf-8");
    for (const [k, re] of Object.entries(ASSINATURAS)) if (re.test(txt)) (achados[k] = achados[k] || []).push(f);
  }
  const porTipo = {};
  for (const r of rede) porTipo[r.tipo] = (porTipo[r.tipo] || 0) + r.tam;
  const relatorio = {
    slug, url, capturadoEm: new Date().toISOString(), tempos: { domcontentloadedMs: tDcl, networkidleMs: tIdle }, lcpHeadless: lcp,
    rede: { total: rede.reduce((s, r) => s + r.tam, 0), porTipo, pedidos: rede.length, pesados: [...rede].sort((a, b) => b.tam - a.tam).slice(0, 20) },
    assinaturasJS: achados, meta, libsDepoisDaRolagem: metaFim.libs, animacoesDepois: metaFim.animacoesCSS, esboco, passos, passosCelular: passosM, celular: transbordo, erros,
  };
  fs.writeFileSync(path.join(dir, "relatorio.json"), JSON.stringify(relatorio, null, 2));
  const alerta = transbordo && transbordo.scrollWidth > transbordo.clientWidth ? ` ⚠️ transbordo no celular: ${transbordo.scrollWidth} > ${transbordo.clientWidth}` : "";
  console.log(`✓ ${slug}: ${passos.length} passos desktop, ${passosM.length} celular, alturaDoc ${esboco.alturaDoc}, ${Math.round(relatorio.rede.total / 1024)} KB, ${erros.length} erros${alerta}`);
}

(async () => {
  const [saida, ...alvos] = process.argv.slice(2);
  if (!saida || !alvos.length) morrer("uso: node captura.js <pasta-saida> <slug>=<url> [...]");
  const { chromium } = carregarPlaywright();
  const navegador = await chromium.launch(opcoesDeLancamento(["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"]));
  for (const a of alvos) {
    const i = a.indexOf("=");
    if (i < 1) { console.log(`✗ alvo sem slug: ${a} (formato slug=url)`); continue; }
    try { await capturar(navegador, a.slice(0, i), a.slice(i + 1), path.resolve(saida)); } catch (e) { console.log(`✗ ${a.slice(0, i)}: ${e.stack || e.message}`); }
  }
  await navegador.close();
  console.log("\n⚠️ Número não é revisão visual: ABRIR os quadros de rolagem antes de concluir qualquer coisa.");
})();
