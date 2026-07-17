// CONFIGURACIÓN: Tiempo de espera para no saturar el sistema (1 minuto)
const CACHE_DURATION = 60000;
// DIRECCIÓN DE INTERNET: El enlace oficial de donde sacamos la información de los sismos en vivo
const API_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson';

// FONDO DE PANTALLA: Coloca la imagen de las olas del mar fijas en el fondo de la página
document.body.style.backgroundImage = "url('https://images.unsplash.com/photo-1518837695005-2083093ee35b?q=80&w=1920')";
document.body.style.backgroundSize = "cover";
document.body.style.backgroundAttachment = "fixed";
document.body.style.backgroundPosition = "center";

// EL ORGANIZADOR DE DATOS: Este bloque se encarga de ordenar y separar la lista de sismos que llega de internet
class EarthquakeService {
    constructor(data) {
        this.earthquakes = data.features || [];
    }
    // Filtra la lista para dejar solo los sismos que tengan el tamaño mínimo seleccionado
    filterByMagnitude(minMag) {
        return this.earthquakes.filter(eq => eq.properties.mag >= minMag);
    }
    // Filtra la lista para buscar solo los sismos que mencionen el lugar elegido (como "Chile" o "Hawaii")
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
// NUEVA LÓGICA: Busca estrictamente el último sismo cronológico registrado en el mundo
    findHighestAlert() {
        if (this.earthquakes.length === 0) return null;

        // Ordena la lista poniendo el sismo más reciente en el tiempo arriba de todo
        const ordenadosPorTiempo = [...this.earthquakes].sort((a, b) => b.properties.time - a.properties.time);

        // Devuelve el último sismo que ocurrió en el planeta
        return ordenadosPorTiempo[0];
    }
    // Busca si hay algún sismo peligroso que supere el tamaño de 7.0 grados
    findCriticalEarthquake() {
        return this.earthquakes.find(eq => eq.properties.mag >= 7.0) || null;
    }
}

// EL CARTERO (Mecanismo de descarga): Va a internet a buscar los sismos más recientes
async function fetchEarthquakeData() {
    // Revisa si ya tenemos datos guardados en la memoria del navegador y qué hora era
    const cachedData = localStorage.getItem('earthquake_data');
    const cachedTime = localStorage.getItem('earthquake_time');
    const now = Date.now();

    // Si los datos guardados tienen menos de un minuto, los usa para no gastar internet en vano
    if (cachedData && cachedTime && (now - cachedTime < CACHE_DURATION)) {
        return JSON.parse(cachedData);
    }

    // Si no hay datos o ya pasó el minuto, viaja a internet a buscar la información nueva
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Error de conexión');
        const data = await response.json();
        // Guarda la información nueva y la hora actual en la memoria para la próxima consulta
        localStorage.setItem('earthquake_data', JSON.stringify(data));
        localStorage.setItem('earthquake_time', now.toString());
        return data;
    } catch (error) {
        // Si internet falla por completo, usa lo último que tenga guardado para que la página no quede vacía
        if (cachedData) return JSON.parse(cachedData);
        return null;
    }
}

// Variable interna para controlar y actualizar el dibujo de las estadísticas
let chartInstance = null;

