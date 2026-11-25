/* VISTACONSCIENTE - INICIO Y CONTROL DE SESIONES */
document.addEventListener("DOMContentLoaded", () => {
    // Limpieza única de datos de prueba anteriores a esta versión.
    // Se conservan las preferencias del usuario (frecuencia, duración y meta configurada).
    const CLAVE_LIMPIEZA_INICIAL = "vistaConsciente_limpieza_progreso_v5";
    if (!localStorage.getItem(CLAVE_LIMPIEZA_INICIAL)) {
        localStorage.removeItem("vistaConscienteSesiones");
        localStorage.removeItem("vistaConscienteRegistrosMolestias");
        localStorage.removeItem("vistaConscienteEstadoSesion");
        Object.keys(localStorage)
            .filter(k => k.startsWith("vistaConscientePausas_"))
            .forEach(k => localStorage.removeItem(k));
        localStorage.setItem(CLAVE_LIMPIEZA_INICIAL, "1");
    }

    const CLAVE_CONFIGURACION = "vistaConscienteConfiguracion";
    const configuracionPredeterminada = {
        usaLentes: false, antecedentesVisuales: [], minutosEntrePausas: 45,
        duracionSesion: 45, duracionPausa: 5, metaDiaria: 5
    };
    let configuracion = { ...configuracionPredeterminada };
    try {
        const guardada = JSON.parse(localStorage.getItem(CLAVE_CONFIGURACION) || "null");
        if (guardada && typeof guardada === "object") configuracion = { ...configuracionPredeterminada, ...guardada };
    } catch (error) { console.warn("No se pudo recuperar la configuración guardada.", error); }

    function leerFrecuenciaGuardada() {
        const valor = Number(configuracion.duracionSesion ?? configuracion.minutosEntrePausas);
        const minutos = Number.isInteger(valor) ? Math.min(120, Math.max(1, valor)) : 45;
        configuracion.minutosEntrePausas = minutos;
        configuracion.duracionSesion = minutos;
        return minutos;
    }
    function guardarFrecuencia(minutos) {
        let actual = {};
        try { actual = JSON.parse(localStorage.getItem(CLAVE_CONFIGURACION) || "{}") || {}; } catch (_) {}
        configuracion = { ...configuracionPredeterminada, ...actual, minutosEntrePausas: minutos, duracionSesion: minutos };
        localStorage.setItem(CLAVE_CONFIGURACION, JSON.stringify(configuracion));
        window.vistaConscienteConfig = configuracion;
    }
    window.vistaConscienteConfig = configuracion;

    // Sincronizar preferencias de modos especiales con la sección Perfil.
    const controlAltaCarga = document.getElementById("alta-carga");
    const controlAltaConcentracion = document.getElementById("alta-concentracion");
    if (controlAltaCarga) {
        controlAltaCarga.checked = Boolean(configuracion.altaCargaAcademica);
        controlAltaCarga.addEventListener("change", () => {
            configuracion.altaCargaAcademica = controlAltaCarga.checked;
            localStorage.setItem(CLAVE_CONFIGURACION, JSON.stringify(configuracion));
        });
    }
    if (controlAltaConcentracion) {
        controlAltaConcentracion.checked = Boolean(configuracion.altaConcentracion);
        controlAltaConcentracion.addEventListener("change", () => {
            configuracion.altaConcentracion = controlAltaConcentracion.checked;
            localStorage.setItem(CLAVE_CONFIGURACION, JSON.stringify(configuracion));
        });
    }

    const botonesActividad = document.querySelectorAll(".opcion-actividad");
    const preparacion = document.getElementById("preparacion-sesion");
    const panelActivo = document.getElementById("panel-sesion-activa");
    const botonIniciar = document.getElementById("boton-sesion");
    const botonPausar = document.getElementById("pausar-sesion");
    const botonReanudarDescanso = document.getElementById("reanudar-descanso");
    const botonIniciarPausa = document.getElementById("iniciar-pausa");
    const botonAccionFinDescanso = document.getElementById("accion-fin-descanso");
    const botonFinalizar = document.getElementById("finalizar-sesion");
    const estadoGlobal = document.getElementById("texto-estado-global");
    const estadoSesionTexto = document.getElementById("estado-sesion-texto");
    const duracionSesion = document.getElementById("duracion-sesion");
    const cuentaPausa = document.getElementById("cuenta-pausa");

    const modal = document.getElementById("modal-duracion-sesion");
    const modalDuracionPausa = document.getElementById("modal-duracion-pausa");
    const modalGuiaPausa = document.getElementById("modal-guia-pausa");
    const iconoGuiaPausa = document.getElementById("icono-guia-pausa");
    const tituloGuiaPausa = document.getElementById("titulo-guia-pausa");
    const descripcionGuiaPausa = document.getElementById("descripcion-guia-pausa");
    const pasosGuiaPausa = document.getElementById("pasos-guia-pausa");
    let minutosPausaConfirmados = 0;
    const inputDuracionPausa = document.getElementById("nueva-duracion-pausa");
    const textoDuracionPausaGuardada = document.getElementById("duracion-pausa-guardada");
    const errorDuracionPausa = document.getElementById("error-duracion-pausa");
    const confirmarDuracionPausa = document.getElementById("confirmar-modal-duracion-pausa");
    const textoDuracionGuardada = document.getElementById("duracion-guardada");
    const inputDuracion = document.getElementById("nueva-duracion-sesion");
    const errorDuracion = document.getElementById("error-duracion-sesion");
    const confirmarDuracion = document.getElementById("confirmar-modal-duracion");
    const modalFinalizar = document.getElementById("modal-confirmar-finalizacion");
    const modalMolestia = document.getElementById("modal-registrar-molestia");

    let actividadSeleccionada = "Estudio";
    let estadoSesion = "inactiva"; // inactiva | activa | pausada | descanso | descanso-pausado | descanso-terminado
    let segundosSesion = 0;
    let segundosHastaPausa = leerFrecuenciaGuardada() * 60;
    let segundosDescanso = Number(configuracion.duracionPausa) * 60;
    let sesionActual = null;
    let pausaActual = null;
    let registroSesionPendiente = null;
    const CLAVE_SESIONES = "vistaConscienteSesiones";
    const CLAVE_REGISTROS_MOLESTIAS = "vistaConscienteRegistrosMolestias";
    const CLAVE_ESTADO_SESION = "vistaConscienteEstadoSesion";
    let pausaPendiente = false;
    let origenPausa = "manual"; // manual | automatica
    let intervalo = null;
    const fechaHoy = new Date().toLocaleDateString("en-CA");
    const CLAVE_PAUSAS = `vistaConscientePausas_v3_${fechaHoy}`;
    // El progreso diario se recupera de las pausas realmente registradas.
    let pausasContadas = Number(localStorage.getItem(CLAVE_PAUSAS) || 0);
    function actualizarProgresoPausas() {
        const meta = Math.max(1, Number(configuracion.metaDiaria) || 1);
        const pausasParaProgreso = Math.min(pausasContadas, meta);
        const porcentaje = Math.min(100, Math.round((pausasParaProgreso / meta) * 100));
        const anillo = document.getElementById("anillo-progreso");
        const textoCircular = document.getElementById("porcentaje-circular");
        const textoPausas = document.getElementById("texto-pausas-completadas");
        const numeroMeta = document.getElementById("numero-meta-pausas");
        const textoPorcentaje = document.getElementById("porcentaje-cumplimiento");
        const barra = document.getElementById("barra-progreso-cumplimiento");
        if (anillo) anillo.style.setProperty("--progreso", `${porcentaje}%`);
        if (textoCircular) textoCircular.textContent = `${porcentaje}%`;
        if (textoPausas) textoPausas.textContent = `${pausasParaProgreso} de ${meta} completadas`;
        if (numeroMeta) numeroMeta.textContent = String(meta);
        if (textoPorcentaje) textoPorcentaje.textContent = `${porcentaje}%`;
        if (barra) barra.style.width = `${porcentaje}%`;
    }
    // Calcula la exposición diaria usando únicamente el tiempo efectivo de actividad.
    // Las pausas se excluyen porque duracionTrabajoSegundos no las contabiliza.
    function actualizarExposicionAcumulada() {
        const elemento = document.getElementById("exposicion-acumulada");
        if (!elemento) return;

        const fechaLocal = (valor) => {
            if (!valor) return "";
            const fecha = new Date(valor);
            if (Number.isNaN(fecha.getTime())) return "";
            return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
        };
        const hoy = fechaLocal(new Date());
        let totalSegundos = 0;

        try {
            const sesiones = JSON.parse(localStorage.getItem(CLAVE_SESIONES) || "[]");
            if (Array.isArray(sesiones)) {
                totalSegundos = sesiones
                    .filter(s => fechaLocal(s.fechaHoraInicio) === hoy)
                    .reduce((suma, s) => suma + Math.max(0, Number(s.duracionTrabajoSegundos ?? s.duracionSegundos ?? 0)), 0);
            }

            const estado = JSON.parse(localStorage.getItem(CLAVE_ESTADO_SESION) || "null");
            const actual = estado?.sesionActual;
            if (actual && fechaLocal(actual.fechaHoraInicio) === hoy) {
                const yaFinalizada = Array.isArray(sesiones) && sesiones.some(s => s.id && s.id === actual.id);
                if (!yaFinalizada) {
                    totalSegundos += Math.max(0, Number(actual.duracionTrabajoSegundos ?? estado.duracionTrabajoSegundos ?? 0));
                }
            }
        } catch (error) {
            console.warn("No se pudo calcular la exposición acumulada.", error);
        }

        const minutos = Math.floor(totalSegundos / 60);
        elemento.textContent = `${minutos} min`;
    }

    function registrarPausaIniciada() {
        const meta = Math.max(1, Number(configuracion.metaDiaria) || 1);
        pausasContadas = Math.min(meta, pausasContadas + 1);
        localStorage.setItem(CLAVE_PAUSAS, String(pausasContadas));
        actualizarProgresoPausas();
    }
    function recuperarPausasDelDia() {
        try {
            const registros = JSON.parse(localStorage.getItem(CLAVE_SESIONES) || "[]");
            const pausasGuardadas = registros.filter(s => s.fechaHoraInicio && new Date(s.fechaHoraInicio).toLocaleDateString("en-CA") === fechaHoy)
                .reduce((n, s) => n + (Array.isArray(s.pausas) ? s.pausas.length : 0), 0);
            const estado = JSON.parse(localStorage.getItem(CLAVE_ESTADO_SESION) || "null");
            const pausasActivas = estado && estado.fechaHoraInicio && new Date(estado.fechaHoraInicio).toLocaleDateString("en-CA") === fechaHoy
                ? (estado.pausas?.length || 0) + (String(estado.estado || "").startsWith("descanso") && !estado.pausas?.some(p => !p.fechaHoraFin) ? 1 : 0)
                : 0;
            const meta = Math.max(1, Number(configuracion.metaDiaria) || 1);
            pausasContadas = Math.min(meta, Math.max(pausasGuardadas, pausasActivas, Number(localStorage.getItem(CLAVE_PAUSAS) || 0)));
            localStorage.setItem(CLAVE_PAUSAS, String(pausasContadas));
        } catch (_) { pausasContadas = Number(localStorage.getItem(CLAVE_PAUSAS) || 0); }
    }
    function restaurarTituloPestana() {
        document.title = "VistaConsciente | Inicio";
    }
    window.addEventListener("focus", restaurarTituloPestana);
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) restaurarTituloPestana();
    });

    function formatoTiempo(segundos) {
        const valor = Math.max(0, Math.floor(segundos));
        return `${String(Math.floor(valor / 60)).padStart(2, "0")}:${String(valor % 60).padStart(2, "0")}`;
    }
    function sonarCampanilla() {
        const modoAltaConcentracion = document.getElementById("alta-concentracion")?.checked === true;
        const modoAltaCarga = document.getElementById("alta-carga")?.checked === true;
        // Ambos modos especiales suprimen el sonido; no generan avisos al activar el switch.
        if (modoAltaConcentracion || modoAltaCarga) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const audio = new AudioContext();
            if (audio.state === "suspended") audio.resume();
            [880, 1174.66].forEach((frecuencia, indice) => {
                const oscilador = audio.createOscillator(); const ganancia = audio.createGain();
                oscilador.type = "sine"; oscilador.frequency.value = frecuencia;
                ganancia.gain.setValueAtTime(0.0001, audio.currentTime + indice * 0.16);
                ganancia.gain.exponentialRampToValueAtTime(0.16, audio.currentTime + indice * 0.16 + 0.025);
                ganancia.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + indice * 0.16 + 0.42);
                oscilador.connect(ganancia); ganancia.connect(audio.destination);
                oscilador.start(audio.currentTime + indice * 0.16); oscilador.stop(audio.currentTime + indice * 0.16 + 0.45);
            });
            setTimeout(() => audio.close(), 1000);
        } catch (error) { console.warn("No se pudo reproducir el aviso.", error); }
    }
    const consejosAltaCarga = [
        ["visibility", "Descanso visual breve", "Mira un objeto lejano durante 20 segundos antes de retomar."],
        ["water_drop", "Hidrátate", "Bebe un poco de agua durante esta pausa."],
        ["air", "Respira con calma", "Haz tres respiraciones lentas para liberar tensión."],
        ["remove_red_eye", "Parpadea conscientemente", "Realiza varios parpadeos suaves para descansar la vista."],
        ["distance", "Cambia el enfoque", "Aparta la mirada de la pantalla y observa algo distante."],
        ["accessibility_new", "Acomoda tu postura", "Relaja los hombros y apoya la espalda."],
        ["light_mode", "Revisa la iluminación", "Evita reflejos y ajusta la luz de tu espacio."],
        ["self_improvement", "Relaja la mirada", "Cierra los ojos unos segundos sin presionarlos."],
        ["directions_walk", "Muévete un momento", "Levántate y camina brevemente por tu espacio."],
        ["pan_tool", "Descansa las manos", "Abre y cierra suavemente las manos y relaja las muñecas."],
        ["monitor", "Ajusta la pantalla", "Comprueba que la pantalla esté a una distancia cómoda."],
        ["chair", "Cambia de posición", "Ajusta tu postura antes de continuar estudiando."],
        ["spa", "Estira el cuello", "Inclina suavemente la cabeza hacia cada lado, sin forzar."],
        ["wb_sunny", "Mira hacia el exterior", "Observa el entorno a través de una ventana, sin mirar al sol."],
        ["sentiment_satisfied", "Relaja el rostro", "Afloja la frente y la mandíbula durante unos segundos."],
        ["potted_plant", "Observa una planta", "Descansa la vista mirando una planta o un objeto natural."],
        ["volume_up", "Escucha un sonido tranquilo", "Tómate unos segundos para escuchar el ambiente sin mirar pantallas."],
        ["edit_note", "Despeja tu escritorio", "Ordena un objeto de tu espacio de estudio."],
        ["local_cafe", "Haz una pausa breve", "Toma agua o una bebida y desconecta de la pantalla."],
        ["self_improvement", "Prepara tu regreso", "Respira, relaja los hombros y vuelve cuando termine tu descanso."]
    ];
    const consejosTrabajo = [
        ["visibility", "Descansa la mirada", "Aparta la vista del monitor y observa un objeto lejano durante 20 segundos."],
        ["monitor", "Ajusta la pantalla", "Mantén el monitor a una distancia cómoda y ligeramente por debajo del nivel de los ojos."],
        ["light_mode", "Evita los reflejos", "Ajusta la iluminación del espacio para reducir los reflejos sobre la pantalla."],
        ["remove_red_eye", "Parpadea con suavidad", "Haz varios parpadeos completos para ayudar a mantener los ojos lubricados."],
        ["chair", "Cambia de postura", "Relaja los hombros, apoya la espalda y acomoda los pies."],
        ["directions_walk", "Aléjate del escritorio", "Camina un momento sin consultar el teléfono ni otra pantalla."],
        ["water_drop", "Bebe agua", "Aprovecha el descanso para hidratarte y desconectar del monitor."],
        ["self_improvement", "Relaja la tensión", "Cierra los ojos unos segundos y respira lentamente, sin presionarlos."],
        ["wb_sunny", "Mira hacia el exterior", "Observa el entorno a través de una ventana, evitando mirar directamente al sol."],
        ["pan_tool", "Descansa las manos", "Estira suavemente los dedos y las muñecas antes de volver al trabajo."]
    ];
    let ultimoConsejoTrabajo = "";
    let ultimoConsejoAltaCarga = "";
    function renderizarConsejos(seleccionados) {
        const contenedor = document.querySelector(".lista-recomendaciones");
        if (!contenedor) return;
        contenedor.innerHTML = seleccionados.map(([icono, titulo, descripcion]) => `
            <article class="tarjeta-recomendacion tarjeta-consejo-dinamico"
                role="button" tabindex="0" aria-haspopup="dialog"
                data-consejo-dinamico="true"
                data-consejo-icono="${icono}"
                data-consejo-titulo="${titulo.replace(/"/g, "&quot;")}"
                data-consejo-descripcion="${descripcion.replace(/"/g, "&quot;")}"
                data-consejo-actividad="${actividadSeleccionada}">
                <span class="icono-recomendacion material-symbols-outlined">${icono}</span>
                <div><h3>${titulo}</h3><p>${descripcion}</p></div>
            </article>`).join("");
    }
    function elegirTresConsejos(lista, ultimo) {
        const disponibles = lista.filter((consejo) => consejo[1] !== ultimo);
        const pool = [...(disponibles.length >= 3 ? disponibles : lista)];
        const seleccionados = [];
        while (seleccionados.length < 3 && pool.length) {
            const indice = Math.floor(Math.random() * pool.length);
            seleccionados.push(pool.splice(indice, 1)[0]);
        }
        return seleccionados;
    }
    function actualizarConsejosParaPausa() {
        // En Trabajo se muestran sus recomendaciones propias. En Estudio,
        // los consejos cambian al iniciar la pausa cuando Alta carga académica está activa.
        if (actividadSeleccionada === "Trabajo") {
            const seleccionados = elegirTresConsejos(consejosTrabajo, ultimoConsejoTrabajo);
            if (seleccionados.length === 3) {
                ultimoConsejoTrabajo = seleccionados[0][1];
                renderizarConsejos(seleccionados);
            }
            return;
        }
        if (document.getElementById("alta-carga")?.checked !== true) return;
        const seleccionados = elegirTresConsejos(consejosAltaCarga, ultimoConsejoAltaCarga);
        if (seleccionados.length === 3) {
            ultimoConsejoAltaCarga = seleccionados[0][1];
            renderizarConsejos(seleccionados);
        }
    }
    function actualizarConsejosAlFinalizarSesion() {
        // Comportamiento predeterminado: al terminar una sesión se renuevan
        // los consejos según la actividad seleccionada, sin depender de los switches.
        if (actividadSeleccionada === "Trabajo") {
            const seleccionados = elegirTresConsejos(consejosTrabajo, ultimoConsejoTrabajo);
            if (seleccionados.length === 3) {
                ultimoConsejoTrabajo = seleccionados[0][1];
                renderizarConsejos(seleccionados);
            }
            return;
        }
        const seleccionados = elegirTresConsejos(consejosAltaCarga, ultimoConsejoAltaCarga);
        if (seleccionados.length === 3) {
            ultimoConsejoAltaCarga = seleccionados[0][1];
            renderizarConsejos(seleccionados);
        }
    }

    function mostrarModal(elemento) {
        elemento.hidden = false; elemento.style.removeProperty("display");
        elemento.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-abierto");
    }
    function ocultarModal(elemento) {
        elemento.hidden = true; elemento.setAttribute("aria-hidden", "true");
        if (modal.hidden && modalDuracionPausa.hidden && modalGuiaPausa.hidden && modalFinalizar.hidden && modalMolestia.hidden) document.body.classList.remove("modal-abierto");
    }
    function abrirModalDuracion() {
        const minutos = leerFrecuenciaGuardada();
        textoDuracionGuardada.textContent = `${minutos} min`;
        inputDuracion.value = String(minutos); errorDuracion.textContent = "";
        mostrarModal(modal); inputDuracion.focus(); inputDuracion.select();
    }
    function cerrarModalDuracion() { ocultarModal(modal); }
    let estadoAntesDeConfigurarPausa = null;
    function abrirModalDuracionPausa() {
        if (estadoSesion !== "activa" && estadoSesion !== "pausada") return;
        estadoAntesDeConfigurarPausa = estadoSesion;
        // Congela el temporizador mientras el usuario elige la duración.
        detenerReloj();
        if (estadoSesion === "activa") estadoSesion = "pausada";
        actualizarInterfazSesion();
        const minutos = Math.min(60, Math.max(1, Number(configuracion.duracionPausa) || 5));
        textoDuracionPausaGuardada.textContent = `${minutos} min`;
        inputDuracionPausa.value = String(minutos);
        errorDuracionPausa.textContent = "";
        modalDuracionPausa.hidden = false;
        modalDuracionPausa.setAttribute("aria-hidden", "false");
        modalDuracionPausa.style.display = "grid";
        document.body.classList.add("modal-abierto");
        requestAnimationFrame(() => { inputDuracionPausa.focus(); inputDuracionPausa.select(); });
    }
    function cerrarModalDuracionPausa() {
        modalDuracionPausa.hidden = true;
        modalDuracionPausa.setAttribute("aria-hidden", "true");
        modalDuracionPausa.style.display = "none";
        if (modal.hidden && modalGuiaPausa.hidden && modalFinalizar.hidden && modalMolestia.hidden) document.body.classList.remove("modal-abierto");
        // Cancelar conserva el tiempo restante y reanuda solo si la sesión estaba activa.
        const reanudar = estadoAntesDeConfigurarPausa === "activa";
        estadoAntesDeConfigurarPausa = null;
        if (reanudar) {
            estadoSesion = "activa";
            actualizarInterfazSesion();
            iniciarReloj();
        } else {
            actualizarInterfazSesion();
        }
    }

    const guiasPausa = {
        Estudio: [
            { icono: "visibility", titulo: "Regla 20-20-20", resumen: "Dale un descanso a tu enfoque visual.", pasos: ["Aparta la mirada de la pantalla.", "Elige un objeto que esté aproximadamente a 6 metros.", "Obsérvalo durante 20 segundos sin volver a mirar la pantalla."] },
            { icono: "remove_red_eye", titulo: "Parpadeo consciente", resumen: "Ayuda a mantener la superficie ocular lubricada.", pasos: ["Mira al frente y relaja el rostro.", "Cierra los párpados suavemente y vuelve a abrirlos.", "Repite el parpadeo lento entre 8 y 10 veces, sin apretar."] },
            { icono: "visibility_off", titulo: "Relajación visual", resumen: "Tómate unos instantes lejos de la pantalla.", pasos: ["Deja de mirar el monitor.", "Cierra los ojos suavemente durante unos segundos.", "Relaja la frente y la mandíbula; no presiones los ojos."] },
            { icono: "accessibility_new", titulo: "Estiramiento de cuello", resumen: "Libera suavemente la tensión acumulada.", pasos: ["Siéntate con la espalda cómoda.", "Inclina lentamente la cabeza hacia un hombro.", "Vuelve al centro y repite hacia el otro lado, sin forzar."] },
            { icono: "self_improvement", titulo: "Respiración consciente", resumen: "Haz una pausa breve para relajar el cuerpo.", pasos: ["Apoya los pies y relaja los hombros.", "Inhala lentamente por la nariz.", "Exhala despacio y repite varias veces a tu ritmo."] }
        ],
        Trabajo: [
            { icono: "monitor", titulo: "Descanso de pantalla", resumen: "Cambia el enfoque después de trabajar frente al monitor.", pasos: ["Aparta la mirada del monitor.", "Busca un objeto distante, preferiblemente a unos 6 metros.", "Obsérvalo durante 20 segundos sin consultar otra pantalla."] },
            { icono: "chair", titulo: "Ajuste postural", resumen: "Acomoda tu cuerpo antes de volver a trabajar.", pasos: ["Apoya la espalda en el respaldo.", "Relaja los hombros y deja los pies apoyados.", "Ajusta la altura para mantener una postura cómoda."] },
            { icono: "pan_tool", titulo: "Relajación de manos", resumen: "Descansa las manos después de usar teclado y ratón.", pasos: ["Extiende suavemente los dedos.", "Abre y cierra las manos sin apretar.", "Realiza pequeños círculos con las muñecas."] },
            { icono: "directions_walk", titulo: "Caminata breve", resumen: "Muévete un momento lejos del escritorio.", pasos: ["Levántate con calma.", "Camina unos minutos por un espacio seguro.", "Evita revisar el celular durante este pequeño recorrido."] },
            { icono: "water_drop", titulo: "Hidratación", resumen: "Aprovecha la pausa para beber agua.", pasos: ["Aléjate de la pantalla.", "Bebe un vaso de agua tranquilamente.", "Regresa a tu espacio cuando estés listo para continuar."] }
        ]
    };
    function mostrarGuiaPausaAleatoria() {
        const lista = guiasPausa[actividadSeleccionada] || guiasPausa.Estudio;
        const guia = lista[Math.floor(Math.random() * lista.length)];
        document.getElementById("etiqueta-guia-pausa").textContent = `GUÍA DE DESCANSO · MODO ${actividadSeleccionada.toUpperCase()}`;
        iconoGuiaPausa.textContent = guia.icono;
        tituloGuiaPausa.textContent = guia.titulo;
        descripcionGuiaPausa.textContent = guia.resumen;
        pasosGuiaPausa.innerHTML = guia.pasos.map(paso => `<li>${paso}</li>`).join("");
        mostrarModal(modalGuiaPausa);
    }
    function continuarDesdeGuiaPausa() {
        ocultarModal(modalGuiaPausa);
        iniciarDescansoManual(minutosPausaConfirmados);
        minutosPausaConfirmados = 0;
    }

    function confirmarInicioPausa() {
        const minutos = inputDuracionPausa.valueAsNumber;
        if (!Number.isInteger(minutos) || minutos < 1 || minutos > 60) {
            errorDuracionPausa.textContent = "Introduce un número entero entre 1 y 60 minutos.";
            inputDuracionPausa.focus();
            return;
        }
        configuracion.duracionPausa = minutos;
        let actual = {};
        try { actual = JSON.parse(localStorage.getItem(CLAVE_CONFIGURACION) || "{}") || {}; } catch (_) {}
        const nuevaConfiguracion = { ...configuracionPredeterminada, ...actual, duracionPausa: minutos };
        localStorage.setItem(CLAVE_CONFIGURACION, JSON.stringify(nuevaConfiguracion));
        configuracion = nuevaConfiguracion;
        window.vistaConscienteConfig = configuracion;
        estadoAntesDeConfigurarPausa = null; // Confirmar no debe reanudar la sesión anterior.
        modalDuracionPausa.hidden = true;
        modalDuracionPausa.setAttribute("aria-hidden", "true");
        modalDuracionPausa.style.display = "none";
        // Primero se muestra la guía; el temporizador de descanso comienza
        // únicamente cuando el usuario pulsa «Continuar».
        minutosPausaConfirmados = minutos;
        mostrarGuiaPausaAleatoria();
    }
    function confirmarInicioSesion() {
        const minutos = inputDuracion.valueAsNumber;
        if (!Number.isInteger(minutos) || minutos < 1 || minutos > 120) {
            errorDuracion.textContent = "Introduce un número entero entre 1 y 120 minutos.";
            inputDuracion.focus(); return;
        }
        guardarFrecuencia(minutos);
        segundosHastaPausa = minutos * 60;
        cerrarModalDuracion();
        iniciarSesion();
    }
    function publicarEstadoSesion() {
        const enPausa = estadoSesion.startsWith("descanso");
        const estado = {
            id: sesionActual?.id || null,
            estado: estadoSesion,
            actividad: sesionActual?.actividad || actividadSeleccionada,
            fechaHoraInicio: sesionActual?.fechaHoraInicio || null,
            duracionTrabajoSegundos: sesionActual?.duracionTrabajoSegundos || 0,
            duracionPausasSegundos: sesionActual?.duracionPausasSegundos || 0,
            pausas: sesionActual?.pausas || [],
            sesionActual: sesionActual ? { ...sesionActual, pausas: [...(sesionActual.pausas || [])] } : null,
            pausaActual: pausaActual ? { ...pausaActual } : null,
            segundosSesion,
            segundosRestantes: enPausa ? segundosDescanso : segundosHastaPausa,
            segundosHastaPausa,
            segundosDescanso,
            fechaHoraInicio: sesionActual?.fechaHoraInicio || null,
            pausasCompletadas: sesionActual?.pausas?.length || 0,
            actualizadoEn: new Date().toISOString()
        };
        localStorage.setItem(CLAVE_ESTADO_SESION, JSON.stringify(estado));
    }
    function actualizarEstadoGlobal() {
        const contenedorEstado = document.getElementById("estado-sesion");
        // El estado rojo solo corresponde a una sesión que está contando activamente.
        if (contenedorEstado) contenedorEstado.classList.toggle("sesion-activa", estadoSesion === "activa");
        if (estadoSesion === "activa") estadoGlobal.textContent = `Sesión activa · ${formatoTiempo(segundosSesion)}`;
        else if (estadoSesion === "pausada") estadoGlobal.textContent = `Sesión pausada · ${formatoTiempo(segundosSesion)}`;
        else if (estadoSesion.startsWith("descanso")) {
            const tiempoPausa = Number(pausaActual?.segundosEfectivos) || 0;
            estadoGlobal.textContent = `Pausa · ${formatoTiempo(tiempoPausa)}`;
        }
        else estadoGlobal.textContent = "Sin sesión activa";
        publicarEstadoSesion();
    }
    function actualizarInterfazSesion() {
        const enCurso = estadoSesion !== "inactiva";
        preparacion.hidden = enCurso; panelActivo.hidden = !enCurso;
        const contenedorEstado = document.getElementById("estado-sesion");
        if (contenedorEstado) contenedorEstado.classList.toggle("sesion-activa", estadoSesion === "activa");
        if (!enCurso) {
            estadoGlobal.textContent = "Sin sesión activa";
            publicarEstadoSesion();
            return;
        }
        duracionSesion.textContent = formatoTiempo(segundosSesion);
        actualizarEstadoGlobal();
        // Cuando termina la cuenta para iniciar una pausa, no se permite pausar
        // el temporizador en ese instante; la acción de continuar sigue disponible.
        botonPausar.disabled = estadoSesion === "activa" && segundosHastaPausa <= 0;
        const enDescanso = estadoSesion.startsWith("descanso");
        botonPausar.hidden = enDescanso;
        botonReanudarDescanso.hidden = !enDescanso;
        botonIniciarPausa.hidden = enDescanso;
        botonAccionFinDescanso.hidden = !enDescanso;
        if (estadoSesion === "activa") {
            estadoSesionTexto.textContent = `${actividadSeleccionada.toUpperCase()} EN CURSO`;
            botonPausar.innerHTML = '<span class="material-symbols-outlined">pause</span><span>Pausar</span>';
            cuentaPausa.textContent = formatoTiempo(segundosHastaPausa);
        } else if (estadoSesion === "pausada") {
            estadoSesionTexto.textContent = "SESIÓN PAUSADA";
            botonPausar.innerHTML = '<span class="material-symbols-outlined">play_arrow</span><span>Continuar</span>';
            cuentaPausa.textContent = formatoTiempo(segundosHastaPausa);
        } else if (estadoSesion === "descanso") {
            estadoSesionTexto.textContent = "PAUSA EN CURSO";
            botonReanudarDescanso.innerHTML = '<span class="material-symbols-outlined">pause</span><span>Pausar</span>';
            cuentaPausa.textContent = formatoTiempo(segundosDescanso);
            configurarAccionFinDescanso();
        } else if (estadoSesion === "descanso-pausado") {
            estadoSesionTexto.textContent = "PAUSA DETENIDA";
            botonReanudarDescanso.innerHTML = '<span class="material-symbols-outlined">play_arrow</span><span>Continuar pausa</span>';
            cuentaPausa.textContent = formatoTiempo(segundosDescanso);
            configurarAccionFinDescanso();
        } else if (estadoSesion === "descanso-terminado") {
            estadoSesionTexto.textContent = "PAUSA COMPLETADA";
            botonReanudarDescanso.hidden = true;
            cuentaPausa.textContent = "00:00";
            configurarAccionFinDescanso();
        }
    }
    function configurarAccionFinDescanso() {
        const automatica = origenPausa === "automatica";
        botonAccionFinDescanso.innerHTML = automatica
            ? '<span class="material-symbols-outlined">play_arrow</span><span>Iniciar sesión</span>'
            : '<span class="material-symbols-outlined">play_arrow</span><span>Continuar sesión</span>';
    }
    function detenerReloj() { if (intervalo !== null) { clearInterval(intervalo); intervalo = null; } }
    function guardarEnLocalStorage(clave, registro) {
        let lista = [];
        try {
            lista = JSON.parse(localStorage.getItem(clave) || "[]");
            if (!Array.isArray(lista)) lista = [];
        } catch (_) { lista = []; }
        lista.push(registro);
        localStorage.setItem(clave, JSON.stringify(lista));
    }
    function finalizarPausaActual() {
        if (!pausaActual || !sesionActual) return;
        pausaActual.fechaHoraFin = new Date().toISOString();
        pausaActual.duracionSegundos = Math.max(0, Math.round((Date.parse(pausaActual.fechaHoraFin) - Date.parse(pausaActual.fechaHoraInicio)) / 1000));
        // El tiempo efectivo de pausa se calcula con el contador, excluyendo los momentos en que se pausó el descanso.
        pausaActual.duracionEfectivaSegundos = Math.max(0, Number(pausaActual.segundosEfectivos) || 0);
        pausaActual.duracionSegundos = pausaActual.duracionEfectivaSegundos;
        delete pausaActual.segundosEfectivos;
        sesionActual.pausas.push({ ...pausaActual });
        sesionActual.duracionPausasSegundos += pausaActual.duracionEfectivaSegundos;
        pausaActual = null;
    }
    function mostrarModalMolestiaDeSesion(registroSesion) {
        registroSesionPendiente = registroSesion || null;
        actividadMolestia.textContent = registroSesion?.actividad || actividadSeleccionada;
        errorMolestia.textContent = "";
        opcionesMolestia.forEach((opcion) => opcion.setAttribute("aria-pressed", "false"));
        intensidadMolestia.value = "3";
        valorIntensidadMolestia.textContent = "3 / 10";
        actualizarSeleccionMolestias();
        mostrarModal(modalMolestia);
    }
    function cerrarSesionYRegistrarMolestia(motivo = "manual") {
        if (!sesionActual) return;
        detenerReloj();
        if (pausaActual) finalizarPausaActual();
        const fechaHoraFin = new Date().toISOString();
        const registro = {
            ...sesionActual,
            fechaHoraFin,
            motivoFinalizacion: motivo,
            duracionSegundos: sesionActual.duracionTrabajoSegundos,
            duracionPausasSegundos: sesionActual.duracionPausasSegundos,
            duracionTotalSegundos: sesionActual.duracionTrabajoSegundos + sesionActual.duracionPausasSegundos
        };
        guardarEnLocalStorage(CLAVE_SESIONES, registro);
        actualizarExposicionAcumulada();
        sesionActual = null;
        document.title = "VistaConsciente | Inicio";
        estadoSesion = "inactiva";
        segundosSesion = 0;
        actualizarConsejosAlFinalizarSesion();
        segundosHastaPausa = Number(configuracion.duracionSesion || configuracion.minutosEntrePausas) * 60;
        segundosDescanso = Number(configuracion.duracionPausa) * 60;
        pausaPendiente = false;
        ocultarModal(modalFinalizar);
        actualizarInterfazSesion();
        mostrarModalMolestiaDeSesion(registro);
    }
    function mostrarMensajeSesionCompletada() {
        let aviso = document.getElementById("mensaje-sesion-completada");
        if (!aviso) {
            aviso = document.createElement("div");
            aviso.id = "mensaje-sesion-completada";
            aviso.className = "mensaje-sesion-completada";
            aviso.setAttribute("role", "status");
            aviso.innerHTML = '<span class="material-symbols-outlined">check_circle</span><div><strong>¡Completaste el tiempo de tu sesión!</strong><p>Te recomendamos realizar una pausa para descansar la vista y continuar después con una nueva sesión.</p></div>';
            document.querySelector(".contenido-principal")?.prepend(aviso);
        }
    }
    function iniciarReloj() {
        detenerReloj();
        intervalo = setInterval(() => {
            if (estadoSesion === "activa") {
                segundosSesion++;
                if (sesionActual) sesionActual.duracionTrabajoSegundos++;
                if (segundosHastaPausa > 0) segundosHastaPausa--;
                if (segundosHastaPausa <= 0 && !pausaPendiente) {
                    segundosHastaPausa = 0;
                    pausaPendiente = true;
                    document.title = "¡Terminó el tiempo de la sesión! | VistaConsciente";
                    sonarCampanilla();
                    detenerReloj();
                    cerrarSesionYRegistrarMolestia("tiempo_agotado");
                    mostrarMensajeSesionCompletada();
                }
            } else if (estadoSesion === "descanso") {
                segundosDescanso--;
                if (sesionActual && pausaActual) pausaActual.segundosEfectivos = (pausaActual.segundosEfectivos || 0) + 1;
                if (segundosDescanso <= 0) {
                    segundosDescanso = 0;
                    estadoSesion = "descanso-terminado";
                    finalizarPausaActual();
                    document.title = "¡Terminó el tiempo de la pausa! | VistaConsciente";
                    sonarCampanilla();
                }
            }
            actualizarInterfazSesion();
            actualizarExposicionAcumulada();
        }, 1000);
    }
    function iniciarDescansoManual(minutosElegidos = Number(configuracion.duracionPausa)) {
        if (estadoSesion !== "activa" && estadoSesion !== "pausada") return;
        origenPausa = pausaPendiente ? "automatica" : "manual";
        estadoSesion = "descanso";
        if (sesionActual) {
            pausaActual = { fechaHoraInicio: new Date().toISOString(), segundosEfectivos: 0, origen: origenPausa };
        }
        registrarPausaIniciada();
        actualizarConsejosParaPausa();
        segundosDescanso = Math.min(60, Math.max(1, Number(minutosElegidos) || 5)) * 60;
        actualizarInterfazSesion();
        iniciarReloj();
    }
    function pausarOContinuarSesion() {
        if (estadoSesion === "activa" && segundosHastaPausa <= 0) return;
        if (estadoSesion === "activa") estadoSesion = "pausada";
        else if (estadoSesion === "pausada") estadoSesion = "activa";
        actualizarInterfazSesion();
    }
    function pausarOReanudarDescanso() {
        if (estadoSesion === "descanso") estadoSesion = "descanso-pausado";
        else if (estadoSesion === "descanso-pausado") estadoSesion = "descanso";
        actualizarInterfazSesion();
    }
    function continuarSesionTrasDescanso() {
        if (pausaActual) finalizarPausaActual();
        if (origenPausa === "automatica") { abrirModalDuracion(); return; }
        document.title = "VistaConsciente | Inicio";
        estadoSesion = "activa";
        actualizarInterfazSesion();
        iniciarReloj();
    }
    function iniciarSesion() {
        document.title = "VistaConsciente | Inicio";
        document.getElementById("mensaje-sesion-completada")?.remove();
        estadoSesion = "activa"; segundosSesion = 0;
        let sesionesGuardadas = [];
        try {
            sesionesGuardadas = JSON.parse(localStorage.getItem(CLAVE_SESIONES) || "[]");
            if (!Array.isArray(sesionesGuardadas)) sesionesGuardadas = [];
        } catch (_) { sesionesGuardadas = []; }
        const numeroSesion = sesionesGuardadas.reduce((max, sesion) => Math.max(max, Number(sesion.numeroSesion) || 0), 0) + 1;
        sesionActual = {
            id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `sesion-${Date.now()}`,
            numeroSesion,
            actividad: actividadSeleccionada,
            fechaHoraInicio: new Date().toISOString(),
            duracionTrabajoSegundos: 0,
            duracionPausasSegundos: 0,
            pausas: []
        };
        pausaActual = null;
        segundosHastaPausa = Number(configuracion.duracionSesion || configuracion.minutosEntrePausas) * 60;
        segundosDescanso = Number(configuracion.duracionPausa) * 60;
        pausaPendiente = false;
        actualizarInterfazSesion(); iniciarReloj();
    }
    function finalizarSesion() {
        cerrarSesionYRegistrarMolestia("finalizacion_manual");
    }

    botonesActividad.forEach((boton) => boton.addEventListener("click", () => {
        if (estadoSesion !== "inactiva") return;
        botonesActividad.forEach((opcion) => opcion.classList.remove("activa"));
        boton.classList.add("activa"); actividadSeleccionada = boton.dataset.actividad;
        document.getElementById("ayuda-concentracion").textContent = actividadSeleccionada === "Trabajo" ? "Avisos discretos, sin interrupciones" : "Avisos discretos";
        document.getElementById("ayuda-carga").textContent = actividadSeleccionada === "Trabajo" ? "Pausas y consejos reforzados" : "Pausas reforzadas";
        document.getElementById("texto-boton-sesion").textContent = `Iniciar sesión de ${actividadSeleccionada}`;
    }));
    // Registro rápido de molestias visuales.
    const botonAbrirMolestia = document.getElementById("abrir-modal-molestia");
    if (window.location.hash === "#registro-rapido") {
        requestAnimationFrame(() => mostrarModalMolestiaDeSesion(sesionActual ? {
            id: sesionActual.id,
            actividad: sesionActual.actividad,
            fechaHoraInicio: sesionActual.fechaHoraInicio
        } : null));
    }
    const botonGuardarMolestia = document.getElementById("guardar-modal-molestia");
    const intensidadMolestia = document.getElementById("intensidad-molestia");
    const valorIntensidadMolestia = document.getElementById("valor-intensidad-molestia");
    const actividadMolestia = document.getElementById("actividad-molestia");
    const errorMolestia = document.getElementById("error-molestia");
    const opcionesMolestia = [...document.querySelectorAll(".opcion-molestia")];
    function actualizarSeleccionMolestias() {
        const seleccionadas = opcionesMolestia.filter((opcion) => opcion.getAttribute("aria-pressed") === "true");
        botonGuardarMolestia.disabled = seleccionadas.length === 0;
        errorMolestia.textContent = "";
    }
    botonAbrirMolestia.addEventListener("click", () => {
        mostrarModalMolestiaDeSesion(sesionActual ? {
            id: sesionActual.id,
            actividad: sesionActual.actividad,
            fechaHoraInicio: sesionActual.fechaHoraInicio
        } : null);
    });
    opcionesMolestia.forEach((opcion) => opcion.addEventListener("click", () => {
        const seleccionado = opcion.getAttribute("aria-pressed") === "true";
        opcion.setAttribute("aria-pressed", String(!seleccionado));
        actualizarSeleccionMolestias();
    }));
    intensidadMolestia.addEventListener("input", () => { valorIntensidadMolestia.textContent = `${intensidadMolestia.value} / 10`; });
    function cerrarModalMolestia() {
        ocultarModal(modalMolestia);
        registroSesionPendiente = null;
    }
    document.getElementById("cancelar-modal-molestia").addEventListener("click", cerrarModalMolestia);
    modalMolestia.addEventListener("click", (evento) => { if (evento.target === modalMolestia) cerrarModalMolestia(); });
    botonGuardarMolestia.addEventListener("click", () => {
        const molestias = opcionesMolestia.filter((opcion) => opcion.getAttribute("aria-pressed") === "true").map((opcion) => opcion.textContent.trim());
        if (!molestias.length) { errorMolestia.textContent = "Selecciona al menos una molestia."; return; }
        const registroMolestia = {
            id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `molestia-${Date.now()}`,
            molestias,
            intensidad: Number(intensidadMolestia.value),
            actividad: registroSesionPendiente?.actividad || actividadSeleccionada,
            fechaHora: new Date().toISOString(),
            sesionId: registroSesionPendiente?.id || sesionActual?.id || null,
            numeroSesion: registroSesionPendiente?.numeroSesion || sesionActual?.numeroSesion || null,
            sesionFechaHoraInicio: registroSesionPendiente?.fechaHoraInicio || sesionActual?.fechaHoraInicio || null,
            vinculadaASesionFinalizada: Boolean(registroSesionPendiente?.fechaHoraFin),
            sesion: registroSesionPendiente ? {
                fechaHoraInicio: registroSesionPendiente.fechaHoraInicio,
                fechaHoraFin: registroSesionPendiente.fechaHoraFin || null,
                numeroSesion: registroSesionPendiente.numeroSesion || null,
                actividad: registroSesionPendiente.actividad || actividadSeleccionada,
                duracionSegundos: registroSesionPendiente.duracionSegundos ?? null,
                duracionPausasSegundos: registroSesionPendiente.duracionPausasSegundos ?? null
            } : null
        };
        guardarEnLocalStorage(CLAVE_REGISTROS_MOLESTIAS, registroMolestia);
        registroSesionPendiente = null;
        opcionesMolestia.forEach((opcion) => opcion.setAttribute("aria-pressed", "false"));
        intensidadMolestia.value = "3"; valorIntensidadMolestia.textContent = "3 / 10";
        actualizarSeleccionMolestias(); cerrarModalMolestia();
    });

    botonIniciar.addEventListener("click", abrirModalDuracion);
    confirmarDuracion.addEventListener("click", confirmarInicioSesion);
    document.getElementById("cancelar-modal-duracion").addEventListener("click", cerrarModalDuracion);
    document.getElementById("cerrar-modal-duracion").addEventListener("click", cerrarModalDuracion);
    modal.addEventListener("click", (evento) => { if (evento.target === modal) cerrarModalDuracion(); });
    confirmarDuracionPausa.addEventListener("click", confirmarInicioPausa);
    document.getElementById("continuar-guia-pausa").addEventListener("click", continuarDesdeGuiaPausa);
    document.getElementById("cancelar-modal-duracion-pausa").addEventListener("click", cerrarModalDuracionPausa);
    document.getElementById("cerrar-modal-duracion-pausa").addEventListener("click", cerrarModalDuracionPausa);
    modalDuracionPausa.addEventListener("click", (evento) => { if (evento.target === modalDuracionPausa) cerrarModalDuracionPausa(); });
    inputDuracionPausa.addEventListener("keydown", (evento) => {
        if (evento.key === "Enter") confirmarInicioPausa();
        if (evento.key === "Escape") cerrarModalDuracionPausa();
    });
    inputDuracion.addEventListener("keydown", (evento) => {
        if (evento.key === "Enter") confirmarInicioSesion();
        if (evento.key === "Escape") { cerrarModalDuracion(); cerrarModalMolestia(); ocultarModal(modalFinalizar); }
    });
    botonPausar.addEventListener("click", pausarOContinuarSesion);
    botonIniciarPausa.addEventListener("click", abrirModalDuracionPausa);
    botonReanudarDescanso.addEventListener("click", pausarOReanudarDescanso);
    botonAccionFinDescanso.addEventListener("click", continuarSesionTrasDescanso);
    botonFinalizar.addEventListener("click", () => mostrarModal(modalFinalizar));
    document.getElementById("cancelar-finalizacion").addEventListener("click", () => ocultarModal(modalFinalizar));
    document.getElementById("cerrar-modal-finalizacion").addEventListener("click", () => ocultarModal(modalFinalizar));
    document.getElementById("confirmar-finalizacion").addEventListener("click", finalizarSesion);
    modalFinalizar.addEventListener("click", (evento) => { if (evento.target === modalFinalizar) ocultarModal(modalFinalizar); });

    // Los consejos variables de Estudio y Trabajo también abren el mismo modal.
    const metadatosConsejos = {
        "Descanso visual breve": { molestias:["Cansancio visual","Visión borrosa temporal"], prevencion:"Repite descansos visuales durante la jornada y alterna la mirada entre la pantalla y objetos lejanos. Evita volver inmediatamente a fijar la vista sin parpadear." },
        "Hidrátate": { molestias:["Sequedad ocular","Irritación"], prevencion:"Mantén agua disponible y bebe regularmente durante el día. Recuerda que la hidratación complementa, pero no sustituye, los descansos visuales ni la atención profesional si las molestias persisten." },
        "Respira con calma": { molestias:["Dolor de cabeza","Tensión muscular"], prevencion:"Haz pequeñas pausas de respiración, relaja mandíbula y hombros y evita mantener una postura rígida durante mucho tiempo." },
        "Parpadea conscientemente": { molestias:["Sequedad ocular","Ardor","Irritación"], prevencion:"Realiza parpadeos completos y suaves con regularidad, especialmente al leer o concentrarte. Intercala descansos lejos de la pantalla." },
        "Cambia el enfoque": { molestias:["Cansancio visual","Visión borrosa temporal"], prevencion:"Alterna el enfoque cercano con objetos lejanos varias veces durante el día y realiza pausas periódicas de pantalla." },
        "Acomoda tu postura": { molestias:["Dolor de cuello","Dolor de espalda","Tensión en hombros"], prevencion:"Apoya la espalda, relaja los hombros, mantén los pies apoyados y ajusta silla y escritorio para evitar posturas forzadas." },
        "Cambia de postura": { molestias:["Dolor de cuello","Dolor de espalda","Tensión muscular"], prevencion:"Alterna la posición con frecuencia, evita encorvarte y ajusta silla, escritorio y pantalla para mantener una postura cómoda." },
        "Revisa la iluminación": { molestias:["Cansancio visual","Dolor de cabeza","Sensibilidad a la luz"], prevencion:"Evita reflejos directos, ajusta el brillo al ambiente y procura una iluminación uniforme en el espacio." },
        "Relaja la mirada": { molestias:["Cansancio visual","Sequedad ocular"], prevencion:"Cierra los ojos suavemente unos segundos sin presionarlos y combina esta práctica con pausas mirando a lo lejos." },
        "Muévete un momento": { molestias:["Dolor de cuello","Dolor de espalda","Tensión muscular"], prevencion:"Levántate periódicamente, camina unos minutos y evita permanecer en la misma postura durante periodos prolongados." },
        "Descansa las manos": { molestias:["Tensión en manos","Molestias en muñecas"], prevencion:"Relaja las manos, cambia de posición y realiza movimientos suaves de dedos y muñecas. Mantén teclado y mouse a una altura cómoda." },
        "Ajusta la pantalla": { molestias:["Cansancio visual","Dolor de cuello","Dolor de cabeza"], prevencion:"Coloca la pantalla a una distancia cómoda, ligeramente por debajo del nivel de los ojos, y aumenta el tamaño del texto si necesitas acercarte." },
        "Cambia de posición": { molestias:["Dolor de cuello","Dolor de espalda","Tensión muscular"], prevencion:"Alterna la postura, apoya la espalda y ajusta la altura de la silla y la pantalla para mantener una posición neutral." },
        "Estira el cuello": { molestias:["Dolor de cuello","Tensión en hombros"], prevencion:"Realiza movimientos lentos y suaves sin rebotes ni forzar el rango. Ajusta la pantalla para no mantener la cabeza inclinada." },
        "Mira hacia el exterior": { molestias:["Cansancio visual","Fatiga ocular"], prevencion:"Haz descansos visuales mirando el entorno a una distancia cómoda; nunca mires directamente al sol." },
        "Relaja el rostro": { molestias:["Tensión facial","Dolor de cabeza"], prevencion:"Relaja la frente, la mandíbula y los músculos faciales. Evita apretar los dientes mientras te concentras." },
        "Observa una planta": { molestias:["Cansancio visual","Fatiga ocular"], prevencion:"Usa este momento para apartar la mirada de la pantalla y enfocar un objeto a distancia. Mantén descansos visuales frecuentes." },
        "Escucha un sonido tranquilo": { molestias:["Cansancio visual","Tensión mental"], prevencion:"Aprovecha el audio para descansar la vista sin mirar otra pantalla y mantén pausas regulares durante la actividad." },
        "Despeja tu escritorio": { molestias:["Tensión en cuello","Dolor de espalda"], prevencion:"Organiza los objetos de uso frecuente para evitar giros y estiramientos repetidos. Mantén el área de trabajo despejada y ergonómica." },
        "Haz una pausa breve": { molestias:["Cansancio visual","Sequedad ocular","Tensión muscular"], prevencion:"Aléjate de todas las pantallas durante unos minutos, hidrátate y cambia de postura antes de retomar." },
        "Prepara tu regreso": { molestias:["Cansancio visual","Tensión muscular"], prevencion:"Antes de volver, acomoda tu postura, ajusta la pantalla y retoma con pausas programadas en lugar de mantener la mirada fija continuamente." },
        "Descansa la mirada": { molestias:["Cansancio visual","Visión borrosa temporal"], prevencion:"Mira a lo lejos de forma periódica y aplica descansos visuales durante la jornada." },
        "Evita los reflejos": { molestias:["Cansancio visual","Dolor de cabeza","Sensibilidad a la luz"], prevencion:"Reubica la pantalla respecto de ventanas y lámparas, ajusta el brillo y utiliza iluminación ambiental uniforme." },
        "Parpadea con suavidad": { molestias:["Sequedad ocular","Ardor","Irritación"], prevencion:"Parpadea de forma completa y suave con frecuencia, sobre todo al concentrarte en el monitor." },
        "Aléjate del escritorio": { molestias:["Cansancio visual","Dolor de cuello","Dolor de espalda"], prevencion:"Camina brevemente sin consultar el celular y aprovecha para cambiar la postura y descansar la vista." },
        "Bebe agua": { molestias:["Sequedad ocular","Irritación"], prevencion:"Bebe agua de manera regular y recuerda que el descanso visual y el parpadeo consciente también son importantes." },
        "Relaja la tensión": { molestias:["Dolor de cabeza","Tensión muscular","Cansancio visual"], prevencion:"Realiza pausas breves, respira con calma y relaja los músculos sin presionar los ojos." }
    };
    function abrirDetalleConsejoDinamico(tarjeta) {
        const titulo = tarjeta.dataset.consejoTitulo;
        const descripcion = tarjeta.dataset.consejoDescripcion;
        const actividad = tarjeta.dataset.consejoActividad || "Estudio";
        const meta = metadatosConsejos[titulo] || { molestias:["Cansancio visual","Tensión muscular"], prevencion:"Realiza pausas periódicas, ajusta tu espacio de trabajo y evita mantener la misma postura o la mirada fija durante periodos prolongados." };
        document.getElementById("titulo-modal-recomendacion").textContent = titulo;
        document.getElementById("icono-modal-recomendacion").textContent = tarjeta.dataset.consejoIcono || "tips_and_updates";
        document.getElementById("habito-modal-recomendacion").textContent = `${descripcion} Incorpora este hábito de forma regular durante el uso de pantallas.`;
        document.getElementById("actividad-modal-recomendacion").textContent = actividad === "Trabajo"
            ? "Trabajo frente al monitor, revisión de documentos, videollamadas y tareas digitales que requieren concentración sostenida."
            : "Estudio con computadora, tablet o celular, lectura digital, clases virtuales y elaboración de trabajos académicos.";
        document.getElementById("prevencion-modal-recomendacion").textContent = meta.prevencion;
        document.getElementById("etiquetas-modal-recomendacion").innerHTML =
            meta.molestias.map(etiqueta => `<span class="etiqueta-molestia-recomendacion">${etiqueta}</span>`).join("");
        mostrarModal(modalRecomendacion);
    }

    // Detalles independientes para las tres recomendaciones preventivas.
    const modalRecomendacion = document.getElementById("modal-recomendacion");
    const datosRecomendaciones = {
        "20-20-20": {
            titulo: "Regla 20-20-20",
            icono: "visibility",
            habito: "Cuando uses una pantalla durante un periodo prolongado, aparta la mirada cada 20 minutos y observa un objeto a unos 6 metros durante al menos 20 segundos. Este hábito ayuda a interrumpir el esfuerzo continuo de enfoque en distancias cercanas.",
            molestias: ["Cansancio visual", "Dolor de cabeza", "Visión borrosa temporal"],
            actividad: "Estudio o trabajo frente a una computadora, tablet o celular, especialmente al leer o realizar tareas que requieren concentración visual sostenida.",
            prevencion: "Programa recordatorios cada 20 minutos, mira a lo lejos durante 20 segundos y aprovecha para parpadear con naturalidad. Complementa este hábito con pausas más largas cuando las necesites."
        },
        luz: {
            titulo: "Ajusta la luz",
            icono: "light_mode",
            habito: "Adapta el brillo de la pantalla a la iluminación del ambiente y ubícala de modo que las ventanas o lámparas no se reflejen directamente en ella. Evita usar la pantalla con un contraste incómodo entre el entorno y su brillo.",
            molestias: ["Cansancio visual", "Dolor de cabeza", "Sensibilidad a la luz"],
            actividad: "Lectura, clases virtuales, elaboración de trabajos o videollamadas en espacios con iluminación muy intensa, tenue o con reflejos.",
            prevencion: "Coloca la pantalla perpendicular a las ventanas, reduce los reflejos, ajusta el brillo al entorno y utiliza una iluminación ambiental uniforme. Si cambias de espacio, vuelve a comprobar el brillo."
        },
        hidratacion: {
            titulo: "Hidrátate y parpadea",
            icono: "water_drop",
            habito: "Durante el uso de pantallas es común reducir la frecuencia de parpadeo. Mantén una hidratación habitual y realiza parpadeos completos y conscientes, sobre todo cuando estés concentrado mirando la pantalla.",
            molestias: ["Sequedad ocular", "Irritación", "Sensación de ardor"],
            actividad: "Sesiones prolongadas de estudio, trabajo, lectura o entretenimiento digital en las que mantienes la mirada fija durante mucho tiempo.",
            prevencion: "Ten agua a tu alcance, recuerda parpadear completamente y realiza pausas para descansar la vista. Si la sequedad o irritación persiste, consulta con un profesional de salud visual."
        }
    };
    function abrirDetalleRecomendacion(clave) {
        const dato = datosRecomendaciones[clave];
        if (!dato) return;
        document.getElementById("titulo-modal-recomendacion").textContent = dato.titulo;
        document.getElementById("icono-modal-recomendacion").textContent = dato.icono;
        document.getElementById("habito-modal-recomendacion").textContent = dato.habito;
        document.getElementById("actividad-modal-recomendacion").textContent = dato.actividad;
        document.getElementById("prevencion-modal-recomendacion").textContent = dato.prevencion;
        document.getElementById("etiquetas-modal-recomendacion").innerHTML =
            dato.molestias.map(etiqueta => `<span class="etiqueta-molestia-recomendacion">${etiqueta}</span>`).join("");
        mostrarModal(modalRecomendacion);
    }
    const listaConsejos = document.querySelector(".lista-recomendaciones");
    listaConsejos?.addEventListener("click", evento => {
        const tarjeta = evento.target.closest(".tarjeta-consejo-dinamico");
        if (tarjeta) abrirDetalleConsejoDinamico(tarjeta);
    });
    listaConsejos?.addEventListener("keydown", evento => {
        const tarjeta = evento.target.closest(".tarjeta-consejo-dinamico");
        if (tarjeta && (evento.key === "Enter" || evento.key === " ")) {
            evento.preventDefault();
            abrirDetalleConsejoDinamico(tarjeta);
        }
    });
    document.querySelectorAll(".tarjeta-recomendacion[data-recomendacion]").forEach(tarjeta => {
        tarjeta.addEventListener("click", () => abrirDetalleRecomendacion(tarjeta.dataset.recomendacion));
        tarjeta.addEventListener("keydown", evento => {
            if (evento.key === "Enter" || evento.key === " ") {
                evento.preventDefault();
                abrirDetalleRecomendacion(tarjeta.dataset.recomendacion);
            }
        });
    });
    const cerrarRecomendacion = () => ocultarModal(modalRecomendacion);
    document.getElementById("cerrar-modal-recomendacion").addEventListener("click", cerrarRecomendacion);
    document.getElementById("entendido-recomendacion").addEventListener("click", cerrarRecomendacion);
    modalRecomendacion.addEventListener("click", evento => {
        if (evento.target === modalRecomendacion) cerrarRecomendacion();
    });



    function restaurarSesionGuardada() {
        try {
            const guardado = JSON.parse(localStorage.getItem(CLAVE_ESTADO_SESION) || "null");
            if (!guardado || !guardado.estado || guardado.estado === "inactiva" || !guardado.sesionActual) return false;

            estadoSesion = guardado.estado;
            sesionActual = { ...guardado.sesionActual, pausas: [...(guardado.sesionActual.pausas || [])] };
            pausaActual = guardado.pausaActual ? { ...guardado.pausaActual } : null;
            actividadSeleccionada = guardado.actividad || sesionActual.actividad || "Estudio";
            segundosSesion = Math.max(0, Number(guardado.segundosSesion) || 0);
            segundosHastaPausa = Math.max(0, Number(guardado.segundosHastaPausa ?? guardado.segundosRestantes) || 0);
            segundosDescanso = Math.max(0, Number(guardado.segundosDescanso ?? (estadoSesion.startsWith("descanso") ? guardado.segundosRestantes : configuracion.duracionPausa * 60)) || 0);
            pausaPendiente = segundosHastaPausa <= 0;

            const ultimaActualizacion = new Date(guardado.actualizadoEn || Date.now()).getTime();
            const transcurrido = Math.max(0, Math.floor((Date.now() - ultimaActualizacion) / 1000));
            if (estadoSesion === "activa") {
                segundosSesion += transcurrido;
                sesionActual.duracionTrabajoSegundos = Number(sesionActual.duracionTrabajoSegundos || 0) + transcurrido;
                segundosHastaPausa = Math.max(0, segundosHastaPausa - transcurrido);
            } else if (estadoSesion === "descanso") {
                segundosDescanso = Math.max(0, segundosDescanso - transcurrido);
                if (pausaActual) pausaActual.segundosEfectivos = Number(pausaActual.segundosEfectivos || 0) + transcurrido;
            }

            botonesActividad.forEach(boton => boton.classList.toggle("activa", boton.dataset.actividad === actividadSeleccionada));
            document.getElementById("ayuda-concentracion").textContent = actividadSeleccionada === "Trabajo" ? "Avisos discretos, sin interrupciones" : "Avisos discretos";
            document.getElementById("ayuda-carga").textContent = actividadSeleccionada === "Trabajo" ? "Pausas y consejos reforzados" : "Pausas reforzadas";
            document.getElementById("texto-boton-sesion").textContent = `Iniciar sesión de ${actividadSeleccionada}`;
            return true;
        } catch (error) {
            console.warn("No se pudo recuperar el temporizador guardado.", error);
            return false;
        }
    }

    recuperarPausasDelDia();
    actualizarProgresoPausas();
    actualizarExposicionAcumulada();
    const sesionRecuperada = restaurarSesionGuardada();
    actualizarInterfazSesion();
    if (sesionRecuperada) iniciarReloj();

    // Guarda el estado exacto al cambiar de página o cerrar la pestaña.
    window.addEventListener("pagehide", publicarEstadoSesion);

});
