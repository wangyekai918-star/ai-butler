"use strict";

/* ==================== 01 安全看板 · AI 防护趋势 ====================
 * 日点使用本地 UI 示例数据；图表在本地绘制，不请求外部服务。
 * 保留左右两条数值轴，避免将防护量与预警、阻断量放在同一量级比较。
 */
(() => {
  const source = document.getElementById("safety-trend-data");
  const host = document.getElementById("protection-chart");
  if (!source || !host) return;
  const data = JSON.parse(source.textContent);
  const svg = host.querySelector("svg");
  const tooltip = host.querySelector(".chart-tooltip");
  const format = new Intl.NumberFormat("zh-CN");
  const colors = { protect: "#dbe7ff", warning: "#ffa400", block: "#e65b75" };
  const axisMaximum = values => {
    const max = Math.max(1, ...values);
    const step = 10 ** Math.floor(Math.log10(max));
    return Math.ceil(max / step) * step;
  };
  const leftMaximum = axisMaximum(data.protect);
  const rightMaximum = axisMaximum([...data.warning, ...data.block]);
  let geometry;
  let lastWidth = 0;
  let scheduled;

  function draw() {
    const width = Math.round(host.clientWidth);
    const height = host.clientHeight;
    if (!width || (width === lastWidth && geometry)) return;
    lastWidth = width;
    const left = 44;
    const right = width - 36;
    const top = 31;
    const bottom = height - 28;
    const step = (right - left) / data.dates.length;
    const xs = data.dates.map((_, i) => left + step * (i + 0.5));
    const yLeft = value => bottom - value / leftMaximum * (bottom - top);
    const yRight = value => bottom - value / rightMaximum * (bottom - top);
    geometry = { width, height, top, bottom, left, right, step, xs };
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const fragments = [
      `<text class="chart-unit" x="0" y="13">AI防护次数（次）</text>`,
      `<text class="chart-unit" text-anchor="end" x="${width}" y="13">预警 / 阻断（次）</text>`
    ];
    for (let i = 0; i <= 4; i++) {
      const y = top + i / 4 * (bottom - top);
      const tickValue = leftMaximum * (1 - i / 4);
      const protectLabel = tickValue >= 10000 ? `${Number((tickValue / 10000).toFixed(2))}万` : format.format(tickValue);
      fragments.push(`<line class="chart-gridline" x1="${left}" y1="${y}" x2="${right}" y2="${y}"/>`);
      fragments.push(`<text class="chart-axis-label" x="${left - 9}" y="${y + 4}" text-anchor="end">${protectLabel}</text>`);
      fragments.push(`<text class="chart-axis-label" x="${right + 8}" y="${y + 4}">${format.format(rightMaximum * (1 - i / 4))}</text>`);
    }
    const barWidth = Math.min(30, step * .43);
    data.protect.forEach((value, index) => {
      const y = yLeft(value);
      fragments.push(`<rect x="${xs[index] - barWidth / 2}" y="${y}" width="${barWidth}" height="${bottom - y}" rx="4" fill="${colors.protect}"/>`);
    });
    for (const key of ["warning", "block"]) {
      const points = data[key].map((value, index) => `${xs[index]},${yRight(value)}`).join(" ");
      fragments.push(`<polyline points="${points}" stroke="${colors[key]}" fill="none" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`);
      data[key].forEach((value, index) => fragments.push(`<circle cx="${xs[index]}" cy="${yRight(value)}" r="3" fill="#fff" stroke="${colors[key]}" stroke-width="2"/>`));
    }
    fragments.push(`<line class="chart-hover" x1="0" x2="0" y1="${top}" y2="${bottom}" visibility="hidden"/>`);
    data.dates.forEach((date, index) => {
      fragments.push(`<text class="chart-axis-label" x="${xs[index]}" y="${height - 8}" text-anchor="middle">${date}</text>`);
      const label = `${date}，AI防护${format.format(data.protect[index])}次，AI预警${data.warning[index]}次，AI阻断${data.block[index]}次`;
      fragments.push(`<rect class="chart-hit" data-index="${index}" role="img" aria-label="${label}" tabindex="0" x="${left + index * step}" y="${top}" width="${step}" height="${bottom - top}"/>`);
    });
    svg.innerHTML = fragments.join("");
    tooltip.hidden = true;
  }

  function show(index) {
    if (!geometry || index < 0 || index >= data.dates.length) return;
    const rows = [["AI防护次数", data.protect[index]], ["AI预警次数", data.warning[index]], ["AI阻断次数", data.block[index]]];
    tooltip.innerHTML = `<strong>${data.dates[index].replace("/", "月")}日</strong>${rows.map(([label, value]) => `<div class="tooltip-row"><span>${label}</span><b>${format.format(value)}</b></div>`).join("")}`;
    tooltip.hidden = false;
    const x = geometry.xs[index];
    const preferredX = x + 14;
    const tooltipWidth = tooltip.offsetWidth;
    tooltip.style.left = `${Math.max(0, Math.min(preferredX, geometry.width - tooltipWidth))}px`;
    tooltip.style.top = `${geometry.top + 12}px`;
    const cursor = svg.querySelector(".chart-hover");
    cursor.setAttribute("x1", x);
    cursor.setAttribute("x2", x);
    cursor.setAttribute("visibility", "visible");
  }

  function hide() {
    tooltip.hidden = true;
    svg.querySelector(".chart-hover")?.setAttribute("visibility", "hidden");
  }

  svg.addEventListener("pointermove", event => {
    const cell = event.target.closest(".chart-hit");
    if (cell) show(Number(cell.dataset.index));
  });
  svg.addEventListener("pointerleave", hide);
  svg.addEventListener("focusin", event => {
    if (event.target.matches(".chart-hit")) show(Number(event.target.dataset.index));
  });
  svg.addEventListener("focusout", event => {
    if (!svg.contains(event.relatedTarget)) hide();
  });
  svg.addEventListener("keydown", event => {
    if (event.key === "Escape") { hide(); return; }
    if (!["ArrowLeft", "ArrowRight"].includes(event.key) || !event.target.matches(".chart-hit")) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(data.dates.length - 1, Number(event.target.dataset.index) + (event.key === "ArrowRight" ? 1 : -1)));
    svg.querySelector(`[data-index="${next}"]`)?.focus();
  });
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(scheduled);
    scheduled = requestAnimationFrame(draw);
  });
  observer.observe(host);
  draw();
})();

