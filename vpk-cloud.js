/* vpk-cloud.js — облачное хранение данных «Заказчиков» и «План-факта».
 *
 * Каждый ключ (vpk_cust_sums, vpk_plan, …) лежит отдельной строкой в Supabase
 * (таблица storage, как vpk_contracts_v3) и копией в localStorage (офлайн-кэш).
 *
 * Правки не перетирают чужие: при сохранении берётся свежая версия из облака,
 * на неё накладываются только записи, изменённые в этом браузере (diff против
 * последней известной облачной версии — «базы»), и результат отправляется обратно.
 *
 * Виды значений:
 *   'map'  — объект {id: значение}; diff по id
 *   'list' — массив объектов с полем id; diff по id, порядок сохраняется
 *   'set'  — массив строк; diff по элементам
 */
(function(){
  var URL_='https://urfnpjumxkewyizaxgns.supabase.co/rest/v1/storage';
  var KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZm5wanVteGtld3lpemF4Z25zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMzkyNDMsImV4cCI6MjA5MTgxNTI0M30.vDbdyE3Z4whApQo50Mfgor11SL-dT1PWDOygipxVKtE';
  var HDR={'apikey':KEY,'Authorization':'Bearer '+KEY};
  var BASE_PREFIX='vpk_cloudbase:';
  var POLL_MS=30000;

  var keys={};      // key → {kind, get, set, readonly}
  var base={};      // key → последняя известная облачная версия (как map)
  var timers={};
  var chain=Promise.resolve();
  var onRemote=function(){};
  var statusEl=null;

  function J(v){return JSON.stringify(v);}
  function clone(v){return v===undefined?undefined:JSON.parse(J(v));}

  /* ---- нормализация в map и обратно ---- */
  function toMap(kind,v){
    var m={};
    if(kind==='list'){(v||[]).forEach(function(x){if(x&&x.id!=null)m[x.id]=x;});}
    else if(kind==='set'){(v||[]).forEach(function(x){m[x]=true;});}
    else m=v&&typeof v==='object'?v:{};
    return m;
  }
  function fromMap(kind,m,orderHint){
    if(kind==='set')return Object.keys(m);
    if(kind==='list'){
      var out=[],seen={};
      (orderHint||[]).forEach(function(x){if(x&&m[x.id]!==undefined&&!seen[x.id]){out.push(m[x.id]);seen[x.id]=1;}});
      Object.keys(m).forEach(function(id){if(!seen[id])out.push(m[id]);});
      return out;
    }
    return m;
  }
  /* изменения local относительно b: {set:{id:v}, del:[id]} */
  function diff(b,l){
    var d={set:{},del:[],n:0};
    Object.keys(l).forEach(function(id){if(!(id in b)||J(b[id])!==J(l[id])){d.set[id]=l[id];d.n++;}});
    Object.keys(b).forEach(function(id){if(!(id in l)){d.del.push(id);d.n++;}});
    return d;
  }
  function apply(r,d){
    var m=clone(r)||{};
    Object.keys(d.set).forEach(function(id){m[id]=clone(d.set[id]);});
    d.del.forEach(function(id){delete m[id];});
    return m;
  }

  /* ---- localStorage ---- */
  function lsGet(k){try{var v=localStorage.getItem(k);return v==null?undefined:JSON.parse(v);}catch(e){return undefined;}}
  function lsSet(k,v){try{localStorage.setItem(k,J(v));}catch(e){}}
  function saveBase(k){if(!keys[k].readonly)lsSet(BASE_PREFIX+k,base[k]);}

  /* ---- сеть ---- */
  function fetchKeys(list){
    var q='?select=key,value&key=in.('+list.map(encodeURIComponent).join(',')+')';
    return fetch(URL_+q,{headers:HDR,cache:'no-store'}).then(function(r){
      if(!r.ok)throw new Error('HTTP '+r.status);return r.json();
    }).then(function(rows){
      var out={};
      (rows||[]).forEach(function(row){
        try{out[row.key]=typeof row.value==='string'?JSON.parse(row.value):row.value;}catch(e){}
      });
      return out;
    });
  }
  function put(k,value){
    return fetch(URL_,{method:'POST',headers:Object.assign({'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},HDR),
      body:J({key:k,value:J(value)})}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);});
  }

  function status(ok,text){
    if(!statusEl){
      statusEl=document.createElement('div');
      statusEl.style.cssText='position:fixed;right:10px;bottom:8px;z-index:9999;font:11px/1.4 system-ui,sans-serif;padding:3px 9px;border-radius:10px;pointer-events:none;opacity:.85';
      document.body.appendChild(statusEl);
    }
    statusEl.textContent=text;
    statusEl.style.background=ok?'#dcfce7':'#fee2e2';
    statusEl.style.color=ok?'#166534':'#991b1b';
  }

  /* Применить облачное значение k к странице (и кэшу) */
  function adopt(k,remoteMap){
    var c=keys[k];
    var cur=c.get();
    var val=fromMap(c.kind,remoteMap,c.kind==='list'?cur:null);
    base[k]=clone(remoteMap);saveBase(k);
    if(J(toMap(c.kind,cur))!==J(remoteMap)){c.set(clone(val));lsSet(k,val);return true;}
    lsSet(k,val);
    return false;
  }

  /* Сохранить локальные изменения k: свежая версия из облака + наш diff */
  function sync(k){
    var c=keys[k];
    chain=chain.then(function(){
      return fetchKeys([k]).then(function(rem){
        var rMap=rem[k]!==undefined?toMap(c.kind,rem[k]):{};
        var d=diff(base[k]||{},toMap(c.kind,c.get()));
        if(!d.n){return adopt(k,rMap);}
        var merged=apply(rMap,d);
        var val=fromMap(c.kind,merged,c.kind==='list'?c.get():null);
        return put(k,val).then(function(){status(true,'☁ Сохранено');return adopt(k,merged);});
      });
    }).then(function(changed){if(changed)onRemote([k]);},function(e){
      status(false,'⚠ Не сохранено в облако — повторю');
      console.warn('vpk-cloud',k,e);
    });
    return chain;
  }

  var VPKCloud={
    /* register(key, {kind, get, set, readonly}) */
    register:function(k,opt){keys[k]=opt;},
    onRemote:function(fn){onRemote=fn;},
    /* Вызывать после каждой локальной правки ключа */
    save:function(k,delay){
      var c=keys[k];if(!c||c.readonly)return;
      lsSet(k,c.get());
      clearTimeout(timers[k]);
      timers[k]=setTimeout(function(){sync(k);},delay==null?600:delay);
    },
    /* Первая загрузка + периодический опрос */
    start:function(){
      var list=Object.keys(keys);
      var first=true;
      function poll(){
        return fetchKeys(list).then(function(rem){
          var changed=[];
          list.forEach(function(k){
            var c=keys[k];
            var rMap=rem[k]!==undefined?toMap(c.kind,rem[k]):undefined;
            if(c.readonly){if(rMap!==undefined&&adopt(k,rMap))changed.push(k);return;}
            if(first&&base[k]===undefined){
              // Этот браузер ещё не работал с облаком: объединяем — облако + записи,
              // которых в облаке нет (ничего из облака не удаляем и не перезаписываем).
              var lMap=toMap(c.kind,c.get());
              var add={set:{},del:[],n:0};
              Object.keys(lMap).forEach(function(id){if(!rMap||!(id in rMap)){add.set[id]=lMap[id];add.n++;}});
              base[k]=rMap?clone(rMap):{};
              if(rMap&&adopt(k,rMap))changed.push(k);
              if(add.n){c.set(fromMap(c.kind,apply(toMap(c.kind,c.get()),add),c.kind==='list'?c.get():null));sync(k);}
              return;
            }
            var pending=diff(base[k]||{},toMap(c.kind,c.get())).n>0;
            if(pending){sync(k);return;}                // есть несохранённое — досылаем с слиянием
            if(rMap!==undefined&&J(rMap)!==J(base[k])&&adopt(k,rMap))changed.push(k);
          });
          first=false;
          status(true,'☁ Облако: синхронизировано');
          if(changed.length)onRemote(changed);
        }).catch(function(e){
          status(false,'⚠ Нет связи с облаком — данные пока только в этом браузере');
          console.warn('vpk-cloud poll',e);
        });
      }
      list.forEach(function(k){if(!keys[k].readonly){var b=lsGet(BASE_PREFIX+k);if(b!==undefined)base[k]=b;}});
      var p=poll();
      setInterval(poll,POLL_MS);
      return p;
    }
  };
  window.VPKCloud=VPKCloud;
})();
