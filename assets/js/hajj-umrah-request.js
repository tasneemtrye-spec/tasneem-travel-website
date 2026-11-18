(function(){
  const form=document.getElementById("service-inquiry");
  if(!form)return;
  const status=document.getElementById("request-status");
  const endpoint="https://kbllhakivjduwanefvtf.supabase.co/functions/v1/submit-booking";
  const publicKey="sb_publishable_upvTd4y1nomu_QsNu9GgVg_Dq4c_6pS";
  form.addEventListener("submit",async function(event){
    event.preventDefault();
    if(!form.reportValidity())return;
    const d=new FormData(form);
    const payload={
      full_name:String(d.get("full_name")||"").trim(),
      phone:String(d.get("phone")||"").trim(),
      email:String(d.get("email")||"").trim(),
      service:"خدمات الحج والعمرة",
      destination:String(d.get("destination")||"").trim(),
      travel_date:String(d.get("travel_date")||""),
      travellers:String(d.get("travellers")||"2"),
      contact_method:"واتساب",
      message:(location.pathname.indexOf("hajj")>=0?"نوع الطلب: الحج. ":"نوع الطلب: العمرة. ")+String(d.get("message")||"").trim(),
      privacy_consent:d.get("privacy_consent")==="on"
    };
    const button=form.querySelector('button[type="submit"]');
    button.disabled=true;
    status.textContent="جارٍ تسجيل طلبك بأمان…";
    try{
      const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","apikey":publicKey,"Authorization":"Bearer "+publicKey},body:JSON.stringify(payload)});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.success)throw new Error(result.error||"تعذر تسجيل الطلب");
      status.textContent="تم استلام طلبك بنجاح. رقم الطلب: "+result.booking_id+" — سيقوم فريق تسنيم بمراجعته والتواصل معك.";
      form.reset();
      const link=document.createElement("a");
      link.href="/track.html";
      link.textContent="يمكنك متابعة الطلب من هنا";
      link.style.display="inline-block";
      link.style.marginTop="8px";
      status.appendChild(document.createElement("br"));
      status.appendChild(link);
    }catch(error){
      status.textContent="لم نتمكن من تسجيل الطلب الآن. يرجى المحاولة لاحقاً أو التواصل عبر واتساب على الرقم +966 53 701 7117.";
    }finally{button.disabled=false;}
  });
})();