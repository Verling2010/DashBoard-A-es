# Dashboard da Carteira

Painel de acompanhamento de ações e FIIs da B3 que **se atualiza sozinho**, sem servidor e sem custo.

Um robô roda no GitHub Actions a cada 15 minutos durante o pregão, busca as cotações, grava dois
arquivos, e a página apenas lê esses arquivos. Os dados ficam atualizados **mesmo com o navegador
fechado** — quando você abre, do computador ou do celular, já está tudo lá.

---

## Publicar — 8 minutos, uma vez só

### 1. Pegue o token da brapi (2 min)
Crie uma conta grátis em **[brapi.dev](https://brapi.dev)** e copie seu token no painel.
O plano gratuito dá 15.000 requisições por mês. Este projeto consome cerca de **3.400/mês** com
5 ativos, então sobra folga para você crescer até uns 20 ativos.

> **Nunca coloque o token em nenhum arquivo do projeto.** Ele vai no cofre de segredos do GitHub, no passo 4.

### 2. Crie o repositório
No GitHub: **New repository** → nome `carteira` → **Public** → *Create*.

> Público é obrigatório para o GitHub Pages gratuito. E é seguro: o repositório mostra quantidade e
> preço médio, não mostra token, senha, CPF nem nada da sua corretora. Se preferir manter os números
> privados, o repositório pode ser privado e o Pages exige conta paga — ou você troca as quantidades
> por valores proporcionais.

### 3. Suba os arquivos
Na página do repositório vazio → **uploading an existing file** → arraste **todos** os arquivos e
pastas desta pasta (inclusive a pasta oculta `.github`) → *Commit changes*.

> Se o Finder não mostrar a pasta `.github`, aperte **⌘ + Shift + .** para exibir arquivos ocultos.

### 4. Guarde o token no cofre
**Settings** → **Secrets and variables** → **Actions** → **New repository secret**
- Name: `BRAPI_TOKEN`
- Secret: cole o token
- *Add secret*

### 5. Ligue o GitHub Pages
**Settings** → **Pages** → em *Source* escolha **Deploy from a branch** → branch `main`, pasta `/ (root)` → *Save*.

Em 1–2 minutos seu painel está em:
`https://SEU-USUARIO.github.io/carteira/`

### 6. Rode o robô pela primeira vez
Aba **Actions** → *Atualizar carteira* → **Run workflow**.
Em ~30 segundos ele busca as cotações e grava os dados. A partir daí roda sozinho.

### 7. Coloque na tela do celular
Abra o endereço no navegador do celular → menu de compartilhar → **Adicionar à Tela de Início**.
Vira um ícone, abre como aplicativo.

---

## Usar no dia a dia

### Só um arquivo é seu: `carteira.json`

Tudo que você edita está lá. Pelo site do GitHub: clique em `carteira.json` → ícone de **lápis** →
edite → *Commit changes*. Funciona do celular também.

Assim que você salva, o robô dispara sozinho e o painel se atualiza.

**Adicionar um ativo** — copie um bloco existente e ajuste:

```json
{
  "ticker": "TAEE11", "tipo": "ACAO", "corretora": "B", "setor": "Energia",
  "quantidade": 300, "precoMedio": 34.5000,
  "dividendoAnual": 3.10, "dividendo3anos": 2.95,
  "lpa": 3.42, "vpa": 17.80, "pvp": 1.95,
  "proventosRecebidos": 0
}
```

Cuidado com os detalhes de JSON: **vírgula entre os blocos**, mas **não depois do último**. Se errar,
o robô falha e a aba Actions mostra uma bolinha vermelha explicando onde.

**Comprou mais do mesmo ativo?** Recalcule o preço médio e atualize `quantidade` e `precoMedio`:

```
novo PM = (qtd_antiga × PM_antigo + qtd_nova × preço_novo + taxas) ÷ (qtd_antiga + qtd_nova)
```

**Vendeu?** Reduza só a `quantidade`. **Não mexa no `precoMedio`** — pela regra brasileira, venda não
altera o preço médio das cotas que sobraram.

**Recebeu provento?** Some ao `proventosRecebidos` daquele ativo.

### O que precisa de manutenção, e com que frequência

| Campo | Quem atualiza | Frequência |
|---|---|---|
| Cotação, variação do dia | 🤖 robô | a cada 15 min |
| Histórico patrimonial | 🤖 robô | 1 ponto por dia |
| Quantidade, preço médio | você | quando compra ou vende |
| Proventos recebidos | você | quando cai na conta |
| `rendimentoMensal` (FII) | você | 1× por mês |
| `lpa`, `vpa`, `dividendoAnual` | você | 1× por trimestre |

O que muda todo dia é automático. O que muda a cada três meses é manual — e leva dois minutos.

---

## O que fica no repositório

```
carteira.json      ← VOCÊ edita. Suas posições.
index.html         ← o painel
dados.json         ← 🤖 robô grava. Cotações da última busca
historico.json     ← 🤖 robô grava. Um ponto por dia
scripts/atualizar.mjs
.github/workflows/atualizar.yml
```

O robô **nunca escreve** em `carteira.json`. Você **nunca precisa editar** `dados.json` nem
`historico.json`. Sem conflito.

---

## Perguntas que vão aparecer

**As cotações são em tempo real?**
Não — têm cerca de 15 minutos de atraso. Cotação instantânea da B3 exige licença paga de market data,
que é o que sua corretora tem. Para carteira de longo prazo, 15 minutos não muda nenhuma decisão.

**A página não atualiza / mostra dados velhos.**
A bolinha ao lado do título fica **verde** (recente), **amarela** (mais de 1 hora) ou **vermelha**
(sem dados). Se ficar amarela em dia de pregão, vá em *Actions* e veja se a última execução falhou —
os motivos mais comuns são token errado e cota mensal estourada.

**Errei o JSON e quebrou tudo.**
Nada se perde. Em *Actions* aparece a falha, e o `dados.json` anterior continua no ar. Corrija o
`carteira.json` e ele roda de novo. O GitHub também guarda todas as versões anteriores.

**Quero ver o histórico de antes de hoje.**
Não dá — ele começa no dia em que você publicar. Reconstruir o passado exigiria o histórico de
aportes com datas, que nenhuma das suas corretoras exporta de forma simples. A partir de agora,
o robô acumula sozinho.

**O gráfico de evolução não aparece.**
Ele precisa de pelo menos 2 dias registrados. No primeiro dia mostra um aviso no lugar.

---

## Custo

Zero. GitHub Actions dá 2.000 minutos por mês em repositórios públicos; este robô usa cerca de
**30 minutos/mês**. GitHub Pages é gratuito. brapi tem plano gratuito. Nenhum cartão de crédito
em lugar nenhum.

---

Ferramenta de triagem quantitativa, não recomendação de investimento.
