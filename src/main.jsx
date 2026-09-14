import React, {useEffect, useMemo, useRef, useState} from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmt=(v,d=2)=>Number.isFinite(v)?v.toFixed(d):"—";
const norm=s=>String(s??"").toLowerCase().replace(/[^a-z0-9.%+\- ]/g," ").replace(/\s+/g," ").trim();
const seeded=(seed=1)=>{let x=seed>>>0;return()=>((x=(1664525*x+1013904223)>>>0)/4294967296)};
const gauss=r=>{let u=0,v=0;while(!u)u=r();while(!v)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
function ema(v,n){let a=2/(n+1),p=v[0];return v.map((x,i)=>(p=i?x*a+p*(1-a):x))}
function rsi(c,n=14){let o=Array(c.length).fill(50),g=0,l=0;for(let i=1;i<c.length;i++){let d=c[i]-c[i-1],up=Math.max(d,0),dn=Math.max(-d,0);if(i<=n){g+=up/n;l+=dn/n}else{g=(g*(n-1)+up)/n;l=(l*(n-1)+dn)/n}if(i>=n)o[i]=l===0?100:100-100/(1+g/l)}return o}
function atr(d,n=14){let tr=d.map((x,i)=>i?Math.max(x.high-x.low,Math.abs(x.high-d[i-1].close),Math.abs(x.low-d[i-1].close)):x.high-x.low),p=tr[0];return tr.map((x,i)=>(p=i?(p*(n-1)+x)/n:x))}
function market(seed=1,n=260){
  const r=seeded(seed), out=[]; let close=100, anchor=100, regime="range", left=0;
  for(let i=0;i<n;i++){
    if(left<=0){regime=["up","down","range","compress","volatile"][Math.floor(r()*5)];left=28+Math.floor(r()*55);anchor=close} left--;
    let drift=0,vol=.008;if(regime==="up")drift=.0015;if(regime==="down")drift=-.0014;if(regime==="range")drift=(anchor-close)/close*.08;if(regime==="compress")vol=.0035;if(regime==="volatile")vol=.018;
    let ret=drift+gauss(r)*vol, open=close*(1+gauss(r)*.002); close=Math.max(5,close*(1+ret));
    let spr=close*(.003+r()*.009), high=Math.max(open,close)+spr*r(), low=Math.max(.1,Math.min(open,close)-spr*r());
    out.push({open,high,low,close,volume:Math.round((4e5+r()*1.2e6)*(1+Math.abs(ret)*20)),regime});
  }
  let c=out.map(x=>x.close),e9=ema(c,9),e20=ema(c,20),e50=ema(c,50),rr=rsi(c),aa=atr(out);
  return out.map((x,i)=>({...x,ema9:e9[i],ema20:e20[i],ema50:e50[i],rsi:rr[i],atr:aa[i]}));
}
function describe(d,i){
  const x=d[i], p=d[Math.max(0,i-20)], ret=x.close/p.close-1;
  return {
    trend:x.close>x.ema20&&x.ema20>x.ema50?"bullish":x.close<x.ema20&&x.ema20<x.ema50?"bearish":"mixed",
    momentum:x.rsi>=60?"strong":x.rsi<=40?"weak":"neutral",
    ret20:ret, atrp:x.atr/x.close
  };
}
function Chart({data,end=90,reveal=0,height=250}){
  const ref=useRef(null),[w,setW]=useState(700);
  useEffect(()=>{let o=new ResizeObserver(([e])=>setW(e.contentRect.width));if(ref.current)o.observe(ref.current);return()=>o.disconnect()},[]);
  const start=Math.max(0,end-59),last=Math.min(data.length-1,end+reveal),vis=data.slice(start,last+1),known=end-start+1;
  const lo=Math.min(...vis.map(x=>x.low))*.997, hi=Math.max(...vis.map(x=>x.high))*1.003,pad=14, pw=w-54, ph=height-30;
  const X=i=>pad+(i+.5)*pw/vis.length,Y=p=>10+(hi-p)/(hi-lo)*ph,step=pw/vis.length;
  return <div ref={ref} className="miniChart"><svg width={w} height={height}>
    <rect width={w} height={height} rx="12" className="chartBg"/>
    {[0,1,2,3,4].map(k=><line key={k} x1={pad} x2={pad+pw} y1={10+k*ph/4} y2={10+k*ph/4} className="grid"/>)}
    {vis.map((d,i)=>{let up=d.close>=d.open,bw=Math.max(2,step*.55);return <g key={i} opacity={i>=known?0.82:1}>
      <line x1={X(i)} x2={X(i)} y1={Y(d.high)} y2={Y(d.low)} className={up?"wick up":"wick down"}/>
      <rect x={X(i)-bw/2} y={Math.min(Y(d.open),Y(d.close))} width={bw} height={Math.max(1,Math.abs(Y(d.open)-Y(d.close)))} className={up?"candle up":"candle down"}/>
    </g>})}
    {reveal>0&&<><rect x={pad+known*step} y="10" width={Math.max(0,(vis.length-known)*step)} height={ph} className="futureShade"/><line x1={pad+known*step} x2={pad+known*step} y1="10" y2={10+ph} className="decisionLine"/></>}
  </svg></div>
}

const lessons=[
["Chart literacy","A chart is a historical record of an auction, not a prophecy. Your job is to separate observations from interpretations and then convert interpretations into conditional probabilities. Price, time, range, volume, and location are evidence; none of them individually guarantee the next move.\n\nProfessionals continuously distinguish what is known from what is inferred. “Price closed above yesterday’s high” is observable. “Price must continue higher” is not. This lesson trains disciplined chart description before prediction."],
["Candlestick anatomy","Candlesticks encode open, high, low, and close. Bodies reveal net movement between open and close while wicks reveal excursions that did not persist through the close. Large bodies imply directional displacement; long wicks can imply rejection, but only in context.\n\nA hammer at support after exhaustion can matter more than an identical hammer in the middle of noise. Candle interpretation should always incorporate preceding trend, location, volatility, and subsequent confirmation."],
["Line-chart structure","Line charts emphasize closing-price structure by removing intrabar detail. They are useful for identifying swing progression, trend slope, ranges, compression, and major turning points without being distracted by individual wicks.\n\nUse line charts to answer structural questions first, then candles to inspect execution detail. A clean sequence of higher closes and higher swing lows often communicates trend more clearly than dozens of individual candles."],
["Trend & swings","An uptrend is best described by persistent higher swing highs and higher swing lows; a downtrend by lower highs and lower lows. Moving averages can summarize trend but should not replace structure analysis.\n\nTrends mature, weaken, and transition. A broken swing does not automatically reverse the trend, but repeated failure to extend plus structural violation raises the probability of transition or range."],
["Support & resistance","Support and resistance are zones where prior order flow caused meaningful response. Treat them as areas rather than exact single-price lines because real markets rarely reverse at a mathematically perfect tick.\n\nThe quality of a level depends on context: prior reactions, approach speed, time spent at the level, volume, and whether price is rejected or accepted beyond it. Repeated testing can either validate a level or consume resting liquidity."],
["Breakouts","A breakout is acceptance beyond a prior boundary, not merely a wick through it. Stronger breakouts often combine a meaningful level, decisive close, expanding participation, and follow-through.\n\nFailed breakouts are equally important. A move outside a range that quickly returns inside can trap continuation traders and create fuel in the opposite direction. Confirmation reduces false-breakout risk but never eliminates it."],
["Moving averages","Moving averages smooth price and help summarize direction and trend alignment. Short EMAs react quickly; longer averages react slowly. Price above a rising fast EMA above a rising slow EMA is evidence of trend health.\n\nCrossovers are lagging by design and frequently whipsaw in ranges. Their usefulness increases when combined with structure, location, and volatility rather than treated as standalone signals."],
["RSI & momentum","RSI compares recent gains and losses to estimate momentum. Overbought does not mean price must fall and oversold does not mean price must rise. Strong trends can remain extreme for extended periods.\n\nUse RSI to evaluate momentum regime, acceleration, and divergence. An elevated RSI within a healthy uptrend can confirm strength, while weakening RSI during marginal new highs can warn that momentum is no longer confirming price."],
["Volatility & ATR","ATR estimates recent trading range and therefore expected movement magnitude, not direction. High ATR means outcomes are more dispersed; low ATR suggests compression and smaller recent movement.\n\nVolatility changes how every setup should be interpreted. A one-dollar move is enormous for a quiet ten-dollar stock and insignificant for a volatile thousand-dollar stock. Normalize movement whenever possible."],
["Volume","Volume is a proxy for participation. Expanding volume can strengthen the informational value of a breakout or reversal, while weak volume can make a move less convincing.\n\nVolume must be interpreted with price response. High volume plus little directional progress may imply absorption. High volume plus large range and close near the extreme may imply forceful acceptance."],
["Ranges & mean reversion","Ranges are two-sided auctions in which neither side maintains sustained control. Location becomes especially important: trades or forecasts near range extremes often have better asymmetry than opinions formed in the middle.\n\nMean reversion works until regime changes. A range boundary that repeatedly rejects price can eventually break; therefore always distinguish fading an extreme from blindly assuming every extreme must revert."],
["Compression & expansion","Volatility often cycles between compression and expansion. Tight ranges, declining ATR, and reduced candle size indicate stored uncertainty, but compression itself does not reveal direction.\n\nDirection should be inferred from the break and its confirmation. The key skill is recognizing when the probability of a large move is rising while remaining agnostic about direction until evidence appears."],
["Confluence","Confluence means multiple genuinely distinct pieces of evidence support the same scenario. Trend, structure, location, volume, and volatility can provide independent context; five oscillators derived from the same closes do not provide five independent votes.\n\nThe objective is not to accumulate indicators. It is to combine nonredundant evidence into a coherent probability estimate and identify what evidence would invalidate that estimate."],
["Probability & calibration","Technical analysis is probabilistic. A good analyst assigns probabilities to competing outcomes and remains comfortable being wrong on individual cases. A 60% event should occur about 60% of the time over a sufficiently large comparable sample.\n\nCalibration penalizes unjustified certainty. Saying 95% bullish and being wrong is much worse than saying 55% bullish and being wrong. Forecast quality therefore depends on both discrimination and confidence."],
["Expected value & risk","Prediction accuracy is not the same as profitability. Expected value combines probability with payoff magnitude. A system can win frequently yet lose money if average losses dominate average wins.\n\nRisk should be considered relative to volatility and invalidation. Technical analysis identifies scenarios; risk management decides whether a scenario is worth taking and how much exposure is appropriate."],
["Integrated analysis","Professional analysis integrates regime, structure, location, momentum, volatility, participation, and competing scenarios. No single candle or indicator gets veto power over the entire chart.\n\nThe final skill is process discipline: analyze only information visible at the decision point, assign probabilities, define invalidation, reveal the outcome, and review process separately from luck."]
];

const keyFor=(li,variant)=>{
  const base=[
    ["historical record","auction","observation","probability"],
    ["open","high","low","close","wick","body"],
    ["closing","structure","swing","trend"],
    ["higher high","higher low","lower high","lower low"],
    ["zone","support","resistance","rejection","acceptance"],
    ["breakout","close","follow through","failed breakout"],
    ["moving average","ema","lag","trend"],
    ["rsi","momentum","overbought","oversold"],
    ["atr","volatility","range","direction"],
    ["volume","participation","absorption"],
    ["range","mean reversion","boundary","middle"],
    ["compression","expansion","volatility","direction"],
    ["confluence","independent","evidence","redundant"],
    ["probability","calibration","confidence","brier"],
    ["expected value","probability","payoff","risk"],
    ["regime","structure","location","momentum","volatility","volume"]
  ][li];
  return base;
};
function accepted(text,keys,min=1){let n=norm(text);return keys.filter(k=>n.includes(norm(k))).length>=min}

function lessonQuestion(li,idx,seed){
  const r=seeded(seed+li*10007+idx*193), data=market(Math.floor(r()*1e9),150), end=80+Math.floor(r()*45), info=describe(data,end);
  const type=idx%5;
  if(type===0){
    const prompts=[
      `In one or two sentences, state the central principle of ${lessons[li][0]} without claiming certainty.`,
      `Explain what evidence from ${lessons[li][0]} can tell you and what it cannot guarantee.`,
      `Name the most important analytical mistake this lesson is designed to prevent.`
    ];
    return {type:"text",prompt:prompts[idx%prompts.length],keys:keyFor(li),min:1,explain:lessons[li][1].split("\n\n")[0]};
  }
  if(type===1){
    const target= li===13 ? Math.round(45+r()*35) : li===8 ? Math.round(1+r()*4)*10 : Math.round(40+r()*40);
    const prompt=li===13?`A setup belongs to a class that historically resolves upward ${target}% of the time. Set the probability you should assign to “up” before considering any new evidence.`:
      li===8?`ATR is ${(target/10).toFixed(1)}% of price. Set the ATR percentage on the slider.`:
      `A historical sample shows ${target} successes out of 100 comparable cases. Set the empirical success probability.`;
    return {type:"slider",prompt,target,min:0,max:100,unit:"%",explain:`The target is ${target}%. Slider answers within ±5 percentage points receive credit.`};
  }
  if(type===2){
    let ans=info.trend;
    return {type:"chartText",prompt:"Classify the current trend as bullish, bearish, or mixed using the visible chart and structure.",data,end,keys:[ans],min:1,explain:`At the decision point the EMA/price alignment classifies this generated case as ${ans}.`};
  }
  if(type===3){
    const pct=Math.round(Math.abs(info.ret20)*1000)/10;
    return {type:"math",prompt:`Price moved from $${fmt(data[end-20].close)} to $${fmt(data[end].close)}. Calculate the approximate percentage change. Enter a signed percentage (for example, -3.2 or 4.1).`,target:info.ret20*100,tol:0.5,explain:`Percentage change = (new ÷ old − 1) × 100 = ${fmt(info.ret20*100,2)}%.`};
  }
  return {type:"chartText",prompt:`Using this chart, identify one relevant ${li%2===0?"trend/structure":"risk/context"} observation from the lesson.`,data,end,keys:keyFor(li),min:1,explain:`Acceptable answers use lesson vocabulary and tie it to visible evidence. Key concepts include: ${keyFor(li).join(", ")}.`};
}

function exampleFor(li,idx,seed){
 const q=lessonQuestion(li,idx+5,seed);
 return {...q,example:true};
}
function gradeQ(q,answer){
 if(q.type==="slider")return Math.abs(Number(answer)-q.target)<=5;
 if(q.type==="math")return Number.isFinite(Number(answer))&&Math.abs(Number(answer)-q.target)<=q.tol;
 return accepted(answer,q.keys,q.min||1);
}

function makeBank(){
 const bank=[];
 for(let i=0;i<1000;i++){
   let li=i%16, mode=i%10, r=seeded(900000+i*37), data=market(50000+i*331,170),end=90+Math.floor(r()*45),info=describe(data,end);
   if(mode<=2){
     const prompts=[
       `Explain the most important principle of ${lessons[li][0]} in professional, probabilistic language.`,
       `Describe one common analytical error associated with ${lessons[li][0]} and how to avoid it.`,
       `Define ${lessons[li][0]} in practical chart-reading terms.`
     ];
     bank.push({id:i,type:"text",lesson:li,prompt:prompts[mode],keys:keyFor(li),min:1,explain:lessons[li][1].split("\n\n")[0]});
   } else if(mode<=5){
     let t=mode===3?"trend":mode===4?"momentum":"volatility";
     let answer=t==="trend"?info.trend:t==="momentum"?info.momentum:(info.atrp>.018?"high":info.atrp<.008?"compressed":"normal");
     bank.push({id:i,type:"chartText",lesson:li,prompt:`Study the randomized chart. State the current ${t} classification and briefly justify it.`,data,end,keys:[answer,...keyFor(li)],min:1,explain:`The generated chart's primary ${t} classification is ${answer}.`});
   } else if(mode<=7){
     let target=25+Math.floor(r()*66);
     bank.push({id:i,type:"slider",lesson:li,prompt:`A dataset contains 100 comparable historical cases and ${target} resolved in the stated direction. Set the empirical probability of that outcome.`,target,min:0,max:100,unit:"%",explain:`${target}/100 = ${target}%. ±5 percentage points is accepted.`});
   } else {
     let old=50+r()*150, change=-.12+r()*.24, neu=old*(1+change);
     bank.push({id:i,type:"math",lesson:li,prompt:`A price changes from $${fmt(old)} to $${fmt(neu)}. Enter the percentage change, signed and rounded to one decimal if desired.`,target:change*100,tol:.5,explain:`(new ÷ old − 1) × 100 = ${fmt(change*100,2)}%.`});
   }
 }
 return bank;
}

function App(){
 const [view,setView]=useState("course"),[selected,setSelected]=useState(0),[seed,setSeed]=useState(()=>Date.now()%1e9);
 const [progress,setProgress]=useState(()=>JSON.parse(localStorage.getItem("mca_course_v2")||'{"scores":{},"passed":{},"attempts":{}}'));
 const [attempt,setAttempt]=useState(null),[exam,setExam]=useState(null);
 const bank=useMemo(()=>makeBank(),[]);
 const save=p=>{setProgress(p);localStorage.setItem("mca_course_v2",JSON.stringify(p))};
 const unlocked=i=>i===0||progress.passed[i-1];
 const allPassed=lessons.every((_,i)=>progress.passed[i]);

 function beginLesson(i){
   const qs=Array.from({length:20},(_,k)=>lessonQuestion(i,k,seed+Math.floor(Math.random()*1e8)));
   setAttempt({lesson:i,qs,answers:Array(20).fill(""),submitted:false,score:0,grades:[]});
 }
 function submitLesson(){
   let grades=attempt.qs.map((q,i)=>gradeQ(q,attempt.answers[i])), score=grades.filter(Boolean).length/grades.length*100, li=attempt.lesson;
   let p={...progress,scores:{...progress.scores,[li]:Math.max(progress.scores[li]||0,score)},passed:{...progress.passed},attempts:{...progress.attempts,[li]:(progress.attempts[li]||0)+1}};
   if(score>=95)p.passed[li]=true; save(p); setAttempt({...attempt,submitted:true,score,grades});
 }
 function startExam(){
   let ids=[...Array(1000).keys()];for(let i=ids.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]]}
   let qs=ids.slice(0,100).map(id=>bank[id]);setExam({qs,answers:Array(100).fill(""),submitted:false,score:0,grades:[]});setView("exam");
 }
 function submitExam(){
   let g=exam.qs.map((q,i)=>gradeQ(q,exam.answers[i])),score=g.filter(Boolean).length;
   setExam({...exam,submitted:true,score,grades:g});
   let p={...progress,examBest:Math.max(progress.examBest||0,score),examPassed:(progress.examPassed||false)||score>=80};save(p);
 }
 const L=lessons[selected], examples=useMemo(()=>Array.from({length:4},(_,i)=>exampleFor(selected,i,seed+selected*100)),[selected,seed]);

 return <div className="app">
   <header><div className="brand"><div className="logo">M</div><div><h1>Market Chart Academy Pro</h1><p>Mastery-gated technical analysis course + 100-question certification exam</p></div></div><div className="headerStats"><span><b>{Object.keys(progress.passed).length}/16</b> lessons passed</span><span><b>{progress.examBest||0}%</b> exam best</span></div></header>
   <nav className="tabs"><button className={view==="course"?"active":""} onClick={()=>setView("course")}>Course</button><button className={view==="exam"?"active":""} onClick={()=>setView("exam")}>Final Exam</button><button className={view==="progress"?"active":""} onClick={()=>setView("progress")}>Progress</button></nav>

   {view==="course"&&<div className="courseLayout">
     <aside className="card courseNav"><span className="eyebrow">MASTERY PATH</span>{lessons.map((l,i)=><button key={i} disabled={!unlocked(i)} className={selected===i?"selected":""} onClick={()=>{if(unlocked(i)){setSelected(i);setAttempt(null)}}}>
       <span className="n">{progress.passed[i]?"✓":i+1}</span><span><b>{l[0]}</b><small>{!unlocked(i)?"Locked":progress.passed[i]?`Passed • ${fmt(progress.scores[i],0)}%`:"Unlocked"}</small></span>
     </button>)}<button className="regen" onClick={()=>setSeed(Date.now()%1e9)}>↻ Randomize examples</button></aside>
     <main className="lessonMain">
       <section className="card lessonHero"><span className="eyebrow">LESSON {selected+1} OF 16</span><h2>{L[0]}</h2>{L[1].split("\n\n").map((p,i)=><p key={i}>{p}</p>)}<div className="masteryRule"><b>Mastery requirement: 95%</b><span>20 randomized exercises. Slider questions accept ±5 percentage points. A score below 95% generates a new attempt.</span></div></section>
       <section className="card examples"><div className="sectionTitle"><div><span className="eyebrow">RANDOMIZED WORKED EXAMPLES</span><h2>Examples regenerate with the lesson</h2></div></div>
         {examples.map((q,i)=><div className="worked" key={i}><h3>Example {i+1}</h3>{q.data&&<Chart data={q.data} end={q.end}/>}<p><b>Prompt:</b> {q.prompt}</p><p className="solution"><b>Worked solution:</b> {q.explain}</p></div>)}
       </section>
       <section className="card exercises">
         <div className="sectionTitle"><div><span className="eyebrow">MASTERY EXERCISES</span><h2>{attempt?`Attempt • ${attempt.qs.length} questions`:"Ready for randomized assessment"}</h2></div>{!attempt&&<button className="primary" onClick={()=>beginLesson(selected)}>Begin lesson assessment</button>}</div>
         {attempt&&<>{attempt.qs.map((q,i)=><Question key={i} q={q} i={i} value={attempt.answers[i]} disabled={attempt.submitted} onChange={v=>{let a=[...attempt.answers];a[i]=v;setAttempt({...attempt,answers:a})}} grade={attempt.submitted?attempt.grades[i]:null}/>)}
           {!attempt.submitted?<button className="primary big" onClick={submitLesson}>Submit lesson for mastery score</button>:<div className={"resultBox "+(attempt.score>=95?"pass":"fail")}><h2>{fmt(attempt.score,0)}%</h2><p>{attempt.score>=95?"Passed. The next lesson is now unlocked.":"Not yet passed. Review the solutions and generate a fresh attempt; 95% is required."}</p><button className="primary" onClick={()=>beginLesson(selected)}>New randomized attempt</button>{attempt.score>=95&&selected<15&&<button className="ghost" onClick={()=>{setSelected(selected+1);setAttempt(null)}}>Continue to next lesson</button>}</div>}
         </>}
       </section>
     </main>
   </div>}

   {view==="exam"&&<section className="examWrap">
     {!allPassed?<div className="card lockedExam"><h2>Final exam locked</h2><p>Pass all 16 lessons at 95% or higher before attempting the certification exam.</p><div className="bigProgress"><i style={{width:`${Object.keys(progress.passed).length/16*100}%`}}/></div><b>{Object.keys(progress.passed).length}/16 lessons complete</b></div>:
     !exam?<div className="card lockedExam"><span className="eyebrow">FINAL CERTIFICATION</span><h2>100-question open-response exam</h2><p>Each attempt randomly draws 100 questions from a 1,000-question bank. The bank includes randomized charts, fill-in/open-response concepts, chart interpretation, probability sliders, and mathematical questions.</p><p><b>Passing score: 80%.</b> Slider inputs receive credit within ±5 percentage points. Mathematical items specify their numerical tolerance. There are no multiple-choice questions.</p><button className="primary big" onClick={startExam}>Generate 100-question exam</button></div>:
     <div className="card examPaper"><div className="sectionTitle"><div><span className="eyebrow">CERTIFICATION EXAM</span><h2>100 randomized open-response questions</h2></div>{!exam.submitted&&<div className="examCount">{exam.answers.filter(x=>String(x).trim()!=="").length}/100 answered</div>}</div>
       {exam.qs.map((q,i)=><Question key={q.id} q={q} i={i} value={exam.answers[i]} disabled={exam.submitted} onChange={v=>{let a=[...exam.answers];a[i]=v;setExam({...exam,answers:a})}} grade={exam.submitted?exam.grades[i]:null}/>)}
       {!exam.submitted?<button className="primary big" onClick={submitExam}>Submit final exam</button>:<div className={"resultBox "+(exam.score>=80?"pass":"fail")}><h2>{exam.score}%</h2><p>{exam.score>=80?"PASS — You met the 80% certification standard.":"FAIL — Review the solutions and take a new randomized exam when ready."}</p><button className="primary" onClick={startExam}>Generate another 100-question exam</button></div>}
     </div>}
   </section>}

   {view==="progress"&&<section className="progress"><div className="statCards"><div className="card"><small>Lessons passed</small><b>{Object.keys(progress.passed).length}/16</b></div><div className="card"><small>Exam best</small><b>{progress.examBest||0}%</b></div><div className="card"><small>Certification</small><b>{progress.examPassed?"Passed":"Not yet"}</b></div></div>
     <div className="card progressTable"><h2>Lesson mastery</h2>{lessons.map((l,i)=><div className="progRow" key={i}><span>{i+1}. {l[0]}</span><b>{progress.scores[i]!=null?`${fmt(progress.scores[i],0)}%`:"—"}</b><small>{progress.attempts[i]||0} attempts</small><em>{progress.passed[i]?"PASSED":unlocked(i)?"UNLOCKED":"LOCKED"}</em></div>)}</div>
   </section>}
   <footer>Educational training software only. Chart analysis is probabilistic and cannot guarantee profitable outcomes. Synthetic randomized charts prevent look-ahead memorization.</footer>
 </div>
}

