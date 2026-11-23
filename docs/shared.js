(function () {
    'use strict';

    var KEY = 'agapayCommunityData';

    function empty() {
        return { donations: [], applications: [], mentorApplications: [], helpRequests: [], posts: [], campaigns: [], partners: [], mentors: [] };
    }
    function read() {
        var data;
        try { data = JSON.parse(localStorage.getItem(KEY)) || empty(); } catch (e) { data = empty(); }
        data.donations = data.donations || [];
        data.applications = data.applications || [];
        data.mentorApplications = data.mentorApplications || [];
        data.helpRequests = data.helpRequests || [];
        data.helpRequests = data.helpRequests.filter(function (request) { return !request.contentPostId; });
        data.posts = data.posts || [];
        data.campaigns = data.campaigns || [];
        data.partners = data.partners || [];
        data.mentors = data.mentors || [];
        data.mentors.forEach(function (mentor) {
            if (mentor.status !== 'Hidden') { mentor.status = 'Published'; }
        });
        var seenPartner = {};
        data.partners = data.partners.filter(function (partner) {
            var key = String(partner.name || '').trim().toLowerCase();
            if (!key) { return true; }
            if (seenPartner[key]) { return false; }
            seenPartner[key] = true;
            return true;
        });
        normalize(data);
        return data;
    }
    function write(data) {
        localStorage.setItem(KEY, JSON.stringify(data));
        window.dispatchEvent(new Event('agapay-data-change'));
    }
    function id() {
        return 'agp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    }
    function esc(value) {
        return String(value || '').replace(/[&<>"']/g, function (character) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
        });
    }
    function normalize(data) {
        data.posts.forEach(function (post) {
            if (post.type === 'Event') { post.type = 'Volunteer'; }
            if (post.type === 'Awareness') { post.type = 'News'; }
            if (post.type === 'Success story') { post.type = 'Success Story'; }
            if (post.type === 'Article') { post.type = 'Blog'; }
            if (post.sourceTitle && !post.sourceKind) {
                post.sourceKind = post.type === 'Volunteer' ? 'volunteer' : post.type === 'Donate' ? 'campaign' : 'awareness';
            }
        });
        if (!data.contentPostsMigrated) {
            data.campaigns.forEach(function (campaign) {
                if (!data.posts.some(function (post) { return post.sourceKind === 'campaign' && post.sourceTitle === campaign.sourceTitle; })) {
                    campaign.type = 'Donate';
                    campaign.sourceKind = 'campaign';
                    data.posts.push(campaign);
                }
            });
            data.contentPostsMigrated = true;
        }
    }

    window.AgapayStore = { read: read, write: write, id: id, silentWrite: function (data) { localStorage.setItem(KEY, JSON.stringify(data)); } };
    window.agapayEscape = esc;

    function rootDocument() {
        try { return window.parent && window.parent.document ? window.parent.document : document; } catch (e) { return document; }
    }
    function cardTitle(card) {
        var heading = card.querySelector('h3');
        return heading ? heading.textContent.trim() : '';
    }
    function cardImage(card) {
        var image = card.querySelector('img');
        return image ? image.getAttribute('src') : '';
    }
    function storyText(container) {
        return container ? Array.prototype.map.call(container.querySelectorAll('p'), function (paragraph) { return paragraph.textContent.trim(); }).join('\n\n') : '';
    }
    function modalDetails(card, root) {
        var link = card.querySelector('a[onclick]');
        var match = link && link.getAttribute('onclick').match(/getElementById\(['"]([^'"]+)/);
        var modal = match && root.getElementById(match[1]);
        var content = modal && modal.querySelector('.article-modal-content');
        return {
            id: match ? match[1] : '',
            story: content ? Array.prototype.map.call(content.querySelectorAll('p:not(.article-date)'), function (paragraph) { return paragraph.textContent.trim(); }).join('\n\n') : ''
        };
    }
    function addPost(data, post) {
        if (!data.posts.some(function (item) { return item.sourceKind === post.sourceKind && item.sourceTitle === post.sourceTitle; })) {
            data.posts.push(post);
        }
    }
    function seedContent() {
        var data = read();
        var root = rootDocument();
        var resourcesGrid = root.querySelector('#educational-resources .awareness-grid');
        var resourceSeedNeeded = !!(resourcesGrid && !data.educationalResourceCardsImported);
        if (resourceSeedNeeded) {
            Array.prototype.forEach.call(resourcesGrid.querySelectorAll('article.awareness-card'), function (card) {
                var title = cardTitle(card);
                if (!title) { return; }
                var excerpt = card.querySelector('.awareness-excerpt');
                var date = card.querySelector('.awareness-date');
                var badge = card.querySelector('.awareness-badge');
                var existing = data.posts.find(function (post) {
                    return post.type === 'Educational Resources' && (post.sourceTitle === title || (!post.sourceTitle && post.title === title));
                });
                if (existing) {
                    existing.sourceTitle = existing.sourceTitle || title;
                    existing.sourceKind = 'educational-resource';
                    existing.resourceLabel = existing.resourceLabel || (badge ? badge.textContent.trim() : 'Resource');
                    return;
                }
                data.posts.push({ id: id(), type: 'Educational Resources', sourceKind: 'educational-resource', sourceTitle: title, title: title, story: excerpt ? excerpt.textContent.trim() : '', fullStory: excerpt ? excerpt.textContent.trim() : '', image: cardImage(card), date: date ? date.textContent.trim() : '', resourceLabel: badge ? badge.textContent.trim() : 'Resource', status: 'Published' });
            });
            data.educationalResourceCardsImported = true;
        }
        if (data.contentSeedVersion >= 8) {
            if (resourceSeedNeeded) { write(data); }
            return;
        }

        [['news-grid', 'News'], ['stories-grid', 'Success Story'], ['blog-grid', 'Blog']].forEach(function (pair) {
            var grid = root.getElementById(pair[0]);
            if (!grid) { return; }
            Array.prototype.forEach.call(grid.querySelectorAll('article'), function (card) {
                var title = cardTitle(card);
                if (!title) { return; }
                var excerpt = card.querySelector('.awareness-excerpt');
                var modal = modalDetails(card, root);
                addPost(data, { id: id(), type: pair[1], sourceKind: 'awareness', sourceTitle: title, title: title, story: excerpt ? excerpt.textContent.trim() : '', fullStory: modal.story || (excerpt ? excerpt.textContent.trim() : ''), modalId: modal.id, image: cardImage(card), status: 'Published' });
            });
        });

        var awarenessGrid = root.querySelector('#awareness-campaigns .awareness-grid');
        if (awarenessGrid) {
            Array.prototype.forEach.call(awarenessGrid.querySelectorAll('article.awareness-card'), function (card) {
                var title = cardTitle(card);
                if (!title) { return; }
                var excerpt = card.querySelector('.awareness-excerpt');
                var date = card.querySelector('.awareness-date');
                addPost(data, { id: id(), type: 'Awareness Campaign', sourceKind: 'awareness-campaign', sourceTitle: title, title: title, story: excerpt ? excerpt.textContent.trim() : '', fullStory: excerpt ? excerpt.textContent.trim() : '', image: cardImage(card), date: date ? date.textContent.trim() : '', status: 'Published' });
            });
        }

        var volunteerGrid = root.getElementById('volunteer-grid');
        if (volunteerGrid) {
            Array.prototype.forEach.call(volunteerGrid.querySelectorAll('article'), function (card) {
                var title = cardTitle(card);
                if (!title) { return; }
                var detail = Array.prototype.find.call(root.querySelectorAll('main.volunteer-page'), function (page) {
                    var heading = page.querySelector('.detail-title');
                    return heading && heading.textContent.trim() === title;
                });
                var detailImage = detail && detail.querySelector('.story-img');
                var body = detail && detail.querySelector('.story-text');
                var excerpt = card.querySelector('p');
                addPost(data, { id: id(), type: 'Volunteer', sourceKind: 'volunteer', sourceTitle: title, title: title, story: excerpt ? excerpt.textContent.trim() : '', fullStory: storyText(body) || (excerpt ? excerpt.textContent.trim() : ''), image: detailImage ? detailImage.getAttribute('src') : cardImage(card), status: 'Published' });
            });
        }

        var donationGrid = root.querySelector('#donation .campaign-grid');
        if (donationGrid) {
            Array.prototype.forEach.call(donationGrid.querySelectorAll('article'), function (card) {
                var title = cardTitle(card);
                if (!title) { return; }
                var detail = Array.prototype.find.call(root.querySelectorAll('main[id^="campaign-"]'), function (page) {
                    var heading = page.querySelector('.detail-title');
                    return heading && heading.textContent.trim() === title;
                });
                var detailImage = detail && detail.querySelector('.story-img');
                var body = detail && detail.querySelector('.story-text');
                var excerpt = card.querySelector('.card-desc');
                addPost(data, { id: id(), type: 'Donate', sourceKind: 'campaign', sourceTitle: title, title: title, story: excerpt ? excerpt.textContent.trim() : '', fullStory: storyText(body) || (excerpt ? excerpt.textContent.trim() : ''), image: detailImage ? detailImage.getAttribute('src') : cardImage(card), status: 'Published' });
            });
        }
        data.posts.forEach(function (post) {
            if ((post.type === 'Volunteer' || post.type === 'Donate') || !post.sourceTitle) { return; }
            var awarenessCard = findCard(root, '#news-grid article,#stories-grid article,#blog-grid article', post.sourceTitle);
            if (awarenessCard) {
                var existingModal = modalDetails(awarenessCard, root);
                if (awarenessCard.closest('#news-grid')) { post.type = 'News'; }
                if (awarenessCard.closest('#stories-grid')) { post.type = 'Success Story'; }
                if (awarenessCard.closest('#blog-grid')) { post.type = 'Blog'; }
                post.modalId = existingModal.id;
                post.fullStory = post.fullStory || existingModal.story || post.story;
            }
        });
        data.contentSeedVersion = 8;
        write(data);
    }
    function originalTitle(heading) {
        return heading && (heading.getAttribute('data-original-title') || heading.textContent.trim());
    }
    function findCard(root, selector, sourceTitle) {
        return Array.prototype.find.call(root.querySelectorAll(selector), function (card) {
            return originalTitle(card.querySelector('h3')) === sourceTitle;
        });
    }
    function setImage(container, imageValue, title) {
        if (!imageValue) { return; }
        var image = container.querySelector('img');
        if (image) { image.src = imageValue; image.alt = title; }
    }
    function updateHeading(heading, post) {
        if (heading) {
            heading.setAttribute('data-original-title', post.sourceTitle || post.title);
            heading.textContent = post.title;
        }
    }
    function updateParagraphs(container, value) {
        if (!container) { return; }
        container.innerHTML = String(value || '').split(/\n\s*\n/).filter(Boolean).map(function (text) {
            return '<p>' + formatInlineText(text) + '</p>';
        }).join('');
    }
    function formatInlineText(text) {
        return esc(text).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    }
    function formatStoryParagraphs(value) {
        return String(value || '').split(/\n\s*\n/).filter(Boolean).map(function (text) {
            return '<p>' + formatInlineText(text) + '</p>';
        }).join('');
    }
    function updateExistingPost(root, post) {
        var cardSelector = post.type === 'Volunteer' ? '#volunteer-grid article' : post.type === 'Donate' ? '#donation .campaign-grid article' : post.type === 'Awareness Campaign' ? '#awareness-campaigns .awareness-grid article' : post.type === 'Educational Resources' ? '#educational-resources .awareness-grid article' : post.type === 'Blog' ? '#blog-grid article' : post.type === 'Success Story' ? '#stories-grid article' : '#news-grid article';
        var card = findCard(root, cardSelector, post.sourceTitle);
        if (card) {
            card.hidden = post.status !== 'Published';
            card.style.display = post.status === 'Published' ? '' : 'none';
            updateHeading(card.querySelector('h3'), post);
            var excerpt = card.querySelector(post.type === 'Donate' ? '.card-desc' : '.awareness-excerpt') || card.querySelector('p');
            if (excerpt) { excerpt.textContent = post.story; }
            if (post.type === 'Educational Resources') {
                var resourceBadge = card.querySelector('.awareness-badge');
                var resourceLink = card.querySelector('.awareness-link');
                if (resourceBadge) { resourceBadge.textContent = post.resourceLabel || 'Resource'; }
                if (resourceLink) {
                    resourceLink.textContent = 'Download PDF \u2192';
                    resourceLink.setAttribute('href', '#');
                    resourceLink.removeAttribute('target');
                    resourceLink.removeAttribute('rel');
                }
            }
            if (post.date) {
                var dateLine = card.querySelector('.awareness-date');
                if (dateLine) { dateLine.textContent = formatPostDate(post.date); }
            }
            setImage(card, post.image, post.title);
            if (post.type === 'Awareness Campaign') {
                var opener = card.querySelector('.awareness-link');
                if (opener) {
                    post.modalId = post.modalId || communityModalId(post);
                    opener.setAttribute('href', 'javascript:void(0);');
                    opener.setAttribute('data-community-open', post.modalId);
                }
                if (post.status === 'Published') { syncCommunityModal(root, post, read()); }
                else { removeCommunityModal(root, post); }
            }
            if (post.modalId) {
                var modal = root.getElementById(post.modalId);
                var content = modal && modal.querySelector('.article-modal-content');
                if (content) {
                    var modalTitle = content.querySelector('h2');
                    if (modalTitle) { modalTitle.textContent = post.title; }
                    if (post.date) {
                        var modalDate = content.querySelector('.article-date');
                        if (modalDate) { modalDate.textContent = formatPostDate(post.date); }
                    }
                    content.querySelectorAll('p:not(.article-date)').forEach(function (paragraph) { paragraph.remove(); });
                    String(post.fullStory || post.story).split(/\n\s*\n/).filter(Boolean).forEach(function (text) {
                        var paragraph = root.createElement('p');
                        paragraph.innerHTML = formatInlineText(text);
                        content.appendChild(paragraph);
                    });
                }
            }
        }

        if (post.type === 'Volunteer') {
            var volunteerPage = Array.prototype.find.call(root.querySelectorAll('main.volunteer-page'), function (page) {
                return originalTitle(page.querySelector('.detail-title')) === post.sourceTitle;
            });
            if (volunteerPage) {
                volunteerPage.hidden = post.status !== 'Published';
                volunteerPage.style.display = post.status === 'Published' ? '' : 'none';
                updateHeading(volunteerPage.querySelector('.detail-title'), post);
                updateParagraphs(volunteerPage.querySelector('.story-text'), post.fullStory || post.story);
                setImage(volunteerPage, post.image, post.title);
            }
        }

        if (post.type === 'Donate') {
            var donatePage = Array.prototype.find.call(root.querySelectorAll('main[id^="campaign-"]'), function (page) {
                return originalTitle(page.querySelector('.detail-title')) === post.sourceTitle;
            });
            if (donatePage) {
                donatePage.hidden = post.status !== 'Published';
                donatePage.style.display = post.status === 'Published' ? '' : 'none';
                updateHeading(donatePage.querySelector('.detail-title'), post);
                updateParagraphs(donatePage.querySelector('.story-text'), post.fullStory || post.story);
                setImage(donatePage, post.image, post.title);
            }
        }
    }
    function communityGrid(root, post) {
        return post.type === 'Volunteer' ? root.getElementById('volunteer-grid') : post.type === 'Donate' ? root.querySelector('#donation .campaign-grid') : post.type === 'Awareness Campaign' ? root.querySelector('#awareness-campaigns .awareness-grid') : post.type === 'Educational Resources' ? root.querySelector('#educational-resources .awareness-grid') : post.type === 'Blog' ? root.getElementById('blog-grid') : post.type === 'Success Story' ? root.getElementById('stories-grid') : root.getElementById('news-grid');
    }

    function communityModalId(post) {
        return 'community-article-' + post.id;
    }
    function communityDetailId(post) {
        return (post.type === 'Donate' ? 'campaign-' : 'volunteer-') + post.id;
    }
    function formatPostDate(value) {
        var text = String(value || '');
        var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
        if (match) {
            return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        }
        return text;
    }
    function verifiedRaised(data, post) {
        return (data.donations || []).filter(function (donation) {
            return donation.status === 'Verified' && (donation.campaign === post.title || donation.campaign === post.sourceTitle);
        }).reduce(function (sum, donation) { return sum + Number(donation.amount || 0); }, 0);
    }
    function syncCommunityModal(root, post, data) {
        var modalId = communityModalId(post);
        var modal = root.getElementById(modalId);
        if (!modal) {
            modal = root.createElement('div');
            modal.className = 'article-modal';
            modal.id = modalId;
            root.body.appendChild(modal);
        }
        var paragraphs = formatStoryParagraphs(post.fullStory || post.story);
        var goal = Number(post.targetAmount) || 0;
        var goalLine = post.type === 'Donate' && goal ?
            '<p><strong>Goal:</strong> \u20b1' + goal.toLocaleString() + ' \u00b7 <strong>Raised so far:</strong> \u20b1' + verifiedRaised(data, post).toLocaleString() + '</p>' : '';
        modal.innerHTML = '<div class="article-modal-bg"></div>' +
            '<div class="article-modal-content">' +
            '<button class="article-modal-close" aria-label="Close">\u00d7</button>' +
            '<h2>' + esc(post.title) + '</h2>' +
            '<p class="article-date">' + esc(formatPostDate(post.date)) + '</p>' +
            paragraphs + goalLine +
            '</div>';
        function close() { modal.classList.remove('active'); }
        modal.querySelector('.article-modal-bg').addEventListener('click', close);
        modal.querySelector('.article-modal-close').addEventListener('click', close);
    }
    function removeCommunityModal(root, post) {
        var modal = root.getElementById(communityModalId(post));
        if (modal) { modal.remove(); }
    }
    function removeCommunityDetailPage(root, post) {
        var page = root.getElementById(communityDetailId(post));
        if (page) { page.remove(); }
    }
    function storyParagraphs(value) {
        return String(value || '').split(/\n\s*\n/).filter(Boolean).map(function (text) {
            return '<p>' + esc(text) + '</p>';
        }).join('');
    }
 
    function syncCommunityDetailPage(root, post, data) {
        var pageId = communityDetailId(post);
        var page = root.getElementById(pageId);
        var isDonate = post.type === 'Donate';
        if (!page) {
            page = root.createElement('main');
            page.id = pageId;
            page.className = isDonate ? 'page' : 'page volunteer-page';
            var footer = root.querySelector('.site-footer');
            if (footer) { footer.parentNode.insertBefore(page, footer); } else { root.body.appendChild(page); }
        }
        var published = post.status === 'Published';
        page.hidden = !published;
        page.style.display = published ? '' : 'none';
        if (!published) { return; }
        var toggleId = (isDonate ? 'donate-' : 'register-') + post.id;
        var when = formatPostDate(post.date);
        var goal = Number(post.targetAmount) || 0;
        var raised = verifiedRaised(data, post);
        var percent = goal ? Math.min(100, Math.round(raised / goal * 100)) : 0;
        var donors = (data.donations || []).filter(function (donation) {
            return donation.status === 'Verified' && (donation.campaign === post.title || donation.campaign === post.sourceTitle);
        });
        var image = post.image || 'assets/Agapay Logo.png';
        var storyText = storyParagraphs(post.fullStory || post.story);
        var backLink = '<a class="volunteer-back" href="' + (isDonate ? '#donation' : '#volunteer-opportunities') + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg> Back</a>';
        var side;
        if (isDonate) {
            side = '<aside class="donate-card">' +
                '<div class="raised-row"><div class="donut" style="--pct: ' + percent + ';"><span>' + percent + '%</span></div>' +
                '<div><h2>\u20b1' + raised.toLocaleString() + '</h2><p>raised' + (goal ? ' of \u20b1' + goal.toLocaleString() + ' needed' : '') + '</p></div></div>' +
                '<label for="' + toggleId + '" class="btn-pill btn-primary">Donate Now</label>' +
                '<input type="button" value="Share" class="btn-pill btn-secondary">' +
                '<h3 class="recent-title">Recent Donors</h3>' +
                '<ul class="recent-list">' + donors.slice(0, 4).map(function (donation) {
                    return '<li><div class="avatar sm"></div><span>' + esc(donation.name) + '</span><strong>\u20b1' + Number(donation.amount || 0).toLocaleString() + '</strong></li>';
                }).join('') + (donors.length ? '' : '<li><span>Be the first to give</span></li>') + '</ul>' +
                '</aside>';
        } else {
            side = '<aside class="donate-card">' +
                '<div class="volunteer-side-meta">' +
                '<div class="volunteer-side-row"><span class="volunteer-side-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg></span><span>' + esc(when || 'Community event') + '</span></div>' +
                '<div class="volunteer-side-row"><span class="volunteer-side-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg></span><span>Agapay Volunteer</span></div>' +
                '</div>' +
                '<label for="' + toggleId + '" class="btn-pill btn-primary">Register Now</label>' +
                '<input type="button" value="Share" class="btn-pill btn-secondary">' +
                '<div class="volunteer-divider"></div>' +
                '</aside>';
        }
        var modalForm;
        if (isDonate) {
            modalForm = '<div class="donate-modal">' +
                '<label for="' + toggleId + '" class="modal-backdrop"></label>' +
                '<form class="modal-box donate-form">' +
                '<label for="' + toggleId + '" class="modal-close">\u00d7</label>' +
                '<div class="form-body">' +
                '<h2>Make a Donation</h2><p class="modal-sub">Send your donation first, then confirm it below.</p>' +
                '<p class="modal-label">1. Which app did you use?</p>' +
                '<div class="pill-options">' +
                '<label><input type="radio" name="method" value="GCash" checked><span>GCash</span></label>' +
                '<label><input type="radio" name="method" value="Maya"><span>Maya</span></label>' +
                '<label><input type="radio" name="method" value="Bank Transfer"><span>Bank</span></label>' +
                '<label><input type="radio" name="method" value="Other"><span>Other</span></label>' +
                '</div>' +
                '<div class="send-box"><div class="qr">QR</div><div><strong>Send your donation to:</strong><p class="send for-gcash">Agapay Foundation<br>0900 000 0000</p><p class="send for-maya">Agapay Foundation<br>0900 000 0000</p><p class="send for-bank">Agapay Foundation<br>Bank name \u00b7 0000 0000 00</p><p class="send for-other">Contact us for other ways to give</p></div></div>' +
                '<p class="modal-label">2. Amount you sent</p>' +
                '<div class="pill-options">' +
                '<label><input type="radio" name="amount" value="100"><span>\u20b1100</span></label>' +
                '<label><input type="radio" name="amount" value="500" checked><span>\u20b1500</span></label>' +
                '<label><input type="radio" name="amount" value="1000"><span>\u20b11,000</span></label>' +
                '<label><input type="radio" name="amount" value="5000"><span>\u20b15,000</span></label>' +
                '</div>' +
                '<input class="plain-input" type="number" name="custom" min="1" placeholder="Other amount (\u20b1) \u2014 leave blank to use the one above">' +
                '<label class="field"><span>3. Reference number</span><input type="text" name="ref" required minlength="6" placeholder="e.g. 1234 567 890123" autocomplete="off"></label>' +
                '<div class="field-row"><label class="field"><span>Full name</span><input type="text" name="name" required placeholder="Juan Dela Cruz"></label><label class="field"><span>Email</span><input type="email" name="email" required placeholder="you@email.com"></label></div>' +
                '<label class="field"><span>Message (optional)</span><textarea name="message" rows="2" placeholder="Words of encouragement for the student"></textarea></label>' +
                '<label class="check"><input type="checkbox" name="anonymous"> Donate anonymously</label>' +
                '<button type="submit" class="btn-pill btn-primary">Confirm donation</button>' +
                '</div></form></div>';
        } else {
            modalForm = '<div class="donate-modal">' +
                '<label for="' + toggleId + '" class="modal-backdrop"></label>' +
                '<form class="modal-box" action="#volunteer-opportunities">' +
                '<label for="' + toggleId + '" class="modal-close">\u00d7</label>' +
                '<div class="form-body">' +
                '<h2>Register for ' + esc(post.title) + '</h2>' +
                '<p class="modal-sub">Fill out the form and our team will reach out with next steps.</p>' +
                '<label class="field"><span>Full name</span><input type="text" name="name" required placeholder="Juan Dela Cruz"></label>' +
                '<div class="field-row"><label class="field"><span>Email</span><input type="email" name="email" required placeholder="you@email.com"></label><label class="field"><span>Contact number</span><input type="tel" name="phone" required placeholder="09XX XXX XXXX"></label></div>' +
                '<label class="field"><span>Preferred schedule</span><input type="text" name="schedule" value="' + esc(when || 'Community event') + '" readonly></label>' +
                '<label class="field"><span>Why do you want to join? (optional)</span><textarea name="reason" rows="2" placeholder="Tell us a little about your interest"></textarea></label>' +
                '<label class="check"><input type="checkbox" required> I agree to the Agapay volunteer guidelines.</label>' +
                '<button type="submit" class="btn-pill btn-primary">Submit registration</button>' +
                '</div></form></div>';
        }
        page.innerHTML = '<input type="checkbox" id="' + toggleId + '" class="' + (isDonate ? 'donate-toggle' : 'register-toggle') + '" hidden>' +
            '<div class="wrap">' +
            backLink +
            '<h1 class="detail-title">' + esc(post.title) + '</h1>' +
            (isDonate ? '<div class="detail-meta"><span>\ud83d\udccd Community donation drive</span><span>\ud83c\udf3f Agapay</span></div>' : '') +
            '<div class="detail-layout">' +
            '<section class="detail-main">' +
            '<img class="story-img" src="' + esc(image) + '" alt="' + esc(post.title) + '">' +
            '<div class="story-text">' + storyText + '</div>' +
            '<div class="organizer-card"><img class="avatar lg" src="assets/Agapay Logo.png" alt="Agapay logo"><div><strong>' + (isDonate ? 'Agapay Foundation' : 'Agapay Volunteer Program') + '</strong><span>' + (isDonate ? 'Campaign organizer' : 'Program organizer') + '</span></div></div>' +
            '</section>' +
            side +
            '</div></div>' +
            modalForm;
    }
    function applyCommunityPost(root, post, data) {
        var existing = root.querySelector('[data-community-post="' + post.id + '"]');
        if (existing) { existing.remove(); }
        if (post.status !== 'Published') { removeCommunityModal(root, post); return; }
        var grid = communityGrid(root, post);
        if (!grid) { return; }
        var modalId = communityModalId(post);
        var when = formatPostDate(post.date);
        var card = root.createElement('article');
        card.setAttribute('data-community-post', post.id);
        var inner;
        var isDonate = post.type === 'Donate';
        var isVolunteer = post.type === 'Volunteer';
        var isDetail = isDonate || isVolunteer;
        var targetId = isDetail ? communityDetailId(post) : modalId;
        if (isDonate) {
            var goal = Number(post.targetAmount) || 0;
            var raised = verifiedRaised(data, post);
            var percent = goal ? Math.min(100, Math.round(raised / goal * 100)) : 0;
            card.className = 'campaign-card';
            inner = (post.image ? '<a href="#' + esc(targetId) + '" aria-label="' + esc(post.title) + '"><img class="card-img" src="' + esc(post.image) + '" alt="' + esc(post.title) + '"></a>' : '') +
                '<div class="card-body">' +
                '<span class="card-tag">DONATION DRIVE</span>' +
                '<h3 class="card-title">' + esc(post.title) + '</h3>' +
                '<p class="card-desc">' + esc(post.story) + '</p>' +
                (goal ? '<div class="progress" role="progressbar" aria-valuenow="' + percent + '" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" style="width: ' + percent + '%;"></div></div>' +
                '<div class="card-meta"><span>\u20b1' + raised.toLocaleString() + ' raised</span><span>\u20b1' + goal.toLocaleString() + ' goal</span></div>' : '') +
                '</div>';
        } else if (isVolunteer) {
            card.className = 'opportunity-card';
            inner = (post.image ? '<a href="#' + esc(targetId) + '" aria-label="' + esc(post.title) + '"><img src="' + esc(post.image) + '" alt="' + esc(post.title) + '"></a>' : '') +
                '<div class="opportunity-card-body">' +
                '<span class="opportunity-tag">' + esc(when || 'Community event') + '</span>' +
                '<h3><a href="#' + esc(targetId) + '">' + esc(post.title) + '</a></h3>' +
                '<p>' + esc(post.story) + '</p>' +
                (when ? '<div class="opportunity-meta"><span>' + esc(when) + '</span></div>' : '') +
                '<a href="#' + esc(targetId) + '">View opportunity \u2192</a></div>';
        } else {
            card.className = 'awareness-card';
            var isResource = post.type === 'Educational Resources';
            var imageArea = isResource ? '<div class="awareness-img-wrap">' + (post.image ? '<img src="' + esc(post.image) + '" alt="' + esc(post.title) + '" class="awareness-img">' : '<div class="awareness-img-placeholder" aria-hidden="true"></div>') + '<span class="awareness-badge">' + esc(post.resourceLabel || 'Resource') + '</span></div>' : (post.image ? '<div class="awareness-img-wrap"><img src="' + esc(post.image) + '" alt="' + esc(post.title) + '" class="awareness-img"><span class="awareness-badge">' + esc(post.type) + '</span></div>' : '');
            inner = imageArea +
                '<div class="awareness-body-content">' +
                (when ? '<p class="awareness-date">' + esc(when) + '</p>' : '') +
                '<h3 class="awareness-card-title">' + esc(post.title) + '</h3>' +
                '<p class="awareness-excerpt">' + esc(post.story) + '</p>' +
                (post.type === 'Educational Resources' ? '<a href="#" class="awareness-link">Download PDF \u2192</a>' : '<a href="javascript:void(0);" data-community-open="' + esc(modalId) + '" class="awareness-link">Read more \u2192</a>') + '</div>';
        }
        card.innerHTML = inner;
        grid.appendChild(card);
        if (isDetail) {
            removeCommunityModal(root, post);
            syncCommunityDetailPage(root, post, data);
        } else {
            removeCommunityDetailPage(root, post);
            if (post.type !== 'Educational Resources') { syncCommunityModal(root, post, data); }
            card.querySelectorAll('[data-community-open]').forEach(function (opener) {
                opener.addEventListener('click', function () {
                    var modal = root.getElementById(opener.getAttribute('data-community-open'));
                    if (modal) { modal.classList.add('active'); }
                });
            });
        }
    }
    function hideOrphanSeedCards(root, liveTitles) {
        var cardSelector = '#news-grid article, #stories-grid article, #blog-grid article, #educational-resources .awareness-grid article, #awareness-campaigns .awareness-grid article, #volunteer-grid article, #donation .campaign-grid article';
        Array.prototype.forEach.call(root.querySelectorAll(cardSelector), function (card) {
            var heading = card.querySelector('h3');
            var title = heading && (heading.getAttribute('data-original-title') || heading.textContent.trim());
            if (title && !liveTitles[title]) {
                card.hidden = true;
                card.style.display = 'none';
            }
        });
        Array.prototype.forEach.call(root.querySelectorAll('main.volunteer-page:not([id^="volunteer-agp-"]), main[id^="campaign-"]:not([id^="campaign-agp-"])'), function (page) {
            var heading = page.querySelector('.detail-title');
            var title = heading && (heading.getAttribute('data-original-title') || heading.textContent.trim());
            if (title && !liveTitles[title]) {
                page.hidden = true;
                page.style.display = 'none';
            }
        });
    }
    function renderPosts() {
        seedContent();
        var root = rootDocument();
        var liveIds = {};
        var liveTitles = {};
        var data = read();
        var posts = data.posts;
        posts.forEach(function (post) {
            liveIds[post.id] = true;
            if (post.sourceTitle) { liveTitles[post.sourceTitle] = true; }
        });
        hideOrphanSeedCards(root, liveTitles);
        Array.prototype.forEach.call(root.querySelectorAll('[data-community-post]'), function (card) {
            if (!liveIds[card.getAttribute('data-community-post')]) { card.remove(); }
        });
        Array.prototype.forEach.call(root.querySelectorAll('[id^="community-article-"]'), function (modal) {
            if (!liveIds[modal.id.replace('community-article-', '')]) { modal.remove(); }
        });

        Array.prototype.forEach.call(root.querySelectorAll('main[id^="campaign-agp-"], main[id^="volunteer-agp-"]'), function (page) {
            if (!liveIds[page.id.replace(/^(campaign|volunteer)-/, '')]) { page.remove(); }
        });
        posts.forEach(function (post) {
            if (post.sourceTitle) { updateExistingPost(root, post); } else { applyCommunityPost(root, post, data); }
        });
    }
    function renderVerifiedDonations() {
        var root = rootDocument();
        var data = read();
        data.posts.filter(function (post) { return post.type === 'Donate'; }).forEach(function (post) {
            var page = Array.prototype.find.call(root.querySelectorAll('main[id^="campaign-"]'), function (entry) {
                return originalTitle(entry.querySelector('.detail-title')) === (post.sourceTitle || post.title);
            });
            if (!page) { return; }
            var verified = data.donations.filter(function (donation) {
                return donation.status === 'Verified' && (donation.campaign === post.title || donation.campaign === post.sourceTitle);
            });
            var total = verified.reduce(function (sum, donation) { return sum + Number(donation.amount || 0); }, 0);
            var summary = page.querySelector('.verified-donation-summary');
            if (!summary) {
                summary = root.createElement('p');
                summary.className = 'verified-donation-summary';
                var story = page.querySelector('.story-text');
                if (story) { story.parentNode.insertBefore(summary, story.nextSibling); }
            }
            if (summary) {
                summary.textContent = total ? 'Verified community donations: ₱' + total.toLocaleString() : '';
                summary.hidden = !total;
            }
            var donorList = page.querySelector('.verified-donor-list');
            if (!donorList) {
                donorList = root.createElement('ul');
                donorList.className = 'verified-donor-list';
                if (summary) { summary.parentNode.insertBefore(donorList, summary.nextSibling); }
            }
            donorList.innerHTML = verified.map(function (donation) {
                return '<li><span>' + esc(donation.name) + '</span><strong>₱' + Number(donation.amount || 0).toLocaleString() + '</strong></li>';
            }).join('');
            donorList.hidden = verified.length === 0;
        });
    }

    function seedPartners() {
        var data = read();
        if (data.partnersSeedVersion >= 1) { return; }
        var root = rootDocument();
        var host = root.querySelector('.info-page .sponsors div');
        if (!host) { return; }
        Array.prototype.forEach.call(host.querySelectorAll('img:not([data-community-partner])'), function (img) {
            var name = img.getAttribute('title') || img.getAttribute('alt') || '';
            if (name && !data.partners.some(function (partner) { return partner.name === name; })) {
                data.partners.push({ id: id(), name: name, image: img.getAttribute('src') });
            }
            img.hidden = true;
        });
        data.partnersSeedVersion = 1;
        write(data);
    }
    function renderPartners() {
        seedPartners();
        var root = rootDocument();
        var host = root.querySelector('.info-page .sponsors div');
        if (!host) { return; }
        var data = read();

        Array.prototype.forEach.call(host.querySelectorAll('img:not([data-community-partner])'), function (img) {
            img.hidden = true;
            img.style.display = 'none';
        });
        Array.prototype.forEach.call(host.querySelectorAll('[data-community-partner]'), function (img) { img.remove(); });
        data.partners.forEach(function (partner) {
            if (!partner.name) { return; }
            if (partner.image) {
                var img = root.createElement('img');
                img.setAttribute('data-community-partner', partner.id);
                img.src = partner.image;
                img.alt = partner.name + ' Logo';
                img.title = partner.name;
                host.appendChild(img);
            } else {
                var placeholder = root.createElement('div');
                placeholder.className = 'partner-placeholder';
                placeholder.setAttribute('data-community-partner', partner.id);
                placeholder.title = partner.name;
                placeholder.textContent = (partner.name || '?').charAt(0).toUpperCase();
                host.appendChild(placeholder);
            }
        });
    }

    function seedMentors() {
        var data = read();
        if (data.mentorsSeedVersion >= 1) { return; }
        var root = rootDocument();
        var host = root.querySelector('.mentors');
        if (!host) { return; }
        Array.prototype.forEach.call(host.querySelectorAll('article.mentor:not([data-community-mentor])'), function (article) {
            var name = article.querySelector('h3');
            var image = article.querySelector('img');
            var description = article.querySelector('p');
            var mentorName = name ? name.textContent.trim() : '';
            if (!mentorName) { return; }
            if (!data.mentors.some(function (mentor) { return mentor.name === mentorName; })) {
                data.mentors.push({ id: id(), name: mentorName, image: image ? image.getAttribute('src') : '', description: description ? description.textContent.trim() : '', status: 'Published' });
            }
        });
        data.mentorsSeedVersion = 1;
        write(data);
    }
    function mentorCard(root, host, key, name, image, description) {
        var card = root.createElement('article');
        card.className = 'mentor';
        card.setAttribute('data-community-mentor', key);
        card.innerHTML = (image ? '<img src="' + esc(image) + '" alt="A picture of ' + esc(name) + '">' : '') +
            '<h3>' + esc(name) + '</h3><p>' + esc(description || 'Agapay mentor') + '</p>';
        host.appendChild(card);
    }
    function renderMentors() {
        seedMentors();
        var root = rootDocument();
        var host = root.querySelector('.mentors');
        if (!host) { return; }
        var data = read();

        Array.prototype.forEach.call(host.querySelectorAll('article.mentor:not([data-community-mentor])'), function (article) {
            article.hidden = true;
            article.style.display = 'none';
        });
        Array.prototype.forEach.call(host.querySelectorAll('[data-community-mentor]'), function (item) { item.remove(); });
        (data.mentors || []).forEach(function (mentor) {
            if (!mentor.name || mentor.status === 'Hidden') { return; }
            mentorCard(root, host, mentor.id, mentor.name, mentor.image, mentor.description);
        });
        data.mentorApplications.filter(function (mentor) { return mentor.status === 'Accepted'; }).forEach(function (mentor) {
            mentorCard(root, host, mentor.id, mentor.name, mentor.image, mentor.expertise || 'Agapay mentor');
        });
    }
    function submitForm(event) {
        var form = event.target;
        var data = read();
        if (form.matches('.donate-form')) {
            event.preventDefault();
            var donation = new FormData(form);
            data.donations.unshift({ id: id(), name: donation.get('anonymous') ? 'Anonymous' : donation.get('name'), email: donation.get('email'), campaign: form.closest('main') && form.closest('main').querySelector('.detail-title') ? form.closest('main').querySelector('.detail-title').textContent : 'Community donation', date: new Date().toLocaleDateString(), method: donation.get('method'), reference: donation.get('ref'), amount: Number(donation.get('custom') || donation.get('amount')), message: donation.get('message'), status: 'Pending' });
            write(data);
            form.reset();
            var modal = form.closest('.donate-modal');
            if (modal) { modal.style.display = 'none'; }
            alert('Thank you. Your donation is pending admin verification.');
            return;
        }
        if (form.closest('.volunteer-page')) {
            event.preventDefault();
            var volunteer = new FormData(form);
            var page = form.closest('.volunteer-page');
            var title = page.querySelector('.detail-title, h1, h2');
            data.applications.unshift({ id: id(), name: volunteer.get('name'), email: volunteer.get('email'), phone: volunteer.get('phone'), schedule: volunteer.get('schedule'), reason: volunteer.get('reason'), event: title ? title.textContent.replace(/^Register for\s*/, '') : 'Volunteer event', date: new Date().toLocaleDateString(), status: 'Pending' });
            write(data);
            form.reset();
            alert('Your event registration is sent for admin review.');
            return;
        }
        if (form.closest('#mentor-application')) {
            event.preventDefault();
            var mentor = new FormData(form);
            var expertise = mentor.getAll('expertise');
            if (mentor.get('expertise-other')) { expertise.push(mentor.get('expertise-other')); }
            var imageFile = mentor.get('professional-image');
            if (imageFile && imageFile.size) {
                if (!/^image\/(png|jpeg)$/.test(imageFile.type) || imageFile.size > 1500000) {
                    alert('Choose a PNG, JPG, or JPEG image smaller than 1.5 MB.');
                    return;
                }
            }
            function saveMentorApplication(image) {
                data.mentorApplications.unshift({ id: id(), name: mentor.get('name'), email: mentor.get('email'), availability: mentor.get('availability'), hours: mentor.get('hours'), expertise: expertise.join(', '), experience: mentor.get('experience'), tutoring: mentor.get('tutoring'), message: mentor.get('message'), image: image, date: new Date().toLocaleDateString(), status: 'Pending' });
                write(data);
                form.reset();
                alert('Your mentor application has been sent for admin review.');
            }
            if (imageFile && imageFile.size) {
                var reader = new FileReader();
                reader.onload = function () { saveMentorApplication(reader.result); };
                reader.onerror = function () { alert('The image could not be read. Please choose another file.'); };
                reader.readAsDataURL(imageFile);
            } else {
                saveMentorApplication('');
            }
            return;
        }
        if (form.closest('#student-requests')) {
            event.preventDefault();
            var request = new FormData(form);
            data.helpRequests.unshift({ id: id(), name: request.get('name'), requester: request.get('requester'), email: request.get('email'), helpType: request.get('help-type'), amount: request.get('amount'), message: request.get('message'), date: new Date().toLocaleDateString() });
            write(data);
            form.reset();
            alert('Your request has been sent to the Agapay team.');
        }
    }

    document.addEventListener('submit', submitForm);

    document.addEventListener('click', function (event) {
        var closer = event.target.closest && event.target.closest('.article-modal-close');
        if (!closer) { return; }
        var modal = closer.closest('.article-modal');
        if (modal) { modal.classList.remove('active'); }
    });

    document.addEventListener('click', function (event) {
        var opener = event.target.closest && event.target.closest('[data-community-open]');
        if (!opener) { return; }
        var modal = document.getElementById(opener.getAttribute('data-community-open'));
        if (modal && !modal.classList.contains('active')) { modal.classList.add('active'); }
    });

    document.addEventListener('click', function (event) {
        var link = event.target.closest && event.target.closest('a[onclick*="article-"]');
        if (!link) { return; }
        var match = (link.getAttribute('onclick') || '').match(/getElementById\('([^']+)'\)/);
        var modal = match && document.getElementById(match[1]);
        if (modal && !modal.classList.contains('active')) { modal.classList.add('active'); }
    });
    document.addEventListener('DOMContentLoaded', function () {
        renderPosts();
        renderVerifiedDonations();
        renderMentors();
        renderPartners();
    });
    window.addEventListener('storage', function () {
        renderPosts();
        renderVerifiedDonations();
        renderMentors();
        renderPartners();
    });
    window.addEventListener('agapay-data-change', function () {
        renderPosts();
        renderVerifiedDonations();
        renderMentors();
        renderPartners();
    });
})();
