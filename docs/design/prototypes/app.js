/* Daimoma prototype — synthetic data only, simulated actions. No backend. */
const I18N = {
  en: {
    skip:"Skip to content", ribbon:"PROTOTYPE — synthetic data, simulated actions",
    role:"Role", screen:"Screen", state:"State", width:"Width",
    navMy:"My work", navHome:"Home", navReq:"My requests", navTime:"My time", navNotif:"Notifications",
    navTeam:"Team", navReviews:"Reviews", navTeamTime:"Team time",
    navAdmin:"Administration", navEmployees:"Employees", navTypes:"Request types", navReports:"Reports",
    normal:"Normal", loading:"Loading", empty:"Empty", error:"Error", conflict:"Stale/conflict",
    expired:"Session expired", forbidden:"Forbidden/404",
    welcome:"Welcome back, Mariam", pendingRev:"Pending your review", myPending:"My pending items",
    hoursWeek:"Hours this week", openReq:"Open requests", newReq:"New request",
    reqTitle:"My requests", colType:"Type", colStatus:"Status", colSubmitted:"Submitted", colSummary:"Summary",
    draft:"Draft", pending:"Pending", approved:"Approved", returned:"Returned", rejected:"Rejected",
    leave:"Leave", equipment:"Equipment", hrservice:"HR service", wfh:"Work from home", general:"General",
    emptyReq:"No requests yet. Submit your first request to get started.",
    errBanner:"Something went wrong. Your input is preserved — try again.",
    staleBanner:"This item changed while you were viewing it. Refresh to see the latest state.",
    expiredBanner:"Your session has expired. Re-authenticate to continue — nothing was submitted.",
    forbiddenT:"Not available", forbiddenB:"You don't have access to this item, or it doesn't exist.",
    backHome:"Back to home", reauth:"Sign in again",
    timeTitle:"My time — week of 14 Sep", day:"Day", start:"Start", end:"End", dur:"Duration", note:"Note",
    submitWeek:"Submit week", submittedBanner:"Submitted — awaiting manager review. Entries are read-only.",
    retBanner:"Returned by Khaled: “Please correct Friday — you logged 12h.” Edit and resubmit.",
    resubmit:"Resubmit", overlap:"Review Friday’s 12-hour entry before submitting.",
    queueT:"Review queue", colFrom:"From", colItem:"Item", colAge:"Waiting",
    selfNote:"This is your own request — it's routed to another reviewer. No decision controls are shown.",
    approve:"Approve", return:"Return", reject:"Reject", reasonPh:"Reason (required)…",
    confirmApprove:"Approve this item? The employee will be notified.",
    reasonReq:"A reason is required to return or reject.",
    toastApproved:"Approved (simulated)", toastReturned:"Returned (simulated)", toastRejected:"Rejected (simulated)",
    teamT:"Team time — current week", colMember:"Member", colHours:"Hours", colStatusT:"Status",
    empT:"Employees", colName:"Name", colRole:"Role", colManager:"Manager", colAcct:"Account",
    roleEmp:"Employee", roleMgr:"Manager", roleHr:"HR", active:"Active",
    editMgr:"Change manager", mgrWarn:"Changing the manager reassigns this person's pending reviews to the new manager. This action is logged.",
    typesT:"Request types", reqFields:"Required fields", attachments:"Attachments",
    repT:"Organization reports", repRange:"Date range", exportBtn:"Export (simulated)",
    notifT:"Notifications", markRead:"Mark read", unread:"Unread", read:"Read",
    notifButton:"Notifications, {count} unread", notifSummary:"{count} unread", notifAll:"View all notifications", notifNone:"No notifications yet.", notifOpen:"Open", notifToday:"Today",
    notif1:"Your leave request was returned for correction", notif2:"Timesheet week 38 approved",
    notif3:"New request awaiting your review",
    dashT:"Home",
    formTitle:"New request", type:"Type", summary:"Summary", details:"Details", attach:"Attachment",
    submit:"Submit request", saveDraft:"Save draft", cancel:"Cancel",
    errSummary:"Please fix 2 problems below.", errType:"Choose a request type.", errSum:"Summary is required (min. 10 characters).",
    succBanner:"Request submitted — it's now with your manager Khaled.", draftSaved:"Draft saved.",
    viewHist:"History", now:"now", ago2d:"2 days ago", ago1d:"1 day ago",
    mon:"Mon",tue:"Tue",wed:"Wed",thu:"Thu",fri:"Fri",sat:"Sat",sun:"Sun",
    dashReqCard:"Requests awaiting review", dashTimeCard:"Timesheets to review", dashMyCard:"My pending items",
    unlocked:"Editable", locked:"Read-only", weekTotal:"Week total", hrs:"h",
    previous:"Previous", next:"Next", pageOf:"Page {page} of {total}", entriesOf:"{count} records", all:"All", noResults:"No records match these filters.",
    weekLabel:"Week {week} · {date}", previousWeeks:"Previous weeks", viewWeek:"View week", backCurrent:"Current week", historicalNote:"Historical weeks are read-only in this mockup.",
    addEmployee:"Add employee", editEmployee:"Edit employee", empEmail:"Email", empDepartment:"Department", empStatus:"Account status", inactive:"Inactive", saveEmployee:"Save employee (simulated)", empSaved:"Employee changes shown in this prototype only.", empCreated:"Employee added in this prototype only.", empValidation:"Enter a name and a valid, unique email address.", lastHr:"The sole HR administrator cannot lose HR access in this example.",
    repMonth:"Month", repEmployee:"Employee", repStatus:"Request status", repSummary:"Requests and approved time by employee", repByStatus:"Requests by status", repTotal:"Requests in view", repHours:"Approved hours in view", repCount:"Requests", repHoursCol:"Approved hours", repScope:"Organization view · synthetic data only", repExportNote:"Export is a preview only; no file was created.", submitDemo:"Submission is simulated; no week was sent.", reportEmpty:"No report rows match the selected filters.",
  },
  ar: {
    skip:"تخطَّ إلى المحتوى", ribbon:"نموذج أولي — بيانات تجريبية، إجراءات محاكاة",
    role:"الدور", screen:"الشاشة", state:"الحالة", width:"العرض",
    navMy:"عملي", navHome:"الرئيسية", navReq:"طلباتي", navTime:"وقتي", navNotif:"الإشعارات",
    navTeam:"الفريق", navReviews:"المراجعات", navTeamTime:"وقت الفريق",
    navAdmin:"الإدارة", navEmployees:"الموظفون", navTypes:"أنواع الطلبات", navReports:"التقارير",
    normal:"عادي", loading:"تحميل", empty:"فارغ", error:"خطأ", conflict:"تعارض",
    expired:"انتهت الجلسة", forbidden:"ممنوع/غير موجود",
    welcome:"مرحبًا، مريم", pendingRev:"بانتظار مراجعتك", myPending:"عناصري المعلّقة",
    hoursWeek:"ساعات هذا الأسبوع", openReq:"الطلبات المفتوحة", newReq:"طلب جديد",
    reqTitle:"طلباتي", colType:"النوع", colStatus:"الحالة", colSubmitted:"قُدِّم", colSummary:"الملخّص",
    draft:"مسودة", pending:"قيد المراجعة", approved:"معتمد", returned:"مُعاد", rejected:"مرفوض",
    leave:"إجازة", equipment:"معدّات", hrservice:"خدمة موارد بشرية", wfh:"عمل من المنزل", general:"عام",
    emptyReq:"لا توجد طلبات بعد. قدِّم أول طلب للبدء.",
    errBanner:"حدث خطأ ما. مدخلاتك محفوظة — حاول مجددًا.",
    staleBanner:"تغيّر هذا العنصر أثناء عرضك له. حدّث الصفحة لرؤية أحدث حالة.",
    expiredBanner:"انتهت جلستك. سجّل الدخول مجددًا للمتابعة — لم يُرسَل شيء.",
    forbiddenT:"غير متاح", forbiddenB:"ليس لديك صلاحية الوصول، أو أن العنصر غير موجود.",
    backHome:"العودة للرئيسية", reauth:"تسجيل الدخول مجددًا",
    timeTitle:"وقتي — أسبوع ١٤ سبتمبر", day:"اليوم", start:"البداية", end:"النهاية", dur:"المدة", note:"ملاحظة",
    submitWeek:"إرسال الأسبوع", submittedBanner:"مُرسَل — بانتظار مراجعة المدير. الإدخالات للقراءة فقط.",
    retBanner:"أعاده خالد: «صحّح الجمعة — سجّلت ١٢ ساعة». عدّل ثم أعد الإرسال.",
    resubmit:"إعادة الإرسال", overlap:"راجع إدخال الجمعة الذي يبلغ ١٢ ساعة قبل الإرسال.",
    queueT:"قائمة المراجعة", colFrom:"من", colItem:"العنصر", colAge:"الانتظار",
    selfNote:"هذا طلبك الخاص — تم توجيهه لمراجع آخر. لا تظهر أدوات القرار.",
    approve:"اعتماد", return:"إرجاع", reject:"رفض", reasonPh:"السبب (إلزامي)…",
    confirmApprove:"اعتماد هذا العنصر؟ سيُبلَّغ الموظف.",
    reasonReq:"السبب إلزامي للإرجاع أو الرفض.",
    toastApproved:"تم الاعتماد (محاكاة)", toastReturned:"تم الإرجاع (محاكاة)", toastRejected:"تم الرفض (محاكاة)",
    teamT:"وقت الفريق — الأسبوع الحالي", colMember:"العضو", colHours:"الساعات", colStatusT:"الحالة",
    empT:"الموظفون", colName:"الاسم", colRole:"الدور", colManager:"المدير", colAcct:"الحساب",
    roleEmp:"موظف", roleMgr:"مدير", roleHr:"موارد بشرية", active:"نشط",
    editMgr:"تغيير المدير", mgrWarn:"تغيير المدير يعيد تعيين المراجعات المعلّقة لهذا الشخص للمدير الجديد. هذا الإجراء مسجَّل.",
    typesT:"أنواع الطلبات", reqFields:"الحقول المطلوبة", attachments:"المرفقات",
    repT:"تقارير المؤسسة", repRange:"النطاق الزمني", exportBtn:"تصدير (محاكاة)",
    notifT:"الإشعارات", markRead:"تعيين كمقروء", unread:"غير مقروء", read:"مقروء",
    notifButton:"الإشعارات، {count} غير مقروءة", notifSummary:"{count} غير مقروءة", notifAll:"عرض كل الإشعارات", notifNone:"لا توجد إشعارات بعد.", notifOpen:"فتح", notifToday:"اليوم",
    notif1:"أُعيد طلب الإجازة للتصحيح", notif2:"اعتُمدت ورقة الأسبوع ٣٨",
    notif3:"طلب جديد بانتظار مراجعتك",
    dashT:"الرئيسية",
    formTitle:"طلب جديد", type:"النوع", summary:"الملخّص", details:"التفاصيل", attach:"مرفق",
    submit:"إرسال الطلب", saveDraft:"حفظ كمسودة", cancel:"إلغاء",
    errSummary:"صحّح المشكلتين أدناه.", errType:"اختر نوع الطلب.", errSum:"الملخّص مطلوب (١٠ أحرف على الأقل).",
    succBanner:"أُرسل الطلب — أصبح لدى مديرك خالد.", draftSaved:"حُفظت المسودة.",
    viewHist:"السجل", now:"الآن", ago2d:"قبل يومين", ago1d:"قبل يوم",
    mon:"اثنين",tue:"ثلاثاء",wed:"أربعاء",thu:"خميس",fri:"جمعة",sat:"سبت",sun:"أحد",
    dashReqCard:"طلبات تنتظر المراجعة", dashTimeCard:"أوراق وقت للمراجعة", dashMyCard:"عناصري المعلّقة",
    unlocked:"قابل للتعديل", locked:"للقراءة فقط", weekTotal:"إجمالي الأسبوع", hrs:"س",
    previous:"السابق", next:"التالي", pageOf:"الصفحة {page} من {total}", entriesOf:"{count} سجلات", all:"الكل", noResults:"لا توجد سجلات تطابق عوامل التصفية.",
    weekLabel:"الأسبوع {week} · {date}", previousWeeks:"الأسابيع السابقة", viewWeek:"عرض الأسبوع", backCurrent:"الأسبوع الحالي", historicalNote:"الأسابيع السابقة للقراءة فقط في هذا النموذج.",
    addEmployee:"إضافة موظف", editEmployee:"تعديل الموظف", empEmail:"البريد الإلكتروني", empDepartment:"القسم", empStatus:"حالة الحساب", inactive:"غير نشط", saveEmployee:"حفظ الموظف (محاكاة)", empSaved:"تظهر تعديلات الموظف في هذا النموذج فقط.", empCreated:"أُضيف الموظف في هذا النموذج فقط.", empValidation:"أدخل اسمًا وبريدًا إلكترونيًا صالحًا وغير مكرر.", lastHr:"لا يمكن إزالة صلاحيات مسؤول الموارد البشرية الوحيد في هذا المثال.",
    repMonth:"الشهر", repEmployee:"الموظف", repStatus:"حالة الطلب", repSummary:"الطلبات والوقت المعتمد حسب الموظف", repByStatus:"الطلبات حسب الحالة", repTotal:"الطلبات المعروضة", repHours:"الساعات المعتمدة المعروضة", repCount:"الطلبات", repHoursCol:"الساعات المعتمدة", repScope:"عرض المؤسسة · بيانات تجريبية فقط", repExportNote:"التصدير للعرض فقط؛ لم يُنشأ ملف.", submitDemo:"الإرسال محاكاة؛ لم يُرسَل الأسبوع.", reportEmpty:"لا توجد صفوف تقارير تطابق عوامل التصفية.",
  }
};

