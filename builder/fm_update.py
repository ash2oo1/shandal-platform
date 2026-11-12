# -*- coding: utf-8 -*-
"""Adds numeric ages, tectonic zones and field tags to the Iraqi formations, and the main formations that were missing.
zones: thrust (Zagros suture/thrust zone), hfz (High Folded Zone), foothill, mesop (Mesopotamian plain), west (Jazira and Western Desert).
tags c (colours): red, redbrown, brown, buff, white, lgrey, dgrey, green, bluegrey, purple, mixed
tags l (rocks): lst, dol, marl, clay, silt, sst, cgl, gyp, chert, volc, ultra
tags f (features): gyp, xbed, chan, cyc, cliff, thin, nod, shells, numm, rud, coral, alg, plank, bitum, rad, pillow"""
import json, os
fp = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src/assets/data/iraq-formations.json')
d = json.load(open(fp, encoding='utf-8'))
by = {f['k']: f for f in d}
EXTRA = {
 'bh': ([4.0, 0.8], ['foothill', 'mesop'], ['brown', 'redbrown', 'mixed'], ['cgl', 'sst', 'clay'], ['chan', 'xbed']),
 'mk': ([9.0, 3.6], ['foothill', 'mesop'], ['lgrey', 'buff', 'redbrown'], ['sst', 'cgl', 'clay', 'silt'], ['xbed', 'chan', 'cyc']),
 'inj': ([11.6, 7.0], ['foothill', 'west', 'hfz'], ['redbrown', 'green', 'lgrey'], ['clay', 'silt', 'sst'], ['cyc', 'xbed']),
 'fat': ([16.0, 11.6], ['foothill', 'west', 'mesop'], ['green', 'lgrey', 'white', 'redbrown'], ['marl', 'gyp', 'lst', 'clay'], ['gyp', 'cyc', 'shells', 'thin']),
 'ps': ([46.0, 36.0], ['hfz', 'foothill'], ['white', 'buff'], ['lst', 'dol'], ['cliff', 'alg', 'coral']),
 'ger': ([52.0, 46.0], ['hfz'], ['redbrown', 'red', 'purple'], ['clay', 'silt', 'sst', 'cgl'], ['chan']),
 'sin': ([59.0, 50.0], ['hfz', 'foothill', 'west'], ['lgrey', 'white'], ['lst'], ['cliff', 'numm', 'coral', 'alg']),
 'kol': ([61.0, 56.0], ['hfz'], ['dgrey'], ['clay', 'sst', 'marl'], ['plank', 'thin']),
 'tan': ([70.0, 66.0], ['hfz'], ['green'], ['sst', 'clay', 'cgl'], ['cyc', 'thin']),
 'shi': ([83.6, 68.0], ['hfz', 'foothill', 'west'], ['bluegrey', 'green', 'lgrey'], ['marl', 'lst'], ['plank', 'thin']),
 'kom': ([92.0, 80.0], ['hfz'], ['white', 'lgrey'], ['lst'], ['thin', 'plank', 'nod']),
 'bal': ([140.0, 92.0], ['hfz', 'thrust'], ['lgrey'], ['lst', 'marl'], ['thin', 'plank']),
 'sar': ([145.0, 125.0], ['hfz'], ['brown', 'bluegrey'], ['marl', 'lst'], ['thin']),
 'qam': ([135.0, 100.0], ['hfz'], ['buff', 'lgrey'], ['lst', 'dol'], ['cliff', 'rud']),
}
for k, v in EXTRA.items():
    f = by[k]; f['ma'] = v[0]; f['zones'] = v[1]; f['tags'] = {'c': v[2], 'l': v[3], 'f': v[4]}
