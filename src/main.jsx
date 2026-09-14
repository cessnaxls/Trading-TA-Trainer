import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const fmt = (v, d=2) => Number.isFinite(v) ? v.toFixed(d) : "—";
const pct = v => `${(v*100).toFixed(1)}%`;

function seeded(seed=123456789) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function gaussian(rand) {
  let u=0, v=0;
  while(u===0) u=rand();
  while(v===0) v=rand();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
}

function ema(values, span) {
  const a = 2/(span+1);
  const out = [];
  let prev = values[0];
  values.forEach((v,i)=>{
    prev = i===0 ? v : a*v+(1-a)*prev;
    out.push(prev);
  });
  return out;
}

function sma(values, n) {
  return values.map((_,i)=>{
    if(i<n-1) return null;
    let s=0;
    for(let j=i-n+1;j<=i;j++) s+=values[j];
    return s/n;
  });
}

function calcRSI(closes, n=14) {
  const out = Array(closes.length).fill(50);
  let avgG=0, avgL=0;
  for(let i=1;i<closes.length;i++) {
    const d=closes[i]-closes[i-1];
    const g=Math.max(d,0), l=Math.max(-d,0);
    if(i<=n) {
      avgG+=g/n; avgL+=l/n;
    } else {
      avgG=(avgG*(n-1)+g)/n;
      avgL=(avgL*(n-1)+l)/n;
    }
    if(i>=n) {
      if(avgL===0) out[i]=100;
      else {
        const rs=avgG/avgL;
        out[i]=100-(100/(1+rs));
      }
    }
  }
  return out;
}

function calcATR(data,n=14) {
  const trs=data.map((d,i)=>{
    if(i===0) return d.high-d.low;
    const p=data[i-1].close;
    return Math.max(d.high-d.low, Math.abs(d.high-p), Math.abs(d.low-p));
  });
  const out=[];
  let prev=trs[0];
  trs.forEach((v,i)=>{
    prev=i===0?v:((prev*(n-1)+v)/n);
    out.push(prev);
  });
  return out;
}

function addIndicators(data) {
  const closes=data.map(d=>d.close);
  const e9=ema(closes,9), e20=ema(closes,20), e50=ema(closes,50);
  const e12=ema(closes,12), e26=ema(closes,26);
  const macd=e12.map((v,i)=>v-e26[i]);
  const signal=ema(macd,9);
  const r=calcRSI(closes,14);
  const at=calcATR(data,14);
  const vol20=sma(data.map(d=>d.volume),20);
  return data.map((d,i)=>({...d,ema9:e9[i],ema20:e20[i],ema50:e50[i],rsi:r[i],atr:at[i],macd:macd[i],signal:signal[i],vol20:vol20[i]}));
}

function generateMarket(seed=Date.now(), n=1100) {
  const rand=seeded(seed);
  const regimes=[];
  const choices=[
    ["Uptrend",0.24],["Downtrend",0.20],["Range",0.23],
    ["Volatile Up",0.13],["Volatile Down",0.12],["Compression",0.08]
  ];
  while(regimes.length<n) {
    let r=rand(), acc=0, kind="Range";
    for(const [k,p] of choices){acc+=p;if(r<=acc){kind=k;break;}}
    const len=45+Math.floor(rand()*100);
    for(let j=0;j<len && regimes.length<n;j++) regimes.push(kind);
  }
  const rows=[];
  let close=100, rangeAnchor=100;
  const start = new Date("2021-01-04T12:00:00Z");
  for(let i=0;i<n;i++) {
    const kind=regimes[i];
    let drift=0, vol=0.009;
    if(kind==="Uptrend"){drift=0.0012;vol=0.008;}
    if(kind==="Downtrend"){drift=-0.00115;vol=0.010;}
    if(kind==="Range"){drift=((rangeAnchor-close)/close)*0.09;vol=0.006;}
    if(kind==="Volatile Up"){drift=0.0009;vol=0.018;}
    if(kind==="Volatile Down"){drift=-0.00085;vol=0.019;}
    if(kind==="Compression"){drift=0;vol=0.0035;}
    if(i===0 || regimes[i]!==regimes[i-1]) rangeAnchor=close;

    let ret=drift+gaussian(rand)*vol;
    if(rand()<0.018) ret += gaussian(rand)*vol*2.5;
    const open=close*(1+gaussian(rand)*0.002);
    close=Math.max(3,close*(1+ret));
    let candleSpread=Math.max(close*(0.0025+rand()*0.012),0.05);
    let high=Math.max(open,close)+candleSpread*(0.2+rand()*0.7);
    let low=Math.min(open,close)-candleSpread*(0.2+rand()*0.7);
    low=Math.max(.01,low);
    const body=Math.abs(close-open)/close;
    const tr=(high-low)/close;
    let volume=Math.round((350000+rand()*1150000)*(1+body*35+tr*8));
    const d=new Date(start.getTime()+i*86400000);
    rows.push({date:d.toISOString().slice(0,10),open,high,low,close,volume,regime:kind});
  }
  return addIndicators(rows);
}

