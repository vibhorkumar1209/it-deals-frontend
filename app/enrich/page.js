"use client";
import { useState, useCallback, useEffect } from "react";
import { Plus, Trash2, Play, Download, Loader2, CheckCircle2,
         History, X, Clock, Search, Cpu, Target, BarChart3,
         ChevronDown, ChevronUp } from "lucide-react";
import s from "./enrich.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function parseCSV(t) { return t.split(/[\n,]/).map(x=>x.trim()).filter(Boolean); }

function fmtMonthYear(val) {
  if (!val) return "-";
  const clean = val.trim();
  const d = new Date(clean);
  if (!isNaN(d.getTime()) && clean.length >= 7)
    return d.toLocaleDateString("en-GB", { month:"short", year:"numeric" });
  if (/^\d{4}$/.test(clean)) return clean;
  return clean;
}

function dlCSV(rows, fields, filename) {
  if (!rows.length) return;
  const keys = fields.map(f=>f.key);
  const csv = [fields.map(f=>f.label).join(","),
    ...rows.map(r=>keys.map(k=>`"${(r[k]??"").replace(/"/g,'""')}"`).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8;"}));
  a.download = filename; a.click();
}

function EmptyState({ msg }) {
  return <div style={{padding:"32px 20px",textAlign:"center",color:"#334155",fontSize:13}}>{msg}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 1 — IT DEAL FINDER
// ─────────────────────────────────────────────────────────────────────────────
const DEAL_FIELDS = [
  { key:"vendor",      label:"Vendor/Partner" },
  { key:"deal_type",   label:"Deal Type" },
  { key:"deal_value",  label:"Deal Value" },
  { key:"date_signed", label:"Last Detected" },
  { key:"deal_focus",  label:"Deal Focus" },
  { key:"description", label:"Deal Description" },
  { key:"source",      label:"Source" },
];
const FIXED_GOAL = "Find every IT and technology deal, contract, outsourcing agreement, and digital transformation initiative involving this company.";
const DEAL_HIST_KEY = "it_deal_finder_history";
function loadDealHist() { try { return JSON.parse(localStorage.getItem(DEAL_HIST_KEY)??"[]"); } catch { return []; } }
function saveDealHist(h) { try { localStorage.setItem(DEAL_HIST_KEY, JSON.stringify(h)); } catch {} }
const emptyCompany = () => ({ id: Math.random().toString(36).slice(2), company_name:"", domain:"", linkedin_url:"", focus_tech_text:"", focus_vendor_text:"" });

function DealFinder() {
  const [companies, setCompanies]   = useState([emptyCompany()]);
  const [status, setStatus]         = useState("idle");
  const [progress, setProgress]     = useState("");
  const [rows, setRows]             = useState([]);
  const [showHist, setShowHist]     = useState(false);
  const [history, setHistory]       = useState([]);
  const [histEntry, setHistEntry]   = useState(null);

  useEffect(()=>setHistory(loadDealHist()),[]);

  const addC = ()=>setCompanies(cs=>[...cs,emptyCompany()]);
  const remC = id=>setCompanies(cs=>cs.filter(c=>c.id!==id));
  const updC = (id,p)=>setCompanies(cs=>cs.map(c=>c.id===id?{...c,...p}:c));
  const valid = companies.filter(c=>c.company_name.trim()&&c.domain.trim());

  const run = useCallback(async()=>{
    if(!valid.length) return;
    setStatus("running"); setRows([]); setProgress("Connecting…");
    const inputs = valid.map(c=>({company_name:c.company_name.trim(),domain:c.domain.trim(),linkedin_url:c.linkedin_url.trim(),focus_tech:parseCSV(c.focus_tech_text),focus_vendor:parseCSV(c.focus_vendor_text)}));
    try {
      const res = await fetch(`${API_URL}/api/enrich-task`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({goal:FIXED_GOAL,schema_fields:DEAL_FIELDS.map(f=>({key:f.key,label:f.label,type:"string",description:""})),inputs})});
      if(!res.ok||!res.body) throw new Error(`Server ${res.status}`);
      const reader=res.body.getReader(); const dec=new TextDecoder(); let buf=""; let all=[];
      while(true){
        const {done,value}=await reader.read(); if(done) break;
        buf+=dec.decode(value,{stream:true});
        const lines=buf.split("\n"); buf=lines.pop()??"";
        for(const line of lines){
          if(!line.startsWith("data: ")) continue;
          try {
            const ev=JSON.parse(line.slice(6));
            if(ev.type==="heartbeat"||ev.type==="progress") setProgress(ev.message??"");
            else if(ev.type==="row"){all=[...all,ev.row];setRows([...all]);const ok=all.filter(r=>r._status==="ok").length;setProgress(`${ok} deal${ok===1?"":"s"} found…`);}
            else if(ev.type==="complete"){setStatus("done");const ok=ev.succeeded??all.filter(r=>r._status==="ok").length;setProgress(`Done — ${ok} deals found`);const h=[{id:Date.now(),date:new Date().toISOString(),companies:valid.map(c=>c.company_name),rows:all},...loadDealHist()].slice(0,50);saveDealHist(h);setHistory(h);}
            else if(ev.type==="error"){setStatus("error");setProgress(ev.message??"Error");}
          } catch{}
        }
      }
      if(status==="running") setStatus("done");
    } catch(e){setStatus("error");setProgress(`Failed: ${e.message}`);}
  },[valid]);

  const dlCSVDeals=(r=rows)=>{if(!r.length)return;const keys=["company_name","domain",...DEAL_FIELDS.map(f=>f.key)];const hdrs=["Company","Domain",...DEAL_FIELDS.map(f=>f.label)];const csv=[hdrs.join(","),...r.map(row=>keys.map(k=>`"${(row[k]??"").replace(/"/g,'""')}"`).join(","))].join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8;"}));a.download="it-deals.csv";a.click();};
  const dlJSON=(r=rows)=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(r,null,2)],{type:"application/json"}));a.download="it-deals.json";a.click();};

  return (
    <>
      {/* History panel */}
      {showHist&&(<div className={s.historyOverlay} onClick={()=>{setShowHist(false);setHistEntry(null);}}>
        <div className={s.historyPanel} onClick={e=>e.stopPropagation()}>
          <div className={s.historyHeader}>
            <span className={s.historyTitle}>{histEntry?<button className={s.historyBack} onClick={()=>setHistEntry(null)}>← Back</button>:"Report History"}</span>
            {!histEntry&&history.length>0&&<button className={s.historyDeleteAll} onClick={()=>{saveDealHist([]);setHistory([]);}}>Clear all</button>}
            <button className={s.historyClose} onClick={()=>{setShowHist(false);setHistEntry(null);}}><X size={15}/></button>
          </div>
          {!histEntry&&(history.length===0?<EmptyState msg="No reports yet."/>:
            <div className={s.historyList}>{history.map(e=>(
              <button key={e.id} className={s.historyItem} onClick={()=>setHistEntry(e)}>
                <div className={s.historyItemTop}><span className={s.historyItemCompanies}>{e.companies.slice(0,3).join(", ")}{e.companies.length>3?` +${e.companies.length-3}`:""}</span><span className={s.historyItemCount}>{e.rows.length} deals</span></div>
                <div className={s.historyItemDate}><Clock size={10}/> {new Date(e.date).toLocaleString()}</div>
              </button>))}</div>)}
          {histEntry&&(<div className={s.historyDetail}>
            <div className={s.historyDetailMeta}><span className={s.historyItemDate}><Clock size={10}/> {new Date(histEntry.date).toLocaleString()}</span><span className={s.historyItemCount}>{histEntry.rows.length} deals</span></div>
            <div className={s.historyDetailActions}><button className={s.dlBtnCSV} onClick={()=>dlCSVDeals(histEntry.rows)}><Download size={12}/> CSV</button><button className={s.dlBtnJSON} onClick={()=>dlJSON(histEntry.rows)}><Download size={12}/> JSON</button><button className={s.historyDeleteOne} onClick={()=>{const u=history.filter(h=>h.id!==histEntry.id);saveDealHist(u);setHistory(u);setHistEntry(null);}}><Trash2 size={12}/> Delete</button></div>
            <DealTable rows={histEntry.rows}/>
          </div>)}
        </div>
      </div>)}

      <div className={s.card}>
        <div className={s.row}><div className={s.cardTitle}>Companies</div><button className={s.btnAdd} onClick={addC}><Plus size={12}/> Add company</button></div>
        <div className={s.cardSub}>Enter each company to research. Domain confirms the organisation. LinkedIn and focus fields are optional.</div>
        {companies.map(c=>(
          <div key={c.id} className={s.companyBlock}>
            <div className={s.companyRow1}>
              <div className={s.fieldGroup}><label className={s.fieldLabel}>Company Name *</label><input className={s.inp} placeholder="e.g. HDFC Bank" value={c.company_name} onChange={e=>updC(c.id,{company_name:e.target.value})}/></div>
              <div className={s.fieldGroup}><label className={s.fieldLabel}>Domain *</label><input className={s.inp} placeholder="e.g. hdfcbank.com" value={c.domain} onChange={e=>updC(c.id,{domain:e.target.value})}/></div>
              <div className={s.fieldGroup}><label className={s.fieldLabel}>LinkedIn <span className={s.optional}>optional</span></label><input className={s.inp} placeholder="linkedin.com/company/…" value={c.linkedin_url} onChange={e=>updC(c.id,{linkedin_url:e.target.value})}/></div>
              {companies.length>1&&<button className={s.btnIcon} style={{alignSelf:"flex-end",marginBottom:2}} onClick={()=>remC(c.id)}><Trash2 size={14}/></button>}
            </div>
            <div className={s.companyRow2}>
              <div className={s.fieldGroup}><label className={s.fieldLabel}>Focus Technologies <span className={s.optional}>optional</span></label><textarea className={`${s.inp} ${s.ta}`} style={{height:68,fontFamily:"monospace",fontSize:11}} placeholder="core banking, cloud, ERP…" value={c.focus_tech_text} onChange={e=>updC(c.id,{focus_tech_text:e.target.value})}/>{parseCSV(c.focus_tech_text).length>0&&<div className={s.csvCount}>{parseCSV(c.focus_tech_text).length} technologies</div>}</div>
              <div className={s.fieldGroup}><label className={s.fieldLabel}>Focus Vendors <span className={s.optional}>optional</span></label><textarea className={`${s.inp} ${s.ta}`} style={{height:68,fontFamily:"monospace",fontSize:11}} placeholder="TCS, Infosys, SAP…" value={c.focus_vendor_text} onChange={e=>updC(c.id,{focus_vendor_text:e.target.value})}/>{parseCSV(c.focus_vendor_text).length>0&&<div className={s.csvCount}>{parseCSV(c.focus_vendor_text).length} vendors</div>}</div>
            </div>
          </div>
        ))}
      </div>

      <div className={s.runBar}>
        {status!=="idle"&&(<div className={s.statusBar}>
          {status==="running"&&<Loader2 size={16} color="#3491E8" className={s.spin}/>}
          {status==="done"&&<CheckCircle2 size={16} color="#34d399"/>}
          {status==="error"&&<span style={{color:"#E63946",fontSize:13}}>✕</span>}
          <span className={s.statusText}>{progress}</span>
          {status==="done"&&rows.length>0&&<div className={s.dlBtn}><button className={s.dlBtnCSV} onClick={()=>dlCSVDeals()}><Download size={12}/> CSV</button><button className={s.dlBtnJSON} onClick={()=>dlJSON()}><Download size={12}/> JSON</button></div>}
        </div>)}
        <button className={`${s.btn} ${s.btnPrimary} ${s.btnRun}`} onClick={run} disabled={status==="running"||!valid.length}>
          {status==="running"?<><Loader2 size={16} className={s.spin}/> Researching…</>:<><Play size={16}/> {status==="done"?"Search again":"Find Deals"}</>}
        </button>
        <button className={s.historyBtn} onClick={()=>{setHistory(loadDealHist());setShowHist(true);setHistEntry(null);}}>
          <History size={13}/> History {history.length>0&&<span className={s.historyBadge}>{history.length}</span>}
        </button>
      </div>
      {rows.length>0&&<DealTable rows={rows}/>}
    </>
  );
}

