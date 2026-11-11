# -*- coding: utf-8 -*-
"""Northern Iraq additions to the Geo-Heritage & Archaeological Tourism tool.
Run:  python3 gh_north.py   (merges into src/assets/data/geoheritage.json, replacing entries with the same id)

Fields added on top of the original schema:
  st    'new' = discovered or first excavated since about 2010; 'exp' = expected / proposed (inferred structure,
        proposed identification or location not yet confirmed by excavation); absent = established place.
  prec  horizontal uncertainty of the coordinates in km (absent = within about 0.5 km).
  line  [[lat, lon], ...] generalised trace for faults and canals, drawn on the map.
"""
import json, os

G = 'geosite'
R = []


def add(i, ty, cat, gov, lat, lon, zone, en, ar, st=None, prec=None, line=None, wp=None):
    e = {'id': i, 'type': ty, 'cat': cat, 'gov': gov, 'lat': lat, 'lon': lon, 'zone': zone,
         'en': {'name': en[0], 'desc': en[1], 'geo': en[2]}, 'ar': {'name': ar[0], 'desc': ar[1], 'geo': ar[2]}}
    if st: e['st'] = st
    if prec: e['prec'] = prec
    if line: e['line'] = line
    if wp: e['wp'] = wp
    R.append(e)


# ======================================================================= formations (type sections and classic outcrops)
add('f_aqra', 'formation', G, 'Duhok', 36.772, 43.893, 'hfz',
    ('Aqra Formation type area (Akre mountain)',
     'The white cliffs above the town of Akre are the type area of the Aqra Formation, one of the best known reef limestones of the Zagros.',
     'Late Cretaceous (Campanian–Maastrichtian) reef and fore-reef limestone, rich in rudist bivalves and large foraminifera, forming the steep southern limb of the Aqra anticline. It passes laterally into the deeper-water Shiranish marl.'),
    ('منطقة النمط لتكوين عقرة (جبل عقرة)',
     'الجروف البيض فوق مدينة عقرة هي منطقة النمط لتكوين عقرة، أحد أشهر الأحجار الجيرية الشعابية في زاكروس.',
     'حجر جيري شعابي وأمام شعابي من الطباشيري المتأخر (الكامباني–الماستريختي) غني بالمحاريات الرودية والفورامنيفرا الكبيرة، يكوّن الجناح الجنوبي الشديد الميل لطية عقرة المحدبة، ويتحول جانبياً إلى مارل تكوين شيرانش الأعمق.'),
    prec=3)
add('f_sargelu', 'formation', G, 'Sulaymaniyah', 35.885, 45.165, 'hfz',
    ('Sargelu Formation type locality (Surdash)',
     'The village of Sargelu near Surdash gave its name to a thin but famous Jurassic unit, a key source rock of the oil of northern Iraq.',
     'Middle Jurassic (Bajocian–Bathonian) black bituminous limestone and papery shale with the thin-shelled bivalve Bositra ("Posidonia"), deposited in a starved, oxygen-poor basin. Rich in organic matter; the main oil source rock of the Kirkuk region.'),
    ('موقع النمط لتكوين سارگلو (سورداش)',
     'أعطت قرية سارگلو قرب سورداش اسمها لوحدة جوراسية رقيقة لكنها شهيرة، وهي من أهم الصخور المصدرية لنفط شمال العراق.',
     'حجر جيري أسود قيري وطفل ورقي من الجوراسي الأوسط (الباجوسي–الباثوني) مع المحار الرقيق «بوسيدونيا»، ترسب في حوض فقير بالأكسجين. غني بالمادة العضوية، والصخر المصدري الرئيس لنفط منطقة كركوك.'),
    prec=4)
add('f_dokan', 'formation', G, 'Sulaymaniyah', 35.958, 44.957, 'hfz',
    ('Dokan gorge: type section of the Dokan Formation',
     'Where the Little Zab cuts the Dokan anticline, the dam abutments and road cuts expose a classic Cretaceous section; the Dokan Formation is named after this gorge.',
     'Cenomanian–Turonian pelagic (oligosteginal) limestone of the Dokan Formation lies between the massive Qamchuqa dolomitic limestone below and the thin-bedded Kometan limestone above. The hard carbonates form the narrow gorge used for the dam.'),
    ('مضيق دوكان: مقطع النمط لتكوين دوكان',
     'حيث يقطع الزاب الصغير طية دوكان المحدبة، تكشف أكتاف السد وقطوع الطريق مقطعاً طباشيرياً كلاسيكياً، ويحمل تكوين دوكان اسم هذا المضيق.',
     'حجر جيري بحري عميق (أوليگوستجيني) من السينوماني–التوروني لتكوين دوكان يقع بين الحجر الجيري الدولوميتي الكتلي لتكوين قمچوقة أسفله والحجر الجيري الرقيق الطبقات لتكوين كوميتان فوقه، وتكوّن هذه الكربونات الصلبة المضيق الضيق الذي بني فيه السد.'),
    prec=2)
add('f_tanjero', 'formation', G, 'Sulaymaniyah', 35.493, 45.389, 'hfz',
    ('Tanjero Formation (Tanjero valley)',
     'The Tanjero river south-west of Sulaymaniyah gives its name to the flysch that records the arrival of the Zagros thrust sheets at the end of the Cretaceous.',
     'Maastrichtian flysch: rhythmic sandstone, siltstone, shale and conglomerate eroded from the rising ophiolite and radiolarite thrust sheets to the north-east and deposited in a deepening foreland trough.'),
    ('تكوين تانجرو (وادي تانجرو)',
     'يعطي نهر تانجرو جنوب غرب السليمانية اسمه للفليش الذي يسجل وصول صفائح زحوف زاكروس في نهاية الطباشيري.',
     'فليش ماستريختي: تعاقب إيقاعي من الحجر الرملي والغريني والطفل والمدملكات، تآكل من صفائح الأوفيولايت والراديولاريت الصاعدة في الشمال الشرقي وترسب في حوض أمامي متعمق.'),
    prec=4)
add('f_kolosh', 'formation', G, 'Erbil', 36.100, 44.560, 'foothill',
    ('Kolosh Formation type area (near Koya)',
     'The Kolosh area near Koya (Koi Sanjaq) is the type area of the Paleocene clastic unit that lies on top of the Tanjero flysch.',
     'Paleocene–Lower Eocene dark shale, sandstone and conglomerate, a flysch shed from the Zagros thrust belt. It forms soft valleys between the limestone ridges and is overlain by the Sinjar and Khurmala limestones.'),
    ('منطقة النمط لتكوين كولوش (قرب كويه)',
     'منطقة كولوش قرب كويه (كوي سنجق) هي منطقة النمط للوحدة الفتاتية الباليوسينية التي تعلو فليش تانجرو.',
     'طفل داكن وحجر رملي ومدملكات من الباليوسين–الإيوسين الأسفل، فليش منحدر من حزام زحوف زاكروس. يكوّن وديان لينة بين حافات الحجر الجيري وتعلوه أحجار سنجار وخورمالة الجيرية.'),
    prec=8)
add('f_shiranish', 'formation', G, 'Duhok', 37.180, 42.830, 'hfz',
    ('Shiranish Formation type area (near Zakho)',
     'The village of Shiranish near Zakho gives its name to the blue-grey marl that covers much of northern Iraq in the Late Cretaceous.',
     'Campanian–Maastrichtian marl and marly limestone full of planktonic foraminifera, deposited in open, fairly deep water. It is a seal over the Cretaceous oil reservoirs and grades laterally into the Aqra reef limestone.'),
    ('منطقة النمط لتكوين شيرانش (قرب زاخو)',
     'تعطي قرية شيرانش قرب زاخو اسمها للمارل الأزرق الرمادي الذي يغطي معظم شمال العراق في الطباشيري المتأخر.',
     'مارل وحجر جيري مارلي من الكامباني–الماستريختي مليء بالفورامنيفرا الطافية، ترسب في مياه مفتوحة عميقة نسبياً. يعمل غطاءً لمكامن النفط الطباشيرية ويتدرج جانبياً إلى الحجر الجيري الشعابي لتكوين عقرة.'),
    prec=6)
add('f_khabour', 'formation', G, 'Duhok', 37.255, 43.150, 'hfz',
    ('Ora–Khabour area: the oldest rocks exposed in Iraq',
     'In the core of the Ora anticline on the Turkish border north of Zakho and Batifa, erosion has reached Ordovician rocks, the oldest seen at the surface anywhere in Iraq.',
     'Ordovician quartzite and shale of the Khabour Formation, overlain by Devonian–Carboniferous Pirispiki, Kaista and Ora formations and the Permian Chia Zairi limestone. About 450 million years of record in one valley.'),
    ('منطقة أورا–الخابور: أقدم صخور مكشوفة في العراق',
     'في لب طية أورا المحدبة على الحدود التركية شمال زاخو وباتيفا، بلغت التعرية صخور الأوردوفيشي، وهي أقدم صخور تظهر على السطح في العراق.',
     'كوارتزايت وطفل أوردوفيشي لتكوين الخابور، تعلوه تكاوين پيريسپيكي وكايستا وأورا من الديفوني–الكاربوني والحجر الجيري البرمي لتكوين چيا زيري. نحو 450 مليون سنة من السجل في وادٍ واحد.'),
    prec=8)
