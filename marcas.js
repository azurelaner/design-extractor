/*
  Marcas de template: conta, num lote de sites, as escolhas que fazem uma página
  parecer "site de IA genérico". Pra comparar a sua página com as referências.

  O que mede, a 1440x900, depois de rolar até o fim:
    recuo lateral do texto (px)      a margem esquerda do grid
    razão maior tipo / corpo         o quanto o título domina o texto corrido
    rótulo pequeno antes de título   o "SOBRE NÓS" em caixa alta em cima de cada h2
    título com trecho em acento      a palavra colorida ou em itálico no meio do título
    cabeçalho padrão                 barra fixa com 4+ links e um botão
    sticky + pin                     sequência fixada durante a rolagem
    fileiras                         3 a 6 cartões idênticos lado a lado
    transbordo no celular            página que rola pro lado a 390px

  Medido num lote real: cinco de seis sites de um estúdio de referência deram recuo
  de 32 a 48px, razão de 9 a 14 e 0 a 2 rótulos; quatro sites com cara de template deram
  recuo de 104 a 184px, razão de 3,5 a 6,4 e 6 a 12 rótulos.

  ⛔ MARCA NÃO É DEFEITO, É SINAL. Não é nota de aprovação: um site pode ter
  cabeçalho padrão e ser ótimo, e zerar as marcas destruindo a página não melhora
  nada. Serve pra transformar "tá genérico" numa lista endereçável, e SEMPRE junto
  do print rolado (captura.js).

  ⚠️ Mede o estado DEPOIS de rolar até o fim: elemento que some ao sair da tela
  (título de hero que desbota, vídeo que cresce) sai da conta e pode derrubar a
  razão. Nesse caso o número é artefato, não fato.

  Uso:
    node marcas.js <slug>=<url>[@TextoDoBotaoDoPortao] [...] [--saida arquivo.json]
*/

const fs = require("fs");
const { carregarPlaywright, opcoesDeLancamento } = require("./navegador");

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const MEDIR = () => {
  const vw = innerWidth;
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && parseFloat(s.opacity) > 0.05; };
  const own = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 2);
  const moda = (arr) => { const c = {}; arr.forEach((v) => (c[v] = (c[v] || 0) + 1)); return +Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]; };
  const pct = (arr, p) => { const a = [...arr].sort((x, y) => x - y); return a.length ? a[Math.floor((a.length - 1) * p)] : null; };

  // Recuo: o 10º percentil da borda esquerda dos blocos de texto é a margem do grid.
  const blocos = [...document.querySelectorAll("h1,h2,h3,p")].filter((el) => vis(el) && el.innerText.trim().length > 3);
  const esq = blocos.map((el) => el.getBoundingClientRect().left).filter((x) => x >= 0 && x < vw);
  const dir = blocos.map((el) => el.getBoundingClientRect().right).filter((x) => x > 0 && x <= vw + 1);
  const recuo = Math.round(pct(esq, 0.1));
  const direita = Math.round(pct(dir, 0.9));

  // Razão: o maior tipo visível sobre o corpo (a moda do tamanho de <p>).
  const textos = [...document.querySelectorAll("body *")].filter((el) => own(el) && vis(el));
  const tamanhos = textos.map((el) => parseFloat(getComputedStyle(el).fontSize));
  const ps = [...document.querySelectorAll("p")].filter(vis).map((el) => Math.round(parseFloat(getComputedStyle(el).fontSize)));
  const corpo = ps.length ? moda(ps) : 16;
  const maior = Math.round(Math.max(...tamanhos));

  // Acento: título com trecho em outra cor ou outro estilo (a palavra colorida ou em itálico).
  const titulos = [...document.querySelectorAll("h1,h2,h3")].filter(vis);
  let acentos = 0;
  titulos.forEach((h) => {
    const s = getComputedStyle(h);
    const tem = [...h.querySelectorAll("*")].some((x) => { const t = getComputedStyle(x); return (t.color !== s.color || t.fontStyle !== s.fontStyle) && (x.innerText || "").trim().length > 1; });
    if (tem) acentos++;
  });

  // Rótulo antes de título: texto pequeno em caixa alta ou espaçado logo antes de h2/h3.
  let rotulos = 0, introsCentradas = 0;
  [...document.querySelectorAll("h2,h3")].filter(vis).forEach((h) => {
    const ant = h.previousElementSibling;
    if (!ant || !vis(ant)) return;
    const s = getComputedStyle(ant);
    if (parseFloat(s.fontSize) <= 15 && (s.textTransform === "uppercase" || parseFloat(s.letterSpacing) >= 1) && ant.innerText.trim().length < 60) {
      rotulos++;
      if (getComputedStyle(h).textAlign === "center") introsCentradas++;
    }
  });

  // Cabeçalho padrão: barra fixa no topo, larga, 4+ links e um botão com borda ou fundo.
  const cab = [...document.querySelectorAll("header, nav, [class*=header], [class*=nav], [class*=topbar]")].find((el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return (s.position === "fixed" || s.position === "sticky") && r.top <= 5 && r.width > vw * 0.8; });
  const linksCab = cab ? [...cab.querySelectorAll("a")].filter(vis).length : 0;
  const ctaCab = cab ? [...cab.querySelectorAll("a,button")].some((a) => { const s = getComputedStyle(a); return vis(a) && (parseFloat(s.borderTopWidth) > 0 || (s.backgroundColor !== "rgba(0, 0, 0, 0)" && s.backgroundColor !== "transparent")); }) : false;

  // Fileira de 3 a 6 cartões idênticos lado a lado.
  let fileiras = 0;
  document.querySelectorAll("body *").forEach((p) => {
    const k = [...p.children].filter(vis);
    if (k.length < 3 || k.length > 6) return;
    const cls = k.map((x) => (x.className || "").toString());
    if (new Set(cls).size !== 1 || !cls[0]) return;
    const ws = k.map((x) => Math.round(x.getBoundingClientRect().width));
    const ts = k.map((x) => Math.round(x.getBoundingClientRect().top));
    if (new Set(ws).size === 1 && new Set(ts).size === 1 && ws[0] > 150 && ws[0] < vw * 0.4) fileiras++;
  });

  return {
    recuo, larguraUtil: direita - recuo, corpo, maior, razao: +(maior / corpo).toFixed(1),
    titulos: titulos.length, acentos, rotulos, introsCentradas,
    cabecalhoPadrao: linksCab >= 4 && ctaCab,
    sticky: [...document.querySelectorAll("body *")].filter((el) => getComputedStyle(el).position === "sticky").length,
    pinSpacers: document.querySelectorAll(".pin-spacer").length,
    fileiras, alturaDoc: document.documentElement.scrollHeight,
  };
};

