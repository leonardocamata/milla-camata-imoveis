# Arquitetura do site — millacamata.com.br

Documento de referência para manutenção. **Leia a seção "Imagens" antes de
adicionar qualquer terreno ou card de turismo novo.**

Última atualização: 22 de agosto de 2026 (alt, JSON-LD, og:image e sitemap de imagens).

---

## Estrutura de arquivos

```
index.html                  home: hero, sobre, região, terrenos, explore, contato
style.css                   CSS compartilhado por index.html e turismo/
carousel.js                 motor de carrossel + lightbox (compartilhado)
turismo/index.html          página de turismo (42 cards, 24 carrosséis)
img/                        TODAS as fotos de index.html e turismo/
videos/                     vídeos dos carrosséis + posters
blog/index.html             lista do Caderno de Campo
blog/<slug>.html            um arquivo por artigo
blog/style.css              CSS compartilhado dos artigos
blog/img/                   fotos dos artigos
sitemap.xml
```

**Arquivos compartilhados (migração de 12/08/2026):** a seção de turismo saiu do
`index.html` e virou página própria. Para não duplicar código, o CSS foi para
`style.css` e o motor de carrossel para `carousel.js`, ambos na raiz e usados
pelas duas páginas. O `index.html` caiu de 88 KB para 22 KB, e o DOM da home de
1.137 para 528 nós — a home tinha 55% dos nós e 61% da altura só em turismo.

O `carousel.js` **não conhece os dados**. Cada página registra seus álbuns em
`galleries[]` e, no fim do próprio script, chama `initCarousels()`, que liga os
três `IntersectionObserver` (priming de slides, controle de vídeo e animação
`data-reveal`). Se uma página esquecer o `initCarousels()`, os carrosséis
aparecem mas não carregam os slides seguintes.

Caminhos dentro de `turismo/index.html` são relativos: `../img/...`,
`../style.css`, `../carousel.js`, `../index.html#terrenos`.

**A barra superior é idêntica nas seis páginas** e existe em duplicidade: as
regras estão em `style.css` (home e turismo) **e** em `blog/style.css`, porque o
blog tem folha própria. As duas cópias precisam ficar iguais — se mudar em uma,
mude na outra. Marcação canônica (ajuste os `../` conforme a pasta):

```html
<header>
  <nav class="wrap">
    <a href="../index.html" class="brand">Milla Camata <span>corretora de imóveis</span></a>
    <div class="navlinks">
      <a href="../index.html#sobre">Sobre</a>
      <a href="../index.html#terrenos">Terrenos</a>
      <a href="../turismo/index.html">Turismo</a>
      <a href="index.html" style="color:var(--gold);">Caderno de Campo</a>
      <a href="https://www.instagram.com/millacamata_artistaecorretora/" target="_blank" rel="noopener" class="ig-link nav-ig">...Instagram</a>
      <a href="../index.html#contato" class="nav-cta">Falar no WhatsApp</a>
    </div>
  </nav>
</header>
```

São sempre os mesmos seis itens, na mesma ordem. O `style="color:var(--gold);"`
marca a página atual e vai em **um** item só. A classe é `navlinks`, sem hífen —
`nav-links` era a convenção antiga do blog e não existe mais em nenhum arquivo.

**Imóveis que não são terrenos:** desde 16/08/2026 o array inclui uma casa
(`Casa na Rota do Caravaggio`). O botão e a mensagem do WhatsApp se adaptam por
`/^casa/i.test(t.nome)` — nome começando com "Casa" gera "Falar sobre esta casa".
Se entrar outro tipo (sítio, chácara, apartamento), essa checagem precisa
crescer, senão o botão volta a dizer "terreno".

O campo `area` da casa traz dois números ("1.600 m² · 240 m² construídos"). Por
isso o parser do dossier lê **apenas o primeiro número** do texto; somar os
dígitos dos dois gerava área de 1.600.240 m². Mantenha a área do terreno sempre
primeiro no campo.

**Pendência de nomenclatura:** o dossier e o hero dizem "terrenos" ao contar
imóveis, e a contagem inclui a casa. Com um imóvel só a imprecisão é pequena, mas
se entrarem mais casas vale decidir entre trocar o rótulo para "imóveis",
separar as contagens, ou excluir casas do contador.

**Atenção ao menu no mobile:** o CSS esconde todos os links do topo abaixo de
760 px, deixando só o botão de WhatsApp (`.navlinks a:not(.nav-cta)`). Como ~90%
do tráfego é mobile, qualquer página interna nova precisa de um link visível
fora do menu — é para isso que existe a seção `.explore` no `index.html`, com
cartões para Turismo e Caderno de Campo. Sem ela, a página fica inalcançável
para a maioria dos visitantes.

---

## Imagens — REGRA PRINCIPAL

