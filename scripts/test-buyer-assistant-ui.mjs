import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = process.env.NETIFY_TEST_BASE_URL || 'http://localhost:3107/sase/home/';
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    page.setDefaultTimeout(20000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    let memory = { email: 'buyer@example.test', revision: 0, facts: [], notes: [], regions: [], organisation: '' };
    let skillCalls = 0;
    await page.route('**/sase/api/auth/session', r => r.fulfill({ json: { authenticated: true, role: 'buyer', email: memory.email } }));
    await page.route('**/sase/api/buyer/assistant', async r => {
      if (r.request().method() === 'GET') return r.fulfill({ json: { memory } });
      const input = r.request().postDataJSON();
      if (input.revision !== memory.revision) return r.fulfill({ status: 409, json: { error: 'Your memories changed in another session. Reload them before saving or running this skill.' } });
      if (input.action === 'save_fact') memory = { ...memory, revision: memory.revision + 1, facts: [{ id: '12345678-1234-4234-8234-123456789012', text: input.text, source: input.source, confirmed_at: input.confirmed ? Date.now() : null, expires_at: input.expires_at }] };
      if (input.action === 'forget_fact') memory = { ...memory, revision: memory.revision + 1, facts: [] };
      if (input.action === 'run_skill') {
        skillCalls++;
        const text = [input.text, ...memory.facts.filter(f => input.fact_ids.includes(f.id)).map(f => f.text)].filter(Boolean).join('\n');
        return r.fulfill({ json: { result: { skill: input.skill, input: text, memory_revision: memory.revision, fact_ids: input.fact_ids, brief: 'Proposed requirement: ' + text, questions: ['Who will operate the service?'], notes: [], engine: 'deterministic_fallback', comparison: input.skill === 'compare_options' ? { columns: ['Factor', 'Managed', 'Co-managed', 'DIY'], rows: [{ Factor: 'Control', Managed: 'Provider', 'Co-managed': 'Shared', DIY: 'Buyer' }] } : null } } });
      }
      return r.fulfill({ json: { memory } });
    });
    await page.goto(base);
    const engine = page.getByRole('textbox', { name: 'Describe your requirements', exact: true });
    await engine.fill('Keep this full RFP draft intact');
    async function nav(name) {
      if (width < 850 && !await page.getByRole('navigation', { name: 'Workspace tools', exact: true }).isVisible()) await page.getByRole('button', { name: 'Toggle workspace navigation' }).click();
      await page.locator('.nf-buying-sidebar').getByRole('button', { name, exact: true }).click();
    }
    await nav('Memories');
    await page.getByLabel('Fact', { exact: true }).fill('Our network covers 20 UK sites.');
    await page.getByLabel('I confirm this fact is accurate.').check();
    await page.getByRole('button', { name: 'Save memory', exact: true }).click();
    await page.getByText('Memory saved to your buyer account.', { exact: true }).waitFor();
    await page.screenshot({ path: `/tmp/netify-assistant-memories-${width}.png`, fullPage: true });
    await page.reload();
    await nav('Memories');
    await page.getByText('Our network covers 20 UK sites.', { exact: true }).waitFor();
    await nav('Project');
    await engine.fill('Keep this full RFP draft intact');
    await nav('Skills');
    await page.getByLabel('Your requirements', { exact: true }).fill('We need managed SD-WAN.');
    await page.getByRole('checkbox', { name: 'Our network covers 20 UK sites.' }).check();
    await page.getByRole('button', { name: /^Compare buying options/ }).click();
    await page.getByRole('heading', { name: 'Delivery model comparison', exact: true }).waitFor();
    await page.screenshot({ path: `/tmp/netify-assistant-skills-${width}.png`, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await page.getByRole('button', { name: /^Prepare my project/ }).click();
    await page.getByRole('button', { name: 'Add reviewed requirements to my brief', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    assert.match(await page.getByPlaceholder('Describe your sites, users, security needs and what should improve. Leave out your company name and contact details.').inputValue(), /20 UK sites/);
    await page.getByRole('button', { name: 'Close project brief', exact: true }).click();
    assert.equal(await engine.inputValue(), 'Keep this full RFP draft intact');
    await nav('Skills');
    assert.equal(await page.getByRole('button', { name: 'Added to your brief' }).isDisabled(), true);
    await page.getByLabel('Your requirements', { exact: true }).fill('Changed requirement');
    assert.equal(await page.getByRole('region', { name: 'Skill result' }).count(), 0);
    memory.revision++;
    await page.getByRole('button', { name: /^Review requirements/ }).click();
    await page.getByRole('alert').filter({ hasText: 'another session' }).waitFor();
    assert.equal(skillCalls, 2);
    await page.getByRole('button', { name: 'Reload memories' }).click();
    await page.getByText('Memories loaded.', { exact: true }).waitFor();
    await nav('Memories');
    await page.getByRole('button', { name: 'Forget', exact: true }).click();
    await page.getByText('Memory forgotten.', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`PASS ${width}px: persistent memory, skills, reviewed brief handoff, existing RFP retained, stale result denial, forgetting and responsive layout.`);
  }
} finally { await browser.close(); }
