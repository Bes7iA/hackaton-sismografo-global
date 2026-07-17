// CONFIGURACIÓN: Tiempo de espera para no saturar el sistema (1 minuto)
const CACHE_DURATION = 60000;
// DIRECCIÓN DE INTERNET: El enlace oficial de donde sacamos la información de los sismos en vivo (última hora)
const API_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson';

// FONDO DE PANTALLA: Coloca la imagen de las olas del mar fijas en el fondo de la página
document.body.style.backgroundImage = "url('https://images.unsplash.com/photo-1518837695005-2083093ee35b?q=80&w=1920')";
document.body.style.backgroundSize = "cover";
document.body.style.backgroundAttachment = "fixed";
document.body.style.backgroundPosition = "center";

// EL ORGANIZADOR DE DATOS: Este bloque se encarga de ordenar y separar la lista de sismos
class EarthquakeService {
    constructor(data) {
        this.earthquakes = data.features || [];
    }
    // Filtra la lista para dejar solo los sismos que tengan el tamaño mínimo seleccionado
    filterByMagnitude(minMag) {
        return this.earthquakes.filter(eq => eq.properties.mag >= minMag);
    }
    // Filtra la lista para buscar solo los sismos del país elegido
    filterByRegion(regionName) {
        if (!regionName) return [];
        return this.earthquakes.filter(eq =>
            eq.properties.place.toLowerCase().includes(regionName.toLowerCase())
        );
    }
    // Ordena los sismos de mayor a menor potencia
    sortByMagnitude(list) {
        return [...list].sort((a, b) => b.properties.mag - a.properties.mag);
    }
    // Busca estrictamente el último sismo cronológico registrado en el mundo (Alerta Menor)
    findLatestEarthquake() {
        if (this.earthquakes.length === 0) return null;
        const sortedByTime = [...this.earthquakes].sort((a, b) => b.properties.time - a.properties.time);
        return sortedByTime[0];
    }
    // Busca si en la lista de la última hora hay algún sismo peligroso mayor o igual a 7.0
    findCriticalEarthquake() {
        return this.earthquakes.find(eq => eq.properties.mag >= 7.0) || null;
    }
}

// EL CARTERO (Mecanismo de descarga): Va a internet a buscar los sismos más recientes
async function fetchEarthquakeData() {
    const cachedData = localStorage.getItem('earthquake_data');
    const cachedTime = localStorage.getItem('earthquake_time');
    const now = Date.now();

    if (cachedData && cachedTime && (now - cachedTime < CACHE_DURATION)) {
        return JSON.parse(cachedData);
    }

    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Error de conexión');
        const data = await response.json();
        localStorage.setItem('earthquake_data', JSON.stringify(data));
        localStorage.setItem('earthquake_time', now.toString());
        return data;
    } catch (error) {
        if (cachedData) return JSON.parse(cachedData);
        return null;
    }
}

// Variable interna para controlar el gráfico
let chartInstance = null;