**Fotos vão para arquivos em `img/`. Nunca mais embutir base64 no HTML.**

Até agosto de 2026 as fotos eram embutidas como `data:image/jpeg;base64,...`
dentro do próprio `index.html`. Isso levou o arquivo a **16,3 MB**, dos quais
99,5% era base64. Consequência medida: o navegador baixava as 100 fotos sempre,
mesmo as ~75 que ninguém olhava (só o primeiro slide de cada carrossel aparece
sem clique), e gastava 2,5 s só interpretando o arquivo antes de desenhar
qualquer card.

Depois da migração:

| | Antes | Depois |
|---|---|---|
| `index.html` | 16,3 MB | 83 KB |
| domInteractive | 3.719 ms | 144 ms |
| Baixado ao abrir a página | 12,9 MB (sempre) | ~570 KB |
| Baixado rolando a página inteira | 12,2 MB | ~4,3 MB |

### Convenção de nomes

`img/<slug-do-dono>-<n>.jpg`, começando em 1, na ordem do carrossel.

- Terreno: slug do campo `nome` — `terreno-entrada-sitio-canaa-g1-1.jpg`
- Card de turismo: prefixo da variável `<nome>Imagens` — `melloleitao-3.jpg`
- Retrato da Milla na seção "sobre": `img/milla-retrato.jpg`

### Pipeline de processamento (PIL)

Sempre o mesmo, para toda foto nova:

```python
from PIL import Image, ImageOps
im = ImageOps.exif_transpose(Image.open(origem)).convert('RGB')
if im.width > 900:
    im = im.resize((900, round(im.height*900/im.width)), Image.LANCZOS)
im.save(destino, 'JPEG', quality=68, optimize=True, progressive=True)
```

Largura máxima 900 px, qualidade 68–72, `progressive=True`. Nunca redimensionar
sem preservar a proporção. Fica em torno de 60–95 KB por foto.

### Carregamento sob demanda

O `buildCarouselHTML()` monta os slides assim:

- **Slide 1**: `<img src="..." loading="lazy">` — o navegador só baixa se o card
  entrar na tela.
- **Slides 2+**: `<img data-src="...">`, **sem `src`** — não baixam nada até
  serem pedidos.

Quem resolve o `data-src` é `primeSlides(galleryIndex, incluirAnterior)`:

- `renderGalleryState()` chama com `true` (slide atual, próximo e anterior) a
  cada clique de seta, ponto ou abertura do lightbox;
- um `IntersectionObserver` chama com `false` quando o carrossel entra na tela,
  adiantando o slide 2 para o primeiro clique ser instantâneo.

O CSS depende de `flex:0 0 100%` em `.carousel-track img`, então uma `<img>` sem
`src` mantém o tamanho da caixa e não quebra o layout do trilho.

**Se você mexer em `buildCarouselHTML`, mantenha o `data-idx="${i}"`** — é por
ele que `primeSlides` encontra cada slide.

### Texto alternativo (`alt`)

`buildCarouselHTML(imagens, galleryIndex, extraTag, altBase)` — o **quarto**
argumento é obrigatório na prática. Ele vira o `alt` de toda foto do álbum,
numerado: `"<altBase> — foto 3 de 7"`. Sem ele o `alt` sai vazio.

- `index.html` passa `` `${t.nome} — Santa Teresa, ES` ``.
- `turismo/index.html` passa o texto de `.turismo-title` do card + `, ES`.

Mantenha em torno de 60–70 caracteres. O `local` do terreno chegava a 130 e
repetia o nome do ponto de referência — isso lê como keyword stuffing e foi
descartado de propósito.

O lightbox copia o `alt` do slide de origem, então não precisa de tratamento
separado.

---

## Vídeos

Ficam em `videos/`, junto do poster (`<nome>-poster.jpg`). No array `imagens`
entram como objeto no lugar da string:

```js
{ video: "videos/arquivo.mp4", poster: "videos/arquivo-poster.jpg" }
```

**A tag `<video>` nasce sem `src`, com `data-src` e `preload="none"`.** O
`autoplay` continua lá, mas só age depois que o `src` é atribuído — por isso
nada é baixado até o carrossel aparecer na tela.

Antes desse ajuste os dois mp4 (10,35 MB somados) eram baixados na abertura da
página, mesmo estando em cards lá embaixo: com `autoplay` o navegador ignora o
`preload` e busca o arquivo de qualquer jeito.

Quem controla é o `videoIO`, um `IntersectionObserver` com `threshold: 0.25`:
atribui o `src` e toca quando o carrossel fica visível, e **pausa quando sai da
tela** — pausar interrompe o buffer, senão quem só rola a página acaba baixando
o vídeo inteiro sem parar para assistir. O `primeSlides()` faz o mesmo controle
ao navegar entre slides.

