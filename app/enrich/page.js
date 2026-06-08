"use client";
import React, { useState, useCallback, useEffect, useRef } from "react";
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

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{padding:"20px",background:"rgba(230,57,70,0.08)",border:"1px solid rgba(230,57,70,0.3)",borderRadius:10,color:"#E63946",fontSize:12,margin:"16px 0"}}>
          <strong>Something went wrong rendering this section.</strong>
          <div style={{marginTop:6,color:"#94a3b8",fontFamily:"monospace",fontSize:11}}>{String(this.state.error)}</div>
          <button onClick={()=>this.setState({error:null})} style={{marginTop:8,fontSize:11,color:"#E63946",background:"none",border:"1px solid rgba(230,57,70,0.3)",borderRadius:4,padding:"3px 8px",cursor:"pointer"}}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
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
              <div key={e.id} className={s.historyItem} style={{position:"relative"}}>
                <button style={{all:"unset",display:"block",width:"100%",cursor:"pointer"}} onClick={()=>setHistEntry(e)}>
                  <div className={s.historyItemTop}><span className={s.historyItemCompanies}>{e.companies.slice(0,3).join(", ")}{e.companies.length>3?` +${e.companies.length-3}`:""}</span><span className={s.historyItemCount}>{e.rows?.length??0} deals</span></div>
                  <div className={s.historyItemDate}><Clock size={10}/> {new Date(e.date).toLocaleString()}</div>
                </button>
                <button onClick={ev=>{ev.stopPropagation();const u=history.filter(h=>h.id!==e.id);saveDealHist(u);setHistory(u);}} style={{position:"absolute",top:8,right:8,background:"rgba(230,57,70,0.08)",border:"1px solid rgba(230,57,70,0.2)",cursor:"pointer",color:"#E63946",padding:"2px 7px",borderRadius:4,fontSize:11,fontWeight:700}} title="Delete this report">✕</button>
              </div>))}</div>)}
          {histEntry&&(<div className={s.historyDetail}>
            <div className={s.historyDetailMeta}><span className={s.historyItemDate}><Clock size={10}/> {new Date(histEntry.date).toLocaleString()}</span><span className={s.historyItemCount}>{histEntry.rows?.length??0} deals</span></div>
            <div className={s.historyDetailActions}><button className={s.dlBtnCSV} onClick={()=>dlCSVDeals(histEntry.rows||[])}><Download size={12}/> CSV</button><button className={s.dlBtnJSON} onClick={()=>dlJSON(histEntry.rows||[])}><Download size={12}/> JSON</button><button className={s.historyDeleteOne} onClick={()=>{const u=history.filter(h=>h.id!==histEntry.id);saveDealHist(u);setHistory(u);setHistEntry(null);}}><Trash2 size={12}/> Delete</button></div>
            <DealTable rows={histEntry.rows||[]}/>
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
          {!histEntry&&(history.length===0?<EmptyState msg="No scans yet."/>:<div className={s.historyList}>{history.map(e=>(<div key={e.id} className={s.historyItem} style={{position:"relative"}}><button style={{all:"unset",display:"block",width:"100%",cursor:"pointer"}} onClick={()=>setHistEntry(e)}><div className={s.historyItemTop}><span className={s.historyItemCompanies}>{e.companies.slice(0,3).join(", ")}</span><span className={s.historyItemCount}>{(e.rows||[]).filter(r=>r._status==="ok").length} tools</span></div><div className={s.historyItemDate}><Clock size={10}/> {new Date(e.date).toLocaleString()}</div></button><button onClick={ev=>{ev.stopPropagation();const u=history.filter(h=>h.id!==e.id);saveTSHist(u);setHistory(u);}} style={{position:"absolute",top:8,right:8,background:"rgba(230,57,70,0.08)",border:"1px solid rgba(230,57,70,0.2)",cursor:"pointer",color:"#E63946",padding:"2px 7px",borderRadius:4,fontSize:11,fontWeight:700}} title="Delete this report">✕</button></div>))}</div>)}
          {histEntry&&(<div className={s.historyDetail}><div className={s.historyDetailActions}><button className={s.dlBtnCSV} onClick={()=>dlCSV(histEntry.rows||[],TS_FIELDS,"tech-stack.csv")}><Download size={12}/> CSV</button><button className={s.historyDeleteOne} onClick={()=>{const u=history.filter(h=>h.id!==histEntry.id);saveTSHist(u);setHistory(u);setHistEntry(null);}}><Trash2 size={12}/> Delete</button></div><TSTable rows={histEntry.rows||[]}/></div>)}
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
// SHARED HISTORY HELPERS (GCC + Aftermarket)
// ─────────────────────────────────────────────────────────────────────────────
const GCC_HIST_KEY = "gcc_intel_history";
const AM_HIST_KEY  = "aftermarket_history";
const MAX_HIST = 30;
function loadGCCHist(){try{const r=JSON.parse(localStorage.getItem(GCC_HIST_KEY)??"[]");return Array.isArray(r)?r.filter(e=>e&&e.id&&e.date):[]; }catch{return[];}}
function saveGCCHist(h){try{localStorage.setItem(GCC_HIST_KEY,JSON.stringify(h));}catch{}}
function loadAMHist(){try{const r=JSON.parse(localStorage.getItem(AM_HIST_KEY)??"[]");return Array.isArray(r)?r.filter(e=>e&&e.id&&e.date):[]; }catch{return[];}}
function saveAMHist(h){try{localStorage.setItem(AM_HIST_KEY,JSON.stringify(h));}catch{}}

function HistPanel({history,onClose,onSelect,onClear,onDeleteOne,histEntry,onBack,accentColor,renderEntry}){
  return(
    <div className={s.historyOverlay} onClick={()=>{onClose();onBack();}}>
      <div className={s.historyPanel} onClick={e=>e.stopPropagation()}>
        <div className={s.historyHeader}>
          <span className={s.historyTitle}>
            {histEntry?<button className={s.historyBack} style={{color:accentColor}} onClick={onBack}>← Back</button>:"Report History"}
          </span>
          {!histEntry&&history.length>0&&<button className={s.historyDeleteAll} onClick={onClear}>Clear all</button>}
          <button className={s.historyClose} onClick={()=>{onClose();onBack();}}><X size={15}/></button>
        </div>
        {!histEntry&&(history.length===0
          ?<div className={s.historyEmpty}>No reports yet. Run a search to save results.</div>
          :<div className={s.historyList}>{history.map(e=>(
            <div key={e.id} className={s.historyItem} style={{position:"relative"}}>
              <button style={{all:"unset",display:"block",width:"100%",cursor:"pointer"}} onClick={()=>onSelect(e)}>
                <div className={s.historyItemTop}>
                  <span className={s.historyItemCompanies}>{e.company}</span>
                  <span className={s.historyItemCount} style={{color:accentColor}}>{e.summary}</span>
                </div>
                <div className={s.historyItemDate}><Clock size={10}/> {new Date(e.date).toLocaleString()}</div>
                <div style={{marginTop:6,fontSize:10,color:accentColor,fontWeight:600}}>Click to view results →</div>
              </button>
              <button onClick={ev=>{ev.stopPropagation();onClear&&typeof onClear==="function"?null:null;const u=history.filter(h=>h.id!==e.id);onDeleteOne&&onDeleteOne(e.id,u);}} style={{position:"absolute",top:8,right:8,background:"rgba(230,57,70,0.08)",border:"1px solid rgba(230,57,70,0.2)",cursor:"pointer",color:"#E63946",padding:"2px 7px",borderRadius:4,fontSize:11,fontWeight:700}} title="Delete this report">✕</button>
            </div>
          ))}</div>
        )}
        {histEntry&&renderEntry(histEntry)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 3 — GCC INTELLIGENCE HUB
// ─────────────────────────────────────────────────────────────────────────────
// ── GCC Intelligence constants ────────────────────────────────────────────────
const GCC_FIELDS=[
  {key:"company_name",label:"Company Name"},
  {key:"gcc_name",label:"GCC / Centre Name"},
  {key:"location",label:"Location"},
  {key:"size",label:"Headcount"},
  {key:"established",label:"Est."},
  {key:"tech_projects",label:"Key Tech Projects"},
  {key:"languages",label:"Languages / Frameworks"},
  {key:"cloud",label:"Cloud & Containers"},
  {key:"data_mlops",label:"Data / MLOps"},
  {key:"executives",label:"Key Executives (Top 3)"},
  {key:"source",label:"Source"},
];

function GCCIntel() {
  const [co,setCo]=useState("");
  const [dom,setDom]=useState("");
  const [location,setLocation]=useState("");
  const [status,setStatus]=useState("idle");
  const [progress,setProgress]=useState("");
  const [gccRows,setGccRows]=useState([]);
  const [showHist,setShowHist]=useState(false);
  const [history,setHistory]=useState([]);
  const [histEntry,setHistEntry]=useState(null);

  useEffect(()=>setHistory(loadGCCHist()),[]);

  const run=useCallback(async()=>{
    if(!co.trim())return;
    setStatus("running");setProgress("Searching for GCCs…");setGccRows([]);
    try{
      const res=await fetch(`${API_URL}/api/gcc-intel`,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({company_name:co.trim(),domain:dom.trim(),location:location.trim(),target_vendor:"",focus_domains:[]})});
      if(!res.ok||!res.body)throw new Error(`Server ${res.status}`);
      const reader=res.body.getReader();const dec=new TextDecoder();let buf="";
      let allRows=[];
      while(true){
        const{done,value}=await reader.read();if(done)break;
        buf+=dec.decode(value,{stream:true});const lines=buf.split("\n");buf=lines.pop()??"";
        for(const line of lines){
          if(!line.startsWith("data: "))continue;
          try{
            const ev=JSON.parse(line.slice(6));
            if(ev.type==="heartbeat"||ev.type==="progress")setProgress(ev.message??"");
            else if(ev.type==="gcc_row"){allRows=[...allRows,ev.row];setGccRows([...allRows]);}
            else if(ev.type==="complete"){
              setStatus("done");
              setProgress(`Done — ${ev.total??allRows.length} GCC${(ev.total??allRows.length)===1?"":"s"} found for ${co.trim()}`);
              const entry={id:Date.now(),date:new Date().toISOString(),company:co.trim(),summary:`${allRows.length} GCC location${allRows.length===1?"":"s"}`,rows:allRows};
              const h=[entry,...loadGCCHist()].slice(0,MAX_HIST);saveGCCHist(h);setHistory(h);
            }
            else if(ev.type==="error"){setStatus("error");setProgress(ev.message??"Error");}
          }catch{}
        }
      }
    }catch(e){setStatus("error");setProgress(`Failed: ${e.message}`);}
  },[co,dom,location]);

  // Support both new schema (histEntry.rows) and old schema (histEntry.techRows)
  const histRows = histEntry
    ? (histEntry.rows?.length ? histEntry.rows
       : histEntry.techRows?.length ? histEntry.techRows   // legacy schema migration
       : [])
    : [];
  const displayRows = histEntry ? histRows : gccRows;
  const isLegacyReport = histEntry && !histEntry.rows?.length && histEntry.techRows?.length > 0;

  return(
    <>
      {showHist&&<HistPanel history={history} accentColor="#f472b6"
        onClose={()=>setShowHist(false)} onBack={()=>setHistEntry(null)}
        onSelect={e=>{setHistEntry(e);setShowHist(false);}}
        onClear={()=>{saveGCCHist([]);setHistory([]);}}
        onDeleteOne={(id,u)=>{saveGCCHist(u);setHistory(u);if(histEntry?.id===id)setHistEntry(null);}}
        histEntry={histEntry}
        renderEntry={e=>(
          <div className={s.historyDetail}>
            <div className={s.historyDetailMeta}>
              <span className={s.historyItemDate}><Clock size={10}/> {new Date(e.date).toLocaleString()}</span>
              <span className={s.historyItemCount} style={{color:"#f472b6"}}>{e.summary}</span>
            </div>
            <div className={s.historyDetailActions}>
              {(e.rows?.length>0)&&<button className={s.dlBtnCSV} onClick={()=>dlCSV(e.rows,GCC_FIELDS,"gcc-intel.csv")}><Download size={12}/> CSV</button>}
              <button className={s.historyDeleteOne} onClick={()=>{const u=history.filter(h=>h.id!==e.id);saveGCCHist(u);setHistory(u);setHistEntry(null);}}><Trash2 size={12}/> Delete</button>
            </div>
          </div>
        )}
      />}

      <div className={s.card}>
        <div className={s.row}>
          <div className={s.cardTitle}>GCC Intelligence Hub</div>
          <button className={s.historyBtn} style={{color:"#f472b6",borderColor:"rgba(244,114,182,0.2)",background:"rgba(244,114,182,0.08)"}} onClick={()=>{setHistory(loadGCCHist());setShowHist(true);setHistEntry(null);}}>
            <History size={13}/> History {history.length>0&&<span className={s.historyBadge} style={{background:"#e879a0"}}>{history.length}</span>}
          </button>
        </div>
        <div className={s.cardSub}>
          Maps all Global Capability Centres of a company worldwide — locations, tech projects
          (languages, cloud, containers, data/MLOps), headcount, and top 3 executives per GCC.
        </div>
        <div className={s.queryRow}>
          <div className={s.fieldGroup}>
            <label className={s.fieldLabel}>Company Name <span className={s.required}>*</span></label>
            <input className={s.inp} placeholder="e.g. Daimler Truck, HDFC Bank, Infosys" value={co} onChange={e=>setCo(e.target.value)}/>
          </div>
          <div className={s.fieldGroup}>
            <label className={s.fieldLabel}>Webpage URL <span className={s.required}>*</span></label>
            <input className={s.inp} placeholder="e.g. daimler-truck.com" value={dom} onChange={e=>setDom(e.target.value)}/>
          </div>
          <div className={s.fieldGroup}>
            <label className={s.fieldLabel}>Location Filter <span className={s.optional}>Optional</span></label>
            <input className={s.inp} placeholder="e.g. India, Poland, Germany" value={location} onChange={e=>setLocation(e.target.value)}/>
          </div>
          <button className={s.btnSynthesize} onClick={run} disabled={status==="running"||!co.trim()||!dom.trim()}>
            {status==="running"?<><Loader2 size={15} className={s.spin}/> Searching&#8230;</>:<><Target size={15}/> Find GCCs</>}
          </button>
        </div>
      </div>

      {status!=="idle"&&(<div className={s.statusBarFull}>
        {status==="running"&&<Loader2 size={15} color="#f472b6" className={s.spin}/>}
        {status==="done"&&<CheckCircle2 size={15} color="#34d399"/>}
        {status==="error"&&<span style={{color:"#E63946"}}>&#10005;</span>}
        <span className={s.statusText}>{progress}</span>
        {status==="done"&&displayRows.length>0&&<div className={s.dlBtn}>
          <button className={s.dlBtnCSV} style={{background:"rgba(244,114,182,0.12)",color:"#f472b6"}} onClick={()=>dlCSV(displayRows,GCC_FIELDS,"gcc-intel.csv")}><Download size={12}/> CSV</button>
        </div>}
      </div>)}

      {histEntry&&<div style={{padding:"10px 16px",background:"rgba(244,114,182,0.08)",border:"1px solid rgba(244,114,182,0.2)",borderRadius:8,fontSize:11,color:"#f472b6",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        {isLegacyReport
          ? <span>⚠️ This report was generated with an older version of GCC Intel (aftermarket tech stack format). The new GCC Intel maps Global Capability Centres. Please <strong>run a new search</strong> to get GCC data for this company.</span>
          : <span>📋 Viewing history: <strong>{histEntry.company}</strong> · {new Date(histEntry.date).toLocaleString()} · {displayRows.length} GCCs</span>
        }
        <button onClick={()=>setHistEntry(null)} style={{fontSize:10,color:"#f472b6",background:"none",border:"none",cursor:"pointer",textDecoration:"underline",padding:0,flexShrink:0}}>
          {isLegacyReport ? "Dismiss" : "Back to current"}
        </button>
      </div>}

      {displayRows.length>0&&(
        <div className={s.tableWrap}>
          <div className={s.tableScroll}>
            <table className={s.table}>
              <thead className={s.thead}><tr className={s.theadTr}>
                <th className={s.th} style={{width:160}}>Company Name</th>
                <th className={s.th} style={{width:180}}>GCC / Centre Name</th>
                <th className={s.th} style={{width:130}}>Location</th>
                <th className={s.th} style={{width:100}}>Headcount</th>
                <th className={s.th} style={{width:60}}>Est.</th>
                <th className={s.th}>Key Tech Projects</th>
                <th className={s.th} style={{width:150}}>Languages / Frameworks</th>
                <th className={s.th} style={{width:150}}>Cloud & Containers</th>
                <th className={s.th} style={{width:150}}>Data / MLOps</th>
                <th className={s.th} style={{width:200}}>Key Executives (Top 3)</th>
                <th className={s.th} style={{width:60}}>Source</th>
              </tr></thead>
              <tbody>
                {displayRows.map((row,i)=>(
                  <tr key={i} className={`${s.tbodyTr} ${i%2===0?"":s.tbodyTrEven} ${s.rowNew}`}>
                    <td className={`${s.td} ${s.tdCo}`} style={{whiteSpace:"normal"}}>{row.company_name||"—"}</td>
                    <td className={`${s.td} ${s.tdCo}`} style={{whiteSpace:"normal",color:"#818cf8"}}>{row.gcc_name||"—"}</td>
                    <td className={s.td}><span style={{display:"inline-flex",alignItems:"center",gap:4,fontWeight:600,color:"#e2e8f0",fontSize:11}}>{row.location||"—"}</span></td>
                    <td className={s.td} style={{fontSize:11,color:"#34d399"}}>{row.size||"—"}</td>
                    <td className={s.td} style={{fontSize:11,color:"#64748b"}}>{row.established||"—"}</td>
                    <td className={s.td} style={{whiteSpace:"normal",lineHeight:1.5,fontSize:11}}>{row.tech_projects||"—"}</td>
                    <td className={s.td} style={{whiteSpace:"normal",fontSize:11,color:"#fbbf24"}}>{row.languages||"—"}</td>
                    <td className={s.td} style={{whiteSpace:"normal",fontSize:11,color:"#3491E8"}}>{row.cloud||"—"}</td>
                    <td className={s.td} style={{whiteSpace:"normal",fontSize:11,color:"#f472b6"}}>{row.data_mlops||"—"}</td>
                    <td className={s.td} style={{whiteSpace:"normal",fontSize:11,lineHeight:1.6}}>{row.executives||"—"}</td>
                    <td className={s.td}>{row.source&&row.source!=="-"?<a href={row.source} target="_blank" rel="noreferrer" className={s.sourceLink}>&#8599;</a>:<span className={s.tdNone}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}




// ── Aftermarket constants ─────────────────────────────────────────────────────
const AM_CAP_F=[{key:"domain",label:"Domain"},{key:"capability",label:"Capability"},{key:"technology",label:"Technology"},{key:"use_case",label:"Use Case"},{key:"install_base",label:"Install Base"},{key:"source",label:"Source"}];
const AM_GAP_F=[{key:"domain",label:"Domain"},{key:"gap_description",label:"Gap"},{key:"priority",label:"Priority"},{key:"recommended_tech",label:"Recommended Tech"},{key:"benchmark",label:"Benchmark"},{key:"source",label:"Source"}];
const AM_SPEND_F=[{key:"domain",label:"Module"},{key:"current_spend",label:"Current Spend"},{key:"spend_math",label:"Calculation"},{key:"market_benchmark",label:"Benchmark"},{key:"source",label:"Source"}];
const AM_AGG_F=[{key:"spend_type",label:"Spend Category"},{key:"estimate",label:"Estimate (USD)"},{key:"basis",label:"Calculation Basis"},{key:"source",label:"Source"}];
const AM_SPEND_DEAL_F=[{key:"vendor",label:"Vendor / Partner"},{key:"deal_type",label:"Deal Type"},{key:"deal_value",label:"Deal Value"},{key:"date",label:"Date"},{key:"spend_link",label:"Linked Spend"},{key:"rationale",label:"Spend Rationale"},{key:"source",label:"Source"}];
const AM_READY_F=[{key:"domain",label:"Module"},{key:"current_system",label:"Current System"},{key:"readiness_score",label:"Score"},{key:"displacement_opp",label:"Displacement"},{key:"addressable_tam",label:"TAM"},{key:"tam_rationale",label:"TAM Rationale"},{key:"source",label:"Source"}];
const AM_COMP_F=[{key:"competitor",label:"Competitor"},{key:"domain",label:"Domain"},{key:"their_advantage",label:"Advantage"},{key:"technology",label:"Technology"},{key:"implication",label:"Implication"},{key:"source",label:"Source"}];
const PRIORITY_COLORS={"Critical":{bg:"rgba(230,57,70,0.15)",color:"#E63946"},"High":{bg:"rgba(251,191,36,0.15)",color:"#fbbf24"},"Medium":{bg:"rgba(52,145,232,0.15)",color:"#3491E8"},"Low":{bg:"rgba(100,116,139,0.15)",color:"#64748b"}};
const DISP_COLORS={"High":{bg:"rgba(52,211,153,0.15)",color:"#34d399"},"Medium":{bg:"rgba(251,191,36,0.15)",color:"#fbbf24"},"Low":{bg:"rgba(100,116,139,0.15)",color:"#64748b"},"None":{bg:"rgba(30,58,80,0.5)",color:"#334155"}};
const SPEND_LINK_COLORS={"IT Spend":{bg:"rgba(52,145,232,0.12)",color:"#3491E8"},"AI Spend":{bg:"rgba(244,114,182,0.12)",color:"#f472b6"},"Cloud Spend":{bg:"rgba(129,140,248,0.12)",color:"#818cf8"},"Aftermarket Tech Spend":{bg:"rgba(52,211,153,0.12)",color:"#34d399"}};

function AftermarketDive() {
  const [co,setCo]=useState("");
  const [dom,setDom]=useState("");
  const [industry,setIndustry]=useState(""); // Target Vendor
  const [competitors,setCompetitors]=useState("");
  const [status,setStatus]=useState("idle");
  const [progress,setProgress]=useState("");
  const [showHist,setShowHist]=useState(false);const [history,setHistory]=useState([]);const [histEntry,setHistEntry]=useState(null);
  useEffect(()=>setHistory(loadAMHist()),[]);
  const [capRows,setCapRows]=useState([]);
  const [spendRows,setSpendRows]=useState([]);
  const [aggRows,setAggRows]=useState([]);
  const [spendDealRows,setSpendDealRows]=useState([]);
  const [readyRows,setReadyRows]=useState([]);
  const [compRows,setCompRows]=useState([]);

  const [subtab,setSubtab]=useState("spend_estimates");
  const abortRef=useRef(null);
  // Track displayed data in a ref so partial regen can merge even when localStorage is stale
  const displayedRef = useRef({cap:[],spend:[],agg:[],deals:[],ready:[],comp:[],vendor:[]});

  const run=useCallback(async()=>{
    if(!co.trim()||!dom.trim())return;
    if(abortRef.current)abortRef.current.abort();
    abortRef.current=new AbortController();
    setStatus("running");setProgress("Starting Aftermarket Deep Dive…");
    setCapRows([]);setSpendRows([]);setAggRows([]);setSpendDealRows([]);setReadyRows([]);setCompRows([]);setSubtab("spend_estimates");
    try{
      const res=await fetch(`${API_URL}/api/aftermarket-dive`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({company_name:co.trim(),domain:dom.trim(),target_vendor:industry.trim(),competitors:competitors.trim()}),signal:abortRef.current?.signal
      });
      if(!res.ok||!res.body)throw new Error(`Server ${res.status}`);
      const reader=res.body.getReader();const dec=new TextDecoder();let buf="";
      // Local accumulators — avoid stale closure on state variables
      let allCap=[],allSpend=[],allAgg=[],allDeals=[],allReady=[],allComp=[];
      while(true){
        const{done,value}=await reader.read();if(done)break;
        buf+=dec.decode(value,{stream:true});
        const lines=buf.split("\n");buf=lines.pop()??"";
        for(const line of lines){
          if(!line.startsWith("data: "))continue;
          try{
            const ev=JSON.parse(line.slice(6));
            if(!ev||typeof ev!=="object")continue;
            if(ev.type==="heartbeat"||ev.type==="progress")setProgress(ev.message??"");
            else if(ev.type==="capability_row"&&ev.row){allCap=[...allCap,ev.row];setCapRows([...allCap]);}
            else if(ev.type==="spend_module_row"&&ev.row){allSpend=[...allSpend,ev.row];setSpendRows([...allSpend]);}
            else if(ev.type==="aggregate_spend_row"&&ev.row){allAgg=[...allAgg,ev.row];setAggRows([...allAgg]);setSubtab("spend_estimates");}
            else if(ev.type==="spend_deal_row"&&ev.row){allDeals=[...allDeals,ev.row];setSpendDealRows([...allDeals]);}
            else if(ev.type==="readiness_row"&&ev.row){allReady=[...allReady,ev.row];setReadyRows([...allReady]);}
            else if(ev.type==="competitor_row"&&ev.row){allComp=[...allComp,ev.row];setCompRows([...allComp]);}
            else if(ev.type==="complete"){
              setStatus("done");
              const tot=allCap.length+allSpend.length+allReady.length;
              setProgress(`Done — ${tot} findings across 4 tables`);
              // Keep ref in sync with actual displayed data
              displayedRef.current={cap:allCap,spend:allSpend,agg:allAgg,deals:allDeals,ready:allReady,comp:allComp,vendor:[]};
              const entry={id:Date.now(),date:new Date().toISOString(),company:co.trim(),
                summary:`${allCap.length} capabilities · ${allAgg.length} spend categories`,
                capRows:allCap,spendRows:allSpend,aggRows:allAgg,
                spendDealRows:allDeals,readyRows:allReady,compRows:allComp};
              try{const h=[entry,...loadAMHist()].slice(0,MAX_HIST);saveAMHist(h);setHistory(h);}catch(_){}
            }
            else if(ev.type==="error"){setStatus("error");setProgress(ev.message??"Error");}
          }catch(streamErr){console.error("SSE parse error:",streamErr);}
        }
      }
    }catch(e){setStatus("error");setProgress(`Failed: ${e.message}`);}
  },[co,dom,industry,competitors]);

  // ── Determine which sections are missing ──────────────────────────────────
  // Compute missing sections from either live state or history entry
  const _checkRows = (histKey, liveRows) => histEntry
    ? (histEntry[histKey]?.length === 0)
    : (status === "done" && liveRows.length === 0);

  const missingSections = (status==="done" || histEntry) ? [
    ...(_checkRows("aggRows",         aggRows)          ? ["agg_spend"]        : []),
    ...(_checkRows("spendDealRows",   spendDealRows)    ? ["spend_deals"]      : []),
    ...(_checkRows("spendRows",       spendRows)        ? ["spend_module"]     : []),
    ...(_checkRows("readyRows",       readyRows)        ? ["readiness"]        : []),
    ...(_checkRows("capRows",         capRows)          ? ["capabilities"]     : []),

  ] : [];

  const runPartial = useCallback(async(sections, fromHistEntry=null)=>{
    if(!sections.length)return;
    // If triggered from history, use the history entry's company info
    const companyName = fromHistEntry?.company || co.trim();
    const companyDomain = fromHistEntry?.domain || dom.trim();
    if(!companyName)return;

    // If triggered from history, seed displayedRef from the CURRENTLY DISPLAYED disp* values
    // (disp* already contain the correct data even if localStorage had empty arrays)
    if(fromHistEntry){
      // Capture what's currently being displayed (from disp* computed values)
      // We read current state at call time via functional updates below
      setCapRows(prev => { displayedRef.current.cap = prev.length ? prev : (fromHistEntry.capRows||[]); return displayedRef.current.cap; });
      setSpendRows(prev => { displayedRef.current.spend = prev.length ? prev : (fromHistEntry.spendRows||[]); return displayedRef.current.spend; });
      setAggRows(prev => { displayedRef.current.agg = prev.length ? prev : (fromHistEntry.aggRows||[]); return displayedRef.current.agg; });
      setSpendDealRows(prev => { displayedRef.current.deals = prev.length ? prev : (fromHistEntry.spendDealRows||[]); return displayedRef.current.deals; });
      setReadyRows(prev => { displayedRef.current.ready = prev.length ? prev : (fromHistEntry.readyRows||[]); return displayedRef.current.ready; });
      setCompRows(prev => { displayedRef.current.comp = prev.length ? prev : (fromHistEntry.compRows||[]); return displayedRef.current.comp; });
      
      setHistEntry(null);
      setCo(fromHistEntry.company||co);
    }

    setStatus("running");
    setProgress(`🔄 Regenerating ${sections.length} missing section(s) for ${companyName}…`);
    try{
      const res=await fetch(`${API_URL}/api/aftermarket-dive`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({company_name:companyName,domain:companyDomain,target_vendor:industry.trim(),competitors:competitors.trim(),sections_to_run:sections})
      });
      if(!res.ok||!res.body)throw new Error(`Server ${res.status}`);
      const reader=res.body.getReader();const dec=new TextDecoder();let buf="";
      let newCap=[],newSpend=[],newAgg=[],newDeals=[],newReady=[],newComp=[];
      while(true){
        const{done,value}=await reader.read();if(done)break;
        buf+=dec.decode(value,{stream:true});const lines=buf.split("\n");buf=lines.pop()??"";
        for(const line of lines){
          if(!line.startsWith("data: "))continue;
          try{
            const ev=JSON.parse(line.slice(6));
            if(!ev||typeof ev!=="object")continue;
            if(ev.type==="heartbeat"||ev.type==="progress")setProgress(ev.message??"");
            else if(ev.type==="capability_row"&&ev.row){newCap=[...newCap,ev.row];setCapRows(r=>[...r,ev.row]);}
            else if(ev.type==="spend_module_row"&&ev.row){newSpend=[...newSpend,ev.row];setSpendRows(r=>[...r,ev.row]);}
            else if(ev.type==="aggregate_spend_row"&&ev.row){newAgg=[...newAgg,ev.row];setAggRows(r=>[...r,ev.row]);}
            else if(ev.type==="spend_deal_row"&&ev.row){newDeals=[...newDeals,ev.row];setSpendDealRows(r=>[...r,ev.row]);}
            else if(ev.type==="readiness_row"&&ev.row){newReady=[...newReady,ev.row];setReadyRows(r=>[...r,ev.row]);}
            else if(ev.type==="competitor_row"&&ev.row){newComp=[...newComp,ev.row];setCompRows(r=>[...r,ev.row]);}
            
            else if(ev.type==="complete"){
              // Merge: base from fromHistEntry (all original data) + new rows
              const baseCap   = fromHistEntry?.capRows    || [];
              const baseSpend = fromHistEntry?.spendRows  || [];
              const baseAgg   = fromHistEntry?.aggRows    || [];
              const baseDeals = fromHistEntry?.spendDealRows || [];
              const baseReady = fromHistEntry?.readyRows  || [];
              const baseComp  = fromHistEntry?.compRows   || [];

              // Use displayedRef as base — guaranteed to have actual displayed data
              // even if localStorage history was saved with stale closure bug (empty arrays)
              const ref = displayedRef.current;
              const mergedCap   = [...(ref.cap.length   ? ref.cap   : baseCap),   ...newCap];
              const mergedSpend = [...(ref.spend.length ? ref.spend : baseSpend), ...newSpend];
              const mergedAgg   = [...(ref.agg.length   ? ref.agg   : baseAgg),   ...newAgg];
              const mergedDeals = [...(ref.deals.length ? ref.deals : baseDeals), ...newDeals];
              const mergedComp  = [...(ref.comp.length  ? ref.comp  : baseComp),  ...newComp];

              // DEFENSIVE: if readiness was regenerated but returned 0 rows (backend timeout/503),
              // keep the previous rows rather than overwriting with empty array.
              // This prevents the table going blank after a failed regen attempt.
              const prevReady = ref.ready.length ? ref.ready : baseReady;
              const mergedReady = newReady.length > 0
                ? [...prevReady, ...newReady]   // new rows arrived — use them (replace, not append, since prevReady was empty before regen)
                : sections.includes("readiness") && newReady.length === 0
                  ? prevReady                   // regen was requested but returned nothing — keep old data
                  : [...prevReady, ...newReady];

              // Update ref with merged data
              displayedRef.current={cap:mergedCap,spend:mergedSpend,agg:mergedAgg,deals:mergedDeals,ready:mergedReady,comp:mergedComp,vendor:[]};
              // Explicitly set state to merged data so tables display
              setCapRows(mergedCap);
              setSpendRows(mergedSpend);
              setAggRows(mergedAgg);
              setSpendDealRows(mergedDeals);
              setReadyRows(mergedReady);
              setCompRows(mergedComp);
              const readyOk = newReady.length > 0 || !sections.includes("readiness");
              if(!readyOk){
                // Auto-retry readiness once — don't require manual intervention
                setProgress("🔄 Readiness returned empty — auto-retrying in 10s…");
                setStatus("running");
                await new Promise(r=>setTimeout(r,10000));
                // Re-run partial for readiness only (recursive call)
                runPartial(["readiness"], fromHistEntry);
                return;
              }
              setStatus("done");
              setProgress(`✅ Regeneration complete — ${sections.length} section(s) updated & saved to history`);

              // Save merged report only when at least the requested sections returned data.
              // If readiness was requested but returned 0 rows, don't overwrite history
              // (the previous history entry — with whatever data it had — is better than empty).
              const shouldSave = readyOk;
              if(shouldSave){
                try{
                  const h=loadAMHist();
                  const entry={
                    id:Date.now(),
                    date:new Date().toISOString(),
                    company:companyName,
                    domain:fromHistEntry?.domain||dom.trim(),
                    summary:`${mergedCap.length} cap · ${mergedAgg.length} spend · ${mergedReady.length} TAM (complete)`,
                    capRows:mergedCap,
                    spendRows:mergedSpend,
                    aggRows:mergedAgg,
                    spendDealRows:mergedDeals,
                    readyRows:mergedReady,
                    compRows:mergedComp,
                  };
                  const filtered=h.filter(e=>e.company!==companyName);
                  const newH=[entry,...filtered].slice(0,MAX_HIST);
                  saveAMHist(newH);
                  setHistory(newH);
                }catch(saveErr){console.error("History save error:",saveErr);}
              }
            }
            else if(ev.type==="error"){setStatus("error");setProgress(ev.message??"Error");}
          }catch(streamErr){console.error("SSE parse error:",streamErr);}
        }
      }
    }catch(e){setStatus("error");setProgress(`Failed: ${e.message}`);}
  },[co,dom,industry,competitors]);

  // When viewing history, use saved data; otherwise use live state
  const dispCapRows    = histEntry ? (histEntry.capRows      || []) : capRows;
  const dispSpendRows  = histEntry ? (histEntry.spendRows    || []) : spendRows;
  const dispAggRows    = histEntry ? (histEntry.aggRows      || []) : aggRows;
  const dispDealRows   = histEntry ? (histEntry.spendDealRows|| []) : spendDealRows;
  const dispReadyRows  = histEntry ? (histEntry.readyRows    || []) : readyRows;
  const dispCompRows   = histEntry ? (histEntry.compRows     || []) : compRows;

  // Group capabilities by domain
  const capByDomain=dispCapRows.reduce((a,r)=>{const d=r.domain||"Other";if(!a[d])a[d]=[];a[d].push(r);return a;},{});

  // XLSX export — all tables as separate sheets
  const exportXLSX = async (companyName) => {
    const XLSX = (await import("xlsx")).default;
    const wb = XLSX.utils.book_new();
    const addSheet = (name, fields, rows) => {
      if (!rows.length) return;
      const ws = XLSX.utils.json_to_sheet(rows.map(r => Object.fromEntries(fields.map(f=>[f.label, r[f.key]??"-"]))));
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0,31));
    };
    addSheet("Spend Summary", AM_AGG_F, aggRows);
    addSheet("IT Deals & Partnerships", AM_SPEND_DEAL_F, spendDealRows);
    addSheet("Spend by Module", AM_SPEND_F, spendRows);
    addSheet("Capabilities", AM_CAP_F, capRows);
    addSheet("Readiness & TAM", AM_READY_F, readyRows);
    if (compRows.length) addSheet("Competitive", AM_COMP_F, compRows);
    XLSX.writeFile(wb, `${companyName || "aftermarket"}-deep-dive.xlsx`);
  };

  // Word export — HTML document all tables
  const exportWord = (companyName) => {
    const tableHTML = (title, fields, rows) => {
      if (!rows.length) return "";
      const hdrs = fields.map(f=>`<th style="background:#1a3a50;color:#fff;padding:6px 10px;text-align:left;font-size:11px">${f.label}</th>`).join("");
      const rws = rows.map((r,i)=>`<tr style="background:${i%2===0?"#f8fafc":"#fff"}">${fields.map(f=>`<td style="padding:5px 10px;font-size:11px;border-bottom:1px solid #e2e8f0">${r[f.key]??"-"}</td>`).join("")}</tr>`).join("");
      return `<h2 style="color:#1e3a5f;margin-top:24px;font-size:14px">${title}</h2><table style="width:100%;border-collapse:collapse;margin-bottom:20px"><thead><tr>${hdrs}</tr></thead><tbody>${rws}</tbody></table>`;
    };
    const html = `<html><head><meta charset="utf-8"><title>${companyName} Aftermarket Deep Dive</title></head><body style="font-family:Arial,sans-serif;color:#111;padding:20px">
<h1 style="color:#1e3a5f;font-size:20px">${companyName} — Aftermarket Deep Dive Report</h1>
<p style="color:#64748b;font-size:12px">Generated: ${new Date().toLocaleDateString()}</p>
${tableHTML("Tech Spend Estimates", AM_AGG_F, aggRows)}
${tableHTML("IT Deals & Partnerships (Spend Rationale)", AM_SPEND_DEAL_F, spendDealRows)}
${tableHTML("Spend by Module", AM_SPEND_F, spendRows)}
${tableHTML("Capabilities", AM_CAP_F, capRows)}
${tableHTML("Readiness Matrix & TAM", AM_READY_F, readyRows)}
${compRows.length ? tableHTML("Competitive Analysis", AM_COMP_F, compRows) : ""}
</body></html>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], {type:"application/msword"}));
    a.download = `${companyName || "aftermarket"}-deep-dive.doc`;
    a.click();
  };

  const TABS=[
    ["spend_estimates","Tech Spend Estimates",dispAggRows.length+dispDealRows.length],
    ["capabilities","Capabilities",dispCapRows.length],
    ["spend","Spend by Module",dispSpendRows.length],
    ["readiness","Readiness + TAM",dispReadyRows.length],
    ...(dispCompRows.length?[["competitive","Competitive",dispCompRows.length]]:[]),
  ];

  return(
    <>
      {showHist&&<HistPanel history={history} accentColor="#34d399"
        onClose={()=>setShowHist(false)} onBack={()=>setHistEntry(null)}
        onSelect={e=>{setHistEntry(e);setShowHist(false);setSubtab("spend_estimates");}}
        onClear={()=>{saveAMHist([]);setHistory([]);}}
        onDeleteOne={(id,u)=>{saveAMHist(u);setHistory(u);if(histEntry?.id===id)setHistEntry(null);}}
        histEntry={histEntry}
        renderEntry={e=>(
          <div className={s.historyDetail}>
            <div className={s.historyDetailMeta}><span className={s.historyItemDate}><Clock size={10}/> {new Date(e.date).toLocaleString()}</span><span className={s.historyItemCount} style={{color:"#34d399"}}>{e.summary}</span></div>
            <div className={s.historyDetailActions}>
              {e.capRows?.length>0&&<button className={s.dlBtnCSV} onClick={()=>dlCSV(e.capRows,AM_CAP_F,"am-cap.csv")}><Download size={12}/> T1</button>}
              {e.gapRows?.length>0&&<button className={s.dlBtnJSON} onClick={()=>dlCSV(e.gapRows,AM_GAP_F,"am-gaps.csv")}><Download size={12}/> T2</button>}
              {e.spendRows?.length>0&&<button className={s.dlBtnCSV} style={{background:"rgba(251,191,36,0.12)",color:"#fbbf24"}} onClick={()=>dlCSV(e.spendRows,AM_SPEND_F,"am-spend.csv")}><Download size={12}/> T3</button>}
              {e.readyRows?.length>0&&<button className={s.dlBtnCSV} style={{background:"rgba(52,211,153,0.12)",color:"#34d399"}} onClick={()=>dlCSV(e.readyRows,AM_READY_F,"am-readiness.csv")}><Download size={12}/> T4</button>}
              <button className={s.historyDeleteOne} onClick={()=>{const u=history.filter(h=>h.id!==e.id);saveAMHist(u);setHistory(u);setHistEntry(null);}}><Trash2 size={12}/> Delete</button>
            </div>
          </div>
        )}
      />}
      <div className={s.card}>
        <div className={s.row}>
          <div className={s.cardTitle}>Aftermarket Deep Dive</div>
          <button className={s.historyBtn} style={{color:"#34d399",borderColor:"rgba(52,211,153,0.2)",background:"rgba(52,211,153,0.08)"}} onClick={()=>{setHistory(loadAMHist());setShowHist(true);setHistEntry(null);}}>
            <History size={13}/> History {history.length>0&&<span className={s.historyBadge} style={{background:"#059669"}}>{history.length}</span>}
          </button>
        </div>
        <div className={s.cardSub}>
          4-table analysis: Tech Spend Estimates (IT/AI/Cloud/Aftermarket + IT Deals rationale),
          Capabilities (tech × use case), Spend by Module (with math), Readiness Matrix + TAM.
        </div>
        <div className={s.queryRow}>
          <div className={s.fieldGroup}>
            <label className={s.fieldLabel}>Company Name <span className={s.required}>*</span></label>
            <input className={s.inp} placeholder="e.g. Daimler Truck North America" value={co} onChange={e=>setCo(e.target.value)}/>
          </div>
          <div className={s.fieldGroup}>
            <label className={s.fieldLabel}>Webpage URL <span className={s.required}>*</span></label>
            <input className={s.inp} placeholder="e.g. daimler-truck.com" value={dom} onChange={e=>setDom(e.target.value)}/>
          </div>
          <div className={s.fieldGroup}>
            <label className={s.fieldLabel}>Target Vendor <span className={s.optional}>Optional</span></label>
            <input className={s.inp} placeholder="e.g. Tavant, Syncron, ServiceMax" value={industry} onChange={e=>setIndustry(e.target.value)}/>
          </div>
          <button className={`${s.btnSynthesize} ${s.btnSynthesizeArch}`} onClick={run} disabled={status==="running"||!co.trim()||!dom.trim()}>
            {status==="running"?<><Loader2 size={15} className={s.spin}/> Running&#8230;</>:<><BarChart3 size={15}/> Synthesize Architecture</>}
          </button>
        </div>
      </div>

      {status!=="idle"&&(<div className={s.statusBarFull}>
        {status==="running"&&<Loader2 size={15} color="#34d399" className={s.spin}/>}
        {status==="done"&&<CheckCircle2 size={15} color="#34d399"/>}
        {status==="error"&&<span style={{color:"#E63946"}}>&#10005;</span>}
        <span className={s.statusText}>{progress}</span>
        {status==="done"&&<div className={s.dlBtn}>
          {aggRows.length>0&&<button className={s.dlBtnCSV} style={{background:"rgba(251,191,36,0.12)",color:"#fbbf24"}} onClick={()=>dlCSV(aggRows,AM_AGG_F,"am-spend-summary.csv")}><Download size={12}/> Spend</button>}
          {capRows.length>0&&<button className={s.dlBtnCSV} onClick={()=>dlCSV(capRows,AM_CAP_F,"am-capabilities.csv")}><Download size={12}/> Cap</button>}
          {readyRows.length>0&&<button className={s.dlBtnCSV} style={{background:"rgba(52,211,153,0.12)",color:"#34d399"}} onClick={()=>dlCSV(readyRows,AM_READY_F,"am-readiness.csv")}><Download size={12}/> TAM</button>}
          <button className={s.dlBtnCSV} style={{background:"rgba(129,140,248,0.12)",color:"#818cf8"}} onClick={()=>exportXLSX(co)}><Download size={12}/> XLSX</button>
          <button className={s.dlBtnCSV} style={{background:"rgba(52,145,232,0.12)",color:"#3491E8"}} onClick={()=>exportWord(co)}><Download size={12}/> Word</button>
        </div>}
        {status==="done"&&missingSections.length>0&&(
          <button onClick={()=>runPartial(missingSections)} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer",border:"1px solid rgba(251,191,36,0.4)",background:"rgba(251,191,36,0.08)",color:"#fbbf24",fontFamily:"inherit",flexShrink:0}}>
            🔄 Fill {missingSections.length} missing section{missingSections.length===1?"":"s"}
          </button>
        )}
      </div>)}

      {histEntry&&<div style={{padding:"10px 16px",background:"rgba(52,211,153,0.08)",border:"1px solid rgba(52,211,153,0.2)",borderRadius:8,fontSize:11,color:"#34d399",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <span>📋 Viewing history: <strong>{histEntry.company}</strong> · {new Date(histEntry.date).toLocaleString()}</span>
        {missingSections.length>0&&(
          <button onClick={()=>runPartial(missingSections,histEntry)} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",border:"1px solid rgba(251,191,36,0.5)",background:"rgba(251,191,36,0.1)",color:"#fbbf24",fontFamily:"inherit"}}>
            🔄 Fill {missingSections.length} missing section{missingSections.length===1?"":"s"}
          </button>
        )}
        <button onClick={()=>setHistEntry(null)} style={{fontSize:10,color:"#34d399",background:"none",border:"none",cursor:"pointer",textDecoration:"underline",padding:0,marginLeft:"auto"}}>Back to current</button>
      </div>}

      {(dispAggRows.length>0||dispCapRows.length>0||dispSpendRows.length>0||dispReadyRows.length>0)&&(
        <div className={s.tableWrap} style={{borderRadius:14}}>
          <div style={{display:"flex",gap:0,borderBottom:"1px solid #1a3a50",background:"#0c1f2e",overflowX:"auto"}}>
            {TABS.map(([id,lbl,cnt])=>(
              <button key={id} onClick={()=>setSubtab(id)} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"10px 14px",fontSize:11,fontWeight:600,color:subtab===id?"#34d399":"#475569",background:"none",border:"none",borderBottom:subtab===id?"2px solid #34d399":"2px solid transparent",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                {lbl} <span style={{background:"rgba(52,211,153,0.1)",color:"#34d399",fontSize:9,padding:"1px 4px",borderRadius:8}}>{cnt}</span>
              </button>
            ))}
          </div>

          {/* Table 1: Capabilities — grouped by domain, no Maturity column */}
          {subtab==="capabilities"&&Object.entries(capByDomain).map(([domain,drows])=>(
            <div key={domain} style={{borderBottom:"1px solid #0f2a3d"}}>
              <div style={{padding:"8px 14px",background:"#0a1c2a",fontSize:12,fontWeight:700,color:"#e2e8f0",borderBottom:"1px solid #0f2a3d"}}>
                {domain} <span style={{fontSize:10,color:"#3491E8",background:"rgba(52,145,232,0.1)",padding:"1px 7px",borderRadius:10,marginLeft:8}}>{drows.length}</span>
              </div>
              <div className={s.tableScroll}>
                <table className={s.table}>
                  <thead className={s.thead}><tr className={s.theadTr}>
                    <th className={s.th} style={{width:160}}>Capability</th>
                    <th className={s.th} style={{width:150}}>Technology</th>
                    <th className={s.th}>Use Case</th>
                    <th className={s.th} style={{width:130}}>Install Base</th>
                    <th className={s.th} style={{width:60}}>Source</th>
                  </tr></thead>
                  <tbody>
                    {drows.map((row,i)=>(
                      <tr key={i} className={`${s.tbodyTr} ${i%2===0?"":s.tbodyTrEven} ${s.rowNew}`}>
                        <td className={`${s.td} ${s.tdCo}`} style={{whiteSpace:"normal",wordBreak:"break-word",maxWidth:160}}>{row.capability||"—"}</td>
                        <td className={s.td} style={{whiteSpace:"normal",wordBreak:"break-word",maxWidth:150,fontWeight:600,color:"#818cf8"}}>{row.technology||"—"}</td>
                        <td className={s.td} style={{whiteSpace:"normal",lineHeight:1.5,fontSize:11,color:"#94a3b8"}}>{row.use_case||"—"}</td>
                        <td className={s.td} style={{fontSize:11,color:"#34d399"}}>{row.install_base||"—"}</td>
                        <td className={s.td}>{row.source&&row.source!=="-"?<a href={row.source} target="_blank" rel="noreferrer" className={s.sourceLink}>&#8599; link</a>:<span className={s.tdNone}>—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Tech Spend Estimates — 4 cards + IT Deals table */}
          {subtab==="spend_estimates"&&<div>
            {/* 4 spend summary cards */}
            {dispAggRows.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,padding:"16px 16px 0"}}>
              {dispAggRows.map((row,i)=>(
                <div key={i} style={{background:"#0a1c2a",border:"1px solid #1a3a50",borderRadius:10,padding:"14px 16px"}}>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:6}}>{row.spend_type||"Spend"}</div>
                  <div style={{fontSize:20,fontWeight:800,color:"#fbbf24",marginBottom:4}}>{row.estimate||"—"}</div>
                  <div style={{fontSize:10,color:"#475569",lineHeight:1.5}}>{row.basis||""}</div>
                  {row.source&&row.source!=="-"&&<a href={row.source} target="_blank" rel="noreferrer" style={{fontSize:10,color:"#3491E8",textDecoration:"none",display:"block",marginTop:6}}>↗ source</a>}
                </div>
              ))}
            </div>}

            {/* IT Deals & Partnerships rationale */}
            {dispDealRows.length>0&&<>
              <div style={{padding:"14px 16px 8px",fontSize:12,fontWeight:700,color:"#e2e8f0",borderTop:"1px solid #1a3a50",marginTop:16}}>IT Deals & Partnerships — Spend Rationale</div>
              <div className={s.tableScroll}><table className={s.table}>
                <thead className={s.thead}><tr className={s.theadTr}>
                  <th className={s.th} style={{width:150}}>Vendor / Partner</th>
                  <th className={s.th} style={{width:140}}>Deal Type</th>
                  <th className={s.th} style={{width:110}}>Value</th>
                  <th className={s.th} style={{width:80}}>Date</th>
                  <th className={s.th} style={{width:130}}>Linked Spend</th>
                  <th className={s.th}>Spend Rationale</th>
                  <th className={s.th} style={{width:60}}>Source</th>
                </tr></thead>
                <tbody>{dispDealRows.map((row,i)=>{const sl=SPEND_LINK_COLORS[row.spend_link]||{};return(
                  <tr key={i} className={`${s.tbodyTr} ${i%2===0?"":s.tbodyTrEven} ${s.rowNew}`}>
                    <td className={`${s.td} ${s.tdCo}`} style={{whiteSpace:"normal"}}>{row.vendor||"—"}</td>
                    <td className={s.td} style={{fontSize:11}}>{row.deal_type||"—"}</td>
                    <td className={s.td} style={{fontWeight:600,color:"#34d399",fontSize:11}}>{row.deal_value||"—"}</td>
                    <td className={s.td} style={{fontSize:11,color:"#94a3b8"}}>{row.date||"—"}</td>
                    <td className={s.td}>{row.spend_link?<span style={{display:"inline-block",padding:"2px 7px",borderRadius:20,fontSize:10,fontWeight:700,background:sl.bg,color:sl.color,whiteSpace:"nowrap"}}>{row.spend_link}</span>:<span className={s.tdNone}>—</span>}</td>
                    <td className={s.td} style={{whiteSpace:"normal",lineHeight:1.5,fontSize:11,color:"#94a3b8"}}>{row.rationale||"—"}</td>
                    <td className={s.td}>{row.source&&row.source!=="-"?<a href={row.source} target="_blank" rel="noreferrer" className={s.sourceLink}>&#8599;</a>:<span className={s.tdNone}>—</span>}</td>
                  </tr>);})}
                </tbody>
              </table></div>
            </>}
          </div>}

          {/* Spend by Module */}
          {subtab==="spend"&&dispSpendRows.length>0&&<div className={s.tableScroll}><table className={s.table}>
            <thead className={s.thead}><tr className={s.theadTr}>
              <th className={s.th} style={{width:160}}>Module</th>
              <th className={s.th} style={{width:140}}>Current Spend (Est.)</th>
              <th className={s.th}>Calculation / Rationale</th>
              <th className={s.th} style={{width:160}}>Market Benchmark</th>
            </tr></thead>
            <tbody>{dispSpendRows.map((row,i)=>(
              <tr key={i} className={`${s.tbodyTr} ${i%2===0?"":s.tbodyTrEven} ${s.rowNew}`}>
                <td className={`${s.td} ${s.tdCo}`} style={{whiteSpace:"normal"}}>{row.domain||"—"}</td>
                <td className={s.td} style={{fontWeight:700,color:"#fbbf24",fontSize:13,whiteSpace:"normal"}}>{row.current_spend||"—"}</td>
                <td className={s.td} style={{whiteSpace:"normal",lineHeight:1.6,fontSize:11,color:"#94a3b8"}}>{row.spend_math||"—"}</td>
                <td className={s.td} style={{fontSize:11,whiteSpace:"normal"}}>{row.market_benchmark||"—"}</td>
              </tr>
            ))}</tbody>
          </table></div>}

          {/* Table 4: Signal Intelligence Matrix + Vendor-Adjusted TAM */}
          {subtab==="readiness"&&dispReadyRows.length>0&&<div>
            {/* Signal category legend */}
            <div style={{display:"flex",gap:8,padding:"10px 16px",background:"#0a1c2a",borderBottom:"1px solid #1a3a50",flexWrap:"wrap"}}>
              {[["Existing Rel.","30%","#34d399"],["IT Signals","15%","#3491E8"],["Company Signals","20%","#fbbf24"],["Exec Signals","15%","#818cf8"],["Budget Signals","20%","#f472b6"]].map(([lbl,w,c])=>(
                <span key={lbl} style={{fontSize:10,fontWeight:600,color:c,background:`rgba(${c==='#34d399'?'52,211,153':c==='#3491E8'?'52,145,232':c==='#fbbf24'?'251,191,36':c==='#818cf8'?'129,140,248':'244,114,182'},0.12)`,padding:"2px 8px",borderRadius:20}}>
                  {lbl} <span style={{opacity:0.7}}>{w}</span>
                </span>
              ))}
            </div>
            {dispReadyRows.map((row,i)=>{
              const scores={er:parseInt(row.existing_rel_score)||0,it:parseInt(row.it_signals_score)||0,cs:parseInt(row.company_signals_score)||0,es:parseInt(row.exec_signals_score)||0,bs:parseInt(row.budget_signals_score)||0};
              const weighted=parseInt(row.weighted_readiness)||(Math.round(scores.er*0.30+scores.it*0.15+scores.cs*0.20+scores.es*0.15+scores.bs*0.20));
              const disp=DISP_COLORS[row.displacement_opp]||{};
              const ScoreBar=({val,color})=><div style={{display:"flex",alignItems:"center",gap:4,minWidth:90}}><div style={{flex:1,height:5,borderRadius:3,background:"#0f2a3d"}}><div style={{height:"100%",borderRadius:3,width:`${val}%`,background:color}}/></div><span style={{fontSize:10,fontWeight:700,minWidth:20,color}}>{val}</span></div>;
              // Supports both new [{text,source}] array AND legacy "s1|s2|s3" string
              const parseSigs=(v)=>{if(!v)return[];if(Array.isArray(v))return v.map(s=>typeof s==="object"?s:{text:String(s),source:"-"});return String(v).split("|").slice(0,3).map(t=>({text:t.trim(),source:"-"}));}
              return(
                <div key={i} style={{borderBottom:"1px solid #0f2a3d",padding:"14px 16px",background:i%2===0?"":"#0a1520"}} className={s.rowNew}>
                  {/* Domain header row */}
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10,flexWrap:"wrap"}}>
                    <span style={{fontSize:13,fontWeight:700,color:"#e2e8f0",flex:1}}>{row.domain||"—"}</span>
                    <span style={{fontSize:11,color:"#64748b"}}>{row.current_system||"—"}</span>
                    {row.displacement_opp&&<span style={{padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,background:disp.bg,color:disp.color}}>{row.displacement_opp}</span>}
                    {/* Big weighted score */}
                    <div style={{display:"flex",alignItems:"center",gap:6,background:"#0a1c2a",border:`1px solid ${weighted>=70?"rgba(52,211,153,0.3)":weighted>=40?"rgba(251,191,36,0.3)":"rgba(230,57,70,0.3)"}`,borderRadius:8,padding:"4px 12px"}}>
                      <span style={{fontSize:10,color:"#64748b"}}>Weighted Readiness</span>
                      <span style={{fontSize:18,fontWeight:800,color:weighted>=70?"#34d399":weighted>=40?"#fbbf24":"#E63946"}}>{weighted}</span>
                      <span style={{fontSize:10,color:"#334155"}}>/100</span>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:10,color:"#64748b"}}>Vendor-Adj. TAM</div>
                      <div style={{fontSize:14,fontWeight:700,color:"#34d399"}}>{row.vendor_adjusted_tam||row.addressable_tam||"—"}</div>
                    </div>
                  </div>
                  {/* 5-category signal grid */}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
                    {[
                      ["Existing Rel.","#34d399",scores.er,parseSigs(row.existing_rel_signals||row.existing_rel_top),"30%"],
                      ["IT Signals","#3491E8",scores.it,parseSigs(row.it_signals_signals||row.it_signals_top),"15%"],
                      ["Company Signals","#fbbf24",scores.cs,parseSigs(row.company_signals_signals||row.company_signals_top),"20%"],
                      ["Exec Signals","#818cf8",scores.es,parseSigs(row.exec_signals_signals||row.exec_signals_top),"15%"],
                      ["Budget Signals","#f472b6",scores.bs,parseSigs(row.budget_signals_signals||row.budget_signals_top),"20%"],
                    ].map(([cat,color,score,sigs,weight])=>(
                      <div key={cat} style={{background:"#0a1c2a",border:`1px solid rgba(${color==='#34d399'?'52,211,153':color==='#3491E8'?'52,145,232':color==='#fbbf24'?'251,191,36':color==='#818cf8'?'129,140,248':'244,114,182'},0.15)`,borderRadius:8,padding:"8px 10px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                          <span style={{fontSize:9,fontWeight:700,color,textTransform:"uppercase",letterSpacing:"0.05em"}}>{cat}</span>
                          <span style={{fontSize:9,color:"#334155"}}>{weight}</span>
                        </div>
                        <ScoreBar val={score} color={color}/>
                        <div style={{marginTop:6,display:"flex",flexDirection:"column",gap:3}}>
                          {sigs.map((sig,j)=>(
                            <div key={j} style={{fontSize:9,lineHeight:1.4,display:"flex",alignItems:"flex-start",gap:3}}>
                              <span style={{color:"#334155",flexShrink:0}}>•</span>
                              <span style={{color:"#64748b",flex:1}}>{sig.text}</span>
                              {sig.source&&sig.source!=="-"&&<a href={sig.source} target="_blank" rel="noreferrer" style={{color,fontSize:9,flexShrink:0,textDecoration:"none",opacity:0.8}} title="Open source">↗</a>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* TAM rationale */}
                  {row.tam_rationale&&<div style={{marginTop:8,fontSize:10,color:"#475569",fontStyle:"italic"}}>{row.tam_rationale}</div>}
                </div>
              );
            })}
          </div>}



          {/* Vendor Footprint */}
          {subtab==="competitive"&&dispCompRows.length>0&&<div className={s.tableScroll}><table className={s.table}>
            <thead className={s.thead}><tr className={s.theadTr}>{AM_COMP_F.map(f=><th key={f.key} className={s.th}>{f.label}</th>)}</tr></thead>
            <tbody>{dispCompRows.map((row,i)=>(
              <tr key={i} className={`${s.tbodyTr} ${i%2===0?"":s.tbodyTrEven} ${s.rowNew}`}>
                <td className={`${s.td} ${s.tdCo}`}>{row.competitor||"—"}</td>
                <td className={s.td}>{row.domain||"—"}</td>
                <td className={`${s.td} ${s.tdVal}`} style={{maxWidth:180,whiteSpace:"normal"}}>{row.their_advantage||"—"}</td>
                <td className={s.td} style={{fontWeight:600,color:"#818cf8"}}>{row.technology||"—"}</td>
                <td className={`${s.td} ${s.tdVal}`} style={{fontSize:11,color:"#94a3b8",whiteSpace:"normal"}}>{row.implication||"—"}</td>
                <td className={s.td}>{row.source&&row.source!=="-"?<a href={row.source} target="_blank" rel="noreferrer" className={s.sourceLink}>&#8599;</a>:<span className={s.tdNone}>—</span>}</td>
              </tr>
            ))}</tbody>
          </table></div>}
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
  const current = TABS.find(t=>t.id===tab) ?? TABS[0];

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
        {tab==="aftermarket"&& <ErrorBoundary><AftermarketDive/></ErrorBoundary>}
      </main>
    </div>
  );
}
