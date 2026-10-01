/* =====================================================================
   THE COACH'S PLAYBOOK · APP
   ---------------------------------------------------------------------
   Renders window.PLAYBOOK (built by data.js + the live-feed merge in
   index.html) into the flipbook. Call window.__initPlaybook() once
   window.PLAYBOOK is fully assembled — index.html does this after it
   has merged in the live Google Sheet feed (or given up trying).
   ===================================================================== */
window.__initPlaybook = function(){
  const D = window.PLAYBOOK;
  const CATS = ["Cardio","Strength","HIIT","Hybrid"];
  const AV_COLORS = ["#00A3E0","#FF5800","#F8C537","#7FD1AE","#C9B6F2","#FF9F7A","#8FD3F4","#FFD08A"];
  const ROSTER_PER_PAGE = 16;
  const ICON = {
    share:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
    arrow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
  };
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const coachById = Object.fromEntries(D.coaches.map((c,i)=>[c.id,{...c,_i:i}]));
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const fmtDate = d => { const [y,m,dd] = d.split("-").map(Number); return dd+" "+MONTHS[m-1]+" "+y; };
  const initials = n => n.split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase();
  const firstName = n => n.split(/\s+/)[0] === "Coach" ? n : n.split(/\s+/)[0];
  const allIndex = Object.fromEntries(D.boards.map((b,i)=>[b.id,i]));
  const chunk = (a,n) => { const out=[]; for (let i=0;i<a.length;i+=n) out.push(a.slice(i,i+n)); return out.length?out:[[]]; };

  const state = { cat:"All", coach:"all" };
  let mode = null, flip = null, block = null, list = [], firstBoardPage = 3;

  /* ---------- building blocks ---------- */
  // No Photo URL on the sheet? Try images/coaches/<first name>.jpg, then .png,
  // and keep the initials if neither exists.
  const photoSlug = n => String(n||"").replace(/^coach\s+/i,"").trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9-]/g,"");
  function avatar(c){
    const bg = AV_COLORS[c._i % AV_COLORS.length];
    if (c.photo) return `<span class="avatar"><img src="${esc(c.photo)}" alt=""></span>`;
    const slug = photoSlug(c.name);
    const guess = slug ? `<img src="images/coaches/${slug}.jpg" alt="" onerror="if(!this.dataset.png){this.dataset.png=1;this.src='images/coaches/${slug}.png'}else this.remove()">` : "";
    return `<span class="avatar" style="background:${bg}"><span>${esc(initials(c.name))}</span>${guess}</span>`;
  }
  function infoInner(b){
    const c = coachById[b.coach] || {name:"Coach TBC",_i:0,id:""};
    return `
      <div class="meta-row">
        <div class="tags"><span class="tag cat-${esc(b.category)}">${esc(b.category)}</span>${b.progression?`<span class="tag prog">Prog. ${esc(b.progression)}</span>`:""}</div>
        <span class="date">${fmtDate(b.date)}</span>
      </div>
      <h2 class="prog-name">${esc(b.program)}</h2>
      ${b.quip?`<p class="quip">${esc(b.quip)}</p>`:""}
      <p class="note">${esc(b.note)}</p>
      <div class="grow"></div>
      <button class="coach-row" data-action="profile" data-coach="${esc(c.id)}">
        ${avatar(c)}
        <span class="who"><span class="drawn">Drawn by</span><span class="c-name">${esc(c.name)}</span><span class="c-link">View profile</span></span>
      </button>`;
  }
  function sketchBtn(b){
    return `<button class="sketch" data-action="zoom" data-board="${esc(b.id)}" aria-label="Open the ${esc(b.program)} board full screen">
        <img src="${esc(b.page)}" alt="${esc(b.transcript)}" loading="lazy" decoding="async"></button>`;
  }
  function coverInner(withHint){
    return `
      <div class="cover-top"><img class="cv-logo" src="images/brand/bft-logo-cyan.svg" alt="BFT">${esc(D.studio.name.replace(/^BFT\s*/,""))}</div>
      <h1 class="cover-title">The Coach's <em>Playbook</em></h1>
      <p class="cover-sub">Whiteboards from the coaches at ${esc(D.studio.name.replace(/^BFT\s*/,""))}.</p>
      ${withHint?`<div class="cover-open">Open &rarr;</div>`:`<div class="cover-open" style="visibility:hidden">.</div>`}`;
  }
  function backInner(){
    return `
      <div class="cover-top"><img class="cv-logo" src="images/brand/bft-logo-cyan.svg" alt="BFT">${esc(D.studio.name.replace(/^BFT\s*/,""))}</div>
      <div class="big">Your turn<span>.</span></div>
      <a class="btn-hot" href="${esc(D.studio.offerUrl)}" target="_blank" rel="noopener"><span>${esc(D.studio.offerLine)}</span>${ICON.arrow}</a>
      <p class="small">${esc(D.studio.offerSmall)}</p>
      <div class="addr">${esc(D.studio.address)}</div>`;
  }
  function introInner(){
    return `
      <span class="eyebrow">How to read this book</span>
      <h2 class="intro-h">One class.<br>One board.</h2>
      <p class="intro-p">Left page: the session and the coach who drew it.</p>
      <p class="intro-p">Right page: the whiteboard. Tap it to zoom in.</p>
      <div class="grow"></div>`;
  }
  function rosterInner(coaches, pageNo, pages){
    return `
      <div class="roster-h"><span class="eyebrow">The coaches</span><span class="cnt">${pages>1?`${pageNo}/${pages}`:`${D.coaches.length} coaches`}</span></div>
      <div class="roster">
        ${coaches.map(c0=>{const c=coachById[c0.id];
          return `<button data-action="profile" data-coach="${esc(c.id)}" aria-label="${esc(c.name)} profile">${avatar(c)}<span class="nm">${esc(firstName(c.name))}</span></button>`;}).join("")}
      </div>`;
  }

  /* ---------- filtering ---------- */
  function filtered(){
    return D.boards.filter(b => (state.cat==="All"||b.category===state.cat) && (state.coach==="all"||b.coach===state.coach));
  }
  function renderFilters(){
    const f = document.getElementById("filters");
    const base = D.boards.filter(b => state.coach==="all"||b.coach===state.coach);
    const dot = {Cardio:"var(--coral)",Strength:"var(--blue)",HIIT:"var(--charcoal)",Hybrid:"linear-gradient(90deg,var(--coral) 50%,var(--blue) 50%)"};
    f.innerHTML = ["All",...CATS].map(c=>{
      const n = c==="All"? base.length : base.filter(b=>b.category===c).length;
      return `<button class="chip-btn" data-action="cat" data-cat="${c}" aria-pressed="${state.cat===c}">${c!=="All"?`<span class="dot" style="background:${dot[c]}"></span>`:""}${c}<span class="n">${n}</span></button>`;
    }).join("");
    const s = document.getElementById("coach-select");
    s.innerHTML = `<option value="all">All coaches</option>` + [...D.coaches].sort((a,b)=>a.name.localeCompare(b.name)).map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
    s.value = state.coach;
  }

  /* ---------- book (desktop) ---------- */
  function pageIndexOf(id){ const i = list.findIndex(b=>b.id===id); return i<0? -1 : firstBoardPage + i*2; }
  function buildBook(target){
    const wrap = document.getElementById("book-wrap");
    if (flip){ try{ flip.destroy(); }catch(e){} flip=null; }
    if (block && block.parentNode) block.remove();
    block = document.createElement("div");
    wrap.appendChild(block);
    list = filtered();

    // front matter: cover | intro + roster page 1 | (extra roster pages, in pairs)
    const rosterPages = chunk(D.coaches, ROSTER_PER_PAGE);
    let pages = [];
    pages.push(`<div class="page" data-density="hard"><div class="pg pg-cover">${coverInner(true)}</div></div>`);
    pages.push(`<div class="page"><div class="pg pg-left intro-left">${introInner()}</div></div>`);
    rosterPages.forEach((rp,i)=> pages.push(`<div class="page"><div class="pg ${i%2===0?"pg-right":"pg-left"}">${rosterInner(rp,i+1,rosterPages.length)}</div></div>`));
    if (pages.length % 2 === 0) pages.push(`<div class="page"><div class="pg pg-right"></div></div>`);
    firstBoardPage = pages.length;

    if (!list.length){
      pages.push(`<div class="page"><div class="pg pg-left"><span class="eyebrow">Nothing here yet</span><h2 class="prog-name">No boards match</h2><p class="empty">Try another workout type or coach.</p></div></div>`);
      pages.push(`<div class="page"><div class="pg pg-right"></div></div>`);
    }
    list.forEach(b=>{
      pages.push(`<div class="page"><div class="pg pg-left">${infoInner(b)}</div></div>`);
      pages.push(`<div class="page"><div class="pg pg-right sk">${sketchBtn(b)}</div></div>`);
    });
    pages.push(`<div class="page" data-density="hard"><div class="pg pg-cover pg-back">${backInner()}</div></div>`);
    block.innerHTML = pages.join("");

    const bar = document.querySelector(".bar").offsetHeight;
    const availH = Math.max(420, window.innerHeight - bar - 120);
    const availW = Math.min(wrap.parentElement.clientWidth, 1240);
    const pageH = Math.round(Math.min(availH, (availW/2)*4/3, 780));
    const pageW = Math.round(pageH*3/4);
    wrap.style.width = (pageW*2)+"px";
    flip = new St.PageFlip(block, {
      width: pageW, height: pageH, size: "fixed",
      showCover: true, usePortrait: false, drawShadow: true, maxShadowOpacity: .25,
      flippingTime: matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 750,
      mobileScrollSupport: true, clickEventForward: true, disableFlipByClick: true, showPageCorners: true
    });
    flip.loadFromHTML(block.querySelectorAll(".page"));
    flip.on("flip", e => onPage(e.data, true));
    const rings = document.getElementById("rings");
    rings.style.height = pageH+"px";
    if (!rings.children.length) rings.innerHTML = "<i></i>".repeat(14);
    let t = 0;
    if (target==="first") t = firstBoardPage;
    else if (target) t = pageIndexOf(target);
    if (t>0 && t < flip.getPageCount()) flip.turnToPage(t);
    onPage(flip.getCurrentPageIndex(), false);
  }
  function onPage(i, fromFlip){
    const total = flip.getPageCount();
    const c = document.getElementById("counter");
    const bi = Math.floor((i-firstBoardPage)/2);
    if (i===0) c.innerHTML = "<b>Cover</b>";
    else if (i>=total-1) c.innerHTML = "<b>Back cover</b>";
    else if (i<firstBoardPage) c.innerHTML = "<b>The coaches</b>";
    else c.innerHTML = list.length ? `Board <b>${bi+1}</b> of <b>${list.length}</b>` : "<b>No boards</b>";
    document.getElementById("prev").disabled = i<=0;
    document.getElementById("next").disabled = i>=total-1;
    if (fromFlip) setHash(i>=firstBoardPage && list[bi] && i<total-1 ? list[bi].id : "");
  }

  /* ---------- stack (mobile) ---------- */
  function buildStack(target){
    list = filtered();
    const s = document.getElementById("stack");
    let html = `<div class="card-cover"><div class="pg pg-cover">${coverInner(false)}</div></div>`;
    if (state.cat==="All" && state.coach==="all") html += `<div class="card card-roster"><div class="pg">${rosterInner(D.coaches,1,1)}</div></div>`;
    if (!list.length) html += `<div class="card card-roster"><div class="pg"><h2 class="prog-name" style="margin:0">No boards match</h2><p class="empty">Try another workout type or coach.</p></div></div>`;
    list.forEach(b=>{
      html += `<article class="card" id="${esc(b.id)}"><div class="card-fig">${sketchBtn(b)}</div><div class="card-info"><div class="pg">${infoInner(b)}</div></div></article>`;
    });
    html += `<div class="card-cover"><div class="pg pg-cover pg-back">${backInner()}</div></div>`;
    s.innerHTML = html;
    if (target==="first"){ const el = document.querySelector("#stack .card[id]"); if (el) el.scrollIntoView({block:"start",behavior:"smooth"}); }
    else if (target){ const el = document.getElementById(target); if (el) el.scrollIntoView({block:"start"}); }
  }

  /* ---------- render ---------- */
  function wantMode(){ return (window.innerWidth >= 860 && window.innerHeight >= 520) ? "book" : "stack"; }
  function render(target){
    renderFilters();
    mode = wantMode();
    document.body.classList.toggle("mode-book", mode==="book");
    document.body.classList.toggle("mode-stack", mode==="stack");
    if (mode==="book"){ document.getElementById("stack").innerHTML = ""; buildBook(target); }
    else { if (flip){ try{flip.destroy();}catch(e){} flip=null; block=null; } buildStack(target); }
  }

  /* ---------- hash / share ---------- */
  function setHash(id){ try{ history.replaceState(null, "", id ? "#"+id : location.pathname + location.search); }catch(e){} }
  function shareUrl(id){ return location.href.split("#")[0] + "#" + id; }
  let toastT;
  function toast(msg){
    const t = document.getElementById("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(()=>t.hidden=true, 3200);
  }
  async function share(id){
    const b = D.boards.find(x=>x.id===id); const url = shareUrl(id);
    if (navigator.share){
      try{ await navigator.share({title:`${b.program} · The Coach's Playbook`, text:b.note, url}); return; }catch(e){ if (e && e.name==="AbortError") return; }
    }
    try{ await navigator.clipboard.writeText(url); toast("Link copied"); }
    catch(e){ toast(url); }
  }

  /* ---------- overlays ---------- */
  let lbBoard = null, lastFocus = null;
  function openLightbox(id){
    lbBoard = D.boards.find(b=>b.id===id); if (!lbBoard) return;
    lastFocus = document.activeElement;
    const c = coachById[lbBoard.coach];
    document.getElementById("lb-title").innerHTML = `${esc(lbBoard.program)}${lbBoard.progression?" · "+esc(lbBoard.progression):""}<small>${fmtDate(lbBoard.date)} · drawn by ${esc(c?c.name:"Coach TBC")}</small>`;
    setOriginal(false); setZoom(false);
    document.getElementById("overlay-lightbox").hidden = false;
    document.querySelector("#overlay-lightbox [data-action=close]").focus();
  }
  function setOriginal(on){
    document.getElementById("lb-orig").setAttribute("aria-pressed", on);
    const img = document.getElementById("lb-img");
    img.src = on ? lbBoard.original : lbBoard.full;
    img.alt = lbBoard.transcript;
  }
  function setZoom(on){
    document.getElementById("lb-zoom").setAttribute("aria-pressed", on);
    const sc = document.getElementById("lb-scroll"); sc.classList.toggle("zoomed", on);
    if (!on) sc.scrollTo(0,0);
  }
  function openProfile(id){
    const c = coachById[id]; if (!c) return;
    lastFocus = document.activeElement;
    const n = D.boards.filter(b=>b.coach===id).length;
    const facts = [["Specialty",c.specialty],["Favourite session",c.favouriteSession],["Signature doodle",c.signatureDoodle],["Boards in this book",n]].filter(f=>f[1]!==""&&f[1]!=null);
    document.getElementById("profile-card").innerHTML = `
      <button class="pf-close" data-action="close" aria-label="Close profile">${ICON.close}</button>
      <div class="pg">
        <div class="pf-head">${avatar(c)}<div><h2>${esc(c.name)}</h2><div class="pf-role">${esc(c.role)}${c.yearsCoaching?` · ${c.yearsCoaching} years coaching`:""}</div></div></div>
        ${c.bio?`<p class="pf-bio">${esc(c.bio)}</p>`:""}
        <dl class="pf-facts">${facts.map(f=>`<div><dt>${f[0]}</dt><dd>${esc(f[1])}</dd></div>`).join("")}</dl>
        <div class="pf-actions">
          ${n?`<button class="btn-hot" data-action="coach-boards" data-coach="${esc(c.id)}"><span>See ${n} board${n===1?"":"s"}</span>${ICON.arrow}</button>`:""}
          ${c.instagram?`<a class="txt-btn" href="https://instagram.com/${esc(c.instagram.replace(/^@/,""))}" target="_blank" rel="noopener">@${esc(c.instagram.replace(/^@/,""))}</a>`:""}
        </div>
      </div>`;
    document.getElementById("overlay-profile").hidden = false;
    setHash(id);
    document.querySelector("#profile-card .pf-close").focus();
  }
  function closeOverlays(){
    const wasProfile = !document.getElementById("overlay-profile").hidden;
    document.getElementById("overlay-lightbox").hidden = true;
    document.getElementById("overlay-profile").hidden = true;
    if (wasProfile) setHash("");
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }
  const overlayOpen = () => !document.getElementById("overlay-lightbox").hidden || !document.getElementById("overlay-profile").hidden;

  /* ---------- events ---------- */
  document.addEventListener("click", e=>{
    const t = e.target.closest("[data-action]"); if (!t) return;
    const a = t.dataset.action;
    if (a==="zoom") openLightbox(t.dataset.board);
    else if (a==="profile") openProfile(t.dataset.coach);
    else if (a==="share") share(t.dataset.board);
    else if (a==="close") closeOverlays();
    else if (a==="cat"){ state.cat = t.dataset.cat; render("first"); }
    else if (a==="coach-boards"){ state.coach = t.dataset.coach; state.cat="All"; closeOverlays(); render("first"); }
    else if (a==="home"){ e.preventDefault(); state.cat="All"; state.coach="all"; setHash(""); render(); window.scrollTo({top:0}); }
  });
  document.getElementById("coach-select").addEventListener("change", e=>{ state.coach = e.target.value; render("first"); });
  document.getElementById("prev").addEventListener("click", ()=> flip && flip.flipPrev());
  document.getElementById("next").addEventListener("click", ()=> flip && flip.flipNext());
  document.getElementById("lb-orig").addEventListener("click", e=> setOriginal(e.currentTarget.getAttribute("aria-pressed")!=="true"));
  document.getElementById("lb-zoom").addEventListener("click", e=> setZoom(e.currentTarget.getAttribute("aria-pressed")!=="true"));
  document.getElementById("lb-img").addEventListener("click", ()=> setZoom(!document.getElementById("lb-scroll").classList.contains("zoomed")));
  document.getElementById("overlay-profile").addEventListener("click", e=>{ if (e.target.id==="overlay-profile") closeOverlays(); });
  document.addEventListener("keydown", e=>{
    if (e.key==="Escape" && overlayOpen()) { closeOverlays(); return; }
    if (overlayOpen() || !flip || /input|select|textarea/i.test(e.target.tagName)) return;
    if (e.key==="ArrowRight") flip.flipNext();
    if (e.key==="ArrowLeft") flip.flipPrev();
  });
  let rT, lastW = window.innerWidth, lastH = window.innerHeight;
  window.addEventListener("resize", ()=>{
    clearTimeout(rT); rT = setTimeout(()=>{
      if (Math.abs(window.innerWidth-lastW)<40 && Math.abs(window.innerHeight-lastH)<80 && wantMode()===mode) return;
      lastW = window.innerWidth; lastH = window.innerHeight;
      const cur = flip ? flip.getCurrentPageIndex() : 0;
      const bi = Math.floor((cur-firstBoardPage)/2);
      render(cur>=firstBoardPage && list[bi] ? list[bi].id : null);
    }, 220);
  });

  /* ---------- boot ---------- */
  const cta = document.getElementById("top-cta");
  cta.href = D.studio.offerUrl;
  cta.innerHTML = `<span class="long">${esc(D.studio.offerLine)}</span><span class="short">${esc(D.studio.offerShort||D.studio.offerLine)}</span>${ICON.arrow}`;
  const h = decodeURIComponent((location.hash||"").slice(1));
  if (h && allIndex[h]!==undefined) render(h);
  else { render(); if (h && coachById[h]) openProfile(h); }
};
