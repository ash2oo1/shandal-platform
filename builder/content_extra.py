# -*- coding: utf-8 -*-
def L(en, ar):
    return {'en': en, 'ar': ar}

AI = {
 'btn': L('Ask Shandal AI', 'اسأل مساعد شندل'),
 'title': L('Shandal AI assistant', 'مساعد شندل الذكي'),
 'sub': L('Geology, remote sensing, engineering', 'جيولوجيا، تحسس نائي، هندسة'),
 'hello': L('Hello. Ask me about geology, remote sensing, field methods, or how to use any tool in the system.', 'مرحباً. اسألني عن الجيولوجيا أو التحسس النائي أو طرق العمل الميداني أو طريقة استخدام أي أداة في النظام.'),
 'sugg': [L('How do I read a stereonet?', 'كيف أقرأ المسقط الستيريوغرافي؟'), L('What does RMR 45 mean for a slope?', 'ماذا يعني RMR = 45 لمنحدر؟'), L('Which contour interval suits 1:25,000?', 'ما الفاصل الكنتوري المناسب لمقياس 1:25,000؟')],
 'ph': L('Type a geology question…', 'اكتب سؤالك الجيولوجي…'),
 'send': L('Send', 'إرسال'),
 'wait': L('Thinking…', 'جارٍ التفكير…'),
 'fail': L('The assistant could not be reached. Check your connection and try again.', 'تعذر الوصول إلى المساعد. تحقق من اتصالك وحاول مجدداً.'),
 'note': L('AI answers can be wrong. Check important results against the method on each tool page.', 'قد تخطئ إجابات الذكاء الاصطناعي. راجع النتائج المهمة مقابل المنهجية في صفحة كل أداة.'),
}

PLATFORM = {
 'title': L('Platform — {N} tools for geology, engineering and the environment', 'المنصة — {N} أداة للجيولوجيا والهندسة والبيئة'),
 'h': L('Twenty-seven tools, from the outcrop to the lab', 'سبع وعشرون أداة، من المكشف إلى المختبر'),
 'p': L('Each tool has its own page: what you enter, what you get, the equations behind it and the standards it follows.', 'لكل أداة صفحتها: ما تدخله، وما تحصل عليه، والمعادلات خلفها، والمعايير التي تتبعها.'),
}

DATA = {
 'title': L('Data hub — open global data for field science', 'مركز البيانات — بيانات عالمية مفتوحة للعلوم الميدانية'),
 'h': L('Open data for any site on Earth', 'بيانات مفتوحة لأي موقع على الأرض'),
 'p': L('The platform connects to international scientific services for elevation, weather, air quality, the geomagnetic field and natural hazards.', 'ترتبط المنصة بخدمات علمية دولية للارتفاعات والطقس وجودة الهواء والمجال المغناطيسي والمخاطر الطبيعية.'),
 'src_k': L('Sources', 'المصادر'), 'src_h': L('Where the numbers come from', 'من أين تأتي الأرقام'),
 'src_p': L('Every source is cited in the tool that uses it. Planned sources are on the development roadmap.', 'كل مصدر مذكور في الأداة التي تستخدمه، والمصادر المخططة ضمن خطة التطوير.'),
 'th1': L('Data', 'البيانات'), 'th2': L('Provider', 'المزوّد'), 'th3': L('Used for', 'الاستخدام'), 'th4': L('Status', 'الحالة'),
 'use_k': L('Put it to work', 'وظّفها'), 'use_h': L('What you can do with it', 'ماذا يمكنك أن تفعل بها'),
 'uses': [
   ('database', L('Download elevation grids', 'نزّل شبكات الارتفاع'), L('Draw a rectangle anywhere and export X, Y, Z points.', 'ارسم مستطيلاً في أي مكان وصدّر نقاط X وY وZ.'), 'tools/dem-studio/'),
   ('cloud-rain', L('Test landslide thresholds', 'اختبر عتبات الانزلاق'), L('Run rainfall history against the Caine curve for any coordinate.', 'قارن سجل الأمطار بمنحنى Caine لأي إحداثيات.'), 'tools/hydro-alert/'),
   ('magnet', L('Reduce magnetic data', 'صحّح البيانات المغناطيسية'), L('Fetch the IGRF reference field over your survey grid.', 'اجلب المجال المرجعي IGRF لشبكة مسحك.'), 'tools/magnetic-lab/'),
   ('thermometer-sun', L('Plan safe field days', 'خطط لأيام ميدانية آمنة'), L('Heat stress, air quality and UV before the team sets out.', 'الإجهاد الحراري وجودة الهواء والأشعة قبل خروج الفريق.'), 'tools/env-monitoring/'),
   ('activity', L('Watch seismic activity', 'راقب النشاط الزلزالي'), L('Live earthquakes of magnitude 4.5 and above, worldwide.', 'الزلازل اللحظية بقدر 4.5 فأكثر حول العالم.'), 'earth-now/'),
   ('satellite', L('Track environmental change', 'تتبّع التغير البيئي'), L('Compare vegetation and water indices between two dates.', 'قارن مؤشرات النبات والمياه بين تاريخين.'), 'tools/spectral-indices/'),
 ],
 'lic': L('Each provider sets its own terms. Map tiles and data are shown with their attribution, and commercial use follows the provider’s licence.', 'لكل مزوّد شروطه. تُعرض الخرائط والبيانات مع ذكر مصدرها، ويخضع الاستخدام التجاري لترخيص المزوّد.'),
}

