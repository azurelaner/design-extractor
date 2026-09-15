/*
  Carrega o Playwright que o `npm install` desta pasta instalou.

  Pra usar um Chrome ou Chromium que já existe na máquina em vez do baixado pelo
  Playwright, defina CHROME_PATH com o caminho do executável.
*/

function carregarPlaywright() {
  try {
    return require("playwright");
  } catch {
    console.error(
      "\n✗ Playwright não encontrado. Rode, dentro desta pasta:\n" +
        "    npm install\n" +
        "    npx playwright install chromium\n"
    );
    process.exit(1);
  }
}

function opcoesDeLancamento(args = []) {
  return { executablePath: process.env.CHROME_PATH || undefined, args };
}

module.exports = { carregarPlaywright, opcoesDeLancamento };
