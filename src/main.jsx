
import React,{useEffect,useMemo,useRef,useState}from"react";
import{createRoot}from"react-dom/client";
import"./styles.css";

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),fmt=(v,d=2)=>Number.isFinite(v)?v.toFixed(d):"—";
const seeded=(s=1)=>{let x=s>>>0;return()=>((x=(1664525*x+1013904223)>>>0)/4294967296)};
const gauss=r=>{let u=0,v=0;while(!u)u=r();while(!v)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
function ema(v,n){let a=2/(n+1),p=v[0];return v.map((x,i)=>(p=i?x*a+p*(1-a):x))}
function rsi(c,n=14){let o=Array(c.length).fill(50),g=0,l=0;for(let i=1;i<c.length;i++){let d=c[i]-c[i-1],up=Math.max(d,0),dn=Math.max(-d,0);if(i<=n){g+=up/n;l+=dn/n}else{g=(g*(n-1)+up)/n;l=(l*(n-1)+dn)/n}if(i>=n)o[i]=l===0?100:100-100/(1+g/l)}return o}
function atr(d,n=14){let tr=d.map((x,i)=>i?Math.max(x.high-x.low,Math.abs(x.high-d[i-1].close),Math.abs(x.low-d[i-1].close)):x.high-x.low),p=tr[0];return tr.map((x,i)=>(p=i?(p*(n-1)+x)/n:x))}
function market(seed=1,n=180){
 const r=seeded(seed),out=[];let close=100,anchor=100,reg="range",left=0;
 for(let i=0;i<n;i++){if(left<=0){reg=["up","down","range","compress","volatile"][Math.floor(r()*5)];left=25+Math.floor(r()*50);anchor=close}left--;
  let drift=0,vol=.008;if(reg==="up")drift=.0015;if(reg==="down")drift=-.0014;if(reg==="range")drift=(anchor-close)/close*.07;if(reg==="compress")vol=.0035;if(reg==="volatile")vol=.018;
  let ret=drift+gauss(r)*vol,open=close*(1+gauss(r)*.002);close=Math.max(5,close*(1+ret));let spr=close*(.003+r()*.009),high=Math.max(open,close)+spr*r(),low=Math.max(.1,Math.min(open,close)-spr*r());
  out.push({open,high,low,close,volume:Math.round((4e5+r()*1.2e6)*(1+Math.abs(ret)*20))});
 }
 let c=out.map(x=>x.close),e9=ema(c,9),e20=ema(c,20),e50=ema(c,50),rr=rsi(c),aa=atr(out);
 return out.map((x,i)=>({...x,ema9:e9[i],ema20:e20[i],ema50:e50[i],rsi:rr[i],atr:aa[i]}));
}
function info(d,end){
 const x=d[end],w=d.slice(end-34,end+1),support=Math.min(...w.map(x=>x.low)),resistance=Math.max(...w.map(x=>x.high)),pos=(x.close-support)/(resistance-support||1);
 const trend=x.close>x.ema20&&x.ema20>x.ema50?"bullish":x.close<x.ema20&&x.ema20<x.ema50?"bearish":"mixed";
 const atrp=x.atr/x.close, vols=d.slice(end-20,end).map(x=>x.volume),avg=vols.reduce((a,b)=>a+b,0)/vols.length,vr=x.volume/avg;
 return{x,support,resistance,pos,trend,atrp,vr};
}
function prob(d,end){
 const z=info(d,end),x=z.x;let s=0;if(z.trend==="bullish")s+=2;if(z.trend==="bearish")s-=2;if(x.ema9>x.ema20)s+=.8;else s-=.8;if(x.rsi>58&&x.rsi<75)s+=.8;if(x.rsi<42&&x.rsi>25)s-=.8;if(z.pos>.86)s-=.45;if(z.pos<.14)s+=.45;
 return Math.round(clamp(100/(1+Math.exp(-s/2.3)),20,80));
}
function Chart({data,end=110}){
 const ref=useRef(null),[w,setW]=useState(700);useEffect(()=>{let o=new ResizeObserver(([e])=>setW(e.contentRect.width));if(ref.current)o.observe(ref.current);return()=>o.disconnect()},[]);
 let start=Math.max(0,end-59),v=data.slice(start,end+1),lo=Math.min(...v.map(x=>x.low))*.997,hi=Math.max(...v.map(x=>x.high))*1.003,H=250,p=12,pw=w-48,ph=H-30,X=i=>p+(i+.5)*pw/v.length,Y=q=>10+(hi-q)/(hi-lo)*ph,step=pw/v.length;
 return <div ref={ref} className="chart"><svg width={w} height={H}><rect width={w} height={H} rx="12" className="bg"/>{[0,1,2,3,4].map(k=><line key={k} x1={p} x2={p+pw} y1={10+k*ph/4} y2={10+k*ph/4} className="grid"/>)}
 {v.map((d,i)=>{let up=d.close>=d.open,bw=Math.max(2,step*.55);return <g key={i}><line x1={X(i)} x2={X(i)} y1={Y(d.high)} y2={Y(d.low)} className={up?"wick up":"wick down"}/><rect x={X(i)-bw/2} y={Math.min(Y(d.open),Y(d.close))} width={bw} height={Math.max(1,Math.abs(Y(d.open)-Y(d.close)))} className={up?"candle up":"candle down"}/></g>})}</svg></div>
}
const lessons=[
["Chart literacy","A chart is a historical auction record, not a prophecy. Professional analysis begins by describing visible facts before assigning directional meaning. Trend, location, volatility, momentum, and participation are evidence; none guarantee the next move.\n\nYour job is to build conditional probabilities from what is visible now. The most important discipline is avoiding certainty language when the chart only supports a bias."],
["Candlestick anatomy","Candles show open, high, low, and close. Bodies show net displacement while wicks show rejected excursions. A large body can represent directional force; a long wick can represent rejection.\n\nCandle shape alone is never enough. Location, preceding structure, volatility, and confirmation determine whether the pattern deserves weight."],
["Line-chart structure","Line charts emphasize closing-price structure and suppress intrabar noise. This makes swing progression, range boundaries, trend slope, and compression easier to see.\n\nUse closing structure to identify the larger auction state before relying on individual candle detail."],
["Trend & swings","Healthy uptrends tend to produce higher highs and higher lows; downtrends tend to produce lower highs and lower lows. Moving averages help summarize the same process but lag price.\n\nThe skill is identifying continuation, weakening, and transition rather than calling every broken swing a reversal."],
["Support & resistance","Support and resistance are zones where prior order flow produced a meaningful response. They should be treated as areas, not perfect single-price lines.\n\nAsk how price approached the zone, whether it was rejected or accepted beyond it, and whether repeated tests are strengthening or consuming the level."],
["Breakouts","A breakout is sustained acceptance outside a prior boundary, not simply a wick through it. Stronger breakouts usually show decisive closes, participation, and follow-through.\n\nFailed breakouts matter because trapped continuation traders can accelerate movement back through the old range."],
["Moving averages","Moving averages summarize trend direction and alignment. Price above fast above medium above slow is bullish evidence; the inverse is bearish evidence.\n\nCrossovers lag and can whipsaw in ranges, so they should confirm structure rather than replace it."],
["RSI & momentum","RSI measures recent momentum. Overbought does not mean price must reverse, and oversold does not mean price must rally.\n\nUse RSI to classify strength, weakness, neutrality, and potential divergence while respecting the broader trend."],
["Volatility & ATR","ATR measures recent range, not direction. High ATR means wider expected movement; low ATR indicates compression.\n\nVolatility changes how much confidence and risk should be attached to every setup."],
["Volume","Volume is a participation measure. Expanding volume can make a breakout or rejection more meaningful; weak volume can make a move less convincing.\n\nAlways interpret participation together with price response."],
["Ranges & mean reversion","Ranges are two-sided auctions. Location matters greatly: the middle usually offers less useful asymmetry than the boundaries.\n\nMean reversion is a regime behavior, not a law. A tested boundary can eventually break."],
["Compression & expansion","Markets often alternate between volatility compression and expansion. Tight ranges and declining ATR can signal increasing potential for a larger move.\n\nCompression predicts possible expansion, not its direction. Direction comes from the eventual break and confirmation."],
["Confluence","Confluence combines genuinely different evidence: structure, location, momentum, volatility, and participation.\n\nDo not count several indicators derived from the same price series as independent votes."],
["Probability & calibration","Chart analysis is probabilistic. The objective is to assign sensible confidence to competing outcomes, not to be certain.\n\nA 60% forecast should resolve correctly about 60% of the time over enough comparable cases. Overconfidence is a forecasting error."],
["Risk context","Good chart reading does not eliminate uncertainty. High volatility and unclear structure should generally reduce conviction or position size.\n\nRisk should adapt to uncertainty and invalidation rather than rely on a fixed arbitrary percentage."],
["Integrated analysis","Professional chart reading integrates regime, structure, location, momentum, volatility, participation, and competing scenarios.\n\nThe final habit is to form a bias, quantify confidence, define what would change your mind, and judge the process separately from the outcome."]
];

function qFor(li,idx,seed){
 const r=seeded(seed+li*10007+idx*193),data=market(Math.floor(r()*1e9)),end=100+Math.floor(r()*35),z=info(data,end),x=z.x,m=idx%6;
 const choice=(prompt,choices,answer,explain)=>({type:"choice",prompt,choices,answer,explain,data,end});
 const probChoice=(prompt,target,explain)=>{
   const bands=["0–20%","21–40%","41–60%","61–80%","81–100%"];
   const ans=target<=20?bands[0]:target<=40?bands[1]:target<=60?bands[2]:target<=80?bands[3]:bands[4];
   return {type:"choice",prompt,choices:bands,answer:ans,explain:data?`${explain} Target probability: ${target}%, which falls in ${ans}.`:explain,data,end};
 };
 switch(li){
  case 0:{
    const last=x.close>=x.open?"closed above its open":"closed below its open";
    const wide=(x.high-x.low) > x.atr*1.25;
    if(m%3===0) return choice("Which statement describes only something directly visible on the chart?",[
      `The final candle ${last}`,
      "The next candle will definitely rise",
      "This setup guarantees a profitable trade",
      "The market must reverse immediately"
    ],`The final candle ${last}`,"This lesson separates observation from prediction. The accepted answer states only a fact visible at the decision point.");
    if(m%3===1) return choice("Which statement avoids making an unsupported prediction?",[
      "The chart records past and current price behavior",
      "The chart proves the next move will be higher",
      "A red candle guarantees another red candle",
      "The visible pattern guarantees a reversal"
    ],"The chart records past and current price behavior","Charts display historical/current auction information. Future direction remains uncertain.");
    return choice("What is the safest conclusion from the final candle alone?",[
      wide?"Its range is relatively large, but the next move is still uncertain":"Its range is not unusually large, and the next move is still uncertain",
      "It guarantees continuation",
      "It guarantees reversal",
      "It proves buyers will control the next several bars"
    ],wide?"Its range is relatively large, but the next move is still uncertain":"Its range is not unusually large, and the next move is still uncertain",
    "Lesson 1 trains observation without forecasting. Candle range can be described, but future movement cannot be guaranteed.");
  }
  case 1:{let body=Math.abs(x.close-x.open),u=x.high-Math.max(x.open,x.close),l=Math.min(x.open,x.close)-x.low,a=body>(u+l)*1.15?"Large directional body":l>body*1.5?"Long lower-wick rejection":u>body*1.5?"Long upper-wick rejection":"Small/indecisive candle";return choice("Classify the final candle's anatomy.",["Large directional body","Long lower-wick rejection","Long upper-wick rejection","Small/indecisive candle"],a,`The final candle is ${a.toLowerCase()}.`)}
  case 2:return choice("Classify the dominant closing-price structure.",["Bullish","Bearish","Mixed/ranging"],z.trend==="bullish"?"Bullish":z.trend==="bearish"?"Bearish":"Mixed/ranging",`The visible structure is ${z.trend}.`);
  case 3:return choice("Classify the current trend.",["Bullish","Bearish","Mixed/transitional"],z.trend==="bullish"?"Bullish":z.trend==="bearish"?"Bearish":"Mixed/transitional",`The trend is ${z.trend}.`);
  case 4:{let a=z.pos<.25?"Near support":z.pos>.75?"Near resistance":"Mid-range";return choice("Where is price located within the recent visible range?",["Near support","Mid-range","Near resistance"],a,`Price is ${Math.round(z.pos*100)}% of the way from recent support to resistance.`)}
  case 5:{let near=z.pos>.83,strong=x.close>x.open&&x.close>x.high-(x.high-x.low)*.25,a=near&&strong?"Potential breakout pressure":near?"Resistance test without strong acceptance":"No immediate resistance breakout setup";return choice("Which breakout interpretation fits best?",["Potential breakout pressure","Resistance test without strong acceptance","No immediate resistance breakout setup"],a,a+".")}
  case 6:{let a=x.close>x.ema9&&x.ema9>x.ema20&&x.ema20>x.ema50?"Bullishly aligned":x.close<x.ema9&&x.ema9<x.ema20&&x.ema20<x.ema50?"Bearishly aligned":"Mixed";return choice("How are price and the moving averages aligned?",["Bullishly aligned","Bearishly aligned","Mixed"],a,`Alignment is ${a.toLowerCase()}.`)}
  case 7:{let a=x.rsi>=70?"Overbought/strong momentum":x.rsi<=30?"Oversold/weak momentum":x.rsi>55?"Positive momentum":x.rsi<45?"Negative momentum":"Neutral momentum";return choice(`RSI is ${fmt(x.rsi,0)}. Which interpretation fits best?`,["Overbought/strong momentum","Oversold/weak momentum","Positive momentum","Negative momentum","Neutral momentum"],a,a+".")}
  case 8:{let a=z.atrp>.018?"High volatility":z.atrp<.008?"Compressed volatility":"Normal volatility";return choice("Classify the volatility regime.",["High volatility","Normal volatility","Compressed volatility"],a,`ATR is ${fmt(z.atrp*100,2)}% of price.`)}
  case 9:{let a=z.vr>1.35?"Expanding participation":z.vr<.7?"Weak participation":"Normal participation";return choice("How does final-bar volume compare with recent participation?",["Expanding participation","Normal participation","Weak participation"],a,`Final volume is ${fmt(z.vr,2)}× the recent average.`)}
  case 10:{let a=z.pos<.2?"Lower range extreme":z.pos>.8?"Upper range extreme":"Middle of range";return choice("For a range framework, where is price located?",["Lower range extreme","Middle of range","Upper range extreme"],a,`Price is at ${Math.round(z.pos*100)}% of the visible range.`)}
  case 11:{let a=z.atrp<.008?"Compression":z.atrp>.018?"Expansion/high volatility":"Neither extreme";return choice("Which volatility-cycle state fits best?",["Compression","Expansion/high volatility","Neither extreme"],a,a+".")}
  case 12:{let b=(z.trend==="bullish")+(x.rsi>55)+(x.ema9>x.ema20),s=(z.trend==="bearish")+(x.rsi<45)+(x.ema9<x.ema20),a=b>=2&&b>s?"Bullish confluence":s>=2&&s>b?"Bearish confluence":"Mixed evidence";return choice("Do the visible factors create directional confluence?",["Bullish confluence","Bearish confluence","Mixed evidence"],a,a+".")}
  case 13:return probChoice("Which probability range best represents the chance that the next several bars resolve higher?",prob(data,end),"The target uses a consistent training model from visible trend, EMA alignment, RSI, and range location.");
  case 14:return choice("Which risk statement best matches this chart?",["Higher volatility should generally reduce conviction or size","Risk no longer matters when indicators agree","Every stop should be exactly 1% away","The next move is certain"],"Higher volatility should generally reduce conviction or size",`ATR is ${fmt(z.atrp*100,2)}% of price, so risk should adapt to volatility.`);
  default:{let p=prob(data,end);return m<3?choice("Choose the best integrated market read.",["Bullish bias","Bearish bias","Mixed/neutral"],p>=57?"Bullish bias":p<=43?"Bearish bias":"Mixed/neutral",`Integrated probability target is ${p}%.`):probChoice("After integrating the entire chart, which probability range best represents an upside resolution?",p,"Use the combined chart evidence to select the closest probability range.")}
 }
}
function grade(q,a){return a===q.answer}
function bank1000(){return Array.from({length:1000},(_,i)=>({...qFor(i%16,i%20,900000+i*7919),id:i,lesson:i%16,topic:i%16}))}
function Question({q,i,value,onChange,disabled,gradeResult}){
 return <div className={"question "+(gradeResult===true?"correct":gradeResult===false?"wrong":"")}><div className="qhead"><b>Question {i+1}{Number.isInteger(q.topic)?` • ${lessons[q.topic][0]}`:""}</b>{gradeResult!=null&&<span>{gradeResult?"✓ Correct":"✕ Incorrect"}</span>}</div><Chart data={q.data} end={q.end}/><p>{q.prompt}</p>
 <div className="choices">{q.choices.map(c=><button key={c} disabled={disabled} className={value===c?"picked":""} onClick={()=>onChange(c)}>{c}</button>)}</div>
 {gradeResult!=null&&<div className={"explain "+(gradeResult?"good":"bad")}><b>{gradeResult?"Accepted":"Resolution"}:</b> {q.explain}</div>}</div>
}

function assessmentTopic(currentLesson,index,rng){
  // 70% of questions drill the current lesson; 30% review only already-taught material.
  // No topic greater than currentLesson can ever be selected.
  if(currentLesson===0 || rng()<0.70) return currentLesson;
  return Math.floor(rng()*currentLesson);
}
function makeLessonAssessment(currentLesson,seed){
  const r=seeded(seed + currentLesson*51511);
  return Array.from({length:20},(_,k)=>{
    const topic=assessmentTopic(currentLesson,k,r);
    return {...qFor(topic,k,Math.floor(r()*1e9)),topic};
  });
}
function makeLessonExamples(currentLesson,seed){
  // Worked examples teach only the concept introduced in this lesson.
  return Array.from({length:4},(_,k)=>({...qFor(currentLesson,k+12,seed+currentLesson*1000+k*997),topic:currentLesson}));
}

function App(){
 const [view,setView]=useState("course"),[selected,setSelected]=useState(0),[seed,setSeed]=useState(Date.now()%1e9),[attempt,setAttempt]=useState(null),[exam,setExam]=useState(null);
 const [progress,setProgress]=useState(()=>JSON.parse(localStorage.getItem("mca_chart_v3")||'{"scores":{},"passed":{},"attempts":{}}'));
 const bank=useMemo(()=>bank1000(),[]);
 const save=p=>{setProgress(p);localStorage.setItem("mca_chart_v3",JSON.stringify(p))},unlocked=i=>i===0||progress.passed[i-1],allPassed=lessons.every((_,i)=>progress.passed[i]);
 const examples=useMemo(()=>makeLessonExamples(selected,seed),[selected,seed]);
 function beginLesson(){const s=seed+Math.floor(Math.random()*1e8);setAttempt({qs:makeLessonAssessment(selected,s),answers:Array(20).fill(""),submitted:false,grades:[],score:0})}
 function submitLesson(){let grades=attempt.qs.map((q,i)=>grade(q,attempt.answers[i])),score=grades.filter(Boolean).length/20*100,p={...progress,scores:{...progress.scores,[selected]:Math.max(progress.scores[selected]||0,score)},passed:{...progress.passed},attempts:{...progress.attempts,[selected]:(progress.attempts[selected]||0)+1}};if(score>=95)p.passed[selected]=true;save(p);setAttempt({...attempt,submitted:true,grades,score})}
 function startExam(){let ids=[...Array(1000).keys()];for(let i=999;i>0;i--){let j=Math.floor(Math.random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]]}setExam({qs:ids.slice(0,100).map(i=>bank[i]),answers:Array(100).fill(""),submitted:false,grades:[],score:0});setView("exam")}
 function submitExam(){let grades=exam.qs.map((q,i)=>grade(q,exam.answers[i])),score=grades.filter(Boolean).length,p={...progress,examBest:Math.max(progress.examBest||0,score),examPassed:(progress.examPassed||false)||score>=80};save(p);setExam({...exam,submitted:true,grades,score})}
 return <div className="app"><header><div><h1>Market Chart Academy Pro</h1><p>Chart-analysis-only mastery course</p></div><div className="status"><span>{Object.keys(progress.passed).length}/16 lessons</span><span>Exam best {progress.examBest||0}%</span></div></header>
 <nav>{["course","exam","progress"].map(v=><button key={v} className={view===v?"active":""} onClick={()=>setView(v)}>{v==="course"?"Course":v==="exam"?"Final Exam":"Progress"}</button>)}</nav>
 {view==="course"&&<div className="layout"><aside className="panel side"><h3>Mastery path</h3>{lessons.map((l,i)=><button key={i} disabled={!unlocked(i)} className={selected===i?"sel":""} onClick={()=>{setSelected(i);setAttempt(null)}}><b>{progress.passed[i]?"✓":i+1}</b><span>{l[0]}<small>{!unlocked(i)?"Locked":progress.passed[i]?`Passed ${fmt(progress.scores[i],0)}%`:"Unlocked"}</small></span></button>)}</aside>
 <main><section className="panel hero"><span>LESSON {selected+1}</span><h2>{lessons[selected][0]}</h2>{lessons[selected][1].split("\n\n").map((p,i)=><p key={i}>{p}</p>)}<div className="rule"><b>Pass requirement: 95%</b><small>20 randomized multiple-choice chart questions. About 70% drill this lesson; the rest review only material from earlier lessons. Future concepts never appear.</small></div></section>
 <section className="panel"><div className="sectionTitle"><div><span>RANDOMIZED WORKED EXAMPLES</span><h2>Chart examples</h2></div><button onClick={()=>setSeed(Date.now()%1e9)}>Randomize</button></div>{examples.map((q,i)=><div className="example" key={i}><h3>Example {i+1}</h3><Chart data={q.data} end={q.end}/><p><b>Question:</b> {q.prompt}</p><p className="solution"><b>Solution:</b> {q.explain}</p></div>)}</section>
 <section className="panel"><div className="sectionTitle"><div><span>MASTERY ASSESSMENT</span><h2>{attempt?"20 chart questions":"Ready"}</h2></div>{!attempt&&<button className="primary" onClick={beginLesson}>Begin</button>}</div>
 {attempt&&<>{attempt.qs.map((q,i)=><Question key={i} q={q} i={i} value={attempt.answers[i]} disabled={attempt.submitted} gradeResult={attempt.submitted?attempt.grades[i]:null} onChange={v=>{let a=[...attempt.answers];a[i]=v;setAttempt({...attempt,answers:a})}}/>)}{!attempt.submitted?<button className="primary full" onClick={submitLesson}>Submit lesson</button>:<div className={"result "+(attempt.score>=95?"pass":"fail")}><h2>{attempt.score}%</h2><p>{attempt.score>=95?"Passed. The next lesson is unlocked.":"Not passed. 95% is required."}</p><button onClick={beginLesson}>New randomized attempt</button></div>}</>}</section></main></div>}
 {view==="exam"&&<section className="exam">{!allPassed?<div className="panel lock"><h2>Final exam locked</h2><p>Pass all 16 lessons at 95% or better first.</p></div>:!exam?<div className="panel lock"><h2>100-question chart-analysis final</h2><p>Each attempt draws 100 questions from a 1,000-question bank. Every item is built around a randomized chart. Every question is chart-based multiple choice, including probability-estimation questions.</p><p><b>Passing score: 80%.</b> Probability questions use multiple-choice probability ranges.</p><button className="primary full" onClick={startExam}>Generate exam</button></div>:<div className="panel"><h2>Final exam</h2>{exam.qs.map((q,i)=><Question key={q.id} q={q} i={i} value={exam.answers[i]} disabled={exam.submitted} gradeResult={exam.submitted?exam.grades[i]:null} onChange={v=>{let a=[...exam.answers];a[i]=v;setExam({...exam,answers:a})}}/>)}{!exam.submitted?<button className="primary full" onClick={submitExam}>Submit final exam</button>:<div className={"result "+(exam.score>=80?"pass":"fail")}><h2>{exam.score}%</h2><p>{exam.score>=80?"PASS":"FAIL — 80% required"}</p><button onClick={startExam}>New randomized exam</button></div>}</div>}</section>}
 {view==="progress"&&<section className="panel progress"><h2>Progress</h2>{lessons.map((l,i)=><div className="row" key={i}><span>{i+1}. {l[0]}</span><b>{progress.scores[i]!=null?`${fmt(progress.scores[i],0)}%`:"—"}</b><em>{progress.passed[i]?"PASSED":unlocked(i)?"UNLOCKED":"LOCKED"}</em></div>)}</section>}
 <footer>Educational only. Technical analysis is probabilistic and cannot guarantee future market direction or profit.</footer></div>
}
createRoot(document.getElementById("root")).render(<App/>);
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));
