# Cartarius

Juego de geografía en el navegador.

- **Completa el mapa** (`index.html`): países, banderas, capitales, ríos y ciudades sobre un mapa en blanco.
- **Modo Quiz** (`quiz.html` en la pantalla grande, `play.html` en los móviles): sala con código de 4 caracteres y QR.

Sin compilación: HTML, CSS y JS. Basta con servir la carpeta (`python -m http.server`).

## Quiz con Firebase

1. `js/firebase-config.js` contiene la configuración web del proyecto (es pública por diseño).
2. En Firebase: Authentication → Anónimo activado; Realtime Database → Reglas → pegar `firebase-rules.json`.
3. Con `?local` en la URL el Quiz funciona sin Firebase entre pestañas del mismo navegador.

## Datos

Datos de países a partir de REST Countries; mapas, ríos y ciudades de [Natural Earth](https://www.naturalearthdata.com/) (dominio público). Scripts en `tools/`.
