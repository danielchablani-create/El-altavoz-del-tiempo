# El altavoz del tiempo

Aplicación web estática. No necesita instalación de paquetes, servidor propio ni compilación.

## Publicar en Netlify
1. Descomprime el ZIP.
2. En los despliegues de tu proyecto de Netlify, sube la carpeta que contiene index.html.
3. Incluye todos los archivos y la carpeta assets. index.html debe estar en la raíz publicada.
4. Abre tu dirección HTTPS y recarga la página después de actualizarla.

Las cinco pantallas son: presentación, biblioteca, creación del vinilo, gramófono y solución con TV.

## Crear tu biblioteca
La primera vez está vacía. Descarga la plantilla CSV desde la biblioteca. Cada fila debe contener Título, Artista, Año y YouTube (enlace o ID del vídeo). Inicio es opcional: segundos, minutos:segundos o horas:minutos:segundos. BPM es una columna opcional compatible con versiones anteriores, no es necesaria para el juego.

La plantilla contiene dos ejemplos que puedes reemplazar. Guarda el archivo como CSV UTF-8: admite separador coma, punto y coma o tabulador, campos entre comillas y tildes. No admite archivos Excel. Límite: 5 MB y 3.000 canciones por importación.

Pulsa «Cargar CSV», ponle nombre al vinilo, elige el archivo y revisa los errores. «Guardar vinilo» añade solo las canciones válidas y vuelve a la biblioteca. Los vinilos se guardan en una caja de madera con sus propias fundas. Puedes hojear las colecciones deslizando a los lados (la animación pasa las fundas hacia delante y hacia atrás), con los botones Anterior/Siguiente o las flechas del teclado. Tira de la funda hacia arriba para sacarla y abrir el gramófono, o pulsa «Escuchar este vinilo». La caja empieza vacía y solo muestra colecciones reales. Los vídeos duplicados se omiten dentro de un mismo vinilo; el mismo vídeo puede estar en distintos vinilos.

Puedes añadir canciones a un vinilo existente desde «＋ Canciones» o exportarlo como CSV. Los vinilos se guardan en el navegador y dominio en que los creas; exporta una copia para conservarlos o pasarlos a otro móvil. No se comparten automáticamente entre dispositivos.

## Jugar
Elige una funda de la caja de vinilos. El gramófono carga una canción aleatoria de esa lista. El disco gira con el nombre de tu colección en el centro; mueve el brazo para colocar la aguja y escuchar. Retírala para pausar. También puedes tocar la aguja o seleccionarla con Tab y usar Intro/Espacio.

La canción, artista, año e imagen de YouTube permanecen ocultos hasta pulsar ?. Esto abre otra pantalla con la solución y el vídeo reproduciéndose en la TV antigua. Se utiliza un único reproductor, sin cambiar de vídeo ni reiniciar su posición al revelar. «Siguiente canción» vuelve al gramófono, oculta el vídeo y deja la aguja en reposo. Las canciones no se repiten hasta agotar el vinilo. Al volver a mezclar se evita repetir inmediatamente la última si hay más de una canción.

La partida guarda una copia de la lista del vinilo elegido para poder reanudarse sin mezclar otras colecciones. Puedes volver a escuchar la última canción desde la presentación, pero debes activar tú el sonido.

«Jugadores y marcador» permite cambiar los nombres de 2 a 6 jugadores. En la solución puedes repartir una ficha por canción, artista y año en cada ronda. Este registro es opcional.

## YouTube y móviles
Hace falta Internet y un servidor HTTPS. No abras index.html directamente como archivo local para probar la reproducción: YouTube necesita el origen y el referrer del sitio. El archivo _headers mantiene una política de referrer compatible con el reproductor.

El navegador puede pedir otro toque en la aguja para autorizar el audio. La aplicación muestra un aviso y, en la TV, permite tocar «Activar sonido y vídeo» o usar los controles de YouTube. Algunos vídeos pueden no estar disponibles por país, haber sido retirados o impedir la inserción. Verificar el formato del enlace al importar no garantiza que el vídeo pueda reproducirse.

La TV mantiene el reproductor oficial con sus controles. El marco no recorta la imagen del vídeo. Las ilustraciones son recursos generados para esta aplicación. Las tipografías se descargan de Google Fonts y cuentan con alternativas del sistema.

