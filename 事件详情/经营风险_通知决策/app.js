/* AI 管家 · 经营风险通知决策
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
  const trend = core.trend || [];
  // 趋势指标严格按原型14个日点汇总，异常定位仍使用触发日的独立数据。
  const actualTotal = trend.reduce((sum, point) => sum + Math.round(point.actual * 1000), 0) / 1000;
  const baselineTotal = trend.reduce((sum, point) => sum + Math.round(point.baseline * 1000), 0) / 1000;
  const delta = actualTotal - baselineTotal;
  const rate = baselineTotal ? delta / baselineTotal * 100 : null;
  const conditionDays = trend.filter(point => point.baseline > 0 && (point.actual - point.baseline) / point.baseline * 100 <= -core.declineRateThreshold).length;
  const display = {
    analysisPeriod: core.analysisPeriod, analysisRange: range(core.analysisRange),
    trendResult: delta < 0 ? '整体下降' : delta > 0 ? '整体上升' : '整体持平',
    conditionDays: String(conditionDays),
    changeValue: (delta > 0 ? '+' : '') + number(delta),
    changeRate: rate === null ? '—' : (rate > 0 ? '+' : '') + number(rate, 2),
    actualTotal: number(actualTotal), baselineTotal: number(baselineTotal)
  };
  document.querySelectorAll('[data-core]').forEach(element => { element.textContent = display[element.dataset.core]; });

  // 使用原型的独立 judgement 字段；没有判断内容时整条隐藏。
  const judgement = typeof core.judgement === 'string' ? core.judgement.trim() : '';
  document.getElementById('core-judgement-text').textContent = judgement;
  document.getElementById('core-judgement').hidden = !judgement;

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
  const points = trend;
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
      ${point.compareDate ? `<small>对应对比日期 ${escape(point.compareDate)}</small>` : ''}`;
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
    // 使用折线对比每日实际值和基线值；完整数值刻度避免歧义。
    const step = 100;
    const min = Math.max(0, Math.floor(Math.min(...values) / step) * step - step);
    const max = Math.ceil(Math.max(...values) / step) * step + step;
    const x = index => points.length === 1 ? (left + width - right) / 2 : left + index * (width - left - right) / (points.length - 1);
    const y = value => top + (max - value) / (max - min) * (bottom - top);
    geometry = { width, x };
    let markup = '<title>近14天实际充电量与基线充电量趋势</title><desc>横轴为08-04至08-17的日期序列，08-17为事件触发日。实际充电量为蓝色实线，基线充电量为橙色虚线。</desc>';
    for (let value = min; value <= max; value += step) {
      markup += `<line class="core-chart-grid" x1="${left}" y1="${y(value)}" x2="${width - right}" y2="${y(value)}"/>`;
      markup += `<text class="core-chart-axis" x="${left - 10}" y="${y(value) + 4}" text-anchor="end">${number(value, 0)}</text>`;
    }
    markup += `<line class="core-chart-guide" x1="0" x2="0" y1="${top}" y2="${bottom}" visibility="hidden"/>`;
    for (const [field, series] of [['baseline', 'baseline'], ['actual', 'actual']]) {
      markup += `<polyline class="core-chart-line core-chart-line--${series}" points="${points.map((point, index) => `${x(index)},${y(point[field])}`).join(' ')}"/>`;
      markup += points.map((point, index) => `<circle class="core-chart-dot core-chart-dot--${series}" cx="${x(index)}" cy="${y(point[field])}" r="${point.isAnalysisDay ? 4.5 : 3.5}"/>`).join('');
    }
    const labelEvery = Math.max(1, Math.ceil(points.length * 46 / (width - left - right)));
    points.forEach((point, index) => {
      if (index === 0 || index === points.length - 1 || (index % labelEvery === 0 && x(points.length - 1) - x(index) >= 46)) markup += `<text class="core-chart-axis" x="${x(index)}" y="${height - 9}" text-anchor="middle">${escape(point.analysisDate)}</text>`;
      const hitLeft = index === 0 ? left : (x(index - 1) + x(index)) / 2;
      const hitRight = index === points.length - 1 ? width - right : (x(index) + x(index + 1)) / 2;
      const label = `${point.analysisDate}${point.isAnalysisDay ? '，触发日' : ''}，实际充电量 ${number(point.actual)} 度；${point.compareDate ? `对应 ${point.compareDate}，` : ''}基线充电量 ${number(point.baseline)} 度`;
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

  function valueCell(value, isShare = false, fallback = '—') {
    const cell = document.createElement('td');
    if (!validNumber(value)) { cell.textContent = fallback; cell.className = 'anomaly-value--unknown'; return cell; }
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

  function renderRows(id, rows, qualitative = false) {
    const body = document.getElementById(id);
    body.replaceChildren();
    if (!rows.length) {
      const row = document.createElement('tr'), empty = document.createElement('td');
      empty.colSpan = qualitative ? 2 : 3; empty.className = 'anomaly-empty'; empty.textContent = '暂无时段分析数据';
      row.append(empty); body.append(row); return;
    }
    rows.forEach(item => {
      const row = document.createElement('tr'), name = document.createElement('td');
      name.textContent = item.isAllDay ? '全天统一价' : formatName(item.name || item.slot || '—');
      row.append(name);
      if (qualitative) {
        const cell = document.createElement('td'), result = document.createElement('span');
        const severity = ['severe', 'drop', 'normal'].includes(item.severity) ? item.severity : 'normal';
        result.className = `anomaly-result anomaly-result--${severity}`;
        result.textContent = item.result || '暂无分析结果';
        cell.append(result); row.append(cell);
      } else {
        row.append(valueCell(item.value, false, item.valueLabel || item.result || '—'), valueCell(item.contributionRate, true));
      }
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
  // 原型仅提供定位结果时展示两列；有量化数据时恢复 PRD 的变化值、影响占比三列表格。
  const qualitative = !timeSlots.some(item => validNumber(item.value) || validNumber(item.contributionRate));
  const timeTable = document.getElementById('anomaly-time-rows').closest('table');
  timeTable.classList.toggle('anomaly-table--qualitative', qualitative);
  if (qualitative) {
    timeTable.querySelector('colgroup').innerHTML = '<col style="width:55%"><col style="width:45%">';
    timeTable.querySelector('thead').innerHTML = '<tr><th scope="col">充电时段</th><th scope="col">定位结果</th></tr>';
  }
  renderRows('anomaly-time-rows', timeSlots, qualitative);
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

/* ==================== 03 通知内容与发送结果 ==================== */
(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('notification-decision-data').textContent);
  const set = (id, value) => { document.getElementById(id).textContent = value || '—'; };
  set('notify-target', data.target);
  set('notify-channel', data.channel);
  set('notify-time', data.sentAt);
  if (data.sentAt) document.getElementById('notify-time').dateTime = data.sentAt.replace(' ', 'T');
  set('notify-status', data.statusName);
  set('notification-subject', data.subject);
  const message = document.getElementById('notification-message-text');
  message.replaceChildren();
  (data.paragraphs || []).forEach(text => {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    message.append(paragraph);
  });
})();

/* ==================== 04 三阶段生命周期定位 ==================== */
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

