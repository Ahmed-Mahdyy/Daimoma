import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage();
await p.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
await p.getByLabel(/email/i).fill('hr-e2e@acme.test');
await p.getByLabel(/password/i).fill('E2ePassw0rd1');
await p.getByRole('button', { name: /sign in/i }).click();
await p.getByText(/my dashboard/i).waitFor({ timeout: 15000 });
await p.goto('http://localhost:5173/employees', { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
await p.screenshot({ path: 'test-results/f1-collapsed.png', clip: {x:0,y:0,width:375,height:500} });
await p.getByRole('button', { name: /filters/i }).click();
await p.waitForTimeout(300);
await p.screenshot({ path: 'test-results/f2-open.png', clip: {x:0,y:0,width:375,height:667} });
await p.goto('http://localhost:5173/employees?role=Manager', { waitUntil: 'networkidle' });
await p.waitForTimeout(600);
const badge = await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => /filters/i.test(b.textContent||''));
  return { btnText: btn?.textContent?.trim(), expanded: btn?.getAttribute('aria-expanded'), visibleSelects: [...document.querySelectorAll('select')].filter(s => s.offsetParent !== null).length };
});
console.log('ACTIVE', JSON.stringify(badge));
const d = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await d.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
await d.getByLabel(/email/i).fill('hr-e2e@acme.test');
await d.getByLabel(/password/i).fill('E2ePassw0rd1');
await d.getByRole('button', { name: /sign in/i }).click();
await d.getByText(/my dashboard/i).waitFor({ timeout: 15000 });
await d.goto('http://localhost:5173/employees', { waitUntil: 'networkidle' });
await d.waitForTimeout(700);
const desktop = await d.evaluate(() => ({
  toggleVisible: !![...document.querySelectorAll('button')].find(b => /filters/i.test(b.textContent||''))?.offsetParent,
  visibleSelects: [...document.querySelectorAll('select')].filter(s => s.offsetParent !== null).length,
}));
console.log('DESKTOP', JSON.stringify(desktop));
await b.close();
