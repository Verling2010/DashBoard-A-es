/**
 * Robô de atualização da carteira.
 *
 * Roda no GitHub Actions a cada 15 minutos durante o pregão.
 * Lê carteira.json (que só VOCÊ edita), busca as cotações na brapi,
 * e grava dados.json + historico.json (que só o ROBÔ edita).
 *
 * O token nunca aparece no código nem no site: vem de um segredo do GitHub.
 */

import { readFile, writeFile } from 'node:fs/promises';

const TOKEN = process.env.BRAPI_TOKEN || '';
const BASE = 'https://brapi.dev/api';

const log = (...a) => console.log('·', ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ------------------------------------------------------------------
   Busca de cotação.
   O plano gratuito da brapi permite 1 ativo por requisição, então
   fazemos uma chamada por ticker com uma pausa curta entre elas.
   Tentamos o endpoint v2 e, se ele não responder, caímos no clássico.
   ------------------------------------------------------------------ */
async function buscar(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'carteira-dashboard' } });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
  return r.json();
}

async function cotacao(ticker) {
  const tentativas = [
    `${BASE}/v2/stocks/quote?symbols=${ticker}&token=${TOKEN}`,
    `${BASE}/quote/${ticker}?token=${TOKEN}`,
    `${BASE}/quote/${ticker}?fundamental=true&token=${TOKEN}`,
  ];
  const erros = [];
  for (const url of tentativas) {
    try {
      const j = await buscar(url);
      const q = (j.results || j.stocks || [])[0];
      if (!q) { erros.push('resposta sem results'); continue; }
      const preco = q.regularMarketPrice ?? q.close ?? q.price;
      if (preco == null) { erros.push('resposta sem preço'); continue; }
      return {
        preco: Number(preco),
        variacaoDia: Number(q.regularMarketChangePercent ?? 0),
        nome: q.longName || q.shortName || ticker,
        // estes vêm dependendo do plano; se não vierem, ficam null e o
        // dashboard usa o valor manual do carteira.json
        pl: q.priceEarnings != null ? Number(q.priceEarnings) : null,
        lpa: q.earningsPerShare != null ? Number(q.earningsPerShare) : null,
        minimo52: q.fiftyTwoWeekLow ?? null,
        maximo52: q.fiftyTwoWeekHigh ?? null,
        fonte: url.includes('/v2/') ? 'brapi v2' : 'brapi v1',
      };
    } catch (e) { erros.push(e.message); }
  }
  throw new Error(erros.join(' | '));
}

/* ------------------------------------------------------------------ */
async function main() {
  if (!TOKEN) {
    console.error('\n!! BRAPI_TOKEN não encontrado.');
    console.error('   Vá em Settings > Secrets and variables > Actions > New repository secret');
    console.error('   Nome: BRAPI_TOKEN   Valor: o token que você pegou em brapi.dev\n');
  }

  const carteira = JSON.parse(await readFile('carteira.json', 'utf8'));
  const ativos = carteira.ativos || [];
  log(`${ativos.length} ativos em carteira`);

  // recupera o que já existe, para não perder tudo se uma busca falhar
  let anterior = { ativos: {} };
  try { anterior = JSON.parse(await readFile('dados.json', 'utf8')); } catch {}

  const resultado = {};
  const falhas = [];

  for (const a of ativos) {
    try {
      const c = await cotacao(a.ticker);
      resultado[a.ticker] = { ...c, atualizadoEm: new Date().toISOString() };
      log(`${a.ticker}: R$ ${c.preco.toFixed(2)} (${c.fonte})`);
    } catch (e) {
      falhas.push(`${a.ticker}: ${e.message}`);
      // mantém o último preço bom em vez de zerar o ativo
      if (anterior.ativos?.[a.ticker]) {
        resultado[a.ticker] = { ...anterior.ativos[a.ticker], desatualizado: true };
        log(`${a.ticker}: FALHOU — mantendo o último preço conhecido`);
      } else {
        log(`${a.ticker}: FALHOU e não há preço anterior`);
      }
    }
    await sleep(400); // gentileza com a API
  }

  const agora = new Date();
  const dados = {
    atualizadoEm: agora.toISOString(),
    ativos: resultado,
    falhas,
    aviso: 'Cotações com atraso de aproximadamente 15 minutos. Fonte: brapi.dev',
  };
  await writeFile('dados.json', JSON.stringify(dados, null, 2));
  log(`dados.json gravado — ${Object.keys(resultado).length} ativos, ${falhas.length} falha(s)`);

  /* ----------------------------------------------------------------
     Histórico: uma linha por dia. É isto que faz o gráfico de evolução
     patrimonial existir — ele passa a ser construído a partir de hoje,
     sem depender de você reconstruir o passado.
     ---------------------------------------------------------------- */
  let hist = [];
  try { hist = JSON.parse(await readFile('historico.json', 'utf8')); } catch {}

  let patrimonio = 0, investido = 0;
  for (const a of ativos) {
    const px = resultado[a.ticker]?.preco;
    if (px == null) continue;
    patrimonio += a.quantidade * px;
    investido += a.quantidade * a.precoMedio;
  }

  const hoje = agora.toISOString().slice(0, 10);
  const linha = {
    data: hoje,
    patrimonio: +patrimonio.toFixed(2),
    investido: +investido.toFixed(2),
    proventos: +ativos.reduce((s, a) => s + (a.proventosRecebidos || 0), 0).toFixed(2),
  };

  const idx = hist.findIndex(h => h.data === hoje);
  if (idx >= 0) hist[idx] = linha; else hist.push(linha);
  hist.sort((a, b) => a.data.localeCompare(b.data));
  if (hist.length > 4000) hist = hist.slice(-4000);

  await writeFile('historico.json', JSON.stringify(hist, null, 2));
  log(`historico.json: ${hist.length} dia(s) · patrimônio hoje R$ ${patrimonio.toFixed(2)}`);

  if (falhas.length === ativos.length && ativos.length > 0) {
    console.error('\n!! Nenhuma cotação foi obtida. Verifique o token e a cota mensal.');
    process.exit(1);
  }
}

main().catch(e => { console.error('Erro fatal:', e); process.exit(1); });