function levelInfo(data, end, lookback=45) {
  const w=data.slice(Math.max(0,end-lookback+1), end+1);
  const lows=w.map(d=>d.low).sort((a,b)=>a-b);
  const highs=w.map(d=>d.high).sort((a,b)=>a-b);
  return {
    support:lows[Math.floor(lows.length*.12)],
    resistance:highs[Math.floor(highs.length*.88)]
  };
}

function analyze(data,end) {
  const d=data[end], prev=data[end-1], {support,resistance}=levelInfo(data,end);
  const bull=[], bear=[], neutral=[];
  let score=0;

  if(d.close>d.ema20 && d.ema20>d.ema50){bull.push("Price is above the 20 EMA and the 20 EMA is above the 50 EMA.");score+=2;}
  if(d.close<d.ema20 && d.ema20<d.ema50){bear.push("Price is below the 20 EMA and the 20 EMA is below the 50 EMA.");score-=2;}
  if(d.ema9>d.ema20){bull.push("Fast EMA alignment favors buyers.");score+=1;}
  else {bear.push("Fast EMA alignment favors sellers.");score-=1;}

  if(d.rsi>55 && d.rsi<72){bull.push(`RSI ${fmt(d.rsi,0)} shows constructive momentum without being deeply extended.`);score+=1;}
  if(d.rsi<45 && d.rsi>28){bear.push(`RSI ${fmt(d.rsi,0)} shows negative momentum.`);score-=1;}
  if(d.rsi>=72){bear.push(`RSI ${fmt(d.rsi,0)} is stretched; continuation is possible but pullback risk is elevated.`);score-=0.25;}
  if(d.rsi<=28){bull.push(`RSI ${fmt(d.rsi,0)} is stretched to the downside; mean-reversion risk is elevated.`);score+=0.25;}

  if(d.macd>d.signal){bull.push("MACD is above its signal line.");score+=0.75;}
  else {bear.push("MACD is below its signal line.");score-=0.75;}

  const volRatio=d.vol20 ? d.volume/d.vol20 : 1;
  const nearR=(resistance-d.close)/d.close;
  const nearS=(d.close-support)/d.close;

  if(nearR<0.012) neutral.push("Price is pressing into a recent resistance zone; breakout confirmation matters.");
  if(nearS<0.012) neutral.push("Price is testing a recent support zone; rejection or breakdown confirmation matters.");
  if(volRatio>1.35) neutral.push(`Volume is ${fmt(volRatio,2)}× its 20-bar average, increasing the significance of this move.`);
  if(volRatio<0.72) neutral.push("Volume is subdued, so apparent moves deserve less conviction.");

  const recent=data.slice(Math.max(0,end-19),end+1);
  const ret20=(d.close/recent[0].close)-1;
  if(ret20>0.04){bull.push(`20-bar structure is positive (${pct(ret20)}).`);score+=1;}
  if(ret20<-0.04){bear.push(`20-bar structure is negative (${pct(ret20)}).`);score-=1;}

  const atrPct=d.atr/d.close;
  if(atrPct>0.022) neutral.push("ATR is elevated; wider outcome dispersion should reduce forecast confidence.");
  if(atrPct<0.008) neutral.push("ATR is compressed; a range or volatility expansion setup may be developing.");

  // Convert heuristic evidence to calibrated-looking training prior, not a claim of market truth.
  let pUp = 1/(1+Math.exp(-score/2.4));
  pUp = clamp(pUp,0.18,0.82);
  let pRange = clamp(0.16 + (atrPct<0.008 ? .16:0) + (Math.abs(score)<1 ? .10:0), .08, .38);
  let directional = 1-pRange;
  let pDown = directional*(1-pUp);
  pUp = directional*pUp;
  const norm=pUp+pDown+pRange;
  pUp/=norm;pDown/=norm;pRange/=norm;

  let trend="Mixed / transitional";
  if(d.close>d.ema20 && d.ema20>d.ema50) trend="Bullish trend";
  if(d.close<d.ema20 && d.ema20<d.ema50) trend="Bearish trend";
  let momentum=d.rsi>55?"Positive":d.rsi<45?"Negative":"Neutral";
  let volatility=atrPct>0.022?"High":atrPct<0.009?"Compressed":"Normal";
  return {bull,bear,neutral,pUp,pDown,pRange,support,resistance,trend,momentum,volatility,volRatio,atrPct};
}

