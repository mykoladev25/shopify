document.documentElement.classList.add('js');

(() => {
  const state = {
    cartOpen: false,
    activeElement: null,
    cartFocusTrap: null
  };

  function getFocusableElements(container) {
    if (!container) return [];
    const selector = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    return Array.from(container.querySelectorAll(selector)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );
  }

  const root = window.ShopTheme?.root || '/';
  const moneyFormatter = new Intl.NumberFormat(document.documentElement.lang || 'en', {
    style: 'currency',
    currency: window.ShopTheme?.currency || 'USD'
  });

  const selectors = {
    cartDrawer: '[data-cart-drawer]',
    cartCount: '[data-cart-count]',
    liveRegion: '[data-cart-live-region]'
  };

  function formatMoney(cents) {
    return moneyFormatter.format((Number(cents) || 0) / 100);
  }

  function announce(message) {
    const liveRegion = document.querySelector(selectors.liveRegion);
    if (!liveRegion || !message) return;

    liveRegion.textContent = '';
    window.setTimeout(() => {
      liveRegion.textContent = message;
    }, 20);
  }

  function updateCartCount(count) {
    document.querySelectorAll(selectors.cartCount).forEach((bubble) => {
      bubble.textContent = count;
      bubble.hidden = count < 1;
    });
  }

  function getCartDrawer() {
    return document.querySelector(selectors.cartDrawer);
  }

  function lockBody(lock) {
    document.body.classList.toggle('is-locked', lock);
  }

  function openCartDrawer() {
    const drawer = getCartDrawer();
    if (!drawer) return;

    drawer.hidden = false;
    requestAnimationFrame(() => drawer.classList.add('is-open'));
    drawer.setAttribute('aria-hidden', 'false');
    state.cartOpen = true;
    lockBody(true);

    const panel = drawer.querySelector('.cart-drawer__panel');
    const focusable = getFocusableElements(panel);
    if (focusable.length) {
      focusable[0].focus();
    }

    if (state.cartFocusTrap) {
      document.removeEventListener('keydown', state.cartFocusTrap);
    }

    state.cartFocusTrap = (event) => {
      if (event.key !== 'Tab' || !state.cartOpen || !panel) return;
      const items = getFocusableElements(panel);
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', state.cartFocusTrap);
  }

  function closeCartDrawer() {
    const drawer = getCartDrawer();
    if (!drawer) return;

    if (state.cartFocusTrap) {
      document.removeEventListener('keydown', state.cartFocusTrap);
      state.cartFocusTrap = null;
    }

    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    state.cartOpen = false;
    lockBody(false);

    window.setTimeout(() => {
      if (!state.cartOpen) {
        drawer.hidden = true;
      }
    }, 220);

    if (state.activeElement instanceof HTMLElement) {
      state.activeElement.focus();
    }
  }

  async function fetchSectionHtml() {
    const response = await fetch(`${root}?sections=cart-drawer`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(window.ShopTheme?.strings?.refreshCartError || 'Unable to refresh cart data.');
    }

    const payload = await response.json();
    return payload['cart-drawer'];
  }

  function replaceCartDrawer(html) {
    const current = getCartDrawer();
    if (!current || !html) return;

    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const incoming = parsed.querySelector(selectors.cartDrawer);

    if (!incoming) return;

    current.replaceWith(incoming);
  }

  async function refreshCartDrawer({ open = false, announceText = '' } = {}) {
    const [cartResponse, sectionHtml] = await Promise.all([
      fetch(`${root}cart.js`, { headers: { Accept: 'application/json' }, cache: 'no-store' }),
      fetchSectionHtml()
    ]);

    if (!cartResponse.ok) {
      throw new Error(window.ShopTheme?.strings?.refreshCartError || 'Unable to refresh cart data.');
    }

    const cart = await cartResponse.json();
    replaceCartDrawer(sectionHtml);
    updateCartCount(cart.item_count);

    if (open) {
      openCartDrawer();
    }

    if (announceText) {
      announce(announceText);
    }

    return cart;
  }

  function setLoadingState(button, loading) {
    if (!button) return;
    button.classList.toggle('is-loading', loading);
    button.disabled = loading;
    button.setAttribute('aria-busy', loading ? 'true' : 'false');
  }

  function setError(target, message) {
    if (!target) return;
    target.textContent = message || '';
  }

  async function addToCart(form) {
    const button = form.querySelector('[data-product-submit]');
    const errorTarget = form.querySelector('[data-product-form-error]');

    setError(errorTarget, '');
    setLoadingState(button, true);

    try {
      const response = await fetch(`${root}cart/add.js`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: new FormData(form)
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.description || payload.message || window.ShopTheme?.strings?.addToCartError || 'Unable to add this product to cart.');
      }

      const productTitle = payload.product_title || form.dataset.productTitle || window.ShopTheme?.strings?.addedFallback || 'Product';
      await refreshCartDrawer({
        open: true,
        announceText: `${productTitle} ${window.ShopTheme?.strings?.addedToCart || 'added to cart.'}`
      });
    } catch (error) {
      setError(errorTarget, error.message);
      announce(error.message);
    } finally {
      setLoadingState(button, false);
    }
  }

  async function updateCartLine(key, quantity) {
    const drawer = getCartDrawer();
    const errorTarget = drawer?.querySelector('[data-cart-error]');
    const line = document.querySelector(`[data-line-key="${CSS.escape(key)}"]`);

    setError(errorTarget, '');
    line?.classList.add('is-loading');

    try {
      const response = await fetch(`${root}cart/change.js`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ id: key, quantity })
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.description || window.ShopTheme?.strings?.updateCartError || 'Unable to update cart.');
      }

      await refreshCartDrawer({
        open: true,
        announceText: quantity > 0
          ? window.ShopTheme?.strings?.cartUpdated || 'Cart updated.'
          : window.ShopTheme?.strings?.itemRemoved || 'Item removed from cart.'
      });
    } catch (error) {
      setError(errorTarget, error.message);
      announce(error.message);
    } finally {
      line?.classList.remove('is-loading');
    }
  }

  function handleQuantityButton(button) {
    const wrapper = button.closest('[data-quantity]');
    const input = wrapper?.querySelector('input[type="number"]');
    if (!input) return;

    const min = Number(input.min || 1);
    const max = Number(input.max || 999);
    const currentValue = Number(input.value || min);
    const nextValue = button.dataset.quantityButton === 'increase'
      ? Math.min(max, currentValue + 1)
      : Math.max(min, currentValue - 1);

    input.value = nextValue;

    const cartLine = input.closest('[data-cart-line]');
    if (cartLine) {
      updateCartLine(cartLine.dataset.lineKey, nextValue);
      return;
    }

    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function handleGalleryThumb(button) {
    const gallery = button.closest('[data-product-gallery]');
    if (!gallery) return;

    const mediaId = button.dataset.galleryThumb;
    const viewport = gallery.querySelector('[data-gallery-viewport]');
    const slide = gallery.querySelector(`[data-media-id="${mediaId}"]`);

    if (!viewport || !slide) return;

    gallery.querySelectorAll('[data-gallery-thumb]').forEach((thumb) => {
      thumb.classList.toggle('is-active', thumb === button);
    });

    slide.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  }

  function findSelectedVariant(productData, section) {
    const optionInputs = section.querySelectorAll('[data-variant-option]:checked');
    const selectedOptions = Array.from(optionInputs).map((input) => input.value);

    if (!selectedOptions.length) {
      const fallbackSelect = section.querySelector('[data-variant-id-select]');
      if (fallbackSelect) {
        return productData.variants.find((variant) => String(variant.id) === fallbackSelect.value);
      }
    }

    return productData.variants.find((variant) => {
      return variant.options.every((option, index) => option === selectedOptions[index]);
    });
  }

  function setVariantAvailability(section, variant) {
    const button = section.querySelector('[data-product-submit]');
    const buttonLabel = button?.querySelector('.button__label');
    const status = section.querySelector('[data-availability-text]');
    const stock = section.querySelector('[data-stock-message]');
    const idInput = section.querySelector('[data-variant-id-input]');
    const fallbackSelect = section.querySelector('[data-variant-id-select]');
    const stickyPrice = section.querySelector('[data-sticky-price]');
    const priceCurrent = section.querySelector('[data-price-current]');
    const priceCompare = section.querySelector('[data-price-compare]');
    const threshold = Number(section.dataset.lowStockThreshold || 0);

    if (!variant) {
      if (button) {
        button.disabled = true;
        button.setAttribute('aria-disabled', 'true');
      }

      if (buttonLabel) {
        buttonLabel.textContent = window.ShopTheme?.strings?.unavailable || 'Unavailable';
      }

      if (status) {
        status.textContent = window.ShopTheme?.strings?.unavailable || 'Unavailable';
      }

      if (stock) {
        stock.textContent = '';
      }

      return;
    }

    if (idInput) idInput.value = variant.id;
    if (fallbackSelect) fallbackSelect.value = String(variant.id);

    if (button) {
      button.disabled = !variant.available;
      button.setAttribute('aria-disabled', variant.available ? 'false' : 'true');
    }

    if (buttonLabel) {
      const addToCartLabel = window.ShopTheme?.strings?.addToCart || buttonLabel.dataset.addToCartLabel || buttonLabel.textContent;
      const soldOutLabel = window.ShopTheme?.strings?.soldOut || buttonLabel.dataset.soldOutLabel || buttonLabel.textContent;
      buttonLabel.textContent = variant.available
        ? addToCartLabel
        : soldOutLabel;
    }

    if (status) {
      const readyToShipLabel = window.ShopTheme?.strings?.readyToShip || status.dataset.readyToShipLabel || status.textContent;
      const soldOutStatus = window.ShopTheme?.strings?.soldOut || status.dataset.soldOutLabel || status.textContent;
      status.textContent = variant.available
        ? readyToShipLabel
        : soldOutStatus;
    }

    if (priceCurrent) {
      priceCurrent.textContent = formatMoney(variant.price);
    }

    if (stickyPrice) {
      stickyPrice.textContent = variant.available
        ? formatMoney(variant.price)
        : window.ShopTheme?.strings?.soldOut || stickyPrice.textContent;
    }

    if (priceCompare) {
      if (variant.compare_at_price && variant.compare_at_price > variant.price) {
        priceCompare.hidden = false;
        priceCompare.textContent = formatMoney(variant.compare_at_price);
      } else {
        priceCompare.hidden = true;
        priceCompare.textContent = '';
      }
    }

    if (stock) {
      if (
        variant.available &&
        threshold > 0 &&
        Number.isFinite(variant.inventory_quantity) &&
        variant.inventory_quantity > 0 &&
        variant.inventory_quantity <= threshold
      ) {
        stock.textContent = (window.ShopTheme?.strings?.lowStock || 'Only [count] left in this handmade batch.')
          .replace('[count]', variant.inventory_quantity);
      } else {
        stock.textContent = '';
      }
    }

    if (variant.featured_media?.id) {
      const thumb = section.querySelector(`[data-gallery-thumb="${variant.featured_media.id}"]`);
      if (thumb) {
        handleGalleryThumb(thumb);
      }
    }

    if (window.location.pathname === variant.url?.split('?')[0]) {
      const url = new URL(window.location.href);
      url.searchParams.set('variant', variant.id);
      window.history.replaceState({}, '', url);
    }
  }

  function initializeProductSection(section) {
    const productJson = section.querySelector('[data-product-json]');
    if (!productJson) return;

    const productData = JSON.parse(productJson.textContent);
    section.productData = productData;

    setVariantAvailability(section, findSelectedVariant(productData, section));

    const stickyBar = section.querySelector('[data-sticky-atc]');
    const purchaseBox = section.querySelector('[data-purchase-box]');

    if (stickyBar && purchaseBox && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const shouldShow = !entry.isIntersecting && window.innerWidth < 990;
            stickyBar.classList.toggle('is-visible', shouldShow);
          });
        },
        { threshold: 0.25 }
      );

      observer.observe(purchaseBox);
    }
  }

  function toggleMobileNav(forceOpen) {
    const nav = document.querySelector('[data-mobile-nav]');
    if (!nav) return;

    const isOpen = forceOpen ?? !nav.classList.contains('is-open');
    nav.hidden = !isOpen;
    nav.classList.toggle('is-open', isOpen);
    lockBody(isOpen);
  }

  function getLocaleForms() {
    return Array.from(document.querySelectorAll('[data-locale-form]'));
  }

  function setLocaleButtonState(localeCode) {
    document.querySelectorAll('[data-locale-button]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.localeCode === localeCode);
    });
  }

  async function submitLocaleForm(form, localeCode) {
    const body = new URLSearchParams(new FormData(form));
    body.set('locale_code', localeCode);
    body.set('return_to', `${window.location.pathname}${window.location.search}${window.location.hash}`);

    const response = await fetch(form.action, {
      method: 'POST',
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest'
      },
      credentials: 'same-origin',
      body: body.toString()
    });

    if (!response.ok) {
      throw new Error(`Locale switch failed with status ${response.status}`);
    }

    window.sessionStorage.setItem('shopTheme.pendingLocale', localeCode);
    window.localStorage.setItem('shopTheme.locale', localeCode);
    setLocaleButtonState(localeCode);
    window.location.assign(`${window.location.pathname}${window.location.search}${window.location.hash}`);
  }

  async function syncPreferredLocale() {
    const forms = getLocaleForms();
    if (!forms.length) return;

    const currentLocale = window.ShopTheme?.currentLocale;
    const defaultLocale = window.ShopTheme?.defaultLocale;
    const preferredLocale = window.localStorage.getItem('shopTheme.locale') || defaultLocale;
    const pendingLocale = window.sessionStorage.getItem('shopTheme.pendingLocale');

    if (pendingLocale && pendingLocale === currentLocale) {
      window.sessionStorage.removeItem('shopTheme.pendingLocale');
    }

    if (!preferredLocale || preferredLocale === currentLocale) return;

    if (pendingLocale && pendingLocale === preferredLocale) {
      window.sessionStorage.removeItem('shopTheme.pendingLocale');
      window.localStorage.removeItem('shopTheme.locale');
      return;
    }

    const hasPreferredLocale = document.querySelector(`[data-locale-button][data-locale-code="${preferredLocale}"]`);
    if (!hasPreferredLocale) return;

    try {
      await submitLocaleForm(forms[0], preferredLocale);
    } catch (error) {
      window.localStorage.removeItem('shopTheme.locale');
    }
  }

  document.addEventListener('click', (event) => {
    const target = event.target;

    if (target.closest('[data-cart-open]')) {
      event.preventDefault();
      state.activeElement = target.closest('[data-cart-open]');
      openCartDrawer();
      return;
    }

    if (target.closest('[data-cart-close]') || target.closest('[data-cart-overlay]')) {
      event.preventDefault();
      closeCartDrawer();
      return;
    }

    if (target.closest('[data-mobile-nav-toggle]')) {
      event.preventDefault();
      toggleMobileNav(true);
      return;
    }

    if (target.closest('[data-mobile-nav-close]') || target.closest('[data-mobile-nav-overlay]')) {
      event.preventDefault();
      toggleMobileNav(false);
      return;
    }

    const localeButton = target.closest('[data-locale-button]');
    if (localeButton) {
      const localeForm = localeButton.closest('[data-locale-form]');
      const localeCode = localeButton.dataset.localeCode;

      if (!localeForm || !localeCode) return;

      event.preventDefault();

      if (localeCode === window.ShopTheme?.currentLocale) {
        return;
      }

      submitLocaleForm(localeForm, localeCode).catch(() => {
        window.location.assign(localeForm.action);
      });
      return;
    }

    const quantityButton = target.closest('[data-quantity-button]');
    if (quantityButton) {
      event.preventDefault();
      handleQuantityButton(quantityButton);
      return;
    }

    const galleryThumb = target.closest('[data-gallery-thumb]');
    if (galleryThumb) {
      event.preventDefault();
      handleGalleryThumb(galleryThumb);
      return;
    }

    const removeButton = target.closest('[data-cart-remove]');
    if (removeButton) {
      event.preventDefault();
      updateCartLine(removeButton.dataset.cartRemove, 0);
      return;
    }

    const stickyButton = target.closest('[data-sticky-atc-button]');
    if (stickyButton) {
      event.preventDefault();
      const section = stickyButton.closest('[data-product-section]');
      const form = section?.querySelector('[data-product-form]');
      form?.requestSubmit(form.querySelector('[data-product-submit]'));
    }
  });

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    if (form.matches('[data-locale-form]')) {
      event.preventDefault();
      return;
    }

    if (!form.matches('[data-product-form]')) return;

    if (event.submitter && !event.submitter.hasAttribute('data-product-submit')) {
      return;
    }

    event.preventDefault();
    addToCart(form);
  });

  document.addEventListener('change', (event) => {
    const target = event.target;

    if (target.matches('[data-cart-line-input]')) {
      const line = target.closest('[data-cart-line]');
      if (!line) return;
      updateCartLine(line.dataset.lineKey, Number(target.value || 0));
      return;
    }

    if (target.matches('[data-sort-by]')) {
      target.form?.submit();
      return;
    }

    if (target.matches('[data-variant-option], [data-variant-id-select]')) {
      const section = target.closest('[data-product-section]');
      if (!section?.productData) return;
      setVariantAvailability(section, findSelectedVariant(section.productData, section));
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (state.cartOpen) {
        closeCartDrawer();
      }

      const nav = document.querySelector('[data-mobile-nav].is-open');
      if (nav) {
        toggleMobileNav(false);
      }
    }
  });

  document.querySelectorAll('[data-product-section]').forEach(initializeProductSection);
  syncPreferredLocale();
})();
