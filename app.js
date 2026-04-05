/* ═══════════════════════════════════════════════
   VAPEXOTIC — app.js
   Modulo principal con namespace para evitar
   contaminar el scope global.
   ═══════════════════════════════════════════════ */

const Vapexotic = (function () {
  'use strict';

  // ── CONFIG ──
  const CONFIG = {
    whatsapp: '18297980193',
    // Cambia esta URL a la raw URL de tu products.json en GitHub
    // Ejemplo: https://raw.githubusercontent.com/tu-usuario/vapexotic/main/products.json
    catalogUrl: 'products.json',
  };

  const CATEGORY_ORDER = [
    { key: 'todos',             label: 'Todos' },
    { key: 'vapes-desechables', label: 'Desechables' },
    { key: 'vapes-rellenables', label: 'Rellenables' },
    { key: 'liquidos',          label: 'Liquidos' },
    { key: 'accesorios',        label: 'Accesorios' },
    { key: 'otros',             label: 'Otros' },
  ];

  const CATEGORY_ICONS = {
    'vapes-desechables': '\u{1F4A8}',
    'vapes-rellenables': '\u267B\uFE0F',
    'otros':             '\u{1F6CD}\uFE0F',
  };

  // ── STATE ──
  let allProducts = [];
  let cart = {};
  let selectedVariantId = null;
  let currentCategory = 'todos';
  let searchQuery = '';
  let currentSort = 'relevancia';  // 'relevancia' | 'precio-asc' | 'precio-desc'
  const variantStore = {};
  let variantKey = 0;
  let searchDebounceTimer = null;

  // ══════════════════════════════════════════════
  //  SECURITY: HTML ESCAPING
  // ══════════════════════════════════════════════

  const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function esc(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, c => ESCAPE_MAP[c]);
  }

  // ══════════════════════════════════════════════
  //  GLOBAL IMAGE ERROR HANDLER
  //  Replaces broken <img> with a styled placeholder.
  //  Uses event delegation on document (capture phase)
  //  so it catches errors from dynamically created imgs.
  // ══════════════════════════════════════════════

  function initImageErrorHandler() {
    document.addEventListener('error', e => {
      const img = e.target;
      if (img.tagName !== 'IMG') return;

      // Determine placeholder content based on context
      const wrap = img.closest('.product-img-wrap');
      const modalWrap = img.closest('#modalImgWrap');

      if (wrap) {
        // Product card image — replace with category placeholder
        const card = img.closest('.product-card');
        const cat = card ? card.dataset.cat : '';
        const icon = CATEGORY_ICONS[cat] || '';
        const placeholder = document.createElement('div');
        placeholder.className = 'product-placeholder';
        placeholder.innerHTML = icon || '\u{1F4E6}';
        img.replaceWith(placeholder);
      } else if (modalWrap) {
        // Modal image — replace with icon placeholder
        const placeholder = document.createElement('div');
        placeholder.className = 'modal-img-placeholder';
        placeholder.id = 'modalImg';
        placeholder.innerHTML = '\u{1F4E6}';
        img.replaceWith(placeholder);
      } else if (img.closest('.nav-logo')) {
        // Nav logo — replace with text fallback
        img.outerHTML = 'VAP<span style="color:var(--blue)">EXOTIC</span>';
      } else {
        // Any other image (hero logo, etc.) — just hide it
        img.style.display = 'none';
      }
    }, true); // capture phase to catch before default handling
  }

  // ══════════════════════════════════════════════
  //  CART PERSISTENCE (localStorage)
  // ══════════════════════════════════════════════

  const CART_KEY = 'vapexotic_cart';

function saveCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify({
      items: cart,
      timestamp: Date.now()
    }));
  } catch (_) {}
}

