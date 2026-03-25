document.addEventListener('DOMContentLoaded', () => {
  const drawer = document.querySelector('#minicart-drawer');
  if (!drawer) return;

  document.querySelectorAll('[data-minicart-open]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      drawer.showModal();
    });
  });

  document.querySelector('#minicart-close')?.addEventListener('click', () => {
    drawer.close();
  });
});