add('f_mukdadiya', 'formation', G, 'Diyala', 33.979, 44.937, 'foothill',
    ('Mukdadiya Formation type area (Muqdadiyah)',
     'The town of Muqdadiyah gives its name to the sandstone and gravel that form the low ridges of the Hamrin foothills.',
     'Upper Miocene–Pliocene fining-upward cycles of pebbly sandstone, sandstone and red mudstone laid down by rivers flowing off the rising Zagros (formerly "Lower Bakhtiari").'),
    ('منطقة النمط لتكوين المقدادية (المقدادية)',
     'تعطي مدينة المقدادية اسمها للحجر الرملي والحصى الذي يكوّن الحافات الواطئة لتلال حمرين.',
     'دورات متناقصة الحجم الحبيبي إلى الأعلى من حجر رملي حصوي وحجر رملي وطين أحمر من المايوسين الأعلى–البلايوسين، أرستها أنهار منحدرة من زاكروس الصاعد (سابقاً «البختياري الأسفل»).'),
    prec=6)
add('f_baihassan', 'formation', G, 'Kirkuk', 35.650, 44.050, 'foothill',
    ('Bai Hassan Formation type area',
     'The Bai Hassan structure north-west of Kirkuk gives its name to the youngest folded rocks of the foothills, the coarse gravels of the Zagros molasse.',
     'Pliocene–Pleistocene conglomerate and sandstone (formerly "Upper Bakhtiari") eroded from the Zagros and folded with the underlying units, which dates the last folding phase of the foothills to the last few million years.'),
    ('منطقة النمط لتكوين باي حسن',
     'يعطي تركيب باي حسن شمال غرب كركوك اسمه لأحدث الصخور المطوية في التلال، وهي الحصى الخشن لمولاس زاكروس.',
     'مدملكات وحجر رملي من البلايوسين–البلايستوسين (سابقاً «البختياري الأعلى») تآكلت من زاكروس وطويت مع الوحدات التي تحتها، مما يؤرخ آخر مراحل الطي في التلال بالملايين القليلة الأخيرة من السنين.'),
    prec=8)

# ======================================================================= ophiolites and thrust-zone outcrops
add('o_mawat', 'outcrop', G, 'Sulaymaniyah', 35.900, 45.400, 'thrust',
    ('Mawat ophiolite complex',
     'The mountains around Mawat expose a slice of Neo-Tethys ocean floor pushed onto the Arabian margin, one of the best ophiolite outcrops in Iraq.',
     'Late Cretaceous ophiolite and arc rocks: serpentinised peridotite, gabbro, diorite, basalt and volcanics with chromite and copper showings, thrust over the Walash–Naopurdan series and the radiolarites.'),
    ('معقد ماوَت الأوفيولايتي',
     'تكشف الجبال حول ماوت شريحة من قاع محيط التيثس الحديث دُفعت فوق حافة الصفيحة العربية، وهي من أفضل مكاشف الأوفيولايت في العراق.',
     'أوفيولايت وصخور قوس من الطباشيري المتأخر: بيريدوتايت متسربن وگابرو ودايورايت وبازلت وصخور بركانية مع دلائل الكرومايت والنحاس، مدفوعة فوق سلسلة ولاش–ناوپردان والراديولاريت.'),
    prec=5)
add('o_penjween', 'outcrop', G, 'Sulaymaniyah', 35.617, 45.953, 'thrust',
    ('Penjween igneous and metamorphic complex',
     'Around Penjween on the Iranian border the crystalline core of the Zagros suture comes to the surface.',
     'Ultramafic and gabbroic rocks, metavolcanics and marbles of the Penjween–Walash thrust sheets, with magnetite (Asnawa) and chromite occurrences. The highest structural unit of the Iraqi Zagros.'),
    ('معقد بنجوين الناري والمتحول',
     'حول بنجوين على الحدود الإيرانية يظهر اللب البلوري لدرز زاكروس على السطح.',
     'صخور فوق قاعدية وگابرو وصخور بركانية متحولة ورخام من صفائح زحوف بنجوين–ولاش، مع تواجدات المگنتايت (أسناوة) والكرومايت. أعلى وحدة تركيبية في زاكروس العراقي.'),
    prec=5)
add('o_bulfat', 'outcrop', G, 'Sulaymaniyah', 36.250, 45.330, 'thrust',
    ('Bulfat igneous complex (Pishdar)',
     'In the Pishdar mountains east of Qala Diza the Bulfat massif is a classic study area of the Zagros igneous rocks.',
     'Gabbro, diorite and granitic intrusions with contact-metamorphosed limestone (marble, skarn) inside the Walash–Naopurdan volcanic-sedimentary thrust sheet, of Paleogene age.'),
    ('معقد بولفات الناري (پشدر)',
     'في جبال پشدر شرق قلعة دزه، كتلة بولفات منطقة دراسة كلاسيكية لصخور زاكروس النارية.',
     'گابرو ودايورايت ومتداخلات گرانيتية مع حجر جيري متحول بالتماس (رخام وسكارن) داخل صفيحة ولاش–ناوپردان البركانية الرسوبية، من عمر الباليوجين.'),
    prec=10)
add('o_walash', 'outcrop', G, 'Erbil', 36.650, 44.880, 'thrust',
    ('Walash volcanic series near Choman',
     'The road from Choman towards Haji Omaran crosses the Walash–Naopurdan belt, an ancient volcanic arc caught in the collision.',
     'Paleocene–Eocene basaltic and andesitic lavas, pillow lavas, tuffs and red beds with limestone lenses (Walash and Naopurdan groups), thrust over the Qulqula radiolarites and the High Folded Zone.'),
    ('سلسلة ولاش البركانية قرب چومان',
     'يقطع طريق چومان نحو حاجي عمران حزام ولاش–ناوپردان، وهو قوس بركاني قديم حُبس في التصادم.',
     'لابات بازلتية وأنديسايتية ولابات وسائدية وطفوف وطبقات حمراء مع عدسات جيرية من الباليوسين–الإيوسين (مجموعتا ولاش وناوپردان)، مدفوعة فوق راديولاريت قلقلة ونطاق الطيات العالية.'),
    prec=10)

# ======================================================================= folds (anticlines)
add('fd_mateen', 'fold', G, 'Duhok', 37.000, 43.600, 'hfz',
    ('Mateen anticline (Chiya-i Mateen)',
     'The long wall of Mateen mountain separates the Amadiya valley from the Duhok foothills and is crossed by the gorges of the Sarsang–Bamarni road.',
     'A high, asymmetric limestone anticline of Cretaceous Qamchuqa and Bekhme carbonates with Jurassic rocks in its eroded core. Its steep southern limb marks the front of the High Folded Zone.'),
    ('طية متين المحدبة (چيای متين)',
     'يفصل جدار جبل متين الطويل وادي العمادية عن تلال دهوك، وتقطعه مضائق طريق سرسنك–بامرني.',
     'طية محدبة جيرية عالية غير متناظرة من كربونات قمچوقة وبخمة الطباشيرية مع صخور جوراسية في لبها المتآكل. يحدد جناحها الجنوبي الشديد الميل جبهة نطاق الطيات العالية.'),
    prec=6)
add('fd_bekher', 'fold', G, 'Duhok', 36.950, 42.950, 'hfz',
    ('Bekher anticline (Duhok–Zakho road)',
     'The Bekher ridge north of Duhok is crossed by the main road to Zakho; road cuts show the folded limestones in section.',
     'An anticline of Paleogene–Cretaceous limestones (Pila Spi, Kolosh, Aqra) with steeply dipping limbs, one of the outermost folds of the High Folded Zone.'),
    ('طية بيخير المحدبة (طريق دهوك–زاخو)',
     'يقطع الطريق الرئيس إلى زاخو حافة بيخير شمال دهوك، وتظهر قطوع الطريق الأحجار الجيرية المطوية في مقطع.',
     'طية محدبة من أحجار جيرية باليوجينية وطباشيرية (پيلاسپي وكولوش وعقرة) بأجنحة شديدة الميل، من أبعد طيات نطاق الطيات العالية نحو الخارج.'),
    prec=5)
add('fd_maqlub', 'fold', G, 'Nineveh', 36.512, 43.421, 'foothill',
    ('Jabal Maqlub–Bashiqa anticline',
     'The isolated ridge of Jabal Maqlub rises above the Nineveh plain north-east of Mosul, with the Mar Mattai monastery on its flank.',
     'A Foothill Zone anticline with Eocene–Oligocene limestones exposed in its core, surrounded by Miocene Fatha gypsum and marl. The name "Maqlub" (overturned) refers to its steep dips.'),
    ('طية جبل مقلوب–بعشيقة المحدبة',
     'ترتفع حافة جبل مقلوب المنعزلة فوق سهل نينوى شمال شرق الموصل، ويقوم دير مار متى على سفحها.',
     'طية محدبة من نطاق التلال تنكشف في لبها أحجار جيرية من الإيوسين–الأوليگوسين، يحيط بها جبس ومارل تكوين الفتحة المايوسيني.'),
    prec=3, wp='Mount Alfaf')