EARTH = {
 'title': L('Earth now — live earthquakes and natural events', 'الأرض الآن — الزلازل والأحداث الطبيعية لحظياً'),
 'h': L('Earth now', 'الأرض الآن'),
 'p': L('Earthquakes of magnitude 4.5 and above over the last seven days, and open natural events tracked by NASA. Updated every time you open the page.', 'الزلازل بقدر 4.5 فأكثر خلال الأيام السبعة الأخيرة، والأحداث الطبيعية الجارية التي ترصدها ناسا. تُحدّث في كل مرة تفتح فيها الصفحة.'),
 'q_count': L('earthquakes M4.5+ this week', 'زلزالاً بقدر 4.5+ هذا الأسبوع'), 'q_max': L('largest this week', 'الأكبر هذا الأسبوع'),
 'q_near': L('in Iraq and neighbouring region', 'في العراق والمنطقة المحيطة'), 'q_deep': L('deepest focus', 'أعمق بؤرة'),
 'last7': L('last 7 days', 'آخر 7 أيام'), 'q_h': L('Latest earthquakes', 'أحدث الزلازل'), 'e_h': L('Open natural events', 'أحداث طبيعية جارية'),
 'fail': L('The live feed could not be loaded. Check your connection and refresh the page.', 'تعذر تحميل البث المباشر. تحقق من اتصالك وأعد تحميل الصفحة.'),
 'attrib': L('Earthquake data: U.S. Geological Survey, Earthquake Hazards Program. Natural events: NASA Earth Observatory Natural Event Tracker (EONET). Times in UTC.', 'بيانات الزلازل: هيئة المسح الجيولوجي الأمريكية USGS. الأحداث الطبيعية: متتبع الأحداث الطبيعية لمرصد الأرض في ناسا EONET. الأوقات بالتوقيت العالمي.'),
}

