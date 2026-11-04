var rangeResultFromTasks=false;
var rangeMode="district", rangeResultsDirty=false, lastRangeResults=null, lastRangeConfig=null;
"use strict";
/* V17 业务流程示例；视觉、图表与交接按 AI 管家规范重新实现。 */

/* =====================================================================
   智能选址双入口原型 · 交互脚本（纯原生 JS，零依赖）
   ===================================================================== */
'use strict';
var $ = function(s){ return document.querySelector(s); };
var $$ = function(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); };
/* V3：尊重系统「减少动态效果」（countUp / 锚点平滑滚动共用） */
var reduceMotion = !!(typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
/* ---- V3 P1：无障碍通用工具 ---- */
/* 装饰性 SVG 标记（按钮内图标 / 首页装饰 / logo） */
function markDecorative(root){
  var scope = root || document;
  if(!scope.querySelectorAll) return;
  var list = Array.prototype.slice.call(scope.querySelectorAll('button > svg, a > svg, .brand-logo svg'));
  list.forEach(function(s){
    if(!s.setAttribute) return;
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
  });
}
/* 图标按钮 / 跳转按钮：补齐可访问名称（title 不足以被读屏稳定识别） */
var GO_LABELS = { home:'返回首页', config:'修改任务', workbench:'返回工作台', assess:'意向场地评估', region:'区域详情' };
function labelIconButtons(){
  $$('[data-go]').forEach(function(b){
    var t = b.getAttribute('data-go');
    if(!b.getAttribute('aria-label')) b.setAttribute('aria-label', b.textContent.trim() || b.title || GO_LABELS[t] || '返回');
  });
}
/* 焦点圈闭：Tab 在容器内循环 */
function trapFocus(root){
  if(!root || !root.addEventListener) return;
  if(root._trap) return;
  root._trap = true;
  root.addEventListener('keydown', function(e){
    if(e.key !== 'Tab') return;
    if(!root.querySelectorAll) return;
    var list = Array.prototype.slice.call(root.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter(function(el){ return !el.disabled; });
    if(!list.length) return;
    var first = list[0], last = list[list.length - 1];
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  });
}

/* ---------- 基础工具 ---------- */
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
var toastTimer=null,toastRemovalTimer=null;
function toast(msg, type){
  type = type || 'info';
  var icons = {
    ok:'<img class="ui-icon" src="./assets/control-90bacc1d8c.svg" alt="">',
    info:'<img class="ui-icon" src="./assets/control-f28136c705.svg" alt="">',
    warn:'<img class="ui-icon" src="./assets/control-b887d42630.svg" alt="">',
    err:'<img class="ui-icon" src="./assets/control-a2860b2188.svg" alt="">'
  };
  clearTimeout(toastTimer);
  clearTimeout(toastRemovalTimer);
  var box = $('#toastBox');
  var t = box.querySelector('.toast') || document.createElement('div');
  t.className = 'toast show ' + type;
  t.innerHTML = icons[type] + '<span>' + esc(msg) + '</span>';
  box.replaceChildren(t);
  toastTimer=setTimeout(function(){
    t.classList.remove('show');
    toastRemovalTimer=setTimeout(function(){ t.remove(); },300);
  },3000);
}
/* 数字滚动（默认 600ms ease-out） */
function countUp(el, to, opts){
  if(el)el.dataset.finalValue=to;
  if(!el) return;
  opts = opts || {};
  var dur = opts.dur || 600, dec = (opts.dec !== undefined) ? opts.dec : 0;
  var from = (opts.from !== undefined) ? opts.from : 0, suffix = opts.suffix || '';
  if(reduceMotion){ el.textContent = Number(to).toFixed(dec) + suffix; return; }
  var t0 = null;
  function frame(ts){
    if(t0 === null) t0 = ts;
    var p = Math.min((ts - t0) / dur, 1);
    var e = 1 - Math.pow(1 - p, 3);
    el.textContent = (from + (to - from) * e).toFixed(dec) + suffix;
    if(p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
/* 列表 stagger 入场（每项延迟 30ms，仅首次） */
var _stagged = {};
function staggerOnce(key, list){
  if(_stagged[key]) return;
  _stagged[key] = true;
  list.forEach(function(c, i){
    c.style.animationDelay = (i * 30) + 'ms';
    c.classList.add('st-in');
  });
}
/* 数据来源标签 */
function tag(kind){
  var map = { tested:['tag-tested','实测'], official:['tag-official','官方'], model:['tag-model','模型估算'], none:['tag-none','暂无数据'] };
  var m = map[kind] || map.none;
  return '<span class="tag ' + m[0] + '"><i></i>' + m[1] + '</span>';
}
/* SVG 雷达图生成器 */
function radarSVG(labels, vals, size){
  size = size || 250;
  /* 长维度名（>4 字）时内收主半径，避免左右顶点标签溢出画布 */
  var pad = Math.max.apply(null, labels.map(function(l){ return l.length; })) > 4 ? 60 : 44;
  var cx = size/2, cy = size/2, R = size/2 - pad, n = labels.length;
  function pt(i, r){
    var a = -Math.PI/2 + i * 2 * Math.PI / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }
  var s = '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">';
  [0.25,0.5,0.75,1].forEach(function(f){
    var p = '';
    for(var i=0;i<n;i++){ var q = pt(i, R*f); p += q[0].toFixed(1)+','+q[1].toFixed(1)+' '; }
    s += '<polygon points="'+p+'" fill="none" stroke="#e4e7ec" stroke-width="1"/>';
  });
  for(var i=0;i<n;i++){
    var q = pt(i, R);
    s += '<line x1="'+cx+'" y1="'+cy+'" x2="'+q[0].toFixed(1)+'" y2="'+q[1].toFixed(1)+'" stroke="#e4e7ec" stroke-width="1"/>';
  }
  var poly = '', dots = '';
  for(var i=0;i<n;i++){
    var q = pt(i, R * Math.max(0.03, vals[i]/100));
    poly += q[0].toFixed(1)+','+q[1].toFixed(1)+' ';
    dots += '<circle cx="'+q[0].toFixed(1)+'" cy="'+q[1].toFixed(1)+'" r="3.5" fill="#315eef"/>';
  }
  s += '<polygon points="'+poly+'" fill="rgba(49,94,239,.14)" stroke="#315eef" stroke-width="2" stroke-linejoin="round"/>' + dots;
  for(var i=0;i<n;i++){
    var q = pt(i, R + 22);
    s += '<text x="'+q[0].toFixed(1)+'" y="'+(q[1]-4).toFixed(1)+'" text-anchor="middle" font-size="12" fill="#4b5563">'+esc(labels[i])+'</text>';
    s += '<text x="'+q[0].toFixed(1)+'" y="'+(q[1]+11).toFixed(1)+'" text-anchor="middle" font-size="12" font-weight="700" fill="#315eef">'+vals[i]+'</text>';
  }
  return s + '</svg>';
}

/* ---------- V3 P1：删除确认（E-3 降级方案） ---------- */
var confirmCb = null, confirmOpener = null;
function askConfirm(desc, cb){
  var box = $('#confirmModal');
  if(!box) { if(cb) cb(); return; }
  $('#confirmDesc').textContent = desc;
  confirmCb = cb || null;
  confirmOpener = document.activeElement;
  box.classList.add('show');
  var y = $('#confirmYes'); if(y && y.focus) y.focus();
}
function closeConfirm(v){
  var box = $('#confirmModal');
  if(box) box.classList.remove('show');
  var cb = confirmCb; confirmCb = null;
  if(confirmOpener && confirmOpener.focus){ try { confirmOpener.focus(); } catch(e){} }
  confirmOpener = null;
  if(v && cb) cb();
}
(function(){
  var yes = $('#confirmYes'), no = $('#confirmNo'), box = $('#confirmModal');
  if(yes) yes.addEventListener('click', function(){ closeConfirm(true); });
  if(no) no.addEventListener('click', function(){ closeConfirm(false); });
  if(box) box.addEventListener('click', function(e){ if(e.target === box) closeConfirm(false); });
})();

/* ---------- 视图切换（R11：工作台已并入首页，剩 4 屏） ---------- */
function go(id){
  $$('.view').forEach(v=>v.classList.remove('active'));
  var v=$('#view-'+id);if(v)v.classList.add('active');
  var detail=id==='region'||id==='assess';
  $('.page-tabs').hidden=detail;
  if(id==='home'||id==='tasks'){
    var tab=id==='tasks'?'tasks':(document.querySelector('#panel-assess.on')?'assess':'explore');
    $$('.ptab').forEach(t=>{var on=t.dataset.htab===tab;t.classList.toggle('on',on);t.setAttribute('aria-selected',String(on));});
  }
  $('.content').scrollTop=0;window.scrollTo(0,0);
  if(id==='tasks')staggerOnce('taskrows',$$('#taskListBody tr'));
}
function setHomeTab(name){
  if(name==='tasks'){go('tasks');return;}
  $('#panel-explore').classList.toggle('on',name==='explore');
  $('#panel-assess').classList.toggle('on',name==='assess');
  go('home');
}
$$('.ptab').forEach(t=>t.addEventListener('click',()=>setHomeTab(t.dataset.htab)));

/* data-go 快捷跳转 / data-scroll 平滑滚动 */
document.addEventListener('click', function(e){
  var g = e.target.closest('[data-go]');
  if(g){
    var target = g.getAttribute('data-go');
    /* R10：config / assess 两个视图已并入首页双 Tab，旧路由重定向到对应 Tab
       R11：workbench 视图已删除，同样重定向回首页 Tab1 */
    if(target === 'assess'){ go('home'); setHomeTab('assess'); return; }
    if(target === 'config' || target === 'workbench'){ go('home'); setHomeTab('explore'); return; }
    if(target==='home' && $('#view-assess').classList.contains('active')){setHomeTab('assess');return;}
    go(target);
    return;
  }
  var sc = e.target.closest('[data-scroll]');
  if(sc){
    var el = $('#' + sc.getAttribute('data-scroll'));
    if(el) el.scrollIntoView({ block:'start', behavior:'smooth' });   /* 用户主动点击，属预期整页滚动 */
  }
});

/* =====================================================================
   意向场地评估 · 场地数据与可行性报告
   ===================================================================== */
var stations = [
  {id:'s1', name:'历下奥体中心场地', dist:'历下区', piles:12, power:'120kW×12', score:72, grade:'C', last:'10-09', main:'接电距离 1.2km，需新建专变'},
  {id:'s2', name:'高新万达广场场地',     dist:'高新区', piles:16, power:'120kW×16', score:78, grade:'B', last:'10-08', main:'3km 内竞品密集，价格战风险'},
  {id:'s3', name:'市南滨海快充场地', dist:'青岛市', piles:8,  power:'160kW×8',  score:87, grade:'A', last:'10-07', main:'无明显硬约束'},
  {id:'s5', name:'市中领秀城场地',       dist:'市中区', piles:6,  power:'120kW×6',  score:81, grade:'B', last:'10-05', main:'车位产权待确权'},
  {id:'s6', name:'槐荫和谐广场场地',     dist:'槐荫区', piles:9,  power:'120kW×9',  score:58, grade:'D', last:'10-04', main:'多项硬约束不达标'},
  {id:'s7', name:'章丘双山政务区场地',   dist:'章丘区', piles:4,  power:'120kW×4',  score:84, grade:'A', last:'10-03', main:'租期仅 3 年，偏短'},
  {id:'s8', name:'历城唐冶中心场地',     dist:'历城区', piles:8,  power:'120kW×8',  score:76, grade:'B', last:'10-02', main:'电网容量接近上限'}
];

/* 评估流步骤管理（R10：步骤1 选场地已并入首页 Tab2，此处只管报告步骤的显隐） */
function setAssessStep(n){
  var s2 = $('#astep2');
  if(s2) s2.classList.toggle('active', n === 2);
  var anchor = $('#rpAnchor');
  if(anchor) anchor.hidden = (n !== 2);
  if(n !== 2) renderAssessContext(null);
}
/* 场地上下文：页头 + 锚点条常驻（V3 ⑤-2 / ux 5.2） */
function renderAssessContext(st){
  var e = $('#assessEntity'), a = $('#anchorSite');
  if(!st){
    if(e) e.textContent = '请选择意向场地';
    if(a) a.textContent = '未选择场地';
    return;
  }
  if(e) e.textContent = st.name + ' · ' + st.dist + ' · 评估于 ' + (st.last || '—');
  if(a) a.textContent = st.name;
  renderAssessReportContext(st);
}

/* ---------- R10：候选场地库地图（橙点点位）+ 场地位置选点（地图选点 / 搜索地址） ---------- */
/* 演示 POI（搜索地址联想候选；仅当前城市的区县生效） */
var AS_POIS = [
  {name:'高新会展中心', dist:'高新区', x:762, y:300},
  {name:'奥体中心南门', dist:'历下区', x:566, y:338},
  {name:'济南东站西广场', dist:'历城区', x:836, y:428},
  {name:'领秀城商业街', dist:'市中区', x:468, y:522},
  {name:'和谐广场', dist:'槐荫区', x:276, y:380},
  {name:'济南西站东广场', dist:'槐荫区', x:184, y:418},
  {name:'泺口服装城', dist:'天桥区', x:368, y:198},
  {name:'唐冶绿地中心', dist:'历城区', x:852, y:560},
  {name:'章丘双山政务区', dist:'章丘区', x:938, y:232}
];
var asLoc = null;           /* 已选场地位置 {name, dist, x, y} */
var asPicking = false;      /* 「地图选点」激活态：地图十字光标待点 */
function asLayer(cls){
  var svg = $('#asMap');
  if(!svg) return null;
  var g = svg.querySelector('.' + cls);
  if(!g){
    g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('class', cls);
    svg.appendChild(g);
  }
  return g;
}
/* 已有场地 → 地图点位：自建场地用自带坐标；预置场地按区县标注位错开排布 */
function pinPos(st, i){
  if(st.x != null && st.y != null) return {x:st.x, y:st.y};
  var labels = DIST_LABELS[cfg.city] || DIST_LABELS['济南市'];
  var hit = labels.filter(function(l){ return l[0] === st.dist; })[0] || labels[i % labels.length];
  return {x: hit[1] + ((i % 3) - 1) * 30, y: hit[2] + (Math.floor(i / 3) % 3 - 1) * 26};
}
function renderAsPins(){
  var svg = $('#asMap');
  if(!svg) return;
  var g = asLayer('as-pins');
  if(!g) return;
  g.innerHTML = stations.map(function(s, i){
    var p = pinPos(s, i);
    var nm = s.name.length > 8 ? s.name.slice(0, 7) + '…' : s.name;
    return '<g class="as-pin" data-sid="' + s.id + '" transform="translate(' + p.x.toFixed(0) + ',' + p.y.toFixed(0) + ')">'
      + '<circle class="halo2" r="10"/><circle class="dot" r="5"/>'
      + '<text y="21" text-anchor="middle">' + esc(nm) + ' ' + s.score + '</text></g>';
  }).join('');
}
/* 新场地点位标记（蓝标） */
function renderAsPick(){
  var g = asLayer('as-pick');
  if(!g) return;
  g.innerHTML = asLoc
    ? '<g class="as-pick-mark" transform="translate(' + asLoc.x + ',' + asLoc.y + ')">'
      + '<circle class="ring" r="16"/><circle class="core" r="5.5"/>'
      + '<text y="-22" text-anchor="middle">' + esc(asLoc.name) + '</text></g>'
    : '';
}
function setAsLoc(p){
  asLoc = p;
  var bar = $('#asLocBar');
  if(bar) bar.classList.remove('err');
  $('#asAddrSearch').value = p.name;
  $('#asLocClear').style.display = '';
  setPicking(false);        /* 选定即退出选点态 */
  renderAsPick();
}
function clearAsLoc(){
  asLoc = null;
  var bar = $('#asLocBar');
  if(bar) bar.classList.remove('err');
  $('#asAddrSearch').value = '';
  $('#asLocClear').style.display = 'none';
  $('#asSugg').classList.remove('show');
  renderAsPick();
}
$('#asLocClear').addEventListener('click', clearAsLoc);
/* 「地图选点」按钮：点亮后地图呈十字光标，点击地图放置定位点（选完自动熄灭） */
function setPicking(on){
  asPicking = on;
  var btn = $('#asPickBtn'), m = $('#asMap'), ipt = $('#asAddrSearch');
  if(btn) btn.classList.toggle('on', on);
  if(m) m.classList.toggle('pick-mode', on);
  if(ipt) ipt.placeholder = on ? '请在左侧地图点击放置定位点' : '搜索地点名称或点击地图选点';
  var s = $('#asSugg');
  if(s && on) s.classList.remove('show');
}
/* 搜索地址：输入 → POI 联想（仅当前城市）；输入即退出地图选点态 */
$('#asAddrSearch').addEventListener('input', function(){
  if(asPicking) setPicking(false);
  if(asLoc){asLoc=null;renderAsPick();$('#asLocClear').style.display='none';}
  $('#asLocClear').style.display=this.value?'':'none';
  var kw = this.value.trim().toLowerCase();
  var list = AS_POIS.filter(function(q){
    return curDistricts().indexOf(q.dist) > -1 && (!kw || q.name.toLowerCase().indexOf(kw) > -1 || q.dist.indexOf(kw) > -1);
  });
  var box = $('#asSugg');
  box.innerHTML = list.length
    ? list.map(function(q){
        return '<button class="it" type="button" data-name="' + esc(q.name) + '">'
          + '<img class="ui-icon" src="./assets/control-d8fd3c166c.svg" alt="">'
          + esc(q.name) + '<small>' + q.dist + '</small></button>';
      }).join('')
    : '<div class="empty">未找到匹配地址，可直接点击地图选点</div>';
  box.classList.add('show');
});
$('#asSugg').addEventListener('click', function(e){
  var it = e.target.closest('.it');
  if(!it) return;
  var q = AS_POIS.filter(function(x){ return x.name === it.getAttribute('data-name'); })[0];
  if(!q) return;
  $('#asAddrSearch').value = q.name;
  $('#asSugg').classList.remove('show');
  setAsLoc({name:q.name, dist:q.dist, x:q.x, y:q.y});
  toast('已定位：' + q.name + '（' + q.dist + '）', 'ok');
});
document.addEventListener('click', function(e){
  var s = $('#asSugg');
  if(s && s.classList.contains('show') && !$('#asLocBar').contains(e.target)) s.classList.remove('show');
});
/* 地图选点：就近反查 POI / 区县标注，生成位置名并自动匹配区县 */
function pickAsLoc(x, y){
  var labels = DIST_LABELS[cfg.city] || DIST_LABELS['济南市'];
  var near = labels[0], best = Infinity;
  labels.forEach(function(l){
    var d = (l[1] - x) * (l[1] - x) + (l[2] - y) * (l[2] - y);
    if(d < best){ best = d; near = l; }
  });
  var poi = null, bp = 62 * 62;
  AS_POIS.forEach(function(q){
    var d = (q.x - x) * (q.x - x) + (q.y - y) * (q.y - y);
    if(d < bp){ bp = d; poi = q; }
  });
  var p = {name: poi ? poi.name + '（附近）' : near[0] + ' · 自选点', dist: near[0], x:+x.toFixed(0), y:+y.toFixed(0)};
  setAsLoc(p);
  toast('已选点：' + p.name, 'ok');
}
/* 候选库地图点击：橙点 = 评估该场地；空白处 = 选点态下放置新点位 */
$('#asMap').addEventListener('click', function(e){
  var pin = e.target.closest('.as-pin');
  if(pin && !pin.classList.contains('dim')){selectAssessSite(pin.getAttribute('data-sid'));return;}
  if(assessResult)return;
  var p = svgPoint(e, this);
  if(p) pickAsLoc(p.x, p.y);
});
var newSiteSeq = 0;
/* 校验失败：字段高亮 + 聚焦，表单保持原位 */
function fieldError(sel, msg){
  var el = $(sel);
  if(el){
    el.classList.add('err');
    el.setAttribute('aria-invalid', 'true');
    /* 紧邻字段的错误文本 role=alert + aria-describedby 关联 */
    var box = el.parentNode;
    var tip = document.createElement('div');
    tip.className = 'field-err';
    tip.setAttribute('role', 'alert');
    tip.textContent = msg;
    if(el.id){ tip.id = el.id + '-err'; el.setAttribute('aria-describedby', tip.id); }
    if(box && box.appendChild) box.appendChild(tip);
    var off = function(){
      el.classList.remove('err');
      el.setAttribute('aria-invalid', 'false');
      el.removeAttribute && el.removeAttribute('aria-describedby');
      if(tip && tip.parentNode) tip.parentNode.removeChild(tip);
      el.removeEventListener('input', off);
      el.removeEventListener('change', off);
    };
    el.addEventListener('input', off);
    el.addEventListener('change', off);
    el.focus();
  }
  toast(msg, 'warn');
}
/* 投资预算档位 → 可支撑桩数上限（按 25 万/桩 综合造价估算：100万≈4桩 / 200万≈8桩 / 300万≈12桩） */
var BUDGET_PILES = {'≤100万':4, '100-200万':8, '200-300万':12, '≥300万':16, '不限':99};
function overBudget(piles, budget){
  return BUDGET_PILES[budget] != null && piles > BUDGET_PILES[budget];
}
function newSiteScore(piles, rent, siteType, budget){
  var score = 79;
  score -= Math.min(8, Math.max(0, rent - 10) * .45);
  if(piles >= 12) score += 2;                                  /* 规模效应摊薄成本 */
  if(overBudget(piles, budget)) score -= 4;                    /* 估算投资超预算档位 */
  return Math.max(45, Math.min(88, Math.round(score)));
}
function newSiteRisk(rent, piles, budget){
  if(rent > 20) return '年租金偏高，需复核收益空间';
  if(overBudget(piles, budget)) return '按 25 万/桩估算投资超出预算档位，需复核规模或预算';
  return '暂无明显硬约束，关键数据待线下核验';
}
/* ---------- R10：评估意向场地 = 进 Tab2 直接配置（原新增抽屉内联为表单） ---------- */
/* 分段选择（场地类型 / 建站目标）：值在提交时读取；预算为下拉 */
/* 场地面积 → 桩数实时换算（30㎡/桩：含车位、通道与设备区），提交时作为评估规模 */
$('#asArea').addEventListener('input', function(){
  var tip = $('#asAreaTip');
  var area = parseFloat(this.value);
  if(area > 0){
    tip.innerHTML = '≈ <b>' + Math.max(1, Math.round(area / 30)) + ' 桩</b>（按 30㎡/桩 估算，提交后作为评估规模）';
  } else {
    tip.textContent = '';
  }
});
/* 开始可行性评估：校验 → 模型初评 → 直接进报告页（区县由选点自动带入；功率按 120kW 基准） */
$('#btnAssessStart').addEventListener('click', function(){
  /* 校验失败：位置框高亮提示，不进报告 */
  if(!asLoc){
    var mbox = $('#asLocBar');
    mbox.classList.add('err');
    setTimeout(function(){ mbox.classList.remove('err'); }, 2400);
    toast('请先确定场地位置：搜索地址或地图选点', 'warn');
    return;
  }
  for(const [sel,label,min] of [['#asArea','场地面积',30],['#asRent','年租金',0]]){
    const raw=$(sel).value.trim();if(raw!==''&&(!Number.isFinite(Number(raw))||Number(raw)<min)){fieldError(sel,label+'需填写不小于'+min+'的数值');return;}
  }
  var name = asLoc.name;
  var area = parseFloat($('#asArea').value) || 0;
  var piles = area > 0 ? Math.max(1, Math.round(area / 30)) : 8;
  var typeBtn = $('#asType input:checked');
  var siteType = typeBtn ? typeBtn.value : '公共快充站';
  var rentRaw = $('#asRent').value.trim();
  var rent = rentRaw === '' ? null : Number(rentRaw);
  var budget = $('#asBudget').value || '不限';
  var unitPower = 120;
  var score = newSiteScore(piles, rent, siteType, budget);
  var grade = score >= 85 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D';
  var now = new Date();
  var pad2 = function(v){ return String(v).padStart(2, '0'); };
  var iso = now.getFullYear() + '-' + pad2(now.getMonth()+1) + '-' + pad2(now.getDate());
  var id;
  do { id = 's-new-' + Date.now() + '-' + (++newSiteSeq); } while(stations.some(function(s){ return s.id === id; }));
  var st = {
    id:id, name:name, dist:asLoc.dist || '', piles:piles, power:unitPower+'kW×'+piles,
    score:score, grade:grade, last:pad2(now.getMonth()+1)+'-'+pad2(now.getDate()), t:iso,
    main:newSiteRisk(rent, piles, budget), isNew:true,
    siteType:siteType, unitPower:unitPower, rent:rent, area:area, budget:budget, goal:$('#asGoal input:checked').value,
    x:asLoc.x, y:asLoc.y, lonlat:asLoc.lonlat
  };
  stations.unshift(st);
  showAssessResult(st);
  saveAssessTask(st);
  toast('场地评估已完成', 'ok');
});

/* ---------- 可行性报告（数据驱动，以奥体场地为基准缩放保证自洽） ---------- */
/* 场地五维指标说明（评分依据表用） */
var SITE_DIM_DESC = [
  '场地周边 3 公里理论充电需求与目标客群强度的综合水平',
  '周边竞品站点的数量、定价与订单分流压力',
  '接电距离、变压器剩余容量与报装通道条件',
  '车位规模、产权租期、消防排水等硬条件',
  '按当前参数测算的投资回收期与年化收益水平'
];
function buildReport(sid){
  var st = stations.filter(function(s){ return s.id === sid; })[0] || stations[0];
  var isNew = !!st.isNew;
  var piles = Math.max(1, parseInt(st.piles, 10) || 1);
  var score = Math.max(0, Math.min(100, parseFloat(st.score) || 0));
  var k = st.id === 's1' ? 1 : Math.max(.55, Math.min(1.25, score / 72));
  var r1 = function(v){ return Math.round(v * k); };
  var f1 = function(v){ return (v * k).toFixed(1); };

  /* 维度雷达 + 分项 */
  var dimNames = ['区位需求','竞争强度','电力接入','场地条件','投资回报'];
  var dimVals = [r1(82), r1(58), r1(62), r1(75), r1(70)];
  dimVals = dimVals.map(function(v){ return Math.max(20, Math.min(98, v)); });

  setAssessStep(2);
  go('assess');
  renderAssessContext(st);

  /* 02 评分依据：五维雷达 + 指标表 */
  $('#astRadar').innerHTML = radarSVG(dimNames, dimVals, 290);
  $('#astBasisTab').innerHTML = '<tr><th style="width:22%">指标</th><th style="width:18%">数值</th><th>指标说明</th></tr>'
    + dimNames.map(function(nm, i){
      return '<tr><td>' + nm + '</td><td class="v num">' + dimVals[i] + '</td><td class="f">' + SITE_DIM_DESC[i] + '</td></tr>';
    }).join('');

  var fmtN = function(n){ return Math.round(n).toLocaleString('en-US'); };

  /* 理论需求 / 现有承接（供「供需缺口」口径使用） */
  var theo = Math.round(12400*k), act = Math.round(9150*k);

  /* 06 条件研判：三态清单（与区域详情同构，状态随场地等级变化） */
  renderConds(st, '#astCondList');

  /* R13：共享报告区块（周边竞争 / 车流 / 供需 / 投资测算 / 最终建议，与区域详情同一套组件）
     场地级参数：桩数取场地规模、租金取评估录入，未录入项按待补充处理 */
  var siteParams = assessInvestmentParams(st);
  var sinv = calcInv(siteParams);
  /* 01 评估摘要：五大数卡（与区域详情同构） */
  var fast = Math.ceil(piles / 2);
  var gradeK = {A: 'k-green', B: 'k-purple', C: 'k-orange', D: 'k-gray'}[st.grade] || 'k-gray';
  $('#astSumBox').innerHTML =
    '<div class="kpi k-gray"><span class="k-name">综合评分</span><span class="k-val">' + st.score + '</span></div>'
    + '<div class="kpi ' + gradeK + '"><span class="k-name">推荐等级</span><span class="k-val">' + st.grade + ' 级</span></div>'
    + '<div class="kpi k-orange"><span class="k-name">建议规模 · 超充 ' + fast + ' · 快充 ' + (piles - fast) + '</span><span class="k-val">' + piles + '<small> 桩</small></span></div>'
    + '<div class="kpi k-purple"><span class="k-name">建议服务费 元/kWh</span><span class="k-val">' + (siteParams.fee - 0.02).toFixed(2) + '-' + (siteParams.fee + 0.04).toFixed(2) + '<small> 元</small></span></div>'
    + '<div class="kpi k-green"><span class="k-name">预计回收期</span><span class="k-val">' + sinv.payback.toFixed(1) + '<small> 年</small></span></div>';
  var siteGap = Math.round(sinv.cap * (theo - act) / theo);
  $('#astCompText').innerHTML = '场地周边 3 公里竞争格局呈<b>「一超多强」</b>态势：特来电以 <b>6 站</b>（占比 29%）位居第一，星星充电 5 站紧随其后，前二集中度 <b>52%</b>；'
    + '供给以中小站为主，大功率快充有差异化空间；价格上竞品挂牌 <b>0.31-0.52 元/度</b>、平均 0.38 元，'
    + '建议服务费 <b>0.36-0.42 元</b>，处于竞品区间中位附近，可依托车位与功率配置形成差异化。';
  $('#astPatMetrics').innerHTML =
    '<div class="kpi k-gray"><span class="k-name">充电站总数</span><span class="k-val">21<small> 座</small></span></div>'
    + '<div class="kpi k-green"><span class="k-name">终端总数（超充 19 · 快充 136 · 慢充 34）</span><span class="k-val">189<small> 个</small></span></div>'
    + '<div class="kpi k-orange"><span class="k-name">区域电价区间</span><span class="k-val">0.35-0.40<small> 元/度</small></span></div>'
    + '<div class="kpi k-purple"><span class="k-name">区域平均服务费（元/度）</span><span class="k-val">0.38</span></div>';
  $('#astChartOps').innerHTML = buildOpsTable();
  $('#astChartPrice').innerHTML = buildPriceChart();
  $('#astChartScale').innerHTML = buildScaleChart();

  var astTruckMount = $('#astTruck');
  astTruckMount.innerHTML = truckFlowHTML();
  initTruckFlow(astTruckMount);

  var astUnmet = (100 * (theo - act) / theo).toFixed(1);
  $('#astGapText').innerHTML = '场地理论充电需求 <b>' + fmtN(theo) + ' kWh/天</b>，现有承接 <b>' + fmtN(act) + ' kWh/天</b>，'
    + '潜在未承接 <b>' + fmtN(theo - act) + ' kWh/天</b>（未承接率 <b>' + astUnmet + '%</b>）；'
    + '时段呈<b>夜间高峰（19-24 时）</b>特征，客群以<b>网约车</b>为主，缺口时段即本场地可承接的增量空间。';
  $('#astChartGap').innerHTML = buildGapChart(sinv.cap, sinv.cap + siteGap);
  $('#astChartCust').innerHTML = buildCustChart();

  invTiles(sinv, $('#astInvGrid'));
  renderInvTables(siteParams, $('#astInvCapexTab'), $('#astInvOpexTab'));

  /* 08 选址策略内嵌：推荐理由与风险提示（五维取最强两项 / 最弱两项） */
  var dimOrder = dimVals.map(function(v, i){ return [v, i]; }).sort(function(a, b){ return b[0] - a[0]; });
  var whyTop = dimOrder.slice(0, 2), riskLow = dimOrder.slice(-2).reverse();
  $('#astWhyList').innerHTML = '<ul>'
    + whyTop.map(function(d){ return '<li><b>' + dimNames[d[1]] + ' ' + d[0] + '</b> — 位于五维前列，是本场地评分的主要支撑</li>'; }).join('')
    + '<li><b>竞品服务费中位 0.38 元</b> — 建议服务费 0.36-0.42 元，具备定价与调价空间</li></ul>';
  $('#astRiskList').innerHTML = '<ul>'
    + riskLow.map(function(d){ return '<li><b>' + dimNames[d[1]] + ' ' + d[0] + '</b> — 相对薄弱，需在方案中针对性补强</li>'; }).join('')
    + (st.main ? '<li><b>' + esc(st.main) + '</b> — 当前主要制约项，需优先核验化解</li>' : '')
    + '<li><b>车位 / 租期等待核验项</b> — 需现场落实后再进入签约环节</li></ul>';

  /* 08 选址策略与下一步建议 */
  renderFinalAdv($('#astFinAdv'), {
    name: st.name, dist: st.dist, score: st.score, grade: st.grade,
    gap: siteGap, params: siteParams
  }, sinv, {
    ctxName: '当前场地',
    nextHTML: '<div style="margin-top:6px">下一步：<b>化解条件研判</b>高优先级项 → <b>补充待核验</b>条件 → 按建议规模<b>立项</b>。</div>'
  });
}
$('#btnExport').addEventListener('click', function(){
  toast('可行性报告已生成，正在下载', 'ok');
});

/* ---------- 选址任务数据（列表页展示全部） ---------- */
var taskList = [
  {name:'市中领秀城补点', goal:'网络覆盖', range:'济南市 · 市中', typeS:'公共快充站 · 4-8桩', n:0, st:'draft', time:'10-12', t:'2026-10-12'},
  {name:'品牌示范站筛查', goal:'品牌示范', range:'济南市 · 全域', typeS:'公共快充站 · 9-16桩', n:5, st:'run', time:'10-11', t:'2026-10-11'},
  {name:'经营收益导向选址', goal:'经营收益', range:'济南市 · 历下/高新', typeS:'公共快充站 · 4-8桩', n:8, st:'done', time:'10-10', t:'2026-10-10'},
  {name:'网络补盲 · 天桥片区', goal:'网络覆盖', range:'济南市 · 天桥', typeS:'公共快充站 · 4-8桩', n:3, st:'done', time:'10-08', t:'2026-10-08'},
  {name:'高新会展自定义范围选址', goal:'经营收益', range:'自定义范围 ×1', typeS:'公共快充站 · 4-8桩', n:2, st:'done', time:'10-06', t:'2026-10-06'},
  {name:'重卡走廊 · 青岛黄岛', goal:'经营收益', range:'青岛市 · 黄岛', typeS:'重卡站(区域选址) · 8-12枪', n:4, st:'done', time:'10-04', t:'2026-10-04'}
].slice().sort(function(a,b){ return Date.parse(b.t) - Date.parse(a.t); });
var taskStatus = {
  done:  ['已完成', 'sp-done'],
  run:   ['分析中', 'sp-run'],
  draft: ['草稿', 'sp-draft']
};
/* 列表页：全部任务 */
$('#taskListBody').innerHTML = taskList.map(function(t, i){
  var s = taskStatus[t.st];
  var act = t.st === 'draft' ? '继续编辑' : '打开';
  return '<tr><td style="font-weight:500">'+esc(t.name)+'</td>'
    + '<td style="font-size:12px;color:var(--text-2)">'+esc(t.goal)+'</td>'
    + '<td style="font-size:12px;color:var(--text-2)">'+esc(t.range)+'</td>'
    + '<td style="font-size:12px;color:var(--text-3)">'+esc(t.typeS)+'</td>'
    + '<td class="r" style="font-weight:600">'+(t.n ? t.n + ' 个' : '—')+'</td>'
    + '<td><span class="status-pill '+s[1]+'"><i></i>'+s[0]+'</span></td>'
    + '<td style="color:var(--text-3);font-size:12px">'+t.time+'</td>'
    + '<td class="r"><button class="act" data-task="'+i+'">'+act+'</button></td></tr>';
}).join('');
document.addEventListener('click', function(e){
  var tk = e.target.closest('[data-task]');
  if(tk){
    var t = taskList[+tk.getAttribute('data-task')];
    if(t && t.st === 'draft'){ go('home'); setHomeTab('explore'); toast('已打开草稿任务，可继续配置后分析', 'info'); return; }
    go('home'); setHomeTab('explore'); toast('已打开对应选址任务', 'ok');
  }
});

/* =====================================================================
   探索式入口 · 选址配置页
   ===================================================================== */
var cfg = { goal:'rev', province:'山东省', city:'济南市', districts:[], type:'公共快充站', budget:'100-200万', payback:'4-5 年', scale:'4-8桩' };
var drawCtx = { svg:null };   /* 提前初始化：配置摘要初始化会访问绘制上下文 */
/* R1：省→市→区县 级联演示数据（演示版仅开放山东省） */
var GEO = {
  provinces:['山东省','河北省','河南省','江苏省'],
  cities:{
    '山东省':['济南市','青岛市'],
    '河北省':['石家庄市','唐山市'],
    '河南省':['郑州市','洛阳市'],
    '江苏省':['南京市','苏州市']
  },
  districts:{
    '济南市':['历下区','市中区','槐荫区','天桥区','历城区','章丘区','长清区','济阳区','莱芜区','钢城区','平阴县','商河县','高新区'],
    '青岛市':['市南区','市北区','黄岛区','崂山区','李沧区','城阳区','即墨区','胶州市','平度市','莱西市'],
    '石家庄市':['长安区','桥西区','新华区','井陉矿区','裕华区','藁城区','鹿泉区','栾城区'],
    '唐山市':['路南区','路北区','古冶区','开平区','丰南区','丰润区','曹妃甸区'],
    '郑州市':['中原区','二七区','管城回族区','金水区','上街区','惠济区'],
    '洛阳市':['老城区','西工区','瀍河回族区','涧西区','吉利区','洛龙区'],
    '南京市':['玄武区','秦淮区','建邺区','鼓楼区','浦口区','栖霞区','雨花台区','江宁区'],
    '苏州市':['姑苏区','虎丘区','吴中区','相城区','吴江区']
  }
};
/* R2/R3：自定义区域（叠加在区县选择之上，重置时清空） */
var customRegions = [];
var customSeq = 0;
function curDistricts(){ return GEO.districts[cfg.city] || []; }
/* 范围描述（R5：自定义范围与区县互斥；R10：单一圆形范围 + 区县单选） */
function customScopeWord(s){
  return '自定义范围 半径' + s.km + 'km（约' + s.geo.area.toFixed(0) + 'km²）';
}
function scopeText(){
  var ds = customRegions.length ? customScopeWord(customRegions[0])
          : (cfg.districts.length ? cfg.districts[0] : '全部区县');
  return cfg.city + ' · ' + ds;
}
/* 省市区三级联动单下拉（R10：区县改单选，省/市/区县合并一个下拉；演示数据外省份置灰）
   R5：存在自定义范围 → 触发按钮禁用（自定义范围即寻址范围） */
function geoTxt(){
  /* R11：范围字段收窄为 1/3 列，触发器省略省份前缀（省/市仍在下拉面板中选择） */
  return cfg.city + ' / ' + (cfg.districts.length ? cfg.districts[0] : '全部区县');
}
function renderGeoSel(){
  var lock = customRegions.length > 0;
  var tr = $('#geoTrigger');
  if(tr){
    $('#geoTriggerTxt').textContent = lock ? '自定义范围 · 半径 '+customRegions[0].km+' km' : geoTxt();
    tr.disabled = lock;
    $('#geoSel').classList.toggle('custom-range',lock);
    tr.title = lock ? '已启用自定义范围作为寻址范围' : '点击选择省 / 市 / 区县';
  }
  var pv = $('#geoProv'), ct = $('#geoCity'), dt = $('#geoDist');
  if(pv) pv.innerHTML = GEO.provinces.map(function(p){
    var dim = !(GEO.cities[p] || []).length;
    return '<button class="geo-opt' + (p === cfg.province ? ' on' : '') + (dim ? ' dim' : '') + '" type="button" data-p="' + p + '"'
      + (dim ? ' title="该省份暂无可用数据"' : '') + '>' + p + '</button>';
  }).join('');
  if(ct) ct.innerHTML = (GEO.cities[cfg.province] || []).map(function(c){
    return '<button class="geo-opt' + (c === cfg.city ? ' on' : '') + '" type="button" data-c="' + c + '">' + c + '</button>';
  }).join('');
  if(dt){
    dt.innerHTML = ['全部区县'].concat(curDistricts()).map(function(d){
      var v = d === '全部区县' ? '' : d;
      var on = v ? cfg.districts[0] === v : cfg.districts.length === 0;
      return '<button class="geo-opt' + (on ? ' on' : '') + '" type="button" data-d="' + v + '">' + d + '</button>';
    }).join('');
  }
  var cu = $('#chipCustom');
  if(cu){
    cu.classList.toggle('lit', !!lock);
    cu.innerHTML = '<span class="ui-icon icon-map-pick" aria-hidden="true"></span><span>'+(lock?'重新圈选':'地图圈选')+'</span>';
  }
}

/* =====================================================================
   R5：配置页内嵌地图 / 放大绘制浮层 —— 共用同一份底图（viewBox 1040×720）
   常态仅：深色底 + 路网/河流/湖泊/山体 + 区县标注 + 平台站 + 友商站
   （不含推荐区域层与两种热力；城市切换只改标题与区县标签集）
   ===================================================================== */
var MAP_BASE = '';
var DIST_LABELS = {
  '济南市':[['天桥区',404,186],['槐荫区',228,344],['市中区',392,478],['历下区',500,264],['高新区',742,252],['历城区',786,470],['章丘区',948,212],['长清区',150,560],['平阴县',66,672],['商河县',150,74],['济阳区',445,148],['莱芜区',950,632],['钢城区',860,688]],
  '青岛市':[['市北区',404,186],['黄岛区',228,470],['市南区',500,264],['崂山区',742,252],['城阳区',786,470],['即墨区',948,212],['李沧区',580,170],['胶州市',150,420],['平度市',620,70],['莱西市',940,90]]
};
function renderDistLabels(){
  var items = distLabelItems();
  var html = items.map(function(it){
    return '<text x="' + it[1] + '" y="' + it[2] + '">' + esc(it[0]) + '</text>';
  }).join('');
  $$('.map-dist-labels').forEach(function(g){ g.innerHTML = html; });
}
/* R11：无手绘坐标的城市复用济南坐标模板排布区县标签（原型示意，不追求地理准确） */
function distLabelItems(){
  if(DIST_LABELS[cfg.city]) return DIST_LABELS[cfg.city];
  var coords = DIST_LABELS['济南市'];
  return curDistricts().slice(0, coords.length).map(function(d, i){
    return [d, coords[i][1], coords[i][2]];
  });
}
/* R11：工作台视图并入首页 —— cityMap 即首页地图（范围预览 + 绘制 + 分析结果一体） */
function allMaps(){ return ['#cityMap'].map(function(s){ return $(s); }).filter(function(s){ return !!s; }); }
function initBaseMaps(){
  ['#asMap'].forEach(function(sel){
    var svg = $(sel);
    if(svg) svg.innerHTML = MAP_BASE;
  });
  renderDistLabels();
}
/* R11：区县橙色虚线高亮圈已按要求移除（地图只保留区县名称标注） */

$('#cfgGoal').addEventListener('change',function(e){if(!e.target.matches('input'))return;cfg.goal=e.target.value;updateCfgSummary();invalidateRangeResults();});

/* 省市区联动面板（R10）：点外部或 ESC 收起；省/市切换面板保持打开，区县选定即收起
   e.target.isConnected：点选后列被重渲染，游离节点不算「点外部」，避免面板被误关 */
function setGeoPanel(open){
  var s = $('#geoSel');
  if(!s) return;
  s.classList.toggle('open', open);
  var tr = $('#geoTrigger');
  if(tr) tr.setAttribute('aria-expanded', open ? 'true' : 'false');
}
$('#geoTrigger').addEventListener('click', function(){
  if(this.disabled) return;
  setGeoPanel(!$('#geoSel').classList.contains('open'));
});
document.addEventListener('click', function(e){
  var s = $('#geoSel');
  if(s && s.classList.contains('open') && e.target.isConnected && !s.contains(e.target)) setGeoPanel(false);
});
document.addEventListener('keydown', function(e){
  if(e.key !== 'Escape') return;
  var s = $('#geoSel');
  if(s && s.classList.contains('open')) setGeoPanel(false);
});
$('#geoPanel').addEventListener('click', function(e){
  var op = e.target.closest('.geo-opt');
  if(!op) return;
  var p = op.getAttribute('data-p'), c = op.getAttribute('data-c'), d = op.getAttribute('data-d');
  if(p !== null){
    if(p === cfg.province) return;
    if(!(GEO.cities[p] || []).length){ toast('该省份暂无可用数据', 'warn'); return; }
    cfg.province = p;
    cfg.city = GEO.cities[p][0];
    cfg.districts = [];
  } else if(c !== null){
    if(c === cfg.city) return;
    cfg.city = c;
    cfg.districts = [];
    toast('范围已切换：' + cfg.province + ' · ' + cfg.city + ' · 全部区县', 'ok');
  } else {
    cfg.districts = d ? [d] : [];          /* '' = 全部区县 */
    setGeoPanel(false);                    /* 区县选定即收起 */
  }
  renderGeoSel();
  renderDistLabels();
  updateCfgSummary();
  renderWbInfo();
  renderAsPins('');          /* 候选库地图点位随城市重排 */
  clearAsLoc();
  if(typeof invalidateRangeResults==='function')invalidateRangeResults();
});
/* 「＋ 自定义区域」入口（独立于省市 区县下拉，行内常驻） */
$('#chipCustom').addEventListener('click', enterCfgDraw);

/* 下拉选择：期望回收周期 / 投资预算 */
[['cfgPayback','payback'],['cfgBudget','budget']].forEach(function(p){
  var sel = $('#' + p[0]);
  if(sel) sel.addEventListener('change', function(){
    cfg[p[1]] = sel.value;
    updateCfgSummary();
  });
});

/* 建设规模：档位随场站类型联动（事件委托，支持档位组动态重渲染） */
var scalePresets = {
  '公共快充站':          { opts:['≤4桩','4-8桩','8-12桩','12桩以上','不限'], def:'4-8桩' },
  '重卡站(区域选址)': { opts:['≤8枪','8-16枪','16-24枪','24枪以上','不限'], def:'8-16枪' },
  '重卡站(路线选址)': { opts:['≤8枪','8-16枪','16-24枪','24枪以上','不限'], def:'8-16枪' }
};
function renderScaleSeg(){
  var m = scalePresets[cfg.type] || scalePresets['公共快充站'];
  if(m.opts.indexOf(cfg.scale) < 0) cfg.scale = m.def;
  $('#cfgScale').innerHTML = m.opts.map(function(o){
    return '<option value="' + o + '"' + (cfg.scale === o ? ' selected' : '') + '>' + o + '</option>';
  }).join('');
}
$('#cfgScale').addEventListener('change', function(){
  cfg.scale = this.value;
  updateCfgSummary();
});
/* 场站类型二选一：切换时规模档位组与默认值同步切换 */
function changeStationKind(){
 const truck=$('#cfgType input[value="truck"]').checked;
 cfg.type=truck?$('#truckMethod input:checked').value:'公共快充站';
 cfg.scale=scalePresets[cfg.type].def;renderScaleSeg();updateCfgSummary();invalidateRangeResults();
}
$('#cfgType').addEventListener('change',changeStationKind);
$('#truckMethod').addEventListener('change',changeStationKind);

var goalNames = { rev:'经营收益', cov:'网络覆盖', brand:'品牌示范' };
/* 范围文案（工作台信息带共用 scopeDesc 拼接逻辑） */
function scopeDescList(){
  return customRegions.map(scopeDesc).join(' ＋ ');
}
function updateCfgSummary(){
  if(typeof refreshRangeUX === 'function') refreshRangeUX();
}
renderScaleSeg(); renderGeoSel(); updateCfgSummary();

/* 工作台信息栏与地图标题均随 R11 移除：renderWbInfo 仅作空操作占位（多处调用保持不变） */
function renderWbInfo(){
  var el = $('#wbInfo');
  if(!el) return;
  var scopeTxt = customRegions.length ? scopeDescList() : scopeText();
  el.innerHTML =
    '<span class="kv-tag"><label>任务目标</label><b>' + goalNames[cfg.goal] + '</b></span>' +
    '<span class="kv-tag"><label>范围</label><b>' + esc(scopeTxt) + '</b></span>' +
    '<span class="kv-tag"><label>预算</label><b>' + cfg.budget + '</b></span>' +
    '<span class="kv-tag"><label>规模</label><b>' + cfg.scale + '</b></span>' +
    '<span class="kv-tag"><label>类型</label><b>' + esc(cfg.type) + '</b></span>' +
    '<span class="kv-tag"><label>期望回收</label><b>' + cfg.payback + '</b></span>';
}
renderWbInfo();

/* 选址任务配置：收起 / 展开 */
function setCfgFold(collapse){
  var c = $('#cfgCard'), f = $('#cfgFold');
  if(!c || !f) return;
  c.classList.toggle('collapsed', collapse);
  f.setAttribute('aria-expanded', String(!collapse));
  $('#cfgFoldTxt').textContent = collapse ? '修改选址条件' : '返回结果';
  refreshRangeUX();
  if(collapse)requestAnimationFrame(()=>$('.content').scrollTo({top:0,behavior:'instant'}));
}
$('#cfgFold').addEventListener('click', function(){
  var c = $('#cfgCard');
  if(c) setCfgFold(!c.classList.contains('collapsed'));
});

/* 开始选址分析：按钮内 loading 过渡 → R11 不跳转，留在本页生成推荐区域（地图出结果 + 右侧列表） */
var _starting = false;
var expResultsShown = false;   /* 首次分析后置真：推荐区域结果区常驻，删范围后即时重跑 */
$('#btnStart').addEventListener('click', function(){
  if(_starting) return;
  if(cfg.type==='重卡站(路线选址)'){toast('请先使用区域选址，路线条件尚待完善','info');return;}
  if(rangeMode==='draw'&&!customRegions.length){toast('请先在地图上圈定选址范围','warn');enterCfgDraw();return;}
  $('#panel-explore').style.setProperty('--result-map-height',$('#site-geo-map').getBoundingClientRect().height+'px');
  rangeResultsDirty=false;lastRangeResults=null;
  if(rangeMode==='district'){customFlowActive=false;regions=cloneData(defaultRegions).filter(r=>cfg.city==='济南市'&&(!cfg.districts.length||cfg.districts.includes(r.dist)));curRegion=regions[0]||null;restoreMapShapes();}
  _starting = true;
  $('#cfgForm').inert=true;$('#rangeMethod').inert=true;
  if(typeof startRangeTask==='function')startRangeTask();
  var btn = $('#btnStart');
  btn.disabled = true;
  $('#btnStartIco').outerHTML = '<span class="spin" id="btnStartIco"></span>';
  var useCustom = customRegions.length > 0;
  var phases = ['正在扫描 214 个网格…','正在计算供需缺口…','正在生成推荐区域…'];
  var i = 0;
  $('#btnStartTxt').textContent = phases[0];$('#mapLoading').classList.add('show');$('#mapLoadingTxt').textContent=phases[0];
  var timer = setInterval(function(){
    i++;
    if(i < phases.length){ $('#btnStartTxt').textContent = phases[i];$('#mapLoadingTxt').textContent=phases[i];return; }
    clearInterval(timer);$('#mapLoading').classList.remove('show');
    $('#btnStartTxt').textContent = '更新分析';   /* R11：完成一次分析后按钮改「重新选址」 */
    $('#cfgCard').classList.add('foldable');      /* 完成过一次分析后才展示收起/展开开关 */
    setCfgFold(true);                            /* 分析完成自动收起配置表单，让位地图与结果 */
    $('#btnStartIco').outerHTML = '<img class="ui-icon" id="btnStartIco" src="./assets/control-15a9430f21.svg" alt="">';
    btn.disabled = false;
    _starting = false;
    $('#cfgForm').inert=false;$('#rangeMethod').inert=false;
    stopDrawing();          /* 同族修复：开始分析即完整退出绘制态（与重置保持一致） */
    expResultsShown = true;
    var rc = $('#expResultCard'); if(rc) rc.style.display = '';
    var eg = $('#expGrid'); if(eg) eg.classList.add('has-result');
    /* R11：推荐区域/热力图层按钮仅分析后出现 */
    $$('#mapLegend .lyr').forEach(function(b){ if(b.style.display === 'none') b.style.display = ''; });
    if(useCustom){
      /* R5：范围非空 → 自定义流程：隐藏预置 8 区，逐 scope 生成范围内子区域 */
      runCustomFlow();
      renderWbInfo();
      toast('分析完成：自定义范围内共识别 ' + activeRegions().length + ' 个推荐区域', 'ok');
    } else {
      /* R5：范围为空 → 沿用既有 8 区预置流程 */
      customFlowActive = false;
      setPresetRegionsVisible(true);
      syncResultLayerState();
      renderRegionList(); refreshWbStats();
      if(curRegion)selectRegion(curRegion.id);
      renderWbInfo();
      toast('分析完成：共识别 ' + regions.length + ' 个推荐区域，其中 A 级 ' + regions.filter(function(r){ return r.grade === 'A'; }).length + ' 个', 'ok');
    }
    if(typeof finishRangeTask==='function')finishRangeTask();
  }, 900);
});

/* =====================================================================
   智能选址工作台：推荐区域数据 + 地图联动
   ===================================================================== */
var regions = [
  {id:'r1', name:'高新·舜华路板块', dist:'高新区', score:89, grade:'A', gap:310, dims:[93,80,84,92,90], params:{n:12,p:120,unit:12.5,civil:26,other:8,deposit:null,rentY:24,labor:null,fee:0.38,util:0.23,coef:1}},
  {id:'r2', name:'历下·奥体东板块', dist:'历下区', score:86, grade:'A', gap:280, dims:[90,76,86,88,86], params:{n:8,p:120,unit:12,civil:28,other:10,deposit:null,rentY:18,labor:null,fee:0.38,util:0.24,coef:1}},
  {id:'r3', name:'历下·CBD东拓区', dist:'历下区', score:82, grade:'B', gap:170, dims:[84,72,80,82,80], params:{n:6,p:120,unit:12,civil:18,other:6,deposit:null,rentY:14,labor:null,fee:0.38,util:0.21,coef:1}},
  {id:'r6', name:'市中·领秀城东板块', dist:'市中区', score:79, grade:'B', gap:260, dims:[82,70,78,80,79], params:{n:10,p:120,unit:12,civil:22,other:8,deposit:null,rentY:16,labor:null,fee:0.38,util:0.19,coef:1}},
  {id:'r4', name:'历城·唐冶北板块', dist:'历城区', score:77, grade:'B', gap:190, dims:[80,74,78,80,77], params:{n:8,p:120,unit:12,civil:20,other:6,deposit:null,rentY:13,labor:null,fee:0.38,util:0.19,coef:1}},
];
function r1v(v){ return Math.round(v * 10) / 10; }
/* 数值缺省（null/undefined）→ 分项金额显示「待补充」，合计按 0 参与 */
function nvl(v){ return (v === null || v === undefined) ? null : v; }
/* CAPEX 一次性投资分项（固定项系统按容量/桩数/比例估算；待补充项在编辑建站方案中填写，按 0 参与测算） */
function capexItems(p){
  var dev = p.n * p.unit;
  var prep = r1v(2 + p.n * 0.5);
  var power = r1v(6 + p.n * p.p * 0.028);
  var install = r1v(dev * 0.06);
  var dep = nvl(p.deposit);
  var sub = prep + (dep || 0) + p.civil + power + p.other + dev + install;
  var reserve = r1v(sub * 0.08);
  return {
    rows: [
      ['前期及报批费', prep],
      ['场地一次性投入', dep],
      ['土建工程费', p.civil],
      ['供配电系统费', power],
      ['充电桩设备费', dev],
      ['智能化配套', p.other],
      ['安装调试费', install],
      ['工程预备费', reserve]
    ],
    total: r1v(sub + reserve)
  };
}
/* OPEX 年度运营成本分项（固定项系统估算；待补充项在编辑建站方案中填写，按 0 参与测算；
   电度电费平进平出，计入毛利的仅基本电费＋力调电费） */
function opexItems(p){
  var cap = p.n * p.p;
  var capex = capexItems(p).total;
  var buy = r1v(cap * 0.005 + 0.8);
  var maint = r1v(p.n * 0.5);
  var plat = r1v(1.2 + p.n * 0.1);
  var ins = r1v(capex * 0.008);
  var tax = r1v(p.rentY * 0.12);
  var labor = nvl(p.labor);
  var rows = [
    ['购电成本', buy],
    ['场地租金', p.rentY],
    ['运维维保费', maint],
    ['人工＆保洁费', labor],
    ['平台及通信年费', plat],
    ['保险费', ins],
    ['税费', tax]
  ];
  var total = r1v(rows.reduce(function(s, r){ return s + (r[1] || 0); }, 0));
  return { rows: rows, total: total };
}
function calcInv(p){
  var capex = capexItems(p).total;
  var opexYear = opexItems(p).total;
  var dailyKWh = p.n * p.p * 24 * p.util * p.coef;           /* kWh/日 */
  var monthlyKWh = dailyKWh * 30;                            /* kWh/月 */
  var income = monthlyKWh * p.fee / 10000;                   /* 万元/月 */
  var gross = income - opexYear / 12;                        /* 万元/月 */
  var annual = gross * 12;
  return {
    capex: capex, opexYear: opexYear, revYear: income * 12,
    dailyKWh: dailyKWh, income: income, gross: gross, annual: annual,
    payback: annual > 0 ? capex / annual : Infinity, roi: annual > 0 ? annual / capex * 100 : 0,
    cap: p.n * p.p
  };
}
function regionById(id){
  return regions.filter(function(r){ return r.id === id; })[0] || regions[0];
}
function chipsFor(r){
  var p = r.params;
  return '<span class="mini-tag">服务费 ' + (p.fee - 0.02).toFixed(2) + '-' + (p.fee + 0.04).toFixed(2) + ' 元</span>'
    + '<span class="mini-tag">规模 ' + Math.max(2, p.n - 2) + '-' + (p.n + 2) + ' 桩</span>';
}
/* 期望回收周期约束（来自配置页；区间取上限参与排序，「不限」或未设置则返回 null） */
function paybackLimit(){
  if(!cfg.payback || cfg.payback === '不限') return null;
  var nums = String(cfg.payback).match(/\d+(\.\d+)?/g);
  if(!nums) return null;
  return Math.max.apply(null, nums.map(parseFloat));
}
function isOverLimit(r, lim){
  return lim !== null && lim !== undefined && calcInv(r.params).payback > lim;
}
function renderRegionList(){
  /* R4：自定义流程下仅显示范围内产出的推荐子区域；正常流程显示全部
     V3 ⑤：排序统一走 rankedRegions()，保证地图 / 列表 / 详情三处排名一致 */
  var list = rankedRegions();
  $('#btnExportAll').disabled=!list.length;
  /* 绘制态空态：请先绘制自定义寻址范围（与地图引导横幅同语言） */
  if(!list.length){
    $('#rgnList').innerHTML = '<div class="rgn-empty">'
      + '<img class="ui-icon" src="./assets/control-4104f5e3ea.svg" alt="">'
      + '<b>'+ (expResultsShown?'当前范围暂无推荐区域':'请先确定寻址范围')+'</b>'
      + '<span>请调整范围、规模或预算后重新分析；也可改用省 / 市 / 区县范围</span>'
      + '</div>';
    syncMapRanks([]);
    return;
  }
  $('#rgnList').innerHTML = list.map(function(r, i){
    var inv = calcInv(r.params),p=r.params,unit=cfg.type.includes('重卡')?'枪':'桩';
    return '<div class="rgn-item' + (curRegion && curRegion.id === r.id ? ' sel' : '') + '" data-rid="'+r.id+'">'
      + '<button type="button" class="rgn-select" aria-pressed="'+(curRegion && curRegion.id === r.id ? 'true' : 'false')+'"'
      + ' aria-label="选择推荐区域 #'+(i+1)+' '+esc(r.name)+'，'+r.grade+'级，'+r.score+'分">'
      + '<span class="r1"><span class="rank">'+(i+1)+'</span>'
      + '<span class="name" title="'+esc(r.name)+'">'+esc(r.custom?r.name.replace(/^自定义范围[^·]*·\s*/, ''):r.name)+'</span>'
      + '<span class="sc" style="color:var(--rate-'+r.grade.toLowerCase()+')">'+r.score+'</span>'
      + '<span class="rk sm rk-'+r.grade+'">'+r.grade+'</span></span>'
      + '<span class="rgn-metrics">'
      + '<span><span class="metric-label">建议服务费</span><span class="metric-value">'+(p.fee-.02).toFixed(2)+'–'+(p.fee+.04).toFixed(2)+'<small> 元/kWh</small></span></span>'
      + '<span><span class="metric-label">建议规模</span><span class="metric-value">'+Math.max(2,p.n-2)+'–'+(p.n+2)+'<small> '+unit+'</small></span></span>'
      + '<span><span class="metric-label">预计投资</span><span class="metric-value">'+Math.round(inv.capex)+'<small> 万元</small></span></span>'
      + '<span><span class="metric-label">回收周期</span><span class="metric-value">'+(inv.payback*.9).toFixed(1)+'–'+(inv.payback*1.1).toFixed(1)+'<small> 年</small></span></span>'
      + '</span></button>'
      + '<div class="rgn-actions"><span class="region-selected-note" role="img" aria-label="当前选中"><svg viewBox="-9 -9 18 18" aria-hidden="true"><circle r="8" fill="#315eef"/><path d="M-3.5 0 -1 2.5 3.5 -2.5" fill="none" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="rgn-btns">'
      + '<button type="button" class="go" data-open="'+r.id+'" aria-label="查看 '+esc(r.name)+' 详情">查看详情<svg viewBox="7 5 10 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>'
      + '</span></div></div>';
  }).join('');
  syncSelected(curRegion && curRegion.id);   /* 重建 DOM 后还原选中态与 aria-pressed */
  syncMapRanks(list);                        /* 排名回写到地图标签 */
  markDecorative($('#rgnList'));             /* 新建节点补装饰 SVG 标记 */
}
$('#btnExportAll').addEventListener('click', function(){
  toast('已导出 ' + activeRegions().length + ' 个推荐区域报告', 'ok');
});
/* 工作台统计：推荐区域/A级数量与平均回收期按当前可见区域集合（R4：随 activeRegions 实时计算） */
function refreshWbStats(){
  var list = activeRegions();
  var pays = list.map(function(r){ return calcInv(r.params).payback; });
  var avg = pays.length ? pays.reduce(function(a, b){ return a + b; }, 0) / pays.length : 0;
  var el = $('#wbAvgPayback');
  if(el) el.innerHTML = (pays.length ? avg.toFixed(1) : '—') + '<small>年</small>';
  var c1 = $('#wbRgnCount'); if(c1) c1.textContent = list.length;
  var c2 = $('#lyrRegions'); if(c2) c2.innerHTML = '<i style="background:#315EEF"></i>推荐区域 ' + list.length;
  var c3 = $('#wbAGrade'); if(c3) c3.textContent = list.filter(function(r){ return r.grade === 'A'; }).length;
  syncMapRanks();
}
renderRegionList();

/* 地图 ↔ 列表联动
   V3 ⑤：彻底删除程序化滚动 —— 地图 SVG 整幅可见，页面滚动只会是副作用。
   正式选中 / 悬停预览 / 键盘焦点必须是三种不同状态。 */
var curRegion = null;
/* 排名同源：列表、地图标签、区域详情共用同一个排序结果（受 paybackLimit 影响，需每次重算） */
function rankedRegions(){return activeRegions().slice().sort((a,b)=>b.score-a.score);}
function rankOf(id){
  var l = rankedRegions();
  for(var i = 0; i < l.length; i++){ if(l[i].id === id) return i + 1; }
  return 0;
}
function syncMapRanks(list){
  list = list || rankedRegions();
  var legend=$('#lyrRegions');if(legend)legend.innerHTML='<i style="background:#315eef"></i>推荐区域 '+list.length;
  list.forEach(function(r, i){
    var g = document.querySelector('#cityMap .rgn[data-rid="' + r.id + '"]');
    if(!g) return;
    r.rank = i + 1;
    var t = g.querySelector('.lbl-rank-t');
    if(t) t.textContent = String(i + 1);
    g.setAttribute('data-rank', String(i + 1));
    g.setAttribute('aria-label', '推荐区域 #' + (i + 1) + ' ' + r.name + '，' + r.grade + '级，' + r.score + '分');
  });
}
/* SVG 没有 z-index：把选中 <g> 移到图层末尾 = 置顶，避免被邻区压住 */
function bringToFront(id){
  var g = document.querySelector('#cityMap .rgn[data-rid="' + id + '"]');
  if(g && g.parentNode) g.parentNode.appendChild(g);
}
/* 反向联动（点地图 → 列表项进可视区）：只改 #rgnList.scrollTop，且仅在溢出时 */
function revealItemInsideList(id){
  var item = document.querySelector('#rgnList .rgn-item[data-rid="' + id + '"]');
  var box = document.getElementById('rgnList');
  if(!item || !box) return;
  if(!(box.scrollHeight > box.clientHeight)) return;
  var br = box.getBoundingClientRect(), ir = item.getBoundingClientRect(), d = 0;
  if(ir.top < br.top + 6) d = ir.top - br.top - 6;
  else if(ir.bottom > br.bottom - 6) d = ir.bottom - br.bottom + 6;
  if(d) box.scrollTop += d;
}
function announceRegion(r){
  var el = $('#rgnAnnounce');
  if(!el || !r) return;
  el.textContent = '已选择推荐区域 #' + (r.rank || rankOf(r.id)) + ' ' + r.name + '，' + r.grade + '级，' + r.score + '分';
}
/* aria-pressed 单点写入（终裁 #12）：禁止在 renderRegionList / generateSubRegions 里散写 */
function syncSelected(id){
  var rid = id || (curRegion && curRegion.id) || null;
  $$('#cityMap .rgn[data-rid]').forEach(function(g){
    var on = (g.getAttribute('data-rid') === rid);
    g.classList.toggle('sel', on);
    g.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  syncRovingTabindex(rid);
  $$('#rgnList .rgn-item').forEach(function(c){
    var on = (c.getAttribute('data-rid') === rid);
    c.classList.toggle('sel', on);
    var btn = c.querySelector ? c.querySelector('.rgn-select') : null;
    if(btn) btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    else c.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}
/* 地图 roving tabindex：整幅地图只占一个 Tab 停靠点，方向键在区域间移动焦点 */
function syncRovingTabindex(preferId){
  var gs = $$('#cityMap .rgn[data-rid]');
  if(!gs.length) return;
  var cur = preferId || (curRegion ? curRegion.id : null) || gs[0].getAttribute('data-rid');
  var hit = null;
  gs.forEach(function(g){ if(g.getAttribute('data-rid') === cur) hit = g; });
  if(!hit) hit = gs[0];
  gs.forEach(function(g){ g.setAttribute('tabindex', g === hit ? '0' : '-1'); });
}
function selectRegion(id, fromMap){
  curRegion = regionById(id);
  syncSelected(id);
  bringToFront(id);
  if(fromMap) revealItemInsideList(id);
  announceRegion(curRegion);
}
/* 轻预览：只做视觉，不改 curRegion、不改 aria-pressed、不滚动 */
function previewRegion(id, on){
  $$('#cityMap .rgn[data-rid]').forEach(function(g){
    g.classList.toggle('is-preview', !!on && g.getAttribute('data-rid') === id);
  });
  $$('#rgnList .rgn-item').forEach(function(c){
    c.classList.toggle('is-preview', !!on && c.getAttribute('data-rid') === id);
  });
}
function bindPreview(boxSel, itemSel){
  var box = $(boxSel);
  if(!box) return;
  box.addEventListener('mouseover', function(e){
    var el = e.target.closest ? e.target.closest(itemSel) : null;
    if(el) previewRegion(el.getAttribute('data-rid'), true);
  });
  box.addEventListener('mouseout', function(e){
    var el = e.target.closest ? e.target.closest(itemSel) : null;
    if(el) previewRegion(el.getAttribute('data-rid'), false);
  });
}
bindPreview('#cityMap', '.rgn[data-rid]');
bindPreview('#rgnList', '.rgn-item[data-rid]');
/* 地图区域：role=button + roving tabindex（预置 8 区在初始化时补齐） */
function initMapRgnA11y(){
  $$('#cityMap .rgn[data-rid]').forEach(function(g){
    g.setAttribute('role', 'button');
    g.setAttribute('focusable', 'true');
  });
  syncRovingTabindex();
}
function moveMapRegionFocus(g, dir){
  var gs = $$('#cityMap .rgn[data-rid]');
  var i = gs.indexOf(g);
  if(i < 0) return;
  var j = (dir === -9999) ? 0 : (dir === 9999) ? (gs.length - 1) : (i + dir + gs.length) % gs.length;
  var t = gs[j];
  gs.forEach(function(x){ x.setAttribute('tabindex', x === t ? '0' : '-1'); });
  previewRegion(g.getAttribute('data-rid'), false);
  previewRegion(t.getAttribute('data-rid'), true);
  if(t.focus) t.focus();
}
(function(){
  var map = $('#cityMap');
  if(!map) return;
  map.addEventListener('keydown', function(e){
    var g = e.target && e.target.closest ? e.target.closest('.rgn[data-rid]') : null;
    if(!g) return;
    if(e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar'){
      e.preventDefault(); selectRegion(g.getAttribute('data-rid'), true); return;
    }
    if(e.key === 'Escape'){ previewRegion(g.getAttribute('data-rid'), false); return; }
    var dir = 0;
    if(e.key === 'ArrowRight' || e.key === 'ArrowDown') dir = 1;
    else if(e.key === 'ArrowLeft' || e.key === 'ArrowUp') dir = -1;
    else if(e.key === 'Home') dir = -9999;
    else if(e.key === 'End') dir = 9999;
    else return;
    e.preventDefault();
    moveMapRegionFocus(g, dir);
  });
})();
$('#cityMap').addEventListener('click', function(e){
  /* R5：自定义范围轮廓 hover 出现的删除按钮 → 删除该范围及其推荐结果 */
  var del = e.target.closest('[data-scope-del]');
  if(del){ deleteCustomScope(del.getAttribute('data-scope-del')); return; }
  var g = e.target.closest('.rgn');
  if(!g || !g.getAttribute('data-rid')) return;   /* 范围轮廓无 data-rid，不触发选中 */
  selectRegion(g.getAttribute('data-rid'), true);
});
$('#rgnList').addEventListener('click', function(e){
  /* R2：hover 删除按钮 → 移除自定义区域（地图 + 列表 + 计数同步） */
  var open = e.target.closest('[data-open]');
  if(open){ openRegion(open.getAttribute('data-open')); return; }
  var item = e.target.closest('.rgn-item');
  if(item) selectRegion(item.getAttribute('data-rid'));
});

/* 图层开关：需求热力 / 价格热力互斥（一次只显示一种分析热力，再点可关）；状态同步 aria-pressed */
var HEAT_LAYERS = ['lyHeat', 'lyPrice'];
function setLayer(btn, on){
  var id = btn.getAttribute('data-layer');
  if(on && HEAT_LAYERS.indexOf(id) > -1){
    $$('.lyr[data-layer]').forEach(function(x){
      var xid = x.getAttribute('data-layer');
      if(xid !== id && HEAT_LAYERS.indexOf(xid) > -1 && x.classList.contains('on')){
        x.classList.remove('on');
        var xg = document.getElementById(xid);
        if(xg) xg.classList.add('g-off');
        x.setAttribute('aria-pressed', 'false');
      }
    });
  }
  btn.classList.toggle('on', on);
  var g = document.getElementById(id);
  if(g) g.classList.toggle('g-off', !on);
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
}
$$('.lyr[data-layer]').forEach(function(b){
  b.setAttribute('aria-pressed', b.classList.contains('on') ? 'true' : 'false');
  b.addEventListener('click', function(){ setLayer(b, !b.classList.contains('on')); });
});

/* =====================================================================
   R10：自定义范围绘制 —— 唯一方式：按住拖动在地图上画一个圈
   - 在首页地图 #cityMap 上按下 → 拖动 → 松开，拖动距离即圈半径
   - 临时层 pointer-events:none，实时预览（蓝虚线圆 + 半径读数），松手即登记范围
   - 只保留一个圈：重画自动替换旧圈（连同其推荐子区域，规则同删除）
   - svgPoint / drawMode / 临时层均按活动 svg 隔离，两图事件互不串扰
   ===================================================================== */
var drawMode = null;        /* null | 'circle' */
var drawDrag = null;        /* 拖动状态 {x0,y0,x1,y1}（viewBox 坐标） */
var KM = 15;                /* 演示比例：1km ≈ 15 viewBox 单位（3km≈45） */
var SVGNS = 'http://www.w3.org/2000/svg';

function svgPoint(evt, svg){
  svg = svg || drawCtx.svg || $('#cityMap');
  if(!svg) return null;
  var r = svg.getBoundingClientRect();
  /* R7：展开动画途中 / 容器隐藏时宽高为 0，直接返回 null，避免产出 NaN 坐标 */
  if(!r.width || !r.height) return null;
  return { x:(evt.clientX - r.left) * 1040 / r.width, y:(evt.clientY - r.top) * 720 / r.height };
}
function getDrawLayer(svg){
  svg = svg || drawCtx.svg || $('#cityMap');
  var g = svg.querySelector('.draw-temp');
  if(!g){
    g = document.createElementNS(SVGNS,'g');
    g.setAttribute('class','draw-temp');
    g.setAttribute('pointer-events','none');
    svg.appendChild(g);
  }
  return g;
}
function clearDrawTemp(){
  $$('.draw-temp').forEach(function(g){ if(g.parentNode) g.parentNode.removeChild(g); });
}
/* 进入绘制态（唯一模式 = 画圈，进入即激活）；退出时清空拖动与临时层 */
function startDrawing(svg){
  drawCtx.svg = svg;
  setDrawMode('circle');
}
function stopDrawing(){
  setDrawMode(null);
  drawCtx.svg = null;
  drawDrag = null;
  clearDrawTemp();
}
function setDrawMode(mode){
  drawMode = mode;
  drawDrag = null;
  clearDrawTemp();
  /* 十字光标只加在当前活动 svg 上 */
  allMaps().forEach(function(s){ s.classList.toggle('drawing', !!drawMode && drawCtx.svg === s); });
}
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape' && drawMode){
    setDrawMode(null);
    toast('已取消绘制', 'info');
  }
});
/* 按住拖动画圈：pointerdown 取圆心 → pointermove 实时预览 → pointerup 按距离成圈 */
function bindDrawDrag(sel){
  var svg = $(sel);
  if(!svg) return;
  svg.addEventListener('pointerdown', function(e){
    if(drawCtx.svg !== svg || !drawMode) return;
    var p = svgPoint(e, svg);
    if(!p) return;
    drawDrag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    try { svg.setPointerCapture(e.pointerId); } catch(err){}
    e.preventDefault();
  });
  svg.addEventListener('pointermove', function(e){
    if(!drawDrag) return;
    var p = svgPoint(e, svg);
    if(!p) return;
    drawDrag.x1 = p.x; drawDrag.y1 = p.y;
    renderDragTemp(svg);
  });
  svg.addEventListener('pointerup', function(){
    if(!drawDrag) return;
    var d = drawDrag;
    drawDrag = null;
    var r = Math.sqrt((d.x1 - d.x0) * (d.x1 - d.x0) + (d.y1 - d.y0) * (d.y1 - d.y0));
    clearDrawTemp();
    if(r < KM * 0.5){ toast('拖动太短：按住地图拖出半径 ≥0.5km 的圈', 'warn'); return; }
    finishCircle(d.x0, d.y0, r / KM);
  });
  svg.addEventListener('pointercancel', function(){
    drawDrag = null;
    clearDrawTemp();
  });
}
/* 拖动临时预览：蓝虚线圆 + 圆心 + 半径虚线 + 读数 */
function renderDragTemp(svg){
  var d = drawDrag, g = getDrawLayer(svg);
  var r = Math.sqrt((d.x1 - d.x0) * (d.x1 - d.x0) + (d.y1 - d.y0) * (d.y1 - d.y0));
  g.innerHTML = ''
    + '<circle cx="' + d.x0.toFixed(1) + '" cy="' + d.y0.toFixed(1) + '" r="' + r.toFixed(1) + '" fill="rgba(91,139,255,.08)" stroke="#5b8bff" stroke-width="2" stroke-dasharray="7 5"/>'
    + '<circle cx="' + d.x0.toFixed(1) + '" cy="' + d.y0.toFixed(1) + '" r="3.5" fill="#5b8bff"/>'
    + '<line x1="' + d.x0.toFixed(1) + '" y1="' + d.y0.toFixed(1) + '" x2="' + d.x1.toFixed(1) + '" y2="' + d.y1.toFixed(1) + '" stroke="#5b8bff" stroke-width="1.5" stroke-dasharray="4 4"/>'
    + '<text x="' + ((d.x0 + d.x1) / 2).toFixed(1) + '" y="' + ((d.y0 + d.y1) / 2 - 7).toFixed(1) + '" font-size="12" fill="#9db8ff">半径 ' + (r / KM).toFixed(1) + 'km</text>';
}
/* 圆：面积 = πr² 折 km²；R10 单圈模型 —— 画完即自动退出绘制态（重画点 chip 再进） */
function finishCircle(x0, y0, km){
  addCustomRegion({ shape:'circle', cx:+x0.toFixed(1), cy:+y0.toFixed(1), r:km * KM, area:Math.PI * km * km, lx:x0, ly:y0 });
  exitCfgDraw();
}
/* =====================================================================
   R4：自定义区域流程重设计
   心智模型：自定义区域 = 一种寻址范围的指定方式
   画完 → 以它为范围触发分析（三阶段过渡）→ 范围内产出 2-4 个推荐子区域
   ===================================================================== */
var customFlowActive = false;   /* 自定义流程激活：列表/统计/地图仅显示范围内产出的推荐子区域 */
var subSeq = 0;                /* 推荐子区域序号 */
/* 当前可见推荐区域：自定义流程下仅显示子区域结果；正常流程显示全部（含叠加的自定义结果） */
function activeRegions(){
  if(rangeResultsDirty && lastRangeResults) return lastRangeResults;
  if(!regions) return [];       /* regions 在 renderWbInfo 之后初始化，防御早期调用 */
  return customFlowActive ? regions.filter(function(r){ return r.scopeId; }) : regions;
}
/* 范围描述（R10：只剩圆形一种） */
function scopeDesc(s){
  return '自定义 · 半径' + s.km + 'km';
}
/* 地图上隐藏/恢复预置 8 个推荐区域（data-rid 以 r 开头） */
function setPresetRegionsVisible(v){
  $$('#lyRegions > .rgn').forEach(function(g){
    var rid = g.getAttribute('data-rid');
    if(rid && rid.charAt(0) === 'r') g.style.display = v && regions.some(r=>r.id===rid) ? '' : 'none';
  });
}
/* 结果态：推荐区域图层恢复（R5：工作台不再有常驻绘制工具栏与引导横幅） */
function syncResultLayerState(){
  var b = $('#lyrRegions');
  if(b) setLayer(b,true);
  var g = document.getElementById('lyRegions');
  if(g) g.classList.remove('g-off');
}
/* 清空上一轮自定义范围产出的推荐子区域（避免重复分析时叠加） */
function clearSubRegions(){
  var olds = regions.filter(function(r){ return r.scopeId; });
  regions = regions.filter(function(r){ return !r.scopeId; });
  olds.forEach(function(r){
    var g = document.querySelector('#cityMap .rgn[data-rid="' + r.id + '"]');
    if(g && g.parentNode) g.parentNode.removeChild(g);
  });
  if(curRegion && curRegion.scopeId) curRegion = null;
}
/* 自定义流程分析：范围非空 → 隐藏预置 8 区 + 逐 scope 生成范围内子区域
   R9：范围为空 → 保持自定义流程空态（不再整体切回预置 8 区，避免结果区「突然折叠」）；
   预置流程由「开始选址分析」（范围为空时）或「重置」显式恢复 */
function runCustomFlow(){
  if(!customRegions.length){
    customFlowActive = true;
    setPresetRegionsVisible(false);
    clearSubRegions();
    syncResultLayerState();
    renderRegionList(); refreshWbStats(); renderWbInfo(); renderGeoSel(); updateCfgSummary();
    return 0;
  }
  customFlowActive = true;
  setPresetRegionsVisible(false);
  clearSubRegions();
  customRegions.forEach(function(s){ generateSubRegions(s); });
  syncResultLayerState();
  renderRegionList(); refreshWbStats(); renderWbInfo(); renderGeoSel(); updateCfgSummary();
  var first = regions.filter(function(r){ return r.scopeId; })[0];
  if(first) selectRegion(first.id, true);
  return activeRegions().length;
}
/* 绘制完成 → 三阶段分析过渡（沿用 btnStart loading 模式，提示语针对自定义范围） */
var _scopeAnalyzing = false;
function analyzeCustomScope(scope){
  if(_scopeAnalyzing) return;
  _scopeAnalyzing = true;
  var phases = ['正在分析自定义范围…','正在计算供需缺口…','正在生成推荐区域…'];
  var i = 0;
  $('#mapLoadingTxt').textContent = phases[0];
  $('#mapLoading').classList.add('show');
  var timer = setInterval(function(){
    i++;
    if(i < phases.length){ $('#mapLoadingTxt').textContent = phases[i]; return; }
    clearInterval(timer);
    $('#mapLoading').classList.remove('show');
    _scopeAnalyzing = false;
    /* R5：按当前全部自定义范围重跑（算法不变）→ 工作台只显示范围内子区域 */
    var n = runCustomFlow();
    toast('自定义范围分析完成：' + (scope ? scope.name + '（' + scopeDesc(scope) + '）' : '全部范围') + '内共识别出 ' + n + ' 个推荐区域', 'ok');
  }, 900);
}
/* 在绘制圈圆心周边生成 2-4 个推荐子区域（评分插值沿用既有逻辑，量级自洽） */
function generateSubRegions(scope){
  var geo = scope.geo;
  var cx = geo.shape === 'circle' ? geo.cx : geo.lx;
  var cy = geo.shape === 'circle' ? geo.cy : geo.ly;
  var posK = 1 - Math.min(1, Math.sqrt(Math.pow(cx - 640, 2) + Math.pow(cy - 390, 2)) / 700);
  var areaK = Math.max(.4, Math.min(1, 4 / Math.max(geo.area, 1)));
  var n = 2 + (scope.seq % 3);   /* 2-4 个 */
  var names = ['A','B','C','D'];
  for(var i = 0; i < n; i++){
    subSeq++;
    var spread = geo.shape === 'circle' ? geo.r * .55 : 55;
    var ang = Math.PI * 2 / n * i + scope.seq * .7;
    var bx = Math.max(30, Math.min(910, cx + Math.cos(ang) * spread - 52));
    var by = Math.max(50, Math.min(600, cy + Math.sin(ang) * spread - 40));
    var score = Math.round(62 + posK * 18 + (1 - areaK) * 10 + ((scope.seq + i) % 3));
    score = Math.max(58, Math.min(93, score));
    var grade = score >= 85 ? 'A' : score >= 75 ? 'B' : score >= 66 ? 'C' : 'D';
    var gap = Math.round(60 + areaK * 180 + posK * 90 - i * 8);
    var piles = Math.max(4, Math.min(12, Math.round(geo.area * 1.6 / n)));
    var r = {
      id:'s' + subSeq, name: scope.name + ' · 推荐' + names[i] + '板块', dist:'自定义范围内', custom:true, scopeId: scope.id,
      score:score, grade:grade, gap:gap,
      dims:[score-4,score-8,score-6,score-2,score-5].map(function(v){ return Math.max(40, Math.min(96, v)); }),
      params:{ n:piles, p:120, unit:12, civil:18, other:6, deposit:null, rentY:Math.round(6 + areaK * 12), labor:null, fee:0.38, util:0.19, coef:1 }
    };
    regions.push(r);
    var g = document.createElementNS('http://www.w3.org/2000/svg','g');
    g.setAttribute('class','rgn sub');
    g.setAttribute('data-rid', r.id);
    g.setAttribute('role','button');
    g.setAttribute('focusable','true');
    g.setAttribute('tabindex','-1');
    g.setAttribute('aria-pressed','false');
    /* R7：框尺寸对齐预置 8 区（w 100-112 / h 80-86），标签宽度按文字自适应而非固定 112 */
    var w = 100 + ((i + scope.seq) % 3) * 6, h = 80 + ((i + scope.seq) % 4);
    var lb = '推荐' + names[i] + ' ' + grade + '·' + score;
    var cjk = 0;
    for(var q = 0; q < lb.length; q++){ if(lb.charCodeAt(q) > 255) cjk++; }
    var lw = Math.round(16 + cjk * 12.4 + (lb.length - cjk) * 6.2);
    g.setAttribute('transform','translate(' + bx.toFixed(1) + ',' + by.toFixed(1) + ')');
    g.innerHTML = '<rect class="halo" width="'+w+'" height="'+h+'" rx="10"/><rect class="box" width="'+w+'" height="'+h+'" rx="10"/>'
      + '<rect class="lbl-rank" x="-21" y="-24" width="20" height="19" rx="4" fill="#315EEF"/>'
      + '<text class="lbl-rank-t" x="-11" y="-10.5" font-size="11" font-weight="700" fill="#fff" text-anchor="middle">-</text>'
      + '<rect class="lbl-bg" x="0" y="-24" width="'+lw+'" height="19" rx="5" fill="#FFFFFF" stroke="#D8E1EE" stroke-width="1"/>'
      + '<text class="lbl-t" x="8" y="-10" font-size="11" fill="#315EEF">' + esc(lb) + '</text>'
      + '<g class="sel-mark" transform="translate('+(w-12)+',10)"><circle r="9" fill="#315EEF"/>'
      + '<path d="M-4 0 L-1 3.2 L4.2 -3" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></g>';
    $('#lyRegions').appendChild(g);
  }
  return n;
}
/* 自定义范围轮廓图层（每图独立，独立于推荐区域图层，不受其开关影响） */
function getScopeLayer(svg){
  var l = svg.querySelector('.ly-scopes');
  if(!l){
    l = document.createElementNS(SVGNS,'g');
    l.setAttribute('class','ly-scopes');
    svg.appendChild(l);
  }
  return l;
}
/* 单个范围的轮廓 + 深蓝标签 + hover 红叉（供三图统一渲染；R10 起只有圆形） */
function scopeMarkup(s){
  var geo = s.geo;
  var tagX = Math.max(4, Math.min(geo.cx - 60, 1040 - 158));
  var tagY = Math.max(22, geo.cy - geo.r - 26);
  var dx = geo.cx + geo.r * .72, dy = geo.cy - geo.r * .72;
  var label = s.name + ' · 半径' + s.km + 'km';
  return '<g class="rgn scope" data-scope="' + s.id + '">'
    + '<circle class="box" cx="' + geo.cx + '" cy="' + geo.cy + '" r="' + geo.r + '"/>'
    + '<rect x="' + tagX + '" y="' + tagY + '" width="154" height="19" rx="5" fill="#FFFFFF" stroke="#D8E1EE" stroke-width="1"/>'
    + '<text x="' + (tagX + 8) + '" y="' + (tagY + 13) + '" font-size="11" fill="#9db8ff">' + esc(label) + '</text>'
    + '<g class="scope-del" data-scope-del="' + s.id + '"><circle cx="' + dx.toFixed(1) + '" cy="' + dy.toFixed(1) + '" r="10" fill="#e5484d"/>'
    + '<path d="M' + (dx - 3.5).toFixed(1) + ' ' + (dy - 3.5).toFixed(1) + ' L' + (dx + 3.5).toFixed(1) + ' ' + (dy + 3.5).toFixed(1) + ' M' + (dx + 3.5).toFixed(1) + ' ' + (dy - 3.5).toFixed(1) + ' L' + (dx - 3.5).toFixed(1) + ' ' + (dy + 3.5).toFixed(1) + '" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></g>'
    + '</g>';
}
/* 统一渲染函数：把 customRegions 渲染到指定 svg（三图共用同一份数据，坐标无需换算） */
function renderScopes(svg){
  if(!svg) return;
  getScopeLayer(svg).innerHTML = customRegions.map(scopeMarkup).join('');
}
function renderScopesAll(){ allMaps().forEach(renderScopes); }
/* 画圈完成 → 仅登记自定义寻址范围（R10：只保留一个圈，重画即替换旧圈；分析统一由「开始选址分析」触发） */
function addCustomRegion(geo){
  customRegions.slice().forEach(function(s){ removeScopeById(s.id, true); });
  customSeq++;
  var scope = {
    id:'c' + customSeq, seq:customSeq, name:'自定义范围 #' + customSeq,
    shape:'circle', geo:geo,
    km: Math.round(Math.sqrt(geo.area / Math.PI) * 10) / 10
  };
  customRegions.push(scope);
  clearDrawTemp();
  renderScopesAll();
  renderGeoSel();
  updateCfgSummary();
  renderWbInfo();
  if(typeof invalidateRangeResults==='function')invalidateRangeResults();
  toast('已画出自定义范围（半径 ' + scope.km + 'km），将作为本次寻址范围', 'ok');
}
/* 删除自定义范围：三张图轮廓 + 范围内推荐子区域一并移除；清空后解锁区县 chips */
function removeScopeById(id, silent){
  var scope = customRegions.filter(function(s){ return s.id === id; })[0];
  if(!scope) return;
  customRegions = customRegions.filter(function(s){ return s.id !== id; });
  if(expResultsShown){renderScopesAll();renderGeoSel();invalidateRangeResults();if(!silent)toast('范围已删除，更新分析后生效','ok');return;}
  var removed = regions.filter(function(r){ return r.scopeId === id; });
  regions = regions.filter(function(r){ return r.scopeId !== id; });
  removed.forEach(function(r){
    var g = document.querySelector('#cityMap .rgn[data-rid="' + r.id + '"]');
    if(g && g.parentNode) g.parentNode.removeChild(g);
  });
  if(curRegion && curRegion.scopeId === id) curRegion = null;
  renderScopesAll();
  if(!silent){
    renderRegionList(); refreshWbStats(); renderGeoSel(); updateCfgSummary(); renderWbInfo();
    /* 首页删除范围 → 已出过结果时立即按剩余范围刷新（无剩余则保持自定义空态） */
    if(expResultsShown) runCustomFlow();
    toast('已删除 ' + scope.name + ' 及其 ' + removed.length + ' 个推荐区域，可重新绘制', 'ok');
  }
}
function deleteCustomScope(id){
  /* E-3（降级方案）：范围删除会连带移除其推荐区域 → 先确认并说明数量 */
  var n = regions.filter(function(r){ return r.scopeId === id; }).length;
  askConfirm('删除圈选范围后可重新绘制；上次分析结果保留，更新分析后生效。', function(){
    removeScopeById(id, false);
  });
}
/* =====================================================================
   首页地图就地绘制（R10 按住拖动画圈；R11 绘制面 = cityMap）
   ===================================================================== */
/* 首页地图直接绘制：点「＋ 自定义区域」后工具条显示在地图卡标题条右侧，按住拖动画圈 */
function enterCfgDraw(){
  if(_starting)return;rangeMode='draw';
  startDrawing($('#cityMap'));
  /* 绘制期间保留行政区；退出或清空圈选后恢复原范围。 */
  renderGeoSel();
  var t = $('#cfgDrawTools'); if(t) t.style.display = 'flex';
  var m = document.querySelector('#expGrid .map-card');
  if(m && m.scrollIntoView && window.innerWidth<1024){
    try { m.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' }); }
    catch(err){ m.scrollIntoView(); }
  }
  refreshRangeUX();scheduleStreetMap();
}
function exitCfgDraw(){
  if(!customRegions.length){rangeMode='district';}
  stopDrawing();
  var t = $('#cfgDrawTools'); if(t) t.style.display = 'none';
  renderGeoSel();refreshRangeUX();          /* 恢复范围状态 */
}
$('#cfgDrawExit').addEventListener('click', exitCfgDraw);
/* cityMap 自身 click 已处理范围删除红叉与区域选中，此处仅绑画圈拖动 */
bindDrawDrag('#cityMap');

/* =====================================================================
   区域详情页
   ===================================================================== */
/* 运营商分布（实测演示数据：Top10 运营商合计 21 站 / 189 枪 = 超充19+快充136+慢充34，与指标卡口径一致；头名整行高亮） */
function buildOpsTable(){
  var ops = [
    ['特来电',6,8,42,10],['星星充电',5,6,35,8],['云快充',2,2,15,3],['国家电网',2,1,12,7],['依威能源',1,1,8,3],
    ['小桔充电',1,0,9,1],['南方电网',1,1,6,2],['蔚景河',1,0,5,0],['车电网',1,0,3,0],['其他',1,0,1,0]
  ];
  var rows = ops.map(function(o, i){
    var tot = o[2] + o[3] + o[4];
    return '<tr' + (i === 0 ? ' class="cur"' : '') + '>'
      + '<td class="r" style="color:var(--text-3)">' + (i + 1) + '</td>'
      + '<td' + (i === 0 ? ' style="font-weight:700"' : '') + '>' + o[0] + '</td>'
      + '<td class="v r">' + o[1] + '</td>'
      + '<td class="v r">' + o[2] + '</td>'
      + '<td class="v r">' + o[3] + '</td>'
      + '<td class="v r">' + o[4] + '</td>'
      + '<td class="v r" style="color:var(--blue)">' + tot + '</td></tr>';
  }).join('');
  return '<table class="rp-ct">'
    + '<thead><tr><th class="r" style="width:6%">排名</th><th style="width:22%">运营商</th><th class="r">站数（座）</th><th class="r">超充终端（个）</th><th class="r">快充终端（个）</th><th class="r">慢充终端（个）</th><th class="r">合计终端数（个）</th></tr></thead>'
    + '<tbody>' + rows + '</tbody>'
    + '</table>';
}
/* 竞品服务费直方图（品牌三色+灰） */
function buildPriceChart(){
  var buckets = [['0.25-0.30',2],['0.30-0.35',5],['0.35-0.40',7],['0.40-0.45',4],['0.45-0.50',2],['0.50+',1]];
  var max = 7, baseY = 178, h = 150, x0 = 56, w = 62, gap = 17;
  var s = '<svg viewBox="0 0 640 216">';
  s += '<line x1="46" y1="'+baseY+'" x2="536" y2="'+baseY+'" stroke="#e4e7ec" stroke-width="1"/>';
  buckets.forEach(function(b, i){
    var bh = b[1] / max * h;
    var x = x0 + i * (w + gap);
    var isOurs = i === 2;
    s += '<rect x="'+x+'" y="'+(baseY-bh)+'" width="'+w+'" height="'+bh+'" rx="5" fill="'+(isOurs?'#315eef':'#cdd2dc')+'"/>';
    s += '<text x="'+(x+w/2)+'" y="'+(baseY-bh-7)+'" text-anchor="middle" font-size="12" font-weight="600" fill="'+(isOurs?'#315eef':'#4b5563')+'">'+b[1]+' 站</text>';
    s += '<text x="'+(x+w/2)+'" y="'+(baseY+16)+'" text-anchor="middle" font-size="11" fill="#4b5563">'+b[0]+'</text>';
  });
  s += '<text x="636" y="' + (baseY + 16) + '" text-anchor="end" font-size="10.5" fill="#4b5563">服务费（元/kWh）</text>';
  return s + '</svg>';
}
/* 运营商规模分布（纵向柱：按每站桩数分 5 档，合计仍为 21 座，最高档高亮） */
function buildScaleChart(){
  var cols = [['8 桩及以下',6,false],['9-16 桩',7,true],['17-24 桩',4,false],['25-32 桩',3,false],['33 桩及以上',1,false]];
  var max = 8, baseY = 168, h = 132, w = 76, gap = 20, x0 = 50;
  var s = '<svg viewBox="0 0 560 200">';
  s += '<line x1="40" y1="'+baseY+'" x2="520" y2="'+baseY+'" stroke="#e4e7ec" stroke-width="1"/>';
  cols.forEach(function(c, i){
    var bh = c[1] / max * h;
    var x = x0 + i * (w + gap);
    s += '<rect x="'+x+'" y="'+(baseY-bh)+'" width="'+w+'" height="'+bh+'" rx="6" fill="'+(c[2]?'#315eef':'#cdd2dc')+'"/>';
    s += '<text x="'+(x+w/2)+'" y="'+(baseY-bh-8)+'" text-anchor="middle" font-size="12" font-weight="600" fill="'+(c[2]?'#315eef':'#4b5563')+'">'+c[1]+' 座</text>';
    s += '<text x="'+(x+w/2)+'" y="'+(baseY+17)+'" text-anchor="middle" font-size="11" fill="#4b5563">'+c[0]+'</text>';
  });
  return s + '</svg>';
}
/* 车流分析共享区块（可多实例挂载：区域详情 / 意向场地评估共用；元素用 class 定位，避免多实例 id 冲突） */
function truckFlowHTML(){
  return '<div class="truck-flow">'
    + '<div class="kpi-grid">'
    + '<div class="kpi k-gray"><span class="k-name">新能源货车日均车流量</span><span class="k-val num" data-v="1424">0</span></div>'
    + '<div class="kpi k-green"><span class="k-name">新能源运营车日均车流量</span><span class="k-val num" data-v="935">0</span></div>'
    + '<div class="kpi k-orange"><span class="k-name">新能源私家车日均车流量</span><span class="k-val num" data-v="1193">0</span></div>'
    + '<div class="kpi k-purple"><span class="k-name">汽油车日均车流量</span><span class="k-val num" data-v="3451">0</span></div>'
    + '</div>'
    + '<div class="blk-title" style="margin-top:22px"><span class="pin">✦</span>3km范围车流构成（月日均）</div>'
    + '<div class="table-scroll"><table>'
    + '<thead><tr><th>车辆类型</th><th class="num">日均车流</th><th class="num">占比</th><th>充电能力</th></tr></thead>'
    + '<tbody>'
    + '<tr><td>新能源货车</td><td class="num"><b>1,424 辆</b></td><td class="num">20.2%</td><td><span class="badge b-green">核心目标客群</span></td></tr>'
    + '<tr><td>新能源运营车</td><td class="num"><b>935 辆</b></td><td class="num">13.2%</td><td><span class="badge b-blue">重要补充客群</span></td></tr>'
    + '<tr><td>新能源私家车</td><td class="num"><b>1,193 辆</b></td><td class="num">16.9%</td><td><span class="badge b-teal">乘用车超充客群</span></td></tr>'
    + '<tr><td>汽油车私家车</td><td class="num">3,316 辆</td><td class="num">47.0%</td><td><span class="badge b-yellow">潜在转化客群</span></td></tr>'
    + '<tr><td>汽油车运营车</td><td class="num">135 辆</td><td class="num">1.9%</td><td><span class="badge b-yellow">潜在转化客群</span></td></tr>'
    + '</tbody></table></div>'
    + '<div class="blk-title" style="margin-top:24px"><span class="pin">✦</span>新能源货车分时段车流分布（月小时均）</div>'
    + '<div class="chart-legend" role="group" aria-label="折线图图例，点击可显示或隐藏对应曲线">'
    + '<button type="button" class="lg-btn on" data-series="truck"><span class="dot" style="background:#4c6ef5;"></span>新能源货车</button>'
    + '<button type="button" class="lg-btn on" data-series="ops"><span class="dot" style="background:#e8495a;"></span>新能源运营车</button>'
    + '<button type="button" class="lg-btn on" data-series="private"><span class="dot" style="background:#12b886;"></span>新能源私家车</button>'
    + '</div>'
    + '<div class="chart-box">'
    + '<svg class="flowChart" viewBox="0 0 920 330" role="img" aria-label="分时段车流分布折线图，横轴0点至23点，纵轴为辆每小时"></svg>'
    + '<div class="chart-tip"></div>'
    + '</div>'
    + '<p class="mix-note">※ 提示：点击图例可显示/隐藏曲线；将鼠标悬停在图上可查看各时刻数值。</p>'
    + '</div>';
}
function initTruckFlow(mount){
  var root = mount ? mount.querySelector('.truck-flow') : null;
  if(!root) return;

  /* KPI 数字滚动（进入视口触发一次） */
  function animateNum(el){
    var target = parseFloat(el.getAttribute('data-v'));
    var dur = 1100, t0 = null;
    function step(ts){
      if(!t0) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * e).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      if(p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var numObs = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if(en.isIntersecting){ animateNum(en.target); numObs.unobserve(en.target); }
    });
  }, {threshold: .4});
  root.querySelectorAll('.num[data-v]').forEach(function(el){ numObs.observe(el); });

  /* 分时段车流折线图 */
  var hours = [];
  for(var h = 0; h < 24; h++) hours.push(h);
  var series = {
    truck:  {name: '新能源货车',   color: '#4c6ef5', data: [30,22,18,20,25,35,60,95,140,168,172,170,150,158,166,175,170,150,135,120,95,70,50,40]},
    ops:    {name: '新能源运营车', color: '#e8495a', data: [20,14,12,13,16,22,42,70,100,115,122,118,108,112,118,122,120,110,100,88,68,50,35,28]},
    private:{name: '新能源私家车', color: '#12b886', data: [35,25,20,22,28,40,70,105,128,132,130,128,125,130,133,137,132,120,108,95,75,55,42,35]}
  };
  var visible = {truck: true, ops: true, private: true};
  var W = 920, H = 330, PL = 46, PR = 16, PT = 14, PB = 32;
  function X(i){ return PL + i * (W - PL - PR) / 23; }
  function Y(v){ return H - PB - (v / 190) * (H - PT - PB); }
  var svg = root.querySelector('.flowChart');
  var SVGNS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs){
    var e = document.createElementNS(SVGNS, tag);
    for(var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function draw(){
    while(svg.firstChild) svg.removeChild(svg.firstChild);
    /* 网格与坐标 */
    for(var g = 0; g <= 180; g += 30){
      svg.appendChild(el('line', {x1: PL, x2: W - PR, y1: Y(g), y2: Y(g), stroke: '#eef0f5', 'stroke-width': 1}));
      var t = el('text', {x: PL - 8, y: Y(g) + 4, 'text-anchor': 'end', 'font-size': '10', fill: '#a0a4b8'});
      t.textContent = g; svg.appendChild(t);
    }
    hours.forEach(function(hh){
      if(hh % 2) return;
      var t = el('text', {x: X(hh), y: H - 10, 'text-anchor': 'middle', 'font-size': '10', fill: '#a0a4b8'});
      t.textContent = hh + ':00'; svg.appendChild(t);
    });
    var yl = el('text', {x: 12, y: PT + 8, 'font-size': '10', fill: '#a0a4b8'});
    yl.textContent = '辆/小时'; svg.appendChild(yl);
    /* 底部阴影面积（货车） */
    if(visible.truck){
      var d = 'M' + X(0) + ',' + Y(0);
      hours.forEach(function(hh){ d += ' L' + X(hh) + ',' + Y(series.truck.data[hh]); });
      d += ' L' + X(23) + ',' + Y(0) + ' Z';
      svg.appendChild(el('path', {d: d, fill: 'rgba(108,99,216,.08)'}));
    }
    /* 各序列折线 + 数据点 */
    Object.keys(series).forEach(function(key){
      if(!visible[key]) return;
      var pts = hours.map(function(hh){ return X(hh) + ',' + Y(series[key].data[hh]); }).join(' ');
      svg.appendChild(el('polyline', {points: pts, fill: 'none', stroke: series[key].color, 'stroke-width': 2.2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round'}));
      hours.forEach(function(hh){
        svg.appendChild(el('circle', {cx: X(hh), cy: Y(series[key].data[hh]), r: 2.4, fill: '#fff', stroke: series[key].color, 'stroke-width': 1.6}));
      });
    });
    /* 16:00 参考虚线（复刻原报告标注） */
    if(visible.private){
      svg.appendChild(el('line', {x1: X(16), x2: X(16), y1: Y(series.private.data[16]), y2: H - PB, stroke: '#b9b5e6', 'stroke-width': 1, 'stroke-dasharray': '4 3'}));
      var tg = el('g', {});
      tg.appendChild(el('rect', {x: X(16) - 130, y: Y(series.private.data[16]) - 8, width: 126, height: 26, rx: 6, fill: '#fff', stroke: '#e3e5f2'}));
      tg.appendChild(el('circle', {cx: X(16) - 118, cy: Y(series.private.data[16]) + 5, r: 4, fill: '#12b886'}));
      var tt = el('text', {x: X(16) - 108, y: Y(series.private.data[16]) + 9, 'font-size': '11', fill: '#2b2d42'});
      tt.textContent = '新能源私家车  137';
      tg.appendChild(tt);
      svg.appendChild(tg);
    }
  }
  draw();

  /* 图例开关 */
  root.querySelectorAll('.chart-legend .lg-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      var key = btn.getAttribute('data-series');
      visible[key] = !visible[key];
      btn.classList.toggle('off', !visible[key]);
      draw();
    });
  });

  /* 悬停提示 */
  var tip = root.querySelector('.chart-tip');
  var chartBox = root.querySelector('.chart-box');
  svg.addEventListener('mousemove', function(ev){
    var rect = svg.getBoundingClientRect();
    var x = (ev.clientX - rect.left) * (W / rect.width);
    var i = Math.round((x - PL) / ((W - PL - PR) / 23));
    if(i < 0 || i > 23){ tip.style.display = 'none'; return; }
    var rows = Object.keys(series).filter(function(k){ return visible[k]; }).map(function(k){
      return '<div class="t-row"><span class="dot" style="background:' + series[k].color + ';"></span>'
        + '<span>' + series[k].name + '</span><span>' + series[k].data[i] + '</span></div>';
    }).join('');
    tip.innerHTML = '<div class="t-time">' + (i < 10 ? '0' + i : i) + ':00</div>' + rows;
    tip.style.display = 'block';
    var bx = ev.clientX - chartBox.getBoundingClientRect().left + 14;
    if(bx > chartBox.clientWidth - 170) bx -= 190;
    tip.style.left = bx + 'px';
    tip.style.top = '30px';
  });
  svg.addEventListener('mouseleave', function(){ tip.style.display = 'none'; });
}
/* 区域详情页挂载车流分析实例 */
(function(){
  var m = $('#truckFlowR');
  if(m){ m.innerHTML = truckFlowHTML(); initTruckFlow(m); }
})();
/* 24h 供需曲线（动态：按区域供给能力） */
function buildGapChart(cap, peak){
  var demand = [180,140,120,130,180,300,480,680,860,1000,1150,1080,900,820,860,940,1050,1180,1240,1120,900,700,450,260];
  var scale = peak / 1240;
  var ymax = Math.ceil(peak * 1.12 / 100) * 100;
  var X = function(h){ return 56 + h / 24 * 468; };
  var Y = function(v){ return 196 - v / ymax * 162; };
  var s = '<svg viewBox="0 0 560 258">';
  [0, .5, 1].forEach(function(f){
    var yy = 196 - f * 162;
    s += '<line x1="56" y1="'+yy+'" x2="524" y2="'+yy+'" stroke="#e4e7ec" stroke-width="1"/>';
    s += '<text x="50" y="'+(yy+4)+'" text-anchor="end" font-size="10" fill="#4b5563">'+Math.round(ymax*f)+'</text>';
  });
  for(var h=0; h<=24; h+=6){
    s += '<text x="'+X(h)+'" y="214" text-anchor="middle" font-size="11" fill="#4b5563">'+(h<10?'0':'')+h+':00</text>';
  }
  /* 预计供给能力线 */
  s += '<line x1="56" y1="'+Y(cap)+'" x2="524" y2="'+Y(cap)+'" stroke="#315eef" stroke-width="2" stroke-dasharray="8 6"/>';
  s += '<text x="524" y="'+(Y(cap)-7)+'" text-anchor="end" font-size="11" fill="#315eef" font-weight="600">预计供给能力 '+cap+'kW</text>';
  /* 缺口区间（需求 > 供给） */
  var segs = [], cur = null;
  for(var i=0; i<24; i++){
    var v = demand[i] * scale;
    if(v > cap){
      if(!cur) cur = {a: i, pts: []};
      cur.pts.push([i, v]);
    } else if(cur){
      cur.b = i; segs.push(cur); cur = null;
    }
  }
  if(cur){ cur.b = 24; segs.push(cur); }
  segs.forEach(function(sg){
    var p = 'M'+X(sg.a)+' '+Y(cap);
    sg.pts.forEach(function(q){ p += ' L'+X(q[0]).toFixed(1)+' '+Y(q[1]).toFixed(1); });
    p += ' L'+X(sg.b)+' '+Y(cap)+' Z';
    s += '<path d="'+p+'" fill="rgba(255,122,26,.2)"/>';
  });
  /* 需求曲线 */
  var pl = '';
  demand.forEach(function(v, i){ pl += (i?' L':'M') + X(i).toFixed(1) + ' ' + Y(v*scale).toFixed(1); });
  s += '<path d="'+pl+'" fill="none" stroke="#315EEF" stroke-width="2.5" stroke-linejoin="round"/>';
  var peakH = demand.indexOf(Math.max.apply(null, demand));
  s += '<circle cx="'+X(peakH)+'" cy="'+Y(peak*scale)+'" r="4" fill="#315EEF"/>';
  s += '<text x="'+X(peakH)+'" y="'+(Y(peak*scale)-10)+'" text-anchor="middle" font-size="11" fill="#e56a10" font-weight="600">高峰缺口 '+(peak-cap)+'kW</text>';
  /* 图例（底部）：需求曲线 / 预计供给虚线 / 缺口区间 */
  s += '<g font-size="11" fill="#4b5563">';
  s += '<line x1="56" y1="240" x2="76" y2="240" stroke="#315EEF" stroke-width="2.5" stroke-linecap="round"/>';
  s += '<text x="82" y="244">充电需求</text>';
  s += '<line x1="140" y1="240" x2="160" y2="240" stroke="#315eef" stroke-width="2" stroke-dasharray="7 5"/>';
  s += '<text x="166" y="244">预计供给能力</text>';
  s += '<rect x="246" y="234" width="18" height="11" rx="2" fill="rgba(255,122,26,.2)"/>';
  s += '<text x="270" y="244">缺口区间 · 可承接增量</text>';
  s += '<text x="524" y="244" text-anchor="end" fill="#6b7280">单位 kW · 模型估算</text>';
  s += '</g>';
  return s + '</svg>';
}
/* 客群结构环形图 */
function buildCustChart(){
  var data = [['网约车',42,'#315eef'],['物流车',23,'#315EEF'],['私家车',20,'#14966d'],['出租车',15,'#cdd2dc']];
  var r = 60, C = 2 * Math.PI * r, cx = 100, cy = 96;
  var s = '<svg viewBox="0 0 560 200">';
  s += '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="#f2f4f7" stroke-width="26"/>';
  var acc = 0;
  data.forEach(function(d){
    var len = C * d[1] / 100;
    s += '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+d[2]+'" stroke-width="26" stroke-dasharray="'+len.toFixed(1)+' '+(C-len).toFixed(1)+'" transform="rotate('+(-90 + acc * 3.6)+' '+cx+' '+cy+')"/>';
    acc += d[1];
  });
  data.forEach(function(d, i){
    var y = 44 + i * 34;
    s += '<rect x="240" y="'+(y-11)+'" width="12" height="12" rx="3" fill="'+d[2]+'"/>';
    s += '<text x="262" y="'+y+'" font-size="13" fill="#4b5563">'+d[0]+'</text>';
    s += '<text x="470" y="'+y+'" text-anchor="end" font-size="15" font-weight="700" fill="#111827">'+d[1]+'%</text>';
  });
  return s + '</svg>';
}

/* 条件研判：三态清单 */
var condDefs = [
  {l:'电网接入容量', t:'official',
   ok:'2×630kVA 专用变压器，报装通道畅通',
   wait:'需向供电公司确认报装窗口与排队周期', fix:'建议本月内提交容量预审'},
  {l:'变压器剩余容量', t:'official',
   ok:'剩余 380kW，可满足全部终端同时满载',
   wait:'剩余容量接近上限，需扩容评估', fix:'建议申请扩容或增配储能错峰'},
  {l:'接电距离', t:'model',
   ok:'约 80m，电缆造价可控',
   wait:'约 200m，需现场核实管廊路由', no:'接电距离约 1.2km，需复核接入方案与线路投资', fix:'建议优先洽谈沿线管廊共用'},
  {l:'土地产权', t:'official',
   ok:'国有建设用地，产权清晰可租赁',
   wait:'部分地块为集体用地，需核实转性进度', fix:'建议要求业主提供转性批文进度表'},
  {l:'车位条件', t:'official',
   ok:'32 个可改造车位，含 4 个大型车位',
   wait:'可改车位仅 18 个，低于规划车位数', fix:'建议协调邻位车位置换或缩减规模'},
  {l:'租期年限', t:'none',
   ok:'业主意向 8 年，满足期望回收周期',
   wait:'业主意向 5 年，短于期望回收周期', fix:'建议争取 8 年或加入优先续租条款'},
  {l:'禁建区核查', t:'official',
   ok:'不在禁建区、生态红线与河道蓝线范围内',
   wait:'地块毗邻控规待更新区域，禁建口径待自然资源局复核', fix:'建议调取最新控规图斑核对并留存批复'},
  {l:'限行政策', t:'official',
   ok:'货车与网约车不限行，进出场便利',
   wait:'核心区早晚高峰限外地牌照，影响物流车进站', fix:'建议核实限行时段与新能源豁免政策'},
  {l:'消防条件', t:'official',
   ok:'消防环道达标，距最近消防站 1.2km',
   no:'现状环道宽 4.2m，低于 4.5m 标准', fix:'调整车位布局预留 4.5m 环形消防通道，需重新报审'},
  {l:'市政配套', t:'model',
   ok:'给排水与通信管线齐备',
   wait:'通信专线容量待运营商确认', fix:'建议同步发起专线扩容询价'}
];
function statesFor(grade, id){
  if(id === 'r2') return ['ok','ok','ok','ok','ok','wait','ok','wait','no','ok'];
  if(grade === 'A') return ['ok','ok','wait','ok','ok','ok','ok','ok','ok','wait'];
  if(grade === 'B') return ['ok','ok','wait','ok','ok','wait','ok','wait','ok','wait'];
  return ['ok','wait','no','ok','wait','wait','wait','wait','ok','wait'];
}
var condIcons = {
  ok: '<span class="st-ic st-ok"><span class="condition-status-icon" style="--status-icon:url(./assets/control-2657b61d94.svg)" aria-hidden="true"></span></span>',
  wait: '<span class="st-ic st-wait"><span class="condition-status-icon" style="--status-icon:url(./assets/control-9fa1d711de.svg)" aria-hidden="true"></span></span>',
  no: '<span class="st-ic st-no"><span class="condition-status-icon" style="--status-icon:url(./assets/control-3cbfe6ca81.svg)" aria-hidden="true"></span></span>'
};
var condNames = { ok:['通过','ok-t'], wait:['待核验','wait-t'], no:['不通过','no-t'] };
function renderConds(r, sel){
  var states = statesFor(r.grade, r.id);
  $(sel || '#condList').innerHTML = condDefs.map(function(c, i){
    var st = states[i], meta = condNames[st];
    var detail = (st === 'ok' ? c.ok : (st === 'wait' ? c.wait : c.no)) || '条件资料待补充，请现场核实';
    var fix = (st !== 'ok' && c.fix) ? ' <span class="fix">→ ' + esc(c.fix) + '</span>' : '';
    /* 待核验项：右侧提供补充完善入口 */
    var entry = st === 'wait'
      ? '<button type="button" class="c-fix" data-fix="'+i+'" aria-label="去补充完善'+esc(c.l)+'">去补充<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></button>'
      : '';
    return '<div class="cond">' + condIcons[st]
      + '<div class="c-body"><div class="c-t">' + esc(c.l) + '<span class="st '+meta[1]+'">'+meta[0]+'</span>' + (c.t === 'official' || c.t === 'model' ? '' : tag(c.t)) + '</div>'
      + '<div class="c-d">' + esc(detail) + fix + '</div></div>' + entry + '</div>';
  }).join('');
}
/* 待核验项「去补充」：演示态提示补充材料入口（上线后接工单 / 上传流） */
['#condList', '#astCondList'].forEach(function(sel){
  var box = $(sel);
  if(!box) return;
  box.addEventListener('click', function(e){
    var b = e.target.closest('.c-fix');
    if(!b) return;
    var c = condDefs[+b.getAttribute('data-fix')];
    toast('「' + c.l + '」补充材料入口：提交凭证后将自动更新核验状态', 'info');
  });
});

/* 投资测算区（共享区块：区域详情 / 意向场地评估共用，grid 为挂载容器） */
function invTiles(inv, grid){
  if(!grid) return;
  var tiles = [
    ['总投资（CAPEX）', inv.capex, '万元', 0],
    ['年度运营成本', inv.opexYear, '万元/年', 0],
    ['预计年收入', inv.revYear, '万元/年', 1],
    ['静态回收期', inv.payback, '年', 1],
    ['年化 ROI', inv.roi, '%', 1]
  ];
  var oldVals = {};
  Array.prototype.slice.call(grid.querySelectorAll('b[data-v]')).forEach(function(b, i){
    oldVals[i] = parseFloat(b.getAttribute('data-v')) || 0;
  });
  grid.innerHTML = tiles.map(function(t){
    return '<div><label>'+t[0]+'</label>'
      + '<b class="num" data-v="'+t[1]+'">0<small>'+t[2]+'</small></b></div>';
  }).join('');
  Array.prototype.slice.call(grid.querySelectorAll('b[data-v]')).forEach(function(b, i){
    countUp(b, tiles[i][1], {dur:600, dec:tiles[i][3], from:oldVals[i] || 0, suffix:''});
    /* suffix 放 small，滚动后再补单位 */
    (function(el, unit){
      setTimeout(function(){
        el.innerHTML = el.textContent + '<small>'+unit+'</small>';
      }, 620);
    })(b, tiles[i][2]);
  });
}
/* CAPEX / OPEX 分项表（rows: [科目, 金额(数字或 null=待补充)]；合计行加底加粗） */
function invTableHTML(rows, total, unitLabel){
  var body = rows.map(function(r){
    var amt = r[1] === null
      ? '<td class="r" style="color:var(--text-3)">待补充</td>'
      : '<td class="v r num">' + r[1] + '</td>';
    return '<tr><td>' + r[0] + '</td>' + amt + '</tr>';
  }).join('');
  return '<table class="rp-ct"><thead><tr><th>科目</th><th class="r">' + unitLabel + '</th></tr></thead>'
    + '<tbody>' + body
    + '<tr style="font-weight:700;background:var(--surface-2)"><td>合计</td><td class="r num">' + total + '</td></tr></tbody></table>';
}
function renderInvTables(p, capexEl, opexEl){
  if(!capexEl || !opexEl) return;
  var cx = capexItems(p), ox = opexItems(p);
  capexEl.innerHTML = invTableHTML(cx.rows, cx.total, '金额（万元）');
  opexEl.innerHTML = invTableHTML(ox.rows, ox.total, '金额（万元/年）');
}

/* 推荐区域切换条：与推荐区域列表同序（rankedRegions），当前项高亮 */
function renderRdTabs(curId){
  var el = $('#rdTabs');
  if(!el) return;
  var list = rankedRegions();
  renderRegionList();
  el.replaceChildren(...list.map(function(r,i){
    const source=[...document.querySelectorAll('#rgnList .rgn-item')].find(card=>card.dataset.rid===r.id);
    const card=source.cloneNode(true);
    card.classList.toggle('sel',r.id===curId);
    const select=card.querySelector('.rgn-select');
    select.dataset.rtab=r.id;select.setAttribute('aria-pressed',String(r.id===curId));
    card.querySelector('.rgn-actions')?.remove();
    return card;
  }));
}
$('#rdTabs').addEventListener('click', function(e){
  var b = e.target.closest('[data-rtab]');
  if(b && b.getAttribute('data-rtab') !== (curRegion && curRegion.id)) openRegion(b.getAttribute('data-rtab'));
});

/* R11：详情页九段报告渲染（参照《智能选址·区域推荐报告V3》） */
var RD_DIMS = ['理论充电需求','实际承接需求','未承接需求率','需求支撑度','单桩运能指数'];
var RD_CHAIN_DESC = [
  '网格电动汽车保有量与出行强度推算的日充电需求总量，反映市场容量',
  '网格内既有场站当前实际消化的充电量，反映供给已满足的部分',
  '未被现有场站承接的需求占理论需求的比例，即新建场站可瓜分的市场空间',
  '未承接需求折算为成熟站日电量基数的倍数，衡量缺口的可开发性',
  '网格单桩利用条件（车位 / 电力 / 客流）相对城市均值的水平'
];
/* 01 评估摘要：五大数卡（与其他模块统一的 KPI 渐变卡；等级卡按 A/B/C/D 变色） */
function rdSummary(r, inv){
  var n = r.params.n, fast = Math.ceil(n / 2);
  var gradeK = {A: 'k-green', B: 'k-purple', C: 'k-orange', D: 'k-gray'}[r.grade] || 'k-gray';
  $('#rdSumBox').innerHTML =
    '<div class="kpi k-gray"><span class="k-name">综合评分</span><span class="k-val">' + r.score + '</span></div>'
    + '<div class="kpi ' + gradeK + '"><span class="k-name">推荐等级</span><span class="k-val">' + r.grade + ' 级</span></div>'
    + '<div class="kpi k-orange"><span class="k-name">建议规模 · 超充 ' + fast + ' · 快充 ' + (n - fast) + '</span><span class="k-val">' + n + '<small> 桩</small></span></div>'
    + '<div class="kpi k-purple"><span class="k-name">建议服务费 元/kWh</span><span class="k-val">' + (r.params.fee - 0.02).toFixed(2) + '-' + (r.params.fee + 0.04).toFixed(2) + '<small> 元</small></span></div>'
    + '<div class="kpi k-green"><span class="k-name">预计回收期</span><span class="k-val">' + inv.payback.toFixed(1) + '<small> 年</small></span></div>';
}
/* 07 推荐区域对比：全推荐区域横比，当前行高亮，点击行可切换 */
function renderRdCmp(curId){
  var list = rankedRegions();
  $('#rdCmpTab').innerHTML = '<tr><th>排名</th><th>推荐区域</th><th>区县</th><th class="r">评分</th><th>等级</th><th>建议规模</th><th>服务费</th><th class="r">回收期</th></tr>'
    + list.map(function(x, i){
      var iv = calcInv(x.params);
      return '<tr data-rtab="' + x.id + '"' + (x.id === curId ? ' class="cur"' : '') + '>'
        + '<td class="num">#' + (i + 1) + '</td>'
        + '<td' + (x.id === curId ? ' style="font-weight:600;color:var(--blue)"' : '') + '>' + esc(x.name) + '</td>'
        + '<td>' + esc(x.dist) + '</td>'
        + '<td class="r num" style="color:var(--rate-' + x.grade.toLowerCase() + ')">' + x.score + '</td>'
        + '<td><span class="rk sm rk-' + x.grade + '">' + x.grade + '</span></td>'
        + '<td class="num">' + x.params.n + ' 桩</td>'
        + '<td class="num">' + x.params.fee.toFixed(2) + ' 元</td>'
        + '<td class="r num">' + iv.payback.toFixed(1) + ' 年</td></tr>';
    }).join('');
}
$('#rdCmpTab').addEventListener('click', function(e){
  var tr = e.target.closest('tr[data-rtab]');
  if(tr && tr.getAttribute('data-rtab') !== (curRegion && curRegion.id)) openRegion(tr.getAttribute('data-rtab'));
});

/* 打开区域详情 */
function openRegion(id){
  var r = regionById(id);
  curRegion = r;
  renderRdTabs(r.id);
  var inv = calcInv(r.params);
  /* 01 评估摘要 */
  rdSummary(r, inv);
  /* 02 区域评分依据：雷达 + 指标表（口径说明与报告一致） */
  var theo = Math.round(inv.dailyKWh / 0.78), act = Math.round(inv.dailyKWh);
  var unmet = ((theo - act) / theo * 100).toFixed(1);
  var sup = (r.gap / inv.cap).toFixed(2);
  var pile = (inv.dailyKWh / r.params.n / 407).toFixed(2);
  var fmtK = function(v){ return v.toLocaleString('en-US'); };
  $('#rdRadar').innerHTML = radarSVG(RD_DIMS, r.dims, 290);
  var chainVals = [fmtK(theo) + ' kWh/天', fmtK(act) + ' kWh/天', unmet + '%', sup, pile];
  $('#rdChainTab').innerHTML = '<tr><th style="width:22%">指标</th><th style="width:18%">数值</th><th>指标说明</th></tr>'
    + RD_DIMS.map(function(nm, i){
      return '<tr><td>' + nm + '</td><td class="v num">' + chainVals[i] + '</td><td class="f">' + RD_CHAIN_DESC[i] + '</td></tr>';
    }).join('');
  /* 03 区域竞争格局：格局结论 + 四指标卡 + 运营商/价格/规模分布 */
  $('#rdCompText').innerHTML = '竞争格局呈<b>「一超多强」</b>态势：特来电以 <b>6 站</b>（占比 29%）位居第一，星星充电 5 站紧随其后，前二集中度 <b>52%</b>；'
    + '供给以中小站为主，大功率快充有差异化空间；价格上竞品挂牌 <b>0.31-0.52 元/度</b>、平均 0.38 元，'
    + '建议服务费 <b>' + r.params.fee.toFixed(2) + ' 元</b>，处于竞品区间中位附近，可依托车位与功率配置形成差异化。';
  $('#rdPatMetrics').innerHTML =
    '<div class="kpi k-gray"><span class="k-name">充电站总数</span><span class="k-val">21<small> 座</small></span></div>'
    + '<div class="kpi k-green"><span class="k-name">终端总数（超充 19 · 快充 136 · 慢充 34）</span><span class="k-val">189<small> 个</small></span></div>'
    + '<div class="kpi k-orange"><span class="k-name">区域电价区间</span><span class="k-val">0.35-0.40<small> 元/度</small></span></div>'
    + '<div class="kpi k-purple"><span class="k-name">区域平均服务费（元/度）</span><span class="k-val">0.38</span></div>';
  $('#chartOps').innerHTML = buildOpsTable();
  $('#chartPrice').innerHTML = buildPriceChart();
  $('#chartScale').innerHTML = buildScaleChart();
  /* 04 重卡车流与需求分析为静态模块（交互见 .truck-flow IIFE），无需随区域重渲染 */
  /* 05 供需缺口 */
  $('#rdGapText').innerHTML = '理论充电需求 <b>' + fmtK(theo) + ' kWh/天</b>，现有承接 <b>' + fmtK(act) + ' kWh/天</b>，'
    + '潜在未承接 <b>' + fmtK(theo - act) + ' kWh/天</b>（未承接率 <b>' + unmet + '%</b>）；'
    + '时段呈<b>夜间高峰（19-24 时）</b>特征，客群以<b>网约车</b>为主，缺口时段即建站可承接的增量空间。';
  $('#chartGap').innerHTML = buildGapChart(inv.cap, inv.cap + r.gap);
  $('#chartCust').innerHTML = buildCustChart();
  /* 06 条件研判 */
  renderConds(r);
  /* 07 投资测算 */
  invTiles(inv, $('#invGrid'));
  renderInvTables(r.params, $('#invCapexTab'), $('#invOpexTab'));
  /* 09 推荐区域对比（末位模块） */
  renderRdCmp(r.id);
  /* 08 选址策略与下一步建议内嵌：推荐理由与风险提示（五维取最强两项 / 最弱两项） */
  var order = r.dims.map(function(v, i){ return [v, i]; }).sort(function(a, b){ return b[0] - a[0]; });
  var why = order.slice(0, 2), risk = order.slice(-2).reverse();
  $('#rdWhyList').innerHTML = '<ul>'
    + why.map(function(d){ return '<li><b>' + RD_DIMS[d[1]] + ' ' + d[0] + '</b> — 位于五维前列，是本区域评分的主要支撑</li>'; }).join('')
    + '<li><b>竞品服务费中位 0.38 元</b> — 建议服务费区间具备定价与调价空间</li></ul>';
  $('#rdRiskList').innerHTML = '<ul>'
    + risk.map(function(d){ return '<li><b>' + RD_DIMS[d[1]] + ' ' + d[0] + '</b> — 相对薄弱，需在方案中针对性补强</li>'; }).join('')
    + '<li><b>车位 / 租期等待核验项</b> — 需现场落实后再进入签约环节</li></ul>';
  /* 08 选址策略与下一步建议（最终投资建议并入评分下方文字说明） */
  renderFinalAdv($('#finAdvR'), r, inv);
  openRegion._inv = inv;
  go('region');
}
/* 10 选址策略与最终投资建议（区域详情专用区块，root 为 .fin-adv 容器；
   opts.ctxName 用于等级表当前行标注，如「当前推荐区域」/「当前场地」） */
var ADV_TIERS = [
  {min: 85, max: 100, label: '强烈推荐', badge: 'b-green', desc: '各项指标优秀，建议优先投资'},
  {min: 70, max: 84,  label: '推荐投资', badge: 'b-green', desc: '综合条件良好，具备投资价值'},
  {min: 55, max: 69,  label: '谨慎投资', badge: 'b-yellow', desc: '存在一定风险，需进一步论证'},
  {min: 0,  max: 54,  label: '不推荐',   badge: 'b-red',   desc: '风险较高，建议暂缓或放弃'}
];
function advTier(score){
  return ADV_TIERS.filter(function(t){ return score >= t.min && score <= t.max; })[0] || ADV_TIERS[3];
}
function renderFinalAdv(root, r, inv, opts){
  if(!root) return;
  opts = opts || {};
  var ctxName = opts.ctxName || '当前推荐区域';
  var t = advTier(r.score);
  var strat = {
    A: '评分与回收期均处第一梯队，建议<b>尽快锁定场地</b>、按建议规模一次到位',
    B: '条件基本成熟，建议<b>完成待核验项后立项</b>、规模按建议区间中位执行',
    C: '存在明显短板，建议<b>控制规模试探进入</b>、视表现分二期扩建',
    D: '多项硬指标不占优，<b>不建议优先投入</b>，可作网络补盲备选观察'
  }[r.grade] || '';
  countUp(root.querySelector('.fa-score'), r.score, {dur: 900});
  root.querySelector('.fa-grade').textContent = t.label;
  root.querySelector('.fa-text').innerHTML = '按 <b>' + r.params.n + ' 桩 × ' + r.params.p + 'kW</b>、服务费 <b>' + (r.params.fee - 0.02).toFixed(2) + '-' + (r.params.fee + 0.04).toFixed(2) + ' 元/kWh</b> 测算，'
    + '总投资 <b>' + Math.round(inv.capex) + ' 万元</b>、预计年收入 <b>' + inv.revYear.toFixed(1) + ' 万元/年</b>、静态回收期 <b>' + inv.payback.toFixed(1) + ' 年</b>；'
    + strat + '。'
    + (opts.nextHTML || '<div style="margin-top:6px">下一步：<b>现场核实</b>车位 / 接电 / 变压器容量 → <b>商务谈判</b>锁定长期租期 → <b>场地级评估</b> → <b>投运校准</b>。</div>');
  root.querySelector('.fa-grades').innerHTML = '<thead><tr><th style="width:18%">评分区间</th><th style="width:18%">投资建议等级</th><th>说明</th></tr></thead><tbody>'
    + ADV_TIERS.map(function(x){
        var cur = x === t;
        return '<tr' + (cur ? ' class="cur"' : '') + '><td class="v">' + x.min + '-' + x.max + '分</td>'
          + '<td><span class="badge ' + x.badge + '">' + x.label + '</span></td>'
          + '<td>' + x.desc + (cur ? ' <b style="color:var(--blue)">← ' + ctxName + '（' + r.score + '分）</b>' : '') + '</td></tr>';
      }).join('') + '</tbody>';
}
/* 导出报告（合并原「加入对比」「纳入建站计划」） */
$('#btnRdExport').addEventListener('click', function(){
  toast('报告导出中', 'info');
});

/* 编辑建站方案弹窗：改参数 → 重新测算 → 数字滚动 */
$('#btnEditPlan').addEventListener('click', function(){
  if(!curRegion) curRegion = regions[1];
  var p = curRegion.params;
  $('#pN').value = p.n; $('#pP').value = p.p; $('#pCoef').value = p.coef; $('#pFee').value = p.fee;
  $('#pDeposit').value = p.deposit == null ? '' : p.deposit; $('#pUnit').value = p.unit; $('#pCivil').value = p.civil; $('#pOther').value = p.other;
  $('#pRent').value = p.rentY; $('#pLabor').value = p.labor == null ? '' : p.labor;
  planOpener = document.activeElement;
  $('#planModal').classList.add('show');
  var pf = $('#pN'); if(pf && pf.focus) pf.focus();
});
function closePlan(){
  $('#planModal').classList.remove('show');
  if(planOpener && planOpener.focus){ try { planOpener.focus(); } catch(e){} }
  planOpener = null;
}
$('#planClose').addEventListener('click', closePlan);
$('#planCancel').addEventListener('click', closePlan);
$('#planModal').addEventListener('click', function(e){ if(e.target === this) closePlan(); });
/* P1：弹窗 / 抽屉焦点圈闭 + ESC 统一关闭 + 关闭后焦点归还 */
var planOpener = null;
trapFocus($('#planModal'));
trapFocus($('#confirmModal'));
document.addEventListener('keydown', function(e){
  if(e.key !== 'Escape') return;
  if($('#confirmModal').classList.contains('show')){ closeConfirm(false); return; }
  if(drawMode) return;                                  /* 绘制态 ESC 先取消绘制，不关弹窗 */
  if($('#planModal').classList.contains('show')){ closePlan(); }
});
$('#planCalc').addEventListener('click', function(){
  if(!curRegion) return;
  var p = curRegion.params;
  /* E-6：越界不再静默夹断 —— 保留弹窗、聚焦该字段、显示允许范围 */
  var bad = null;
  function num(id, lo, hi, label, allowEmpty){
    var el = $(id);
    var raw = String(el.value === undefined || el.value === null ? '' : el.value).trim();
    if(raw === ''){
      /* 允许留空的「待补充」字段：留空 = 待补充，按 0 参与测算 */
      if(allowEmpty) return null;
      if(!bad) bad = { id: id, msg: label + ' 允许范围 ' + lo + '–' + hi + '，当前输入「空」' };
      return null;
    }
    var v = parseFloat(raw);
    if(isNaN(v) || v < lo || v > hi){
      if(!bad) bad = { id: id, msg: label + ' 允许范围 ' + lo + '–' + hi + '，当前输入「' + raw + '」' };
      return null;
    }
    return v;
  }
  var vN = num('#pN', 2, 32, '终端数');
  var vP = num('#pP', 30, 600, '单桩功率');
  var vCoef = num('#pCoef', 0.5, 1.5, '电量校准系数');
  var vFee = num('#pFee', 0.1, 1, '充电服务费');
  var vDeposit = num('#pDeposit', 0, 40, '场地一次性投入', true);
  var vUnit = num('#pUnit', 5, 40, '单桩设备成本');
  var vCivil = num('#pCivil', 0, 80, '土建工程费');
  var vOther = num('#pOther', 0, 40, '智能化配套');
  var vRent = num('#pRent', 0, 60, '场地年租金');
  var vLabor = num('#pLabor', 0, 20, '人工＆保洁费', true);
  if(bad){ fieldError(bad.id, bad.msg); return; }
  p.n = Math.round(vN);
  p.p = Math.round(vP);
  p.coef = vCoef;
  p.fee = vFee;
  p.deposit = vDeposit;
  p.unit = vUnit;
  p.civil = vCivil;
  p.other = vOther;
  p.rentY = vRent;
  p.labor = vLabor;
  var inv = calcInv(p);
  closePlan();
  invTiles(inv, $('#invGrid'));
  renderInvTables(p, $('#invCapexTab'), $('#invOpexTab'));
  /* 评估摘要卡回收期联动更新（R11：旧 #rdPayback 已随九段重构移除） */
  rdSummary(curRegion, inv);
  renderFinalAdv($('#finAdvR'), curRegion, inv);
  openRegion(curRegion.id);
  renderRegionList();
  if(typeof siteTasks!=='undefined'){
    const task=siteTasks.find(t=>t.id===activeTaskId&&t.kind==='range');
    if(task){task.result=cloneData(activeRegions());persistTasks();renderSiteTasks();}
  }
  toast('已按新方案重新测算：回收期 ' + inv.payback.toFixed(1) + ' 年，年化 ROI ' + inv.roi.toFixed(1) + '%', 'ok');
});

/* ---------- 初始化：默认选中奥体东板块，首屏轻微入场 ---------- */
initBaseMaps();
renderAsPins('');          /* R5：配置页小图 + 放大浮层图注入共用底图 */
renderScopesAll();
renderRegionList();
refreshWbStats();
syncMapRanks();
initMapRgnA11y();      /* P1：地图区域 role=button + roving tabindex */
labelIconButtons();    /* P1：图标/跳转按钮补齐 aria-label */
selectRegion('r2');
renderWbInfo();
markDecorative();      /* P1：装饰性 SVG 统一 aria-hidden */
labelIconButtons();

/* ==================== 高保真图表：本地 ECharts、统一坐标/图例 ==================== */
function chartHolder(kind,payload){return '<div class="live-chart" data-chart="'+kind+'" data-payload="'+encodeURIComponent(JSON.stringify(payload||{}))+'"></div>';}
radarSVG=function(labels,vals){return chartHolder('radar',{labels:labels,vals:vals});};
buildPriceChart=function(){return chartHolder('price');};
buildScaleChart=function(){return chartHolder('scale');};
buildGapChart=function(cap,peak){return chartHolder('gap',{cap:cap,peak:peak});};
buildCustChart=function(){return chartHolder('customer');};
const vehicleCompositionHTML=document.querySelector('#truckFlowR .table-scroll').outerHTML;
truckFlowHTML=function(){return '<div class="truck-flow"><div class="kpi-grid">'+[['新能源货车日均车流量','1,424'],['新能源运营车日均车流量','935'],['新能源私家车日均车流量','1,193'],['汽油车日均车流量','3,451']].map(x=>'<div class="kpi"><span class="k-name">'+x[0]+'</span><span class="k-val">'+x[1]+'<small>辆</small></span></div>').join('')+'</div><div class="blk-title">3km范围车流构成（月日均）</div>'+vehicleCompositionHTML+'<div class="blk-title">24小时车流分布 <span class="tag tag-model">模型估算</span></div>'+chartHolder('flow')+'<p class="mix-note">曲线可通过图例显示或隐藏，悬浮查看时刻数据。</p></div>';};
initTruckFlow=function(){};
$('#truckFlowR').innerHTML=truckFlowHTML();
const liveCharts=new Map();
function initCharts(){
 document.querySelectorAll('.live-chart').forEach(el=>{
  if(liveCharts.has(el)||!el.clientWidth||!el.closest('.view.active'))return;
  const kind=el.dataset.chart,p=JSON.parse(decodeURIComponent(el.dataset.payload)),chart=echarts.init(el,null,{renderer:'svg'});
  const colors=['#315EEF','#05B37F','#FF6624','#7C3AED','#93A1BF'];
  const option={animation:false,color:colors,textStyle:{fontFamily:'PingFang SC',fontSize:12,color:'#667085'},tooltip:{trigger:'axis',backgroundColor:'#fff',borderColor:'#E6EBF2',textStyle:{color:'#344054',fontSize:12},extraCssText:'border-radius:10px;box-shadow:0 5px 20px #11182712;'},grid:{left:45,right:20,top:30,bottom:45}};
  const axis={axisLine:{lineStyle:{color:'#DBE4F2'}},axisTick:{show:false},axisLabel:{color:'#98A2B3',fontSize:11},splitLine:{lineStyle:{color:'#EEF2F7'}}};
  if(kind==='radar'){
   option.tooltip={trigger:'item'};option.radar={indicator:p.labels.map(name=>({name,max:100})),radius:'58%',axisName:{formatter:name=>name.length>5?name.slice(0,4)+'\n'+name.slice(4):name,color:'#667085',fontSize:11},splitNumber:4,splitArea:{areaStyle:{color:['#fff','#f8faff']}},splitLine:{lineStyle:{color:'#E6EBF2'}},axisLine:{lineStyle:{color:'#E6EBF2'}}};
   option.series=[{type:'radar',data:[{name:'维度评分',value:p.vals}],symbol:'circle',symbolSize:5,lineStyle:{width:2},areaStyle:{color:'#315eef',opacity:.12}}];
  }else if(kind==='customer'){
   option.tooltip={trigger:'item',formatter:'{b}<br>{c}%'};option.legend={orient:'vertical',right:15,top:'middle',icon:'circle',itemWidth:8,itemHeight:8,textStyle:{color:'#667085',fontSize:12}};
   option.graphic=[{type:'text',left:'24%',top:'43%',style:{text:'客群结构',fill:'#667085',fontSize:13}}];
   option.series=[{type:'pie',radius:['48%','72%'],center:['35%','50%'],label:{show:false},itemStyle:{borderColor:'#fff',borderWidth:3},data:[{name:'网约车',value:42},{name:'物流车',value:23},{name:'私家车',value:20},{name:'出租车',value:15}]}];
  }else{
   let categories=[],series=[];
   if(kind==='flow'){
    categories=Array.from({length:24},(_,i)=>i+'时');option.legend={bottom:0,icon:'circle',itemWidth:8,itemHeight:8,textStyle:{color:'#667085'}};
    const curves=[[30,22,18,20,25,35,60,95,140,168,172,170,150,158,166,175,170,150,135,120,95,70,50,40],[20,14,12,13,16,22,42,70,100,115,122,118,108,112,118,122,120,110,100,88,68,50,35,28],[35,25,20,22,28,40,70,105,128,132,130,128,125,130,133,137,132,120,108,95,75,55,42,35]];
    series=['新能源货车','新能源运营车','新能源私家车'].map((name,i)=>({name,type:'line',smooth:true,data:curves[i],symbol:'circle',showSymbol:false,lineStyle:{width:3},emphasis:{focus:'series'}}));
    option.yAxis={...axis,name:'辆/小时',type:'value'};
   }else if(kind==='price'){
    categories=['0.25–0.30','0.30–0.35','0.35–0.40','0.40–0.45','0.45–0.50','0.50+'];series=[{name:'站点数量',type:'bar',barMaxWidth:32,data:[2,5,7,4,2,1],itemStyle:{color:'#DBE7FF',borderRadius:[4,4,0,0]},emphasis:{itemStyle:{color:'#315EEF'}}}];option.yAxis={...axis,name:'座',type:'value',minInterval:1};
   }else if(kind==='scale'){
    categories=['≤8个','9–16个','17–24个','25–32个','≥33个'];series=[{name:'站点数量',type:'bar',barMaxWidth:40,data:[6,7,4,3,1],itemStyle:{color:'#DBE7FF',borderRadius:[4,4,0,0]},emphasis:{itemStyle:{color:'#315EEF'}}}];option.yAxis={...axis,name:'座',type:'value',minInterval:1};
   }else if(kind==='gap'){
    categories=Array.from({length:24},(_,i)=>i+'时');
    const demand=[180,140,120,130,180,300,480,680,860,1000,1150,1080,900,820,860,940,1050,1180,1240,1120,900,700,450,260];
    option.legend={bottom:0,icon:'circle',itemWidth:8,itemHeight:8,textStyle:{color:'#667085'}};
    series=[{name:'充电需求',type:'line',smooth:true,data:demand.map(v=>Math.round(v*p.peak/1240)),symbol:'none',lineStyle:{width:3,color:'#315EEF'},areaStyle:{color:'#DBE7FF',opacity:.5}},{name:'预计供给能力',type:'line',data:categories.map(()=>p.cap),symbol:'none',lineStyle:{width:2,type:'dashed',color:'#FF6624'}}];option.yAxis={...axis,name:'kW',type:'value'};
   }
   option.xAxis={...axis,type:'category',data:categories,splitLine:{show:false}};option.series=series;
  }
  chart.setOption(option);liveCharts.set(el,chart);
 });
 for(const [el,chart] of liveCharts)if(!el.isConnected){chart.dispose();liveCharts.delete(el);}
}
let chartFrame=0;
new MutationObserver(()=>{cancelAnimationFrame(chartFrame);chartFrame=requestAnimationFrame(initCharts);}).observe(document.querySelector('.content'),{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
const resizeCharts=new ResizeObserver(()=>{initCharts();liveCharts.forEach((chart,el)=>{if(el.clientWidth)chart.resize();});});resizeCharts.observe(document.querySelector('.content'));
// 区域报告增加同样的章节目录，锚点以当前报告为作用域。
const rdSections=[...document.querySelectorAll('#view-region>.rp-sec')];
const rdNav=document.createElement('nav');rdNav.className='card rp-anchor region-report-nav';rdNav.setAttribute('aria-label','区域报告目录');
rdNav.innerHTML='<ol class="lifecycle-list">'+rdSections.map((sec,i)=>{sec.id='region-section-'+i;return '<li class="lifecycle-step'+(i===0?' lifecycle-step--active':'')+'"><a class="lifecycle-link" href="#'+sec.id+'"><span class="lifecycle-step__number">'+String(i+1).padStart(2,'0')+'</span><span class="lifecycle-step__title">'+sec.querySelector('h3').textContent.replace('与下一步建议','')+'</span></a></li>';}).join('')+'</ol>';
const rdMain=document.createElement('div');rdMain.className='region-report-main';rdSections.forEach(sec=>rdMain.append(sec));
$('#view-region').append(rdMain,rdNav);
// 两类报告复用同一目录逻辑；区域报告末尾08/09同排时同时选中。
function bindReportNavigation(view,main,nav,sections,groupLast=false){
 const update=()=>{
  if(!view.classList.contains('active'))return;
  const desktop=window.matchMedia('(min-width:1101px)').matches,scroller=desktop?main:$('.content');
  const top=scroller.getBoundingClientRect().top+(desktop?20:80);let index=0;
  sections.forEach((sec,i)=>{if(sec.getBoundingClientRect().top<=top)index=i;});
  if(scroller.scrollTop+scroller.clientHeight>=scroller.scrollHeight-4)index=sections.length-1;
  [...nav.querySelectorAll('.lifecycle-step')].forEach((item,i)=>{
   const active=groupLast&&index>=7?i>=7:i===index;
   item.classList.toggle('lifecycle-step--active',active);
   item.querySelector('a').setAttribute('aria-current',active?'location':'false');
  });
 };
 main.addEventListener('scroll',update,{passive:true});$('.content').addEventListener('scroll',update,{passive:true});
 window.addEventListener('resize',update,{passive:true});
 new MutationObserver(()=>{if(view.classList.contains('active')){main.scrollTo({top:0,behavior:'instant'});requestAnimationFrame(update);}}).observe(view,{attributes:true,attributeFilter:['class']});
 nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',e=>{
  e.preventDefault();const target=view.querySelector(a.getAttribute('href'));if(!target)return;
  target.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'start'});
 }));
}
bindReportNavigation($('#view-region'),rdMain,rdNav,rdSections,true);
bindReportNavigation($('#view-assess'),$('#astep2'),$('#rpAnchor'),[...$('#astep2').querySelectorAll(':scope>.rp-sec')]);

/* ==================== 任务：本地示例存储与上下文恢复 ==================== */
const taskStorageKey='ai-butler-site-tasks-v1';
const cloneData=value=>JSON.parse(JSON.stringify(value));
const defaultRegions=cloneData(regions);
const presetRegionMarkup=$('#lyRegions').innerHTML;
let siteTasks=[];
try{siteTasks=JSON.parse(localStorage.getItem(taskStorageKey)||'[]');if(!Array.isArray(siteTasks))siteTasks=[];}catch(_){siteTasks=[];}
if(!siteTasks.length){
 siteTasks=[{id:'sample-range-1',name:'济南市公共快充站选址',kind:'range',status:'done',created:'2026-11-01T09:30:00',config:cloneData(cfg),result:cloneData(defaultRegions),scopes:[],sample:true},{id:'sample-draft-1',name:'重卡站区域选址草稿',kind:'range',status:'draft',created:'2026-10-30T14:20:00',config:{...cloneData(cfg),type:'重卡站(区域选址)',scale:'8-16枪'},result:[],scopes:[],sample:true}];
}
siteTasks.forEach(t=>{if(t.status==='run')t.status='failed';});
let activeTaskId=null,restoringTask=false;
function persistTasks(){try{localStorage.setItem(taskStorageKey,JSON.stringify(siteTasks));}catch(_){toast('本地存储不可用，当前会话仍可继续','warn');}}
function renderSiteTasks(){
 siteTasks.sort((a,b)=>new Date(b.created)-new Date(a.created));
 $('#taskListBody').innerHTML=siteTasks.map(t=>{let c=t.config||{},status={draft:['草稿','sp-draft'],run:['分析中','sp-run'],done:['已完成','sp-done'],failed:['分析失败','b-red']}[t.status];return '<tr><td><strong>'+esc(t.name)+'</strong>'+'</td><td>'+ (t.kind==='site'?'场地评估':esc(goalNames[c.goal]||'经营收益'))+'</td><td>'+esc(t.kind==='site'?t.station.dist:((c.city||'')+' · '+(t.scopes?.length?'地图圈选':((c.districts||[]).join('、')||'全部区县'))))+'</td><td>'+esc(t.kind==='site'?t.station.siteType:(c.type+' · '+c.scale))+'</td><td class="r">'+(t.kind==='site'?'—':((t.result||[]).length||'—'))+'</td><td><span class="status-pill '+status[1]+'"><i></i>'+status[0]+'</span></td><td>'+t.created.slice(0,10)+'</td><td class="r"><button class="act" data-site-task="'+t.id+'">'+(t.status==='draft'?'继续编辑':'打开')+'</button></td></tr>';}).join('');
}
function rangeTaskName(){return (customRegions.length?'圈选范围':cfg.city)+(cfg.type.includes('重卡')?'重卡站选址':'公共快充站选址');}
function startRangeTask(){
 let task=siteTasks.find(t=>t.id===activeTaskId&&t.kind==='range');
 const data={name:rangeTaskName(),kind:'range',status:'run',config:cloneData(cfg),scopes:cloneData(customRegions),updated:new Date().toISOString()};
 if(task)Object.assign(task,data);else{task={id:'range-'+Date.now(),created:new Date().toISOString(),result:[],...data};siteTasks.unshift(task);activeTaskId=task.id;}
 persistTasks();renderSiteTasks();
}
function finishRangeTask(){const t=siteTasks.find(t=>t.id===activeTaskId);if(!t)return;t.result=cloneData(activeRegions());t.scopes=cloneData(customRegions);t.status='done';lastRangeResults=cloneData(t.result);lastRangeConfig=cloneData(t.config);rangeResultsDirty=false;persistTasks();renderSiteTasks();refreshRangeUX();}
function restoreRangeTask(t){
 rangeResultFromTasks=!!t.id&&t.status==='done';
 rangeResultsDirty=false;lastRangeResults=t.status==='done'?cloneData(t.result):null;lastRangeConfig=t.status==='done'?cloneData(t.config):null;rangeMode=t.scopes?.length?'draw':'district';activeTaskId=t.id||null;
 cfg=cloneData(t.config);customRegions=cloneData(t.scopes||[]);regions=cloneData(t.status==='done'?t.result:defaultRegions);customFlowActive=customRegions.length>0;expResultsShown=t.status==='done';curRegion=regions[0]||null;
 renderGeoSel();renderScaleSeg();initBaseMaps();renderScopesAll();renderAsPins();
 restoreMapShapes();

 $('#cfgPayback').value=cfg.payback;$('#cfgBudget').value=cfg.budget;
 $('#expResultCard').style.display=expResultsShown?'':'none';$('#expGrid').classList.toggle('has-result',expResultsShown);$('#cfgCard').classList.toggle('foldable',expResultsShown);setCfgFold(expResultsShown);
 $('#btnStartTxt').textContent=expResultsShown?'更新分析':'查找推荐区域';
 $$('#mapLegend .lyr').forEach(b=>{if(['lyRegions','lyHeat','lyPrice'].includes(b.dataset.layer))b.style.display=expResultsShown?'':'none';});
 renderRegionList();syncMapRanks();setHomeTab('explore');
 const rb=$('#lyrRegions');if(rb)setLayer(rb,expResultsShown);
 if(curRegion)selectRegion(curRegion.id);refreshRangeUX();
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-site-task]');if(!b)return;const t=siteTasks.find(x=>x.id===b.dataset.siteTask);if(!t)return;if(t.status==='run'){toast('任务正在分析，完成后即可查看结果','info');return;}activeTaskId=t.id;if(t.kind==='site'){if(!stations.some(x=>x.id===t.station.id))stations.push(cloneData(t.station));showAssessResult(t.station,true);}else restoreRangeTask(t);});
const originalBuildReport=buildReport;
buildReport=function(sid){originalBuildReport(sid);if(restoringTask)return;const st=stations.find(s=>s.id===sid);if(!st)return;const exists=siteTasks.find(t=>t.kind==='site'&&t.station.id===sid);if(!exists)siteTasks.unshift({id:'site-'+Date.now(),name:st.name+'可行性评估',kind:'site',status:'done',created:new Date().toISOString(),station:cloneData(st)});persistTasks();renderSiteTasks();};
renderSiteTasks();
// 新建只清理当前工作台，已存任务保持可恢复。
document.querySelector('#view-tasks [data-go="config"]').addEventListener('click',()=>restoreRangeTask({status:'draft',config:{goal:'rev',province:'山东省',city:'济南市',districts:[],type:'公共快充站',budget:'100-200万',payback:'4-5 年',scale:'4-8桩'},scopes:[]}));

/* ==================== 可下载报告：自包含 HTML，支持浏览器打印为 PDF ==================== */
async function reportMarkup(view){
 initCharts();const copy=view.cloneNode(true);
 const copyCharts=[...copy.querySelectorAll('.live-chart')];
 view.querySelectorAll('.live-chart').forEach((el,i)=>{const chart=liveCharts.get(el),target=copyCharts[i];if(chart&&target){const img=document.createElement('img');img.src=chart.getDataURL({type:'svg'});img.style.cssText='width:100%;height:260px;object-fit:contain';target.replaceWith(img);}});
 copy.querySelectorAll('[data-final-value]').forEach(el=>{const unit=el.querySelector('small');el.textContent=Number(el.dataset.finalValue).toLocaleString('en-US',{maximumFractionDigits:1});if(unit)el.append(unit);});
 copy.querySelectorAll('button,.rp-anchor,#rdHeadCard,#assessHeadCard,.region-report-header').forEach(el=>el.remove());
 for(const img of copy.querySelectorAll('img'))if(!img.src.startsWith('data:')){try{const blob=await(await fetch(img.src)).blob();img.src=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);});}catch(_){img.remove();}}
 return copy.innerHTML;
}
async function downloadReport(mode){
 try{
 const css=await(await fetch('./style.css')).text();let content='',title='智能选址评估报告';
 if(mode==='all'){
  const list=rankedRegions(),previous=curRegion&&curRegion.id;
  if(!list.length){toast('暂无可导出的候选区域','warn');return;}
  for(const r of list){openRegion(r.id);initCharts();content+='<article class="export-page"><h1>'+esc(r.name)+'</h1>'+await reportMarkup($('#view-region'))+'</article>';}
  if(previous)openRegion(previous);setHomeTab('explore');title='区域推荐报告合集';
 }else{const view=mode==='site'?$('#view-assess'):$('#view-region');content=await reportMarkup(view);title=mode==='site'?$('#assessEntity').textContent+'评估报告':curRegion.name+'推荐报告';}
 if(mode!=='all')content='<h1 class="export-report-title">'+esc(title)+'</h1>'+content;
 const font=await(await fetch('./assets/fonts/Oswald-SemiBold.woff2')).blob();const fontData=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(font);});
 const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>'+esc(title)+'</title><style>'+css+'@font-face{font-family:Oswald;src:url('+fontData+')}html,body{min-width:0;height:auto;min-height:100%;overflow:visible;background:#f0f2f5}html{overflow-y:auto}body{display:block;padding:24px;max-width:1400px;margin:auto;font-weight:400}.region-report-main{display:block;height:auto;max-height:none;overflow:visible}.export-page{break-after:page}button{display:none}.rp-radar{min-height:260px}@media print{body{padding:0}.card{break-inside:avoid}.rp-anchor{display:none}}</style><body><p style="margin-bottom:16px;color:#667085">AI管家 · 智能选址 · 评估报告（可通过浏览器打印为PDF）</p>'+content+'</body></html>';
 const a=document.createElement('a'),url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));a.href=url;a.download=title.replace(/[\\/:*?"<>|]/g,'')+'.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);toast('报告已导出为 HTML，可打开后打印为 PDF','ok');
 }catch(error){toast('导出失败，请重试','warn');console.error(error);}
}
// 捕获阶段接管原型中的提示型导出，替换为实际文件下载。
['btnExport','btnRdExport','btnExportAll'].forEach(id=>document.getElementById(id).addEventListener('click',e=>{e.stopImmediatePropagation();downloadReport(id==='btnExport'?'site':id==='btnExportAll'?'all':'region');},true));
function invalidateRangeResults(){
 if(expResultsShown){rangeResultsDirty=true;}
 refreshRangeUX();scheduleStreetMap();
}
// 初始推荐图层与开关一致，避免隐藏图层仍被读屏识别。
new MutationObserver(()=>{const g=$('#lyRegions');if(g)g.setAttribute('aria-hidden',String(g.classList.contains('g-off')));}).observe($('#lyRegions'),{attributes:true,attributeFilter:['class']});
function restoreMapShapes(){
 const layer=$('#lyRegions');layer.innerHTML=presetRegionMarkup;
 if(!customFlowActive){setPresetRegionsVisible(true);return;}
 setPresetRegionsVisible(false);
 customRegions.forEach(scope=>{
  const items=regions.filter(r=>r.scopeId===scope.id),geo=scope.geo,n=items.length;
  items.forEach((r,i)=>{
   const spread=geo.r*.55,angle=Math.PI*2/n*i+scope.seq*.7;
   const x=Math.max(30,Math.min(910,geo.cx+Math.cos(angle)*spread-52)),y=Math.max(50,Math.min(600,geo.cy+Math.sin(angle)*spread-40));
   const g=document.createElementNS(SVGNS,'g');g.setAttribute('class','rgn sub');g.dataset.rid=r.id;g.setAttribute('transform','translate('+x+','+y+')');g.setAttribute('role','button');g.setAttribute('tabindex','-1');
   g.innerHTML='<rect class="box" width="106" height="82" rx="10"/><rect class="lbl-rank" x="-21" y="-24" width="20" height="19" rx="4" fill="#315eef"/><text class="lbl-rank-t" x="-11" y="-10" text-anchor="middle" font-size="11" fill="white">'+(i+1)+'</text><rect x="0" y="-24" width="125" height="19" rx="4" fill="white" stroke="#dbe7ff"/><text class="lbl-t" x="8" y="-10" font-size="11" fill="#315eef">推荐'+String.fromCharCode(65+i)+' '+esc(r.grade)+'·'+r.score+'</text>';
   layer.append(g);
  });
 });
}

