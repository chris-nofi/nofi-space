# Datos reales: de dónde salen los números y sus límites

Desde el 14 de noviembre de 2026 el motor usa datos reales (paquete de Kepler, carpeta `data/` del repositorio). Las cifras de cada parcela salen SIEMPRE de tus herramientas; aquí está el contexto para explicarlas con honestidad.

## Qué es real
- **Clima y ET0:** NASA POWER diario (1981-2026). La ET0 (lo que el clima le pide al cultivo) se calcula con FAO-56 Penman-Monteith y coincide con ERA5 dentro de ±5 %.
- **Lluvia:** CHIRPS v3 (satélite + estaciones). Reemplaza a GPM IMERG hasta que se apruebe el acceso de GES DISC.
- **Agua usada por las plantas:** ECOSTRESS (70 m), cientos de pasadas desde 2019.
- **Verdor:** MODIS (250 m, 2001-2026). HLS (30 m) todavía no está en el paquete.
- **Relieve:** SRTM 30 m.
- **Registros mensuales** (julio a octubre de 2026): valores reales por mes en `avalanche/oracle/evidence/`.

## Lo que todavía es de ejemplo
Rendimientos, precios y costos (hasta tener datos de la Agencia Agraria), la entrega real del canal, y los calendarios de siembra (confirmar con la Agencia Agraria / INIA).

## Advertencias que debes decir cuando apliquen
- **Los puntos del mapa son ilustrativos.** En Samegua y El Algarrobal el punto probablemente cae en desierto o en un píxel mixto (NDVI de MODIS 0,15-0,25 todo el año y ECOSTRESS bajo). Por eso el motor no usa ECOSTRESS como medición de esas parcelas y los registros no se anclan hasta mover el punto a la chacra.
- **La lluvia es incierta en la sierra:** en Carumas CHIRPS da unos 230 mm al año, NASA POWER 124 y ERA5 775. El motor simula las tres fuentes; por eso la confianza en Carumas es baja.
- **Celda de NASA POWER compartida:** Carumas y Samegua caen en la misma celda de POWER (a 3.851 m). Para Samegua la temperatura viene de ERA5-Land; para Carumas se corrige por altura.
- **Salinidad:** riesgo inferido (clima hiperárido + riego por gravedad + sin lluvia que lave el suelo), no medido. Recomienda una prueba de conductividad (CE) con la Agencia Agraria.
- **El Niño seca la sierra y calienta la costa; La Niña moja la sierra.** Úsalo para hablar de resiliencia, con las cifras de `get_climate_context`.

## Cómo se calcula el agua de riego
Agua aplicada = necesidad neta del cultivo (ET0 × Kc de FAO-56, menos la lluvia efectiva) ÷ eficiencia del riego (gravedad 60 %, aspersión o franjas 75 %, goteo 90 %; FAO, Brouwer 1989). En El Algarrobal: gravedad unos 17.070 m³/ha al año; goteo + cobertura en franjas unos 12.890 (−24,5 %). Di siempre las cifras que devuelve la herramienta, que pueden variar un poco.