function DealTable({rows}) {
  return (
    <div className={s.tableWrap}><div className={s.tableScroll}><table className={s.table}>
      <thead className={s.thead}><tr className={s.theadTr}><th className={s.th}>#</th><th className={s.th}>Company</th>{DEAL_FIELDS.map(f=><th key={f.key} className={s.th}>{f.label}</th>)}<th className={s.th}>Status</th></tr></thead>
      <tbody>{rows.map((row,i)=>(
        <tr key={i} className={`${s.tbodyTr} ${i%2===0?"":s.tbodyTrEven} ${s.rowNew}`}>
          <td className={`${s.td} ${s.tdNum}`}>{i+1}</td>
          <td className={`${s.td} ${s.tdCo}`}>{row.company_name}</td>
          {DEAL_FIELDS.map(f=>(
            <td key={f.key} className={`${s.td} ${s.tdVal}`}>
              {f.key==="source"&&row[f.key]?<a href={row[f.key]} target="_blank" rel="noreferrer" className={s.sourceLink}>↗ link</a>
              :f.key==="deal_focus"&&row[f.key]?<span className={s.focusBadge}>{row[f.key]}</span>
              :f.key==="date_signed"?<span>{fmtMonthYear(row[f.key])}</span>
              :f.key==="deal_value"?<span>{row[f.key]||"-"}</span>
              :row[f.key]?<span className={s.tdValInner}>{row[f.key]}</span>:<span className={s.tdNone}>—</span>}
            </td>
          ))}
          <td className={s.td}><span className={`${s.badge} ${row._status==="ok"?s.badgeOk:s.badgeNone}`}>{row._status==="ok"?"Found":row._status==="timeout"?"Timeout":"No data"}</span></td>
        </tr>
      ))}</tbody>
    </table></div></div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 2 — TECH STACK FINDER
// ─────────────────────────────────────────────────────────────────────────────
const TS_FIELDS = [
  {key:"core_tech_category",label:"Core Category"},{key:"tech_stack_category",label:"Tech Category"},
  {key:"vendor",label:"Tech"},{key:"integration_partner",label:"Implementation Partner"},
  {key:"last_detected",label:"Last Detected"},{key:"tech_install",label:"Install Size"},
  {key:"renewal_date",label:"Renewal"},{key:"confidence_score",label:"Confidence"},
  {key:"source_info",label:"Source"},
];
const CAT_COLORS = {"Core Enterprise Operations":{bg:"rgba(99,102,241,0.12)",color:"#818cf8"},"Customer-Facing & Revenue":{bg:"rgba(52,211,153,0.12)",color:"#34d399"},"Infrastructure & Cloud":{bg:"rgba(52,145,232,0.12)",color:"#3491E8"},"Development & Engineering":{bg:"rgba(251,191,36,0.12)",color:"#fbbf24"},"Data Analytics & AI":{bg:"rgba(244,114,182,0.12)",color:"#f472b6"},"Security & Compliance":{bg:"rgba(230,57,70,0.12)",color:"#E63946"}};
function confColor(s){const n=parseInt(s);if(n>=90)return{bg:"rgba(52,211,153,0.15)",color:"#34d399"};if(n>=75)return{bg:"rgba(52,145,232,0.15)",color:"#3491E8"};if(n>=60)return{bg:"rgba(251,191,36,0.15)",color:"#fbbf24"};return{bg:"rgba(100,116,139,0.15)",color:"#64748b"};}

const TS_HIST_KEY = "it_tech_stack_history";
function loadTSHist(){try{return JSON.parse(localStorage.getItem(TS_HIST_KEY)??"[]");}catch{return[];}}
function saveTSHist(h){try{localStorage.setItem(TS_HIST_KEY,JSON.stringify(h));}catch{}}
const emptyCo=()=>({id:Math.random().toString(36).slice(2),company_name:"",domain:"",linkedin_url:"",focus_categories_text:"",focus_vendors_text:""});

function TechStackFinder() {
  const [companies,setCompanies]=useState([emptyCo()]);
  const [status,setStatus]=useState("idle");
  const [progress,setProgress]=useState("");
  const [rows,setRows]=useState([]);
  const [showHist,setShowHist]=useState(false);
  const [history,setHistory]=useState([]);
  const [histEntry,setHistEntry]=useState(null);
  useEffect(()=>setHistory(loadTSHist()),[]);

  const addC=()=>setCompanies(cs=>[...cs,emptyCo()]);
  const remC=id=>setCompanies(cs=>cs.filter(c=>c.id!==id));
  const updC=(id,p)=>setCompanies(cs=>cs.map(c=>c.id===id?{...c,...p}:c));
  const valid=companies.filter(c=>c.company_name.trim()&&c.domain.trim());

  const run=useCallback(async()=>{
    if(!valid.length) return;
    setStatus("running");setRows([]);setProgress("Connecting…");
    const inputs=valid.map(c=>({company_name:c.company_name.trim(),domain:c.domain.trim(),linkedin_url:c.linkedin_url.trim(),focus_categories:parseCSV(c.focus_categories_text),focus_vendors:parseCSV(c.focus_vendors_text)}));
    try{
      const res=await fetch(`${API_URL}/api/tech-stack`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({inputs})});
      if(!res.ok||!res.body) throw new Error(`Server ${res.status}`);
      const reader=res.body.getReader();const dec=new TextDecoder();let buf="";let all=[];
      while(true){const{done,value}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});const lines=buf.split("\n");buf=lines.pop()??"";for(const line of lines){if(!line.startsWith("data: "))continue;try{const ev=JSON.parse(line.slice(6));if(ev.type==="heartbeat"||ev.type==="progress")setProgress(ev.message??"");else if(ev.type==="row"){all=[...all,ev.row];setRows([...all]);const ok=all.filter(r=>r._status==="ok").length;setProgress(`${ok} tool${ok===1?"":"s"} detected…`);}else if(ev.type==="complete"){setStatus("done");const ok=all.filter(r=>r._status==="ok").length;setProgress(`Done — ${ok} tools detected`);const h=[{id:Date.now(),date:new Date().toISOString(),companies:valid.map(c=>c.company_name),rows:all},...loadTSHist()].slice(0,30);saveTSHist(h);setHistory(h);}else if(ev.type==="error"){setStatus("error");setProgress(ev.message??"Error");}}catch{}}}
    }catch(e){setStatus("error");setProgress(`Failed: ${e.message}`);}
  },[valid]);

  return(
    <>
      {showHist&&(<div className={s.historyOverlay} onClick={()=>{setShowHist(false);setHistEntry(null);}}>
        <div className={s.historyPanel} onClick={e=>e.stopPropagation()}>
          <div className={s.historyHeader}>
            <span className={s.historyTitle}>{histEntry?<button className={s.historyBack} onClick={()=>setHistEntry(null)}>← Back</button>:"Scan History"}</span>
            {!histEntry&&history.length>0&&<button className={s.historyDeleteAll} onClick={()=>{saveTSHist([]);setHistory([]);}}>Clear all</button>}
            <button className={s.historyClose} onClick={()=>{setShowHist(false);setHistEntry(null);}}><X size={15}/></button>
          </div>
          {!histEntry&&(history.length===0?<EmptyState msg="No scans yet."/>:<div className={s.historyList}>{history.map(e=>(<button key={e.id} className={s.historyItem} onClick={()=>setHistEntry(e)}><div className={s.historyItemTop}><span className={s.historyItemCompanies}>{e.companies.slice(0,3).join(", ")}</span><span className={s.historyItemCount}>{e.rows.filter(r=>r._status==="ok").length} tools</span></div><div className={s.historyItemDate}><Clock size={10}/> {new Date(e.date).toLocaleString()}</div></button>))}</div>)}
          {histEntry&&(<div className={s.historyDetail}><div className={s.historyDetailActions}><button className={s.dlBtnCSV} onClick={()=>dlCSV(histEntry.rows,TS_FIELDS,"tech-stack.csv")}><Download size={12}/> CSV</button><button className={s.historyDeleteOne} onClick={()=>{const u=history.filter(h=>h.id!==histEntry.id);saveTSHist(u);setHistory(u);setHistEntry(null);}}><Trash2 size={12}/> Delete</button></div><TSTable rows={histEntry.rows}/></div>)}
        </div>
      </div>)}

      <div className={s.card}>
        <div className={s.row}><div className={s.cardTitle}>Companies to scan</div><button className={s.btnAdd} onClick={addC}><Plus size={12}/> Add company</button></div>
        <div className={s.cardSub}>Leave focus fields empty for full wide-spectrum audit. Fill for laser-focused scan.</div>
        {companies.map(c=>(
          <div key={c.id} className={s.companyBlock}>
            <div className={s.companyRow1}>
              <div className={s.fieldGroup}><label className={s.fieldLabel}>Company Name *</label><input className={s.inp} placeholder="e.g. HDFC Bank" value={c.company_name} onChange={e=>updC(c.id,{company_name:e.target.value})}/></div>
              <div className={s.fieldGroup}><label className={s.fieldLabel}>Domain *</label><input className={s.inp} placeholder="e.g. hdfcbank.com" value={c.domain} onChange={e=>updC(c.id,{domain:e.target.value})}/></div>
              <div className={s.fieldGroup}><label className={s.fieldLabel}>LinkedIn <span className={s.optional}>optional</span></label><input className={s.inp} placeholder="linkedin.com/company/…" value={c.linkedin_url} onChange={e=>updC(c.id,{linkedin_url:e.target.value})}/></div>
              {companies.length>1&&<button className={s.btnIcon} style={{alignSelf:"flex-end",marginBottom:2}} onClick={()=>remC(c.id)}><Trash2 size={14}/></button>}
            </div>
            <div className={s.companyRow2}>
              <div className={s.fieldGroup}><label className={s.fieldLabel}>Focus Categories <span className={s.optional}>optional</span></label><textarea className={`${s.inp} ${s.ta}`} style={{height:68,fontFamily:"monospace",fontSize:11}} placeholder="CRM, Cloud Hosting, Cybersecurity…" value={c.focus_categories_text} onChange={e=>updC(c.id,{focus_categories_text:e.target.value})}/>{parseCSV(c.focus_categories_text).length>0&&<div className={s.csvCount}>{parseCSV(c.focus_categories_text).length} categories</div>}</div>
              <div className={s.fieldGroup}><label className={s.fieldLabel}>Focus Vendors <span className={s.optional}>optional</span></label><textarea className={`${s.inp} ${s.ta}`} style={{height:68,fontFamily:"monospace",fontSize:11}} placeholder="Salesforce, SAP, Microsoft…" value={c.focus_vendors_text} onChange={e=>updC(c.id,{focus_vendors_text:e.target.value})}/>{parseCSV(c.focus_vendors_text).length>0&&<div className={s.csvCount}>{parseCSV(c.focus_vendors_text).length} vendors</div>}</div>
            </div>
          </div>
        ))}
      </div>

      <div className={s.runBar}>
        {status!=="idle"&&(<div className={s.statusBar}>
          {status==="running"&&<Loader2 size={16} color="#818cf8" className={s.spin}/>}
          {status==="done"&&<CheckCircle2 size={16} color="#34d399"/>}
          {status==="error"&&<span style={{color:"#E63946",fontSize:13}}>✕</span>}
          <span className={s.statusText}>{progress}</span>
          {status==="done"&&rows.length>0&&<div className={s.dlBtn}><button className={s.dlBtnCSV} style={{background:"rgba(129,140,248,0.12)",color:"#818cf8"}} onClick={()=>dlCSV(rows,TS_FIELDS,"tech-stack.csv")}><Download size={12}/> CSV</button></div>}
        </div>)}
        <button className={`${s.btn} ${s.btnPrimary} ${s.btnRun}`} style={{background:"#6366f1"}} onClick={run} disabled={status==="running"||!valid.length}>
          {status==="running"?<><Loader2 size={16} className={s.spin}/> Scanning…</>:<><Cpu size={16}/> {status==="done"?"Scan again":"Scan Tech Stack"}</>}
        </button>
        <button className={s.historyBtn} style={{color:"#818cf8",borderColor:"rgba(129,140,248,0.2)",background:"rgba(129,140,248,0.08)"}} onClick={()=>{setHistory(loadTSHist());setShowHist(true);setHistEntry(null);}}>
          <History size={13}/> History {history.length>0&&<span className={s.historyBadge} style={{background:"#6366f1"}}>{history.length}</span>}
        </button>
      </div>
      {rows.length>0&&<TSTable rows={rows}/>}
    </>
  );
}

