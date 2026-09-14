/* AI 管家 · 经营机会
 * 五步按业务顺序展示；运行数据保存在同级 HTML，不请求或执行真实调价接口。
 */

/* ==================== 01 五步机会分析与调价建议 ==================== */
(() => {
  'use strict';
  const source = document.getElementById('opportunity-analysis-data');
  const host = document.getElementById('opportunity-analysis-content');
  if (!source || !host) return;
  const data = JSON.parse(source.textContent);
  const valid = value => typeof value === 'number' && Number.isFinite(value);
  const number = (value, digits = 0) => valid(value) ? value.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const statuses = { passed: '通过', adjusted: '已调整', failed: '不通过', skipped: '无需复核', pending: '待分析' };
  const icons = new Set(['opportunity-basis.svg', 'station-performance.svg', 'history-review.svg', 'demand-forecast.svg', 'opportunity-conclusion.svg']);
  const factMarkup = fact => {
    const numeric = valid(fact.value);
    const empty = fact.value === null || fact.value === undefined || fact.value === '';
    const emphasis = ['primary', 'positive', 'warning'].includes(fact.emphasis) ? ` opportunity-fact--${fact.emphasis}` : '';
    const value = numeric ? number(fact.value, fact.digits || 0) : empty ? '—' : escape(fact.value);
    return `<div class="opportunity-fact${emphasis}"><dt>${escape(fact.label)}</dt><dd><span class="${numeric ? 'metric-number' : 'opportunity-fact__text'}">${!empty ? escape(fact.prefix || '') : ''}${value}</span>${fact.unit && !empty ? `<span class="opportunity-fact__unit">${escape(fact.unit)}</span>` : ''}</dd></div>`;
  };
  const factsMarkup = facts => `<dl class="opportunity-facts" style="--fact-count:${Math.max(1, Math.min(facts.length, 4))}"${facts.length ? '' : ' hidden'}>${facts.map(factMarkup).join('')}</dl>`;
  const steps = Array.isArray(data.steps) ? data.steps : [];
  const renderStep = step => {
    const status = Object.hasOwn(statuses, step.status) ? step.status : 'pending';
    // 不适用的历史复核仅显示说明，不以“0次”冒充已完成复核。
    const facts = status === 'skipped' || status === 'pending' ? [] : (Array.isArray(step.facts) ? step.facts : []);
    const finalStep = step.id === 'opportunity-conclusion';
    const description = finalStep
      ? `<section class="ai-conclusion opportunity-final-judgement" aria-label="最终机会AI判断"><h4>AI判断</h4><p>${escape(step.description)}</p></section>`
      : `<p class="opportunity-description">${escape(step.description)}</p>`;
    return `<section class="analysis-block opportunity-step${step.id === 'demand-forecast' ? ' opportunity-step--forecast' : ''}" id="${escape(step.id)}" aria-labelledby="${escape(step.id)}-title">
      <header class="analysis-block__heading"><img class="analysis-block__icon" src="./assets/${icons.has(step.icon) ? step.icon : 'opportunity-basis.svg'}" width="20" height="20" alt=""><h3 id="${escape(step.id)}-title">${escape(step.title)}</h3><span class="status-tag step-status--${status}">${statuses[status]}</span></header>
      <div class="opportunity-step__body">${description}${factsMarkup(facts)}</div>
    </section>`;
  };
  const processSteps = steps.filter(step => step.id !== 'opportunity-conclusion');
  const finalStep = steps.find(step => step.id === 'opportunity-conclusion');
  // 前四步构成分析过程，最终结论与建议在下一行完成承接。
  host.innerHTML = `<div class="opportunity-steps-frame"><div class="opportunity-steps-scroll" role="region" aria-label="四个机会分析过程，按从左到右顺序阅读" tabindex="-1" style="--step-count:${Math.max(1, processSteps.length)}">${processSteps.map(renderStep).join('')}</div></div><div class="opportunity-outcome-row" aria-label="最终机会结论与调价建议">${finalStep ? renderStep(finalStep) : ''}</div>`;
  const outcomeRow = host.querySelector('.opportunity-outcome-row');
  const stepsScroll = host.querySelector('.opportunity-steps-scroll');
  const stepsFrame = host.querySelector('.opportunity-steps-frame');
  const updateStepsScroll = () => {
    const overflowing = stepsScroll.scrollWidth > stepsScroll.clientWidth + 1;
    stepsScroll.tabIndex = overflowing ? 0 : -1;
    stepsFrame.classList.toggle('has-more', overflowing && stepsScroll.scrollLeft + stepsScroll.clientWidth < stepsScroll.scrollWidth - 1);
  };
  stepsScroll.addEventListener('scroll', updateStepsScroll, { passive: true });
  new ResizeObserver(updateStepsScroll).observe(stepsScroll);
  updateStepsScroll();
  const allowed = data.constitutesOpportunity === true;
  document.getElementById('event-analysis-summary').textContent = data.eventSummary || '分析结论待生成';
  const advice = data.advice;
  if (allowed && advice) {
    const priceFacts = [
      { label: '当前服务费', value: advice.currentFee, unit: '元/度', digits: 2 },
      { label: '建议调价幅度', value: advice.adjustAmount, unit: '元/度', digits: 2, prefix: advice.adjustAmount > 0 ? '+' : '', emphasis: 'primary' },
      { label: '调整后服务费', value: advice.adjustedFee, unit: '元/度', digits: 2 }
    ];
    const range = advice.suggestedRange;
    const competitor = valid(advice.competitorMin) && valid(advice.competitorMax) ? `${number(advice.competitorMin, 2)} 至 ${number(advice.competitorMax, 2)} 元/度` : '—';
    const incomeDescription = valid(advice.expectedIncomeRate) ? `<li>预计服务费收入${advice.expectedIncomeRate < 0 ? '下降' : '提升'}约 <strong>${number(Math.abs(advice.expectedIncomeRate), 1)}%</strong>。</li>` : '';
    outcomeRow.insertAdjacentHTML('beforeend', `<section class="analysis-block opportunity-advice" id="pricing-advice" aria-labelledby="pricing-advice-title">
      <header class="analysis-block__heading"><img class="analysis-block__icon" src="./assets/pricing-advice.svg" width="20" height="20" alt=""><h3 id="pricing-advice-title">调价建议</h3><span class="status-tag status-tag--opportunity">推荐进入调价决策</span></header>
      <div class="opportunity-advice__body"><dl class="opportunity-facts opportunity-price-grid" style="--fact-count:3">${priceFacts.map(factMarkup).join('')}</dl>
      <p class="opportunity-advice-context"><span>竞品主流区间：<strong>${competitor}</strong></span><span>建议调价范围：<strong>${range ? escape(range) : '—'}</strong></span></p>
      <ul class="opportunity-advice-list"><li>${escape(advice.scopeText)}</li>${incomeDescription}</ul></div>
    </section>`);
  }
  outcomeRow.hidden = !outcomeRow.children.length;
  if (!allowed) {
    document.querySelector('.decision-review-grid').hidden = true;
    ['decision-section', 'execution-review'].forEach(id => {
      document.getElementById(id).hidden = true;
      document.querySelector(`.lifecycle-link[href="#${id}"]`).closest('.lifecycle-step').hidden = true;
    });
    const state = document.getElementById('event-state');
    state.textContent = data.constitutesOpportunity === false ? '已结束' : '分析中';
    state.className = 'status-tag status-tag--neutral';
    if (data.constitutesOpportunity !== false) document.querySelector('#event-analysis > header .status-tag').textContent = '分析中';
  }
})();

