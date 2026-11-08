/* =========================================================
   Gotiastudio — Botones flotantes (index.html y paquetes.html)
     · derecha: WhatsApp (el enlace lo pone contacto.js, como en todos los data-wa). En paquetes
       lo muestra planes.js, según la pantalla.
     · izquierda: la guía en audio. Recorre la página de arriba hacia abajo: en cada parte la
       página va a esa sección (o a ese cuadro de los recorridos), la voz la explica y el
       subtítulo dice lo mismo. Si la parte trae un paso a paso (los tutoriales de 3 pasos, el
       flujo de la automatización, el Proceso, los recorridos de paquetes.html), lo recorre paso
       por paso. Tocarla la pausa; Anterior / Siguiente saltan de parte; la X la cierra.
   Cada página tiene su guion en GUIAS (data-guia en #guia: inicio o paquetes).
   La voz son grabaciones (assets/audio/guia-*.mp3 y paq-*.mp3), hechas con _generar-guia.py a
   partir de los textos: si cambias un texto, vuelve a correrlo (o graba tu voz con el mismo
   nombre de archivo). Si una grabación no carga, ese paso lo lee la voz del navegador.
   Los dos aparecen al terminar la pantalla de carga y se esconden con el menú del celular.
   ========================================================= */
(() => {
  // ir: 'top', el id de una sección o el de un paquete (#plan-…, que en index se abre con su
  // botón del mazo). tarjeta: el cuadro de un recorrido (0 = su presentación). recorre: la página
  // baja al ritmo de la voz (el manifiesto: cada palabra aparece cuando se dice). pasos: el paso
  // a paso de esa parte, en orden (cada uno toca su pestaña o enciende su paso: data-marcas).
  // cuenta: qué partes ven las estadísticas (una vez por sección, no por cuadro).
  const GUIAS = {
    inicio: {
      cuenta: (p) => !p.tarjeta && !/^#plan-/.test(p.ir),
      pasos: [
        { ir: 'top', titulo: 'Inicio', audio: 'guia-01.mp3', texto: '¡Hola! Te muestro la página de arriba hacia abajo. Aquí, al inicio, está lo principal: creamos tu página web y la ponemos a trabajar por ti.' },
        { ir: '#estudio', recorre: true, titulo: 'Manifiesto', audio: 'guia-02.mp3', texto: 'Tu negocio merece ser encontrado. Hacemos que más clientes te vean y te escriban.' },
        { ir: '#servicios', tarjeta: 0, titulo: 'Servicios', audio: 'guia-03.mp3', texto: 'Estos son nuestros seis servicios, conectados en un solo sistema. Te muestro cómo funciona cada uno.' },
        { ir: '#servicios', tarjeta: 1, titulo: 'Tu página web', audio: 'guia-04.mp3', texto: 'Uno: una web que trabaja por ti. Mira cómo.', pasos: [
          { audio: 'guia-04-1.mp3', texto: 'Una clienta te escribe de noche, mientras duermes.' },
          { audio: 'guia-04-2.mp3', texto: 'Tu web le contesta al instante y le aparta la cita.' },
          { audio: 'guia-04-3.mp3', texto: 'Y al despertar ves el aviso: la cita ya está en tu agenda.' }
        ] },
        { ir: '#servicios', tarjeta: 2, titulo: 'Edita tu web tú mismo', audio: 'guia-05.mp3', texto: 'Dos: editas tu web tú mismo.', pasos: [
          { audio: 'guia-05-1.mp3', texto: 'Entras a tu panel con tu clave, desde el celular.' },
          { audio: 'guia-05-2.mp3', texto: 'Cambias un precio, una foto o un texto, y guardas.' },
          { audio: 'guia-05-3.mp3', texto: 'Listo: tus clientes ya lo ven en tu web.' }
        ] },
        { ir: '#servicios', tarjeta: 3, titulo: 'Aparece en Google', audio: 'guia-06.mp3', texto: 'Tres: apareces en Google.', pasos: [
          { audio: 'guia-06-1.mp3', texto: 'Alguien busca en Google lo que tú vendes, cerca de donde está.' },
          { audio: 'guia-06-2.mp3', texto: 'Sales arriba en el mapa, con tus estrellas y tu horario.' },
          { audio: 'guia-06-3.mp3', texto: 'Y desde el mapa entran a tu web y te hacen su pedido.' }
        ] },
        { ir: '#servicios', tarjeta: 4, titulo: 'Mide tus visitas', audio: 'guia-07.mp3', texto: 'Cuatro: medimos tus visitas, cada semana.', pasos: [
          { audio: 'guia-07-1.mp3', texto: 'Te llega un reporte por mensaje, o lo vemos juntos en una llamada.' },
          { audio: 'guia-07-2.mp3', texto: 'Ves cuánta gente entró y de dónde vino.' },
          { audio: 'guia-07-3.mp3', texto: 'Y te decimos qué mejorar para que más personas te compren.' }
        ] },
        { ir: '#servicios', tarjeta: 5, titulo: 'Crece en redes sociales', audio: 'guia-08.mp3', texto: 'Cinco: crecemos tus redes sociales.', pasos: [
          { audio: 'guia-08-1.mp3', texto: 'Publicamos fotos y videos que llaman la atención.' },
          { audio: 'guia-08-2.mp3', texto: 'A la gente le gusta, pregunta y con un toque llega a tu web.' },
          { audio: 'guia-08-3.mp3', texto: 'Y te escriben: así ganas clientes nuevos.' }
        ] },
        { ir: '#servicios', tarjeta: 6, titulo: 'Fotos y videos con IA', audio: 'guia-09.mp3', texto: 'Y seis: contenido viral, con inteligencia artificial.', pasos: [
          { audio: 'guia-09-1.mp3', texto: 'Nos mandas una foto de tu producto, tomada con tu celular.' },
          { audio: 'guia-09-2.mp3', texto: 'La convertimos en un video 3D, con tu logo y tus colores.' },
          { audio: 'guia-09-3.mp3', texto: 'Lo movemos con las tendencias, para que lo vea muchísima gente.' },
          { audio: 'guia-09-4.mp3', texto: 'Y esa gente llega a tu web.' }
        ] },
        { ir: '#automatizacion', tarjeta: 0, titulo: 'Automatización', audio: 'guia-10.mp3', texto: 'Esta es la automatización: vive dentro de tu web, y viene en los paquetes Automático y Negocio.' },
        { ir: '#automatizacion', tarjeta: 1, titulo: 'Tu web atiende', audio: 'guia-11.mp3', texto: 'Tu web atiende y guarda a cada cliente. Viene desde el paquete Automático.', pasos: [
          { audio: 'guia-11-1.mp3', texto: 'Alguien llena el formulario de tu web para pedir una cita.' },
          { audio: 'guia-11-2.mp3', texto: 'Tu web le responde al instante y guarda sus datos.' },
          { audio: 'guia-11-3.mp3', texto: 'Y a ti te llega el aviso con todo listo. Tú solo atiendes.' }
        ] },
        { ir: '#automatizacion', tarjeta: 2, titulo: 'Así funciona', audio: 'guia-14.mp3', texto: 'Así trabaja tu web, paso a paso.', pasos: [
          { audio: 'guia-14-1.mp3', texto: 'Te escriben desde tu web, a cualquier hora.' },
          { audio: 'guia-14-2.mp3', texto: 'Responde al instante las preguntas frecuentes.' },
          { audio: 'guia-14-3.mp3', texto: 'Agenda sola, directo a tu calendario.' },
          { audio: 'guia-14-4.mp3', texto: 'Le confirma al cliente con un correo automático.' },
          { audio: 'guia-14-5.mp3', texto: 'Y todo queda registrado en tu panel, con un aviso para ti.' }
        ] },
        { ir: '#automatizacion', tarjeta: 3, titulo: 'Recordatorios', audio: 'guia-16.mp3', texto: 'Recordatorios por correo, para que nadie falte.', pasos: [
          { audio: 'guia-16-1.mp3', texto: 'Laura tiene cita mañana a las diez.' },
          { audio: 'guia-16-2.mp3', texto: 'Antes de la cita le llega un recordatorio por correo.' },
          { audio: 'guia-16-3.mp3', texto: 'Y llega a tiempo, sin que tú escribas nada.' }
        ] },
        { ir: '#automatizacion', tarjeta: 4, titulo: 'Reseñas', audio: 'guia-17.mp3', texto: 'Y reseñas que te traen clientes.', pasos: [
          { audio: 'guia-17-1.mp3', texto: 'Un cliente compra y recibe su pedido.' },
          { audio: 'guia-17-2.mp3', texto: 'Un correo le pide su opinión, y deja cinco estrellas en Google.' },
          { audio: 'guia-17-3.mp3', texto: 'Con más reseñas, más clientes te eligen.' }
        ] },
        { ir: '#ecosistema', titulo: 'Ecosistema', audio: 'guia-18.mp3', texto: 'Tu web en el centro, y alrededor todo lo que hace por ti y lo que te trae clientes. Toca una burbuja para verla.' },
        { ir: '#panel', tarjeta: 0, titulo: 'Panel de administrador', audio: 'guia-19.mp3', texto: 'El panel de administrador: desde el paquete Automático manejas tu web sin depender de nadie.' },
        { ir: '#panel', tarjeta: 1, titulo: 'Pruébalo aquí', audio: 'guia-20.mp3', texto: 'Pruébalo aquí mismo: cambia un precio y míralo en vivo.' },
        { ir: '#panel', tarjeta: 2, titulo: 'Qué puedes hacer', audio: 'guia-21.mp3', texto: 'Cambias precios, fotos y textos, y ves tus pedidos desde el celular.' },
        { ir: '#panel', tarjeta: 3, titulo: 'Tenlo en tu web', audio: 'guia-22.mp3', texto: 'Tenerlo en tu web es fácil.', pasos: [
          { audio: 'guia-22-1.mp3', texto: 'Nos escribes y nos cuentas qué vendes.' },
          { audio: 'guia-22-2.mp3', texto: 'Lo armamos con tus productos y lo conectamos a tu web.' },
          { audio: 'guia-22-3.mp3', texto: 'Y lo usas desde tu celular, sin depender de nadie.' }
        ] },
        { ir: '#datos', tarjeta: 0, titulo: 'Datos verificables', audio: 'guia-23.mp3', texto: 'Datos verificables, si los quieres: decides con datos, no con intuición.' },
        { ir: '#datos', tarjeta: 1, titulo: 'Llegan y compran', audio: 'guia-24.mp3', texto: 'Cada semana ves cuánta gente llega y cuántos compran.', pasos: [
          { audio: 'guia-24-1.mp3', texto: 'Ves cuánta gente llegó a tu web y de dónde vino.' },
          { audio: 'guia-24-2.mp3', texto: 'Cuántos compraron, y cuántos se quedaron a medio camino.' },
          { audio: 'guia-24-3.mp3', texto: 'Y te decimos qué cambiar para que más personas compren.' }
        ] },
        { ir: '#datos', tarjeta: 2, titulo: 'Dónde dudan', audio: 'guia-25.mp3', texto: 'Y dónde dudan tus clientes.', pasos: [
          { audio: 'guia-25-1.mp3', texto: 'Vemos hasta dónde llega la gente en tu página.' },
          { audio: 'guia-25-2.mp3', texto: 'Encontramos dónde dudan y se van sin comprar.' },
          { audio: 'guia-25-3.mp3', texto: 'Y lo arreglamos juntos, midiendo el resultado.' }
        ] },
        { ir: '#datos', tarjeta: 3, titulo: 'Tú decides', audio: 'guia-26.mp3', texto: 'Tú decides, y es privado.', pasos: [
          { audio: 'guia-26-1.mp3', texto: 'Medir tu web es opcional: tú lo activas.' },
          { audio: 'guia-26-2.mp3', texto: 'Contamos visitas, no personas con nombre.' },
          { audio: 'guia-26-3.mp3', texto: 'Y cada semana lo revisamos contigo.' }
        ] },
        { ir: '#proceso', titulo: 'Proceso', audio: 'guia-27.mp3', texto: 'Así trabajamos, en cuatro pasos.', pasos: [
          { audio: 'guia-27-1.mp3', texto: 'Uno, descubrimiento: tu negocio, tu cliente y qué debe lograr tu web.' },
          { audio: 'guia-27-2.mp3', texto: 'Dos, diseño a medida: apruebas cada pantalla antes de construirla.' },
          { audio: 'guia-27-3.mp3', texto: 'Tres, desarrollo: web, automatizaciones, panel, Google y redes, todo probado.' },
          { audio: 'guia-27-4.mp3', texto: 'Y cuatro, lanzamiento: publicamos y mejoramos cada semana con datos reales.' }
        ] },
        { ir: '#packs', titulo: 'Paquetes', audio: 'guia-28.mp3', texto: 'Estos son los paquetes: tres de página web con automatización, y uno para empezar.' },
        { ir: '#plan-presencia', solo: 'auto', titulo: 'Presencia', audio: 'guia-29.mp3', texto: 'Presencia: tu negocio bien presentado en internet, con cuatro secciones y Google Maps.' },
        { ir: '#plan-automatico', solo: 'auto', titulo: 'Automático', audio: 'guia-30.mp3', texto: 'Automático, el recomendado: tu web atiende, agenda y te avisa sola.' },
        { ir: '#plan-negocio', solo: 'auto', titulo: 'Negocio', audio: 'guia-31.mp3', texto: 'Negocio: tu web vende, cobra y te muestra los números.' },
        { ir: '#plan-emprende', solo: 'auto', titulo: 'Emprende', audio: 'guia-32.mp3', texto: 'Y Emprende, si apenas vas a empezar: una sola sección, lista en uno o dos días hábiles.' },
        { ir: '#plan-compare', titulo: 'Compara los paquetes', audio: 'guia-35.mp3', texto: 'Aquí los comparas todos de un vistazo.' },
        { ir: '#faq', titulo: 'Preguntas frecuentes', audio: 'guia-36.mp3', texto: 'Aquí resolvemos las preguntas más comunes.' },
        { ir: '#equipo', titulo: 'Equipo', audio: 'guia-37.mp3', texto: 'Y este es nuestro equipo de especialistas.' },
        { ir: '#contacto', titulo: 'Contacto', audio: 'guia-38.mp3', texto: 'Para terminar, déjanos tus datos aquí o escríbenos por WhatsApp. ¡Gracias por recorrer la página!' }
      ]
    },
    // paquetes.html: una parte por pantalla; los recorridos de los 4 paquetes, nota por nota
    paquetes: {
      cuenta: (p) => /^(top|#casos|#paso-\d|#comparar|#planes-marketing|#planes-datos|#contacto)$/.test(p.ir),
      pasos: [
        { ir: 'top', titulo: 'Inicio', audio: 'paq-01.mp3', texto: '¡Hola! Primero elige tu camino: automatizar tu negocio, vender más y atraer clientes, o entender tus datos. Toca el que quieras y te lo explico.' },
        { ir: '#auto-inicio', solo: 'auto', titulo: 'Automatizar', audio: 'paq-21.mp3', texto: 'Todo claro, en dos pasos: primero eliges tu paquete, y luego ves la mensualidad que lo mantiene funcionando.' },
        { ir: '#casos', titulo: 'Casos de éxito', audio: 'paq-02.mp3', texto: 'Antes de los precios, pregúntanos por nuestros casos de éxito más recientes, por WhatsApp o por llamada.' },
        { ir: '#paso-1', solo: 'auto', titulo: 'Paso 1 · Tu paquete', audio: 'paq-03.mp3', texto: 'Paso uno: elige tu paquete. Son tres paquetes, y recomendamos el del medio, Automático. Y si apenas vas a empezar, abajo está Emprende.' },
        { ir: '#ejemplo-presencia', solo: 'auto', titulo: 'Presencia', audio: 'paq-04.mp3', texto: 'Presencia: tu negocio bien presentado en internet. Mira un ejemplo.', pasos: [
          { audio: 'paq-04-1.mp3', texto: 'Una web con cuatro secciones, y el menú lleva a cada una.' },
          { audio: 'paq-04-2.mp3', texto: 'Tus servicios, uno por uno, bien explicados.' },
          { audio: 'paq-04-3.mp3', texto: 'Quiénes son: tu historia y tu equipo generan confianza.' },
          { audio: 'paq-04-4.mp3', texto: 'Tu ubicación en Google Maps, con tu formulario y tu WhatsApp al lado.' },
          { audio: 'paq-04-5.mp3', texto: 'La preparamos para que salgas en Google cuando te buscan en tu ciudad.' },
          { audio: 'paq-04-6.mp3', texto: 'Y el primer mes de Cuidado va incluido.' }
        ] },
        { ir: '#plan-presencia', solo: 'auto', titulo: 'Presencia', audio: 'paq-05.mp3', texto: 'Esto es lo que incluye Presencia: lista en tres a cinco días hábiles, y sin automatizaciones.' },
        { ir: '#ejemplo-automatico', solo: 'auto', titulo: 'Automático', audio: 'paq-06.mp3', texto: 'Automático es el recomendado: tu web atiende, agenda y te avisa sola.', pasos: [
          { audio: 'paq-06-1.mp3', texto: 'Responde sola, de día y de noche, aunque estés dormido.' },
          { audio: 'paq-06-2.mp3', texto: 'El cliente elige día y hora, y la cita queda agendada.' },
          { audio: 'paq-06-3.mp3', texto: 'A ti te llega el aviso, y a él un correo de confirmación.' },
          { audio: 'paq-06-4.mp3', texto: 'Cada cliente queda guardado en tu panel, con su correo y su celular.' },
          { audio: 'paq-06-5.mp3', texto: 'Cada cita entra sola a tu calendario, y se conecta con Booking o Airbnb si los usas.' },
          { audio: 'paq-06-6.mp3', texto: 'Desde tu panel cambias tú mismo textos, fotos y precios.' },
          { audio: 'paq-06-7.mp3', texto: 'Y trae dos meses de Cuidado Automático incluidos.' }
        ] },
        { ir: '#plan-automatico', solo: 'auto', titulo: 'Automático', audio: 'paq-07.mp3', texto: 'Esto es lo que incluye Automático: lista en cinco a siete días hábiles. Después sigue con Cuidado Automático.' },
        { ir: '#ejemplo-negocio', solo: 'auto', titulo: 'Negocio', audio: 'paq-08.mp3', texto: 'Negocio: tu web vende, cobra y te muestra los números.', pasos: [
          { audio: 'paq-08-1.mp3', texto: 'Tu catálogo en línea, con fotos, precios y carrito.' },
          { audio: 'paq-08-2.mp3', texto: 'Pagan con tarjeta, PSE o Nequi, y la factura les llega sola.' },
          { audio: 'paq-08-3.mp3', texto: 'Tu catálogo lo manejas tú, cuando quieras.' },
          { audio: 'paq-08-4.mp3', texto: 'Cada venta queda en tu panel, con su factura.' },
          { audio: 'paq-08-5.mp3', texto: 'Antes de cada cita sale un recordatorio por correo, y después otro pide la reseña en Google.' },
          { audio: 'paq-08-6.mp3', texto: 'Ves tus visitas, de dónde llegan y cuánto vendes, en tiempo real.' },
          { audio: 'paq-08-7.mp3', texto: 'Y trae tres meses de Cuidado Negocio incluidos.' }
        ] },
        { ir: '#plan-negocio', solo: 'auto', titulo: 'Negocio', audio: 'paq-09.mp3', texto: 'Esto es lo que incluye Negocio: lista en siete a diez días hábiles. Después sigue con Cuidado Negocio.' },
        { ir: '#ejemplo-emprende', solo: 'auto', titulo: 'Emprende', audio: 'paq-10.mp3', texto: '¿Apenas vas a empezar? Emprende es tu negocio en internet, en una sola sección.', pasos: [
          { audio: 'paq-10-1.mp3', texto: 'Tu propia dirección, con candado de seguridad. El dominio y el hosting van por un año.' },
          { audio: 'paq-10-2.mp3', texto: 'Tu negocio, bien presentado, con tu logo, tus colores y tus fotos.' },
          { audio: 'paq-10-3.mp3', texto: 'Un botón lleva al cliente a tu WhatsApp, con el mensaje listo.' },
          { audio: 'paq-10-4.mp3', texto: 'Y tus redes, a un clic, para que te sigan.' }
        ] },
        { ir: '#plan-emprende', solo: 'auto', titulo: 'Emprende', audio: 'paq-11.mp3', texto: 'Esto es lo que incluye Emprende: lista en uno o dos días hábiles.' },
        { ir: '#comparar', solo: 'auto', titulo: 'Compara los paquetes', audio: 'paq-12.mp3', texto: 'Aquí comparas los cuatro paquetes, lado a lado.' },
        { ir: '#paso-2', solo: 'auto', titulo: 'Paso 2 · Tu mensualidad', audio: 'paq-13.mp3', texto: 'Paso dos: tu mensualidad. Tu página sigue trabajando, y aquí ves en cuál continúa cada paquete.' },
        { ir: '#cuidado', solo: 'auto', titulo: 'Cuidado', audio: 'paq-14.mp3', texto: 'Cuidado es para Emprende y Presencia, y es opcional. Incluye hosting, copias de seguridad, seguridad al día y hasta cinco cambios al mes.' },
        { ir: '#cuidado-automatico', solo: 'auto', titulo: 'Cuidado Automático', audio: 'paq-15.mp3', texto: 'Cuidado Automático mantiene funcionando tus automatizaciones, con monitoreo, dos ajustes al mes y un reporte corto.' },
        { ir: '#cuidado-negocio', solo: 'auto', titulo: 'Cuidado Negocio', audio: 'paq-16.mp3', texto: 'Cuidado Negocio suma un reporte completo, mapas de calor, una reunión de estrategia y una mejora al mes.' },
        { ir: '#reglas', solo: 'auto', titulo: 'Las reglas', audio: 'paq-17.mp3', texto: 'Las reglas son simples: tu página y tu dominio son tuyos, no hay permanencia, y si pagas el año, dos meses son gratis. Y si quieres que te traigamos clientes, está Crecimiento.' },
        { ir: '#planes-marketing', solo: 'vender', titulo: 'Vender más · Los planes', audio: 'paq-22.mp3', texto: 'Para vender más hay tres planes: Visible, para que te encuentren en Google; Redes, para que te vean y te escriban; y Crecimiento, con varias redes, YouTube y anuncios. Ya llevamos un perfil a siete millones de vistas de video en tres semanas.' },
        { ir: '#recorrido-marketing', solo: 'vender', titulo: 'Cómo funciona', audio: 'paq-23.mp3', texto: 'Mira cómo funciona, con el ejemplo de una joyería.', pasos: [
          { audio: 'paq-23-1.mp3', texto: 'Con Visible, tu web sube en Google cuando buscan lo que vendes en tu ciudad.' },
          { audio: 'paq-23-2.mp3', texto: 'Y tu perfil de Google Maps se mantiene al día, con fotos y respuesta a tus reseñas.' },
          { audio: 'paq-23-3.mp3', texto: 'Con Redes, manejamos dos redes a tu elección, también YouTube, con la misma imagen.' },
          { audio: 'paq-23-4.mp3', texto: 'Cada mes, doce publicaciones con cuatro videos. Tú apruebas el calendario.' },
          { audio: 'paq-23-5.mp3', texto: 'Con Crecimiento, sumamos una campaña en Google o Meta. La pauta va aparte.' },
          { audio: 'paq-23-6.mp3', texto: 'Y cada mes ves cuántos clientes trae cada canal.' }
        ] },
        { ir: '#plan-visible', solo: 'vender', titulo: 'Visible', audio: 'paq-24.mp3', texto: 'Esto incluye Visible. Subir en Google toma meses, y no prometemos el primer lugar.' },
        { ir: '#plan-redes', solo: 'vender', titulo: 'Redes', audio: 'paq-25.mp3', texto: 'Esto incluye Redes. Los mensajes y comentarios los respondes tú.' },
        { ir: '#plan-crecimiento', solo: 'vender', titulo: 'Crecimiento', audio: 'paq-26.mp3', texto: 'Crecimiento maneja cuatro redes con YouTube, doce publicaciones, una campaña y tu perfil de Google. Es por mínimo tres meses.' },
        { ir: '#marketing-reglas', solo: 'vender', titulo: 'Las reglas', audio: 'paq-27.mp3', texto: 'Las reglas son simples: tus redes y tu perfil son tuyos, no hay permanencia salvo en Crecimiento, y si pagas el año, dos meses son gratis.' },
        { ir: '#planes-datos', solo: 'datos', titulo: 'Datos · Los paquetes', audio: 'paq-29.mp3', texto: 'Para decidir con números hay tres paquetes, y los tres se pagan mes a mes. Mide instala el software en tu web. Une suma tus redes y un analista de datos. Y Decide une a cada cliente y cada venta. Los tres traen tres meses gratis de registro de datos.' },
        { ir: '#recorrido-datos', solo: 'datos', titulo: 'Cómo funciona', audio: 'paq-30.mp3', texto: 'Mira cómo se vería tu panel.', pasos: [
          { audio: 'paq-30-1.mp3', texto: 'Con Mide, ves en vivo tus visitas, de dónde llegan y cuántos escriben o compran.' },
          { audio: 'paq-30-2.mp3', texto: 'El mapa de calor te muestra dónde se quedan y en qué punto se van.' },
          { audio: 'paq-30-3.mp3', texto: 'Con Une, tus redes quedan juntas en el mismo panel.' },
          { audio: 'paq-30-4.mp3', texto: 'Así sabes qué red te trae clientes, y tu analista de datos te muestra dónde vale la pena seguir.' },
          { audio: 'paq-30-5.mp3', texto: 'Con Decide, cada cliente queda en un solo lugar, y ves a quién escribirle hoy.' },
          { audio: 'paq-30-6.mp3', texto: 'Y tu analista te dice qué dejar y qué reforzar, con una reunión al mes.' }
        ] },
        { ir: '#analista-datos', solo: 'datos', titulo: 'Tu analista', audio: 'paq-36.mp3', texto: 'En Une y Decide, un analista de datos con experiencia revisa tus números. Identifica lo que más te quita tiempo y dinero, y te ayuda a invertir en lo que da mejor rendimiento.' },
        { ir: '#plan-mide', solo: 'datos', titulo: 'Mide', audio: 'paq-31.mp3', texto: 'Mide es solo el software: lo instalamos en tu web y tú ves tus números en tu panel. Funciona aunque tu página la haya hecho otro proveedor.' },
        { ir: '#plan-une', solo: 'datos', titulo: 'Une', audio: 'paq-32.mp3', texto: 'Une suma tus redes y un analista de datos, que revisa tus números cada mes. Tus cuentas deben ser profesionales, y cada red decide qué datos comparte.' },
        { ir: '#plan-decide', solo: 'datos', titulo: 'Decide', audio: 'paq-33.mp3', texto: 'Decide suma tus clientes, tu embudo de ventas y tus metas. Y tu analista se reúne contigo una vez al mes.' },
        { ir: '#datos-reglas', solo: 'datos', titulo: 'Las reglas', audio: 'paq-34.mp3', texto: 'Las reglas son simples: tus datos son tuyos, solo guardamos clientes que lo autorizaron, y los primeros tres meses de registro son gratis. Después pagas mes a mes, sin permanencia.' },
        { ir: '#extras', titulo: 'Extras', audio: 'paq-18.mp3', texto: 'Si tu página la hizo otro proveedor, también la automatizamos. Y si necesitas algo más grande, te cotizamos un proyecto a medida.' },
        { ir: '#como-se-paga', solo: 'auto', titulo: 'Cómo se paga', audio: 'paq-19.mp3', texto: 'Así se paga: nos escribes, pagas la mitad para empezar, la hacemos contigo, y pagas el resto antes de publicarla.' },
        { ir: '#como-se-paga', solo: 'vender', titulo: 'Cómo se paga', audio: 'paq-28.mp3', texto: 'Así se paga: cada plan va mes a mes. Pagas el primer mes, apruebas el plan y empezamos.' },
        { ir: '#como-se-paga', solo: 'datos', titulo: 'Cómo se paga', audio: 'paq-35.mp3', texto: 'Así se paga: la mitad de la instalación para empezar, y la otra mitad cuando esté lista. Registramos tus datos tres meses gratis, y tu mensualidad empieza el mes cuatro.' },
        { ir: '#contacto', titulo: 'Escríbenos', audio: 'paq-20.mp3', texto: '¿No sabes cuál elegir? Escríbenos y te ayudamos, gratis y sin compromiso. ¡Gracias por escuchar!' }
      ]
    }
  };

  const root = document.documentElement;
  const nav = document.getElementById('nav');
  const guia = document.getElementById('guia');
  const pagina = (guia && guia.dataset.guia) || 'inicio';
  const wa = pagina === 'inicio' ? document.querySelector('.wa-float') : null;   // en paquetes, planes.js
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- Cuándo se ven ---------- */
  let shown = false;
  const paint = () => {
    const menu = nav && nav.classList.contains('nav-open');
    [wa, guia].forEach((el) => el && el.classList.toggle('show', shown && !menu));
  };
  if (nav) new MutationObserver(paint).observe(nav, { attributes: true, attributeFilter: ['class'] });
  // en la 3D, cuando la "G" de la carga ya llegó a su sitio (con red de seguridad, como el sorteo)
  const loading = root.classList.contains('is-loading') && !(window.gotia || {}).revealed;
  (loading
    ? Promise.race([new Promise((r) => document.addEventListener('gotia:reveal', r, { once: true })), wait(7000)]).then(() => wait(500))
    : wait(600)
  ).then(() => { shown = true; paint(); });

  if (!guia || !GUIAS[pagina]) return;

  /* ---------- La guía en audio ---------- */
  const { pasos: PASOS, cuenta } = GUIAS[pagina];
  // la lista que se reproduce: cada parte y, detrás, su paso a paso (n: la parte; marca: el paso).
  // En paquetes.html sigue el camino elegido (caminos.js); sin elegir, solo la portada
  let LISTA = [], M = 0, L = 0;
  const armar = () => {
    const camino = root.dataset.camino;
    const partes = pagina === 'paquetes' && !camino ? PASOS.slice(0, 1) : PASOS.filter((p) => !p.solo || p.solo === camino);
    LISTA = [];
    partes.forEach((p, n) => {
      LISTA.push({ ...p, n });
      (p.pasos || []).forEach((s, k) => LISTA.push({ ...p, ...s, n, marca: k, de: p.pasos.length }));
    });
    M = partes.length;
    L = LISTA.length;
  };
  armar();
  const $ = (s) => guia.querySelector(s);
  const btn = $('.guia-btn'), close = $('.guia-x'), cap = $('.guia-cap'), line = $('.guia-say');
  const back = $('.guia-prev'), next = $('.guia-next');
  const title = $('.guia-txt strong'), sub = $('.guia-txt small');
  const idle = { title: title.textContent, sub: sub.textContent, label: btn.getAttribute('aria-label') };
  const behavior = reduce ? 'auto' : 'smooth';
  const synth = window.speechSynthesis && window.SpeechSynthesisUtterance ? window.speechSynthesis : null;
  const audio = new Audio();          // una sola: en el iPhone, la que se tocó puede seguir sonando
  const warm = new Audio();           // la grabación siguiente, ya descargada
  warm.preload = 'auto';
  let state = 'idle';                 // idle · playing · paused
  let step = 0, turn = 0, done = false, voice = false, voiceT0 = 0, keep = null, scrub = 0, held = null;

  // la cuentan las estadísticas (analytics.js): si la empiezan y hasta qué sección llegan
  const tell = (what) => document.dispatchEvent(new CustomEvent('gotia:guia', { detail: what }));
  const setProgress = (k) => guia.style.setProperty('--p', Math.min(1, Math.max(0, (step + k) / L)).toFixed(4));
  // cuánto va el paso (0 a 1): de la grabación o, con la voz del navegador, un cálculo por letras
  const part = () => (voice
    ? (performance.now() - voiceT0) / (LISTA[step].texto.length * 62)
    : audio.duration ? audio.currentTime / audio.duration : 0);
  const head = (n) => LISTA.findIndex((q) => q.n === n);   // dónde empieza la parte n

  // la página, al paso: los recorridos (Servicios, Automatización, Panel, Datos) y el mazo de
  // paquetes se mueven con sus propios botones, así cada cuadro queda centrado como al tocarlos
  const show = (p) => {
    if (p.ir === 'top') { scrollTo({ top: 0, behavior }); return; }
    const el = document.querySelector(p.ir);
    if (!el) return;
    const own = p.tarjeta != null
      ? el.querySelectorAll('.svc-dot')[p.tarjeta]
      : document.querySelector(`[data-plan-go][href="${p.ir}"]`);
    if (own) own.click();
    else if (p.marca == null) el.scrollIntoView({ behavior, block: 'start' });
  };
  // el paso a paso: en los tutoriales toca su pestaña (como al tocarla: la animación sigue desde
  // ahí); en los que se encienden solos (data-marcas: el flujo, el Proceso) les dice cuál
  // encender y main.js deja su bucle hasta que la guía lo suelta (-1)
  const box = (p) => {
    const el = p.ir === 'top' ? null : document.querySelector(p.ir);
    return el && p.tarjeta != null ? el.querySelectorAll('.svc-card')[p.tarjeta] : el;
  };
  const release = () => {
    if (held) held.dispatchEvent(new CustomEvent('gotia:marca', { detail: -1 }));
    held = null;
  };
  const mark = (p) => {
    const el = p.marca == null ? null : box(p);
    const list = el && (el.matches('[data-marcas]') ? el : el.querySelector('[data-marcas]'));
    if (held && held !== list) release();
    if (!el) return;
    const tab = el.querySelectorAll('.tuto-steps button, .t-steps button')[p.marca];
    if (tab) { tab.click(); return; }
    if (!list) return;
    held = list;
    list.dispatchEvent(new CustomEvent('gotia:marca', { detail: p.marca }));
    // fuera de los recorridos (el Proceso, en el celular va en columna): que se vea el paso
    const item = list.querySelectorAll(list.dataset.marcas)[p.marca];
    if (item && p.tarjeta == null) {
      const r = item.getBoundingClientRect();
      if (r.top < 70 || r.bottom > innerHeight - 150) item.scrollIntoView({ behavior, block: 'center' });
    }
  };
  // el manifiesto: baja de donde esté hasta que la última palabra se ve, al ritmo de la voz.
  // Si quien visita mueve la página, deja de seguirla.
  const follow = (p, mine) => {
    const el = document.querySelector(p.ir);
    if (!el) return;
    const from = scrollY, to = el.getBoundingClientRect().top + scrollY + innerHeight;
    let free = false;
    const leave = () => { free = true; };
    ['wheel', 'touchstart', 'keydown'].forEach((t) => addEventListener(t, leave, { once: true, passive: true }));
    const tick = () => {
      if (free || mine !== turn) return;
      if (state === 'playing') scrollTo({ top: from + (to - from) * Math.min(1, part() * 1.1), behavior: 'instant' });
      scrub = requestAnimationFrame(tick);
    };
    tick();
  };

  const render = () => {
    guia.classList.toggle('is-playing', state === 'playing');
    guia.classList.toggle('is-paused', state === 'paused');
    close.hidden = cap.hidden = state === 'idle';
    if (state === 'idle') {
      title.textContent = idle.title;
      sub.textContent = idle.sub;
      btn.setAttribute('aria-label', idle.label);
      return;
    }
    const p = LISTA[step];
    title.textContent = p.titulo;
    sub.textContent = state === 'paused' ? 'En pausa · toca para seguir'
      : `Parte ${p.n + 1} de ${M}` + (p.marca != null ? ` · paso ${p.marca + 1}/${p.de}` : '');
    btn.setAttribute('aria-label', state === 'paused' ? 'Seguir la guía' : 'Pausar la guía');
    back.disabled = step === 0;
    next.disabled = p.n === M - 1;
  };

  const silence = () => {
    turn++;
    audio.pause();
    if (synth) synth.cancel();
    cancelAnimationFrame(scrub);
  };
  const reset = () => {
    silence();
    release();
    state = 'idle';
    step = 0;
    done = false;
    guia.style.setProperty('--p', '0');
    render();
  };

  // al terminar un paso: un respiro y el siguiente (o el final). Dentro de un paso a paso, más corto
  const ended = (mine) => {
    if (mine !== turn) return;
    done = true;
    setProgress(1);
    const after = LISTA[step + 1];
    setTimeout(() => {
      if (mine !== turn || state !== 'playing') return;
      if (after) go(step + 1);
      else { reset(); idle.title = 'Escúchala de nuevo'; render(); tell('Terminó'); }
    }, after && after.marca != null ? 250 : 450);
  };

  // si la grabación no carga, lee el paso la voz del navegador (en español, la más natural que haya)
  const REGIONES = ['es-CO', 'es-MX', 'es-US', 'es-419', 'es-ES'];
  const pickVoice = () => {
    const score = (v) => {
      const r = REGIONES.indexOf(v.lang.replace('_', '-'));
      return (r < 0 ? REGIONES.length : r) - (/natural|online|google/i.test(v.name) ? 10 : 0);
    };
    return synth.getVoices().filter((v) => /^es\b/i.test(v.lang.replace('_', '-'))).sort((a, b) => score(a) - score(b))[0] || null;
  };
  if (synth) synth.getVoices();   // en Chrome las voces llegan después: así ya están si hacen falta
  const speak = (mine) => {
    voice = true;
    voiceT0 = performance.now();
    if (!synth) { setTimeout(() => ended(mine), LISTA[step].texto.length * 62); return; }   // solo subtítulos
    synth.cancel();
    const u = new SpeechSynthesisUtterance(LISTA[step].texto);
    const v = pickVoice();
    u.lang = v ? v.lang : 'es-CO';
    if (v) u.voice = v;
    u.onend = () => ended(mine);
    u.onerror = (e) => { if (e.error !== 'interrupted' && e.error !== 'canceled') ended(mine); };
    keep = u;   // que no se lo lleve el recolector: Chrome dejaría de avisar cuando termina
    synth.speak(u);
  };

  const go = (k) => {
    silence();
    const mine = turn;
    step = k;
    done = false;
    voice = false;
    state = 'playing';
    const p = LISTA[k];
    line.textContent = p.texto;
    render();
    setProgress(0);
    if (p.marca == null && cuenta(p)) tell(p.titulo);
    if (LISTA[k + 1]) warm.src = LISTA[k + 1].audio;
    audio.src = p.audio;   // antes de mover la página: el manifiesto mide cuánto va de esta grabación
    audio.play().catch((e) => { if (mine === turn && e.name !== 'AbortError') speak(mine); });
    if (p.recorre) follow(p, mine);
    else show(p);
    mark(p);
  };
  audio.addEventListener('timeupdate', () => { if (!voice && state !== 'idle') setProgress(part()); });
  audio.addEventListener('ended', () => ended(turn));

  btn.addEventListener('click', () => {
    if (state === 'playing') {
      state = 'paused';
      audio.pause();
      if (voice && synth) { turn++; synth.cancel(); }   // la voz del navegador no se deja pausar bien
      render();
    } else if (state === 'paused' && !voice && !done) {
      state = 'playing';
      audio.play().catch(() => go(step));
      mark(LISTA[step]);   // en la pausa, el tutorial pudo seguir solo: vuelve al paso que se oye
      render();
    } else if (state === 'paused') {
      go(done ? Math.min(step + 1, L - 1) : step);
    } else {
      tell('Empezó');
      guia.classList.add('is-heard');   // el halo deja de latir
      go(0);
    }
  });
  // Anterior: al comienzo de esta parte (si va en su paso a paso) o a la parte anterior
  back.addEventListener('click', () => {
    const p = LISTA[step];
    go(head(p.marca != null ? p.n : Math.max(0, p.n - 1)));
  });
  next.addEventListener('click', () => go(head(Math.min(M - 1, LISTA[step].n + 1))));
  close.addEventListener('click', () => { reset(); btn.focus(); });
  // al elegir un camino, la guía sigue por ahí si estaba sonando
  document.addEventListener('gotia:camino', () => {
    const sonaba = state === 'playing';
    if (state !== 'idle') reset();
    armar();
    if (sonaba && M > 1) go(head(1));
  });
  addEventListener('pagehide', () => { if (state === 'playing') btn.click(); });
})();
