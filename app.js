let globalEarthquakeData = null;
let myChart = null; // Instancia global del gráfico para poder destruirlo/redibujarlo

// 1. POO Estricta: Lógica y Procesamiento Desacoplado
class EarthquakeService {
    constructor(features) {
        this.features = features || [];
    }

    // Filtro por magnitud mínima
    filterByMagnitude(minMag) {
        return this.features.filter(f => (f.properties.mag || 0) >= minMag);
    }

    // [NIVEL ORO]: Filtrado Geográfico Estricto del lado del cliente para "Chile"
    filterByCountry(featuresList, countryName) {
        return featuresList.filter(f => {
            const place = f.properties.place || "";
            return place.toLowerCase().includes(countryName.toLowerCase());
        });
    }

    // Lógica avanzada de métricas
    getStats(filteredFeatures) {
        const magnitudes = filteredFeatures.map(f => f.properties.mag || 0);
        const maxMag = magnitudes.length > 0 ? Math.max(...magnitudes) : 0;
        const tsunamiCount = filteredFeatures.filter(f => f.properties.tsunami > 0).length;
        const sortedFeatures = [...filteredFeatures].sort((a, b) => b.properties.mag - a.properties.mag);

        const majorEvent = filteredFeatures.find(f => f.properties.mag >= 4.0);
        const topHighlight = majorEvent ? majorEvent.properties.place : "Sin anomalías críticas";

        return { total: filteredFeatures.length, maxMag, tsunamiCount, topHighlight, sortedFeatures };
    }
}

// 2. [NIVEL ORO]: Inicialización y Reactividad del Gráfico (Chart.js)
function updateChart(filteredFeatures) {
    const ctx = document.getElementById('magnitudeChart').getContext('2d');

    // Agrupamos los sismos en rangos para el histograma
    const ranges = { '0-2.5': 0, '2.5-4.5': 0, '4.5-6.0': 0, '6.0+': 0 };

    filteredFeatures.forEach(f => {
        const mag = f.properties.mag || 0;
        if (mag < 2.5) ranges['0-2.5']++;
        else if (mag < 4.5) ranges['2.5-4.5']++;
        else if (mag < 6.0) ranges['4.5-6.0']++;
        else ranges['6.0+']++;
    });

    // Si ya existe un gráfico, lo destruimos antes de crear el nuevo para evitar bugs visuales
    if (myChart) {
        myChart.destroy();
    }

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(ranges),
            datasets: [{
                label: 'Cantidad de Sismos por Intensidad',
                data: Object.values(ranges),
                backgroundColor: ['#3b82f6', '#eab308', '#f97316', '#dc2626'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#374151' }, ticks: { color: '#9ca3af' } },
                x: { ticks: { color: '#9ca3af' } }
            }
        }
    });
}

