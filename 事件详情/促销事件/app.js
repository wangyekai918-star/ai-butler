/* 促销事件：分析数据独立于促销决策与复盘，后两阶段沿用基础模板。 */
(() => {
 'use strict';
 const data=JSON.parse(document.getElementById('promotion-analysis-data').textContent);
 document.querySelector('[data-promotion="window"]').textContent=data.repurchaseDays.join('~');
 document.querySelector('[data-promotion="expectedUsers"]').textContent=data.expectedConvertedUsers;
 document.querySelector('[data-promotion="reviewChange"]').textContent=(data.reviewChangePercent>0?'+':'')+data.reviewChangePercent;
 const audience=document.getElementById('promotionAudience');
 const colors=['#315eef','#05b37f','#93a1bf'];
 const chart=document.createElement('div');chart.className='promotion-audience-pie';chart.setAttribute('role','img');chart.setAttribute('aria-label','本站用户构成：'+data.audience.map(i=>i.name+' '+i.share+'%').join('，'));
 const legend=document.createElement('div');legend.className='promotion-audience-legend';
 data.audience.forEach((item,index)=>{
  const row=document.createElement('div');row.className='promotion-audience-legend-row';
  const color=colors[index%colors.length];
  const dot=document.createElement('i');dot.style.backgroundColor=color;dot.setAttribute('aria-hidden','true');
  const name=document.createElement('span');name.textContent=item.name;
  const meter=document.createElement('span');meter.className='promotion-audience-meter';
  const bar=document.createElement('i');bar.className='promotion-audience-bar';bar.style.width=item.share+'%';bar.style.backgroundColor=color;
  const value=document.createElement('b');value.textContent=item.share+'%';value.style.color=color;meter.append(bar,value);row.append(dot,name,meter);legend.append(row);
  row.addEventListener('mouseenter',()=>{pie.dispatchAction({type:'highlight',seriesIndex:0,dataIndex:index});pie.dispatchAction({type:'showTip',seriesIndex:0,dataIndex:index});});
  row.addEventListener('mouseleave',()=>{pie.dispatchAction({type:'downplay',seriesIndex:0});pie.dispatchAction({type:'hideTip'});});
 });
 audience.replaceChildren(chart,legend);
 const pie=echarts.init(chart,null,{renderer:'canvas'});
 pie.setOption({color:colors,tooltip:{trigger:'item',confine:true,formatter:'{b}：{c}%',textStyle:{fontSize:12,color:'#344054'},borderColor:'#e6ebf2',padding:[6,10]},series:[{type:'pie',radius:'86%',center:['50%','50%'],label:{show:false},labelLine:{show:false},itemStyle:{borderColor:'#ffffff',borderWidth:2},emphasis:{scale:true,scaleSize:5,itemStyle:{shadowBlur:8,shadowColor:'rgba(17,24,39,.15)'}},data:data.audience.map(item=>({name:item.name,value:item.share}))}]});
 new ResizeObserver(()=>pie.resize()).observe(chart);
})();

/* ==================== 03 促销决策、评估复盘与当日效果趋势 ==================== */

