let products = [];
let categories = [];
let activeFilter = "All";
let activeGroup = null;
let activeSubcategory = null;
let selectedProduct = null;
let selectedVariant = null;
let currentQuote = null;
let storeSettings = {
  freeShippingThreshold: 2499,
  standardShippingFee: 80,
  storeName: "EXAMPLE",
  contactEmail: "[PENDING STORE OWNER APPROVAL: Contact Email]",
  contactPhone: "[PENDING STORE OWNER APPROVAL: Contact Phone]"
};

const $ = s => document.querySelector(s);
const money = n => "₹" + Number(n || 0).toLocaleString("en-IN");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
const FALLBACK_IMAGE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='800' viewBox='0 0 600 800' fill='%23e5e2da'><rect width='100%25' height='100%25' fill='%23eceae4'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='monospace' font-size='20' fill='%23999'>EXAMPLE</text></svg>";

// --- CART PERSISTENCE (localStorage) ---
const CART_STORAGE_KEY = "example_cart_v1";

function loadSavedCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {}
}

let cart = loadSavedCart();

// --- CATEGORY METADATA & DESCRIPTIONS ---
const CATEGORY_META = {
  All: {
    eyebrow: "COLLECTION / ALL",
    title: "SHOP ALL <i>PIECES.</i>",
    desc: "Independent style engineered for character and endurance. Heavyweight streetwear essentials and oversized silhouettes."
  },
  Men: {
    eyebrow: "COLLECTION / MEN",
    title: "MEN'S <i>COLLECTION.</i>",
    desc: "Precision tailoring, oversized silhouettes, and heavy streetwear essentials crafted for everyday wear."
  },
  Women: {
    eyebrow: "COLLECTION / WOMEN",
    title: "WOMEN'S <i>COLLECTION.</i>",
    desc: "Contemporary cuts, fluid tailoring, and elevated casual statement pieces made to be remembered."
  },
  Kids: {
    eyebrow: "COLLECTION / KIDS",
    title: "KIDS <i>COLLECTION.</i>",
    desc: "Playful proportions, durable heavyweight fabrics, and clean everyday comfort for boys and girls."
  },
  Footwear: {
    eyebrow: "COLLECTION / FOOTWEAR",
    title: "FOOTWEAR <i>COLLECTION.</i>",
    desc: "Sculpted soles, premium leathercraft, and timeless streetwear silhouettes built to ground every fit."
  },
  Accessories: {
    eyebrow: "COLLECTION / ACCESSORIES",
    title: "ACCESSORIES <i>COLLECTION.</i>",
    desc: "Considered leather goods, minimal headwear, and functional everyday accents to complete your look."
  },
  Sale: {
    eyebrow: "CURATED ARCHIVE / SALE",
    title: "SEASONAL <i>REDUCTIONS.</i>",
    desc: "Curated archive pieces and seasonal styles at special prices. Limited quantities available."
  }
};

// --- ROUTING & CLEAN URL HELPERS ---
function buildCollectionUrl(filter, group = null, sub = null) {
  if (!filter || filter === "Home") return "/";
  const catSlug = filter.toLowerCase();
  const params = new URLSearchParams();
  if (group) params.set("group", group);
  if (sub) {
    const cleanSub = (group && sub.toLowerCase().startsWith(group.toLowerCase() + " - "))
      ? sub.slice(group.length + 3)
      : sub;
    params.set("sub", cleanSub);
  }
  const query = params.toString();
  return `/collections/${catSlug}${query ? "?" + query : ""}`;
}

function parseCurrentRoute() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const search = new URLSearchParams(window.location.search);

  if (path === "/products" || path.startsWith("/products/")) {
    const rawSegments = path.replace("/products", "").split("/").filter(Boolean);
    const slug = rawSegments[0] ? decodeURIComponent(rawSegments[0]).trim() : null;
    return {
      isProduct: Boolean(slug),
      slug: slug,
      isCollection: !slug,
      filter: "All",
      group: null,
      sub: null
    };
  }

  if (path === "/collections" || path.startsWith("/collections/")) {
    const rawSegments = path.replace("/collections", "").split("/").filter(Boolean);
    const catKey = rawSegments[0] || search.get("category") || "all";
    const catMap = {
      all: "All",
      men: "Men",
      women: "Women",
      kids: "Kids",
      footwear: "Footwear",
      accessories: "Accessories",
      sale: "Sale"
    };
    const filter = catMap[catKey.toLowerCase()] || "All";

    let group = search.get("group") || null;
    let sub = search.get("sub") || null;

    if (rawSegments.length >= 2) {
      if (filter === "Kids" || filter === "Footwear") {
        group = decodeURIComponent(rawSegments[1]);
        if (rawSegments[2]) sub = decodeURIComponent(rawSegments[2]);
      } else {
        sub = decodeURIComponent(rawSegments[1]);
      }
    }

    return {
      isProduct: false,
      slug: null,
      isCollection: true,
      filter,
      group,
      sub
    };
  }

  return {
    isProduct: false,
    slug: null,
    isCollection: false,
    filter: "All",
    group: null,
    sub: null
  };
}

function navigateTo(url, push = true) {
  if (push && window.location.pathname + window.location.search !== url) {
    window.history.pushState({}, "", url);
  }
  applyRoute();
  if (url === "/" || url === "") {
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    window.scrollTo({ top: 0, behavior: "instant" });
  }
}

function renderBreadcrumbs() {
  const list = $("#breadcrumbsList");
  if (!list) return;

  const parts = [`<a href="/" data-nav>HOME</a>`];

  if (activeFilter === "All") {
    parts.push(`<span class="bc-sep">/</span><span class="bc-current">ALL PIECES</span>`);
  } else {
    const catUrl = buildCollectionUrl(activeFilter);
    if (!activeGroup && !activeSubcategory) {
      parts.push(`<span class="bc-sep">/</span><span class="bc-current">${esc(activeFilter.toUpperCase())}</span>`);
    } else {
      parts.push(`<span class="bc-sep">/</span><a href="${catUrl}" data-nav>${esc(activeFilter.toUpperCase())}</a>`);

      if (activeGroup) {
        const groupUrl = buildCollectionUrl(activeFilter, activeGroup);
        if (!activeSubcategory || activeSubcategory.toLowerCase() === activeGroup.toLowerCase()) {
          parts.push(`<span class="bc-sep">/</span><span class="bc-current">${esc(activeGroup.toUpperCase())}</span>`);
        } else {
          parts.push(`<span class="bc-sep">/</span><a href="${groupUrl}" data-nav>${esc(activeGroup.toUpperCase())}</a>`);
          const leafName = activeSubcategory.toLowerCase().startsWith(activeGroup.toLowerCase() + " - ")
            ? activeSubcategory.slice(activeGroup.length + 3)
            : activeSubcategory;
          parts.push(`<span class="bc-sep">/</span><span class="bc-current">${esc(leafName.toUpperCase())}</span>`);
        }
      } else if (activeSubcategory) {
        parts.push(`<span class="bc-sep">/</span><span class="bc-current">${esc(activeSubcategory.toUpperCase())}</span>`);
      }
    }
  }

  list.innerHTML = parts.join(" ");
}

let currentPdpProduct = null;
let currentPdpVariant = null;
let currentPdpImageIndex = 0;
let currentPdpQty = 1;

function clearPdpSeo() {
  const existingJsonLd = document.getElementById("pdpJsonLd");
  if (existingJsonLd) existingJsonLd.remove();
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute("href", window.location.origin + window.location.pathname);
  if (document.title.includes("— EXAMPLE®")) {
    document.title = "EXAMPLE® — Modern Luxury Fashion & Curated Wardrobe";
  }
}

function updatePdpSeo(p) {
  document.title = `${p.name} — EXAMPLE®`;

  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement("meta");
    metaDesc.name = "description";
    document.head.appendChild(metaDesc);
  }
  const cleanDesc = (p.description || `${p.name} from the EXAMPLE editorial collection.`).replace(/\s+/g, " ").trim();
  metaDesc.content = cleanDesc.slice(0, 160);

  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = `${window.location.origin}/products/${p.slug}`;

  let jsonLd = document.getElementById("pdpJsonLd");
  if (!jsonLd) {
    jsonLd = document.createElement("script");
    jsonLd.id = "pdpJsonLd";
    jsonLd.type = "application/ld+json";
    document.head.appendChild(jsonLd);
  }

  const images = (p.images && p.images.length) ? p.images : (p.image ? [p.image] : []);
  const schemaData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": p.name,
    "image": images,
    "description": cleanDesc,
    "sku": p.sku || `EX-${p.id}`,
    "brand": {
      "@type": "Brand",
      "name": p.brand || "EXAMPLE"
    },
    "category": p.category || "Fashion",
    "offers": {
      "@type": "Offer",
      "url": `${window.location.origin}/products/${p.slug}`,
      "priceCurrency": "INR",
      "price": p.price,
      "priceValidUntil": "2027-12-31",
      "itemCondition": "https://schema.org/NewCondition",
      "availability": (p.totalStock > 0) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "seller": {
        "@type": "Organization",
        "name": "EXAMPLE®"
      }
    }
  };
  jsonLd.textContent = JSON.stringify(schemaData, null, 2);
}

function openLightbox(src) {
  const modal = $("#imageLightboxModal");
  const img = $("#lightboxImg");
  if (!modal || !img) return;

  // Normalize / sanitize src
  if (Array.isArray(src)) src = src[0];
  if (typeof src !== "string" || !src.trim()) {
    if (typeof currentPdpProduct !== "undefined" && currentPdpProduct) {
      src = currentPdpProduct.image || (currentPdpProduct.images && currentPdpProduct.images[0]) || FALLBACK_IMAGE;
    } else {
      src = FALLBACK_IMAGE;
    }
  }
  src = String(src).trim();
  if (!src) src = FALLBACK_IMAGE;

  // Preload image before revealing modal to prevent broken image / empty overlay
  const preloader = new Image();
  let completed = false;

  const timer = setTimeout(() => {
    if (!completed) {
      completed = true;
      console.warn("Lightbox preloader timed out for:", src);
      closeLightbox();
    }
  }, 8000);

  preloader.onload = function() {
    if (completed) return;
    completed = true;
    clearTimeout(timer);
    img.src = src;
    img.alt = (typeof currentPdpProduct !== "undefined" && currentPdpProduct?.name)
      ? `${currentPdpProduct.name} — Enlarged Photograph`
      : "Enlarged product photograph";
    modal.classList.add("open", "is-open");
    modal.removeAttribute("hidden");
    document.body.style.overflow = "hidden";
  };

  preloader.onerror = function() {
    if (completed) return;
    completed = true;
    clearTimeout(timer);
    console.warn("Lightbox failed to load primary image:", src);
    if (src !== FALLBACK_IMAGE) {
      const fallbackPreloader = new Image();
      fallbackPreloader.onload = function() {
        img.src = FALLBACK_IMAGE;
        img.alt = "Enlarged product photograph";
        modal.classList.add("open", "is-open");
        modal.removeAttribute("hidden");
        document.body.style.overflow = "hidden";
      };
      fallbackPreloader.onerror = function() {
        closeLightbox();
      };
      fallbackPreloader.src = FALLBACK_IMAGE;
    } else {
      closeLightbox();
    }
  };

  preloader.src = src;
}

function closeLightbox() {
  const modal = $("#imageLightboxModal");
  if (!modal) return;
  modal.classList.remove("open", "is-open");
  modal.setAttribute("hidden", "");
  const img = $("#lightboxImg");
  if (img) img.removeAttribute("src");
  document.body.style.overflow = "";
}

// Lightbox listeners
$("#lightboxClose")?.addEventListener("click", e => {
  e.preventDefault();
  e.stopPropagation();
  closeLightbox();
});

$("#imageLightboxModal")?.addEventListener("click", e => {
  if (e.target === $("#imageLightboxModal") || e.target.classList.contains("lightbox-content") || e.target.id === "lightboxClose") {
    e.preventDefault();
    closeLightbox();
  }
});

window.addEventListener("keydown", e => {
  if (e.key === "Escape" || e.key === "Esc") {
    closeLightbox();
  }
});

