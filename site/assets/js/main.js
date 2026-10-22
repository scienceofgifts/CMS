/**
 * scienceofgifts-static Main Vanilla JavaScript Controller
 * Implements navigation, search modal, saved items drawer, shortlist import/sharing,
 * Gift Finder interactive scoring engine with auto-advancement & transition animation,
 * primary/secondary recommendation hierarchy, guide/article filters, and guide scrollspy.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Global State
  let savedItems = getSavedItems();

  // Initialize all modular scripts
  initHeaderAndDrawer();
  initSearch();
  initPageBookmarks();
  checkShortlistImport();

  // Initialize page-specific interactive scripts
  if (document.querySelector('#gift-finder-container')) {
    initGiftFinder();
  }
  if (document.querySelector('#gift-guides-page-container') || document.querySelector('#collections-page-container')) {
    initGiftGuidesPage();
  }
  if (document.querySelector('#articles-page-container')) {
    initArticlesPage();
  }
  if (document.querySelector('#for-men-page-container')) {
    initProductCollectionPage('men');
  }
  if (document.querySelector('#for-women-page-container')) {
    initProductCollectionPage('women');
  }
  if (document.querySelector('.toc-link')) {
    initScrollSpy();
  }
  if (document.querySelector('.faq-item')) {
    initFaqAccordion();
  }

  // --- LOCAL STORAGE HELPERS ---
  function getSavedItems() {
    try {
      const stored = localStorage.getItem('sog_saved_items');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  function saveSavedItems(items) {
    try {
      localStorage.setItem('sog_saved_items', JSON.stringify(items));
      savedItems = items;
      window.dispatchEvent(new Event('sog:saved_updated'));
    } catch (err) {
      console.error('Failed to save to localStorage', err);
    }
  }

  function getVendorRelAttr(vendor, vendorUrl) {
    const v = (vendor || '').toLowerCase();
    const u = (vendorUrl || '').toLowerCase();
    if (v.includes('scienceofgifts') || v.includes('science of gifts') || u.includes('scienceofgifts.com')) {
      return '';
    }
    return 'rel="noopener noreferrer sponsored"';
  }

  // --- COMPONENT 1: HEADER & SAVED ITEMS DRAWER ---
  function initHeaderAndDrawer() {
    const savedBtns = document.querySelectorAll('button[aria-label="Saved gifts and guides"]');
    const mobileMenuTrigger = document.getElementById('mobile-menu-trigger') || document.querySelector('button[aria-label="Toggle navigation menu"]');
    
    let savedDrawer = document.querySelector('#saved-gifts-drawer');
    if (!savedDrawer) {
      injectSavedDrawerTemplate();
      savedDrawer = document.querySelector('#saved-gifts-drawer');
    }

    if (mobileMenuTrigger) {
      mobileMenuTrigger.addEventListener('click', () => {
        const drawer = document.getElementById('mobile-menu-drawer') || document.querySelector('.md\\:hidden.border-t');
        if (drawer) {
          drawer.classList.toggle('hidden');
          const svg = mobileMenuTrigger.querySelector('svg');
          if (svg) {
            if (drawer.classList.contains('hidden')) {
              svg.innerHTML = '<path d="M4 5h16"></path><path d="M4 12h16"></path><path d="M4 19h16"></path>';
            } else {
              svg.innerHTML = '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>';
            }
          }
        }
      });
    }

    savedBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        openSavedDrawer();
      });
    });

    updateSavedCountBadge();
    window.addEventListener('sog:saved_updated', () => {
      updateSavedCountBadge();
      if (savedDrawer && !savedDrawer.classList.contains('hidden')) {
        renderSavedDrawerItems();
      }
    });

    if (savedDrawer) {
      const closeBtns = savedDrawer.querySelectorAll('.close-drawer');
      closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          closeSavedDrawer();
        });
      });

      savedDrawer.addEventListener('click', (e) => {
        const clearBtn = e.target.closest('#clear-all-saved');
        if (clearBtn) {
          e.preventDefault();
          saveSavedItems([]);
          renderSavedDrawerItems();
          updateSavedCountBadge();
        }
      });
    }
  }

  function openSavedDrawer() {
    const drawer = document.querySelector('#saved-gifts-drawer');
    if (drawer) {
      drawer.classList.remove('hidden');
      renderSavedDrawerItems();
    }
  }

  function closeSavedDrawer() {
    const drawer = document.querySelector('#saved-gifts-drawer');
    if (drawer) {
      drawer.classList.add('hidden');
    }
  }

  function updateSavedCountBadge() {
    const count = getSavedItems().length;
    const badges = document.querySelectorAll('button[aria-label="Saved gifts and guides"] span.relative');
    badges.forEach(badge => {
      if (count > 0) {
        badge.innerHTML = `<span class="absolute inset-0 rounded-full bg-[#C3F3DF] text-[#154D3B] text-[10px] font-bold flex items-center justify-center font-mono-code border border-[#226E56]/20 whitespace-nowrap">${count > 99 ? '99+' : count}</span>`;
      } else {
        badge.innerHTML = '';
      }
    });
  }

  function renderSavedDrawerItems() {
    const listContainer = document.querySelector('#saved-drawer-items-list');
    const items = getSavedItems();
    
    if (!listContainer) return;
    if (items.length === 0) {
      listContainer.innerHTML = `
        <div class="text-center py-16 space-y-3">
          <div class="w-12 h-12 rounded-full bg-[#EEF5FF] text-[#2A548E] flex items-center justify-center mx-auto text-xl font-serif">✦</div>
          <h4 class="font-serif-display text-base text-[#1E232B]">No saved objects yet</h4>
          <p class="text-xs text-[#5A6270] max-w-xs mx-auto leading-relaxed">
            As you browse our gift guides and essays, click the bookmark icon on any recommendation to keep a personal shortlist.
          </p>
          <a href="/gift-guides/" class="mt-2 inline-flex items-center gap-1 text-xs text-[#2A548E] font-medium hover:underline">
            Explore Gift Guides <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-right w-3.5 h-3.5"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
          </a>
        </div>
      `;
      const footer = document.querySelector('#saved-drawer-footer');
      if (footer) footer.classList.add('hidden');
      return;
    }

    const footer = document.querySelector('#saved-drawer-footer');
    if (footer) footer.classList.remove('hidden');

    listContainer.innerHTML = items.map(item => {
      const rawImg = item.image || item.imageType || item.id;
      const { webp, fallback } = getOptimizedImageSources(rawImg, true);
      return `
      <div class="p-4 bg-white border border-[#99BFF9]/25 space-y-3 relative group" data-id="${item.id}">
        <div class="flex items-start gap-3">
          <div class="w-16 h-16 shrink-0 bg-[#FAF9F6] border border-[#99BFF9]/30 rounded-sm overflow-hidden">
            <img
              src="${webp}"
              data-fallback="${fallback}"
              alt="${item.title}"
              class="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              onerror="this.onerror=null; this.src=this.dataset.fallback;"
            >
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <h4 class="font-serif-display text-sm font-medium text-[#1E232B] line-clamp-1">${item.title}</h4>
              <button class="remove-saved-item text-[#5A6270]/60 hover:text-red-600 p-1 transition-colors shrink-0 cursor-pointer" data-id="${item.id}" title="Remove from saved">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2 w-3.5 h-3.5"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              </button>
            </div>
            <p class="text-xs text-[#5A6270] line-clamp-1 mt-0.5">${item.tagline || ''}</p>
          </div>
        </div>
        <div class="pt-2 flex items-center justify-between text-xs border-t border-stone-100">
          <span class="font-mono-code font-semibold text-[#154D3B]">${item.price || ''}</span>
          <a href="${item.vendorUrl || '#'}" ${getVendorRelAttr(item.vendor, item.vendorUrl)} class="text-[#2A548E] hover:underline flex items-center gap-1 font-medium text-[11px]">
            View on ${item.vendor ? item.vendor.split(',')[0] : 'Store'} <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-external-link w-2.5 h-2.5"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>
          </a>
        </div>
      </div>
    `;
    }).join('');

    const removeBtns = listContainer.querySelectorAll('.remove-saved-item');
    removeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const filtered = getSavedItems().filter(item => item.id !== id);
        saveSavedItems(filtered);
        renderSavedDrawerItems();
      });
    });

    const clearBtn = document.querySelector('#clear-all-saved');
    if (clearBtn) {
      clearBtn.onclick = (e) => {
        if (e) e.preventDefault();
        saveSavedItems([]);
        renderSavedDrawerItems();
        updateSavedCountBadge();
      };
    }

    const shareBtn = document.querySelector('#share-saved-shortlist');
    if (shareBtn) {
      shareBtn.onclick = () => {
        const ids = getSavedItems().map(item => item.id).join(',');
        const shareUrl = `${window.location.origin}/?shortlist=${encodeURIComponent(ids)}`;
        navigator.clipboard?.writeText(shareUrl).then(() => {
          shareBtn.innerText = '✓ Link Copied';
          shareBtn.classList.remove('bg-[#2A548E]');
          shareBtn.classList.add('bg-[#226E56]');
          setTimeout(() => {
            shareBtn.innerText = 'Share Shortlist';
            shareBtn.classList.remove('bg-[#226E56]');
            shareBtn.classList.add('bg-[#2A548E]');
          }, 2000);
        });
      };
    }
  }

  function injectSavedDrawerTemplate() {
    const drawerHtml = `
      <div id="saved-gifts-drawer" class="fixed inset-0 z-50 overflow-hidden hidden" role="dialog" aria-modal="true">
        <div class="absolute inset-0 bg-black/30 backdrop-blur-xs transition-opacity close-drawer"></div>
        <div class="absolute inset-y-0 right-0 max-w-full flex pl-10">
          <div class="w-screen max-w-md bg-[#FAF9F6] border-l border-[#99BFF9]/40 shadow-2xl flex flex-col">
            <div class="p-6 border-b border-[#99BFF9]/30 flex items-center justify-between bg-white">
              <div>
                <h3 class="font-serif-display text-xl text-[#1E232B]">Your Saved Curations</h3>
                <p class="text-xs text-[#5A6270] mt-0.5">Shortlisted gift items</p>
              </div>
              <button class="p-2 text-[#5A6270] hover:text-[#1E232B] hover:bg-[#EEF5FF] rounded-full close-drawer cursor-pointer" aria-label="Close saved drawer">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div id="saved-drawer-items-list" class="flex-1 overflow-y-auto p-6 space-y-4"></div>
            <div id="saved-drawer-footer" class="p-4 bg-white border-t border-[#99BFF9]/30 flex items-center justify-between text-xs hidden">
              <button id="clear-all-saved" class="text-[#5A6270] hover:text-red-600 transition-colors cursor-pointer">Clear all</button>
              <button id="share-saved-shortlist" class="px-4 py-2 bg-[#2A548E] hover:bg-[#1B365D] text-white font-medium text-xs transition-colors min-w-[120px] text-center cursor-pointer">Share Shortlist</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', drawerHtml);
  }

  // --- COMPONENT 2: SEARCH OVERLAY ---
  function initSearch() {
    const searchBtns = document.querySelectorAll('button[aria-label="Search gift guides and articles"]');
    
    let searchModal = document.querySelector('#search-modal');
    if (!searchModal) {
      injectSearchModalTemplate();
      searchModal = document.querySelector('#search-modal');
    }

    searchBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        openSearchModal();
      });
    });

    if (searchModal) {
      const closeBtns = searchModal.querySelectorAll('.close-search');
      closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          closeSearchModal();
        });
      });

      const overlay = searchModal.querySelector('.search-overlay-bg');
      if (overlay) {
        overlay.addEventListener('click', () => {
          closeSearchModal();
        });
      }

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !searchModal.classList.contains('hidden')) {
          closeSearchModal();
        }
      });

      const searchInput = searchModal.querySelector('#search-input-field');
      const resultsContainer = searchModal.querySelector('#search-results-list');
      const clearInputBtn = searchModal.querySelector('#clear-search-input');

      if (searchInput && resultsContainer) {
        searchInput.addEventListener('input', (e) => {
          const query = e.target.value;
          if (clearInputBtn) {
            if (query) {
              clearInputBtn.classList.remove('hidden');
            } else {
              clearInputBtn.classList.add('hidden');
            }
          }
          renderSearchResults(query, resultsContainer);
        });
      }

      if (clearInputBtn && searchInput && resultsContainer) {
        clearInputBtn.addEventListener('click', () => {
          searchInput.value = '';
          clearInputBtn.classList.add('hidden');
          renderSearchResults('', resultsContainer);
          searchInput.focus();
        });
      }

      const suggestions = searchModal.querySelectorAll('.popular-suggestion-trigger');
      suggestions.forEach(s => {
        s.addEventListener('click', () => {
          const term = s.getAttribute('data-term');
          if (searchInput) {
            searchInput.value = term;
            if (clearInputBtn) clearInputBtn.classList.remove('hidden');
            renderSearchResults(term, resultsContainer);
            searchInput.focus();
          }
        });
      });
    }
  }

  function openSearchModal() {
    const searchModal = document.querySelector('#search-modal');
    if (searchModal) {
      searchModal.classList.remove('hidden');
      const input = searchModal.querySelector('#search-input-field');
      if (input) {
        input.value = '';
        input.focus();
      }
      const resultsContainer = searchModal.querySelector('#search-results-list');
      if (resultsContainer) {
        renderSearchResults('', resultsContainer);
      }
    }
  }

  function closeSearchModal() {
    const searchModal = document.querySelector('#search-modal');
    if (searchModal) {
      searchModal.classList.add('hidden');
    }
  }

  function renderSearchResults(query, container) {
    const q = query.toLowerCase().trim();
    const catalog = window.SOG_PRODUCTS || [];
    const guides = window.SOG_GUIDES ? Object.values(window.SOG_GUIDES) : [];
    const articles = window.SOG_ARTICLES ? Object.values(window.SOG_ARTICLES) : [];

    if (!q) {
      container.innerHTML = `
        <div class="space-y-4">
          <div>
            <div class="text-xs uppercase tracking-widest text-[#226E56] font-semibold mb-3 flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-gift w-3.5 h-3.5"><path d="M12 22V8"></path><path d="M5 12H19"></path><path d="M19 12V22H5V12"></path><path d="M12 2A5 5 0 0 0 7 7a5 5 0 0 0 5 15"></path></svg>
              <span>Featured Gift Guides</span>
            </div>
            <div class="grid grid-cols-1 gap-2">
              ${guides.slice(0, 3).map(g => `
                <a href="/${g.slug}/" class="p-3 bg-white border border-[#99BFF9]/20 hover:border-[#99BFF9] transition-all flex items-center justify-between group">
                  <div>
                    <h4 class="font-serif-display text-sm text-[#1E232B] group-hover:text-[#2A548E] font-medium">${g.title}</h4>
                    <p class="text-xs text-[#5A6270] mt-0.5 line-clamp-1">${g.deck || ''}</p>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-right w-3.5 h-3.5 text-[#2A548E] opacity-0 group-hover:opacity-100 transition-opacity"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                </a>
              `).join('')}
            </div>
          </div>
        </div>
      `;
      return;
    }

    const matchedGuides = guides.filter(g => 
       (g.title && g.title.toLowerCase().includes(q)) || 
       (g.deck && g.deck.toLowerCase().includes(q)) || 
       (g.category && g.category.toLowerCase().includes(q))
    );
    const matchedArticles = articles.filter(a => 
       (a.title && a.title.toLowerCase().includes(q)) || 
       (a.deck && a.deck.toLowerCase().includes(q)) || 
       (a.category && a.category.toLowerCase().includes(q))
    );
    const matchedProducts = catalog.filter(p => 
       (p.title && p.title.toLowerCase().includes(q)) || 
       (p.tagline && p.tagline.toLowerCase().includes(q)) || 
       (p.editorialReview && p.editorialReview.toLowerCase().includes(q)) ||
       (p.tags && p.tags.some(t => t.toLowerCase().includes(q)))
    );

    if (matchedGuides.length === 0 && matchedArticles.length === 0 && matchedProducts.length === 0) {
      container.innerHTML = `
        <div class="text-center py-12 text-[#5A6270]">
          <p class="font-serif-display text-lg text-[#1E232B]">No exact matches found</p>
          <p class="text-xs mt-1">Try broader terms like "history", "reading", "kitchen", or "under $50".</p>
        </div>
      `;
      return;
    }

    let html = '<div class="space-y-6">';
    if (matchedGuides.length > 0) {
      html += `
        <div>
          <div class="text-xs uppercase tracking-widest text-[#226E56] font-semibold mb-3 flex items-center gap-1.5">
            <span>Gift Guides (${matchedGuides.length})</span>
          </div>
          <div class="space-y-2">
            ${matchedGuides.map(g => `
              <a href="/${g.slug}/" class="block p-3 bg-white border border-[#99BFF9]/20 hover:border-[#99BFF9] transition-all group">
                <div class="flex items-center justify-between">
                  <h4 class="font-serif-display text-base text-[#1E232B] group-hover:text-[#2A548E]">${g.title}</h4>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-right w-3.5 h-3.5 text-[#2A548E] opacity-0 group-hover:opacity-100 transition-opacity"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                </div>
                <p class="text-xs text-[#5A6270] mt-0.5 line-clamp-1">${g.deck || ''}</p>
              </a>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (matchedArticles.length > 0) {
      html += `
        <div>
          <div class="text-xs uppercase tracking-widest text-[#2A548E] font-semibold mb-3 flex items-center gap-1.5">
            <span>Essays & Articles (${matchedArticles.length})</span>
          </div>
          <div class="space-y-2">
            ${matchedArticles.map(a => `
              <a href="/${a.slug}/" class="block p-3 bg-white border border-[#99BFF9]/20 hover:border-[#99BFF9] transition-all group">
                <div class="flex items-center justify-between">
                  <h4 class="font-serif-display text-base text-[#1E232B] group-hover:text-[#2A548E]">${a.title}</h4>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-right w-3.5 h-3.5 text-[#2A548E] opacity-0 group-hover:opacity-100 transition-opacity"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                </div>
                <p class="text-xs text-[#5A6270] mt-0.5 line-clamp-1">${a.deck || ''}</p>
              </a>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (matchedProducts.length > 0) {
      html += `
        <div>
          <div class="text-xs uppercase tracking-widest text-[#154D3B] font-semibold mb-3 flex items-center gap-1.5">
            <span>Specific Objects & Recommendations (${matchedProducts.length})</span>
          </div>
          <div class="space-y-2">
            ${matchedProducts.slice(0, 6).map(p => {
              const isSaved = getSavedItems().some(item => item.id === p.id);
              const rawImg = p.image || p.imageType || p.id;
              const { webp, fallback } = getOptimizedImageSources(rawImg, true);
              return `
                <div class="p-3 bg-white border border-[#99BFF9]/20 flex items-center justify-between gap-3">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="w-12 h-12 shrink-0 bg-[#FAF9F6] border border-[#99BFF9]/30 rounded-sm overflow-hidden">
                      <img
                        src="${webp}"
                        data-fallback="${fallback}"
                        alt="${p.title}"
                        class="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                        onerror="this.onerror=null; this.src=this.dataset.fallback;"
                      >
                    </div>
                    <div class="min-w-0">
                      <h5 class="font-medium text-sm text-[#1E232B] line-clamp-1">${p.title}</h5>
                      <p class="text-xs text-[#5A6270] line-clamp-1 mt-0.5">${p.tagline || ''}</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-3 shrink-0">
                    <span class="font-mono-code text-xs font-semibold text-[#154D3B]">${p.price || ''}</span>
                    <button class="toggle-save-search-result p-1.5 rounded-full hover:bg-stone-50 cursor-pointer text-[#5A6270] hover:text-[#2A548E]" data-id="${p.id}" aria-label="Save ${p.title}">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${isSaved ? '#226E56' : 'none'}" stroke="${isSaved ? '#226E56' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path></svg>
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }
    html += '</div>';
    container.innerHTML = html;

    const saveBtns = container.querySelectorAll('.toggle-save-search-result');
    saveBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const prod = catalog.find(item => item.id === id);
        if (prod) {
          toggleSaveProduct(prod);
          const isSavedNow = getSavedItems().some(item => item.id === id);
          const svg = btn.querySelector('svg');
          if (svg) {
            svg.setAttribute('fill', isSavedNow ? '#226E56' : 'none');
            svg.setAttribute('stroke', isSavedNow ? '#226E56' : 'currentColor');
          }
        }
      });
    });
  }

  function injectSearchModalTemplate() {
    const modalHtml = `
      <div id="search-modal" class="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 md:p-20 bg-black/40 backdrop-blur-xs hidden" role="dialog" aria-modal="true">
        <div class="absolute inset-0 search-overlay-bg close-search"></div>
        <div class="w-full max-w-2xl bg-[#FAF9F6] border border-[#99BFF9]/40 shadow-xl overflow-hidden flex flex-col max-h-[85vh] relative z-10">
          <div class="p-4 border-b border-[#99BFF9]/30 flex items-center gap-3 bg-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search w-5 h-5 text-[#2A548E] shrink-0"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input id="search-input-field" type="text" placeholder="Search by recipient, interest, item (e.g. history, books, brass, tea)..." class="w-full bg-transparent border-none outline-none text-sm sm:text-base text-[#1E232B] placeholder:text-[#5A6270]/60" />
            <button id="clear-search-input" class="p-1 text-[#5A6270] hover:text-[#1E232B] hidden cursor-pointer" aria-label="Clear search">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x w-4 h-4"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <button class="p-1 text-xs text-[#5A6270] hover:text-[#1E232B] px-2 py-1 border border-stone-200 close-search cursor-pointer">ESC</button>
          </div>
          <div class="px-4 py-2 bg-[#EEF5FF]/80 border-b border-[#99BFF9]/20 flex items-center gap-2 overflow-x-auto text-xs">
            <span class="text-[#5A6270] font-medium shrink-0">Popular:</span>
            <button class="popular-suggestion-trigger text-[#2A548E] hover:underline font-medium shrink-0 cursor-pointer" data-term="History">History</button>
            <button class="popular-suggestion-trigger text-[#2A548E] hover:underline font-medium shrink-0 cursor-pointer" data-term="Books">Books</button>
            <button class="popular-suggestion-trigger text-[#2A548E] hover:underline font-medium shrink-0 cursor-pointer" data-term="Curiosity">Curiosity</button>
            <button class="popular-suggestion-trigger text-[#2A548E] hover:underline font-medium shrink-0 cursor-pointer" data-term="Science">Science</button>
            <button class="popular-suggestion-trigger text-[#2A548E] hover:underline font-medium shrink-0 cursor-pointer" data-term="Food">Food</button>
            <button class="popular-suggestion-trigger text-[#2A548E] hover:underline font-medium shrink-0 cursor-pointer" data-term="Under 50">Under $50</button>
          </div>
          <div id="search-results-list" class="overflow-y-auto p-4 space-y-6 flex-1"></div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  // --- COMPONENT 3: PAGE-LEVEL BOOKMARKS ---
  function initPageBookmarks() {
    if (!window._sogBookmarksDelegated) {
      window._sogBookmarksDelegated = true;
      document.addEventListener('click', (e) => {
        const bookmarkBtn = e.target.closest('.toggle-product-bookmark');
        if (!bookmarkBtn) return;
        e.preventDefault();
        e.stopPropagation();
        const id = bookmarkBtn.getAttribute('data-id');
        if (!id) return;
        const prod = window.SOG_PRODUCTS?.find(p => p.id === id);
        if (prod) {
          toggleSaveProduct(prod);
          document.querySelectorAll(`.toggle-product-bookmark[data-id="${CSS.escape(id)}"]`).forEach(b => {
            updatePageBookmarkBtnState(b, id);
          });
        }
      });

      window.addEventListener('sog:saved_updated', () => {
        document.querySelectorAll('.toggle-product-bookmark').forEach(btn => {
          const id = btn.getAttribute('data-id');
          if (id) updatePageBookmarkBtnState(btn, id);
        });
      });
    }

    document.querySelectorAll('.toggle-product-bookmark').forEach(btn => {
      const id = btn.getAttribute('data-id');
      if (id) updatePageBookmarkBtnState(btn, id);
    });
  }

  function updatePageBookmarkBtnState(btn, id) {
    const isSaved = getSavedItems().some(item => item.id === id);
    const labelSpan = btn.querySelector('.save-label') || btn.querySelector('.bookmark-label');
    const svg = btn.querySelector('svg');
    if (labelSpan) {
      labelSpan.textContent = isSaved ? 'Saved' : 'Save';
    }
    if (svg) {
      if (isSaved) {
        svg.setAttribute('fill', '#226E56');
        svg.setAttribute('stroke', '#226E56');
        btn.classList.add('bg-[#E8F8F1]', 'border-[#226E56]', 'text-[#154D3B]');
        btn.classList.remove('border-[#99BFF9]/40', 'text-[#5A6270]');
      } else {
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        btn.classList.remove('bg-[#E8F8F1]', 'border-[#226E56]', 'text-[#154D3B]');
        btn.classList.add('border-[#99BFF9]/40', 'text-[#5A6270]');
      }
    }
  }

  function toggleSaveProduct(product) {
    let items = getSavedItems();
    const exists = items.some(p => p.id === product.id);
    if (exists) {
      items = items.filter(p => p.id !== product.id);
    } else {
      items.push(product);
    }
    saveSavedItems(items);
  }

  // --- COMPONENT 4: URL SHORTLIST IMPORT ---
  function checkShortlistImport() {
    const params = new URLSearchParams(window.location.search);
    const shortlistParam = params.get('shortlist');
    
    if (shortlistParam) {
      const ids = shortlistParam.split(',').map(id => id.trim()).filter(Boolean);
      if (ids.length > 0 && window.SOG_PRODUCTS) {
        const matched = ids
          .map(id => window.SOG_PRODUCTS.find(p => p.id === id))
          .filter(Boolean);
        if (matched.length > 0) {
          const current = getSavedItems();
          matched.forEach(prod => {
            if (!current.some(item => item.id === prod.id)) {
              current.push(prod);
            }
          });
          saveSavedItems(current);
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('shortlist');
          window.history.replaceState({}, '', newUrl.pathname + newUrl.search);
          setTimeout(() => {
            openSavedDrawer();
          }, 400);
        }
      }
    }
  }

  // --- COMPONENT 5: GIFT FINDER QUESTIONNAIRE & SCORING ENGINE ---
  function initGiftFinder() {
    const container = document.querySelector('#gift-finder-container');
    if (!container) return;

    const flow = document.querySelector('#finder-questionnaire-flow');
    const resultsView = document.querySelector('#finder-results-view');
    const prevBtn = document.querySelector('#finder-prev-btn');
    const nextBtn = document.querySelector('#finder-next-btn');
    const submitBtn = document.querySelector('#finder-submit-btn');
    const stepCountText = document.querySelector('#finder-step-count-text');
    const progressBar = document.querySelector('#finder-progress-bar');
    const stepPanes = container.querySelectorAll('.finder-step-pane');

    let currentStep = 1;
    const totalSteps = stepPanes.length || 6;
    let isTransitioning = false;

    const answers = {
      recipient: '',
      ageRange: '',
      budget: '',
      interests: [],
      occasion: '',
      personalityStyle: ''
    };

    // Option Button Click Handlers with Automatic Advancement
    stepPanes.forEach(pane => {
      const field = pane.getAttribute('data-field');
      const optionButtons = pane.querySelectorAll('.finder-option-btn');

      optionButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          if (isTransitioning) return;

          const targetBtn = e.target.closest('.finder-option-btn');
          if (!targetBtn) return;
          const val = targetBtn.getAttribute('data-value');
          if (!val) return;

          if (field === 'interests') {
            // Multi-select toggle (Step 4)
            const idx = answers.interests.indexOf(val);
            if (idx > -1) {
              answers.interests.splice(idx, 1);
              targetBtn.classList.remove('bg-[#EEF5FF]', 'border-[#2A548E]', 'text-[#2A548E]', 'font-medium', 'shadow-xs');
              targetBtn.classList.add('bg-[#FAF9F6]', 'border-stone-200', 'text-[#1E232B]');
            } else {
              answers.interests.push(val);
              targetBtn.classList.add('bg-[#EEF5FF]', 'border-[#2A548E]', 'text-[#2A548E]', 'font-medium', 'shadow-xs');
              targetBtn.classList.remove('bg-[#FAF9F6]', 'border-stone-200', 'text-[#1E232B]');
            }
          } else {
            // Single-select: Highlight immediately
            answers[field] = val;
            optionButtons.forEach(otherBtn => {
              otherBtn.classList.remove('bg-[#EEF5FF]', 'border-[#2A548E]', 'text-[#2A548E]', 'font-medium', 'shadow-xs');
              otherBtn.classList.add('bg-[#FAF9F6]', 'border-stone-200', 'text-[#1E232B]');
            });
            targetBtn.classList.add('bg-[#EEF5FF]', 'border-[#2A548E]', 'text-[#2A548E]', 'font-medium', 'shadow-xs');
            targetBtn.classList.remove('bg-[#FAF9F6]', 'border-stone-200', 'text-[#1E232B]');

            // Auto-advance
            if (field === 'personalityStyle' || currentStep === totalSteps) {
              // Last step: trigger calibration animation and results
              isTransitioning = true;
              setTimeout(() => {
                isTransitioning = false;
                showCalibrationAnimationAndResults(answers);
              }, 220);
            } else {
              isTransitioning = true;
              setTimeout(() => {
                isTransitioning = false;
                if (currentStep < totalSteps) {
                  currentStep++;
                  updateStepUI(currentStep);
                }
              }, 220);
            }
          }
        });
      });
    });

    function updateStepUI(step) {
      stepPanes.forEach(pane => {
        const paneStep = parseInt(pane.getAttribute('data-step') || '1', 10);
        if (paneStep === step) {
          pane.classList.remove('hidden');
        } else {
          pane.classList.add('hidden');
        }
      });

      const pct = Math.round(((step - 1) / totalSteps) * 100);
      if (stepCountText) {
        stepCountText.textContent = `Step ${step} of ${totalSteps} · ${pct}% Complete`;
      }
      if (progressBar) {
        progressBar.style.width = `${pct}%`;
      }

      if (prevBtn) {
        if (step === 1) {
          prevBtn.classList.add('invisible');
        } else {
          prevBtn.classList.remove('invisible');
        }
      }

      if (step === totalSteps) {
        if (nextBtn) nextBtn.classList.add('hidden');
        if (submitBtn) submitBtn.classList.remove('hidden');
      } else {
        if (nextBtn) nextBtn.classList.remove('hidden');
        if (submitBtn) submitBtn.classList.add('hidden');
      }
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentStep < totalSteps) {
          currentStep++;
          updateStepUI(currentStep);
        }
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentStep > 1) {
          currentStep--;
          updateStepUI(currentStep);
        }
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showCalibrationAnimationAndResults(answers);
      });
    }

    function showCalibrationAnimationAndResults(prefs) {
      if (flow) flow.classList.add('hidden');
      if (!resultsView) return;

      resultsView.classList.remove('hidden');
      // Show loading transition animation
      resultsView.innerHTML = `
        <div id="finder-loading-state" class="bg-white border border-[#99BFF9]/35 p-12 sm:p-16 text-center space-y-6 shadow-xs max-w-2xl mx-auto my-6 animate-pulse">
          <div class="relative w-16 h-16 mx-auto">
            <div class="absolute inset-0 rounded-full border-3 border-[#99BFF9]/30 border-t-[#226E56] animate-spin"></div>
            <div class="absolute inset-2 rounded-full bg-[#E8F8F1] flex items-center justify-center text-[#226E56]">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"></path></svg>
            </div>
          </div>
          <div class="space-y-2">
            <h3 class="font-serif-display text-2xl sm:text-3xl text-[#1E232B] font-normal">Calibrating Recommendations...</h3>
            <p class="text-xs sm:text-sm text-[#5A6270] max-w-md mx-auto leading-relaxed">
              Cross-referencing recipient rituals, budget parameters, and material durability standards against our laboratory-tested catalog.
            </p>
          </div>
        </div>
      `;

      window.scrollTo({ top: container.offsetTop - 80, behavior: 'smooth' });

      setTimeout(() => {
        calculateAndRenderFinderResults(prefs);
      }, 700);
    }

    function calculateAndRenderFinderResults(prefs) {
      const allProducts = window.SOG_PRODUCTS || [];
      if (allProducts.length === 0) return;

      const scoringConfig = window.SOG_GIFT_FINDER?.scoring || {
        recipientMatch: 15,
        interestMatchPerItem: 10,
        personalityMatch: 8,
        occasionMatch: 5,
        ageMatch: 12,
        editorsPickBonus: 10
      };

      const budgetRulesConfig = window.SOG_GIFT_FINDER?.budgetRules || [];

      const scored = allProducts.map(prod => {
        let score = 0;
        const reasons = [];

        // 1. Recipient Match
        if (prefs.recipient && prod.recipients) {
          if (prod.recipients.includes(prefs.recipient) || prod.recipients.includes('other') || prod.recipients.includes('all')) {
            score += (scoringConfig.recipientMatch ?? 15);
            reasons.push(`Curated for ${prefs.recipient.replace('-', ' ')}`);
          }
        }

        // 2. Budget Match
        if (prefs.budget && prefs.budget !== 'any') {
          const rule = budgetRulesConfig.find(r => r.value === prefs.budget);
          if (rule) {
            const priceNum = prod.priceNumber || 0;
            let matchesBudget = true;
            if (rule.minPrice != null && priceNum < rule.minPrice) matchesBudget = false;
            if (rule.maxPrice != null && priceNum > rule.maxPrice) matchesBudget = false;
            if (matchesBudget) {
              score += 25;
              reasons.push('Fits budget threshold');
            }
          } else if (prod.priceRange === prefs.budget) {
            score += 25;
            reasons.push('Fits budget threshold');
          }
        } else {
          score += 10;
        }

        // 3. Interests Match (per item)
        if (prefs.interests && prefs.interests.length > 0 && prod.interests) {
          prefs.interests.forEach(interest => {
            if (prod.interests.includes(interest)) {
              score += (scoringConfig.interestMatchPerItem ?? 10);
              reasons.push(interest.replace('-', ' & '));
            }
          });
        }

        // 4. Occasion Match
        if (prefs.occasion && prod.occasions) {
          if (prod.occasions.includes(prefs.occasion) || prod.occasions.includes('just-because') || prod.occasions.includes('other')) {
            score += (scoringConfig.occasionMatch ?? 5);
          }
        }

        // 5. Personality Style Match
        if (prefs.personalityStyle && prod.personalityStyles) {
          if (prod.personalityStyles.includes(prefs.personalityStyle)) {
            score += (scoringConfig.personalityMatch ?? 8);
            reasons.push(`${prefs.personalityStyle} aesthetic`);
          }
        }

        // 6. Age Range Match
        if (prefs.ageRange && prefs.ageRange !== 'any' && prod.ageRanges) {
          if (prod.ageRanges.includes(prefs.ageRange)) {
            score += (scoringConfig.ageMatch ?? 12);
          }
        }

        // 7. Editor's Pick Bonus
        if (prod.category === 'editors-pick' || prod.badgeLabel) {
          score += (scoringConfig.editorsPickBonus ?? 10);
        }

        return { product: prod, score, reasons };
      });

      scored.sort((a, b) => b.score - a.score);

      const primary = scored[0] ? scored[0].product : allProducts[0];
      const primaryReasons = scored[0] ? scored[0].reasons : [];
      const additional = scored.slice(1, 4).map(s => s.product);

      renderOriginalResultHierarchy(primary, primaryReasons, additional, prefs);
    }

    function renderOriginalResultHierarchy(primary, primaryReasons, additional, prefs) {
      if (!resultsView) return;

      const summaryTags = [
        prefs.recipient ? `For: ${prefs.recipient.replace('-', ' ')}` : null,
        prefs.budget && prefs.budget !== 'any' ? `Budget: ${prefs.budget}` : null,
        prefs.interests && prefs.interests.length > 0 ? `Passions: ${prefs.interests.join(', ')}` : null,
        prefs.personalityStyle ? `Style: ${prefs.personalityStyle}` : null
      ].filter(Boolean);

      const isPrimarySaved = getSavedItems().some(item => item.id === primary.id);
      const rawPrimaryImg = primary.image || primary.imageType || primary.id;
      const primaryImg = getOptimizedImageSources(rawPrimaryImg, false);

      let html = `
        <div class="space-y-12 animate-fade-in">
          <!-- Calibration Top Bar -->
          <div class="bg-white border border-[#99BFF9]/35 p-6 sm:p-8 space-y-4 shadow-xs">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#99BFF9]/20 pb-4">
              <div>
                <span class="text-xs uppercase tracking-widest text-[#226E56] font-semibold">Curation Complete</span>
                <h2 class="font-serif-display text-2xl sm:text-3xl text-[#1E232B] font-normal mt-1">
                  Your Primary Recommendation
                </h2>
              </div>
              <button id="finder-restart-btn" class="px-4 py-2 bg-[#FAF9F6] border border-stone-300 hover:border-[#2A548E] text-[#1E232B] text-xs font-semibold uppercase tracking-wider rounded transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto cursor-pointer shadow-2xs">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-rotate-ccw w-3.5 h-3.5 text-[#2A548E]"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
                <span>Restart Questionnaire</span>
              </button>
            </div>
            <div class="flex flex-wrap items-center gap-2 text-xs">
              <span class="text-[#5A6270] font-medium">Your Calibration:</span>
              ${summaryTags.map(t => `<span class="px-2.5 py-0.5 rounded-full bg-[#EEF5FF] text-[#2A548E] font-medium border border-[#99BFF9]/30 capitalize">${t}</span>`).join('')}
            </div>
          </div>

          <!-- PRIMARY RECOMMENDATION FEATURE CARD -->
          <div class="bg-[#FAF9F6] border border-[#99BFF9]/40 p-6 sm:p-10 space-y-8 shadow-sm relative group" id="primary-recommendation-card" data-id="${primary.id}">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#99BFF9]/25 pb-4">
              <div class="flex items-center gap-2">
                <span class="font-mono-code font-bold text-lg text-[#154D3B]">${primary.price || ''}</span>
                <span class="text-xs uppercase tracking-wider text-[#5A6270]">· ${primary.vendor ? primary.vendor.split(',')[0] : 'Curated Studio'}</span>
              </div>
              <div class="inline-flex items-center gap-1.5 px-3 py-1 bg-[#E8F8F1] border border-[#226E56]/30 text-[#154D3B] text-xs font-bold uppercase tracking-wider rounded-full self-start sm:self-auto">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 text-[#226E56]"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"></path></svg>
                <span>${primary.badgeLabel || 'Top Curated Match'}</span>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              <div class="md:col-span-5">
                <div class="relative overflow-hidden bg-white border border-[#99BFF9]/30 rounded-sm aspect-[4/3] shadow-xs">
                  <img
                    src="${primaryImg.webp}"
                    data-fallback="${primaryImg.fallback}"
                    alt="${primary.title}"
                    class="w-full h-full object-cover"
                    loading="eager"
                    decoding="async"
                    onerror="this.onerror=null; this.src=this.dataset.fallback;"
                  >
                </div>
              </div>

              <div class="md:col-span-7 space-y-4">
                <h3 class="font-serif-display text-2xl sm:text-3xl text-[#1E232B] font-normal leading-tight">
                  ${primary.title}
                </h3>
                ${primary.tagline ? `<p class="text-sm text-[#5A6270] italic">${primary.tagline}</p>` : ''}
                
                ${primary.whyItMakesAGreatGift ? `
                  <div class="p-3.5 bg-[#E8F8F1]/80 border-l-4 border-[#226E56] space-y-1">
                    <strong class="text-xs uppercase tracking-wider text-[#154D3B] block">Why it makes a singular match:</strong>
                    <p class="text-xs text-[#226E56] leading-relaxed">${primary.whyItMakesAGreatGift}</p>
                  </div>
                ` : ''}

                <div class="text-sm text-[#1E232B] leading-relaxed">
                  <p>${primary.editorialReview || primary.description || ''}</p>
                </div>

                <div class="pt-4 flex flex-wrap items-center gap-3">
                  <a href="${primary.vendorUrl || '#'}" ${getVendorRelAttr(primary.vendor, primary.vendorUrl)} class="px-6 py-2.5 bg-white text-black border border-black hover:opacity-80 transition-opacity duration-200 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 shadow-2xs rounded-none">
                    <span>View on ${primary.vendor ? primary.vendor.split(',')[0] : 'Store'}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>
                  </a>
                  <button data-id="${primary.id}" class="toggle-product-bookmark px-4 py-2.5 border text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer border-[#99BFF9]/40 text-[#5A6270] hover:text-[#1E232B] rounded">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${isPrimarySaved ? '#226E56' : 'none'}" stroke="${isPrimarySaved ? '#226E56' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path></svg>
                    <span class="save-label">${isPrimarySaved ? 'Saved' : 'Save'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- SECONDARY ADDITIONAL SUGGESTIONS -->
          ${additional.length > 0 ? `
            <div class="space-y-6 pt-6 border-t border-[#99BFF9]/25">
              <div class="space-y-1">
                <span class="text-xs uppercase tracking-widest text-[#2A548E] font-semibold">Alternative Matches</span>
                <h3 class="font-serif-display text-2xl text-[#1E232B]">Additional Curated Suggestions</h3>
                <p class="text-xs sm:text-sm text-[#5A6270]">Other tested objects closely aligning with your calibration.</p>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                ${additional.map(p => {
                  const isSaved = getSavedItems().some(item => item.id === p.id);
                  const rawImg = p.image || p.imageType || p.id;
                  const { webp, fallback } = getOptimizedImageSources(rawImg, true);

                  return `
                    <div class="bg-white border border-[#99BFF9]/30 hover:border-[#99BFF9] transition-all p-5 flex flex-col justify-between space-y-4 group shadow-xs" data-id="${p.id}">
                      <div class="space-y-3">
                        <div class="relative overflow-hidden bg-[#FAF9F6] border border-[#99BFF9]/25 rounded-sm aspect-[4/3]">
                          <img
                            src="${webp}"
                            data-fallback="${fallback}"
                            alt="${p.title}"
                            class="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                            loading="lazy"
                            decoding="async"
                            onerror="this.onerror=null; this.src=this.dataset.fallback;"
                          >
                          ${p.badgeLabel ? `
                            <span class="absolute top-2 left-2 px-2 py-0.5 bg-[#FAF9F6]/90 backdrop-blur-xs text-[#154D3B] text-[10px] font-bold uppercase tracking-wider border border-[#226E56]/30">
                              ${p.badgeLabel}
                            </span>
                          ` : ''}
                        </div>

                        <div class="space-y-1.5">
                          <div class="flex items-center justify-between gap-2 text-xs pt-1 border-b border-[#99BFF9]/20 pb-2">
                            <div class="flex items-center gap-1.5 min-w-0">
                              <span class="font-mono-code font-bold text-sm text-[#154D3B] shrink-0">${p.price || ''}</span>
                              <span class="text-[#5A6270] truncate text-[11px]">· ${p.vendor ? p.vendor.split(',')[0] : 'Curated Studio'}</span>
                            </div>
                            <button data-id="${p.id}" class="toggle-product-bookmark p-1 text-[#5A6270] hover:text-[#2A548E] transition-colors shrink-0 cursor-pointer" title="Save gift">
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${isSaved ? '#226E56' : 'none'}" stroke="${isSaved ? '#226E56' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 text-[#2A548E]"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path></svg>
                            </button>
                          </div>
                          <h4 class="font-serif-display text-base font-medium text-[#1E232B] group-hover:text-[#2A548E] transition-colors leading-snug line-clamp-1 pt-1">
                            ${p.title}
                          </h4>
                          <p class="text-xs text-[#5A6270] leading-relaxed line-clamp-2">
                            ${p.editorialReview || p.tagline || ''}
                          </p>
                        </div>
                      </div>

                      <div class="pt-3 border-t border-[#99BFF9]/20 flex items-center justify-between gap-2">
                        <a href="${p.vendorUrl || '#'}" ${getVendorRelAttr(p.vendor, p.vendorUrl)} class="w-full justify-center px-4 py-2 bg-white text-black border border-black hover:opacity-80 transition-opacity duration-200 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 shadow-2xs rounded-none">
                          <span>View on ${p.vendor ? p.vendor.split(',')[0] : 'Store'}</span>
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>
                        </a>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;

      resultsView.innerHTML = html;

      // Rebind bookmark buttons in results
      initPageBookmarks();

      const restartBtn = resultsView.querySelector('#finder-restart-btn');
      if (restartBtn) {
        restartBtn.addEventListener('click', (e) => {
          e.preventDefault();
          currentStep = 1;
          // Clear selections
          answers.recipient = '';
          answers.ageRange = '';
          answers.budget = '';
          answers.interests = [];
          answers.occasion = '';
          answers.personalityStyle = '';

          stepPanes.forEach(pane => {
            const btns = pane.querySelectorAll('.finder-option-btn');
            btns.forEach(b => {
              b.classList.remove('bg-[#EEF5FF]', 'border-[#2A548E]', 'text-[#2A548E]', 'font-medium', 'shadow-xs');
              b.classList.add('bg-[#FAF9F6]', 'border-stone-200', 'text-[#1E232B]');
            });
          });

          updateStepUI(1);
          resultsView.classList.add('hidden');
          resultsView.innerHTML = '';
          if (flow) flow.classList.remove('hidden');
          window.scrollTo({ top: container.offsetTop - 80, behavior: 'smooth' });
        });
      }

      window.scrollTo({ top: container.offsetTop - 80, behavior: 'smooth' });
    }

    // Initialize first step
    updateStepUI(1);
  }

  // --- COMPONENT 6: GIFT GUIDES PAGE FILTERING ---
  function initGiftGuidesPage() {
    const filterBtns = document.querySelectorAll('.guide-cat-btn');
    const guideCards = document.querySelectorAll('#gift-guides-grid > a[data-category]');
    const countDisplay = document.querySelector('#gift-guides-results-count');

    if (!filterBtns.length || !guideCards.length) return;

    filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const cat = (btn.getAttribute('data-category') || '').trim().toLowerCase();

        filterBtns.forEach(b => {
          b.classList.remove('bg-[#2A548E]', 'text-white');
          b.classList.add('text-[#5A6270]', 'hover:text-[#2A548E]', 'hover:bg-[#EEF5FF]');
        });
        btn.classList.add('bg-[#2A548E]', 'text-white');
        btn.classList.remove('text-[#5A6270]', 'hover:text-[#2A548E]', 'hover:bg-[#EEF5FF]');

        let visibleCount = 0;
        guideCards.forEach(card => {
          const cardCat = (card.getAttribute('data-category') || '').toLowerCase();
          if (cat === 'all' || cat === 'all gift guides' || cardCat.includes(cat) || cat.includes(cardCat)) {
            card.style.display = '';
            visibleCount++;
          } else {
            card.style.display = 'none';
          }
        });

        if (countDisplay) {
          countDisplay.textContent = `Showing 1 – ${visibleCount} of ${visibleCount} guides`;
        }
      });
    });
  }

  // --- COMPONENT 7: ARTICLES & ESSAYS FILTERING ---
  function initArticlesPage() {
    const filterBtns = document.querySelectorAll('.article-cat-btn');
    const articleCards = document.querySelectorAll('#articles-grid > a[data-category]');
    const countDisplay = document.querySelector('#articles-results-count');

    if (!filterBtns.length || !articleCards.length) return;

    filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const cat = (btn.getAttribute('data-category') || '').trim().toLowerCase();

        filterBtns.forEach(b => {
          b.classList.remove('bg-[#2A548E]', 'text-white');
          b.classList.add('text-[#5A6270]', 'hover:text-[#2A548E]', 'hover:bg-[#EEF5FF]');
        });
        btn.classList.add('bg-[#2A548E]', 'text-white');
        btn.classList.remove('text-[#5A6270]', 'hover:text-[#2A548E]', 'hover:bg-[#EEF5FF]');

        let visibleCount = 0;
        articleCards.forEach(card => {
          const cardCat = (card.getAttribute('data-category') || '').toLowerCase();
          if (cat === 'all' || cat === 'all essays' || cardCat.includes(cat) || cat.includes(cardCat)) {
            card.style.display = '';
            visibleCount++;
          } else {
            card.style.display = 'none';
          }
        });

        if (countDisplay) {
          countDisplay.textContent = `Showing 1 – ${visibleCount} of ${visibleCount} essays`;
        }
      });
    });
  }

  // --- COMPONENT 8: PRODUCT COLLECTION PAGES (MEN / WOMEN) ---
  function initProductCollectionPage(type) {
    const catBtns = document.querySelectorAll(`.${type}-cat-btn`);
    const interestBtns = document.querySelectorAll(`.${type}-interest-btn`);
    const sortSelect = document.querySelector(`#${type}-sort-select`);
    const countDisplay = document.querySelector(`#${type}-results-count`);
    const grid = document.querySelector(`#${type}-products-grid`);

    if (!grid) return;
    const productCards = Array.from(grid.querySelectorAll('.product-card, .product-card-grid-item, [data-id]'));
    if (!productCards.length) return;

    // Record original order
    productCards.forEach((card, idx) => {
      card.setAttribute('data-original-index', String(idx));
    });

    let selectedCatSlug = 'all';
    let selectedCatRecipients = [];
    let selectedInterest = 'all';
    let selectedSort = 'featured';

    function applyProductFilters() {
      // 1. Sort elements if needed
      let sortedCards = [...productCards];
      if (selectedSort === 'price-asc') {
        sortedCards.sort((a, b) => {
          const pA = parseFloat(a.getAttribute('data-price') || '0');
          const pB = parseFloat(b.getAttribute('data-price') || '0');
          return pA - pB;
        });
        sortedCards.forEach(card => grid.appendChild(card));
      } else if (selectedSort === 'price-desc') {
        sortedCards.sort((a, b) => {
          const pA = parseFloat(a.getAttribute('data-price') || '0');
          const pB = parseFloat(b.getAttribute('data-price') || '0');
          return pB - pA;
        });
        sortedCards.forEach(card => grid.appendChild(card));
      } else if (selectedSort === 'featured') {
        sortedCards.sort((a, b) => {
          const idxA = parseInt(a.getAttribute('data-original-index') || '0', 10);
          const idxB = parseInt(b.getAttribute('data-original-index') || '0', 10);
          return idxA - idxB;
        });
        sortedCards.forEach(card => grid.appendChild(card));
      }

      // 2. Filter visibility
      let visibleCount = 0;
      sortedCards.forEach(card => {
        const cardRecipients = (card.getAttribute('data-recipients') || '').toLowerCase().split(',').map(s => s.trim());
        const cardInterests = (card.getAttribute('data-interests') || '').toLowerCase().split(',').map(s => s.trim());
        const priceNum = parseFloat(card.getAttribute('data-price') || '0');

        // Check Category Match
        let catMatch = false;
        if (selectedCatSlug === 'all') {
          catMatch = true;
        } else if (selectedCatRecipients.length > 0) {
          catMatch = selectedCatRecipients.some(r => cardRecipients.includes(r)) || cardRecipients.includes(selectedCatSlug) || cardRecipients.includes('other');
        } else {
          catMatch = cardRecipients.includes(selectedCatSlug) || cardRecipients.includes('other');
        }

        // Check Interest Match
        let interestMatch = false;
        if (selectedInterest === 'all') {
          interestMatch = true;
        } else {
          interestMatch = cardInterests.includes(selectedInterest);
        }

        // Check Price Range from Sort Select
        let priceMatch = true;
        if (selectedSort === 'under-50') {
          priceMatch = priceNum <= 50;
        } else if (selectedSort === '50-100') {
          priceMatch = priceNum >= 50 && priceNum <= 100;
        } else if (selectedSort === 'over-100') {
          priceMatch = priceNum >= 100;
        }

        if (catMatch && interestMatch && priceMatch) {
          card.style.display = '';
          visibleCount++;
        } else {
          card.style.display = 'none';
        }
      });

      if (countDisplay) {
        countDisplay.textContent = `Showing 1 – ${visibleCount} of ${visibleCount} gifts`;
      }
    }

    catBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const slug = (btn.getAttribute('data-slug') || 'all').toLowerCase();
        const recs = (btn.getAttribute('data-recipients') || '').toLowerCase().split(',').map(r => r.trim()).filter(Boolean);
        selectedCatSlug = slug;
        selectedCatRecipients = recs;

        catBtns.forEach(b => {
          b.classList.remove('bg-[#2A548E]', 'text-white');
          b.classList.add('text-[#5A6270]', 'hover:text-[#2A548E]', 'hover:bg-[#EEF5FF]');
        });
        btn.classList.add('bg-[#2A548E]', 'text-white');
        btn.classList.remove('text-[#5A6270]', 'hover:text-[#2A548E]', 'hover:bg-[#EEF5FF]');

        applyProductFilters();
      });
    });

    interestBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const interest = (btn.getAttribute('data-interest') || 'all').toLowerCase();
        selectedInterest = interest;

        interestBtns.forEach(b => {
          b.classList.remove('bg-[#2A548E]', 'text-white');
          b.classList.add('bg-white', 'text-[#5A6270]');
        });
        btn.classList.add('bg-[#2A548E]', 'text-white');
        btn.classList.remove('bg-white', 'text-[#5A6270]');

        applyProductFilters();
      });
    });

    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        selectedSort = e.target.value;
        applyProductFilters();
      });
    }

    // Initial filter pass
    applyProductFilters();
  }

  // --- COMPONENT 9: SCROLLSPY ---
  function initScrollSpy() {
    const tocLinks = document.querySelectorAll('.toc-link');
    if (!tocLinks.length) return;

    const activeClasses = ['bg-[#EEF5FF]', 'text-[#2A548E]', 'font-semibold', 'border-l-2', 'border-[#2A548E]', 'active-toc'];

    function setActiveLink(activeId) {
      tocLinks.forEach(link => {
        const href = link.getAttribute('href')?.replace('#', '');
        const dataSec = link.getAttribute('data-section');
        if (href === activeId || dataSec === activeId) {
          link.classList.remove('text-[#5A6270]', 'hover:text-[#1E232B]');
          activeClasses.forEach(cls => link.classList.add(cls));
        } else {
          activeClasses.forEach(cls => link.classList.remove(cls));
          link.classList.remove('font-semibold');
          link.classList.add('text-[#5A6270]', 'hover:text-[#1E232B]', 'hover:bg-[#EEF5FF]');
        }
      });
    }

    const sectionElements = Array.from(tocLinks).map(link => {
      const id = link.getAttribute('href')?.replace('#', '') || link.getAttribute('data-section');
      return id ? document.getElementById(id) : null;
    }).filter(Boolean);

    function onScroll() {
      const scrollPos = window.scrollY + 180;
      let currentActiveId = null;

      for (let i = 0; i < sectionElements.length; i++) {
        const sec = sectionElements[i];
        if (sec) {
          const top = sec.offsetTop;
          if (scrollPos >= top) {
            currentActiveId = sec.id;
          }
        }
      }

      if (!currentActiveId && sectionElements.length > 0) {
        currentActiveId = sectionElements[0].id;
      }

      if (currentActiveId) {
        setActiveLink(currentActiveId);
      }
    }

    // Smooth click handler
    tocLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        const id = link.getAttribute('href')?.replace('#', '') || link.getAttribute('data-section');
        const target = id ? document.getElementById(id) : null;
        if (target) {
          e.preventDefault();
          const offsetTop = target.getBoundingClientRect().top + window.scrollY - 100;
          window.scrollTo({ top: offsetTop, behavior: 'smooth' });
          setActiveLink(id);
        }
      });
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    setTimeout(onScroll, 100);
  }

  // --- COMPONENT 10: FAQ ACCORDION ---
  function initFaqAccordion() {
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
      const trigger = item.querySelector('.faq-trigger');
      const content = item.querySelector('.faq-content');
      const chevron = item.querySelector('.faq-chevron');
      if (trigger && content) {
        trigger.addEventListener('click', (e) => {
          e.preventDefault();
          const isHidden = content.classList.contains('hidden');
          faqItems.forEach(otherItem => {
            const otherContent = otherItem.querySelector('.faq-content');
            const otherChevron = otherItem.querySelector('.faq-chevron');
            const otherTrigger = otherItem.querySelector('.faq-trigger');
            if (otherContent) otherContent.classList.add('hidden');
            if (otherChevron) otherChevron.classList.remove('rotate-180', 'transform');
            if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false');
          });
          if (isHidden) {
            content.classList.remove('hidden');
            if (chevron) chevron.classList.add('rotate-180', 'transform');
            trigger.setAttribute('aria-expanded', 'true');
          }
        });
      }
    });
  }

  // --- HELPER: OPTIMIZED IMAGE SOURCES ---
  function getOptimizedImageSources(input, isThumb = false) {
    if (!input || input === 'default') {
      input = 'brass-book-weight';
    }
    if (input.startsWith('http://') || input.startsWith('https://')) {
      return { webp: input, fallback: input };
    }
    let dir = '/assets/';
    let clean = input.trim();
    if (clean.startsWith('/')) {
      const lastSlash = clean.lastIndexOf('/');
      dir = clean.substring(0, lastSlash + 1);
      clean = clean.substring(lastSlash + 1);
    } else if (clean.includes('/')) {
      const lastSlash = clean.lastIndexOf('/');
      dir = '/' + clean.substring(0, lastSlash + 1);
      clean = clean.substring(lastSlash + 1);
    }
    let ext = '.jpg';
    let baseName = clean;
    const match = clean.match(/\.(webp|jpg|jpeg|png|svg)$/i);
    if (match) {
      ext = match[0].toLowerCase();
      baseName = clean.substring(0, clean.length - ext.length);
    }
    const thumbSuffix = isThumb && !baseName.endsWith('-thumb') ? '-thumb' : '';
    const webpSrc = `${dir}${baseName}${thumbSuffix}.webp`;
    const fallbackSrc = `${dir}${baseName}${ext === '.webp' ? '.jpg' : ext}`;
    return { webp: webpSrc, fallback: fallbackSrc };
  }
});
