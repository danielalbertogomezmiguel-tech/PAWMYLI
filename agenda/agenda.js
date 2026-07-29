const meses = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
];

let fecha = new Date();
let mes = fecha.getMonth();
let anio = fecha.getFullYear();
let diaSeleccionado = fecha.getDate();

const calendario = document.getElementById("diasCalendario");
const tituloMes = document.getElementById("mesActual");
const lista = document.getElementById("listaCitas");
const numeroDia = document.getElementById("numeroDia");
const btnAnterior = document.getElementById("anterior");
const btnSiguiente = document.getElementById("siguiente");

let citas = JSON.parse(localStorage.getItem("citasVeterinaria")) || [];

function generarCalendario(){
    calendario.innerHTML="";
    tituloMes.textContent=`${meses[mes]} ${anio}`;
    const primerDia=new Date(anio,mes,1);
    const ultimoDia=new Date(anio,mes+1,0);
    let inicio=primerDia.getDay();
    if(inicio===0) inicio=7;
    for(let i=1;i<inicio;i++){
        calendario.innerHTML+=`<div class="vacio"></div>`;
    }
    for(let d=1;d<=ultimoDia.getDate();d++){
        let clases="dia";
        const hoy=new Date();
        if(d===hoy.getDate() && mes===hoy.getMonth() && anio===hoy.getFullYear()){
            clases+=" hoy";
        }
        if(d===diaSeleccionado){
            clases+=" seleccionado";
        }
        const fechaTexto=formatoFecha(d);
        const existe=citas.some(c=>c.fecha===fechaTexto);
        if(existe){
            clases+=" citaCalendario";
        }
        calendario.innerHTML+=`
        <div class="${clases}" onclick="seleccionarDia(${d})">
            ${d}
        </div>`;
    }
}

generarCalendario();

function formatoFecha(dia){
    const dd=String(dia).padStart(2,"0");
    const mm=String(mes+1).padStart(2,"0");
    return `${anio}-${mm}-${dd}`;
}

function seleccionarDia(dia){
    diaSeleccionado=dia;
    numeroDia.textContent=dia;
    generarCalendario();
    mostrarCitas();
}

function mostrarCitas(){
    lista.innerHTML="";
    const fechaBuscar=formatoFecha(diaSeleccionado);
    const resultado=citas.filter(c=>c.fecha===fechaBuscar);
    resultado.sort((a,b)=>a.hora.localeCompare(b.hora));
    if(resultado.length===0){
        lista.innerHTML=`
        <div class="cita">
            <h3>No hay citas</h3>
            <p>Este día está disponible.</p>
        </div>`;
        return;
    }
    resultado.forEach((cita,index)=>{
        lista.innerHTML+=`
        <div class="cita">
            <h3>${cita.hora}</h3>
            <p><strong>Mascota:</strong> ${cita.mascota}</p>
            <p><strong>Dueño:</strong> ${cita.dueno}</p>
            <p>${cita.nota}</p>
            <button class="eliminar" onclick="eliminarCita(${index},'${fechaBuscar}')">
                Eliminar
            </button>
        </div>`;
    });
}

mostrarCitas();

btnAnterior.onclick=()=>{
    mes--;
    if(mes<0){ mes=11; anio--; }
    generarCalendario();
    mostrarCitas();
}

btnSiguiente.onclick=()=>{
    mes++;
    if(mes>11){ mes=0; anio++; }
    generarCalendario();
    mostrarCitas();
}

document.getElementById("formCita").addEventListener("submit",e=>{
    e.preventDefault();
    const nueva={
        mascota:document.getElementById("nombreMascota").value,
        fecha:document.getElementById("fecha").value,
        dueno:document.getElementById("dueno").value,
        hora:document.getElementById("hora").value,
        nota:document.getElementById("nota").value
    };
    citas.push(nueva);
    localStorage.setItem("citasVeterinaria",JSON.stringify(citas));
    alert("Cita registrada correctamente.");
    e.target.reset();
    generarCalendario();
    mostrarCitas();
});

function eliminarCita(indice,fechaEliminar){
    const resultado=citas.filter(c=>c.fecha===fechaEliminar);
    const citaEliminar=resultado[indice];
    citas=citas.filter(c=>c!==citaEliminar);
    localStorage.setItem("citasVeterinaria",JSON.stringify(citas));
    generarCalendario();
    mostrarCitas();
}

document.querySelector(".cerrar").onclick=()=>{
    if(confirm("¿Desea cerrar sesión?")){
        window.location="../auth/login.html";
    }
}