let lang='en', role='employee', cur='dashboard', state='normal', width='1440';
const t=k=>I18N[lang][k]||k;
const badge=s=>`<span class="badge ${s}">${({draft:'◌',pending:'◔',approved:'✓',returned:'↩',rejected:'✕'})[s]||'•'} ${t(s)}</span>`;
const bdi=x=>`<bdi>${x}</bdi>`;

const screens={
 employee:['dashboard','requests','reqform','reqdetail','timesheet','notifications'],
 manager:['dashboard','requests','reqform','reqdetail','timesheet','notifications','reviewq','reviewitem','teamtime'],
 hr:['dashboard','requests','reqform','reqdetail','timesheet','notifications','employees','types','reports']
};
const screenNames={dashboard:'dashT',requests:'reqTitle',reqform:'formTitle',reqdetail:'reqTitle',
 timesheet:'timeTitle',notifications:'notifT',reviewq:'queueT',reviewitem:'queueT',
 teamtime:'teamT',employees:'empT',types:'typesT',reports:'repT'};

const REQ=[
 {type:'leave',status:'pending',sub:'22 Sep',sum:'Annual leave 5–9 Oct'},
 {type:'equipment',status:'returned',sub:'20 Sep',sum:'New monitor — second screen'},
 {type:'wfh',status:'approved',sub:'15 Sep',sum:'Remote Fridays in October'},
 {type:'general',status:'draft',sub:'—',sum:'Parking access request'},
 {type:'hrservice',status:'rejected',sub:'8 Sep',sum:'Salary certificate amendment'},
 {type:'leave',status:'approved',sub:'4 Sep',sum:'One day of annual leave'},
 {type:'equipment',status:'approved',sub:'28 Aug',sum:'Replacement keyboard request'},
 {type:'wfh',status:'pending',sub:'20 Aug',sum:'Remote work on Wednesdays'}
];
const TEAM=[{m:'Mariam Adel',h:'32.5',s:'approved'},{m:'Omar Hany',h:'38',s:'pending'},{m:'Lina Samir',h:'—',s:'draft'},{m:'Yusuf Nabil',h:'40',s:'pending'}];
const EMPS=[
 {n:'Mariam Adel',email:'mariam@example.test',d:'Operations',r:'roleEmp',m:'Khaled Fathy',a:1},
 {n:'Omar Hany',email:'omar@example.test',d:'Operations',r:'roleEmp',m:'Khaled Fathy',a:1},
 {n:'Khaled Fathy',email:'khaled@example.test',d:'Operations',r:'roleMgr',m:'Sara Lotfy',a:1},
 {n:'Sara Lotfy',email:'sara@example.test',d:'People',r:'roleHr',m:'—',a:1},
 {n:'Lina Samir',email:'lina@example.test',d:'People',r:'roleEmp',m:'Khaled Fathy',a:1},
 {n:'Yusuf Nabil',email:'yusuf@example.test',d:'Operations',r:'roleEmp',m:'Khaled Fathy',a:0}
];
const WEEKS=[
 {week:38,date:'14 Sep',status:'draft',minutes:2760,events:['draft']},
 {week:37,date:'7 Sep',status:'approved',minutes:2400,events:['draft','pending','approved']},
 {week:36,date:'31 Aug',status:'approved',minutes:2160,events:['draft','pending','returned','pending','approved']},
 {week:35,date:'24 Aug',status:'rejected',minutes:1950,events:['draft','pending','rejected']},
 {week:34,date:'17 Aug',status:'approved',minutes:2400,events:['draft','pending','approved']},
 {week:33,date:'10 Aug',status:'approved',minutes:2040,events:['draft','pending','approved']},
 {week:32,date:'3 Aug',status:'returned',minutes:1980,events:['draft','pending','returned']}
];
const REPORTS=[
 {month:'2026-09',n:'Mariam Adel',status:'pending',requests:2,minutes:2280},
 {month:'2026-09',n:'Omar Hany',status:'approved',requests:3,minutes:2400},
 {month:'2026-09',n:'Lina Samir',status:'returned',requests:1,minutes:2160},
 {month:'2026-09',n:'Yusuf Nabil',status:'approved',requests:2,minutes:1800},
 {month:'2026-09',n:'Khaled Fathy',status:'rejected',requests:1,minutes:2400},
 {month:'2026-08',n:'Mariam Adel',status:'approved',requests:1,minutes:2200},
 {month:'2026-08',n:'Omar Hany',status:'pending',requests:2,minutes:2100},
 {month:'2026-08',n:'Lina Samir',status:'approved',requests:2,minutes:2000}
];
const pages={requests:1,employees:1,weeks:1,reports:1,notifications:1,reviewq:1,teamtime:1};
const reportFilters={month:'2026-09',employee:'',status:''};
let selectedWeek=38;
const esc=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt=value=>new Intl.NumberFormat(lang).format(value);
const pageText=(page,total)=>t('pageOf').replace('{page}',fmt(page)).replace('{total}',fmt(total));
function paged(key,rows,size){const count=Math.max(1,Math.ceil(rows.length/size));pages[key]=Math.min(Math.max(1,pages[key]),count);return rows.slice((pages[key]-1)*size,pages[key]*size)}
function pager(key,length,size){const count=Math.max(1,Math.ceil(length/size));return `<nav class="pager" aria-label="${t('pageOf').replace('{page}',fmt(pages[key])).replace('{total}',fmt(count))}"><span>${pageText(pages[key],count)} · ${t('entriesOf').replace('{count}',fmt(length))}</span><button class="btn secondary" type="button" data-page="${key}" data-step="-1" ${pages[key]===1?'disabled':''}>${t('previous')}</button><button class="btn secondary" type="button" data-page="${key}" data-step="1" ${pages[key]===count?'disabled':''}>${t('next')}</button></nav>`}

