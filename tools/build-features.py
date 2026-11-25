"""Genera data/features.json (y data/features.js) con los ríos y ciudades del juego
a partir de Natural Earth 10m (dominio público), guardado en data/raw/ne/*.zip.

  - Ríos: lista elegida a mano en data/curated/rios.json (nombres es/en/local y tramos por id de Wikidata).
  - Ciudades: las más pobladas de cada continente, separadas entre sí para que no se amontonen.
    Nombre local: el de Natural Earth en el idioma principal del país si lo tiene; si no, el nombre propio de NE.

Requisitos: pip install pyshp shapely
Uso: python3 tools/build-features.py
Para volver a descargar: tools/fetch-ne.sh
"""
import json, os, zipfile, io, math, tempfile
import shapefile
from shapely.geometry import shape, mapping, MultiLineString, LineString
from shapely.ops import linemerge

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
P = lambda *a: os.path.join(ROOT, *a)


def read_zip(name):
    tmp = tempfile.mkdtemp()
    zipfile.ZipFile(P('data/raw/ne', name + '.zip')).extractall(tmp)
    shp = [f for f in os.listdir(tmp) if f.endswith('.shp')][0]
    return shapefile.Reader(os.path.join(tmp, shp), encoding='utf-8')


def rnd(geom, nd=2):
    def r(c): return [round(c[0], nd), round(c[1], nd)]
    if geom.geom_type == 'LineString':
        return [[r(c) for c in geom.coords]]
    return [[r(c) for c in g.coords] for g in geom.geoms]


countries = {c['iso2']: c for c in json.load(open(P('data/countries.json'), encoding='utf-8'))['paises']}
iso3 = {c['iso3']: c['iso2'] for c in countries.values() if c.get('iso3')}

# ---------- Ríos ----------
cur = json.load(open(P('data/curated/rios.json'), encoding='utf-8'))['rios']
want = {i for r in cur for i in r['ids']}
segs = {}
for sr in read_zip('ne_10m_rivers_lake_centerlines').iterShapeRecords():
    q = sr.record['wikidataid']
    if q in want:
        segs.setdefault(q, []).append(shape(sr.shape.__geo_interface__))

rivers = []
for i, r in enumerate(cur):
    lines = []
    for q in r['ids']:
        for g in segs.get(q, []):
            parts = list(g.geoms) if g.geom_type == 'MultiLineString' else [g]
            for p in parts:
                lat = p.centroid.y
                if 'lat_min' in r and lat < r['lat_min']: continue
                if 'lat_max' in r and lat > r['lat_max']: continue
                lines.append(p)
    if not lines:
        print('SIN GEOMETRÍA:', r['en']); continue
    g = linemerge(MultiLineString(lines)).simplify(0.02, preserve_topology=False)
    rivers.append({'id': 'r%d' % i, 'cont': r['cont'], 'nombres': {'es': r['es'], 'en': r['en'], 'local': r['local']},
                   'nace': r.get('nace', []), 'desemboca': r.get('desemboca', []),
                   'lineas': rnd(g)})

# ---------- Ciudades ----------
NE_LANGS = {'ar', 'bn', 'de', 'el', 'en', 'es', 'fa', 'fr', 'he', 'hi', 'hu', 'id', 'it', 'ja', 'ko', 'nl', 'pl', 'pt', 'ru', 'sv', 'tr', 'uk', 'ur', 'vi', 'zh'}
PER_CONT = {'EU': 40, 'AS': 45, 'AF': 35, 'AM': 40, 'OC': 15}
SPACING = {'EU': 1.2, 'AS': 1.6, 'AF': 1.6, 'AM': 1.6, 'OC': 1.2}
WORLD_N, WORLD_SPACING = 80, 3.0


def dist(a, b):
    dx = (a['lng'] - b['lng']) * math.cos(math.radians((a['lat'] + b['lat']) / 2))
    return math.hypot(dx, a['lat'] - b['lat'])


places = []
for rec in read_zip('ne_10m_populated_places').records():
    p = rec.as_dict()
    iso = p['ISO_A2'] if p['ISO_A2'] in countries else iso3.get(p['ADM0_A3'])
    if not iso: continue
    c = countries[iso]
    cont = c.get('continente')
    if iso == 'RU' and p['LONGITUDE'] >= 60: cont = 'AS'
    if not cont or cont not in PER_CONT: continue
    lang = next((l['iso'] for l in c.get('idiomas', []) if l.get('iso') in NE_LANGS), None)
    if iso == 'CN': lang = 'zh'
    local = (p.get('NAME_' + lang.upper()) if lang else None) or p['NAME']
    places.append({'iso': iso, 'cont': cont, 'lat': round(p['LATITUDE'], 3), 'lng': round(p['LONGITUDE'], 3),
                   'pop': int(p['POP_MAX'] or 0), 'capital': bool(p['ADM0CAP']),
                   'nombres': {'es': p['NAME_ES'] or p['NAME_EN'] or p['NAME'], 'en': p['NAME_EN'] or p['NAME'], 'local': local}})
# Retoques de nombres (clave: NAME_EN de Natural Earth)
FIX = {'New York City': {'en': 'New York', 'local': 'New York', 'es': 'Nueva York'}, 'Tokyo': {'local': '東京'}}
for x in places:
    x['nombres'].update(FIX.get(x['nombres']['en'], {}))
places.sort(key=lambda x: -x['pop'])


def pick(pool, n, spacing):
    out = []
    for x in pool:
        if len(out) >= n: break
        if all(dist(x, y) >= spacing for y in out): out.append(x)
    return out


chosen = {}
for cont, n in PER_CONT.items():
    for x in pick([p for p in places if p['cont'] == cont], n, SPACING[cont]):
        chosen[id(x)] = x
for x in pick(places, WORLD_N, WORLD_SPACING):
    chosen[id(x)] = x; x['mundo'] = True
cities = sorted(chosen.values(), key=lambda x: -x['pop'])
for i, x in enumerate(cities):
    x['id'] = 'c%d' % i

out = {'meta': {'fuente': 'Natural Earth 10m (dominio público)', 'rios': len(rivers), 'ciudades': len(cities)},
       'rios': rivers, 'ciudades': cities}
s = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
open(P('data/features.json'), 'w', encoding='utf-8').write(s)
open(P('data/features.js'), 'w', encoding='utf-8').write('window.CARTARIUS_FEATURES = ' + s + ';\n')
print('%d ríos, %d ciudades, %.0f KB' % (len(rivers), len(cities), len(s) / 1024))