// EL MOTOR PRINCIPAL: Se encarga de armar la página y dibujar todo con los datos actualizados
async function renderApp() {
    // 1. Le pide los datos al "cartero"
    const rawData = await fetchEarthquakeData();
    if (!rawData) return;

    // 2. Le pasa los datos al "organizador" para empezar a separarlos
    const service = new EarthquakeService(rawData);

    // 3. Revisa qué tamaño mínimo de sismo seleccionó el usuario en la pantalla
    const minMagSelect = document.getElementById('filter-magnitude');
    const minMag = minMagSelect ? parseFloat(minMagSelect.value) : 0;

    // 4. Revisa qué país o región se guardó en la memoria o cuál está marcada actualmente
    const regionSelect = document.getElementById('region-filter');
    let selectedRegion = regionSelect ? regionSelect.value : localStorage.getItem('selected_region') || 'Chile';
    if (regionSelect) regionSelect.value = selectedRegion;

    // 5. Prepara las listas finales filtradas y ordenadas
    const globalFiltrados = service.filterByMagnitude(minMag);
    const globalOrdenados = service.sortByMagnitude(globalFiltrados);
    const regionFiltrados = service.filterByRegion(selectedRegion);

    // 6. Escribe la hora actual en la barra superior para avisar cuándo se actualizaron los datos
    const timestampEl = document.getElementById('timestamp');
    if (timestampEl) {
        timestampEl.innerText = new Date().toLocaleTimeString();
    }

    // 7. DIBUJAR ALERTA CENTRAL SUPERIOR (Peligro crítico)
    const sismoCritico = service.findCriticalEarthquake();
    const topAlertContainer = document.getElementById('top-critical-alert');
    if (topAlertContainer) {
        if (sismoCritico) {
            // Si hay un terremoto > 7.0, pinta un cuadro rojo gigante con sirenas
            topAlertContainer.innerHTML = `
                <div class="bg-red-700 border-4 border-red-500 text-white p-6 rounded-xl shadow-2xl text-center">
                    <h3 class="text-2xl font-black tracking-wider uppercase mb-2">🚨 ÚLTIMO SISMO CON MAGNITUD MAYOR A 7 REGISTRADO 🚨</h3>
                    <p class="text-xl font-bold">¡Evento Crítico Detectado! <span class="text-3xl font-extrabold text-yellow-300">M ${sismoCritico.properties.mag}</span></p>
                    <p class="text-md mt-1 font-semibold">📍 Ubicación: ${sismoCritico.properties.place}</p>
                    <p class="text-xs text-gray-200 mt-1">Sincronizado en tiempo real</p>
                </div>
            `;
        } else {
            // Si el planeta está tranquilo, muestra el aviso informativo gris estándar
            topAlertContainer.innerHTML = `
                <div class="bg-gradient-to-r from-gray-800/90 to-red-950/40 border border-gray-700 text-white p-5 rounded-xl shadow-md backdrop-blur-sm text-center">
                    <h3 class="text-lg font-bold tracking-wider text-red-400 uppercase flex items-center justify-center gap-2">
                        ⚠️ MONITOREO DE EVENTOS MAYORES
                    </h3>
                    <p class="text-sm text-gray-300 mt-1">Último sismo con magnitud mayor a 7 registrado: Ninguno en la última hora. El umbral global permanece estable.</p>
                </div>
            `;
        }
    }

    // 8. DIBUJAR ALERTA INFERIOR DERECHA (El sismo más fuerte de la hora)
    const sismoMasFuerte = service.findHighestAlert();
    const alertaContainer = document.getElementById('alert-container');
    if (alertaContainer && sismoMasFuerte) {
        alertaContainer.innerHTML = `
            <div class="bg-gray-800/95 border border-red-900/60 text-white p-6 rounded-xl shadow-md backdrop-blur-sm w-full flex flex-col justify-center">
                <h4 class="text-xs font-bold tracking-wider uppercase text-gray-400 mb-2 flex items-center gap-2">
                    <span>🔔</span> Ultima Actividad Sismica Registrada
                </h4>
                <p class="text-base text-gray-200">
                    Magnitud local máxima: <span class="font-bold text-yellow-400 text-lg">M ${sismoMasFuerte.properties.mag}</span>
                </p>
                <p class="text-sm text-gray-300 mt-2 truncate">📍 ${sismoMasFuerte.properties.place}</p>
                <p class="text-xs text-gray-500 mt-1">Hora del reporte: ${new Date(sismoMasFuerte.properties.time).toLocaleTimeString()}</p>
            </div>
        `;
    }

    // 9. DIBUJAR LA LISTA GLOBAL (Todos los sismos del mundo en la derecha)
    const listContainer = document.getElementById('earthquake-list');
    if (listContainer) {
        if (globalOrdenados.length === 0) {
            listContainer.innerHTML = '<p class="text-gray-400 text-center py-8">No hay sismos.</p>';
        } else {
            // Arma los cuadritos uno por uno. Si el sismo es fuerte lo pinta con letras rojas, si es débil con verdes
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

    // 10. DIBUJAR LA LISTA REGIONAL (Los sismos del país elegido en la izquierda)
    const localContainer = document.getElementById('chile-list');
    const localTitle = document.getElementById('local-section-title');
    if (localTitle) localTitle.innerText = `Región Destacada: Monitoreo en ${selectedRegion}`;

    if (localContainer) {
        if (regionFiltrados.length === 0) {
            localContainer.innerHTML = `<p class="text-gray-400 text-center col-span-full py-6">Sin actividad reciente en ${selectedRegion}.</p>`;
        } else {
            // Arma los cuadritos azules correspondientes al país que elegiste
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

    // 11. Le pasa los datos refinados al dibujante de estadísticas para que actualice las barras gráficas
    renderChart(globalOrdenados);
}

// EL DIBUJAR DE ESTADÍSTICAS: Cuenta cuántos sismos hay de cada tipo y pinta las barras de colores
function renderChart(earthquakes) {
    const ctx = document.getElementById('magnitudeChart');
    if (!ctx) return;

    // Contadores vacíos para clasificar los sismos por su tamaño
    let micro = 0, menor = 0, ligero = 0, moderado = 0;
    earthquakes.forEach(eq => {
        const m = eq.properties.mag;
        if (m < 2.5) micro++;
        else if (m < 4.5) menor++;
        else if (m < 6.0) ligero++;
        else moderado++;
    });

    // Si ya existía un gráfico dibujado antes, lo borra por completo para poder pintar el nuevo encima sin errores
    if (chartInstance) {
        chartInstance.destroy();
    }

    // Genera el gráfico de barras con sus nombres, números y colores correspondientes
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

// INICIO AUTOMÁTICO: Configura los interruptores y arranca el programa cuando la pantalla se termina de cargar
document.addEventListener('DOMContentLoaded', () => {

    // Interruptor 1: Si cambias la magnitud mínima, re-calcula y actualiza la pantalla
    const magFilter = document.getElementById('filter-magnitude');
    if (magFilter) magFilter.addEventListener('change', renderApp);

    // Interruptor 2: Si cambias el país a destacar, guarda tu preferencia en la memoria y actualiza la lista local
    const regionFilter = document.getElementById('region-filter');
    if (regionFilter) {
        regionFilter.addEventListener('change', (e) => {
            localStorage.setItem('selected_region', e.target.value);
            renderApp();
        });
    }

    // Interruptor 3: Si presionas el botón de "Forzar Actualización", borra el reloj y busca datos nuevos al instante
    const refreshBtn = document.getElementById('btn-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            localStorage.removeItem('earthquake_time');
            renderApp();
        });
    }

    // DISPARADOR: Ejecuta todo el sistema por primera vez al abrir la página
    renderApp();

    // TEMPORIZADOR: Se queda funcionando en secreto y actualiza los datos automáticamente cada 1 minuto (60000 milisegundos)
    setInterval(renderApp, 60000);
});