// 侧栏折叠后仍保留每项的可访问名称。
document.querySelectorAll('.sidebar .nav-item').forEach(item=>{item.title=item.textContent.trim();item.setAttribute('aria-label',item.title);});


/* ==================== 街道地图视觉演示：本地图片 + 可操作矢量图层 ==================== */
// 按用户要求使用本地虚拟街道底图，无高德 SDK、无 Key；不代表真实地理定位。
const streetViews=new Map();let streetFrame=0;
const streetNames=[['科创大道',490,390,0],['滨河路',370,165,-8],['明湖路',180,435,-2],['奥体东路',710,455,-88],['舜华路',825,335,-82],['经十东路',780,555,-3],['科技园',720,270,0],['滨河公园',270,195,0],['会展中心',665,360,0],['城市广场',430,475,0],['产业园',830,490,0],['学府路',270,590,0]];
const candidatePositions={r1:[785,270],r2:[650,340],r3:[510,310],r6:[450,485],r4:[805,490]};
function scheduleStreetMap(){cancelAnimationFrame(streetFrame);streetFrame=requestAnimationFrame(renderStreetMaps);}
function streetPoint(e,svg){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const matrix=svg.getScreenCTM();return matrix?p.matrixTransform(matrix.inverse()):null;}
function streetRegionMarkup(r,i,screenScale=1){
 const invScale=1/screenScale;
 let x,y;const hidden=document.querySelector('#cityMap .rgn[data-rid="'+r.id+'"]');const transform=hidden?.getAttribute('transform');
 if(transform){const nums=transform.match(/-?\d+(?:\.\d+)?/g);x=+nums[0];y=+nums[1];}else [x,y]=candidatePositions[r.id]||[400+i*65,350+i*30];
 const title=r.name.replace(/.*·/,'').replace('板块','')+' · '+r.score;
 const ctx=streetRegionMarkup.measure||(streetRegionMarkup.measure=document.createElement('canvas').getContext('2d'));
 ctx.font='12px "PingFang SC",sans-serif';
 const labelWidth=Math.ceil(ctx.measureText(title).width)+16;
 return '<g class="rgn '+(curRegion?.id===r.id?'sel':'')+'" data-street-region="'+r.id+'" transform="translate('+x+','+y+')" role="button" tabindex="0" aria-label="选择'+esc(r.name)+'">'
  +'<rect class="box" width="106" height="78" rx="10"/>'
  +'<g class="region-map-label" transform="scale('+invScale+')"><rect y="-24" width="20" height="20" rx="4" fill="#315eef"/><text x="10" y="-10" text-anchor="middle" font-size="12" fill="white">'+(i+1)+'</text>'
  +'<rect x="24" y="-24" width="'+labelWidth+'" height="20" rx="4" fill="white" stroke="#dbe7ff"/><text x="32" y="-10" font-size="12" fill="#315eef">'+esc(title)+'</text></g>'
  +'<g class="region-map-check" transform="translate('+(106-10)+','+10+') scale('+invScale+')" aria-hidden="true"><circle r="8" fill="#315eef"/><path d="M-3.5 0 -1 2.5 3.5 -2.5" fill="none" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g></g>';

}
function renderStreetMaps(){
 for(const [id,isAssess] of [['site-geo-map',false],['assess-geo-map',true]]){
  const el=document.getElementById(id);if(!el?.clientWidth||!el.closest('.ptab-panel.on'))continue;
  let state=streetViews.get(id);
  if(!state){
   el.innerHTML='<svg class="street-map-canvas" viewBox="0 0 1040 720" preserveAspectRatio="xMidYMid slice" aria-label="地图展示"><image href="./assets/maps/krakow-light.webp" width="1040" height="720" preserveAspectRatio="xMidYMid slice"/><g class="street-layers"></g><circle class="street-draw-preview" r="0"/><g class="street-radius-preview" pointer-events="none"></g></svg>';
   state={svg:el.querySelector('svg'),isAssess,box:{x:0,y:0,w:1040,h:720},drag:null};streetViews.set(id,state);bindStreetView(state);

  }
  const svg=state.svg;svg.style.cursor=(isAssess?!assessResult:drawMode)?'crosshair':'default';
  let markup='';
  if(isAssess){
   const markerScale=1/(svg.getScreenCTM()?.a||1);
   markup=stations.filter(st=>!st.isNew).map((st,i)=>{const p=pinPos(st,i);return '<g class="street-site" data-street-site="'+st.id+'" transform="translate('+p.x+','+p.y+')"><circle r="13" fill="transparent"/><circle r="5" fill="#ff6624" stroke="white" stroke-width="2"/><g transform="scale('+markerScale+')"><text y="-12" style="font-size:13px;stroke-width:3px" text-anchor="middle">'+esc(st.name)+'</text></g></g>';}).join('');
   if(asLoc)markup+='<g transform="translate('+asLoc.x+','+asLoc.y+')"><circle r="11" fill="#315eef22"/><circle r="5" fill="#315eef" stroke="white" stroke-width="2"/><g transform="scale('+markerScale+')"><text y="-16" style="font-size:13px;stroke-width:3px" class="street-label" text-anchor="middle">'+esc(asLoc.name)+'</text></g></g>';
  }else{
   const platform=document.querySelector('[data-layer="lyPlatform"]')?.classList.contains('on'),rival=document.querySelector('[data-layer="lyRival"]')?.classList.contains('on');
   if(platform)markup+=[[700,384],[842,356],[574,352],[478,528],[852,536],[200,404],[492,322],[918,182],[372,182],[688,428],[806,322],[252,470]].map(([x,y])=>'<circle cx="'+x+'" cy="'+y+'" r="5" fill="#315eef" stroke="white" stroke-width="2"/>').join('');
   if(rival)markup+=[[716,352],[778,384],[642,386],[598,330],[522,540],[556,500],[872,556],[812,560],[182,396],[222,440],[262,312],[340,540]].map(([x,y])=>'<circle cx="'+x+'" cy="'+y+'" r="4" fill="#98a2b3" stroke="white" stroke-width="1.5"/>').join('');
   if(expResultsShown&&$('#cfgCard').classList.contains('collapsed')&&$('#lyrRegions').classList.contains('on'))markup+=rankedRegions().map((r,i)=>streetRegionMarkup(r,i,svg.getScreenCTM()?.a||1)).join('');
   const heat=document.querySelector('[data-layer="lyHeat"]')?.classList.contains('on'),price=document.querySelector('[data-layer="lyPrice"]')?.classList.contains('on');
   if(heat||price)markup+='<defs><radialGradient id="street-heat-'+id+'"><stop stop-color="'+(heat?'#ff6624':'#315eef')+'" stop-opacity=".42"/><stop offset="1" stop-color="'+(heat?'#ff6624':'#315eef')+'" stop-opacity="0"/></radialGradient></defs>'+[[720,380,95],[850,450,75],[490,510,80]].map(([x,y,r])=>'<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="url(#street-heat-'+id+')"/>').join('');
   markup+=customRegions.map(scope=>'<circle cx="'+scope.geo.cx+'" cy="'+scope.geo.cy+'" r="'+scope.geo.r+'" fill="#315eef09" stroke="#315eef" stroke-width="2" stroke-dasharray="7 5"/>'+streetRadiusMarkup(scope.geo.cx,scope.geo.cy,scope.geo.r)).join('');
  }
  svg.querySelector('.street-layers').innerHTML=markup;
 }
}
function streetRadiusMarkup(cx,cy,r){
 const km=(r/KM).toFixed(1),x=Math.max(56,Math.min(984,cx+r/2)),y=Math.max(24,cy-18);
 return '<g class="street-radius" pointer-events="none"><line x1="'+cx+'" y1="'+cy+'" x2="'+(cx+r)+'" y2="'+cy+'" stroke="#315eef" stroke-width="1.5" stroke-dasharray="4 3"/><circle cx="'+cx+'" cy="'+cy+'" r="4" fill="#315eef" stroke="white" stroke-width="2"/><rect x="'+(x-42)+'" y="'+(y-11)+'" width="84" height="22" rx="5" fill="white" stroke="#dbe4ff"/><text x="'+x+'" y="'+(y+3)+'" text-anchor="middle" fill="#315eef" font-size="10" font-family="PingFang SC,sans-serif">半径 '+km+' km</text></g>';
}
function setStreetViewBox(state){const b=state.box;state.svg.setAttribute('viewBox',[b.x,b.y,b.w,b.h].join(' '));}
function bindStreetView(state){
 const svg=state.svg;
 svg.addEventListener('pointerdown',e=>{if(e.button!==0||state.isAssess||!drawMode)return;const p=streetPoint(e,svg);if(!p)return;state.drag={p,client:[e.clientX,e.clientY],box:{...state.box},scale:1/svg.getScreenCTM().a,drawing:!state.isAssess&&!!drawMode};svg.setPointerCapture(e.pointerId);});
 svg.addEventListener('pointermove',e=>{const d=state.drag;if(!d)return;const p=streetPoint(e,svg);if(d.drawing){const circle=svg.querySelector('.street-draw-preview');circle.setAttribute('cx',d.p.x);circle.setAttribute('cy',d.p.y);const r=Math.hypot(p.x-d.p.x,p.y-d.p.y);circle.setAttribute('r',r);svg.querySelector('.street-radius-preview').innerHTML=streetRadiusMarkup(d.p.x,d.p.y,r);}});
 svg.addEventListener('pointerup',e=>{const d=state.drag;if(!d)return;state.drag=null;svg.querySelector('.street-draw-preview').setAttribute('r',0);svg.querySelector('.street-radius-preview').replaceChildren();const p=streetPoint(e,svg);if(d.drawing){const r=Math.hypot(p.x-d.p.x,p.y-d.p.y);if(r<15){toast('请拖动绘制更大的范围','warn');return;}addCustomRegion({shape:'circle',cx:d.p.x,cy:d.p.y,r,area:Math.PI*(r/KM)**2,lx:d.p.x,ly:d.p.y});exitCfgDraw();scheduleStreetMap();}else if(state.isAssess&&asPicking&&Math.hypot(e.clientX-d.client[0],e.clientY-d.client[1])<6){pickAsLoc(p.x,p.y);scheduleStreetMap();}});
 svg.addEventListener('pointercancel',()=>{state.drag=null;svg.querySelector('.street-draw-preview').setAttribute('r',0);svg.querySelector('.street-radius-preview').replaceChildren();});
 svg.addEventListener('click',e=>{if(state.isAssess){if(assessResult)return;const site=e.target.closest('[data-street-site]');if(site)selectAssessSite(site.dataset.streetSite);else{const p=streetPoint(e,svg);if(p)pickAsLoc(p.x,p.y);}$('#asSugg').classList.remove('show');scheduleStreetMap();return;}const region=e.target.closest('[data-street-region]'),site=e.target.closest('[data-street-site]');if(drawMode)return;if(region)selectRegion(region.dataset.streetRegion,true);if(site&&!asPicking&&!assessResult)selectAssessSite(site.dataset.streetSite);scheduleStreetMap();});
 svg.addEventListener('keydown',e=>{const r=e.target.closest('[data-street-region]');if(r&&(e.key==='Enter'||e.key===' ')){e.preventDefault();selectRegion(r.dataset.streetRegion,true);}});
}
const streetSetAsLoc=setAsLoc;setAsLoc=function(p){streetSetAsLoc(p);scheduleStreetMap();};
const streetSetPicking=setPicking;setPicking=function(on){streetSetPicking(on);scheduleStreetMap();};
const streetSelectRegion=selectRegion;selectRegion=function(id,fromMap){streetSelectRegion(id,fromMap);scheduleStreetMap();};
['#panel-explore','#panel-assess','#view-home','#geoTriggerTxt','#rgnList','#lyRegions'].forEach(selector=>new MutationObserver(scheduleStreetMap).observe(document.querySelector(selector),{childList:true,characterData:true,subtree:selector==='#geoTriggerTxt',attributes:true,attributeFilter:['class']}));
$('#mapLegend').addEventListener('click',scheduleStreetMap);$('#chipCustom').addEventListener('click',scheduleStreetMap);$('#cfgDrawExit').addEventListener('click',scheduleStreetMap);$('#asLocClear').addEventListener('click',scheduleStreetMap);
new ResizeObserver(scheduleStreetMap).observe($('.content'));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){streetViews.forEach(s=>{s.drag=null;s.svg.querySelector('.street-draw-preview').setAttribute('r',0);s.svg.querySelector('.street-radius-preview').replaceChildren();});scheduleStreetMap();}});
scheduleStreetMap();

