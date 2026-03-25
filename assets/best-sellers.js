(() => {
  const initSection = (section) => {
    const tabs = Array.from(section.querySelectorAll('[data-bs-tab-index]'));
    const panels = Array.from(section.querySelectorAll('[data-bs-product-index]'));
    const overlay = section.querySelector('[data-bs-overlay]');
    const modal = section.querySelector('[data-bs-modal]');
    const modalText = section.querySelector('[data-bs-modal-text]');
    const modalClose = section.querySelector('[data-bs-modal-close]');

    const openModal = (productName) => {
      if (!overlay || !modal || !modalText) return;
      modalText.textContent = `${productName} has been added to the your wishlist.`;
      overlay.classList.add('is-visible');
      modal.classList.add('is-visible');
      document.body.style.overflow = 'hidden';
    };

    const closeModal = () => {
      if (!overlay || !modal) return;
      overlay.classList.remove('is-visible');
      modal.classList.remove('is-visible');
      document.body.style.overflow = '';
    };

    tabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        if (tab.classList.contains('is-active')) return;

        tabs.forEach((t) => {
          t.classList.remove('is-active');
          t.setAttribute('aria-selected', 'false');
        });
        panels.forEach((p) => p.classList.remove('is-active'));

        tab.classList.add('is-active');
        tab.setAttribute('aria-selected', 'true');

        const index = tab.getAttribute('data-bs-tab-index');
        const target = section.querySelector(`[data-bs-product-index="${index}"]`);
        if (target) target.classList.add('is-active');
      });
    });

    section.querySelectorAll('[data-bs-wishlist]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const panel = btn.closest('.best-sellers__product');
        const name = panel?.getAttribute('data-bs-product-name') ?? '';
        openModal(name);
      });
    });

    modalClose?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal?.classList.contains('is-visible')) {
        closeModal();
      }
    });

    section.querySelectorAll('[data-bs-add-to-cart]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const panel = btn.closest('.best-sellers__product');
        if (!panel) return;

        const variantIdRaw = panel.getAttribute('data-bs-variant-id');
        const variantId = Number.parseInt(variantIdRaw ?? '', 10);
        if (!Number.isFinite(variantId)) return;

        btn.disabled = true;

        try {
          const response = await fetch('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: [{ id: variantId, quantity: 1 }] })
          });

          if (!response.ok) throw new Error('Failed to add to cart');
          await response.json();
        } catch (err) {
          // noop
        } finally {
          btn.disabled = false;
        }
      });
    });
  };

  const initAll = () => {
    document.querySelectorAll('[data-section-type="best-sellers"]').forEach((section) => {
      if (section.dataset.bestSellersInitialized === 'true') return;
      section.dataset.bestSellersInitialized = 'true';
      initSection(section);
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