add('fd_ainzala', 'fold', G, 'Nineveh', 36.700, 42.550, 'foothill',
    ('Ain Zala anticline and oil field',
     'North-west of Mosul, Ain Zala was one of the first oil fields of northern Iraq, discovered in 1939.',
     'A buried Foothill Zone anticline with oil in fractured Cretaceous limestones (Shiranish and older), expressed at the surface by Miocene Fatha beds.'),
    ('طية عين زالة المحدبة وحقلها النفطي',
     'شمال غرب الموصل، كان عين زالة من أوائل حقول النفط في شمال العراق واكتشف عام 1939.',
     'طية محدبة مدفونة من نطاق التلال فيها نفط في أحجار جيرية طباشيرية متشققة (شيرانش وأقدم)، ويظهر سطحها بطبقات الفتحة المايوسينية.'),
    prec=6)
add('fd_qarachauq', 'fold', G, 'Erbil', 35.850, 43.700, 'foothill',
    ('Qara Chauq anticline',
     'The long ridge of Qara Chauq (Qarachogh) runs south of Erbil above the town of Makhmur.',
     'A broad Foothill Zone anticline of Miocene Fatha and Injana beds with older limestones in the core; it holds oil in its Cretaceous reservoirs.'),
    ('طية قره چوخ المحدبة',
     'تمتد حافة قره چوخ الطويلة جنوب أربيل فوق بلدة مخمور.',
     'طية محدبة عريضة من نطاق التلال من طبقات الفتحة وإنجانة المايوسينية مع أحجار جيرية أقدم في اللب، وتحوي نفطاً في مكامنها الطباشيرية.'),
    prec=8)
add('fd_khurmala', 'fold', G, 'Erbil', 35.972, 43.775, 'foothill',
    ('Khurmala dome',
     'The Khurmala dome south-west of Erbil is the north-western end of the great Kirkuk structure and gave its name to the Khurmala limestone.',
     'The north-western culmination of the Kirkuk anticline, with Eocene–Oligocene reef limestones (the main Kirkuk reservoir) beneath Fatha gypsum; type area of the Paleocene–Eocene Khurmala Formation.'),
    ('قبة خورمالة',
     'قبة خورمالة جنوب غرب أربيل هي الطرف الشمالي الغربي لتركيب كركوك العظيم، وأعطت اسمها لحجر خورمالة الجيري.',
     'القمة الشمالية الغربية لطية كركوك المحدبة، مع أحجار جيرية شعابية من الإيوسين–الأوليگوسين (المكمن الرئيس لكركوك) تحت جبس الفتحة؛ منطقة النمط لتكوين خورمالة من الباليوسين–الإيوسين.'),
    prec=3)
add('fd_chamchamal', 'fold', G, 'Sulaymaniyah', 35.560, 44.850, 'foothill',
    ('Chamchamal anticline',
     'The ridge behind the town of Chamchamal is one of the gas-bearing folds between Kirkuk and Sulaymaniyah.',
     'A Foothill Zone anticline exposing Miocene Fatha and Injana beds, with gas and condensate in deeper Oligocene and Cretaceous carbonates.'),
    ('طية چمچمال المحدبة',
     'الحافة خلف بلدة چمچمال إحدى الطيات الحاملة للغاز بين كركوك والسليمانية.',
     'طية محدبة من نطاق التلال تكشف طبقات الفتحة وإنجانة المايوسينية، مع غاز ومتكثفات في كربونات أوليگوسينية وطباشيرية أعمق.'),
    prec=5)
add('fd_taqtaq', 'fold', G, 'Erbil', 35.889, 44.586, 'foothill',
    ('Taq Taq anticline and the Little Zab',
     'At Taq Taq the Little Zab crosses an oil-bearing anticline; the town lies on the river at the foot of the fold.',
     'A Foothill Zone anticline with oil in fractured Cretaceous limestones (Shiranish, Kometan, Qamchuqa); the river keeps its course across the growing fold, an antecedent drainage.'),
    ('طية طق طق المحدبة والزاب الصغير',
     'عند طق طق يقطع الزاب الصغير طية محدبة نفطية، وتقع البلدة على النهر عند قدم الطية.',
     'طية محدبة من نطاق التلال فيها نفط في أحجار جيرية طباشيرية متشققة (شيرانش وكوميتان وقمچوقة)، ويحافظ النهر على مجراه عبر الطية النامية، وهو تصريف سابق للطي.'),
    prec=3)
add('fd_kormor', 'fold', G, 'Sulaymaniyah', 35.135, 44.822, 'foothill',
    ('Khor Mor anticline and gas field',
     'Khor Mor, between Chamchamal and Kalar, is one of the largest gas fields of the Kurdistan Region.',
     'A Foothill Zone anticline of Miocene beds with gas and condensate in Oligocene–Cretaceous carbonate reservoirs beneath the Fatha evaporite seal.'),
    ('طية خور مور المحدبة وحقل الغاز',
     'خور مور بين چمچمال وكلار من أكبر حقول الغاز في إقليم كردستان.',
     'طية محدبة من نطاق التلال من طبقات مايوسينية فيها غاز ومتكثفات في مكامن كربونية أوليگوسينية–طباشيرية تحت غطاء متبخرات الفتحة.'),
    prec=3)
add('fd_harir', 'fold', G, 'Erbil', 36.575, 44.300, 'hfz',
    ('Harir anticline',
     'The Harir ridge above the town of Harir closes the Shaqlawa–Harir valley to the north.',
     'A High Folded Zone anticline of Cretaceous and Paleogene limestones, part of the same belt of folds as Safeen and Bradost.'),
    ('طية حرير المحدبة',
     'تغلق حافة حرير فوق بلدة حرير وادي شقلاوة–حرير من الشمال.',
     'طية محدبة من نطاق الطيات العالية من أحجار جيرية طباشيرية وباليوجينية، من حزام الطيات نفسه الذي يضم سفين وبرادوست.'),
    prec=5)
add('fd_baranan', 'fold', G, 'Sulaymaniyah', 35.420, 45.550, 'hfz',
    ('Baranan anticline',
     'The Baranan ridge rises south-east of Sulaymaniyah between the city and Darbandikhan.',
     'A High Folded Zone anticline of Cretaceous and Paleogene limestones; its flanks show the Tanjero and Kolosh flysch in the adjacent valleys.'),
    ('طية بەرانان المحدبة',
     'ترتفع حافة برانان جنوب شرق السليمانية بين المدينة ودربندخان.',
     'طية محدبة من نطاق الطيات العالية من أحجار جيرية طباشيرية وباليوجينية، وتظهر على جانبيها في الوديان المجاورة فليش تانجرو وكولوش.'),
    prec=6)

# ======================================================================= mountains
add('m_goizha', 'mountain', G, 'Sulaymaniyah', 35.600, 45.470, 'hfz',
    ('Mount Goizha', 'Goizha (Goyzha) closes the city of Sulaymaniyah to the north-east and is its favourite hiking mountain.',
     'A steep limestone ridge of the High Folded Zone (Cretaceous Qamchuqa and Balambo limestones); karst springs such as Sarchinar rise at its foot.'),
    ('جبل گويژە', 'يغلق جبل گويژة مدينة السليمانية من الشمال الشرقي، وهو جبل المشي المفضل لأهلها.',
     'حافة جيرية شديدة الانحدار من نطاق الطيات العالية (أحجار قمچوقة وبالامبو الطباشيرية)، وتنبع عند قدمها عيون كارستية مثل سرچنار.'),
    prec=3)
add('m_azmar', 'mountain', G, 'Sulaymaniyah', 35.630, 45.520, 'hfz',
    ('Mount Azmar', 'Azmar (Azmer) rises behind Goizha north-east of Sulaymaniyah, with summer meadows and views over the Shahrizor plain.',
     'A High Folded Zone anticline of Cretaceous limestones, structurally the continuation of the Goizha ridge.'),
    ('جبل ئەزمڕ', 'يرتفع جبل أزمر خلف گويژة شمال شرق السليمانية، وفيه مراعٍ صيفية وإطلالة على سهل شهرزور.',
     'طية محدبة من نطاق الطيات العالية من أحجار جيرية طباشيرية، وهي تركيبياً امتداد لحافة گويژة.'),
    prec=4)
