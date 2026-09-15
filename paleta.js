/*
  Paleta e tipografia de uma página, por ÁREA PINTADA.

  Companheiro do extrair.js: ele devolve o CSS computado de UM componente, este
  devolve o sistema da página inteira.

  ⭐ A conta é ÁREA, não contagem de elementos. Contar ocorrências elege a cor do
  texto miúdo que se repete em 200 rótulos e ignora o fundo do hero que ocupa
  metade da tela. Cor de marca é a que o olho recebe, e o olho recebe área.

  Também colhe: as custom properties de :root, que muitas vezes JÁ SÃO a paleta
  declarada pelo autor; as famílias tipográficas por área de texto; raios de
  canto e sombras mais usados; e dois prints, a dobra e a página inteira.

  ## Uso

    node paleta.js <url> [pasta-saida]

  Sem pasta, grava em ./saida/paletas.
*/

const path = require("path");
const fs = require("fs");
const { carregarPlaywright, opcoesDeLancamento } = require("./navegador");

function morrer(mensagem) {
  console.error(`\n✗ ${mensagem}\n`);
  process.exit(1);
}

// --- a coleta, dentro da página --------------------------------------------
const COLETA = () => {
  const transparente = (c) => !c || c === "transparent" || /rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(c);
  const hex = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return c;
    const [r, g, b, a] = m[1].split(",").map((n) => parseFloat(n));
    const h = (n) => Math.round(n).toString(16).padStart(2, "0");
    const base = `#${h(r)}${h(g)}${h(b)}`;
    return a !== undefined && a < 1 ? `${base} @${a}` : base;
  };
  const somar = (mapa, chave, quanto) => {
    if (!chave) return;
    mapa[chave] = (mapa[chave] || 0) + quanto;
  };

  const fundos = {};
  const textos = {};
  const bordas = {};
  const fontes = {};
  const raios = {};
  const sombras = {};
  let areaTotal = 0;

  for (const el of document.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || parseFloat(s.opacity) === 0) continue;
    const area = r.width * r.height;
    areaTotal += area;

    if (!transparente(s.backgroundColor)) somar(fundos, hex(s.backgroundColor), area);
    if (s.backgroundImage && s.backgroundImage.includes("gradient")) {
      somar(fundos, `gradiente: ${s.backgroundImage.slice(0, 90)}`, area);
    }

    // Texto conta pela área da CAIXA DE TEXTO, não do bloco: parágrafo dentro de
    // section não faz a cor do texto valer a página inteira.
    const temTextoProprio = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (temTextoProprio) {
      const linhas = Math.max(1, Math.round(r.height / (parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.2 || 16)));
      const areaTexto = Math.min(area, (el.textContent.trim().length || 1) * parseFloat(s.fontSize) * 0.5 * linhas);
      somar(textos, hex(s.color), areaTexto);
      somar(fontes, `${s.fontFamily.split(",")[0].replace(/["']/g, "")} ${s.fontWeight}`, areaTexto);
    }

    if (parseFloat(s.borderTopWidth) > 0 && !transparente(s.borderTopColor)) {
      somar(bordas, hex(s.borderTopColor), (r.width + r.height) * 2);
    }
    if (parseFloat(s.borderTopLeftRadius) > 0) somar(raios, s.borderTopLeftRadius, area);
    if (s.boxShadow && s.boxShadow !== "none") somar(sombras, s.boxShadow.slice(0, 70), area);
  }

  // As custom properties de :root costumam SER a paleta declarada pelo autor.
  const tokens = {};
  for (const folha of document.styleSheets) {
    let regras;
    try {
      regras = folha.cssRules;
    } catch {
      continue; // cross-origin sem CORS
    }
    for (const regra of regras || []) {
      if (!regra.style || !regra.selectorText) continue;
      if (!/^(:root|html|body|\[data-theme|\.dark|\.light)/.test(regra.selectorText)) continue;
      for (const prop of regra.style) {
        if (prop.startsWith("--")) tokens[prop] = regra.style.getPropertyValue(prop).trim();
      }
    }
  }

  const topo = (mapa, n = 14) =>
    Object.entries(mapa)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k, v]) => ({ valor: k, area: Math.round(v), pct: areaTotal ? +((100 * v) / areaTotal).toFixed(2) : 0 }));

  return {
    url: location.href,
    titulo: document.title,
    fundos: topo(fundos),
    textos: topo(textos),
    bordas: topo(bordas, 8),
    fontes: topo(fontes, 10),
    raios: topo(raios, 6),
    sombras: topo(sombras, 5),
    tokens,
    imagens: [...document.querySelectorAll("img, svg")]
      .slice(0, 40)
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        src: el.getAttribute("src") || "",
        alt: el.getAttribute("alt") || "",
        classe: (el.getAttribute("class") || "").slice(0, 60),
      }))
      .filter((i) => /logo|marca|brand|icon/i.test(i.src + i.alt + i.classe)),
  };
};

