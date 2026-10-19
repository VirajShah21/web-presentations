async (page) => {
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const checks=[];
 const sleep=ms=>page.waitForTimeout(ms);
 const label=()=>page.evaluate(()=>WebPresentations.getState().label);
 const assert=(ok,message)=>{if(!ok)throw Error(message);checks.push(message)};
 const fixture=page.url().split('?')[0];
 const reset=async(slide=1,sub='')=>{await page.goto(fixture);await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(([s,u])=>WebPresentations.goTo(s,u),[slide,sub]);await page.mouse.move(1050,700);};
 const dispatchWheel=async(x,y,mode=0,extra={})=>page.evaluate(({x,y,mode,extra})=>document.querySelector('.wp-state.is-active').dispatchEvent(new WheelEvent('wheel',{deltaX:x,deltaY:y,deltaMode:mode,bubbles:true,cancelable:true,...extra})),{x,y,mode,extra});
 await page.setViewportSize({width:1200,height:900});
 await reset();await page.mouse.wheel(0,90);await sleep(330);assert(await label()==='1','small desktop wheel stays on slide');
 await page.mouse.wheel(0,290);await sleep(330);assert(await label()==='2','deliberate desktop wheel advances');
 await reset();await dispatchWheel(0,290);await dispatchWheel(0,-230);await sleep(330);assert(await label()==='1','reversed wheel snaps back');
 await reset();await dispatchWheel(200,0);await sleep(330);assert(await label()==='1','small horizontal wheel stays');
 await dispatchWheel(380,0);await sleep(330);assert(await label()==='1a','deliberate horizontal wheel advances');
 await reset();await dispatchWheel(0,20,1);await sleep(330);assert(await label()==='2','line-mode wheel normalized');
 await reset();await dispatchWheel(0,1,2);await sleep(330);assert(await label()==='2','page-mode wheel normalized');
 await reset();await dispatchWheel(0,900,0,{ctrlKey:true});await sleep(330);assert(await label()==='1','pinch wheel does not navigate');
 await reset();for(let i=0;i<12;i++){await dispatchWheel(0,160);await sleep(30)}await sleep(330);assert(await label()==='2','one long wheel burst advances once');
 await reset(2);await page.evaluate(()=>{const s=document.querySelector('.wp-state.is-active');s.scrollTop=s.scrollHeight-s.clientHeight-50});await page.mouse.wheel(0,120);await sleep(40);await page.mouse.wheel(0,400);await sleep(340);assert(await label()==='2','content scroll reaching edge does not spill into next slide');
 await page.mouse.wheel(0,300);await sleep(340);assert(await label()==='3','fresh gesture at content edge may navigate');
 await reset();const horizontal=page.locator('#horizontal');await horizontal.scrollIntoViewIfNeeded();await horizontal.hover();await page.mouse.wheel(500,0);await sleep(340);assert(await label()==='1','nested horizontal scroller owns gesture');assert(await horizontal.evaluate(n=>n.scrollLeft)>0,'nested horizontal content actually scrolled');
 await reset();await page.locator('#horizontal').focus();await page.keyboard.press('ArrowRight');assert(await label()==='1'&&await page.locator('#horizontal').evaluate(n=>n.scrollLeft)>0,'focused overflow keeps horizontal arrow scrolling');
 await reset();await page.locator('#range').focus();await page.keyboard.press('ArrowRight');assert(await label()==='1','range control keeps arrow keys');
 await reset(2);await page.keyboard.press('PageDown');await sleep(50);assert(await label()==='2','PageDown scrolls long slide before leaving');assert(await page.evaluate(()=>document.querySelector('.wp-state.is-active').scrollTop)>0,'keyboard really scrolled content');
 await reset();await page.keyboard.press('ArrowRight');assert(await label()==='1a','keyboard horizontal navigation');await page.keyboard.press('ArrowLeft');assert(await label()==='1','keyboard previous subslide');
 await page.evaluate(()=>WebPresentations.goTo(4,'a'));const aligned=await page.evaluate(()=>({label:WebPresentations.getState().label,left:document.querySelector('.wp-state.is-active').getBoundingClientRect().left}));assert(aligned.label==='4a'&&Math.abs(aligned.left)<1,'cross-section goTo aligns requested subslide');
 await reset();await page.evaluate(()=>{document.querySelectorAll('.wp-slide')[1].dataset.transition='custom-test';window.customCalled=0;window.webPresentationTransitions['custom-test']=()=>{window.customCalled++}});await page.mouse.wheel(0,90);await sleep(330);assert(await label()==='1','custom transitions cannot bypass gesture threshold');await page.mouse.wheel(0,300);await sleep(330);assert(await label()==='2'&&await page.evaluate(()=>window.customCalled)===0,'wheel ignores custom fade transition');
 await reset();await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>{window.movement=WebPresentations.next()});await sleep(140);const motion=await page.evaluate(()=>[...document.querySelectorAll('.wp-slide')].slice(0,2).map(n=>({opacity:getComputedStyle(n).opacity,y:new DOMMatrix(getComputedStyle(n).transform).m42})));assert(motion.every(n=>n.opacity==='1')&&motion[0].y<-10&&motion[1].y>10,'default transition translates viewport without fading');await page.evaluate(()=>window.movement);
 await reset();await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>{window.movement=WebPresentations.nextSubslide()});await sleep(100);assert(await page.locator('[data-wp-magic-clone]').count()>0,'shared element moves during scroll transition');await page.evaluate(()=>window.movement);assert(await page.locator('[data-wp-magic-clone]').count()===0,'shared elements restore after navigation');
 await reset();await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>{document.querySelectorAll('.wp-slide')[1].dataset.transition='slow-test';window.webPresentationTransitions['slow-test']=()=>new Promise(r=>setTimeout(r,400));window.slow=WebPresentations.next()});await sleep(100);await page.evaluate(()=>WebPresentations.goTo(4));await page.evaluate(()=>window.slow);assert(await label()==='2','explicit effect cannot be disposed by overlapping navigation');
 await reset();await dispatchWheel(0,140);await page.setViewportSize({width:1100,height:850});await sleep(330);assert(await label()==='1','resize cancels incomplete gesture');
 // CDP sends actual browser touch input, exercising native scrolling and touch cancellation.
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 await page.setViewportSize({width:390,height:844});
 const swipe=async(dx,dy,{cancel=false,multi=false}={})=>{
  const x=310,y=650;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/8,y:y+dy*i/8,id:1}]});await sleep(18)}
  if(multi)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x+dx,y:y+dy,id:1},{x:100,y:200,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});await sleep(360);
 };
 await reset();await swipe(0,-80);assert(await label()==='1','short mobile swipe stays');
 await swipe(0,-310);assert(await label()==='2','deliberate mobile swipe advances');
 await reset();await swipe(-80,0);assert(await label()==='1','short mobile horizontal swipe stays');await swipe(-180,0);assert(await label()==='1a','deliberate mobile horizontal swipe advances');
 await reset();await swipe(0,-310,{cancel:true});assert(await label()==='1','touchcancel snaps back');
 await reset();await swipe(0,-310,{multi:true});assert(await label()==='1','multi-touch cancels slide navigation');
 await reset(2);await swipe(0,-310);assert(await label()==='2','mobile scroll inside long slide does not advance');assert(await page.evaluate(()=>document.querySelector('.wp-state.is-active').scrollTop)>0,'mobile gesture really scrolls long content');
 await page.evaluate(()=>{const s=document.querySelector('.wp-state.is-active');s.scrollTop=s.scrollHeight-s.clientHeight-60});await swipe(0,-310);assert(await label()==='2','mobile content gesture stays inside after reaching edge');
 await swipe(0,-310);assert(await label()==='3','new mobile swipe at boundary advances');
 await cdp.detach();
 assert(errors.length===0,'no browser runtime errors');
 return {version:await page.evaluate(()=>WebPresentations.version),passed:checks.length,checks,errors};
}
