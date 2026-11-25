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

    const CLAVE_SESIONES = "vistaConscienteSesiones";
    const CLAVE_MOLESTIAS = "vistaConscienteRegistrosMolestias";
    const CLAVE_ESTADO = "vistaConscienteEstadoSesion";
    const CLAVE_CONFIG = "vistaConscienteConfiguracion";
    let periodo = "dia";

    const leerLista = (clave) => {
        try { const valor = JSON.parse(localStorage.getItem(clave) || "[]"); return Array.isArray(valor) ? valor : []; }
        catch (_) { return []; }
    };
    const leerObjeto = (clave) => {
        try { return JSON.parse(localStorage.getItem(clave) || "null"); } catch (_) { return null; }
    };
    const fmt = (segundos) => {
        const s = Math.max(0, Math.floor(Number(segundos) || 0));
        const m = Math.floor(s / 60);
        return `${m}:${String(s % 60).padStart(2, "0")}`;
    };
    const fecha = (iso) => iso ? new Date(iso) : null;
    const mismoDia = (a,b) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
    const inicioSemana = (d) => { const x = new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate()-((x.getDay()+6)%7)); return x; };
    const sesiones = () => leerLista(CLAVE_SESIONES);
    const molestias = () => leerLista(CLAVE_MOLESTIAS);

    function actualizarEstado() {
        const e = leerObjeto(CLAVE_ESTADO);
        const texto = document.getElementById("texto-estado-global");
        const cont = document.getElementById("estado-sesion");
        if (!e || !e.estado || e.estado === "inactiva") {
            texto.textContent = "Sin sesión activa"; cont.classList.remove("sesion-activa"); return;
        }
        const delta = Math.max(0, Math.floor((Date.now() - new Date(e.actualizadoEn).getTime()) / 1000));
        let segundos;
        const actividad = e.actividad || "Sesión";
        if (e.estado.startsWith("descanso")) {
            segundos = Number(e.pausaActual?.segundosEfectivos) || 0;
            if (e.estado === "descanso") segundos += delta;
        } else {
            segundos = Number(e.segundosSesion) || 0;
            if (e.estado === "activa") segundos += delta;
        }
        const tiempo = `${String(Math.floor(segundos/60)).padStart(2,"0")}:${String(segundos%60).padStart(2,"0")}`;
        if (e.estado.startsWith("descanso")) texto.textContent = `Pausa ${actividad} · ${tiempo}`;
        else if (e.estado === "pausada") texto.textContent = `Sesión pausada · ${tiempo}`;
        else texto.textContent = `Sesión activa · ${tiempo}`;
        cont.classList.toggle("sesion-activa", e.estado === "activa");
    }

    function obtenerDatosFiltrados() {
        const ahora = new Date();
        const desde = periodo === "dia" ? new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()) : inicioSemana(ahora);
        const ss = sesiones().filter(s => { const d=fecha(s.fechaHoraInicio); return d && d>=desde && d<=ahora; });
        const mm = molestias().filter(m => { const d=fecha(m.fechaHora); return d && d>=desde && d<=ahora; });
        return { ss, mm, desde, ahora };
    }

    function renderizar() {
        const {ss, mm, desde, ahora} = obtenerDatosFiltrados();
        const esDia = periodo === "dia";
        document.getElementById("titulo-exposicion").textContent = esDia ? "EXPOSICIÓN DE HOY" : "EXPOSICIÓN DE LA SEMANA";
        let trabajo=0, pausa=0, pausas=[];
        ss.forEach(s => {
            trabajo += Number(s.duracionTrabajoSegundos ?? s.duracionSegundos ?? 0);
            pausa += Number(s.duracionPausasSegundos || 0);
            (s.pausas || []).forEach(p => pausas.push(p));
        });
        const estado = leerObjeto(CLAVE_ESTADO);
        if (estado && estado.estado !== "inactiva" && estado.fechaHoraInicio) {
            const actualInicio = new Date(estado.fechaHoraInicio);
            if (actualInicio >= desde && actualInicio <= ahora) {
                const actual = ss.find(s => s.id === estado.id);
                // La sesión activa se añade como tiempo provisional sin duplicar registros ya finalizados.
                if (!actual) {
                    trabajo += Number(estado.duracionTrabajoSegundos || 0);
                    if (estado.estado === "activa" && estado.actualizadoEn) {
                        trabajo += Math.max(0, Math.floor((Date.now() - new Date(estado.actualizadoEn).getTime()) / 1000));
                    }
                    pausa += Number(estado.duracionPausasSegundos || 0);
                    if (estado.pausaActual && String(estado.estado).startsWith("descanso")) {
                        pausa += Number(estado.pausaActual.segundosEfectivos || 0);
                    }
                    (estado.pausas || []).forEach(p => pausas.push(p));
                }
            }
        }
        // La exposición principal representa únicamente el tiempo efectivo de sesión.
        // Las pausas se mantienen separadas en su leyenda y estadística.
        document.getElementById("total-exposicion").textContent = fmt(trabajo);
        document.getElementById("total-sesion").textContent = fmt(trabajo);
        document.getElementById("total-pausas").textContent = fmt(pausa);

        const buckets = [];
        if (esDia) {
            const sesionesDia = [...ss].sort((a,b) => new Date(a.fechaHoraInicio)-new Date(b.fechaHoraInicio));
            sesionesDia.forEach((s, i) => {
                const work = Number(s.duracionTrabajoSegundos ?? s.duracionSegundos ?? 0);
                const rest = Number(s.duracionPausasSegundos || 0);
                buckets.push({ key:s.id || String(i), label:`S${i+1}`, work, rest,
                    tooltip:`S${i+1}: sesión ${fmt(work)} · pausas ${fmt(rest)}` });
            });
            if (estado && estado.estado !== "inactiva" && estado.fechaHoraInicio) {
                const d = fecha(estado.fechaHoraInicio);
                if (d && mismoDia(d, ahora) && !sesionesDia.some(s => s.id === estado.id)) {
                    const work = Number(estado.duracionTrabajoSegundos || 0);
                    const rest = Number(estado.duracionPausasSegundos || 0);
                    let restLive = rest;
                    if (String(estado.estado).startsWith("descanso") && estado.pausaActual?.fechaHoraInicio) {
                        restLive += Number(estado.pausaActual.segundosEfectivos || 0);
                    }
                    const n = buckets.length + 1;
                    buckets.push({key:estado.id || "actual",label:`S${n}`,work,rest:restLive,
                        tooltip:`S${n}: sesión ${fmt(work)} · pausas ${fmt(restLive)} (en curso)`});
                }
            }
        } else {
            const names=["L","M","X","J","V","S","D"];
            for(let i=0;i<7;i++){const d=new Date(desde);d.setDate(d.getDate()+i);buckets.push({key:d.toISOString().slice(0,10),label:names[i],work:0,rest:0});}
            ss.forEach(s=>{const d=fecha(s.fechaHoraInicio);if(!d)return;const b=buckets.find(x=>x.key===d.toISOString().slice(0,10));if(b){b.work+=Number(s.duracionTrabajoSegundos??s.duracionSegundos??0);b.rest+=Number(s.duracionPausasSegundos||0);}});
            if (estado && estado.estado !== "inactiva" && estado.fechaHoraInicio) {
                const d=fecha(estado.fechaHoraInicio), b=d && buckets.find(x=>x.key===d.toISOString().slice(0,10));
                if(b && !ss.some(s=>s.id===estado.id)){b.work+=Number(estado.duracionTrabajoSegundos||0);b.rest+=Number(estado.duracionPausasSegundos||0);}
            }
        }
        const max=Math.max(1,...buckets.flatMap(b=>[b.work,b.rest]));
        document.getElementById("barras-exposicion").innerHTML = buckets.length
            ? buckets.map(b=>`<div class="grupo-barra" title="${b.tooltip || `${b.label}: sesión ${fmt(b.work)} · pausas ${fmt(b.rest)}`}"><div class="barra sesion" style="height:${(b.work/max*100)}%"></div><div class="barra pausa" style="height:${(b.rest/max*100)}%"></div><small>${b.label}</small></div>`).join("")
            : '<p class="sin-datos">Aún no hay sesiones registradas.</p>';
        const allPauses = ss.flatMap(s=>(s.pausas||[]).map(p=>({...p, _fechaSesion:s.fechaHoraInicio})));
        const pausaActiva = Boolean(estado && String(estado.estado || "").startsWith("descanso"));
        const pausaActualIncluida = allPauses.some(p => !p.fechaHoraFin);
        const count = allPauses.length + (pausaActiva && !pausaActualIncluida ? 1 : 0);
        const config=leerObjeto(CLAVE_CONFIG);
        const metaDiaria=Math.max(1,Number(config?.metaDiaria)||5);
        const metaSemanal=metaDiaria*5;
        const etiquetaPausas=document.getElementById("etiqueta-estadistica-pausas");
        const valorMeta=document.getElementById("porcentaje-meta");
        const detalleMeta=document.getElementById("detalle-meta");
        const etiquetaMejorDia=document.querySelector(".tarjetas-estadistica .tarjeta-estadistica:nth-child(2) .etiqueta");
        const valorMejorDia=document.getElementById("pausa-mas-larga");
        const detalleMejorDia=document.getElementById("detalle-pausa-larga");
        if (esDia) {
            const pct=Math.min(100,Math.round(count/metaDiaria*100));
            etiquetaPausas.textContent="META DIARIA DE PAUSAS";
            valorMeta.textContent=`${pct}%`;
            detalleMeta.textContent=`${Math.min(count,metaDiaria)} de ${metaDiaria} pausas`;
            etiquetaMejorDia.textContent="PAUSA MÁS LARGA";
            const masLarga=allPauses.reduce((max,p)=>Math.max(max,Number(p.duracionEfectivaSegundos??p.duracionSegundos??0)),0);
            valorMejorDia.textContent=masLarga?fmt(masLarga):"—";
            const larga=allPauses.find(p=>Number(p.duracionEfectivaSegundos??p.duracionSegundos??0)===masLarga);
            detalleMejorDia.textContent=larga?.fechaHoraFin?`Completada a las ${new Date(larga.fechaHoraFin).toLocaleTimeString("es-PE",{hour:"2-digit",minute:"2-digit"})}`:"Sin pausas registradas";
        } else {
            const pct=Math.min(100,Math.round(count/metaSemanal*100));
            etiquetaPausas.textContent="META DE PAUSAS";
            valorMeta.textContent=`${pct}%`;
            detalleMeta.textContent=`${Math.min(count,metaSemanal)} de ${metaSemanal} esta semana`;

            // Cuenta las pausas por el día en que comenzaron y destaca el día con más pausas.
            const dias=["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
            const conteoDias=Array(7).fill(0);
            allPauses.forEach(p=>{
                const fechaPausa=fecha(p.fechaHoraInicio || p._fechaSesion);
                if(fechaPausa) conteoDias[fechaPausa.getDay()]++;
            });
            if(pausaActiva && !pausaActualIncluida) conteoDias[ahora.getDay()]++;
            const mejorCantidad=Math.max(...conteoDias);
            const mejorIndice=conteoDias.findIndex(n=>n===mejorCantidad);
            etiquetaMejorDia.textContent="MEJOR DÍA";
            valorMejorDia.textContent=mejorCantidad?dias[mejorIndice]:"—";
            detalleMejorDia.textContent=mejorCantidad?`${mejorCantidad} ${mejorCantidad===1?"pausa":"pausas"} registradas`:"Sin pausas registradas";
        }
        const hours=Array.from({length:7},(_,i)=>({label:`${8+i*2}h`,n:0}));
        mm.forEach(m=>{const d=fecha(m.fechaHora);if(!d)return;let idx=Math.floor((d.getHours()-8)/2);idx=Math.max(0,Math.min(6,idx));hours[idx].n++;});
        const escalaMolestias=5;
        document.getElementById("barras-molestias").innerHTML=hours.map(x=>`<div class="barra-hora" style="height:${Math.min(100,x.n/escalaMolestias*100)}%" title="${x.label}: ${x.n} registro(s)"><small>${x.label}</small></div>`).join("");
        const mayor=hours.reduce((a,b)=>b.n>a.n?b:a,hours[0]);
        const actividadTop=mm.reduce((acc,m)=>{
            const valor=String(m.actividad || "Sin actividad").trim().toLowerCase();
            const k=valor === "trabajo" ? "Trabajo" : valor === "estudio" ? "Estudio" : "Sin actividad";
            acc[k]=(acc[k]||0)+1;
            return acc;
        },{});
        const actividadMayor=Object.entries(actividadTop).filter(([actividad])=>actividad!=="Sin actividad").sort((a,b)=>b[1]-a[1])[0];
        const detalleActividad=actividadMayor
            ? ` La actividad más asociada fue ${actividadMayor[0]} (${actividadMayor[1]} ${actividadMayor[1]===1?"registro":"registros"}).`
            : "";
        document.getElementById("resumen-molestias").textContent=mm.length
            ? `Registraste ${mm.length} ${mm.length===1?"molestia":"molestias"} en el periodo. ${mayor.n?`La franja con más registros fue alrededor de las ${mayor.label}.`:""}${detalleActividad}`
            : "Los registros de molestias aparecerán aquí cuando los guardes desde Inicio.";

        const cronologicas=[...ss].sort((a,b)=>new Date(a.fechaHoraInicio)-new Date(b.fechaHoraInicio));
        const numeroPorId=new Map();
        let consecutivo=0;
        cronologicas.forEach(s=>{
            consecutivo++;
            numeroPorId.set(s.id,Number(s.numeroSesion)||consecutivo);
        });
        const sorted=[...ss].sort((a,b)=>new Date(b.fechaHoraInicio)-new Date(a.fechaHoraInicio));
        document.getElementById("cantidad-sesiones").textContent=`${sorted.length} ${sorted.length===1?"sesión":"sesiones"}`;
        document.getElementById("lista-sesiones").innerHTML=sorted.length?sorted.map(s=>{
            const d=fecha(s.fechaHoraInicio);const date=d?d.toLocaleString("es-PE",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"Fecha no disponible";
            const linked=mm.filter(m=>m.sesionId===s.id).length;
            const numero=Number(s.numeroSesion)||numeroPorId.get(s.id)||1;
            const etiqueta=`${s.actividad||"Sesión"} (sesión ${numero})`;
            return `<article class="sesion-item"><div><strong>${etiqueta}</strong><small>${date} · ${s.pausas?.length||0} pausas · ${linked} registros de molestias</small></div><div class="sesion-duracion">${fmt(Number(s.duracionTrabajoSegundos??s.duracionSegundos??0))}<small> sesión</small><br>${fmt(Number(s.duracionPausasSegundos||0))}<small> pausas</small></div></article>`;
        }).join(""):`<p class="sin-datos">Todavía no hay sesiones finalizadas en este periodo.</p>`;
    }

    document.querySelectorAll("[data-periodo]").forEach(btn=>btn.addEventListener("click",()=>{
        periodo=btn.dataset.periodo;
        document.querySelectorAll("[data-periodo]").forEach(b=>b.classList.toggle("activo",b===btn));
        renderizar();
    }));
    window.addEventListener("storage",e=>{if([CLAVE_SESIONES,CLAVE_MOLESTIAS,CLAVE_ESTADO,CLAVE_CONFIG].includes(e.key))renderizar();actualizarEstado();});
    actualizarEstado();renderizar();
    setInterval(actualizarEstado,1000);
    setInterval(renderizar,5000);
});
