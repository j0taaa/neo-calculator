import { createInterface } from "node:readline";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { Browser } from "happy-dom";
const send = (value) => process.stdout.write(JSON.stringify(value) + "\n");
const waiting = new Map();
let next = 0,
  browser,
  page;
function rpc(request) {
  const id = ++next;
  send({ rpc: id, request });
  return new Promise((resolve, reject) => waiting.set(id, { resolve, reject }));
}
async function open(input) {
  const { scope, assets, frameworkUrl } = input;
  browser = new Browser({
    settings: {
      enableJavaScriptEvaluation: true,
      disableCSSFileLoading: true,
      enableImageFileLoading: false,
      fetch: {
        disableSameOriginPolicy: true,
        interceptor: {
          async beforeAsyncRequest({ request, window }) {
            const url = new URL(request.url);
            let body = assets[request.url];
            if (url.pathname.endsWith("/api/config")) {
              if (url.searchParams.get("urlPath") !== scope.service)
                throw Error("Configuration scope changed");
              body = input.config;
            }
            if (url.pathname.endsWith("/api/productInfo")) {
              if (
                url.searchParams.get("urlPath") !== scope.service ||
                url.searchParams.get("region") !== scope.region
              )
                throw Error("Product scope changed");
              body = input.products;
            }
            if (url.pathname.endsWith("/api/menuInfo")) body = input.menu;
            if (body !== undefined)
              return new window.Response(body, {
                status: 200,
                headers: {
                  "content-type": url.pathname.endsWith(".js")
                    ? "application/javascript"
                    : "application/json",
                },
              });
            const response = await rpc({
              url: request.url,
              method: request.method,
              body: await request.text(),
            });
            return new window.Response(response.body, {
              status: response.status,
              headers: { "content-type": response.contentType },
            });
          },
        },
      },
      timer: { maxTimeout: 30000, maxIntervalIterations: 2 },
      viewport: { width: 1440, height: 1200 },
    },
  });
  page = browser.newPage();
  page.url = `https://www.huaweicloud.com/intl/en-us/pricing/calculator.html?region=${scope.region}&inIframe=true#/${scope.service}`;
  page.content = '<html><head></head><body><div id="app"></div></body></html>';
  page.mainFrame.window.indexedDB = new IDBFactory();
  page.mainFrame.window.IDBKeyRange = IDBKeyRange;
  const style = page.mainFrame.window.document.createElement("style");
  style.textContent = input.css;
  page.mainFrame.window.document.head.appendChild(style);
  page.evaluate(`
    // Geometry is unavailable. This neutral value prevents scrolling code from recursing into undefined.
    Object.defineProperty(HTMLElement.prototype,'offsetParent',{get(){return null}});
    // The emulator rejects otherwise valid tag selectors containing underscores.
    const nativeQuery=Element.prototype.querySelector;
    Element.prototype.querySelector=function(value){return /^[A-Za-z][\\w-]*$/.test(value)?this.getElementsByTagName(value)[0]||null:nativeQuery.call(this,value)};
    window.__neoVisible=el=>{
      const cache=window.__neoVisibilityCache;
      if(cache.has(el))return cache.get(el);
      const style=getComputedStyle(el);
      const value=!!el.isConnected&&!el.matches('input[type=hidden]')&&style.display!=='none'&&style.visibility!=='hidden'&&(!el.parentElement||window.__neoVisible(el.parentElement));
      cache.set(el,value);return value;
    };
    Object.assign(window,{version:${JSON.stringify(new URL(frameworkUrl).pathname.split("/").at(-2))},timeOutTime:30000,calcStation:'zh-HK',calcLanguage:'en-us',calcSymbol:'$',calcUnit:'USD',baseUrl:'https://res-img3.huaweicloud.com/content/dam/cloudbu-site/archive/china/commons/pricing/dist5/'});
  `);
  await page.evaluateModule({ url: frameworkUrl, code: assets[frameworkUrl] });
  const deadline = Date.now() + 15000;
  const ready = `typeof window.iframeSetValue==='function' && !!document.querySelector('[id^=calculator_]')`;
  while (Date.now() < deadline && !page.evaluate(ready))
    await new Promise((resolve) => setTimeout(resolve, 100));
  if (!page.evaluate(ready))
    throw Error(
      `Official form did not initialize: ${page.virtualConsolePrinter.readAsString().slice(0, 1500)}`,
    );
  const init = {
    global_REGIONINFO: {
      region: scope.region,
      chargeMode: scope.billingMode,
      locationType: "commonAZ",
    },
  };
  page.evaluate(`window.iframeSetValue(${JSON.stringify(init)})`);
  await new Promise((resolve) => setTimeout(resolve, 500));
  return {
    rssMiB: process.memoryUsage().rss / 1024 / 1024,
    uptimeSeconds: process.uptime(),
  };
}
function act(field, value) {
  return page.evaluate(`(function(field,value){
    const control=document.querySelector('[data-neo-control='+JSON.stringify(field.id)+']');
    if(!control)throw Error('Control disappeared');
    if(field.type==='select'){
      if(control.matches('.base-radio-group')){const option=control.querySelectorAll('li')[Number(value)];(option.querySelector('button')||option).click();}
      else{control.querySelector('input').click();document.querySelector('[data-neo-option='+JSON.stringify(field.id+':'+value)+']').click();}
    }else if(field.type==='number'){
      control.focus();control.value=String(value);control.dispatchEvent(new Event('input',{bubbles:true}));control.dispatchEvent(new Event('change',{bubbles:true}));control.blur();
    }else if(field.type!=='checkbox'||field.value!==value)control.click();
  })(${JSON.stringify(field)},${JSON.stringify(value)})`);
}
const input = createInterface({ input: process.stdin });
input.on("line", async (line) => {
  let message;
  try {
    message = JSON.parse(line);
    if (message.reply) {
      const job = waiting.get(message.reply);
      waiting.delete(message.reply);
      if (!job) return;
      if (message.error) job.reject(Error(message.error));
      else job.resolve(message.response);
      return;
    }
    let result;
    if (message.action === "open") result = await open(message.input);
    else if (message.action === "evaluate")
      result = await page.evaluate(message.source);
    else if (message.action === "act")
      result = act(message.field, message.value);
    else if (message.action === "status")
      result = {
        logs: page.virtualConsolePrinter.readAsString(),
        metrics: {
          rssMiB: process.memoryUsage().rss / 1024 / 1024,
          uptimeSeconds: process.uptime(),
        },
      };
    else if (message.action === "close") {
      await browser?.close();
      result = true;
    } else throw Error("Unknown action");
    send({ id: message.id, result });
  } catch (error) {
    send({ id: message?.id, error: error.stack });
  }
});
input.on("close", () => {
  void browser?.close().finally(() => process.exit());
});
