fetch("/api/health").then(r=>r.json()).then(d=>{
 const el=document.querySelector("#status");
 el.textContent=d.ok?"Server online · Database connected":"Server responded, but database is unavailable.";
 el.style.background=d.ok?"#e8f5ef":"#fde9eb";
 el.style.color=d.ok?"#237b5d":"#bd4652";
}).catch(()=>{document.querySelector("#status").textContent="Server connection unavailable. Start the Express application.";});