function resolveOutcome(data,end,horizon=10) {
  const start=data[end].close;
  const endIdx=Math.min(data.length-1,end+horizon);
  const future=data.slice(end+1,endIdx+1);
  const final=future.length?future[future.length-1].close:start;
  const ret=(final/start)-1;
  const threshold=Math.max(0.006, data[end].atr/data[end].close*0.5);
  let outcome="Range";
  if(ret>threshold) outcome="Up";
  else if(ret<-threshold) outcome="Down";
  const maxHigh=future.length?Math.max(...future.map(x=>x.high)):start;
  const minLow=future.length?Math.min(...future.map(x=>x.low)):start;
  return {outcome,ret,threshold,endIdx,maxHigh,minLow};
}

const LESSONS = [
  {
    title:"1. What a chart actually tells you",
    level:"Foundation",
    body:`A price chart is a compressed record of auction outcomes, not a crystal ball. Every bar summarizes where buyers and sellers transacted. Technical analysis is strongest when it asks conditional questions: “Given trend, location, volatility, momentum, and participation, which outcomes are more or less likely?” It is weakest when a single pattern is treated as deterministic.

Professional habit: separate observation from inference. “Price is above the 20 EMA” is an observation. “Therefore it must rise tomorrow” is an unjustified inference.`
  },
  {
    title:"2. Candlestick anatomy",
    level:"Foundation",
    body:`A candle contains open, high, low, and close. The body shows the distance between open and close. Wicks show excursions that were not sustained by the close.

A long lower wick near support can show rejection, but context matters. The same candle in a strong downtrend can merely be temporary short-covering. A large body on expanding volume has more informational weight than the same body on weak volume.`
  },
  {
    title:"3. Line charts and closing-price structure",
    level:"Foundation",
    body:`Line charts remove intrabar noise and emphasize closing-price structure. They are useful for seeing trend slope, swing progression, compression, rounded formations, and major support/resistance.

Use line charts when candle detail is distracting. Switch back to candles when rejection, gaps, body size, or intrabar volatility matters.`
  },
  {
    title:"4. Trend and market structure",
    level:"Core",
    body:`An uptrend usually shows higher swing highs and higher swing lows. A downtrend usually shows lower highs and lower lows. Ranges alternate around relatively stable boundaries.

Trend is not merely “price above a moving average.” Moving averages summarize the same price data with lag. Structure, slope, and acceptance above or below prior levels matter more than a single crossover.`
  },
  {
    title:"5. Support and resistance",
    level:"Core",
    body:`Support and resistance are zones, not exact lines. They represent areas where prior auction behavior changed. The more obvious the level, the more traders may watch it—but repeated tests can either validate it or weaken the remaining resting interest.

A professional framework asks: How did price arrive? Was the approach impulsive or weak? Is volume expanding? Is the level being accepted through or rejected away from?`
  },
  {
    title:"6. Breakouts and failed breakouts",
    level:"Core",
    body:`A breakout becomes more persuasive when price closes beyond a well-observed boundary, participation expands, volatility increases in the breakout direction, and follow-through appears.

A failed breakout occurs when price trades beyond a level but cannot sustain acceptance. Failed breakouts can be powerful because trapped participants may accelerate the move back through the range.`
  },
  {
    title:"7. Moving averages",
    level:"Core",
    body:`EMAs are trend filters, not predictive engines. A fast EMA reacts quickly; a slower EMA smooths more noise. Alignment—price > fast > medium > slow—can summarize trend health.

Do not blindly trade crossovers. Crossovers lag and often whipsaw in ranges. Their value improves when combined with structure and volatility regime.`
  },
  {
    title:"8. RSI",
    level:"Core",
    body:`RSI measures the balance of recent gains and losses. “Overbought” does not mean “must fall.” In strong uptrends RSI can remain elevated for long periods. “Oversold” can persist in downtrends.

More useful questions: Is RSI confirming price momentum? Is it failing to confirm a new extreme? Is it cycling around a bullish or bearish range?`
  },
  {
    title:"9. MACD",
    level:"Core",
    body:`MACD compares two exponential averages and then compares that spread with a signal line. It highlights momentum shifts but is derived entirely from price.

Its best use is contextual: confirmation of acceleration, deceleration, or divergence—not as a standalone buy/sell switch.`
  },
  {
    title:"10. ATR and volatility",
    level:"Core",
    body:`ATR estimates recent trading range. It does not predict direction. It tells you how much movement is normal for the current regime.

When ATR expands, outcomes disperse more widely and position sizing would normally need to shrink. When ATR compresses, a breakout may be developing—but direction is not known from compression alone.`
  },
  {
    title:"11. Volume and participation",
    level:"Advanced",
    body:`Volume can strengthen or weaken a price narrative. A breakout with expanding participation is generally more informative than one on thin volume. Large volume with little net progress can also signal two-sided absorption.

Volume is market-specific. Centralized equity volume is different from fragmented or synthetic markets. Always know what your data actually represents.`
  },
  {
    title:"12. Multi-factor confluence",
    level:"Advanced",
    body:`Confluence means independent evidence points in the same direction. Good confluence might combine trend structure, location, momentum, volume, and volatility.

Avoid “indicator stacking” where five indicators are all derived from the same price transformation and appear to provide five independent votes. They often do not.`
  },
  {
    title:"13. Probability, not certainty",
    level:"Advanced",
    body:`The correct question is rarely “Will it go up?” It is “What probability do I assign to each plausible outcome?”

A 60% forecast should be right about 60% of the time over many comparable cases. Calibration matters more than bravado. This app uses a Brier-style score so overconfidence is penalized.`
  },
  {
    title:"14. Expected value",
    level:"Advanced",
    body:`Being right more often is not enough. A strategy can win 70% of the time and still lose money if losses are much larger than wins. Expected value depends on probability and payoff asymmetry.

This trainer intentionally separates chart-reading skill from trade execution. First learn to estimate scenarios well. Then, separately, learn risk sizing and payoff structure.`
  },
  {
    title:"15. Common chart-reading traps",
    level:"Advanced",
    body:`Major traps include hindsight bias, seeing patterns in noise, moving a level after the fact, ignoring the higher-timeframe regime, over-weighting one candle, treating indicators as independent evidence, and confusing a plausible narrative with statistical edge.

The cure is process: define what you knew at the decision point, assign probabilities, reveal the future, then grade the forecast without changing the original thesis.`
  },
  {
    title:"16. Professional review process",
    level:"Expert",
    body:`Before forecast: identify regime, structure, key levels, volatility, momentum, and participation. Write invalidation conditions. Assign probabilities.

After resolution: separate bad process from bad outcome. A high-quality 65% bullish forecast can still resolve down. The question is whether repeated forecasts with similar confidence calibrate correctly over a large sample.`
  }
];