const QUEUE=[{f:'Mariam Adel',i:'leave — Annual leave 5–9 Oct',a:'2d',s:'pending'},{f:'Omar Hany',i:'timesheet — Week 38',a:'1d',s:'pending'},{f:'Lina Samir',i:'equipment — New laptop',a:'3d',s:'pending'}];
const NOTIFS=[
 {id:'return',text:'notif1',time:'notifToday',screen:'reqdetail',read:false},
 {id:'timesheet',text:'notif2',time:'ago1d',screen:'timesheet',read:true},
 {id:'review',text:'notif3',time:'ago2d',screen:'reviewq',read:false,reviewer:true}
];
const visibleNotifs=()=>NOTIFS.filter(n=>!n.reviewer||role!=='employee');
const notifLabel=(key,count)=>t(key).replace('{count}',new Intl.NumberFormat(lang).format(count));

function tplLoading(){return `<h1>${t(screenNames[cur])}</h1><div class="card"><div class="skel" style="width:40%"></div><div class="skel"></div><div class="skel"></div><div class="skel" style="width:70%"></div><div class="skel" style="width:55%"></div></div>`}
function tplEmpty(){return `<h1>${t(screenNames[cur])}</h1><div class="card empty"><span class="glyph">🗂️</span><p>${t('emptyReq')}</p><button class="btn primary">${t('newReq')}</button></div>`}
function tplError(inner){return `<div class="banner err" role="alert">⚠ ${t('errBanner')}</div>${inner}`}
function tplConflict(inner){return `<div class="banner warn" role="alert">⚠ ${t('staleBanner')} <button class="btn secondary" style="margin-inline-start:8px">${t('read')} ↻</button></div>${inner}`}
function tplExpired(){return `<h1>${t(screenNames[cur])}</h1><div class="card empty"><span class="glyph">🔒</span><h2>${t('expiredBanner')}</h2><button class="btn primary">${t('reauth')}</button></div>`}
function tplForbidden(){return `<h1>${t(screenNames[cur])}</h1><div class="card empty"><span class="glyph">⛔</span><h2>${t('forbiddenT')}</h2><p class="muted">${t('forbiddenB')}</p><button class="btn secondary">${t('backHome')}</button></div>`}

