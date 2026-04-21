const MOBILE_BREAKPOINT = 980;

function syncTopbarOffset(header) {
  const target = header || document.querySelector('.topbar');
  if (!target) return;
  const height = Math.ceil(target.getBoundingClientRect().height || 0);
  document.documentElement.style.setProperty('--po-topbar-offset', `${Math.max(height + 8, 64)}px`);
}


function closeMenu(menu, burger) {
  if (!menu || !burger) return;
  menu.classList.remove('is-open');
  burger.classList.remove('is-open');
  syncTopbarOffset(document.querySelector('.topbar'));
  burger.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('po-auth-menu-open');
}

function openMenu(menu, burger) {
  if (!menu || !burger) return;
  menu.classList.add('is-open');
  burger.classList.add('is-open');
  syncTopbarOffset(document.querySelector('.topbar'));
  burger.setAttribute('aria-expanded', 'true');
  document.body.classList.add('po-auth-menu-open');
}

function initProtectedTopbar() {
  const header = document.querySelector('.topbar');
  const container = header?.querySelector('.container.row.between');
  if (!header || !container) return;
  const actions = container.querySelector(':scope > .row.gap.wrap');
  const brand = container.querySelector(':scope > .brand');
  if (!actions || !brand || container.querySelector('.po-auth-burger')) return;

  document.body.classList.add('po-protected-page');
  header.classList.add('po-protected-topbar');
  container.classList.add('po-protected-topbar-row');
  brand.classList.add('po-protected-brand');
  actions.classList.add('po-auth-actions');
  actions.id = actions.id || 'poAuthActionsMenu';
  syncTopbarOffset(header);

  const updateCompactMode = () => {
    const compact = window.matchMedia('(max-width: 980px) and (orientation: landscape), (max-width: 980px) and (max-height: 520px)').matches;
    document.body.classList.toggle('po-topbar-compact', compact);
    syncTopbarOffset(header);
  };
  updateCompactMode();

  const burger = document.createElement('button');
  burger.type = 'button';
  burger.className = 'po-auth-burger';
  burger.setAttribute('aria-label', 'Ouvrir le menu');
  burger.setAttribute('aria-expanded', 'false');
  burger.setAttribute('aria-controls', actions.id);
  burger.innerHTML = '<span></span><span></span><span></span>';
  brand.insertAdjacentElement('afterend', burger);

  burger.addEventListener('click', () => {
    const isOpen = actions.classList.contains('is-open');
    if (isOpen) closeMenu(actions, burger);
    else openMenu(actions, burger);
  });

  actions.querySelectorAll('a, button').forEach((node) => {
    node.addEventListener('click', () => closeMenu(actions, burger));
  });

  document.addEventListener('click', (event) => {
    if (!actions.classList.contains('is-open')) return;
    if (actions.contains(event.target) || burger.contains(event.target)) return;
    closeMenu(actions, burger);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu(actions, burger);
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > MOBILE_BREAKPOINT) closeMenu(actions, burger);
    updateCompactMode();
    syncTopbarOffset(header);
  });

  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      updateCompactMode();
      syncTopbarOffset(header);
      if (window.innerWidth > MOBILE_BREAKPOINT) closeMenu(actions, burger);
    }, 60);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProtectedTopbar, { once: true });
} else {
  initProtectedTopbar();
}
