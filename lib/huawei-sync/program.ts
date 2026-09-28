// Executed only inside QuickJS. Keep this program host-independent for Chromium parity tests.
import { createHash } from "node:crypto";
export const FORM_PROGRAM = String.raw`function(input) {
  const clone = value => JSON.parse(JSON.stringify(value));
  const cfg = viewConfig.calc_view;
  if (!cfg || !Array.isArray(cfg.components)) throw Error('Missing calculator view');
  const words = Object.assign({}, input.language || {}, typeof lang === 'object' ? lang : {});
  const label = value => String(value == null ? '' : value).replace(/[A-Za-z][A-Za-z0-9]*_[0-9]+_/g, key => words[key] || key).replace(/<[^>]*>/g, '');
  const diagnostics = [];
  const fields = [];
  const values = {};
  const requested = input.values || {};
  const info = { region: input.region, chargeMode: 'ONDEMAND', locationType: 'commonAZ', tag: 'general.online.portal', siteCode: 'HWC' };
  const all = [];
  function collect(value) {
    if (!value || typeof value !== 'object') return;
    if (value.resourceType && value.resourceSpecCode && Array.isArray(value.planList)) { all.push(value); return; }
    Object.values(value).forEach(collect);
  }
  collect(input.products.product);
  if (!all.length) diagnostics.push('No products available');
  const pool = all.filter(p => p.planList.some(plan => plan.billingMode === 'ONDEMAND'));
  const data = {global_REGIONINFO: info};
  const rendered = {};
  const viewContexts = {};
  const sourceDefs = dataConfig.dataSources || [];
  const show = cfg.showConfigs || [];
  function resolve(key) {
    if (Object.prototype.hasOwnProperty.call(data, key)) return data[key];
    if (key.startsWith('hws.resource.type.')) return pool.filter(p => p.resourceType === key);
    if (Object.prototype.hasOwnProperty.call(words, key)) return words[key];
    return key;
  }
  function matches(product, rules) {
    if (!rules) return true;
    return rules.some(rule => {
      for (const key of ['regions','tags','chargeModes']) {
        const scalar = {regions:'region',tags:'tag',chargeModes:'chargeMode'}[key];
        if (rule[key] && !rule[key].includes(info[scalar])) return false;
      }
      for (const [key, value] of Object.entries(rule)) {
        if (['regions','tags','chargeModes'].includes(key)) continue;
        if (key === 'billingEvent') {
          if (!(product.planList || []).some(p => new RegExp(value).test(p.billingEvent || ''))) return false;
        } else if (!new RegExp(String(value)).test(String(product[key] == null ? '' : product[key]))) return false;
      }
      return true;
    });
  }
  function visible(id) {
    return show.filter(s => s.ids.includes(id)).every(s => {
      if (s.defaultShow === false) return false;
      if (s.chargeMode && ![s.chargeMode].flat().includes(info.chargeMode)) return false;
      if (s.regions && !s.regions.includes(info.region)) return false;
      if (s.switchs && !s.switchs.every(sw => {
        const match = sw.values.includes(data[sw.id]);
        return sw.type === 'inverse' ? !match : match;
      })) return false;
      if (s.checkboxs || s.otherDataSource) diagnostics.push('Unsupported visibility dependency on ' + id);
      return true;
    });
  }
  function numeric(id, title, settings, fallback) {
    const min = settings.min == null ? 1 : settings.min;
    const max = settings.max == null ? 99999999 : settings.max;
    const step = settings.step || 1;
    const value = Number(requested[id] == null ? (settings.defaultValue == null ? fallback : settings.defaultValue) : requested[id]);
    if (!Number.isFinite(value) || value < min || value > max || Math.abs((value-min)/step - Math.round((value-min)/step)) > 1e-8) throw Error('Invalid numeric value for ' + id);
    fields.push({id, label:label(title), type:'number', value, min, max, step});
    values[id] = value;
    return value;
  }
  function select(id, title, raw, order, labels) {
    const options = [...new Set(raw.map(String))];
    if (Array.isArray(order)) options.sort((a,b) => {
      const x=order.map(String).indexOf(a), y=order.map(String).indexOf(b);
      return (x<0?999999:x)-(y<0?999999:y);
    });
    if (!options.length) return null;
    const value = options.includes(String(requested[id])) ? String(requested[id]) : options[0];
    values[id] = value;
    fields.push({id, label:label(title), type:'select', value, options:options.map(v => ({value:v,label:label(labels ? labels[raw.map(String).indexOf(v)] : v)}))});
    return value;
  }
  function stepper(component, products, id, title) {
    const prefixes = component.prefixs || [];
    if (prefixes.length !== 1) { diagnostics.push('Multiple or missing measurement units on ' + id); return products; }
    const prefix = prefixes[0];
    const number = component.enumValues ? Number(select(id, title, component.enumValues, component.enumValues, component.enumLabels)) : numeric(id, title, prefix, 1);
    fields[fields.length-1].binding={component:id.split('.stepper')[0],key:'UNSET_Stepper_'+(id.split('.stepper')[1] || '0'),measureId:prefix.measureId};
    const target = component.target || 'ProductNum';
    const keys = {Resource:['resourceSize','resouceSizeMeasureId'], Usage:['usageValue','usageMeasureId'], ProductNum:['productNum','productNumMeasureId']}[target];
    if (!keys) { diagnostics.push('Unknown stepper target ' + target); return products; }
    return products.map(p => Object.assign({},p,{[keys[0]]:number,[keys[1]]:prefix.measureId}));
  }
  const components = cfg.components.filter(c => !c.id.startsWith('global_'));
  const pending = components.slice();
  const ids = components.map(c => c.id);
  let budget = pending.length + 1;
  while (pending.length && budget-- > 0) {
    let progress = false;
    for (let index=0;index<pending.length;) {
      const original = pending[index];
      const definition = sourceDefs.find(d => d.ids.includes(original.id)) || {};
      const dependencyKeys = [...(definition.cascadedSource?.inputs || []), ...(original.cascadedViewConfig?.inputs || [])];
      const deps = dependencyKeys.filter(k => ids.includes(k));
      if (deps.some(k => !Object.prototype.hasOwnProperty.call(data,k))) { index++; continue; }
      pending.splice(index,1); progress=true;
      const id=original.id;
      if (!visible(id)) { data[id]=[]; continue; }
      let component = original;
      if (original.cascadedViewConfig) {
        const context={defaultViewConfig:clone(original)};
        delete context.defaultViewConfig.cascadedViewConfig;
        viewContexts[id]=context;
        component=original.cascadedViewConfig.function.apply(context, original.cascadedViewConfig.inputs.map(resolve));
      }
      let products=[];
      if (definition.cascadedSource) products=definition.cascadedSource.function(...definition.cascadedSource.inputs.map(resolve)) || [];
      else for (const source of definition.sources || []) products.push(...pool.filter(p => p.resourceType === source.param && matches(p, source.rules)));
      if (!Array.isArray(products)) { diagnostics.push('Non-product data source for ' + id); data[id]=[]; continue; }
      products=clone(products);
      if (component.type === 'CommonTip') { data[id]=products; continue; }
      if (!products.length && component.type !== 'CommonSwitch') { data[id]=[]; continue; }
      if (component.type === 'CommonSelect' || component.type === 'CommonRadioGroup') {
        for (const [i,key] of (component.optionKeys || []).entries()) {
          const raw=products.map(p=>p[key]).filter(v=>v!=null && v!=='');
          const value=select(id+'.'+key, component.titles?.[i] || key, raw, component.sortMethods?.[i]);
          if (value!=null) products=products.filter(p=>String(p[key])===value);
        }
        for (const [i,s] of (component.steppers || []).entries()) {
          const matching=products.filter(p=>matches(p,s.rules));
          if (matching.length) {
            const changed=stepper(s,matching,id+'.stepper'+i,s.title || component.titles?.at(-1) || 'Quantity');
            products=products.filter(p=>!matching.includes(p)).concat(changed);
          }
        }
      } else if (component.type === 'CommonStepper') {
        products=stepper(component,products,id,component.title || id);
      } else if (component.type === 'CommonSwitch') {
        const raw=component.enumValues || [...new Set(products.map(p=>p[component.optionKey]))];
        const value=select(id,component.title || id,raw,raw,component.enumLabels);
        if (value!=null) fields[fields.length-1].binding={component:id,key:'UNSET_Switch'};
        data[id]=value;
        continue;
      } else { diagnostics.push('Unsupported component ' + component.type + ' (' + id + ')'); }
      data[id]=products;
      rendered[id]=products;
    }
    if (!progress) break;
  }
  if (pending.length) diagnostics.push('Unresolved dependencies: ' + pending.map(c=>c.id).join(', '));
  let durationConfig=cfg.components.find(c=>c.id==='global_ONDEMANDTIME') || {prefixs:[{measureId:4,min:1,max:9999,defaultValue:1}]};
  if (durationConfig.cascadedViewConfig) durationConfig=durationConfig.cascadedViewConfig.function.apply({defaultViewConfig:clone(durationConfig)},durationConfig.cascadedViewConfig.inputs.map(resolve));
  const unit=durationConfig.prefixs?.[0] || {measureId:4,min:1,max:9999};
  const duration=Number(input.duration == null ? (unit.defaultValue || 1) : input.duration);
  const quantity=Number(input.quantity == null ? 1 : input.quantity);
  if (!Number.isFinite(duration) || duration < (unit.min ?? 1) || duration > (unit.max ?? 9999) || !Number.isInteger(duration)) throw Error('Invalid duration');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) throw Error('Invalid quantity');
  data.global_ONDEMANDTIME={UNSET_Stepper_0:{measureValue:duration,measureId:unit.measureId}};
  data.global_QUANTITY={UNSET_Stepper_0:{measureValue:quantity,measureId:41}};
  for (const [id,products] of Object.entries(rendered)) {
    rendered[id]=products.map(p=>{
      const plan=p.planList?.find(plan=>plan.billingMode==='ONDEMAND');
      if (!plan) {diagnostics.push('No matching billing plan for '+p.resourceSpecCode); return p;}
      const product=Object.assign({},plan,p); delete product.planList;
      product.inquiryTag='normal'; product.productNum=(product.productNum || 1)*(visible('global_QUANTITY') ? quantity : 1);
      if (['duration','Duration','period'].includes(product.usageFactor)) {product.usageValue=duration; product.usageMeasureId=unit.measureId;}
      else {product.durationNum=duration; product.productNum*=duration;}
      return product;
    });
  }
  for (const id of Object.keys(rendered)) {
    const hook=(funcConfig.calc?.parseSelectProduct || []).find(f=>f.id===id);
    if (hook) rendered[id]=hook.function.apply({translate:label,toThousands:n=>String(n)},hook.inputs.map(k=>rendered[k] || data[k] || k));
  }
  const products=Object.values(rendered).flat().filter(p=>p.inquiryTag);
  const productInfos=products.map((p,i)=>{
    const result={id:String(i),cloudServiceType:p.cloudServiceType,resourceType:p.resourceType,resourceSpecCode:p.resourceSpecCode,productNum:p.productNum};
    if (p.resourceSize!=null && p.resouceSizeMeasureId!=null) {result.resourceSize=p.resourceSize;result.resouceSizeMeasureId=p.resouceSizeMeasureId;}
    if (p.usageFactor && p.usageValue!=null && p.usageMeasureId!=null) {result.usageFactor=p.usageFactor;result.usageValue=p.usageValue;result.usageMeasureId=p.usageMeasureId;}
    if (p.skuCode || p.supportBizExt || p._injectedMode) diagnostics.push('Unsupported billing extension for '+p.resourceSpecCode);
    return result;
  });
  if (!productInfos.length) diagnostics.push('No billable products selected');
  const inquiry=diagnostics.length ? null : {regionId:info.region,chargingMode:1,periodType:4,periodNum:1,subscriptionNum:1,siteCode:'HWC',productInfos};
  return {fields,values,diagnostics:[...new Set(diagnostics)],inquiry,duration:{value:duration,measureId:unit.measureId,min:unit.min??1,max:unit.max??9999}};
}`;

export const INSPECT_PROGRAM = String.raw`function() {
  const callbacks=[];
  function visit(value,path) {
    if (typeof value==='function') {callbacks.push({path,source:String(value)});return;}
    if (value && typeof value==='object') for(const [key,item] of Object.entries(value)) visit(item,path.concat(key));
  }
  visit({dataConfig,viewConfig,funcConfig},[]);
  return {components:(viewConfig.calc_view?.components || []).map(c=>({id:c.id,type:c.type || 'global'})),callbacks};
}`;

export const ENGINE_VERSION = createHash("sha256").update("quickjs-0.32.0:" + FORM_PROGRAM + INSPECT_PROGRAM).digest("hex");