function loadCart() {
  try {
    var raw = localStorage.getItem(CART_KEY);
    if (!raw) return;
    var parsed = JSON.parse(raw);
    // Expirar despues de 24 horas
    if (!parsed.timestamp || Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(CART_KEY);
      return;
    }
    cart = parsed.items || {};
  } catch (_) {
    localStorage.removeItem(CART_KEY);
  }
}

  // Remove cart items whose IDs no longer exist in the active catalog
  function reconcileCart() {
    const validIds = new Set(allProducts.map(p => String(p.id)));
    let changed = false;
    for (const key of Object.keys(cart)) {
      if (!validIds.has(key)) {
        delete cart[key];
        changed = true;
      }
    }
    if (changed) saveCart();
  }

  // ══════════════════════════════════════════════
  //  HERO TITLE ANIMATION
  // ══════════════════════════════════════════════

  function initHeroTitle() {
    const el = document.getElementById('heroTitle');
    if (!el) return;
    const text = 'VAPEXOTIC';
    let html = '';
    for (let i = 0; i < text.length; i++) {
      const cls = i >= 3 ? ' blue' : '';
      html += `<span class="letter${cls}">${text[i]}</span>`;
    }
    el.innerHTML = html;
  }

  // ══════════════════════════════════════════════
  //  DATA LOADING
  // ══════════════════════════════════════════════

  async function loadProducts() {
    try {
      const res = await fetch(CONFIG.catalogUrl, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Catalogo vacio o formato invalido');
      }

      // Sanitize and normalize each product
      allProducts = data.map((p, i) => ({
        id:           typeof p.id === 'number' ? p.id : i + 1,
        categoria:    String(p.categoria || 'otros'),
        marca:        String(p.marca || ''),
        nombre:       String(p.nombre || ''),
        sabor:        String(p.sabor || ''),
        specs:        Array.isArray(p.specs) ? p.specs.map(String) : [],
        precio:       parseInt(p.precio, 10) || 0,
        stock:        parseInt(p.stock, 10) || 0,
        imagen:       String(p.imagen || ''),
        imagenModelo: String(p.imagenModelo || p.imagen || ''),
        hot:          p.hot === true,
        oferta:       p.oferta === true,
        precioAntes:  parseInt(p.precioAntes, 10) || 0,
        activo:       p.activo !== false,   // default true if missing
      })).filter(p => p.nombre && p.activo);

    } catch (e) {
      console.error('Error cargando catalogo:', e);
      document.getElementById('productsContainer').innerHTML =
        '<p class="loading-text" style="padding:40px;color:var(--orange);">Error cargando el catalogo. Recarga la pagina.</p>';
      return;
    }

    reconcileCart();
    buildTabs();
    renderProducts('todos');
    renderOfertas();
    updateUI();
  }

  // ══════════════════════════════════════════════
  //  TABS
  // ══════════════════════════════════════════════

  function buildTabs() {
    const el = document.getElementById('categoryTabs');
    if (!el) return;

    // Build tab data, skip categories with 0 products (except "todos")
    const tabs = CATEGORY_ORDER.map(t => {
      let count;
      if (t.key === 'todos') {
        count = new Set(allProducts.map(p => `${p.marca}||${p.nombre}`)).size;
      } else {
        const inCat = allProducts.filter(p => p.categoria === t.key);
        count = new Set(inCat.map(p => `${p.marca}||${p.nombre}`)).size;
      }
      return { ...t, count };
    }).filter(t => t.key === 'todos' || t.count > 0);

    el.innerHTML = tabs.map((t, i) => {
      const countStr = t.count > 0 ? ` (${t.count})` : '';
      return `<button class="tab-btn${i === 0 ? ' active' : ''}" data-cat="${esc(t.key)}">${esc(t.label)}${countStr}</button>`;
    }).join('');

    // Event delegation instead of inline onclick
    el.addEventListener('click', e => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      el.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.cat;
      renderProducts(currentCategory);
    });
  }

  // ══════════════════════════════════════════════
  //  SEARCH + SORT
  // ══════════════════════════════════════════════

  function initSearch() {
    const input = document.getElementById('searchInput');
    const clearBtn = document.getElementById('searchClear');
    if (!input) return;

    input.addEventListener('input', () => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        searchQuery = input.value.trim().toLowerCase();
        renderProducts(currentCategory);
      }, 200);
      // Show/hide clear button
      if (clearBtn) clearBtn.style.display = input.value ? 'flex' : 'none';
    });

    // Clear button
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        input.value = '';
        searchQuery = '';
        clearBtn.style.display = 'none';
        renderProducts(currentCategory);
        input.focus();
      });
    }
  }

  function initSort() {
    const select = document.getElementById('sortSelect');
    if (!select) return;
    select.addEventListener('change', () => {
      currentSort = select.value;
      renderProducts(currentCategory);
    });
  }

  function filterBySearch(products) {
    if (!searchQuery) return products;
    const q = searchQuery;
    return products.filter(p =>
      p.marca.toLowerCase().includes(q) ||
      p.nombre.toLowerCase().includes(q) ||
      p.sabor.toLowerCase().includes(q)
    );
  }

  // ══════════════════════════════════════════════
  //  RENDERING
  // ══════════════════════════════════════════════

  function renderProducts(cat) {
    let raw = cat === 'todos' ? allProducts : allProducts.filter(p => p.categoria === cat);
    raw = filterBySearch(raw);

    // Reset variant store
    variantKey = 0;
    Object.keys(variantStore).forEach(k => delete variantStore[k]);

    // Group by marca+nombre
    const modelMap = new Map();
    raw.forEach(p => {
      const key = `${p.marca}||${p.nombre}`;
      if (!modelMap.has(key)) modelMap.set(key, []);
      modelMap.get(key).push(p);
    });

    // Sort: OOS always last, then by user selection
    const models = [...modelMap.values()].sort((a, b) => {
      const aOos = a.every(p => p.stock <= 0);
      const bOos = b.every(p => p.stock <= 0);
      if (aOos !== bOos) return aOos ? 1 : -1;

      if (currentSort === 'precio-asc') {
        return (a[0].precio - b[0].precio);
      } else if (currentSort === 'precio-desc') {
        return (b[0].precio - a[0].precio);
      }
      // Default: relevancia — hot/oferta first
      const aHot = a.some(p => p.hot || p.oferta);
      const bHot = b.some(p => p.hot || p.oferta);
      if (aHot !== bHot) return aHot ? -1 : 1;
      return 0;
    });

    const el = document.getElementById('productsContainer');
    if (!models.length) {
      el.innerHTML = '<p class="loading-text" style="padding:40px;">Sin resultados</p>';
      return;
    }
    el.innerHTML = `<div class="products-grid">${models.map(v => modelCard(v)).join('')}</div>`;

    // Event delegation for product cards
    el.querySelector('.products-grid').addEventListener('click', e => {
      const card = e.target.closest('.product-card');
      if (!card) return;
      const key = parseInt(card.dataset.vkey, 10);
      if (!isNaN(key) && variantStore[key]) {
        openModal(key);
      }
    });
  }

  function modelCard(variants) {
    const key = variantKey++;
    variantStore[key] = variants;

    const rep    = variants.find(p => p.stock > 0) || variants[0];
    const allOos = variants.every(p => p.stock <= 0);
    const isHot  = variants.some(p => p.hot);
    const avail  = variants.filter(p => p.stock > 0).length;
    const total  = variants.length;
    const icon   = CATEGORY_ICONS[rep.categoria] || '';

    // Offer detection: count flavors with active offers (in stock)
    const offersInStock = variants.filter(p => p.oferta && p.stock > 0).length;
    const allOnOffer    = avail > 0 && offersInStock === avail;

    // Badge priority: Agotado > Oferta (all flavors) > Popular > none
    let badge = '';
    if (allOos)         badge = '<span class="badge badge-out">Agotado</span>';
    else if (allOnOffer) badge = '<span class="badge badge-offer">Oferta</span>';
    else if (isHot)      badge = '<span class="badge badge-hot">Popular</span>';

    // Flavor label with offer indicator
    let flavorLabel;
    if (total === 1) {
      flavorLabel = esc(rep.sabor);
    } else {
      flavorLabel = `${avail} sabor${avail !== 1 ? 'es' : ''} disponible${avail !== 1 ? 's' : ''}`;
      if (offersInStock > 0 && !allOnOffer) {
        flavorLabel += ` <span class="offer-hint">\u00B7 ${offersInStock} en oferta</span>`;
      }
    }

    const imgHtml = rep.imagenModelo
      ? `<img src="${esc(rep.imagenModelo)}" alt="${esc(rep.nombre)}" loading="lazy">`
      : `<div class="product-placeholder">${icon || '\u{1F4E6}'}</div>`;

    return `
    <div class="product-card${allOos ? ' oos' : ''}${allOnOffer ? ' offer-card' : ''}" data-vkey="${key}" data-cat="${esc(rep.categoria)}">
      <div class="product-img-wrap">
        ${imgHtml}
        ${badge}
      </div>
      <div class="product-info">
        <p class="product-brand">${esc(rep.marca)}</p>
        <h3 class="product-name">${esc(rep.nombre)}</h3>
        <p class="product-flavor">${flavorLabel}</p>
        <div class="product-footer">
          <div>
            <div class="product-price">RD$ ${rep.precio.toLocaleString()}</div>
            <div class="product-stock ${allOos ? 'out' : 'available'}">${allOos ? 'Agotado' : 'Toca para elegir sabor'}</div>
          </div>
          ${!allOos ? '<div class="product-arrow">\u203A</div>' : ''}
        </div>
      </div>
    </div>`;
  }

  // ── OFFER CARDS ──
  function offerCard(p) {
    const oos = p.stock <= 0;
    const icon = CATEGORY_ICONS[p.categoria] || '';

    let badgeHtml = '';
    if (oos) badgeHtml = '<span class="badge badge-out">Agotado</span>';
    else badgeHtml = '<span class="badge badge-offer">Oferta</span>';

    const imgHtml = p.imagen
      ? `<img src="${esc(p.imagen)}" alt="${esc(p.nombre)}" loading="lazy">`
      : `<div class="product-placeholder">${icon || '\u{1F4E6}'}</div>`;

    return `
    <div class="product-card${oos ? ' oos' : ''} offer-card" data-offer-id="${p.id}" data-cat="${esc(p.categoria)}">
      <div class="product-img-wrap">
        ${imgHtml}
        ${badgeHtml}
      </div>
      <div class="product-info">
        <p class="product-brand">${esc(p.marca)}</p>
        <h3 class="product-name">${esc(p.nombre)}</h3>
        <p class="product-flavor">${esc(p.sabor)}</p>
        <div class="product-footer">
          <div>
            ${p.precioAntes ? `<div class="price-original">RD$ ${p.precioAntes.toLocaleString()}</div>` : ''}
            <div class="product-price offer-price">RD$ ${p.precio.toLocaleString()}</div>
            <div class="product-stock ${oos ? 'out' : 'available'}">${oos ? 'Agotado' : 'Disponible'}</div>
          </div>
          ${!oos ? '<div class="product-arrow">\u203A</div>' : ''}
        </div>
      </div>
    </div>`;
  }

  function renderOfertas() {
    const offers = allProducts.filter(p => p.oferta === true && p.stock > 0);
    const block = document.getElementById('ofertasBlock');
    const grid  = document.getElementById('ofertasGrid');
    const divider = document.getElementById('ofertasDivider');

    if (offers.length === 0) {
      block.style.display = 'none';
      divider.style.display = 'none';
    } else {
      block.style.display = '';
      divider.style.display = '';
      grid.innerHTML = `<div class="products-grid">${offers.map(p => offerCard(p)).join('')}</div>`;

      // Event delegation for offer cards
      grid.querySelector('.products-grid').addEventListener('click', e => {
        const card = e.target.closest('.product-card');
        if (!card) return;
        const id = parseInt(card.dataset.offerId, 10);
        if (!isNaN(id)) openModalSingleFlavor(id);
      });
    }
  }

  // ══════════════════════════════════════════════
  //  MODAL
  // ══════════════════════════════════════════════

  function openModal(key) {
    const variants = variantStore[key];
    if (!variants) return;
    buildModal(variants);
  }

  function openModalSingleFlavor(id) {
    const p = allProducts.find(x => x.id === id);
    if (!p) return;
    // Show ALL flavors of this model, pre-select the clicked one
    const variants = allProducts.filter(x => x.marca === p.marca && x.nombre === p.nombre);
    buildModal(variants);
    if (p.stock > 0) selectFlavor(id);
  }

  function openModalForProduct(id) {
    const p = allProducts.find(x => x.id === id);
    if (!p) return;
    const variants = allProducts.filter(x => x.marca === p.marca && x.nombre === p.nombre);
    buildModal(variants);
  }

  function buildModal(variants) {
    if (!variants.length) return;
    const rep = variants[0];
    selectedVariantId = null;

    const icon = CATEGORY_ICONS[rep.categoria] || '\u{1F4E6}';
    const imgWrap = document.getElementById('modalImgWrap');

    if (rep.imagenModelo) {
      imgWrap.innerHTML = `<img id="modalImg" class="modal-img" src="${esc(rep.imagenModelo)}" alt="${esc(rep.nombre)}">`;
    } else {
      imgWrap.innerHTML = `<div id="modalImg" class="modal-img-placeholder">${icon}</div>`;
    }

    document.getElementById('modalBrand').textContent = rep.marca;
    document.getElementById('modalName').textContent  = rep.nombre;
    document.getElementById('modalPrice').textContent = `RD$ ${rep.precio.toLocaleString()}`;

    // Specs (shared across variants, taken from first)
    const specsEl = document.getElementById('modalSpecs');
    if (specsEl) {
      if (rep.specs && rep.specs.length) {
        specsEl.innerHTML = rep.specs.map(s => `<span class="spec-chip">${esc(s)}</span>`).join('');
        specsEl.style.display = '';
      } else {
        specsEl.innerHTML = '';
        specsEl.style.display = 'none';
      }
    }

    // Sort variants: offers first, then available, then OOS
    const sorted = [...variants].sort((a, b) => {
      // OOS always last
      if ((a.stock <= 0) !== (b.stock <= 0)) return a.stock <= 0 ? 1 : -1;
      // Offers first among available
      if (a.oferta !== b.oferta) return a.oferta ? -1 : 1;
      return 0;
    });

    // Flavor buttons
    const grid = document.getElementById('flavorGrid');
    grid.innerHTML = sorted.map(p => {
      const oos = p.stock <= 0;
      const stockLabel = oos ? 'Agotado' : (p.stock < 10 ? `Solo ${p.stock}!` : 'Disponible');
      const offerBadge = p.oferta && !oos
        ? '<span style="background:var(--orange);color:#fff;font-size:8px;font-weight:700;letter-spacing:1px;padding:2px 6px;margin-left:6px;vertical-align:middle;">OFERTA</span>'
        : '';
      const priceHtml = p.oferta && p.precioAntes
        ? `<span style="font-size:10px;color:var(--muted);text-decoration:line-through;margin-right:4px;">RD$${p.precioAntes.toLocaleString()}</span><span style="font-size:11px;color:var(--orange);font-weight:600;">RD$${p.precio.toLocaleString()}</span>`
        : '';

      return `<button
        class="flavor-btn${oos ? ' oos-flavor' : ''}"
        data-flavor-id="${p.id}"
        ${oos ? 'disabled' : ''}
      >
        <span>${esc(p.sabor)}${offerBadge}</span>
        ${priceHtml ? `<span style="display:block;margin-top:3px;">${priceHtml}</span>` : ''}
        <span class="flavor-stock">${stockLabel}</span>
      </button>`;
    }).join('');

    // Event delegation for flavor buttons
    grid.onclick = e => {
      const btn = e.target.closest('.flavor-btn');
      if (!btn || btn.disabled) return;
      const id = parseInt(btn.dataset.flavorId, 10);
      if (!isNaN(id)) selectFlavor(id);
    };

    // Auto-select if only 1 available
    if (variants.length === 1 && variants[0].stock > 0) {
      selectFlavor(variants[0].id);
    }

    // Reset add button
    const addBtn = document.getElementById('modalAddBtn');
    addBtn.disabled = true;
    addBtn.textContent = 'Selecciona un sabor';

    document.getElementById('modalOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function selectFlavor(id) {
    selectedVariantId = id;
    document.querySelectorAll('.flavor-btn').forEach(b => b.classList.remove('selected'));
    const btn = document.querySelector(`.flavor-btn[data-flavor-id="${id}"]`);
    if (btn) btn.classList.add('selected');

    const p = allProducts.find(x => x.id === id);
    if (p) {
      // Swap image
      const imgEl = document.getElementById('modalImg');
      const newSrc = p.imagen || p.imagenModelo || '';
      if (imgEl && newSrc) {
        if (imgEl.tagName === 'IMG') {
          imgEl.src = newSrc;
        } else {
          imgEl.outerHTML = `<img id="modalImg" class="modal-img" src="${esc(newSrc)}" alt="${esc(p.nombre)}">`;
        }
      }
      // Update price
      const priceEl = document.getElementById('modalPrice');
      if (p.oferta && p.precioAntes) {
        priceEl.innerHTML = `<span style="font-size:16px;color:var(--muted);text-decoration:line-through;display:block;line-height:1;">RD$ ${p.precioAntes.toLocaleString()}</span><span style="color:var(--orange);">RD$ ${p.precio.toLocaleString()}</span>`;
      } else {
        priceEl.textContent = `RD$ ${p.precio.toLocaleString()}`;
      }
    }

    const addBtn = document.getElementById('modalAddBtn');
    addBtn.disabled = false;
    addBtn.textContent = 'Agregar al Carrito';
  }

  function addSelectedToCart() {
    if (!selectedVariantId) return;
    const p = allProducts.find(x => x.id === selectedVariantId);
    if (!p) return;
    const key = String(selectedVariantId);
    cart[key] ? cart[key].qty++ : (cart[key] = { ...p, qty: 1 });
    updateUI();
    saveCart();
    showToast(`${p.nombre} \u00B7 ${p.sabor} agregado`);
    closeModal();
  }

  function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
    document.body.style.overflow = '';
    selectedVariantId = null;
  }

  // ══════════════════════════════════════════════
  //  CART
  // ══════════════════════════════════════════════

  function changeQty(id, delta) {
    const key = String(id);
    if (!cart[key]) return;
    cart[key].qty += delta;
    if (cart[key].qty <= 0) delete cart[key];
    updateUI();
    saveCart();
    renderCart();
  }

  function updateUI() {
    const count = Object.values(cart).reduce((s, i) => s + i.qty, 0);
    const el = document.getElementById('cartCount');
    el.textContent = count;

    if (count > 0) {
      el.classList.add('visible');
      // Trigger pulse animation
      el.classList.remove('pulse');
      void el.offsetWidth; // force reflow
      el.classList.add('pulse');
    } else {
      el.classList.remove('visible');
    }

    document.getElementById('cartTotal').textContent =
      'RD$ ' + Object.values(cart).reduce((s, i) => s + i.precio * i.qty, 0).toLocaleString();
    document.getElementById('wsBtn').disabled = count === 0;
  }

  function renderCart() {
    const items = Object.values(cart);
    const el = document.getElementById('cartItems');

    if (!items.length) {
      el.innerHTML = '<div class="cart-empty">Tu carrito esta vacio</div>';
      return;
    }

    el.innerHTML = items.map(i => `
      <div class="cart-item">
        <div class="cart-item-info">
          <p class="cart-item-name">${esc(i.marca)} ${esc(i.nombre)}</p>
          <p class="cart-item-flavor">${esc(i.sabor)}</p>
          <div class="cart-item-controls">
            <button class="qty-btn" data-qty-id="${i.id}" data-qty-delta="-1" aria-label="Reducir cantidad">\u2212</button>
            <span class="qty-num">${i.qty}</span>
            <button class="qty-btn" data-qty-id="${i.id}" data-qty-delta="1" aria-label="Aumentar cantidad">+</button>
          </div>
        </div>
        <span class="cart-item-price">RD$${(i.precio * i.qty).toLocaleString()}</span>
      </div>`).join('');

    // Event delegation for qty buttons
    el.onclick = e => {
      const btn = e.target.closest('.qty-btn');
      if (!btn) return;
      const id = parseInt(btn.dataset.qtyId, 10);
      const delta = parseInt(btn.dataset.qtyDelta, 10);
      if (!isNaN(id) && !isNaN(delta)) changeQty(id, delta);
    };
  }

  function openCart() {
    renderCart();
    document.getElementById('cartOverlay').classList.add('open');
    document.getElementById('cartDrawer').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeCart() {
    document.getElementById('cartOverlay').classList.remove('open');
    document.getElementById('cartDrawer').classList.remove('open');
    document.body.style.overflow = '';
  }

  function generateOrderId() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
    const rand = String(Math.floor(Math.random() * 900) + 100); // 3-digit random
    return `VX-${date}-${time}-${rand}`;
  }

  function sendToWhatsApp() {
    const items = Object.values(cart);
    if (!items.length) return;
    const orderId = generateOrderId();
    const total = items.reduce((s, i) => s + i.precio * i.qty, 0);
    let msg = `Hola Vapexotic! Quiero hacer el siguiente pedido:\n\n`;
    msg += `*Pedido ${orderId}*\n\n`;
    items.forEach(i => {
      msg += `\u2022 ${i.qty}x ${i.marca} ${i.nombre} (${i.sabor}) \u2014 RD$ ${(i.precio * i.qty).toLocaleString()}\n`;
    });
    msg += `\n*Total: RD$ ${total.toLocaleString()}*\n\nCual es el numero de cuenta y como coordinamos la entrega?`;
    window.open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  // ══════════════════════════════════════════════
  //  TOAST
  // ══════════════════════════════════════════════

  let toastTimer = null;

  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // ══════════════════════════════════════════════
  //  KEYBOARD HANDLING
  // ══════════════════════════════════════════════

  function initKeyboard() {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('modalOverlay');
        const cartDrawer = document.getElementById('cartDrawer');
        if (modal.classList.contains('open')) {
          closeModal();
        } else if (cartDrawer.classList.contains('open')) {
          closeCart();
        }
      }
    });

    // Close modal on overlay click
    document.getElementById('modalOverlay').addEventListener('click', e => {
      if (e.target === document.getElementById('modalOverlay')) closeModal();
    });
  }

  // ══════════════════════════════════════════════
  //  BACK TO TOP
  // ══════════════════════════════════════════════

  function initBackToTop() {
    const btn = document.getElementById('backToTop');
    if (!btn) return;
    window.addEventListener('scroll', () => {
      btn.classList.toggle('visible', window.scrollY > 500);
    }, { passive: true });
    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ══════════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════════

  function init() {
    initHeroTitle();
    initSearch();
    initSort();
    initKeyboard();
    initImageErrorHandler();
    initBackToTop();
    loadCart();
    loadProducts();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API (exposed for onclick handlers in HTML)
  return {
    openCart,
    closeCart,
    closeModal,
    addSelectedToCart,
    sendToWhatsApp,
  };

})();