function setupPdpInteractions(p, images, variants) {
  const wrap = $("#pdpMainImageWrap");
  const mainImg = $("#pdpMainImg");
  const thumbnails = $("#pdpThumbnails");
  const prevBtn = $("#pdpGalleryPrev");
  const nextBtn = $("#pdpGalleryNext");

  function switchImage(idx) {
    if (!images.length) return;
    currentPdpImageIndex = (idx + images.length) % images.length;
    if (mainImg) mainImg.src = images[currentPdpImageIndex];
    if (thumbnails) {
      thumbnails.querySelectorAll(".pdp-thumb-btn").forEach((btn, i) => {
        btn.classList.toggle("active", i === currentPdpImageIndex);
      });
    }
  }

  prevBtn?.addEventListener("click", e => {
    e.stopPropagation();
    switchImage(currentPdpImageIndex - 1);
  });
  nextBtn?.addEventListener("click", e => {
    e.stopPropagation();
    switchImage(currentPdpImageIndex + 1);
  });

  thumbnails?.addEventListener("click", e => {
    const btn = e.target.closest(".pdp-thumb-btn");
    if (btn && btn.dataset.idx !== undefined) {
      switchImage(parseInt(btn.dataset.idx, 10));
    }
  });

  wrap?.addEventListener("click", e => {
    if (e.target.closest("#pdpGalleryPrev") || e.target.closest("#pdpGalleryNext")) return;
    const activeSrc = (images && images[currentPdpImageIndex]) || p.image || (p.images && p.images[0]) || FALLBACK_IMAGE;
    openLightbox(activeSrc);
  });

  function updateVariantDisplay() {
    const stockBadge = $("#pdpStockBadge");
    const qtyInput = $("#pdpQtyInput");
    const addBtn = $("#pdpAddToBag");
    const stock = currentPdpVariant ? (currentPdpVariant.stock ?? 0) : 0;

    if (stockBadge) {
      if (stock <= 0) {
        stockBadge.textContent = "OUT OF STOCK";
        stockBadge.className = "stock-pill stock-out";
      } else if (stock <= 3) {
        stockBadge.textContent = `ONLY ${stock} LEFT`;
        stockBadge.className = "stock-pill";
      } else {
        stockBadge.textContent = "IN STOCK";
        stockBadge.className = "stock-pill";
      }
    }

    if (stock <= 0) {
      currentPdpQty = 0;
      if (qtyInput) {
        qtyInput.value = 0;
        qtyInput.max = 0;
      }
      if (addBtn) {
        addBtn.disabled = true;
        addBtn.textContent = "OUT OF STOCK";
      }
    } else {
      if (currentPdpQty <= 0) currentPdpQty = 1;
      if (currentPdpQty > stock) currentPdpQty = stock;
      if (qtyInput) {
        qtyInput.value = currentPdpQty;
        qtyInput.max = stock;
      }
      if (addBtn) {
        addBtn.disabled = false;
        addBtn.textContent = `ADD TO BAG — ${money(p.price * currentPdpQty)}`;
      }
    }
  }

  $("#pdpSizesRow")?.addEventListener("click", e => {
    const btn = e.target.closest(".pdp-size-btn");
    if (!btn) return;
    const selectedSize = btn.dataset.size;
    const curColour = currentPdpVariant?.colour || "";
    const match = variants.find(v => v.size === selectedSize && (curColour ? (v.colour || "") === curColour : true))
      || variants.find(v => v.size === selectedSize);
    if (match) {
      currentPdpVariant = match;
      $("#pdpSizesRow").querySelectorAll(".pdp-size-btn").forEach(b => b.classList.toggle("selected", b === btn));
      const lbl = $("#pdpSelectedSizeLabel");
      if (lbl) lbl.textContent = selectedSize;
      updateVariantDisplay();
    }
  });

  $("#pdpColoursRow")?.addEventListener("click", e => {
    const btn = e.target.closest(".pdp-colour-btn");
    if (!btn) return;
    const selectedColour = btn.dataset.colour;
    const curSize = currentPdpVariant?.size || "";
    const match = variants.find(v => (v.colour || "") === selectedColour && (curSize ? v.size === curSize : true))
      || variants.find(v => (v.colour || "") === selectedColour);
    if (match) {
      currentPdpVariant = match;
      $("#pdpColoursRow").querySelectorAll(".pdp-colour-btn").forEach(b => b.classList.toggle("selected", b === btn));
      const lbl = $("#pdpSelectedColourLabel");
      if (lbl) lbl.textContent = selectedColour;
      updateVariantDisplay();
    }
  });

  $("#pdpQtyDec")?.addEventListener("click", () => {
    if (currentPdpQty > 1) {
      currentPdpQty--;
      updateVariantDisplay();
    }
  });
  $("#pdpQtyInc")?.addEventListener("click", () => {
    const max = currentPdpVariant ? (currentPdpVariant.stock ?? 99) : 99;
    if (currentPdpQty < max) {
      currentPdpQty++;
      updateVariantDisplay();
    }
  });

  $("#pdpAddToBag")?.addEventListener("click", () => {
    if (!currentPdpVariant || (currentPdpVariant.stock ?? 0) <= 0) return;
    addCart(p.id, currentPdpVariant.size, currentPdpVariant.colour || "", currentPdpQty);
    const feedback = $("#pdpFeedback");
    if (feedback) {
      feedback.textContent = `ADDED ${currentPdpQty} ${currentPdpQty === 1 ? 'PIECE' : 'PIECES'} TO BAG ✓`;
      feedback.classList.remove("error");
      setTimeout(() => { feedback.textContent = ""; }, 2500);
    }
    openCart();
  });

  document.querySelectorAll(".pdp-accordion-trigger").forEach(trigger => {
    trigger.addEventListener("click", () => {
      const item = trigger.closest(".pdp-accordion-item");
      if (!item) return;
      const isOpen = item.classList.toggle("open");
      trigger.setAttribute("aria-expanded", String(isOpen));
    });
  });
}

async function renderProductDetailPage(slug) {
  const container = $("#pdpContainer");
  const breadcrumbList = $("#pdpBreadcrumbsList");
  if (!container) return;

  if (!products || products.length === 0) {
    container.innerHTML = `
      <div class="pdp-loading" style="text-align:center;padding:120px 20px;font:11px 'DM Mono', monospace;letter-spacing:0.1em;color:var(--muted)">
        LOCATING ARCHIVAL PIECE...
      </div>
    `;
    return;
  }

  let p = products.find(x => x.slug === slug && x.isActive !== false);

  if (!p) {
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(slug)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.product && data.product.is_active !== 0 && data.product.isActive !== false) {
          p = {
            ...data.product,
            image: data.product.image || (data.product.images || [])[0] || "",
            desc: data.product.description || "",
            tag: data.product.totalStock === 0 ? "SOLD OUT" : ""
          };
        }
      }
    } catch (_) {}
  }

  if (!p || p.isActive === false) {
    clearPdpSeo();
    document.title = "Piece Unavailable — EXAMPLE®";
    if (breadcrumbList) {
      breadcrumbList.innerHTML = `<a href="/" data-nav>HOME</a> <span class="bc-sep">/</span> <span class="bc-current">NOT FOUND</span>`;
    }
    container.innerHTML = `
      <div class="pdp-unavailable">
        <p class="pdp-eyebrow">ARCHIVAL NOTICE / 404</p>
        <h2>THIS PIECE IS CURRENTLY UNAVAILABLE.</h2>
        <p class="pdp-unavailable-desc">The requested item may have been vaulted, relocated, or is no longer in active circulation.</p>
        <a href="/collections/all" class="pdp-unavailable-btn" data-nav>EXPLORE ALL PIECES ↗</a>
      </div>
    `;
    return;
  }

  currentPdpProduct = p;
  updatePdpSeo(p);

  if (breadcrumbList) {
    const parts = [`<a href="/" data-nav>HOME</a>`];
    if (p.category) {
      const catUrl = buildCollectionUrl(p.category);
      parts.push(`<span class="bc-sep">/</span><a href="${catUrl}" data-nav>${esc(p.category.toUpperCase())}</a>`);
      if (p.subcategory) {
        const subUrl = buildCollectionUrl(p.category, null, p.subcategory);
        parts.push(`<span class="bc-sep">/</span><a href="${subUrl}" data-nav>${esc(p.subcategory.toUpperCase())}</a>`);
      }
    }
    parts.push(`<span class="bc-sep">/</span><span class="bc-current">${esc(p.name.toUpperCase())}</span>`);
    breadcrumbList.innerHTML = parts.join(" ");
  }

  const images = (p.images && p.images.length) ? p.images : (p.image ? [p.image] : [FALLBACK_IMAGE]);
  currentPdpImageIndex = 0;

  const variants = Array.isArray(p.variants) && p.variants.length
    ? p.variants
    : [{ size: "Free Size", colour: "", stock: p.totalStock ?? 10 }];

  currentPdpVariant = variants.find(v => (v.stock ?? 0) > 0) || variants[0];
  currentPdpQty = 1;

  const availableSizes = [...new Set(variants.map(v => v.size).filter(Boolean))];
  const availableColours = [...new Set(variants.map(v => v.colour).filter(Boolean))];

  const isUnconfirmedDiscount = ["ex-1003", "ex-1001"].includes(p.sku) || (p.brand && ["BALMAIN PARIS", "Calvin Klein"].includes(p.brand));
  const hasDiscount = !isUnconfirmedDiscount && p.compareAtPrice && p.compareAtPrice > p.price;
  const discountPercent = hasDiscount ? Math.round(((p.compareAtPrice - p.price) / p.compareAtPrice) * 100) : 0;
  const savingsAmount = hasDiscount ? p.compareAtPrice - p.price : 0;

  let related = products.filter(item => String(item.id) !== String(p.id) && item.category === p.category && item.isActive !== false).slice(0, 4);
  if (related.length === 0) {
    related = products.filter(item => String(item.id) !== String(p.id) && item.isActive !== false).slice(0, 4);
  }

  const getStockStatus = (stock) => {
    if (stock <= 0) return { text: "OUT OF STOCK", isOut: true };
    if (stock <= 3) return { text: `ONLY ${stock} LEFT`, isOut: false };
    return { text: "IN STOCK", isOut: false };
  };
  const initialStock = getStockStatus(currentPdpVariant.stock ?? 0);

  container.innerHTML = `
    <div class="pdp-layout">
      <!-- LEFT: Image Gallery -->
      <div class="pdp-gallery">
        <div class="pdp-main-image-wrap" id="pdpMainImageWrap">
          <img id="pdpMainImg" src="${esc(images[0])}" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'" alt="${esc(p.name)}" class="pdp-main-image">
          <span class="pdp-zoom-badge">🔍 CLICK TO ENLARGE</span>
          ${images.length > 1 ? `
            <button class="pdp-gallery-arrow pdp-prev" id="pdpGalleryPrev" aria-label="Previous photograph">←</button>
            <button class="pdp-gallery-arrow pdp-next" id="pdpGalleryNext" aria-label="Next photograph">→</button>
          ` : ""}
        </div>
        ${images.length > 1 ? `
          <div class="pdp-thumbnails" id="pdpThumbnails" role="tablist" aria-label="Product thumbnails">
            ${images.map((img, idx) => `
              <button class="pdp-thumb-btn ${idx === 0 ? 'active' : ''}" data-idx="${idx}" role="tab" aria-label="Photograph view ${idx + 1}">
                <img src="${esc(img)}" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'" alt="Angle ${idx + 1}">
              </button>
            `).join("")}
          </div>
        ` : ""}
      </div>

      <!-- RIGHT: Product Info & Actions -->
      <div class="pdp-info">
        <p class="pdp-eyebrow">${esc((p.category || "").toUpperCase())}${p.subcategory ? ` · ${esc(p.subcategory.toUpperCase())}` : ""} / ARCHIVE 001</p>
        <h1 class="pdp-title">${esc(p.name)}</h1>
        <div class="pdp-sku">REF: ${esc(p.sku || `EX-${p.id}`)}</div>

        <div class="pdp-price-row">
          <span class="pdp-price" id="pdpPriceDisplay">${money(p.price)}</span>
          ${hasDiscount ? `
            <s class="pdp-compare-price">${money(p.compareAtPrice)}</s>
            <span class="pdp-discount-tag">${discountPercent}% OFF · SAVE ${money(savingsAmount)}</span>
          ` : ""}
          <span id="pdpStockBadge" class="stock-pill ${initialStock.isOut ? 'stock-out' : ''}">${initialStock.text}</span>
        </div>

        ${p.material ? `
          <div class="pdp-material-highlight">
            <strong>FABRICATION & MATERIAL:</strong> ${esc(p.material)}
          </div>
        ` : ""}

        <!-- SIZES -->
        ${availableSizes.length > 0 ? `
          <div class="pdp-option-label">SELECT SIZE: <span id="pdpSelectedSizeLabel">${esc(currentPdpVariant.size || 'Standard')}</span></div>
          <div class="pdp-sizes" id="pdpSizesRow">
            ${availableSizes.map(size => {
              const matchingVar = variants.find(v => v.size === size && (currentPdpVariant.colour ? (v.colour || "") === currentPdpVariant.colour : true)) || variants.find(v => v.size === size);
              const isOut = !matchingVar || (matchingVar.stock ?? 0) <= 0;
              const isSel = currentPdpVariant.size === size;
              return `
                <button class="pdp-size-btn ${isSel ? 'selected' : ''}" data-size="${esc(size)}" ${isOut ? 'data-out="1"' : ''}>
                  ${esc(size)}
                </button>
              `;
            }).join("")}
          </div>
        ` : ""}

        <!-- COLOURS -->
        ${availableColours.length > 0 ? `
          <div class="pdp-option-label">SELECT COLOUR: <span id="pdpSelectedColourLabel">${esc(currentPdpVariant.colour || 'Standard')}</span></div>
          <div class="pdp-colours" id="pdpColoursRow">
            ${availableColours.map(col => {
              const matchingVar = variants.find(v => (v.colour || "") === col && (currentPdpVariant.size ? v.size === currentPdpVariant.size : true)) || variants.find(v => (v.colour || "") === col);
              const isOut = !matchingVar || (matchingVar.stock ?? 0) <= 0;
              const isSel = (currentPdpVariant.colour || "") === col;
              return `
                <button class="pdp-colour-btn ${isSel ? 'selected' : ''}" data-colour="${esc(col)}" ${isOut ? 'data-out="1"' : ''}>
                  ${esc(col)}
                </button>
              `;
            }).join("")}
          </div>
        ` : ""}

        <!-- ACTIONS ROW: QTY & ADD TO BAG -->
        <div class="pdp-actions-row">
          <div class="pdp-qty-wrap">
            <button class="pdp-qty-btn" id="pdpQtyDec" aria-label="Decrease quantity">−</button>
            <input type="number" id="pdpQtyInput" value="1" min="1" max="${Math.max(1, currentPdpVariant.stock ?? 1)}" readonly>
            <button class="pdp-qty-btn" id="pdpQtyInc" aria-label="Increase quantity">+</button>
          </div>
          <button class="pdp-add-btn" id="pdpAddToBag" ${initialStock.isOut ? 'disabled' : ''}>
            ${initialStock.isOut ? 'OUT OF STOCK' : `ADD TO BAG — ${money(p.price)}`}
          </button>
        </div>
        <div class="pdp-feedback" id="pdpFeedback"></div>

        <!-- ACCORDIONS -->
        <div class="pdp-accordions" id="pdpAccordions">
          <div class="pdp-accordion-item open">
            <button class="pdp-accordion-trigger" aria-expanded="true">
              <span>DESCRIPTION & DETAILS</span>
              <span>+</span>
            </button>
            <div class="pdp-accordion-content">
              <p>${esc(p.description || "Crafted to exacting standards in limited quantities. An essential silhouette tailored for enduring style and refined everyday wear.")}</p>
              <ul>
                <li>Curated by EXAMPLE Editorial Studio</li>
                <li>Article Reference: ${esc(p.sku || `EX-${p.id}`)}</li>
                <li>Category: ${esc(p.category || "Apparel")}${p.subcategory ? ` · ${esc(p.subcategory)}` : ""}</li>
                <li>Direct consignment & verified craftsmanship</li>
              </ul>
            </div>
          </div>

          <div class="pdp-accordion-item">
            <button class="pdp-accordion-trigger" aria-expanded="false">
              <span>MATERIAL & CARE</span>
              <span>+</span>
            </button>
            <div class="pdp-accordion-content">
              <p><strong>Fabrication:</strong> ${esc(p.material || "100% Premium Combed Cotton / Fine Structured Twill")}</p>
              <p><strong>Care Guidelines:</strong></p>
              <ul>
                <li>Gentle machine wash cold with similar shades</li>
                <li>Do not tumble dry or wring</li>
                <li>Warm iron on reverse side</li>
                <li>Professional dry clean recommended for structured garments</li>
              </ul>
            </div>
          </div>

          <div class="pdp-accordion-item">
            <button class="pdp-accordion-trigger" aria-expanded="false">
              <span>SIZE & FIT ASSISTANCE</span>
              <span>+</span>
            </button>
            <div class="pdp-accordion-content">
              <p>Designed for a modern tailored silhouette with precise proportions. Fits true to size; we recommend ordering your standard size.</p>
              <p>For an intentionally relaxed, oversized drape, take one size up. Detailed garment measurements are verified prior to dispatch.</p>
            </div>
          </div>

          <div class="pdp-accordion-item">
            <button class="pdp-accordion-trigger" aria-expanded="false">
              <span>SHIPPING, RETURNS & CONCIERGE</span>
              <span>+</span>
            </button>
            <div class="pdp-accordion-content">
              <p><strong>Complimentary Domestic Shipping:</strong> Orders of ${money(storeSettings.free_shipping_threshold || 2499)} and above qualify for free delivery nationwide. Flat ${money(storeSettings.shipping_fee || 80)} applies for orders below the threshold.</p>
              <p><strong>Dispatch & Transit:</strong> Orders are packaged in bespoke protective garment boxes and dispatched within 24–48 business hours with express domestic tracking.</p>
              <p><strong>7-Day Returns:</strong> Eligible items may be returned or exchanged within 7 days of delivery, provided tags remain attached and garments are unworn.</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- RELATED PRODUCTS -->
    ${related.length > 0 ? `
      <section class="pdp-related-section" aria-label="Related pieces">
        <h2>CURATED PIECES</h2>
        <div class="product-grid" id="pdpRelatedGrid">
          ${related.map(rel => `
            <article class="product-card" data-id="${esc(rel.id)}" data-slug="${esc(rel.slug)}">
              <div class="product-image">
                <a href="/products/${esc(rel.slug)}" data-nav class="product-image-link" aria-label="${esc(rel.name)}">
                  <img src="${esc(rel.image || FALLBACK_IMAGE)}" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'" alt="${esc(rel.name)}" loading="lazy">
                </a>
                ${rel.totalStock === 0 ? `<span class="product-tag" style="background:#b33d32;color:#fff">SOLD OUT</span>` : ((!["ex-1003", "ex-1001"].includes(rel.sku) && (rel.isSale || (rel.compareAtPrice && rel.compareAtPrice > rel.price))) ? `<span class="product-tag" style="background:#b33927;color:#fff">SALE</span>` : "")}
                <button class="quick-add" data-quick="${esc(rel.id)}" aria-label="Quick view">${rel.totalStock === 0 ? "VIEW DETAILS ↗" : "QUICK VIEW ↗"}</button>
              </div>
              <div class="product-meta">
                <a href="/products/${esc(rel.slug)}" data-nav class="product-title-link" style="color:inherit;text-decoration:none;"><span>${esc(rel.name)}</span></a>
                <span>${money(rel.price)}${(rel.compareAtPrice && !["ex-1003", "ex-1001"].includes(rel.sku)) ? ` <s style="color:var(--muted);font-size:10px">${money(rel.compareAtPrice)}</s>` : ""}</span>
              </div>
              <div class="product-category">${esc((rel.category || "").toUpperCase())}${rel.subcategory ? ` · ${esc(rel.subcategory.toUpperCase())}` : ""} / EXAMPLE 001 ${rel.totalStock === 0 ? `<span class="stock-pill stock-out">OUT OF STOCK</span>` : ""}</div>
            </article>
          `).join("")}
        </div>
      </section>
    ` : ""}
  `;

  setupPdpInteractions(p, images, variants);

  const relatedGrid = $("#pdpRelatedGrid");
  if (relatedGrid) {
    relatedGrid.addEventListener("click", e => {
      const quickBtn = e.target.closest("[data-quick]");
      if (quickBtn) {
        e.preventDefault();
        e.stopPropagation();
        openQuick(quickBtn.dataset.quick);
        return;
      }
      const navLink = e.target.closest("a[data-nav]");
      if (navLink) return;
      const card = e.target.closest(".product-card");
      if (card && card.dataset.slug) {
        e.preventDefault();
        navigateTo(`/products/${card.dataset.slug}`, true);
      }
    });
  }
}