add('m_hasarost', 'mountain', G, 'Erbil', 36.720, 44.700, 'hfz',
    ('Hasarost mountain', 'Hasarost rises north of Rawanduz on the way to Sidakan, one of the long limestone walls of the Balakayati region.',
     'A High Folded Zone anticline of Cretaceous limestones close to the Zagros thrust front, deeply cut by the gorges of the Rawanduz river tributaries.'),
    ('جبل هەسارۆست', 'يرتفع جبل هساروست شمال راوندوز على طريق سيدكان، وهو من الجدران الجيرية الطويلة لمنطقة بالكايتي.',
     'طية محدبة من نطاق الطيات العالية من أحجار جيرية طباشيرية قريبة من جبهة زحوف زاكروس، تقطعها بعمق مضائق روافد نهر راوندوز.'),
    prec=6)
add('m_shinrwe', 'mountain', G, 'Halabja', 35.250, 46.050, 'hfz',
    ('Shinrwe mountain', 'Shinrwe (Shnrwe) rises directly above Halabja and the Ahmad Awa valley.',
     'A limestone anticline of the High Folded Zone close to the thrust front; its karst feeds the springs and waterfalls of Ahmad Awa and Zalm.'),
    ('جبل شنروێ', 'يرتفع جبل شنروێ مباشرة فوق حلبجة ووادي أحمد آوا.',
     'طية محدبة جيرية من نطاق الطيات العالية قريبة من جبهة الزحوف، ويغذي كارستها عيون وشلالات أحمد آوا وزلم.'),
    prec=4)
add('m_hawraman', 'mountain', G, 'Halabja', 35.200, 46.250, 'thrust',
    ('Hawraman mountains (Iraqi side)', 'The Hawraman range on the Iranian border, with its terraced villages of Tawella and Byara, is a cultural landscape proposed for World Heritage on the Iranian side.',
     'Massive Jurassic–Cretaceous limestones of the Avroman (Hawraman) thrust sheet, part of the Zagros Thrust Zone, forming high cliffs and deep karst gorges.'),
    ('جبال هورامان (الجانب العراقي)', 'سلسلة هورامان على الحدود الإيرانية مع قراها المدرجة مثل طويلة وبيارة، وهي مشهد ثقافي مسجل في التراث العالمي على الجانب الإيراني.',
     'أحجار جيرية كتلية جوراسية–طباشيرية لصفيحة زحف أورامان (هورامان)، جزء من نطاق الزحوف لزاكروس، تكوّن جروفاً عالية ومضائق كارستية عميقة.'),
    prec=8, wp='Hawraman')

# ======================================================================= gorges, caves, springs, minerals
add('g_bazian', 'gorge', G, 'Sulaymaniyah', 35.600, 45.130, 'hfz',
    ('Bazian pass (Darbandi Bazian)', 'The Bazian pass carries the Kirkuk–Sulaymaniyah road through the first big limestone ridge of the mountains.',
     'A water gap through the Bazian anticline exposing steeply dipping Paleogene and Cretaceous limestones; the boundary between the Foothill Zone and the High Folded Zone.'),
    ('ممر بازيان (دربندی بازیان)', 'يمر طريق كركوك–السليمانية عبر ممر بازيان في أول حافة جيرية كبيرة من الجبال.',
     'فجوة مائية عبر طية بازيان المحدبة تكشف أحجاراً جيرية باليوجينية وطباشيرية شديدة الميل، وهي الحد بين نطاق التلال ونطاق الطيات العالية.'),
    prec=3)
add('g_ranya', 'gorge', G, 'Sulaymaniyah', 36.215, 44.975, 'hfz',
    ('Darband-i Ranya (Little Zab gorge)', 'At the Darband-i Ranya the Little Zab leaves the Ranya plain through a narrow gorge into Lake Dukan; the ancient fort of Qalatga Darband guards it.',
     'A gorge cut through a Cretaceous limestone anticline by the antecedent Little Zab; the river kept pace with the uplift of the fold.'),
    ('دربندی رانیە (مضيق الزاب الصغير)', 'في دربند رانية يغادر الزاب الصغير سهل رانية عبر مضيق ضيق إلى بحيرة دوكان، ويحرسه حصن قلاتگه دربند القديم.',
     'مضيق حفره الزاب الصغير السابق للطي عبر طية محدبة من حجر جيري طباشيري، إذ واكب النهر نهوض الطية.'),
    prec=2)
add('c_zarzi', 'cave', 'archaeo', 'Sulaymaniyah', 36.050, 44.900, 'hfz',
    ('Zarzi cave', 'Excavated by Dorothy Garrod in 1928, Zarzi cave gave its name to the Zarzian, the Epipalaeolithic culture of the Zagros.',
     'A karst cave in Cretaceous limestone of the High Folded Zone; flint tools and animal bones of hunter-gatherers of about 20,000–12,000 years ago lie in the cave fill.'),
    ('كهف زرزي', 'نقبته دوروثي گارود عام 1928، وأعطى اسمه للثقافة الزرزية، وهي ثقافة العصر الحجري القديم المتأخر في زاكروس.',
     'كهف كارستي في حجر جيري طباشيري من نطاق الطيات العالية، فيه أدوات صوانية وعظام حيوانات لصيادين وجامعين عاشوا قبل نحو 20000–12000 سنة.'),
    prec=10)
add('c_gunduk', 'cave', 'archaeo', 'Duhok', 36.810, 43.870, 'hfz',
    ('Gunduk cave reliefs', 'High on the mountain near Akre, the Gunduk (Gondik) cave has rock reliefs of a hunt and a banquet, dated to the third millennium BC.',
     'A karst cave in the Cretaceous limestone of the Aqra anticline; the reliefs are carved on the cave wall near its mouth.'),
    ('منحوتات كهف گوندك', 'في أعالي الجبل قرب عقرة، يحوي كهف گوندك منحوتات صخرية لمشهد صيد ووليمة تؤرخ بالألف الثالث قبل الميلاد.',
     'كهف كارستي في الحجر الجيري الطباشيري لطية عقرة المحدبة، والمنحوتات محفورة على جدار الكهف قرب فوهته.'),
    prec=10)
add('s_sarchinar', 'spring', G, 'Sulaymaniyah', 35.583, 45.372, 'hfz',
    ('Sarchinar spring', 'The spring of Sarchinar on the western edge of Sulaymaniyah has long fed the city and is surrounded by a popular park.',
     'A karst spring issuing from the Cretaceous limestones of the Goizha–Azmar anticline where they meet the less permeable flysch of the Tanjero valley.'),
    ('عين سرچنار', 'غذت عين سرچنار على الطرف الغربي من السليمانية المدينة منذ زمن طويل، وتحيط بها حديقة مقصودة.',
     'عين كارستية تخرج من الأحجار الجيرية الطباشيرية لطية گويژة–أزمر حيث تلتقي بفليش وادي تانجرو الأقل نفاذية.'),
    prec=1)
add('s_zalm', 'spring', G, 'Halabja', 35.300, 46.080, 'hfz',
    ('Zalm spring', 'The Zalm spring near Ahmad Awa is one of the largest karst springs of the Kurdistan Region, feeding the Zalm stream towards the Shahrizor plain.',
     'Groundwater from the karstified limestones of Shinrwe mountain emerges at the contact with impermeable rocks at the edge of the Shahrizor basin.'),
    ('عين زلم', 'عين زلم قرب أحمد آوا من أكبر العيون الكارستية في إقليم كردستان، وتغذي جدول زلم نحو سهل شهرزور.',
     'تخرج المياه الجوفية من أحجار جبل شنروێ الجيرية المتكرستة عند تماسها مع صخور كتيمة على حافة حوض شهرزور.'),
    prec=4)
add('s_subhanagha', 'spring', G, 'Halabja', 35.280, 45.950, 'hfz',
    ('Saraw Subhan Agha spring', 'The spring of Saraw Subhan Agha near Halabja forms a shaded pool that is a traditional picnic place.',
     'A karst spring at the foot of the Shinrwe limestone ridge where groundwater meets the clays of the Shahrizor plain.'),
    ('عين سراو سبحان آغا', 'تكوّن عين سراو سبحان آغا قرب حلبجة بركة ظليلة هي مكان تقليدي للنزهة.',
     'عين كارستية عند قدم حافة شنروێ الجيرية حيث تلتقي المياه الجوفية بأطيان سهل شهرزور.'),
    prec=5)
add('s_qayyarah', 'spring', G, 'Nineveh', 35.800, 43.290, 'foothill',
    ('Bitumen springs of Qayyarah', 'Qayyarah ("place of tar") south of Mosul has been known for its bitumen seeps since antiquity; the Assyrians used its bitumen.',
     'Heavy oil and bitumen seep to the surface along fractures of the Qayyarah anticline through the Miocene Fatha gypsum, from Cretaceous–Paleogene reservoirs below; sulphurous waters accompany them.'),
    ('عيون القير في القيارة', 'عُرفت القيارة جنوب الموصل بنضوح القير منذ القدم، واستخدم الآشوريون قيرها.',
     'يرشح النفط الثقيل والقير إلى السطح على امتداد شقوق طية القيارة المحدبة عبر جبس الفتحة المايوسيني من مكامن طباشيرية–باليوجينية أسفلها، وترافقها مياه كبريتية.'),
    prec=4)
