# Arquitetura do site — millacamata.com.br

Documento de referência para manutenção. **Leia a seção "Imagens" antes de
adicionar qualquer terreno ou card de turismo novo.**

Última atualização: 11 de agosto de 2026 (migração das imagens para arquivos).

---

## Estrutura de arquivos

```
index.html                  site inteiro (HTML + CSS + JS num arquivo só)
img/                        TODAS as fotos do index.html
videos/                     vídeos dos carrosséis + posters
blog/index.html             lista do Caderno de Campo
blog/<slug>.html            um arquivo por artigo
blog/style.css              CSS compartilhado dos artigos
blog/img/                   fotos dos artigos
sitemap.xml
```

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

`disponivel: false` esconde o card sem apagar o registro. O card, o contador de
terrenos e o texto pré-preenchido do WhatsApp derivam todos desse objeto — não
existe HTML a duplicar.

Para inserir num ponto exato do array sem usar `str_replace` (que falha em
linhas gigantes), vale `sed -i '<linha>r arquivo.js' index.html`.

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

## Checklist antes de cada commit

1. **Validar o JS**: extrair cada bloco `<script>` (excluindo
   `type="application/ld+json"`, que não é JavaScript) e rodar `node --check`.
2. **Validar o JSON-LD** com `json.loads`.
3. **Conferir referências de imagem**: toda string `img/...` citada no HTML
   precisa existir em disco.
4. **Renderizar num navegador de verdade** (Playwright) e conferir: nenhum erro
   de JS no console, contagem de cards correta, e o slide visível de cada
   carrossel efetivamente carregado depois de navegar.
5. Push para `origin main`; o GitHub Pages leva um ou dois minutos.
