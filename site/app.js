const DB = {
  "FARMS": [
    {
      "id": "carumas",
      "name": "Parcela Familia Quispe",
      "place": {
        "es": "Carumas · zona alta",
        "en": "Carumas · highlands"
      },
      "zone": {
        "es": "Zona alta · secano",
        "en": "Highlands · rainfed"
      },
      "lat": -16.81,
      "lon": -70.69,
      "ha": 1,
      "elevation": 3000,
      "crop": {
        "es": "Papa · lluvias dic–mar",
        "en": "Potato · rains Dec–Mar"
      },
      "waterSource": {
        "es": "Lluvia + qocha comunal",
        "en": "Rain + community qocha"
      },
      "mode": "practice",
      "rateHa": 70,
      "compliance": 90,
      "et": [
        2.6,
        2.8,
        2.4,
        1.4,
        0.5,
        0.25,
        0.2,
        0.2,
        0.25,
        0.4,
        0.8,
        1.6
      ],
      "ref": [
        2.8,
        3.3,
        2.3,
        0.5,
        0.07,
        0,
        0,
        0.03,
        0.1,
        0.2,
        0.5,
        1.5
      ],
      "refLabel": {
        "es": "Lluvia disponible",
        "en": "Available rain"
      },
      "rainYear": 342,
      "tminCold": -2,
      "ceres": {
        "es": "Tu cultivo usa más agua de la que llueve en octubre, noviembre, marzo y abril. En esos meses vive del agua guardada en el suelo y en la qocha. Si el suelo queda desnudo de mayo a septiembre, esa agua se pierde.",
        "en": "Your crop uses more water than falls as rain in October, November, March and April. In those months it lives on water stored in the soil and the qocha. If the soil stays bare from May to September, that water is lost."
      },
      "strategies": [
        {
          "id": "current",
          "current": true,
          "water": 380,
          "soil": 30,
          "income": 3,
          "name": {
            "es": "Papa → papa",
            "en": "Potato → potato"
          },
          "mainRisk": {
            "es": "Helada jun–ago",
            "en": "Frost Jun–Aug"
          },
          "why": {
            "es": "Es lo que se siembra hoy.",
            "en": "What is planted today."
          },
          "evidence": {
            "es": "Meses de suelo desnudo: se calcula con NDVI satelital (ver Datos y evidencia).",
            "en": "Bare-soil months: computed from satellite NDVI (see Data & evidence)."
          },
          "gaps": {
            "es": "Sin datos de rendimiento por parcela.",
            "en": "No plot-level yield data."
          },
          "risks": {
            "es": "Plagas de suelo acumuladas y menos infiltración.",
            "en": "Soil pests build up; less infiltration."
          }
        },
        {
          "id": "haba-avena",
          "recommended": true,
          "water": 350,
          "soil": 78,
          "income": 3,
          "name": {
            "es": "Papa → haba → avena-vicia",
            "en": "Potato → faba bean → oat-vetch"
          },
          "mainRisk": {
            "es": "Helada sobre la haba",
            "en": "Frost on faba bean"
          },
          "why": {
            "es": "La haba fija nitrógeno y la avena-vicia cubre el suelo en la época seca, guardando humedad.",
            "en": "Faba bean fixes nitrogen and oat-vetch covers the soil in the dry season, keeping moisture in."
          },
          "evidence": {
            "es": "Rotación andina tradicional; mezclas avena-vicia usadas como abono verde en papa de altura.",
            "en": "Traditional Andean rotation; oat-vetch mixes used as green manure in highland potato."
          },
          "gaps": {
            "es": "Sin ensayos publicados en Carumas: evidencia transferida de otras zonas altoandinas.",
            "en": "No published trials in Carumas: evidence transferred from other high-Andean areas."
          },
          "risks": {
            "es": "Helada en junio–agosto; disponibilidad local de semilla de vicia.",
            "en": "Frost in June–August; local vetch seed supply."
          }
        },
        {
          "id": "tarwi",
          "water": 330,
          "soil": 72,
          "income": 4,
          "name": {
            "es": "Papa → tarwi → cebada",
            "en": "Potato → tarwi → barley"
          },
          "mainRisk": {
            "es": "Mercado de tarwi",
            "en": "Tarwi market"
          },
          "why": {
            "es": "El tarwi es una leguminosa andina tolerante a sequía, de raíz profunda.",
            "en": "Tarwi is a drought-tolerant, deep-rooted Andean legume."
          },
          "evidence": {
            "es": "Cultivo nativo con demanda en ciudades del sur.",
            "en": "Native crop with demand in southern cities."
          },
          "gaps": {
            "es": "Comercialización local en Moquegua no verificada.",
            "en": "Local market in Moquegua not verified."
          },
          "risks": {
            "es": "Requiere desamargado; más mano de obra.",
            "en": "Needs debittering; more labor."
          }
        },
        {
          "id": "descanso",
          "water": 300,
          "soil": 84,
          "income": 2,
          "name": {
            "es": "Papa → haba → descanso con zanjas",
            "en": "Potato → faba → fallow with trenches"
          },
          "mainRisk": {
            "es": "Menos ingreso a corto plazo",
            "en": "Less short-term income"
          },
          "why": {
            "es": "Descanso de la tierra con zanjas de infiltración: máxima agua retenida en la cuenca.",
            "en": "Fallow with infiltration trenches: the most water kept in the basin."
          },
          "evidence": {
            "es": "Zanjas y qochas son las prácticas que ya financia el MERESE de EPS Ilo.",
            "en": "Trenches and qochas are what EPS Ilo's MERESE already funds."
          },
          "gaps": {
            "es": "Medir la infiltración real requiere puntos en campo.",
            "en": "Measuring real infiltration needs field points."
          },
          "risks": {
            "es": "Un año sin cosecha de papa en esa parcela.",
            "en": "One year without a potato harvest on that plot."
          }
        }
      ],
      "checks": [
        {
          "id": "legume",
          "weight": 30,
          "result": "ok",
          "label": {
            "es": "Leguminosa sembrada",
            "en": "Legume planted"
          },
          "detail": {
            "es": "Regla: HLS NDVI > 0,4 en ene–feb (pendiente: HLS 30 m)",
            "en": "Rule: HLS NDVI > 0.4 in Jan–Feb (pending: HLS 30 m)"
          }
        },
        {
          "id": "cover",
          "weight": 30,
          "result": "ok",
          "label": {
            "es": "Suelo cubierto en época seca",
            "en": "Soil covered in dry season"
          },
          "detail": {
            "es": "Regla: HLS NDVI > 0,25 de may a sep (pendiente: HLS 30 m)",
            "en": "Rule: HLS NDVI > 0.25 May–Sep (pending: HLS 30 m)"
          }
        },
        {
          "id": "qocha",
          "weight": 20,
          "result": "ok",
          "label": {
            "es": "Qocha con agua en mayo",
            "en": "Qocha holds water in May"
          },
          "detail": {
            "es": "OPERA DSWx · lámina de agua",
            "en": "OPERA DSWx · water surface"
          }
        },
        {
          "id": "moisture",
          "weight": 20,
          "result": "partial",
          "got": 10,
          "label": {
            "es": "Humedad retenida",
            "en": "Moisture retained"
          },
          "detail": {
            "es": "SMAP + ECOSTRESS · señal regional, baja confianza (SMAP pendiente)",
            "en": "SMAP + ECOSTRESS · regional signal, low confidence (SMAP pending)"
          }
        }
      ],
      "confidence": {
        "water": "example",
        "ref": "example"
      }
    },
    {
      "id": "samegua",
      "name": "Chacra Los Ángeles",
      "place": {
        "es": "Samegua · valle medio",
        "en": "Samegua · middle valley"
      },
      "zone": {
        "es": "Valle · riego Pasto Grande",
        "en": "Valley · Pasto Grande irrigation"
      },
      "lat": -17.18,
      "lon": -70.9,
      "ha": 1.2,
      "elevation": 1550,
      "crop": {
        "es": "Alfalfa continua",
        "en": "Continuous alfalfa"
      },
      "waterSource": {
        "es": "Canal Pasto Grande · turno de riego",
        "en": "Pasto Grande canal · irrigation turn"
      },
      "mode": "m3",
      "et": [
        5.8,
        6.1,
        5.5,
        4.6,
        3.6,
        3,
        3.1,
        3.7,
        4.6,
        5.4,
        5.9,
        6.2
      ],
      "ref": [
        4.9,
        5.1,
        4.7,
        3.9,
        3.1,
        2.6,
        2.6,
        3.1,
        3.9,
        4.5,
        4.9,
        5.2
      ],
      "refLabel": {
        "es": "ET₀ de referencia (NASA POWER, FAO-56)",
        "en": "Reference ET₀ (NASA POWER, FAO-56)"
      },
      "rainYear": 15,
      "tminCold": 5,
      "ceres": {
        "es": "Casi no llueve aquí: el agua de tu alfalfa sale del canal de Pasto Grande. Te muestro rotaciones que usan menos agua sin dejar la chacra vacía.",
        "en": "It barely rains here: your alfalfa's water comes from the Pasto Grande canal. Here are rotations that use less water without leaving the field empty."
      },
      "strategies": [
        {
          "id": "current",
          "current": true,
          "water": 17250,
          "soil": 70,
          "income": 3,
          "name": {
            "es": "Alfalfa continua",
            "en": "Continuous alfalfa"
          },
          "mainRisk": {
            "es": "Turno de agua recortado",
            "en": "Water turn cut"
          },
          "why": {
            "es": "Forraje estable para ganado lechero.",
            "en": "Steady forage for dairy cattle."
          },
          "evidence": {
            "es": "ECOSTRESS en el punto del mapa: ver Datos y evidencia.",
            "en": "ECOSTRESS at the map point: see Data & evidence."
          },
          "gaps": {
            "es": "No sabemos cuánta agua llega realmente en cada turno.",
            "en": "We don't know how much water each turn actually delivers."
          },
          "risks": {
            "es": "Si Pasto Grande baja, la alfalfa es lo primero que sufre.",
            "en": "If Pasto Grande drops, alfalfa suffers first."
          }
        },
        {
          "id": "maiz-arveja",
          "recommended": true,
          "water": 11500,
          "soil": 66,
          "income": 4,
          "name": {
            "es": "Alfalfa → maíz chala → arveja",
            "en": "Alfalfa → forage maize → pea"
          },
          "mainRisk": {
            "es": "Precio de arveja",
            "en": "Pea price"
          },
          "why": {
            "es": "El maíz chala sigue dando forraje y la arveja de temporada fresca pide poca agua y fija nitrógeno.",
            "en": "Forage maize keeps feed coming; cool-season pea needs little water and fixes nitrogen."
          },
          "evidence": {
            "es": "Coeficientes FAO-56 con la evapotranspiración de referencia de NASA POWER para Samegua.",
            "en": "FAO-56 crop coefficients with NASA POWER reference ET for Samegua."
          },
          "gaps": {
            "es": "Rendimientos locales de arveja por confirmar con la Agencia Agraria.",
            "en": "Local pea yields to confirm with the Agencia Agraria."
          },
          "risks": {
            "es": "Más mano de obra en la cosecha de arveja.",
            "en": "More labor at pea harvest."
          }
        },
        {
          "id": "cebada-frijol",
          "water": 10200,
          "soil": 60,
          "income": 3,
          "name": {
            "es": "Alfalfa → cebada forrajera → frijol",
            "en": "Alfalfa → forage barley → bean"
          },
          "mainRisk": {
            "es": "Calor sobre el frijol",
            "en": "Heat on beans"
          },
          "why": {
            "es": "La cebada de invierno aprovecha los meses de menor evaporación.",
            "en": "Winter barley uses the low-evaporation months."
          },
          "evidence": {
            "es": "Menor demanda en jun–ago según NASA POWER.",
            "en": "Lower demand in Jun–Aug per NASA POWER."
          },
          "gaps": {
            "es": "Variedades de frijol para 1,500 m no evaluadas aquí.",
            "en": "Bean varieties for 1,500 m not tested here."
          },
          "risks": {
            "es": "Golpe de calor en verano.",
            "en": "Summer heat stress."
          }
        },
        {
          "id": "quinua",
          "water": 12800,
          "soil": 68,
          "income": 4,
          "name": {
            "es": "Alfalfa 3 años → quinua → alfalfa",
            "en": "Alfalfa 3 yrs → quinoa → alfalfa"
          },
          "mainRisk": {
            "es": "Mercado de quinua",
            "en": "Quinoa market"
          },
          "why": {
            "es": "La quinua tolera sequía y salinidad leve y corta ciclos de plagas.",
            "en": "Quinoa tolerates drought and mild salinity and breaks pest cycles."
          },
          "evidence": {
            "es": "Quinua bajo riego en la costa sur del Perú.",
            "en": "Irrigated quinoa on Peru's southern coast."
          },
          "gaps": {
            "es": "Comprador local no identificado.",
            "en": "No local buyer identified."
          },
          "risks": {
            "es": "Precio volátil.",
            "en": "Volatile price."
          }
        }
      ],
      "checks": [
        {
          "id": "alive",
          "weight": 0,
          "result": "ok",
          "label": {
            "es": "Cultivo vivo todo el año",
            "en": "Crop alive all year"
          },
          "detail": {
            "es": "Regla: NDVI ≥ 0,20 — ahorrar abandonando la chacra no cuenta",
            "en": "Rule: NDVI ≥ 0.20 — saving by abandoning the field never counts"
          }
        },
        {
          "id": "rotation",
          "weight": 0,
          "result": "ok",
          "label": {
            "es": "Rotación detectada",
            "en": "Rotation detected"
          },
          "detail": {
            "es": "Regla: fenología distinta a la alfalfa (pendiente: HLS 30 m)",
            "en": "Rule: phenology differs from alfalfa (pending: HLS 30 m)"
          }
        },
        {
          "id": "use",
          "weight": 0,
          "result": "ok",
          "label": {
            "es": "Consumo medido",
            "en": "Water use measured"
          },
          "detail": {
            "es": "Regla: ECOSTRESS campaña vs línea base (cuando el punto esté sobre la chacra)",
            "en": "Rule: ECOSTRESS season vs baseline (once the point is on the field)"
          }
        }
      ],
      "confidence": {
        "water": "example",
        "ref": "example"
      }
    },
    {
      "id": "algarrobal",
      "name": "Olivar Santa Rosa",
      "place": {
        "es": "El Algarrobal · Ilo",
        "en": "El Algarrobal · Ilo"
      },
      "zone": {
        "es": "Costa · olivo perenne",
        "en": "Coast · perennial olive"
      },
      "lat": -17.62,
      "lon": -71.26,
      "ha": 2,
      "elevation": 150,
      "crop": {
        "es": "Olivo · suelo desnudo",
        "en": "Olive · bare soil"
      },
      "waterSource": {
        "es": "Río Osmore · riego por gravedad",
        "en": "Osmore river · gravity irrigation"
      },
      "mode": "m3",
      "et": [
        4.2,
        4.4,
        4.1,
        3.6,
        3,
        2.6,
        2.5,
        2.7,
        3.1,
        3.5,
        3.9,
        4.1
      ],
      "ref": [
        3.7,
        3.9,
        3.6,
        3.2,
        2.7,
        2.3,
        2.2,
        2.4,
        2.8,
        3.1,
        3.4,
        3.6
      ],
      "refLabel": {
        "es": "ET₀ de referencia (NASA POWER, FAO-56)",
        "en": "Reference ET₀ (NASA POWER, FAO-56)"
      },
      "rainYear": 5,
      "tminCold": 12,
      "ceres": {
        "es": "El olivo no se rota, pero sí se puede regar distinto. Te muestro tres alternativas a lo que haces hoy, incluida una cobertura que cuida el suelo pero gasta más agua.",
        "en": "Olive trees aren't rotated, but they can be irrigated differently. Here are three alternatives to what you do today, including a cover crop that protects soil but uses more water."
      },
      "strategies": [
        {
          "id": "current",
          "current": true,
          "water": 12500,
          "soil": 35,
          "income": 3,
          "name": {
            "es": "Riego por gravedad, suelo desnudo",
            "en": "Gravity irrigation, bare soil"
          },
          "mainRisk": {
            "es": "Salinidad",
            "en": "Salinity"
          },
          "why": {
            "es": "Práctica actual.",
            "en": "Current practice."
          },
          "evidence": {
            "es": "ECOSTRESS en el punto del mapa: ver Datos y evidencia.",
            "en": "ECOSTRESS at the map point: see Data & evidence."
          },
          "gaps": {
            "es": "Sin mediciones de sal en el suelo.",
            "en": "No soil salinity measurements."
          },
          "risks": {
            "es": "Sales acumuladas y estrés en verano.",
            "en": "Salt build-up and summer stress."
          }
        },
        {
          "id": "deficit",
          "recommended": true,
          "water": 9800,
          "soil": 40,
          "income": 3,
          "name": {
            "es": "Riego deficitario guiado por ECOSTRESS",
            "en": "Deficit irrigation guided by ECOSTRESS"
          },
          "mainRisk": {
            "es": "Calibrar el estrés",
            "en": "Calibrating stress"
          },
          "why": {
            "es": "Menos riego en las etapas en que el olivo lo tolera.",
            "en": "Less water in growth stages olives tolerate."
          },
          "evidence": {
            "es": "El índice de estrés de ECOSTRESS marca cuándo no recortar.",
            "en": "ECOSTRESS stress index flags when not to cut."
          },
          "gaps": {
            "es": "Cultivo perenne: es una estrategia de manejo, no una rotación.",
            "en": "Perennial crop: a management strategy, not a rotation."
          },
          "risks": {
            "es": "Recortar en floración baja la cosecha.",
            "en": "Cutting at flowering lowers yield."
          }
        },
        {
          "id": "cover",
          "water": 13100,
          "soil": 72,
          "income": 3,
          "name": {
            "es": "Olivo + cobertura invernal de leguminosa",
            "en": "Olive + winter legume cover"
          },
          "mainRisk": {
            "es": "Gasta más agua",
            "en": "Uses more water"
          },
          "why": {
            "es": "Protege el suelo y aporta nitrógeno en la época de neblina.",
            "en": "Protects soil and adds nitrogen in the fog season."
          },
          "evidence": {
            "es": "Mejora el suelo, pero ECOSTRESS mostraría más consumo.",
            "en": "Improves soil, but ECOSTRESS would show more use."
          },
          "gaps": {
            "es": "Aporte real de la neblina invernal sin medir.",
            "en": "Winter fog contribution unmeasured."
          },
          "risks": {
            "es": "En el desierto la cobertura compite por agua.",
            "en": "In the desert a cover crop competes for water."
          }
        },
        {
          "id": "drip",
          "water": 10600,
          "soil": 58,
          "income": 3,
          "name": {
            "es": "Goteo + cobertura en franjas",
            "en": "Drip + strip cover"
          },
          "mainRisk": {
            "es": "Inversión inicial",
            "en": "Upfront cost"
          },
          "why": {
            "es": "Agua al pie del árbol y cobertura solo entre hileras.",
            "en": "Water at the tree base, cover only between rows."
          },
          "evidence": {
            "es": "Combina ahorro y protección de suelo.",
            "en": "Combines saving and soil protection."
          },
          "gaps": {
            "es": "Costo del goteo sin financiamiento.",
            "en": "Drip cost unfunded."
          },
          "risks": {
            "es": "Goteros se tapan con agua salobre.",
            "en": "Emitters clog with brackish water."
          }
        }
      ],
      "checks": [
        {
          "id": "alive",
          "weight": 0,
          "result": "ok",
          "label": {
            "es": "Árboles sanos",
            "en": "Trees healthy"
          },
          "detail": {
            "es": "Regla: NDVI ≥ 0,20 — secar el olivar no cuenta",
            "en": "Rule: NDVI ≥ 0.20 — drying the grove never counts"
          }
        },
        {
          "id": "stress",
          "weight": 0,
          "result": "ok",
          "label": {
            "es": "Sin estrés severo",
            "en": "No severe stress"
          },
          "detail": {
            "es": "ECOSTRESS ESI · pendiente (no descargado)",
            "en": "ECOSTRESS ESI · pending (not downloaded)"
          }
        },
        {
          "id": "use",
          "weight": 0,
          "result": "ok",
          "label": {
            "es": "Consumo medido",
            "en": "Water use measured"
          },
          "detail": {
            "es": "Regla: ECOSTRESS campaña vs línea base (cuando el punto esté sobre la chacra)",
            "en": "Rule: ECOSTRESS season vs baseline (once the point is on the field)"
          }
        }
      ],
      "confidence": {
        "water": "example",
        "ref": "example"
      }
    }
  ],
  "BASIN": {
    "reservoirPct": [
      78,
      74,
      69,
      63,
      58,
      54,
      51,
      49,
      47,
      52,
      61,
      70,
      72,
      68,
      62,
      57,
      52,
      48,
      45,
      43,
      41,
      46,
      53,
      60
    ],
    "headRainPct": [
      92,
      68,
      110,
      74,
      81
    ],
    "storageCm": [
      4,
      3.2,
      2.1,
      1.5,
      0.4,
      -0.6,
      -1.4,
      -2.3,
      -2.9,
      -3.6
    ],
    "confidence": "example"
  },
  "REGION_FACTS": [
    {
      "value": "S/ 21 M",
      "es": "perdidos en la sequía de 2016; en El Algarrobal se perdió más del 50 % de las plantaciones de olivo.",
      "en": "lost to the 2016 drought; El Algarrobal lost over 50 % of its olive plantations.",
      "src": "ProActivo",
      "href": "https://proactivo.com.pe/sequia-en-el-sur-moquegua-pierde-21-millones-de-soles-por-falta-de-agua/"
    },
    {
      "value": "700,000 m³",
      "es": "de recarga en la sierra con 30 qochas (Fondo Sierra Azul, 2026; 10 de 30 entregadas a junio de 2026).",
      "en": "of highland recharge from 30 qochas (Fondo Sierra Azul, 2026; 10 of 30 delivered by June 2026).",
      "src": "Agraria",
      "href": "https://agraria.pe/noticias/moquegua-gobierno-asegura-mas-de-700-mil-m-de-agua-con-30-qo-42405"
    },
    {
      "value": "6.8 MMC/año",
      "es": "para ampliar la frontera agrícola desde Vizcachas (28 → 60 MMC), según Anglo American.",
      "en": "to expand farmland from Vizcachas (28 → 60 MMC), per Anglo American.",
      "src": "Energiminas",
      "href": "https://energiminas.com/2024/04/03/la-gestion-sostenible-del-agua-el-factor-clave-de-la-millonaria-inversion-de-anglo-american-en-quellaveco"
    },
    {
      "value": "MERESE",
      "es": "EPS Ilo ya paga a comunidades de cabecera por qochas y zanjas.",
      "en": "EPS Ilo already pays upstream communities for qochas and trenches.",
      "src": "El Búho",
      "href": "https://elbuho.pe/?p=373160"
    }
  ]
};
try { window.CeresRealData?.apply?.(DB); } catch (e) { console.error(e); }
(() => {
  'use strict';
  const farms = DB.FARMS, basin=DB.BASIN, facts=DB.REGION_FACTS;
  const state = {lang:'es',view:'overview',farm:'samegua',strategy:{},stage:{},modal:'',menu:false,notice:false};
  try {if(localStorage.getItem('agua-lang')==='en') state.lang='en';} catch(e){}
  for(const f of farms){state.strategy[f.id]=(f.strategies.find(s=>s.recommended)||f.strategies[1]).id;state.stage[f.id]=0;}
  const t=(es,en)=>state.lang==='es'?es:en;
  const l=(obj)=>obj?.[state.lang]??'';
  const num=(n,d=0)=>Number(n).toLocaleString(state.lang==='es'?'es-PE':'en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
  const f=()=>farms.find(x=>x.id===state.farm)||farms[1];
  const ss=()=>f().strategies.find(x=>x.id===state.strategy[f().id])||f().strategies[1];
  const base=(x)=>x.strategies.find(s=>s.current)?.water||x.strategies[0].water;
  const savings=(x,s)=>(1-s.water/base(x))*100;
  const eligible=(x,s)=>!s.current&&(x.mode!=='m3'||s.water<base(x));
  const maxReward=(x,s)=>!eligible(x,s)?0:x.mode==='practice'?(x.rateHa||0)*x.ha:(base(x)-s.water)*x.ha*.015;
  const measured=(s)=>Math.round(s.water*1.035/100)*100;
  const reward=(x,s)=>!eligible(x,s)?0:x.mode==='practice'?(x.rateHa||0)*x.ha*((x.compliance||0)/100):Math.max(0,(base(x)-measured(s))*x.ha)*.015;
  const annual=(x)=>(x.annualEtcMm??x.et.reduce((a,b)=>a+b,0)*30)*(x.mode==='m3'?10:1);
  const REAL=!!DB.REAL;
  const pct=(v)=>{const r=Math.round(Math.abs(v)*10)/10;return r<0.05?'0':num(r,r%1?1:0);};
  const cite=(k)=>REAL?l(DB.REAL.cite[k]):'';
  const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ico=(name,size=18,cls='')=>{
    const p={dashboard:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',layers:'<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',satellite:'<path d="m13 7 4 4-6 6-4-4zM7 7l3-3 4 4-3 3M14 14l4 4-3 3-4-4M3 14a7 7 0 0 0 7 7M3 9A12 12 0 0 0 15 21"/>',wallet:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 9h18M16 16h2"/>',droplet:'<path d="M12 2C8 8 5 11 5 15a7 7 0 0 0 14 0c0-4-3-7-7-13Z"/>',arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',up:'<path d="M7 17 17 7M9 7h8v8"/>',check:'<path d="m5 12 4 4L19 6"/>',shield:'<path d="m12 2 9 4v6c0 5-4 8-9 10-5-2-9-5-9-10V6l9-4Z"/><path d="m8 12 3 3 5-6"/>',pin:'<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',cloud:'<path d="M20 16a4 4 0 0 0-4-4h-1a6 6 0 0 0-12 1 4 4 0 0 0 1 8h13a4 4 0 0 0 3-5Z"/>',trend:'<path d="m3 17 7-7 4 4 7-7M15 7h6v6"/>',spark:'<path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2Z"/>',activity:'<path d="M3 12h4l3-7 4 14 3-7h4"/>',leaf:'<path d="M20 4c-10-1-16 2-16 10a6 6 0 0 0 6 6c8 0 11-8 10-16ZM5 19l11-11"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/>',close:'<path d="M5 5 19 19M19 5 5 19"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',external:'<path d="M13 5h6v6M19 5l-9 9"/><path d="M19 13v6H5V5h6"/>',chevron:'<path d="m7 10 5 5 5-5"/>',globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18M12 3c-5 5-5 13 0 18"/>',target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',refresh:'<path d="M20 10a8 8 0 1 0-2 7M20 3v7h-7"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>'};
    return `<svg class="i ${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p[name]||p.droplet}</svg>`;
  };
  const brand=()=>`<span class="brand-glyph"><svg viewBox="0 0 44 44" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M22 5C16 14 9 22 9 28a13 13 0 0 0 26 0c0-6-7-14-13-23Z"/><path d="M14 28c2.5-3 5.5-3.2 8.4 0 2.6 3 5.5 3 8 0" stroke-linecap="round"/></svg></span>`;
  const pages=[['overview','dashboard',t('Resumen general','Overview'),t('Tu centro de control','Your control center')],['strategies','layers',t('Estrategias','Strategies'),t('Compara alternativas','Compare alternatives')],['intel','activity',t('Inteligencia SI','SI intelligence'),t('4 módulos + CERES','4 modules + CERES')],['evidence','satellite',t('Datos y evidencia','Data & evidence'),t('NASA y la cuenca','NASA & watershed')],['records','shield',t('Registro verificable','Verifiable record'),t('Datos NASA anclados','Anchored NASA data')]];
  const statusPill=()=>`<span class="pill-demo"><span class="pulse"></span>${REAL?t('DATOS NASA REALES · PUNTOS ILUSTRATIVOS','REAL NASA DATA · ILLUSTRATIVE POINTS'):t('DATOS DE EJEMPLO','EXAMPLE DATA')}</span>`;
  const top=()=>`<aside class="sidebar ${state.menu?'show':''}"><div class="brandline">${brand()}<div class="brandcopy"><b>ceres<span>ventures</span><i>.</i></b><small>BY NOFI LABS · AGUA</small></div></div><div class="side-label">${t('PLATAFORMA','PLATFORM')}</div><nav class="side-nav">${pages.map(p=>`<button class="side-link ${state.view===p[0]?'active':''}" data-action="nav" data-view="${p[0]}">${ico(p[1],19)}<span><b>${p[2]}</b><small>${p[3]}</small></span>${state.view===p[0]?'<i></i>':''}</button>`).join('')}</nav><div class="side-spacer"></div><div class="sidebar-stat"><div class="mini-dot"></div><span>NASA SPACE APPS<br><strong>CHALLENGE 2026</strong></span>${ico('up',15)}</div><div class="side-project"><span class="side-label">POWERED BY</span><div class="nochain"><span class="no-glyph">NØ</span><span>NØFI CHAIN <small>AVALANCHE L1</small></span></div><small>${t('Registros verificables · testnet','Verifiable records · testnet')}</small></div></aside><div class="mobile-overlay ${state.menu?'visible':''}" data-action="closemenu"></div><div class="mainpane"><header class="topbar"><div class="crumbs"><button class="hamburger" data-action="menu" aria-label="Menu">${ico('menu',22)}</button><span>${t('Inteligencia hídrica','Water intelligence')}</span>${ico('chevron',15)}<b>${pages.find(p=>p[0]===state.view)[2]}</b></div><div class="top-actions">${statusPill()}<div class="langs" role="group" aria-label="Language"><button data-action="lang" data-lang="es" class="${state.lang==='es'?'active':''}">ES</button><button data-action="lang" data-lang="en" class="${state.lang==='en'?'active':''}">EN</button></div><span class="avatar">${ico('droplet',17)}</span></div></header><main class="content">`;
  const bottom=()=>`<footer class="footer"><div class="footbrand">${brand()}<b>ceres<span>ventures</span>.</b></div><span>${REAL?t('Herramienta de apoyo, no sustituye asesoría agraria. Clima y satélite: datos reales de la NASA y socios; ubicaciones, rendimientos y precios: ilustrativos.','Decision support, not a substitute for agronomic advice. Climate and satellite: real NASA and partner data; locations, yields and prices: illustrative.'):t('Herramienta de apoyo, no sustituye asesoría agraria. Datos ilustrativos salvo indicación contraria.','Decision support, not a substitute for agronomic advice. Illustrative data unless stated otherwise.')} ${REAL?E(cite('si')):''}</span><small>NASA SPACE APPS 2026 · NOFI LABS</small></footer></main></div>`;
  const farmTabs=()=>`<section class="farmpicker"><div class="tinyheading"><b>${t('PARCELAS EN ESTUDIO','STUDY FARMS')}</b><span>03 ${t('UBICACIONES','LOCATIONS')} ${ico('pin',13)}</span></div><div class="farmtabs">${farms.map((x,i)=>`<button data-action="farm" data-farm="${x.id}" class="farmtab ${state.farm===x.id?'on':''}"><span class="farmnum">0${i+1}</span><span class="farminfo"><strong>${E(l(x.place).split(' · ')[0])}</strong><small>${E(l(x.crop))}</small></span>${ico(state.farm===x.id?'target':'up',17,'tabicon')}</button>`).join('')}</div></section>`;
  const map=()=>{const coords=x=>({left:Math.max(13,Math.min(84,20+((x.lon+71.30)/.65)*63)),top:Math.max(19,Math.min(83,18+((-16.75-x.lat)/.94)*65))});return `<div class="map" role="group" aria-label="${t('Mapa esquemático de parcelas','Schematic farm map')}"><div class="maphalo"></div><svg class="contours" viewBox="0 0 620 430" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><pattern id="m-points" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".8" fill="#83d6d2" opacity=".2"/></pattern></defs><rect width="620" height="430" fill="url(#m-points)"/><g stroke="#529ca1" stroke-width="1" fill="none" opacity=".38">${Array.from({length:11},(_,i)=>`<path d="M-40 ${25+i*35}Q80 ${i*24-10} 145 ${45+i*30}T305 ${70+i*27}Q395 ${110+i*20} 464 ${30+i*31}T660 ${42+i*33}"/>`).join('')}</g><path d="M490 0Q465 65 411 129T292 259T65 460" fill="none" stroke="#79e5df" stroke-width="3" opacity=".35" stroke-dasharray="7 8" class="river"/><g stroke="#85c1c5" opacity=".17" stroke-dasharray="3 6"><path d="M0 142H620M0 284H620M155 0V430M310 0V430M465 0V430"/></g></svg><div class="radar"><div class="radar-sweep"></div></div><span class="map-n">N ↑</span>${farms.map((x,i)=>{const pos=coords(x);return `<button class="pin ${state.farm===x.id?'selected':''} ${pos.left>65?'pin-left':''}" style="left:${pos.left}%;top:${pos.top}%;--i:${i}" data-action="farm" data-farm="${x.id}" aria-label="${E(x.name)}"><span class="pin-wave"></span><span class="pin-core"></span><span class="pin-tag"><b>${E(l(x.place).split(' · ')[0])}</b><small>${num(x.elevation)} m</small></span></button>`}).join('')}<div class="map-footer"><span><i class="mini-dot"></i>${t('3 zonas de estudio','3 study zones')}</span><small>${t('Mapa esquemático · no GIS','Schematic map · not GIS')}</small></div></div>`;};
  const chart=(arr1,arr2,colors=['#28b8bc','#efa96b'],labels=[t('Consumo del cultivo','Crop water use'),t('Referencia','Reference')])=>{
    const W=720,H=222,L=22,R=18,T=18,B=35, vals=[...arr1,...(arr2||[])],max=Math.max(...vals)*1.17||1;
    const path=a=>a.map((v,i)=>`${i?'L':'M'}${(L+i*(W-L-R)/(a.length-1)).toFixed(1)} ${(T+(1-v/max)*(H-T-B)).toFixed(1)}`).join(' ');
    const area=path(arr1)+` L${W-R} ${H-B} L${L} ${H-B} Z`;
    const m=t(['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].join(','),['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].join(',')).split(',');
    return `<div class="chart-head"><div class="chart-leg"><span><i style="background:${colors[0]}"></i>${labels[0]}</span>${arr2?`<span><i style="background:${colors[1]}"></i>${labels[1]}</span>`:''}</div><span class="chart-note">${REAL?t('Serie mensual · NASA POWER 2001–2025','Monthly series · NASA POWER 2001–2025'):t('Serie mensual · datos ilustrativos','Monthly series · illustrative data')}</span></div><svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${E(labels.join(' versus '))}"><defs><linearGradient id="a-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#18b6b5" stop-opacity=".18"/><stop offset="1" stop-color="#18b6b5" stop-opacity="0"/></linearGradient></defs>${[0,.25,.5,.75,1].map(k=>`<line x1="${L}" y1="${T+k*(H-T-B)}" x2="${W-R}" y2="${T+k*(H-T-B)}" stroke="#dfedf0" stroke-dasharray="4 6"/>`).join('')}<path d="${area}" fill="url(#a-fill)"/>${arr2?`<path d="${path(arr2)}" fill="none" stroke="${colors[1]}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" opacity=".85" class="draw-line"/>`:''}<path d="${path(arr1)}" fill="none" stroke="${colors[0]}" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round" class="draw-line"/>${arr1.map((v,i)=>`<circle cx="${L+i*(W-L-R)/(arr1.length-1)}" cy="${T+(1-v/max)*(H-T-B)}" r="2.8" fill="#fff" stroke="${colors[0]}" stroke-width="1.8"/>`).join('')}${m.map((mon,i)=>`<text x="${L+i*(W-L-R)/11}" y="${H-10}" text-anchor="middle" font-size="12" fill="#8aa6ae">${mon}</text>`).join('')}</svg>`;
  };
  const metrics=()=>{let x=f(),s=x.strategies.find(y=>y.recommended)||x.strategies[1],pred=Math.max(0,Math.round(savings(x,s)*10)/10),val=Math.round(annual(x));const data=[[REAL?t('Necesidad de agua del cultivo (ETc)','Crop water need (ETc)'):t('Consumo anual estimado','Estimated annual consumption'),num(val)+(x.mode==='m3'?' m³/ha':' mm'),REAL?t('ET₀ NASA POWER × Kc FAO-56 (modelada)','NASA POWER ET₀ × FAO-56 Kc (modeled)'):t('Evapotranspiración ilustrativa','Illustrative evapotranspiration'),'droplet','aqua'],[t('Ahorro potencial','Potential savings'),pct(pred)+'%',REAL?t('Agua aplicada, recomendada vs hoy (motor SI)','Applied water, recommended vs today (SI engine)'):t('Frente al cultivo actual','Versus current crop'),'trend','mint'],[t('Superficie de estudio','Study area'),num(x.ha,1)+' ha',t('Parcela seleccionada','Selected farm'),'target','lilac'],[t('Alternativas','Alternatives'),'03',t('Con evidencia y riesgos','With evidence and risks'),'layers','peach']];return `<div class="metric-grid">${data.map((d,i)=>`<article class="metric ${d[4]}" style="--delay:${i*95}ms"><div class="metric-label"><span>${d[0]}</span><i>${ico(d[3],18)}</i></div><strong>${d[1]}</strong><small><span></span>${d[2]}</small></article>`).join('')}</div>`;};
  const sectionHeader=(num,title,desc,button='',action='')=>`<div class="section-header"><div><span class="eyeline">${num}</span><h2>${title}</h2><p>${desc}</p></div>${button?`<button data-action="${action}" class="text-btn">${button}${ico('up',16)}</button>`:''}</div>`;
  const waterCard=()=>{const x=f(),refName=l(x.refLabel);return `<article class="card chart-card"><div class="card-header"><div><span class="eyeline">${REAL?'NASA POWER · FAO-56':'NASA ECOSTRESS / POWER'}</span><h3>${REAL?t('Necesidad de agua del cultivo','Crop water need'):t('Consumo hídrico del cultivo','Crop water consumption')}</h3><p>${REAL?t('ETc mensual del cultivo frente a la ET₀ de referencia, 2001–2025.','Monthly crop ETc versus reference ET₀, 2001–2025.'):t('Comparación mensual de evapotranspiración.','Monthly evapotranspiration comparison.')}</p></div><button class="round-action" data-action="modal" data-modal="water" title="Sources">${ico('info',18)}</button></div><div class="chart-stat"><span>${REAL?t('ETc MEDIA DIARIA (MODELADA)','MEAN DAILY ETc (MODELED)'):t('MEDIA ILUSTRATIVA DIARIA','ILLUSTRATIVE DAILY AVERAGE')}</span><strong>${num(x.et.reduce((a,b)=>a+b,0)/12,1)} <small>mm/día</small></strong></div>${chart(x.et,x.ref,['#0fabb5','#efa46d'],[x.etLabel?l(x.etLabel):t('Cultivo','Crop'),refName])}${REAL?`<p class="cite">${E(cite('power'))} · ${E(cite('kc'))}</p>`:''}<div class="chart-bottom"><span>${ico('shield',15)} ${REAL?t('ETc modelada con ET₀ real; ECOSTRESS del punto en Datos y evidencia','Modeled ETc from real ET₀; point ECOSTRESS in Data & evidence'):t('Estimaciones, no mediciones verificadas','Estimates, not verified field measurements')}</span><button data-action="nav" data-view="evidence">${t('Ver evidencia','See evidence')}${ico('arrow',15)}</button></div></article>`;};
  const exampleBasinCard=()=>`<article class="card basin-card"><div class="card-header"><div><span class="eyeline">OPERA DSWx / GPM IMERG</span><h3>${t('Señales de la cuenca','Watershed signals')}</h3></div><button class="round-action" data-action="modal" data-modal="basin">${ico('info',18)}</button></div><span class="smallmuted">${t('Pasto Grande · cobertura estimada','Pasto Grande · estimated coverage')}</span><div class="basin-big"><strong>${basin.reservoirPct.at(-1)}<small>%</small></strong><span>${ico('activity',16)} ${t('Índice ilustrativo','Illustrative index')}</span></div><div class="minibars">${basin.reservoirPct.map((v,i)=>`<i style="height:${Math.max(12,v)}%;--delay:${i*20}ms"></i>`).join('')}</div><div class="basin-footer"><span>${t('Tendencia reciente','Recent trend')}</span><b>${t('Ejemplo, no nivel reportado','Example, not official level')}</b></div></article>`;
  const rainCard=()=>{const x=f(),rr=x.rainRange||{},m=x.rainMonthly||[],mx=Math.max(...m,1),mon=t('E F M A M J J A S O N D','J F M A M J J A S O N D').split(' ');return `<article class="card basin-card"><div class="card-header"><div><span class="eyeline">CHIRPS v3 · NASA POWER · ERA5</span><h3>${t('Lluvia en la parcela','Rain at the farm')}</h3></div><button class="round-action" data-action="modal" data-modal="basin">${ico('info',18)}</button></div><span class="smallmuted">${t('Promedio anual 1991–2020 (CHIRPS)','Annual mean 1991–2020 (CHIRPS)')}</span><div class="basin-big"><strong>${num(x.rainYear)}<small> mm</small></strong><span>${ico('activity',16)} ${t('Rango entre fuentes','Range across sources')}: ${rr.power!=null?'POWER '+num(rr.power):''}${rr.era5!=null?' · ERA5 '+num(rr.era5):''} mm</span></div><div class="minibars" role="img" aria-label="${t('Lluvia mensual CHIRPS','Monthly CHIRPS rain')}">${m.map((v,i)=>`<i style="height:${Math.max(4,v/mx*100)}%;--delay:${i*20}ms" title="${mon[i]} · ${num(v,1)} mm"></i>`).join('')}</div><div class="basin-footer"><span>${t('Señal regional (0,05°), no medición de la parcela','Regional signal (0.05°), not a field measurement')}</span><b>${x.mode==='m3'?t('El riego viene del canal','Water comes from the canal'):t('Secano: vive de esta lluvia','Rainfed: lives on this rain')}</b></div><p class="cite">${E(cite('chirps'))}</p></article>`;};
  const basinCard=()=>REAL?rainCard():exampleBasinCard();
  const pointCard=()=>{const x=f(),e=x.real?.ecostress||{},nd=x.real?.ndvi||{},cur=x.strategies.find(s=>s.current);if(!e.etMonthly)return '';const ok=e.representative!==false;return `<article class="card chart-card point-card"><div class="card-header"><div><span class="eyeline">NASA ECOSTRESS · MODIS</span><h3>${t('Lo que ve el satélite en el punto del mapa','What the satellite sees at the map point')}</h3><p>${E(l(cur?.evidence))}</p></div><span class="inner-tag ${ok?'':'warn-tag'}">${ok?t('PUNTO REPRESENTATIVO','REPRESENTATIVE POINT'):t('PUNTO FUERA DE LA CHACRA','POINT OFF THE FIELD')}</span></div>${chart(e.etMonthly.map(v=>v??0),x.et,['#7b6cf6','#0fabb5'],[t('ECOSTRESS observado (mm/día)','ECOSTRESS observed (mm/day)'),x.etLabel?l(x.etLabel):t('ETc','ETc')])}<p class="cite">${t('Pasadas válidas por mes','Valid overpasses per month')}: ${(e.overpassesMonthly||[]).join(' · ')} · NDVI ${E(nd.source||'')}: ${(nd.monthly||[]).map(v=>num(v,2)).join(' · ')}</p><p class="cite">${E(cite('ecostress'))} · ${E(cite('modis'))}</p></article>`;};
  const ceresCard=()=>{const x=f(),s=x.strategies.find(y=>y.recommended)||x.strategies[1];return `<article class="insight-card"><div class="insight-label">${ico('spark',15)} CERES · ${t('VOZ DE LA SI','VOICE OF THE SI')}</div><h3>${t('Pequeños cambios. Un gran impacto.','Small changes. Real impact.')}</h3><p>${E(l(x.ceres))}</p><div class="insight-bottom"><div><small>${t('Ahorro proyectado','Projected savings')}</small><strong>${pct(Math.max(0,savings(x,s)))==='0'?'':'−'}${pct(Math.max(0,savings(x,s)))}%</strong></div><button data-action="ceres-open" aria-label="${t('Hablar con CERES','Talk to CERES')}">${ico('spark',18)}</button><button data-action="nav" data-view="intel" aria-label="${t('Inteligencia SI','SI intelligence')}">${ico('arrow',18)}</button></div></article>`;};
  const recCards=()=>{const x=f();return `<div class="recommend-grid">${x.strategies.filter(s=>!s.current).map((s,i)=>`<button class="recommend-card" data-action="choose" data-strategy="${s.id}" style="--delay:${i*95}ms"><div class="rec-top"><span>0${i+1}</span>${s.recommended?`<b>${t('SUGERIDA','SUGGESTED')}</b>`:''}</div><strong>${E(l(s.name))}</strong><div class="rec-bot"><span>${pct(savings(x,s))==='0'?'':savings(x,s)>0?'−':'+'}${pct(savings(x,s))}% <small>${t('agua','water')}</small></span><i>${ico('up',18)}</i></div></button>`).join('')}</div>`;};
  const potential=()=>{const x=f(),r=(window.AGUA_SI_RECORDS||{})[x.id]||[],last=r[r.length-1];return `<div class="reward-promo"><span class="reward-promo-icon">${ico('shield',24)}</span><div><span>${t('TU REGISTRO VERIFICABLE DE AGUA','YOUR VERIFIABLE WATER RECORD')}</span><strong>${last&&!last.placeholder?t('Guardado ✔','Saved ✔'):t('En preparación','Being prepared')}</strong><p>${last&&!last.placeholder?t('Cualquiera puede comprobar que estos datos de la NASA no se cambiaron. Para ti es gratis.','Anyone can check these NASA data were not changed. Free for you.'):t('Datos de ejemplo hasta tener las mediciones reales de la NASA. Para ti es gratis.','Example data until the real NASA measurements arrive. Free for you.')}</p></div><button data-action="nav" data-view="records" aria-label="${t('Ver registro','View record')}">${ico('up',20)}</button></div>`;};
  const hero=()=>`<section class="hero enter"><div class="hero-copy"><span class="hero-eyebrow"><i></i> NASA SPACE APPS CHALLENGE 2026</span><h1>${t('El futuro del agua','The future of water')}<em>${t('se cultiva hoy.','starts in the field.')}</em></h1><p>${t('Entiende lo que consume cada parcela, compara estrategias de cultivo y guarda un registro de tu agua que nadie puede alterar.','See how much water each field uses, compare crop strategies, and keep a water record nobody can tamper with.')}</p><div class="hero-buttons"><button class="primary-btn" data-action="nav" data-view="strategies">${t('Comparar estrategias','Compare strategies')}${ico('arrow',17)}</button><button class="ghost-btn" data-action="scrollfarms">${ico('pin',16)}${t('Explorar parcelas','Explore farms')}</button></div><div class="hero-foot"><span>✧ NASA ECOSTRESS</span><i></i><span>HLS · POWER · OPERA</span></div></div>${map()}</section>`;
  const overview=()=>`${hero()}${farmTabs()}<div class="snapshot"><div><span class="eyeline"><i class="green-dot"></i>${t('PARCELA SELECCIONADA','SELECTED FARM')}</span><h2>${E(f().name)}</h2></div><div class="snapshot-loc">${ico('pin',15)}${E(l(f().place))} · ${num(f().elevation)} m</div></div>${metrics()}${sectionHeader('01 / '+t('OBSERVATORIO','OBSERVATORY'),t('Tu parcela, en perspectiva','Your farm in perspective'),t('Consumo, condiciones locales y señales regionales.','Water use, local conditions and regional signals.'))}<div class="dashboard-grid"><div>${waterCard()}</div><div class="stack">${ceresCard()}${basinCard()}</div></div>${sectionHeader('02 / FIELD SHIFT',t('Elige un camino más inteligente','Choose a smarter path'),t('Tres alternativas para ahorrar agua, con beneficios y riesgos.','Three alternatives for saving water, with benefits and risks.'),t('Ver todas','View all'),'nav-strategies')}${recCards()}${potential()}${disclaimer()}`;
  const disclaimer=()=>`<div class="disclaimer">${ico('info',17)}${REAL?t('Clima, ET₀, lluvia, ECOSTRESS y NDVI son datos reales (NASA POWER, CHIRPS, ERA5, ECOSTRESS, MODIS). Los puntos de las parcelas, rendimientos, precios y la entrega del canal son ilustrativos; confirmar en campo.','Climate, ET₀, rain, ECOSTRESS and NDVI are real data (NASA POWER, CHIRPS, ERA5, ECOSTRESS, MODIS). Farm points, yields, prices and canal delivery are illustrative; confirm in the field.'):t('Los valores de las parcelas son ilustrativos hasta conectar las mediciones reales de la NASA y verificar en campo.','Farm values are illustrative until real NASA measurements and field checks are connected.')}</div>`;
  const heading=(small,title,desc)=>`<div class="page-title enter"><span class="eyeline"><i class="green-dot"></i>${small} <span class="slash">/</span> ${t('MODO DEMOSTRACIÓN','DEMO MODE')}</span><h1>${title}</h1><p>${desc}</p></div>`;
  const strategyOptions=(showAll=true)=>`<div class="strategy-options">${f().strategies.map((s,i)=>`<button data-action="strategy" data-strategy="${s.id}" class="strategy-option ${state.strategy[f().id]===s.id?'picked':''}"><span class="opt-num">0${i+1}</span><div><b>${E(l(s.name))}</b><small>${s.current?t('PRÁCTICA ACTUAL','CURRENT PRACTICE'):s.recommended?t('ALTERNATIVA SUGERIDA','SUGGESTED ALTERNATIVE'):t('ALTERNATIVA','ALTERNATIVE')}</small></div><span class="strategy-radio"></span></button>`).join('')}</div>`;
  const compare=()=>{const x=f(),s=ss(),b=base(x),sv=savings(x,s),v=x.mode==='m3'?'m³/ha/año':'mm/año';return `<article class="card compare-card"><div class="card-header"><div><span class="eyeline">${t('COMPARACIÓN DE ESCENARIOS','SCENARIO COMPARISON')}</span><h3>${E(l(s.name))}</h3></div>${s.recommended?`<span class="recommended-tag">${ico('spark',14)} ${t('SUGERIDA','SUGGESTED')}</span>`:''}</div><div class="compare-top"><div><small>${t('PRÁCTICA ACTUAL','CURRENT PRACTICE')}</small><strong>${num(b)}</strong><span>${v}</span></div><div class="compare-arrow">${ico('arrow',24)}</div><div><small>${t('ESTRATEGIA ELEGIDA','SELECTED STRATEGY')}</small><strong>${num(s.water)}</strong><span>${v}</span></div></div><div class="saving-row"><span>${t('Diferencia de agua proyectada','Projected water difference')}</span><b class="${sv>=0?'positive':'negative'}">${pct(sv)==='0'?'':sv>=0?'−':'+'}${pct(sv)}%</b></div><div class="progress-track"><span style="width:${Math.min(100,Math.max(2,s.water/b*100))}%"></span></div><div class="score-grid"><div>${ico('leaf',18)}<small>${t('SALUD DEL SUELO','SOIL HEALTH')}</small><strong>${s.soil}/100</strong></div><div>${ico('trend',18)}<small>${t('POTENCIAL DE INGRESOS','INCOME POTENTIAL')}</small><strong>${'●'.repeat(s.income)}<span class="empty-dots">${'○'.repeat(5-s.income)}</span></strong></div><div>${ico('shield',18)}<small>${t('RIESGO PRINCIPAL','MAIN RISK')}</small><strong class="risktext">${E(l(s.mainRisk))}</strong></div></div><div class="four-insights"><div class="explain good-box"><span>${ico('spark',16)} ${t('POR QUÉ','WHY')}</span><p>${E(l(s.why))}</p></div><div class="explain"><span>${ico('satellite',16)} ${t('EVIDENCIA','EVIDENCE')}</span><p>${E(l(s.evidence))}</p></div><div class="explain"><span>${ico('info',16)} ${t('VACÍOS DE DATOS','DATA GAPS')}</span><p>${E(l(s.gaps))}</p></div><div class="explain"><span>${ico('shield',16)} ${t('RIESGOS','RISKS')}</span><p>${E(l(s.risks))}</p></div></div><div class="compare-footer"><span>${ico('info',16)} ${t('Revisar con Agencia Agraria / INIA antes de implementar.','Review with local agrarian agency / INIA before implementation.')}</span><button class="primary-btn small" data-action="nav" data-view="records">${t('Ver registro verificable','See verifiable record')}${ico('arrow',16)}</button></div></article>`;};
  const strategies=()=>`${heading('FIELD SHIFT / '+t('DECISIONES','DECISIONS'),t('Explora estrategias','Explore strategies'),t('Compara cuatro alternativas para esta parcela, con agua, suelo, ingresos, evidencia y riesgos.','Compare four options for this field, including water, soil, income, evidence and risks.'))}${farmTabs()}<div class="inner-farm"><span>${ico('leaf',21)}</span><div><b>${E(f().name)}</b><small>${E(l(f().crop))} · ${f().ha} ha · ${E(l(f().place))}</small></div><span class="inner-tag">${t('DATOS DEMO','DEMO DATA')}</span></div><div class="strategy-layout"><div><div class="section-header compact"><div><span class="eyeline">01 / ${t('ESCOGE UNA OPCIÓN','CHOOSE AN OPTION')}</span><h2>${t('Cuatro caminos, una decisión','Four paths, one decision')}</h2></div></div>${strategyOptions()}<div class="strategy-help">${ico('info',17)}${t('Las cifras son escenarios educativos, no predicciones de rendimiento o ahorro medido.','These are educational scenarios, not verified predictions of yield or savings.')}</div></div><div>${compare()}</div></div>${potential()}${disclaimer()}`;
  const sources=[['ECOSTRESS','Evapotranspiración / ESI','Evapotranspiration / ESI','70 m',t('Campo · sobrepasos irregulares','Field · irregular overpasses'),'field'],['HLS','NDVI · vegetación','NDVI · crop vegetation','30 m',t('Campo · comprobar cultivo vivo','Field · living crop check'),'field'],['NASA POWER','ET₀ · clima','ET₀ · climate','~50 km',t('Regional · no parcela','Regional · not field'),'regional'],['GPM IMERG','Precipitación','Precipitation','~10 km',t('Regional · cabeceras','Regional · headwaters'),'regional'],['OPERA DSWx','Lámina de agua','Water surface','var.',t('Embalse · verificación local','Reservoir · local validation'),'regional'],['SMAP / GRACE-FO','Humedad / almacenamiento','Moisture / water storage','9 km / cuenca',t('Regional · baja resolución','Regional · coarse resolution'),'regional']];
  const evidence=()=>`${heading('EARTH OBSERVATION / NASA',t('Inteligencia satelital','Satellite intelligence'),t('De la órbita a la parcela: descubre qué se mide, qué se estima y dónde están los límites.','From orbit to field: what is measured, what is estimated, and where the limits are.'))}${farmTabs()}<div class="steps-overview">${[['satellite','01',t('Observamos','Observe'),t('Satélites evalúan evapotranspiración y vegetación.','Satellites estimate evapotranspiration and vegetation.')],['layers','02',t('Comparamos','Compare'),t('Exploramos cuatro estrategias posibles de cultivo.','Explore four possible growing strategies.')],['shield','03',t('Verificamos','Verify'),t('Cada mes, la evidencia queda guardada con una huella que nadie puede cambiar.','Each month the evidence is saved with a fingerprint nobody can change.')]].map(x=>`<div class="evidence-step"><span>${ico(x[0],23)}</span><small>${x[1]}</small><strong>${x[2]}</strong><p>${x[3]}</p></div>`).join('')}</div>${sectionHeader('01 / DATA SOURCES',t('Qué dice la NASA','What NASA tells us'),t('Cada fuente tiene escala, frecuencia y límites distintos.','Each source has different scales, frequency and limitations.'))}<div class="source-grid">${sources.map(s=>`<article class="source-card"><div class="src-top"><span>${ico('satellite',18)}</span><i class="${s[5]==='field'?'field-tag':'regional-tag'}">${s[5]==='field'?t('PARCELA','FIELD'):t('REGIONAL','REGIONAL')}</i></div><h3>${s[0]}</h3><p>${state.lang==='es'?s[1]:s[2]}</p><div><b>${s[3]}</b><span>${s[4]}</span></div></article>`).join('')}</div>${sectionHeader('02 / '+t('VALIDACIÓN','VALIDATION'),t('Datos y contexto','Data and context'),t('Series ilustrativas y situación hídrica regional.','Illustrative series and regional water conditions.'))}<div class="dashboard-grid"><div>${waterCard()}</div><div>${basinCard()}</div></div>${REAL?pointCard():''}<div class="limitation"><span>${ico('shield',21)}</span><div><h3>${t('Transparencia primero.','Transparency first.')}</h3><p>${t('ECOSTRESS estima agua consumida por las plantas, no agua entregada por canales. POWER, CHIRPS, SMAP y GRACE-FO son regionales; no prueban ahorro parcela por parcela. '+(REAL?'En Samegua y El Algarrobal el punto del mapa probablemente cae fuera de la chacra (NDVI MODIS 0,15–0,25 y ECOSTRESS bajo): hay que ubicar la chacra real antes de anclar registros.':'Las cifras en esta demo son ejemplos.'),'ECOSTRESS estimates water consumed by plants, not delivered irrigation. POWER, CHIRPS, SMAP and GRACE-FO are regional and cannot prove plot-level savings. '+(REAL?'At Samegua and El Algarrobal the map point probably falls off the field (MODIS NDVI 0.15–0.25, low ECOSTRESS): locate the real field before attesting records.':'Values in this demo are examples.'))}</p></div></div>${sectionHeader('03 / MOQUEGUA',t('Por qué importa aquí','Why it matters here'),t('Contexto regional con referencias públicas.','Regional context with public references.'))}<div class="facts-grid">${facts.map(item=>`<a class="fact-card" href="${E(item.href)}" target="_blank" rel="noopener noreferrer"><strong>${E(item.value)}</strong><p>${E(state.lang==='es'?item.es:item.en)}</p><small>${E(item.src)} ${ico('up',14)}</small></a>`).join('')}</div>${disclaimer()}`;
  const checkList=()=>`<div class="checklist"><div class="check-title">${ico('shield',18)} ${t('Reglas de verificación (ejemplo)','Verification rules (example)')}</div>${f().checks.map(c=>`<div class="checkrow"><span class="check-circle ${c.result==='ok'?'ok':'part'}">${ico(c.result==='ok'?'check':'info',14)}</span><span><strong>${E(l(c.label))}</strong><small>${E(l(c.detail))}</small></span>${c.weight>0?`<b>${c.result==='ok'?c.weight:c.got||0}/${c.weight}</b>`:''}</div>`).join('')}</div>`;
  const records=()=>`${heading('NØFI L1 / X402',t('Registro verificable','Verifiable record'),t('Cada mes, los datos de la NASA de tu parcela quedan guardados con una huella digital. Si alguien cambia un número, la huella ya no coincide.','Every month your field\'s NASA data are saved with a digital fingerprint. Change one number and the fingerprint no longer matches.'))}${farmTabs()}<div id="records-root"></div>${disclaimer()}`;
  const modal=()=>{if(!state.modal)return '';const md=REAL?{water:[t('De dónde salen estos números','Where these numbers come from'),t('La ET₀ (lo que el clima le pide al cultivo) se calcula con FAO-56 Penman-Monteith a partir de NASA POWER diario 2001–2025, y coincide con ERA5 dentro de ±5 %. La ETc del cultivo es ET₀ × Kc de FAO-56; el agua aplicada divide la necesidad por la eficiencia del riego (gravedad 60 %, goteo 90 %). ECOSTRESS (70 m) se muestra en Datos y evidencia: en Samegua y El Algarrobal el punto del mapa probablemente no está sobre la chacra, así que no se usa como medición de la parcela.','ET₀ (what the climate asks of the crop) is FAO-56 Penman-Monteith from NASA POWER daily 2001–2025, within ±5 % of ERA5. Crop ETc is ET₀ × FAO-56 Kc; applied water divides the need by irrigation efficiency (surface 60 %, drip 90 %). ECOSTRESS (70 m) is shown in Data & evidence: at Samegua and El Algarrobal the map point is probably not on the field, so it is not used as the field measurement.')],basin:[t('Lluvia: tres fuentes que no coinciden','Rain: three sources that disagree'),t('CHIRPS v3 (satélite + estaciones, 0,05°) es la referencia; NASA POWER y ERA5 dan el rango. En la sierra difieren mucho (Carumas: CHIRPS ~230 mm, POWER ~124, ERA5 ~775), por eso el motor simula las tres. GPM IMERG está pendiente: falta aprobar el acceso de GES DISC. El nivel de Pasto Grande no se muestra porque no se descargó una serie real (OPERA DSWx pendiente).','CHIRPS v3 (satellite + stations, 0.05°) is the reference; NASA POWER and ERA5 give the range. In the highlands they differ a lot (Carumas: CHIRPS ~230 mm, POWER ~124, ERA5 ~775), so the engine simulates all three. GPM IMERG is pending GES DISC access approval. Pasto Grande levels are not shown because no real series was pulled (OPERA DSWx pending).')]}[state.modal]||[]:{water:[t('Cómo interpretamos el consumo hídrico','Understanding water use'),t('ECOSTRESS ofrece estimaciones de evapotranspiración. Los datos por parcela de esta demo son ilustrativos; la resolución de 70 m y el paso irregular del satélite exigen analizar cobertura temporal, nubes y límites espaciales. NASA POWER y otros productos regionales no sustituyen medición en campo.','ECOSTRESS estimates evapotranspiration. Plot values here are illustrative; its ~70 m resolution and irregular overpasses require coverage and quality checks. Regional NASA POWER and other products do not replace ground measurements.')],basin:[t('Señales regionales de agua','Regional water signals'),t('Las barras de almacenamiento de Pasto Grande de esta demo son ejemplos y no corresponden a un nivel reportado oficialmente. OPERA DSWx, GPM IMERG y GRACE-FO informan sobre superficie del embalse, lluvia y almacenamiento regional a escalas diferentes.','Pasto Grande reservoir bars in this demo are example values and are not officially reported levels. OPERA DSWx, GPM IMERG and GRACE-FO show water surface, rain and regional storage at different scales.')]}[state.modal]||[];return `<div class="modal-back" data-action="closemodal"><section class="modal" role="dialog" aria-modal="true" aria-label="${E(md[0])}"><div class="modal-top">${ico('satellite',23)}<button data-action="closemodal" aria-label="Close">${ico('close',21)}</button></div><h2>${E(md[0])}</h2><p>${E(md[1])}</p><div class="modal-note">${ico('info',18)} ${t('Revisar resultados con la Agencia Agraria / INIA.','Review results with the agrarian agency / INIA.')}</div><button class="primary-btn" data-action="closemodal">${t('Entendido','Got it')}${ico('check',17)}</button></section></div>`;};
  const intel=()=>`${heading('FIELD SHIFT / SI',t('Inteligencia SI','SI intelligence'),t('Compara rotaciones, revela compensaciones, entiende el riesgo y ve la incertidumbre. CERES te lo explica.','Compare rotations, reveal trade-offs, understand risk and see the uncertainty. CERES explains it.'))}${farmTabs()}<div id="si-root"></div>${disclaimer()}`;
  const app=()=>`${top()}${({overview,strategies,intel,evidence,records})[state.view]()}${bottom()}${modal()}`;
  function render(preserve=true){const sc=window.scrollY;document.documentElement.lang=state.lang;document.getElementById('app').innerHTML=app();document.title=`CERES Ventures — ${pages.find(p=>p[0]===state.view)?.[2]||'Dashboard'}`;try{window.AguaClara?.afterRender?.({view:state.view,farm:state.farm,lang:state.lang,strategy:state.strategy[state.farm]});}catch(e){console.error(e);}if(preserve)window.scrollTo(0,sc);}
  document.addEventListener('click',event=>{const el=event.target.closest('[data-action]');if(!el)return;const a=el.dataset.action;
    if(a==='nav'||a==='nav-strategies'){state.view=a==='nav-strategies'?'strategies':el.dataset.view;state.menu=false;state.notice=false;render(false);window.scrollTo({top:0,behavior:'instant'});return;}
    if(a==='farm'){state.farm=el.dataset.farm;state.notice=false;render();return;}
    if(a==='lang'){state.lang=el.dataset.lang;try{localStorage.setItem('agua-lang',state.lang)}catch(e){}render();return;}
    if(a==='menu'){state.menu=!state.menu;render();return;}
    if(a==='closemenu'){state.menu=false;render();return;}
    if(a==='strategy'){state.strategy[state.farm]=el.dataset.strategy;state.stage[state.farm]=0;state.notice=false;render();return;}
    if(a==='choose'){state.strategy[state.farm]=el.dataset.strategy;state.stage[state.farm]=0;state.view='strategies';state.notice=false;render(false);window.scrollTo(0,0);return;}
    if(a==='advance'){const x=f(),s=ss();if(!eligible(x,s))return;state.stage[x.id]=Math.min(3,state.stage[x.id]+1);state.notice=false;render();return;}
    if(a==='reset'){state.stage[state.farm]=0;state.notice=false;render();return;}
    if(a==='cashout'){state.notice=true;render();return;}
    if(a==='scrollfarms'){document.querySelector('.farmpicker')?.scrollIntoView({behavior:'smooth',block:'center'});return;}
    if(a==='modal'){state.modal=el.dataset.modal;render();return;}
    if(a==='closemodal'){state.modal='';render();return;}
  });
  window.AguaClara=Object.assign(window.AguaClara||{},{go:(view,farm)=>{if(farm)state.farm=farm;state.view=view;state.menu=false;render(false);window.scrollTo(0,0);}});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&(state.modal||state.menu)){state.modal='';state.menu=false;render();}});
  render(false);
})();
