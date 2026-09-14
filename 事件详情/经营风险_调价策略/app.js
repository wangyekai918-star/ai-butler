/* AI 管家 · 经营风险调价策略
 * 页面交互统一入口；各功能保留独立作用域，按原顺序初始化。
 */

/* ==================== 01 核心指标、趋势图与 AI 修正说明 ==================== */

/* 本地 UI 示例：只渲染核心指标、趋势与说明提示，不请求接口。 */
(() => {
  'use strict';
  const source = document.getElementById('core-analysis-data');
  if (!source) return;
  const core = JSON.parse(source.textContent);
  const number = (value, digits = 3) => Number(value).toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const range = value => String(value).replace(/\s*[—–]\s*/g, ' 至 ');
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const display = {
    analysisPeriod: range(core.analysisPeriod), comparePeriod: range(core.comparePeriod),
    analysisValue: number(core.analysisValue), compareValue: number(core.compareValue),
    changeValue: (core.changeValue > 0 ? '+' : '') + number(core.changeValue),
    changeRate: (core.changeRate > 0 ? '+' : '') + number(core.changeRate, 2)
  };
  document.querySelectorAll('[data-core]').forEach(element => { element.textContent = display[element.dataset.core]; });

  const correction = document.getElementById('ai-correction');
  correction.hidden = core.baselineCorrection?.corrected !== true;
  document.getElementById('correction-explanation-text').textContent = range(core.baselineCorrection?.description || '');
  correction.addEventListener('pointerenter', () => correction.classList.remove('is-dismissed'));
  correction.addEventListener('focusin', () => correction.classList.remove('is-dismissed'));
  correction.addEventListener('keydown', event => {
    if (event.key === 'Escape') { correction.classList.add('is-dismissed'); event.stopPropagation(); }
  });

  const svg = document.getElementById('core-trend-svg');
  const plot = document.getElementById('core-trend-plot');
  const tooltip = document.getElementById('core-chart-tooltip');
  const points = core.trend || [];
  let geometry;

  function hidePoint() {
    tooltip.hidden = true;
    svg.querySelector('.core-chart-guide')?.setAttribute('visibility', 'hidden');
  }

  function showPoint(index) {
    if (!geometry || !points[index]) return;
    const point = points[index];
    tooltip.innerHTML = `<strong>${escape(point.analysisDate)}</strong>
      <div class="chart-tooltip__row"><span class="chart-tooltip__label"><i class="chart-tooltip__dot"></i>实际充电量</span><b>${number(point.actual)} 度</b></div>
      <div class="chart-tooltip__row"><span class="chart-tooltip__label"><i class="chart-tooltip__dot chart-tooltip__dot--baseline"></i>基线充电量</span><b>${number(point.baseline)} 度</b></div>
      <small>对应对比日期 ${escape(point.compareDate)}</small>`;
    tooltip.hidden = false;
    const x = geometry.x(index), tooltipWidth = tooltip.offsetWidth;
    const preferredLeft = x + 16 + tooltipWidth > geometry.width ? x - tooltipWidth - 16 : x + 16;
    tooltip.style.left = `${Math.max(0, Math.min(geometry.width - tooltipWidth, preferredLeft))}px`;
    tooltip.style.top = '12px';
    const guide = svg.querySelector('.core-chart-guide');
    guide.setAttribute('x1', x); guide.setAttribute('x2', x); guide.setAttribute('visibility', 'visible');
  }

  function renderChart() {
    const width = Math.round(plot.clientWidth), height = Math.round(plot.clientHeight);
    if (!width || !height) return;
    hidePoint();
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    if (!points.length) { svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" class="core-chart-axis">暂无趋势数据</text>'; return; }
    const left = 48, right = 24, top = 16, bottom = height - 32;
    const values = points.flatMap(point => [point.actual, point.baseline]);
    // 以 200 度为刻度，向两侧各留一个刻度；显示完整坐标值，不将折线图误用为零基柱形图。
    const step = 200;
    const min = Math.max(0, Math.floor(Math.min(...values) / step) * step - step);
    const max = Math.ceil(Math.max(...values) / step) * step + step;
    const x = index => points.length === 1 ? (left + width - right) / 2 : left + index * (width - left - right) / (points.length - 1);
    const y = value => top + (max - value) / (max - min) * (bottom - top);
    geometry = { width, x };
    let markup = '<title>分析期间与对比期间充电量趋势</title><desc>横轴为分析日期；每个点按周期位置匹配对比日期。实际充电量为蓝色实线，基线充电量为橙色虚线。</desc>';
    for (let value = min; value <= max; value += step) {
      markup += `<line class="core-chart-grid" x1="${left}" y1="${y(value)}" x2="${width - right}" y2="${y(value)}"/>`;
      markup += `<text class="core-chart-axis" x="${left - 10}" y="${y(value) + 4}" text-anchor="end">${number(value, 0)}</text>`;
    }
    markup += `<line class="core-chart-guide" x1="0" x2="0" y1="${top}" y2="${bottom}" visibility="hidden"/>`;
    for (const [field, series] of [['baseline', 'baseline'], ['actual', 'actual']]) {
      markup += `<polyline class="core-chart-line core-chart-line--${series}" points="${points.map((point, index) => `${x(index)},${y(point[field])}`).join(' ')}"/>`;
      markup += points.map((point, index) => `<circle class="core-chart-dot core-chart-dot--${series}" cx="${x(index)}" cy="${y(point[field])}" r="3.5"/>`).join('');
    }
    points.forEach((point, index) => {
      markup += `<text class="core-chart-axis" x="${x(index)}" y="${height - 9}" text-anchor="middle">${escape(point.analysisDate)}</text>`;
      const hitLeft = index === 0 ? left : (x(index - 1) + x(index)) / 2;
      const hitRight = index === points.length - 1 ? width - right : (x(index) + x(index + 1)) / 2;
      const label = `${point.analysisDate}，实际充电量 ${number(point.actual)} 度；对应 ${point.compareDate}，基线充电量 ${number(point.baseline)} 度`;
      markup += `<g class="core-chart-hit" data-index="${index}" tabindex="0" role="img" aria-label="${escape(label)}" aria-describedby="core-chart-tooltip"><rect x="${hitLeft}" y="${top}" width="${hitRight - hitLeft}" height="${bottom - top}" fill="transparent"/></g>`;
    });
    svg.innerHTML = markup;
  }

  svg.addEventListener('pointermove', event => {
    const hit = event.target.closest('.core-chart-hit');
    if (hit) showPoint(Number(hit.dataset.index)); else hidePoint();
  });
  svg.addEventListener('pointerleave', hidePoint);
  svg.addEventListener('focusin', event => {
    const hit = event.target.closest('.core-chart-hit');
    if (hit) showPoint(Number(hit.dataset.index));
  });
  svg.addEventListener('focusout', hidePoint);
  svg.addEventListener('keydown', event => { if (event.key === 'Escape') hidePoint(); });
  new ResizeObserver(renderChart).observe(plot);
  renderChart();
})();

/* ==================== 02 异常定位数据与时段列表滚动 ==================== */

/* 异常定位：展示原型给定数据，时段列表按实际数组长度自然扩展。 */
(() => {
  'use strict';
  const source = document.getElementById('anomaly-analysis-data');
  if (!source) return;
  const data = JSON.parse(source.textContent);
  const format = (value, digits) => Number(value).toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const validNumber = value => typeof value === 'number' && Number.isFinite(value);
  const primaryName = data.isPartner ? (data.primaryChannelName || '本站运营渠道') : '特来电渠道';
  const formatName = value => String(value || '').replace(/\s*[—–]\s*/g, ' 至 ').replaceAll('主渠道', primaryName);

  function valueCell(value, isShare = false) {
    const cell = document.createElement('td');
    if (!validNumber(value)) { cell.textContent = '—'; return cell; }
    const container = document.createElement('span');
    container.className = 'anomaly-value' + (isShare ? ' anomaly-share' : value < 0 ? ' anomaly-value--decrease' : value > 0 ? ' anomaly-value--increase' : '');
    const number = document.createElement('span');
    number.className = 'metric-number';
    number.textContent = isShare ? String(value) : (value > 0 ? '+' : '') + format(value, 3);
    const unit = document.createElement('span');
    unit.className = 'anomaly-value__unit';
    unit.textContent = isShare ? '%' : '度';
    container.append(number, unit); cell.append(container);
    return cell;
  }

  function renderRows(id, rows) {
    const body = document.getElementById(id);
    body.replaceChildren();
    if (!rows.length) {
      const row = document.createElement('tr'), empty = document.createElement('td');
      empty.colSpan = 3; empty.className = 'anomaly-empty'; empty.textContent = '暂无时段分析数据';
      row.append(empty); body.append(row); return;
    }
    rows.forEach(item => {
      const row = document.createElement('tr'), name = document.createElement('td');
      name.textContent = item.isAllDay ? '全天统一价' : formatName(item.name || item.slot || '—');
      row.append(name, valueCell(item.value), valueCell(item.contributionRate, true));
      body.append(row);
    });
  }

  function conclusion(id, text, show = true) {
    const element = document.getElementById(id);
    element.textContent = formatName(text);
    element.parentElement.hidden = !show || !text;
    return !element.parentElement.hidden;
  }

  renderRows('anomaly-user-rows', [
    { ...data.user?.personal, name: '个人用户' },
    { ...data.user?.enterprise, name: '企业用户' }
  ]);
  renderRows('anomaly-channel-rows', [
    { ...data.channel?.primary, name: primaryName },
    { ...data.channel?.interconnect, name: '互联互通渠道' }
  ]);
  const timeSlots = Array.isArray(data.timeSlots) ? data.timeSlots : [];
  renderRows('anomaly-time-rows', timeSlots);
  // 维度结论紧邻各自表格，整体判断单独放在下方通栏。
  conclusion('anomaly-user-conclusion', data.user?.conclusion);
  conclusion('anomaly-channel-conclusion', data.channel?.conclusion);
  conclusion('anomaly-time-conclusion', data.timeConclusion, timeSlots.length > 0);
  const cross = document.getElementById('anomaly-cross-conclusion');
  cross.textContent = formatName(data.crossConclusion);
  cross.closest('.anomaly-cross-conclusion').hidden = !data.crossConclusion;

  const pane = document.getElementById('anomaly-time-scroll');
  const frame = pane.closest('.anomaly-time-frame');
  const count = document.getElementById('anomaly-time-count');
  count.textContent = `${timeSlots.length} 个时段`;
  const timeCard = pane.closest('.anomaly-card--time');
  const stack = document.querySelector('.anomaly-stack');
  const grid = timeCard.closest('.anomaly-grid');
  const timeHeading = timeCard.querySelector('.anomaly-card__heading');
  const timeConclusion = timeCard.querySelector('.anomaly-card__conclusion');

  const toggle = document.getElementById('anomaly-time-toggle');
  const toggleLabel = toggle.querySelector('span');
  let expanded = false;
  let layoutFrame = 0;

  function updateFade() {
    frame.classList.toggle('has-more', pane.scrollHeight - pane.clientHeight - pane.scrollTop > 1);
  }
  function updateScrollState() {
    const overflowing = pane.scrollHeight > pane.clientHeight + 1;
    pane.classList.toggle('is-scrollable', overflowing);
    pane.tabIndex = overflowing ? 0 : -1;
    pane.setAttribute('aria-label', `充电时段列表，${timeSlots.length} 个时段${overflowing ? '，可滚动' : ''}`);
    // 展开入口取决于默认状态的真实溢出；展开后始终保留收起入口。
    toggle.hidden = !expanded && !overflowing;
    updateFade();
  }
  function sizeTimeList() {
    if (!grid.clientWidth) return;
    if (!expanded) {
      pane.style.removeProperty('height');
      pane.style.removeProperty('max-height');
      pane.style.removeProperty('--time-row-height');
    } else {
      const px = value => parseFloat(value) || 0;
      const cardStyle = getComputedStyle(timeCard);
      const outside = px(cardStyle.borderTopWidth) + px(cardStyle.borderBottomWidth)
        + timeHeading.getBoundingClientRect().height
        + (timeConclusion.hidden ? 0 : timeConclusion.getBoundingClientRect().height);
      // 左侧由内容自然撑高，右侧扣除标题和结论后，把剩余空间分配给滚动表格。
      const available = Math.max(132, stack.getBoundingClientRect().height - outside);
      const headerHeight = pane.querySelector('thead').getBoundingClientRect().height;
      const rowCount = Math.max(1, timeSlots.length);
      const bodyHeight = available - headerHeight;
      const visibleRows = bodyHeight >= rowCount * 40 ? rowCount
        : Math.max(0.5, Math.floor(bodyHeight / 40 - 0.5) + 0.5);
      pane.style.setProperty('--time-row-height', `${Math.max(40, bodyHeight / visibleRows)}px`);
      pane.style.height = `${available}px`;
      pane.style.maxHeight = `${available}px`;
    }
    updateScrollState();
  }
  function scheduleLayout() {
    if (layoutFrame) return;
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = 0;
      sizeTimeList();
    });
  }
  toggle.addEventListener('click', () => {
    expanded = !expanded;
    grid.classList.toggle('is-time-expanded', expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
    toggleLabel.textContent = expanded ? '收起' : '展开';
    sizeTimeList();
  });
  pane.addEventListener('scroll', updateFade, { passive: true });
  // 键盘滚动仅作用于已聚焦的时段列表，滚到底后不继续推动整页。
  pane.addEventListener('keydown', event => {
    if (!pane.classList.contains('is-scrollable')) return;
    const page = pane.clientHeight - 32;
    const rowHeight = pane.querySelector('tbody tr')?.getBoundingClientRect().height || 40;
    const positions = { ArrowDown: pane.scrollTop + rowHeight, ArrowUp: pane.scrollTop - rowHeight, PageDown: pane.scrollTop + page, PageUp: pane.scrollTop - page, Home: 0, End: pane.scrollHeight };
    if (Object.hasOwn(positions, event.key)) { event.preventDefault(); pane.scrollTop = positions[event.key]; }
  });
  const layoutObserver = new ResizeObserver(scheduleLayout);
  [pane, stack, ...stack.children, grid, timeHeading, timeConclusion, pane.querySelector('table')]
    .forEach(element => layoutObserver.observe(element));
  document.fonts.ready.then(scheduleLayout);
  sizeTimeList();
})();