function applyRoute() {
  const route = parseCurrentRoute();
  // Men's-first homepage: collection URLs remain unchanged; only the home grid defaults to Men.
  activeFilter = route.isCollection ? route.filter : (route.isProduct ? route.filter : "Men");
  activeGroup = route.group;
  activeSubcategory = route.sub;

  const homeSections = $("#homeSections");
  const homeLowerSections = $("#homeLowerSections");
  const homeProductHeading = $("#homeProductHeading");
  const collectionBreadcrumbs = $("#collectionBreadcrumbs");
  const collectionHeader = $("#collectionHeader");
  const productsSection = $("#products");
  const pdpSection = $("#productDetailSection");

  if (route.isProduct) {
    if (homeSections) homeSections.style.display = "none";
    if (homeLowerSections) homeLowerSections.style.display = "none";
    if (homeProductHeading) homeProductHeading.style.display = "none";
    if (collectionBreadcrumbs) collectionBreadcrumbs.style.display = "none";
    if (collectionHeader) collectionHeader.style.display = "none";
    if (productsSection) productsSection.style.display = "none";
    if (pdpSection) pdpSection.style.display = "block";

    document.querySelectorAll("#mainNav a[data-filter]").forEach(a => {
      a.style.borderBottom = "none";
      a.style.fontWeight = a.dataset.filter === "Sale" ? "700" : "400";
    });
    document.querySelectorAll(".filter").forEach(b => {
      b.classList.remove("active");
    });

    renderProductDetailPage(route.slug);
    return;
  }

  // Collection or Home route
  if (pdpSection) pdpSection.style.display = "none";
  if (productsSection) productsSection.style.display = "block";
  clearPdpSeo();

  if (route.isCollection) {
    if (homeSections) homeSections.style.display = "none";
    if (homeLowerSections) homeLowerSections.style.display = "none";
    if (homeProductHeading) homeProductHeading.style.display = "none";
    if (collectionBreadcrumbs) collectionBreadcrumbs.style.display = "flex";
    if (collectionHeader) collectionHeader.style.display = "block";

    const meta = CATEGORY_META[activeFilter] || CATEGORY_META.All;
    if ($("#collectionEyebrow")) $("#collectionEyebrow").textContent = meta.eyebrow;
    if ($("#collectionTitle")) $("#collectionTitle").innerHTML = meta.title;
    if ($("#collectionDesc")) $("#collectionDesc").textContent = meta.desc;

    renderBreadcrumbs();
  } else {
    if (homeSections) homeSections.style.display = "block";
    if (homeLowerSections) homeLowerSections.style.display = "block";
    if (homeProductHeading) homeProductHeading.style.display = "flex";
    if (collectionBreadcrumbs) collectionBreadcrumbs.style.display = "none";
    if (collectionHeader) collectionHeader.style.display = "none";
  }

  // Sync main navigation highlight
  document.querySelectorAll("#mainNav a[data-filter]").forEach(a => {
    const isActive = route.isCollection && a.dataset.filter?.toLowerCase() === activeFilter.toLowerCase();
    a.style.borderBottom = isActive ? "2px solid var(--ink)" : "none";
    a.style.fontWeight = isActive ? "700" : (a.dataset.filter === "Sale" ? "700" : "400");
  });

  // Sync filter pills in filter-row
  document.querySelectorAll(".filter").forEach(b => {
    b.classList.toggle("active", b.dataset.filter?.toLowerCase() === activeFilter.toLowerCase());
  });

  const allCount = $("#allCountBadge");
  if (allCount) allCount.textContent = String(products.length).padStart(2, "0");

  renderSubcategories();
  renderProducts(getSortedAndFilteredProducts());
}

// --- PRODUCT GRID RENDERING ---
function getSortedAndFilteredProducts() {
  let list = [...products];

  if (activeFilter === "Sale") {
    list = list.filter(p => p.isSale || (p.compareAtPrice && p.compareAtPrice > p.price) || (p.category || "").toLowerCase() === "sale");
  } else if (activeFilter !== "All") {
    list = list.filter(p => (p.category || "").toLowerCase() === activeFilter.toLowerCase());
  }

  if (activeGroup && !activeSubcategory) {
    const targetGroup = activeGroup.toLowerCase();
    list = list.filter(p => {
      const sub = (p.subcategory || "").toLowerCase();
      if (!sub) return false;
      return sub === targetGroup || sub.startsWith(targetGroup + " - ") || sub.endsWith(" - " + targetGroup);
    });
  } else if (activeSubcategory) {
    const target = activeSubcategory.toLowerCase();
    list = list.filter(p => {
      const sub = (p.subcategory || "").toLowerCase();
      if (!sub) return false;
      return sub === target || sub.startsWith(target + " - ") || sub.endsWith(" - " + target);
    });
  }

  const sort = $("#productSort")?.value || "featured";
  if (sort === "price_asc") {
    list.sort((a, b) => a.price - b.price);
  } else if (sort === "price_desc") {
    list.sort((a, b) => b.price - a.price);
  } else if (sort === "name_asc") {
    list.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === "newest") {
    list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }
  return list;
}

