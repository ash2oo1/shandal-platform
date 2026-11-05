/* Well-log lab — library: readers for LAS 2.0, delimited text and Excel (.xlsx) files, recognition of curve mnemonics of
   the main service companies, unit normalisation, and the reference "type section" of log responses used by the log
   guide and by the example well. Exposes window.WL. */
(function () {
  'use strict';
  var WL = window.WL = {};

  /* ---------------------------------------------------------------- curve kinds and mnemonics */
  /* kind: canonical log; rx: mnemonics (whole word, case-insensitive) of the main service companies and common software */
  WL.KINDS = [
    { k: 'DEPT', rx: /^(DEPT|DEPTH|DEP|MD|TDEP|DEPTH_M|DEPTH_FT)$/ },
    { k: 'GR', rx: /^(GR|GRC|GRD|GRS|SGR|HSGR|GR_EDTC|ECGR|EHGR|GRGC|GAM|GAMMA|GRAPI|HGR|GR1|GRN|NGT|GRR)$/ },
    { k: 'CGR', rx: /^(CGR|HCGR|GRKT|GRTH)$/ },
    { k: 'K', rx: /^(K|POTA|HFK|K40|KPCT)$/ }, { k: 'TH', rx: /^(TH|THOR|HTHO|TH232|THPPM)$/ }, { k: 'U', rx: /^(U|URAN|HURA|U238|UPPM)$/ },
    { k: 'SP', rx: /^(SP|SPR?C|SSP|SPBR|SPS|SP1)$/ },
    { k: 'CALI', rx: /^(CAL|CALI|CALX|CALY|CAL1|CAL2|HCAL|DCAL|C1|C2|C13|C24|LCAL|CALS|BHD)$/ },
    { k: 'BS', rx: /^(BS|BIT|BITSIZE|BIT_SIZE)$/ },
    { k: 'RD', rx: /^(LLD|HLLD|LL7|RT|RD|ILD|RILD|IDPH|AT90|AF90|AHT90|AHF90|M2R9|M2RX|RLA5|RLA4|RDEEP|RES_DEEP|RESD|DLL|LN|LONG_NORMAL|ILD1|RT_HRLT|HDRS|P34H|P40H|RACEHM|RPCEHM|RES)$/ },
    { k: 'RM', rx: /^(LLS|HLLS|ILM|RILM|IMPH|RM|AT30|AT60|AF30|AF60|AHT30|AHT60|M2R3|M2R6|RLA3|RLA2|RMED|RES_MED|RESM|SFLU|P16H|P22H|RPCELM|SN|SHORT_NORMAL)$/ },
    { k: 'RXO', rx: /^(MSFL|RXO|RXOZ|RXO8|MLL|SFL|SFLA|MCFL|LL8|ML1|ML2|MNOR|MINV|AT10|AF10|AHT10|M2R1|RLA1|RS|RSHAL|RES_SHAL|RESS|SPR|SPRES)$/ },
    { k: 'RHOB', rx: /^(RHOB|RHOZ|RHO8|DEN|ZDEN|DENS|RHOM|BDCFM|BDEL|RHOB_CORR|DENB|ZDNC|DPEB|RHOC|ROBB|RHOI|DPHB)$/ },
    { k: 'DRHO', rx: /^(DRHO|HDRA|ZCOR|DCOR|ORHO|DRHOB|CORR)$/ },
    { k: 'NPHI', rx: /^(NPHI|NPOR|TNPH|NPHS|NPHL|CNL|CNC|CNCF|CNPOR|CN|NEU|NEUT|PHIN|APLC|APSC|NPL|NPSS|NPLS|NPRL|HNPO|TNPL|CNCLS|NPHI_LS|NPH|SNP|CNS)$/ },
    { k: 'PEF', rx: /^(PE|PEF|PEFZ|PEFL|PEF8|PEB|PDPE|PEQ|PFE|PEDF)$/ },
    { k: 'DT', rx: /^(DT|DTC|DTCO|DT4P|DTP|AC|ACOU|SONIC|DTL|DTLN|DTLF|DT24|DTCOMP|DELT|DT1|BCS)$/ },
    { k: 'DTS', rx: /^(DTS|DTSM|DTSH|DT4S|DTSHEAR|DTSXX|DTSYY|DTS1)$/ },
    { k: 'TEMP', rx: /^(TEMP|MTEM|BHT|TMP|FT|FLTEMP|WTEP|HTEM)$/ },
    { k: 'NMR', rx: /^(TCMR|CMRP|MPHE|PHIT_NMR|MRP|TPOR|CMFF|FFV|BFV|CBVI|T2LM|PHIE_NMR)$/ },
    { k: 'ROP', rx: /^(ROP|ROP5|ROPA|RATE)$/ }
  ];
  WL.kindOf = function (mn) { var m = String(mn || '').trim().toUpperCase().replace(/[\s.]+$/, ''); for (var i = 0; i < WL.KINDS.length; i++) if (WL.KINDS[i].rx.test(m)) return WL.KINDS[i].k; return ''; };
  /* display properties of each kind: track, scale [left, right], log scale, colour, dash, unit */
  WL.STYLE = {
    GR: { tr: 'gr', s: [0, 150], c: '#1a9850', u: 'gAPI' }, CGR: { tr: 'gr', s: [0, 150], c: '#7b3294', d: '5 3', u: 'gAPI' },
    SP: { tr: 'gr', s: null, c: '#2166ac', d: '6 3', u: 'mV' }, CALI: { tr: 'gr', s: [6, 16], c: '#222', d: '2 3', u: 'in' }, BS: { tr: 'gr', s: [6, 16], c: '#888', d: '1 4', u: 'in' },
    K: { tr: 'sgr', s: [0, 5], c: '#1b7837', u: '%' }, TH: { tr: 'sgr', s: [0, 25], c: '#b2182b', d: '5 3', u: 'ppm' }, U: { tr: 'sgr', s: [0, 15], c: '#2166ac', d: '2 2', u: 'ppm' },
    RD: { tr: 'res', s: [0.2, 2000], log: true, c: '#d7191c', u: 'ohm.m' }, RM: { tr: 'res', s: [0.2, 2000], log: true, c: '#2c7bb6', d: '6 3', u: 'ohm.m' }, RXO: { tr: 'res', s: [0.2, 2000], log: true, c: '#222', d: '2 2', u: 'ohm.m' },
    RHOB: { tr: 'nd', s: [1.95, 2.95], c: '#d7191c', u: 'g/cm3' }, NPHI: { tr: 'nd', s: [0.45, -0.15], c: '#2c7bb6', d: '6 3', u: 'v/v' }, PEF: { tr: 'nd', s: [0, 10], c: '#8e44ad', d: '1 3', u: 'b/e' },
    DRHO: { tr: 'nd', s: [-0.75, 0.25], c: '#999', d: '1 2', u: 'g/cm3', hide: true },
    DT: { tr: 'dt', s: [140, 40], c: '#111', u: 'us/ft' }, DTS: { tr: 'dt', s: [340, 40], c: '#e66101', d: '5 3', u: 'us/ft' },
    TEMP: { tr: 'dt', s: null, c: '#b35806', d: '1 3', u: 'degC' }
  };

  /* ---------------------------------------------------------------- readers */
  WL.num = function (s) { if (s == null) return NaN; s = String(s).trim().replace(',', '.'); if (s === '') return NaN; var v = +s; return isFinite(v) ? v : NaN; };
  /* LAS 2.0 (also wrapped files and most LAS 1.2): ~V, ~W, ~C, ~P and ~A sections */
  WL.readLAS = function (txt, name) {
    var lines = txt.replace(/\r/g, '').split('\n'), sec = '', well = {}, curves = [], params = {}, data = [], wrap = false, nul = -999.25;
    var head = function (l) { var m = l.match(/^\s*([^.\s]+)\s*\.(\S*)\s+(.*?)\s*:\s*(.*)$/) || l.match(/^\s*([^.\s]+)\s*\.(\S*)\s*:\s*(.*)$/); if (!m) return null; return m.length === 5 ? { mn: m[1], u: m[2], v: m[3], d: m[4] } : { mn: m[1], u: m[2], v: '', d: m[3] }; };
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i]; if (!l.trim() || l.trim()[0] === '#') continue;
      if (l.trim()[0] === '~') { sec = l.trim()[1].toUpperCase(); continue; }
      if (sec === 'A') { l.trim().split(/[\s,]+/).forEach(function (x) { data.push(WL.num(x)); }); continue; }
      var h = head(l); if (!h) continue;
      if (sec === 'V' && h.mn.toUpperCase() === 'WRAP') wrap = /YES/i.test(h.v);
      else if (sec === 'W') { well[h.mn.toUpperCase()] = { u: h.u, v: h.v, d: h.d }; if (h.mn.toUpperCase() === 'NULL') nul = WL.num(h.v); }
      else if (sec === 'C') curves.push({ mn: h.mn, u: h.u, d: h.d });
      else if (sec === 'P') params[h.mn.toUpperCase()] = { u: h.u, v: h.v, d: h.d };
    }
    if (!curves.length || !data.length) throw new Error('LAS');
    var nc = curves.length, nr = Math.floor(data.length / nc), cols = curves.map(function () { return new Float64Array(nr); });
    for (var r = 0; r < nr; r++) for (var c = 0; c < nc; c++) { var v = data[r * nc + c]; cols[c][r] = (v === nul || Math.abs(v - nul) < 1e-6 || v === -9999 || v === -999) ? NaN : v; }
    var wn = (well.WELL && well.WELL.v) || name, du = (well.STRT && well.STRT.u) || curves[0].u || 'm';
    return WL.makeWell(wn, curves.map(function (c, k) { return { mn: c.mn, u: c.u, d: c.d, v: cols[k] }; }), du, { field: well.FLD && well.FLD.v, comp: well.COMP && well.COMP.v, loc: well.LOC && well.LOC.v, src: name, params: params, wrap: wrap });
  };
  /* delimited text: comma, semicolon, tab or spaces; first line with words is the header (an optional second line of units) */
  WL.readTable = function (txt, name) {
    var lines = txt.replace(/\r/g, '').split('\n').filter(function (l) { return l.trim() && l.trim()[0] !== '#'; });
    if (lines.length < 3) throw new Error('table');
    var dl = /\t/.test(lines[0]) ? '\t' : /;/.test(lines[0]) ? ';' : /,/.test(lines[0]) ? ',' : /\s+/;
    var split = function (l) { return l.trim().split(dl).map(function (s) { return s.trim().replace(/^"|"$/g, ''); }); };
    var H = split(lines[0]), units = [], start = 1, s1 = split(lines[1]);
    if (s1.length === H.length && s1.every(function (x) { return !isFinite(WL.num(x)) || x === ''; }) && s1.some(function (x) { return x; })) { units = s1; start = 2; }
    var rows = lines.slice(start).map(split).filter(function (r) { return r.length >= 2; });
    return WL.fromRows(H, units, rows, name);
  };
  WL.fromRows = function (H, units, rows, name) {
    var nc = H.length, cols = H.map(function () { return new Float64Array(rows.length); });
    rows.forEach(function (r, i) { for (var c = 0; c < nc; c++) { var v = WL.num(r[c]); cols[c][i] = (v <= -999 && v >= -99999) ? NaN : v; } });
    var cs = H.map(function (h, k) { var m = String(h).match(/^\s*([^([]+?)\s*[([]\s*([^)\]]*)\s*[)\]]\s*$/); return { mn: m ? m[1] : String(h).trim(), u: m ? m[2] : (units[k] || ''), v: cols[k] }; });
    var di = cs.findIndex(function (c) { return WL.kindOf(c.mn) === 'DEPT'; }); if (di < 0) di = 0; if (di) cs.unshift(cs.splice(di, 1)[0]);
    return WL.makeWell(name, cs, cs[0].u || 'm', { src: name });
  };
  /* Excel .xlsx: the zip directory is read and each part inflated with the browser's own decompressor; first worksheet */
  WL.readXLSX = function (buf, name) {
    var u8 = new Uint8Array(buf), dv = new DataView(buf), eocd = -1;
    for (var i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) return Promise.reject(new Error('xlsx'));
    var n = dv.getUint16(eocd + 10, true), off = dv.getUint32(eocd + 16, true), files = {};
    for (var k = 0; k < n; k++) { var cm = dv.getUint16(off + 10, true), cs = dv.getUint32(off + 20, true), fl = dv.getUint16(off + 28, true), xl = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true), lo = dv.getUint32(off + 42, true);
      var fn = new TextDecoder().decode(u8.subarray(off + 46, off + 46 + fl)); files[fn] = { cm: cm, cs: cs, lo: lo }; off += 46 + fl + xl + cl; }
    var get = function (fn) { var f = files[fn]; if (!f) return Promise.resolve(null); var lh = f.lo, nl = dv.getUint16(lh + 26, true), el = dv.getUint16(lh + 28, true), st = lh + 30 + nl + el, raw = u8.subarray(st, st + f.cs);
      if (f.cm === 0) return Promise.resolve(new TextDecoder().decode(raw));
      if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('inflate'));
      return new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text(); };
    var sheet = Object.keys(files).filter(function (f) { return /^xl\/worksheets\/sheet\d+\.xml$/.test(f); }).sort()[0];
    return Promise.all([get('xl/sharedStrings.xml'), get(sheet)]).then(function (r) {
      var P = new DOMParser(), ss = [], col = function (ref) { var s = ref.replace(/\d+/g, ''), v = 0; for (var q = 0; q < s.length; q++) v = v * 26 + s.charCodeAt(q) - 64; return v - 1; };
      if (r[0]) Array.prototype.forEach.call(P.parseFromString(r[0], 'application/xml').getElementsByTagName('si'), function (si) { ss.push(Array.prototype.map.call(si.getElementsByTagName('t'), function (t) { return t.textContent; }).join('')); });
      var doc = P.parseFromString(r[1], 'application/xml'), grid = [];
      Array.prototype.forEach.call(doc.getElementsByTagName('row'), function (row) { var arr = []; Array.prototype.forEach.call(row.getElementsByTagName('c'), function (c) { var v = c.getElementsByTagName('v')[0], is = c.getElementsByTagName('t')[0], t = c.getAttribute('t'), val = v ? v.textContent : is ? is.textContent : '';
        if (t === 's') val = ss[+val]; arr[col(c.getAttribute('r'))] = val; }); grid.push(arr); });
      grid = grid.filter(function (r2) { return r2 && r2.some(function (x) { return x !== undefined && x !== ''; }); });
      var hi = grid.findIndex(function (r2) { return r2.some(function (x) { return x && !isFinite(WL.num(x)); }); }); if (hi < 0) throw new Error('xlsx');
      var H = grid[hi].map(function (x) { return x || ''; }), units = [], st2 = hi + 1, nx = grid[hi + 1] || [];
      if (nx.some(function (x) { return x && !isFinite(WL.num(x)); })) { units = nx; st2++; }
      return WL.fromRows(H, units, grid.slice(st2).map(function (r2) { return H.map(function (_, c) { return r2[c]; }); }), name);
    });
  };

  /* ---------------------------------------------------------------- normalised well */
  /* curves get a kind from the mnemonic; units are converted to: depth m or ft (kept), density g/cm³, neutron v/v
     (limestone units), sonic µs/ft, resistivity Ω·m */
  WL.makeWell = function (name, cs, du, meta) {
    var dep = cs[0].v, n = dep.length, ord = [];
    for (var i = 0; i < n; i++) if (isFinite(dep[i])) ord.push(i);
    if (ord.length > 1 && dep[ord[0]] > dep[ord[ord.length - 1]]) ord.reverse();
    var D = Float64Array.from(ord.map(function (i) { return dep[i]; })), unit = /f/i.test(du || '') ? 'ft' : 'm';
    var curves = cs.slice(1).map(function (c) {
      var v = Float64Array.from(ord.map(function (i) { return c.v[i]; })), k = WL.kindOf(c.mn), u = String(c.u || '').toLowerCase(), note = '';
      var fin = Array.prototype.filter.call(v, isFinite), med = fin.length ? fin.slice().sort(function (a, b) { return a - b; })[Math.floor(fin.length / 2)] : NaN;
      if (k === 'RHOB' && (/kg/.test(u) || med > 100)) { for (i = 0; i < v.length; i++) v[i] /= 1000; note = 'kg/m³ → g/cm³'; c.u = 'g/cm3'; }
      if (k === 'NPHI' && (/%|pu|p\.u/.test(u) || med > 1.5)) { for (i = 0; i < v.length; i++) v[i] /= 100; note = '% → v/v'; c.u = 'v/v'; }
      if ((k === 'DT' || k === 'DTS') && (/us\/m|µs\/m|usec\/m/.test(u) || (k === 'DT' && med > 160))) { for (i = 0; i < v.length; i++) v[i] *= 0.3048; note = 'µs/m → µs/ft'; c.u = 'us/ft'; }
      if (k === 'K' && med < 0.08 && med > 0) { for (i = 0; i < v.length; i++) v[i] *= 100; note = 'fraction → %'; c.u = '%'; }
      return { mn: c.mn, u: c.u, desc: c.d || '', kind: k, v: v, note: note, on: true };
    });
    var step = D.length > 1 ? (D[D.length - 1] - D[0]) / (D.length - 1) : 0;
    return { name: name || 'Well', D: D, unit: unit, curves: curves, step: step, meta: meta || {} };
  };
  WL.curve = function (w, kind) { for (var i = 0; i < w.curves.length; i++) if (w.curves[i].kind === kind && w.curves[i].on) return w.curves[i].v; return null; };

  /* ---------------------------------------------------------------- reference type section */
  /* typical responses of the main rocks and fluids, from the log-interpretation chart books and textbooks (Schlumberger
     1989/2009 charts; Rider & Kennedy 2011; Asquith & Krygowski 2004). Neutron in limestone units, Rw 0.05 Ω·m, Rmf 0.5 Ω·m. */
  WL.TYPE = [
    { id: 'sh', th: 12, en: 'Shale', ar: 'طفل (سجيل)', col: '#8c8c8c', GR: 115, K: 3.0, TH: 13, U: 3.5, SP: 0, CALI: 9.2, RD: 2.2, RM: 2.0, RXO: 2.4, RHOB: 2.45, NPHI: 0.34, PEF: 3.3, DT: 98, DTS: 220 },
    { id: 'ssw', th: 8, en: 'Sandstone, water', ar: 'حجر رملي مشبع بالماء', col: '#f6e05e', GR: 28, K: 0.6, TH: 2.5, U: 0.8, SP: -62, CALI: 8.3, RD: 1.0, RM: 2.0, RXO: 6.5, RHOB: 2.29, NPHI: 0.18, PEF: 1.9, DT: 86, DTS: 150 },
    { id: 'sho', th: 8, en: 'Sandstone, oil', ar: 'حجر رملي مشبع بالنفط', col: '#f6e05e', fl: 'oil', GR: 30, K: 0.6, TH: 2.6, U: 0.8, SP: -55, CALI: 8.3, RD: 26, RM: 14, RXO: 9, RHOB: 2.27, NPHI: 0.17, PEF: 1.9, DT: 88, DTS: 152 },
    { id: 'shg', th: 6, en: 'Sandstone, gas', ar: 'حجر رملي مشبع بالغاز', col: '#f6e05e', fl: 'gas', GR: 27, K: 0.6, TH: 2.4, U: 0.8, SP: -50, CALI: 8.3, RD: 45, RM: 22, RXO: 11, RHOB: 2.12, NPHI: 0.07, PEF: 1.8, DT: 98, DTS: 148 },
    { id: 'sh2', th: 6, en: 'Shale', ar: 'طفل (سجيل)', col: '#8c8c8c', GR: 110, K: 2.9, TH: 12, U: 3.2, SP: 0, CALI: 9.1, RD: 2.4, RM: 2.2, RXO: 2.6, RHOB: 2.47, NPHI: 0.33, PEF: 3.3, DT: 96, DTS: 215 },
    { id: 'hot', th: 5, en: 'Organic-rich shale (source rock)', ar: 'طفل غني بالمادة العضوية (صخر مصدري)', col: '#3d3d3d', GR: 210, K: 2.6, TH: 11, U: 16, SP: 0, CALI: 9.2, RD: 35, RM: 30, RXO: 20, RHOB: 2.32, NPHI: 0.30, PEF: 3.0, DT: 112, DTS: 230 },
    { id: 'lsw', th: 8, en: 'Limestone, water', ar: 'حجر جيري مشبع بالماء', col: '#6fa8dc', GR: 15, K: 0.2, TH: 1.0, U: 1.8, SP: -40, CALI: 8.4, RD: 3.4, RM: 6, RXO: 30, RHOB: 2.51, NPHI: 0.12, PEF: 5.0, DT: 65, DTS: 120 },
    { id: 'dlo', th: 8, en: 'Dolomite, oil', ar: 'دولومايت مشبع بالنفط', col: '#c27ba0', fl: 'oil', GR: 18, K: 0.3, TH: 1.2, U: 2.0, SP: -35, CALI: 8.4, RD: 70, RM: 45, RXO: 40, RHOB: 2.68, NPHI: 0.13, PEF: 3.1, DT: 58, DTS: 105 },
    { id: 'frc', th: 6, en: 'Tight fractured limestone', ar: 'حجر جيري محكم متكسر', col: '#3d85c6', GR: 12, K: 0.1, TH: 0.8, U: 1.5, SP: -15, CALI: 8.8, RD: 260, RM: 120, RXO: 45, RHOB: 2.62, NPHI: 0.05, PEF: 5.0, DT: 49, DTS: 95 },
    { id: 'anh', th: 5, en: 'Anhydrite', ar: 'أنهايدرايت', col: '#f4cccc', GR: 9, K: 0.1, TH: 0.5, U: 0.4, SP: -5, CALI: 8.5, RD: 2000, RM: 1500, RXO: 900, RHOB: 2.98, NPHI: -0.01, PEF: 5.05, DT: 50, DTS: 95 },
    { id: 'slt', th: 6, en: 'Rock salt (halite)', ar: 'ملح صخري (هالايت)', col: '#ffffff', GR: 6, K: 0.05, TH: 0.2, U: 0.2, SP: -3, CALI: 11.8, RD: 2000, RM: 2000, RXO: 1200, RHOB: 2.04, NPHI: -0.02, PEF: 4.65, DT: 67, DTS: 120 },
    { id: 'col', th: 3, en: 'Coal', ar: 'فحم', col: '#111111', GR: 22, K: 0.2, TH: 2, U: 1, SP: -20, CALI: 9.0, RD: 350, RM: 300, RXO: 250, RHOB: 1.42, NPHI: 0.52, PEF: 0.2, DT: 125, DTS: 260 },
    { id: 'sh3', th: 6, en: 'Shale', ar: 'طفل (سجيل)', col: '#8c8c8c', GR: 112, K: 3.0, TH: 12.5, U: 3.4, SP: 0, CALI: 9.3, RD: 2.3, RM: 2.1, RXO: 2.5, RHOB: 2.46, NPHI: 0.34, PEF: 3.3, DT: 97, DTS: 218 }
  ];
  /* example well built from the type section: transitions smoothed over the tool resolution, measurement noise added */
  WL.example = function () {
    var step = 0.1524, top = 2000, rows = [], z = top, rnd = (function () { var s = 7; return function () { s = (s * 16807) % 2147483647; return s / 2147483647 - 0.5; }; })();
    var K = ['GR', 'SP', 'CALI', 'RD', 'RM', 'RXO', 'RHOB', 'NPHI', 'PEF', 'DT', 'K', 'TH', 'U'], lay = [];
    WL.TYPE.forEach(function (t) { lay.push({ t: t, a: z, b: z + t.th }); z += t.th; });
    var at = function (d, key) { var w = 0, s = 0; lay.forEach(function (L) { var c = (L.a + L.b) / 2, h = (L.b - L.a) / 2, x = Math.abs(d - c) - h, wt = 1 / (1 + Math.exp(x / 0.18)); var v = L.t[key]; if (key === 'RD' || key === 'RM' || key === 'RXO') v = Math.log10(v); s += wt * v; w += wt; }); var r = s / w; return (key === 'RD' || key === 'RM' || key === 'RXO') ? Math.pow(10, r) : r; };
    var NS = { GR: 3, SP: 0.8, CALI: 0.03, RD: 0.03, RM: 0.03, RXO: 0.05, RHOB: 0.012, NPHI: 0.008, PEF: 0.08, DT: 0.8, K: 0.08, TH: 0.4, U: 0.25 };
    for (var d = top; d <= z; d += step) { var r = [d]; K.forEach(function (k) { var v = at(d, k), e = rnd() * 2 * NS[k]; r.push(/^R/.test(k) && k !== 'RHOB' ? v * Math.pow(10, e) : v + e); }); r.push(8.5); rows.push(r); }
    var cs = ['DEPT'].concat(K, ['BS']).map(function (k, i) { return { mn: k, u: { DEPT: 'm', GR: 'gAPI', SP: 'mV', CALI: 'in', BS: 'in', RD: 'ohm.m', RM: 'ohm.m', RXO: 'ohm.m', RHOB: 'g/cm3', NPHI: 'v/v', PEF: 'b/e', DT: 'us/ft', K: '%', TH: 'ppm', U: 'ppm' }[k], v: Float64Array.from(rows.map(function (r) { return r[i]; })) }; });
    cs[4].mn = 'LLD'; cs[5].mn = 'LLS'; cs[6].mn = 'MSFL';
    var w = WL.makeWell('Shandal type well', cs, 'm', { src: 'example', layers: lay.map(function (L) { return { a: L.a, b: L.b, id: L.t.id, en: L.t.en, ar: L.t.ar, fl: L.t.fl || '' }; }) });
    return w;
  };
})();
