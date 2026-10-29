# Writes tools/soil/data/figures.json: the values the soil story takes from the slides' charts, read off twice
# independently (two readers, each with its own crops and method) and reconciled here.
# The slides ("Exploring the Effects of Biological Nitrification Inhibition on the Rhizosphere Microbiome of a
# BNI-enabled Winter Wheat", Marina Montserrat Díez et al.) are not in the repository and none of their pictures is
# used; only these numbers are kept. Every chart in the deck is a picture, so every value here is a reading, approximate.
#   slide 6: chlorophyll (SPAD), soil ammonium and nitrate (mg N/kg dry soil) by day, regime and wheat line
#   slide 7: N2O (ppm) in incubations of each day's rhizosphere soil, ten readings over 20 to 22 days
#   slide 9: amoA gene copies per g dry soil (qPCR) of ammonia-oxidising archaea (AOA) and bacteria (AOB)
# Rule: where both readers give a value and they agree within their reading precision (the sum of the two readers'
# stated precisions), the value is their mean; where they differ by more, it is still their mean but flagged
# ('disagree', with both values kept); where one reader could not see a point (hidden behind the other line), the other
# reader's value is taken ('one'); where neither could, and both say the point lies under the other line's, the other
# line's value is taken ('under'). Error bars: the mean of the two readers' half-lengths (the slides do not say whether
# they are SD or SE; the notes' caption of slide 6 says SD).
# usage: python -I tools/soil/data/reconcile.py <reader A readings.json> <reader B readings.json>
import sys, os, json

A_PATH, B_PATH = sys.argv[1], sys.argv[2]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'figures.json')
A, B = json.load(open(A_PATH)), json.load(open(B_PATH))
FERTS = ['Not fertilised', 'Fertilised', 'Fertilised+DCD']
FERTS_B = ['Not Fertilized', 'Fertilized', 'Fertilized+DCD']
DAYS = [1, 15, 24, 53, 70]
LINES = ['BNI', 'ctrl']
log = []


def rnd(x, k):
    return None if x is None else round(float(x), k)


def merge(a, b, tol, k, what):
    """a, b: (mean or None, half error bar or None); returns the reconciled entry"""
    (ma, ea), (mb, eb) = a, b
    e = [x for x in (ea, eb) if x is not None]
    err = rnd(sum(e) / len(e), k) if e else None
    if ma is not None and mb is not None:
        d = abs(ma - mb)
        o = {'v': rnd((ma + mb) / 2, k), 'err': err, 'a': rnd(ma, k), 'b': rnd(mb, k)}
        if d > tol:
            o['flag'] = 'disagree'
            log.append(f'disagree {what}: {ma} vs {mb} (tolerance {tol})')
        return o
    if ma is not None or mb is not None:
        return {'v': rnd(ma if ma is not None else mb, k), 'err': err, 'a': rnd(ma, k), 'b': rnd(mb, k), 'flag': 'one'}
    return {'v': None, 'err': None, 'a': None, 'b': None}


# ---- slide 6: chlorophyll, ammonium, nitrate ----
S6A, S6B = A['slide6']['data'], B['slide6']['data']
BKEY = {'chl': 'chlorophyll_SPAD', 'nh4': 'NH4_mg_N_per_kg_dry_soil', 'no3': 'NO3_mg_N_per_kg_dry_soil'}
TOL6 = {'chl': 0.3 + 0.15, 'nh4': 2 + 2, 'no3': 1 + 1}   # the readers' stated precisions, added
DIG6 = {'chl': 2, 'nh4': 1, 'no3': 1}
slide6 = {}
for m in ['chl', 'nh4', 'no3']:
    out = []
    for f, fb in zip(FERTS, FERTS_B):
        row = []
        for d in DAYS:
            cell = []
            for l in LINES:
                a = S6A.get(f'{m}|{f}|{d}|{l}', {})
                b = S6B[BKEY[m]][fb][str(d)]['Munal-' + l]
                ma = a.get('mean')
                ea = (a['hi'] - a['lo']) / 2 if a.get('hi') is not None and a.get('lo') is not None else None
                mb, eb = b.get('mean'), b.get('err')
                hidden_a = ma is not None and ea is None and 'hidden' in str(a.get('note', ''))
                o = merge((ma, ea), (mb, eb), TOL6[m], DIG6[m], f'slide 6 {m} {f} day {d} {l}')
                if hidden_a and mb is None:
                    o['flag'] = 'under'   # reader A's guess for a point hidden under the other line's
                if m == 'chl' and d == 53:
                    o = {'v': None, 'note': 'no reading on day 53 (both readers: the chart has no point there)'}
                cell.append(o)
            row.append(cell)
        out.append(row)
    slide6[m] = out