function dashboard(){
 const mgr=role!=='employee';
 return `<h1>${t('dashT')}</h1><p class="muted">${t('welcome')}</p>
 <div class="metrics">
   ${mgr?`<div class="metric"><div class="muted">${t('dashReqCard')}</div><div class="v">3</div></div>
   <div class="metric"><div class="muted">${t('dashTimeCard')}</div><div class="v">2</div></div>`:''}
   <div class="metric"><div class="muted">${t('myPending')}</div><div class="v">2</div></div>
   <div class="metric"><div class="muted">${t('hoursWeek')}</div><div class="v">32.5</div></div>
   <div class="metric"><div class="muted">${t('openReq')}</div><div class="v">4</div></div>
 </div>
 <div class="card"><h2>${t('reqTitle')}</h2>${reqTable(REQ.slice(0,3))}</div>`;
}
function reqTable(rows){
 return `<table class="resp"><thead><tr><th>${t('colType')}</th><th>${t('colSummary')}</th><th>${t('colStatus')}</th><th>${t('colSubmitted')}</th></tr></thead><tbody>
 ${rows.map(r=>`<tr><td data-th="${t('colType')}">${t(r.type)}</td><td data-th="${t('colSummary')}">${bdi(r.sum)}</td><td data-th="${t('colStatus')}">${badge(r.status)}</td><td data-th="${t('colSubmitted')}"><bdi>${r.sub}</bdi></td></tr>`).join('')}
 </tbody></table>`;
}
function requests(){return `<h1>${t('reqTitle')}</h1><div class="card"><button class="btn primary" id="newReq">${t('newReq')}</button><div style="margin-block-start:14px">${reqTable(paged('requests',REQ,3))}${pager('requests',REQ.length,3)}</div></div>`}
function reqform(){
 return `<h1>${t('formTitle')}</h1><div class="card">
 <div class="errsummary" role="alert" tabindex="-1"><strong>${t('errSummary')}</strong></div>
 <div class="field"><label for="ftype">${t('type')} <span class="req">*</span></label>
   <select id="ftype" aria-invalid="true" aria-describedby="e1"><option></option>
   <option>${t('leave')}</option><option>${t('equipment')}</option><option>${t('hrservice')}</option><option>${t('wfh')}</option><option>${t('general')}</option></select>
   <div class="errtext" id="e1">${t('errType')}</div></div>
 <div class="field"><label for="fsum">${t('summary')} <span class="req">*</span></label>
   <input id="fsum" aria-invalid="true" aria-describedby="e2"><div class="errtext" id="e2">${t('errSum')}</div></div>
 <div class="field"><label for="fdet">${t('details')}</label><textarea id="fdet" rows="4"></textarea></div>
 <div class="field"><label for="fatt">${t('attach')}</label><input id="fatt" type="file"><div class="muted">PDF/PNG/JPEG — limits per policy</div></div>
 <button class="btn primary" id="submitBtn">${t('submit')}</button>
 <button class="btn secondary">${t('saveDraft')}</button>
 <button class="btn secondary">${t('cancel')}</button></div>`;
}
function reqdetail(){
 return `<h1>${t('reqTitle')} — ${t('equipment')}</h1>
 <div class="banner info">↩ ${t('retBanner')}</div>
 <div class="grid2"><div class="card"><h2>${bdi('New monitor — second screen')}</h2>
 <p class="muted">${t('colSubmitted')}: <bdi>20 Sep</bdi> · ${badge('returned')}</p>
 <p>Current monitor flickers during meetings; requesting a standard 24" replacement.</p>
 <button class="btn primary">${t('resubmit')}</button></div>
 <div class="card"><h2>${t('viewHist')}</h2><ul class="timeline">
 <li><bdi>Mariam Adel</bdi> — ${t('draft')} · <bdi>${t('ago2d')}</bdi></li>
 <li><bdi>Mariam Adel</bdi> — ${t('pending')} · <bdi>${t('ago2d')}</bdi></li>
 <li><bdi>Khaled Fathy</bdi> — ${t('returned')} · <bdi>${t('ago1d')}</bdi></li></ul></div></div>`;
}
function timesheet(){
 const days=['mon','tue','wed','thu','fri','sat','sun'];
 const rows=[['09:00','17:30','8.5'],['09:15','18:00','8.5'],['09:00','17:00','8'],['09:30','18:30','9'],['08:00','20:00','12 ⚠'],['','',''],['','','']];
 const week=WEEKS.find(w=>w.week===selectedWeek),past=week.week!==38; // demo: draft
 const pastRows=days.map((day,i)=>({day,minutes:i<5?Math.max(0,Math.min(480,week.minutes-i*480)):0}));
 return `<h1>${t('navTime')}</h1><div class="card"><div class="section-head"><h2>${t('weekLabel').replace('{week}',fmt(week.week)).replace('{date}',week.date)} ${badge(week.status)}</h2>${past?`<button type="button" class="btn secondary" id="currentWeek">${t('backCurrent')}</button>`:''}</div>
 ${past?`<p class="banner info">${t('historicalNote')}</p><table class="resp"><thead><tr><th>${t('day')}</th><th>${t('dur')}</th></tr></thead><tbody>${pastRows.map(r=>`<tr><td data-th="${t('day')}">${t(r.day)}</td><td data-th="${t('dur')}">${fmt(r.minutes/60)} ${t('hrs')}</td></tr>`).join('')}</tbody></table>`:
 `<div class="banner warn">⚠ ${t('overlap')}</div><table class="resp"><thead><tr><th>${t('day')}</th><th>${t('start')}</th><th>${t('end')}</th><th>${t('dur')}</th><th>${t('note')}</th></tr></thead><tbody>
 ${rows.map((r,i)=>`<tr><td data-th="${t('day')}">${t(days[i])}</td><td data-th="${t('start')}"><input aria-label="${t('start')} ${t(days[i])}" value="${r[0]}" size="5"></td><td data-th="${t('end')}"><input aria-label="${t('end')} ${t(days[i])}" value="${r[1]}" size="5"></td><td data-th="${t('dur')}"><bdi>${r[2]}</bdi></td><td data-th="${t('note')}"><input aria-label="${t('note')} ${t(days[i])}" size="12"></td></tr>`).join('')}
 </tbody></table><button type="button" class="btn primary" id="submitWeekDemo">${t('submitWeek')}</button>`}
 <p><strong>${t('weekTotal')}:</strong> <bdi>${fmt(week.minutes/60)} ${t('hrs')}</bdi></p><h2>${t('viewHist')}</h2><ul class="timeline">${week.events.map(event=>`<li>${badge(event)}</li>`).join('')}</ul></div>
 <div class="card"><h2>${t('previousWeeks')}</h2><table class="resp"><thead><tr><th>${t('previousWeeks')}</th><th>${t('colStatus')}</th><th>${t('weekTotal')}</th><th></th></tr></thead><tbody>
 ${paged('weeks',WEEKS.slice(1),3).map(w=>`<tr><td data-th="${t('previousWeeks')}">${t('weekLabel').replace('{week}',fmt(w.week)).replace('{date}',w.date)}</td><td data-th="${t('colStatus')}">${badge(w.status)}</td><td data-th="${t('weekTotal')}">${fmt(w.minutes/60)} ${t('hrs')}</td><td><button class="btn secondary" type="button" data-week="${w.week}">${t('viewWeek')}</button></td></tr>`).join('')}</tbody></table>${pager('weeks',WEEKS.length-1,3)}</div>`;
}
function notifications(){
 const items=visibleNotifs();
 return `<h1>${t('notifT')}</h1><div class="card"><table class="resp"><thead><tr><th>${t('colSummary')}</th><th>${t('colStatus')}</th><th></th></tr></thead><tbody>
 ${paged('notifications',items,2).map(n=>`<tr><td data-th="${t('colSummary')}">${t(n.text)}</td><td data-th="${t('colStatus')}"><span class="badge ${n.read?'draft':'pending'}">${n.read?'✓':'●'} ${t(n.read?'read':'unread')}</span></td><td>${n.read?'':`<button class="btn secondary" type="button" data-notif-read="${n.id}">${t('markRead')}</button>`} <button class="btn secondary" type="button" data-notif-open="${n.id}">${t('notifOpen')}</button></td></tr>`).join('')}
 </tbody></table>${pager('notifications',items.length,2)}</div>`;
}
function reviewq(){
 return `<h1>${t('queueT')}</h1><div class="card"><table class="resp"><thead><tr><th>${t('colFrom')}</th><th>${t('colItem')}</th><th>${t('colAge')}</th><th>${t('colStatus')}</th><th></th></tr></thead><tbody>
 ${paged('reviewq',QUEUE,2).map(q=>`<tr><td data-th="${t('colFrom')}"><bdi>${q.f}</bdi></td><td data-th="${t('colItem')}">${bdi(q.i)}</td><td data-th="${t('colAge')}"><bdi>${q.a}</bdi></td><td data-th="${t('colStatus')}">${badge(q.s)}</td><td><button class="btn secondary" data-open="reviewitem">${t('notifOpen')}</button></td></tr>`).join('')}
 </tbody></table>${pager('reviewq',QUEUE.length,2)}</div>`;
}
function reviewitem(){
 const own=false;
 return `<h1>${t('queueT')} — ${t('leave')}</h1>
 ${own?`<div class="banner info">${t('selfNote')}</div>`:''}
 <div class="grid2"><div class="card"><h2>${bdi('Annual leave 5–9 Oct')}</h2>
 <p class="muted">${t('colFrom')}: <bdi>Mariam Adel</bdi> · ${t('ago2d')} · ${badge('pending')}</p>
 <p>Family trip planned for the national holiday week; coverage arranged with Omar.</p>
 <div class="field"><label>${t('reasonPh').replace('…','')}</label><input id="reason" placeholder="${t('reasonPh')}"></div>
 ${own?'':`<button class="btn primary" data-act="approve">${t('approve')}</button>
 <button class="btn secondary" data-act="return">${t('return')}</button>
 <button class="btn danger" data-act="reject">${t('reject')}</button>`}</div>
 <div class="card"><h2>${t('viewHist')}</h2><ul class="timeline">
 <li><bdi>Mariam Adel</bdi> — ${t('pending')} · <bdi>${t('ago2d')}</bdi></li></ul></div></div>`;
}
function teamtime(){
 return `<h1>${t('teamT')}</h1><div class="card"><table class="resp"><thead><tr><th>${t('colMember')}</th><th>${t('colHours')}</th><th>${t('colStatusT')}</th></tr></thead><tbody>
 ${paged('teamtime',TEAM,2).map(x=>`<tr><td data-th="${t('colMember')}"><bdi>${x.m}</bdi></td><td data-th="${t('colHours')}"><bdi>${x.h}</bdi></td><td data-th="${t('colStatusT')}">${badge(x.s)}</td></tr>`).join('')}
 </tbody></table>${pager('teamtime',TEAM.length,2)}</div>`;
}
function employees(){
 const rows=paged('employees',EMPS,3);
 return `<h1>${t('empT')}</h1><div class="card"><button type="button" class="btn primary" id="addEmployee">${t('addEmployee')}</button><table class="resp"><thead><tr><th>${t('colName')}</th><th>${t('empEmail')}</th><th>${t('colRole')}</th><th>${t('colManager')}</th><th>${t('colAcct')}</th><th></th></tr></thead><tbody>
 ${rows.map(e=>`<tr><td data-th="${t('colName')}"><bdi>${esc(e.n)}</bdi></td><td data-th="${t('empEmail')}"><bdi>${esc(e.email)}</bdi></td><td data-th="${t('colRole')}">${t(e.r)}</td><td data-th="${t('colManager')}"><bdi>${esc(e.m)}</bdi></td><td data-th="${t('colAcct')}"><span class="badge ${e.a?'approved':'draft'}">${t(e.a?'active':'inactive')}</span></td><td><button class="btn secondary" type="button" data-edit="${EMPS.indexOf(e)}">${t('editEmployee')}</button></td></tr>`).join('')}
 </tbody></table>${pager('employees',EMPS.length,3)}</div>`;
}
function types(){
 const rows=[['leave','dates + balance note'],['equipment','item, quantity, justification'],['hrservice','service type, documents'],['wfh','days, coverage plan'],['general','summary, details']];
 return `<h1>${t('typesT')}</h1><div class="card"><table class="resp"><thead><tr><th>${t('colType')}</th><th>${t('reqFields')}</th><th>${t('attachments')}</th></tr></thead><tbody>
 ${rows.map(r=>`<tr><td data-th="${t('colType')}">${t(r[0])}</td><td data-th="${t('reqFields')}">${r[1]}</td><td data-th="${t('attachments')}">PDF/PNG/JPEG</td></tr>`).join('')}
 </tbody></table></div>`;
}
function reports(){
 const rows=REPORTS.filter(r=>(!reportFilters.month||r.month===reportFilters.month)&&(!reportFilters.employee||r.n===reportFilters.employee)&&(!reportFilters.status||r.status===reportFilters.status));
 const total=rows.reduce((sum,r)=>sum+r.requests,0),hours=rows.reduce((sum,r)=>sum+r.minutes,0)/60;
 const statuses=['pending','approved','returned','rejected'];
 return `<h1>${t('repT')}</h1><p class="muted">${t('repScope')}</p>
 <div class="card"><div class="filter-row">
 <label class="ctl">${t('repMonth')}<select id="reportMonth"><option value="">${t('all')}</option>${['2026-09','2026-08'].map(m=>`<option value="${m}" ${reportFilters.month===m?'selected':''}>${m}</option>`).join('')}</select></label>
 <label class="ctl">${t('repEmployee')}<select id="reportEmployee"><option value="">${t('all')}</option>${[...new Set(REPORTS.map(r=>r.n))].map(n=>`<option value="${esc(n)}" ${reportFilters.employee===n?'selected':''}>${esc(n)}</option>`).join('')}</select></label>
 <label class="ctl">${t('repStatus')}<select id="reportStatus"><option value="">${t('all')}</option>${statuses.map(s=>`<option value="${s}" ${reportFilters.status===s?'selected':''}>${t(s)}</option>`).join('')}</select></label></div></div>
 <div class="metrics"><div class="metric"><div class="muted">${t('repTotal')}</div><div class="v">${fmt(total)}</div></div><div class="metric"><div class="muted">${t('repHours')}</div><div class="v">${fmt(hours)} ${t('hrs')}</div></div><div class="metric"><div class="muted">${t('repEmployee')}</div><div class="v">${fmt(new Set(rows.map(r=>r.n)).size)}</div></div></div>
 <div class="grid2"><div class="card"><h2>${t('repByStatus')}</h2>${statuses.map(s=>{const n=rows.filter(r=>r.status===s).reduce((sum,r)=>sum+r.requests,0);return `<div class="bar-row"><span>${t(s)}</span><div class="bar-track"><span style="width:${total?100*n/total:0}%"></span></div><strong>${fmt(n)}</strong></div>`}).join('')}</div>
 <div class="card"><h2>${t('repSummary')}</h2><p class="muted">${t('repScope')}</p><button class="btn secondary" type="button" id="reportExport" ${rows.length?'':'disabled'}>${t('exportBtn')}</button></div></div>
 <div class="card"><h2>${t('repSummary')}</h2>${rows.length?`<table class="resp"><thead><tr><th>${t('repMonth')}</th><th>${t('repEmployee')}</th><th>${t('repStatus')}</th><th>${t('repCount')}</th><th>${t('repHoursCol')}</th></tr></thead><tbody>${paged('reports',rows,3).map(r=>`<tr><td data-th="${t('repMonth')}"><bdi>${r.month}</bdi></td><td data-th="${t('repEmployee')}"><bdi>${esc(r.n)}</bdi></td><td data-th="${t('repStatus')}">${badge(r.status)}</td><td data-th="${t('repCount')}">${fmt(r.requests)}</td><td data-th="${t('repHoursCol')}">${fmt(r.minutes/60)} ${t('hrs')}</td></tr>`).join('')}</tbody></table>${pager('reports',rows.length,3)}`:`<p class="empty">${t('reportEmpty')}</p>`}</div>`;
}
const TPL={dashboard,requests,reqform,reqdetail,timesheet,notifications,reviewq,reviewitem,teamtime,employees,types,reports};

