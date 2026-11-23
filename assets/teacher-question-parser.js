(()=>{'use strict';
const roman='(?:viii|vii|vi|v|iv|iii|ii|i|ix|x)';
const plural=(n,word)=>`${n} ${word}${n===1?'':'s'}`;
function cleanPrompt(value){
  let text=String(value||'').trim(),points=null;
  const markPatterns=[/\s*\[\s*(\d+(?:\.\d+)?)\s*marks?\s*\]\s*$/i,/\s*\(\s*(\d+(?:\.\d+)?)\s*marks?\s*\)\s*$/i,/\s*marks?\s*:\s*(\d+(?:\.\d+)?)\s*$/i];
  for(const pattern of markPatterns){const match=text.match(pattern);if(match){points=Number(match[1]);text=text.replace(pattern,'').trim();break}}
  return{text,points};
}
function parse(raw,style='auto',format='structured'){
  const source=String(raw||'').trim();
  if(!source)return{items:[],message:'Paste your questions first.'};
  const lines=source.split(/\r?\n/).map(line=>line.trim()).filter(Boolean),items=[];
  let question='',questionLabel='',letter='',letterStem='',pendingLetter=false,current=null;
  const flush=()=>{if(current&&current.text.trim())items.push(current);current=null};
  const labelFor=(q,alpha='',romanPart='')=>{
    const root=q||question||'1',prefix=(questionLabel.startsWith('Q')||questionLabel.startsWith('Question'))?'Q':'';
    return prefix+root+(alpha?`(${alpha})`:'')+(romanPart?`(${romanPart})`:'');
  };
  const addCurrent=(label,body,kind,context='')=>{
    const clean=cleanPrompt(body),text=[label,context,clean.text].filter(Boolean).join(' · ');
    current={type:format==='multiple_choice'?'multiple_choice':'long_answer',text,points:clean.points||1,options:[],answerKey:'',structure:kind};
  };
  const closeMain=(q,label,body)=>{
    flush();question=q;questionLabel=label;letter='';letterStem='';
    if(body){const clean=cleanPrompt(body);letterStem=clean.text;current={type:format==='multiple_choice'?'multiple_choice':'long_answer',text:[label,clean.text].filter(Boolean).join(' · '),points:clean.points||1,options:[],answerKey:'',structure:'numbered'}}
  };
  const explicitPart=new RegExp(`^\\s*(?:Q(?:uestion)?\\s*)?(\\d+)\\s*(?:\\(\\s*([a-z])\\s*\\)|([a-z]))(?:\\s*\\(\\s*(${roman})\\s*\\)|\\s+(${roman})[).:]?)?\\s*(.*)$`,'i');
  const implicitNested=new RegExp(`^\\s*\\(\\s*([a-z])\\s*\\)\\s*\\(\\s*(${roman})\\s*\\)\\s*(.*)$`,'i');
  const implicitRoman=new RegExp(`^\\s*\\(\\s*(${roman})\\s*\\)\\s*(.*)$`,'i');
  const implicitLetter=/^\s*\(\s*([a-z])\s*\)\s*(.*)$/i;
  const punctLetter=/^\s*([a-z])[).:]\s*(.*)$/i;
  const mainLabel=/^\s*((?:Q(?:uestion)?\s*)?\d+)(?:\s*[.):]\s*|\s*$)(.*)$/i;
  for(const line of lines){
    if(current&&/^[A-H][).]\s+/.test(line)){current.options.push(line.replace(/^[A-H][).]\s*/,'').trim());continue}
    const explicit=line.match(explicitPart);
    if(explicit){
      const q=explicit[1],alpha=(explicit[2]||explicit[3]||'').toLowerCase(),romanPart=(explicit[4]||explicit[5]||'').toLowerCase(),body=(explicit[6]||'').replace(/^[).:]\s*/,''),
        clean=cleanPrompt(body);
      if(q!==question){question=q;questionLabel=line.match(/^\s*Q/i)?`Q${q}`:q;letter='';letterStem='';pendingLetter=false;flush()}
      if(alpha!==letter){flush();letter=alpha;letterStem=''}else flush();
      const label=labelFor(q,alpha,romanPart),context=romanPart?letterStem:'';
      if(alpha&&!romanPart&&!clean.text){pendingLetter=true;continue}
      addCurrent(label,clean.text,romanPart?'roman':alpha?'lettered':'numbered',context);
      if(alpha&&!romanPart)letterStem=clean.text;pendingLetter=false;continue;
    }
    const sameLineNested=line.match(implicitNested);
    if(sameLineNested){flush();letter=sameLineNested[1].toLowerCase();const label=labelFor('',letter,sameLineNested[2].toLowerCase());addCurrent(label,sameLineNested[3],'roman',letterStem);pendingLetter=false;continue}
    const romanOnly=line.match(implicitRoman);
    if(romanOnly&&letter){flush();addCurrent(labelFor('',letter,romanOnly[1].toLowerCase()),romanOnly[2],'roman',letterStem);pendingLetter=false;continue}
    const punctRoman=line.match(new RegExp(`^\\s*(${roman})[).:]\\s+(.*)$`,'i'));
    if(punctRoman&&(letter||style==='nested'||style==='zimsec_p2')){if(!letter)letter='a';flush();addCurrent(labelFor('',letter,punctRoman[1].toLowerCase()),punctRoman[2],'roman',letterStem);pendingLetter=false;continue}
    const main=line.match(mainLabel);
    if(main){const token=main[1].trim(),q=token.match(/\d+/)?.[0]||'1',label=/^Q/i.test(token)?`Q${q}`:q;pendingLetter=false;closeMain(q,label,main[2]||'');continue}
    const part=line.match(implicitLetter)||line.match(punctLetter);
    if(part){flush();letter=part[1].toLowerCase();letterStem='';const body=part[2]||'',label=labelFor('',letter);if(body){const clean=cleanPrompt(body);letterStem=clean.text;current={type:format==='multiple_choice'?'multiple_choice':'long_answer',text:[label,clean.text].filter(Boolean).join(' · '),points:clean.points||1,options:[],answerKey:'',structure:'lettered'};pendingLetter=false}else pendingLetter=true;continue}
    if(/^marks?\s*:/i.test(line)&&current){current.points=Number(line.split(':').slice(1).join(':').trim())||current.points;continue}
    if(/^answer\s*:/i.test(line)&&current){current.answerKey=line.replace(/^answer\s*:/i,'').trim();continue}
    if(current){const clean=cleanPrompt(line);current.text+='\n'+clean.text;if(clean.points)current.points=clean.points;continue}
    if(question&&pendingLetter){const label=labelFor('',letter);const clean=cleanPrompt(line);letterStem=clean.text;current={type:format==='multiple_choice'?'multiple_choice':'long_answer',text:[label,clean.text].filter(Boolean).join(' · '),points:clean.points||1,options:[],answerKey:'',structure:'lettered'};pendingLetter=false;continue}
    if(letter){letterStem=letterStem?letterStem+'\n'+line:line;continue}
    if(question){const label=labelFor('');addCurrent(label,line,'numbered');continue}
  }
  flush();
  if(!items.length){
    const blocks=source.split(/\n\s*\n+/).map(block=>block.trim()).filter(Boolean);
    const questions=blocks.length?blocks:[source];
    for(const [index,block] of questions.entries()){const clean=cleanPrompt(block);items.push({type:format==='multiple_choice'?'multiple_choice':'long_answer',text:clean.text,points:clean.points||1,options:[],answerKey:'',structure:'numbered',fallbackNumber:index+1})}
  }
  const counts={numbered:0,lettered:0,roman:0};for(const item of items)counts[item.structure]=(counts[item.structure]||0)+1;
  const parts=[];if(counts.numbered)parts.push(plural(counts.numbered,'numbered question'));if(counts.lettered)parts.push(plural(counts.lettered,'lettered part'));if(counts.roman)parts.push(plural(counts.roman,'Roman subpart'));
  const prefix=style==='auto'?'Auto-detected and preserved the pasted structure. ':'Used the selected format while preserving labels found in the text. ';
  return{items,message:prefix+items.length+' editable response item'+(items.length===1?'':'s')+(parts.length?' · '+parts.join(', '):'')+'. Check each item and its marks before publishing.'};
}
window.DIPVTCTeacherQuestionParser={parse};
})();