/* 本地 UI 示例：活动方案、累计指标及评估结论由数据提供，不发券、不提交业务操作。 */
(() => {
  'use strict';
  const source = document.getElementById('decision-review-data');
  if (!source) return;
  const { decision = {}, execution = {} } = JSON.parse(source.textContent);
  const byId = id => document.getElementById(id);
  const valid = value => typeof value === 'number' && Number.isFinite(value);
  const number = (value, digits = 0) => valid(value)
    ? value.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
  const rate = value => valid(value) ? `${number(value, 1)}%` : '—';
  const setText = (id, value) => { byId(id).textContent = value || '—'; };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const setStatus = (id, text, variant) => {
    setText(id, text);
    byId(id).className = `status-tag status-tag--${variant}`;
  };
  const activityStates = {
    PENDING_CONFIRM: ['待确认', 'pending'], PENDING_EXECUTION: ['待执行', 'pending'],
    EXECUTING: ['进行中', 'active'], COMPLETED: ['已结束', 'neutral'],
    REJECTED: ['已拒绝', 'neutral'], CANCELLED: ['已取消', 'neutral'], GENERATED: ['已生成', 'active']
  };
  setStatus('decision-status', ...(activityStates[decision.status] || ['状态待更新', 'neutral']));
  setText('promo-activity-title', decision.title);
  setText('promo-audience', decision.audience);
  setText('promo-selected-users', number(decision.selectedUsers));
  setText('promo-budget', number(decision.budget));
  setText('promo-coupon-count', number(decision.couponCount));
  setText('promo-reward', decision.reward);
  ['start', 'end'].forEach(key => {
    const value = decision[key === 'start' ? 'periodStart' : 'periodEnd'];
    setText(`promo-${key}`, value);
    if (value) byId(`promo-${key}`).setAttribute('datetime', value);
  });
  const goals = {
    NEW_USER_RECHARGE: '促进首充用户完成二充/三充，提升新用户复充转化。',
    DORMANT_WAKEUP: '促使沉睡用户重新到站充电，恢复用户充电活跃。',
    CHURN_RECALL: '召回长期未充电或高价值流失用户，促使用户重新到站充电，降低用户持续流失。'
  };
  setText('promo-goal', decision.goal || goals[decision.sceneType]);

  // PRD 6.3：阶段、等级决定默认结论；业务传入的结论优先，不由 KPI 自行推算等级。
  const conclusions = {
  "NEW_USER_RECHARGE": {
    "EVALUATING": {
      "优": "当前活动执行效果良好，新用户二充/三充转化表现积极，建议按原策略继续执行并持续观察后续转化表现。",
      "良": "当前活动执行效果基本符合预期，新用户复充转化已有提升，建议继续执行并重点关注后续转化效率。",
      "差": "当前活动执行效果未达预期，新用户复充转化偏弱，建议重点关注目标人群筛选、券力度及投放节奏，必要时及时调整活动。"
    },
    "PENDING_REVIEW": {
      "优": "活动执行已结束，最后一次阶段评估为“优”，当前正在汇总完整活动周期数据，等待生成最终复盘结果。",
      "良": "活动执行已结束，最后一次阶段评估为“良”，当前正在汇总完整活动周期数据，等待生成最终复盘结果。",
      "差": "活动执行已结束，最后一次阶段评估为“差”，当前正在汇总完整活动周期数据，等待生成最终复盘结果。"
    },
    "REVIEWED": {
      "优": "本次活动有效促进首充用户完成二充/三充，新用户复充转化达到预期，建议保留当前人群筛选与券策略，作为同类拉新转化活动参考。",
      "良": "本次活动对新用户复充转化有一定促进作用，但整体效果仍有优化空间，建议复盘用户筛选范围与券力度配置后再复用。",
      "差": "本次活动对新用户复充转化带动有限，当前方案不建议直接复用，后续需重点优化目标人群识别与激励力度。"
    }
  },
  "DORMANT_WAKEUP": {
    "EVALUATING": {
      "优": "当前活动执行效果良好，沉睡用户回流表现积极，建议按原策略继续执行并持续观察后续到站转化表现。",
      "良": "当前活动对沉睡用户唤醒已有一定成效，建议继续执行，并重点关注干预效率与回流转化效果。",
      "差": "当前活动对沉睡用户唤醒效果偏弱，建议重点关注目标人群筛选、券策略与投放节奏，必要时及时调整活动。"
    },
    "PENDING_REVIEW": {
      "优": "活动执行已结束，最后一次阶段评估为“优”，当前正在汇总沉睡用户回流效果，等待生成最终复盘结果。",
      "良": "活动执行已结束，最后一次阶段评估为“良”，当前正在汇总沉睡用户回流效果，等待生成最终复盘结果。",
      "差": "活动执行已结束，最后一次阶段评估为“差”，当前正在汇总沉睡用户回流效果，等待生成最终复盘结果。"
    },
    "REVIEWED": {
      "优": "本次活动有效唤醒沉睡用户重新到站充电，用户活跃恢复效果达到预期，建议保留当前目标人群与激励策略。",
      "良": "本次活动对沉睡用户唤醒有一定促进作用，但回流效果仍有优化空间，建议复盘活动节奏与优惠力度后再复用。",
      "差": "本次活动对沉睡用户唤醒作用有限，当前方案不建议直接复用，后续需重点优化目标人群识别与活动设计。"
    }
  },
  "CHURN_RECALL": {
    "EVALUATING": {
      "优": "当前活动执行效果良好，流失用户回流表现积极，建议按原策略继续执行并持续观察后续召回转化表现。",
      "良": "当前活动对流失用户召回已有一定成效，建议继续执行，并重点关注干预效率与回流转化效果。",
      "差": "当前活动对流失用户召回效果偏弱，建议重点关注目标人群筛选、券策略与投放节奏，必要时及时调整活动。"
    },
    "PENDING_REVIEW": {
      "优": "活动执行已结束，最后一次阶段评估为“优”，当前正在汇总流失用户召回效果，等待生成最终复盘结果。",
      "良": "活动执行已结束，最后一次阶段评估为“良”，当前正在汇总流失用户召回效果，等待生成最终复盘结果。",
      "差": "活动执行已结束，最后一次阶段评估为“差”，当前正在汇总流失用户召回效果，等待生成最终复盘结果。"
    },
    "REVIEWED": {
      "优": "本次活动对流失用户召回效果良好，用户回流与再次充电表现达到预期，建议保留当前召回策略作为同类活动参考。",
      "良": "本次活动对流失用户召回有一定促进作用，但整体回流效果仍有优化空间，建议复盘目标人群与激励力度后再复用。",
      "差": "本次活动对流失用户召回带动有限，当前方案不建议直接复用，后续需重点优化召回人群识别与活动方案。"
    }
  }
};
  const phase = execution.phase;
  const reviewed = phase === 'REVIEWED';
  const pending = phase === 'PENDING_REVIEW';
  const phaseStates = {
    EVALUATING: ['评估中', 'active'], PENDING_REVIEW: ['待复盘', 'pending'], REVIEWED: ['已复盘', 'neutral']
  };
  const hasReview = ['EXECUTING', 'COMPLETED'].includes(decision.status);
  byId('execution-review').hidden = !hasReview;
  document.querySelector('.lifecycle-link[href="#execution-review"]').closest('.lifecycle-step').hidden = !hasReview;
  setStatus('execution-status', ...(phaseStates[phase] || ['待评估', 'neutral']));
  const eventState = hasReview ? (phaseStates[phase] || ['待评估', 'neutral'])
    : (activityStates[decision.status] || ['状态待更新', 'neutral']);
  setStatus('event-current-status', ...eventState);
  setText('execution-grade-label', reviewed ? '复盘结果' : pending ? '最后一次阶段评估' : '阶段评估');
  const gradeName = execution.gradeName;
  setText('execution-grade', gradeName);
  byId('execution-grade').className = ({ '优': '', '良': 'is-fair', '差': 'is-poor' })[gradeName] ?? 'is-unknown';
  const display = {
    interveneCount: number(execution.interveneCount), interveneRate: rate(execution.interveneRate),
    redeemAmount: number(execution.redeemAmount, valid(execution.redeemAmount) && !Number.isInteger(execution.redeemAmount) ? 2 : 0),
    // 核销率来自业务数据；金额 / 预算是预算消耗比例，不能用作核销率。
    redeemRate: rate(execution.redeemRate), convertCount: number(execution.convertCount), convertRate: rate(execution.convertRate)
  };
  document.querySelectorAll('[data-execution]').forEach(element => { element.textContent = display[element.dataset.execution]; });
  setText('execution-conclusion-title', reviewed ? 'AI 复盘结论' : '阶段结论');
  const fallback = reviewed ? '活动复盘已完成，结论待补充。' : pending ? '活动执行已结束，等待生成最终复盘结果。' : '活动持续评估中，等待形成阶段结论。';
  setText('execution-conclusion-text', execution.conclusion || conclusions[decision.sceneType]?.[phase]?.[gradeName] || fallback);

  const svg = byId('execution-trend-svg');
  const plot = byId('execution-trend-plot');
  const tooltip = byId('execution-chart-tooltip');
  const series = [
    { key: 'intervene', label: '干预用户数', unit: '人', color: '#315eef', axis: 'people' },
    { key: 'redeemAmount', label: '核销金额', unit: '元', color: '#05b37f', axis: 'amount' },
    { key: 'convert', label: '转化用户数', unit: '人', color: '#7c3aed', axis: 'people' }
  ];
  const rawPoints = Array.isArray(execution.trend) ? execution.trend : [];
  // 原型累计示例按相邻日差分；正式接口可直接传 trendBasis: daily 的当日值。
  // 缺失前值时保留空缺，避免把累计值或缺失值误画成当日零值。
  const points = rawPoints.map((point, index) => {
    const result = { date: point.date };
    for (const { key } of series) {
      const previous = index ? rawPoints[index - 1][key] : execution.trendInitialValues?.[key];
      result[key] = execution.trendBasis === 'cumulative'
        ? (valid(point[key]) && valid(previous) && point[key] >= previous ? point[key] - previous : null)
        : (valid(point[key]) ? point[key] : null);
    }
    return result;
  });
  let geometry;
  const hidePoint = () => {
    tooltip.hidden = true;
    svg.querySelector('.execution-guide')?.setAttribute('visibility', 'hidden');
  };
  function showPoint(index) {
    if (!geometry || !points[index]) return;
    const point = points[index];
    tooltip.innerHTML = `<strong>${escape(point.date)} · 当日值</strong>${series.map(item => `<div><span>${item.label}</span><b>${number(point[item.key], item.axis === 'amount' && valid(point[item.key]) && !Number.isInteger(point[item.key]) ? 2 : 0)} ${item.unit}</b></div>`).join('')}`;
    tooltip.hidden = false;
    const x = geometry.x(index);
    const left = x + 12 + tooltip.offsetWidth > geometry.width ? x - tooltip.offsetWidth - 12 : x + 12;
    tooltip.style.left = `${Math.max(0, Math.min(geometry.width - tooltip.offsetWidth, left))}px`;
    tooltip.style.top = '4px';
    const guide = svg.querySelector('.execution-guide');
    guide.setAttribute('x1', x); guide.setAttribute('x2', x); guide.setAttribute('visibility', 'visible');
  }
  const axisTop = values => {
    const max = Math.max(1, ...values.filter(valid));
    const rawStep = max / 4;
    const scale = 10 ** Math.floor(Math.log10(rawStep));
    const step = Math.max(1, [1, 2, 5, 10].find(n => n * scale >= rawStep) * scale);
    return step * 4;
  };
  function renderChart() {
    const width = Math.round(plot.clientWidth), height = Math.round(plot.clientHeight);
    if (!width || !height) return;
    hidePoint(); geometry = null;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    if (!points.some(p => series.some(item => valid(p[item.key])))) {
      svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" class="execution-axis">暂无活动趋势数据</text>';
      return;
    }
    const left = 38, right = width - 48, top = 26, bottom = height - 28;
    const maxima = { people: axisTop(points.flatMap(p => [p.intervene, p.convert])), amount: axisTop(points.map(p => p.redeemAmount)) };
    const x = index => points.length === 1 ? (left + right) / 2 : left + index * (right - left) / (points.length - 1);
    const y = (value, axis) => bottom - value / maxima[axis] * (bottom - top);
    geometry = { width, x };
    let markup = '<title>促销活动每日执行效果</title><desc>每个节点为当日值。左轴为干预和转化人数，右轴为核销金额；上方指标卡为活动累计结果。</desc>';
    markup += `<text class="execution-axis" x="${left}" y="13">人数（人）</text><text class="execution-axis" x="${right}" y="13" text-anchor="end">金额（元）</text>`;
    for (let tick = 0; tick <= 4; tick++) {
      const gy = bottom - tick / 4 * (bottom - top);
      markup += `<line class="execution-gridline" x1="${left}" y1="${gy}" x2="${right}" y2="${gy}"/><text class="execution-axis" x="${left - 8}" y="${gy + 4}" text-anchor="end">${number(maxima.people * tick / 4)}</text><text class="execution-axis" x="${right + 8}" y="${gy + 4}">${number(maxima.amount * tick / 4)}</text>`;
    }
    markup += `<line class="execution-guide" y1="${top}" y2="${bottom}" stroke="#d5dce8" stroke-dasharray="3 3" visibility="hidden"/>`;
    series.forEach(item => {
      let path = '', connected = false;
      points.forEach((point, index) => {
        if (valid(point[item.key])) { path += `${connected ? 'L' : 'M'}${x(index)},${y(point[item.key], item.axis)} `; connected = true; }
        else connected = false;
      });
      markup += `<path class="execution-series" data-series="${item.key}" d="${path}" stroke="${item.color}" stroke-width="3"/>`;
      points.forEach((point, index) => {
        if (valid(point[item.key])) markup += `<circle cx="${x(index)}" cy="${y(point[item.key], item.axis)}" r="3" fill="#fff" stroke="${item.color}" stroke-width="1.5"/>`;
      });
    });
    const labelStep = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor((right - left) / 50))));
    points.forEach((point, index) => {
      if (index === points.length - 1 || (index % labelStep === 0 && points.length - 1 - index >= labelStep)) {
        markup += `<text class="execution-axis" x="${x(index)}" y="${bottom + 20}" text-anchor="middle">${escape(point.date)}</text>`;
      }
      const hitLeft = index ? (x(index - 1) + x(index)) / 2 : left - 6;
      const hitRight = index === points.length - 1 ? right + 6 : (x(index) + x(index + 1)) / 2;
      const label = `${point.date}，当日${series.map(item => `${item.label} ${number(point[item.key], item.axis === 'amount' ? 2 : 0)} ${item.unit}`).join('；')}`;
      markup += `<g class="execution-chart-hit" data-index="${index}" tabindex="0" role="img" aria-label="${escape(label)}" aria-describedby="execution-chart-tooltip"><rect x="${hitLeft}" y="${top}" width="${hitRight - hitLeft}" height="${bottom - top}" fill="transparent"/></g>`;
    });
    svg.innerHTML = markup;
  }
  svg.addEventListener('pointermove', event => { const hit = event.target.closest('.execution-chart-hit'); if (hit) showPoint(Number(hit.dataset.index)); else hidePoint(); });
  svg.addEventListener('pointerleave', hidePoint);
  svg.addEventListener('focusin', event => { const hit = event.target.closest('.execution-chart-hit'); if (hit) showPoint(Number(hit.dataset.index)); });
  svg.addEventListener('focusout', hidePoint);
  svg.addEventListener('keydown', event => { if (event.key === 'Escape') hidePoint(); });
  new ResizeObserver(renderChart).observe(plot);
  document.fonts.ready.then(renderChart);
  renderChart();
})();

