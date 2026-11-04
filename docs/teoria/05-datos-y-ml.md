# 5. Datos y machine learning

La metodología completa (CRISP-DM, fases y línea de entrenamiento de cada modelo) está en
[machine-learning.md](../machine-learning.md). Cómo se conecta con la tienda está en
[../codigo/09-inteligencia.md](../codigo/09-inteligencia.md). Aquí se explican **los conceptos**,
para poder defenderlos.

## BI y ML no son lo mismo

- **BI (inteligencia de negocios)** describe lo que pasó: sumas, promedios, rankings, márgenes.
  No aprende nada. Ejemplos: Métricas, Logística, Conversión.
- **ML (aprendizaje automático)** ajusta un modelo a los datos para **predecir** o **descubrir
  estructura**. Ejemplos: forecast, segmentación, fraude.
- **Supervisado:** hay una respuesta conocida con la cual aprender, como las ventas pasadas en
  el forecast. **No supervisado:** no la hay; se buscan grupos o rarezas, como en KMeans y en
  Isolation Forest.

## Forecast de demanda: regresión Ridge

**El modelo.** Para cada producto, las unidades vendidas por mes se explican con:

- una **tendencia** (meses desde la primera venta);
- **11 variables de mes** (*one-hot*, con enero como base): cada coeficiente mide cuánto se
  vende más o menos ese mes. Es un **índice estacional**.

**Por qué Ridge.** Es una regresión lineal con **regularización L2**: minimiza el error más
α·Σβ², con α = 1. Con pocos datos (por ejemplo, 24 meses y 12 coeficientes), una regresión
común se ajusta al ruido (**sobreajuste**). Ridge "encoge" los coeficientes hacia cero y
generaliza mejor. Además es **explicable**: se puede leer cada coeficiente.

**Decisiones de datos que importan:**

- La serie empieza en la **primera venta** del producto. Rellenar con ceros los meses en que no
  existía inventaría una tendencia al alza.
- Solo se usan **meses cerrados**: el mes en curso está incompleto y parecería una caída.
- Con menos de 12 meses no hay un año completo para estimar la estacionalidad, así que solo se
  usa la tendencia.

**Evaluación honesta: el *backtest*.**

- El error medido sobre los datos de entrenamiento siempre sale optimista. Por eso se reservan
  los **últimos 3 meses cerrados**: se entrena sin ellos, se predicen y se compara con lo que de
  verdad se vendió. Esto es **validación temporal**: en series de tiempo no se puede mezclar al
  azar, porque se estaría usando el futuro para predecir el pasado.
- La métrica es el **MAE** (error absoluto medio, en unidades por mes), fácil de explicar:
  "nos equivocamos en promedio en X unidades".
