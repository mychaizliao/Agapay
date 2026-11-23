(function () {
    'use strict';

    var SESSION_KEY = 'agapaySession';

    var ACCOUNTS = [
        { role: 'user',  email: 'juan@email.com',         password: 'Juan12345',
          firstName: 'Juan',  lastName: 'Dela Cruz', city: 'Antipolo' },
        { role: 'user',  email: 'maria.santos@email.com', password: 'Maria12345',
          firstName: 'Maria', lastName: 'Santos',    city: 'Quezon City' },
        { role: 'admin', email: 'admin@agapay.org',       password: 'Admin12345',
          firstName: 'Admin', lastName: '',           city: '' }
    ];

    function findByEmail(email) {
        email = String(email || '').trim().toLowerCase();
        for (var i = 0; i < ACCOUNTS.length; i++) {
            if (ACCOUNTS[i].email === email) { return ACCOUNTS[i]; }
        }
        return null;
    }

    function getSession() {
        try {
            var saved = JSON.parse(sessionStorage.getItem(SESSION_KEY));
            var account = saved && findByEmail(saved.email);
            return account && account.role === saved.role ? account : null;
        } catch (e) { return null; }
    }

    function saveSession(account) {
        try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify({ email: account.email, role: account.role }));
        } catch (e) { }
    }

    function clearSession() {
        try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
    }

    function landingPage(account) {
        return account.role === 'admin' ? '#admin' : '#home';
    }

    function fillProfile(account) {
        var fullName = (account.firstName + ' ' + account.lastName).trim();
        var initials = (account.firstName.charAt(0) + account.lastName.charAt(0)).toUpperCase();
        var name = document.getElementById('profile-name');
        var email = document.getElementById('profile-email');
        var badge = document.getElementById('profile-initials');
        if (name)  { name.textContent = fullName; }
        if (email) { email.textContent = account.email; }
        if (badge) { badge.textContent = initials; }

        var fields = document.querySelectorAll('[data-profile]');
        for (var i = 0; i < fields.length; i++) {
            var value = account[fields[i].getAttribute('data-profile')];
            if (value) { fields[i].value = value; }
        }
    }

    function applySession(account) {
        var isAdmin = !!account && account.role === 'admin';
        var isUser  = !!account && account.role === 'user';

        document.body.classList.toggle('is-admin', isAdmin);
        document.body.classList.toggle('is-user', isUser);

        if (isUser) { fillProfile(account); }

        var frame = document.querySelector('.admin-frame');
        if (frame) {
            if (isAdmin) {
                if (frame.getAttribute('src') !== frame.getAttribute('data-src')) {
                    frame.setAttribute('src', frame.getAttribute('data-src'));
                }
            } else if (frame.getAttribute('src')) {
                frame.setAttribute('src', 'about:blank');
            }
        }
    }

    function guardRoute() {
        var hash = window.location.hash;
        var account = getSession();

        if (!account && (hash === '#admin' || hash === '#profile')) {
            window.location.hash = '#login';
        } else if (account && account.role === 'user' && hash === '#admin') {
            window.location.hash = '#home';
        } else if (account && account.role === 'admin' && hash === '#profile') {
            window.location.hash = '#admin';
        } else if (account && (hash === '#login' || hash === '#signup')) {
            window.location.hash = landingPage(account);
        }
    }

    var form = document.getElementById('login-form');
    if (form) {
        var emailInput = document.getElementById('login-email');
        var passwordInput = document.getElementById('login-password');
        var errorBox = document.getElementById('login-error');

        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var account = findByEmail(emailInput.value);

            if (account && account.password === passwordInput.value) {
                saveSession(account);
                applySession(account);
                form.reset();
                errorBox.hidden = true;
                window.location.hash = landingPage(account);
            } else {
                errorBox.hidden = false;
                passwordInput.value = '';
                passwordInput.focus();
            }
        });

        form.addEventListener('input', function () { errorBox.hidden = true; });
    }

    document.addEventListener('click', function (event) {
        var pdfDownloadLink = event.target.closest && event.target.closest('#educational-resources .awareness-link');
        if (pdfDownloadLink && pdfDownloadLink.textContent.indexOf('Download PDF') !== -1) {
            event.preventDefault();
            alert('The PDF file has been downloaded.');
        }

        if (event.target.closest && event.target.closest('[data-logout]')) {
            clearSession();
            applySession(null);
        }
    });

    window.addEventListener('hashchange', guardRoute);

    applySession(getSession());
    guardRoute();

    document.addEventListener('DOMContentLoaded', function() {
        const toggleBtn = document.getElementById("toggle-campaigns");
        const campaignGrid = document.querySelector(".campaigns .campaign-grid");

        if (toggleBtn && campaignGrid) {
            toggleBtn.addEventListener("click", function() {
                // Toggle the 'show-all' class on the grid
                campaignGrid.classList.toggle("show-all");

                // Change the text
                if (campaignGrid.classList.contains("show-all")) {
                    toggleBtn.textContent = "Show less";
                } else {
                    toggleBtn.textContent = "Show more";
                }
            });
        }
    });

    window.handleDonation = function(event, formElement) {
        event.preventDefault();

        alert("Thank you for your donation! Your confirmation has been received. Our team will verify your transaction shortly.");

        const modalToggleId = formElement.closest('.page').querySelector('.donate-toggle').id;
        document.getElementById(modalToggleId).checked = false;

        formElement.reset();
    };
    
    document.addEventListener("DOMContentLoaded", function() {
        
        const volunteerBtn = document.getElementById("volunteer-btn");
        const volunteerGrid = document.getElementById("volunteer-grid");

        if (volunteerBtn && volunteerGrid) {
            volunteerBtn.addEventListener("click", function() {
                volunteerGrid.classList.toggle("show-all");
                volunteerBtn.textContent = volunteerGrid.classList.contains("show-all") ? "Show less" : "Show more";
            });
        }

        const newsBtn = document.getElementById("news-btn");
        const newsGrid = document.getElementById("news-grid");

        if (newsBtn && newsGrid) {
            newsBtn.addEventListener("click", function() {
                newsGrid.classList.toggle("show-all");
                newsBtn.textContent = newsGrid.classList.contains("show-all") ? "Show less" : "Show more";
            });
        }

        const storiesBtn = document.getElementById("stories-btn");
        const storiesGrid = document.getElementById("stories-grid");

        if (storiesBtn && storiesGrid) {
            storiesBtn.addEventListener("click", function() {
                storiesGrid.classList.toggle("show-all");
                storiesBtn.textContent = storiesGrid.classList.contains("show-all") ? "Show less" : "Show more";
            });
        }

        const blogBtn = document.getElementById("blog-btn");
        const blogGrid = document.getElementById("blog-grid");

        if (blogBtn && blogGrid) {
            blogBtn.addEventListener("click", function() {
                blogGrid.classList.toggle("show-all");
                blogBtn.textContent = blogGrid.classList.contains("show-all") ? "Show less" : "Show more";
            });
        }

    });

})();