function renderProducts(list = getSortedAndFilteredProducts()) {
  const grid = $("#productGrid");
  if (!grid) return;

  const countBadge = $("#productCountBadge");
  if (countBadge) {
    countBadge.textContent = `${list.length} ${list.length === 1 ? 'PIECE' : 'PIECES'}`;
  }

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="collection-empty">
        <h3>NO PIECES FOUND IN THIS SELECTION.</h3>
        <p>We are currently crafting new arrivals for this category. Check back soon for the next drop.</p>
        <button class="btn-reset-filter" id="resetCategoryBtn">VIEW ALL ${esc(activeFilter.toUpperCase())} PIECES ↗</button>
      </div>
    `;
    const resetBtn = $("#resetCategoryBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        navigateTo(buildCollectionUrl(activeFilter));
      });
    }
    return;
  }

  grid.innerHTML = list.map(p => {
    // Owner Decision: Hide compare-at prices and discount percentage badges for unconfirmed items (Balmain, Calvin Klein) until owner confirmation
    const isUnconfirmedDiscount = ["ex-1003", "ex-1001"].includes(p.sku) || (p.brand && ["BALMAIN PARIS", "Calvin Klein"].includes(p.brand));
    const isSale = !isUnconfirmedDiscount && (p.isSale || (p.compareAtPrice && p.compareAtPrice > p.price));
    const discountPct = isSale && p.compareAtPrice ? Math.round(((p.compareAtPrice - p.price) / p.compareAtPrice) * 100) : 0;
    const brandLabel = p.brand ? esc(p.brand.toUpperCase()) : "EXAMPLE";
    const PLUS = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M6 1.5v9M1.5 6h9" stroke="currentColor" stroke-width="1.3" fill="none"/></svg>';
    const variants = Array.isArray(p.variants) && p.variants.length > 0
      ? p.variants
      : [{ size: "S", stock: 2 }, { size: "M", stock: 3 }, { size: "L", stock: 1 }];

    return `
    <article class="product-card pc pc-cut${p.totalStock === 0 ? ' pc-out' : ''}" data-id="${esc(p.id)}" data-slug="${esc(p.slug)}" data-cat="${esc(p.category)}">
      <div class="product-image pc-m">
        <a href="/products/${esc(p.slug)}" data-nav class="product-image-link pc-a" aria-label="${esc(p.name)}">
          <span class="gl contain" data-gl>
            <img src="${esc(p.image || FALLBACK_IMAGE)}" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'" alt="${esc(p.name)}" loading="lazy">
          </span>
        </a>
        ${p.totalStock === 0 ? `<span class="product-tag" style="background:#b33d32;color:#fff">SOLD OUT</span>` : (isSale ? `<span class="product-tag" style="background:var(--tag-sale);color:#fff">${discountPct > 0 ? `${discountPct}% OFF` : 'SALE'}</span>` : "")}
      </div>
      <div class="product-meta pc-t">
        <a href="/products/${esc(p.slug)}" data-nav class="product-title-link" style="color:inherit;text-decoration:none;">
          <span class="pn">${esc(p.name)}</span>
          <span class="pl mono"><span>${money(p.price)}</span>${(p.compareAtPrice && !isUnconfirmedDiscount) ? ` <s style="color:var(--muted);font-size:10px">${money(p.compareAtPrice)}</s>` : ""}${p.totalStock === 0 ? '<span class="stock-pill stock-out">Sold out</span>' : ''}</span>
        </a>
        ${p.totalStock === 0 ? '' : `<button class="pc-add quick-add" data-quick="${esc(p.id)}" type="button" aria-label="quick add ${esc(p.name)}" aria-expanded="false">${PLUS}</button>`}
      </div>
      <div class="product-category">${brandLabel} · ${esc((p.category || "").toUpperCase())}${p.subcategory ? ` · ${esc(p.subcategory.toUpperCase())}` : ""} / EXAMPLE 001 ${p.totalStock === 0 ? `<span class="stock-pill stock-out">OUT OF STOCK</span>` : ""}</div>
      <div class="pc-sz" role="group" aria-label="Pick a size" hidden>
        ${variants.map(v => `<button type="button" data-add-size="${esc(v.size || 'Free')}" data-prod-id="${esc(p.id)}"${(v.stock ?? 1) <= 0 ? ' disabled' : ''}>${esc((v.size || 'Free').toUpperCase())}</button>`).join("")}
      </div>
    </article>
  `;
  }).join("");

  // Wire in-card size selector buttons
  grid.querySelectorAll(".pc-add").forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      const card = btn.closest(".product-card");
      if (!card) return;
      const szRow = card.querySelector(".pc-sz");
      if (!szRow) return;
      const isHidden = szRow.hidden;
      // Close other open size rows
      grid.querySelectorAll(".pc-sz").forEach(r => r.hidden = true);
      szRow.hidden = !isHidden;
      btn.setAttribute("aria-expanded", String(!isHidden));
    });
  });

  grid.querySelectorAll("[data-add-size]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      const prodId = btn.dataset.prodId;
      const size = btn.dataset.addSize;
      if (!prodId) return;
      addCart(prodId, size, "", 1);
      const card = btn.closest(".product-card");
      if (card) {
        const szRow = card.querySelector(".pc-sz");
        if (szRow) szRow.hidden = true;
      }
      openCart();
    });
  });
}

function renderSubcategories() {
  const row = $("#subcategoryRow");
  if (!row) return;

  if (activeFilter === "All" || activeFilter === "Sale") {
    row.style.display = "none";
    row.innerHTML = "";
    return;
  }

  const catObj = categories.find(c => c.name.toLowerCase() === activeFilter.toLowerCase());
  if (!catObj) {
    row.style.display = "none";
    row.innerHTML = "";
    return;
  }

  const hasGroups = Array.isArray(catObj.groups) && catObj.groups.length > 0;

  if (hasGroups) {
    row.style.display = "flex";
    row.style.flexDirection = "column";
    row.style.gap = "10px";

    const groupsHtml = `
      <div class="group-pills" style="display:flex;flex-wrap:wrap;gap:8px;">
        <button class="sub-pill ${!activeGroup ? 'active' : ''}" data-group="">ALL ${esc(activeFilter.toUpperCase())}</button>
        ${catObj.groups.map(g => `
          <button class="sub-pill ${activeGroup?.toLowerCase() === g.name.toLowerCase() ? 'active' : ''}" data-group="${esc(g.name)}">${esc(g.name.toUpperCase())}</button>
        `).join("")}
      </div>
    `;

    let subPillsHtml = "";
    if (activeGroup) {
      const currentGroup = catObj.groups.find(g => g.name.toLowerCase() === activeGroup.toLowerCase());
      const subs = currentGroup?.subcategories || [];
      if (subs.length > 0) {
        subPillsHtml = `
          <div class="sub-pills" style="display:flex;flex-wrap:wrap;gap:6px;padding-left:8px;border-left:2px solid var(--line);">
            <button class="sub-pill ${(!activeSubcategory || activeSubcategory.toLowerCase() === activeGroup.toLowerCase()) ? 'active' : ''}" data-sub="">ALL ${esc(activeGroup.toUpperCase())}</button>
            ${subs.map(s => {
              const fullVal = `${currentGroup.name} - ${s.name}`;
              const isSelected = activeSubcategory && (activeSubcategory.toLowerCase() === fullVal.toLowerCase() || activeSubcategory.toLowerCase() === s.name.toLowerCase());
              return `<button class="sub-pill ${isSelected ? 'active' : ''}" data-sub="${esc(s.name)}">${esc(s.name.toUpperCase())}</button>`;
            }).join("")}
          </div>
        `;
      }
    }

    row.innerHTML = groupsHtml + subPillsHtml;

    row.querySelectorAll("[data-group]").forEach(btn => {
      btn.addEventListener("click", () => {
        const groupVal = btn.dataset.group || null;
        navigateTo(buildCollectionUrl(activeFilter, groupVal));
      });
    });

    row.querySelectorAll("[data-sub]").forEach(btn => {
      btn.addEventListener("click", () => {
        const subVal = btn.dataset.sub || null;
        navigateTo(buildCollectionUrl(activeFilter, activeGroup, subVal));
      });
    });

    return;
  }

  // Non-grouped categories (Men, Women, Accessories)
  const subs = catObj.subcategories || [];
  if (subs.length === 0) {
    row.style.display = "none";
    row.innerHTML = "";
    return;
  }

  row.style.display = "flex";
  row.style.flexDirection = "row";
  row.style.flexWrap = "wrap";
  row.style.gap = "8px";
  row.innerHTML = `
    <button class="sub-pill ${!activeSubcategory ? 'active' : ''}" data-sub="">ALL ${esc(activeFilter.toUpperCase())}</button>
    ${subs.map(s => `
      <button class="sub-pill ${activeSubcategory?.toLowerCase() === s.name.toLowerCase() ? 'active' : ''}" data-sub="${esc(s.name)}">${esc(s.name.toUpperCase())}</button>
    `).join("")}
  `;

  row.querySelectorAll("[data-sub]").forEach(btn => {
    btn.addEventListener("click", () => {
      const subVal = btn.dataset.sub || null;
      navigateTo(buildCollectionUrl(activeFilter, null, subVal));
    });
  });
}

function setFilter(f, sub = null) {
  navigateTo(buildCollectionUrl(f, null, sub));
}

$("#productSort")?.addEventListener("change", () => {
  renderProducts(getSortedAndFilteredProducts());
});

// History popstate navigation
window.addEventListener("popstate", () => {
  applyRoute();
});

// Intercept all data-nav links (top nav, category cards, breadcrumbs, logos)
document.addEventListener("click", e => {
  const link = e.target.closest("a[data-nav]");
  if (!link) return;
  const href = link.getAttribute("href");
  if (!href) return;

  if (href.startsWith("#") || href.includes("#story")) {
    const hash = href.includes("#") ? href.slice(href.indexOf("#")) : href;
    if (window.location.pathname !== "/") {
      e.preventDefault();
      navigateTo("/", true);
      setTimeout(() => {
        const el = document.querySelector(hash);
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
    return;
  }

  e.preventDefault();
  $("#mainNav")?.classList.remove("open");
  navigateTo(href, true);
});

// Category filter row buttons (clicks filter and navigate)
document.querySelectorAll(".filter").forEach(el => {
  el.addEventListener("click", e => {
    const f = el.dataset.filter;
    if (!f) return;
    e.preventDefault();
    navigateTo(buildCollectionUrl(f), true);
  });
});

$("#discoverAll")?.addEventListener("click", e => {
  e.preventDefault();
  navigateTo("/collections/all", true);
});

$("#productGrid")?.addEventListener("click", e => {
  const btn = e.target.closest("[data-quick]");
  if (btn) {
    e.preventDefault();
    e.stopPropagation();
    const id = btn.dataset.quick;
    if (id) openQuick(id);
    return;
  }
  const navLink = e.target.closest("a[data-nav]");
  if (navLink) return;
  const card = e.target.closest(".product-card");
  if (card && card.dataset.slug) {
    e.preventDefault();
    navigateTo(`/products/${card.dataset.slug}`, true);
  }
});

// --- QUICK VIEW & VARIANT SELECTION ---
function openQuick(idOrSlug) {
  selectedProduct = products.find(p => String(p.id) === String(idOrSlug) || p.slug === String(idOrSlug));
  if (!selectedProduct) return;
  const p = selectedProduct;

  const images = (p.images && p.images.length) ? p.images : (p.image ? [p.image] : []);
  const variants = Array.isArray(p.variants) && p.variants.length
    ? p.variants
    : [{ size: "Free Size", colour: "", stock: p.totalStock ?? 10 }];

  // Default select first available variant or first variant
  selectedVariant = variants.find(v => (v.stock ?? 0) > 0) || variants[0];

  const related = products.filter(item => String(item.id) !== String(p.id) && item.category === p.category).slice(0, 3);
  if (related.length === 0) {
    related.push(...products.filter(item => String(item.id) !== String(p.id)).slice(0, 3));
  }

  const content = $("#quickContent");
  if (!content) return;

  content.innerHTML = `
    <div class="quick-layout">
      <div>
        <img id="quickMainImg" src="${esc(images[0] || FALLBACK_IMAGE)}" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'" alt="${esc(p.name)}">
        ${images.length > 1 ? `
          <div class="quick-thumbs">
            ${images.map((img, i) => `<img src="${esc(img)}" class="${i === 0 ? 'active' : ''}" data-idx="${i}" alt="Thumbnail">`).join("")}
          </div>
        ` : ""}
      </div>
      <div class="quick-info">
        <p class="eyebrow">${esc((p.category || "").toUpperCase())} / EXAMPLE 001</p>
        <h3>${esc(p.name)}</h3>
        <p class="quick-price">
          ${money(p.price)}
          ${(p.compareAtPrice && !(["ex-1003", "ex-1001"].includes(p.sku) || (p.brand && ["BALMAIN PARIS", "Calvin Klein"].includes(p.brand)))) ? `<s style="color:var(--muted);font-size:12px;margin-left:8px">${money(p.compareAtPrice)}</s>` : ""}
          <span id="variantStockBadge" class="stock-pill ${selectedVariant.stock === 0 ? 'stock-out' : ''}">
            ${selectedVariant.stock > 0 ? (selectedVariant.stock <= 3 ? `ONLY ${selectedVariant.stock} LEFT` : 'IN STOCK') : 'OUT OF STOCK'}
          </span>
        </p>
        <p>${esc(p.desc)}</p>
        <div class="size-label">SELECT SIZE &amp; FIT</div>
        <div class="sizes" id="quickSizes">
          ${variants.map(v => `
            <button data-size="${esc(v.size)}" data-colour="${esc(v.colour || '')}" class="${v === selectedVariant ? 'selected' : ''}" ${v.stock === 0 ? 'disabled title="Out of stock"' : ''}>
              ${esc(v.size)}${v.colour ? ` (${esc(v.colour)})` : ''}
            </button>
          `).join("")}
        </div>
        <button class="add-btn" id="addToBag" ${selectedVariant.stock === 0 ? 'disabled style="opacity:0.4;cursor:not-allowed"' : ''}>
          ${selectedVariant.stock === 0 ? 'OUT OF STOCK' : `ADD TO BAG — ${money(p.price)}`}
        </button>
        <div style="margin-top:14px;text-align:center;">
          <a href="/products/${esc(p.slug)}" class="quick-view-pdp-link" data-nav style="display:inline-block;font-family:'DM Mono',monospace;font-size:11px;letter-spacing:0.08em;color:var(--ink);text-decoration:none;border-bottom:1px solid var(--ink);padding-bottom:2px;">
            VIEW FULL PRODUCT DETAILS ↗
          </a>
        </div>
      </div>
    </div>
    ${related.length ? `
      <div class="quick-related" style="margin-top:24px;border-top:1px solid var(--line);padding-top:16px;">
        <p class="eyebrow" style="margin-bottom:10px;">COMPLETE THE LOOK / RELATED PIECES</p>
        <div style="display:grid;grid-template-columns:repeat(${Math.min(related.length, 3)}, 1fr);gap:10px;">
          ${related.map(r => `
            <div class="related-card" data-rel-id="${esc(r.id)}" style="cursor:pointer;background:#fff;border:1px solid var(--line);padding:8px;text-align:left;">
              <img src="${esc(r.image)}" alt="${esc(r.name)}" style="width:100%;height:100px;object-fit:cover;margin-bottom:6px;">
              <div style="font-size:10px;font-weight:700;line-height:1.3;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(r.name)}</div>
              <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--muted);">${money(r.price)}</div>
            </div>
          `).join("")}
        </div>
      </div>
    ` : ""}
  `;

  content.querySelectorAll("[data-rel-id]").forEach(card => {
    card.addEventListener("click", () => {
      openQuick(card.dataset.relId);
    });
  });

  content.querySelector(".quick-view-pdp-link")?.addEventListener("click", e => {
    e.preventDefault();
    closeQuick();
    navigateTo(`/products/${p.slug}`, true);
  });

  // Thumbnails click
  content.querySelectorAll(".quick-thumbs img").forEach(thumb => {
    thumb.addEventListener("click", () => {
      content.querySelectorAll(".quick-thumbs img").forEach(t => t.classList.remove("active"));
      thumb.classList.add("active");
      const main = $("#quickMainImg");
      if (main) main.src = thumb.src;
    });
  });

  // Variant selector click
  content.querySelector("#quickSizes")?.addEventListener("click", e => {
    const btn = e.target.closest("button");
    if (!btn || btn.disabled) return;
    const size = btn.dataset.size;
    const colour = btn.dataset.colour || "";
    selectedVariant = variants.find(v => v.size === size && (v.colour || "") === colour) || selectedVariant;

    content.querySelectorAll("#quickSizes button").forEach(b => b.classList.toggle("selected", b === btn));

    const badge = $("#variantStockBadge");
    const addBtn = $("#addToBag");
    if (badge) {
      badge.className = `stock-pill ${selectedVariant.stock === 0 ? 'stock-out' : ''}`;
      badge.textContent = selectedVariant.stock > 0
        ? (selectedVariant.stock <= 3 ? `ONLY ${selectedVariant.stock} LEFT` : 'IN STOCK')
        : 'OUT OF STOCK';
    }
    if (addBtn) {
      if (selectedVariant.stock === 0) {
        addBtn.disabled = true;
        addBtn.style.opacity = "0.4";
        addBtn.style.cursor = "not-allowed";
        addBtn.textContent = "OUT OF STOCK";
      } else {
        addBtn.disabled = false;
        addBtn.style.opacity = "1";
        addBtn.style.cursor = "pointer";
        addBtn.textContent = `ADD TO BAG — ${money(p.price)}`;
      }
    }
  });

  $("#addToBag")?.addEventListener("click", () => {
    if (!selectedVariant || selectedVariant.stock === 0) return;
    addCart(p.id, selectedVariant.size, selectedVariant.colour || "", 1);
    closeQuick();
    openCart();
  });

  $("#quickView")?.classList.add("open");
  $("#overlay")?.classList.add("show");
}

function closeQuick() {
  $("#quickView")?.classList.remove("open");
  if (!$("#cartDrawer")?.classList.contains("open") && !$("#searchPanel")?.classList.contains("open") && !$("#checkoutDrawer")?.classList.contains("open")) {
    $("#overlay")?.classList.remove("show");
  }
}
$("#quickClose")?.addEventListener("click", closeQuick);

// --- SHOPPING BAG ---
function addCart(id, size, colour = "", quantityToAdd = 1) {
  if (typeof colour === "number" && (quantityToAdd === 1 || typeof quantityToAdd !== "number")) {
    quantityToAdd = colour;
    colour = "";
  }
  const p = products.find(x => String(x.id) === String(id));
  if (!p) return;

  const toAdd = Math.max(1, parseInt(quantityToAdd, 10) || 1);
  const item = cart.find(x => String(x.id) === String(id) && x.size === size && (x.colour || "") === colour);
  const variant = Array.isArray(p.variants) ? p.variants.find(v => v.size === size && (v.colour || "") === colour) : null;
  const maxStock = variant ? (variant.stock ?? 99) : (p.totalStock ?? 99);

  if (item) {
    if (item.qty + toAdd <= maxStock) {
      item.qty += toAdd;
    } else {
      item.qty = maxStock;
      alert(`Maximum available stock (${maxStock}) reached for size ${size}.`);
    }
  } else {
    cart.push({ id, size, colour, qty: Math.min(toAdd, maxStock) });
  }

  saveCart(cart);
  renderCart();
}

function renderCart() {
  const count = cart.reduce((a, x) => a + x.qty, 0);
  let subtotal = 0;

  const itemsEl = $("#cartItems");
  const bagCountEl = $("#bagCount");
  const drawerCountEl = $("#drawerCount");
  const subtotalEl = $("#subtotal");
  const checkoutBtn = $("#checkoutBtn");

  if (bagCountEl) bagCountEl.textContent = `[${count}]`;
  if (drawerCountEl) drawerCountEl.textContent = `(${count})`;

  if (!cart.length) {
    if (itemsEl) itemsEl.innerHTML = `<div class="empty-cart">YOUR BAG IS WAITING.<br><span>Find something that feels like you.</span></div>`;
    if (subtotalEl) subtotalEl.textContent = money(0);
    updateShippingBar(0);
    if (checkoutBtn) {
      checkoutBtn.disabled = true;
      checkoutBtn.style.opacity = "0.5";
      checkoutBtn.style.cursor = "not-allowed";
    }
    return;
  }

  let hasUnavailable = false;
  const validCart = [];
  const linesHtml = cart.map(x => {
    const p = products.find(y => String(y.id) === String(x.id));
    if (!p) return "";
    validCart.push(x);
    const lineTotal = p.price * x.qty;
    subtotal += lineTotal;

    const variant = Array.isArray(p.variants) ? p.variants.find(v => v.size === x.size && (v.colour || "") === (x.colour || "")) : null;
    const maxStock = variant ? (variant.stock ?? 99) : (p.totalStock ?? 99);
    const isOut = maxStock <= 0;
    const isOver = x.qty > maxStock;
    if (isOut || isOver) hasUnavailable = true;

    return `
      <div class="cart-line">
        <img src="${esc(p.image || FALLBACK_IMAGE)}" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'" alt="${esc(p.name)}">
        <div>
          <h4>${esc(p.name)}</h4>
          <p>
            SIZE: ${esc(x.size)}${x.colour ? ` · ${esc(x.colour)}` : ''} · ${money(p.price)}
            ${isOut ? '<span class="stock-pill stock-out" style="margin-left:6px">OUT OF STOCK</span>' : (isOver ? `<span class="stock-pill stock-out" style="margin-left:6px">ONLY ${maxStock} LEFT</span>` : '')}
          </p>
          <div class="qty">
            <button data-qty="-1" data-id="${esc(x.id)}" data-size="${esc(x.size)}" data-colour="${esc(x.colour || '')}">−</button>
            <span>${x.qty}</span>
            <button data-qty="1" data-id="${esc(x.id)}" data-size="${esc(x.size)}" data-colour="${esc(x.colour || '')}" ${isOut || x.qty >= maxStock ? 'disabled' : ''}>+</button>
          </div>
        </div>
        <button class="remove-item" data-remove="${esc(x.id)}" data-size="${esc(x.size)}" data-colour="${esc(x.colour || '')}">REMOVE</button>
      </div>
    `;
  }).join("");

  if (itemsEl) itemsEl.innerHTML = linesHtml;
  if (subtotalEl) subtotalEl.textContent = money(subtotal);
  updateShippingBar(subtotal);

  if (checkoutBtn) {
    if (hasUnavailable) {
      checkoutBtn.disabled = true;
      checkoutBtn.style.opacity = "0.4";
      checkoutBtn.style.cursor = "not-allowed";
      checkoutBtn.title = "Please adjust or remove out-of-stock items";
    } else {
      checkoutBtn.disabled = false;
      checkoutBtn.style.opacity = "1";
      checkoutBtn.style.cursor = "pointer";
      checkoutBtn.title = "";
    }
  }
}

function updateShippingBar(subtotal) {
  const bar = $("#shippingBar");
  const note = $("#shippingNote");
  const threshold = typeof storeSettings.freeShippingThreshold === "number" && storeSettings.freeShippingThreshold >= 0
    ? storeSettings.freeShippingThreshold
    : 2499;

  if (bar) {
    let pct = 0;
    if (subtotal >= threshold) {
      pct = 100;
    } else if (subtotal > 0 && threshold > 0) {
      // Below threshold: visibly cap at 98% so the progress bar remains visibly incomplete
      pct = Math.min(98, Math.max(1, Math.floor((subtotal / threshold) * 100)));
    }
    bar.style.width = `${pct}%`;
  }
  if (note) {
    if (subtotal >= threshold) {
      note.textContent = "✓ COMPLIMENTARY SHIPPING UNLOCKED!";
      note.style.color = "var(--ink)";
    } else {
      const remaining = threshold - subtotal;
      note.textContent = `ADD ${money(remaining)} MORE FOR FREE SHIPPING`;
      note.style.color = "var(--muted)";
    }
  }
}

$("#cartItems")?.addEventListener("click", e => {
  const q = e.target.closest("[data-qty]");
  const r = e.target.closest("[data-remove]");

  if (q) {
    const id = q.dataset.id;
    const size = q.dataset.size;
    const colour = q.dataset.colour || "";
    const item = cart.find(i => String(i.id) === String(id) && i.size === size && (i.colour || "") === colour);
    if (!item) return;

    const delta = Number(q.dataset.qty);
    const p = products.find(x => String(x.id) === String(id));
    const variant = p?.variants?.find(v => v.size === size && (v.colour || "") === colour);
    const maxStock = variant ? (variant.stock ?? 99) : 99;

    if (delta > 0 && item.qty >= maxStock) {
      alert(`Only ${maxStock} in stock for this variant.`);
      return;
    }

    item.qty += delta;
    if (item.qty <= 0) {
      cart = cart.filter(i => i !== item);
    }
    saveCart(cart);
    renderCart();
  }

  if (r) {
    const id = r.dataset.remove;
    const size = r.dataset.size;
    const colour = r.dataset.colour || "";
    cart = cart.filter(i => !(String(i.id) === String(id) && i.size === size && (i.colour || "") === colour));
    saveCart(cart);
    renderCart();
  }
});

function openCart() {
  renderCart();
  $("#cartDrawer")?.classList.add("open");
  $("#overlay")?.classList.add("show");
  $("#bagOpen")?.setAttribute("aria-expanded", "true");
}

function closeCart() {
  $("#cartDrawer")?.classList.remove("open");
  $("#bagOpen")?.setAttribute("aria-expanded", "false");
  if (!$("#quickView")?.classList.contains("open") && !$("#searchPanel")?.classList.contains("open") && !$("#checkoutDrawer")?.classList.contains("open")) {
    $("#overlay")?.classList.remove("show");
  }
}

$("#bagOpen")?.addEventListener("click", openCart);
$("#cartClose")?.addEventListener("click", closeCart);

// --- EXPRESS CHECKOUT & RAZORPAY INTEGRATION ---
async function openCheckout() {
  if (!cart.length) {
    alert("Your shopping bag is empty. Add a piece before checkout.");
    return;
  }

  closeCart();
  const drawer = $("#checkoutDrawer");
  const form = $("#checkoutForm");
  const success = $("#checkoutSuccess");
  const errEl = $("#checkoutError");

  if (form) form.hidden = false;
  if (success) success.hidden = true;
  if (errEl) errEl.textContent = "";

  drawer?.classList.add("open");
  $("#overlay")?.classList.add("show");

  // Fetch live server quote
  try {
    const quoteRes = await fetch("/api/checkout/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart.map(i => ({ id: i.id, size: i.size, colour: i.colour || "", quantity: i.qty }))
      })
    });
    const quoteData = await quoteRes.json();
    if (!quoteRes.ok) throw new Error(quoteData.error || "Could not retrieve checkout quote.");

    currentQuote = quoteData;
    $("#chkSubtotal").textContent = money(quoteData.subtotal);
    $("#chkShipping").textContent = quoteData.shippingFee === 0 ? "FREE" : money(quoteData.shippingFee);
    $("#chkTotal").textContent = money(quoteData.total);
  } catch (err) {
    if (errEl) errEl.textContent = err.message;
  }
}

function closeCheckout() {
  $("#checkoutDrawer")?.classList.remove("open");
  if (!$("#cartDrawer")?.classList.contains("open") && !$("#quickView")?.classList.contains("open") && !$("#searchPanel")?.classList.contains("open")) {
    $("#overlay")?.classList.remove("show");
  }
}

$("#checkoutBtn")?.addEventListener("click", openCheckout);
$("#checkoutClose")?.addEventListener("click", closeCheckout);

$("#checkoutForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.currentTarget;
  const payBtn = $("#payButton");
  const errEl = $("#checkoutError");
  if (errEl) errEl.textContent = "";
  payBtn.disabled = true;
  payBtn.textContent = "INITIALIZING PAYMENT…";

  const formData = new FormData(form);
  const payload = {
    customerName: String(formData.get("name") || "").trim(),
    customerEmail: String(formData.get("email") || "").trim(),
    customerPhone: String(formData.get("phone") || "").trim(),
    shippingAddress: {
      street: String(formData.get("street") || "").trim(),
      landmark: String(formData.get("landmark") || "").trim() || undefined,
      city: String(formData.get("city") || "").trim(),
      state: String(formData.get("state") || "").trim(),
      pincode: String(formData.get("pincode") || "").trim()
    },
    items: cart.map(i => ({ id: i.id, size: i.size, colour: i.colour || "", quantity: i.qty }))
  };

  try {
    const orderRes = await fetch("/api/checkout/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const orderData = await orderRes.json();
    if (!orderRes.ok) throw new Error(orderData.error || "Order creation failed.");

    // Case 1: Standard Razorpay Modal (when not in mock testMode)
    if (orderData.razorpayOrderId && !orderData.testMode && window.Razorpay) {
      const options = {
        key: orderData.razorpayKeyId,
        amount: orderData.total * 100,
        currency: "INR",
        name: "EXAMPLE® STORE",
        description: `Order ${orderData.orderNumber}`,
        image: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=120&q=80",
        order_id: orderData.razorpayOrderId,
        prefill: {
          name: orderData.customerName,
          email: orderData.customerEmail,
          contact: orderData.customerPhone
        },
        theme: {
          color: "#171715"
        },
        handler: async function (response) {
          payBtn.textContent = "VERIFYING PAYMENT…";
          try {
            const verifyRes = await fetch("/api/checkout/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: orderData.orderId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature
              })
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || "Payment signature verification failed.");

            completeOrderSuccess(orderData.orderNumber);
          } catch (vErr) {
            alert(`Payment verification error: ${vErr.message}`);
          }
        },
        modal: {
          ondismiss: function () {
            payBtn.disabled = false;
            payBtn.textContent = "PROCEED TO SECURE PAYMENT ↗";
          }
        }
      };

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.open();
      return;
    }

    // Case 2: Test / Demo Mode fallback simulator (for development and pre-bank activation)
    if (orderData.testMode) {
      const confirmed = confirm(`Order created (Test Mode):\nOrder #${orderData.orderNumber}\nTotal: ₹${orderData.total}\n\nProceed with simulated payment verification?`);
      if (confirmed) {
        const verifyRes = await fetch("/api/checkout/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: orderData.orderId,
            testPayment: true
          })
        });
        const vData = await verifyRes.json();
        if (!verifyRes.ok) throw new Error(vData.error || "Test payment verification failed.");
        completeOrderSuccess(orderData.orderNumber);
      } else {
        payBtn.disabled = false;
        payBtn.textContent = "PROCEED TO SECURE PAYMENT ↗";
      }
      return;
    }

    throw new Error("Payment gateway response unexpected.");
  } catch (err) {
    if (errEl) errEl.textContent = err.message;
    payBtn.disabled = false;
    payBtn.textContent = "PROCEED TO SECURE PAYMENT ↗";
  }
});

