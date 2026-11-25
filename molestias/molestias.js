document.addEventListener("DOMContentLoaded", () => {
    const CLAVE_MOLESTIAS = "vistaConscienteRegistrosMolestias";
    const CLAVE_SESIONES = "vistaConscienteSesiones";
    const CLAVE_ESTADO = "vistaConscienteEstadoSesion";
    const $ = (id) => document.getElementById(id);
    const formato = (segundos) => {
        const s = Math.max(0, Math.floor(Number(segundos) || 0));
        return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    };
    const consejos = {
        "Sequedad": {
            titulo: "La sequedad puede aumentar durante el uso continuo",
            texto: "Al mirar una pantalla solemos parpadear menos. Realiza parpadeos completos, haz pausas visuales y mantén una hidratación habitual.",
            habito: "Parpadeo consciente",
            prevencion: "Cada cierto tiempo, aparta la mirada, parpadea suavemente varias veces y descansa la vista."
        },
        "Ardor": {
            titulo: "Dale un descanso a tus ojos",
            texto: "El ardor puede relacionarse con periodos prolongados de enfoque, sequedad o condiciones ambientales incómodas.",
            habito: "Pausas visuales",
            prevencion: "Aplica la regla 20-20-20, evita el aire directo hacia los ojos y revisa la iluminación del espacio."
        },
        "Fatiga": {
            titulo: "Reduce el esfuerzo visual sostenido",
            texto: "La fatiga puede aparecer después de mantener la mirada fija en pantallas durante mucho tiempo.",
            habito: "Regla 20-20-20",
            prevencion: "Cada 20 minutos mira a unos 6 metros durante 20 segundos y ajusta el tamaño del texto para leer cómodamente."
        },
        "Visión borrosa": {
            titulo: "Alterna el enfoque y realiza pausas",
            texto: "La visión borrosa temporal puede presentarse tras enfocar de cerca durante periodos prolongados.",
            habito: "Cambiar el enfoque",
            prevencion: "Mira objetos lejanos periódicamente, evita acercarte demasiado a la pantalla y descansa la vista."
        },
        "Dolor de cabeza": {
            titulo: "Revisa la iluminación y la postura",
            texto: "El esfuerzo visual, los reflejos y una postura incómoda pueden acompañar la aparición de dolor de cabeza.",
            habito: "Ajuste ergonómico",
            prevencion: "Reduce reflejos, ajusta el brillo al ambiente, mantén una distancia cómoda y realiza pausas regulares."
        }
    };

    function leerRegistros() {
        try {
            const datos = JSON.parse(localStorage.getItem(CLAVE_MOLESTIAS) || "[]");
            return Array.isArray(datos) ? datos.sort((a,b) => new Date(b.fechaHora)-new Date(a.fechaHora)) : [];
        } catch (_) { return []; }
    }
    function renderizarRegistros() {
        const registros = leerRegistros();
        $("total-registros").textContent = registros.length;
        const intensidades = registros.map(r => Number(r.intensidad)).filter(n => Number.isFinite(n) && n > 0);
        $("intensidad-promedio").textContent = intensidades.length
            ? `${(intensidades.reduce((a,b)=>a+b,0)/intensidades.length).toFixed(1)}/10`
            : "—";

        const frecuencia = {};
        registros.forEach(r => (Array.isArray(r.molestias) ? r.molestias : []).forEach(m => frecuencia[m]=(frecuencia[m]||0)+1));
        const molestiaTop = Object.entries(frecuencia).sort((a,b)=>b[1]-a[1])[0];
        $("molestia-frecuente").textContent = molestiaTop ? molestiaTop[0] : "—";

        const estudio = registros.filter(r => String(r.actividad).toLowerCase() === "estudio").length;
        const trabajo = registros.filter(r => String(r.actividad).toLowerCase() === "trabajo").length;
        $("total-estudio").textContent = estudio;
        $("total-trabajo").textContent = trabajo;
        $("nota-actividad").textContent = registros.length
            ? (estudio === trabajo ? "Los registros están distribuidos entre ambas actividades." : `Se registraron más molestias durante ${estudio > trabajo ? "Estudio" : "Trabajo"}.`)
            : "Aquí verás en qué actividad se registran más molestias.";

        if (molestiaTop && consejos[molestiaTop[0]]) {
            const consejo = consejos[molestiaTop[0]];
            $("titulo-consejo-molestia").textContent = consejo.titulo;
            $("texto-consejo-molestia").textContent = consejo.texto;
            $("titulo-habito").textContent = consejo.habito;
            $("texto-habito").textContent = consejo.prevencion;
        } else {
            $("titulo-consejo-molestia").textContent = "Cuida tu bienestar visual";
            $("texto-consejo-molestia").textContent = "Al registrar tus molestias, podrás recibir una recomendación relacionada con los síntomas que aparecen con mayor frecuencia.";
            $("titulo-habito").textContent = "Regla 20-20-20";
            $("texto-habito").textContent = "Cada 20 minutos, mira un objeto a unos 6 metros durante 20 segundos.";
        }

        const contenedor = $("lista-registros-molestias");
        let sesiones = [];
        try {
            const guardadas = JSON.parse(localStorage.getItem(CLAVE_SESIONES) || "[]");
            sesiones = Array.isArray(guardadas) ? guardadas : [];
        } catch (_) { sesiones = []; }
        const cronologicas = [...sesiones].sort((a,b) => new Date(a.fechaHoraInicio)-new Date(b.fechaHoraInicio));
        const numeroPorId = new Map();
        cronologicas.forEach((sesion, indice) => numeroPorId.set(sesion.id, Number(sesion.numeroSesion) || indice + 1));
        if (!registros.length) {
            contenedor.innerHTML = `<div class="estado-vacio"><span class="material-symbols-outlined">visibility</span><h3>Aún no hay registros</h3><p>Cuando registres una molestia desde Inicio, aquí podrás consultar su intensidad, actividad y evolución.</p><a href="inicio.html#registro-rapido">Registrar primera molestia</a></div>`;
            return;
        }
        contenedor.innerHTML = registros.map((r) => {
            const fecha = r.fechaHora ? new Date(r.fechaHora) : null;
            const fechaTexto = fecha && !Number.isNaN(fecha.getTime())
                ? fecha.toLocaleString("es-PE",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})
                : "Fecha no disponible";
            const molestias = (Array.isArray(r.molestias) ? r.molestias : []);
            const intensidad = Math.max(0,Math.min(10,Number(r.intensidad)||0));
            const actividad = r.actividad === "Trabajo" ? "Trabajo" : "Estudio";
            const sesion = r.sesion;
            const sesionGuardada = sesiones.find(item => item.id === r.sesionId);
            const numeroSesion = Number(r.numeroSesion || sesion?.numeroSesion || sesionGuardada?.numeroSesion || numeroPorId.get(r.sesionId)) || null;
            const actividadSesion = sesionGuardada?.actividad || sesion?.actividad || actividad;
            const etiquetaSesion = numeroSesion ? `${actividadSesion} (sesión ${numeroSesion})` : actividadSesion;
            const detalleSesion = r.sesionId
                ? `<p class="detalle-sesion-molestia">Vinculada a: <strong>${etiquetaSesion}</strong>${sesion?.duracionSegundos != null ? ` · ${formato(sesion.duracionSegundos)} de actividad${sesion.duracionPausasSegundos != null ? ` · ${formato(sesion.duracionPausasSegundos)} de pausas` : ""}` : ""}</p>`
                : "";
            return `<article class="registro-molestia">
                <div class="registro-molestia-superior">
                    <div><strong>${actividad}</strong><small>${fechaTexto}</small></div>
                    <span class="intensidad-registro">${intensidad}/10</span>
                </div>
                <div class="etiquetas-registro">${molestias.map(m=>`<span>${m}</span>`).join("")}</div>
                <div class="barra-intensidad"><span style="width:${intensidad*10}%"></span></div>
                ${detalleSesion}
            </article>`;
        }).join("");
    }

    function actualizarTemporizador() {
        const contenedor = $("estado-sesion");
        const texto = $("texto-estado-global");
        if (!contenedor || !texto) return;
        let e = null;
        try { e = JSON.parse(localStorage.getItem(CLAVE_ESTADO) || "null"); } catch (_) {}
        const estado = e?.estado || "inactiva";
        const activo = estado === "activa";
        contenedor.classList.toggle("sesion-activa", activo);
        if (!e || estado === "inactiva" || !e.sesionActual) {
            texto.textContent = "Sin sesión activa";
            return;
        }
        const delta = Math.max(0,Math.floor((Date.now()-new Date(e.actualizadoEn || Date.now()).getTime())/1000));
        let segundos = 0;
        if (estado.startsWith("descanso")) {
            segundos = Number(e.pausaActual?.segundosEfectivos)||0;
            if (estado === "descanso") segundos += delta;
            texto.textContent = `Pausa · ${formato(segundos)}`;
        } else {
            segundos = Number(e.segundosSesion)||0;
            if (activo) segundos += delta;
            texto.textContent = `${activo ? "Sesión activa" : "Sesión pausada"} · ${formato(segundos)}`;
        }
    }

    // Registro rápido desde esta misma página, reutilizando el formato de Inicio.
    const modalRegistro = $("modal-registrar-molestia");
    const opcionesRegistro = [...document.querySelectorAll("#opciones-molestia .opcion-molestia")];
    const intensidadRegistro = $("intensidad-molestia");
    const valorIntensidad = $("valor-intensidad-molestia");
    const actividadRegistro = $("actividad-molestia");
    const errorRegistro = $("error-molestia");
    const botonGuardar = $("guardar-modal-molestia");

    function estadoSesionActual() {
        try { return JSON.parse(localStorage.getItem(CLAVE_ESTADO) || "null"); }
        catch (_) { return null; }
    }
    function abrirModalRegistro(evento) {
        if (evento) evento.preventDefault();
        const estado = estadoSesionActual();
        const actividad = estado?.actividad === "Trabajo" ? "Trabajo" : "Estudio";
        actividadRegistro.textContent = actividad;
        errorRegistro.textContent = "";
        opcionesRegistro.forEach(opcion => opcion.setAttribute("aria-pressed", "false"));
        intensidadRegistro.value = "3";
        valorIntensidad.textContent = "3 / 10";
        botonGuardar.disabled = true;
        modalRegistro.hidden = false;
        modalRegistro.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-abierto");
    }
    function cerrarModalRegistro() {
        modalRegistro.hidden = true;
        modalRegistro.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-abierto");
    }
    function actualizarSeleccionRegistro() {
        const seleccionadas = opcionesRegistro.filter(opcion => opcion.getAttribute("aria-pressed") === "true");
        botonGuardar.disabled = seleccionadas.length === 0;
        errorRegistro.textContent = "";
    }
    document.querySelectorAll("[data-abrir-registro]").forEach(enlace => enlace.addEventListener("click", abrirModalRegistro));
    opcionesRegistro.forEach(opcion => opcion.addEventListener("click", () => {
        opcion.setAttribute("aria-pressed", opcion.getAttribute("aria-pressed") !== "true" ? "true" : "false");
        actualizarSeleccionRegistro();
    }));
    intensidadRegistro.addEventListener("input", () => { valorIntensidad.textContent = `${intensidadRegistro.value} / 10`; });
    $("cancelar-modal-molestia").addEventListener("click", cerrarModalRegistro);
    modalRegistro.addEventListener("click", evento => { if (evento.target === modalRegistro) cerrarModalRegistro(); });
    document.addEventListener("keydown", evento => { if (evento.key === "Escape" && !modalRegistro.hidden) cerrarModalRegistro(); });
    botonGuardar.addEventListener("click", () => {
        const molestias = opcionesRegistro.filter(opcion => opcion.getAttribute("aria-pressed") === "true").map(opcion => opcion.textContent.trim());
        if (!molestias.length) { errorRegistro.textContent = "Selecciona al menos una molestia."; return; }
        const estado = estadoSesionActual();
        const actividad = estado?.actividad === "Trabajo" ? "Trabajo" : "Estudio";
        const registro = {
            id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `molestia-${Date.now()}`,
            molestias,
            intensidad: Number(intensidadRegistro.value),
            actividad,
            fechaHora: new Date().toISOString(),
            sesionId: estado?.sesionActual?.id || null,
            numeroSesion: estado?.sesionActual?.numeroSesion || null,
            sesionFechaHoraInicio: estado?.sesionActual?.fechaHoraInicio || null,
            vinculadaASesionFinalizada: false,
            sesion: estado?.sesionActual ? {
                fechaHoraInicio: estado.sesionActual.fechaHoraInicio || null,
                fechaHoraFin: null,
                numeroSesion: estado.sesionActual.numeroSesion || null,
                actividad: estado.sesionActual.actividad || actividad,
                duracionSegundos: Number(estado.segundosSesion) || 0,
                duracionPausasSegundos: Number(estado.sesionActual.duracionPausasSegundos) || 0
            } : null
        };
        const registros = leerRegistros();
        registros.push(registro);
        localStorage.setItem(CLAVE_MOLESTIAS, JSON.stringify(registros));
        cerrarModalRegistro();
        renderizarRegistros();
    });

    renderizarRegistros();
    actualizarTemporizador();
    setInterval(() => {
        actualizarTemporizador();
        renderizarRegistros();
    }, 1000);
    window.addEventListener("storage", (e) => {
        if (e.key === CLAVE_MOLESTIAS) renderizarRegistros();
        if (e.key === CLAVE_ESTADO) actualizarTemporizador();
    });
});