HERITAGE = {
 'title': L('Geo-heritage atlas — geosites and archaeological landmarks', 'أطلس التراث الجيولوجي — المواقع الجيولوجية والمعالم الآثارية'),
 'h': L('Geo-heritage atlas', 'أطلس التراث الجيولوجي'),
 'p': L('Monuments read through the ground they stand on: the rock, the setting and the age of each site.', 'قراءة المعالم من خلال الأرض التي تقوم عليها: الصخر والبيئة والعمر لكل موقع.'),
 'map_t': L('Documented sites, Iraq', 'المواقع الموثقة، العراق'),
 'why_h': L('Geology is half of every heritage site', 'الجيولوجيا نصف كل موقع تراثي'),
 'why_p': L('Building stone, groundwater, river terraces and tectonics decided where people settled and how their monuments survived. The atlas records both sides for each site, with photos, era filters and directions.', 'حجر البناء والمياه الجوفية ومصاطب الأنهار والتكتونية حددت أين استقر الناس وكيف صمدت معالمهم. يوثّق الأطلس الجانبين لكل موقع، مع الصور وفلترة الحقب والاتجاهات.'),
 'open_atlas': L('Open the interactive atlas', 'افتح الأطلس التفاعلي'),
 'rock': L('Material', 'المادة'), 'setting': L('Setting', 'البيئة'), 'age': L('Ground', 'الأرضية'),
 'more_h': L('More sites in the atlas', 'مواقع أخرى في الأطلس'),
}

ACADEMY = {
 'title': L('Shandal Academy — courses for Earth scientists', 'أكاديمية شندل — دورات لعلماء الأرض'),
 'h': L('Shandal Academy', 'أكاديمية شندل'),
 'p': L('Practical courses in field geology, remote sensing, engineering geology and petroleum geochemistry, taught with the platform’s tools.', 'دورات تطبيقية في الجيولوجيا الميدانية والتحسس النائي والجيولوجيا الهندسية والجيوكيمياء البترولية، تُدرّس بأدوات المنصة.'),
 'cat_k': L('Course catalogue', 'دليل الدورات'), 'cat_h': L('Learn by doing the survey', 'تعلّم بإجراء المسح'),
 'cat_p': L('Courses open in stages. Register your interest and we tell you when enrolment opens.', 'تُفتح الدورات تباعاً. سجّل اهتمامك وسنخبرك عند فتح التسجيل.'),
 'join': L('Ask to join', 'اطلب الانضمام'),
 'cert_h': L('Certificates anyone can verify', 'شهادات يمكن لأي جهة التحقق منها'),
 'cert_p': L('Every certificate carries a unique code and QR. Employers and universities check it on the verification page.', 'تحمل كل شهادة رمزاً فريداً ورمز QR، وتتحقق منها جهات العمل والجامعات عبر صفحة التحقق.'),
 'cert_list': [L('Unique certificate number', 'رقم شهادة فريد'), L('QR code linked to the record', 'رمز QR مرتبط بالسجل'), L('Course, hours and date on record', 'الدورة والساعات والتاريخ في السجل')],
 'cert_mock_t': L('Certificate of completion', 'شهادة إتمام'), 'cert_mock_n': L('Digital field geology', 'الجيولوجيا الميدانية الرقمية'), 'cert_mock_c': L('Shandal Training & Development', 'شندل للتدريب والتطوير'),
}

LIBRARY = {
 'title': L('Library and journal — publications of the Shandal System', 'المكتبة والمجلة — إصدارات نظام شندل'),
 'h': L('Library and journal', 'المكتبة والمجلة'),
 'p': L('Booklets, field guides and a bulletin of field studies from the Shandal team and contributors.', 'كتيبات وأدلة ميدانية ونشرة للدراسات الحقلية من فريق شندل والمساهمين.'),
 'books_k': L('Publications', 'الإصدارات'), 'books_h': L('From the Shandal team', 'من فريق شندل'),
 'request': L('Request a copy', 'اطلب نسخة'),
 'j_k': L('Journal', 'المجلة'), 'j_h': L('Shandal Field Notes', 'دفاتر شندل الميدانية'),
 'j_p': L('A bulletin for short field studies, technical notes and case reports from geologists and engineers. We are accepting proposals for the first issue.', 'نشرة للدراسات الحقلية القصيرة والملاحظات التقنية والحالات التطبيقية من الجيولوجيين والمهندسين. نستقبل مقترحات العدد الأول.'),
 'j_list': [L('Field studies and case reports', 'دراسات حقلية وحالات تطبيقية'), L('Technical notes on methods and tools', 'ملاحظات تقنية في الطرق والأدوات'), L('Arabic and English', 'بالعربية والإنجليزية')],
 'j_cta': L('Propose an article', 'اقترح مقالاً'),
 'pol_h': L('What we publish', 'ما ننشره'),
 'pol_p': L('The library hosts only original work by its authors or material released under an open licence. We do not host copies of commercially published books.', 'تستضيف المكتبة الأعمال الأصلية لأصحابها أو المواد المنشورة بترخيص مفتوح فقط، ولا تستضيف نسخاً من الكتب المنشورة تجارياً.'),
}