**Cuidado ao testar vídeo com Playwright:** o Chromium headless não traz o codec
H.264, então todo mp4 falha com `DEMUXER_ERROR_NO_SUPPORTED_STREAMS` e nunca
toca. Isso é limitação do ambiente de teste, não bug do site. Para conferir a
lógica sem depender do codec, dá para instrumentar `HTMLMediaElement.prototype`
com `add_init_script` e registrar as chamadas de `play`, `pause` e `src`.

Vídeo novo: manter o mp4 o mais leve possível (os atuais têm 7,1 MB e 3,7 MB, o
que é bastante) e processar o poster pelo mesmo pipeline das fotos.

---

## Adicionar um terreno novo

1. Processar as fotos com o pipeline acima, salvando em `img/` com o slug do
   nome do terreno, numeradas na ordem desejada do carrossel.
2. Inserir o objeto no array `terrenos` do `index.html`:

```js
{
  tipo: "simples",
  disponivel: true,
  nome: "Terreno Exemplo",
  local: "texto dourado acima do título",
  area: "800 m²",
  valor: "R$ 480.000",
  destaques: ["Bullet 1", "Bullet 2", "Bullet 3"],
  imagens: ["img/terreno-exemplo-1.jpg", "img/terreno-exemplo-2.jpg"],
},
```

Vídeo, quando houver, é um objeto no lugar da string, normalmente no primeiro
slide: `{ video: "videos/arquivo.mp4", poster: "videos/arquivo-poster.jpg" }`.

`disponivel: false` esconde o card sem apagar o registro. Os três números do
**dossier** (quantidade, faixa de área e faixa de valores) e o contador do hero
são calculados a partir do array no carregamento — os lotes do condomínio contam
individualmente, e terrenos com `disponivel: false` ficam fora. Não edite esses
números na mão: eles ficam desatualizados em silêncio, que foi o que aconteceu
até 12/08/2026 (diziam 5 terrenos e faixa até R$ 1M quando já havia 13 e um card
de R$ 2,7M). O card, o contador de
terrenos e o texto pré-preenchido do WhatsApp derivam todos desse objeto — não
existe HTML a duplicar.

Para inserir num ponto exato do array sem usar `str_replace` (que falha em
linhas gigantes), vale `sed -i '<linha>r arquivo.js' index.html`.

**Armadilha ao editar o array por script:** as entradas antigas terminam com
`imagens: [...]` **sem vírgula** depois do `]`. Procurar o fim do array com
`find('],')` pula essa entrada e casa com o `destaques: [...],` do terreno
seguinte, apagando o bloco inteiro que estiver no meio. Ache o `]` que fecha
contando colchetes (ignorando os que estão dentro de strings) e confira que o
número de itens não mudou antes de gravar.

**Ordem dos slides e desempenho:** deixe sempre uma foto no slide 1 e o vídeo no
slide 2. Com o vídeo em primeiro, o `videoIO` atribui o `src` assim que o card
entra na tela e o mp4 inteiro é baixado de quem só passou rolando. Com uma foto
em primeiro, o vídeo só carrega se a pessoa clicar na seta — nos dois cards com
vídeo isso economizou 10,35 MB por visita.

---

## Adicionar um card de turismo

Precisa de **duas** alterações coordenadas, senão o carrossel fica órfão:

1. No HTML, a `div` com id próprio dentro de `turismo-top`:
   `<div id="exemplo-visual"></div>`
2. No JS, depois do último bloco de registro:

```js
const exemploImagens = ["img/exemplo-1.jpg", "img/exemplo-2.jpg"];
const exemploGalleryIndex = galleries.length;
galleries.push({ imagens: exemploImagens, current: 0 });
const exemploVisual = document.getElementById('exemplo-visual');
if (exemploVisual) exemploVisual.innerHTML = buildCarouselHTML(exemploImagens, exemploGalleryIndex, '');
```

Cards sem Instagram usam ícone de globo apontando para a URL oficial de
referência, em vez do ícone do Instagram.

---

## Artigos do blog

Um arquivo HTML por artigo em `blog/`, fotos em `blog/img/`, CSS compartilhado
em `blog/style.css`. Ao criar um artigo novo:

1. Copiar o `<head>` de um artigo existente — os tags de analytics precisam
   estar em **todas** as páginas (ver seção abaixo).
2. Fotos pelo mesmo pipeline; incluir `width` e `height` reais na tag `<img>`.
   O CSS já tem `height:auto`, sem o qual a foto estica.
3. Gerar a imagem de compartilhamento (`og:image`) em 1200×630.
4. Adicionar o card no topo de `blog/index.html` e a URL no `sitemap.xml`.
5. Botão de WhatsApp leva `onclick="gtag_report_conversion();"`.

---