/* ==================== 03 决策生成、执行复盘与效果趋势 ==================== */

/* 本地高保真示例：策略由数据提供，前端只负责展示，不执行调价或回调。 */
(() => {
  'use strict';
  const source = document.getElementById('decision-review-data');
  if (!source) return;
  const { decision = {}, execution = {} } = JSON.parse(source.textContent);
  const byId = id => document.getElementById(id);
  const validNumber = value => typeof value === 'number' && Number.isFinite(value);
  const number = (value, digits = 0) => validNumber(value)
    ? value.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
  const signed = (value, digits = 1) => validNumber(value) ? `${value > 0 ? '+' : ''}${number(value, digits)}` : '—';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const setText = (id, value) => { byId(id).textContent = value || '—'; };
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
    if (value) byId(`decision-${key}`).setAttribute('datetime', value.replace(' ', 'T'));
  });
  setText('decision-mode', decision.mode);
  setText('decision-scope', decision.scope);
  setText('decision-sync', decision.syncAction);
  setText('decision-purpose-text', decision.purpose);

  // 明确传入空数组表示暂无时段；仅旧版未提供 slots 时回退为全天调整。
  const slots = (Array.isArray(decision.slots) ? decision.slots : validNumber(decision.adjustAmount)
    ? [{ isAllDay: true, amount: decision.adjustAmount }] : []).filter(slot => slot && typeof slot === 'object');
  byId('decision-slot-count').textContent = slots.length ? `${slots.length} 个时段` : '';
  byId('decision-slot-rows').innerHTML = slots.length ? slots.map(slot => {
    const allDay = slot.isAllDay === true || (slot.start === '00:00' && slot.end === '24:00');
    const time = allDay ? '全天统一价' : slot.label || (slot.start && slot.end ? `${slot.start} 至 ${slot.end}` : '时段待补充');
    const signClass = slot.amount < 0 ? 'is-negative' : slot.amount > 0 ? 'is-positive' : '';
    return `<tr><td>${escape(time)}</td><td><span class="decision-adjustment-value ${signClass}"><span class="metric-number">${signed(slot.amount, 4)}</span>${validNumber(slot.amount) ? '<small>元/度</small>' : ''}</span></td></tr>`;
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
  setText('execution-grade-label', reviewed ? '复盘结果' : pending ? '最后一次阶段评估' : '阶段评估');
  setText('execution-grade', grade);
  byId('execution-grade').className = grade === '良' ? 'is-fair' : grade === '差' ? 'is-poor' : grade === '—' ? 'is-unknown' : '';
  const metrics = execution.metrics || {};
  document.querySelectorAll('[data-execution]').forEach(element => {
    const key = element.dataset.execution;
    const value = metrics[key];
    element.textContent = /Rate$/.test(key) ? (validNumber(value) ? `${signed(value)}%` : '—') : key === 'pricingBenefit' ? signed(value, 0) : number(value);
  });

  const stageCopy = {
    优: '当前策略阶段效果良好，未触发回调条件，建议按原策略继续执行并持续观察。',
    良: '当前策略阶段效果基本符合预期，暂未触发回调条件，建议继续执行并重点关注后续效果变化。',
    差: '当前策略阶段效果未达预期，已进入重点观察，若后续评估持续为差将触发策略回调。'
  };
  const reviewCopy = {
    优: '本次调价策略整体有效，策略收益达到预期，建议保留本次调价规则，并作为后续同类经营风险事件的参考。',
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
  setText('execution-conclusion-title', reviewed ? '复盘结论' : '阶段结论');
  setText('execution-conclusion-text', conclusion);
  byId('execution-conclusion-text').parentElement.classList.toggle('is-callback', execution.callbackTriggered === true && !reviewed);

  const points = (Array.isArray(execution.trend) ? execution.trend : []).filter(point => point && typeof point === 'object');
  const series = [
    { key: 'baseline', label: '充电量基线', color: '#a6badf', width: 2, dash: '5 3' },
    { key: 'income', label: '服务费收入', color: '#98a2b3', width: 2, dash: '2 3' },
    { key: 'users', label: '充电用户', color: '#667085', width: 2 },
    { key: 'volume', label: '充电量', color: '#05b37f', width: 3 }
  ];
  // 原型直接提供指数，不能当作度/元/人，也不用于反推上方累计指标。
  setText('execution-trend-note', points.length ? `各指标以 ${points[0].date} 累计值为 100，展示策略开始至各评估时点的累计变化。` : '暂无趋势数据');
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
    tooltip.innerHTML = `<strong>${escape(point.date)} · 累计效果指数</strong>${[...series].reverse().map(item => `<div><span>${item.label}</span><b>${number(point[item.key], 1)}</b></div>`).join('')}`;
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
        if (validNumber(point[item.key])) markup += `<circle class="execution-point" cx="${x(index)}" cy="${y(point[item.key])}" r="${item.key === 'volume' ? 3 : 2.5}" fill="#fff" stroke="${item.color}" stroke-width="1.5"/>`;
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

