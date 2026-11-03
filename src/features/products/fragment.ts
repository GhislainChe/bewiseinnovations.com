/** No network, storage, token verification or user data interpolation. */
export const WAITLIST_FRAGMENT_BOOTSTRAP=`(function(){
 if(location.pathname!=="/products/withdraw")return;
 var raw=location.search?"":location.hash.slice(1),token="";
 try{history.replaceState(null,"","/products/withdraw");var p=new URLSearchParams(raw);if(p.getAll("token").length===1&&Array.from(p.keys()).length===1&&/^w1_[a-f0-9]{64}$/.test(p.get("token")||""))token=p.get("token");}catch(_){token="";}
 raw="";Object.defineProperty(window,"__beWiseWaitlistWithdrawal",{configurable:true,value:function(){var v=token;token="";delete window.__beWiseWaitlistWithdrawal;return v;}});
 addEventListener("pagehide",function(){token="";delete window.__beWiseWaitlistWithdrawal;},{once:true});
})();`;
