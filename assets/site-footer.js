(async function(){
  if(document.getElementById('contact-footer')) return;
  document.querySelectorAll('footer,.footer,.foot').forEach(node=>node.remove());
  try{
    const response=await fetch('/assets/site-footer.html',{cache:'no-store'});
    if(!response.ok) throw new Error('Could not load shared footer');
    document.body.insertAdjacentHTML('beforeend',await response.text());
    const store=window.dipvtcStore||localStorage;
    const get=key=>{try{return store.getItem(key)}catch{return null}};
    const set=(id,key)=>{const value=get(key);const node=document.getElementById(id);if(value&&node)node.textContent=value};
    set('admissionTitle','dipvtc_admission_sec_title');
    set('admissionText','dipvtc_admission_sec_text');
    set('newsTitle','dipvtc_news_title');
    set('newsText','dipvtc_news_text');
    set('footerText','dipvtc_site_footer');
    set('contactEmail','dipvtc_site_email');
    set('contactPhones','dipvtc_site_phones');
    set('contactAddress','dipvtc_site_address');
    const enquiries=document.getElementById('enqCountFooter');if(enquiries)enquiries.textContent='Admission enquiries welcome';
    const host=document.getElementById('newsListPublic');
    let news=[];try{const parsed=JSON.parse(get('dipvtc_news')||'[]');if(Array.isArray(parsed))news=parsed.filter(item=>item&&typeof item==='object')}catch{}
    if(host&&news.length){host.replaceChildren();news.slice().reverse().slice(0,2).forEach(item=>{const card=document.createElement('div');card.style.cssText='border:1px solid #eee;padding:10px;border-radius:8px;margin:6px 0';const title=document.createElement('b');title.textContent=String(item.title||'');const date=document.createElement('small');date.textContent=String(item.date||'');const body=document.createElement('p');body.style.fontSize='12px';body.textContent=String(item.body||'');card.append(title,document.createElement('br'),date,body);host.append(card)})}
  }catch(error){console.error('Shared footer did not load:',error)}
})();
