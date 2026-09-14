/* AI 管家 · 经营风险促销策略
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
    // 以 200 度为刻度，向两侧各留一个刻度；显示完整坐标值，不将折线图误用为零基柱形图。
    const step = 200;
    const min = Math.max(0, Math.floor(Math.min(...values) / step) * step - step);
    const max = Math.ceil(Math.max(...values) / step) * step + step;
    const x = index => points.length === 1 ? (left + width - right) / 2 : left + index * (width - left - right) / (points.length - 1);
    const y = value => top + (max - value) / (max - min) * (bottom - top);
    geometry = { width, x };
    let markup = '<title>近 7 日实际充电量与基线充电量趋势</title><desc>横轴为日期，08-17 为本次分析日。实际充电量为蓝色实线，基线充电量为橙色虚线；历史日期不代表本次单日事件的累计分析周期。</desc>';
    for (let value = min; value <= max; value += step) {
      markup += `<line class="core-chart-grid" x1="${left}" y1="${y(value)}" x2="${width - right}" y2="${y(value)}"/>`;
      markup += `<text class="core-chart-axis" x="${left - 10}" y="${y(value) + 4}" text-anchor="end">${number(value, 0)}</text>`;
    }
    markup += `<line class="core-chart-guide" x1="0" x2="0" y1="${top}" y2="${bottom}" visibility="hidden"/>`;
    for (const [field, series] of [['baseline', 'baseline'], ['actual', 'actual']]) {
      markup += `<polyline class="core-chart-line core-chart-line--${series}" points="${points.map((point, index) => `${x(index)},${y(point[field])}`).join(' ')}"/>`;
      markup += points.map((point, index) => `<circle class="core-chart-dot core-chart-dot--${series}" cx="${x(index)}" cy="${y(point[field])}" r="${point.isAnalysisDay ? 4.5 : 3.5}"/>`).join('');
    }
    points.forEach((point, index) => {
      markup += `<text class="core-chart-axis" x="${x(index)}" y="${height - 9}" text-anchor="middle">${escape(point.analysisDate)}</text>`;
      const hitLeft = index === 0 ? left : (x(index - 1) + x(index)) / 2;
      const hitRight = index === points.length - 1 ? width - right : (x(index) + x(index + 1)) / 2;
      const label = `${point.analysisDate}${point.isAnalysisDay ? '，分析日' : ''}，实际充电量 ${number(point.actual)} 度；${point.compareDate ? `对应 ${point.compareDate}，` : ''}基线充电量 ${number(point.baseline)} 度`;
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

