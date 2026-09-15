/*
  Self-check: abre o test.html num Chromium headless e lê o título da aba, que o
  próprio test.html troca pra PASS ou FAIL depois de rodar o extractor.

  Uso: npm test
*/

const path = require("path");
const { pathToFileURL } = require("url");
const { carregarPlaywright, opcoesDeLancamento } = require("./navegador");

(async () => {
  const { chromium } = carregarPlaywright();
  const navegador = await chromium.launch(opcoesDeLancamento());
  try {
    const pagina = await navegador.newPage();
    await pagina.goto(pathToFileURL(path.join(__dirname, "test.html")).href);
    await pagina.waitForFunction(() => /^(PASS|FAIL)/.test(document.title), null, { timeout: 15000 });
    const titulo = await pagina.title();
    console.log(titulo);
    process.exitCode = titulo === "PASS" ? 0 : 1;
  } finally {
    await navegador.close();
  }
})().catch((e) => {
  console.error(`\n✗ ${e.message}\n`);
  process.exit(1);
});