// --- relatório --------------------------------------------------------------
function md(d, prints) {
  const linha = (x) => `| \`${x.valor}\` | ${x.pct}% |`;
  const bloco = (titulo, lista) =>
    lista.length ? `\n### ${titulo}\n\n| valor | área da página |\n|---|---|\n${lista.map(linha).join("\n")}\n` : "";
  const toks = Object.entries(d.tokens);
  return `# Paleta: ${d.titulo}

> ${d.url}
> Extraído por \`paleta.js\` em ${new Date().toLocaleString("pt-BR")}.
> ⭐ A ordem é por **área pintada**, não por número de ocorrências.

Prints: ${prints.join(" · ")}
${bloco("Fundos", d.fundos)}${bloco("Texto", d.textos)}${bloco("Bordas", d.bordas)}${bloco("Tipografia", d.fontes)}${bloco("Raio de canto", d.raios)}${bloco("Sombra", d.sombras)}
${
  toks.length
    ? `\n### Tokens declarados no CSS\n\n| token | valor |\n|---|---|\n${toks
        .map(([k, v]) => `| \`${k}\` | \`${v}\` |`)
        .join("\n")}\n`
    : "\n_Sem custom properties legíveis: ou o CSS é cross-origin sem CORS, ou o autor não usa tokens._\n"
}${
    d.imagens.length
      ? `\n### Candidatos a logo\n\n${d.imagens.map((i) => `- \`${i.tag}\` ${i.src || i.classe} ${i.alt}`).join("\n")}\n`
      : ""
  }`;
}

async function principal() {
  const [url, pastaArg] = process.argv.slice(2);
  if (!url) morrer("uso: node paleta.js <url> [pasta-saida]");
  const pasta = path.resolve(pastaArg || path.join(process.cwd(), "saida", "paletas"));
  fs.mkdirSync(pasta, { recursive: true });
  const nome = url.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60);

  const { chromium } = carregarPlaywright();
  const navegador = await chromium.launch(opcoesDeLancamento());
  const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  try {
    await pagina.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await pagina.waitForTimeout(1200);
    const dobra = path.join(pasta, `${nome}-dobra.png`);
    const inteira = path.join(pasta, `${nome}-inteira.png`);
    await pagina.screenshot({ path: dobra });
    await pagina.screenshot({ path: inteira, fullPage: true });
    const dados = await pagina.evaluate(COLETA);
    const relatorio = path.join(pasta, `${nome}.md`);
    fs.writeFileSync(relatorio, md(dados, [path.basename(dobra), path.basename(inteira)]), "utf-8");
    fs.writeFileSync(path.join(pasta, `${nome}.json`), JSON.stringify(dados, null, 2), "utf-8");
    console.log(`✓ ${relatorio}`);
    console.log(`✓ ${dobra}`);
    console.log(`✓ ${inteira}`);
    console.log(`\n⚠️ Número não é revisão visual: ABRIR os dois prints antes de usar a paleta.`);
  } finally {
    await navegador.close();
  }
}

principal().catch((e) => morrer(e.stack || e.message));