# where a point is hidden under the other line's in both readings (or only guessed), take the other line's value
for m in slide6:
    for row in slide6[m]:
        for cell in row:
            for i, o in enumerate(cell):
                other = cell[1 - i]
                if o.get('v') is None and other.get('v') is not None and o.get('note') is None:
                    o.update({'v': other['v'], 'flag': 'under'})
stars6 = B['slide6']['stars']
same_stars = json.dumps(A['slide6']['stars_above_panel']['chl'], sort_keys=True) == json.dumps(
    {k.replace('Fertilized', 'Fertilised').replace('Not Fertilised', 'Not fertilised'): v for k, v in stars6['chlorophyll_SPAD'].items()}, sort_keys=True)
log.append(f'slide 6 stars (chlorophyll) agree: {same_stars}')

# ---- slide 7: N2O incubation curves ----
S7A, S7B = A['slide7']['data'], B['slide7']['data']
TIMES = A['slide7']['sample_times_days']
assert TIMES == B['slide7']['times_days'], 'the readers read different incubation times'
curves, peaks = [], []
for d in DAYS:
    rowc, rowp = [], []
    for f, fb in zip(FERTS, FERTS_B):
        lines = []
        for l in LINES:
            pa, pb = S7A[f'{d}|{f}|{l}'], S7B[str(d)][fb]['Munal-' + l]
            pts = []
            for k, t in enumerate(TIMES):
                a, b = pa[k], pb[k]
                assert a['t'] == t and b['t'] == t
                ea = (a['hi'] - a['lo']) / 2 if a.get('hi') is not None and a.get('lo') is not None else None
                pts.append(merge((a.get('mean'), ea), (b.get('mean'), b.get('err')), 0.06, 2, f'slide 7 day {d} {f} {l} t {t}'))
            lines.append(pts)
        # a point neither reader saw lies under the other line's (both readers say so): take that value
        for i in range(2):
            for k in range(len(TIMES)):
                if lines[i][k]['v'] is None and lines[1 - i][k]['v'] is not None:
                    lines[i][k].update({'v': lines[1 - i][k]['v'], 'flag': 'under'})
        rowc.append([[p['v'] for p in pts] for pts in lines])
        rowp.append([max((p['v'] for p in pts if p['v'] is not None), default=None) for pts in lines])
        rowc[-1] = {'BNI': lines[0], 'ctrl': lines[1]}
    curves.append(rowc)
    peaks.append(rowp)
pA, pB = A['slide7']['germline_p_by_day'], B['slide7']['germline_p_printed']
germ = []
for d in DAYS:
    row = []
    for f, fb in zip(FERTS, FERTS_B):
        sa, sb = pA[str(d)][f], pB[str(d)][fb]
        if sa.replace('p', '').replace(' ', '').replace('=', '') != sb.replace(' ', '').replace('=', ''):
            log.append(f'slide 7 printed p, day {d} {f}: "{sa}" vs "{sb}" (kept A\'s; the stars differ only in how they were copied)')
        row.append(sa)
    germ.append(row)