function completeOrderSuccess(orderNumber) {
  cart = [];
  saveCart(cart);
  renderCart();

  const form = $("#checkoutForm");
  const success = $("#checkoutSuccess");
  const numEl = $("#successOrderNumber");

  if (form) form.hidden = true;
  if (success) success.hidden = false;
  if (numEl) numEl.textContent = orderNumber;

  $("#successTrackBtn")?.addEventListener("click", () => {
    closeCheckout();
    openTrackOrder(orderNumber);
  }, { once: true });

  $("#continueShoppingBtn")?.addEventListener("click", closeCheckout, { once: true });
}

// --- ORDER TRACKING ---
function openTrackOrder(prefillOrderNumber = "") {
  const modal = $("#trackModal");
  if (!modal) return;
  modal.hidden = false;
  $("#accountBtn")?.setAttribute("aria-expanded", "true");
  const input = modal.querySelector('input[name="orderNumber"]');
  if (input && prefillOrderNumber) input.value = prefillOrderNumber;
  $("#trackResult").innerHTML = "";
}

function closeTrackOrder() {
  const modal = $("#trackModal");
  if (modal) modal.hidden = true;
  $("#accountBtn")?.setAttribute("aria-expanded", "false");
}

$("#accountBtn")?.addEventListener("click", () => openTrackOrder());
$("#footerTrack")?.addEventListener("click", e => { e.preventDefault(); openTrackOrder(); });
$("#trackClose")?.addEventListener("click", closeTrackOrder);
$("#trackModal")?.addEventListener("click", e => {
  if (e.target === $("#trackModal")) closeTrackOrder();
});