function CandlestickChart({data,start,end,revealEnd,chartType,showEMA,showLevels,analysisInfo,height=390}) {
  const ref=useRef(null);
  const [size,setSize]=useState({w:900,h:height});
  useEffect(()=>{
    const obs=new ResizeObserver(([e])=>setSize({w:e.contentRect.width,h:height}));
    if(ref.current) obs.observe(ref.current);
    return ()=>obs.disconnect();
  },[height]);

  const vis=data.slice(start,revealEnd+1);
  const knownCount=end-start+1;
  const w=size.w,h=size.h,pad={l:12,r:58,t:18,b:28};
  const plotW=Math.max(100,w-pad.l-pad.r), plotH=h-pad.t-pad.b;
  const minP=Math.min(...vis.map(d=>d.low))*0.995;
  const maxP=Math.max(...vis.map(d=>d.high))*1.005;
  const y=p=>pad.t+(maxP-p)/(maxP-minP)*plotH;
  const x=i=>pad.l+(i+.5)/vis.length*plotW;
  const step=plotW/vis.length;
  const futureStartX=pad.l+knownCount/vis.length*plotW;

  let path="";
  vis.forEach((d,i)=>{path+=(i?"L":"M")+`${x(i)},${y(d.close)} `});
  const emaPath=(key)=>{
    let p="";
    vis.forEach((d,i)=>{if(Number.isFinite(d[key])) p+=(p?"L":"M")+`${x(i)},${y(d[key])} `});
    return p;
  };
  const priceTicks=Array.from({length:6},(_,i)=>minP+(maxP-minP)*i/5);

  return <div className="chartWrap" ref={ref}>
    <svg width={w} height={h} className="chartSvg" role="img" aria-label="Market chart">
      <rect x="0" y="0" width={w} height={h} className="chartBg" rx="14"/>
      {priceTicks.map((p,i)=><g key={i}>
        <line x1={pad.l} x2={pad.l+plotW} y1={y(p)} y2={y(p)} className="grid"/>
        <text x={w-4} y={y(p)+4} textAnchor="end" className="axisText">{fmt(p)}</text>
      </g>)}
      {showLevels && analysisInfo && <>
        <line x1={pad.l} x2={pad.l+plotW} y1={y(analysisInfo.support)} y2={y(analysisInfo.support)} className="support"/>
        <line x1={pad.l} x2={pad.l+plotW} y1={y(analysisInfo.resistance)} y2={y(analysisInfo.resistance)} className="resistance"/>
      </>}
      {chartType==="line" ? <path d={path} className="linePrice"/> :
      vis.map((d,i)=>{
        const up=d.close>=d.open;
        const cx=x(i), bw=Math.max(2,step*.58);
        return <g key={i} className={i>=knownCount?"futureCandle":""}>
          <line x1={cx} x2={cx} y1={y(d.high)} y2={y(d.low)} className={up?"wick up":"wick down"}/>
          <rect x={cx-bw/2} y={Math.min(y(d.open),y(d.close))}
            width={bw} height={Math.max(1.5,Math.abs(y(d.open)-y(d.close)))}
            className={up?"candle up":"candle down"} rx="1"/>
        </g>
      })}
      {showEMA && <>
        <path d={emaPath("ema9")} className="ema ema9"/>
        <path d={emaPath("ema20")} className="ema ema20"/>
        <path d={emaPath("ema50")} className="ema ema50"/>
      </>}
      {revealEnd>end && <>
        <rect x={futureStartX} y={pad.t} width={pad.l+plotW-futureStartX} height={plotH} className="futureShade"/>
        <line x1={futureStartX} x2={futureStartX} y1={pad.t} y2={pad.t+plotH} className="decisionLine"/>
        <text x={futureStartX+6} y={pad.t+16} className="futureLabel">REVEALED FUTURE</text>
      </>}
    </svg>
  </div>
}