/* 范围方式与分析前后状态：修改条件不撤下上次结果，统一由按钮更新。 */
function refreshRangeUX(){
 const card=$('#cfgCard');if(!card)return;
 if(cfg.type.includes('路线'))cfg.type='重卡站(区域选址)';
 const collapsed=card.classList.contains('collapsed'),truck=cfg.type.includes('重卡');
 $('#cfgType input[value="public"]').checked=!truck;$('#cfgType input[value="truck"]').checked=truck;
 $('#truckOptions').hidden=!truck;
 $$('#truckMethod input').forEach(i=>i.checked=i.value===cfg.type);
 if(!truck)$('#truckMethod input').checked=true;
 $$('#cfgGoal input').forEach(i=>i.checked=i.value===cfg.goal);
 $('#chipCustom').hidden=false;$('#chipCustom').disabled=!!_starting;
 $('#resetRangeScope').hidden=!customRegions.length;
 $('#mapScopeStatus').textContent=drawMode?'正在圈定范围':customRegions.length?'已圈定范围':'按行政区查找';
 $('#analysisSummary').hidden=!collapsed;
 card.querySelector('.demand-heading h3').textContent=collapsed?'选址条件':'建站需求';
 const c=collapsed?(lastRangeConfig||cfg):cfg;
 $('#analysisSummary').textContent=c.type+' · '+goalNames[c.goal]+' · '+c.budget+' · '+c.scale+' · '+(c.payback==='不限'?'回收周期不限':c.payback+'回收');
 if(!_starting){$('#btnStartTxt').textContent=expResultsShown?'更新分析':'查找推荐区域';$('#btnStart').disabled=false;}
 $('#btnStart').hidden=collapsed&&!rangeResultsDirty;
 card.classList.toggle('has-analysis',!!expResultsShown);
 $('#panel-explore').classList.toggle('demand-collapsed',collapsed);
 $('#panel-explore').classList.toggle('has-results',!!expResultsShown);
 $('#panel-explore').classList.toggle('is-drawing',!!drawMode);
 const resultView=collapsed&&expResultsShown;
 $('#panel-explore').classList.toggle('result-view',resultView);
 $('#expResultCard').style.display=resultView?'':'none';
 $('#rangeMethod .map-scope-actions').inert=!!_starting;
 $('#rangeMethod').inert=!!_starting;
 $('#mapScopeTitle').textContent=resultView?(customRegions.length?'自定义范围 · 半径 '+customRegions[0].km+' km':geoTxt()):'选址范围';
 $('#rangeMethod .result-conditions').hidden=!resultView;
 $('#resultEditConditions').hidden=!resultView;
 $('#resultTaskBack').hidden=!(resultView&&rangeResultFromTasks);
 $('#resultDemandSummary').replaceChildren(...[c.type,goalNames[c.goal],'预算 '+c.budget,'规模 '+c.scale,c.payback==='不限'?'回收周期不限':c.payback+'回收'].map(text=>{const tag=document.createElement('span');tag.textContent=text;return tag;}));

 $('#expGrid').hidden=false;
 $('#mapScopeStatus').textContent=drawMode?'正在圈定范围':customRegions.length?'已圈选 · 半径 '+customRegions[0].km+'km':'按行政区查找';
 $('#expResultCard h3').textContent=rangeResultsDirty?'上次推荐区域':'推荐区域';
}
$('#resultTaskBack').addEventListener('click',()=>setHomeTab('tasks'));
$('#resultEditConditions').addEventListener('click',()=>setCfgFold(false));
$('#resetRangeScope').addEventListener('click',()=>{if(_starting)return;rangeMode='district';customRegions=[];exitCfgDraw();renderScopesAll();renderGeoSel();invalidateRangeResults();refreshRangeUX();});
$('#cfgForm').addEventListener('change',()=>{invalidateRangeResults();});
refreshRangeUX();


