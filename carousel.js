/* =========================================================================
   MOTOR DE CARROSSEL + LIGHTBOX  (compartilhado por index.html e turismo/)
   Este arquivo NAO conhece os dados. Cada pagina registra seus proprios
   albuns em galleries[] e, no final, chama initCarousels().
   Ver ARQUITETURA.md antes de editar.
   ========================================================================= */
  /* =========================================================================
     CARROSSEL DE FOTOS + LIGHTBOX
     Cada card de terreno vira um "álbum" independente identificado por um
     índice (galleryIndex). O carrossel do card e o lightbox compartilham
     o mesmo estado, então passar fotos no lightbox também move o card.
     ========================================================================= */
  const galleries = []; // galleries[galleryIndex] = { imagens: [...], current: 0 }

  // Escapa texto que vai para dentro de um atributo HTML.
  function escAttr(s){
    return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // altBase e o nome do imovel ou do lugar; vira o alt de cada foto do album,
  // numerado. Sem ele o Google nao tem nenhuma pista do que a foto mostra.
  function buildCarouselHTML(imagens, galleryIndex, extraTag, altBase){
    const total = imagens.length;
    const altDe = (i) => altBase
      ? escAttr(total > 1 ? `${altBase} — foto ${i + 1} de ${total}` : altBase)
      : '';
    const slides = imagens.map((item, i) => {
      if (item && typeof item === 'object' && item.video) {
        return `<div class="video-slide" data-idx="${i}">
          <video data-src="${item.video}" poster="${item.poster || ''}" ${altBase ? `title="${escAttr(`Vídeo — ${altBase}`)}" aria-label="${escAttr(`Vídeo — ${altBase}`)}"` : ''} muted loop autoplay playsinline preload="none"></video>
          <span class="video-badge">🔇 vídeo</span>
        </div>`;
      }
      // Apenas o primeiro slide nasce com src (o loading=lazy decide se a
      // foto e baixada, conforme o card entra ou nao na tela). Os demais ficam
      // em data-src e sao carregados sob demanda por primeSlides().
      return i === 0
        ? `<img src="${item}" alt="${altDe(i)}" data-idx="${i}" loading="lazy" decoding="async">`
        : `<img data-src="${item}" alt="${altDe(i)}" data-idx="${i}" decoding="async">`;
    }).join('');
    const dots = imagens.length > 1
      ? `<div class="carousel-dots">${imagens.map((_, i) => `<span class="${i===0?'active':''}"></span>`).join('')}</div>`
      : '';
    const arrows = imagens.length > 1
      ? `<button class="carousel-arrow prev" data-gallery="${galleryIndex}" data-dir="-1" aria-label="Foto anterior">‹</button>
         <button class="carousel-arrow next" data-gallery="${galleryIndex}" data-dir="1" aria-label="Próxima foto">›</button>`
      : '';
    const counter = imagens.length > 1 ? `<span class="carousel-count" data-gallery-count="${galleryIndex}">1/${imagens.length}</span>` : '';
    return `
      ${extraTag}
      <div class="carousel" data-gallery="${galleryIndex}">
        <div class="carousel-track" data-gallery-track="${galleryIndex}" style="transform:translateX(0%)">${slides}</div>
        ${arrows}
        ${dots}
        ${counter}
      </div>`;
  }

  function moveGallery(galleryIndex, dir){
    const g = galleries[galleryIndex];
    if (!g) return;
    const n = g.imagens.length;
    g.current = (g.current + dir + n) % n;
    renderGalleryState(galleryIndex);
  }

  function setGallery(galleryIndex, index){
    const g = galleries[galleryIndex];
    if (!g) return;
    g.current = ((index % g.imagens.length) + g.imagens.length) % g.imagens.length;
    renderGalleryState(galleryIndex);
  }

  // Promove o slide atual e os vizinhos para carregamento imediato.
  // Rede de seguranca: se o lazy loading nao disparar num slide deslocado
  // por translateX, isso garante que a foto nunca apareca em branco.
  function primeSlides(galleryIndex, incluirAnterior){
    const track = document.querySelector(`[data-gallery-track="${galleryIndex}"]`);
    const g = galleries[galleryIndex];
    if (!track || !g) return;
    const n = g.imagens.length;
    const alvos = incluirAnterior
      ? [g.current, (g.current + 1) % n, (g.current - 1 + n) % n]
      : [g.current, (g.current + 1) % n];
    alvos.forEach(i => {
      const el = track.querySelector(`img[data-idx="${i}"]`);
      if (el && el.dataset.src) { el.src = el.dataset.src; delete el.dataset.src; }
    });
    // Video so baixa quando o slide dele esta em exibicao (nao tem autoplay,
    // que forcava o download dos 10 MB de mp4 na abertura da pagina).
    track.querySelectorAll('video').forEach(v => {
      const slide = v.closest('.video-slide');
      if (slide && slide.dataset.idx == g.current) {
        if (v.dataset.src) { v.src = v.dataset.src; delete v.dataset.src; }
        v.play().catch(() => {});
      } else if (!v.paused) {
        v.pause();
      }
    });
  }

  function renderGalleryState(galleryIndex){
    const g = galleries[galleryIndex];
    const track = document.querySelector(`[data-gallery-track="${galleryIndex}"]`);
    if (track) track.style.transform = `translateX(-${g.current * 100}%)`;
    primeSlides(galleryIndex, true);
    const dotsWrap = document.querySelector(`[data-gallery="${galleryIndex}"] .carousel-dots`);
    if (dotsWrap) {
      [...dotsWrap.children].forEach((dot, i) => dot.classList.toggle('active', i === g.current));
    }
    const counter = document.querySelector(`[data-gallery-count="${galleryIndex}"]`);
    if (counter) counter.textContent = `${g.current + 1}/${g.imagens.length}`;
    if (lightbox.classList.contains('open') && lightbox.dataset.gallery == galleryIndex) {
      updateLightboxImage();
    }
  }

  // ---- Lightbox ----
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxVideo = document.getElementById('lightbox-video');
  const lightboxCaption = document.getElementById('lightbox-caption');

  function openLightbox(galleryIndex){
    lightbox.dataset.gallery = galleryIndex;
    updateLightboxImage();
    lightbox.classList.add('open');
  }
  function closeLightbox(){
    lightbox.classList.remove('open');
    lightboxVideo.pause();
  }
  function updateLightboxImage(){
    const galleryIndex = lightbox.dataset.gallery;
    const g = galleries[galleryIndex];
    if (!g) return;
    const item = g.imagens[g.current];
    const isVideo = item && typeof item === 'object' && item.video;
    if (isVideo) {
      lightboxImg.style.display = 'none';
      lightboxVideo.style.display = 'block';
      if (lightboxVideo.getAttribute('src') !== item.video) lightboxVideo.src = item.video;
      if (item.poster) lightboxVideo.poster = item.poster;
      lightboxVideo.muted = false;
      lightboxVideo.currentTime = 0;
      lightboxVideo.play().catch(() => {});
    } else {
      lightboxVideo.pause();
      lightboxVideo.style.display = 'none';
      lightboxImg.style.display = 'block';
      lightboxImg.src = item;
      // Reaproveita o alt ja montado no slide do carrossel, para o lightbox
      // nao ser uma imagem sem descricao.
      const slideOrigem = document.querySelector(`[data-gallery-track="${galleryIndex}"] img[data-idx="${g.current}"]`);
      lightboxImg.alt = slideOrigem ? slideOrigem.alt : '';
      primeSlides(galleryIndex, true);
    }
    lightboxCaption.textContent = g.imagens.length > 1 ? `${g.current + 1} de ${g.imagens.length}` : '';
  }

  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('lightbox-prev').addEventListener('click', () => moveGallery(lightbox.dataset.gallery, -1));
  document.getElementById('lightbox-next').addEventListener('click', () => moveGallery(lightbox.dataset.gallery, 1));
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') moveGallery(lightbox.dataset.gallery, -1);
    if (e.key === 'ArrowRight') moveGallery(lightbox.dataset.gallery, 1);
  });

  // Delegated clicks for carousel arrows and opening the lightbox by clicking a photo
  document.addEventListener('click', (e) => {
    const arrow = e.target.closest('.carousel-arrow');
    if (arrow) {
      e.stopPropagation();
      moveGallery(arrow.dataset.gallery, parseInt(arrow.dataset.dir, 10));
      return;
    }
    const carousel = e.target.closest('.carousel');
    if (carousel && (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO' || e.target.closest('.video-slide'))) {
      openLightbox(carousel.dataset.gallery);
    }
  });

  /* Chame no fim do script da pagina, depois de registrar todos os albuns. */
  function initCarousels(){
    // Quando um carrossel entra na tela, adianta o 2o slide para que o
    // primeiro clique na seta seja instantaneo. Roda uma vez por carrossel.
    const carrosselIO = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        primeSlides(e.target.dataset.gallery, false);
        carrosselIO.unobserve(e.target);
      });
    }, { rootMargin: '200px' });
    document.querySelectorAll('.carousel[data-gallery]').forEach(c => carrosselIO.observe(c));

    // Toca o video so enquanto o carrossel dele esta visivel na tela. Sem isso,
    // quem apenas rola a pagina baixa o mp4 inteiro sem nunca parar para assistir.
    const videoIO = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        const car = e.target;
        const g = galleries[car.dataset.gallery];
        const v = car.querySelector('video');
        if (!v || !g) return;
        const videoEhOSlideAtual = !!car.querySelector(`.video-slide[data-idx="${g.current}"]`);
        if (e.isIntersecting && videoEhOSlideAtual) {
          if (v.dataset.src) { v.src = v.dataset.src; delete v.dataset.src; }
          v.play().catch(() => {});
        } else if (!v.paused) {
          v.pause();
        }
      });
    }, { threshold: 0.25 });
    document.querySelectorAll('.carousel[data-gallery]').forEach(c => {
      if (c.querySelector('video')) videoIO.observe(c);
    });

    const els = document.querySelectorAll('[data-reveal]');
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    },{threshold:0.12});
    els.forEach(el=>io.observe(el));
  }