function ProbabilityBars({up,down,range}) {
  return <div className="probBars">
    <div><span>Up</span><div className="bar"><i style={{width:`${up*100}%`}} className="bu"/></div><b>{pct(up)}</b></div>
    <div><span>Range</span><div className="bar"><i style={{width:`${range*100}%`}} className="br"/></div><b>{pct(range)}</b></div>
    <div><span>Down</span><div className="bar"><i style={{width:`${down*100}%`}} className="bd"/></div><b>{pct(down)}</b></div>
  </div>
}

function brier(pred, outcome) {
  const truth={Up:0,Down:0,Range:0}; truth[outcome]=1;
  return ((pred.Up-truth.Up)**2+(pred.Down-truth.Down)**2+(pred.Range-truth.Range)**2)/3;
}

function App() {
  const [dataset,setDataset]=useState(()=>generateMarket(Date.now()%1000000000,1100));
  const [exercise,setExercise]=useState(null);
  const [resolved,setResolved]=useState(false);
  const [pred,setPred]=useState({Up:45,Range:20,Down:35});
  const [chartType,setChartType]=useState("candles");
  const [showEMA,setShowEMA]=useState(true);
  const [showLevels,setShowLevels]=useState(true);
  const [tab,setTab]=useState("Practice");
  const [difficulty,setDifficulty]=useState("Intermediate");
  const [horizon,setHorizon]=useState(10);
  const [lesson,setLesson]=useState(0);
  const [history,setHistory]=useState(()=>JSON.parse(localStorage.getItem("mca_history")||"[]"));

  const makeExercise=()=>{
    const min=120, max=dataset.length-horizon-2;
    const end=Math.floor(min+Math.random()*(max-min));
    let lookback=difficulty==="Beginner"?55:difficulty==="Intermediate"?75:difficulty==="Advanced"?95:120;
    const start=Math.max(0,end-lookback+1);
    const a=analyze(dataset,end);
    setExercise({start,end,analysis:a});
    setResolved(false);
    setPred({Up:45,Range:20,Down:35});
    setTab("Practice");
  };

  useEffect(()=>{ if(!exercise) makeExercise(); },[]);

  const normalizedPred=useMemo(()=>{
    const total=pred.Up+pred.Down+pred.Range;
    if(total<=0) return {Up:1/3,Down:1/3,Range:1/3};
    return {Up:pred.Up/total,Down:pred.Down/total,Range:pred.Range/total};
  },[pred]);

  const result=exercise?resolveOutcome(dataset,exercise.end,horizon):null;

  const resolve=()=>{
    if(!exercise) return;
    const r=resolveOutcome(dataset,exercise.end,horizon);
    const np=normalizedPred;
    const bs=brier(np,r.outcome);
    const best=Object.entries(np).sort((a,b)=>b[1]-a[1])[0][0];
    const rec={
      id:Date.now(), date:new Date().toLocaleString(), difficulty,horizon,
      outcome:r.outcome, return:r.ret, pick:best, correct:best===r.outcome,
      brier:bs, pred:np
    };
    const h=[rec,...history].slice(0,250);
    setHistory(h); localStorage.setItem("mca_history",JSON.stringify(h));
    setResolved(true);
  };

  const clearStats=()=>{
    if(confirm("Clear all saved training history on this device?")){
      setHistory([]);localStorage.removeItem("mca_history");
    }
  };

  const stats=useMemo(()=>{
    if(!history.length)return {n:0,acc:0,brier:0,conf:0};
    const acc=history.filter(x=>x.correct).length/history.length;
    const b=history.reduce((s,x)=>s+x.brier,0)/history.length;
    const conf=history.reduce((s,x)=>s+Math.max(x.pred.Up,x.pred.Down,x.pred.Range),0)/history.length;
    return {n:history.length,acc,brier:b,conf};
  },[history]);

  const regenerate=()=>{
    setDataset(generateMarket(Math.floor(Math.random()*1e9),1100));
    setExercise(null);setResolved(false);
    setTimeout(()=>{},0);
  };

  useEffect(()=>{
    if(!exercise && dataset.length) makeExercise();
  },[dataset]);

  const current=exercise?dataset[exercise.end]:null;
  const r=result;

  return <div className="app">
    <header>
      <div className="brand">
        <div className="logo">M</div>
        <div>
          <h1>Market Chart Academy</h1>
          <p>Technical analysis • probability • replay • calibration</p>
        </div>
      </div>
      <div className="headerStats">
        <span><b>{stats.n}</b> drills</span>
        <span><b>{pct(stats.acc)}</b> top-pick accuracy</span>
        <span><b>{fmt(stats.brier,3)}</b> Brier</span>
      </div>
    </header>

    <nav className="tabs">
      {["Practice","Lessons","Playbook","Progress"].map(t=><button key={t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{t}</button>)}
    </nav>

    {tab==="Practice" && exercise && <>
      <section className="toolbar card">
        <div className="field">
          <label>Difficulty</label>
          <select value={difficulty} onChange={e=>setDifficulty(e.target.value)}>
            <option>Beginner</option><option>Intermediate</option><option>Advanced</option><option>Expert</option>
          </select>
        </div>
        <div className="field">
          <label>Forecast horizon</label>
          <select value={horizon} onChange={e=>setHorizon(+e.target.value)}>
            <option value="5">5 bars</option><option value="10">10 bars</option><option value="20">20 bars</option>
          </select>
        </div>
        <div className="segmented">
          <button className={chartType==="candles"?"on":""} onClick={()=>setChartType("candles")}>Candles</button>
          <button className={chartType==="line"?"on":""} onClick={()=>setChartType("line")}>Line</button>
        </div>
        <label className="toggle"><input type="checkbox" checked={showEMA} onChange={e=>setShowEMA(e.target.checked)}/> EMAs</label>
        <label className="toggle"><input type="checkbox" checked={showLevels} onChange={e=>setShowLevels(e.target.checked)}/> Levels</label>
        <button className="ghost" onClick={regenerate}>New market</button>
      </section>

      <section className="practiceGrid">
        <div className="mainColumn">
          <div className="card chartCard">
            <div className="chartHeader">
              <div>
                <span className="eyebrow">HIDDEN-FUTURE EXERCISE</span>
                <h2>Read only what is known at the decision line</h2>
              </div>
              <div className="quote">
                <b>${fmt(current.close)}</b>
                <small>RSI {fmt(current.rsi,0)} • ATR {pct(current.atr/current.close)}</small>
              </div>
            </div>
            <CandlestickChart
              data={dataset}
              start={exercise.start}
              end={exercise.end}
              revealEnd={resolved?r.endIdx:exercise.end}
              chartType={chartType}
              showEMA={showEMA}
              showLevels={showLevels}
              analysisInfo={exercise.analysis}
            />
            <div className="legend">
              <span className="dot e9"></span>EMA 9
              <span className="dot e20"></span>EMA 20
              <span className="dot e50"></span>EMA 50
              <span className="lineLegend supportL"></span>Support zone
              <span className="lineLegend resistanceL"></span>Resistance zone
            </div>
          </div>

          {!resolved ? <div className="card forecast">
            <div className="sectionTitle">
              <div><span className="eyebrow">YOUR FORECAST</span><h2>Assign probabilities, not certainty</h2></div>
              <div className={"sum "+(pred.Up+pred.Down+pred.Range===100?"ok":"bad")}>Total {pred.Up+pred.Down+pred.Range}%</div>
            </div>
            {["Up","Range","Down"].map(k=><div className="sliderRow" key={k}>
              <label>{k}</label>
              <input type="range" min="0" max="100" value={pred[k]} onChange={e=>setPred({...pred,[k]:+e.target.value})}/>
              <input className="num" type="number" min="0" max="100" value={pred[k]} onChange={e=>setPred({...pred,[k]:clamp(+e.target.value,0,100)})}/>
              <span>%</span>
            </div>)}
            <p className="hint">Your percentages are normalized for scoring, but forcing yourself to total 100% is good forecasting discipline.</p>
            <button className="primary big" onClick={resolve}>Lock forecast & reveal future</button>
          </div> :
          <div className="card resolution">
            <span className="eyebrow">RESOLUTION</span>
            <div className="outcomeRow">
              <div>
                <h2>Outcome: <span className={"outcome "+r.outcome.toLowerCase()}>{r.outcome}</span></h2>
                <p>{horizon}-bar return: <b>{pct(r.ret)}</b> • Classification threshold: ±{pct(r.threshold)}</p>
              </div>
              <button className="primary" onClick={makeExercise}>Next exercise</button>
            </div>
            <div className="compareGrid">
              <div>
                <h3>Your probabilities</h3>
                <ProbabilityBars up={normalizedPred.Up} down={normalizedPred.Down} range={normalizedPred.Range}/>
              </div>
              <div>
                <h3>Model's pre-reveal evidence estimate</h3>
                <ProbabilityBars up={exercise.analysis.pUp} down={exercise.analysis.pDown} range={exercise.analysis.pRange}/>
              </div>
            </div>
            <div className="scoreStrip">
              <div><span>Brier score</span><b>{fmt(brier(normalizedPred,r.outcome),3)}</b><small>Lower is better; 0 is perfect.</small></div>
              <div><span>Maximum favorable excursion</span><b>{pct((r.maxHigh-current.close)/current.close)}</b><small>Best upside during horizon.</small></div>
              <div><span>Maximum adverse excursion</span><b>{pct((r.minLow-current.close)/current.close)}</b><small>Worst downside during horizon.</small></div>
            </div>
          </div>}
        </div>

        <aside className="sideColumn">
          <div className="card context">
            <span className="eyebrow">MARKET CONTEXT</span>
            <div className="metricGrid">
              <div><small>Trend</small><b>{exercise.analysis.trend}</b></div>
              <div><small>Momentum</small><b>{exercise.analysis.momentum}</b></div>
              <div><small>Volatility</small><b>{exercise.analysis.volatility}</b></div>
              <div><small>Volume</small><b>{fmt(exercise.analysis.volRatio,2)}× avg</b></div>
            </div>
            <div className="levels">
              <div><span>Support</span><b>${fmt(exercise.analysis.support)}</b></div>
              <div><span>Resistance</span><b>${fmt(exercise.analysis.resistance)}</b></div>
            </div>
          </div>

          <div className="card checklist">
            <span className="eyebrow">PRO ANALYSIS CHECKLIST</span>
            <ol>
              <li>Identify regime before pattern.</li>
              <li>Mark recent swing structure.</li>
              <li>Locate price relative to major levels.</li>
              <li>Check trend alignment.</li>
              <li>Read momentum without treating it as destiny.</li>
              <li>Evaluate volatility regime.</li>
              <li>Judge volume / participation.</li>
              <li>Write competing bullish and bearish cases.</li>
              <li>Assign probabilities.</li>
              <li>Define what would invalidate the thesis.</li>
            </ol>
          </div>

          {resolved && <div className="card evidence">
            <span className="eyebrow">WHAT WAS KNOWABLE BEFORE REVEAL</span>
            <h3 className="bullText">Bullish evidence</h3>
            <ul>{exercise.analysis.bull.length?exercise.analysis.bull.map((x,i)=><li key={i}>{x}</li>):<li>No strong bullish factor identified.</li>}</ul>
            <h3 className="bearText">Bearish evidence</h3>
            <ul>{exercise.analysis.bear.length?exercise.analysis.bear.map((x,i)=><li key={i}>{x}</li>):<li>No strong bearish factor identified.</li>}</ul>
            <h3>Ambiguity / caution</h3>
            <ul>{exercise.analysis.neutral.length?exercise.analysis.neutral.map((x,i)=><li key={i}>{x}</li>):<li>No unusual caution factor.</li>}</ul>
            <p className="note"><b>Key lesson:</b> the resolved future does not retroactively make the losing thesis irrational. Grade the quality and calibration of the forecast using information available at the decision point.</p>
          </div>}
        </aside>
      </section>
    </>}

    {tab==="Lessons" && <section className="lessonLayout">
      <div className="card lessonList">
        <span className="eyebrow">CURRICULUM</span>
        {LESSONS.map((l,i)=><button key={i} className={lesson===i?"selected":""} onClick={()=>setLesson(i)}>
          <span>{l.level}</span>{l.title}
        </button>)}
      </div>
      <article className="card lessonBody">
        <span className="eyebrow">{LESSONS[lesson].level.toUpperCase()}</span>
        <h2>{LESSONS[lesson].title}</h2>
        {LESSONS[lesson].body.split("\n\n").map((p,i)=><p key={i}>{p}</p>)}
        <div className="lessonCallout">
          <b>Training prompt</b>
          <p>Open Practice, hide or show indicators as needed, and describe the chart in neutral observational language before making a forecast.</p>
        </div>
      </article>
    </section>}

    {tab==="Playbook" && <section className="playbook">
      <div className="card"><span className="eyebrow">SETUP PLAYBOOK</span><h2>Trend continuation</h2><p>Look for aligned structure, controlled pullback, maintained support, momentum stabilization, and renewed participation. Avoid entering merely because a candle is green.</p><b>Invalidation concept:</b><p>Loss of the pullback structure and acceptance beneath the level that should have held.</p></div>
      <div className="card"><span className="eyebrow">SETUP PLAYBOOK</span><h2>Breakout</h2><p>Prefer a meaningful boundary, close outside the range, participation expansion, and follow-through. A wick through resistance without acceptance is not equivalent to a confirmed breakout.</p><b>Failure clue:</b><p>Rapid return into the prior range, especially after a high-volume probe.</p></div>
      <div className="card"><span className="eyebrow">SETUP PLAYBOOK</span><h2>Mean reversion</h2><p>Best considered when price is stretched from its local mean, momentum is extreme, and the larger structure does not support continued acceleration. Strong trends can stay stretched much longer than expected.</p></div>
      <div className="card"><span className="eyebrow">SETUP PLAYBOOK</span><h2>Range rotation</h2><p>Ranges reward location. Middle-of-range forecasts usually have poor asymmetry. Near boundaries, look for either rejection back toward the center or genuine acceptance through the edge.</p></div>
      <div className="card"><span className="eyebrow">SETUP PLAYBOOK</span><h2>Compression / expansion</h2><p>Falling ATR and narrowing structure can precede expansion. Compression says movement may increase; it does not tell you direction. Use the breakout evidence to determine directional bias.</p></div>
      <div className="card"><span className="eyebrow">SETUP PLAYBOOK</span><h2>Failed move</h2><p>A failed breakout or breakdown can be informative because traders positioned for continuation may be forced to exit. Watch whether price rapidly reclaims or loses the breached level.</p></div>
      <div className="card wide">
        <span className="eyebrow">DECISION TEMPLATE</span>
        <h2>Read every chart in this order</h2>
        <div className="decisionGrid">
          {["Regime","Structure","Location","Trend","Momentum","Volatility","Participation","Bull case","Bear case","Probabilities","Invalidation","Review"].map((x,i)=><div key={x}><b>{i+1}</b><span>{x}</span></div>)}
        </div>
      </div>
    </section>}

    {tab==="Progress" && <section className="progress">
      <div className="statCards">
        <div className="card"><small>Exercises</small><b>{stats.n}</b></div>
        <div className="card"><small>Top-pick accuracy</small><b>{pct(stats.acc)}</b></div>
        <div className="card"><small>Average Brier</small><b>{fmt(stats.brier,3)}</b></div>
        <div className="card"><small>Average confidence</small><b>{pct(stats.conf)}</b></div>
      </div>
      <div className="card">
        <div className="sectionTitle"><div><span className="eyebrow">TRAINING LOG</span><h2>Recent probability forecasts</h2></div><button className="ghost" onClick={clearStats}>Clear</button></div>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Date</th><th>Horizon</th><th>Forecast</th><th>Outcome</th><th>Return</th><th>Brier</th></tr></thead>
            <tbody>
              {history.length?history.slice(0,50).map(x=><tr key={x.id}>
                <td>{x.date}</td><td>{x.horizon}</td>
                <td>↑{Math.round(x.pred.Up*100)} / ↔{Math.round(x.pred.Range*100)} / ↓{Math.round(x.pred.Down*100)}</td>
                <td><b>{x.outcome}</b></td><td>{pct(x.return)}</td><td>{fmt(x.brier,3)}</td>
              </tr>):<tr><td colSpan="6">Complete prediction exercises to build your calibration history.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card education">
        <h2>How to interpret your score</h2>
        <p><b>Accuracy</b> only checks whether your single highest-probability outcome won. <b>Brier score</b> grades the whole probability distribution, so saying “95% up” and being wrong is punished much more than saying “55% up.”</p>
        <p>A professional forecaster should seek calibration: events assigned around 60% probability should occur around 60% of the time over a sufficiently large sample of comparable cases.</p>
      </div>
    </section>}

    <footer>
      Educational simulator only. Technical analysis cannot guarantee future market direction. Synthetic scenarios are used so the future can be hidden and revealed without look-ahead leakage.
    </footer>
  </div>
}

createRoot(document.getElementById("root")).render(<App/>);


if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