## Analytics — replicar em todas as páginas

Os três blocos ficam no `<head>` de **todas** as páginas do site:

| Ferramenta | ID |
|---|---|
| Google Ads | `AW-18382453338`, label `ITEOCLPhrt8cENr0t71E` |
| Google Analytics 4 | `G-2QS3R63SDG` |
| Microsoft Clarity | `y0h1s08zjz` |

Conversão dispara por `onclick="gtag_report_conversion();"` nos botões de
WhatsApp. No `index.html` os `href` são montados por JS a partir de
`WHATSAPP_NUMERO`, por isso o `onclick` é o ponto certo de encaixe.

Desde 11/08/2026 o GA4 (`gtag('config', 'G-2QS3R63SDG')`) está instalado nas
cinco páginas, logo abaixo do `config` do Ads. Ao criar página nova, copiar o
`<head>` inteiro de uma existente garante os três.

---

## SEO de imagem, dados estruturados e sitemap

Adicionado em 22/08/2026. Motivo: nenhuma foto do site tinha `alt`, a home não
tinha JSON-LD nem `og:image`, e o sitemap não declarava imagem alguma.

**O problema central:** os slides 2+ nascem com `data-src` e **sem `src`**. Isso
é ótimo para performance e péssimo para descoberta — o rastreador do Google
nunca chega neles navegando a página. As fotos do slide 2 em diante só existem
para o Google em **dois** lugares: o `image[]` do JSON-LD e o sitemap de
imagens. Se um dos dois sair do ar, aquelas fotos somem da busca.

### JSON-LD

| Bloco | Onde | Como |
|---|---|---|
| `RealEstateAgent` + `WebSite` + `WebPage` | `<head>` do `index.html` | estático — não muda |
| `ItemList` de `RealEstateListing` | fim do script do `index.html` | **gerado do array `terrenos`** em tempo de execução |
| `CollectionPage` | `<head>` do `turismo/index.html` | estático |

O bloco dos imóveis é gerado por JS pelo mesmo motivo dos números do dossier:
dado duplicado na mão desatualiza calado. O Google renderiza JS e lê JSON-LD
injetado no DOM. A contrapartida é que depende de renderização — se algum dia o
array virar arquivo JSON separado, vale reavaliar.

Todo terreno vira um `RealEstateListing` com `@id` derivado do slug do nome,
`image[]` com o álbum completo e `mainEntity` com a oferta (`Offer` com preço, ou
`AggregateOffer` com faixa, no caso do condomínio). `provider` aponta para
`#corretora`.

**Não existe rich result de imóvel na busca do Google.** Esse JSON-LD serve para
associar foto ↔ imóvel e para o Google entender a entidade, não para gerar um
card especial no resultado.

### `og:image`

`index.html` → `img/og-home.jpg`; `turismo/` → `img/og-turismo.jpg`; artigos →
`blog/img/og-<slug>.jpg`. Sempre **1200×630**, gerados por corte central a
partir de uma foto do próprio site, qualidade 82 (não entram no peso da página,
então não seguem o `quality=68` das fotos normais).

**Pendência:** `br-101-duplicacao-santa-teresa.html` e
`santa-teresa-ou-pedra-azul.html` não têm foto nenhuma e por isso ficaram sem
`og:image`. Compartilhados no WhatsApp, vão sem preview.

### Sitemap de imagens

`sitemap.xml` usa a extensão `xmlns:image` do Google. **Não edite na mão** —
rode `python3 tools/gerar-sitemap.py`, que varre os HTML, confere se cada
referência existe em disco e regrava o arquivo. Rode sempre que entrar foto
nova. O Google ignora `<image:title>` e `<image:caption>` desde 2022; a
descrição da foto vem do `alt`, por isso o script só emite `<image:loc>`.

Depois de publicar, reenviar o sitemap no Search Console acelera o rastreio.

---

## Checklist antes de cada commit

1. **Validar o JS**: extrair cada bloco `<script>` (excluindo
   `type="application/ld+json"`, que não é JavaScript) e rodar `node --check`.
2. **Validar o JSON-LD** com `json.loads`.
3. **Conferir referências de imagem**: toda string `img/...` citada no HTML
   precisa existir em disco.
4. **Se entrou ou saiu foto**: rodar `python3 tools/gerar-sitemap.py` e conferir
   que nenhuma foto do carrossel ficou com `alt` vazio no navegador
   (`document.querySelectorAll('.carousel img:not([alt]), .carousel img[alt=""]')`
   tem que voltar zero).
5. **Renderizar num navegador de verdade** (Playwright) e conferir: nenhum erro
   de JS no console, contagem de cards correta, e o slide visível de cada
   carrossel efetivamente carregado depois de navegar.
6. Push para `origin main`; o GitHub Pages leva um ou dois minutos.
