class CartDrawer extends HTMLElement {
  constructor() {
    super();
    this.drawer = this.querySelector('.cart-drawer');
    this.overlay = this.querySelector('.cart-drawer-overlay');
    this.closeBtn = this.querySelector('.cart-drawer-close');
    
    this.bindEvents();
  }

  bindEvents() {
    if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());
    if (this.overlay) this.overlay.addEventListener('click', () => this.close());
    
    document.addEventListener('cart:refresh', () => this.fetchCart());
    document.addEventListener('cart:open', () => this.open());
  }

  open() {
    this.setAttribute('open', '');
    document.body.style.overflow = 'hidden';
  }

  close() {
    this.removeAttribute('open');
    document.body.style.overflow = '';
  }

  async fetchCart() {
    try {
      const res = await fetch('/cart?section_id=cart-drawer');
      const text = await res.text();
      const html = new DOMParser().parseFromString(text, 'text/html');
      
      const newDrawer = html.querySelector('.cart-drawer-content');
      if (newDrawer) {
        this.querySelector('.cart-drawer-content').innerHTML = newDrawer.innerHTML;
      }
      this.open();
    } catch (err) {
      console.error('Failed to fetch cart', err);
    }
  }
}

customElements.define('cart-drawer', CartDrawer);

// Form submission for ATC
document.addEventListener('submit', async (e) => {
  if (e.target.matches('form[action="/cart/add"]')) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const formData = new FormData(e.target);
      await fetch(window.Shopify.routes.root + 'cart/add.js', {
        method: 'POST',
        body: formData
      });
      document.dispatchEvent(new CustomEvent('cart:refresh'));
    } catch (err) {
      console.error('ATC failed', err);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }
});