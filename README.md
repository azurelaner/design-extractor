# Design Extractor

Copia o design de qualquer elemento de um site num bloco pronto pra colar no Claude, Cursor, v0 ou Lovable. Serve pra dar referência de verdade pro agente, em vez de pedir "um hero bonito" e receber a cara de sempre.

Duas formas de usar:

- **Extensão do Chrome**: você aponta o elemento com o mouse e clica.
- **Scripts de terminal**: sem clicar, por URL. Além do componente, tiram a paleta da página, fazem prints rolando e medem o que dá "cara de template".

## 1. Extensão do Chrome

### Instalar

1. Baixe o repositório: `git clone https://github.com/azurelaner/design-extractor.git`, ou **Code → Download ZIP** e descompacte.
2. Abra `chrome://extensions` e ligue o **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** e escolha a pasta `design-extractor`.
4. Fixe a extensão na barra (ícone da peça de quebra-cabeça, depois o alfinete).

### Usar

1. Abra o site de referência e clique no ícone da extensão.
2. Passe o mouse pela página. O elemento embaixo do cursor fica destacado (azul é a caixa, verde é a área de conteúdo) e um card mostra tamanho, cores, fonte, espaçamento, sombra, transição e os estados que existem no CSS.
3. Ajuste com as setas até pegar o elemento certo e clique.
4. Cole no agente de IA. O bloco já começa com "Recrie este componente exatamente como especificado abaixo".

| tecla | ação |
|---|---|
| clique ou `Enter` | copia o design |
| `↑` | sobe pro elemento pai |
| `↓` | desce pro primeiro filho |
| `Esc` | sai sem copiar |

Enquanto a extensão está ativa, os cliques da página não funcionam. Copie ou aperte `Esc` pra voltar ao normal.

### O que vai no clipboard

- **HTML com os estilos computados inline**, só o que difere do padrão do navegador
- **Estados interativos**: as regras originais de `:hover`, `:focus`, `:active`, com as `@media`
- **Pseudo-elementos**: `::before` e `::after`
- **Animações**: os `@keyframes` usados
- **Fontes**: os `@font-face` das famílias usadas
- **Tokens**: tipografia, cores e sombras do trecho copiado

## 2. Scripts de terminal

### Instalar (uma vez)

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo.

```bash
cd design-extractor
npm install
npx playwright install chromium
npm test        # tem que imprimir PASS
```

### `extrair.js`: um componente, sem clicar

```bash
node extrair.js https://site.com auto hero.md
node extrair.js https://site.com ".pricing-card" card.md
node extrair.js --lote exemplos/alvos.json saida
```

`auto` pega o maior texto visível perto do topo, que costuma ser o título do hero. Sem arquivo de saída, o resultado sai na tela.

### `paleta.js`: as cores e fontes da página

```bash
node paleta.js https://site.com
```

Grava em `saida/paletas/` um relatório `.md` (fundos, texto, bordas, tipografia, raio de canto, sombra e as variáveis `--token` declaradas no CSS), o mesmo em `.json` e dois prints: a primeira dobra e a página inteira.

A ordem é pela **área que cada cor ocupa na tela**, não por quantas vezes ela aparece. Assim o fundo do hero ganha do cinza de 200 rótulos pequenos.

### `captura.js`: a página rolando de verdade

```bash
node captura.js capturas site=https://site.com
node captura-resumo.js capturas site
```

Rola pela roda do mouse e tira um print a cada tela, no computador (1440x900) e no celular (390x844). Junto sai um `relatorio.json` com as bibliotecas usadas (GSAP, Lenis, Three.js e outras), seções, escala tipográfica, botões, elementos fixos, peso da página e se ela transborda pro lado no celular. O `captura-resumo.js` transforma esse relatório em texto legível.

Site com botão de entrada, que trava a rolagem até alguém clicar: `CLICAR=Entrar node captura.js ...` (no PowerShell: `$env:CLICAR="Entrar"; node captura.js ...`).

### `marcas.js`: o que dá cara de template

```bash
node marcas.js meu=https://meusite.com ref=https://referencia.com
```

Mede lado a lado as escolhas que fazem um site parecer genérico: recuo lateral do texto, tamanho do título contra o corpo, rótulo em caixa alta antes de cada título, palavra colorida no meio do título, cabeçalho padrão, sequências fixadas na rolagem, fileiras de cartões iguais e transbordo no celular.

Num lote medido, cinco de seis sites de um estúdio de referência ficaram com recuo de 32 a 48px e título 9 a 14 vezes maior que o corpo. Os sites com cara de template ficaram com recuo acima de 100px e título 3,5 a 6,4 vezes o corpo.

## Dicas de quem usa

- **Confira o que o `auto` pegou.** Numa rodada de 14 sites ele errou 2, pegando um rótulo de seção ou um link do menu no lugar do título. A linha `Seletor:` no topo do resultado mostra o elemento que veio. Se estiver estranho, use a extensão e escolha na mão.
- **Número não substitui olhar.** Abra os prints antes de decidir. Numa das páginas testadas a primeira dobra era quase toda preta, e só rolando apareceu o componente que mais definia a marca.
- **Marca de template é sinal, não defeito.** Serve pra transformar "tá genérico" numa lista do que mexer, não pra zerar a pontuação.
- **Referência não é cópia.** Estude a técnica e recrie com a sua marca. Os arquivos que o `captura.js` baixa (`js/`, `css/`, `dom.html`) são de terceiros: não suba pro seu repositório nem redistribua.

## Limites conhecidos

- CSS de outro domínio sem CORS não é legível: os estilos computados saem completos, mas as regras de `:hover` daquele arquivo não aparecem.
- Copia no máximo 400 elementos por vez.
- Shadow DOM fechado não é percorrido.
- Sites com proteção anti-robô (Cloudflare e parecidos) podem bloquear os scripts, e sites com política de segurança rígida (CSP) podem bloquear o `extrair.js`. Nesses casos, a extensão costuma funcionar.
- Tempos e LCP do `captura.js` saem de navegador headless sem GPU: servem pra comparar sites entre si na mesma máquina, não como número real de usuário.

## Licença

[MIT](LICENSE). Use, modifique e distribua à vontade, mantendo o aviso de licença.
