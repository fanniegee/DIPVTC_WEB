const test = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../shared/calculations.js');

test('weighted multi-paper calculation uses total obtained / total possible', () => {
  const subject = {id:'math', papers:[80,100,50,50].map((maximum,i)=>({id:'p'+i,name:'Paper '+i,maximum}))};
  const result = calc.calculateSubject(subject,'primary',{papers:{p0:40,p1:50,p2:25,p3:25}});
  assert.equal(result.obtained,140);
  assert.equal(result.maximum,280);
  assert.equal(result.percentage,50);
  assert.equal(result.units,5);
});

test('Primary grade bands and ranking tie-break remain stable', () => {
  const band = pct => calc.calculateSubject({papers:[{id:'p',maximum:100}]},'primary',{papers:{p:pct}});
  assert.equal(band(30).status,'Pass');
  assert.equal(band(20).status,'Fail');
  const ranked = calc.rankStudents([
    {id:'a',totalUnits:5,obtained:80,maximum:100,percentage:80},
    {id:'b',totalUnits:5,obtained:90,maximum:100,percentage:90},
    {id:'c',totalUnits:4,obtained:60,maximum:100,percentage:60}
  ],'primary');
  assert.deepEqual(ranked.map(s=>s.id),['c','b','a']);
});

test('Secondary E remains a pass and ranking qualification requires three subjects in a band', () => {
  const sub = {id:'s',papers:[{id:'p',maximum:100}]};
  const subjects = [0,1,2].map(i=>({...sub,id:'s'+i}));
  const student = {id:'learner',name:'Learner',marks:{s0:{papers:{p:30}},s1:{papers:{p:35}},s2:{papers:{p:39}}}};
  const result = calc.calculateStudent(student,subjects,'secondary');
  assert.equal(result.results[0].grade,'E');
  assert.equal(result.results[0].status,'Pass');
  assert.equal(calc.secondaryRankProfile(result).qualifyingBand,'30–39%');
  const incomplete = calc.calculateStudent({id:'other',marks:{s0:{papers:{p:100}},s1:{papers:{p:100}}}},subjects,'secondary');
  assert.equal(calc.secondaryRankProfile(incomplete).qualifyingBand,null);
});

test('invalid marks above paper maximum are rejected', () => {
  assert.throws(()=>calc.calculateSubject({papers:[{id:'p',maximum:20}]},'secondary',{papers:{p:21}}),/cannot exceed maximum/);
});

test('unentered papers remain incomplete and cannot earn an official position', () => {
  const subject={id:'english',name:'English',papers:[{id:'p1',maximum:100}]};
  const complete=calc.calculateStudent({id:'complete',marks:{english:{papers:{p1:75}}}},[subject],'primary');
  const pending=calc.calculateStudent({id:'pending',marks:{}},[subject],'primary');
  assert.equal(pending.results[0].percentage,null);
  assert.equal(pending.marksComplete,false);
  assert.equal(pending.maximum,0);
  const ranked=calc.rankStudents([pending,complete],'primary');
  assert.equal(ranked[0].id,'complete');
  assert.equal(ranked[0].position,1);
  assert.equal(ranked[1].position,null);
});

test('subject awards preserve ties', () => {
  const subject={id:'x',name:'English'};
  const students=['a','b'].map(id=>({id,results:[{subject,percentage:90}]}));
  assert.equal(calc.subjectAwards(students,[subject])[0].winners.length,2);
});