PRICING = {
 'title': L('Pricing — Shandal System subscriptions', 'الاشتراكات — نظام شندل'),
 'h': L('One subscription, every tool', 'اشتراك واحد، كل الأدوات'),
 'p': L('All {N} tools, report export and the AI assistant on phone, tablet and desktop.', 'جميع الأدوات ({N} أداة) وتصدير التقارير والمساعد الذكي على الهاتف والجهاز اللوحي والحاسوب.'),
 'best': L('Best value', 'الأوفر'), 'subscribe': L('Subscribe', 'اشترك'),
 'wa_msg': L('Hello, I would like to subscribe to the Shandal System', 'مرحباً، أرغب بالاشتراك في نظام شندل'),
 'inst_h': L('Universities, companies and government teams', 'الجامعات والشركات والفرق الحكومية'),
 'inst_p': L('Several accounts, onboarding and training for your team, with invoicing.', 'عدة حسابات وتهيئة وتدريب لفريقك، مع فواتير رسمية.'),
 'inst_cta': L('Talk to us', 'تحدث إلينا'),
 'pay': L('Payment by ZainCash or Mastercard. Prices are in Iraqi dinar; international pricing is on the way.', 'الدفع عبر زين كاش أو ماستركارد. الأسعار بالدينار العراقي، والتسعير الدولي قادم.'),
 'faq_h': L('Questions', 'أسئلة شائعة'), 'faq_p': L('Anything else, ask us on WhatsApp.', 'لأي سؤال آخر، راسلنا على واتساب.'),
}

CONTACT = {
 'title': L('Contact the Shandal System', 'تواصل مع نظام شندل'),
 'h': L('Talk to the team', 'تحدّث مع الفريق'),
 'p': L('Subscriptions, institutional plans, training, partnerships and technical support.', 'الاشتراكات وخطط المؤسسات والتدريب والشراكات والدعم الفني.'),
 'name': L('Your name', 'الاسم'), 'org': L('Organisation (optional)', 'الجهة (اختياري)'), 'email': L('Email', 'البريد الإلكتروني'),
 'topic': L('Topic', 'الموضوع'), 'msg': L('Message', 'الرسالة'),
 'topics': [L('Subscription', 'اشتراك'), L('Institutional plan', 'خطة مؤسسات'), L('Training and courses', 'التدريب والدورات'), L('Partnership', 'شراكة'), L('Technical support', 'دعم فني'), L('Media', 'إعلام')],
 'send': L('Send on WhatsApp', 'أرسل عبر واتساب'),
 'note': L('Your message opens in WhatsApp, ready to send. Nothing is stored on this website.', 'تُفتح رسالتك في واتساب جاهزة للإرسال، ولا يُخزّن شيء على هذا الموقع.'),
 'sent': L('WhatsApp should have opened in a new tab. If it did not,', 'يُفترض أن يفتح واتساب في تبويب جديد. إن لم يحدث،'),
 'open_wa': L('open WhatsApp', 'افتح واتساب'),
 'copy_addr': L('Copy address', 'انسخ العنوان'), 'copied': L('Copied', 'تم النسخ'),
 'where_h': L('Where we are', 'موقعنا'), 'where_p': L('Baghdad, Iraq. We work with field teams in any country.', 'بغداد، العراق. نعمل مع الفرق الميدانية في أي بلد.'),
}