/* ==================== 02 已完成页签切换 ====================
 * 保留各页签的滚动位置；支持链接定位、键盘左右切换。
 * 顶部范围与跨页入口仍为静态展示。
 */
(() => {
  const tabs = [...document.querySelectorAll('.module-tab[data-tab]')];
  const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
  const positions = new Map();
  let activeTab;

  function selectTab(tab, updateUrl = true) {
    if (!tab || tab === activeTab) return;
    if (activeTab) {
      const activePanel = document.getElementById(activeTab.getAttribute('aria-controls'));
      positions.set(activeTab.dataset.tab, activePanel.scrollTop);
    }
    tabs.forEach((item, index) => {
      const selected = item === tab;
      item.classList.toggle('module-tab--selected', selected);
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      panels[index].hidden = !selected;
      if (selected) panels[index].scrollTop = positions.get(item.dataset.tab) || 0;
    });
    activeTab = tab;
    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab.dataset.tab);
      window.history.replaceState(null, '', url);
    }
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
      const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      const targetIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 :
        (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      selectTab(tabs[targetIndex]);
      tabs[targetIndex].focus();
    });
  });

  const requested = new URLSearchParams(window.location.search).get('tab');
  selectTab(tabs.find(tab => tab.dataset.tab === requested) || tabs[0], false);
})();

/* ==================== 03 安全评估 · 本地筛选与详情 ====================
 * 480条虚拟记录与车辆防护汇总一致：健康432、亚健康28、高危20。
 * 状态是预设演示值，不通过示例得分推导正式业务结论；VIN均为DEMO编号。
 */
