/* AI 管家 · 社会事件
 * 同一事件，多电站独立分析。仅演示本地 UI，业务汇总结果来自原型；阶段趋势沿用原型示例走势并校正时间。
 * 正式接入时，服务端必须先返回“事件关联站点 ∩ 当前用户权限站点”。
 */
(() => {
  'use strict';
  const source = document.getElementById('social-event-data');
  if (!source) return;
  const data = JSON.parse(source.textContent);
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const byId = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
  const valid = value => typeof value === 'number' && Number.isFinite(value);
  const num = (value, digits = 0) => valid(value) ? value.toLocaleString('zh-CN', {minimumFractionDigits:digits, maximumFractionDigits:digits}) : '—';
  const signed = (value, digits = 1) => valid(value) ? `${value > 0 ? '+' : ''}${num(value, digits)}` : '—';
  const rate = (value, base) => valid(value) && valid(base) && base !== 0 ? (value / base - 1) * 100 : null;
  const pct = value => valid(value) ? `${signed(value)}%` : '—';
  const tag = (label, variant = 'neutral') => `<span class="status-tag status-tag--${variant}">${escape(label)}</span>`;
  const money = value => `<span class="metric-number">${num(value, 4)}</span>`;
  const directionVariant = s => s.direction === '机会评估' ? 'opportunity' : s.direction === '通知' ? 'pending' : 'neutral';
  const hasStrategy = s => s.direction === '机会评估' && s.priceSpace === true && valid(s.adjust) && s.adjust > 0;
  const hasEvaluation = s => hasStrategy(s) && [s.actualIncome,s.baseIncome,s.actualVol,s.baseVol,s.actualUsers,s.baseUsers].every(valid);
  const hasReview = s => hasEvaluation(s) && (s.phase || 'REVIEWED') === 'REVIEWED' && valid(s.aiValue);
  const params = new URLSearchParams(location.search);
  const ids = new Set(Array.isArray(data.authorizedStationIds) ? data.authorizedStationIds : []);
  let stations = (Array.isArray(data.stations) ? data.stations : []).filter(s => ids.has(s.id));
  if (params.get('single') === '1') stations = stations.slice(0, 1); // 原型自带验收入口。
  if (params.get('access') === 'none') stations = []; // 本地无权限状态验收。
  let selectedId = stations.some(s => s.id === params.get('station')) ? params.get('station') : stations[0]?.id;
  let modalPage = 1;
  const pageSize = 6;
  const dialog = byId('station-dialog');
  let overflowObserver;
  let trendMode = 'daily';

  function fact(label, value, unit = '', digits = 0, emphasis = '', signedValue = false) {
    const numeric = valid(value);
    const content = numeric ? (signedValue ? signed(value, digits) : num(value, digits)) : escape(value ?? '—');
    return `<div class="opportunity-fact${emphasis ? ` opportunity-fact--${emphasis}` : ''}"><dt>${escape(label)}</dt><dd><span class="${numeric ? 'metric-number' : 'opportunity-fact__text'}">${content}</span>${unit && value !== null && value !== undefined ? `<span class="opportunity-fact__unit">${escape(unit)}</span>` : ''}</dd></div>`;
  }
  function blockHeading(title, icon, suffix = '') {
    return `<header class="social-block__heading"><img src="./assets/${icon}.svg" width="20" height="20" alt=""><h3>${title}</h3>${suffix}</header>`;
  }
  function processCard(id, title, icon, description, facts, label = '通过', status = 'passed') {
    return `<article class="opportunity-step" aria-labelledby="${id}-title"><header class="analysis-block__heading"><img class="analysis-block__icon" src="./assets/${icon}.svg" width="18" height="18" alt=""><h4 id="${id}-title">${title}</h4><span class="status-tag step-status--${status}">${label}</span></header><div class="opportunity-step__body"><p class="opportunity-description">${description}</p><dl class="opportunity-facts">${facts}</dl></div></article>`;
  }
  function selectionSummary(s) {
    if (hasStrategy(s)) return `${s.name}的大型活动经营机会成立，经营健康核验通过，机会强度为${s.strength}。结合竞品价格空间与收益测算，建议在 ${s.window} 上调服务费 ${num(s.adjust,2)} 元/度。`;
    if (s.direction === '机会评估') return `${s.name}的需求增长机会成立，但当前价格空间不足。本次保持当前价格，不生成调价策略。`;
    if (s.direction === '通知') return `${s.name}预计会受到活动影响，但尚未形成可执行的调价机会。建议进行运营提醒，关注活动期间的需求变化。`;
    return `${s.name}预计充电量变化较弱，暂不生成经营动作，持续观察活动窗口内的实际变化。`;
  }
  function renderSelector() {
    const show = stations.length > 1;
    byId('station-selector').hidden = !show;
    byId('station-total').textContent = stations.length;
    byId('station-affected').textContent = stations.filter(s => s.affected).length;
    byId('dialog-total').textContent = `${stations.length} 个电站`;
    byId('station-quick-list').innerHTML = show ? stations.map(s => `<button class="station-chip" type="button" data-station="${escape(s.id)}" aria-pressed="${s.id === selectedId}" title="${escape(s.name)}">${escape(s.name)}</button>`).join('') : '';
    fitStationOptions();
  }
  function fitStationOptions() {
    const row = $('.station-selector__options'), more = byId('open-station-dialog');
    const buttons = [...byId('station-quick-list').children];
    if(byId('station-selector').hidden || !row.clientWidth){more.hidden=true;return;}
    // Measure actual rendered labels, including font weight and the current row width.
    // There is no fixed station-count limit. All fitting labels stay directly accessible.
    buttons.forEach(button=>{button.hidden=false;button.style.maxWidth='';});
    const gap=parseFloat(getComputedStyle(row).columnGap)||0;
    const widths=buttons.map(button=>button.getBoundingClientRect().width);
    const total=widths.reduce((sum,width)=>sum+width,0)+gap*Math.max(0,buttons.length-1);
    if(total<=row.clientWidth){
      more.hidden=true;
      if(dialog.matches(':popover-open'))dialog.hidePopover();
      return;
    }
    more.hidden=false;
    const budget=Math.max(0,row.clientWidth-more.getBoundingClientRect().width-gap);
    const chosen=[];let used=0;
    for(let i=0;i<buttons.length;i++){
      const needed=widths[i]+(chosen.length?gap:0);
      if(used+needed>budget)break;
      chosen.push(i);used+=needed;
    }
    // A station chosen from the full list must remain visible after selection/resizing.
    const selected=buttons.findIndex(button=>button.dataset.station===selectedId);
    if(selected>=0&&!chosen.includes(selected)){
      while(chosen.length&&used+gap+widths[selected]>budget){const last=chosen.pop();used-=widths[last]+(chosen.length?gap:0);}
      if(widths[selected]>budget)buttons[selected].style.maxWidth=`${budget}px`;
      chosen.push(selected);
    }
    buttons.forEach((button,index)=>{button.hidden=!chosen.includes(index);});
  }
  function renderAnalysis(s) {
    const direction = s.direction;
    const impact = fact('距活动地点', parseFloat(s.distance), 'km', 1) + fact('正常基准充电量',s.baseline,'度') + fact('活动窗口预测',s.predicted,'度',0,'primary') + fact('预计变化幅度',s.change,'%',1,s.change >= 0 ? 'positive' : 'negative',true) + fact('建议方向',direction,'',0,direction === '机会评估' ? 'primary' : '');
    let html = `<section class="social-block">${blockHeading('外部事件影响评估','social-impact',tag('单站判断','opportunity'))}<p class="social-caption">结合活动规模、时间、预计到场人数及同类活动表现，预测本站在活动窗口内的充电量变化。</p><dl class="social-impact-metrics">${impact}</dl></section>`;
    if (direction === '机会评估') {
      const cards = [
        processCard('condition','机会条件核验','opportunity-basis','活动窗口预测充电量高于正常经营基准，达到经营机会评估条件。',fact('正常基准',s.baseline,'度')+fact('活动窗口预测',s.predicted,'度')+fact('预计变化',s.change,'%',1,'positive',true)+fact('核验结果','机会条件成立','','','primary')),
        processCard('health','经营健康门禁','social-shield','近 6 周经营表现总体稳定，服务费收入和充电量未出现持续异常。',fact('观察周期','近 6 周')+fact('经营趋势','稳定')+fact('异常状态','无持续异常')+fact('门禁结果','通过','','','primary')),
        processCard('strength','机会强度与预测','demand-forecast',`结合活动窗口预测结果，本站机会强度判定为${escape(s.strength)}。`,fact('机会强度',s.strength,'',0,'primary')+fact('预测充电量',s.predicted,'度')+fact('较正常基准',s.change,'%',1,'positive',true)+fact('机会窗口',s.window)),
        processCard('price-space','竞品价格空间','social-price-space',s.priceSpace ? '周边核心竞品服务费高于本站当前水平，本站仍具备价格竞争力。' : '本站服务费已接近竞品主流价格上沿，不建议继续上调。',fact('本站服务费',s.currentFee,'元/度',2)+fact('竞品主流区间',s.competitor)+fact('可调价格范围',s.priceSpace ? `0 至 ${num(s.adjust,2)} 元/度` : '无上涨空间'),s.priceSpace ? '存在空间' : '无价格空间',s.priceSpace ? 'passed' : 'skipped')
      ].join('');
      html += `<section class="social-block">${blockHeading('经营机会评估','opportunity-basis',tag(s.priceSpace ? '建议调价' : '保持当前价格',s.priceSpace ? 'opportunity' : 'neutral'))}<div class="social-flow-frame"><div class="social-flow-scroll" data-overflow="horizontal" role="region" aria-label="经营机会评估步骤" tabindex="-1"><div class="social-opportunity-grid">${cards}</div></div></div></section>`;
      html += `<section class="social-block">${blockHeading('调价收益测算','social-calculator',tag(s.priceSpace ? '找到最优价格点' : '无需测算',s.priceSpace ? 'opportunity' : 'neutral'))}`;
      if (s.priceSpace) {
        html += `<p class="social-caption">比较各调价方案的预测收入与充电量，变化率均相对不调整方案。</p><div class="candidate-grid" aria-label="调价候选方案">${(s.candidates || []).map((row,index) => `<article class="candidate-card${row.recommended ? ' candidate-card--recommended' : ''}" aria-labelledby="candidate-${index}-title"><header class="candidate-card__heading"><span>调价幅度</span>${tag(row.recommended ? '收益最大' : row.adjust ? '可行' : '基准方案',row.recommended ? 'opportunity' : 'neutral')}</header><h4 class="candidate-card__price" id="candidate-${index}-title">${row.adjust ? `<span class="metric-number">${signed(row.adjust,2)}</span><span class="candidate-unit">元/度</span>` : '<span class="candidate-card__baseline">不调整</span>'}</h4><dl class="candidate-card__metrics"><div class="candidate-metric candidate-metric--income"><dt>预测服务费收入</dt><dd><span class="candidate-metric__value"><span class="metric-number">${num(row.income)}</span><span class="candidate-unit">元</span></span><span class="candidate-metric__change${row.adjust ? row.incomeChange>0?' is-positive':row.incomeChange<0?' is-negative':'' : ''}" aria-label="收入变化 ${row.adjust ? pct(row.incomeChange) : '基准方案'}">${row.adjust ? pct(row.incomeChange) : '—'}</span></dd></div><div class="candidate-metric"><dt>预测充电量</dt><dd><span class="candidate-metric__value"><span class="metric-number">${num(row.volume)}</span><span class="candidate-unit">度</span></span><span class="candidate-metric__change${row.adjust ? row.volumeChange>0?' is-positive':row.volumeChange<0?' is-negative':'' : ''}" aria-label="充电量变化 ${row.adjust ? pct(row.volumeChange) : '基准方案'}">${row.adjust ? pct(row.volumeChange) : '—'}</span></dd></div></dl></article>`).join('')}</div>`;
      } else html += '<p class="social-caption">竞品价格空间不足，本次不生成调价候选方案，无需继续进行量价测算。</p>';
      html += '</section>';
    }
    html += `<section class="ai-conclusion social-judgement" aria-labelledby="social-judgement-title"><h3 id="social-judgement-title">AI判断</h3><p>${escape(selectionSummary(s))}</p></section>`;
    byId('analysis-content').innerHTML = html;
    byId('analysis-status').textContent = '分析完成';
  }
  function renderDecision(s) {
    const enabled = hasStrategy(s);
    byId('decision-section').hidden = !enabled;
    byId('decision-content').replaceChildren();
    if (!enabled) return;
    byId('decision-status').textContent = s.phase === 'EVALUATING' ? '执行中' : '已完成';
    byId('decision-content').innerHTML = `<div class="social-adjustment"><span class="social-adjustment__label"><img src="./assets/pricing-advice.svg" width="18" height="18" alt="">服务费调整</span><span class="social-adjustment__value"><strong class="metric-number">${signed(s.adjust,2)}</strong><small>元/度</small></span></div>
      <dl class="decision-fields" aria-label="本站调价策略信息"><div class="decision-field decision-field--wide"><dt>生效时间</dt><dd>2026-08-23 ${escape(s.window)}</dd></div><div class="decision-field decision-field--divided"><dt>执行方式</dt><dd>AI自动执行</dd></div><div class="decision-field"><dt>影响范围</dt><dd>${escape(s.name)}</dd></div><div class="decision-field decision-field--wide"><dt>调价项目</dt><dd>服务费</dd></div><div class="decision-field decision-field--wide decision-field--purpose"><dt>调价目的</dt><dd>把握大型活动带来的需求机会，在保持价格竞争力的前提下提升服务费收入。</dd></div></dl>
      <section aria-labelledby="social-price-title"><div class="social-price-caption"><strong id="social-price-title">分时价格方案</strong><span>单位：元/度</span></div><div class="social-table-frame"><table class="social-table social-price-table" aria-label="电费服务费及综合价格调整对比"><thead><tr><th>价格项目</th><th>调价前</th><th>调价后</th></tr></thead><tbody><tr><td>电费</td><td>${money(s.electricityFee)}</td><td>${money(s.electricityFee)}</td></tr><tr><td>服务费</td><td>${money(s.currentFee)}</td><td class="is-primary">${money(s.currentFee+s.adjust)}</td></tr><tr><td>综合价格</td><td>${money(s.electricityFee+s.currentFee)}</td><td class="is-primary">${money(s.electricityFee+s.currentFee+s.adjust)}</td></tr></tbody></table></div></section>`;
  }
  function resultMetric(label,value,unit,change,variant='',note='较策略评估基准',isDelta=false) {
    return `<div class="execution-metric${variant ? ` execution-metric--${variant}` : ''}"><dt>${label}</dt><dd><span class="metric-number">${isDelta ? signed(value,0) : num(value)}</span><span class="execution-unit">${unit}</span></dd><dd class="execution-change"><span>${note}</span><strong>${pct(change)}</strong></dd></div>`;
  }
  function gradeClass(grade) { return grade === '良' ? 'is-fair' : grade === '差' ? 'is-poor' : grade === '优' ? '' : 'is-unknown'; }
  function renderEvaluation(s) {
    const enabled=hasEvaluation(s);
    byId('execution-evaluation').hidden=!enabled;
    byId('evaluation-content').replaceChildren();
    if(!enabled)return;
    const inc=rate(s.actualIncome,s.baseIncome),vol=rate(s.actualVol,s.baseVol),users=rate(s.actualUsers,s.baseUsers);
    const finished=(s.phase || 'REVIEWED')!=='EVALUATING';
    const grade=['优','良','差'].includes(s.grade)?s.grade:'—';
    const heading=grade==='优'?'策略执行效果优于预期':grade==='良'?'策略执行效果符合预期':grade==='差'?'策略执行效果未达预期':'执行效果待评估';
    byId('evaluation-status').textContent=finished?'执行完成':'评估中';
    byId('evaluation-content').innerHTML=`<div class="execution-assessment"><div class="execution-grade"><span>执行评级</span><strong class="${gradeClass(grade)}">${grade}</strong></div><span class="evaluation-summary">${heading}</span></div><dl class="execution-metrics evaluation-metrics" aria-label="执行期间累计经营指标">${resultMetric('充电量',s.actualVol,'度',vol)}${resultMetric('充电用户',s.actualUsers,'人',users)}${resultMetric('服务费收入',s.actualIncome,'元',inc,'primary')}</dl>
<figure class="execution-trend social-trend" aria-labelledby="social-trend-title"><div class="execution-trend__heading"><h3 id="social-trend-title">策略执行效果趋势</h3><div class="trend-switch" role="group" aria-label="评估节点口径"><button type="button" data-trend-mode="daily">日评估</button><button type="button" data-trend-mode="stages">阶段明细</button></div></div><p class="execution-trend__note" id="social-trend-note"></p><div class="execution-trend__plot"><svg id="social-trend-svg" role="group" aria-label="累计经营结果较策略评估基准变化趋势"></svg><div class="execution-chart-tooltip" id="social-trend-tooltip" role="tooltip" hidden></div></div><figcaption class="execution-trend__legend">${[{label:'服务费收入',color:'#05b37f'},{label:'充电量',color:'#7c8799'},{label:'充电用户',color:'#a1aab8',dash:true}].map(item=>`<span><svg viewBox="0 0 24 12" aria-hidden="true"><path d="M1 6H23" fill="none" stroke="${item.color}" stroke-width="2" ${item.dash?'stroke-dasharray="4 3"':''}/><circle cx="12" cy="6" r="3" fill="${item.color}"/></svg>${item.label}</span>`).join('')}</figcaption></figure>`;
    const timeline=s.evaluationTimeline;
    const duration=timeline?new Date(timeline.endAt)-new Date(timeline.startAt):0;
    // This demo has separate evaluation and final review stages. Short-window
    // evaluation retains the prototype's stage detail; final impact belongs to 05.
    trendMode=timeline?.stages?.length && duration<3*86400000 ? 'stages' : 'daily';
    drawTrend(s);
  }
  function renderReview(s) {
    const enabled=hasReview(s);
    byId('decision-review').hidden=!enabled;
    byId('review-content').replaceChildren();
    if(!enabled)return;
    const inc=rate(s.actualIncome,s.baseIncome),vol=rate(s.actualVol,s.baseVol),users=rate(s.actualUsers,s.baseUsers);
    const grade=['优','良','差'].includes(s.grade)?s.grade:'—';
    const conclusion=grade==='优'
      ? `本次调价策略整体有效，服务费收入较策略评估基准变化 ${pct(inc)}，充电量变化 ${pct(vol)}、用户数变化 ${pct(users)}，可作为后续同类大型活动场景的参考。`
      : grade==='良' ? `本次调价策略取得一定效果，服务费收入较策略评估基准变化 ${pct(inc)}。建议保留策略方向，并继续优化调价幅度和执行时段。`
      : grade==='差' ? '本次调价策略整体效果未达预期，不建议直接复用当前方案，需重新评估调价幅度及影响因素。' : '暂未提供最终复盘结论。';
    byId('review-status').textContent='复盘完成';
    byId('review-content').innerHTML=`<section class="ai-conclusion review-conclusion"><header class="review-conclusion__heading"><h3>AI 复盘结论</h3><div class="execution-grade"><span>复盘结果</span><strong class="${gradeClass(grade)}">${grade}</strong></div></header><p>${escape(conclusion)}</p></section><dl class="execution-metrics review-impact-metrics" aria-label="策略最终增减影响">${resultMetric('AI创造价值',s.aiValue,'元',inc,'value','服务费收入变化',true)}${resultMetric('充电量影响',s.actualVol-s.baseVol,'度',vol,'','变化率',true)}${resultMetric('用户数影响',s.actualUsers-s.baseUsers,'人',users,'','变化率',true)}</dl>`;
  }
  function drawTrend(s) {
    const svg = byId('social-trend-svg');
    if (!svg || !hasEvaluation(s)) return;
    const points = s.evaluationTimeline?.[trendMode] || [];
    $$('[data-trend-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.trendMode === trendMode)));
    byId('social-trend-note').textContent = trendMode === 'daily'
      ? `累计效果较策略评估基准变化（%）${points.length === 1 ? '；本次策略在 1 天内完成。' : '。'}`
      : '策略生效后各评估节点的累计变化（%） · 示例数据';
    byId('social-trend-tooltip').hidden = true;
    const width = Math.max(280,svg.parentElement.clientWidth), height = svg.parentElement.clientHeight;
    const left = 44, right = width-20, top = 20, bottom = height-40;
    const series = [{key:'income',label:'服务费收入',color:'#05b37f'},{key:'volume',label:'充电量',color:'#7c8799'},{key:'users',label:'充电用户',color:'#a1aab8',dash:'4 3'}];
    const values = points.flatMap(point=>series.map(item=>point.rates[item.key])).filter(valid);
    const low = Math.min(-5,Math.floor(Math.min(0,...values)/5)*5), high = Math.max(5,Math.ceil(Math.max(0,...values)/5)*5);
    const x = i => points.length === 1 ? (left+right)/2 : left+i*(right-left)/(points.length-1);
    const y = value => bottom-(value-low)/(high-low)*(bottom-top);
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    svg.dataset.nodeCount=points.length;svg.dataset.mode=trendMode;
    let markup='';
    for(let tick=low;tick<=high;tick+=5)markup+=`<line x1="${left}" x2="${right}" y1="${y(tick)}" y2="${y(tick)}" class="execution-gridline" ${tick===0?'style="stroke:#c9d2df"':''}/><text x="${left-8}" y="${y(tick)+4}" text-anchor="end" class="execution-axis">${tick>0?'+':''}${tick}%</text>`;
    if(!points.length) { svg.innerHTML=markup+`<text x="${width/2}" y="${height/2}" text-anchor="middle" class="execution-axis">暂无评估节点</text>`; return; }
    const labels = new Set([0,points.length-1]);
    const labelCount = Math.min(points.length,Math.max(2,Math.floor((right-left)/100)));
    for(let i=1;i<labelCount-1;i++)labels.add(Math.round(i*(points.length-1)/(labelCount-1)));
    points.forEach((point,i)=>{
      if(!labels.has(i))return;
      const time=point.at.endsWith('00:00')?'24:00':point.at.slice(11,16);
      const label=trendMode==='daily' ? point.label : time;
      markup+=`<text x="${x(i)}" y="${height-13}" text-anchor="${points.length===1?'middle':i===0?'start':i===points.length-1?'end':'middle'}" class="execution-axis">${escape(label)}</text>`;
    });
    series.forEach(item=>{
      if(points.length>1)markup+=`<polyline points="${points.map((point,i)=>`${x(i)},${y(point.rates[item.key])}`).join(' ')}" class="execution-series" stroke="${item.color}" stroke-width="2.5" ${item.dash?`stroke-dasharray="${item.dash}"`:''}/>`;
      points.forEach((point,i)=>markup+=`<circle cx="${x(i)}" cy="${y(point.rates[item.key])}" r="${points.length===1?4:3}" fill="${item.color}" stroke="#fff" stroke-width="1"/>`);
    });
    points.forEach((point,i)=>{
      const half=points.length===1?48:(right-left)/(points.length-1)/2;
      const timeLabel=point.at.endsWith('00:00')?'08/23 24:00':point.at.slice(5,10).replace('-','/')+' '+point.at.slice(11,16);
      const label=`${timeLabel}，${series.map(item=>`${item.label}${pct(point.rates[item.key])}`).join('，')}`;
      markup+=`<g tabindex="0" class="execution-chart-hit" data-node="${i}" data-x="${x(i)}" aria-label="${escape(label)}"><rect x="${Math.max(left,x(i)-half)}" y="${top}" width="${Math.min(right,x(i)+half)-Math.max(left,x(i)-half)}" height="${bottom-top}" fill="transparent"/></g>`;
    });
    svg.innerHTML=markup;
    const tooltip=byId('social-trend-tooltip');
    const show = target => {
      const point=points[Number(target.dataset.node)];if(!point)return;
      const date=point.at.endsWith('00:00')?'08/23 24:00':point.at.slice(5,10).replace('-','/')+' '+point.at.slice(11,16);
      tooltip.innerHTML=`<strong>${date}${trendMode==='stages'?' · 阶段明细':''}</strong>${series.map(item=>`<div><span>${item.label}</span><b style="color:${item.color}">${pct(point.rates[item.key])}</b></div>`).join('')}<span class="trend-tooltip-note">从策略生效起累计，较对应基准</span>`;
      tooltip.hidden=false;tooltip.style.top='4px';
      tooltip.style.left=`${Math.max(0,Math.min(width-tooltip.offsetWidth,Number(target.dataset.x)-tooltip.offsetWidth/2))}px`;
    };
    svg.querySelectorAll('[data-node]').forEach(target=>{target.addEventListener('pointerenter',()=>show(target));target.addEventListener('focus',()=>show(target));target.addEventListener('pointerleave',()=>{tooltip.hidden=true;});target.addEventListener('blur',()=>{tooltip.hidden=true;});});
  }
  function bindOverflow() {
    overflowObserver?.disconnect();
    const update = element => {
      const overflow = element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1;
      element.tabIndex = overflow ? 0 : -1;
      element.parentElement.classList.toggle('has-more',element.scrollWidth > element.clientWidth + 1 && element.scrollLeft + element.clientWidth < element.scrollWidth - 1);
    };
    overflowObserver = new ResizeObserver(entries=>entries.forEach(entry=>update(entry.target)));
    $$('[data-overflow]').forEach(element=>{element.addEventListener('scroll',()=>update(element),{passive:true});overflowObserver.observe(element);update(element);});
  }
  function updateLifecycle() {
    ['event-analysis','decision-section','execution-evaluation','decision-review'].forEach(id=>{
      $(`.lifecycle-link[href="#${id}"]`).closest('.lifecycle-step').hidden=byId(id).hidden;
    });
    window.dispatchEvent(new Event('social-station-change'));
  }
  function renderAll() {
    renderSelector();
    const s=stations.find(s=>s.id===selectedId);
    byId('no-access').hidden=!!s;
    byId('event-analysis').hidden=!s;
    if (!s) {
      byId('analysis-content').replaceChildren();byId('decision-content').replaceChildren();byId('evaluation-content').replaceChildren();byId('review-content').replaceChildren();
      byId('decision-section').hidden=true;byId('execution-evaluation').hidden=true;byId('decision-review').hidden=true;byId('decision-evaluation-grid').hidden=true;
    } else {
      renderAnalysis(s);renderDecision(s);renderEvaluation(s);renderReview(s);
      byId('decision-evaluation-grid').hidden=!hasStrategy(s);
      $$('[data-station-name]').forEach(e=>{e.textContent=s.name;});
      bindOverflow();
    }
    updateLifecycle();
  }
  function selectStation(id) {
    const s=stations.find(s=>s.id===id);if (!s) return;
    const fromDialog=dialog.matches(':popover-open');
    selectedId=id;renderAll();
    const url=new URL(location.href);url.searchParams.set('station',id);
    const hashTarget=url.hash&&document.getElementById(url.hash.slice(1));
    if (hashTarget?.hidden) url.hash='event-analysis';
    history.replaceState(null,'',url);
    if(fromDialog)closeDialog();
    const focusTarget=fromDialog?byId('open-station-dialog'):$(`[data-station="${id}"]`);
    focusTarget?.focus({preventScroll:true});
    byId('station-announcement').textContent=`已切换至${s.name}，分析及后续结果已更新。`;
  }
  function filteredStations() {
    const q=byId('station-search').value.trim().toLowerCase(),region=byId('station-region').value;
    return stations.filter(s=>(!region||s.region===region)&&(!q||s.name.toLowerCase().includes(q)||s.code.toLowerCase().includes(q)));
  }
  function renderModal() {
    const filtered=filteredStations(),pages=Math.max(1,Math.ceil(filtered.length/pageSize));modalPage=Math.min(modalPage,pages);
    const visible=filtered.slice((modalPage-1)*pageSize,modalPage*pageSize);
    byId('station-results').innerHTML=visible.length?`<ul class="station-result-list">${visible.map(s=>`<li><button class="station-result" type="button" data-modal-station="${escape(s.id)}" aria-pressed="${s.id===selectedId}"><span class="station-result__identity"><span class="station-result__radio" aria-hidden="true"></span><span><strong>${escape(s.name)}</strong><small>${escape(s.region)} · ${escape(s.code)}</small></span></span><span class="station-result__impact ${s.affected?'is-affected':''}">${s.affected?'受影响':'无明显影响'}</span><span>${tag(hasStrategy(s)?'建议调价':s.direction==='机会评估'?'保持价格':s.direction==='通知'?'通知提醒':'持续观察',directionVariant(s))}</span></button></li>`).join('')}</ul>`:'<div class="social-empty"><img src="./assets/social-search.svg" width="28" height="28" alt=""><h3>未找到匹配电站</h3><p>试试其他电站名称、编号或区域。</p></div>';
    byId('search-total').textContent=`共 ${filtered.length} 个电站`;byId('station-page').textContent=`${modalPage} / ${pages}`;
    byId('station-prev').disabled=modalPage<=1;byId('station-next').disabled=modalPage>=pages;
    byId('station-results').scrollTop=0;
    if(dialog.matches(':popover-open'))positionDialog();
  }
  function prepareDialog() {
    if(stations.length<=1)return;
    modalPage=1;byId('station-search').value='';
    byId('station-region').innerHTML='<option value="">全部区域</option>'+[...new Set(stations.map(s=>s.region))].map(region=>`<option value="${escape(region)}">${escape(region)}</option>`).join('');
    renderSelector();renderModal();
  }
  function positionDialog() {
    if(!dialog.matches(':popover-open'))return;
    const trigger=byId('open-station-dialog').getBoundingClientRect();
    if(trigger.bottom<60 || trigger.top>innerHeight){dialog.hidePopover();return;}
    const width=Math.min(600,innerWidth-32),below=innerHeight-trigger.bottom-16,above=trigger.top-16;
    const useBelow=below>=300 || below>=above,available=Math.max(180,useBelow?below:above);
    dialog.style.width=`${width}px`;dialog.style.maxHeight=`${Math.min(510,available)}px`;
    dialog.style.left=`${Math.min(Math.max(16,trigger.left),innerWidth-width-16)}px`;
    dialog.style.top=`${useBelow?trigger.bottom+8:Math.max(8,trigger.top-dialog.offsetHeight-8)}px`;
  }
  function closeDialog() { if(dialog.matches(':popover-open'))dialog.hidePopover();byId('open-station-dialog').focus({preventScroll:true}); }
  dialog.addEventListener('beforetoggle',event=>{if(event.newState!=='open')return;if(stations.length<=1){event.preventDefault();return;}prepareDialog();requestAnimationFrame(()=>{positionDialog();byId('station-search').focus({preventScroll:true});});});
  byId('station-quick-list').addEventListener('click',event=>{const button=event.target.closest('[data-station]');if(button)selectStation(button.dataset.station);});
  byId('station-results').addEventListener('click',event=>{const button=event.target.closest('[data-modal-station]');if(button)selectStation(button.dataset.modalStation);});
  byId('close-station-dialog').addEventListener('click',closeDialog);
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeDialog();}});
  dialog.addEventListener('toggle',event=>byId('open-station-dialog').setAttribute('aria-expanded',String(event.newState==='open')));
  window.addEventListener('resize',positionDialog);
  window.addEventListener('scroll',event=>{if(dialog.matches(':popover-open')&&!dialog.contains(event.target))positionDialog();},{passive:true,capture:true});
  byId('evaluation-content').addEventListener('click',event=>{const button=event.target.closest('[data-trend-mode]');if(!button)return;trendMode=button.dataset.trendMode;const s=stations.find(s=>s.id===selectedId);if(s)drawTrend(s);});
  byId('station-search').addEventListener('input',()=>{modalPage=1;renderModal();});
  byId('station-region').addEventListener('change',()=>{modalPage=1;renderModal();});
  byId('station-prev').addEventListener('click',()=>{if(modalPage>1){modalPage--;renderModal();}});
  byId('station-next').addEventListener('click',()=>{if(modalPage<Math.ceil(filteredStations().length/pageSize)){modalPage++;renderModal();}});
  const chartObserver=new ResizeObserver(()=>{const s=stations.find(s=>s.id===selectedId);if(s)drawTrend(s);});
  chartObserver.observe(byId('execution-evaluation'));
  const stationLayoutObserver=new ResizeObserver(fitStationOptions);
  stationLayoutObserver.observe($('.station-selector__options'));
  document.fonts.ready.then(fitStationOptions);
  renderAll();
})();

/* 社会事件的03至05共用选中背景，阶段名称、时间和锚点各自保留。 */
(() => {
  'use strict';
  if (location.hash === '#execution-review') history.replaceState(null, '', '#execution-evaluation');
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

  const decisionStageIds = new Set(['decision-section', 'execution-evaluation', 'decision-review']);

  function getRows() {
    const rows = [];
    stages.forEach(item => {
      if (item.link.closest('.lifecycle-step').hidden || !item.section.getClientRects().length) return;
      const top = item.section.getBoundingClientRect().top;
      const groupId = decisionStageIds.has(item.section.id) ? 'decision-cycle' : item.section.id;
      const last = rows[rows.length - 1];
      // 03、04、05按同一业务组高亮，不随并排或上下布局拆开。
      if (last && last.groupId === groupId) last.items.push(item);
      else rows.push({ groupId, top, items: [item] });
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
    // 页尾进入03至05整组，保留用户点击的锚点，避免强制切到05。
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