/* ==================== 02 决策生成、评估复盘与效果趋势 ==================== */

/* 本地高保真示例：策略由数据提供，前端只负责展示，不执行调价或回调。 */
(() => {
  'use strict';
  const source = document.getElementById('decision-review-data');
  if (!source) return;
  const { decision, execution = {} } = JSON.parse(source.textContent);
  if (!decision || document.querySelector('.decision-review-grid').hidden) return;
  // 保留原型的 running 状态入口；没有新增可见演示按钮。
  if (new URLSearchParams(location.search).get('state') === 'running') {
    decision.status = 'EXECUTING';
    execution.phase = 'EVALUATING';
    execution.evaluationCount = 6;
    execution.achievementRate = null;
    execution.stageConclusion = '策略效果符合预期，建议继续执行。';
  }
  const byId = id => document.getElementById(id);
  const validNumber = value => typeof value === 'number' && Number.isFinite(value);
  const number = (value, digits = 0) => validNumber(value)
    ? value.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
  const signed = (value, digits = 1) => validNumber(value) ? `${value > 0 ? '+' : ''}${number(value, digits)}` : '—';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const setText = (id, value) => { byId(id).textContent = value === null || value === undefined || value === '' ? '—' : value; };
  const setStatus = (id, label, variant) => {
    const element = byId(id);
    element.textContent = label;
    element.className = `status-tag status-tag--${variant}`;
  };

  const statuses = {
    PENDING_CONFIRM: ['待确认', 'pending'], PENDING_EXECUTION: ['待执行', 'pending'],
    EXECUTING: ['执行中', 'executing'], COMPLETED: ['已完成', 'neutral'],
    REJECTED: ['已拒绝', 'neutral'], CANCELLED: ['已取消', 'neutral']
  };
  setStatus('decision-status', ...(statuses[decision.status] || ['待更新', 'neutral']));
  const project = decision.project || '服务费';
  setText('adjustment-title', `${project}调整`);
  ['start', 'end'].forEach(key => {
    const value = decision[`${key}At`];
    setText(`decision-${key}`, value);
    if (value) {
      const date = / 24:00$/.test(value) ? new Date(`${value.replace(' ', 'T')}Z`).toISOString().slice(0, 16) : value.replace(' ', 'T');
      byId(`decision-${key}`).setAttribute('datetime', date);
    }
  });
  setText('decision-mode', decision.mode);
  setText('decision-scope', decision.scope);
  setText('decision-sync', decision.syncAction);
  byId('decision-sync').closest('.decision-field').hidden = !decision.syncAction;
  setText('decision-purpose-text', decision.purpose);

  // 明确传入空数组表示暂无时段；仅旧版未提供 slots 时回退为全天调整。
  const slots = (Array.isArray(decision.slots) ? decision.slots : validNumber(decision.adjustAmount)
    ? [{ isAllDay: true, amount: decision.adjustAmount }] : []).filter(slot => slot && typeof slot === 'object');
  byId('decision-slot-count').textContent = slots.length ? `${slots.length} 个时段` : '';
  byId('decision-slot-rows').innerHTML = slots.length ? slots.map(slot => {
    const allDay = slot.isAllDay === true || (slot.start === '00:00' && slot.end === '24:00');
    const time = allDay ? '全天统一价' : slot.label || (slot.start && slot.end ? `${slot.start} 至 ${slot.end}` : '时段待补充');
    const signClass = slot.amount < 0 ? 'is-negative' : slot.amount > 0 ? 'is-positive' : '';
    return `<tr><td>${escape(time)}</td><td><span class="decision-adjustment-value ${signClass}"><span class="metric-number">${signed(slot.amount, 2)}</span>${validNumber(slot.amount) ? '<small>元/度</small>' : ''}</span></td></tr>`;
  }).join('') : '<tr><td colspan="2" class="decision-slot-empty">暂无调价时段</td></tr>';

  const scroll = byId('decision-slot-scroll');
  scroll.querySelector('table').setAttribute('aria-label', `各时段${project}调整幅度`);
  const updateScroll = () => {
    const overflowing = scroll.scrollHeight > scroll.clientHeight + 1;
    scroll.tabIndex = overflowing ? 0 : -1;
    scroll.setAttribute('aria-label', `${project}调整时段${overflowing ? '，可上下滚动查看' : ''}`);
    byId('decision-slot-frame').classList.toggle('has-more', overflowing && scroll.scrollTop + scroll.clientHeight < scroll.scrollHeight - 1);
  };
  scroll.addEventListener('scroll', updateScroll, { passive: true });
  new ResizeObserver(updateScroll).observe(scroll);
  updateScroll();

  const phases = {
    EVALUATING: ['评估中', 'executing'], PENDING_REVIEW: ['待复盘', 'pending'], REVIEWED: ['已复盘', 'neutral']
  };
  const phase = execution.phase;
  const reviewed = phase === 'REVIEWED';
  const pending = phase === 'PENDING_REVIEW';
  const grade = ({ A: '优', B: '良', C: '差', GOOD: '优', FAIR: '良', POOR: '差', 优: '优', 良: '良', 差: '差' })[execution.grade] || '—';
  setStatus('execution-status', ...(phases[phase] || ['待更新', 'neutral']));
  setStatus('event-state', ...(phases[phase] || ['待更新', 'neutral']));
  setText('review-count', number(execution.evaluationCount));
  byId('review-achievement').hidden = !validNumber(execution.achievementRate);
  setText('review-achievement-value', number(execution.achievementRate, 1));
  setText('execution-grade-label', reviewed ? '复盘结果' : pending ? '最后一次阶段评估' : '阶段评估');
  setText('execution-grade', grade);
  byId('execution-grade').className = grade === '良' ? 'is-fair' : grade === '差' ? 'is-poor' : grade === '—' ? 'is-unknown' : '';
  const metrics = execution.metrics || {};
  document.querySelectorAll('[data-execution]').forEach(element => {
    const key = element.dataset.execution;
    const value = metrics[key];
    element.textContent = key === 'serviceIncomeChangeRate' ? signed(value)
      : /Rate$/.test(key) ? (validNumber(value) ? `${signed(value)}%` : '—') : signed(value, 0);
  });

  const stageCopy = {
    优: '当前策略阶段效果良好，未触发回调条件，建议按原策略继续执行并持续观察。',
    良: '当前策略阶段效果基本符合预期，暂未触发回调条件，建议继续执行并重点关注后续效果变化。',
    差: '当前策略阶段效果未达预期，已进入重点观察，若后续评估持续为差将触发策略回调。'
  };
  const reviewCopy = {
    优: '本次调价策略整体有效，策略收益达到预期，建议保留本次调价规则，并作为后续同类经营机会事件的参考。',
    良: '本次调价策略取得一定效果，但部分指标未完全达到预期，建议保留策略方向并优化调价幅度或执行时段。',
    差: '本次调价策略整体效果未达预期，不建议直接复用当前方案，后续需重新评估调价幅度及影响因素。'
  };
  let conclusion = '暂无评估结论';
  if (reviewed) conclusion = execution.reviewConclusion || reviewCopy[grade] || '暂无复盘结论';
  else if (execution.callbackTriggered === true) {
    const reason = execution.callbackReason || '连续2次阶段评估结果为“差”，达到策略回调条件';
    conclusion = `策略已回调：${reason.replace(/[。；;]+$/, '')}${pending ? '；策略执行已结束，等待生成最终复盘结果。' : '。'}`;
  } else if (pending) conclusion = execution.pendingReviewConclusion || `策略执行已结束，${grade === '—' ? '' : `最后一次阶段评估为“${grade}”，`}当前正在汇总完整执行周期数据，最终复盘结果待生成。`;
  else if (phase === 'EVALUATING') conclusion = execution.stageConclusion || stageCopy[grade] || conclusion;
  setText('execution-conclusion-title', reviewed ? 'AI 复盘结论' : 'AI 阶段结论');
  setText('execution-conclusion-text', conclusion);
  byId('execution-conclusion-text').parentElement.classList.toggle('is-callback', execution.callbackTriggered === true && !reviewed);

  const points = (Array.isArray(execution.trend) ? execution.trend : []).filter(point => point && typeof point === 'object');
  const series = [
    { key: 'baseline', label: '充电量基线', color: '#a6badf', width: 2, dash: '5 3' },
    { key: 'volume', label: '充电量', color: '#667085', width: 2 },
    { key: 'users', label: '充电用户', color: '#98a2b3', width: 2, dash: '2 3' },
    { key: 'income', label: '服务费收入', color: '#05b37f', width: 3 }
  ];
  // 下列点为原型 SVG 坐标对应的指数示意；不是接口累计业务数据，也不用于反推上方指标。
  setText('execution-trend-note', points.length ? '按评估节点展示，首节点为 100。' : '暂无趋势数据');
  const svg = byId('execution-trend-svg');
  const plot = byId('execution-trend-plot');
  const tooltip = byId('execution-chart-tooltip');
  let geometry;
  const hidePoint = () => {
    tooltip.hidden = true;
    svg.querySelector('.execution-guide')?.setAttribute('visibility', 'hidden');
  };
  const showPoint = index => {
    if (!geometry || !points[index]) return;
    const point = points[index];
    tooltip.innerHTML = `<strong>${escape(point.date)} · 累计效果指数（示意）</strong>${[...series].reverse().map(item => `<div><span>${item.label}</span><b>${number(point[item.key], 1)}</b></div>`).join('')}`;
    tooltip.hidden = false;
    const x = geometry.x(index);
    const left = x + 12 + tooltip.offsetWidth > geometry.width ? x - tooltip.offsetWidth - 12 : x + 12;
    tooltip.style.left = `${Math.max(0, Math.min(geometry.width - tooltip.offsetWidth, left))}px`;
    tooltip.style.top = '0px';
    const guide = svg.querySelector('.execution-guide');
    guide.setAttribute('x1', x); guide.setAttribute('x2', x); guide.setAttribute('visibility', 'visible');
  };

  function renderChart() {
    const width = Math.round(plot.clientWidth), height = Math.round(plot.clientHeight);
    if (!width || !height) return;
    hidePoint();
    geometry = null;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const values = points.flatMap(point => series.map(item => point[item.key])).filter(validNumber);
    if (!values.length) {
      svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" class="execution-axis">暂无趋势数据</text>';
      return;
    }
    const left = 36, right = 22, top = 12;
    const hasTime = points.some(point => /\s\d{2}:\d{2}/.test(point.date));
    const bottom = height - (hasTime ? 44 : 28);
    const low = Math.min(...values), high = Math.max(...values);
    const rawStep = Math.max((high - low) / 4, 1);
    const scale = 10 ** Math.floor(Math.log10(rawStep));
    const step = ([1, 2, 5, 10].find(value => value * scale >= rawStep) || 10) * scale;
    const min = Math.floor((low - step * .15) / step) * step;
    const max = Math.ceil((high + step * .15) / step) * step;
    const x = index => points.length === 1 ? (left + width - right) / 2 : left + index * (width - left - right) / (points.length - 1);
    const y = value => top + (max - value) / (max - min) * (bottom - top);
    geometry = { width, x };
    let markup = '<title>策略执行累计效果指数</title><desc>横轴为评估时点。充电量为绿色实线，充电量基线为浅蓝虚线，充电用户为灰色实线，服务费收入为灰色点虚线。所有点表示从策略开始到评估时点的累计结果指数。</desc>';
    for (let value = min; value <= max + step / 2; value += step) {
      markup += `<line class="execution-gridline" x1="${left}" y1="${y(value)}" x2="${width - right}" y2="${y(value)}"/><text class="execution-axis" x="${left - 8}" y="${y(value) + 4}" text-anchor="end">${number(value)}</text>`;
    }
    markup += `<line class="execution-guide" y1="${top}" y2="${bottom}" stroke="#d5dce8" stroke-dasharray="3 3" visibility="hidden"/>`;
    series.forEach(item => {
      let path = '', previousValid = false;
      points.forEach((point, index) => {
        if (validNumber(point[item.key])) { path += `${previousValid ? 'L' : 'M'}${x(index)},${y(point[item.key])} `; previousValid = true; }
        else previousValid = false;
      });
      markup += `<path class="execution-series" data-series="${item.key}" d="${path}" stroke="${item.color}" stroke-width="${item.width}"${item.dash ? ` stroke-dasharray="${item.dash}"` : ''}/>`;
      points.forEach((point, index) => {
        if (validNumber(point[item.key])) markup += `<circle class="execution-point" cx="${x(index)}" cy="${y(point[item.key])}" r="${item.key === 'income' ? 3 : 2.5}" fill="#fff" stroke="${item.color}" stroke-width="1.5"/>`;
      });
    });
    const labelStep = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor((width - left - right) / 52))));
    points.forEach((point, index) => {
      if (index % labelStep === 0 || index === points.length - 1) {
        const tooCloseToLast = index !== points.length - 1 && (points.length - 1 - index) < labelStep;
        if (!tooCloseToLast) {
          const [date, time] = String(point.date || '—').split(/\s+/);
          markup += `<text class="execution-axis" x="${x(index)}" y="${bottom + 20}" text-anchor="middle">${escape(date)}${time ? `<tspan x="${x(index)}" dy="15">${escape(time)}</tspan>` : ''}</text>`;
        }
      }
      const hitLeft = index === 0 ? left : (x(index - 1) + x(index)) / 2;
      const hitRight = index === points.length - 1 ? width - right : (x(index) + x(index + 1)) / 2;
      const label = `${point.date}，累计效果指数：${series.map(item => `${item.label} ${number(point[item.key], 1)}`).join('；')}`;
      markup += `<g class="execution-chart-hit" data-index="${index}" tabindex="0" role="img" aria-label="${escape(label)}" aria-describedby="execution-chart-tooltip"><rect x="${hitLeft}" y="${top}" width="${hitRight - hitLeft}" height="${bottom - top}" fill="transparent"/></g>`;
    });
    svg.innerHTML = markup;
  }
  svg.addEventListener('pointermove', event => {
    const hit = event.target.closest('.execution-chart-hit');
    if (hit) showPoint(Number(hit.dataset.index)); else hidePoint();
  });
  svg.addEventListener('pointerleave', hidePoint);
  svg.addEventListener('focusin', event => {
    const hit = event.target.closest('.execution-chart-hit');
    if (hit) showPoint(Number(hit.dataset.index));
  });
  svg.addEventListener('focusout', hidePoint);
  svg.addEventListener('keydown', event => { if (event.key === 'Escape') hidePoint(); });
  new ResizeObserver(renderChart).observe(plot);
  renderChart();
})();

/* ==================== 03 生命周期定位与滚动高亮 ==================== */

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

