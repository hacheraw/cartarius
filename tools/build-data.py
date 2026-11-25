"""Genera data/countries.json (y data/countries.js para abrir el juego sin servidor)
a partir de data/raw/restcountries-v5.json + data/overrides.json.
Uso: python3 tools/build-data.py
"""
import json, os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
raw = json.load(open(os.path.join(ROOT, 'data/raw/restcountries-v5.json'), encoding='utf-8'))
ov = json.load(open(os.path.join(ROOT, 'data/overrides.json'), encoding='utf-8'))
def capital_of(a2, c):
    """Capital principal (la primera si hay varias) con su nombre en es/en/local."""
    caps = c.get('capitals', [])
    if caps:
        x = next((x for x in caps if x['attributes'].get('primary')), caps[0])
        en0, lat, lng = x['name'], x['coordinates']['lat'], x['coordinates']['lng']
    else:
        x = ov.get('capitales_extra', {}).get(a2)
        if not x: return None
        en0, lat, lng = x['nombre'], x['lat'], x['lng']
    en = ov.get('capitales_en', {}).get(a2) or en0
    es = ov.get('capitales', {}).get(a2) or en
    local = ov.get('capitales_local', {}).get(a2) or en
    return {'nombre': es, 'nombre_en': en, 'nombres': {'es': es, 'en': en, 'local': local}, 'lat': lat, 'lng': lng}

def native_name(a2, c):
    if a2 in ov.get('nombres_local', {}): return ov['nombres_local'][a2]
    nat = (c.get('names') or {}).get('native') or {}
    for l in c.get('languages', []):
        k = l.get('iso639_3') or l.get('iso639_2t')
        if k in nat: return nat[k]['common'].replace('\u200f', '').replace('\u200e', '').strip()
    return next(iter(nat.values()))['common'].strip() if nat else None
cont_of = {i: c for c, s in ov['continentes'].items() for i in s.split()}
a3_to_a2 = {c['codes']['alpha_3']: c['codes']['alpha_2'] for c in raw['countries'] if c['codes'].get('alpha_2')}

def estatus(c):
    k = c.get('classification', {})
    if k.get('un_member'): return 'onu'
    if k.get('un_observer'): return 'observador'
    if k.get('disputed') or k.get('dependency_type') == 'disputed': return 'reconocimiento_limitado'
    if k.get('dependency'): return 'dependiente'
    return 'otro'

out = []
for c in raw['countries']:
    a2 = c['codes'].get('alpha_2')
    if not a2: continue  # Abjasia, Osetia del Sur, Chipre del Norte, Somalilandia: sin código ISO
    n = c['names']; spa = n.get('translations', {}).get('spa', {})
    k = c.get('classification', {})
    f = c.get('flag', {})
    out.append({
        'iso2': a2, 'iso3': c['codes'].get('alpha_3'), 'ccn3': c['codes'].get('ccn3'),
        'nombre': ov['nombres'].get(a2) or spa.get('common') or n['common'],
        'nombre_oficial': spa.get('official') or n['official'],
        'nombre_en': ov.get('nombres_en', {}).get(a2) or n['common'],
        'nombres': {'es': ov['nombres'].get(a2) or spa.get('common') or n['common'],
                    'en': ov.get('nombres_en', {}).get(a2) or n['common'],
                    'local': native_name(a2, c) or ov.get('nombres_en', {}).get(a2) or n['common']},
        'continente': cont_of.get(a2),
        'region': c.get('region'), 'subregion': c.get('subregion'),
        'estatus': estatus(c),
        'tipo_dependencia': k.get('dependency_type') or None,
        'soberano': (c.get('parent') or {}).get('alpha_2') or None,
        'capitales': [{'nombre': x['name'], 'lat': x['coordinates']['lat'], 'lng': x['coordinates']['lng'],
                       'principal': x['attributes'].get('primary', False)} for x in c.get('capitals', [])],
        'capital': capital_of(a2, c),
        'bandera': {'svg': 'data/flags/%s.svg' % a2.lower() if f.get('url_svg') else None, 'emoji': f.get('emoji'),
                    'color': (f.get('colors') or {}).get('prominent'), 'descripcion_en': f.get('description') or None},
        'centro': [c.get('coordinates', {}).get('lat'), c.get('coordinates', {}).get('lng')],
        'area_km2': (c.get('area') or {}).get('kilometers'),
        'poblacion': c.get('population'),
        'idiomas': [{'iso': l.get('iso639_1') or l.get('iso639_3'), 'nombre_en': l.get('name'), 'nativo': l.get('native_name')} for l in c.get('languages', [])],
        'monedas': c.get('currencies', []),
        'fronteras': [a3_to_a2.get(b, b) for b in c.get('borders', [])],
        'sin_litoral': c.get('landlocked'),
        'husos': c.get('timezones', []),
        'prefijos': c.get('calling_codes', []),
        'dominios': c.get('tlds', []),
        'conduccion': (c.get('cars') or {}).get('driving_side'),
        'miembro': [m for m, v in (c.get('memberships') or {}).items() if v],
    })
out.sort(key=lambda x: x['iso2'])
meta = {'fuente': 'REST Countries v5', 'descargado': raw['fetched_at'], 'total': len(out)}
js = json.dumps({'meta': meta, 'paises': out}, ensure_ascii=False, separators=(',', ':'))
open(os.path.join(ROOT, 'data/countries.json'), 'w', encoding='utf-8').write(
    json.dumps({'meta': meta, 'paises': out}, ensure_ascii=False, indent=1))
open(os.path.join(ROOT, 'data/countries.js'), 'w', encoding='utf-8').write('window.CARTARIUS_COUNTRIES=' + js + ';\n')
from collections import Counter
print(len(out), 'países;', dict(Counter(x['estatus'] for x in out)), '; sin continente:', [x['iso2'] for x in out if not x['continente']])