add('mn_mishraq', 'mineral', G, 'Nineveh', 35.950, 43.330, 'foothill',
    ('Mishraq native sulphur', 'Mishraq, south of Mosul, holds one of the largest deposits of native sulphur in the world, mined by the Frasch method since the 1970s.',
     'Native sulphur formed when bacteria reduced the gypsum and anhydrite of the Miocene Fatha Formation in the presence of oil and gas migrating up from below (biogenic replacement of sulphate by sulphur and calcite).'),
    ('كبريت المشراق الحر', 'يحوي المشراق جنوب الموصل أحد أكبر رواسب الكبريت الحر في العالم، ويستخرج بطريقة فراش منذ سبعينيات القرن الماضي.',
     'تكوّن الكبريت الحر حين اختزلت البكتيريا جبس وأنهيدرايت تكوين الفتحة المايوسيني بوجود النفط والغاز الصاعدين من الأسفل (إحلال حيوي للكبريتات بالكبريت والكالسايت).'),
    prec=5)

# ======================================================================= archaeology
A = 'archaeo'
add('a_qalatga', 'citadel', A, 'Sulaymaniyah', 36.2135, 44.9773, 'hfz',
    ('Qalatga Darband', 'A fortified town of the Hellenistic–Parthian period at the Darband-i Ranya gorge, spotted on declassified spy-satellite photographs and excavated since 2015.',
     'Built on a river terrace of the Little Zab at the entrance of the gorge, controlling the route through the High Folded Zone.'),
    ('قلاتگە دربند', 'بلدة محصنة من العصر الهلنستي–الفرثي عند مضيق دربند رانية، رصدت في صور أقمار التجسس المرفوعة عنها السرية ونقبت منذ 2015.',
     'مبنية على مصطبة نهرية للزاب الصغير عند مدخل المضيق، تتحكم بالطريق عبر نطاق الطيات العالية.'),
    st='new', wp='Qalatga Darband')
add('a_kunara', 'archaeo', A, 'Sulaymaniyah', 35.5194, 45.3594, 'hfz',
    ('Tell Kunara', 'A Bronze Age city of the late third millennium BC excavated by a French team since 2012; possibly a centre of the Lullubi people (proposed).',
     'On the alluvial plain of the Tanjero river at the foot of the Baranan ridge.'),
    ('تل كنارة', 'مدينة من العصر البرونزي في أواخر الألف الثالث ق.م نقبتها بعثة فرنسية منذ 2012، ويقترح أنها مركز لشعب اللولوبي.',
     'على السهل الغريني لنهر تانجرو عند قدم حافة برانان.'),
    st='new', wp='Kunara')
add('a_bestansur', 'archaeo', A, 'Sulaymaniyah', 35.3767, 45.6456, 'hfz',
    ('Bestansur', 'An early Neolithic village (about 7700–7100 BC) in the Shahrizor plain, with house floors and burials, excavated 2012–2017.',
     'On the edge of the Shahrizor plain near a karst spring; the plain is a basin filled with Quaternary alluvium in front of the Zagros.'),
    ('بستانسور', 'قرية من العصر الحجري الحديث المبكر (نحو 7700–7100 ق.م) في سهل شهرزور، فيها أرضيات بيوت ودفنات، نقبت بين 2012 و2017.',
     'على حافة سهل شهرزور قرب عين كارستية، والسهل حوض مملوء بالغرين الرباعي أمام زاكروس.'),
    st='new', wp='Bestansur')
add('a_yasintepe', 'archaeo', A, 'Sulaymaniyah', 35.3601, 45.6496, 'hfz',
    ('Yasin Tepe', 'A large mound in the Shahrizor plain with a Neo-Assyrian lower town; proposed as Mazamua, an Assyrian provincial capital (identification not confirmed).',
     'A tell built up on the alluvial plain of the Shahrizor basin.'),
    ('ياسين تپه', 'تل كبير في سهل شهرزور فيه مدينة سفلى من العصر الآشوري الحديث، ويقترح أنه مزاموا عاصمة إقليم آشوري (التعريف غير مؤكد).',
     'تل نشأ على السهل الغريني لحوض شهرزور.'),
    st='new')
add('a_shemshara', 'archaeo', A, 'Sulaymaniyah', 36.2007, 44.9383, 'hfz',
    ('Tell Shemshara (Shusharra)', 'Ancient Shusharra, where an archive of about 250 cuneiform tablets of the 18th century BC was found; now on the shore of Lake Dukan.',
     'On the alluvial terraces of the Little Zab in the Ranya plain, partly flooded since the Dukan dam was built.'),
    ('تل شمشارة (شوشارا)', 'شوشارا القديمة، وُجد فيها أرشيف من نحو 250 رقيماً مسمارياً من القرن الثامن عشر ق.م، وهي اليوم على شاطئ بحيرة دوكان.',
     'على المصاطب الغرينية للزاب الصغير في سهل رانية، وتغمرها المياه جزئياً منذ بناء سد دوكان.'),
    wp='Tell Shemshara')
add('a_bazmusian', 'archaeo', A, 'Sulaymaniyah', 36.1616, 44.9243, 'hfz',
    ('Tell Bazmusian', 'A mound with levels from the Halaf period to the Middle Ages, rescued before the Dukan lake flooded it; it reappears when the water is low.',
     'A tell on the Little Zab terraces, now inside the Dukan reservoir.'),
    ('تل بازموسيان', 'تل بطبقات من عصر حلف حتى العصور الوسطى، أنقذ قبل أن تغمره بحيرة دوكان، ويظهر حين ينخفض الماء.',
     'تل على مصاطب الزاب الصغير، يقع اليوم داخل خزان دوكان.'),
    wp='Tell Bazmusian')
add('a_bakrawa', 'archaeo', A, 'Halabja', 35.2206, 45.9406, 'hfz',
    ('Bakr Awa', 'A large mound near Halabja occupied from the Chalcolithic to the Islamic period, with a high citadel mound and a lower town.',
     'On the alluvial fans of the Shahrizor plain fed by the karst springs of the Hawraman front.'),
    ('بكر آوا', 'تل كبير قرب حلبجة استوطن من العصر الحجري النحاسي حتى العصر الإسلامي، فيه قلعة مرتفعة ومدينة سفلى.',
     'على المراوح الغرينية لسهل شهرزور التي تغذيها عيون جبهة هورامان الكارستية.'),
    wp='Bakr Awa')
add('a_satuqala', 'archaeo', A, 'Erbil', 35.8753, 44.6972, 'foothill',
    ('Satu Qala (ancient Idu)', 'A mound on the Little Zab identified by inscribed bricks as Idu, a city of the Assyrian and post-Assyrian kingdoms.',
     'On the river terraces of the Little Zab in the Foothill Zone.'),
    ('ساتو قلا (إدو القديمة)', 'تل على الزاب الصغير عُرّف بالآجر المنقوش بأنه إدو، مدينة من الممالك الآشورية وما بعدها.',
     'على المصاطب النهرية للزاب الصغير في نطاق التلال.'),
    prec=2, wp='Satu Qala')
add('a_shemamok', 'archaeo', A, 'Erbil', 36.1056, 43.7525, 'foothill',
    ('Qasr Shemamok (Kilizu)', 'The mound of ancient Kilizu, an Assyrian provincial city on the Erbil plain, excavated by a French mission.',
     'A large tell on the Erbil plain near the Great Zab, on Quaternary alluvium over Miocene foothill rocks.'),
    ('قصر شمامك (كيليزو)', 'تل كيليزو القديمة، مدينة إقليمية آشورية في سهل أربيل نقبتها بعثة فرنسية.',
     'تل كبير في سهل أربيل قرب الزاب الأعلى، على غرين رباعي فوق صخور التلال المايوسينية.'),
    wp='Qasr Shemamok')
add('a_kurdqaburstan', 'archaeo', A, 'Erbil', 35.99, 43.86, 'foothill',
    ('Kurd Qaburstan', 'A walled Middle Bronze Age city of about 100 ha south of Erbil, mapped by geophysics and excavated since 2013; possibly ancient Qabra (proposed).',
     'On the Erbil plain; its buried streets and houses were mapped by magnetometry before excavation.'),
    ('كرد قابرستان', 'مدينة مسورة من العصر البرونزي الأوسط بمساحة نحو 100 هكتار جنوب أربيل، رسمت بالمسح الجيوفيزيائي ونقبت منذ 2013، ويقترح أنها قبرا القديمة.',
     'في سهل أربيل، ورسمت شوارعها وبيوتها المدفونة بالمسح المغناطيسي قبل التنقيب.'),
    st='new', prec=2, wp='Kurd Qaburstan')
