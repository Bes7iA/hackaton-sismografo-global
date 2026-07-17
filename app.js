// CONFIGURACIÓN: Tiempo de espera para no saturar el sistema (1 minuto)
const CACHE_DURATION = 60000;

// DIRECCIONES DE INTERNET (Dos fuentes de datos distintas):
const API_URL_HOUR = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson';
const API_URL_DAY = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';

// FONDO DE PANTALLA: Coloca la imagen de las olas del mar fijas en el fondo de la página
document.body.style.backgroundImage = "url('https://images.unsplash.com/photo-1518837695005-2083093ee35b?q=80&w=1920')";
document.body.style.backgroundSize = "cover";
document.body.style.backgroundAttachment = "fixed";
document.body.style.backgroundPosition = "center";

// EL ORGANIZADOR DE DATOS: Este bloque se encarga de ordenar y separar las listas de sismos
class EarthquakeService {
    constructor(hourData, dayData) {
        this.earthquakesHour = hourData?.features || [];
        this.earthquakesDay = dayData?.features || [];
    }
    filterByMagnitude(minMag) {
        return this.earthquakesHour.filter(eq => eq.properties.mag >= minMag);
    }
    filterByRegion(regionName) {
        if (!regionName) return [];
        return this.earthquakesHour.filter(eq =>
            eq.properties.place.toLowerCase().includes(regionName.toLowerCase())
        );
    }
    sortByTime(list) {
        // Ordena de mayor a menor según el timestamp (el sismo más nuevo primero)
        return [...list].sort((a, b) => b.properties.time - a.properties.time);
    }
    findLatestEarthquake() {
        if (this.earthquakesHour.length === 0) return null;
        const sortedByTime = [...this.earthquakesHour].sort((a, b) => b.properties.time - a.properties.time);
        return sortedByTime[0];
    }
    findCriticalEarthquake() {
        return this.earthquakesHour.find(eq => eq.properties.mag >= 7.0) || null;
    }
}

// EL CARTERO (Mecanismo de descarga): Va a internet a buscar ambas listas en paralelo
async function fetchAllEarthquakeData() {
    const cachedHour = localStorage.getItem('eq_data_hour');
    const cachedDay = localStorage.getItem('eq_data_day');
    const cachedTime = localStorage.getItem('earthquake_time_stamp');
    const now = Date.now();

    if (cachedHour && cachedDay && cachedTime && (now - cachedTime < CACHE_DURATION)) {
        return {
            hour: JSON.parse(cachedHour),
            day: JSON.parse(cachedDay)
        };
    }

    try {
        const [responseHour, responseDay] = await Promise.all([
            fetch(API_URL_HOUR),
            fetch(API_URL_DAY)
        ]);

        if (!responseHour.ok || !responseDay.ok) throw new Error('Error de conexión');

        const dataHour = await responseHour.json();
        const dataDay = await responseDay.json();

        localStorage.setItem('eq_data_hour', JSON.stringify(dataHour));
        localStorage.setItem('eq_data_day', JSON.stringify(dataDay));
        localStorage.setItem('earthquake_time_stamp', now.toString());

        return { hour: dataHour, day: dataDay };
    } catch (error) {
        if (cachedHour && cachedDay) {
            return { hour: JSON.parse(cachedHour), day: JSON.parse(cachedDay) };
        }
        return null;
    }
}

// Variables globales internas de control
let chartInstance = null;
let currentServiceInstance = null;

// EL MOTOR PRINCIPAL: Se ejecuta cada 1 minuto o al presionar "Actualizar"
async function renderApp() {
    const allData = await fetchAllEarthquakeData();
    if (!allData) return;

    // Guardamos el servicio en una variable externa para que el filtro regional lo use sin recargar la app
    currentServiceInstance = new EarthquakeService(allData.hour, allData.day);

    const minMagSelect = document.getElementById('filter-magnitude');
    const minMag = minMagSelect ? parseFloat(minMagSelect.value) : 0;

    const globalFiltrados = currentServiceInstance.filterByMagnitude(minMag);
    const globalOrdenados = currentServiceInstance.sortByTime(globalFiltrados);

    const timestampEl = document.getElementById('timestamp');
    if (timestampEl) {
        timestampEl.innerText = new Date().toLocaleTimeString();
    }

    // 1. ACTUALIZAR ALERTA HISTÓRICA SUPERIOR (7.0+)
    actualizarAlertaCritica(currentServiceInstance);

    // 2. ACTUALIZAR ALERTA INFERIOR DERECHA (Último sismo mundial)
    actualizarUltimoSismoMundo(currentServiceInstance);

    // 3. ACTUALIZAR LISTA GLOBAL (Última hora)
    actualizarListaGlobal(globalOrdenados);

    // 4. ACTUALIZAR LISTA REGIONAL DE ESTRENO
    renderRegionDestacada();

    // 5. ENVIAR DATOS AL GRÁFICO (Datos de 24 horas mundiales)
    renderChart(currentServiceInstance.earthquakesDay);
}