NEW = [
 {'k': 'qua', 're': 'quaternary|holocene|pleistocene|alluvi|terrace|recent', 'en': 'Quaternary deposits', 'ar': 'رسوبيات العصر الرباعي',
  'age': ['Pleistocene–Holocene (river terraces, fans, flood plains)', 'البلايستوسين–الهولوسين (مصاطب نهرية ومراوح وسهول فيضية)'],
  'lith': ['Loose gravel, sand, silt and clay; gypcrete and calcrete crusts', 'حصى ورمل وغرين وطين غير ملتحمة؛ وقشور جبسية وكلسية'], 'colour': '#D8C9A3',
  'col': ['brown, buff or grey; pebbles of every colour of the rocks upstream', 'بني أو أصفر شاحب أو رمادي؛ وحصى بكل ألوان صخور أعلى المجرى'],
  'fos': ['Land snails, plant remains, rare bones; archaeological material', 'قواقع برية وبقايا نباتية وعظام نادرة؛ ومواد أثرية'],
  'feat': ['Terrace steps along rivers, alluvial fans at mountain fronts, pebbles that reveal the source rocks (green serpentinite and red radiolarite from the Zagros)', 'مصاطب متدرجة على الأنهار، ومراوح غرينية عند الجبهات الجبلية، وحصى يكشف صخور المصدر (سربنتينايت أخضر وراديولاريت أحمر من زاكروس)'],
  'ma': [2.6, 0.0], 'zones': ['foothill', 'mesop', 'west', 'hfz', 'thrust'], 'tags': {'c': ['brown', 'buff', 'lgrey', 'mixed'], 'l': ['cgl', 'sst', 'silt', 'clay'], 'f': ['chan']}},
 {'k': 'dib', 're': 'dibdibba', 'en': 'Dibdibba', 'ar': 'الدبدبة', 'age': ['Pliocene–Pleistocene', 'البلايوسين–البلايستوسين'],
  'lith': ['Sand and gravel with pebbles of igneous rocks', 'رمل وحصى مع حصى من صخور نارية'], 'colour': '#D9C28E', 'col': ['buff to light grey', 'أصفر شاحب إلى رمادي فاتح'],
  'fos': ['Barren', 'خالية'], 'feat': ['Wide gravel plains in the south-west, cross-bedding', 'سهول حصوية واسعة في الجنوب الغربي، وتطبق متقاطع'],
  'ma': [5.0, 1.0], 'zones': ['mesop', 'west'], 'tags': {'c': ['buff', 'lgrey'], 'l': ['sst', 'cgl'], 'f': ['xbed']}},
 {'k': 'eup', 're': 'euphrates', 'en': 'Euphrates', 'ar': 'الفرات', 'age': ['Early Miocene', 'المايوسين المبكر'],
  'lith': ['Shelly, chalky and recrystallised limestone, dolomite and marl', 'حجر جيري صدفي وطباشيري ومعاد التبلور ودولومايت ومارل'], 'colour': '#E6DDC4',
  'col': ['white, cream and light grey', 'أبيض وكريمي ورمادي فاتح'], 'fos': ['Abundant shells, corals, algae and miliolid foraminifera', 'أصداف ومرجان وطحالب وفورامنيفرا ميليولية بكثرة'],
  'feat': ['Low plateaus and scarps along the Euphrates; shell beds and coral heads', 'هضاب وحافات واطئة على الفرات؛ طبقات أصداف ورؤوس مرجانية'],
  'ma': [23.0, 17.0], 'zones': ['west'], 'tags': {'c': ['white', 'buff', 'lgrey'], 'l': ['lst', 'dol', 'marl'], 'f': ['shells', 'coral', 'alg']}},
 {'k': 'jer', 're': 'jeribe', 'en': 'Jeribe', 'ar': 'الجريبي', 'age': ['Early–Middle Miocene', 'المايوسين المبكر–الأوسط'],
  'lith': ['Recrystallised, dolomitised and chalky limestone', 'حجر جيري معاد التبلور ومتدلمت وطباشيري'], 'colour': '#E3D7B8', 'col': ['white to buff, massive', 'أبيض إلى أصفر شاحب، كتلي'],
  'fos': ['Algae, miliolids and shell fragments', 'طحالب وميليولايد وشظايا أصداف'], 'feat': ['Forms the hard crest of foothill anticlines below the Fatha gypsum', 'يكوّن القمة الصلبة لطيات التلال تحت جبس الفتحة'],
  'ma': [19.0, 16.0], 'zones': ['foothill', 'west'], 'tags': {'c': ['white', 'buff'], 'l': ['lst', 'dol'], 'f': ['cliff', 'alg']}},
 {'k': 'aqr', 're': 'aqra|bekhme', 'en': 'Aqra and Bekhme', 'ar': 'عقرة وبخمة', 'age': ['Late Cretaceous (Campanian–Maastrichtian)', 'الطباشيري المتأخر (الكامباني–الماستريختي)'],
  'lith': ['Reef and fore-reef limestone and dolomite', 'حجر جيري ودولومايت شعابي وأمام شعابي'], 'colour': '#DCD3BE', 'col': ['white to light grey, massive cliffs', 'أبيض إلى رمادي فاتح، جروف كتلية'],
  'fos': ['Rudist bivalves, corals, large foraminifera (Loftusia, Omphalocyclus)', 'محاريات رودية ومرجان وفورامنيفرا كبيرة (لوفتوسيا وأومفالوسايكلس)'],
  'feat': ['Great white cliffs of Akre, Bekhme and Rawanduz gorges; karst caves and springs', 'الجروف البيض العظيمة في عقرة وبخمة ومضيق راوندوز؛ كهوف وعيون كارستية'],
  'ma': [80.0, 66.0], 'zones': ['hfz'], 'tags': {'c': ['white', 'lgrey', 'buff'], 'l': ['lst', 'dol'], 'f': ['cliff', 'rud', 'coral']}},
 {'k': 'sgl', 're': 'sargelu|naokelekan|barsarin', 'en': 'Sargelu', 'ar': 'سارگلو', 'age': ['Middle Jurassic', 'الجوراسي الأوسط'],
  'lith': ['Black bituminous limestone and papery shale with chert', 'حجر جيري أسود قيري وطفل ورقي مع صوان'], 'colour': '#4A4A48', 'col': ['black to dark grey, thin-bedded', 'أسود إلى رمادي داكن، رقيق التطبق'],
  'fos': ['Thin-shelled bivalves (Bositra), ammonites', 'محار رقيق الصدفة (بوسيترا) وأمونايت'], 'feat': ['Smells of oil when broken; source rock of northern Iraq oil', 'تفوح منه رائحة النفط عند كسره؛ الصخر المصدري لنفط شمال العراق'],
  'ma': [174.0, 163.0], 'zones': ['hfz'], 'tags': {'c': ['dgrey'], 'l': ['lst', 'clay', 'chert'], 'f': ['bitum', 'thin', 'shells']}},
 {'k': 'krc', 're': 'kurra chine|geli khana|baluti', 'en': 'Kurra Chine and Geli Khana', 'ar': 'كورا جيني وگلي خانة', 'age': ['Triassic', 'الترياسي'],
  'lith': ['Dolomite, limestone and dark shale', 'دولومايت وحجر جيري وطفل داكن'], 'colour': '#7C7A72', 'col': ['dark grey to grey, well bedded', 'رمادي داكن إلى رمادي، جيد التطبق'],
  'fos': ['Bivalves and ammonoids in places', 'محاريات وأمونويدات في بعض الأماكن'], 'feat': ['Core of the high anticlines near Amadiya', 'لب الطيات العالية قرب العمادية'],
  'ma': [242.0, 201.0], 'zones': ['hfz'], 'tags': {'c': ['dgrey', 'lgrey'], 'l': ['dol', 'lst', 'clay'], 'f': ['thin']}},
 {'k': 'qul', 're': 'qulqula|radiolar', 'en': 'Qulqula (radiolarites)', 'ar': 'قلقلة (راديولاريت)', 'age': ['Early Cretaceous', 'الطباشيري المبكر'],
  'lith': ['Thin beds of radiolarian chert, siliceous shale and limestone', 'طبقات رقيقة من صوان راديولاري وطفل سيليسي وحجر جيري'], 'colour': '#A2554A', 'col': ['brick red, green and grey, finely banded', 'أحمر طابوقي وأخضر ورمادي، بأشرطة رقيقة'],
  'fos': ['Radiolaria (microscopic)', 'راديولاريا (مجهرية)'], 'feat': ['Very hard, splintery chert ribbons folded tightly', 'أشرطة صوانية صلدة جداً تتشظى، مطوية بشدة'],
  'ma': [145.0, 95.0], 'zones': ['thrust'], 'tags': {'c': ['red', 'green', 'lgrey'], 'l': ['chert', 'lst', 'clay'], 'f': ['rad', 'thin']}},
 {'k': 'wal', 're': 'walash|naopurdan', 'en': 'Walash and Naopurdan', 'ar': 'ولاش وناوپردان', 'age': ['Paleocene–Oligocene', 'الباليوسين–الأوليگوسين'],
  'lith': ['Basaltic and andesitic lavas, pillow lavas, tuffs, red beds and limestone lenses', 'لابات بازلتية وأنديسايتية، ولابات وسائدية، وطفوف، وطبقات حمراء، وعدسات جيرية'], 'colour': '#5E6B4E', 'col': ['dark green, purple and red', 'أخضر داكن وبنفسجي وأحمر'],
  'fos': ['Nummulites in the limestone lenses', 'نمّوليت في العدسات الجيرية'], 'feat': ['Pillow shapes, vesicles, no reaction with acid except the limestone', 'أشكال وسائدية وفجوات غازية، ولا تفاعل مع الحامض عدا الحجر الجيري'],
  'ma': [65.0, 30.0], 'zones': ['thrust'], 'tags': {'c': ['green', 'purple', 'redbrown', 'dgrey'], 'l': ['volc', 'clay', 'sst', 'lst'], 'f': ['pillow', 'numm']}},
 {'k': 'oph', 're': 'ophiolit|mawat|penjw|serpentin|peridot|gabbro|bulfat', 'en': 'Ophiolite and igneous complexes (Mawat, Penjween, Bulfat)', 'ar': 'الأوفيولايت والمعقدات النارية (ماوت وبنجوين وبولفات)', 'age': ['Late Cretaceous', 'الطباشيري المتأخر'],
  'lith': ['Serpentinite, peridotite, gabbro, basalt and diorite', 'سربنتينايت وبيريدوتايت وگابرو وبازلت ودايورايت'], 'colour': '#3F5A44', 'col': ['dark green to black, shiny green surfaces', 'أخضر داكن إلى أسود، بسطوح خضراء لامعة'],
  'fos': ['None', 'لا يوجد'], 'feat': ['Heavy, magnetic in places (magnetite, chromite), slippery polished serpentine surfaces', 'ثقيلة، ومغناطيسية في بعض الأماكن (مگنتايت وكرومايت)، وسطوح سربنتين مصقولة زلقة'],
  'ma': [100.0, 80.0], 'zones': ['thrust'], 'tags': {'c': ['green', 'dgrey'], 'l': ['ultra', 'volc'], 'f': []}},
 {'k': 'dhi', 're': 'dhiban', 'en': 'Dhiban', 'ar': 'ذيبان', 'age': ['Early Miocene', 'المايوسين المبكر'],
  'lith': ['Anhydrite and gypsum with thin limestone', 'أنهيدرايت وجبس مع حجر جيري رقيق'], 'colour': '#EFEDE6', 'col': ['white to light grey', 'أبيض إلى رمادي فاتح'],
  'fos': ['Rare', 'نادرة'], 'feat': ['Massive gypsum, dissolution hollows', 'جبس كتلي وتجاويف ذوبان'],
  'ma': [20.0, 18.0], 'zones': ['foothill', 'west'], 'tags': {'c': ['white', 'lgrey'], 'l': ['gyp', 'lst'], 'f': ['gyp']}},
]
d = [f for f in d if f['k'] not in {n['k'] for n in NEW}] + NEW
json.dump(d, open(fp, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(len(d), 'formations')
