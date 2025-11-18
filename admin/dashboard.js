document.addEventListener('DOMContentLoaded', () => {
  const role = resolveRole();
  applyRoleView(role);
  initTabs(role);
  hydrateOverviewPanel();
});

function resolveRole() {
  const attrRole = (document.body.dataset.role || '').toLowerCase();
  const storedRole = (sessionStorage.getItem('userRole') || '').toLowerCase();
  const globalRole = (window.APP_CONTEXT && window.APP_CONTEXT.role || '').toLowerCase();
  const role = attrRole || storedRole || globalRole;
  return role === 'admin' ? 'admin' : 'user';
}

function applyRoleView(role) {
  const isAdmin = role === 'admin';
  document.body.classList.toggle('admin-view', isAdmin);
  document.body.classList.toggle('user-view', !isAdmin);

  if (!isAdmin) {
    document.querySelectorAll('.tab-button.admin-only').forEach(btn => {
      btn.setAttribute('aria-hidden', 'true');
      btn.setAttribute('tabindex', '-1');
      btn.disabled = true;
    });

    document.querySelectorAll('.tab-content.admin-only').forEach(section => {
      section.setAttribute('hidden', 'hidden');
      section.setAttribute('aria-hidden', 'true');
      section.classList.remove('active');
    });
  }
}

function initTabs(role) {
  const tabButtons = Array.from(document.querySelectorAll('.tab-button'));
  const tabContents = Array.from(document.querySelectorAll('.tab-content'));
  const isAdmin = role === 'admin';

  const activateTab = (tabId) => {
    const target = document.getElementById(tabId);
    if (!target) return;
    if (!isAdmin && target.classList.contains('admin-only')) {
      return; // Guard against manual JS invocation
    }

    tabContents.forEach(content => {
      const isMatch = content === target;
      content.classList.toggle('active', isMatch);
      content.toggleAttribute('hidden', !isMatch);
      content.setAttribute('aria-hidden', isMatch ? 'false' : 'true');
    });

    tabButtons.forEach(btn => {
      const isMatch = btn.dataset.tab === tabId;
      btn.classList.toggle('active', isMatch);
    });
  };

  tabButtons.forEach(btn => {
    const tabId = btn.dataset.tab;
    if (!tabId) return;
    if (!isAdmin && btn.classList.contains('admin-only')) return;

    btn.addEventListener('click', () => activateTab(tabId));
  });

  activateTab('overview');
}

function hydrateOverviewPanel() {
  const totalMailingsEl = document.getElementById('overviewTotalMailings');
  const pendingQuotesEl = document.getElementById('overviewPendingQuotes');
  const upcomingDatesEl = document.getElementById('overviewUpcomingDates');
  if (!totalMailingsEl || !pendingQuotesEl || !upcomingDatesEl) return;

  // Placeholder data until wired to backend
  totalMailingsEl.textContent = '0';
  pendingQuotesEl.textContent = '0';
  upcomingDatesEl.innerHTML = '<li>No upcoming mailings scheduled</li>';
}