add('a_kemune', 'palace', A, 'Duhok', 36.7839, 42.7288, 'foothill',
    ('Kemune (Mittani palace)', 'A Mittani palace of the 15th–14th century BC with painted walls and tablets, revealed in 2018 and 2022 when the Mosul Dam lake fell; possibly ancient Zakhiku.',
     'On a terrace of the Tigris now inside the Mosul Dam reservoir; it reappears only when the water level drops.'),
    ('كمونة (قصر ميتاني)', 'قصر ميتاني من القرن الخامس عشر–الرابع عشر ق.م بجدران ملونة ورقم طينية، ظهر عامي 2018 و2022 حين انخفضت بحيرة سد الموصل، ويحتمل أنه زاخيكو القديمة.',
     'على مصطبة لدجلة داخل خزان سد الموصل، ولا يظهر إلا حين ينخفض منسوب الماء.'),
    st='new', wp='Kemune')
add('a_bassetki', 'archaeo', A, 'Duhok', 36.9588, 42.7215, 'foothill',
    ('Bassetki (Mardaman)', 'Findspot of a famous Akkadian bronze statue base (1975) and, in 2017, of tablets identifying the city of Mardaman.',
     'A mound in the Duhok foothills on the route between Mesopotamia and Anatolia.'),
    ('باسطكي (مردمان)', 'موقع العثور على قاعدة تمثال أكدي برونزي شهير (1975)، ثم على رقم طينية عام 2017 عرّفت مدينة مردمان.',
     'تل في تلال دهوك على الطريق بين بلاد الرافدين والأناضول.'),
    st='new', wp='Bassetki')
add('a_billa', 'archaeo', A, 'Nineveh', 36.4336, 43.3483, 'foothill',
    ('Tell Billa (Shibaniba)', 'Ancient Shibaniba, a city of the Assyrian heartland near Bashiqa, inhabited from the Halaf period to Assyrian times.',
     'A tell on the Nineveh plain at the foot of the Bashiqa–Maqlub anticline.'),
    ('تل بلا (شيبانيبا)', 'شيبانيبا القديمة، مدينة في قلب آشور قرب بعشيقة، استوطنت من عصر حلف حتى العصر الآشوري.',
     'تل في سهل نينوى عند قدم طية بعشيقة–مقلوب.'),
    wp='Tell Billa')
add('a_balawat', 'archaeo', A, 'Nineveh', 36.2294, 43.4033, 'foothill',
    ('Balawat (Imgur-Enlil)', 'The Assyrian town of Imgur-Enlil, famous for the bronze bands of its gates showing the campaigns of Shalmaneser III.',
     'A mound on the Nineveh plain east of Nimrud.'),
    ('بلاوات (إمگور-إنليل)', 'البلدة الآشورية إمگور-إنليل، الشهيرة بالأشرطة البرونزية لبواباتها التي تصور حملات شلمنصر الثالث.',
     'تل في سهل نينوى شرق نمرود.'),
    wp='Balawat')
add('a_rimah', 'archaeo', A, 'Nineveh', 36.2571, 42.4493, 'jazira',
    ('Tell al-Rimah', 'A Bronze Age city west of Mosul (possibly ancient Karana or Qattara) with a temple with early brick vaults.',
     'On the Jazira plain south of Jabal Sinjar.'),
    ('تل الرماح', 'مدينة من العصر البرونزي غرب الموصل (يحتمل أنها كرانا أو قطارا القديمة) فيها معبد بأقبية آجرية مبكرة.',
     'على سهل الجزيرة جنوب جبل سنجار.'),
    wp='Tell al-Rimah')
add('a_nuzi', 'archaeo', A, 'Kirkuk', 35.3700, 44.2549, 'foothill',
    ('Nuzi (Yorgan Tepe)', 'A Hurrian city of the 15th–14th century BC near Kirkuk; its thousands of tablets describe daily life, law and family in detail.',
     'On the plain south-west of the Kirkuk anticline.'),
    ('نوزي (يورغان تپه)', 'مدينة حورية من القرن الخامس عشر–الرابع عشر ق.م قرب كركوك، تصف آلاف رقمها الحياة اليومية والقانون والأسرة بالتفصيل.',
     'على السهل جنوب غرب طية كركوك المحدبة.'),
    wp='Nuzi')
add('a_tarbisu', 'archaeo', A, 'Nineveh', 36.415, 43.1197, 'foothill',
    ('Tarbisu (Sherif Khan)', 'An Assyrian royal town north of Nineveh with temples built by Sennacherib and Esarhaddon.',
     'On the Tigris terraces just north of Nineveh.'),
    ('تربيصو (شريف خان)', 'بلدة ملكية آشورية شمال نينوى فيها معابد بناها سنحاريب وأسرحدون.',
     'على مصاطب دجلة شمال نينوى مباشرة.'),
    wp='Tarbisu')
add('a_thalathat', 'archaeo', A, 'Nineveh', 36.5667, 42.5333, 'jazira',
    ('Telul eth-Thalathat', 'A group of prehistoric mounds west of the Tigris excavated by a Japanese mission, with Hassuna, Halaf and Ubaid levels.',
     'On the Jazira plain north-west of Mosul.'),
    ('تلول الثلاثات', 'مجموعة تلال من عصور ما قبل التاريخ غرب دجلة نقبتها بعثة يابانية، فيها طبقات حسونة وحلف والعبيد.',
     'على سهل الجزيرة شمال غرب الموصل.'),
    prec=2, wp='Telul eth-Thalathat')
add('a_yarimtepe', 'archaeo', A, 'Nineveh', 36.3205, 42.3675, 'jazira',
    ('Yarim Tepe', 'Prehistoric villages of the Hassuna and Halaf periods near Tal Afar, with some of the earliest copper and lead objects of Mesopotamia.',
     'Low mounds on the Jazira plain south of Sinjar.'),
    ('يارم تپه', 'قرى من عصور ما قبل التاريخ (حسونة وحلف) قرب تلعفر، فيها من أقدم المصنوعات النحاسية والرصاصية في بلاد الرافدين.',
     'تلال واطئة على سهل الجزيرة جنوب سنجار.'),
    wp='Yarim Tepe')
add('a_ummdab', 'archaeo', A, 'Nineveh', 35.5049, 42.3007, 'jazira',
    ('Umm Dabaghiyah', 'A small Neolithic hunters\' village (about 6000 BC) in the steppe west of Hatra, where onager hides were processed.',
     'In the dry Jazira steppe on Miocene gypsum, near seasonal salt flats.'),
    ('أم الدباغية', 'قرية صيادين صغيرة من العصر الحجري الحديث (نحو 6000 ق.م) في البادية غرب الحضر، كانت تُعالَج فيها جلود الحمير الوحشية.',
     'في بادية الجزيرة الجافة على جبس مايوسيني قرب سبخات موسمية.'),
    prec=3, wp='Umm Dabaghiyah')
add('a_nemrik', 'archaeo', A, 'Nineveh', 36.7167, 42.85, 'foothill',
    ('Nemrik 9', 'A Pre-Pottery Neolithic village (about 10,000–8,000 BC) on the Tigris above Mosul, excavated before the Mosul Dam lake filled.',
     'On a Tigris terrace on the south shore of today\'s Mosul Dam lake.'),
    ('نمريك 9', 'قرية من العصر الحجري الحديث قبل الفخار (نحو 10000–8000 ق.م) على دجلة أعلى الموصل، نقبت قبل امتلاء بحيرة سد الموصل.',
     'على مصطبة لدجلة على الشاطئ الجنوبي لبحيرة سد الموصل الحالية.'),
    prec=2, wp='Nemrik 9')
add('a_mlefaat', 'archaeo', A, 'Nineveh', 36.30, 43.55, 'foothill',
    ('M\'lefaat', 'One of the earliest villages of the Zagros foothills (about 9,500 BC) on the Khazir river, with round houses.',
     'On a terrace of the Khazir river between the Nineveh and Erbil plains.'),
    ('ملفعات', 'من أقدم قرى تلال زاكروس (نحو 9500 ق.م) على نهر الخازر، فيها بيوت دائرية.',
     'على مصطبة لنهر الخازر بين سهلي نينوى وأربيل.'),
    prec=4, wp="M'lefaat")
add('a_kanishaie', 'archaeo', A, 'Sulaymaniyah', 35.5581, 45.1765, 'hfz',
    ('Kani Shaie', 'A mound in the Bazian valley with Chalcolithic and Bronze Age levels, excavated since 2013.',
     'In the Bazian valley between limestone anticlines, at a spring ("kani" means spring).'),
    ('كاني شايي', 'تل في وادي بازيان فيه طبقات من العصر الحجري النحاسي والبرونزي، نقب منذ 2013.',
     'في وادي بازيان بين طيات جيرية، عند عين ماء («كاني» تعني العين).'),
    st='new', wp='Kani Shaie')
add('a_zawichemi', 'archaeo', A, 'Erbil', 36.7817, 44.2789, 'hfz',
    ('Zawi Chemi Shanidar', 'An open-air village of about 9,000 BC near Shanidar cave, with early evidence of sheep herding.',
     'On a terrace of the Great Zab below the Bradost anticline.'),
    ('زاوي چمي شانيدر', 'قرية مكشوفة من نحو 9000 ق.م قرب كهف شانيدر، فيها من أقدم الدلائل على رعي الأغنام.',
     'على مصطبة للزاب الأعلى تحت طية برادوست المحدبة.'),
    prec=2, wp='Zawi Chemi Shanidar')