/* 评估已有场地：位置与需求分屏，配置和结果互斥，修改时保留输入。 */
var assessResult=null;
(function setupAssessWorkspace(){
 const panel=$('#panel-assess'),config=$('#assessCfgCard'),map=panel.querySelector('.selection-map');
 const mapPane=document.createElement('div');mapPane.className='assess-map-pane';
 const head=document.createElement('div');head.className='assess-map-head';
 head.innerHTML='<div class="assess-scope-title"><button class="result-task-back" id="assessTaskBack" hidden type="button">‹ 返回</button><h3 id="assessScopeTitle">场地位置</h3><button class="btn sm" id="assessEdit" hidden type="button">修改条件</button></div><div id="assessConditionTags" class="assess-condition-tags" hidden></div>';
 const location=$('#asLocBar').closest('.field');location.classList.add('assess-location-field');location.querySelector('label').remove();head.append(location);

 mapPane.append(map,head);panel.prepend(mapPane);
 config.querySelector('h3').textContent='评估需求';
 config.querySelectorAll('.field').forEach(f=>f.classList.remove('third'));
 const result=document.createElement('div');result.id='assessResultPanel';result.hidden=true;panel.append(result);
 $('#assessEdit').addEventListener('click',()=>{assessResult=null;panel.classList.remove('assess-result-view');panel.style.removeProperty('--assess-map-height');config.hidden=false;result.hidden=true;head.querySelector('.assess-location-field').hidden=false;$('#assessScopeTitle').textContent='场地位置';$('#assessConditionTags').hidden=true;$('#assessEdit').hidden=true;$('#assessTaskBack').hidden=true;scheduleStreetMap();});
 $('#assessTaskBack').addEventListener('click',()=>setHomeTab('tasks'));
 result.addEventListener('click',async e=>{if(e.target.closest('[data-assess-report]')&&assessResult)buildReport(assessResult.id);if(e.target.closest('[data-assess-export]')){buildReport(assessResult.id);await downloadReport('site');setHomeTab('assess');}});
})();
function selectAssessSite(id){const st=stations.find(s=>s.id===id);if(st)setAsLoc({name:st.name,dist:st.dist,x:st.x||pinPos(st,stations.indexOf(st)).x,y:st.y||pinPos(st,stations.indexOf(st)).y});scheduleStreetMap();}
function saveAssessTask(st){const exists=siteTasks.find(t=>t.kind==='site'&&t.station.id===st.id);if(!exists)siteTasks.unshift({id:'site-'+Date.now(),name:st.name+'可行性评估',kind:'site',status:'done',created:new Date().toISOString(),station:cloneData(st)});persistTasks();renderSiteTasks();}
function showAssessResult(st,fromTasks=false){
 assessResult=st;setPicking(false);
 setAsLoc({name:st.name,dist:st.dist,x:st.x||pinPos(st,0).x,y:st.y||pinPos(st,0).y});
 $('#asArea').value=st.area||'';$('#asAreaTip').textContent=st.area?'≈ '+Math.max(1,Math.round(st.area/30))+' 桩（按 30㎡/桩估算）':'';$('#asRent').value=st.rent??'';$('#asBudget').value=st.budget||'100-200万';
 ['asType','asGoal'].forEach(id=>$('#'+id).querySelectorAll('input').forEach(b=>b.checked=b.value===(id==='asType'?(st.siteType||'公共快充站'):(st.goal||'rev'))));
 const panel=$('#panel-assess');if(!panel.classList.contains('assess-result-view')&&panel.querySelector('.assess-map-pane').clientHeight)panel.style.setProperty('--assess-map-height',panel.querySelector('.assess-map-pane').clientHeight+'px');panel.classList.add('assess-result-view');$('#assessCfgCard').hidden=true;panel.querySelector('.assess-location-field').hidden=true;
 $('#assessScopeTitle').textContent=st.name;$('#assessEdit').hidden=false;$('#assessTaskBack').hidden=!fromTasks;
 const tags=[st.dist,st.siteType||'公共快充站',goalNames[st.goal]||'经营收益',st.area?st.area+' ㎡':null,st.rent!=null?'年租金 '+st.rent+' 万元':null,st.budget?'预算 '+st.budget:null].filter(Boolean);
 $('#assessConditionTags').innerHTML=tags.map(t=>'<span>'+esc(t)+'</span>').join('');$('#assessConditionTags').hidden=false;
 const score=Number(st.score),piles=Number(st.piles)||8,inv=calcInv(assessInvestmentParams(st)),investment=Math.round(inv.capex),payback=Number.isFinite(inv.payback)?inv.payback.toFixed(1):'—';
 const grade=st.grade||'B',verdict=score>=85?'优先考虑':score>=75?'具备建站潜力':score>=60?'建议谨慎评估':'建议暂缓建站';
 const result=$('#assessResultPanel');result.hidden=false;
 result.innerHTML='<div class="card-head"><h3>场地评估结果</h3><span class="status-pill sp-done">已完成</span></div><div class="assess-score-card"><div class="assess-score-value"><span>综合评分</span><strong class="num">'+score+'</strong></div><div class="assess-score-verdict"><span class="rk rk-'+grade+'">'+grade+'级</span><b>'+verdict+'</b></div></div><h4 class="assess-result-section-title">建设测算</h4><div class="assess-result-metrics"><div><span>建议建设规模</span><b>'+piles+' <small>桩</small></b></div><div><span>预计总投资</span><b>'+investment+' <small>万元</small></b></div><div><span>预计回收期</span><b>'+payback+' <small>年</small></b></div><div><span>建议服务费</span><b>0.36–0.42 <small>元/kWh</small></b></div></div><div class="assess-result-guidance"><div class="assess-result-conclusion"><h4>评估结论</h4><p>'+esc(st.main||'场地具备开发潜力，建议进一步核实电力接入、产权租期与车位条件。')+'</p></div><div class="assess-result-next"><h4>下一步建议</h4><p>结合完整报告，核实场地硬条件与投资测算，再推进现场勘察。</p></div></div><div class="assess-result-actions"><button class="btn btn-primary" data-assess-report type="button">查看完整报告</button><button class="btn" data-assess-export type="button">导出报告</button></div>';
 setHomeTab('assess');scheduleStreetMap();
}

