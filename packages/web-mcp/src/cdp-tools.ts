import { YoloCdpClient } from "@yolo-web/cdp-client";

type Args = Record<string, unknown>;
type Target = { targetId: string; title: string; url: string; type: string; attached?: boolean };

let cdp: YoloCdpClient | null = null;
let activeTargetId: string | null = null;
let requests: Array<Record<string, unknown>> = [];
let consoleMessages: Array<Record<string, unknown>> = [];

function stringArg(args: Args, key: string, fallback = ""): string {
  const value = args[key];
  return typeof value === "string" ? value : fallback;
}

function numberArg(args: Args, key: string, fallback: number): number {
  const value = args[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function selectorFor(args: Args): string {
  const selector = stringArg(args, "selector").trim();
  if (selector) return selector;
  const ref = stringArg(args, "ref").trim();
  if (ref && /^[\w-]+$/.test(ref)) return `[data-yolo-web-ref="${ref}"]`;
  throw new Error("Provide a CSS selector or a reference returned by browser_snapshot.");
}

async function ensureCdp() {
  if (!cdp) {
    const endpoint = Bun.env.YOLO_CDP_ENDPOINT ?? `http://127.0.0.1:${Bun.env.YOLO_CDP_PORT ?? "9222"}`;
    cdp = await YoloCdpClient.connect({ endpoint, token: Bun.env.YOLO_CDP_TOKEN, timeoutMs: 8_000 });
    cdp.on("Network.requestWillBeSent", (params) => {
      requests.push({ kind: "request", requestId: params.requestId, url: (params.request as Record<string, unknown> | undefined)?.url, method: (params.request as Record<string, unknown> | undefined)?.method, type: params.type, timestamp: params.timestamp });
      if (requests.length > 500) requests = requests.slice(-500);
    });
    cdp.on("Network.responseReceived", (params) => {
      requests.push({ kind: "response", requestId: params.requestId, url: (params.response as Record<string, unknown> | undefined)?.url, status: (params.response as Record<string, unknown> | undefined)?.status, mimeType: (params.response as Record<string, unknown> | undefined)?.mimeType, type: params.type, timestamp: params.timestamp });
      if (requests.length > 500) requests = requests.slice(-500);
    });
    cdp.on("Runtime.consoleAPICalled", (params) => {
      consoleMessages.push({ type: params.type, args: params.args, timestamp: params.timestamp, executionContextId: params.executionContextId });
      if (consoleMessages.length > 300) consoleMessages = consoleMessages.slice(-300);
    });
  }

  const targets = await cdp.listTargets() as Target[];
  let target = targets.find((item) => item.targetId === activeTargetId && item.type === "page");
  if (!target) target = targets.find((item) => item.type === "page" && !item.url.startsWith("devtools://"));
  if (!target) {
    activeTargetId = await cdp.createTarget("about:blank");
    target = { targetId: activeTargetId, title: "", url: "about:blank", type: "page" };
  }
  if (activeTargetId !== target.targetId || !cdp.activeSessionId) {
    activeTargetId = target.targetId;
    await cdp.attachToTarget(target.targetId, true);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("DOM.enable");
    await cdp.send("Network.enable");
  }
  return cdp;
}

async function evaluate<T>(expression: string): Promise<T> {
  const client = await ensureCdp();
  return client.evaluate<T>(expression);
}

function literal(value: unknown): string {
  return JSON.stringify(value);
}

async function waitUntil(predicate: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await Bun.sleep(100);
  }
  return await predicate();
}

export async function executeBrowserTool(name: string, args: Args): Promise<unknown> {
  switch (name) {
    case "browser_navigate": {
      const url = stringArg(args, "url");
      if (!/^https?:\/\//i.test(url) && url !== "about:blank") throw new Error("Only http, https, and about:blank navigation is allowed by this MCP tool.");
      const client = await ensureCdp();
      const result = await client.navigate(url, { waitUntil: "domcontentloaded" });
      return { ...result, url };
    }
    case "browser_snapshot":
      return await evaluate(`(() => { const nodes = [...document.querySelectorAll('a,button,input,textarea,select,[role=button],[role=link],[tabindex]')].filter((el) => { const r=el.getBoundingClientRect(); return r.width>0 && r.height>0; }).slice(0,250); return {url:location.href,title:document.title,body:(document.body?.innerText??'').slice(0,20000),elements:nodes.map((el,i)=>{const ref='e'+(i+1);el.setAttribute('data-yolo-web-ref',ref);const r=el.getBoundingClientRect();return {ref,tag:el.tagName.toLowerCase(),text:(el.innerText||el.getAttribute('aria-label')||el.getAttribute('placeholder')||'').trim().slice(0,300),role:el.getAttribute('role'),type:el.getAttribute('type'),name:el.getAttribute('name'),disabled:!!el.disabled,box:{x:r.x,y:r.y,width:r.width,height:r.height}};})}; })()`);
    case "browser_click": {
      const selector = selectorFor(args);
      return await evaluate(`(() => { const el=document.querySelector(${literal(selector)}); if(!el) throw new Error('No element matches selector'); el.scrollIntoView({block:'center',inline:'center'}); el.click(); return {clicked:true,tag:el.tagName.toLowerCase()}; })()`);
    }
    case "browser_fill": {
      const selector = selectorFor(args), value = stringArg(args, "value");
      return await evaluate(`(() => { const el=document.querySelector(${literal(selector)}); if(!el) throw new Error('No element matches selector'); el.focus(); const setter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value')?.set; if(setter) setter.call(el,${literal(value)}); else el.value=${literal(value)}; el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:${literal(value)}})); el.dispatchEvent(new Event('change',{bubbles:true})); return {filled:true}; })()`);
    }
    case "browser_type": {
      const selector = selectorFor(args), text = stringArg(args, "text");
      await evaluate(`(() => { const el=document.querySelector(${literal(selector)}); if(!el) throw new Error('No element matches selector'); el.focus(); return true; })()`);
      await (await ensureCdp()).send("Input.insertText", { text });
      return { typed: text.length, selector };
    }
    case "browser_press_key": {
      const key = stringArg(args, "key");
      if (!key) throw new Error("key is required");
      const client = await ensureCdp();
      await client.dispatchKeyEvent({ type: "keyDown", key, code: key });
      await client.dispatchKeyEvent({ type: "keyUp", key, code: key });
      return { pressed: key };
    }
    case "browser_select_option": {
      const selector = selectorFor(args), value = stringArg(args, "value");
      return await evaluate(`(() => { const el=document.querySelector(${literal(selector)}); if(!(el instanceof HTMLSelectElement)) throw new Error('Selector must match a select element'); if(![...el.options].some(o=>o.value===${literal(value)})) throw new Error('No option has the requested value'); el.value=${literal(value)}; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); return {selected:el.value}; })()`);
    }
    case "browser_evaluate": {
      const script = stringArg(args, "script");
      if (!script.trim()) throw new Error("script is required");
      const client = await ensureCdp();
      return await client.send("Runtime.evaluate", { expression: script, awaitPromise: true, returnByValue: true, userGesture: true, timeout: numberArg(args, "timeoutMs", 5_000) });
    }
    case "browser_wait_for_function": {
      const script = stringArg(args, "script"), timeoutMs = numberArg(args, "timeoutMs", 5_000);
      const found = await waitUntil(async () => Boolean(await evaluate(`Boolean((${script})())`)), timeoutMs);
      return { resolved: found, timeoutMs };
    }
    case "browser_wait_for": {
      const selector = stringArg(args, "selector"), seconds = numberArg(args, "seconds", 5);
      if (!selector) throw new Error("selector is required");
      const found = await waitUntil(async () => Boolean(await evaluate(`Boolean(document.querySelector(${literal(selector)}))`)), Math.max(0, seconds * 1000));
      return { found, selector, timeoutSeconds: seconds };
    }
    case "browser_network_requests": return requests;
    case "browser_console_messages": return consoleMessages;
    case "browser_close": {
      const client = await ensureCdp();
      const closed = activeTargetId ? await client.closeTarget(activeTargetId) : false;
      activeTargetId = null;
      client.setSessionId(undefined);
      return { closed };
    }
    case "browser_markdown": {
      const content = await evaluate<{ title: string; url: string; text: string }>(`({title:document.title,url:location.href,text:document.body?.innerText??''})`);
      return `# ${content.title}\n\nSource: ${content.url}\n\n${content.text}`;
    }
    case "browser_links":
      return await evaluate(`Array.from(document.querySelectorAll('a[href]'),a=>({text:(a.innerText||a.getAttribute('aria-label')||'').trim(),href:a.href,title:a.title})).filter(a=>a.href)`);
    case "browser_interactive_elements":
      return await evaluate(`Array.from(document.querySelectorAll('a,button,input,textarea,select,[role=button],[role=link],[tabindex]')).map((el,i)=>{const r=el.getBoundingClientRect();return {index:i,tag:el.tagName.toLowerCase(),text:(el.innerText||el.getAttribute('aria-label')||el.getAttribute('placeholder')||'').trim(),role:el.getAttribute('role'),disabled:!!el.disabled,box:{x:r.x,y:r.y,width:r.width,height:r.height}}}).filter(e=>e.box.width>0&&e.box.height>0)`);
    case "browser_back":
    case "browser_forward": {
      const client = await ensureCdp();
      const history = await client.send<{ currentIndex: number; entries: Array<{ id: number }> }>("Page.getNavigationHistory");
      const delta = name === "browser_back" ? -1 : 1;
      const entry = history.entries[history.currentIndex + delta];
      if (!entry) return { navigated: false, reason: "no-history-entry" };
      await client.send("Page.navigateToHistoryEntry", { entryId: entry.id });
      return { navigated: true, direction: delta < 0 ? "back" : "forward" };
    }
    case "browser_reload": await (await ensureCdp()).send("Page.reload", { ignoreCache: args.ignoreCache === true }); return { reloaded: true };
    case "browser_get_cookies": {
      const client = await ensureCdp();
      const result = await client.send<{ cookies: Array<Record<string, unknown>> }>("Network.getAllCookies");
      const domain = stringArg(args, "domain");
      return domain ? result.cookies.filter((cookie) => String(cookie.domain).includes(domain)) : result.cookies;
    }
    case "browser_set_cookie": {
      const name = stringArg(args, "name"), value = stringArg(args, "value");
      if (!name) throw new Error("name is required");
      const cookie: Record<string, unknown> = { name, value, url: stringArg(args, "url") || await evaluate<string>("location.origin") };
      for (const key of ["domain", "path", "secure", "httpOnly", "sameSite", "expires"] as const) if (args[key] !== undefined) cookie[key] = args[key];
      return await (await ensureCdp()).send("Network.setCookie", cookie);
    }
    case "browser_clear_cookies": return await (await ensureCdp()).send("Network.clearBrowserCookies");
    case "browser_wait_for_text": {
      const text = stringArg(args, "text"), timeoutMs = numberArg(args, "timeoutMs", 5_000);
      const found = await waitUntil(async () => (await evaluate<string>("document.body?.innerText??''")).includes(text), timeoutMs);
      return { found, text, timeoutMs };
    }
    case "browser_detect_forms":
      return await evaluate(`Array.from(document.forms,form=>({action:form.action,method:form.method,fields:Array.from(form.elements,el=>({tag:el.tagName.toLowerCase(),type:el.type||null,name:el.name||null,id:el.id||null,placeholder:el.placeholder||null,required:!!el.required,disabled:!!el.disabled}))}))`);
    case "browser_fill_form": {
      const selector = stringArg(args, "formSelector", "form"), fields = args.fields;
      if (!fields || typeof fields !== "object" || Array.isArray(fields)) throw new Error("fields must be an object keyed by field name or selector");
      return await evaluate(`(() => { const form=document.querySelector(${literal(selector)}); if(!(form instanceof HTMLFormElement)) throw new Error('No form matches formSelector'); const values=${literal(fields)}; const filled=[]; for(const [key,value] of Object.entries(values)){const el=form.elements.namedItem(key)||form.querySelector(key); if(!el||!('value' in el)) throw new Error('No form field matches '+key); el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));filled.push(key);} return {filled}; })()`);
    }
    case "browser_scroll": {
      const x = numberArg(args, "x", 0), y = numberArg(args, "y", 0), direction = stringArg(args, "direction", "delta");
      return await evaluate(`(() => { const map={top:[0,0],bottom:[0,document.documentElement.scrollHeight],left:[0,0],right:[document.documentElement.scrollWidth,0]}; const p=map[${literal(direction)}]; window.scrollTo({left:p?p[0]:window.scrollX+${x},top:p?p[1]:window.scrollY+${y},behavior:'auto'}); return {x:window.scrollX,y:window.scrollY}; })()`);
    }
    case "browser_get_attribute": {
      const selector = selectorFor(args), attribute = stringArg(args, "attribute");
      if (!attribute || !/^[\w:-]+$/.test(attribute)) throw new Error("attribute must be a valid attribute name");
      return await evaluate(`document.querySelector(${literal(selector)})?.getAttribute(${literal(attribute)})??null`);
    }
    case "browser_count": {
      const selector = stringArg(args, "selector");
      return await evaluate(`document.querySelectorAll(${literal(selector)}).length`);
    }
    case "browser_extract": {
      const schema = args.schema;
      if (!schema || typeof schema !== "object") throw new Error("schema must be an object mapping result keys to CSS selectors");
      return await evaluate(`(() => {const schema=${literal(schema)};const read=(selector)=>Array.from(document.querySelectorAll(String(selector)),el=>({text:(el.innerText||el.textContent||'').trim(),html:el.innerHTML,href:el.href||null,src:el.src||null,value:('value' in el)?el.value:null,attributes:Object.fromEntries(Array.from(el.attributes,a=>[a.name,a.value]))}));return Object.fromEntries(Object.entries(schema).map(([key,selector])=>[key,read(selector)]));})()`);
    }
    case "browser_tab_new": {
      const client = await ensureCdp();
      const targetId = await client.createTarget(stringArg(args, "url", "about:blank"));
      activeTargetId = targetId;
      client.setSessionId(undefined);
      await ensureCdp();
      return { targetId, url: stringArg(args, "url", "about:blank") };
    }
    case "browser_tab_list": {
      const client = await ensureCdp();
      const targets = await client.listTargets() as Target[];
      return targets.filter((target) => target.type === "page").map((target) => ({ ...target, active: target.targetId === activeTargetId }));
    }
    case "browser_tab_switch": {
      const targetId = stringArg(args, "tabId");
      const targets = await (await ensureCdp()).listTargets() as Target[];
      if (!targets.some((target) => target.targetId === targetId && target.type === "page")) throw new Error(`No page target with id ${targetId}`);
      activeTargetId = targetId;
      cdp!.setSessionId(undefined);
      await ensureCdp();
      return { activeTargetId };
    }
    case "browser_tab_close": {
      const targetId = stringArg(args, "tabId");
      const client = await ensureCdp();
      const closed = await client.closeTarget(targetId);
      if (!closed) throw new Error(`CDP did not close target ${targetId}`);
      if (activeTargetId === targetId) { activeTargetId = null; client.setSessionId(undefined); await ensureCdp(); }
      return { closed: targetId };
    }
    case "browser_search": {
      const query = stringArg(args, "query");
      return await evaluate(`Array.from(document.querySelectorAll('body *')).filter(el=>el.children.length===0&&(el.textContent||'').includes(${literal(query)})).slice(0,100).map(el=>{const r=el.getBoundingClientRect();return {tag:el.tagName.toLowerCase(),text:(el.textContent||'').trim().slice(0,500),box:{x:r.x,y:r.y,width:r.width,height:r.height}}})`);
    }
    case "browser_storage_state":
      return await evaluate(`({url:location.origin,localStorage:Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])),sessionStorage:Object.fromEntries(Object.keys(sessionStorage).map(k=>[k,sessionStorage.getItem(k)]))})`);
    case "browser_set_storage_state": {
      const state = args.state;
      if (!state || typeof state !== "object") throw new Error("state must include localStorage and/or sessionStorage maps");
      return await evaluate(`(() => {const state=${literal(state)};for(const [k,v] of Object.entries(state.localStorage||{}))localStorage.setItem(k,String(v));for(const [k,v] of Object.entries(state.sessionStorage||{}))sessionStorage.setItem(k,String(v));return {localStorage:localStorage.length,sessionStorage:sessionStorage.length};})()`);
    }
    case "browser_screenshot": {
      const client = await ensureCdp();
      let clip: { x: number; y: number; width: number; height: number } | undefined;
      const selector = stringArg(args, "selector");
      if (selector) clip = await evaluate(`(()=>{const r=document.querySelector(${literal(selector)})?.getBoundingClientRect();if(!r)throw new Error('No element matches selector');return {x:r.x,y:r.y,width:r.width,height:r.height}})()`);
      const bytes = await client.captureScreenshot({ format: "png", captureBeyondViewport: args.fullPage === true, ...(clip ? { clip } : {}) });
      const path = stringArg(args, "path");
      if (path) { await Bun.write(path, bytes); return { path, bytes: bytes.byteLength, format: "png" }; }
      return { format: "png", base64: Buffer.from(bytes).toString("base64") };
    }
    case "browser_pdf": {
      const bytes = await (await ensureCdp()).printToPdf({ landscape: args.landscape === true, printBackground: args.print_background !== false });
      const path = stringArg(args, "path");
      if (path) { await Bun.write(path, bytes); return { path, bytes: bytes.byteLength, format: "pdf" }; }
      return { format: "pdf", base64: Buffer.from(bytes).toString("base64") };
    }
    default: throw new Error(`No real browser implementation is registered for MCP tool: ${name}`);
  }
}

export async function closeBrowserToolSession(): Promise<void> {
  await cdp?.close();
  cdp = null;
  activeTargetId = null;
  requests = [];
  consoleMessages = [];
}