add('a_gawr', 'relief', A, 'Sulaymaniyah', 35.2189, 45.4139, 'hfz',
    ('Darband-i Gawr relief', 'A rock relief of a victorious king trampling enemies, of the Akkadian period (probably Naram-Sin), in a gorge of the Qaradagh mountains.',
     'Carved on a smoothed cliff of Cretaceous limestone in a narrow gorge of the Qaradagh anticline.'),
    ('منحوتة دربندی گاور', 'منحوتة صخرية لملك منتصر يطأ أعداءه من العصر الأكدي (يرجح أنه نرام-سين) في مضيق من جبال قره داغ.',
     'محفورة على جرف مصقول من حجر جيري طباشيري في مضيق ضيق من طية قره داغ.'),
    prec=2)
add('a_belula', 'relief', A, 'Sulaymaniyah', 35.050, 45.900, 'hfz',
    ('Darband-i Belula (Horen Shekhan) relief', 'An Old Babylonian period rock relief of a ruler with an inscription, above the pass of Belula near the Sirwan river.',
     'Cut into a limestone cliff at a pass through a High Folded Zone ridge.'),
    ('منحوتة دربندی بێلولە (هورين شيخان)', 'منحوتة صخرية من العصر البابلي القديم لحاكم مع نقش، فوق ممر بيلولة قرب نهر سيروان.',
     'محفورة في جرف جيري عند ممر عبر حافة من نطاق الطيات العالية.'),
    prec=10)
add('a_paikuli', 'monument', A, 'Sulaymaniyah', 35.0983, 45.5905, 'foothill',
    ('Paikuli tower and inscription', 'Ruins of a Sasanian tower with a long bilingual inscription of King Narseh (AD 293); the blocks are kept in the Sulaymaniyah Museum.',
     'On a ridge of the foothills south-west of Darbandikhan, built of local limestone blocks.'),
    ('برج پايكولي ونقشه', 'أطلال برج ساساني بنقش طويل ثنائي اللغة للملك نرسي (293 م)، وتحفظ كتله في متحف السليمانية.',
     'على حافة في التلال جنوب غرب دربندخان، مبني من كتل جيرية محلية.'),
    wp='Paikuli inscription')
add('a_qizqapan', 'relief', A, 'Sulaymaniyah', 35.8099, 45.0068, 'hfz',
    ('Qizqapan rock tomb', 'A rock-cut tomb of the Median or Achaemenid period high on a cliff, with carved columns and figures at a fire altar.',
     'Cut into a vertical cliff of Cretaceous limestone in the Surdash area.'),
    ('قبر قزقاپان الصخري', 'قبر منحوت في الصخر من العصر الميدي أو الأخميني عالياً في جرف، فيه أعمدة منحوتة وأشخاص عند مذبح نار.',
     'منحوت في جرف عمودي من حجر جيري طباشيري في منطقة سورداش.'),
    prec=1, wp='Qizqapan')
add('a_faida', 'relief', A, 'Duhok', 36.730, 43.000, 'foothill',
    ('Faida reliefs', 'Ten Assyrian reliefs of gods and kings carved along an irrigation canal of Sargon II or Sennacherib, uncovered in 2019 by a Kurdish–Italian team.',
     'Carved on the wall of a canal cut into the Miocene–Pliocene foothill rocks south of Duhok.'),
    ('منحوتات فايدة', 'عشر منحوتات آشورية لآلهة وملوك على امتداد قناة ري من عهد سرجون الثاني أو سنحاريب، كشفت عام 2019 على يد فريق كردي–إيطالي.',
     'محفورة على جدار قناة شُقّت في صخور التلال المايوسينية–البلايوسينية جنوب دهوك.'),
    st='new', prec=3)
add('a_maltai', 'relief', A, 'Duhok', 36.890, 43.010, 'hfz',
    ('Maltai reliefs', 'Assyrian rock reliefs of a king before seven gods on their animals, on the mountain just north of Duhok.',
     'Carved on the cliff of the Duhok anticline, in Paleogene limestone.'),
    ('منحوتات مالطا', 'منحوتات صخرية آشورية لملك أمام سبعة آلهة على حيواناتها، على الجبل شمال دهوك مباشرة.',
     'محفورة على جرف طية دهوك المحدبة في حجر جيري باليوجيني.'),
    prec=3)
add('a_canal', 'archaeo', A, 'Nineveh', 36.560, 43.300, 'foothill',
    ('Sennacherib\'s canal system (Khinis–Jerwan–Nineveh)', 'The Assyrian king Sennacherib brought water to Nineveh by canals from the mountains, crossing valleys on aqueducts such as Jerwan. ',
     'The canal heads at the Khinis gorge where the Gomel river leaves the mountains and follows the slope of the foothills to Nineveh. Parts of its course are known from survey and satellite imagery.'),
    ('منظومة قنوات سنحاريب (خنس–جروانة–نينوى)', 'جلب الملك الآشوري سنحاريب الماء إلى نينوى بقنوات من الجبال عبرت الوديان على جسور مائية مثل جروانة، ',
     'تبدأ القناة عند مضيق خنس حيث يخرج نهر گومل من الجبال وتتبع انحدار التلال إلى نينوى. وعرفت أجزاء مسارها بالمسح والصور الفضائية.'),
    prec=3)
add('a_gaugamela', 'archaeo', A, 'Nineveh', 36.56, 43.44, 'foothill',
    ('Gaugamela battlefield (proposed location)', 'Where Alexander the Great defeated Darius III in 331 BC. The battlefield is placed on the plain near Tell Gomel, but the exact location is not proven.',
     'A wide plain of the Foothill Zone suited to cavalry and chariots, between the Gomel and Khazir rivers.'),
    ('ساحة معركة گوگاميلا (موقع مقترح)', 'حيث هزم الإسكندر الأكبر داريوس الثالث عام 331 ق.م. توضع ساحة المعركة في السهل قرب تل گومل، لكن الموقع الدقيق غير مثبت.',
     'سهل واسع من نطاق التلال يناسب الخيالة والعربات بين نهري گومل والخازر.'),
    st='exp', prec=10, wp='Battle of Gaugamela')
add('a_musasir', 'archaeo', A, 'Erbil', 36.800, 44.600, 'thrust',
    ('Musasir (proposed at Mudjesir, Sidakan)', 'The holy city of the Urartian god Haldi, sacked by Sargon II in 714 BC. Life-size statues found at Mudjesir near Sidakan in 2005–2017 support placing it here.',
     'In the high valleys of the Zagros Thrust Zone near the Iranian and Turkish borders.'),
    ('موصاصير (مقترح في مودجيسير، سيدكان)', 'المدينة المقدسة للإله الأورارتي خالدي، نهبها سرجون الثاني عام 714 ق.م. وتدعم التماثيل بالحجم الطبيعي المكتشفة في مودجيسير قرب سيدكان بين 2005 و2017 وضعها هنا.',
     'في الوديان العالية لنطاق الزحوف لزاكروس قرب الحدود الإيرانية والتركية.'),
    st='exp', prec=8, wp='Musasir')
add('a_zab750', 'archaeo', A, 'Nineveh', 36.05, 43.40, 'foothill',
    ('Battle of the Zab, AD 750 (proposed area)', 'Here the Abbasids defeated the last Umayyad caliph Marwan II. The battle was fought on the banks of the Great Zab; the exact place is uncertain.',
     'River terraces of the Great Zab above its junction with the Tigris.'),
    ('معركة الزاب 750 م (منطقة مقترحة)', 'هنا هزم العباسيون آخر الخلفاء الأمويين مروان الثاني. دارت المعركة على ضفاف الزاب الأعلى، والموقع الدقيق غير مؤكد.',
     'مصاطب نهرية للزاب الأعلى فوق التقائه بدجلة.'),
    st='exp', prec=15, wp='Battle of the Zab')
add('a_ekallatum', 'archaeo', A, 'Saladin', 35.530, 43.250, 'foothill',
    ('Ekallatum (location proposed)', 'Royal city of Shamshi-Adad I and his son Ishme-Dagan (18th century BC), known from the Mari letters. It lay on the Tigris upstream of Ashur; mounds near Ashur such as Tell Haikal have been proposed, but it is not yet identified.',
     'Tigris terraces where the river leaves the Makhul–Khanuqa gap.'),
    ('إكلاتوم (موقع مقترح)', 'المدينة الملكية لشمشي-أدد الأول وابنه إشمي-داگان (القرن الثامن عشر ق.م)، معروفة من رسائل ماري. كانت على دجلة أعلى آشور، واقترحت تلال قرب آشور مثل تل هيكل، لكنها لم تُعرَّف بعد.',
     'مصاطب دجلة حيث يخرج النهر من فتحة مكحول–خانوقة.'),
    st='exp', prec=15, wp='Ekallatum')
