# EarPiano

Tu repertorio de canciones con acordes, y una zona para practicar piano. Solo tú editas; quien tenga el enlace puede mirar. No necesita cuenta.

## Lo básico

- **Buscar una canción:** escribe en el buscador y toca la canción.
- **Ver acordes y letra:** dentro de la canción hay dos pestañas, *Acordes* y *Letra*.
- **Presentar:** el botón **▶ Presentar** abre la canción en pantalla completa y baja sola.
- **Instalar en el teléfono:** en el menú del navegador, *Instalar app* o *Añadir a pantalla de inicio*.
- **Sin internet:** abre la página una vez con internet y después se ve la última copia guardada.

## Practicar

Toca **Practicar**. Ahí hay lectura de notas, teclado, escalas, oído, lecciones cortas y retos. Los retos no usan sonido ni internet.

Dentro de los retos está **Lectura a primera vista**: sale una frase, la lees y la tocas en tu piano. Puedes agregar ritmo y un metrónomo con tempo de 50 a 120.

## Teoría

Escalas, modos, acordes y el círculo de quintas.

## Editar canciones

Toca 5 veces el título (o abre `/?editar`) y pon tu contraseña. Ahí puedes agregar, editar y borrar canciones. En *Ajustes* puedes descargar una copia de seguridad.

## Junto con TimerPiano

TimerPiano es la otra app: un temporizador de práctica. Al terminar una sesión, su botón **Sumar a EarPiano** te trae aquí el tiempo practicado.

## Conectar las dos apps (una sola vez, en Vercel)

Para que EarPiano muestre lo que practicas en TimerPiano sin copiar nada:

1. En los dos proyectos de Vercel usa el **mismo `SESSION_SECRET`**. Así entras una vez con tu contraseña y el pase vale en las dos.
2. Conecta los dos proyectos al **mismo almacén de Vercel Blob** (el mismo `BLOB_READ_WRITE_TOKEN`).

TimerPiano deja un resumen en `timerpiano/totales.json` cada vez que sincronizas. EarPiano solo lee ese resumen. Si no lo conectas, sigue funcionando con el botón **Sumar a EarPiano**.
