"use strict";

(() => {
  // 单站分析快照；当前展示已生成、已复盘的 Demo。推荐价格为示例输入，前端只计算展示差值。
  const snapshot = {
    baseOpportunity: 2,
    demandAdjustment: 0,
    periods: [
      { from: "00:00", to: "03:00", hours: 3, current: 0.30, recommended: 0.30 },
      { from: "03:00", to: "06:00", hours: 3, current: 0.30, recommended: 0.31 },
      { from: "06:00", to: "09:00", hours: 3, current: 0.30, recommended: 0.28 },
      { from: "09:00", to: "18:00", hours: 9, current: 0.30, recommended: 0.33 },
      { from: "18:00", to: "24:00", hours: 6, current: 0.30, recommended: 0.29 }
    ]
  };
  const timeline = document.getElementById("price-timeline");
  // 涨、跌分别按当前数据中的最大绝对幅度归一化，最大值使用规范最深色。
  const deltas = snapshot.periods.map(period => Number((period.recommended - period.current).toFixed(2)));
  const maxIncrease = Math.max(0, ...deltas);
  const maxDecrease = Math.max(0, ...deltas.map(delta => -delta));
  const adjustmentColor = delta => {
    const maximum = delta > 0 ? maxIncrease : maxDecrease;
    const ratio = maximum ? Math.min(1, Math.abs(delta) / maximum) : 0;
    const base = delta > 0 ? [226, 24, 24] : [5, 179, 127];
    const whiteMix = 0.72 * (1 - ratio);
    return `rgb(${base.map(channel => Math.round(channel + (255 - channel) * whiteMix)).join(", ")})`;
  };
  document.querySelectorAll(".timeline-legend .swatch:not(.hold)").forEach(swatch => {
    const label = swatch.parentElement.textContent.replace("−", "-");
    const delta = Number.parseFloat(label);
    if (Number.isFinite(delta) && delta !== 0) swatch.style.setProperty("--adjustment-color", adjustmentColor(delta));
  });
  snapshot.periods.forEach(period => {
    const delta = Number((period.recommended - period.current).toFixed(2));
    const label = delta === 0 ? "维持现价" : `${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(2)}`;
    const segment = document.createElement("div");
    const tone = delta === 0 ? "hold" : `${delta < 0 ? "decrease" : "level"}${Math.min(3, Math.max(1, Math.round(Math.abs(delta) * 100)))}`;
    segment.className = `time-segment ${tone}`;
    if (delta !== 0) segment.style.setProperty("--adjustment-color", adjustmentColor(delta));
    segment.style.flex = String(period.hours);
    const value = document.createElement("span");
    value.className = "time-segment__value";
    value.textContent = label;
    segment.append(value);
    segment.title = `${period.from} 至 ${period.to}：${period.current.toFixed(2)} → ${period.recommended.toFixed(2)} 元/度`;
    segment.setAttribute("aria-label", segment.title);
    timeline.append(segment);
  });
  const toggle = document.getElementById("toggle-unchanged");
  const extra = document.getElementById("unchanged-period");
  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(expanded));
    extra.hidden = !expanded;
    document.getElementById("toggle-visibility-icon").src = expanded ? "./assets/toggle-eye-off.svg" : "./assets/toggle-eye.svg";
    document.getElementById("toggle-caption").textContent = expanded ? "隐藏保持现价时段" : "显示保持现价时段";
  });

})();

// 完成态示例：累计效果指数，图表库随本 Demo 本地交付。
(() => {
  const element = document.getElementById("completed-review-chart");
  if (!element || !window.echarts) return;
  const chart = echarts.init(element);
  const series = [
    { name: "充电量", color: "#05B37F", data: [104, 106, 108, 109, 111, 113, 114.1] },
    { name: "充电用户", color: "#315EEF", data: [102, 104, 105, 108, 109, 110, 112] },
    { name: "服务费收入", color: "#8B5CF6", data: [110, 112, 114, 116, 118, 120, 121.7] },
    { name: "评估基准", color: "#98A2B3", data: [100, 100, 100, 100, 100, 100, 100], baseline: true }
  ];
  chart.setOption({
    animationDuration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 450,
    textStyle: { fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif' },
    grid: { top: 16, left: 8, right: 16, bottom: 62, containLabel: true },
    tooltip: {
      trigger: "axis", confine: true, enterable: false, hideDelay: 0,
      backgroundColor: "#fff", borderColor: "#E6EBF2", padding: [10, 12],
      textStyle: { color: "#344054", fontSize: 12 },
      axisPointer: { type: "line", lineStyle: { color: "#CBD5E1", type: "dashed" } },
      formatter: params => {
        const date = params[0]?.axisValueLabel || "";
        return `<div style="font-weight:600;margin-bottom:6px">${date} · 累计效果指数</div>`
          + params.map(item => `<div style="display:flex;justify-content:space-between;gap:20px">${item.marker}<span style="flex:1">${item.seriesName}</span><strong>${Number(item.value).toFixed(1)}</strong></div>`).join("")
          + '<div style="margin-top:6px;color:#667085">截至当日累计值与同期累计基准的比值，基准=100</div>';
      },
      extraCssText: "border-radius:10px;box-shadow:0 6px 20px rgba(15,23,42,.08);"
    },
    legend: { bottom: 0, itemWidth: 18, itemHeight: 8, itemGap: 14,
      textStyle: { fontSize: 12, color: "#667085" } },
    xAxis: { type: "category", boundaryGap: false,
      data: ["10/14", "10/15", "10/16", "10/17", "10/18", "10/19", "10/20"],
      axisLine: { lineStyle: { color: "#E6EBF2" } }, axisTick: { show: false },
      axisLabel: { color: "#667085", fontSize: 12, margin: 12, hideOverlap: true } },
    yAxis: { type: "value", min: 90, max: 130, interval: 10,
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: "#667085", fontSize: 12 },
      splitLine: { lineStyle: { color: "#EDF0F5" } } },
    series: series.map(item => ({
      name: item.name, type: "line", data: item.data,
      symbol: "circle", symbolSize: 5, showSymbol: !item.baseline,
      itemStyle: { color: "#fff", borderColor: item.color, borderWidth: 2 },
      lineStyle: { color: item.color, width: item.baseline ? 1.5 : 3, type: item.baseline ? "dashed" : "solid" },
      emphasis: { focus: "series" }
    }))
  });
  const observer = new ResizeObserver(() => chart.resize());
  observer.observe(element);
  window.addEventListener("pagehide", event => {
    // 后退缓存保留现有实例，避免返回本页时图表消失。
    if (!event.persisted) { observer.disconnect(); chart.dispose(); }
  });
  window.addEventListener("pageshow", event => { if (event.persisted) chart.resize(); });
})();

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
  new ResizeObserver(scheduleUpdate).observe(document.querySelector('.event-canvas'));
  const initial = getRows().flatMap(row => row.items).find(item => item.link.hash === location.hash);
  if (initial) requestAnimationFrame(() => navigateTo(initial, false, false));
  else updateFromScroll();
})();