$("#trackForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.currentTarget;
  const btn = form.querySelector("button");
  const resultEl = $("#trackResult");
  btn.disabled = true;
  btn.textContent = "SEARCHING…";
  resultEl.innerHTML = "";

  const orderNum = form.elements.orderNumber.value.trim();
  const contact = form.elements.contact.value.trim();

  try {
    const res = await fetch(`/api/orders/track?order_number=${encodeURIComponent(orderNum)}&contact=${encodeURIComponent(contact)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Order not found. Please verify details.");

    const ord = data.order;
    const stages = ["pending", "paid", "processing", "shipped", "delivered"];
    const currentIdx = stages.indexOf(ord.status);
    const isCancelledOrRefunded = ord.status === 'cancelled' || ord.status === 'refunded';

    resultEl.innerHTML = `
      <div style="background:#eeece6;padding:16px;border:1px solid var(--line);margin-bottom:16px">
        <p class="eyebrow" style="margin-bottom:6px">ORDER #${esc(ord.orderNumber)} · ${new Date(ord.createdAt).toLocaleDateString('en-IN')}</p>
        <p style="font-size:14px;margin:0">Recipient: <strong>${esc(ord.customerName)}</strong></p>
        <p style="font-size:12px;color:var(--muted);margin:4px 0 0">Payment: <strong>${esc(ord.paymentStatus).toUpperCase()}</strong> · Total: <strong>${money(ord.total)}</strong></p>
      </div>

      ${isCancelledOrRefunded ? `
        <div style="background:#fbf7f6;border:1px solid #e8dcd9;padding:14px;margin-bottom:16px;color:#8a3b32;">
          <strong style="letter-spacing:0.05em;">ORDER ${esc(ord.status).toUpperCase()}</strong>
          ${ord.cancellationReason ? `<p style="margin:4px 0 0;font-size:12px;">Reason: <strong>${esc(ord.cancellationReason)}</strong></p>` : ''}
          <p style="margin:4px 0 0;font-size:11px;color:#77766f;">Any processed payment will be refunded to your original payment method within 5–7 business days.</p>
        </div>
      ` : `
        <div class="timeline-wrap">
          ${stages.map((st, i) => `
            <div class="timeline-step ${i <= currentIdx ? 'active' : ''}">
              ${st.toUpperCase()}
            </div>
          `).join("")}
        </div>
      `}

      ${(ord.trackingNumber || ord.shippingCarrier) ? `
        <div style="background:#f8f7f3;border:1px solid var(--line);padding:14px;margin:16px 0;font-size:12px;">
          <p class="eyebrow" style="margin-bottom:4px">SHIPMENT &amp; CARRIER TRACKING</p>
          ${ord.shippingCarrier ? `<p style="margin:2px 0;">Carrier: <strong>${esc(ord.shippingCarrier)}</strong></p>` : ''}
          ${ord.trackingNumber ? `<p style="margin:2px 0 6px;">Waybill / Tracking: <code style="font-family:monospace;background:#eeece7;padding:2px 6px;">${esc(ord.trackingNumber)}</code></p>` : ''}
          ${ord.trackingUrl ? `<p style="margin:6px 0 0;"><a href="${esc(ord.trackingUrl)}" target="_blank" rel="noopener noreferrer" class="under-link" style="font-weight:700;">TRACK COURIER SHIPMENT ↗</a></p>` : ''}
        </div>
      ` : ''}
      <div style="margin-top:16px">
        <p class="eyebrow">ORDERED PIECES</p>
        <div style="display:grid;gap:8px">
          ${(ord.items || []).map(it => `
            <div style="display:flex;justify-content:space-between;font-size:12px;border-bottom:1px solid var(--line);padding-bottom:6px">
              <span><strong>${esc(it.product_name)}</strong> (Size: ${esc(it.size)}${it.colour ? `, ${esc(it.colour)}` : ''}) × ${it.quantity}</span>
              <strong>${money(it.unit_price * it.quantity)}</strong>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  } catch (err) {
    resultEl.innerHTML = `<p style="color:#b33d32;font-size:12px">${esc(err.message)}</p>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "TRACK ↗";
  }
});

// --- POLICY MODALS (ABOUT, CONTACT, SHIPPING, RETURNS, REFUND, CANCELLATION, PRIVACY, TERMS) ---
const POLICIES = {
  about: {
    eyebrow: "04 / OUR STORY & PHILOSOPHY",
    title: "ABOUT US & BRAND MANIFESTO.",
    body: `
      <p><strong>Brand Identity &amp; Vision:</strong> [PENDING STORE OWNER APPROVAL: Official brand origin statement, design philosophy, and verified aesthetic manifesto for EXAMPLE].</p>
      <p><strong>Studio Location &amp; Heritage:</strong> [PENDING STORE OWNER APPROVAL: Studio founding history, flagship studio location in Kozhikode, Kerala, and official founder statement].</p>
      <p><strong>Design &amp; Sourcing Disclosures:</strong> [PENDING STORE OWNER APPROVAL: Verified owner disclosures regarding fabric selection, garment manufacturing standards, artisan partnerships, and batch production sizes].</p>
      <p><strong>Consumer Transparency Commitment:</strong> We dress individuals who express their own point of view, upholding honest customer communication, transparent pricing, and zero deceptive sales practices.</p>
    `
  },
  contact: {
    eyebrow: "STUDIO CONCIERGE & SUPPORT",
    title: "CONNECT WITH OUR STUDIO.",
    body: `
      <p><strong>Registered Studio &amp; Office:</strong><br>[PENDING STORE OWNER APPROVAL: Full registered business address, building name, street, city, state — PIN Code, India].</p>
      <p><strong>Customer Care Email:</strong> [PENDING STORE OWNER APPROVAL: Official Customer Support Email, e.g. care@examplefashion.com / hello@example.com]</p>
      <p><strong>Phone &amp; WhatsApp Concierge:</strong> [PENDING STORE OWNER APPROVAL: Official Support Phone / WhatsApp Number, e.g. +91 9XXXXXXXXX]</p>
      <p><strong>Customer Care Operating Hours:</strong> [PENDING STORE OWNER APPROVAL: Customer support working days and operating hours, e.g., Monday through Saturday, 10:00 AM – 6:00 PM IST (Excluding Gazetted National Holidays)].</p>
      <p><strong>Grievance Redressal (Consumer Protection E-Commerce Rules, 2020 &amp; DPDP Framework):</strong><br>
      • Grievance Officer: [PENDING STORE OWNER APPROVAL: Name and Corporate Designation of appointed Grievance Officer]<br>
      • Official Grievance Email: [PENDING STORE OWNER APPROVAL: Dedicated Grievance Redressal Email]<br>
      • Statutory Acknowledgment: Within 48 hours of ticket receipt.<br>
      • Grievance Resolution SLA: [PENDING STORE OWNER APPROVAL: Operational grievance resolution turnaround SLA, subject to statutory maximum under Rule 5(9)].</p>
    `
  },
  shipping: {
    eyebrow: "FULFILLMENT & LOGISTICS",
    title: "SHIPPING & DELIVERY INFORMATION.",
    body: `
      <p><strong>Studio Dispatch SLA:</strong> [PENDING STORE OWNER APPROVAL: Verified order handling, quality inspection, and dispatch timeframe from Kozhikode studio].</p>
      <p><strong>Domestic Delivery SLA:</strong> [PENDING STORE OWNER APPROVAL: Verified commercial courier delivery SLA nationwide, e.g., metro and regional delivery commitments].</p>
      <p><strong>Logistics Carriers:</strong> [PENDING STORE OWNER APPROVAL: Contracted third-party courier and logistics partners, e.g., Blue Dart, Delhivery, DTDC, India Post].</p>
      <p><strong>Transparent Shipping Rates &amp; Free Delivery Threshold:</strong><br>
      • <strong>Complimentary Standard Delivery:</strong> Applied automatically to eligible orders qualifying at or above ₹2,499.<br>
      • <strong>Standard Flat Delivery Fee:</strong> ₹80 applied to orders below ₹2,499.<br>
      <em>All shipping charges and thresholds are transparently itemized prior to checkout initiation with zero drip pricing or unadvertised handling fees.</em></p>
      <p><strong>Real-Time Tracking:</strong> Secure tracking credentials and carrier tracking links are transmitted via email/SMS upon dispatch and remain accessible on-site via our Track Order tool.</p>
      <p><strong>Transit Damage &amp; Package Tampering:</strong> [PENDING STORE OWNER APPROVAL: Customer reporting timeframe, photographic verification protocol, and claim procedure for parcels arriving damaged, opened, or tampered with].</p>
    `
  },
  returns: {
    eyebrow: "EXCHANGE & RETURNS POLICY",
    title: "RETURN & EXCHANGE POLICY.",
    body: `
      <p><strong>Return / Exchange Window:</strong> [PENDING STORE OWNER APPROVAL: Commercial return and exchange eligibility window, e.g., within 7 calendar days of verified carrier delivery].</p>
      <p><strong>Garment Condition Standards:</strong> [PENDING STORE OWNER APPROVAL: Specific garment condition standards upon return, e.g., strictly unworn, unwashed, unaltered pieces with original brand tags and intact packaging].</p>
      <p><strong>Non-Returnable &amp; Final Sale Categories:</strong> [PENDING STORE OWNER APPROVAL: Explicit list of non-returnable categories, e.g., intimate apparel, socks, custom altered pieces, accessories, and archive clearance items].</p>
      <p><strong>Reverse Pickup &amp; Return Freight Logistics:</strong> [PENDING STORE OWNER APPROVAL: Reverse logistics availability across serviceable PIN codes, courier scheduling terms, or customer self-shipment courier reimbursement guidelines].</p>
      <p><strong>Studio Quality Inspection:</strong> [PENDING STORE OWNER APPROVAL: Studio quality check inspection turnaround timeline upon warehouse receipt prior to processing replacement or refund].</p>
    `
  },
  refund: {
    eyebrow: "FINANCIAL SETTLEMENTS & REFUNDS",
    title: "REFUND & REIMBURSEMENT POLICY.",
    body: `
      <p><strong>Refund Eligibility:</strong> Provided for verified returns passing studio inspection, pre-dispatch cancelled orders, or confirmed lost consignments.</p>
      <p><strong>Payment Reversal Mode:</strong> In compliance with Reserve Bank of India (RBI) payment aggregator regulations, all online electronic transactions are refunded strictly to the original payment source (Credit/Debit Card, Net Banking, UPI) through our authorized payment gateway partners. Cash on Delivery refunds (if activated) are disbursed via verified bank account NEFT/IMPS transfer or store credit [PENDING STORE OWNER APPROVAL: Approved payment reversal mechanisms].</p>
      <p><strong>Settlement Timelines:</strong> [PENDING STORE OWNER APPROVAL: Store refund processing timeline and acquiring bank settlement disclaimer].</p>
      <p><strong>Delivery Fee Refundability:</strong> [PENDING STORE OWNER APPROVAL: Store policy on retention or refund of standard shipping charges (₹80) upon customer-initiated returns].</p>
      <p><strong>Failed Transactions &amp; Dropped Connections:</strong> If funds are debited from a customer account but an order fails to generate due to network dropouts, the payment gateway initiates an uncaptured reversal in accordance with the RBI Turnaround Time (TAT) framework (typically within 1 to 5 banking days depending on payment method).</p>
    `
  },
  cancellation: {
    eyebrow: "ORDER AMENDMENTS & CANCELLATIONS",
    title: "ORDER CANCELLATION POLICY.",
    body: `
      <p><strong>Pre-Dispatch Cancellation Cutoff:</strong> [PENDING STORE OWNER APPROVAL: Pre-dispatch cancellation cutoff window, e.g., within 2 hours of placement before studio order processing].</p>
      <p><strong>Post-Dispatch Order Handling:</strong> [PENDING STORE OWNER APPROVAL: Policy on post-dispatch cancellation feasibility, doorstep courier refusal handling, and return-to-origin (RTO) charges if any].</p>
      <p><strong>Self-Service Cancellation:</strong> Customers can submit a cancellation request via the Track Order utility using their Order Number and verified contact details, or via customer concierge.</p>
      <p><strong>Immediate Stock Restoral:</strong> Verified cancellations immediately release variant inventory back to our active storefront catalog.</p>
      <p><strong>Store-Initiated Cancellations:</strong> [PENDING STORE OWNER APPROVAL: Store cancellation rights, customer notification protocol, and 100% full refund procedure in cases of unforeseen stock discrepancies or unserviceable delivery locations].</p>
    `
  },
  privacy: {
    eyebrow: "PRIVACY & DATA GOVERNANCE",
    title: "DATA PROTECTION & INTEGRITY.",
    body: `
      <p><strong>Data Minimization Principle:</strong> We collect only personal data necessary to execute, deliver, and service customer purchases: Customer Name, Email Address, Mobile Phone Number, Delivery Address, and Order History.</p>
      <p><strong>Financial Credential Security:</strong> EXAMPLE never receives, handles, or stores sensitive payment card numbers, CVVs, or Net Banking credentials. All payment transactions are securely tokenized through authorized payment gateway partners (e.g., Razorpay) using 256-bit SSL encryption.</p>
      <p><strong>Zero Third-Party Data Monetization:</strong> We strictly never sell, rent, lease, or broker customer personal information or behavioral records to third-party data brokers or external advertisers.</p>
      <p><strong>Digital Personal Data Protection Act (DPDP Act, 2023) &amp; DPDP Rules Readiness:</strong> In alignment with the phased commencement of the DPDP Act, 2023 and the DPDP Rules, 2025, we are establishing progressive technical and organizational safeguards. Customers may contact our Grievance Officer to inquire about their personal data on file, request corrections, or request data erasure, subject to statutory retention obligations and identity verification.</p>
      <p><strong>Statutory Grievance Redressal:</strong> In accordance with Section 5(9) of the Consumer Protection (E-Commerce) Rules, 2020 and applicable data governance frameworks:<br>
      • Grievance Officer: [PENDING STORE OWNER APPROVAL: Name, Designation &amp; Official Contact]<br>
      • Official Email: [PENDING STORE OWNER APPROVAL: Dedicated Grievance Redressal Email]<br>
      • Registered Studio Address: [PENDING STORE OWNER APPROVAL: Registered Office Postal Address, Kozhikode, Kerala, India]<br>
      • Statutory Acknowledgment: Within 48 hours; resolution within prescribed statutory timelines.</p>
    `
  },
  terms: {
    eyebrow: "TERMS OF SERVICE & SALE",
    title: "STORE TERMS & CONDITIONS.",
    body: `
      <p><strong>Store Ownership &amp; Legal Entity:</strong> This website and commerce platform is operated by [PENDING STORE OWNER APPROVAL: Registered Legal Entity Name, e.g., Sole Proprietorship, Partnership, LLP, or Private Limited Company]. Registered Office: [PENDING STORE OWNER APPROVAL: Full Registered Address, Kozhikode, Kerala, India].</p>
      <p><strong>GST Registration &amp; Tax Determination:</strong> [PENDING STORE OWNER APPROVAL &amp; CA DETERMINATION: GST registration status, 15-digit GSTIN (if registered under Kerala State Code 32), or applicable statutory composition/threshold exemption under the Central Goods and Services Tax (CGST) Act, 2017 (including Notification No. 34/2023-Central Tax). Product pricing and tax treatment are determined based on verified legal seller structure and CA advice].</p>
      <p><strong>Transparent Pricing (No Drip Pricing):</strong> In readiness for the Consumer Protection (E-Commerce) Amendment Rules, 2026 (effective 1 January 2027), all prices, applicable shipping fees, and taxes are clearly disclosed to consumers before checkout initiation. We do not impose unexpected fees at final payment steps.</p>
      <p><strong>Prohibition of Dark Patterns:</strong> In compliance with the Guidelines for Prevention and Regulation of Dark Patterns, 2023 and the 2026 Amendment Rules, this website strictly prohibits deceptive design practices, including false urgency countdowns, basket sneaking (unsolicited additions to cart), confirm shaming, and hidden subscription loops.</p>
      <p><strong>Search Ranking &amp; Sponsored Listings Transparency:</strong> Search and category listings are ranked organically based on clear parameters (Relevance, Newest, and Price). If sponsored or promoted listings are introduced in the future, they will carry an explicit, conspicuous "Sponsored" disclosure tag.</p>
      <p><strong>Product Representation &amp; Color Fidelity:</strong> We make every reasonable effort to accurately display garment silhouettes, color palettes, and fabric finishes. Actual appearance may vary slightly depending on individual display hardware and ambient illumination.</p>
      <p><strong>Intellectual Property:</strong> All original photography, typography, logos, brand assets, and editorial copy published on this platform are the exclusive intellectual property of EXAMPLE and protected under the Copyright Act, 1957, and Trade Marks Act, 1999.</p>
      <p><strong>Limitation of Liability:</strong> [PENDING STORE OWNER APPROVAL &amp; LEGAL REVIEW: Enforceability of limitation of liability provisions, capped at the order value paid by the customer].</p>
      <p><strong>Governing Law &amp; Jurisdiction:</strong> [PENDING STORE OWNER APPROVAL &amp; LEGAL REVIEW: Governing law (Laws of India) and specific dispute resolution forum/jurisdiction clause (e.g., competent courts in Kozhikode, Kerala, India)].</p>
    `
  }
};

function openPolicy(type) {
  const modal = $("#policyModal");
  const p = POLICIES[type];
  if (!modal || !p) return;
  $("#policyEyebrow").textContent = p.eyebrow;
  $("#policyTitle").textContent = p.title;
  $("#policyBody").innerHTML = p.body;
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
}

function closePolicy() {
  const modal = $("#policyModal");
  if (modal) {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }
}

// Hook up policy click listeners
$("#policyAbout")?.addEventListener("click", e => { e.preventDefault(); openPolicy("about"); });
$("#policyContact")?.addEventListener("click", e => { e.preventDefault(); openPolicy("contact"); });
$("#policyShipping")?.addEventListener("click", e => { e.preventDefault(); openPolicy("shipping"); });
$("#policyReturns")?.addEventListener("click", e => { e.preventDefault(); openPolicy("returns"); });
$("#policyRefund")?.addEventListener("click", e => { e.preventDefault(); openPolicy("refund"); });
$("#policyCancellation")?.addEventListener("click", e => { e.preventDefault(); openPolicy("cancellation"); });
$("#policyPrivacy")?.addEventListener("click", e => { e.preventDefault(); openPolicy("privacy"); });
$("#policyTerms")?.addEventListener("click", e => { e.preventDefault(); openPolicy("terms"); });
$("#storyContactLink")?.addEventListener("click", e => { e.preventDefault(); openPolicy("contact"); });
$("#policyClose")?.addEventListener("click", closePolicy);
$("#policyModal")?.addEventListener("click", e => {
  if (e.target === $("#policyModal")) closePolicy();
});

// Hash navigation listener for direct policy links (#shipping, #returns, #refund, #cancellation, #privacy, #terms, #contact, #about, #track)
function handleHashNavigation() {
  const hash = (window.location.hash || "").toLowerCase();
  if (!hash) return;
  const policyKey = hash.replace("#", "");
  if (POLICIES[policyKey]) {
    openPolicy(policyKey);
  } else if (hash === "#track") {
    openTrackOrder();
  }
}
window.addEventListener("hashchange", handleHashNavigation);

// --- SEARCH PANEL ---
function openSearch() {
  $("#searchPanel")?.classList.add("open");
  $("#overlay")?.classList.add("show");
  $("#searchOpen")?.setAttribute("aria-expanded", "true");
  $("#searchInput")?.focus();
}

function closeSearch() {
  $("#searchPanel")?.classList.remove("open");
  $("#searchOpen")?.setAttribute("aria-expanded", "false");
  if (!$("#cartDrawer")?.classList.contains("open") && !$("#quickView")?.classList.contains("open") && !$("#checkoutDrawer")?.classList.contains("open")) {
    $("#overlay")?.classList.remove("show");
  }
}

$("#searchOpen")?.addEventListener("click", openSearch);
$("#searchClose")?.addEventListener("click", closeSearch);

$("#searchInput")?.addEventListener("input", e => {
  const q = e.target.value.toLowerCase().trim();
  const found = q ? products.filter(p => (p.name + " " + p.category + " " + (p.subcategory || "") + " " + (p.desc || "") + " " + (p.sku || "")).toLowerCase().includes(q)) : [];
  const resultsEl = $("#searchResults");
  if (!resultsEl) return;
  resultsEl.innerHTML = q
    ? (found.length
      ? found.map(p => `
        <a href="/products/${esc(p.slug)}" class="search-result" data-search-id="${esc(p.id)}" data-search-slug="${esc(p.slug)}">
          <img src="${esc(p.image || FALLBACK_IMAGE)}" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'" alt="${esc(p.name)}" loading="lazy">
          <div>
            <div style="font-size:12px;font-weight:600;">${esc(p.name)}</div>
            <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--muted);">${esc(p.category || '')}${p.subcategory ? ` · ${esc(p.subcategory)}` : ''} — ${money(p.price)}</div>
          </div>
        </a>
      `).join("")
      : `<div class="no-results">No matching pieces found for "${esc(q)}".</div>`)
    : "";
});

$("#searchResults")?.addEventListener("click", e => {
  const a = e.target.closest("[data-search-id]");
  if (a) {
    e.preventDefault();
    closeSearch();
    const slug = a.dataset.searchSlug;
    if (slug) {
      navigateTo(`/products/${slug}`, true);
    } else {
      openQuick(a.dataset.searchId);
    }
  }
});

// --- GENERAL NAVIGATION & OVERLAY ---
function closeMenu() {
  const mainNav = $("#mainNav");
  if (mainNav && mainNav.classList.contains("open")) {
    mainNav.classList.remove("open");
    $("#menuToggle")?.setAttribute("aria-expanded", "false");
    $("#overlay")?.classList.remove("show");
  }
}

function openMenu() {
  const mainNav = $("#mainNav");
  if (mainNav) {
    mainNav.classList.add("open");
    $("#menuToggle")?.setAttribute("aria-expanded", "true");
    $("#overlay")?.classList.add("show");
  }
}

$("#overlay")?.addEventListener("click", () => {
  closeCart();
  closeQuick();
  closeSearch();
  closeCheckout();
  closeTrackOrder();
  closeMenu();
});

$("#menuToggle")?.addEventListener("click", () => {
  const isOpen = $("#mainNav")?.classList.contains("open");
  if (isOpen) {
    closeMenu();
  } else {
    openMenu();
  }
});

$("#menuClose")?.addEventListener("click", closeMenu);

$("#mainNav")?.addEventListener("click", e => {
  if (e.target.closest("a") || e.target.closest("button:not(#menuClose)")) {
    closeMenu();
  }
});

$("#searchOpenDesktop")?.addEventListener("click", openSearch);
$("#accountBtnDesktop")?.addEventListener("click", () => openTrackOrder());

$("#newsletterForm")?.addEventListener("submit", e => {
  e.preventDefault();
  $("#newsletterMessage").textContent = "THANK YOU — YOU'RE ON THE LIST.";
  e.target.reset();
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeCart();
    closeQuick();
    closeSearch();
    closeCheckout();
    closeTrackOrder();
    closePolicy();
    closeMenu();
  }
});

// --- THEME SYSTEM (LIGHT / DARK) ---
function getEffectiveTheme() {
  const saved = localStorage.getItem("example_theme");
  if (saved === "dark" || saved === "light") return saved;
  const systemPrefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return systemPrefersDark ? "dark" : "light";
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");

  const meta = document.getElementById("metaThemeColor");
  if (meta) {
    meta.setAttribute("content", isDark ? "#0e0e0d" : "#fbfaf7");
  }

  document.querySelectorAll(".theme-toggle").forEach(btn => {
    const icon = btn.querySelector(".theme-icon");
    const label = btn.querySelector(".theme-label");
    if (icon) icon.textContent = isDark ? "☼" : "◐";
    if (label) {
      if (btn.id === "footerThemeToggle") {
        label.textContent = isDark ? "LIGHT MODE" : "DARK MODE";
      } else if (btn.id === "mobileThemeToggle") {
        label.textContent = isDark ? "SWITCH TO LIGHT" : "SWITCH TO DARK";
      } else {
        label.textContent = isDark ? "LIGHT" : "DARK";
      }
    }
    btn.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
    btn.setAttribute("title", isDark ? "Switch to light theme" : "Switch to dark theme");
  });
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || getEffectiveTheme();
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem("example_theme", next);
  applyTheme(next);
}

function initThemeSystem() {
  const theme = getEffectiveTheme();
  applyTheme(theme);

  document.querySelectorAll(".theme-toggle").forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault();
      toggleTheme();
    });
  });

  try {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", e => {
      if (!localStorage.getItem("example_theme")) {
        applyTheme(e.matches ? "dark" : "light");
      }
    });
  } catch (_) {}
}

