/* Shared DIPvtC rules: arbitrary paper counts; backward-compatible with v0.1 records. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.DIPvtCCalculations=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const PRIMARY_BANDS=[
{min:85,units:1,status:"Pass"},{min:77,units:2,status:"Pass"},{min:70,units:3,status:"Pass"},{min:60,units:4,status:"Pass"},{min:50,units:5,status:"Pass"},{min:40,units:6,status:"Pass with Credit"},{min:30,units:7,status:"Pass"},{min:20,units:8,status:"Fail"},{min:0,units:9,status:"Fail"}];
const SECONDARY_BANDS=[
{min:90,grade:"A+",comment:"Outstanding",pass:true},{min:75,grade:"A",comment:"Excellent",pass:true},{min:70,grade:"B+",comment:"Very Good",pass:true},{min:65,grade:"B",comment:"Good",pass:true},{min:55,grade:"C+",comment:"Above Average",pass:true},{min:50,grade:"C",comment:"Average",pass:true},{min:45,grade:"D+",comment:"Satisfactory",pass:true},{min:40,grade:"D",comment:"Below Average",pass:true},{min:30,grade:"E",comment:"Pass",pass:true},{min:0,grade:"U",comment:"Fail",pass:false}];
function num(v,label){const n=Number(v);if(!Number.isFinite(n)||n<0)throw Error(label+" must be a non-negative number.");return n;}
function normalizePapers(subject,record={}){
 if(Array.isArray(subject.papers)&&subject.papers.length)return subject.papers.map((p,i)=>{const marked=record.papers?.[p.id]??record.papers?.[i]??p.obtained;return{id:p.id||"paper-"+(i+1),name:p.name||"Paper "+(i+1),maximum:num(p.maximum??p.max??0,"Paper maximum"),obtained:marked??0,complete:marked!==undefined&&marked!==null&&marked!==""}});
 const marked1=record.p1,legacy=[{id:"p1",name:"Paper 1",maximum:num(subject.p1Max??0,"Paper 1 maximum"),obtained:marked1??0,complete:marked1!==undefined&&marked1!==null&&marked1!==""}];
 if(Number(subject.p2Max??0)>0){const marked2=record.p2;legacy.push({id:"p2",name:"Paper 2",maximum:num(subject.p2Max,"Paper 2 maximum"),obtained:marked2??0,complete:marked2!==undefined&&marked2!==null&&marked2!==""});}
 return legacy;
}
function calculateSubject(subject,level,record={}){
 const papers=normalizePapers(subject,record);
 let obtained=0,maximum=0;
 for(const p of papers){const got=num(p.obtained??0,p.name+" mark");if(got>p.maximum)throw Error(p.name+": obtained mark cannot exceed maximum.");obtained+=got;maximum+=p.maximum;}
 const complete=papers.every(p=>p.complete!==false);
 if(maximum<=0)return{papers,obtained,maximum,percentage:null,units:null,status:"Incomplete",grade:"",comment:"",complete:false};
 const percentage=obtained/maximum*100;
 if(level==="primary"){const b=PRIMARY_BANDS.find(x=>percentage>=x.min);return{papers,obtained,maximum,percentage:complete?percentage:null,units:complete?b.units:null,status:complete?b.status:"Incomplete",grade:complete?String(b.units):"",comment:complete?b.status:"Mark entry incomplete",complete};}
 const b=SECONDARY_BANDS.find(x=>percentage>=x.min);return{papers,obtained,maximum,percentage:complete?percentage:null,units:null,status:complete?(b.pass?"Pass":"Fail"):"Incomplete",grade:complete?b.grade:"",comment:complete?b.comment:"Mark entry incomplete",complete};
}
function calculateStudent(student,subjects,level){
 const results=subjects.map(subject=>{const raw=student.marks?.[subject.id]||{};return{subject,...calculateSubject(subject,level,raw)};}).filter(r=>r.maximum>0);
 const completed=results.filter(r=>r.complete),obtained=completed.reduce((a,r)=>a+r.obtained,0),maximum=completed.reduce((a,r)=>a+r.maximum,0),percentage=maximum?obtained/maximum*100:null;
 return{...student,results,obtained,maximum,percentage,completedSubjectCount:completed.length,totalSubjectCount:results.length,marksComplete:results.length>0&&completed.length===results.length,totalUnits:level==="primary"?completed.reduce((a,r)=>a+(r.units||0),0):null,passedSubjects:level==="secondary"?completed.filter(r=>r.status==="Pass").length:null};
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
  if(a.marksComplete===false&&b.marksComplete!==false)return 1;
  if(a.marksComplete!==false&&b.marksComplete===false)return -1;
  if(a.marksComplete===false&&b.marksComplete===false)return 0;
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
  if(s.marksComplete===false)return{...s,position:null};
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
