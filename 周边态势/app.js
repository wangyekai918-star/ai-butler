"use strict";

(() => {
  // 图表数值来自用户 2026-10-13 提供的截图，不读取旧 HTML 原型。
  // 得分为图内可见数值；横坐标按截图刻度近似还原，气泡尺寸按图示比例。
  // 竞品名称及悬浮明细按用户要求使用虚拟数据，仅用于 UI 演示。
  // 截图自身的「气泡65分 / 文字58分」暂时按原图保留；排行榜属于上一轮独立示例。
  const screenshotPoints = [
    { id: "peer-01", price: 0.64, score: 68, status: "decrease", diameter: 42 },
    { id: "peer-02", price: 0.77, score: 72, status: "normal", diameter: 34 },
    { id: "peer-03", price: 0.88, score: 78, status: "decrease", diameter: 44 },
    { id: "self", price: 1.02, score: 65, status: "self", diameter: 54 },
    { id: "peer-04", price: 1.14, score: 55, status: "normal", diameter: 34 },
    { id: "peer-05", price: 1.22, score: 67, status: "increase", diameter: 38 },
    { id: "peer-06", price: 1.38, score: 62, status: "newStation", diameter: 42 },
    { id: "peer-07", price: 0.58, score: 38, status: "normal", diameter: 32 },
    { id: "peer-08", price: 0.68, score: 28, status: "increase", diameter: 38 },
    { id: "peer-09", price: 0.81, score: 35, status: "normal", diameter: 36 },
    { id: "peer-10", price: 0.92, score: 25, status: "newStation", diameter: 36 },
    { id: "peer-11", price: 1.17, score: 42, status: "decrease", diameter: 36 },
    { id: "peer-12", price: 1.37, score: 43, status: "normal", diameter: 40 },
    { id: "peer-13", price: 1.49, score: 33, status: "normal", diameter: 32 }
  ];
  const states = {
    self: { label: "本站", color: "#315eef", lightColor: "#87a7ff" },
    decrease: { label: "降价", color: "#05b37f", lightColor: "#73d9b9" },
    increase: { label: "涨价", color: "#e34c4c", lightColor: "#ff9d9d" },
    newStation: { label: "新站", color: "#9852ef", lightColor: "#c28aff" },
    normal: { label: "正常", color: "#98a2b3", lightColor: "#c4cbd6" }
  };
  const chartElement = document.getElementById("strategy-chart");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const currentStationName = document.querySelector(".scope-control__label")?.textContent.trim() || "本站";
  // 仅用于 UI 演示，不代表真实场站或截图中的站点对应关系。
  const demoStationNames = {
    "peer-01": "云杉路充电站",
    "peer-02": "星河广场充电站",
    "peer-03": "青岚科技园充电站",
    "peer-04": "锦程大道充电站",
    "peer-05": "望湖中心充电站",
    "peer-06": "云栖公园充电站",
    "peer-07": "新桥社区充电站",
    "peer-08": "晨光路充电站",
    "peer-09": "绿洲商务园充电站",
    "peer-10": "知行路充电站",
    "peer-11": "悦湖广场充电站",
    "peer-12": "银杏路充电站",
    "peer-13": "和悦社区充电站"
  };
  // 悬浮字段依据 PRD《018AI管家周边态势竞争力分析》2026-10-13 在线正文。
  // 用户授权补齐的虚拟明细；不代表真实业务数据。
  const demoStationDetails = {
    "peer-01": { distanceKm: 0.6, terminalTypes: { ultra: 4, fast: 20, slow: 4 }, previousPrice: 0.72, changeDate: "10-12" },
    "peer-02": { distanceKm: 1.2, terminalTypes: { ultra: 2, fast: 12, slow: 4 }, previousPrice: 0.80, changeDate: "09-18" },
    "peer-03": { distanceKm: 2.1, terminalTypes: { ultra: 6, fast: 20, slow: 4 }, previousPrice: 0.96, changeDate: "10-11" },
    "self": { distanceKm: 0, terminalTypes: { ultra: 8, fast: 32, slow: 6 }, previousPrice: 1.08, changeDate: "09-26" },
    "peer-04": { distanceKm: 0.9, terminalTypes: { ultra: 2, fast: 16, slow: 0 }, previousPrice: 1.20, changeDate: "09-20" },
    "peer-05": { distanceKm: 1.7, terminalTypes: { ultra: 4, fast: 16, slow: 2 }, previousPrice: 1.12, changeDate: "10-12" },
    "peer-06": { distanceKm: 2.6, terminalTypes: { ultra: 6, fast: 20, slow: 2 }, openedDate: "10-10" },
    "peer-07": { distanceKm: 0.4, terminalTypes: { ultra: 0, fast: 12, slow: 4 }, previousPrice: 0.62, changeDate: "09-15" },
    "peer-08": { distanceKm: 1.4, terminalTypes: { ultra: 2, fast: 16, slow: 4 }, previousPrice: 0.60, changeDate: "10-11" },
    "peer-09": { distanceKm: 2.3, terminalTypes: { ultra: 4, fast: 16, slow: 0 }, previousPrice: 0.85, changeDate: "09-22" },
    "peer-10": { distanceKm: 0.8, terminalTypes: { ultra: 4, fast: 16, slow: 0 }, openedDate: "10-13" },
    "peer-11": { distanceKm: 1.9, terminalTypes: { ultra: 2, fast: 16, slow: 2 }, previousPrice: 1.25, changeDate: "10-13" },
    "peer-12": { distanceKm: 2.8, terminalTypes: { ultra: 4, fast: 18, slow: 3 }, previousPrice: 1.40, changeDate: "09-16" },
    "peer-13": { distanceKm: 2.5, terminalTypes: { ultra: 0, fast: 12, slow: 4 }, previousPrice: 1.45, changeDate: "09-24" }
  };
  const stations = screenshotPoints.map(point => {
    const detail = demoStationDetails[point.id];
    return {
      ...point,
      name: point.status === "self" ? currentStationName : demoStationNames[point.id],
      distanceKm: detail.distanceKm,
      terminalTypes: detail.terminalTypes,
      terminals: Object.values(detail.terminalTypes).reduce((total, count) => total + count, 0),
      latestPriceChange: detail.openedDate
        ? { note: `${detail.openedDate} 上线，暂无调价` }
        : { from: detail.previousPrice, to: point.price, date: detail.changeDate },
      rankByRadius: {},
      priceIsApproximate: true
    };
  });
  // 排名仅针对本组虚拟样本，按距离筛选后以得分降序计算。
  [1, 3, 5].forEach(radius => {
    const ranked = stations.filter(station => station.distanceKm <= radius)
      .sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm);
    ranked.forEach((station, index) => {
      station.rankByRadius[radius] = { position: index + 1, total: ranked.length };
    });
  });

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  }

  function showTooltip(params) {
    const point = params.data;
    if (!point || !point.status) return "";
    const state = states[point.status];
    const scopeText = document.querySelectorAll(".scope-control__label")[1]?.textContent || "附近3km";
    const radius = Number(scopeText.match(/(1|3|5)\s*km/i)?.[1] || 3);
    const rank = point.rankByRadius?.[radius];
    const missing = '<span class="strategy-tooltip__missing">—</span>';
    const terminalParts = [["ultra", "超"], ["fast", "快"], ["slow", "慢"]]
      .filter(([key]) => Number.isFinite(point.terminalTypes?.[key]) && point.terminalTypes[key] > 0)
      .map(([key, label]) => `${point.terminalTypes[key]}${label}`);
    const terminals = Number.isFinite(point.terminals)
      ? `${point.terminals}${terminalParts.length ? `<span class="strategy-tooltip__breakdown">（${terminalParts.join("/")}）</span>` : ""}`
      : missing;
    const change = point.latestPriceChange;
    let latestPriceChange = change?.note ? escapeHtml(change.note) : missing;
    if (Number.isFinite(change?.from) && Number.isFinite(change?.to)) {
      const direction = change.to < change.from ? "decrease" : change.to > change.from ? "increase" : "normal";
      latestPriceChange = `${change.date ? `<span class="strategy-tooltip__date">${escapeHtml(change.date)}</span>` : ""}<span class="strategy-tooltip__change" style="color:${states[direction].color}">${change.from.toFixed(2)} → ${change.to.toFixed(2)}<span class="strategy-tooltip__unit"> 元/kWh</span></span>`;
    }
    const rows = [
      ["距离", Number.isFinite(point.distanceKm) ? `${point.distanceKm}<span class="strategy-tooltip__unit">km</span>` : missing],
      ["终端", terminals],
      ["平均价格", `${point.priceIsApproximate ? "约 " : ""}¥${point.value[0].toFixed(2)}<span class="strategy-tooltip__unit">/kWh</span>`],
      ["最新一次价格变动", latestPriceChange],
      ["综合得分", `${point.value[1]}<span class="strategy-tooltip__unit">分</span>`, "strategy-tooltip__score"],
      [`${radius}km内排名`, Number.isInteger(rank?.position) && Number.isInteger(rank?.total) && rank.position > 0 && rank.position <= rank.total ? `第${rank.position}名 / ${rank.total}站` : missing]
    ];
    // PRD 标明雷达对标入口“暂时先不做”，不显示无效的可点击入口。
    return `<div class="strategy-tooltip"><div class="strategy-tooltip__header"><strong class="strategy-tooltip__title">${escapeHtml(point.name || "周边场站")}</strong><span class="strategy-tooltip__badge" style="--status-color:${state.color}">${state.label}</span></div><dl>${rows.map(([label, value, className = ""]) => `<dt>${label}</dt><dd class="${className}">${value}</dd>`).join("")}</dl></div>`;
  }

  function tooltipPosition(position, params, element, rect, size) {
    const [width, height] = size.contentSize;
    const [viewWidth, viewHeight] = size.viewSize;
    const right = (rect ? rect.x + rect.width : position[0]) + 12;
    const left = (rect ? rect.x : position[0]) - width - 12;
    const x = right + width <= viewWidth - 8 ? right : left;
    return [Math.max(8, Math.min(x, viewWidth - width - 8)), Math.max(8, Math.min(position[1] - height / 2, viewHeight - height - 8))];
  }

  function strategyTooltipPosition(position, params, element, rect, size) {
    if (!strategyChart || !params.data?.value) return tooltipPosition(position, params, element, rect, size);
    // 锚定数据坐标，避免命中的圆形/文字边界及悬停放大动画改变避让方向。
    const [centerX, centerY] = strategyChart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, params.data.value);
    const radius = params.data.symbolSize * 1.12 / 2;
    const [width, height] = size.contentSize;
    const [viewWidth, viewHeight] = size.viewSize;
    const right = centerX + radius + 12;
    const left = centerX - radius - width - 12;
    const x = right + width <= viewWidth - 8 ? right : left;
    return [Math.max(8, Math.min(x, viewWidth - width - 8)), Math.max(8, Math.min(centerY - height / 2, viewHeight - height - 8))];
  }

  function bubbleDiameter(point) {
    const scale = Math.min(1, Math.max(0.78, chartElement.clientWidth / 650));
    // 接入真实终端数量后，面积随终端数增加；缺失时保留截图中的示意尺寸。
    const size = Number.isFinite(point.terminals)
      ? Math.min(62, Math.max(26, Math.sqrt(point.terminals) * 8))
      : point.diameter;
    return point.status === "self" ? Math.max(54, size * scale) : size * scale;
  }

  function chartOption() {
    const series = Object.entries(states).map(([key, state]) => ({
      id: `stations-${key}`,
      name: state.label,
      type: "scatter",
      data: stations.filter(point => point.status === key).map(point => ({
        ...point,
        value: [point.price, point.score],
        symbolSize: bubbleDiameter(point)
      })),
      symbol: "circle",
      itemStyle: {
        color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: state.lightColor }, { offset: 1, color: state.color }] },
        opacity: 1, borderColor: "#fff", borderWidth: 2
      },
      label: key === "self" ? {
        show: true, position: "inside", formatter: params => `{station|本站}\n{score|${params.value[1]}}`,
        rich: {
          station: { color: "#fff", fontSize: 11, fontWeight: 600, fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif', lineHeight: 14, align: "center" },
          score: { color: "#fff", fontSize: 22, fontWeight: 600, fontFamily: "Oswald, sans-serif", lineHeight: 24, align: "center" }
        }
      } : { show: true, position: "inside", formatter: params => String(params.value[1]), color: "#fff", fontSize: 13, fontWeight: 600, fontFamily: "Oswald, sans-serif" },
      emphasis: { focus: "self", blurScope: "coordinateSystem", scale: 1.12, itemStyle: { opacity: 1, borderWidth: 2, shadowBlur: 8, shadowColor: "rgba(17,24,39,.12)" } },
      blur: { itemStyle: { opacity: 0.22 }, label: { opacity: 0.3 } },
      // ECharts 的 markLine 默认层级为 5，气泡置于其上并保持不透明。
      z: key === "self" ? 11 : 10
    }));
    return {
      animation: !reduceMotion,
      animationDuration: 400,
      animationDurationUpdate: 180,
      textStyle: { fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif' },
      grid: { top: 34, right: 16, bottom: 52, left: 36 },
      tooltip: { trigger: "item", confine: true, enterable: false, hideDelay: 0, transitionDuration: 0, position: strategyTooltipPosition, formatter: showTooltip, backgroundColor: "#fff", borderColor: "#e6ebf2", borderWidth: 1, padding: 16, extraCssText: "pointer-events:none;border-radius:14px;box-shadow:0 6px 24px rgba(17,24,39,.1);" },
      xAxis: {
        type: "value", min: 0.4, max: 1.6, interval: 0.2,
        name: "平均价格（元/kWh）", nameLocation: "middle", nameGap: 32,
        nameTextStyle: { color: "#667085", fontSize: 12 },
        axisLine: { show: true, lineStyle: { color: "#d8e0ec" } },
        axisTick: { show: false }, splitLine: { show: false },
        axisLabel: { color: "#98a2b3", fontSize: 12, margin: 10, formatter: value => value.toFixed(1) }
      },
      yAxis: {
        type: "value", min: 0, max: 100, interval: 20,
        name: "竞争力得分", nameLocation: "end", nameGap: 16,
        nameTextStyle: { align: "left", color: "#667085", fontSize: 12 },
        axisLine: { show: true, lineStyle: { color: "#d8e0ec" } },
        axisTick: { show: false }, splitLine: { show: false },
        axisLabel: { color: "#98a2b3", fontSize: 12, margin: 10 }
      },
      series: [
        {
          id: "quadrants", type: "scatter", data: [], silent: true, z: 0,
          markArea: {
            silent: true, z: 0,
            blur: { itemStyle: { opacity: 1 }, label: { opacity: 1 } },
            label: { show: true, fontSize: 14, fontWeight: 600, distance: 10 },
            data: [
              [{ name: "黄金区 · 低价高分", xAxis: 0.4, yAxis: 50, itemStyle: { color: "rgba(5,179,127,.065)" }, label: { color: "#05a777", position: "insideTopLeft" } }, { xAxis: 1, yAxis: 100 }],
              [{ name: "差异化 · 高价高分", xAxis: 1, yAxis: 50, itemStyle: { color: "rgba(49,94,239,.055)" }, label: { color: "#315eef", position: "insideTopRight" } }, { xAxis: 1.6, yAxis: 100 }],
              [{ name: "搅局区 · 低价低分", xAxis: 0.4, yAxis: 0, itemStyle: { color: "rgba(226,24,24,.04)" }, label: { color: "#df554c", position: "insideBottomLeft" } }, { xAxis: 1, yAxis: 50 }],
              [{ name: "观望区 · 高价低分", xAxis: 1, yAxis: 0, itemStyle: { color: "rgba(239,178,36,.085)" }, label: { color: "#bc8b14", position: "insideBottomRight" } }, { xAxis: 1.6, yAxis: 50 }]
            ]
          },
          markLine: { silent: true, z: 1, symbol: "none", label: { show: false }, blur: { lineStyle: { opacity: 1 } }, lineStyle: { color: "#d2dce8", width: 1, type: "dashed" }, data: [{ xAxis: 1 }, { yAxis: 50 }] }
        },
        ...series
      ]
    };
  }

  let strategyChart;
  if (chartElement && window.echarts) {
    const chart = strategyChart = window.echarts.init(chartElement, null, { renderer: "svg" });
    chart.setOption(chartOption());
    const resetHighlight = () => {
      chart.dispatchAction({ type: "hideTip" });
      chart.dispatchAction({ type: "downplay" });
    };
    // 悬浮卡仅展示信息，不接收鼠标；离开气泡立即关闭，避免遮挡相邻场站。
    chart.on("mouseout", resetHighlight);
    chartElement.addEventListener("pointerleave", resetHighlight);
    chart.on("globalout", resetHighlight);
    let frame;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!chartElement.clientWidth || chart.isDisposed()) return;
        chart.resize();
        chart.setOption(chartOption());
      });
    });
    observer.observe(chartElement);
    document.fonts.ready.then(() => {
      if (!chart.isDisposed()) chart.resize();
    });
    window.addEventListener("pagehide", () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      chartElement.removeEventListener("pointerleave", resetHighlight);
      chart.dispose();
    }, { once: true });
  } else if (chartElement) {
    chartElement.classList.add("chart-unavailable");
    chartElement.textContent = "图表暂未加载，请刷新页面重试";
  }

  // ==================== 02 格局变化：数据口径与每日排名 ====================
  // 规则依据在线 PRD 第 3 节。用户确认以现有排行榜站点为准：
  // 前 7 站的名称、最新分数、距离直接读取排行榜，避免两处维护产生偏差。
  // 逐日得分、价格事件、终端明细及未展开的其余 5 站均为 UI 演示样本，非真实业务数据。
  // 历史日期固定为 2026-10-07 至 2026-10-13，不随访问日期滚动，以便开发核对。
  const trendDates = ["10-07", "10-08", "10-09", "10-10", "10-11", "10-12", "10-13"];
  const trendFixtures = [
    { history: [97, 97, 99, 100, 100, 100], price: 0.80, terminals: { ultra: 4, fast: 16, slow: 0 } },
    { history: [98, 98, 96, 95, 95, 94], price: 0.82, terminals: { ultra: 2, fast: 12, slow: 4 } },
    { history: [null, null, null, null, null, null], price: 0.79, terminals: { ultra: 4, fast: 8, slow: 0 } },
    { history: [84, 84, 86, 86, 86, 85], price: 0.81, terminals: { ultra: 0, fast: 12, slow: 4 } },
    { history: [86, 86, 87, 87, 85, 84], price: 0.80, terminals: { ultra: 6, fast: 20, slow: 4 } },
    { history: [78, 78, 78, 78, 78, 77], price: 0.83, terminals: { ultra: 0, fast: 14, slow: 0 } },
    { history: [53, 53, 53, 53, 53, 52], price: 0.85, terminals: { ultra: 0, fast: 8, slow: 2 } }
  ];
  const trendStations = Array.from(document.querySelectorAll(".rank-item"), (row, index) => {
    const fixture = trendFixtures[index];
    const isSelf = row.classList.contains("rank-item--current");
    const latestScore = parseFloat(row.querySelector(".rank-score").textContent);
    return {
      id: isSelf ? "self" : `rank-${index + 1}`,
      name: row.querySelector(".rank-station").textContent.trim(),
      isSelf,
      distanceKm: isSelf ? 0 : parseFloat(row.querySelector(".rank-distance").textContent),
      scores: [...fixture.history, latestScore],
      initialPrice: fixture.price,
      capacityKw: [96, 88, 72, 76, 80, 68, 62][index],
      terminalTypes: fixture.terminals,
      events: []
    };
  });
  const extraTrendStations = [
    { name: "云杉路充电站", distanceKm: 2.8, scores: [51, 51, 52, 52, 52, 51, 51], initialPrice: 0.88 },
    { name: "星河广场充电站", distanceKm: 1.4, scores: [50, 50, 50, 50, 50, 50, 50], initialPrice: 0.82 },
    { name: "青岚科技园充电站", distanceKm: 2.5, scores: [48, 48, 49, 49, 48, 48, 48], initialPrice: 0.89 },
    { name: "锦程大道充电站", distanceKm: 0.6, scores: [47, 47, 47, 47, 47, 46, 46], initialPrice: 0.84 },
    { name: "望湖中心充电站", distanceKm: 2.7, scores: [44, 44, 45, 45, 45, 44, 44], initialPrice: 0.86 }
  ];
  extraTrendStations.forEach((station, index) => trendStations.push({
    ...station, id: `extra-${index + 1}`, isSelf: false, capacityKw: 60 + index * 4,
    terminalTypes: { ultra: 0, fast: 8 + index * 2, slow: index % 2 ? 2 : 0 }, events: []
  }));
  const trendEvents = [
    { stationId: "rank-1", day: 1, status: "decrease", from: 0.80, to: 0.76 },
    { stationId: "rank-2", day: 1, status: "decrease", from: 0.82, to: 0.79 },
    { stationId: "self", day: 2, status: "decrease", from: 0.80, to: 0.78 },
    { stationId: "rank-2", day: 4, status: "increase", from: 0.79, to: 0.85 },
    { stationId: "rank-3", day: 6, status: "newStation" }
  ];
  const trendById = new Map(trendStations.map(station => [station.id, station]));
  trendEvents.forEach(event => trendById.get(event.stationId)?.events.push(event));
  const dailyRankings = trendDates.map((date, day) => trendStations
    .filter(station => Number.isFinite(station.scores[day]))
    .slice().sort((a, b) => b.scores[day] - a.scores[day] || a.id.localeCompare(b.id)));
  trendStations.forEach(station => {
    station.ranks = dailyRankings.map(ranking => {
      const index = ranking.findIndex(item => item.id === station.id);
      return index < 0 ? null : index + 1;
    });
  });
  const latestDay = trendDates.length - 1;
  const trendColors = { normal: "#315eef", decrease: "#05b37f", increase: "#e34c4c", newStation: "#9852ef" };
  let trendMode = "rank";
  let trendChart;
  let trendSeries = [];
  let trendHitPaths = [];
  const trendHitRadius = 12; // 曲线上下各约 12px，视觉线宽不变。
  let highlightedStation = null;
  let trendHighlightFrame = 0;
  const trendVisualStates = new Map();
  const trendElement = document.getElementById("trend-chart");

  function selectTrendStations(mode) {
    const ranking = dailyRankings[latestDay];
    if (ranking.length <= 8) return ranking;
    const self = ranking.find(station => station.isSelf);
    if (mode === "distance") {
      return [self, ...ranking.filter(station => !station.isSelf)
        .sort((a, b) => a.distanceKm - b.distanceKm || a.ranks[latestDay] - b.ranks[latestDay]).slice(0, 7)]
        .sort((a, b) => a.ranks[latestDay] - b.ranks[latestDay]);
    }
    // 与排行榜名次段一致；末段不足 8 站时只展示该段，不混入上一段。
    const start = Math.floor((self.ranks[latestDay] - 1) / 8) * 8;
    return ranking.slice(start, start + 8);
  }

  function trendStatus(station, day) {
    return station.events.filter(event => event.day <= day).at(-1)?.status || "normal";
  }

  function trendPrice(station, day) {
    return station.events.filter(event => event.day <= day && Number.isFinite(event.to)).at(-1)?.to ?? station.initialPrice;
  }

  function showTrendTooltip(params) {
    const stationId = params.data?.stationId || trendSeries.find(series => series.id === params.seriesId)?.stationId || trendSeries[params.seriesIndex]?.stationId;
    const station = trendById.get(stationId);
    if (!station) return "";
    // 悬浮卡描述整条场站曲线：始终展示最新指标，不随指针所在日期变化。
    const status = trendStatus(station, latestDay);
    const terminalParts = [["ultra", "超"], ["fast", "快"], ["slow", "慢"]]
      .filter(([key]) => station.terminalTypes[key] > 0)
      .map(([key, label]) => `${station.terminalTypes[key]}${label}`);
    const terminalTotal = Object.values(station.terminalTypes).reduce((sum, value) => sum + value, 0);
    const firstRank = station.ranks[0];
    const lastRank = station.ranks[latestDay];
    const change = firstRank === null ? null : lastRank - firstRank;
    const changeColor = change === null ? trendColors.newStation : change > 0 ? "#e21818" : change < 0 ? "#05b37f" : "#667085";
    const rankTrend = firstRank === null ? `新站上线 · 第${lastRank}名` : `第${firstRank} → 第${lastRank}名${change > 0 ? `（▼${change}）` : change < 0 ? `（▲${-change}）` : "（持平）"}`;
    const rows = [
      ["终端", `${terminalTotal}（${terminalParts.join("/")}）`],
      ["平均价格", `¥${trendPrice(station, latestDay).toFixed(2)}/kWh`],
      ["单桩运能", `${station.capacityKw}kW`],
      ["综合得分", `${station.scores[latestDay]}分`],
      ["7天走势", `<span style="color:${changeColor}">${rankTrend}</span>`]
    ];
    return `<div class="strategy-tooltip trend-tooltip"><div class="strategy-tooltip__header"><strong class="strategy-tooltip__title">${station.isSelf ? "本站·" : ""}${escapeHtml(station.name)}</strong><span class="strategy-tooltip__badge" style="--status-color:${station.isSelf ? trendColors.normal : trendColors[status]}">${station.isSelf ? "本站" : states[status].label}</span></div><dl>${rows.map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join("")}</dl></div>`;
  }

  // 事件标签自动分行：共享日期的事件共用竖线，避免标签互相叠压。
  function trendEventLayout(selected, width, left, right) {
    const selectedIds = new Set(selected.map(station => station.id));
    const events = trendEvents.filter(event => selectedIds.has(event.stationId));
    const laneEnds = [];
    const labels = events.map(event => {
      const station = trendById.get(event.stationId);
      const shortName = station.isSelf ? "本站" : station.name.replace(/充电站.*$/, "");
      const text = event.status === "newStation" ? `${shortName}上线` : `${shortName}${states[event.status].label} ${event.from.toFixed(2)}→${event.to.toFixed(2)}元`;
      const labelWidth = Array.from(text).reduce((sum, char) => sum + (/[^\x00-\xff]/.test(char) ? 12 : 6.8), 20);
      const anchorX = left + (width - left - right) * event.day / latestDay;
      const labelX = Math.max(left, Math.min(anchorX - labelWidth / 2, width - right + 12 - labelWidth));
      let lane = laneEnds.findIndex(end => labelX >= end + 8);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = labelX + labelWidth;
      return { ...event, text, labelWidth, labelX, anchorX, lane };
    });
    return { labels, top: Math.max(66, laneEnds.length * 32 + 28) };
  }

  function buildTrendOption(selected) {
    const width = trendElement.clientWidth;
    const left = 46;
    const right = 190;
    const { labels, top } = trendEventLayout(selected, width, left, right);
    const allRanks = selected.flatMap(station => station.ranks.filter(Number.isFinite));
    const minRank = Math.min(...allRanks);
    const maxRank = Math.max(...allRanks);
    const height = top + Math.max(294, (maxRank - minRank) * 40) + 40;
    trendElement.style.height = `${height}px`;
    const series = [];
    selected.forEach(station => {
      const firstDay = station.ranks.findIndex(Number.isFinite);
      const breaks = [firstDay, ...station.events.map(event => event.day).filter(day => day > firstDay), latestDay];
      [...new Set(breaks)].forEach((start, index, days) => {
        const end = days[index + 1];
        if (end === undefined) return;
        const color = trendColors[trendStatus(station, start)];
        series.push({
          id: `${station.id}-segment-${index}`, stationId: station.id, name: station.name,
          type: "line", triggerLineEvent: true, showSymbol: false, symbol: "none", smooth: false,
          data: Array.from({ length: end - start + 1 }, (_, offset) => ({
            value: [start + offset, station.ranks[start + offset]], stationId: station.id, day: start + offset
          })),
          lineStyle: { color, width: station.isSelf ? 3.5 : 2.5, opacity: 1, cap: "round", join: "round" },
          itemStyle: { color }, emphasis: { disabled: true }, z: station.isSelf ? 6 : 4
        });
      });
      const latestColor = trendColors[trendStatus(station, latestDay)];
      const name = station.name.length > 11 ? `${station.name.slice(0, 10)}…` : station.name;
      series.push({
        id: `${station.id}-nodes`, stationId: station.id, name: station.name, type: "scatter",
        symbol: "circle", symbolSize: station.isSelf ? 9 : 7,
        data: station.ranks.flatMap((rank, day) => rank === null ? [] : [{
          value: [day, rank], stationId: station.id, day,
          symbolSize: day === latestDay ? (station.isSelf ? 12 : 10) : (station.isSelf ? 9 : 7),
          itemStyle: { color: trendColors[trendStatus(station, day)], borderWidth: 2, borderColor: "#fff" },
          label: day === latestDay ? {
            show: true, position: "right", distance: 10,
            formatter: `{station|${name}}\n${station.isSelf ? "{meta|本站 · }" : `{meta|${station.distanceKm}km · }`}{score|${station.scores[latestDay]}分}`,
            rich: {
              station: { color: station.isSelf ? "#315eef" : "#344054", fontSize: 13, fontWeight: 600, lineHeight: 19 },
              meta: { color: "#98a2b3", fontSize: 11, fontWeight: 400, lineHeight: 17 },
              score: { color: latestColor, fontSize: 11, fontWeight: 600, fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif', lineHeight: 17 }
            }
          } : { show: false }
        }]),
        itemStyle: { opacity: 1 }, emphasis: { disabled: true }, z: 8
      });
    });
    trendSeries = series;
    const graphic = [];
    const eventDays = [...new Set(labels.map(event => event.day))];
    eventDays.forEach(day => {
      const sameDay = labels.filter(event => event.day === day);
      const label = sameDay.reduce((lower, item) => item.lane > lower.lane ? item : lower);
      graphic.push({
        type: "line", silent: true, z: 1,
        shape: { x1: label.anchorX, y1: label.lane * 32 + 30, x2: label.anchorX, y2: height - 40 },
        style: { stroke: trendColors[label.status], opacity: 0.24, lineWidth: 1, lineDash: [4, 4] }
      });
    });
    labels.forEach(event => {
      const color = trendColors[event.status];
      graphic.push({
        type: "group", silent: true, z: 10, x: event.labelX, y: event.lane * 32 + 4,
        children: [
          { type: "rect", shape: { x: 0, y: 0, width: event.labelWidth, height: 25, r: 6 }, style: { fill: `${color}0e`, stroke: `${color}33`, lineWidth: 1 } },
          { type: "text", style: { x: event.labelWidth / 2, y: 12.5, text: event.text, align: "center", verticalAlign: "middle", fill: color, font: '500 12px "PingFang SC", "Microsoft YaHei", sans-serif' } }
        ]
      });
    });
    return {
      animation: !reduceMotion, animationDuration: 360, animationDurationUpdate: 160,
      textStyle: { fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif' },
      grid: { left, right, top, bottom: 40 },
      tooltip: { trigger: "item", triggerOn: "none", enterable: false, confine: true, transitionDuration: 0, hideDelay: 0,
        position: tooltipPosition, formatter: showTrendTooltip, backgroundColor: "#fff", borderColor: "#e6ebf2", borderWidth: 1, padding: 16,
        extraCssText: "pointer-events:none;border-radius:14px;box-shadow:0 6px 24px rgba(17,24,39,.1);" },
      xAxis: { type: "value", min: 0, max: latestDay, interval: 1,
        axisLine: { lineStyle: { color: "#e6ebf2" } }, axisTick: { show: false }, splitLine: { show: false },
        axisLabel: { color: "#98a2b3", fontSize: 12, margin: 16, formatter: day => trendDates[day] } },
      yAxis: { type: "value", inverse: true, min: minRank, max: maxRank, interval: 1,
        axisLine: { show: false }, axisTick: { show: false },
        splitLine: { lineStyle: { color: "#eef2f7", width: 1 } },
        axisLabel: { color: "#98a2b3", fontSize: 12, margin: 12, formatter: rank => `第${rank}名` } },
      graphic, series
    };
  }

  // 分段曲线属于同一场站：悬停任意一段/节点，同时高亮该站的所有历史区段。
  function highlightTrendStation(stationId) {
    if (!trendChart || trendChart.isDisposed() || highlightedStation === stationId) return;
    highlightedStation = stationId;
    cancelAnimationFrame(trendHighlightFrame);
    // setOption 的样式更新不会自动执行 ECharts 的状态动画，因此显式插值。
    // 与战略定位默认状态动画一致：300ms cubic-out；中途切换从当前值接续。
    const transitions = trendSeries.filter(series => series.stationId).map(series => {
      const faded = stationId !== null && series.stationId !== stationId;
      return {
        series,
        from: trendVisualStates.get(series.id) || { line: 1, node: 1, label: 1, width: series.lineStyle?.width || 0 },
        to: { line: faded ? 0.16 : 1, node: faded ? 0.18 : 1, label: faded ? 0.25 : 1,
          width: stationId === series.stationId ? 4 : series.lineStyle?.width || 0 }
      };
    });
    const start = performance.now();
    const animate = now => {
      if (trendChart.isDisposed()) return;
      const progress = reduceMotion ? 1 : Math.min(1, (now - start) / 300);
      const eased = 1 - Math.pow(1 - progress, 3);
      const series = transitions.map(({ series, from, to }) => {
        const state = Object.fromEntries(Object.keys(to).map(key => [key, from[key] + (to[key] - from[key]) * eased]));
        trendVisualStates.set(series.id, state);
        return {
          id: series.id,
          ...(series.type === "line" ? { lineStyle: { ...series.lineStyle, opacity: state.line, width: state.width } } : {}),
          itemStyle: { opacity: state.node }, label: { opacity: state.label },
          z: stationId === series.stationId ? 12 : series.z
        };
      });
      trendChart.setOption({ series }, { lazyUpdate: true });
      trendHighlightFrame = progress < 1 ? requestAnimationFrame(animate) : 0;
    };
    if (reduceMotion) animate(start);
    else trendHighlightFrame = requestAnimationFrame(animate);
  }

  function distanceToTrendSegment(cursor, start, end) {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared ? Math.max(0, Math.min(1,
      ((cursor[0] - start[0]) * dx + (cursor[1] - start[1]) * dy) / lengthSquared)) : 0;
    return Math.hypot(cursor[0] - start[0] - t * dx, cursor[1] - start[1] - t * dy);
  }

  function nearestTrendStation(cursor) {
    // 终点右侧两行文字共用整块热区，文字之间的空隙也能触发。
    // 使用同一套当前图表坐标，确保筛选、缩放与横向滚动后仍对应正确场站。
    const labelHit = trendHitPaths.find(({ points }) => {
      const end = points[latestDay];
      return end && cursor[0] >= end[0] + 8 && cursor[0] <= trendElement.clientWidth - 4
        && Math.abs(cursor[1] - end[1]) <= 19;
    });
    if (labelHit) return labelHit.stationId;
    let nearest = null;
    let shortest = trendHitRadius;
    trendHitPaths.forEach(({ stationId, points }) => {
      let distance = Infinity;
      points.forEach((point, index) => {
        if (!point) return;
        distance = Math.min(distance, distanceToTrendSegment(cursor, points[index - 1] || point, point));
      });
      // 交叉处选择最近曲线；距离相同则保留当前场站，避免来回闪动。
      if (distance < shortest || (distance <= shortest + 0.001 && distance <= trendHitRadius && stationId === highlightedStation)) {
        shortest = distance;
        nearest = stationId;
      }
    });
    return nearest;
  }

  function renderTrendChart() {
    if (!trendElement.clientWidth || !window.echarts) return;
    const selected = selectTrendStations(trendMode);
    const note = document.getElementById("trend-scope-note");
    const remaining = trendStations.length - selected.length;
    const scope = trendMode === "rank" ? "按竞争力排行榜圈定本站所在名次段" : "本站与距离最近的7个竞品";
    note.innerHTML = `<strong>竞争圈：</strong>${trendStations.length <= 8 ? "当前范围内全部场站" : scope}，共 ${selected.length} 站${remaining ? `；其余 ${remaining} 站未在本图展示` : "，已全部展示"}。`;
    trendElement.setAttribute("aria-label", `近7天竞争力排名趋势，${scope}。${selected.map(station => `${station.isSelf ? "本站" : station.name}第${station.ranks[latestDay]}名，${station.scores[latestDay]}分`).join("；")}。悬停曲线或节点查看详情。`);
    cancelAnimationFrame(trendHighlightFrame);
    trendVisualStates.clear();
    highlightedStation = null;
    const option = buildTrendOption(selected);
    if (!trendChart) {
      trendChart = window.echarts.init(trendElement, null, { renderer: "svg" });
      const showStationTooltip = params => {
        const id = params.stationId || params.data?.stationId || trendSeries.find(series => series.id === params.seriesId)?.stationId || trendSeries[params.seriesIndex]?.stationId;
        if (!id) return;
        highlightTrendStation(id);
        // 折线路径本身没有 dataIndex，主动用该站终点数据打开整站卡片。
        // 位置跟随鼠标，而不是跳到最后一天；不再要求必须命中节点。
        const seriesIndex = trendSeries.findIndex(series => series.id === `${id}-nodes`);
        const cursor = [params.event?.offsetX, params.event?.offsetY];
        trendChart.dispatchAction({
          type: "showTip", seriesIndex, dataIndex: trendSeries[seriesIndex].data.length - 1,
          position: cursor.every(Number.isFinite)
            ? (point, data, element, rect, size) => tooltipPosition(cursor, data, element, null, size)
            : tooltipPosition
        });
      };
      const hideStationTooltip = () => {
        trendChart.dispatchAction({ type: "hideTip" });
        highlightTrendStation(null);
      };
      // 曲线附近与右侧整块站点文字均可命中，不依赖细线或文字笔画的像素热区。
      trendElement.addEventListener("pointermove", event => {
        const bounds = trendElement.getBoundingClientRect();
        const cursor = [event.clientX - bounds.left, event.clientY - bounds.top];
        const stationId = nearestTrendStation(cursor);
        if (stationId) showStationTooltip({ stationId, event: { offsetX: cursor[0], offsetY: cursor[1] } });
        else hideStationTooltip();
      });
      trendElement.addEventListener("pointerleave", hideStationTooltip);
    }
    trendChart.resize();
    trendChart.setOption(option, { notMerge: true });
    trendHitPaths = selected.map(station => ({
      stationId: station.id,
      points: station.ranks.map((rank, day) => rank === null ? null : trendChart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [day, rank]))
    }));
  }

  let trendFrame;
  let lastTrendWidth = 0;
  const trendObserver = new ResizeObserver(() => {
    const width = trendElement.clientWidth;
    if (!width || width === lastTrendWidth) return;
    lastTrendWidth = width;
    cancelAnimationFrame(trendFrame);
    trendFrame = requestAnimationFrame(renderTrendChart);
  });
  trendObserver.observe(trendElement);
  document.fonts.ready.then(() => { if (trendChart && trendElement.clientWidth) renderTrendChart(); });
  window.addEventListener("pagehide", () => {
    cancelAnimationFrame(trendFrame);
    cancelAnimationFrame(trendHighlightFrame);
    trendObserver.disconnect();
    trendChart?.dispose();
  }, { once: true });

  // ==================== 03 分析页签及竞争圈切换 ====================
  const analysisTabs = Array.from(document.querySelectorAll("[data-analysis-tab]"));
  function switchAnalysisTab(key) {
    analysisTabs.forEach(tab => {
      const selected = tab.dataset.analysisTab === key;
      tab.classList.toggle("segment--selected", selected);
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      document.getElementById(tab.getAttribute("aria-controls")).hidden = !selected;
    });
    strategyChart?.dispatchAction({ type: "hideTip" });
    trendChart?.dispatchAction({ type: "hideTip" });
    if (key === "trend") {
      if (window.echarts) renderTrendChart();
      else { trendElement.classList.add("chart-unavailable"); trendElement.textContent = "图表暂未加载，请刷新页面重试"; }
    } else if (strategyChart) {
      strategyChart.resize();
      strategyChart.setOption(chartOption());
      strategyChart.dispatchAction({ type: "downplay" });
    }
  }
  analysisTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => switchAnalysisTab(tab.dataset.analysisTab));
    tab.addEventListener("keydown", event => {
      let next;
      if (event.key === "ArrowRight") next = (index + 1) % analysisTabs.length;
      if (event.key === "ArrowLeft") next = (index - 1 + analysisTabs.length) % analysisTabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = analysisTabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      switchAnalysisTab(analysisTabs[next].dataset.analysisTab);
      analysisTabs[next].focus();
    });
  });
  const trendModeButtons = Array.from(document.querySelectorAll("[data-trend-mode]"));
  trendModeButtons.forEach(button => button.addEventListener("click", () => {
    if (trendMode === button.dataset.trendMode) return;
    trendMode = button.dataset.trendMode;
    trendModeButtons.forEach(item => {
      const selected = item === button;
      item.classList.toggle("is-selected", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    trendChart?.dispatchAction({ type: "hideTip" });
    renderTrendChart();
  }));

  // ==================== 04 战略定位分析详情 ====================
  // 详情只展开截图中已有的结论和指标，不添加额外分析或虚拟站点数据。
  const dialog = document.getElementById("strategy-detail");
  const titles = { landscape: "竞争格局", pressure: "压力来源", focus: "建议关注" };
  document.querySelectorAll("[data-detail]").forEach(button => {
    button.addEventListener("click", () => {
      const key = button.dataset.detail;
      const template = document.getElementById(`detail-${key}`);
      if (!template || !dialog) return;
      document.getElementById("strategy-detail-title").textContent = titles[key];
      document.getElementById("strategy-detail-body").replaceChildren(template.content.cloneNode(true));
      dialog.showModal();
    });
  });
  dialog.querySelector(".strategy-detail__close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
})();