function Question({q,i,value,onChange,disabled,grade}){
 return <div className={"question "+(grade===true?"correct":grade===false?"wrong":"")}><div className="qHead"><b>Question {i+1}</b>{grade!=null&&<span>{grade?"✓ Correct":"✕ Incorrect"}</span>}</div>{q.data&&<Chart data={q.data} end={q.end}/>}<p>{q.prompt}</p>
   {q.type==="slider"?<div className="sliderAnswer"><input type="range" min={q.min??0} max={q.max??100} value={value===""?50:value} disabled={disabled} onChange={e=>onChange(+e.target.value)}/><input type="number" value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}/><span>{q.unit||""}</span></div>:
   q.type==="math"?<input className="textAnswer short" type="number" step=".1" value={value} disabled={disabled} onChange={e=>onChange(e.target.value)} placeholder="Enter numerical answer"/>:
   <textarea className="textAnswer" value={value} disabled={disabled} onChange={e=>onChange(e.target.value)} placeholder="Type your open-ended answer…"/>}
   {grade===false&&<div className="explain"><b>Resolution / solution:</b> {q.explain}</div>}{grade===true&&<div className="explain good"><b>Accepted.</b> {q.explain}</div>}
 </div>
}
createRoot(document.getElementById("root")).render(<App/>);

if("serviceWorker"in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}))}