VERIFY = {
 'title': L('Verify a report or certificate', 'التحقق من تقرير أو شهادة'),
 'h': L('Verify a report or certificate', 'تحقق من تقرير أو شهادة'),
 'p': L('Every Shandal report and academy certificate carries a code and a QR. Enter the code to confirm it is genuine.', 'يحمل كل تقرير من نظام شندل وكل شهادة من الأكاديمية رمزاً ورمز QR. أدخل الرمز للتأكد من أصالته.'),
 'code': L('Report or certificate code', 'رمز التقرير أو الشهادة'), 'check': L('Check code', 'تحقق من الرمز'),
 'notice': L('Online verification opens with the new account system. Until then, send us the code and we confirm it within one working day:', 'يُفعّل التحقق الإلكتروني مع نظام الحسابات الجديد. حتى ذلك الحين، أرسل لنا الرمز ونؤكده خلال يوم عمل:'),
 'how_h': L('How verification works', 'كيف يعمل التحقق'),
 'how': [L('Scan the QR or type the code', 'امسح رمز QR أو اكتب الرمز'), L('We match it to the original record', 'نطابقه مع السجل الأصلي'), L('You see who issued it and when', 'ترى الجهة المُصدِرة والتاريخ')],
}

LOGIN = {
 'title': L('Sign in — Shandal System', 'تسجيل الدخول — نظام شندل'),
 'art_h': L('Welcome back to the field', 'أهلاً بعودتك إلى الحقل'),
 'art_p': L('Your surveys, reports and tools, on any device.', 'مسوحاتك وتقاريرك وأدواتك، على أي جهاز.'),
 'sub': L('Use the account details we sent when your subscription was activated.', 'استخدم بيانات الحساب التي أرسلناها عند تفعيل اشتراكك.'),
 'user': L('Full name or username', 'الاسم الثلاثي أو اسم المستخدم'), 'pass': L('Access code', 'رمز الدخول'),
 'busy': L('Checking your subscription…', 'جارٍ التحقق من اشتراكك…'),
 'ok': L('Signed in. Opening your workspace…', 'تم تسجيل الدخول. جارٍ فتح مساحة العمل…'),
 'device': L('Your session is tied to this device for security and lasts 24 hours.', 'ترتبط جلستك بهذا الجهاز للأمان وتستمر 24 ساعة.'),
 'signed': L('You are signed in as', 'أنت مسجل الدخول باسم'),
 'to_tools': L('Go to the tools', 'اذهب إلى الأدوات'),
 'no_acc': L('No account yet?', 'ليس لديك حساب؟'),
 'status': L('Check my subscription', 'تحقق من اشتراكي'),
 'status_msg': L('Hello, I would like to check the status of my Shandal System subscription. My name is: ', 'مرحباً، أرغب بالتحقق من حالة اشتراكي في نظام شندل. اسمي: '),
}

ACCOUNT = {
 'title': L('My account — Shandal System', 'حسابي — نظام شندل'),
 'h': L('My account', 'حسابي'), 'p': L('Your session, recent work and subscription.', 'جلستك وأعمالك الأخيرة واشتراكك.'),
 'none_h': L('You are not signed in', 'لم تسجّل الدخول'), 'none_p': L('Sign in with the name and access code we sent when your subscription was activated.', 'سجّل الدخول بالاسم ورمز الدخول اللذين أرسلناهما عند تفعيل اشتراكك.'),
 'session': L('Session', 'الجلسة'), 'name': L('Name', 'الاسم'), 'since': L('Signed in', 'تاريخ الدخول'), 'exp': L('Session ends', 'تنتهي الجلسة'), 'device': L('Device ID', 'معرّف الجهاز'),
 'recent': L('Recently opened workspaces', 'مساحات العمل المفتوحة مؤخراً'), 'recent_none': L('Workspaces you open will appear here.', 'ستظهر هنا مساحات العمل التي تفتحها.'),
 'data_h': L('Data stored in this browser', 'البيانات المخزنة في هذا المتصفح'), 'data_p': L('Inputs you type in the tools are kept only in this browser so you can continue later. Clearing them does not affect your subscription.', 'تُحفظ مدخلاتك في الأدوات في هذا المتصفح فقط لتكمل لاحقاً. مسحها لا يؤثر على اشتراكك.'),
 'clear_btn': L('Clear saved tool inputs', 'امسح مدخلات الأدوات المحفوظة'), 'cleared': L('Saved inputs cleared.', 'مُسحت المدخلات المحفوظة.'),
 'renew': L('Renew or upgrade by WhatsApp', 'جدّد أو رقِّ الاشتراك عبر واتساب'),
}

