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
      "sofia": {
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
            "es": "HLS muestra el suelo desnudo unos 7 meses al año.",
            "en": "HLS shows bare soil about 7 months a year."
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
            "es": "HLS · NDVI > 0.4 en ene–feb",
            "en": "HLS · NDVI > 0.4 in Jan–Feb"
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
            "es": "HLS · NDVI > 0.25 de may a sep",
            "en": "HLS · NDVI > 0.25 May–Sep"
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
            "es": "SMAP + ECOSTRESS · regional, baja confianza",
            "en": "SMAP + ECOSTRESS · regional, low confidence"
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
        "es": "Mediana del valle",
        "en": "Valley median"
      },
      "rainYear": 15,
      "tminCold": 5,
      "sofia": {
        "es": "Tu alfalfa consume unos 17 mil m³ por hectárea al año, más que la mediana del valle. Casi no llueve aquí: todo sale del canal de Pasto Grande. Te muestro rotaciones que usan menos agua sin dejar la chacra vacía.",
        "en": "Your alfalfa uses about 17,000 m³ per hectare a year, more than the valley median. It barely rains here: all of it comes from the Pasto Grande canal. Here are rotations that use less water without leaving the field empty."
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
            "es": "ECOSTRESS: el consumo más alto de las tres parcelas.",
            "en": "ECOSTRESS: highest use of the three plots."
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
            "es": "HLS · NDVI > 0.4 — ahorrar abandonando la chacra no paga",
            "en": "HLS · NDVI > 0.4 — saving by abandoning the field never pays"
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
            "es": "HLS · fenología distinta a la alfalfa",
            "en": "HLS · phenology differs from alfalfa"
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
            "es": "ECOSTRESS · campaña vs línea base",
            "en": "ECOSTRESS · season vs baseline"
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
        "es": "Mediana del valle",
        "en": "Valley median"
      },
      "rainYear": 5,
      "tminCold": 12,
      "sofia": {
        "es": "El olivo no se rota, pero sí se puede regar distinto. ECOSTRESS muestra que tu olivar consume más que el promedio del valle en verano. Te muestro tres estrategias, incluida una cobertura que cuida el suelo pero gasta algo más de agua.",
        "en": "Olive trees aren't rotated, but they can be irrigated differently. ECOSTRESS shows your grove uses more than the valley average in summer. Here are three strategies, including a cover crop that protects soil but uses a bit more water."
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
            "es": "ECOSTRESS: consumo sobre la mediana del valle de dic a mar.",
            "en": "ECOSTRESS: use above valley median Dec–Mar."
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
            "es": "HLS · NDVI estable — secar el olivar no paga",
            "en": "HLS · NDVI stable — drying the grove never pays"
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
            "es": "ECOSTRESS ESI · rango normal",
            "en": "ECOSTRESS ESI · normal range"
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
            "es": "ECOSTRESS · campaña vs línea base",
            "en": "ECOSTRESS · season vs baseline"
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
      "es": "perdidos en la sequía de 2016; murió más de la mitad del olivar de El Algarrobal.",
      "en": "lost to the 2016 drought; over half of El Algarrobal's olives died.",
      "src": "ProActivo",
      "href": "https://proactivo.com.pe/sequia-en-el-sur-moquegua-pierde-21-millones-de-soles-por-falta-de-agua/"
    },
    {
      "value": "700,000 m³",
      "es": "de recarga en la sierra con 30 qochas (Fondo Sierra Azul, 2026).",
      "en": "of highland recharge from 30 qochas (Fondo Sierra Azul, 2026).",
      "src": "Agraria",
      "href": "https://agraria.pe/noticias/moquegua-gobierno-asegura-mas-de-700-mil-m-de-agua-con-30-qo-42405"
    },
    {
      "value": "6.8 MMC/año",
      "es": "comprometidos a la agricultura desde Vizcachas (28 → 60 MMC).",
      "en": "committed to farmland from Vizcachas (28 → 60 MMC).",
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
  const annual=(x)=>x.et.reduce((a,b)=>a+b,0)*30*(x.mode==='m3'?10:1);
  const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ico=(name,size=18,cls='')=>{
    const p={dashboard:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',layers:'<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',satellite:'<path d="m13 7 4 4-6 6-4-4zM7 7l3-3 4 4-3 3M14 14l4 4-3 3-4-4M3 14a7 7 0 0 0 7 7M3 9A12 12 0 0 0 15 21"/>',wallet:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 9h18M16 16h2"/>',droplet:'<path d="M12 2C8 8 5 11 5 15a7 7 0 0 0 14 0c0-4-3-7-7-13Z"/>',arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',up:'<path d="M7 17 17 7M9 7h8v8"/>',check:'<path d="m5 12 4 4L19 6"/>',shield:'<path d="m12 2 9 4v6c0 5-4 8-9 10-5-2-9-5-9-10V6l9-4Z"/><path d="m8 12 3 3 5-6"/>',pin:'<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',cloud:'<path d="M20 16a4 4 0 0 0-4-4h-1a6 6 0 0 0-12 1 4 4 0 0 0 1 8h13a4 4 0 0 0 3-5Z"/>',trend:'<path d="m3 17 7-7 4 4 7-7M15 7h6v6"/>',spark:'<path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2Z"/>',activity:'<path d="M3 12h4l3-7 4 14 3-7h4"/>',leaf:'<path d="M20 4c-10-1-16 2-16 10a6 6 0 0 0 6 6c8 0 11-8 10-16ZM5 19l11-11"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/>',close:'<path d="M5 5 19 19M19 5 5 19"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',external:'<path d="M13 5h6v6M19 5l-9 9"/><path d="M19 13v6H5V5h6"/>',chevron:'<path d="m7 10 5 5 5-5"/>',globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18M12 3c-5 5-5 13 0 18"/>',target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',refresh:'<path d="M20 10a8 8 0 1 0-2 7M20 3v7h-7"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>'};
    return `<svg class="i ${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p[name]||p.droplet}</svg>`;
  };
  const brand=()=>`<span class="brand-glyph"><svg viewBox="0 0 44 44" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M22 5C16 14 9 22 9 28a13 13 0 0 0 26 0c0-6-7-14-13-23Z"/><path d="M14 28c2.5-3 5.5-3.2 8.4 0 2.6 3 5.5 3 8 0" stroke-linecap="round"/></svg></span>`;
  const pages=[['overview','dashboard',t('Resumen general','Overview'),t('Tu centro de control','Your control center')],['strategies','layers',t('Estrategias','Strategies'),t('Compara alternativas','Compare alternatives')],['evidence','satellite',t('Datos y evidencia','Data & evidence'),t('NASA y la cuenca','NASA & watershed')],['rewards','wallet',t('Recompensas','Rewards'),t('Simula incentivos','Simulate rewards')]];
  const statusPill=()=>`<span class="pill-demo"><span class="pulse"></span>${t('DATOS DE EJEMPLO','EXAMPLE DATA')}</span>`;
  const top=()=>`<aside class="sidebar ${state.menu?'show':''}"><div class="brandline">${brand()}<div class="brandcopy"><b>agua<span>clara</span><i>.</i></b><small>INTELIGENCIA HÍDRICA</small></div></div><div class="side-label">${t('PLATAFORMA','PLATFORM')}</div><nav class="side-nav">${pages.map(p=>`<button class="side-link ${state.view===p[0]?'active':''}" data-action="nav" data-view="${p[0]}">${ico(p[1],19)}<span><b>${p[2]}</b><small>${p[3]}</small></span>${state.view===p[0]?'<i></i>':''}</button>`).join('')}</nav><div class="side-spacer"></div><div class="sidebar-stat"><div class="mini-dot"></div><span>NASA SPACE APPS<br><strong>CHALLENGE 2026</strong></span>${ico('up',15)}</div><div class="side-project"><span class="side-label">POWERED BY</span><div class="nochain"><span class="no-glyph">NØ</span><span>NØCHAIN <small>AVALANCHE L1</small></span></div><small>${t('Recompensas en testnet · simulación','Testnet rewards · simulated')}</small></div></aside><div class="mobile-overlay ${state.menu?'visible':''}" data-action="closemenu"></div><div class="mainpane"><header class="topbar"><div class="crumbs"><button class="hamburger" data-action="menu" aria-label="Menu">${ico('menu',22)}</button><span>${t('Inteligencia hídrica','Water intelligence')}</span>${ico('chevron',15)}<b>${pages.find(p=>p[0]===state.view)[2]}</b></div><div class="top-actions">${statusPill()}<div class="langs" role="group" aria-label="Language"><button data-action="lang" data-lang="es" class="${state.lang==='es'?'active':''}">ES</button><button data-action="lang" data-lang="en" class="${state.lang==='en'?'active':''}">EN</button></div><span class="avatar">${ico('droplet',17)}</span></div></header><main class="content">`;
  const bottom=()=>`<footer class="footer"><div class="footbrand">${brand()}<b>agua<span>clara</span>.</b></div><span>${t('Herramienta de apoyo, no sustituye asesoría agraria. Datos ilustrativos salvo indicación contraria.','Decision support, not a substitute for agronomic advice. Illustrative data unless stated otherwise.')}</span><small>NASA SPACE APPS 2026 · NØCHAIN TESTNET</small></footer></main></div>`;
  const farmTabs=()=>`<section class="farmpicker"><div class="tinyheading"><b>${t('PARCELAS EN ESTUDIO','STUDY FARMS')}</b><span>03 ${t('UBICACIONES','LOCATIONS')} ${ico('pin',13)}</span></div><div class="farmtabs">${farms.map((x,i)=>`<button data-action="farm" data-farm="${x.id}" class="farmtab ${state.farm===x.id?'on':''}"><span class="farmnum">0${i+1}</span><span class="farminfo"><strong>${E(l(x.place).split(' · ')[0])}</strong><small>${E(l(x.crop))}</small></span>${ico(state.farm===x.id?'target':'up',17,'tabicon')}</button>`).join('')}</div></section>`;
  const map=()=>{const coords=x=>({left:Math.max(13,Math.min(84,20+((x.lon+71.30)/.65)*63)),top:Math.max(19,Math.min(83,18+((-16.75-x.lat)/.94)*65))});return `<div class="map" role="group" aria-label="${t('Mapa esquemático de parcelas','Schematic farm map')}"><div class="maphalo"></div><svg class="contours" viewBox="0 0 620 430" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><pattern id="m-points" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".8" fill="#83d6d2" opacity=".2"/></pattern></defs><rect width="620" height="430" fill="url(#m-points)"/><g stroke="#529ca1" stroke-width="1" fill="none" opacity=".38">${Array.from({length:11},(_,i)=>`<path d="M-40 ${25+i*35}Q80 ${i*24-10} 145 ${45+i*30}T305 ${70+i*27}Q395 ${110+i*20} 464 ${30+i*31}T660 ${42+i*33}"/>`).join('')}</g><path d="M490 0Q465 65 411 129T292 259T65 460" fill="none" stroke="#79e5df" stroke-width="3" opacity=".35" stroke-dasharray="7 8" class="river"/><g stroke="#85c1c5" opacity=".17" stroke-dasharray="3 6"><path d="M0 142H620M0 284H620M155 0V430M310 0V430M465 0V430"/></g></svg><div class="radar"><div class="radar-sweep"></div></div><span class="map-n">N ↑</span>${farms.map((x,i)=>{const pos=coords(x);return `<button class="pin ${state.farm===x.id?'selected':''} ${pos.left>65?'pin-left':''}" style="left:${pos.left}%;top:${pos.top}%;--i:${i}" data-action="farm" data-farm="${x.id}" aria-label="${E(x.name)}"><span class="pin-wave"></span><span class="pin-core"></span><span class="pin-tag"><b>${E(l(x.place).split(' · ')[0])}</b><small>${num(x.elevation)} m</small></span></button>`}).join('')}<div class="map-footer"><span><i class="mini-dot"></i>${t('3 zonas de estudio','3 study zones')}</span><small>${t('Mapa esquemático · no GIS','Schematic map · not GIS')}</small></div></div>`;};
  const chart=(arr1,arr2,colors=['#28b8bc','#efa96b'],labels=[t('Consumo del cultivo','Crop water use'),t('Referencia','Reference')])=>{
    const W=720,H=222,L=22,R=18,T=18,B=35, vals=[...arr1,...(arr2||[])],max=Math.max(...vals)*1.17||1;
    const path=a=>a.map((v,i)=>`${i?'L':'M'}${(L+i*(W-L-R)/(a.length-1)).toFixed(1)} ${(T+(1-v/max)*(H-T-B)).toFixed(1)}`).join(' ');
    const area=path(arr1)+` L${W-R} ${H-B} L${L} ${H-B} Z`;
    const m=t(['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].join(','),['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].join(',')).split(',');
    return `<div class="chart-head"><div class="chart-leg"><span><i style="background:${colors[0]}"></i>${labels[0]}</span>${arr2?`<span><i style="background:${colors[1]}"></i>${labels[1]}</span>`:''}</div><span class="chart-note">${t('Serie mensual · datos ilustrativos','Monthly series · illustrative data')}</span></div><svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${E(labels.join(' versus '))}"><defs><linearGradient id="a-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#18b6b5" stop-opacity=".18"/><stop offset="1" stop-color="#18b6b5" stop-opacity="0"/></linearGradient></defs>${[0,.25,.5,.75,1].map(k=>`<line x1="${L}" y1="${T+k*(H-T-B)}" x2="${W-R}" y2="${T+k*(H-T-B)}" stroke="#dfedf0" stroke-dasharray="4 6"/>`).join('')}<path d="${area}" fill="url(#a-fill)"/>${arr2?`<path d="${path(arr2)}" fill="none" stroke="${colors[1]}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" opacity=".85" class="draw-line"/>`:''}<path d="${path(arr1)}" fill="none" stroke="${colors[0]}" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round" class="draw-line"/>${arr1.map((v,i)=>`<circle cx="${L+i*(W-L-R)/(arr1.length-1)}" cy="${T+(1-v/max)*(H-T-B)}" r="2.8" fill="#fff" stroke="${colors[0]}" stroke-width="1.8"/>`).join('')}${m.map((mon,i)=>`<text x="${L+i*(W-L-R)/11}" y="${H-10}" text-anchor="middle" font-size="12" fill="#8aa6ae">${mon}</text>`).join('')}</svg>`;
  };
  const metrics=()=>{let x=f(),s=x.strategies.find(y=>y.recommended)||x.strategies[1],pred=Math.max(0,Math.round(savings(x,s))),val=Math.round(annual(x));const data=[[t('Consumo anual estimado','Estimated annual consumption'),num(val)+(x.mode==='m3'?' m³/ha':' mm'),t('Evapotranspiración ilustrativa','Illustrative evapotranspiration'),'droplet','aqua'],[t('Ahorro potencial','Potential savings'),num(pred)+'%',t('Frente al cultivo actual','Versus current crop'),'trend','mint'],[t('Superficie de estudio','Study area'),num(x.ha,1)+' ha',t('Parcela seleccionada','Selected farm'),'target','lilac'],[t('Alternativas','Alternatives'),'03',t('Con evidencia y riesgos','With evidence and risks'),'layers','peach']];return `<div class="metric-grid">${data.map((d,i)=>`<article class="metric ${d[4]}" style="--delay:${i*95}ms"><div class="metric-label"><span>${d[0]}</span><i>${ico(d[3],18)}</i></div><strong>${d[1]}</strong><small><span></span>${d[2]}</small></article>`).join('')}</div>`;};
  const sectionHeader=(num,title,desc,button='',action='')=>`<div class="section-header"><div><span class="eyeline">${num}</span><h2>${title}</h2><p>${desc}</p></div>${button?`<button data-action="${action}" class="text-btn">${button}${ico('up',16)}</button>`:''}</div>`;
  const waterCard=()=>{const x=f(),refName=l(x.refLabel);return `<article class="card chart-card"><div class="card-header"><div><span class="eyeline">NASA ECOSTRESS / POWER</span><h3>${t('Consumo hídrico del cultivo','Crop water consumption')}</h3><p>${t('Comparación mensual de evapotranspiración.','Monthly evapotranspiration comparison.')}</p></div><button class="round-action" data-action="modal" data-modal="water" title="Sources">${ico('info',18)}</button></div><div class="chart-stat"><span>${t('MEDIA ILUSTRATIVA DIARIA','ILLUSTRATIVE DAILY AVERAGE')}</span><strong>${num(x.et.reduce((a,b)=>a+b,0)/12,1)} <small>mm/día</small></strong></div>${chart(x.et,x.ref,['#0fabb5','#efa46d'],[t('Cultivo','Crop'),refName])}<div class="chart-bottom"><span>${ico('shield',15)} ${t('Estimaciones, no mediciones verificadas','Estimates, not verified field measurements')}</span><button data-action="nav" data-view="evidence">${t('Ver evidencia','See evidence')}${ico('arrow',15)}</button></div></article>`;};
  const basinCard=()=>`<article class="card basin-card"><div class="card-header"><div><span class="eyeline">OPERA DSWx / GPM IMERG</span><h3>${t('Señales de la cuenca','Watershed signals')}</h3></div><button class="round-action" data-action="modal" data-modal="basin">${ico('info',18)}</button></div><span class="smallmuted">${t('Pasto Grande · cobertura estimada','Pasto Grande · estimated coverage')}</span><div class="basin-big"><strong>${basin.reservoirPct.at(-1)}<small>%</small></strong><span>${ico('activity',16)} ${t('Índice ilustrativo','Illustrative index')}</span></div><div class="minibars">${basin.reservoirPct.map((v,i)=>`<i style="height:${Math.max(12,v)}%;--delay:${i*20}ms"></i>`).join('')}</div><div class="basin-footer"><span>${t('Tendencia reciente','Recent trend')}</span><b>${t('Ejemplo, no nivel reportado','Example, not official level')}</b></div></article>`;
  const sofia=()=>{const x=f(),s=x.strategies.find(y=>y.recommended)||x.strategies[1];return `<article class="insight-card"><div class="insight-label">${ico('spark',15)} ${t('UNA MIRADA MÁS CLARA','A CLEARER PERSPECTIVE')}</div><h3>${t('Pequeños cambios. Un gran impacto.','Small changes. Real impact.')}</h3><p>${E(l(x.sofia))}</p><div class="insight-bottom"><div><small>${t('Ahorro proyectado','Projected savings')}</small><strong>−${Math.max(0,Math.round(savings(x,s)))}%</strong></div><button data-action="nav" data-view="strategies">${ico('arrow',18)}</button></div></article>`;};
  const recCards=()=>{const x=f();return `<div class="recommend-grid">${x.strategies.filter(s=>!s.current).map((s,i)=>`<button class="recommend-card" data-action="choose" data-strategy="${s.id}" style="--delay:${i*95}ms"><div class="rec-top"><span>0${i+1}</span>${s.recommended?`<b>${t('SUGERIDA','SUGGESTED')}</b>`:''}</div><strong>${E(l(s.name))}</strong><div class="rec-bot"><span>${savings(x,s)>0?'−':'+'}${num(Math.abs(savings(x,s)),0)}% <small>${t('agua','water')}</small></span><i>${ico('up',18)}</i></div></button>`).join('')}</div>`;};
  const potential=()=>{const x=f(),s=x.strategies.find(y=>y.recommended)||x.strategies[1];return `<div class="reward-promo"><span class="reward-promo-icon">${ico('wallet',24)}</span><div><span>${t('INCENTIVO POTENCIAL · SIMULACIÓN','POTENTIAL REWARD · SIMULATION')}</span><strong>${num(maxReward(x,s),2)} <small>USDC</small></strong><p>${t('Si el ahorro es verificado y el cultivo sigue vivo.','If savings are verified and the crop remains alive.')}</p></div><button data-action="nav" data-view="rewards">${ico('up',20)}</button></div>`;};
  const hero=()=>`<section class="hero enter"><div class="hero-copy"><span class="hero-eyebrow"><i></i> NASA SPACE APPS CHALLENGE 2026</span><h1>${t('El futuro del agua','The future of water')}<em>${t('se cultiva hoy.','starts in the field.')}</em></h1><p>${t('Entiende lo que consume cada parcela, compara estrategias de cultivo y descubre cómo un ahorro puede convertirse en una recompensa verificable.','See how much water each field uses, compare crop strategies, and explore how savings could become verifiable rewards.')}</p><div class="hero-buttons"><button class="primary-btn" data-action="nav" data-view="strategies">${t('Comparar estrategias','Compare strategies')}${ico('arrow',17)}</button><button class="ghost-btn" data-action="scrollfarms">${ico('pin',16)}${t('Explorar parcelas','Explore farms')}</button></div><div class="hero-foot"><span>✧ NASA ECOSTRESS</span><i></i><span>HLS · POWER · OPERA</span></div></div>${map()}</section>`;
  const overview=()=>`${hero()}${farmTabs()}<div class="snapshot"><div><span class="eyeline"><i class="green-dot"></i>${t('PARCELA SELECCIONADA','SELECTED FARM')}</span><h2>${E(f().name)}</h2></div><div class="snapshot-loc">${ico('pin',15)}${E(l(f().place))} · ${num(f().elevation)} m</div></div>${metrics()}${sectionHeader('01 / '+t('OBSERVATORIO','OBSERVATORY'),t('Tu parcela, en perspectiva','Your farm in perspective'),t('Consumo, condiciones locales y señales regionales.','Water use, local conditions and regional signals.'))}<div class="dashboard-grid"><div>${waterCard()}</div><div class="stack">${sofia()}${basinCard()}</div></div>${sectionHeader('02 / FIELD SHIFT',t('Elige un camino más inteligente','Choose a smarter path'),t('Tres alternativas para ahorrar agua, con beneficios y riesgos.','Three alternatives for saving water, with benefits and risks.'),t('Ver todas','View all'),'nav-strategies')}${recCards()}${potential()}${disclaimer()}`;
  const disclaimer=()=>`<div class="disclaimer">${ico('info',17)}${t('Los valores de las parcelas y recompensas son ilustrativos hasta conectar el oráculo NASA y verificar evidencia en campo.','Farm and reward values are illustrative until the NASA oracle and field verification are connected.')}</div>`;
  const heading=(small,title,desc)=>`<div class="page-title enter"><span class="eyeline"><i class="green-dot"></i>${small} <span class="slash">/</span> ${t('MODO DEMOSTRACIÓN','DEMO MODE')}</span><h1>${title}</h1><p>${desc}</p></div>`;
  const strategyOptions=(showAll=true)=>`<div class="strategy-options">${f().strategies.map((s,i)=>`<button data-action="strategy" data-strategy="${s.id}" class="strategy-option ${state.strategy[f().id]===s.id?'picked':''}"><span class="opt-num">0${i+1}</span><div><b>${E(l(s.name))}</b><small>${s.current?t('PRÁCTICA ACTUAL','CURRENT PRACTICE'):s.recommended?t('ALTERNATIVA SUGERIDA','SUGGESTED ALTERNATIVE'):t('ALTERNATIVA','ALTERNATIVE')}</small></div><span class="strategy-radio"></span></button>`).join('')}</div>`;
  const compare=()=>{const x=f(),s=ss(),b=base(x),sv=savings(x,s),v=x.mode==='m3'?'m³/ha/año':'mm/año';return `<article class="card compare-card"><div class="card-header"><div><span class="eyeline">${t('COMPARACIÓN DE ESCENARIOS','SCENARIO COMPARISON')}</span><h3>${E(l(s.name))}</h3></div>${s.recommended?`<span class="recommended-tag">${ico('spark',14)} ${t('SUGERIDA','SUGGESTED')}</span>`:''}</div><div class="compare-top"><div><small>${t('PRÁCTICA ACTUAL','CURRENT PRACTICE')}</small><strong>${num(b)}</strong><span>${v}</span></div><div class="compare-arrow">${ico('arrow',24)}</div><div><small>${t('ESTRATEGIA ELEGIDA','SELECTED STRATEGY')}</small><strong>${num(s.water)}</strong><span>${v}</span></div></div><div class="saving-row"><span>${t('Diferencia de agua proyectada','Projected water difference')}</span><b class="${sv>=0?'positive':'negative'}">${sv>=0?'−':'+'}${num(Math.abs(sv),0)}%</b></div><div class="progress-track"><span style="width:${Math.min(100,Math.max(2,s.water/b*100))}%"></span></div><div class="score-grid"><div>${ico('leaf',18)}<small>${t('SALUD DEL SUELO','SOIL HEALTH')}</small><strong>${s.soil}/100</strong></div><div>${ico('trend',18)}<small>${t('POTENCIAL DE INGRESOS','INCOME POTENTIAL')}</small><strong>${'●'.repeat(s.income)}<span class="empty-dots">${'○'.repeat(5-s.income)}</span></strong></div><div>${ico('shield',18)}<small>${t('RIESGO PRINCIPAL','MAIN RISK')}</small><strong class="risktext">${E(l(s.mainRisk))}</strong></div></div><div class="four-insights"><div class="explain good-box"><span>${ico('spark',16)} ${t('POR QUÉ','WHY')}</span><p>${E(l(s.why))}</p></div><div class="explain"><span>${ico('satellite',16)} ${t('EVIDENCIA','EVIDENCE')}</span><p>${E(l(s.evidence))}</p></div><div class="explain"><span>${ico('info',16)} ${t('VACÍOS DE DATOS','DATA GAPS')}</span><p>${E(l(s.gaps))}</p></div><div class="explain"><span>${ico('shield',16)} ${t('RIESGOS','RISKS')}</span><p>${E(l(s.risks))}</p></div></div><div class="compare-footer"><span>${ico('info',16)} ${t('Revisar con Agencia Agraria / INIA antes de implementar.','Review with local agrarian agency / INIA before implementation.')}</span><button class="primary-btn small" data-action="nav" data-view="rewards">${t('Explorar recompensa','Explore reward')}${ico('arrow',16)}</button></div></article>`;};
  const strategies=()=>`${heading('FIELD SHIFT / '+t('DECISIONES','DECISIONS'),t('Explora estrategias','Explore strategies'),t('Compara cuatro alternativas para esta parcela, con agua, suelo, ingresos, evidencia y riesgos.','Compare four options for this field, including water, soil, income, evidence and risks.'))}${farmTabs()}<div class="inner-farm"><span>${ico('leaf',21)}</span><div><b>${E(f().name)}</b><small>${E(l(f().crop))} · ${f().ha} ha · ${E(l(f().place))}</small></div><span class="inner-tag">${t('DATOS DEMO','DEMO DATA')}</span></div><div class="strategy-layout"><div><div class="section-header compact"><div><span class="eyeline">01 / ${t('ESCOGE UNA OPCIÓN','CHOOSE AN OPTION')}</span><h2>${t('Cuatro caminos, una decisión','Four paths, one decision')}</h2></div></div>${strategyOptions()}<div class="strategy-help">${ico('info',17)}${t('Las cifras son escenarios educativos, no predicciones de rendimiento o ahorro medido.','These are educational scenarios, not verified predictions of yield or savings.')}</div></div><div>${compare()}</div></div>${potential()}${disclaimer()}`;
  const sources=[['ECOSTRESS','Evapotranspiración / ESI','Evapotranspiration / ESI','70 m',t('Campo · sobrepasos irregulares','Field · irregular overpasses'),'field'],['HLS','NDVI · vegetación','NDVI · crop vegetation','30 m',t('Campo · comprobar cultivo vivo','Field · living crop check'),'field'],['NASA POWER','ET₀ · clima','ET₀ · climate','~50 km',t('Regional · no parcela','Regional · not field'),'regional'],['GPM IMERG','Precipitación','Precipitation','~10 km',t('Regional · cabeceras','Regional · headwaters'),'regional'],['OPERA DSWx','Lámina de agua','Water surface','var.',t('Embalse · verificación local','Reservoir · local validation'),'regional'],['SMAP / GRACE-FO','Humedad / almacenamiento','Moisture / water storage','9 km / cuenca',t('Regional · baja resolución','Regional · coarse resolution'),'regional']];
  const evidence=()=>`${heading('EARTH OBSERVATION / NASA',t('Inteligencia satelital','Satellite intelligence'),t('De la órbita a la parcela: descubre qué se mide, qué se estima y dónde están los límites.','From orbit to field: what is measured, what is estimated, and where the limits are.'))}${farmTabs()}<div class="steps-overview">${[['satellite','01',t('Observamos','Observe'),t('Satélites evalúan evapotranspiración y vegetación.','Satellites estimate evapotranspiration and vegetation.')],['layers','02',t('Comparamos','Compare'),t('Exploramos cuatro estrategias posibles de cultivo.','Explore four possible growing strategies.')],['shield','03',t('Verificamos','Verify'),t('La recompensa requiere evidencia y cultivo vivo.','Payment requires evidence and a living crop.')]].map(x=>`<div class="evidence-step"><span>${ico(x[0],23)}</span><small>${x[1]}</small><strong>${x[2]}</strong><p>${x[3]}</p></div>`).join('')}</div>${sectionHeader('01 / DATA SOURCES',t('Qué dice la NASA','What NASA tells us'),t('Cada fuente tiene escala, frecuencia y límites distintos.','Each source has different scales, frequency and limitations.'))}<div class="source-grid">${sources.map(s=>`<article class="source-card"><div class="src-top"><span>${ico('satellite',18)}</span><i class="${s[5]==='field'?'field-tag':'regional-tag'}">${s[5]==='field'?t('PARCELA','FIELD'):t('REGIONAL','REGIONAL')}</i></div><h3>${s[0]}</h3><p>${state.lang==='es'?s[1]:s[2]}</p><div><b>${s[3]}</b><span>${s[4]}</span></div></article>`).join('')}</div>${sectionHeader('02 / '+t('VALIDACIÓN','VALIDATION'),t('Datos y contexto','Data and context'),t('Series ilustrativas y situación hídrica regional.','Illustrative series and regional water conditions.'))}<div class="dashboard-grid"><div>${waterCard()}</div><div>${basinCard()}</div></div><div class="limitation"><span>${ico('shield',21)}</span><div><h3>${t('Transparencia primero.','Transparency first.')}</h3><p>${t('ECOSTRESS estima agua consumida por las plantas, no agua entregada por canales. POWER, IMERG, SMAP y GRACE-FO son regionales; no prueban ahorro parcela por parcela. Las cifras en esta demo son ejemplos.','ECOSTRESS estimates water consumed by plants, not delivered irrigation. POWER, IMERG, SMAP and GRACE-FO are regional and cannot prove plot-level savings. Values in this demo are examples.')}</p></div></div>${sectionHeader('03 / MOQUEGUA',t('Por qué importa aquí','Why it matters here'),t('Contexto regional con referencias públicas.','Regional context with public references.'))}<div class="facts-grid">${facts.map(item=>`<a class="fact-card" href="${E(item.href)}" target="_blank" rel="noopener noreferrer"><strong>${E(item.value)}</strong><p>${E(state.lang==='es'?item.es:item.en)}</p><small>${E(item.src)} ${ico('up',14)}</small></a>`).join('')}</div>${disclaimer()}`;
  const checkList=()=>`<div class="checklist"><div class="check-title">${ico('shield',18)} ${t('Reglas de verificación (ejemplo)','Verification rules (example)')}</div>${f().checks.map(c=>`<div class="checkrow"><span class="check-circle ${c.result==='ok'?'ok':'part'}">${ico(c.result==='ok'?'check':'info',14)}</span><span><strong>${E(l(c.label))}</strong><small>${E(l(c.detail))}</small></span>${c.weight>0?`<b>${c.result==='ok'?c.weight:c.got||0}/${c.weight}</b>`:''}</div>`).join('')}</div>`;
  const rewards=()=>{const x=f(),s=ss(),idx=state.stage[x.id]||0,good=eligible(x,s),am=maxReward(x,s),actual=reward(x,s);const stages=[t('Comprometer','Commit'),t('Verificar','Verify'),t('Pagar','Pay')];return `${heading('NØCHAIN / X402',t('Incentivos hídricos','Water incentives'),t('Simula cómo se comprometen, verifican y liberan recompensas basadas en evidencia.','Simulate how evidence-based rewards are committed, verified and released.'))}${farmTabs()}<div class="reward-warning">${ico('info',19)}<p>${t('Simulación únicamente. No se mueven fondos reales. Ninguna organización mencionada es un socio confirmado.','Simulation only. No real funds move. Mentioned organizations are not confirmed partners.')}</p><span>TESTNET / DEMO</span></div><div class="reward-layout"><section><div class="section-header compact"><div><span class="eyeline">01 / ${t('ESTRATEGIA','STRATEGY')}</span><h2>${t('Elige una estrategia','Choose a strategy')}</h2></div></div>${strategyOptions()}<div class="reward-info"><span>${ico('leaf',19)}</span><div><b>${t('Regla contra el abandono','No field-abandonment rewards')}</b><p>${t('Secar o abandonar un cultivo nunca libera un incentivo. HLS NDVI debe confirmar vegetación viva.','Drying or abandoning a crop never releases an incentive. HLS NDVI must confirm live vegetation.')}</p></div></div></section><section class="workflow-card"><div class="card-header"><div><span class="eyeline">02 / SMART REWARDS</span><h3>${t('Flujo de recompensa','Reward flow')}</h3><p>${t('USDC · NØCHAIN Avalanche L1','USDC · NØCHAIN Avalanche L1')}</p></div><span class="workflow-icon">${ico('wallet',23)}</span></div><div class="workflow-stepper">${stages.map((q,i)=>`<div class="flow-step ${idx>i?'complete':idx===i?'current':''}"><span>${idx>i?ico('check',16):i+1}</span><small>${q}</small></div>`).join('')}</div><div class="reward-amount"><span>${t('INCENTIVO MÁXIMO ESTIMADO','MAX. ESTIMATED REWARD')}</span><strong>${num(am,2)} <small>USDC</small></strong><div><span>${t('Financiador','Funder')}: ${t('institución potencial','potential institution')}</span><span>${t('Gas patrocinado','Sponsored gas')}</span></div></div>${!good?`<div class="inactive-note">${ico('info',19)}${t('Elige una alternativa con ahorro de agua para poder simular un incentivo.','Select a water-saving alternative to simulate a reward.')}</div>`:`<div class="workflow-stage-content">${idx>=2?checkList():`<p>${idx===0?t('Un financiador bloquea fondos simulados para la estrategia elegida.','A funder commits simulated funds for the selected strategy.'):t('El compromiso está registrado en la simulación. El siguiente paso valida vegetación y métricas hídricas.','The commitment is recorded in the simulation. Next, validate vegetation and water metrics.')}</p>`}${idx===3?`<div class="paid-success"><span>${ico('check',22)}</span><div><small>${t('RECOMPENSA SIMULADA ENTREGADA','SIMULATED REWARD DELIVERED')}</small><strong>+${num(actual,2)} USDC</strong><small>NØFI WALLET · TESTNET</small></div></div>`:''}</div><div class="workflow-actions">${idx<3?`<button class="primary-btn" data-action="advance">${idx===0?t('Simular compromiso','Simulate commitment'):idx===1?t('Verificar con evidencia','Verify with evidence'):t('Simular pago USDC','Simulate USDC payment')}${ico('arrow',17)}</button>`:`<button class="primary-btn" data-action="cashout">${t('Retirar a soles (demo)','Cash out to soles (demo)')}${ico('up',17)}</button><button class="secondary-btn" data-action="reset">${ico('refresh',16)}${t('Reiniciar','Restart')}</button>`}${state.notice?`<p class="notice">${t('Demo: retiro a soles no conectado. Ningún fondo fue transferido.','Demo: soles cash-out is not connected. No funds transferred.')}</p>`:''}</div>`}<div class="workflow-footer">${ico('shield',15)} ${t('Toda validación y pago mostrados son simulados.','All validation and payment shown are simulated.')}</div></section></div>${disclaimer()}`;};
  const modal=()=>{if(!state.modal)return '';const md={water:[t('Cómo interpretamos el consumo hídrico','Understanding water use'),t('ECOSTRESS ofrece estimaciones de evapotranspiración. Los datos por parcela de esta demo son ilustrativos; la resolución de 70 m y el paso irregular del satélite exigen analizar cobertura temporal, nubes y límites espaciales. NASA POWER y otros productos regionales no sustituyen medición en campo.','ECOSTRESS estimates evapotranspiration. Plot values here are illustrative; its ~70 m resolution and irregular overpasses require coverage and quality checks. Regional NASA POWER and other products do not replace ground measurements.')],basin:[t('Señales regionales de agua','Regional water signals'),t('Las barras de almacenamiento de Pasto Grande de esta demo son ejemplos y no corresponden a un nivel reportado oficialmente. OPERA DSWx, GPM IMERG y GRACE-FO informan sobre superficie del embalse, lluvia y almacenamiento regional a escalas diferentes.','Pasto Grande reservoir bars in this demo are example values and are not officially reported levels. OPERA DSWx, GPM IMERG and GRACE-FO show water surface, rain and regional storage at different scales.')]}[state.modal]||[];return `<div class="modal-back" data-action="closemodal"><section class="modal" role="dialog" aria-modal="true" aria-label="${E(md[0])}"><div class="modal-top">${ico('satellite',23)}<button data-action="closemodal" aria-label="Close">${ico('close',21)}</button></div><h2>${E(md[0])}</h2><p>${E(md[1])}</p><div class="modal-note">${ico('info',18)} ${t('Revisar resultados con la Agencia Agraria / INIA.','Review results with the agrarian agency / INIA.')}</div><button class="primary-btn" data-action="closemodal">${t('Entendido','Got it')}${ico('check',17)}</button></section></div>`;};
  const app=()=>`${top()}${({overview,strategies,evidence,rewards})[state.view]()}${bottom()}${modal()}`;
  function render(preserve=true){const sc=window.scrollY;document.documentElement.lang=state.lang;document.getElementById('app').innerHTML=app();document.title=`Agua Clara — ${pages.find(p=>p[0]===state.view)?.[2]||'Dashboard'}`;if(preserve)window.scrollTo(0,sc);}
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
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&(state.modal||state.menu)){state.modal='';state.menu=false;render();}});
  render(false);
})();
