# Los datos de la NASA, en palabras simples

| Dato | Qué mide | Qué tan fino ve | Para qué lo usamos |
|---|---|---|---|
| **ECOSTRESS** (Estación Espacial) | El agua que el campo devuelve al aire: evapotranspiración | Cuadros de 70 m: ve tu parcela | Cuánta agua usa tu cultivo; es la base de la recompensa |
| **HLS** (satélites Landsat y Sentinel-2) | Qué tan verde está el campo (NDVI) | 30 m, cada 2–3 días | Saber si hay cultivo vivo, si cambiaste de cultivo y cuándo el suelo queda desnudo |
| **NASA POWER** | Temperatura, lluvia, sol, humedad, viento | Zona de ~50 km | Calcular cuánta agua "debería" pedir cada cultivo y los meses de helada |
| **GPM IMERG** | Lluvia diaria | ~10 km | La lluvia en la cabecera que llena Pasto Grande |
| **OPERA DSWx** | Dónde hay agua en superficie | 30 m | Cuánta agua tiene el reservorio y si la qocha guarda agua |
| **SMAP** | Humedad del suelo | 9 km | Contexto en la zona alta |
| **GRACE-FO** | Agua guardada en toda la región (incluye subterránea) | Cuenca | La tendencia de largo plazo |
| **SRTM** | Altura y pendiente del terreno | 30 m | Riesgo de helada y dónde conviene una qocha |

## Palabras clave
- **Evapotranspiración (ET):** agua que se va del campo al aire, por el suelo (evaporación) y por las hojas (transpiración). 1 milímetro sobre 1 hectárea son 10 metros cúbicos.
- **NDVI:** número de 0 a 1 que dice qué tan verde y denso está el cultivo. Menos de 0.25 suele ser suelo desnudo.
- **Evapotranspiración de referencia (ET0):** cuánta agua pediría un pasto bien regado con ese clima. Cada cultivo pide una fracción (coeficiente Kc) de eso.
- **Helada:** cuando la temperatura mínima baja de cero; la papa, la arveja y el frijol sufren; la haba y la avena aguantan más.

## Límites honestos (dilos cuando importe)
- ECOSTRESS mide el agua **consumida**, no la **entregada** por el canal. Las pérdidas del canal no aparecen.
- ECOSTRESS pasa a horas irregulares; algunos meses no hay foto clara. El modelo SI llena esos huecos y lo dice.
- POWER, IMERG, SMAP y GRACE-FO describen la zona, no una sola parcela.
- En la costa de Ilo la neblina de invierno puede tapar algunas fotos.
- Mientras no se descarguen los datos reales, el sistema usa **clima de ejemplo** y lo indica.