function renderNotifPanel(){
 const items=visibleNotifs(),count=items.filter(n=>!n.read).length;
 const toggle=document.getElementById('notif-toggle');
 toggle.setAttribute('aria-label',notifLabel('notifButton',count));
 const badge=document.getElementById('notif-count');
 badge.textContent=new Intl.NumberFormat(lang).format(count);
 badge.classList.toggle('hidden',!count);
 document.getElementById('notif-heading').textContent=t('notifT');
 document.getElementById('notif-summary').textContent=notifLabel('notifSummary',count);
 document.getElementById('notif-all').textContent=t('notifAll');
 document.getElementById('notif-list').innerHTML=items.length?items.map(n=>`<div class="notif-entry ${n.read?'':'unread'}">
 <p>${t(n.text)}</p><span class="muted">${t(n.time)} · ${t(n.read?'read':'unread')}</span>
 <div><button type="button" data-notif-open="${n.id}">${t('notifOpen')}</button>${n.read?'':` · <button type="button" data-notif-read="${n.id}">${t('markRead')}</button>`}</div>
 </div>`).join(''):`<p class="notif-empty muted">${t('notifNone')}</p>`;
}
function closeNotif(restoreFocus=false){
 const toggle=document.getElementById('notif-toggle');
 document.getElementById('notif-panel').classList.add('hidden');
 toggle.setAttribute('aria-expanded','false');
 if(restoreFocus)toggle.focus();
}
function render(){
 const list=screens[role];
 if(!list.includes(cur))cur='dashboard';
 const sel=document.getElementById('screen');
 sel.innerHTML=list.map(s=>`<option value="${s}" ${s===cur?'selected':''}>${t(screenNames[s])}</option>`).join('');
 document.querySelectorAll('.navitem,.navgroup').forEach(el=>{
   const n=el.dataset.nav;
   if(el.classList.contains('navgroup')){el.classList.toggle('hidden',!(
      (el.classList.contains('mgr')&&role!=='employee')||(el.classList.contains('hr')&&role==='hr')));return}
   const isMgr=n==='reviewq'||n==='reviewitem'||n==='teamtime';
   const isHr=n==='employees'||n==='types'||n==='reports';
   el.classList.toggle('hidden',isMgr?role==='employee':isHr?role!=='hr':false);
   el.classList.toggle('active',n===cur);
 });
 const stage=document.getElementById('stage');
 stage.className='stage w'+width;
 let inner=TPL[cur]();
 if(state==='loading')inner=tplLoading();
 else if(state==='empty')inner=tplEmpty();
 else if(state==='expired')inner=tplExpired();
 else if(state==='forbidden')inner=tplForbidden();
 else if(state==='error')inner=tplError(inner);
 else if(state==='conflict')inner=tplConflict(inner);
 stage.innerHTML=inner;
 // controls
 document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));
 document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';
 document.getElementById('lang').textContent=lang==='en'?'العربية':'English';
 const wm=document.getElementById('wordmark');wm.textContent=lang==='en'?'Daimoma':'ديمومة';wm.lang=lang;
 renderNotifPanel();
 document.querySelector('.notif-shell').hidden=state==='expired';
 const sel3=document.getElementById('state');[...sel3.options].forEach(o=>o.textContent=t(o.value));
 document.querySelectorAll('.navitem').forEach(a=>a.onclick=e=>{e.preventDefault();closeNotif();cur=a.dataset.nav;render()});
 sel.onchange=()=>{closeNotif();cur=sel.value;render()};
 const nr=document.getElementById('newReq');if(nr)nr.onclick=()=>{cur='reqform';render()};
 ['Month','Employee','Status'].forEach(name=>{const input=document.getElementById('report'+name);if(input)input.onchange=()=>{reportFilters[name.toLowerCase()]=input.value;pages.reports=1;render();document.getElementById('report'+name)?.focus()}});
 const exportButton=document.getElementById('reportExport');if(exportButton)exportButton.onclick=()=>toast(t('repExportNote'));
 document.querySelectorAll('[data-page]').forEach(button=>button.onclick=()=>{pages[button.dataset.page]+=Number(button.dataset.step);render();document.querySelector(`[data-page="${button.dataset.page}"][data-step="${button.dataset.step}"]:not([disabled])`)?.focus()});
 document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{cur=b.dataset.open;render()});
 document.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>{
   if(b.dataset.act!=='approve'&&!document.getElementById('reason').value){toast(t('reasonReq'));return}
   if(b.dataset.act==='approve'&&!confirm(t('confirmApprove')))return;
   toast(t('toast'+b.dataset.act.charAt(0).toUpperCase()+b.dataset.act.slice(1)));
 });
 const addEmployee=document.getElementById('addEmployee');if(addEmployee)addEmployee.onclick=()=>openEmployeeDlg();
 document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEmployeeDlg(Number(b.dataset.edit)));
 document.querySelectorAll('[data-week]').forEach(b=>b.onclick=()=>{selectedWeek=Number(b.dataset.week);render();document.getElementById('main').focus()});
 const currentWeek=document.getElementById('currentWeek');if(currentWeek)currentWeek.onclick=()=>{selectedWeek=38;render();document.getElementById('main').focus()};
 const submitWeekDemo=document.getElementById('submitWeekDemo');if(submitWeekDemo)submitWeekDemo.onclick=()=>toast(t('submitDemo'));
}
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),3500)}
let dlg;
function openEmployeeDlg(index=null){
 const employee=index===null?null:EMPS[index];
 if(!dlg){dlg=document.createElement('dialog');document.body.appendChild(dlg)}
 const soleHr=employee?.r==='roleHr'&&EMPS.filter(e=>e.r==='roleHr'&&e.a).length===1;
 const managers=EMPS.filter(e=>e!==employee&&e.a&&['roleMgr','roleHr'].includes(e.r));
 dlg.innerHTML=`<form id="employeeForm" novalidate><h2>${t(employee?'editEmployee':'addEmployee')}</h2>
 <p class="muted">${t('ribbon')}</p><p id="employeeError" class="errtext hidden" role="alert" tabindex="-1"></p>
 <div class="field"><label for="empName">${t('colName')}</label><input id="empName" name="name" required value="${esc(employee?.n||'')}"></div>
 <div class="field"><label for="empEmail">${t('empEmail')}</label><input id="empEmail" name="email" type="email" required value="${esc(employee?.email||'')}"></div>
 <div class="field"><label for="empDepartment">${t('empDepartment')}</label><input id="empDepartment" name="department" required value="${esc(employee?.d||'')}"></div>
 <div class="field"><label for="empRole">${t('colRole')}</label><select id="empRole" name="role" ${soleHr?'disabled':''}>${['roleEmp','roleMgr','roleHr'].map(r=>`<option value="${r}" ${employee?.r===r?'selected':''}>${t(r)}</option>`).join('')}</select></div>
 <div class="field"><label for="empManager">${t('colManager')}</label><select id="empManager" name="manager"><option value="">—</option>${managers.map(e=>`<option value="${esc(e.n)}" ${employee?.m===e.n?'selected':''}>${esc(e.n)}</option>`).join('')}</select></div>
 <div class="field"><label for="empStatus">${t('empStatus')}</label><select id="empStatus" name="status" ${soleHr?'disabled':''}><option value="1" ${employee?.a!==0?'selected':''}>${t('active')}</option><option value="0" ${employee?.a===0?'selected':''}>${t('inactive')}</option></select></div>
 ${soleHr?`<p class="banner info">${t('lastHr')}</p>`:''}
 <div class="modal-actions"><button class="btn primary" type="submit">${t('saveEmployee')}</button><button class="btn secondary" type="button" id="cancelEmployee">${t('cancel')}</button></div></form>`;
 const trigger=document.activeElement;
 dlg.showModal();dlg.querySelector('#empName').focus();
 dlg.querySelector('#cancelEmployee').onclick=()=>dlg.close();
 dlg.onclose=()=>trigger?.isConnected&&trigger.focus();
 dlg.querySelector('#employeeForm').onsubmit=e=>{
  e.preventDefault();
  const form=e.currentTarget, name=form.elements.namedItem('name').value.trim(),email=form.elements.namedItem('email').value.trim().toLowerCase();
  const error=dlg.querySelector('#employeeError');
  if(!name||!form.elements.namedItem('department').value.trim()||!form.checkValidity()||EMPS.some((person,i)=>i!==index&&person.email===email)){
    error.textContent=t('empValidation');error.classList.remove('hidden');error.focus();return;
  }
  const manager=form.elements.namedItem('manager').value||'—';
  if(employee&&manager!==employee.m&&!confirm(t('mgrWarn')))return;
  const updated={n:name,email,d:form.elements.namedItem('department').value.trim(),r:soleHr?employee.r:form.elements.namedItem('role').value,m:manager,a:soleHr?employee.a:Number(form.elements.namedItem('status').value)};
  if(employee)EMPS[index]=updated;else EMPS.push(updated);
  dlg.close();render();document.querySelector(employee?`[data-edit="${index}"]`:'#addEmployee')?.focus();toast(t(employee?'empSaved':'empCreated'));
 };
}
const notifToggle=document.getElementById('notif-toggle');
const notifPanel=document.getElementById('notif-panel');
notifToggle.onclick=()=>{
 const opening=notifPanel.classList.contains('hidden');
 notifPanel.classList.toggle('hidden',!opening);
 notifToggle.setAttribute('aria-expanded',String(opening));
 if(opening){notifPanel.style.setProperty('--notif-top',`${Math.round(notifToggle.getBoundingClientRect().bottom+8)}px`);notifPanel.querySelector('button')?.focus();}
};
document.getElementById('notif-all').onclick=()=>{closeNotif();cur='notifications';state='normal';render();document.getElementById('main').focus()};
document.addEventListener('click',e=>{
 const readButton=e.target.closest('[data-notif-read]');
 const openButton=e.target.closest('[data-notif-open]');
 if(readButton){
   const n=visibleNotifs().find(item=>item.id===readButton.dataset.notifRead);
   if(!n)return;
   n.read=true;render();
   if(!notifPanel.classList.contains('hidden'))notifPanel.querySelector(`[data-notif-open="${n.id}"]`)?.focus();
   else document.querySelector(`#stage [data-notif-open="${n.id}"]`)?.focus();
 }else if(openButton){
   const n=visibleNotifs().find(item=>item.id===openButton.dataset.notifOpen);
   if(!n)return;
   n.read=true;closeNotif();cur=n.screen;state='normal';render();document.getElementById('main').focus();
 }else if(!e.target.closest('.notif-shell'))closeNotif();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!notifPanel.classList.contains('hidden')){e.preventDefault();closeNotif(true)}});
document.addEventListener('focusin',e=>{if(!notifPanel.classList.contains('hidden')&&!e.target.closest('.notif-shell'))closeNotif()});
document.getElementById('role').onchange=e=>{closeNotif();role=e.target.value;render()};
document.getElementById('state').onchange=e=>{closeNotif();state=e.target.value;render()};
document.getElementById('width').onchange=e=>{closeNotif();width=e.target.value;render()};
document.getElementById('lang').onclick=()=>{lang=lang==='en'?'ar':'en';render()};
render();
