document.addEventListener("DOMContentLoaded", () => {
    const CLAVE_CONFIG = "vistaConscienteConfiguracion";
    const CLAVE_CRONOGRAMA = "vistaConscienteCronogramaVisual";
    const CLAVE_ESTADO = "vistaConscienteEstadoSesion";
    const $ = id => document.getElementById(id);
    const leerJSON = (clave, defecto) => { try { return JSON.parse(localStorage.getItem(clave) || "null") ?? defecto; } catch (_) { return defecto; } };
    const configuracionBase = {usaLentes:false, antecedentesVisuales:[], minutosEntrePausas:45, duracionSesion:45, duracionPausa:5, metaDiaria:5};
    let config = {...configuracionBase, ...leerJSON(CLAVE_CONFIG, {})};
    // La bienvenida guarda la frecuencia como minutosEntrePausas/duracionSesion,
    // la duración como duracionPausa y la meta como metaDiaria.
    const obtenerValor = key => {
        if (key === "minutosEntrePausas") return Number(config.minutosEntrePausas ?? config.duracionSesion ?? configuracionBase.minutosEntrePausas);
        return Number(config[key] ?? configuracionBase[key]);
    };
    const guardarConfig = () => {
        localStorage.setItem(CLAVE_CONFIG, JSON.stringify(config));
        $("aviso-configuracion").textContent = "Preferencias guardadas correctamente.";
    };
    const controles = [
        ["frecuencia-perfil","valor-frecuencia","minutosEntrePausas","min"],
        ["duracion-perfil","valor-duracion","duracionPausa","min"],
        ["meta-perfil","valor-meta","metaDiaria","pausas"]
    ];
    controles.forEach(([inputId,outputId,key,suffix]) => {
        const input=$(inputId), output=$(outputId);
        const valorInicial = obtenerValor(key);
        input.value = String(Math.min(Number(input.max), Math.max(Number(input.min), valorInicial)));
        const actualizarSalida = () => { output.textContent=`${input.value} ${suffix}`; };
        const update=()=>{
            config[key]=Number(input.value);
            if(key==="minutosEntrePausas") config.duracionSesion=config[key];
            actualizarSalida();
            guardarConfig();
        };
        actualizarSalida();
        input.addEventListener("input",update);
        input.addEventListener("change",update);
    });
    $("usa-lentes").checked=Boolean(config.usaLentes);
    $("usa-lentes").addEventListener("change",()=>{config.usaLentes=$("usa-lentes").checked;guardarConfig();});
    $("alta-carga-perfil").checked=Boolean(config.altaCargaAcademica);
    $("alta-carga-perfil").addEventListener("change",()=>{config.altaCargaAcademica=$("alta-carga-perfil").checked;guardarConfig();});
    const antecedentes=new Set(Array.isArray(config.antecedentesVisuales)?config.antecedentesVisuales:[]);
    document.querySelectorAll("[data-antecedente]").forEach(btn=>{
        btn.classList.toggle("seleccionado",antecedentes.has(btn.dataset.antecedente));
        btn.addEventListener("click",()=>{
            const value=btn.dataset.antecedente;
            antecedentes.has(value)?antecedentes.delete(value):antecedentes.add(value);
            btn.classList.toggle("seleccionado",antecedentes.has(value));
            config.antecedentesVisuales=[...antecedentes];guardarConfig();
        });
    });

    // Cronograma exclusivamente visual: utiliza una clave separada de los temporizadores.
    let descansos=leerJSON(CLAVE_CRONOGRAMA,[]);
    if(!Array.isArray(descansos)) descansos=[];
    const lista=$("lista-cronograma"), editor=$("editor-descansos"), modal=$("modal-cronograma");
    const ordenar=items=>items.sort((a,b)=>a.hora.localeCompare(b.hora));
    function renderizarCronograma(){
        ordenar(descansos);
        if(!descansos.length){lista.innerHTML='<p class="cronograma-vacio">Aún no has añadido descansos a tu horario.</p>';return;}
        lista.innerHTML=descansos.map(d=>`<div class="item-cronograma"><span class="material-symbols-outlined">${d.tipo==="largo"?"event_available":"schedule"}</span><span><strong>${d.hora}</strong> · ${d.tipo==="largo"?"Descanso largo (1 hora)":"Pausa visual (30 min)"}</span></div>`).join("");
    }
    function filaEditor(descanso={hora:"10:30",tipo:"visual"}){
        const fila=document.createElement("div");fila.className="fila-editor-descanso";
        fila.innerHTML=`<input type="time" aria-label="Hora del descanso" value="${descanso.hora}"><select aria-label="Tipo de descanso"><option value="visual">Pausa visual (30 min)</option><option value="largo">Descanso largo (1 hora)</option></select><button type="button" class="eliminar-descanso" aria-label="Eliminar descanso">×</button>`;
        fila.querySelector("select").value=descanso.tipo;
        fila.querySelector(".eliminar-descanso").addEventListener("click",()=>{fila.remove();actualizarBotonAnadir();});
        editor.appendChild(fila);
    }
    function actualizarBotonAnadir(){$("anadir-descanso").disabled=editor.children.length>=6;}
    function abrirEditor(){
        editor.innerHTML="";
        descansos.forEach(d=>filaEditor(d));
        actualizarBotonAnadir();
        modal.hidden=false;modal.setAttribute("aria-hidden","false");document.body.classList.add("modal-abierto");
    }
    function cerrarEditor(){modal.hidden=true;modal.setAttribute("aria-hidden","true");document.body.classList.remove("modal-abierto");}
    $("editar-cronograma").addEventListener("click",abrirEditor);
    $("anadir-descanso").addEventListener("click",()=>{if(editor.children.length<6){filaEditor({hora:"12:00",tipo:"visual"});actualizarBotonAnadir();}});
    $("cerrar-cronograma").addEventListener("click",cerrarEditor);
    modal.addEventListener("click",e=>{if(e.target===modal)cerrarEditor();});
    document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!modal.hidden)cerrarEditor();});
    $("guardar-cronograma").addEventListener("click",()=>{
        const nuevos=[...editor.querySelectorAll(".fila-editor-descanso")].map(f=>({hora:f.querySelector('input[type="time"]').value,tipo:f.querySelector("select").value}));
        if(nuevos.some(d=>!d.hora)){alert("Selecciona una hora para cada descanso.");return;}
        const horas=nuevos.map(d=>d.hora);
        if(new Set(horas).size!==horas.length){alert("No puedes asignar dos descansos a la misma hora.");return;}
        descansos=ordenar(nuevos);
        localStorage.setItem(CLAVE_CRONOGRAMA,JSON.stringify(descansos));
        renderizarCronograma();cerrarEditor();
    });
    function actualizarEstado(){
        const pill=$("estado-sesion-perfil"),texto=$("texto-estado-perfil");
        const e=leerJSON(CLAVE_ESTADO,null);
        if(!e||e.estado==="inactiva"||!e.sesionActual){pill.classList.remove("sesion-activa");texto.textContent="Sin sesión activa";return;}
        const activo=e.estado==="activa";pill.classList.toggle("sesion-activa",activo);
        const delta=Math.max(0,Math.floor((Date.now()-new Date(e.actualizadoEn||Date.now()).getTime())/1000));
        let tiempo=Number(e.segundosSesion)||0, etiqueta=activo?"Sesión activa":"Sesión pausada";
        if(e.estado==="descanso"||e.estado==="descanso-pausado"){
            tiempo=Number(e.pausaActual?.segundosEfectivos)||0;
            if(e.estado==="descanso")tiempo+=delta;
            etiqueta="Pausa";
        }else if(activo)tiempo+=delta;
        texto.textContent=`${etiqueta} · ${String(Math.floor(tiempo/60)).padStart(2,"0")}:${String(tiempo%60).padStart(2,"0")}`;
    }
    window.addEventListener("storage", evento => {
        if (evento.key !== CLAVE_CONFIG) return;
        config = {...configuracionBase, ...leerJSON(CLAVE_CONFIG, {})};
        controles.forEach(([inputId,outputId,key,suffix]) => {
            const input=$(inputId), output=$(outputId);
            input.value=String(Math.min(Number(input.max),Math.max(Number(input.min),obtenerValor(key))));
            output.textContent=`${input.value} ${suffix}`;
        });
        $("usa-lentes").checked=Boolean(config.usaLentes);
        $("alta-carga-perfil").checked=Boolean(config.altaCargaAcademica);
        antecedentes.clear();
        (Array.isArray(config.antecedentesVisuales)?config.antecedentesVisuales:[]).forEach(v=>antecedentes.add(v));
        document.querySelectorAll("[data-antecedente]").forEach(btn=>btn.classList.toggle("seleccionado",antecedentes.has(btn.dataset.antecedente)));
    });

    renderizarCronograma();actualizarEstado();setInterval(actualizarEstado,1000);
    window.addEventListener("storage",e=>{if(e.key===CLAVE_ESTADO)actualizarEstado();});
});
