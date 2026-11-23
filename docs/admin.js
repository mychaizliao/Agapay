(function () {
    'use strict';

    var session;
    try { session = JSON.parse(sessionStorage.getItem('agapaySession')); } catch (e) {}
    if (!session || session.role !== 'admin') {
        document.documentElement.hidden = true;
        (window.top || window).location.replace('index.html#login');
        return;
    }

    var store = window.AgapayStore;
    var esc = window.agapayEscape;
    var contentQuery = '';
    var contentFilter = 'All';

    function get() { return store.read(); }
    function importEducationalResourceCards(data) {
        if (data.educationalResourceCardsImported) { return; }
        var publicDocument = document;
        try {
            if (window.parent && window.parent.document) { publicDocument = window.parent.document; }
        } catch (e) {}
        var grid = publicDocument.querySelector('#educational-resources .awareness-grid');
        if (!grid) { return; }
        Array.prototype.forEach.call(grid.querySelectorAll('article.awareness-card'), function (card) {
            var heading = card.querySelector('h3');
            var title = heading ? heading.textContent.trim() : '';
            if (!title) { return; }
            var existing = data.posts.find(function (post) {
                return post.type === 'Educational Resources' && (post.sourceTitle === title || (!post.sourceTitle && post.title === title));
            });
            var badge = card.querySelector('.awareness-badge');
            if (existing) {
                existing.sourceTitle = existing.sourceTitle || title;
                existing.sourceKind = 'educational-resource';
                existing.resourceLabel = existing.resourceLabel || (badge ? badge.textContent.trim() : 'Resource');
                return;
            }
            var excerpt = card.querySelector('.awareness-excerpt');
            var date = card.querySelector('.awareness-date');
            var image = card.querySelector('img');
            data.posts.push({
                id: store.id(),
                type: 'Educational Resources',
                sourceKind: 'educational-resource',
                sourceTitle: title,
                title: title,
                story: excerpt ? excerpt.textContent.trim() : '',
                fullStory: excerpt ? excerpt.textContent.trim() : '',
                image: image ? image.getAttribute('src') : '',
                date: date ? date.textContent.trim() : '',
                resourceLabel: badge ? badge.textContent.trim() : 'Resource',
                status: 'Published'
            });
        });
        data.educationalResourceCardsImported = true;
        store.silentWrite(data);
    }
    function showSaved() {
        var notice = document.querySelector('.admin-save-notice');
        if (!notice) {
            notice = document.createElement('div');
            notice.className = 'admin-save-notice';
            notice.setAttribute('role', 'status');
            document.body.appendChild(notice);
        }
        notice.textContent = 'Changes saved';
        notice.classList.add('is-visible');
        clearTimeout(showSaved.timer);
        showSaved.timer = setTimeout(function () { notice.classList.remove('is-visible'); }, 2600);
    }
    function commit(data) { store.write(data); render(); showSaved(); }
    function field(name, value, placeholder) {
        return '<input data-field="' + name + '" value="' + esc(value) + '" placeholder="' + (placeholder || '') + '">';
    }
    function storyField(name, value, placeholder) {
        return '<textarea data-field="' + name + '" rows="3" placeholder="' + (placeholder || '') + '">' + esc(value) + '</textarea>';
    }
    function contentStoryField(value) {
        return '<textarea data-field="fullStory" rows="3" placeholder="Full story">' + esc(value) + '</textarea>';
    }
    function imagePicker(value) {
        return '<div class="image-picker">' +
            '<input type="hidden" data-field="image" value="' + esc(value) + '">' +
            '<label class="image-upload-control"><span class="image-upload-label">Choose image</span><input type="file" data-image-upload accept="image/png,image/jpeg,image/webp,image/gif"></label>' +
            '<span class="image-upload-note">PNG, JPG, WEBP, or GIF · up to 1.5 MB</span>' +
            (value ? '<img class="admin-thumb" src="' + esc(value) + '" alt="Selected image">' : '<div class="admin-thumb image-empty">No image selected</div>') +
            '</div>';
    }
    function publishSelect(item) {
        return '<select data-post-status="' + esc(item.id) + '"><option value="Published" ' + (item.status === 'Published' ? 'selected' : '') + '>Public</option><option value="Draft" ' + (item.status === 'Draft' ? 'selected' : '') + '>Hidden</option></select>';
    }
    function contentTypeSelect(value) {
        return '<select data-field="type"><option ' + (value === 'News' ? 'selected' : '') + '>News</option><option ' + (value === 'Blog' ? 'selected' : '') + '>Blog</option><option ' + (value === 'Success Story' ? 'selected' : '') + '>Success Story</option><option ' + (value === 'Educational Resources' ? 'selected' : '') + '>Educational Resources</option><option ' + (value === 'Awareness Campaign' ? 'selected' : '') + '>Awareness Campaign</option><option ' + (value === 'Volunteer' ? 'selected' : '') + '>Volunteer</option><option ' + (value === 'Donate' ? 'selected' : '') + '>Donate</option></select>';
    }
    function toDateInputValue(value) {
        var text = String(value || '');
        var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
        if (match) { return text; }
        var parsed = new Date(text);
        if (!isNaN(parsed.getTime())) {
            var month = parsed.getMonth() + 1;
            var day = parsed.getDate();
            return parsed.getFullYear() + '-' + (month < 10 ? '0' + month : month) + '-' + (day < 10 ? '0' + day : day);
        }
        return '';
    }
    function dateField(post) {
        if (post.type === 'Educational Resources') {
            return '<input type="text" data-field="date" value="' + esc(post.date || '') + '" placeholder="e.g. PDF · Ages 5–7" aria-label="Resource format or audience">';
        }
        return '<input type="date" data-field="date" value="' + toDateInputValue(post.date) + '" aria-label="When this post or event happens">';
    }
    function goalField(post) {
        var disabled = post.type === 'Donate' ? '' : ' disabled';
        return '<input type="number" min="0" step="any" data-field="targetAmount"' + disabled + ' value="' + esc(post.targetAmount || '') + '" placeholder="Donate only" aria-label="Donation goal in pesos">';
    }

    function render() {
        var data = get();
        importEducationalResourceCards(data);
        renderCurrentMentors(data);
        renderDonations(data);
        renderContent(data);
        renderHelpRequests(data);
        renderPartners(data);
        renderOverview(data);
    }

    function trashButton(action, label) {
        return '<button type="button" data-delete-' + action + ' class="trash-button" aria-label="' + label + '" title="' + label + '"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>';
    }
    function renderCurrentMentors(data) {
        var host = document.getElementById('mentors-table');
        if (!host) { return; }
        var rows = (data.mentors || []).map(function (mentor) {
            var status = mentor.status === 'Hidden' ? 'Hidden' : 'Published';
            return '<tr data-kind="published-mentor" data-id="' + esc(mentor.id) + '">' +
                '<td><input data-field="name" value="' + esc(mentor.name) + '"><span class="table-secondary">On the public mentor list</span></td>' +
                '<td>' + imagePicker(mentor.image) + '</td>' +
                '<td>' + storyField('description', mentor.description, 'Short description shown on the public card') + '</td>' +
                '<td class="mentor-answer">\u2014</td>' +
                '<td class="mentor-answer">\u2014</td>' +
                '<td class="mentor-answer">\u2014</td>' +
                '<td><select data-mentor-decision="' + esc(mentor.id) + '" data-decision-kind="builtin"><option value="Published" ' + (status === 'Published' ? 'selected' : '') + '>Accepted</option><option value="Hidden" ' + (status === 'Hidden' ? 'selected' : '') + '>Not accepted</option></select></td>' +
                '<td><button type="button" data-save-row>Save</button> ' + trashButton('mentor', 'Delete mentor') + '</td></tr>';
        });
        data.mentorApplications.forEach(function (application) {
            var accepted = application.status === 'Accepted';
            rows.push('<tr data-kind="mentor" data-id="' + esc(application.id) + '">' +
                '<td><input data-field="name" value="' + esc(application.name) + '"><span class="table-secondary">' + esc(application.email) + '</span></td>' +
                '<td>' + imagePicker(application.image) + '</td>' +
                '<td>' + storyField('expertise', application.expertise, 'Short description shown on the public card') + '</td>' +
                '<td class="mentor-answer">' + esc(application.experience || '\u2014') + '</td>' +
                '<td class="mentor-answer">' + esc(application.tutoring || '\u2014') + '</td>' +
                '<td class="mentor-answer">' + esc(application.message || '\u2014') + '</td>' +
                '<td><select data-mentor-decision="' + esc(application.id) + '" data-decision-kind="application"><option value="Accepted" ' + (accepted ? 'selected' : '') + '>Accepted</option><option value="Pending" ' + (!accepted ? 'selected' : '') + '>Not accepted</option></select></td>' +
                '<td><button type="button" data-save-row>Save</button> ' + trashButton('mentor', 'Delete permanently') + '</td></tr>');
        });
        host.innerHTML = '<div class="panel-heading panel-heading-simple"><div><p class="eyebrow">PUBLIC MENTOR LIST</p></div><span class="record-count">' + rows.length + (rows.length === 1 ? ' mentor' : ' mentors') + '</span><button type="button" class="secondary-button" data-new-mentor>+ New mentor</button></div>' +
            '<div class="table-scroll"><table class="editable-table"><thead><tr><th>Name</th><th>Photo</th><th>Short description</th><th>Relevant experience</th><th>Teaching / tutoring background</th><th>Why they want to be a mentor</th><th>Decision</th><th>Action</th></tr></thead><tbody>' +
            (rows.length ? rows.join('') : '<tr><td colspan="8">No mentors yet. Use the + New mentor button above.</td></tr>') +
            '</tbody></table></div>';
    }

    function renderDonations(data) {
        var host = document.getElementById('donation-records-table');
        if (!host) { return; }
        host.innerHTML = '<div class="panel-heading"><div><p class="eyebrow">CONTRIBUTIONS</p></div><span class="record-count">' + data.donations.length + ' records</span></div>' +
            '<div class="table-scroll"><table><thead><tr><th>Donor</th><th>Campaign</th><th>Date</th><th>Method</th><th>Reference</th><th>Amount</th><th>Review</th></tr></thead><tbody>' +
            (data.donations.length ? data.donations.map(function (donation) {
                return '<tr><td>' + esc(donation.name) + '<span class="table-secondary">' + esc(donation.email) + '</span></td><td>' + esc(donation.campaign) + '</td><td>' + esc(donation.date) + '</td><td>' + esc(donation.method) + '</td><td>' + esc(donation.reference) + '</td><td>₱' + Number(donation.amount || 0).toLocaleString() + '</td><td><select data-donation-status="' + esc(donation.id) + '"><option ' + (donation.status === 'Pending' ? 'selected' : '') + '>Pending</option><option ' + (donation.status === 'Verified' ? 'selected' : '') + '>Verified</option><option ' + (donation.status === 'Rejected' ? 'selected' : '') + '>Rejected</option></select></td></tr>';
            }).join('') : '<tr><td colspan="7">No donations submitted yet.</td></tr>') +
            '</tbody></table></div>';
    }

    function contentRow(post) {
        return '<tr data-kind="post" data-id="' + esc(post.id) + '">' +
            '<td>' + contentTypeSelect(post.type) + '</td>' +
            '<td>' + field('title', post.title, 'Title') + '</td>' +
            '<td>' + storyField('story', post.story, 'Public card excerpt') + '</td>' +
            '<td>' + contentStoryField(post.fullStory || post.story) + '</td>' +
            '<td>' + field('resourceLabel', post.resourceLabel || '', 'Resource label (e.g. Worksheet)') + '</td>' +
            '<td>' + imagePicker(post.image) + '</td>' +
            '<td>' + dateField(post) + '</td>' +
            '<td>' + goalField(post) + '</td>' +
            '<td>' + publishSelect(post) + '</td>' +
            '<td><button type="button" data-save-row>Save</button> ' + trashButton('post', 'Delete post') + '</td></tr>';
    }

    function trashButton(action, label) {
        return '<button type="button" data-delete-' + action + '="" class="trash-button" aria-label="' + label + '" title="' + label + '"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>';
    }
    function renderPartners(data) {
        var host = document.getElementById('partner-admin-app');
        if (!host) { return; }
        var list = data.partners || [];
        var total = document.getElementById('partner-total-count');
        if (total) { total.textContent = list.length + (list.length === 1 ? ' partner' : ' partners'); }
        host.innerHTML = '<div class="panel-heading panel-heading-simple"><div><p class="eyebrow">SPONSORS</p></div><span class="record-count">' + list.length + (list.length === 1 ? ' partner' : ' partners') + '</span><button type="button" class="secondary-button" data-new-partner>+ Add partner</button></div>' +
            '<div class="table-scroll"><table class="editable-table"><thead><tr><th>Organization</th><th>Logo</th><th>Action</th></tr></thead><tbody>' +
            (list.length ? list.map(function (partner) {
                return '<tr data-kind="partner" data-id="' + esc(partner.id) + '">' +
                    '<td>' + field('name', partner.name, 'Organization name') + '</td>' +
                    '<td>' + imagePicker(partner.image) + '</td>' +
                    '<td><button type="button" data-save-row>Save</button> ' + trashButton('partner', 'Delete partner') + '</td></tr>';
            }).join('') : '<tr><td colspan="3">No partners added yet.</td></tr>') +
            '</tbody></table></div>';
    }

    function renderContent(data) {
        var host = document.getElementById('content-admin-app');
        if (!host) { return; }
        var query = contentQuery.trim().toLowerCase();
        var posts = data.posts.filter(function (post) {
            var matchesType = contentFilter === 'All' || post.type === contentFilter;
            var searchable = [post.title, post.story, post.fullStory, post.resourceLabel].join(' ').toLowerCase();
            return matchesType && (!query || searchable.indexOf(query) !== -1);
        });
        host.innerHTML = '<div class="content-tools"><label class="content-search"><span>Search content</span><input type="search" data-content-search value="' + esc(contentQuery) + '" placeholder="Search title or story"></label><label class="content-filter"><span>Filter by type</span><select data-content-filter><option ' + (contentFilter === 'All' ? 'selected' : '') + '>All</option><option ' + (contentFilter === 'News' ? 'selected' : '') + '>News</option><option ' + (contentFilter === 'Blog' ? 'selected' : '') + '>Blog</option><option ' + (contentFilter === 'Success Story' ? 'selected' : '') + '>Success Story</option><option ' + (contentFilter === 'Educational Resources' ? 'selected' : '') + '>Educational Resources</option><option ' + (contentFilter === 'Awareness Campaign' ? 'selected' : '') + '>Awareness Campaign</option><option ' + (contentFilter === 'Volunteer' ? 'selected' : '') + '>Volunteer</option><option ' + (contentFilter === 'Donate' ? 'selected' : '') + '>Donate</option></select></label></div>' +
            '<div class="panel-heading"><div><p class="eyebrow">CONTENT</p></div><span class="record-count">' + posts.length + ' of ' + data.posts.length + ' posts</span><button type="button" class="secondary-button" data-new-post>+ New post</button></div>' +
            '<div class="table-scroll"><table class="editable-table"><thead><tr><th>Post type</th><th>Title</th><th>Card excerpt</th><th>Full story</th><th>Resource label</th><th>Image</th><th>Date / resource info</th><th>Goal \u20b1</th><th>Public</th><th>Action</th></tr></thead><tbody>' +
            posts.map(contentRow).join('') +
            '</tbody></table></div>';
    }

    function renderHelpRequests(data) {
        var host = document.getElementById('help-requests-table');
        if (!host) { return; }
        host.innerHTML = '<div class="panel-heading"><div><p class="eyebrow">COMMUNITY HELP REQUESTS</p><h2>Requests submitted by users</h2></div><span class="record-count">' + data.helpRequests.length + ' requests</span></div>' +
            '<p class="table-note">Creating a Donate post from a request adds the post to Content and automatically removes the request from this list.</p>' +
            '<div class="table-scroll"><table><thead><tr><th>Requester</th><th>Help needed</th><th>Request</th><th>Submitted</th><th>Content action</th></tr></thead><tbody>' +
            (data.helpRequests.length ? data.helpRequests.map(function (request) {
                return '<tr><td>' + esc(request.name) + '<span class="table-secondary">' + esc(request.email) + '</span></td><td>' + esc(request.helpType) + '<span class="table-secondary">' + esc(request.amount || '') + '</span></td><td>' + esc(request.message) + '</td><td>' + esc(request.date) + '</td><td><button type="button" data-create-donate-post="' + esc(request.id) + '">Create Donate post</button></td></tr>';
            }).join('') : '<tr><td colspan="5">No help requests submitted yet.</td></tr>') +
            '</tbody></table></div>';
    }

    function renderOverview(data) {
        var metrics = document.querySelectorAll('#overview .metric');
        if (metrics.length < 4) { return; }
        metrics[0].querySelector('strong').textContent = data.mentorApplications.filter(function (mentor) { return mentor.status === 'Pending'; }).length;
        metrics[0].querySelector('.metric-top span').textContent = 'Mentor applications';
        metrics[0].querySelector('small').textContent = 'Awaiting mentor review';
        metrics[1].querySelector('strong').textContent = (data.partners || []).length;
        metrics[1].querySelector('small').textContent = 'Company sponsors';
        metrics[2].querySelector('strong').textContent = data.donations.filter(function (donation) { return donation.status === 'Pending'; }).length;
        metrics[2].querySelector('small').textContent = 'Awaiting verification';
        metrics[3].querySelector('strong').textContent = '₱' + data.donations.filter(function (donation) { return donation.status === 'Verified'; }).reduce(function (sum, donation) { return sum + Number(donation.amount || 0); }, 0).toLocaleString();
        metrics[3].querySelector('small').textContent = 'Verified contributions';
    }

    function rowValues(row) {
        var values = {};
        row.querySelectorAll('[data-field]').forEach(function (element) {
            if (!element.disabled) { values[element.dataset.field] = element.value; }
        });
        return values;
    }
    function updateStatus(data, list, id, status) {
        var item = data[list].find(function (entry) { return entry.id === id; });
        if (item) { item.status = status; commit(data); }
    }

    document.addEventListener('click', function (event) {
        var button = event.target.closest('button');
        if (!button) { return; }
        var row = button.closest('tr');
        var data = get();

        if (button.hasAttribute('data-save-row')) {
            var values = rowValues(row);
            var collection = row.dataset.kind === 'mentor' ? data.mentorApplications : row.dataset.kind === 'published-mentor' ? data.mentors : row.dataset.kind === 'partner' ? data.partners : data.posts;
            var item = collection.find(function (entry) { return entry.id === row.dataset.id; });
            if (item) {
                var previousType = item.type;
                if (!values.date) { delete values.date; }
                if (values.targetAmount !== undefined) { values.targetAmount = values.targetAmount === '' ? '' : Number(values.targetAmount); }
                Object.keys(values).forEach(function (key) { item[key] = values[key]; });
                if (collection === data.posts && previousType !== item.type && (previousType === 'Educational Resources' || item.type === 'Educational Resources')) {
                    item.sourceTitle = '';
                    item.sourceKind = '';
                    item.modalId = '';
                }
                if (collection === data.posts && item.type !== 'Donate') { item.targetAmount = ''; }
                commit(data);
            }
            return;
        }
        if (button.hasAttribute('data-delete-post')) {
            if (!window.confirm('Delete this post? Its public card will be removed from the site.')) { return; }
            data.posts = data.posts.filter(function (post) { return post.id !== row.dataset.id; });
            commit(data);
            return;
        }
        if (button.hasAttribute('data-delete-partner')) {
            if (!window.confirm('Delete this partner? Its logo will be removed from the About Us page.')) { return; }
            data.partners = data.partners.filter(function (partner) { return partner.id !== row.dataset.id; });
            commit(data);
            return;
        }
        if (button.hasAttribute('data-delete-mentor')) {
            if (row.dataset.kind === 'mentor') {
                if (!window.confirm('Permanently delete this mentor application? This cannot be undone.')) { return; }
                data.mentorApplications = data.mentorApplications.filter(function (entry) { return entry.id !== row.dataset.id; });
                commit(data);
            } else {
                if (!window.confirm('Delete this mentor? They will be removed from the public mentor list.')) { return; }
                data.mentors = data.mentors.filter(function (mentor) { return mentor.id !== row.dataset.id; });
                commit(data);
            }
            return;
        }
        if (button.hasAttribute('data-new-mentor')) {
            data.mentors.unshift({ id: store.id(), name: '', image: '', description: '', status: 'Hidden' });
            commit(data);
            var firstMentor = document.querySelector('#mentors-table tr[data-kind="published-mentor"]');
            var mentorName = firstMentor && firstMentor.querySelector('[data-field="name"]');
            if (mentorName) { mentorName.focus(); }
            return;
        }
        if (button.hasAttribute('data-add-campaign')) {
            var newCampaign = rowValues(row);
            if (!newCampaign.title || !newCampaign.story) { alert('Enter a title and card excerpt first.'); return; }
            var campaignStatus = row.querySelector('[data-field="status"]');
            if (campaignStatus) { newCampaign.status = campaignStatus.value; }
            data.posts.unshift({
                id: store.id(),
                type: 'Donate',
                title: newCampaign.title,
                story: newCampaign.story,
                fullStory: newCampaign.fullStory || newCampaign.story,
                image: newCampaign.image || '',
                targetAmount: newCampaign.targetAmount === '' || newCampaign.targetAmount === undefined ? '' : Number(newCampaign.targetAmount),
                status: newCampaign.status || 'Draft',
                date: new Date().toISOString().slice(0, 10)
            });
            commit(data);
            return;
        }
        if (button.hasAttribute('data-new-partner')) {
            data.partners.unshift({ id: store.id(), name: '', image: '' });
            commit(data);
            var firstPartner = document.querySelector('#partner-admin-app tr[data-kind="partner"]');
            var partnerName = firstPartner && firstPartner.querySelector('[data-field="name"]');
            if (partnerName) { partnerName.focus(); }
            return;
        }
        if (button.hasAttribute('data-new-post')) {
            contentQuery = '';
            var postType = contentFilter === 'All' ? 'News' : contentFilter;
            data.posts.unshift({ id: store.id(), type: postType, title: '', story: '', fullStory: '', image: '', resourceLabel: postType === 'Educational Resources' ? 'Resource' : '', targetAmount: '', status: 'Draft', date: postType === 'Educational Resources' ? 'PDF' : new Date().toISOString().slice(0, 10) });
            commit(data);
            var firstPost = document.querySelector('#content-admin-app tr[data-kind="post"]');
            var postTitle = firstPost && firstPost.querySelector('[data-field="title"]');
            if (postTitle) { postTitle.focus(); }
            return;
        }
        if (button.hasAttribute('data-create-donate-post')) {
            var request = data.helpRequests.find(function (entry) { return entry.id === button.dataset.createDonatePost; });
            if (!request) { return; }
            var postFromRequest = { id: store.id(), type: 'Donate', title: request.name + ': ' + request.helpType, story: request.message, fullStory: request.message + (request.amount ? '\n\nNeeded: ' + request.amount : ''), image: '', status: 'Draft', date: request.date };
            data.helpRequests = data.helpRequests.filter(function (entry) { return entry.id !== request.id; });
            data.posts.unshift(postFromRequest);
            commit(data);
        }
    });

    document.addEventListener('change', function (event) {
        if (event.target.matches('select[data-field="type"]')) {
            var typeRow = event.target.closest('tr');
            var goalInput = typeRow && typeRow.querySelector('[data-field="targetAmount"]');
            if (goalInput) {
                goalInput.disabled = event.target.value !== 'Donate';
                if (goalInput.disabled) { goalInput.value = ''; }
            }
        }
        if (event.target.matches('[data-content-filter]')) {
            contentFilter = event.target.value;
            renderContent(get());
            return;
        }
        if (event.target.matches('[data-image-upload]')) {
            var file = event.target.files && event.target.files[0];
            var imageRow = event.target.closest('tr');
            if (!file || !imageRow) { return; }
            if (file.size > 1500000) { alert('Choose an image smaller than 1.5 MB.'); event.target.value = ''; return; }
            var reader = new FileReader();
            reader.onload = function () {
                var hidden = imageRow.querySelector('[data-field="image"]');
                var preview = imageRow.querySelector('.admin-thumb');
                hidden.value = reader.result;
                if (preview.tagName === 'IMG') { preview.src = reader.result; } else {
                    var image = document.createElement('img');
                    image.className = 'admin-thumb';
                    image.alt = 'Selected image';
                    image.src = reader.result;
                    preview.replaceWith(image);
                }
            };
            reader.readAsDataURL(file);
            return;
        }
        var target = event.target;
        if (target.dataset.mentorDecision) {
            var mentorData = get();
            var mentorItem;
            if (target.dataset.decisionKind === 'application') {
                mentorItem = mentorData.mentorApplications.find(function (entry) { return entry.id === target.dataset.mentorDecision; });
                if (mentorItem) { mentorItem.status = target.value; }
            } else {
                mentorItem = mentorData.mentors.find(function (entry) { return entry.id === target.dataset.mentorDecision; });
                if (mentorItem) { mentorItem.status = target.value; }
            }
            if (mentorItem) { commit(mentorData); }
        }
        if (target.dataset.donationStatus) { updateStatus(get(), 'donations', target.dataset.donationStatus, target.value); }
        if (target.dataset.postStatus) {

            var statusData = get();
            var statusPost = statusData.posts.find(function (entry) { return entry.id === target.dataset.postStatus; });
            if (statusPost) {
                statusPost.status = target.value;
                store.silentWrite(statusData);
                showSaved();
            }
        }
    });

    document.addEventListener('input', function (event) {
        if (event.target.matches('[data-content-search]')) {
            contentQuery = event.target.value;
            renderContent(get());
            var search = document.querySelector('[data-content-search]');
            if (search) {
                search.focus();
                search.setSelectionRange(search.value.length, search.value.length);
            }
        }
    });

    window.addEventListener('storage', render);
    window.addEventListener('agapay-data-change', render);
    render();
})();