function TSTable({rows}){
  return(
    <div className={s.tableWrap}><div className={s.tableScroll}><table className={s.table}>
      <thead className={s.thead}><tr className={s.theadTr}><th className={s.th}>#</th><th className={s.th}>Company</th>{TS_FIELDS.map(f=><th key={f.key} className={s.th}>{f.label}</th>)}</tr></thead>
      <tbody>{rows.map((row,i)=>{const cat=CAT_COLORS[row.core_tech_category]||{};const conf=confColor(row.confidence_score);return(
        <tr key={i} className={`${s.tbodyTr} ${i%2===0?"":s.tbodyTrEven} ${s.rowNew}`}>
          <td className={`${s.td} ${s.tdNum}`}>{i+1}</td>
          <td className={`${s.td} ${s.tdCo}`}>{row.company_name}</td>
          {TS_FIELDS.map(f=>(
            <td key={f.key} className={`${s.td} ${s.tdVal}`}>
              {f.key==="core_tech_category"&&row[f.key]&&row[f.key]!=="—"?<span className={s.catBadge} style={{background:cat.bg,color:cat.color}}>{row[f.key]}</span>
              :f.key==="confidence_score"&&row[f.key]&&row[f.key]!=="—"?<span className={s.confBadge} style={{background:conf.bg,color:conf.color}}>{row[f.key]}</span>
              :f.key==="source_info"&&row[f.key]&&row[f.key]!=="—"?<span className={s.sourceBadge}>{row[f.key]}</span>
              :row[f.key]&&row[f.key]!=="—"?<span className={s.tdValInner}>{row[f.key]}</span>:<span className={s.tdNone}>—</span>}
            </td>
          ))}
        </tr>);})}
      </tbody>
    </table></div></div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 3 — GCC INTELLIGENCE HUB
// ─────────────────────────────────────────────────────────────────────────────
const GCC_DOMAINS=["Warranty Management","Service Operations & Field Service","Quality Management","Knowledge Management & Technical Documentation","Parts & Spare Parts Management","Dealer Management System (DMS)","Supply Chain & Procurement","Manufacturing Execution & IoT","Engineering & PLM","Customer Experience & CRM","Finance & ERP","HR & Workforce Management","Data Foundation & Analytics","AI & Automation Platform","Cybersecurity & Compliance"];
const GCC_TECH_F=[{key:"domain",label:"Domain"},{key:"layer",label:"Layer"},{key:"tool_vendor",label:"Tool / Vendor"},{key:"current_status",label:"Status"},{key:"notes",label:"Notes"},{key:"source",label:"Source"}];
const GCC_VENDOR_F=[{key:"domain",label:"Domain"},{key:"signal_strength",label:"Signal"},{key:"opportunity_type",label:"Opportunity"},{key:"existing_competitor",label:"Incumbent"},{key:"readiness_score",label:"Score"},{key:"rationale",label:"Rationale"},{key:"source",label:"Source"}];
const GCC_BUDGET_F=[{key:"domain",label:"Domain"},{key:"estimated_budget",label:"Est. Budget (USD)"},{key:"budget_basis",label:"Basis"},{key:"source",label:"Source"}];
const ST_COLORS={"Active":{bg:"rgba(52,211,153,0.12)",color:"#34d399"},"Legacy":{bg:"rgba(251,191,36,0.12)",color:"#fbbf24"},"Evaluating":{bg:"rgba(52,145,232,0.12)",color:"#3491E8"},"Planned":{bg:"rgba(129,140,248,0.12)",color:"#818cf8"},"Replaced":{bg:"rgba(230,57,70,0.12)",color:"#E63946"}};
const SIG_COLORS={"High":{bg:"rgba(52,211,153,0.15)",color:"#34d399"},"Medium":{bg:"rgba(251,191,36,0.15)",color:"#fbbf24"},"Low":{bg:"rgba(100,116,139,0.15)",color:"#64748b"},"None":{bg:"rgba(30,58,80,0.5)",color:"#334155"}};

function GCCIntel() {
  const [co,setCo]=useState("");const [dom,setDom]=useState("");const [vendor,setVendor]=useState("");const [focusTxt,setFocusTxt]=useState("");
  const [status,setStatus]=useState("idle");const [progress,setProgress]=useState("");
  const [techRows,setTechRows]=useState([]);const [budgetRows,setBudgetRows]=useState([]);const [vendorRows,setVendorRows]=useState([]);
  const [tab,setTab]=useState("tech");const [expanded,setExpanded]=useState({});

  const run=useCallback(async()=>{
    if(!co.trim())return;
    setStatus("running");setProgress("Connecting to GCC Intelligence Engine…");setTechRows([]);setBudgetRows([]);setVendorRows([]);
    try{
      const res=await fetch(`${API_URL}/api/gcc-intel`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({company_name:co.trim(),domain:dom.trim(),target_vendor:vendor.trim(),focus_domains:parseCSV(focusTxt)})});
      if(!res.ok||!res.body)throw new Error(`Server ${res.status}`);
      const reader=res.body.getReader();const dec=new TextDecoder();let buf="";
      while(true){const{done,value}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});const lines=buf.split("\n");buf=lines.pop()??"";for(const line of lines){if(!line.startsWith("data: "))continue;try{const ev=JSON.parse(line.slice(6));if(ev.type==="heartbeat"||ev.type==="progress")setProgress(ev.message??"");else if(ev.type==="tech_stack_row"){setTechRows(r=>[...r,ev.row]);setTab("tech");}else if(ev.type==="budget_row")setBudgetRows(r=>[...r,ev.row]);else if(ev.type==="vendor_signal_row")setVendorRows(r=>[...r,ev.row]);else if(ev.type==="complete"){setStatus("done");setProgress(`Done — ${ev.total_tools??0} tools mapped across ${ev.domains_researched??0} domains`);setTab("tech");}else if(ev.type==="error"){setStatus("error");setProgress(ev.message??"Error");}}catch{}}}
    }catch(e){setStatus("error");setProgress(`Failed: ${e.message}`);}
  },[co,dom,vendor,focusTxt]);

  const techByDomain=techRows.reduce((a,r)=>{const d=r.domain||"Other";if(!a[d])a[d]=[];a[d].push(r);return a;},{});

  return(
    <>
      <div className={s.card}>
        <div className={s.cardTitle}>GCC Intelligence Hub — Target Configuration</div>
        <div className={s.cardSub}>Two-phase AI research across {GCC_DOMAINS.length} aftermarket domains. Optionally score a vendor's readiness signals.</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:12}}>
          <div className={s.fieldGroup}><label className={s.fieldLabel}>Company Name *</label><input className={s.inp} placeholder="e.g. Daimler Truck North America" value={co} onChange={e=>setCo(e.target.value)}/></div>
          <div className={s.fieldGroup}><label className={s.fieldLabel}>Company Domain</label><input className={s.inp} placeholder="e.g. daimler-trucks.com" value={dom} onChange={e=>setDom(e.target.value)}/></div>
          <div className={s.fieldGroup}><label className={s.fieldLabel}>Target Vendor <span className={s.optional}>optional</span></label><input className={s.inp} placeholder="e.g. Tavant, Salesforce" value={vendor} onChange={e=>setVendor(e.target.value)}/></div>
          <div className={s.fieldGroup}><label className={s.fieldLabel}>Focus Domains <span className={s.optional}>optional</span></label><textarea className={`${s.inp} ${s.ta}`} style={{height:58,fontSize:11,fontFamily:"monospace"}} placeholder={GCC_DOMAINS.slice(0,2).join(", ")+"…"} value={focusTxt} onChange={e=>setFocusTxt(e.target.value)}/></div>
        </div>
      </div>

      <div className={s.runBar}>
        {status!=="idle"&&(<div className={s.statusBar}>
          {status==="running"&&<Loader2 size={16} color="#f472b6" className={s.spin}/>}
          {status==="done"&&<CheckCircle2 size={16} color="#34d399"/>}
          {status==="error"&&<span style={{color:"#E63946",fontSize:13}}>✕</span>}
          <span className={s.statusText}>{progress}</span>
          {status==="done"&&<div className={s.dlBtn}>
            {techRows.length>0&&<button className={s.dlBtnCSV} onClick={()=>dlCSV(techRows,GCC_TECH_F,"gcc-tech.csv")}><Download size={12}/> Tech</button>}
            {budgetRows.length>0&&<button className={s.dlBtnJSON} onClick={()=>dlCSV(budgetRows,GCC_BUDGET_F,"gcc-budget.csv")}><Download size={12}/> Budget</button>}
            {vendorRows.length>0&&<button className={s.dlBtnCSV} style={{background:"rgba(244,114,182,0.12)",color:"#f472b6"}} onClick={()=>dlCSV(vendorRows,GCC_VENDOR_F,"gcc-signals.csv")}><Download size={12}/> Signals</button>}
          </div>}
        </div>)}
        <button className={`${s.btn} ${s.btnPrimary} ${s.btnRun}`} style={{background:"#e879a0"}} onClick={run} disabled={status==="running"||!co.trim()}>
          {status==="running"?<><Loader2 size={16} className={s.spin}/> Researching…</>:<><Target size={16}/> {status==="done"?"Run again":"Run Intelligence"}</>}
        </button>
      </div>

      {(techRows.length>0||budgetRows.length>0||vendorRows.length>0)&&(
        <div className={s.tableWrap} style={{borderRadius:14}}>
          <div style={{display:"flex",gap:0,borderBottom:"1px solid #1a3a50",background:"#0c1f2e"}}>
            {[["tech","Tech Stack",techRows.length],["budget","IT Budget",budgetRows.length],...(vendorRows.length?[["vendor",(vendor||"Vendor")+" Signals",vendorRows.length]]:[])].map(([id,lbl,cnt])=>(
              <button key={id} onClick={()=>setTab(id)} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"11px 18px",fontSize:12,fontWeight:600,color:tab===id?"#f472b6":"#475569",background:"none",border:"none",borderBottom:tab===id?"2px solid #f472b6":"2px solid transparent",cursor:"pointer",fontFamily:"inherit"}}>
                {lbl} <span style={{background:"rgba(244,114,182,0.1)",color:"#f472b6",fontSize:10,padding:"1px 5px",borderRadius:10}}>{cnt}</span>
              </button>
            ))}
          </div>
          {tab==="tech"&&<div>{Object.entries(techByDomain).map(([d,drows])=>(
            <div key={d} style={{borderBottom:"1px solid #0f2a3d"}}>
              <button style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 16px",background:"#0a1c2a",border:"none",cursor:"pointer",fontFamily:"inherit",color:"#fff",textAlign:"left"}} onClick={()=>setExpanded(p=>({...p,[d]:p[d]===false}))}>
                <span style={{fontSize:12,fontWeight:700,flex:1}}>{d}</span>
                <span style={{fontSize:10,color:"#3491E8",background:"rgba(52,145,232,0.1)",padding:"1px 7px",borderRadius:10}}>{drows.length} tools</span>
                {expanded[d]===false?<ChevronDown size={13}/>:<ChevronUp size={13}/>}
              </button>
              {expanded[d]!==false&&<div className={s.tableScroll}><table className={s.table}><thead className={s.thead}><tr className={s.theadTr}>{GCC_TECH_F.filter(f=>f.key!=="domain").map(f=><th key={f.key} className={s.th}>{f.label}</th>)}</tr></thead><tbody>
                {drows.map((row,i)=>{const st=ST_COLORS[row.current_status]||{};return(<tr key={i} className={`${s.tbodyTr} ${i%2===0?"":s.tbodyTrEven} ${s.rowNew}`}>
                  <td className={s.td}><span style={{display:"inline-block",padding:"2px 6px",borderRadius:4,fontSize:10,fontWeight:600,background:"rgba(52,145,232,0.08)",color:"#475569"}}>{row.layer||"—"}</span></td>
                  <td className={`${s.td} ${s.tdCo}`}>{row.tool_vendor||"—"}</td>
                  <td className={s.td}>{row.current_status?<span style={{display:"inline-block",padding:"2px 7px",borderRadius:20,fontSize:10,fontWeight:700,background:st.bg,color:st.color}}>{row.current_status}</span>:<span className={s.tdNone}>—</span>}</td>
                  <td className={`${s.td} ${s.tdVal}`} style={{fontSize:11,color:"#94a3b8"}}>{row.notes||"—"}</td>
                  <td className={s.td}>{row.source&&row.source!=="-"?<a href={row.source} target="_blank" rel="noreferrer" className={s.sourceLink}>↗ link</a>:<span className={s.tdNone}>—</span>}</td>
                </tr>);})}
              </tbody></table></div>}
            </div>
          ))}</div>}
          {tab==="budget"&&budgetRows.length>0&&<div className={s.tableScroll}><table className={s.table}><thead className={s.thead}><tr className={s.theadTr}>{GCC_BUDGET_F.map(f=><th key={f.key} className={s.th}>{f.label}</th>)}</tr></thead><tbody>{budgetRows.map((row,i)=>(<tr key={i} className={`${s.tbodyTr} ${i%2===0?"":s.tbodyTrEven} ${s.rowNew}`}><td className={`${s.td} ${s.tdCo}`}>{row.domain||"—"}</td><td className={s.td} style={{fontWeight:700,color:"#34d399",fontSize:13}}>{row.estimated_budget||"—"}</td><td className={s.td}>{row.budget_basis||"—"}</td><td className={s.td}>{row.source&&row.source!=="-"?<a href={row.source} target="_blank" rel="noreferrer" className={s.sourceLink}>↗ link</a>:<span className={s.tdNone}>—</span>}</td></tr>))}</tbody></table></div>}
          {tab==="vendor"&&vendorRows.length>0&&<div className={s.tableScroll}><table className={s.table}><thead className={s.thead}><tr className={s.theadTr}>{GCC_VENDOR_F.map(f=><th key={f.key} className={s.th}>{f.label}</th>)}</tr></thead><tbody>{vendorRows.map((row,i)=>{const sig=SIG_COLORS[row.signal_strength]||{};const score=parseInt(row.readiness_score)||0;return(<tr key={i} className={`${s.tbodyTr} ${i%2===0?"":s.tbodyTrEven} ${s.rowNew}`}><td className={`${s.td} ${s.tdCo}`}>{row.domain||"—"}</td><td className={s.td}>{row.signal_strength?<span style={{display:"inline-block",padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,background:sig.bg,color:sig.color}}>{row.signal_strength}</span>:<span className={s.tdNone}>—</span>}</td><td className={s.td}><span style={{display:"inline-block",padding:"2px 6px",borderRadius:4,fontSize:10,background:"rgba(129,140,248,0.1)",color:"#818cf8"}}>{row.opportunity_type||"—"}</span></td><td className={`${s.td} ${s.tdCo}`}>{row.existing_competitor||"—"}</td><td className={s.td}>{score>0?<div style={{display:"flex",alignItems:"center",gap:6,minWidth:80}}><div style={{height:4,borderRadius:2,width:`${score}%`,background:score>=70?"#34d399":score>=40?"#fbbf24":"#E63946"}}/><span style={{fontSize:11,fontWeight:700}}>{score}</span></div>:<span className={s.tdNone}>—</span>}</td><td className={`${s.td} ${s.tdVal}`} style={{fontSize:11,color:"#94a3b8",maxWidth:240}}>{row.rationale||"—"}</td><td className={s.td}>{row.source&&row.source!=="-"?<a href={row.source} target="_blank" rel="noreferrer" className={s.sourceLink}>↗ link</a>:<span className={s.tdNone}>—</span>}</td></tr>);})}</tbody></table></div>}
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 4 — AFTERMARKET DEEP DIVE
// ─────────────────────────────────────────────────────────────────────────────
const AM_CAP_F=[{key:"domain",label:"Domain"},{key:"capability",label:"Capability"},{key:"maturity_level",label:"Maturity"},{key:"technology_used",label:"Technology Used"},{key:"key_finding",label:"Key Finding"},{key:"source",label:"Source"}];
const AM_GAP_F=[{key:"domain",label:"Domain"},{key:"gap_description",label:"Gap / Opportunity"},{key:"priority",label:"Priority"},{key:"recommended_tech",label:"Recommended Tech"},{key:"benchmark",label:"Industry Benchmark"},{key:"source",label:"Source"}];
const AM_COMP_F=[{key:"competitor",label:"Competitor"},{key:"domain",label:"Domain"},{key:"their_advantage",label:"Their Advantage"},{key:"technology",label:"Technology"},{key:"implication",label:"Implication"},{key:"source",label:"Source"}];
const MATURITY_COLORS={"Leading":{bg:"rgba(52,211,153,0.15)",color:"#34d399"},"Established":{bg:"rgba(52,145,232,0.15)",color:"#3491E8"},"Developing":{bg:"rgba(251,191,36,0.15)",color:"#fbbf24"},"Basic":{bg:"rgba(100,116,139,0.15)",color:"#64748b"},"Gap":{bg:"rgba(230,57,70,0.15)",color:"#E63946"}};
const PRIORITY_COLORS={"Critical":{bg:"rgba(230,57,70,0.15)",color:"#E63946"},"High":{bg:"rgba(251,191,36,0.15)",color:"#fbbf24"},"Medium":{bg:"rgba(52,145,232,0.15)",color:"#3491E8"},"Low":{bg:"rgba(100,116,139,0.15)",color:"#64748b"}};

function AftermarketDive() {
  const [co,setCo]=useState("");const [dom,setDom]=useState("");const [industry,setIndustry]=useState("");const [competitors,setCompetitors]=useState("");
  const [status,setStatus]=useState("idle");const [progress,setProgress]=useState("");
  const [capRows,setCapRows]=useState([]);const [gapRows,setGapRows]=useState([]);const [compRows,setCompRows]=useState([]);
  const [tab,setTab]=useState("capabilities");

  const run=useCallback(async()=>{
    if(!co.trim())return;
    setStatus("running");setProgress("Starting Aftermarket Deep Dive…");setCapRows([]);setGapRows([]);setCompRows([]);
    try{
      const res=await fetch(`${API_URL}/api/aftermarket-dive`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({company_name:co.trim(),domain:dom.trim(),industry:industry.trim(),competitors:competitors.trim()})});
      if(!res.ok||!res.body)throw new Error(`Server ${res.status}`);
      const reader=res.body.getReader();const dec=new TextDecoder();let buf="";
      while(true){const{done,value}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});const lines=buf.split("\n");buf=lines.pop()??"";for(const line of lines){if(!line.startsWith("data: "))continue;try{const ev=JSON.parse(line.slice(6));if(ev.type==="heartbeat"||ev.type==="progress")setProgress(ev.message??"");else if(ev.type==="capability_row"){setCapRows(r=>[...r,ev.row]);setTab("capabilities");}else if(ev.type==="gap_row")setGapRows(r=>[...r,ev.row]);else if(ev.type==="competitor_row")setCompRows(r=>[...r,ev.row]);else if(ev.type==="complete"){setStatus("done");const tot=(ev.capabilities?.length??0)+(ev.gaps?.length??0)+(ev.competitors?.length??0);setProgress(`Done — ${tot} findings across capabilities, gaps & competitive analysis`);}else if(ev.type==="error"){setStatus("error");setProgress(ev.message??"Error");}}catch{}}}
    }catch(e){setStatus("error");setProgress(`Failed: ${e.message}`);}
  },[co,dom,industry,competitors]);

  return(
    <>
      <div className={s.card}>
        <div className={s.cardTitle}>Aftermarket Deep Dive — Configuration</div>
        <div className={s.cardSub}>Assess aftermarket service capabilities, identify technology gaps, and benchmark against competitors across 12 service domains.</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:12}}>
          <div className={s.fieldGroup}><label className={s.fieldLabel}>Company Name *</label><input className={s.inp} placeholder="e.g. Daimler Truck North America" value={co} onChange={e=>setCo(e.target.value)}/></div>
          <div className={s.fieldGroup}><label className={s.fieldLabel}>Domain</label><input className={s.inp} placeholder="e.g. daimler-trucks.com" value={dom} onChange={e=>setDom(e.target.value)}/></div>
          <div className={s.fieldGroup}><label className={s.fieldLabel}>Industry <span className={s.optional}>optional</span></label><input className={s.inp} placeholder="e.g. Heavy Truck Manufacturing" value={industry} onChange={e=>setIndustry(e.target.value)}/></div>
          <div className={s.fieldGroup}><label className={s.fieldLabel}>Competitors <span className={s.optional}>optional · comma separated</span></label><input className={s.inp} placeholder="e.g. PACCAR, Volvo, Navistar" value={competitors} onChange={e=>setCompetitors(e.target.value)}/></div>
        </div>
      </div>

      <div className={s.runBar}>
        {status!=="idle"&&(<div className={s.statusBar}>
          {status==="running"&&<Loader2 size={16} color="#34d399" className={s.spin}/>}
          {status==="done"&&<CheckCircle2 size={16} color="#34d399"/>}
          {status==="error"&&<span style={{color:"#E63946",fontSize:13}}>✕</span>}
          <span className={s.statusText}>{progress}</span>
          {status==="done"&&<div className={s.dlBtn}>
            {capRows.length>0&&<button className={s.dlBtnCSV} onClick={()=>dlCSV(capRows,AM_CAP_F,"am-capabilities.csv")}><Download size={12}/> Capabilities</button>}
            {gapRows.length>0&&<button className={s.dlBtnJSON} onClick={()=>dlCSV(gapRows,AM_GAP_F,"am-gaps.csv")}><Download size={12}/> Gaps</button>}
            {compRows.length>0&&<button className={s.dlBtnCSV} style={{background:"rgba(244,114,182,0.12)",color:"#f472b6"}} onClick={()=>dlCSV(compRows,AM_COMP_F,"am-competitive.csv")}><Download size={12}/> Competitive</button>}
          </div>}
        </div>)}
        <button className={`${s.btn} ${s.btnPrimary} ${s.btnRun}`} style={{background:"#059669"}} onClick={run} disabled={status==="running"||!co.trim()}>
          {status==="running"?<><Loader2 size={16} className={s.spin}/> Analysing…</>:<><BarChart3 size={16}/> {status==="done"?"Run again":"Run Deep Dive"}</>}
        </button>
      </div>

      {(capRows.length>0||gapRows.length>0||compRows.length>0)&&(
        <div className={s.tableWrap} style={{borderRadius:14}}>
          <div style={{display:"flex",gap:0,borderBottom:"1px solid #1a3a50",background:"#0c1f2e"}}>
            {[["capabilities","Capabilities",capRows.length],["gaps","Tech Gaps",gapRows.length],...(compRows.length?[["competitive","Competitive",compRows.length]]:[])].map(([id,lbl,cnt])=>(
              <button key={id} onClick={()=>setTab(id)} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"11px 18px",fontSize:12,fontWeight:600,color:tab===id?"#34d399":"#475569",background:"none",border:"none",borderBottom:tab===id?"2px solid #34d399":"2px solid transparent",cursor:"pointer",fontFamily:"inherit"}}>
                {lbl} <span style={{background:"rgba(52,211,153,0.1)",color:"#34d399",fontSize:10,padding:"1px 5px",borderRadius:10}}>{cnt}</span>
              </button>
            ))}
          </div>

          {tab==="capabilities"&&capRows.length>0&&<div className={s.tableScroll}><table className={s.table}><thead className={s.thead}><tr className={s.theadTr}>{AM_CAP_F.map(f=><th key={f.key} className={s.th}>{f.label}</th>)}</tr></thead><tbody>{capRows.map((row,i)=>{const m=MATURITY_COLORS[row.maturity_level]||{};return(<tr key={i} className={`${s.tbodyTr} ${i%2===0?"":s.tbodyTrEven} ${s.rowNew}`}><td className={`${s.td} ${s.tdCo}`}>{row.domain||"—"}</td><td className={s.td}>{row.capability||"—"}</td><td className={s.td}>{row.maturity_level?<span style={{display:"inline-block",padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,background:m.bg,color:m.color}}>{row.maturity_level}</span>:<span className={s.tdNone}>—</span>}</td><td className={s.td}>{row.technology_used||"—"}</td><td className={`${s.td} ${s.tdVal}`} style={{fontSize:11,color:"#94a3b8"}}>{row.key_finding||"—"}</td><td className={s.td}>{row.source&&row.source!=="-"?<a href={row.source} target="_blank" rel="noreferrer" className={s.sourceLink}>↗ link</a>:<span className={s.tdNone}>—</span>}</td></tr>);})}</tbody></table></div>}

          {tab==="gaps"&&gapRows.length>0&&<div className={s.tableScroll}><table className={s.table}><thead className={s.thead}><tr className={s.theadTr}>{AM_GAP_F.map(f=><th key={f.key} className={s.th}>{f.label}</th>)}</tr></thead><tbody>{gapRows.map((row,i)=>{const p=PRIORITY_COLORS[row.priority]||{};return(<tr key={i} className={`${s.tbodyTr} ${i%2===0?"":s.tbodyTrEven} ${s.rowNew}`}><td className={`${s.td} ${s.tdCo}`}>{row.domain||"—"}</td><td className={`${s.td} ${s.tdVal}`} style={{maxWidth:220}}>{row.gap_description||"—"}</td><td className={s.td}>{row.priority?<span style={{display:"inline-block",padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,background:p.bg,color:p.color}}>{row.priority}</span>:<span className={s.tdNone}>—</span>}</td><td className={s.td}>{row.recommended_tech||"—"}</td><td className={`${s.td} ${s.tdVal}`} style={{fontSize:11,color:"#94a3b8"}}>{row.benchmark||"—"}</td><td className={s.td}>{row.source&&row.source!=="-"?<a href={row.source} target="_blank" rel="noreferrer" className={s.sourceLink}>↗ link</a>:<span className={s.tdNone}>—</span>}</td></tr>);})}</tbody></table></div>}

          {tab==="competitive"&&compRows.length>0&&<div className={s.tableScroll}><table className={s.table}><thead className={s.thead}><tr className={s.theadTr}>{AM_COMP_F.map(f=><th key={f.key} className={s.th}>{f.label}</th>)}</tr></thead><tbody>{compRows.map((row,i)=>(<tr key={i} className={`${s.tbodyTr} ${i%2===0?"":s.tbodyTrEven} ${s.rowNew}`}><td className={`${s.td} ${s.tdCo}`}>{row.competitor||"—"}</td><td className={s.td}>{row.domain||"—"}</td><td className={`${s.td} ${s.tdVal}`} style={{maxWidth:180}}>{row.their_advantage||"—"}</td><td className={s.td}>{row.technology||"—"}</td><td className={`${s.td} ${s.tdVal}`} style={{fontSize:11,color:"#94a3b8",maxWidth:200}}>{row.implication||"—"}</td><td className={s.td}>{row.source&&row.source!=="-"?<a href={row.source} target="_blank" rel="noreferrer" className={s.sourceLink}>↗ link</a>:<span className={s.tdNone}>—</span>}</td></tr>))}</tbody></table></div>}
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT PAGE — 4-TAB SHELL
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { id:"deals",    label:"IT Deal Finder",       icon:<Search size={13}/>,    accent:"#3491E8" },
  { id:"techstack",label:"Tech Stack Finder",    icon:<Cpu size={13}/>,       accent:"#818cf8" },
  { id:"gcc",      label:"GCC Intelligence",     icon:<Target size={13}/>,    accent:"#f472b6" },
  { id:"aftermarket",label:"Aftermarket Deep Dive",icon:<BarChart3 size={13}/>,accent:"#34d399" },
];

export default function EnrichPage() {
  const [tab, setTab] = useState("deals");
  const current = TABS.find(t=>t.id===tab);

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={s.headerInner}>
          <div className={s.iconBox} style={{background:`rgba(${current.accent.replace("#","").match(/.{2}/g).map(x=>parseInt(x,16)).join(",")},0.15)`}}>
            {current.icon}
          </div>
          <div>
            <div className={s.headerTitle}>RefractOne Intelligence</div>
            <div className={s.headerSub}>Powered by RefractOne</div>
          </div>
        </div>
        <div className={s.moduleTabs}>
          {TABS.map(t=>(
            <button key={t.id} className={`${s.moduleTab} ${tab===t.id?s.moduleTabActive:""}`}
              style={tab===t.id?{color:t.accent,borderBottomColor:t.accent}:{}}
              onClick={()=>setTab(t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className={s.main}>
        {tab==="deals"      && <DealFinder/>}
        {tab==="techstack"  && <TechStackFinder/>}
        {tab==="gcc"        && <GCCIntel/>}
        {tab==="aftermarket"&& <AftermarketDive/>}
      </main>
    </div>
  );
}
