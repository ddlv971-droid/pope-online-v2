// Topbar mobile universelle V40 — burger + menu + croix
(function() {
  var burger  = document.getElementById('v40Burger');
  var menu    = document.getElementById('v40MobileMenu');
  if (!burger || !menu) return;

  var spans = burger.querySelectorAll('span');

  function setOpen(open) {
    if (open) {
      menu.classList.add('open');
      spans[0].style.cssText = 'transform:rotate(45deg) translate(5px,5px)';
      spans[1].style.cssText = 'opacity:0;transform:scaleX(0)';
      spans[2].style.cssText = 'transform:rotate(-45deg) translate(5px,-5px)';
    } else {
      menu.classList.remove('open');
      spans[0].style.cssText = '';
      spans[1].style.cssText = '';
      spans[2].style.cssText = '';
    }
  }

  burger.addEventListener('click', function() {
    setOpen(!menu.classList.contains('open'));
  });

  // Fermer en cliquant un lien
  menu.querySelectorAll('a, button').forEach(function(el) {
    el.addEventListener('click', function() { setOpen(false); });
  });

  // Fermer en cliquant hors du menu
  document.addEventListener('click', function(e) {
    if (!burger.contains(e.target) && !menu.contains(e.target)) {
      setOpen(false);
    }
  });
})();
