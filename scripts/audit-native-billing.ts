/** Independent live audit of every billing family against the unmodified official renderer. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, type Page } from "playwright";
import { NativeCalculator } from "../lib/huawei-native/native-session";
import { HuaweiCollector, PAGE_URL } from "../lib/huawei-native/collector";
import { SourceStore, canonical } from "../lib/huawei-native/store";
import { semanticInquiry } from "../lib/huawei-native/inquiry";
import type { Inquiry } from "../lib/huawei-native/types";
import type { NativeState, NativeField } from "../lib/huawei-native/native-types";
import type { NativeBillingMode } from "../lib/huawei-native/native-billing";
import type { InquiryResponse } from "../lib/huawei-native/quotes";

const output = process.env.NATIVE_BILLING_AUDIT_DIR ?? "/tmp/neo-native-billing-audit";
await mkdir(output,{recursive:true});
const store = new SourceStore(`${output}/sources.sqlite`);
const calculator = new NativeCalculator(new HuaweiCollector(store));
const proxy = process.env.HWC_SOCKS5_PROXY?.replace("socks5h://","socks5://");
const browser = await chromium.launch({headless:true,...(proxy ? {proxy:{server:proxy}} : {})});
const evidence: unknown[] = [];
const cases: [string,string,NativeBillingMode][] = [
  ["nat","ap-southeast-1","ONDEMAND"], ["nat","ap-southeast-1","PERIOD"],
  ["elb","ap-southeast-1","PERIOD"], ["redis","ap-southeast-3","PERIOD"],
  ["ecs","ap-southeast-1","ONDEMAND"], ["ecs","sa-brazil-1","ONDEMAND"],
  ["ecs","ap-southeast-1","PERIOD"], ["ecs","ap-southeast-1","RI"],
  ["ecs","sa-brazil-1","RI"], ["ccm","ap-southeast-1","ONETIME"], ["dew","ap-southeast-1","ONETIME"],
];
const started = Date.now();
function amount(text: string) {
  const value = Number(text.replace(/[^\d.-]/g,""));
  assert(Number.isFinite(value),`Invalid displayed amount: ${text}`); return value;
}
async function drive(page: Page, field: NativeField, value: string | number | boolean) {
  if (field.type === "number") {
    const input = page.locator(`[data-neo-control="${field.id}"]`);
    await input.fill(String(value)); await input.press("Tab"); return;
  }
  assert.equal(field.type,"select");
  const label = field.options!.find(o => o.value === value)!.label;
  const root = page.locator(`[id="${field.component}"], [idheader="${field.component}"]`).first();
  const tagged = page.locator(`[data-neo-option="${field.id}:${value}"]`);
  if (await tagged.count()) {
    // A select's options may be invisible until its input is opened.
    const input = page.locator(`[data-neo-control="${field.id}"]`);
    if (await input.count()) await input.click();
    await tagged.click();
  } else await root.getByRole("button",{name:label,exact:true}).click();
}
try {
  for (const [service,region,billingMode] of cases) {
    if (process.env.NATIVE_BILLING_AUDIT_SERVICES && !process.env.NATIVE_BILLING_AUDIT_SERVICES.split(",").includes(service)) continue;
    if (process.env.NATIVE_BILLING_AUDIT_MODES && !process.env.NATIVE_BILLING_AUDIT_MODES.split(",").includes(billingMode)) continue;
    let state: NativeState | undefined;
    const context = await browser.newContext({viewport:{width:1440,height:1200},serviceWorkers:"block"});
    try {
      state = await calculator.open(service,region,billingMode);
      // The oracle gets the same public source versions, but its pricing framework is ORIGINAL.
      await context.route("**/api/config?**",r => r.fulfill({contentType:"text/plain",body:store.body(state!.source.config)}));
      await context.route("**/api/productInfo?**",r => r.fulfill({contentType:"application/json",body:store.body(state!.source.products)}));
      await context.route("**/api/menuInfo?**",r => r.fulfill({contentType:"application/json",body:store.body(state!.source.menu)}));
      await context.route("**/framework.js",r => r.fulfill({contentType:"application/javascript",body:store.body(state!.source.framework)}));
      const page = await context.newPage();
      let latestTag = "", receivedAt = 0;
      const responses = new Map<string,{inquiry:Inquiry;response:InquiryResponse}>();
      page.on("request",request => {
        if (!request.url().includes("/inquiry/resource") || request.method() !== "POST") return;
        const inquiry = request.postDataJSON() as Inquiry;
        latestTag = inquiry.productInfos[0].id.split("-")[0];
      });
      page.on("response",async response => {
        if (!response.url().includes("/inquiry/resource") || response.request().method() !== "POST") return;
        try {
          const inquiry = response.request().postDataJSON() as Inquiry;
          const result = await response.json() as InquiryResponse;
          if (result.currency !== "USD" || !result.productRatingResult?.length) return;
          responses.set(canonical(inquiry),{inquiry,response:result}); receivedAt = Date.now();
        } catch { /* Only complete successful responses count. */ }
      });
      await page.goto(`${PAGE_URL}?region=${region}&inIframe=true#/${service}`,{waitUntil:"domcontentloaded",timeout:45000});
      await page.waitForFunction(() => typeof (window as unknown as {iframeSetValue?:unknown}).iframeSetValue === "function",undefined,{timeout:45000});
      await page.locator('[id^="calculator_"]').first().waitFor({timeout:45000});
      await page.evaluate(({region,billingMode}) => (window as unknown as {iframeSetValue:(v:unknown)=>void}).iframeSetValue({global_REGIONINFO:{region,chargeMode:billingMode,locationType:"commonAZ"}}),{region,billingMode});
      const guide = page.locator(".guide-dialog").getByRole("button",{name:"Close",exact:true});
      if (await guide.isVisible()) await guide.click();
      // Use the DOM mapper only to tag controls for interaction. Price evidence is independent.
      const {readNativeForm} = await import("../lib/huawei-native/native-dom");
      async function compare(name: string) {
        const deadline = Date.now()+20000;
        while ((!receivedAt || Date.now()-receivedAt<1800) && Date.now()<deadline) await page.waitForTimeout(200);
        assert.deepEqual(state!.diagnostics,[]);
        assert(state!.quote,state!.priceError || "No native quote");
        const official = [...responses.values()].filter(q => q.inquiry.productInfos.every(p => p.id.startsWith(`${latestTag}-`)));
        assert(official.length,"No official response");
        const requestSet = (requests:Inquiry[]) => requests.map(q=>canonical(semanticInquiry(q))).sort();
        assert.deepEqual(requestSet(state!.inquiries),requestSet(official.map(q=>q.inquiry)),`${service}/${billingMode}/${name}: inquiry mismatch`);
        const displayed = amount(await page.locator('[id="func-priceboard-amount_0"]:visible').innerText());
        assert.equal(Number(state!.quote.amount.toFixed(2)),displayed,`${name}: official displayed total mismatch`);
        if (state!.quote.payment) {
          const payment = state!.quote.payment;
          const upfront = amount(await page.locator('[id="func-priceboard-perAmountAmount"]:visible').innerText());
          const recurring = amount(await page.locator('[id="func-priceboard-monthlyAmount"]:visible').innerText());
          assert.equal(payment.upfront,upfront); assert.equal(payment.recurring,recurring);
          const extraElements = page.locator('.func-priceboard-tipinfo-price[id^="func-priceboard-injected"]:visible');
          const extras = await extraElements.allTextContents();
          assert.deepEqual(payment.extras.map(e=>e.recurring).sort((a,b)=>a-b),extras.map(amount).sort((a,b)=>a-b));
          const text = await page.locator(".func-priceboard:visible").first().innerText();
          assert(text.includes(`x ${payment.installments}`) || text.includes(`x${payment.installments}`),"Official installment count mismatch");
          const independentlySummed = upfront + (recurring + extras.map(amount).reduce((a,b)=>a+b,0))*payment.installments;
          assert(Math.abs(independentlySummed-state!.quote.amount)<0.000001,`Installment total mismatch ${independentlySummed} vs ${state!.quote.amount}`);
        } else {
          const rawTotal = official.reduce((sum,q)=>sum+q.response.amount,0);
          assert(Math.abs(rawTotal-state!.quote.amount)<0.000001,`${name}: exact API total mismatch`);
        }
        evidence.push({service,region,billingMode,name,amount:state!.quote.amount,payment:state!.quote.payment,inquiries:state!.inquiries.map(semanticInquiry),source:state!.source});
        await writeFile(`${output}/evidence.json`,JSON.stringify({elapsedSeconds:(Date.now()-started)/1000,evidence},null,2));
        console.log(`${service}/${region}/${billingMode}/${name}: PASS USD ${state!.quote.amount}`);
      }
      async function change(name: string, field: NativeField, value: string | number | boolean) {
        await readNativeForm(page);
        receivedAt = 0;
        await drive(page,field,value);
        state = await calculator.act({session:state!.session,revision:state!.revision,field:field.id,value});
        await compare(name);
      }
      async function choose(label: string, name=label) {
        const field = state!.fields.find(f=>f.options?.some(o=>o.label===label && !o.disabled));
        assert(field,`Missing option ${label}`);
        await change(name,field,field.options!.find(o=>o.label===label)!.value);
      }
      await compare("default");
      if (service === "ecs") {
        const generation = state.fields.find(f=>f.options?.some(o=>o.label==="C7n"))!;
        const original = generation.options!.find(o=>o.value===generation.value)!.label;
        await choose("aC8","aC8-no-image-selection");
        const images = state.fields.filter(f=>f.component==="calculator_ims_select");
        assert.equal(images.length,2);
        assert(images.every(f=>f.disabled && f.options?.length===0 && f.value==="-1"),"aC8 must preserve Huawei's unavailable images");
        await choose("C7n","generation-with-images");
        assert(state.fields.filter(f=>f.component==="calculator_ims_select").every(f=>!f.disabled && f.options!.length>0),"C7n image choices must return");
        await choose(original,"return-to-original-generation");
      }
      if (billingMode === "PERIOD") {
        // Huawei's default aC7 offers monthly terms only; C7n also offers annual terms.
        if (service === "ecs") await choose("C7n","annual-capable-generation");
        const term = state!.fields.find(f=>f.component==="global_PERIODTIME" && f.type==="select")!;
        assert(term,"Missing purchase term");
        const year = term.options!.find(o=>/1 year/i.test(o.label))!;
        assert(year,"Missing annual term");
        await change("annual",term,year.value);
        const multi = state!.fields.find(f=>f.component==="global_PERIODTIME" && f.type==="select")!;
        const three = multi.options!.find(o=>/3 years/i.test(o.label));
        if (three) await change("three-years",multi,three.value);
      }
      if (billingMode === "RI") {
        const payment = state!.fields.find(f=>f.component === "calculator_ecs_RIRadio" && f.id.endsWith(":0"))!;
        for (const option of payment.options!.filter(o=>o.value !== payment.value && !o.disabled)) await choose(option.label);
        if (state!.fields.find(f=>f.id===payment.id)?.value !== payment.value) await choose(payment.options!.find(o=>o.value===payment.value)!.label);
        await choose("3 Years");
      }
      const quantity = state!.fields.find(f=>f.component==="global_QUANTITY" && f.type==="number");
      if (quantity) await change("quantity-two",quantity,2);
      if (billingMode === "ONDEMAND") {
        const duration = state!.fields.find(f=>f.component==="global_ONDEMANDTIME" && f.type==="number")!;
        await change("duration-two",duration,2);
      }
      if (service === "ccm") {
        const validity = state!.fields.find(f=>f.options?.some(o=>/3 years/i.test(o.label)));
        if (validity) await change("validity-three-years",validity,validity.options!.find(o=>/3 years/i.test(o.label))!.value);
      }
      const selection = state!.selection, before = state!.quote!.amount;
      await calculator.remove(state!.session);
      state = await calculator.restore(selection);
      assert.deepEqual(state.selection,selection);
      assert(state.quote,state.priceError);
      assert.equal(state.quote.amount,before,"Replayed price mismatch");
      state = await calculator.refresh(state.session,state.revision);
      assert.equal(state.quote!.amount,before,"Fresh saved price mismatch");
      evidence.push({service,region,billingMode,name:"save-and-replay",amount:before});
      if (billingMode === "ONDEMAND") {
        const legacy = {...selection,billingMode:undefined};
        await calculator.remove(state.session);
        state = await calculator.restore({...legacy,version:1});
        assert.equal(state.selection.version,1);
        assert.equal(state.quote!.amount,before,"Legacy saved price mismatch");
        evidence.push({service,region,billingMode,name:"legacy-replay",amount:before});
      }
      console.log(`${service}/${region}/${billingMode}/save-and-replay: PASS`);
    } finally {if(state) await calculator.remove(state.session); await context.close();}
  }
  for (const [service,region,mode] of [["ecs","cn-north-4","RI"],["elb","sa-peru-1","PERIOD"],["ccm","ap-southeast-1","ONDEMAND"]] as [string,string,NativeBillingMode][]) {
    await assert.rejects(calculator.open(service,region,mode),/does not offer/);
  }
  await writeFile(`${output}/evidence.json`,JSON.stringify({elapsedSeconds:(Date.now()-started)/1000,evidence,regionalGuards:3},null,2));
  console.log(`PASS: ${evidence.length} billing checks in ${((Date.now()-started)/1000).toFixed(1)}s`);
} catch(error) {console.error(error);process.exitCode=1;}
finally {await calculator.close();await browser.close();store.close();process.exit(process.exitCode || 0);}