// --- STORE INITIALIZATION & HASH ROUTING ---
async function loadStoreSettings() {
  try {
    const res = await fetch("/api/settings");
    if (res.ok) {
      const data = await res.json();
      if (data.settings) {
        storeSettings = { ...storeSettings, ...data.settings };
        const subtotal = cart.reduce((a, x) => {
          const p = products.find(y => String(y.id) === String(x.id));
          return a + (p ? p.price * x.qty : 0);
        }, 0);
        updateShippingBar(subtotal);
      }
    }
  } catch {}
}

async function loadStoreCategories() {
  try {
    const res = await fetch("/api/categories");
    if (res.ok) {
      const data = await res.json();
      if (data.ok && Array.isArray(data.categories)) {
        categories = data.categories;
        renderSubcategories();
      }
    }
  } catch (err) {
    console.warn("Failed to load categories:", err);
  }
}


// Use genuine catalog images for footwear/accessories category tiles when available.
// This avoids unrelated stock product photography and keeps the category cards in sync with D1.
function syncCategoryVisualsFromCatalog() {
  const categoryTiles = ["Footwear", "Accessories", "Kids", "Women"];
  categoryTiles.forEach(categoryName => {
    const product = products.find(item =>
      String(item.category || "").toLowerCase() === categoryName.toLowerCase() &&
      item.isActive !== false && (item.image || (Array.isArray(item.images) && item.images[0]))
    );
    if (!product) return;
    const imageUrl = product.image || product.images[0];
    const image = document.querySelector(`[data-category-image="${categoryName}"]`);
    if (image && imageUrl) {
      image.src = imageUrl;
      image.alt = `${categoryName} selection from the EXAMPLE catalogue`;
    }
  });
}