add('a_mashki', 'archaeo', A, 'Nineveh', 36.370, 43.150, 'foothill',
    ('Mashki Gate of Nineveh', 'One of the gates of Sennacherib\'s Nineveh; rebuilt in the 20th century, damaged in 2016, and in 2022 excavators found new Assyrian reliefs there.',
     'In the western city wall on the Tigris terraces.'),
    ('بوابة المسقى في نينوى', 'إحدى بوابات نينوى سنحاريب، أعيد بناؤها في القرن العشرين وتضررت عام 2016، وعثر المنقبون فيها عام 2022 على منحوتات آشورية جديدة.',
     'في السور الغربي للمدينة على مصاطب دجلة.'),
    st='new', prec=1, wp='Mashki Gate')
add('a_hamrinbasin', 'archaeo', A, 'Diyala', 34.250, 45.000, 'foothill',
    ('Drowned tells of the Hamrin basin', 'More than 80 sites (such as Tell Gubba, Tell Madhhur and Tell Abada) were excavated in a rescue campaign in 1977–1984 before Lake Hamrin flooded them; some reappear in drought years.',
     'The Hamrin basin is a syncline between the Hamrin and Qara Chauq ridges filled by the Diyala alluvium.'),
    ('التلال الغارقة في حوض حمرين', 'نُقّب أكثر من 80 موقعاً (مثل تل گُبّة وتل مضهور وتل أبادة) في حملة إنقاذ بين 1977 و1984 قبل أن تغمرها بحيرة حمرين، ويظهر بعضها في سنوات الجفاف.',
     'حوض حمرين مقعر بين حافة حمرين وحافات التلال، ملأه غرين ديالى.'),
    prec=10)

# ======================================================================= religious and heritage
add('r_rabbanhormizd', 'church', 'religious', 'Nineveh', 36.7492, 43.1144, 'foothill',
    ('Rabban Hormizd Monastery', 'Founded in the 7th century in the mountain above Alqosh, with cells cut in the rock; for centuries the seat of the patriarchs of the Church of the East.',
     'Cut into the Paleogene limestone cliff of the Alqosh anticline, the first ridge of the mountains above the Nineveh plain.'),
    ('دير الربان هرمزد', 'أسس في القرن السابع في الجبل فوق ألقوش، وفيه صوامع منحوتة في الصخر، وكان لقرون مقر بطاركة كنيسة المشرق.',
     'منحوت في جرف حجر جيري باليوجيني لطية ألقوش المحدبة، أول حافة جبلية فوق سهل نينوى.'),
    wp='Rabban Hormizd Monastery')
add('r_marelia', 'church', 'religious', 'Nineveh', 36.2925, 43.1311, 'foothill',
    ('Monastery of Saint Elijah (Dair Mar Elia)', 'Probably the oldest Christian monastery in Iraq (about AD 600), south of Mosul; destroyed in 2014, its ruins are being protected.',
     'On the Tigris terraces south of Mosul.'),
    ('دير مار إيليا', 'يرجح أنه أقدم دير مسيحي في العراق (نحو 600 م) جنوب الموصل، دمر عام 2014 وتجري حماية أطلاله.',
     'على مصاطب دجلة جنوب الموصل.'),
    wp="Dair Mar Elia")
add('r_tahira', 'church', 'religious', 'Nineveh', 36.2697, 43.3775, 'foothill',
    ('Al-Tahira Church, Qaraqosh', 'The great Syriac Catholic church of Bakhdida (Qaraqosh), one of the largest in Iraq, restored after 2017.',
     'On the Nineveh plain, built of local stone and brick.'),
    ('كنيسة الطاهرة الكبرى، قره قوش', 'الكنيسة السريانية الكاثوليكية الكبرى في بغديدا (قره قوش)، من أكبر كنائس العراق، رممت بعد 2017.',
     'في سهل نينوى، مبنية بالحجر والآجر المحليين.'),
    wp='Qaraqosh')
add('r_bashiqa', 'religious', 'religious', 'Nineveh', 36.4547, 43.3375, 'foothill',
    ('Yazidi shrines of Bashiqa and Bahzani', 'The twin towns of Bashiqa and Bahzani have many conical Yazidi shrines and olive groves at the foot of Jabal Maqlub.',
     'On the alluvial fans at the foot of the Bashiqa–Maqlub anticline; springs from the limestone ridge water the olive groves.'),
    ('مزارات الإيزيدية في بعشيقة وبحزاني', 'في بلدتي بعشيقة وبحزاني المتلاصقتين مزارات إيزيدية مخروطية كثيرة وبساتين زيتون عند قدم جبل مقلوب.',
     'على المراوح الغرينية عند قدم طية بعشيقة–مقلوب، وتسقي عيون الحافة الجيرية بساتين الزيتون.'),
    prec=1, wp='Bahzani')
add('h_koya', 'heritage', A, 'Erbil', 36.0828, 44.6286, 'foothill',
    ('Koya (Koi Sanjaq) old town', 'A historic town of poets and scholars between Erbil and Sulaymaniyah, with an old bazaar and the shrine of Haji Qadir Koyi.',
     'Built on the slope of the Bawaji ridge above the Koya plain, on Miocene–Paleogene rocks.'),
    ('مدينة كويه (كوي سنجق) القديمة', 'مدينة تاريخية للشعراء والعلماء بين أربيل والسليمانية، فيها سوق قديم وضريح حاجي قادر الكويي.',
     'مبنية على سفح حافة باواجي فوق سهل كويه، على صخور مايوسينية–باليوجينية.'),
    wp='Koya, Iraq')
add('h_tawella', 'heritage', A, 'Halabja', 35.1914, 46.1811, 'thrust',
    ('Tawella village (Hawraman)', 'A terraced stone village of Hawraman with walnut and pomegranate gardens and the Hawrami language and music.',
     'Stone houses step up a steep slope of Jurassic–Cretaceous limestone; springs from the karst feed the gardens.'),
    ('قرية طويلة (هورامان)', 'قرية حجرية مدرجة في هورامان مع بساتين الجوز والرمان، ولغة وموسيقى هورامية.',
     'بيوت حجرية تصعد منحدراً شديداً من حجر جيري جوراسي–طباشيري، وتغذي عيون الكارست البساتين.'),
    wp='Tawella')
add('h_byara', 'heritage', 'religious', 'Halabja', 35.2298, 46.1199, 'thrust',
    ('Byara (Biyara) and its takiya', 'A mountain village of Hawraman known for its old Sufi takiya and its waterfalls and orchards.',
     'In a karst valley of the Hawraman thrust sheet, fed by springs.'),
    ('بيارة وتكيتها', 'قرية جبلية في هورامان معروفة بتكيتها الصوفية القديمة وشلالاتها وبساتينها.',
     'في وادٍ كارستي من صفيحة زحف هورامان، تغذيه العيون.'),
    wp='Byara')
add('h_barzan', 'heritage', A, 'Erbil', 36.9167, 44.0333, 'hfz',
    ('Barzan', 'The historic village of the Barzani family in the valley of the Great Zab, surrounded by high limestone ridges.',
     'In the Great Zab valley of the High Folded Zone between the Sherin and Pirs anticlines.'),
    ('بارزان', 'القرية التاريخية لعائلة البارزاني في وادي الزاب الأعلى تحيط بها حافات جيرية عالية.',
     'في وادي الزاب الأعلى ضمن نطاق الطيات العالية بين طيتي شيرين وپيرس.'),
    prec=1, wp='Barzan, Iraq')
add('h_sarsang', 'resort', 'nature', 'Duhok', 37.0333, 43.3333, 'hfz',
    ('Sarsang', 'A summer resort town in the Amadiya valley, with orchards and springs beneath the Mateen ridge.',
     'In the syncline valley between the Mateen and Gara anticlines; springs rise where the limestone meets the valley marls.'),
    ('سرسنك', 'بلدة اصطياف في وادي العمادية بين البساتين والعيون تحت حافة متين.',
     'في وادي المقعر بين طيتي متين وگارا، وتنبع العيون حيث يلتقي الحجر الجيري بمارل الوادي.'),
    prec=1, wp='Sarsing')
add('h_kanimasi', 'resort', 'nature', 'Duhok', 37.220, 43.420, 'hfz',
    ('Kani Masi', 'A resort village near the Turkish border with a cold spring, waterfalls and orchards ("the fish spring").',
     'A karst spring at the foot of a limestone anticline of the High Folded Zone.'),
    ('كاني ماسي', 'قرية اصطياف قرب الحدود التركية فيها عين باردة وشلالات وبساتين («عين السمك»).',
     'عين كارستية عند قدم طية محدبة جيرية من نطاق الطيات العالية.'),
    prec=5)

# ======================================================================= merge
if __name__ == '__main__':
    fp = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src/assets/data/geoheritage.json')
    d = json.load(open(fp, encoding='utf-8'))
    ids = {e['id'] for e in R}
    assert len(ids) == len(R), 'duplicate id'
    d = [x for x in d if x['id'] not in ids] + R
    json.dump(d, open(fp, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('merged', len(R), 'entries; total', len(d))
