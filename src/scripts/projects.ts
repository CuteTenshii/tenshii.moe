function initFilters() {
  const buttons = document.querySelectorAll<HTMLButtonElement>('.filter-btn');
  const cards = document.querySelectorAll<HTMLAnchorElement>('[data-category]');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      cards.forEach((card) => {
        card.classList.toggle('hidden', filter !== 'all' && card.dataset.category !== filter);
      });
    });
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

async function fetchRepoStats(repoUrl: string) {
  const { host, pathname } = new URL(repoUrl);
  const [owner, name] = pathname.replace(/^\/|\/$|\.git$/g, '').split('/');
  if (!owner || !name) return null;

  // Anything that isn't GitHub is a Forgejo instance: same endpoint shape, different field names.
  const isGithub = host === 'github.com';
  const res = await fetch(isGithub
    ? `https://api.github.com/repos/${owner}/${name}`
    : `https://${host}/api/v1/repos/${owner}/${name}`);
  if (!res.ok) return null;

  const data = await res.json();
  return isGithub
    ? { stars: data.stargazers_count as number, updated: data.pushed_at as string }
    : { stars: data.stars_count as number, updated: data.updated_at as string };
}

async function loadRepoStats() {
  const containers = Array.from(document.querySelectorAll<HTMLDivElement>('[data-repo]'));
  if (!containers.length) return;

  await Promise.all(containers.map(async (el) => {
    try {
      const stats = await fetchRepoStats(el.dataset.repo!);
      if (!stats) return;

      el.querySelector<HTMLSpanElement>('[data-repo-stars]')!.textContent = stats.stars.toLocaleString();
      el.querySelector<HTMLSpanElement>('[data-repo-updated]')!.textContent = formatDate(stats.updated);
      el.classList.remove('hidden');
      el.classList.add('flex');
    } catch {}
  }));
}

function initProjects() {
  initFilters();
  loadRepoStats();
}

// ClientRouter fires astro:page-load on the initial load too, so this is the only entry point needed.
document.addEventListener('astro:page-load', initProjects);
initProjects();