async function loadStoreProducts() {
  try {
    await loadStoreCategories();
    const response = await fetch("/api/products", { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error("Store API unavailable");
    const data = await response.json();
    products = (data.products || []).map(p => ({
      ...p,
      image: p.image || (p.images || [])[0] || "",
      desc: p.description || "",
      tag: p.totalStock === 0 ? "SOLD OUT" : ""
    }));

    syncCategoryVisualsFromCatalog();
    applyRoute();

    // Deep-link checking on initial load (e.g. #product/oversized-t-shirt)
    if (location.hash.startsWith("#product/")) {
      const slug = location.hash.replace("#product/", "");
      navigateTo(`/products/${slug}`, false);
    }
  } catch (error) {
    products = [];
    renderProducts();
  }
}

function initHeroVideo() {
  const video = document.getElementById("heroVideo");
  if (!video) return;

  // Owner Decision: Video playback disabled pending commercial model/publicity rights clearance
  try {
    video.pause();
  } catch (e) {}
  video.style.display = "none";

  const heroActive = document.getElementById("heroActiveImg") || document.querySelector(".hero-image.fallback-active");
  if (heroActive) {
    heroActive.style.display = "block";
    heroActive.style.zIndex = "1";
    heroActive.style.opacity = "1";
  }

  video.addEventListener("error", () => {
    video.style.display = "none";
  });
}

// Initial boot - render route immediately then load data
initThemeSystem();
initHeroVideo();
applyRoute();
loadStoreSettings();
loadStoreProducts();
renderCart();
handleHashNavigation();


// ==========================================================================
// DZ COMMUNE INTERACTIVE SHEETS & DRAWERS SYSTEM
// ==========================================================================
function closeAllSheets() {
  closeLightbox();
  document.querySelectorAll(".sheet").forEach(s => s.classList.remove("open"));
  document.querySelectorAll(".drawer").forEach(d => d.classList.remove("open"));
  document.querySelectorAll(".modal-backdrop").forEach(m => m.hidden = true);
  document.querySelectorAll("[data-open]").forEach(b => b.setAttribute("aria-expanded", "false"));
  const overlay = document.getElementById("overlay");
  if (overlay) {
    overlay.classList.remove("open", "show");
  }
}

document.addEventListener("click", e => {
  const openTrigger = e.target.closest("[data-open]");
  if (openTrigger) {
    const sheetName = openTrigger.dataset.open;
    if (sheetName === "shop" || sheetName === "collection") {
      e.preventDefault();
      const targetSheet = document.querySelector(`.sheet.mega[data-sheet="${sheetName}"]`);
      if (targetSheet) {
        const isOpen = targetSheet.classList.contains("open");
        closeAllSheets();
        if (!isOpen) {
          targetSheet.classList.add("open");
          openTrigger.setAttribute("aria-expanded", "true");
          const overlay = document.getElementById("overlay");
          if (overlay) overlay.classList.add("open", "show");
        }
      }
      return;
    }
    if (sheetName === "menu") {
      e.preventDefault();
      const mainNav = document.getElementById("mainNav");
      if (mainNav) {
        const isOpen = mainNav.classList.contains("open");
        closeAllSheets();
        if (!isOpen) {
          mainNav.classList.add("open");
          openTrigger.setAttribute("aria-expanded", "true");
          const overlay = document.getElementById("overlay");
          if (overlay) overlay.classList.add("open", "show");
        }
      }
      return;
    }
    if (sheetName === "search") {
      e.preventDefault();
      const searchPanel = document.getElementById("searchPanel");
      if (searchPanel) {
        closeAllSheets();
        searchPanel.classList.add("open");
        const overlay = document.getElementById("overlay");
        if (overlay) overlay.classList.add("open", "show");
        const input = document.getElementById("searchInput");
        if (input) setTimeout(() => input.focus(), 100);
      }
      return;
    }
    if (sheetName === "bag") {
      e.preventDefault();
      const cartDrawer = document.getElementById("cartDrawer");
      if (cartDrawer) {
        closeAllSheets();
        cartDrawer.classList.add("open");
        const overlay = document.getElementById("overlay");
        if (overlay) overlay.classList.add("open", "show");
      }
      return;
    }
    if (sheetName === "track") {
      e.preventDefault();
      closeAllSheets();
      const trackModal = document.getElementById("trackModal");
      if (trackModal) {
        trackModal.hidden = false;
        const overlay = document.getElementById("overlay");
        if (overlay) overlay.classList.add("open", "show");
      }
      return;
    }
  }

  const closeTrigger = e.target.closest("[data-close]");
  if (closeTrigger) {
    e.preventDefault();
    closeAllSheets();
    return;
  }
});

// Update [data-bag-count] on all cart updates
const origRenderCart = renderCart;
renderCart = function() {
  origRenderCart();
  const total = cart.reduce((a, x) => a + x.qty, 0);
  document.querySelectorAll("[data-bag-count]").forEach(el => {
    el.textContent = total;
  });
};

// LIVE CLOCK IN ASIA/CALCUTTA TIMEZONE
function initClock() {
  function update() {
    try {
      const now = new Date();
      const timeStr = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }).format(now);
      document.querySelectorAll("[data-clock], #liveClock").forEach(el => {
        el.textContent = timeStr;
      });
    } catch (e) {}
  }
  update();
  setInterval(update, 1000);
}

// HERO VIDEO PLAY/PAUSE AND SOUND CONTROLS
function initHeroControls() {
  const video = document.getElementById("heroVideo");
  const playBtn = document.getElementById("heroPlayBtn");
  const soundBtn = document.getElementById("heroSoundBtn");
  if (!video) return;

  if (playBtn) {
    playBtn.addEventListener("click", () => {
      if (video.paused) {
        video.style.display = "block";
        video.play().then(() => {
          playBtn.textContent = "Pause Film";
        }).catch(() => {});
      } else {
        video.pause();
        playBtn.textContent = "Watch Trailer";
      }
    });
  }

  if (soundBtn) {
    soundBtn.addEventListener("click", () => {
      video.muted = !video.muted;
      soundBtn.textContent = video.muted ? "Sound" : "Mute";
    });
  }
}

initClock();
initHeroControls();