# ---- slide 9: qPCR of amoA ----
S9A, S9B = A['slide9']['data'], B['slide9']['data']
TOL9 = {'AOA': 1.5e6 + 1e6, 'AOB': 0.6e6 + 0.3e6}
qpcr = {}
for g in ['AOA', 'AOB']:
    out = []
    for f, fb in zip(FERTS, FERTS_B):
        row = []
        for d in DAYS:
            cell = []
            for l in LINES:
                a, b = S9A.get(f'{g}|{f}|{d}|{l}', {}), S9B[g][fb][str(d)]['Munal-' + l]
                ea = (a['hi'] - a['lo']) / 2 if a.get('hi') is not None and a.get('lo') is not None else None
                tol = TOL9[g] + (0.4e6 if g == 'AOB' and f == 'Not fertilised' else 0)
                o = merge((a.get('mean'), ea), (b.get('mean'), b.get('err')), tol, -4, f'slide 9 {g} {f} day {d} {l}')
                cell.append(o)
            row.append(cell)
        out.append(row)
    qpcr[g] = out

flagged = sum(1 for m in slide6 for row in slide6[m] for c in row for o in c if o.get('flag') == 'disagree') + \
    sum(1 for row in curves for c in row for l in c.values() for o in l if o.get('flag') == 'disagree') + \
    sum(1 for g in qpcr for row in qpcr[g] for c in row for o in c if o.get('flag') == 'disagree')
data = {
    'source': 'the slides "Exploring the Effects of Biological Nitrification Inhibition on the Rhizosphere Microbiome of '
              'a BNI-enabled Winter Wheat" (Marina Montserrat Díez, Tadashi Yoshihashi, Guntur Subbarao Ventaka, '
              'Eleftheria Bachtsevani, Dimitrios Karpouzas, Christina Hazard, Melina Kerou, Christa Schleper): its charts '
              'read off by two independent readers (A and B) and reconciled by tools/soil/data/reconcile.py',
    'rule': 'v: the mean of the two readings where both exist; flag "disagree" where they differ by more than the sum of '
            'the readers\' precisions, "one" where only one reader saw the point, "under" where the point lies under the '
            'other line\'s and that value is taken; err: the mean half-length of the error bars (SD per the notes\' caption '
            'of slide 6; not said for slides 7 and 9)',
    'days': DAYS, 'ferts': FERTS, 'lines': ['BNI', 'ctrl'],
    'slide6': {'units': {'chl': 'SPAD index', 'nh4': 'mg N/kg dry soil', 'no3': 'mg N/kg dry soil'},
               'order': '[fert][day][line]', 'chl': slide6['chl'], 'nh4': slide6['nh4'], 'no3': slide6['no3'],
               'stars': {'chl': stars6['chlorophyll_SPAD'], 'no3': stars6['NO3']},
               'stars_note': 'printed above a day: * p < 0.05, . p < 0.06 (Wilcoxon, BNI against control; the notes\' caption)',
               'note': 'chlorophyll has no point on day 53 (the lines run from day 24 to day 70)'},
    'slide7': {'units': 'N2O ppm in the jar\'s air', 'incubation': A['slide7']['incubation'],
               'incubation_note': 'the slide says 20 days of incubation, the notes\' caption 22; the x axis runs to about 22',
               'times': TIMES, 'order': '[day][fert] -> { BNI: [points], ctrl: [points] }', 'curves': curves,
               'peaks': peaks, 'peaks_order': '[day][fert][line]', 'germline_p': germ,
               'germline_p_note': 'printed on each panel: the wheat line\'s effect in a mixed model over the incubation '
                                  '(Type III ANOVA; the notes\' caption)'},
    'slide9': {'units': 'amoA gene copies per g dry soil', 'order': '[fert][day][line]', 'AOA': qpcr['AOA'], 'AOB': qpcr['AOB'],
               'annotation': 'the only one printed: AOA, fertilised, day 24, p = 0.057'},
    'flagged': flagged, 'log': log,
}
with open(OUT, 'w', encoding='utf-8') as fh:
    json.dump(data, fh, ensure_ascii=False, indent=1)
print('\n'.join(log))
print('wrote', OUT, os.path.getsize(OUT) // 1024, 'KB;', flagged, 'values flagged')