(() => {
  const form = document.getElementById('evaluation-form');
  if (!form) return;
  const fields = form.elements;
  const tbody = document.getElementById('evaluation-table-body');
  const pagination = document.getElementById('evaluation-pagination');
  const scrollRegion = document.getElementById('evaluation-table-scroll');
  const dialog = document.getElementById('evaluation-dialog');
  const defaultDate = '2026-08-17';
  const pageSize = 10;
  const statusClass = { 高危: 'risk', 亚健康: 'subhealthy', 健康: 'healthy' };
  const metricLabels = ['不均衡得分', 'SOC跳变得分', '压差得分', '温差偏离度得分', '温速偏离度得分', '最高温度偏离得分', '异常终止得分'];
  const catalog = [
    ['领克', '08 EM-P 120km'], ['比亚迪', '秦 450km'], ['奔腾', 'B30EV 406km'],
    ['别克', '微蓝6 410km'], ['雪佛兰', '畅巡 410km'], ['广汽埃安', 'AION S'],
    ['比亚迪', '秦 400km'], ['奇瑞', 'eQ1 301km'], ['长安', '逸动EV460'],
    ['奔腾', 'E05 401km'], ['特斯拉', 'Model Y 594km'], ['宝马', 'iX1'],
    ['特斯拉', 'Model 3'], ['比亚迪', '海豚'], ['比亚迪', '元PLUS'],
    ['比亚迪', '宋PLUS EV'], ['吉利', '几何A'], ['吉利', '银河E5'],
    ['五菱', '缤果'], ['欧拉', '好猫'], ['广汽埃安', 'AION Y'],
    ['小鹏', 'P7'], ['小鹏', 'G6'], ['蔚来', 'ET5'], ['零跑', 'C10'],
    ['大众', 'ID.4'], ['哪吒', 'U'], ['东风', '风神E70'],
    ['远程', '星享V'], ['福田', '智蓝轻卡'], ['上汽大通', 'EV30'],
    ['江淮', '帅铃i5'], ['东风', '御风EM26'], ['瑞驰', 'EC35'],
    ['中通', 'LCK6809EVGK'], ['重汽豪沃', 'JK6126GPHE']
  ].map(([brand, model], i) => ({ brand, model, category: i < 28 ? '乘用车' : i < 34 ? '商用货车' : '商用客车' }));
  const riskTemplates = [
    { score: 0, battery: 42, metrics: [0,0,0,0,0,0,0], hazards: ['压差异常', '温升偏离'] },
    { score: 0, battery: 45, metrics: [0,0,0,0,0,0,0], hazards: ['SOC跳变', '异常终止'] },
    { score: 4.5, battery: 51, metrics: [.5,1,.8,.7,.5,.4,.6], hazards: ['最高温度偏离'] },
    { score: 8, battery: 56, metrics: [1.2,1,1.5,1,1.2,1,1.1], hazards: ['温差偏离', '温速偏离'] },
    { score: 12.5, battery: 58, metrics: [2,1.5,2.3,1.7,1.5,1.9,1.6], hazards: ['异常终止', '压差异常'] }
  ];
  const cities = ['青岛市', '济南市', '烟台市', '潍坊市', '淄博市'];
  const records = [];
  function addRecord(modelIndex, health, index) {
    const id = String(records.length + 1).padStart(4, '0');
    let assessment;
    if (health === '高危') assessment = riskTemplates[index % riskTemplates.length];
    else {
      const score = health === '健康' ? 86 + index % 14 : 64 + index % 12;
      const base = Math.floor(score * 10 / 7) / 10;
      const metrics = Array(6).fill(base);
      metrics.push(Number((score - base * 6).toFixed(1)));
      assessment = {
        score, metrics,
        battery: health === '健康' ? 88 + index % 12 : 68 + index % 13,
        hazards: health === '健康' ? [] : [['不均衡偏离'], ['温差偏离'], ['SOC波动']][index % 3]
      };
    }
    records.push({ id, vin: `DEMO-VIN-${id}`, date: defaultDate, type: 'VIN', health,
      city: cities[index % cities.length], ...catalog[modelIndex], ...assessment });
  }
  // 高危车型数量：5/4/3/2/1，其他乘用1、货车3、客车1。
  [0,0,0,0,0,1,1,1,1,2,2,2,3,3,4,5,28,29,30,34].forEach((modelIndex, i) => addRecord(modelIndex, '高危', i));
  for (const [health, counts] of [['亚健康', [22,5,1]], ['健康', [370,52,10]]]) {
    counts.forEach((count, group) => {
      const start = [0,28,34][group];
      const length = [28,6,2][group];
      for (let i = 0; i < count; i++) addRecord(start + i % length, health, i);
    });
  }
  const recordById = new Map(records.map(record => [record.id, record]));
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const cell = (value, extraClass = '') => `<span class="evaluation-cell-text ${extraClass}" title="${escape(value)}">${escape(value)}</span>`;
  const badge = record => `<span class="evaluation-health">${record.health}</span>`;
  const hazardTags = record => record.hazards.length ? `<div class="evaluation-hazards">${record.hazards.map(item => `<span class="evaluation-hazard">${escape(item)}</span>`).join('')}</div>` : '<span class="evaluation-muted">无</span>';
  let filtered = [];
  let currentPage = 1;
  let detailTrigger;

  function updateOptions(select, values, placeholder) {
    const previous = select.value;
    select.replaceChildren(new Option(placeholder, ''), ...values.map(value => new Option(value, value)));
    select.value = values.includes(previous) ? previous : '';
  }
  function updateModels() {
    const candidates = catalog.filter(item => (!fields.category.value || item.category === fields.category.value) && (!fields.brand.value || item.brand === fields.brand.value));
    updateOptions(fields.model, candidates.map(item => item.model), '全部车系');
  }
  function updateBrands() {
    const candidates = catalog.filter(item => !fields.category.value || item.category === fields.category.value);
    updateOptions(fields.brand, [...new Set(candidates.map(item => item.brand))], '全部品牌');
    updateModels();
  }
  fields.category.addEventListener('change', updateBrands);
  fields.brand.addEventListener('change', updateModels);

  function renderPagination(totalPages) {
    pagination.replaceChildren();
    if (!totalPages) return;
    function addButton(page, label, { current = false, disabled = false, icon } = {}) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'evaluation-page-button';
      button.dataset.page = page;
      button.disabled = disabled;
      button.setAttribute('aria-label', label);
      if (current) button.setAttribute('aria-current', 'page');
      if (icon) {
        const image = document.createElement('img');
        image.src = `./assets/page-${icon}.svg`;
        image.alt = '';
        button.append(image);
      } else button.textContent = page;
      pagination.append(button);
    }
    addButton(currentPage - 1, '上一页', { disabled: currentPage === 1, icon: 'previous' });
    const pages = [...new Set([1, totalPages, ...Array.from({ length: 5 }, (_, i) => currentPage + i - 2)])]
      .filter(page => page > 0 && page <= totalPages).sort((a, b) => a - b);
    let previous = 0;
    pages.forEach(page => {
      if (previous && page - previous > 1) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'evaluation-page-ellipsis';
        ellipsis.textContent = '…';
        ellipsis.setAttribute('aria-hidden', 'true');
        pagination.append(ellipsis);
      }
      addButton(page, `第${page}页`, { current: page === currentPage });
      previous = page;
    });
    addButton(currentPage + 1, '下一页', { disabled: currentPage === totalPages, icon: 'next' });
  }
  function render() {
    const start = (currentPage - 1) * pageSize;
    const visible = filtered.slice(start, start + pageSize);
    tbody.innerHTML = visible.map(record => `<tr class="evaluation-status--${statusClass[record.health]}">
      <td>${record.date}</td><td>${cell(record.vin, 'evaluation-vin')}</td><td>${record.type}</td>
      <td><span class="evaluation-score metric-number">${record.score.toFixed(1)}</span></td><td>${badge(record)}</td>
      <td>${record.city}</td><td>${record.category}</td><td>${cell(record.brand)}</td><td>${cell(record.model)}</td>
      <td>${hazardTags(record)}</td><td><span class="evaluation-battery-score">${record.battery}</span></td>
      <td class="evaluation-operation"><button class="evaluation-detail-link" type="button" data-evaluation-id="${record.id}" aria-label="查看 ${record.vin} 的评估详情">评估详情</button></td>
    </tr>`).join('');
    document.getElementById('evaluation-empty').hidden = filtered.length > 0;
    document.getElementById('evaluation-summary').textContent = filtered.length
      ? `共 ${filtered.length} 条 · 第 ${start + 1} 至 ${start + visible.length} 条 · 每页 ${pageSize} 条`
      : '共 0 条';
    renderPagination(Math.ceil(filtered.length / pageSize));
    scrollRegion.scrollTop = 0;
  }
  function query() {
    const vin = fields.vin.value.trim().toUpperCase();
    const score = fields.score.value;
    filtered = records.filter(record => record.date === fields.date.value
      && (!vin || record.vin.includes(vin))
      && (score === '' || record.score === Number(score))
      && (fields.health.value === '全部' || record.health === fields.health.value)
      && (!fields.category.value || record.category === fields.category.value)
      && (!fields.brand.value || record.brand === fields.brand.value)
      && (!fields.model.value || record.model === fields.model.value));
    currentPage = 1;
    render();
  }
  form.addEventListener('submit', event => { event.preventDefault(); query(); });
  form.addEventListener('reset', event => {
    event.preventDefault();
    fields.date.value = defaultDate;
    fields.health.value = '高危';
    ['vin', 'score', 'category', 'brand', 'model'].forEach(name => { fields[name].value = ''; });
    updateBrands();
    query();
  });
  pagination.addEventListener('click', event => {
    const button = event.target.closest('button[data-page]');
    if (!button || button.disabled) return;
    const next = Number(button.dataset.page);
    if (next === currentPage || next < 1 || next > Math.ceil(filtered.length / pageSize)) return;
    currentPage = next;
    render();
    pagination.querySelector('[aria-current="page"]')?.focus({ preventScroll: true });
  });
  tbody.addEventListener('click', event => {
    const button = event.target.closest('button[data-evaluation-id]');
    const record = button && recordById.get(button.dataset.evaluationId);
    if (!record) return;
    detailTrigger = button;
    document.getElementById('evaluation-detail-vehicle').textContent = `${record.vin} · ${record.brand} ${record.model} · ${record.city}`;
    const summary = document.getElementById('evaluation-detail-summary');
    summary.className = `evaluation-detail-summary evaluation-status--${statusClass[record.health]}`;
    summary.innerHTML = `<div><dt>评估日期</dt><dd>${record.date}</dd></div>
      <div><dt>健康状态</dt><dd>${badge(record)}</dd></div>
      <div><dt>总分</dt><dd><span class="metric-number evaluation-score">${record.score.toFixed(1)}</span><span>分</span></dd></div>
      <div><dt>电池健康评分</dt><dd><span class="metric-number">${record.battery}</span><span>分</span></dd></div>`;
    // 单项≤1的红色强调沿用原型，仅用于示例展示。
    document.getElementById('evaluation-detail-metrics').innerHTML = record.metrics.map((score, i) =>
      `<article class="evaluation-metric${score <= 1 ? ' evaluation-metric--risk' : ''}"><p>${metricLabels[i]}</p><strong class="metric-number">${score.toFixed(1)}</strong></article>`).join('');
    const danger = document.getElementById('evaluation-detail-danger');
    danger.className = `evaluation-status--${statusClass[record.health]}`;
    danger.innerHTML = hazardTags(record);
    document.getElementById('evaluation-detail-note').textContent = record.hazards.length
      ? `本次评估为${record.health}，判定危险项为${record.hazards.join('、')}。`
      : '本次评估为健康，未判定危险项。';
    dialog.showModal();
  });
  document.getElementById('evaluation-detail-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => detailTrigger?.focus({ preventScroll: true }));
  updateBrands();
  query();
})();

