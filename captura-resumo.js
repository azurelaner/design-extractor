/*
  Resumo legível de uma captura do captura.js (o relatorio.json inteiro é grande
  demais pra ler de uma vez).

  Uso: node captura-resumo.js <pasta-saida> <slug>
*/
const fs = require("fs");
const path = require("path");

const [base, slug] = process.argv.slice(2);
if (!base || !slug) {
  console.error("uso: node captura-resumo.js <pasta-saida> <slug>");
  process.exit(1);
}
const r = JSON.parse(fs.readFileSync(path.join(base, slug, "relatorio.json"), "utf-8"));
const kb = (n) => Math.round(n / 1024) + "KB";
const m = r.meta;
const out = [];
const p = (...a) => out.push(a.join(" "));

p(`## ${slug}  ${r.url}`);
p(`titulo: ${m.titulo} | lang ${m.lang} | generator: ${m.generator || "-"}`);
p(`descricao: ${m.descricao.slice(0, 160)}`);
p(`html.class: ${m.htmlClasses} | body.class: ${m.bodyClasses}`);
p(`tempos: DCL ${r.tempos.domcontentloadedMs}ms, idle ${r.tempos.networkidleMs}ms | LCP headless: ${JSON.stringify(r.lcpHeadless)}`);
p(`rede: ${kb(r.rede.total)} em ${r.rede.pedidos} pedidos | ${Object.entries(r.rede.porTipo).map(([k, v]) => k + " " + kb(v)).join(", ")}`);
p(`pesados:`);
r.rede.pesados.slice(0, 10).forEach((x) => p(`  ${kb(x.tam)} ${x.tipo} ${x.url.slice(0, 130)}`));
p(`altura doc: ${r.esboco.alturaDoc} | largura ${m.larguraDoc} | cursor body: ${m.cursorBody} | svgs ${m.svgs} imgs ${m.imgs}`);
p(`libs (window): ${JSON.stringify(Object.fromEntries(Object.entries(r.libsDepoisDaRolagem).filter(([k]) => !["gsapAmostra", "scrollTriggers"].includes(k))))}`);
p(`assinaturas JS (indício, não prova): ${Object.entries(r.assinaturasJS).map(([k, v]) => `${k}(${v.length})`).join(", ")}`);
p(`scripts: ${m.scripts.map((s) => s.replace(/^https?:\/\/[^/]+/, "")).slice(0, 25).join(" · ")}`);
p(`estilos: ${m.estilos.map((s) => s.replace(/^https?:\/\/[^/]+/, "")).slice(0, 12).join(" · ")}`);
p(`fontes: ${m.fontes.join(" · ")}`);
const toks = Object.entries(m.tokens);
p(`tokens (${toks.length}): ${toks.slice(0, 60).map(([k, v]) => `${k}=${v}`).join(" ; ").slice(0, 2500)}`);
p(`recursos CSS: ${JSON.stringify(m.recursosCSS)}`);
p(`keyframes: ${m.keyframes.join(", ").slice(0, 600)}`);
p(`media: ${m.mediaQueries.slice(0, 15).join(" | ")}`);
p(`fixos: ${m.fixos.map((f) => `${f.el}[${f.pos} ${f.w}x${f.h}@${f.x},${f.y} pe:${f.pe} blend:${f.blend}${f.texto ? ' "' + f.texto.replace(/\s+/g, " ").slice(0, 40) + '"' : ""}]`).join(" ; ").slice(0, 1800)}`);
p(`canvas: ${JSON.stringify(m.canvas)} | videos: ${JSON.stringify(m.videos).slice(0, 600)} | iframes: ${m.iframes.join(", ").slice(0, 200)}`);
p(`animações CSS (depois da rolagem): ${(r.animacoesDepois || []).map((a) => `${a.nome}@${a.alvo}(${a.dur}ms x${a.iter})`).slice(0, 20).join(" ; ").slice(0, 1500)}`);
const libs = r.libsDepoisDaRolagem;
if (libs.scrollTriggers) p(`scrollTriggers (${libs.scrollTriggers.length}): ${libs.scrollTriggers.map((s) => `${s.trigger}${s.pin ? " PIN" : ""}${s.scrub ? " scrub=" + s.scrub : ""} ${s.start}->${s.end}`).join(" ; ").slice(0, 2500)}`);
if (libs.gsapAmostra) p(`gsap tweens amostra: ${libs.gsapAmostra.slice(0, 30).map((t) => `${t.alvos.join("+")}{${t.vars.join(",")}}${t.dur}s${t.st ? " ST" : ""}`).join(" ; ").slice(0, 2500)}`);
p(`nav: ${r.esboco.nav}`);
p(`raiz das seções: ${r.esboco.raizDasSecoes}`);
p(`SEÇÕES (${r.esboco.secoes.length}):`);
r.esboco.secoes.forEach((s, i) => {
  p(`  [${i}] ${s.el} topo ${s.topo} h ${s.altura} | fundo ${s.fundo.slice(0, 70)} | img ${s.imgs} vid ${s.videos} cv ${s.canvas}`);
  s.titulos.slice(0, 4).forEach((t) => p(`      ${t.tag} "${t.texto}" ${t.fonte} ${t.tam}/${t.lh} w${t.peso} ls${t.ls} ${t.tt} ${t.cor}`));
  p(`      texto: ${s.amostra.slice(0, 220)}`);
});
p(`ESCALA TIPOGRÁFICA:`);
r.esboco.tipos.slice(0, 22).forEach((t) => p(`  ${t.estilo} | lh ${t.lh} | ${t.tag} x${t.n} | "${t.amostra}" ${t.cor}`));
p(`BOTÕES:`);
r.esboco.botoes.forEach((b) => p(`  "${b.texto}" fundo ${b.fundo} cor ${b.cor} borda ${b.borda} raio ${b.raio} pad ${b.padding} | ${b.fonte} x${b.n}`));
p(`passos desktop: ${r.passos.map((x) => x.y).join(",")}`);
p(`passos celular: ${r.passosCelular.map((x) => x.y).join(",")} | celular: ${JSON.stringify(r.celular)}`);
p(`erros: ${r.erros.slice(0, 8).join(" || ")}`);
console.log(out.join("\n"));
