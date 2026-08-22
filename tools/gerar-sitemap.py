#!/usr/bin/env python3
"""
Regera o sitemap.xml com a extensao de imagens do Google.

Por que existe: os slides 2+ dos carrosseis nascem com `data-src` e SEM `src`,
entao o rastreador do Google nunca chega neles navegando a pagina. O sitemap de
imagens e o unico caminho para essas fotos serem descobertas. Toda vez que
entrar foto nova em img/ ou blog/img/, rode:

    python3 tools/gerar-sitemap.py

O Google ignora <image:title> e <image:caption> desde 2022 — so <image:loc>
importa. A descricao da foto vem do atributo alt no HTML, nao daqui.
"""
import re, os, glob
from xml.sax.saxutils import escape

BASE = "https://millacamata.com.br/"
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (url do sitemap, arquivo HTML, prefixo dos caminhos de imagem, changefreq, priority)
PAGINAS = [
    (BASE,                    "index.html",           "",      "weekly",  "1.0"),
    (BASE + "turismo/",       "turismo/index.html",   "",      "monthly", "0.8"),
    (BASE + "blog/",          "blog/index.html",      "blog/", "weekly",  "0.8"),
]
ARTIGOS_GLOB = "blog/*.html"

PADRAO = re.compile(r'(?:\.\./)?((?:blog/)?img/[A-Za-z0-9._\-]+\.(?:jpg|jpeg|png|webp))')


def imagens_de(caminho_html, prefixo):
    """Todas as imagens citadas no HTML, sem repetir, na ordem de aparicao."""
    with open(os.path.join(RAIZ, caminho_html), encoding="utf-8") as f:
        html = f.read()
    vistas, saida = set(), []
    for m in PADRAO.finditer(html):
        rel = m.group(1)
        if not rel.startswith("blog/") and prefixo:
            rel = prefixo + rel
        # og-*.jpg sao previews de compartilhamento, duplicam foto ja listada
        if os.path.basename(rel).startswith("og-"):
            continue
        if not os.path.exists(os.path.join(RAIZ, rel)):
            print(f"  ! referencia sem arquivo em disco: {rel}")
            continue
        if rel not in vistas:
            vistas.add(rel)
            saida.append(rel)
    return saida


def data_do_arquivo(caminho_html):
    ts = os.path.getmtime(os.path.join(RAIZ, caminho_html))
    import datetime
    return datetime.date.fromtimestamp(ts).isoformat()


def bloco(url, imagens, changefreq, priority, lastmod=None):
    linhas = ["  <url>", f"    <loc>{escape(url)}</loc>"]
    if lastmod:
        linhas.append(f"    <lastmod>{lastmod}</lastmod>")
    linhas += [
        f"    <changefreq>{changefreq}</changefreq>",
        f"    <priority>{priority}</priority>",
    ]
    for img in imagens:
        linhas.append("    <image:image>")
        linhas.append(f"      <image:loc>{escape(BASE + img)}</image:loc>")
        linhas.append("    </image:image>")
    linhas.append("  </url>")
    return "\n".join(linhas)


def main():
    blocos, total = [], 0

    for url, arquivo, prefixo, freq, prio in PAGINAS:
        imgs = imagens_de(arquivo, prefixo)
        total += len(imgs)
        print(f"{url} -> {len(imgs)} imagens")
        blocos.append(bloco(url, imgs, freq, prio))

    for caminho in sorted(glob.glob(os.path.join(RAIZ, ARTIGOS_GLOB))):
        rel = os.path.relpath(caminho, RAIZ)
        if rel == "blog/index.html":
            continue
        imgs = imagens_de(rel, "blog/")
        total += len(imgs)
        print(f"{BASE + rel} -> {len(imgs)} imagens")
        blocos.append(bloco(BASE + rel, imgs, "monthly", "0.7",
                            lastmod=data_do_arquivo(rel)))

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
        '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'
        + "\n".join(blocos) +
        "\n</urlset>\n"
    )
    destino = os.path.join(RAIZ, "sitemap.xml")
    with open(destino, "w", encoding="utf-8") as f:
        f.write(xml)
    print(f"\nsitemap.xml gravado: {len(blocos)} URLs, {total} imagens")


if __name__ == "__main__":
    main()