LEGAL_COMMON = {'updated': L('Last updated: October 2026', 'آخر تحديث: تشرين الأول 2026')}

PRIVACY = {
 'title': L('Privacy policy', 'سياسة الخصوصية'),
 'p': L('What we collect, why, and the choices you have.', 'ما نجمعه ولماذا، والخيارات المتاحة لك.'),
 'sections': [
  (L('Who we are', 'من نحن'), [L('The Shandal Geological Field Survey System (“Shandal”, “we”) is operated from Baghdad, Iraq by its founder, Ali Shandal Falah Al-Janabi. Contact: alishandal12@gmail.com.', 'يُدار نظام شندل للمسح الميداني الجيولوجي («شندل»، «نحن») من بغداد، العراق، من قبل مؤسسه علي شندل فلاح الجنابي. للتواصل: alishandal12@gmail.com.')]),
  (L('What we collect', 'ما نجمعه'), [L('Account details: your name and the access code issued with your subscription, and a random identifier stored on your device to keep you signed in.', 'بيانات الحساب: اسمك ورمز الدخول المرتبط باشتراكك، ومعرّف عشوائي يُحفظ على جهازك لإبقائك مسجلاً.'),
                                       L('Location: only when you use a tool that needs it, such as GPS capture or the seismic evaluation. We do not record your location when you sign in.', 'الموقع: فقط عند استخدامك أداة تحتاجه، مثل التقاط GPS أو التقييم الزلزالي. لا نسجّل موقعك عند تسجيل الدخول.'),
                                       L('Survey inputs: the values you enter are processed in your browser to produce results and reports.', 'مدخلات المسح: تُعالج القيم التي تدخلها في متصفحك لإنتاج النتائج والتقارير.'),
                                       L('Questions to the AI assistant are sent to our server and to the AI provider to generate an answer.', 'تُرسل أسئلتك للمساعد الذكي إلى خادمنا وإلى مزوّد الذكاء الاصطناعي لتوليد الإجابة.')]),
  (L('Services we rely on', 'الخدمات التي نعتمد عليها'), [L('To deliver maps and data, your browser contacts third-party services directly: weather, air-quality and elevation data services, map-tile providers, the British Geological Survey, USGS, NASA EONET, Cloudflare and Google. Each processes your request under its own privacy policy.', 'لتقديم الخرائط والبيانات، يتصل متصفحك مباشرة بخدمات خارجية: خدمات بيانات الطقس وجودة الهواء والارتفاعات، ومزوّدو بلاطات الخرائط، وهيئة المسح الجيولوجي البريطانية وUSGS وNASA EONET وCloudflare وGoogle. تعالج كل خدمة طلبك وفق سياسة الخصوصية الخاصة بها.')]),
  (L('What we never do', 'ما لا نفعله أبداً'), [L('We do not sell personal data, and we do not use your survey data for advertising.', 'لا نبيع البيانات الشخصية، ولا نستخدم بيانات مسحك لأغراض إعلانية.')]),
  (L('How long we keep data', 'مدة الاحتفاظ بالبيانات'), [L('Account details are kept while your subscription is active and for up to twelve months after it ends, unless you ask us to delete them sooner.', 'نحتفظ ببيانات الحساب طوال مدة الاشتراك ولمدة أقصاها اثنا عشر شهراً بعد انتهائه، ما لم تطلب حذفها قبل ذلك.')]),
  (L('Your rights', 'حقوقك'), [L('You can ask to see, correct or delete your personal data at any time by writing to us. We reply within thirty days.', 'يمكنك طلب الاطلاع على بياناتك الشخصية أو تصحيحها أو حذفها في أي وقت بمراسلتنا، ونرد خلال ثلاثين يوماً.')]),
  (L('Cookies and storage', 'ملفات تعريف الارتباط والتخزين'), [L('This website stores only your theme and language choice in your browser. It uses no advertising or tracking cookies.', 'يحفظ هذا الموقع في متصفحك اختيارك للمظهر واللغة فقط، ولا يستخدم ملفات تعريف ارتباط إعلانية أو تتبعية.')]),
 ],
}
TERMS = {
 'title': L('Terms of use', 'شروط الاستخدام'),
 'p': L('The rules for using the Shandal System and this website.', 'قواعد استخدام نظام شندل وهذا الموقع.'),
 'sections': [
  (L('Accounts', 'الحسابات'), [L('Each subscription is for one named person. Do not share your access code. We may suspend accounts that are shared or misused.', 'كل اشتراك مخصص لشخص واحد باسمه. لا تشارك رمز الدخول. يحق لنا إيقاف الحسابات المشتركة أو المُساء استخدامها.')]),
  (L('Subscriptions and payment', 'الاشتراكات والدفع'), [L('Plans are paid in advance for the period chosen. Partner discounts apply only under the conditions of the partnership.', 'تُدفع الاشتراكات مقدماً للمدة المختارة، وتسري خصومات الشركاء وفق شروط الشراكة فقط.')]),
  (L('Intellectual property', 'الملكية الفكرية'), [L('The system, its code, design and content are the registered work of Ali Shandal Falah (registration no. 2841/ع). Reports you produce are yours to use in your work.', 'النظام وشيفرته وتصميمه ومحتواه عمل مسجّل باسم علي شندل فلاح (رقم التسجيل 2841/ع). التقارير التي تُنتجها ملك لك لاستخدامها في عملك.')]),
  (L('Professional responsibility', 'المسؤولية المهنية'), [L('Results are tools for qualified professionals. Engineering, safety and investment decisions remain the responsibility of the licensed person who signs them.', 'النتائج أدوات للمختصين المؤهلين، وتبقى قرارات الهندسة والسلامة والاستثمار مسؤولية الشخص المرخّص الذي يوقّعها.')]),
  (L('Governing law', 'القانون الحاكم'), [L('These terms are governed by the laws of the Republic of Iraq.', 'تخضع هذه الشروط لقوانين جمهورية العراق.')]),
 ],
}
DISCLAIMER = {
 'title': L('Professional disclaimer', 'إخلاء المسؤولية المهنية'),
 'p': L('How to use the results responsibly.', 'كيف تستخدم النتائج بمسؤولية.'),
 'sections': [
  (L('Screening, not sign-off', 'فحص أولي لا مصادقة نهائية'), [L('Seismic parameters, slope stability verdicts, landslide thresholds and environmental indicators are screening-level estimates based on published methods and open data. They do not replace site investigation, laboratory testing or the judgement of a licensed engineer or geologist.', 'المعاملات الزلزالية وأحكام استقرار المنحدرات وعتبات الانزلاق والمؤشرات البيئية تقديرات أولية مبنية على طرق منشورة وبيانات مفتوحة، ولا تغني عن التحريات الموقعية والفحوص المختبرية وحكم مهندس أو جيولوجي مرخّص.')]),
  (L('Data accuracy', 'دقة البيانات'), [L('Phone sensors and global datasets have limited accuracy. Calibrate the compass, check GPS precision before capture, and compare results with independent measurements where it matters.', 'لحساسات الهاتف والبيانات العالمية دقة محدودة. عاير البوصلة وتحقق من دقة GPS قبل الالتقاط، وقارن النتائج بقياسات مستقلة حيث يلزم.')]),
  (L('Local codes', 'الأكواد المحلية'), [L('Design values follow the format of ASCE 7 and the International Building Code. Where a national code applies, it takes precedence.', 'تتبع قيم التصميم صيغة ASCE 7 وكود البناء الدولي IBC، وحيث يسري كود وطني تكون له الأولوية.')]),
 ],
}
