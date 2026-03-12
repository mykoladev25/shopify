const dialog = document.getElementById('mobile-menu');
const openBtn = document.getElementById('menu-open');
const closeBtn = document.getElementById('menu-close');

openBtn.addEventListener('click', () => {
    dialog.showModal();
});

closeBtn.addEventListener('click', () => {
    dialog.close();
});