async function entrar(pg, portao) {
  if (!portao) return;
  const vp = pg.viewportSize();
  try { await pg.getByRole("button", { name: new RegExp(portao, "i") }).first().click({ timeout: 5000 }); }
  catch { await pg.mouse.click(vp.width / 2, vp.height * 0.574); }
  await espera(2500);
}

(async () => {
  const args = process.argv.slice(2);
  const iSaida = args.indexOf("--saida");
  const arquivo = iSaida >= 0 ? args.splice(iSaida, 2)[1] : null;
  if (!args.length) { console.error("uso: node marcas.js <slug>=<url>[@Portao] [...] [--saida arquivo.json]"); process.exit(1); }

  const { chromium } = carregarPlaywright();
  const nav = await chromium.launch(opcoesDeLancamento(["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]));
  const saida = {};
  for (const alvo of args) {
    const i = alvo.indexOf("=");
    const slug = alvo.slice(0, i);
    const [url, portao] = alvo.slice(i + 1).split("@");
    try {
      const pg = await nav.newPage({ viewport: { width: 1440, height: 900 } });
      await pg.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      try { await pg.waitForLoadState("networkidle", { timeout: 20000 }); } catch {}
      await espera(2500);
      await entrar(pg, portao);
      await pg.mouse.move(720, 450);
      let yAnt = -1, iguais = 0;
      for (let k = 0; k < 60; k++) {
        await pg.mouse.wheel(0, 600);
        await espera(300);
        const y = await pg.evaluate(() => Math.round(scrollY));
        if (y === yAnt) { if (++iguais >= 3) break; } else iguais = 0;
        yAnt = y;
      }
      await espera(1200);
      const m = await pg.evaluate(MEDIR);
      await pg.close();

      // Transbordo lateral no celular: página que rola pro lado a 390px.
      const pm = await nav.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await pm.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      try { await pm.waitForLoadState("networkidle", { timeout: 20000 }); } catch {}
      await espera(2000);
      await entrar(pm, portao);
      m.transbordoCelular = await pm.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      await pm.close();

      saida[slug] = m;
      console.log(`${slug.padEnd(14)} recuo ${String(m.recuo).padStart(4)}  razão ${String(m.razao).padStart(4)}  rótulos ${String(m.rotulos).padStart(2)}  acentos ${String(m.acentos).padStart(2)}  cabeçalho-padrão ${m.cabecalhoPadrao ? "SIM" : "não"}  sticky ${m.sticky} pin ${m.pinSpacers}  fileiras ${m.fileiras}  transbordo-celular ${m.transbordoCelular}px`);
    } catch (e) { console.log(`✗ ${slug}: ${e.message}`); }
  }
  await nav.close();
  if (arquivo) fs.writeFileSync(arquivo, JSON.stringify(saida, null, 2));
  console.log("\n⛔ Marca é sinal, não defeito. Abrir o print rolado antes de mexer em qualquer coisa.");
})();