// 3. Controlador UI: Renderizado dinámico general
function renderDashboard() {
    const minMag = parseFloat(document.getElementById('filter-magnitude').value);
    const service = new EarthquakeService(globalEarthquakeData.features);

    // Aplicamos los filtros en cascada del lado del cliente
    const filteredFeatures = service.filterByMagnitude(minMag);
    const stats = service.getStats(filteredFeatures);

    // Actualizar Timestamp del Servidor (Propiedad updated de la API)
    const serverTime = new Date(globalEarthquakeData.metadata.updated);
    document.getElementById('timestamp').textContent = serverTime.toLocaleString();

    // Renderizar Tarjetas Superiores
    document.getElementById('metrics-container').innerHTML = `
        <div class="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-md">
            <h3 class="text-xs font-medium text-gray-400 uppercase tracking-wider">Sismos Analizados</h3>
            <p class="text-4xl font-extrabold text-blue-400 mt-2">${stats.total}</p>
        </div>
        <div class="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-md">
            <h3 class="text-xs font-medium text-gray-400 uppercase tracking-wider">Magnitud Máxima</h3>
            <p class="text-4xl font-extrabold text-red-500 mt-2">${stats.maxMag.toFixed(1)}</p>
        </div>
        <div class="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-md">
            <h3 class="text-xs font-medium text-gray-400 uppercase tracking-wider">Alertas Tsunami</h3>
            <p class="text-4xl font-extrabold text-yellow-500 mt-2">${stats.tsunamiCount}</p>
        </div>
        <div class="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-md">
            <h3 class="text-xs font-medium text-gray-400 uppercase tracking-wider">Mayor Alerta Reciente</h3>
            <p class="text-xs font-semibold text-green-400 mt-3 truncate" title="${stats.topHighlight}">${stats.topHighlight}</p>
        </div>
    `;

    // Renderizar Listado General (Cards de sismos)
    const listContainer = document.getElementById('earthquake-list');
    if (filteredFeatures.length === 0) {
        listContainer.innerHTML = `<p class="text-gray-500 text-center py-4">Sin coincidencias.</p>`;
    } else {
        listContainer.innerHTML = stats.sortedFeatures.map(eq => {
            const p = eq.properties;
            return `
                <div class="p-3 bg-gray-900/50 rounded border border-gray-700 flex justify-between items-center text-xs">
                    <span class="truncate pr-2 w-40 font-medium">${p.place}</span>
                    <span class="font-bold text-red-400 bg-red-950/40 px-2 py-0.5 rounded border border-red-900/60">M ${p.mag.toFixed(1)}</span>
                </div>
            `;
        }).join('');
    }

    // [NIVEL ORO]: Renderizar Sección Especial de Chile (Independiente del filtro de magnitud superior para ver todo)
    const chileFeatures = service.filterByCountry(globalEarthquakeData.features, "Chile");
    const chileContainer = document.getElementById('chile-list');

    if (chileFeatures.length === 0) {
        chileContainer.innerHTML = `<div class="col-span-full text-center text-gray-500 py-4">No se registran sismos en Chile en la última hora.</div>`;
    } else {
        chileContainer.innerHTML = chileFeatures.map(eq => {
            const p = eq.properties;
            const t = new Date(p.time).toLocaleTimeString();
            return `
                <article class="p-4 bg-cyan-950/20 border border-cyan-900/60 rounded-xl flex justify-between items-center">
                    <div>
                        <h4 class="text-sm font-bold text-gray-200 truncate w-44">${p.place.replace(", Chile", "")}</h4>
                        <p class="text-xs text-gray-400 mt-0.5">Hora local: ${t}</p>
                    </div>
                    <span class="text-md font-black text-cyan-400 bg-cyan-950 border border-cyan-800 px-3 py-1 rounded-lg">M ${p.mag.toFixed(1)}</span>
                </article>
            `;
        }).join('');
    }

    // Actualizar de forma reactiva el gráfico con la data filtrada actual
    updateChart(filteredFeatures);
}

// 4. [NIVEL ORO]: Gestión del Caché Local Expirable (5 Minutos)
async function fetchEarthquakeData(forceRefresh = false) {
    const cacheKey = 'usgs_earthquake_data';
    const cacheTimeKey = 'usgs_earthquake_time';
    const cacheDuration = 5 * 60 * 1000; // 5 minutos en milisegundos

    const now = Date.now();
    const cachedData = localStorage.getItem(cacheKey);
    const cachedTime = localStorage.getItem(cacheTimeKey);

    // Si el usuario no fuerza la recarga, y hay datos frescos en el caché, los usamos
    if (!forceRefresh && cachedData && cachedTime && (now - cachedTime < cacheDuration)) {
        console.log("Cargando datos desde el localStorage (Caché activo)...");
        globalEarthquakeData = JSON.parse(cachedData);
        renderDashboard();
        return;
    }

    // Si no hay caché o expiró, hacemos la petición HTTP
    console.log("Caché expirado o actualización forzada. Consultando API...");
    const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson';
    const loadingEl = document.getElementById('loading-state');
    const errorEl = document.getElementById('error-state');

    loadingEl.classList.remove('hidden');
    errorEl.classList.add('hidden');

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Error de conexión HTTP: ${response.status}`);

        globalEarthquakeData = await response.json();

        // Guardamos en el localStorage con la estampa de tiempo actual
        localStorage.setItem(cacheKey, JSON.stringify(globalEarthquakeData));
        localStorage.setItem(cacheTimeKey, now);

        renderDashboard();
    } catch (error) {
        console.error(error);
        errorEl.textContent = `Error crítico: ${error.message}. Se intentará usar caché antiguo si existe.`;
        errorEl.classList.remove('hidden');
    } finally {
        loadingEl.classList.add('hidden');
    }
}

// 5. Asignación de Listeners de Eventos
document.getElementById('btn-refresh').addEventListener('click', () => fetchEarthquakeData(true)); // forceRefresh = true
document.getElementById('filter-magnitude').addEventListener('change', renderDashboard);

// Carga Inicial
document.addEventListener('DOMContentLoaded', () => fetchEarthquakeData(false));