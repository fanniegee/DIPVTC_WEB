/* Shared DIPvtC rules: arbitrary paper counts; backward-compatible with v0.1 records. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.DIPvtCCalculations=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const PRIMARY_BANDS=[
{min:85,units:1,status:"Pass"},{min:77,units:2,status:"Pass"},{min:70,units:3,status:"Pass"},{min:60,units:4,status:"Pass"},{min:50,units:5,status:"Pass"},{min:40,units:6,status:"Pass with Credit"},{min:30,units:7,status:"Pass"},{min:20,units:8,status:"Fail"},{min:0,units:9,status:"Fail"}];
const SECONDARY_BANDS=[
{min:90,grade:"A+",comment:"Outstanding",pass:true},{min:75,grade:"A",comment:"Excellent",pass:true},{min:70,grade:"B+",comment:"Very Good",pass:true},{min:65,grade:"B",comment:"Good",pass:true},{min:55,grade:"C+",comment:"Above Average",pass:true},{min:50,grade:"C",comment:"Average",pass:true},{min:45,grade:"D+",comment:"Satisfactory",pass:true},{min:40,grade:"D",comment:"Below Average",pass:true},{min:30,grade:"E",comment:"Pass",pass:true},{min:0,grade:"U",comment:"Fail",pass:false}];
function num(v,label){const n=Number(v);if(!Number.isFinite(n)||n<0)throw Error(label+" must be a non-negative number.");return n;}
function normalizePapers(subject,record={}){
 if(Array.isArray(subject.papers)&&subject.papers.length)return subject.papers.map((p,i)=>({id:p.id||"paper-"+(i+1),name:p.name||"Paper "+(i+1),maximum:num(p.maximum??p.max??0,"Paper maximum"),obtained:record.papers?.[p.id]??record.papers?.[i]??p.obtained??0}));
 const legacy=[{id:"p1",name:"Paper 1",maximum:num(subject.p1Max??0,"Paper 1 maximum"),obtained:record.p1??0}];
 if(Number(subject.p2Max??0)>0)legacy.push({id:"p2",name:"Paper 2",maximum:num(subject.p2Max,"Paper 2 maximum"),obtained:record.p2??0});
 return legacy;
}
function calculateSubject(subject,level,record={}){
 const papers=normalizePapers(subject,record);
 let obtained=0,maximum=0;
 for(const p of papers){const got=num(p.obtained??0,p.name+" mark");if(got>p.maximum)throw Error(p.name+": obtained mark cannot exceed maximum.");obtained+=got;maximum+=p.maximum;}
 if(maximum<=0)return{papers,obtained,maximum,percentage:null,units:null,status:"Incomplete",grade:"",comment:""};
 const percentage=obtained/maximum*100;
 if(level==="primary"){const b=PRIMARY_BANDS.find(x=>percentage>=x.min);return{papers,obtained,maximum,percentage,units:b.units,status:b.status,grade:String(b.units),comment:b.status};}
 const b=SECONDARY_BANDS.find(x=>percentage>=x.min);return{papers,obtained,maximum,percentage,units:null,status:b.pass?"Pass":"Fail",grade:b.grade,comment:b.comment};
}
function calculateStudent(student,subjects,level){
 const results=subjects.map(subject=>{const raw=student.marks?.[subject.id]||{};return{subject,...calculateSubject(subject,level,raw)};}).filter(r=>r.maximum>0);
 const obtained=results.reduce((a,r)=>a+r.obtained,0),maximum=results.reduce((a,r)=>a+r.maximum,0),percentage=maximum?obtained/maximum*100:null;
 return{...student,results,obtained,maximum,percentage,totalUnits:level==="primary"?results.reduce((a,r)=>a+(r.units||0),0):null,passedSubjects:level==="secondary"?results.filter(r=>r.status==="Pass").length:null};
}
const SECONDARY_RANK_BANDS=[
 {label:"50% and above",min:50,max:100},
 {label:"45–49%",min:45,max:49.999999},
 {label:"40–44%",min:40,max:44.999999},
 {label:"30–39%",min:30,max:39.999999},
 {label:"25–29%",min:25,max:29.999999},
 {label:"20–24%",min:20,max:24.999999},
 {label:"0–19%",min:0,max:19.999999}
];
function secondaryRankProfile(student){
 const counts=SECONDARY_RANK_BANDS.map(b=>student.results.filter(r=>r.percentage!==null&&r.percentage>=b.min&&r.percentage<=b.max).length);
 const qualifyingIndex=counts.findIndex(n=>n>=3);
 return {counts,qualifyingIndex,qualifyingBand:qualifyingIndex<0?null:SECONDARY_RANK_BANDS[qualifyingIndex].label,qualifyingCount:qualifyingIndex<0?0:counts[qualifyingIndex]};
}
function rankStudents(students,level){
 const prepared=students.map(s=>({...s,...(level==="secondary"?{rankingProfile:secondaryRankProfile(s)}:{})}));
 const sorted=prepared.sort((a,b)=>{
  if(level==="primary")return ((a.totalUnits??Infinity)-(b.totalUnits??Infinity))||((b.obtained??-1)-(a.obtained??-1));
  const ap=a.rankingProfile,bp=b.rankingProfile,aq=ap.qualifyingIndex,bq=bp.qualifyingIndex;
  if(aq!==-1&&bq===-1)return -1;
  if(aq===-1&&bq!==-1)return 1;
  if(aq!==-1&&bq!==-1&&aq!==bq)return aq-bq;
  if(aq!==-1&&bq!==-1&&ap.qualifyingCount!==bp.qualifyingCount)return bp.qualifyingCount-ap.qualifyingCount;
  return (b.obtained??-1)-(a.obtained??-1);
 });
 let previous=null,position=0;
 return sorted.map((s,i)=>{
  const key=level==="primary"
   ? `${s.totalUnits??"na"}|${s.obtained??"na"}`
   : `${s.rankingProfile.qualifyingIndex}|${s.rankingProfile.qualifyingCount}|${s.obtained??"na"}`;
  if(key!==previous)position=i+1;
  previous=key;
  return {...s,position};
 });
}
function subjectAwards(students,subjects){return subjects.map(subject=>{const c=students.map(student=>({student,result:student.results.find(r=>r.subject.id===subject.id)})).filter(x=>x.result&&x.result.percentage!==null);if(!c.length)return{subject,winners:[],percentage:null};const best=Math.max(...c.map(x=>x.result.percentage));return{subject,winners:c.filter(x=>Math.abs(x.result.percentage-best)<1e-7),percentage:best};});}
return{PRIMARY_BANDS,SECONDARY_BANDS,SECONDARY_RANK_BANDS,normalizePapers,calculateSubject,calculateStudent,secondaryRankProfile,rankStudents,subjectAwards};
});