// EL MOTOR PRINCIPAL: Dibuja y actualiza la pantalla completa
async function renderApp() {
    const rawData = await fetchEarthquakeData();
    if (!rawData) return;

    const service = new EarthquakeService(rawData);

    const minMagSelect = document.getElementById('filter-magnitude');
    const minMag = minMagSelect ? parseFloat(minMagSelect.value) : 0;

    const regionSelect = document.getElementById('region-filter');
    let selectedRegion = regionSelect ? regionSelect.value : localStorage.getItem('selected_region') || 'Chile';
    if (regionSelect) regionSelect.value = selectedRegion;

    const globalFiltrados = service.filterByMagnitude(minMag);
    const globalOrdenados = service.sortByMagnitude(globalFiltrados);
    const regionFiltrados = service.filterByRegion(selectedRegion);

    const timestampEl = document.getElementById('timestamp');
    if (timestampEl) {
        timestampEl.innerText = new Date().toLocaleTimeString();
    }

    // =========================================================================
    // 1. SISTEMA DE MEMORIA PARA LA ALERTA CENTRAL SUPERIOR (Sismos Magnitud 7+)
    // =========================================================================

    // Revisa si la lista que acaba de llegar de internet trae algún sismo mayor a 7
    const sismoCriticoActual = service.findCriticalEarthquake();

    // Si efectivamente hay uno nuevo en la lista, lo guarda inmediatamente en la memoria eterna
    if (sismoCriticoActual) {
        localStorage.setItem('last_huge_earthquake', JSON.stringify(sismoCriticoActual));
    }

    // Ahora le pedimos a la memoria que nos devuelva el sismo guardado (sea el que acabamos de meter o uno antiguo)
    const sismoAnclado = JSON.parse(localStorage.getItem('last_huge_earthquake'));

    const topAlertContainer = document.getElementById('top-critical-alert');
    if (topAlertContainer) {
        if (sismoAnclado) {
            // Convierte los datos internos del sismo en un formato de fecha fácil de leer (Día de Mes de Año)
            const opcionesFecha = { year: 'numeric', month: 'long', day: 'numeric' };
            const fechaSismo = new Date(sismoAnclado.properties.time).toLocaleDateString('es-ES', opcionesFecha);
            const horaSismo = new Date(sismoAnclado.properties.time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            // Dibuja el cuadro rojo gigante con la fecha bien grande y destacada en amarillo
            topAlertContainer.innerHTML = `
                <div class="bg-red-700 border-4 border-red-500 text-white p-6 rounded-xl shadow-2xl text-center">
                    <h3 class="text-2xl font-black tracking-wider uppercase mb-2">🚨 ÚLTIMO SISMO CON MAGNITUD MAYOR A 7 REGISTRADO 🚨</h3>
                    <p class="text-xl font-bold">Alerta Histórica Fija: <span class="text-3xl font-extrabold text-yellow-300">M ${sismoAnclado.properties.mag}</span></p>
                    <p class="text-md mt-1 font-semibold">📍 Ubicación: ${sismoAnclado.properties.place}</p>
                    
                    <!-- Bloque de fecha y hora destacado -->
                    <div class="mt-3 inline-block bg-red-900/60 border border-red-400/30 px-4 py-1.5 rounded-lg">
                        <p class="text-sm font-medium">📅 Fecha: <span class="text-yellow-300 font-bold">${fechaSismo}</span> a las <span class="text-yellow-300 font-bold">${horaSismo}</span></p>
                    </div>
                </div>
            `;
        } else {
            // Este cuadro solo aparecerá la primerísima vez que abras la app si tu memoria está totalmente vacía
            topAlertContainer.innerHTML = `
                <div class="bg-gradient-to-r from-gray-800/90 to-red-950/40 border border-gray-700 text-white p-5 rounded-xl shadow-md text-center">
                    <h3 class="text-lg font-bold tracking-wider text-red-400 uppercase">⚠️ SISTEMA DE MONITOREO CRÍTICO</h3>
                    <p class="text-sm text-gray-300 mt-1">Esperando la detección del primer sismo mayor a 7.0 para fijar la alerta en este panel...</p>
                </div>
            `;
        }
    }

    // =========================================================================
    // 2. DIBUJAR ALERTA INFERIOR DERECHA (El último sismo absoluto del planeta)
    // =========================================================================
    const ultimoSismoMundo = service.findLatestEarthquake();
    const alertaContainer = document.getElementById('alert-container');
    if (alertaContainer && ultimoSismoMundo) {
        alertaContainer.innerHTML = `
            <div class="bg-gray-800/95 border border-blue-900/60 text-white p-6 rounded-xl shadow-md backdrop-blur-sm w-full flex flex-col justify-center">
                <h4 class="text-xs font-bold tracking-wider uppercase text-cyan-400 mb-2 flex items-center gap-2">
                    <span>⏱️</span> Último Sismo en el Mundo
                </h4>
                <p class="text-base text-gray-200">
                    Magnitud registrada: <span class="font-bold text-yellow-400 text-lg">M ${ultimoSismoMundo.properties.mag}</span>
                </p>
                <p class="text-sm text-gray-300 mt-2 truncate">📍 ${ultimoSismoMundo.properties.place}</p>
                <p class="text-xs text-gray-500 mt-1">Sucedió a las: ${new Date(ultimoSismoMundo.properties.time).toLocaleTimeString()}</p>
            </div>
        `;
    }

    // 3. DIBUJAR LA LISTA GLOBAL
    const listContainer = document.getElementById('earthquake-list');
    if (listContainer) {
        if (globalOrdenados.length === 0) {
            listContainer.innerHTML = '<p class="text-gray-400 text-center py-8">No hay sismos en la última hora.</p>';
        } else {
            listContainer.innerHTML = globalOrdenados.map(eq => `
                <article class="bg-gray-900/90 border border-gray-700 p-3 rounded-lg shadow-sm hover:border-red-500 transition-colors backdrop-blur-sm">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-base font-bold ${eq.properties.mag >= 4.0 ? 'text-red-400' : 'text-green-400'}">M ${eq.properties.mag}</span>
                        <span class="text-[11px] text-gray-400">${new Date(eq.properties.time).toLocaleTimeString()}</span>
                    </div>
                    <p class="text-xs text-gray-300 truncate">📍 ${eq.properties.place}</p>
                </article>
            `).join('');
        }
    }

    // 4. DIBUJAR LA LISTA REGIONAL
    const localContainer = document.getElementById('chile-list');
    const localTitle = document.getElementById('local-section-title');
    if (localTitle) localTitle.innerText = `Región Destacada: Monitoreo en ${selectedRegion}`;

    if (localContainer) {
        if (regionFiltrados.length === 0) {
            localContainer.innerHTML = `<p class="text-gray-400 text-center col-span-full py-6">Sin actividad reciente en ${selectedRegion}.</p>`;
        } else {
            localContainer.innerHTML = regionFiltrados.map(eq => `
                <article class="bg-blue-950/60 border border-blue-700/50 p-4 rounded-lg shadow-sm backdrop-blur-sm">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-base font-bold text-blue-300">M ${eq.properties.mag}</span>
                        <span class="text-[11px] text-blue-400">${new Date(eq.properties.time).toLocaleTimeString()}</span>
                    </div>
                    <p class="text-xs text-gray-200 truncate">📍 ${eq.properties.place}</p>
                </article>
            `).join('');
        }
    }

    renderChart(globalOrdenados);
}

// EL DIBUJAR DE ESTADÍSTICAS (Pinta las barras)
function renderChart(earthquakes) {
    const ctx = document.getElementById('magnitudeChart');
    if (!ctx) return;

    let micro = 0, menor = 0, ligero = 0, moderado = 0;
    earthquakes.forEach(eq => {
        const m = eq.properties.mag;
        if (m < 2.5) micro++;
        else if (m < 4.5) menor++;
        else if (m < 6.0) ligero++;
        else moderado++;
    });

    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Micro (<2.5)', 'Menor (2.5-4.4)', 'Ligero (4.5-5.9)', 'Mod-Fuerte (>6.0)'],
            datasets: [{
                label: 'Cantidad de Sismos',
                data: [micro, menor, ligero, moderado],
                backgroundColor: ['#4ade80', '#facc15', '#fb923c', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: '#374151' }, ticks: { color: '#9ca3af' } },
                x: { ticks: { color: '#9ca3af' } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// INICIO AUTOMÁTICO: Configura los botones y arranca el programa
document.addEventListener('DOMContentLoaded', () => {

    const magFilter = document.getElementById('filter-magnitude');
    if (magFilter) magFilter.addEventListener('change', renderApp);

    const regionFilter = document.getElementById('region-filter');
    if (regionFilter) {
        regionFilter.addEventListener('change', (e) => {
            localStorage.setItem('selected_region', e.target.value);
            renderApp();
        });
    }

    const refreshBtn = document.getElementById('btn-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            localStorage.removeItem('earthquake_time');
            renderApp();
        });
    }

    renderApp();
    setInterval(renderApp, 60000);
});