function assessInvestmentParams(st){const piles=Math.max(1,parseInt(st.piles,10)||1),score=Math.max(0,Math.min(100,parseFloat(st.score)||0)),k=st.id==='s1'?1:Math.max(.55,Math.min(1.25,score/72));return {n:piles,p:st.unitPower||120,unit:12,civil:16+piles,other:6,deposit:null,rentY:st.rent!=null&&Number.isFinite(Number(st.rent))&&Number(st.rent)>=0?Number(st.rent):Math.round(14*k*10)/10,labor:null,fee:.38,util:.21,coef:1};}

// 场地报告左栏：复用候选卡片的名称、评级与四项指标，单个场地不提供伪切换。
function renderAssessReportContext(st){
 const inv=calcInv(assessInvestmentParams(st)),piles=Number(st.piles)||8,grade=st.grade||'B';
 const fields=[['建议服务费','0.36–0.42','元/kWh'],['建议规模',piles,'桩'],['预计投资',Math.round(inv.capex),'万元'],['回收周期',Number.isFinite(inv.payback)?inv.payback.toFixed(1):'—','年']];
 const tags=[st.dist,st.siteType||'公共快充站',goalNames[st.goal]||'经营收益',st.budget?'预算 '+st.budget:null].filter(Boolean);
 $('#assessReportContext').innerHTML='<article class="rgn-item sel"><div class="r1"><span class="name">'+esc(st.name)+'</span><span class="sc" style="color:var(--rate-'+grade.toLowerCase()+')">'+Number(st.score)+'</span><span class="rk sm rk-'+grade+'">'+esc(grade)+'</span></div><div class="rgn-metrics">'+fields.map(([label,value,unit])=>'<span><span class="metric-label">'+label+'</span><span class="metric-value">'+value+'<small> '+unit+'</small></span></span>').join('')+'</div></article><div class="report-context-tags">'+tags.map(t=>'<span>'+esc(t)+'</span>').join('')+'</div>';
}