## Archivos
index.html, styles.css, catalog.js (CSV), engine.js (biblioteca y partida), app.js (interacciones y YouTube), assets/ (gramófono, TV y caja de vinilos), plantilla-canciones.csv, icon.svg, manifest.webmanifest y _headers.

## Vista aérea durante la escucha
Cuando YouTube confirma que la canción está sonando, la vista se acerca al plato y pasa al gramófono visto desde arriba. Se ven el vinilo entero girando, el nombre de la colección y la bocina dorada. La aguja se puede retirar y colocar en esta vista; al pausar se conserva el encuadre para reanudar cómodamente. Al pasar a otra canción vuelve la vista inicial. La transición respeta la preferencia del dispositivo de reducir movimiento.

## Formato horizontal y rondas
Gira el móvil o la tableta a posición horizontal para usar la distribución apaisada. En dispositivos y navegadores compatibles, la app instalada solicita orientación horizontal. El navegador puede permitir también el uso vertical; la interfaz conserva una distribución alternativa para ese caso.

En la biblioteca, antes de elegir el vinilo, selecciona 5, 10, 15 o 20 rondas, o escribe una cantidad entera de 1 a 100. Cada ronda contiene una canción. Se muestra el progreso, por ejemplo «3 / 10». La duración elegida se conserva al reanudar la partida. Si el vinilo tiene menos canciones, se vuelve a mezclar al agotarlas.

En la última solución, el botón cambia a «Ver resultado final». Abre el resumen y el marcador opcional, y permite repetir con la misma duración o volver a elegir otro vinilo. La partida no pasa del límite seleccionado.

## Botones y rueda del gramófono
Los tres botones dibujados sobre la caja de madera son funcionales: retroceder 10 segundos, reproducir/pausar y avanzar 10 segundos. Reproducir coloca la aguja sobre el vinilo y pausa la devuelve al soporte. Avanzar y retroceder desplazan el mismo vídeo, sin cambiar de canción ni de ronda, y respetan el principio y el final de la pista. Si estabas en pausa, al desplazarte se conserva la pausa.

Arrastra la rueda de volumen arriba/abajo o a los lados para ajustarlo entre 0 y 100. Con teclado puedes enfocar la rueda y usar flechas, Inicio y Fin. El volumen se conserva al pausar, reanudar y cambiar de canción; se guarda como preferencia en el navegador cuando el almacenamiento está disponible. En cero se silencia el reproductor.

En la vista aérea los controles siguen disponibles sobre el gramófono. En pantallas pequeñas también puedes desplegar «Controles de sonido» para usar botones y un deslizador más grandes.

El vídeo de la TV utiliza posición dentro del documento para desplazarse junto al televisor al hacer scroll. El ajuste de tamaño al girar o redimensionar la pantalla conserva el mismo reproductor y la posición de reproducción.

## Personalizar portadas
Al crear un vinilo puedes elegir una imagen JPG, PNG o WebP de hasta 8 MB. La app toma el cuadrado central, lo adapta a 512 × 512 píxeles y lo comprime para guardarlo en este navegador. La vista previa muestra cómo quedará la funda con su nombre, y la caja de la biblioteca usa esa misma imagen.

Para cambiar la portada de un vinilo ya guardado, selecciónalo en las herramientas de la biblioteca y pulsa «Portada». Puedes subir otra imagen o quitar la actual y volver a la ilustración genérica, sin cargar de nuevo el CSV ni modificar sus canciones. Los cambios se conservan solo al pulsar «Guardar portada».

La exportación CSV contiene las canciones; no incluye la imagen. Si el navegador no dispone de espacio suficiente, se avisa y se conserva el vinilo anterior.

## Borrar la biblioteca
En la biblioteca, pulsa «Borrar todos los vinilos» y confirma «Borrar todos». Elimina de ese navegador los vinilos, sus canciones y portadas, la partida guardada y las copias de canciones de versiones anteriores. La biblioteca vuelve a quedar vacía y puedes crear nuevos vinilos inmediatamente. Cancelar no cambia nada. La preferencia de volumen se conserva.
