const consultas = [
    { paciente: "Mango", doctor: "Luis Alonso", hora: "2:00 PM" },
    { paciente: "Francisco", doctor: "Andrés Managua", hora: "4:00 PM" }
];

const recordatorios = [
    "Desparasitante vencido 10/07/2026",
    "Peluso - Angela Marcela - 1:10 PM"
];

const lista = document.getElementById("listaConsultas");
consultas.forEach(c => {
    lista.innerHTML += `<li>${c.paciente} - ${c.doctor} ${c.hora}</li>`;
});

const lista2 = document.getElementById("listaRecordatorios");
recordatorios.forEach(r => {
    lista2.innerHTML += `<li>${r}</li>`;
});

document.querySelector(".scan").addEventListener("click", () => {
    alert("Aquí se abrirá el lector QR.");
});

function cerrarSesion() {
    if (confirm("¿Desea cerrar sesión?")) {
        window.location = "../auth/login.html";
    }
}