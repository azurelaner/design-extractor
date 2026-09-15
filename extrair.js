/*
  Automatiza o Design Extractor (picker.js) sem precisar de Chrome + hover manual.
  Abre a URL num navegador headless, injeta o MESMO picker.js da extensão e chama
  a função `extract()` que ele já expõe em `window.__dxExtract` pro self-check do
  test.html — não é reimplementação, é o extractor original rodando fora do clique.

  ## Uso

    node extrair.js <url> <seletor-css | auto> [arquivo-saida.md]
    node extrair.js --lote alvos.json [pasta-saida]

  `auto` acha o maior texto visível perto do topo (o título do hero). Confira o
  `Seletor:` no resultado: em site real ele às vezes pega outro elemento.

  `alvos.json` é uma lista de { "url", "seletor", "nome" }. Sem `nome`, usa o
  seletor sanitizado como nome do arquivo. Exemplo em exemplos/alvos.json.
*/

const path = require("path");
const fs = require("fs");
const { carregarPlaywright, opcoesDeLancamento } = require("./navegador");

function morrer(mensagem) {
  console.error(`\n✗ ${mensagem}\n`);
  process.exit(1);
}

const PICKER_JS = fs.readFileSync(path.join(__dirname, "picker.js"), "utf8");

// Muito h1 de site real é rótulo de acessibilidade escondido (font-size 0,
// text-indent -9999px, sr-only) e não o título visual do hero — "h1" sozinho
// engana mais do que ajuda. `seletor: "auto"` acha o maior texto VISÍVEL
// perto do topo da página em vez de confiar na tag.
async function marcarAuto(page) {
  return page.evaluate(() => {
    document.querySelectorAll("[data-dx-auto]").forEach((e) => e.removeAttribute("data-dx-auto"));
    const candidatos = [...document.querySelectorAll("h1,h2,h3,p,span,div,a")];
    let melhor = null, melhorTamanho = 0;
    for (const el of candidatos) {
      const texto = (el.textContent || "").trim();
      if (texto.length < 4 || texto.length > 200) continue;
      if ([...el.children].some((c) => (c.textContent || "").trim() === texto)) continue; // pega o filho específico, não o wrapper
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") continue;
      if (parseFloat(cs.textIndent) < -999) continue; // truque clássico de sr-only
      const r = el.getBoundingClientRect();
      if (r.width < 10 || r.height < 10 || r.top > window.innerHeight * 2.5) continue;
      const tamanho = parseFloat(cs.fontSize) || 0;
      if (tamanho > melhorTamanho) { melhorTamanho = tamanho; melhor = el; }
    }
    if (!melhor) return false;
    melhor.setAttribute("data-dx-auto", "1");
    return true;
  });
}

// Headline com scroll-reveal tipo GSAP SplitText quebra CADA LETRA num nó (uma frase
// de 34 letras pode virar ~90 <div>s aninhados, a maioria opacity:0/visibility:hidden
// pro efeito). O extract() original não sabe disso — ele só
// sabe percorrer subárvore. A assinatura é a razão nó/caractere perto de 1: texto normal
// tem poucos nós pra muito texto, texto quebrado por letra tem quase um nó POR letra.
// Achatar ANTES de extrair: troca a subárvore pelo texto plano (aria-label, se existir,
// senão o textContent), preservando o estilo do próprio elemento raiz.
async function achatarSeQuebrado(page, sel) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return;
    const texto = (el.getAttribute("aria-label") || el.textContent || "").trim();
    const nos = el.querySelectorAll("*").length;
    if (texto.length < 4 || nos < 20 || nos < texto.length * 0.6) return; // não é o padrão de split-text
    el.textContent = texto;
  }, sel);
}

async function extrairUm(page, url, seletor) {
  await page.goto(url, { waitUntil: "load", timeout: 45000 });
  await page.waitForTimeout(1200); // dá tempo de hidratar SPA antes de medir estilo computado
  await page.addScriptTag({ content: PICKER_JS });
  let alvo = seletor;
  if (seletor === "auto") {
    const achou = await marcarAuto(page);
    if (!achou) return null;
    alvo = '[data-dx-auto="1"]';
  }
  await achatarSeQuebrado(page, alvo);
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? window.__dxExtract(el) : null;
  }, alvo);
}

function nomeDeArquivo(alvo) {
  return (alvo.nome || alvo.seletor).replace(/[^a-z0-9-]+/gi, "_").replace(/^_+|_+$/g, "");
}

async function principal() {
  const args = process.argv.slice(2);
  const { chromium } = carregarPlaywright();
  const navegador = await chromium.launch(opcoesDeLancamento());
  const page = await navegador.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    if (args[0] === "--lote") {
      const alvos = JSON.parse(fs.readFileSync(args[1], "utf8"));
      const saidaDir = path.resolve(args[2] || "saida");
      fs.mkdirSync(saidaDir, { recursive: true });
      for (const alvo of alvos) {
        const rotulo = alvo.nome || alvo.seletor;
        process.stdout.write(`${rotulo} (${alvo.url})... `);
        try {
          const texto = await extrairUm(page, alvo.url, alvo.seletor);
          if (!texto) {
            console.log(`seletor "${alvo.seletor}" não encontrado`);
            continue;
          }
          const arquivo = path.join(saidaDir, `${nomeDeArquivo(alvo)}.md`);
          fs.writeFileSync(arquivo, texto, "utf8");
          console.log(`${texto.length} caracteres -> ${arquivo}`);
        } catch (e) {
          console.log(`erro: ${e.message}`);
        }
      }
    } else {
      const [url, seletor, saida] = args;
      if (!url || !seletor) {
        morrer("Uso: node extrair.js <url> <seletor-css> [saida.md]\n  ou: node extrair.js --lote alvos.json [pasta-saida]");
      }
      const texto = await extrairUm(page, url, seletor);
      if (!texto) morrer(`seletor "${seletor}" não encontrado em ${url}`);
      if (saida) {
        fs.writeFileSync(saida, texto, "utf8");
        console.log(`${texto.length} caracteres -> ${saida}`);
      } else {
        console.log(texto);
      }
    }
  } finally {
    await navegador.close();
  }
}

principal();