// SUB-MOTOR REGIONAL: Funciona de manera independiente y aislada
function renderRegionDestacada() {
    if (!currentServiceInstance) return;

    const regionSelect = document.getElementById('region-filter');
    let selectedRegion = regionSelect ? regionSelect.value : localStorage.getItem('selected_region') || 'Chile';
    if (regionSelect && regionSelect.value !== selectedRegion) regionSelect.value = selectedRegion;

    const regionFiltrados = currentServiceInstance.filterByRegion(selectedRegion);

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
}

function actualizarAlertaCritica(service) {
    const sismoCriticoActual = service.findCriticalEarthquake();
    if (sismoCriticoActual) {
        localStorage.setItem('last_huge_earthquake', JSON.stringify(sismoCriticoActual));
    }

    const sismoAnclado = JSON.parse(localStorage.getItem('last_huge_earthquake'));
    const topAlertContainer = document.getElementById('top-critical-alert');
    if (topAlertContainer) {
        if (sismoAnclado) {
            const opcionesFecha = { year: 'numeric', month: 'long', day: 'numeric' };
            const fechaSismo = new Date(sismoAnclado.properties.time).toLocaleDateString('es-ES', opcionesFecha);
            const horaSismo = new Date(sismoAnclado.properties.time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            topAlertContainer.innerHTML = `
                <div class="bg-red-700 border-4 border-red-500 text-white p-6 rounded-xl shadow-2xl text-center">
                    <h3 class="text-2xl font-black tracking-wider uppercase mb-2">🚨 ÚLTIMO SISMO CON MAGNITUD MAYOR A 7 REGISTRADO 🚨</h3>
                    <p class="text-xl font-bold">Alerta Histórica Fija: <span class="text-3xl font-extrabold text-yellow-300">M ${sismoAnclado.properties.mag}</span></p>
                    <p class="text-md mt-1 font-semibold">📍 Ubicación: ${sismoAnclado.properties.place}</p>
                    <div class="mt-3 inline-block bg-red-900/60 border border-red-400/30 px-4 py-1.5 rounded-lg">
                        <p class="text-sm font-medium">📅 Fecha: <span class="text-yellow-300 font-bold">${fechaSismo}</span> a las <span class="text-yellow-300 font-bold">${horaSismo}</span></p>
                    </div>
                </div>
            `;
        } else {
            topAlertContainer.innerHTML = `
                <div class="bg-gradient-to-r from-gray-800/90 to-red-950/40 border border-gray-700 text-white p-5 rounded-xl shadow-md text-center">
                    <h3 class="text-lg font-bold tracking-wider text-red-400 uppercase">⚠️ SISTEMA DE MONITOREO CRÍTICO</h3>
                    <p class="text-sm text-gray-300 mt-1">Esperando la detección del primer sismo mayor a 7.0 para fijar la alerta...</p>
                </div>
            `;
        }
    }
}

function actualizarUltimoSismoMundo(service) {
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
}

function actualizarListaGlobal(globalOrdenados) {
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
}

// EL DIBUJAR DE ESTADÍSTICAS: Barras mínimas, números flotantes y cero tooltips molestos
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
        plugins: [ChartDataLabels],
        data: {
            labels: ['Micro (<2.5)', 'Menor (2.5-4.4)', 'Ligero (4.5-5.9)', 'Mod-Fuerte (>6.0)'],
            datasets: [{
                label: 'Sismos en las últimas 24 horas',
                data: [micro, menor, ligero, moderado],
                backgroundColor: ['#4ade80', '#facc15', '#fb923c', '#ef4444'],
                borderWidth: 0,
                minBarLength: 8 // Hace visible la barra aunque sea de solo 1 sismo
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#374151' },
                    ticks: { color: '#9ca3af' },
                    grace: '12%'
                },
                x: { ticks: { color: '#9ca3af' } }
            },
            plugins: {
                legend: { display: false, labels: { color: '#9ca3af' } },
                tooltip: { enabled: false }, // Desactiva los cuadros negros flotantes
                datalabels: { // Configura los números encima de las barras
                    align: 'end',
                    anchor: 'end',
                    color: '#ffffff',
                    font: { weight: 'bold', size: 12 },
                    formatter: function(value) { return value; }
                }
            }
        }
    });
}

// CONFIGURACIÓN DE ESCUCHAS Y ARRANQUE AUTOMÁTICO
document.addEventListener('DOMContentLoaded', () => {

    const magFilter = document.getElementById('filter-magnitude');
    if (magFilter) magFilter.addEventListener('change', renderApp);

    const regionFilter = document.getElementById('region-filter');
    if (regionFilter) {
        regionFilter.addEventListener('change', (e) => {
            localStorage.setItem('selected_region', e.target.value);
            // OPTIMIZACIÓN CLAVE: Al cambiar de país, solo redibuja el recuadro regional
            renderRegionDestacada();
        });
    }

    const refreshBtn = document.getElementById('btn-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            localStorage.removeItem('earthquake_time_stamp');
            renderApp();
        });
    }

    renderApp();
    setInterval(renderApp, 60000);
});