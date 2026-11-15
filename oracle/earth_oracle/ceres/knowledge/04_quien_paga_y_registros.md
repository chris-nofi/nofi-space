# Quién paga, qué se guarda y por qué se puede confiar

## La idea en una frase
El agricultor nunca paga ni toca nada de cripto. Los datos de la NASA de su parcela se **venden por consulta** a quien los necesita (el propio agente CERES, una cooperativa, un comprador o un auditor) y cada registro mensual queda **anclado** en la blockchain de NOFI para que nadie pueda inflarlo ni cambiarlo.

## Qué ve el agricultor
- Consejos de agua en su idioma, por voz o por chat.
- Un aviso: "Tu registro verificable de agua está guardado ✔. Cualquiera puede comprobar que estos datos de la NASA no se cambiaron."
- Nada más: **no ve billetera, token, comisión ni pago**. No necesita teléfono inteligente para hablar con CERES por llamada.

Cuando hables con un agricultor, no le hables de x402, tokens, gas ni billeteras salvo que pregunte. Si pregunta, explícalo en una frase sencilla y deja claro que a él no le cuesta nada.

## Qué es el registro verificable
Cada mes y por parcela, el oráculo de la Tierra arma un registro con:
- **ET** (agua que usa el cultivo, de ECOSTRESS), **ET0** (lo que pide el clima, de POWER), **lluvia** (GPM IMERG Late; CHIRPS como contraste), **NDVI** (verdor, de HLS);
- la **estrategia recomendada** y el **agua ahorrada** estimada frente a la práctica actual;
- los identificadores de los datos de la NASA usados y la versión del motor.

De ese registro se calcula una **huella digital** (dataHash, un sha256). La huella se guarda en un contrato llamado **WaterProofRegistry** en la L1 de NOFI. Si alguien cambia un solo número del registro, la huella ya no coincide y el contrato dice "✘ no coincide". Así **nadie puede inflar el ahorro de agua, ni nosotros**.

Solo oráculos autorizados pueden escribir registros. Si un extraño lo intenta, el contrato lo rechaza.

**Si el registro está marcado como de ejemplo (placeholder)**, todavía no tiene las mediciones reales de la NASA y no se ancla en la cadena. Dilo con claridad.

## Quién paga y por qué
| Quién | Qué compra | Precio en la red de prueba |
|---|---|---|
| **El agente CERES** | Un registro de una parcela y un mes, cada vez que responde con datos de la NASA | 0.05 dólares de prueba |
| **Una cooperativa** (olivo, alfalfa) | El reporte mensual verificado de sus socios, para demostrar ahorro de agua ante un MERESE o la Junta de Usuarios | 0.05 por parcela |
| **Un comprador o auditor** | Un registro y su evidencia para comprobar una declaración de trazabilidad | 0.05 |

No hay suscripción ni cuenta: se paga solo lo que se consulta. Hoy es una **red de prueba (testnet)**: los dólares son de prueba y no tienen valor.

## Cómo funciona x402 (para jueces, socios e instituciones)
x402 es un estándar abierto para cobrar en internet por consulta, usando el código HTTP 402 "Payment Required".
1. El comprador pide el dato y el oráculo responde **402** con el precio.
2. El comprador **firma** una autorización de pago (EIP-3009). No envía una transacción ni paga gas: solo firma.
3. Un **facilitador** verifica la firma y envía el pago a la cadena (él paga el gas).
4. El oráculo entrega el dato junto con el enlace a la transacción en el explorador **nofiscan.io** y confirma que el dato vendido es exactamente el que está registrado en la cadena.
Lo usa el propio agente CERES: le compra el dato al oráculo de la Tierra como pagaría una API, pero sin claves ni contratos de suscripción.

## La L1 de NOFI (NØFI Chain)
- Es **una blockchain propia** de NOFI construida con Avalanche (una L1 soberana, ACP-77), red de prueba, chain ID 880024. No es un contrato dentro de una red compartida.
- **El gas se paga en dólares de prueba (tUSD)**, no en un token volátil. Las tarifas están fijadas por la propia red (alrededor de 0.002 dólares de prueba por pago).
- Explorador: **nofiscan.io**.
- Próximo paso (todavía no construido): reflejar los registros en la C-Chain de Avalanche con ICM para compradores que trabajan allí.
No digas cifras de velocidad de la red que no estén medidas.

## La regla que protege a todos
Ahorrar agua abandonando o secando la parcela no cuenta: si el NDVI del mes es menor que 0.20 (campo pelado o cultivo muerto), el registro no da crédito de ahorro. Esto evita trampas.

## Lo que NO es
- **No es un pago al agricultor ni una promesa de pago.** Un programa como un MERESE podría usar estos registros en el futuro para retribuir, pero eso depende de un financiador que firme un programa; hoy no existe.
- **No es un seguro ni un préstamo.**
- **No hay token para invertir ni promesa de ganancias.** Los dólares de prueba no valen nada.

## Seguridad
Nunca compartas tu frase de recuperación, claves ni contraseñas. Ni NOFI, ni CERES, ni la Agencia Agraria te las pedirán jamás. Si alguien te las pide, es una estafa.

## Qué es un MERESE
Los MERESE (Mecanismos de Retribución por Servicios Ecosistémicos) son un esquema legal en el Perú: quien se beneficia del agua retribuye a quien la cuida. En el sur del Perú ya existen; por ejemplo, la EPS Ilo trabaja con comunidades de cabecera en qochas y zanjas de infiltración. Los registros verificables de CERES Ventures pueden servir como prueba barata y transparente para esos esquemas. Los fondos mencionados son **posibles** usuarios, no socios confirmados.

## Impuestos y temas legales
CERES no da asesoría tributaria ni legal. Para eso: un contador o SUNAT.
