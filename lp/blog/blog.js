
(function () {
  'use strict';
  initFilterAndSearch();
  initFeaturedCarousel();
  function initFilterAndSearch() {
    var filterGroup = document.querySelector('.blog-filters');
    var items = [].slice.call(document.querySelectorAll('.blog-list-grid .bp-item'));
    var status = document.getElementById('blog-filter-status');
    var searchInput = document.getElementById('blog-search-input');
    if (!items.length) return;
    var buttons = filterGroup ? [].slice.call(filterGroup.querySelectorAll('.blog-filter-btn')) : [];
    var activeCat = 'all';
    var searchTerm = '';
    function applyFilters() {
      var visible = 0;
      items.forEach(function (item) {
        var matchesCat = activeCat === 'all' || item.getAttribute('data-cat') === activeCat;
        var title = item.querySelector('h3');
        var matchesSearch = !searchTerm || (title && title.textContent.toLowerCase().indexOf(searchTerm) !== -1);
        var match = matchesCat && matchesSearch;
        item.classList.toggle('hidden', !match);
        if (match) visible += 1;
      });
      if (status) {
        status.textContent = visible === 1 ? '1 post encontrado.' : visible + ' posts encontrados.';
      }
    }
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.getAttribute('aria-pressed') === 'true') return;
        buttons.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
        activeCat = btn.getAttribute('data-filter');
        applyFilters();
      });
    });
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        searchTerm = searchInput.value.trim().toLowerCase();
        applyFilters();
      });
    }
  }
  function initFeaturedCarousel() {
    var root = document.getElementById('blog-featured');
    if (!root) return;
    var slides = [].slice.call(root.querySelectorAll('.blog-featured-slide'));
    var dots = [].slice.call(root.querySelectorAll('.blog-dot'));
    if (slides.length < 2) return;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var current = 0;
    var timer = null;
    var AUTOPLAY_MS = 6000;
    function goTo(index) {
      if (index === current) return;
      slides[current].classList.remove('is-active');
      slides[current].setAttribute('aria-hidden', 'true');
      dots[current].classList.remove('is-active');
      dots[current].setAttribute('aria-selected', 'false');
      current = index;
      slides[current].classList.add('is-active');
      slides[current].setAttribute('aria-hidden', 'false');
      dots[current].classList.add('is-active');
      dots[current].setAttribute('aria-selected', 'true');
    }
    function next() { goTo((current + 1) % slides.length); }
    function start() {
      if (reduceMotion || timer) return;
      timer = window.setInterval(next, AUTOPLAY_MS);
    }
    function stop() {
      if (timer) { window.clearInterval(timer); timer = null; }
    }
    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () {
        goTo(i);
        stop();
        start();
      });
    });
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    root.addEventListener('focusin', stop);
    root.addEventListener('focusout', start);
    start();
  }
})();