/* ==================== 04 防护预警 · 概览筛选与记录 ====================
 * 数据均为本地UI示例，订单/电站使用显式示例编号与名称。
 * 三档级别互斥；阻断是记录状态，其68次包含在236次预警内。
 */
(() => {
  const form = document.getElementById('warning-form');
  if (!form) return;
  const fields = form.elements;
  const tbody = document.getElementById('warning-table-body');
  const pagination = document.getElementById('warning-pagination');
  const scrollRegion = document.getElementById('warning-table-scroll');
  const cards = [...document.querySelectorAll('[data-warning-filter]')];
  const defaults = { start: '2026-08-08', end: '2026-08-14', order: '', level: '' };
  const pageSize = 10;
  const levelTargets = { 高危预警: 82, 严重预警: 100, 一般预警: 54 };
  const levelUsed = { 高危预警: 0, 严重预警: 0, 一般预警: 0 };
  const levels = Object.keys(levelTargets);
  const levelClass = { 高危预警: 'danger', 严重预警: 'warning', 一般预警: 'normal' };
  const templates = {
    高危预警: [['电池温升异常', '特斯拉 Model Y'], ['高频异常复现', '特斯拉 MODEL Y L']],
    严重预警: [['车辆电池组温度过高', '理想 L7'], ['温度过高主动拦截', '海格 KLQ6650']],
    一般预警: [['BMS通讯波动', 'AITO 问界M5'], ['充电结束压差异常', '沃尔沃 XC70'], ['车辆连接异常', '小米 SU7'], ['BMS通信间歇异常', '吉利银河 L7']]
  };
  const trend = JSON.parse(document.getElementById('safety-trend-data').textContent);
  const records = [];
  const pad = value => String(value).padStart(2, '0');
  // 按时间倒序生成，日记录和阻断次数与看板七天趋势保持一致。
  for (let day = trend.dates.length - 1; day >= 0; day--) {
    const date = `2026-${trend.dates[day].replace('/', '-')}`;
    let blocked = 0;
    for (let i = 0; i < trend.warning[day]; i++) {
      const index = records.length;
      const available = levels.filter(level => levelUsed[level] < levelTargets[level]);
      const level = index < 3 ? levels[index] : available.reduce((best, item) =>
        levelTargets[item] * (index + 1) / 236 - levelUsed[item] > levelTargets[best] * (index + 1) / 236 - levelUsed[best] ? item : best);
      const [type, model] = templates[level][levelUsed[level] % templates[level].length];
      levelUsed[level]++;
      const isBlocked = level !== '一般预警' && blocked < trend.block[day];
      if (isBlocked) blocked++;
      const minutes = 13 * 60 + 50 - Math.max(0, i - 3) * 17;
      const time = i < 3 ? ['18:27:30', '17:19:27', '14:16:29'][i] : `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:${pad(i * 7 % 60)}`;
      const serial = String(i + 1).padStart(3, '0');
      const record = {
        date, time: `${date} ${time}`, order: `DEMO-${date.replaceAll('-', '')}-${serial}`,
        reason: isBlocked ? '主动防护已终止' : i % 3 === 0 ? '预警已恢复' : '持续观察',
        model, station: `示例充电站 ${['A','B','C','D','E','F'][index % 6]}`,
        terminal: index < 3 ? ['025号终端', '003A号终端', '001A号终端'][index] : `${String(i % 36 + 1).padStart(3, '0')}号终端`,
        type, level, blocked: isBlocked
      };
      records.push(record);
    }
  }
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const cell = (value, className = '') => `<span class="evaluation-cell-text ${className}" title="${escape(value)}">${escape(value)}</span>`;
  let applied = { ...defaults };
  let onlyBlocked = false;
  let currentPage = 1;
  let filtered = [];

  function readFilters() {
    fields.end.setCustomValidity(fields.start.value && fields.end.value && fields.start.value > fields.end.value ? '结束日期不能早于开始日期' : '');
    if (!form.reportValidity()) return null;
    return { start: fields.start.value, end: fields.end.value, order: fields.order.value.trim().toUpperCase(), level: fields.level.value };
  }
  [fields.start, fields.end].forEach(field => field.addEventListener('input', () => fields.end.setCustomValidity('')));

  function renderPagination(totalPages) {
    pagination.replaceChildren();
    if (!totalPages) return;
    function addButton(page, label, icon, disabled = false) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'evaluation-page-button';
      button.dataset.page = page;
      button.disabled = disabled;
      button.setAttribute('aria-label', label);
      if (icon) {
        const image = document.createElement('img');
        image.src = `./assets/page-${icon}.svg`;
        image.alt = '';
        button.append(image);
      } else {
        button.textContent = page;
        if (page === currentPage) button.setAttribute('aria-current', 'page');
      }
      pagination.append(button);
    }
    addButton(currentPage - 1, '上一页', 'previous', currentPage === 1);
    const pages = [...new Set([1,totalPages,...Array.from({length:5},(_, i) => currentPage + i - 2)])]
      .filter(page => page >= 1 && page <= totalPages).sort((a,b) => a-b);
    let previous = 0;
    pages.forEach(page => {
      if (previous && page - previous > 1) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'evaluation-page-ellipsis';
        ellipsis.textContent = '…';
        ellipsis.setAttribute('aria-hidden', 'true');
        pagination.append(ellipsis);
      }
      addButton(page, `第${page}页`);
      previous = page;
    });
    addButton(currentPage + 1, '下一页', 'next', currentPage === totalPages);
  }
  function render() {
    const start = (currentPage - 1) * pageSize;
    const visible = filtered.slice(start, start + pageSize);
    tbody.innerHTML = visible.map(record => `<tr>
      <td><time datetime="${record.time.replace(' ', 'T')}">${record.time}</time></td>
      <td>${cell(record.order, 'warning-order')}</td><td>${record.reason}</td><td>${cell(record.model)}</td>
      <td>${cell(record.station)}</td><td>${record.terminal}</td><td>${cell(record.type)}</td>
      <td><span class="state-tag state-tag--${levelClass[record.level]}">${record.level}</span></td>
      <td>${record.blocked ? '<span class="warning-blocked">已阻断</span>' : '<span class="evaluation-muted">否</span>'}</td>
    </tr>`).join('');
    document.getElementById('warning-empty').hidden = filtered.length > 0;
    document.getElementById('warning-summary').textContent = filtered.length
      ? `共 ${filtered.length} 条 · 第 ${start + 1} 至 ${start + visible.length} 条 · 每页 ${pageSize} 条`
      : '共 0 条';
    renderPagination(Math.ceil(filtered.length / pageSize));
    scrollRegion.scrollTop = 0;
  }
  function query() {
    const base = records.filter(record => record.date >= applied.start && record.date <= applied.end && (!applied.order || record.order.includes(applied.order)));
    cards.forEach(card => {
      const filter = card.dataset.warningFilter;
      const count = base.filter(record => filter === 'blocked' ? record.blocked : record.level === filter).length;
      card.querySelector('[data-warning-count]').textContent = count;
      const pressed = filter === 'blocked' ? onlyBlocked : !onlyBlocked && applied.level === filter;
      card.setAttribute('aria-pressed', String(pressed));
    });
    filtered = base.filter(record => (!applied.level || record.level === applied.level) && (!onlyBlocked || record.blocked));
    currentPage = 1;
    render();
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    const values = readFilters();
    if (!values) return;
    applied = values;
    query();
  });
  form.addEventListener('reset', event => {
    event.preventDefault();
    Object.entries(defaults).forEach(([key,value]) => { fields[key].value = value; });
    fields.end.setCustomValidity('');
    applied = { ...defaults };
    onlyBlocked = false;
    query();
  });
  cards.forEach(card => card.addEventListener('click', () => {
    const values = readFilters();
    if (!values) return;
    const filter = card.dataset.warningFilter;
    if (filter === 'blocked') {
      onlyBlocked = !onlyBlocked;
      values.level = '';
    } else {
      values.level = !onlyBlocked && applied.level === filter ? '' : filter;
      onlyBlocked = false;
    }
    fields.level.value = values.level;
    applied = values;
    query();
  }));
  pagination.addEventListener('click', event => {
    const button = event.target.closest('button[data-page]');
    if (!button || button.disabled) return;
    const next = Number(button.dataset.page);
    if (next < 1 || next === currentPage || next > Math.ceil(filtered.length / pageSize)) return;
    currentPage = next;
    render();
    pagination.querySelector('[aria-current="page"]')?.focus({ preventScroll: true });
  });
  query();
})();
