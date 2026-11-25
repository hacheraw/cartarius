"""Genera una versión de una sola página (CSS/JS en línea, D3 desde cdnjs, datos por fetch) para publicarla como vista previa.
Uso: python3 tools/build-artifact.py <carpeta_salida>   (copia también data/world.json y data/countries.json)
"""
import sys, re, os, shutil
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
out = sys.argv[1]; os.makedirs(os.path.join(out, 'data'), exist_ok=True)
rd = lambda p: open(os.path.join(ROOT, p), encoding='utf-8').read()
s = rd('index.html')
head = s[s.index('<title>'):s.index('</head>')]
head = re.sub(r'<meta charset[^>]*>\s*|<meta name="viewport"[^>]*>\s*', '', head)
head = head.replace('<link rel="stylesheet" href="css/cartarius.css">', '<style>\n' + rd('css/cartarius.css') + '</style>')
body = s[s.index('<body>') + 6:s.index('</body>')]
# El Quiz necesita sus propias páginas (quiz.html, play.html): no entra en la vista previa de una sola página
body = re.sub(r'<a class="btn primary" id="quizBtn"[^>]*>.*?</a>', '', body)
for a, b in [('<script src="js/vendor/d3.min.js"></script>', '<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>'),
             ('<script src="data/world.js"></script>\n', ''), ('<script src="data/countries.js"></script>\n', ''), ('<script src="data/features.js"></script>\n', ''),
             ('<script src="js/i18n.js"></script>', '<script>\n' + rd('js/i18n.js') + '\n</script>'),
             ('<script src="js/geo.js"></script>', '<script>window.CARTARIUS_FLAGS_URL = "data/flags.json";</script>\n<script>\n' + rd('js/geo.js') + '\n</script>'),
             ('<script src="js/app.js"></script>', '<script>\n' + rd('js/app.js') + '\n</script>')]:
    assert a in body, a
    body = body.replace(a, b)
open(os.path.join(out, 'cartarius.html'), 'w', encoding='utf-8').write(head + body)
for f in ('world.json', 'countries.json', 'features.json'):
    shutil.copy(os.path.join(ROOT, 'data', f), os.path.join(out, 'data', f))
import json
flags = {f[:-4]: open(os.path.join(ROOT, 'data', 'flags', f), encoding='utf-8').read() for f in sorted(os.listdir(os.path.join(ROOT, 'data', 'flags')))}
json.dump(flags, open(os.path.join(out, 'data', 'flags.json'), 'w', encoding='utf-8'), separators=(',', ':'))
print('ok')
