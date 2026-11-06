/* =========================================================================
   Guidance Office Records Inventory Management System
   Main JavaScript — global utilities, theme toggle, sidebar, search, helpers
   ========================================================================= */

(function () {
    'use strict';

    // ----- AOS init -----
    document.addEventListener('DOMContentLoaded', function () {
        if (window.AOS) {
            AOS.init({ duration: 700, once: true, offset: 60 });
        }
    });

    // ----- Theme toggle (persisted in cookie) -----
    const THEME_COOKIE = 'theme';
    const html = document.documentElement;

    function getCookie(name) {
        const m = document.cookie.match('(?:^|; )' + name + '=([^;]*)');
        return m ? decodeURIComponent(m[1]) : null;
    }
    function setCookie(name, value, days) {
        const d = new Date();
        d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${value};path=/;expires=${d.toUTCString()};SameSite=Lax`;
    }
    function applyTheme(theme) {
        html.setAttribute('data-bs-theme', theme);
    }
    // On load, ensure the persisted theme is applied
    const persistedTheme = getCookie(THEME_COOKIE);
    if (persistedTheme) applyTheme(persistedTheme);

    document.addEventListener('click', function (e) {
        const btn = e.target.closest('#themeToggle');
        if (!btn) return;
        const current = html.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
        applyTheme(current);
        setCookie(THEME_COOKIE, current, 365);
    });

    // ----- Sidebar (mobile) -----
    document.addEventListener('click', function (e) {
        const hamburger = e.target.closest('#btnHamburger');
        const sidebar = document.getElementById('appSidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (hamburger && sidebar) {
            sidebar.classList.add('open');
            if (overlay) overlay.classList.add('show');
            return;
        }
        if (overlay && (e.target === overlay || e.target.closest('.btn-logout') === null)) {
            // close on overlay click
            if (e.target === overlay) {
                sidebar.classList.remove('open');
                overlay.classList.remove('show');
            }
        }
    });

    // ----- Toast auto-hide -----
    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('#toastContainer .toast').forEach(function (t) {
            const bs = bootstrap.Toast.getOrCreateInstance(t, { delay: 5000 });
            bs.show();
        });
    });

    // ----- Global search (top bar) -----
    document.addEventListener('DOMContentLoaded', function () {
        const input = document.getElementById('globalSearchInput');
        const resultsBox = document.getElementById('globalSearchResults');
        if (!input || !resultsBox) return;
        let timer = null;
        const url = input.dataset.url;

        function renderResults(data) {
            if (!data || data.length === 0) {
                resultsBox.innerHTML = '<div class="gs-empty">No results found</div>';
                resultsBox.classList.add('show');
                return;
            }
            resultsBox.innerHTML = data.map(function (r) {
                const icon = {
                    student: 'bi-mortarboard',
                    user: 'bi-person',
                    item: 'bi-box-seam',
                    referral: 'bi-send-exclamation',
                    counseling: 'bi-chat-heart',
                }[r.type] || 'bi-search';
                return `<a href="${r.url}" class="gs-item">
                    <i class="bi ${icon}"></i>
                    <div><div class="fw-medium">${r.label}</div>
                    <small class="text-muted">${r.subtitle}</small></div>
                </a>`;
            }).join('');
            resultsBox.classList.add('show');
        }

        input.addEventListener('input', function () {
            const q = this.value.trim();
            clearTimeout(timer);
            if (q.length < 2) {
                resultsBox.classList.remove('show');
                return;
            }
            timer = setTimeout(function () {
                fetch(`${url}?q=${encodeURIComponent(q)}`)
                    .then(r => r.json())
                    .then(renderResults)
                    .catch(function () { resultsBox.classList.remove('show'); });
            }, 250);
        });
        document.addEventListener('click', function (e) {
            if (!input.contains(e.target) && !resultsBox.contains(e.target)) {
                resultsBox.classList.remove('show');
            }
        });
    });

    // ----- Flatpickr auto-init -----
    document.addEventListener('DOMContentLoaded', function () {
        if (!window.flatpickr) return;
        flatpickr('.datepicker', {
            dateFormat: 'Y-m-d',
            allowInput: true,
        });
        flatpickr('.datetimepicker', {
            enableTime: true,
            dateFormat: 'Y-m-d H:i',
            allowInput: true,
        });
    });

    // ----- Select2 auto-init -----
    document.addEventListener('DOMContentLoaded', function () {
        if (!window.jQuery || !jQuery.fn.select2) return;
        jQuery('.select2').select2({ theme: 'bootstrap-5', width: '100%' });
    });

    // ----- Confirm-delete helper (SweetAlert2) -----
    window.confirmDelete = function (opts) {
        opts = opts || {};
        return Swal.fire({
            title: opts.title || 'Are you sure?',
            text: opts.text || 'This action cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#c0392b',
            confirmButtonText: opts.confirmText || 'Yes, delete it!',
            cancelButtonText: 'Cancel',
        }).then(function (result) {
            if (result.isConfirmed && opts.onConfirm) opts.onConfirm();
        });
    };

    // ----- Logout confirmation -----
    document.addEventListener('click', function (e) {
        const btn = e.target.closest('.btn-logout');
        if (!btn) return;
        e.preventDefault();
        const url = btn.getAttribute('href');
        Swal.fire({
            title: 'Are you sure you want to logout?',
            text: 'You will need to sign in again to access the system.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#1a4d8f',
            confirmButtonText: 'Yes, logout',
            cancelButtonText: 'Cancel',
        }).then(function (result) {
            if (result.isConfirmed) window.location.href = url;
        });
    });

    // ----- Auto-disable submit on form submit (prevent double-click) -----
    document.addEventListener('submit', function (e) {
        const form = e.target;
        if (!form.matches('form[data-disable-on-submit]')) return;
        const btn = form.querySelector('button[type="submit"]');
        if (btn) {
            btn.disabled = true;
            btn.dataset.originalText = btn.innerHTML;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Processing...';
        }
    });
})();