- Se compara contra un **modelo ingenuo estacional** ("lo mismo que el mismo mes del año
  pasado"). **Un modelo solo vale la pena si le gana a la alternativa trivial.** Si pierde, se
  muestra igual. Ajustar el modelo mirando esos 3 meses sería **fuga de datos (*data
  leakage*)**: el resultado se vería bien porque el modelo ya conoce la prueba.
- La **banda de incertidumbre** (≈ P10–P90) usa el error del backtest, no el de
  entrenamiento, que la haría engañosamente estrecha.

## Reposición: punto de pedido

```
demanda diaria = pronóstico del mes ÷ días del mes
necesario      = demanda diaria × (14 días de proveedor + 30 días de cobertura)
comprar        = necesario − disponible        (disponible = stock − reservado)
días a quiebre = disponible ÷ demanda diaria
```

Es la lógica clásica de **punto de reorden con tiempo de reposición (*lead time*)**: un
producto es urgente si se agota antes de que pueda llegar el pedido al proveedor.

## Segmentación: RFM + KMeans

- **RFM** resume a cada cliente en tres números: **R**ecencia (días desde la última compra),
  **F**recuencia (cuántas compras) y **M**onto (cuánto gastó). Con puntajes de 1 a 5 se nombran
  segmentos fáciles de leer: campeones, leales, nuevos, prometedores, en riesgo, hibernando.
- **KMeans** agrupa a los clientes en *k* = 4 grupos, minimizando la distancia de cada uno al
  centro de su grupo.
  - **Antes de agrupar se transforma:** la frecuencia y el monto pasan a logaritmo (`log1p`),
    porque son muy asimétricos (pocos clientes gastan muchísimo). Luego todo se **estandariza**
    (media 0, desviación 1). Sin esto, la variable con números más grandes dominaría la
    distancia.
  - `n_init = 10` y semilla fija: KMeans depende de dónde empieza, así que se prueba 10 veces y
    se queda con la mejor. El resultado es reproducible.
- **Silhouette** mide la calidad de los grupos (de −1 a 1): qué tan cerca está cada cliente de
  su grupo comparado con el grupo vecino. Un valor cercano a 0,35 indica una **estructura
  moderada**, típica de clientes reales, que no forman grupos nítidos.

## Fraude: Isolation Forest

- **El problema:** no hay ejemplos etiquetados de fraude, así que no se puede usar un
  clasificador supervisado.
- **La idea:** construir árboles que cortan los datos al azar. **Un punto raro se aísla con
  pocos cortes**, mientras que uno normal, rodeado de otros parecidos, necesita muchos. El
  puntaje es la profundidad promedio a la que se aísla el punto en 200 árboles.
- **Rasgos (9):**
  - monto (en logaritmo), ítems y unidades;
  - hora del pedido como **seno y coseno**, para que las 23:00 y las 00:00 queden cerca;
  - si es invitado, si es retiro en tienda, antigüedad de la cuenta y compras previas.
- `contamination = 0,02` fija qué fracción se considera anómala.
- **El modelo no acusa: sugiere revisar.** Cada alerta trae una explicación en palabras (por
  ejemplo, "cuenta recién creada con una primera compra grande"), calculada con z-scores de los
  rasgos.

## Recomendaciones: reglas de asociación

Para cada par de productos A → B, comprados en la misma canasta:

- **Soporte:** en qué fracción de las canastas aparecen juntos.
- **Confianza:** P(B | A), de quienes compraron A, cuántos compraron B.
- **Lift** = P(B | A) / P(B). Si vale 1, comprar A no cambia nada; si es mayor que 1, A
  **aumenta** la probabilidad de B. La confianza sola engaña con los productos muy populares
  (todos compran ramen); el lift corrige eso.

Se recomiendan pares con lift > 1 y al menos 5 compras juntas, porque con menos el lift es puro
ruido.

## Clasificación ABC (principio de Pareto)

Se ordenan los productos por ingresos y se acumula su participación:

- **A:** los que llevan al 80 % de los ingresos.
- **B:** hasta el 95 %.
- **C:** el resto.

La clase depende de lo acumulado **antes** del producto. Así, un producto que solo ya vende el
90 % queda como A y no como B.

## Anomalías de ventas: z-score

Un día es anómalo si sus ingresos se alejan **2,5 desviaciones estándar o más** del promedio
(z = (x − μ) / σ). Si los datos fueran normales, eso ocurriría en aproximadamente el 1 % de los
días.

## Elasticidad-precio de la demanda

**Qué mide.** Cuánto cambian las ventas (en %) cuando cambia el precio (en %):

```
e = %Δ cantidad / %Δ precio
```

- |e| > 1: **elástica**, las ventas reaccionan más que el precio (bajar el precio puede subir el
  ingreso total).
- |e| < 1: **inelástica**, las ventas cambian poco (subir el precio puede subir el ingreso).
- Lo esperable es e < 0: si el precio sube, se vende menos. Un valor positivo indica que otro
  factor pesó más.

**Elasticidad de arco (punto medio).** El porcentaje se calcula sobre el promedio de los dos
valores, no sobre el inicial:

```
%Δ = (nuevo − anterior) / ((nuevo + anterior) / 2)
```

Así el resultado es **el mismo si el precio sube de 1.000 a 1.200 o baja de 1.200 a 1.000**. Con
el porcentaje simple darían números distintos.

**Límites que se declaran.**

- Es **descriptiva, no causal**. Compara 28 días antes con 28 días después, sin controlar
  estacionalidad, promociones ni quiebres de stock. Para una medida causal haría falta un
  experimento (por ejemplo, un test A/B de precios) o un modelo econométrico con controles.
- **No se publica sin evidencia:** si la ventana tiene menos de 14 días, el cambio queda en
  observación, y si se vendieron menos de 10 unidades, queda sin datos suficientes.

## Trazabilidad y reproducibilidad (MLOps básico)

Cada corrida queda en `ModelRun` (modelo, versión, métricas, filas y duración), y cada
predicción apunta a su corrida. Las semillas aleatorias están fijas (`random_state = 42`). Con
los mismos datos y la misma versión, el resultado es el mismo, y ante cualquier número se puede
responder **qué modelo y qué versión lo produjeron**.