/* ==================== 04 生命周期定位与滚动高亮 ==================== */

/* 页内阶段导航：并排卡片共用选中背景，阶段名称、时间和锚点各自保留。 */
(() => {
  'use strict';
  const links = [...document.querySelectorAll('.lifecycle-link')];
  const stages = links.map(link => ({
    link,
    section: document.getElementById(link.hash.slice(1))
  })).filter(item => item.section);
  if (!stages.length) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let activeId = stages[0].section.id;
  let preferredId = activeId;
  let navigationTarget = null;
  let settleTimer;
  let framePending = false;

  function getRows() {
    const rows = [];
    stages.forEach(item => {
      if (item.link.closest('.lifecycle-step').hidden || !item.section.getClientRects().length) return;
      const top = item.section.getBoundingClientRect().top;
      const last = rows[rows.length - 1];
      if (last && last.items[0].section.parentElement === item.section.parentElement
          && Math.abs(top - last.top) < 2) last.items.push(item);
      else rows.push({ top, items: [item] });
    });
    return rows;
  }

  function setActive(id, rows = getRows()) {
    const row = rows.find(item => item.items.some(stage => stage.section.id === id));
    const selected = row ? row.items : [];
    activeId = id;
    stages.forEach(({ link, section }) => {
      const index = selected.findIndex(item => item.section === section);
      const step = link.closest('.lifecycle-step');
      step.classList.toggle('lifecycle-step--active', index !== -1);
      step.classList.toggle('lifecycle-step--joined-previous', index > 0);
      step.classList.toggle('lifecycle-step--joined-next', index !== -1 && index < selected.length - 1);
      // 保留一个明确的当前锚点；同组其他阶段仅共享视觉选中态。
      if (index !== -1 && section.id === id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  function updateFromScroll() {
    const rows = getRows();
    if (!rows.length) return;
    if (navigationTarget) {
      setActive(navigationTarget, rows);
      return;
    }
    const line = document.querySelector('.topbar').getBoundingClientRect().bottom + 36;
    let row = rows[0];
    rows.forEach(candidate => { if (candidate.top <= line) row = candidate; });
    // 最后一行可能不足以滚到顶部，抵达页尾时仍能进入最后一组。
    if (window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
      row = rows[rows.length - 1];
    }
    const target = row.items.find(item => item.section.id === preferredId)
      || row.items.find(item => item.section.id === activeId) || row.items[0];
    setActive(target.section.id, rows);
  }

  function scheduleUpdate() {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(() => { framePending = false; updateFromScroll(); });
  }
  function finishNavigation() {
    clearTimeout(settleTimer);
    navigationTarget = null;
    scheduleUpdate();
  }

  function navigateTo(item, smooth, updateHistory) {
    preferredId = item.section.id;
    navigationTarget = item.section.id;
    setActive(item.section.id);
    if (updateHistory && location.hash !== item.link.hash) history.pushState(null, '', item.link.hash);
    item.section.focus({ preventScroll: true });
    const offset = parseFloat(getComputedStyle(item.section).scrollMarginTop) || 72;
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const top = Math.max(0, Math.min(max, item.section.getBoundingClientRect().top + window.scrollY - offset));
    window.scrollTo({ top, left: window.scrollX, behavior: smooth && !reduceMotion.matches ? 'smooth' : 'instant' });
    clearTimeout(settleTimer);
    // 同一行内切换可能没有 scrollend，空闲回退保证滚动高亮继续生效。
    settleTimer = setTimeout(finishNavigation, 180);
  }

  stages.forEach(item => item.link.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!getRows().some(row => row.items.includes(item))) return;
    event.preventDefault();
    navigateTo(item, true, true);
  }));
  window.addEventListener('scroll', () => {
    if (navigationTarget) {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(finishNavigation, 180);
    } else scheduleUpdate();
  }, { passive: true });
  window.addEventListener('scrollend', finishNavigation);
  window.addEventListener('wheel', finishNavigation, { passive: true });
  window.addEventListener('touchstart', finishNavigation, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('social-station-change', () => {
    finishNavigation();
    if (!getRows().some(row => row.items.some(item => item.section.id === preferredId))) {
      preferredId = 'event-analysis';
    }
    scheduleUpdate();
  });
  window.addEventListener('popstate', () => {
    const item = getRows().flatMap(row => row.items).find(stage => stage.link.hash === location.hash);
    if (item) navigateTo(item, false, false);
    else scheduleUpdate();
  });
  new ResizeObserver(scheduleUpdate).observe(document.querySelector('.event-sections'));
  const initial = getRows().flatMap(row => row.items).find(item => item.link.hash === location.hash);
  if (initial) requestAnimationFrame(() => navigateTo(initial, false, false));
  else updateFromScroll();
})();


/* 标题说明气泡：鼠标移入/键盘聚焦显示，移出、失焦、Esc或滚动关闭。 */
(() => {
 const tip=document.createElement('div');tip.id='promotion-help-tooltip';tip.className='promotion-help-tooltip';tip.setAttribute('role','tooltip');tip.hidden=true;document.body.append(tip);
 const hide=()=>{tip.hidden=true;};
 document.querySelectorAll('[data-promotion-help]').forEach(button=>{
  button.setAttribute('aria-describedby',tip.id);
  const show=()=>{
   tip.textContent=button.dataset.promotionHelp;tip.hidden=false;
   const r=button.getBoundingClientRect(),box=tip.getBoundingClientRect();
   tip.style.left=Math.max(12,Math.min(r.left,window.innerWidth-box.width-12))+'px';
   tip.style.top=(r.bottom+8+box.height>window.innerHeight-12?Math.max(12,r.top-box.height-8):r.bottom+8)+'px';
  };
  button.addEventListener('pointerenter',show);button.addEventListener('pointerleave',hide);
  button.addEventListener('focus',show);button.addEventListener('blur',hide);
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});
 document.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);
})();
