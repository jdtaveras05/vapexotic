# Vapexotic — Documentacion del Proyecto

Pagina web estatica para venta de vapes via WhatsApp en Santo Domingo, RD.
Sin backend, sin base de datos, sin autenticacion. Hospedada en GitHub Pages.

---

## Estructura de Archivos

```
vapexotic/
├── index.html          ← Pagina principal (estructura HTML)
├── styles.css          ← Todos los estilos
├── app.js              ← Toda la logica (modulo IIFE, namespace Vapexotic)
├── products.json       ← Catalogo de productos (fuente de verdad)
├── README.md           ← Este archivo
└── assets/
    ├── logo.png        ← Logo principal
    └── products/       ← Imagenes de productos (ver seccion Imagenes)
```

---

## Imagenes de Productos

Las imagenes se organizan en carpetas por modelo. El nombre de la carpeta es
`MarcaModelo` en PascalCase sin espacios. Dentro de cada carpeta:

- `modelo.jpg` — foto general/grupal del producto (se muestra en la card del catalogo)
- `NombreSabor.jpg` — foto especifica del sabor (se muestra en el modal al seleccionar)

```
assets/products/
├── LostMaryBM600/
│   ├── modelo.jpg
│   ├── MangoIce.jpg
│   ├── WatermelonIce.jpg
│   ├── Blueberry.jpg
│   └── StrawberryKiwi.jpg
├── ElfBarBC5000/
│   ├── modelo.jpg
│   ├── WatermelonIce.jpg
│   ├── MangoMilkIce.jpg
│   └── BlueRazzIce.jpg
├── SMOKNord5/
│   └── modelo.jpg          ← kits sin variantes solo necesitan modelo.jpg
└── ...
```

**Si falta una imagen**, la pagina no se rompe. Se muestra un placeholder con icono.
Los paths en el JSON deben coincidir exactamente con los nombres de archivo (case-sensitive).

---

## Esquema del JSON (`products.json`)

El archivo es un array de objetos. **Cada objeto es un sabor/variante individual**, no un modelo completo.
Multiples entradas con la misma `marca` + `nombre` se agrupan automaticamente como un solo modelo
con selector de sabores en la pagina.

### Campos

| Campo          | Tipo       | Requerido | Default   | Descripcion |
|----------------|------------|-----------|-----------|-------------|
| `id`           | `number`   | Si        | —         | Identificador unico. Nunca reutilizar IDs eliminados. |
| `categoria`    | `string`   | Si        | `"otros"` | Determina en que tab aparece. Ver seccion Categorias. |
| `marca`        | `string`   | Si        | —         | Nombre de la marca. |
| `nombre`       | `string`   | Si        | —         | Nombre del modelo. Junto con `marca`, define la agrupacion. |
| `sabor`        | `string`   | Si        | —         | Nombre del sabor/variante. Para kits: `"Kit Completo"`. |
| `specs`        | `string[]` | No        | `[]`      | Especificaciones tecnicas. Se muestran como chips en el modal. **Si se omite, esta vacio, o no se incluye, simplemente no se muestra nada.** No da error. |
| `precio`       | `number`   | Si        | —         | Precio en RD$. Sin decimales. |
| `stock`        | `number`   | Si        | —         | Unidades disponibles. `0` = agotado (visible pero deshabilitado). |
| `imagenModelo` | `string`   | No        | `""`      | Path a la imagen del modelo. Si vacio, muestra placeholder. |
| `imagen`       | `string`   | No        | `""`      | Path a la imagen del sabor. Si vacio, usa `imagenModelo`. |
| `hot`          | `boolean`  | No        | `false`   | Muestra badge "Popular". |
| `oferta`       | `boolean`  | No        | `false`   | Muestra badge "Oferta" y aparece en Ofertas del Dia. |
| `precioAntes`  | `number`   | No        | `0`       | Precio anterior (tachado). `0` = no mostrar. |
| `activo`       | `boolean`  | No        | `true`    | `false` = oculta completamente sin borrar del JSON. |

### Diferencia entre `activo: false` y `stock: 0`

- **`stock: 0`** → El sabor se muestra tachado y deshabilitado. El usuario lo ve pero no puede comprarlo.
- **`activo: false`** → El sabor desaparece completamente. Como si no existiera.

### Reglas de Agrupacion

Los productos se agrupan por `marca` + `nombre`. Ejemplo:

```json
{ "marca": "Elf Bar", "nombre": "BC5000", "sabor": "Watermelon Ice" }
{ "marca": "Elf Bar", "nombre": "BC5000", "sabor": "Blue Razz Ice" }
```

Estas 2 entradas = **una sola card** "Elf Bar BC5000" con selector de 2 sabores.

### Reglas de Specs

- Los `specs` son compartidos entre todos los sabores de un modelo.
- Se toman del primer sabor del grupo, asi que deben ser identicos en todas las entradas del mismo modelo.
- Si se quiere que un modelo no muestre specs, dejar `"specs": []` en todas sus entradas.
- Cada spec es un string corto y descriptivo: `"600 Puffs"`, `"20mg Nicotina"`, `"USB-C"`.

### Prioridad de Badges (en la card del catalogo)

1. **Agotado** — todos los sabores sin stock
2. **Oferta** — todos los sabores disponibles tienen `oferta: true`
3. **Popular** — al menos un sabor tiene `hot: true`
4. Sin badge

Si solo algunos sabores tienen oferta, la card muestra "X en oferta" en el texto de sabores.

### Categorias

| Valor en JSON          | Tab en la pagina |
|------------------------|------------------|
| `vapes-desechables`    | Desechables      |
| `vapes-rellenables`    | Rellenables      |
| `liquidos`             | Liquidos         |
| `accesorios`           | Accesorios       |
| `otros`                | Otros            |

**Auto-ocultacion:** Si todos los productos de una categoria estan desactivados (`activo: false`),
el tab de esa categoria desaparece automaticamente. No hace falta tocar codigo.

Para agregar una categoria nueva, se necesita agregar una entrada en `CATEGORY_ORDER` en `app.js`.

---

## Operaciones Comunes

### Agregar un producto nuevo con sabores

1. Buscar el mayor `id` existente y sumar 1.
2. Crear una entrada por cada sabor, misma `marca` y `nombre`, mismos `specs`.
3. Crear la carpeta de imagenes: `assets/products/MarcaModelo/`

```json
{
  "id": 31,
  "categoria": "vapes-desechables",
  "marca": "Swft",
  "nombre": "Mod 5000",
  "sabor": "Watermelon Ice",
  "specs": ["5000 Puffs", "50mg Nicotina", "12ml E-Liquid", "600mAh"],
  "precio": 1000,
  "stock": 10,
  "imagenModelo": "assets/products/SwftMod5000/modelo.jpg",
  "imagen": "assets/products/SwftMod5000/WatermelonIce.jpg",
  "hot": false,
  "oferta": false,
  "precioAntes": 0,
  "activo": true
}
```

### Agregar un sabor a un modelo existente

Nueva entrada con el mismo `marca` + `nombre`, nuevo `id`, nuevo `sabor`.
Agregar la imagen del sabor a la carpeta existente del modelo.

### Desactivar un sabor / Desactivar un modelo completo

- Un sabor: `"activo": false` en esa entrada.
- Un modelo: `"activo": false` en TODAS las entradas de ese modelo.

### Desactivar una categoria completa

Poner `"activo": false` en todos los productos de esa categoria. El tab desaparece automaticamente.

### Poner en oferta

```json
"oferta": true,
"precioAntes": 1200,
"precio": 900
```

### Quitar oferta

```json
"oferta": false,
"precioAntes": 0
```

### Marcar como agotado

`"stock": 0` — NO usar `"activo": false` para esto.

---

## Flujo de Compra

1. Usuario navega el catalogo (filtros por categoria, busqueda, ordenar por precio).
2. Click en card → modal con specs y selector de sabores (ofertas aparecen primero).
3. Selecciona sabor → "Agregar al Carrito".
4. Carrito → ajusta cantidades → "Enviar Pedido por WhatsApp".
5. Se genera mensaje con numero de orden unico → se abre WhatsApp.
6. Vendedor recibe, verifica precios, coordina pago y entrega.

### Numero de Orden

Formato: `VX-YYYYMMDD-HHMM-XXX` (ej: `VX-20260404-1523-847`)

Generado client-side al enviar. No se almacena.

---

## Carrito

- Se guarda en `localStorage` con key `vapexotic_cart`, expira a las 24 horas.
- `reconcileCart()` limpia items cuyo `id` ya no exista en el catalogo tras cargar productos.

---

## Arquitectura del JS (`app.js`)

IIFE que expone el namespace `Vapexotic` con 5 funciones publicas:

- `Vapexotic.openCart()`
- `Vapexotic.closeCart()`
- `Vapexotic.closeModal()`
- `Vapexotic.addSelectedToCart()`
- `Vapexotic.sendToWhatsApp()`

### Configuracion

```js
const CONFIG = {
  whatsapp: '18297980193',     // Numero de WhatsApp (con codigo de pais)
  catalogUrl: 'products.json', // URL del catalogo
};
```

Para cambiar el numero de WhatsApp, tambien hay que actualizarlo en los 3 links de `index.html`
(nav, hero CTA, footer). Lo mismo aplica para los 2 links de Instagram.

### Seguridad

- `esc()` sanitiza todos los datos del JSON antes de insertarlos en el DOM.
- Event delegation con `data-*` attributes.
- `rel="noopener"` en todos los links externos.
- Cart validation + reconciliation al cargar.

---

## Hosting (GitHub Pages)

- Activar 2FA en GitHub.
- Actualizar `og:image` y `og:url` en `index.html` con URLs absolutas al dominio final.
- Repo puede ser publico o privado (Pages funciona con ambos).

---

## Rendimiento

El proyecto pesa aproximadamente:

- `index.html` ~7 KB
- `styles.css` ~17 KB
- `app.js` ~18 KB
- `products.json` ~variable (30 productos ≈ 7 KB)

Total sin imagenes: **~49 KB**. Con gzip (que GitHub Pages aplica automaticamente): **~15 KB**.
Las Google Fonts agregan ~50-80 KB adicionales (cacheadas tras primera visita).

No hay frameworks, no hay dependencias externas (excepto Google Fonts), no hay build step.
El codigo se sirve tal cual. Tiempo de carga tipico en 4G: <1 segundo.

---

## Notas para IA

Si estas modificando este proyecto como IA:

1. **Para cambios en el JSON** (agregar productos, precios, stock, ofertas, desactivar), solo necesitas este README y el JSON actual. No necesitas ver el codigo.
2. **IDs son unicos y nunca se reutilizan.** Buscar el mayor existente y sumar 1.
3. **La agrupacion es automatica** por `marca` + `nombre`. No hay campo de "grupo".
4. **`specs` se duplica** en cada sabor del mismo modelo. No hay herencia.
5. **`activo: false`** oculta. **`stock: 0`** muestra como agotado. Cosas distintas.
6. **`specs` vacio o ausente** = no se muestra nada, sin error.
7. **Categorias vacias se ocultan** automaticamente.
8. **Imagenes:** carpeta = `MarcaModelo` (PascalCase), archivo del sabor = `NombreSabor.jpg` (PascalCase), archivo del modelo = `modelo.jpg`.
9. **El JSON debe ser valido.** Verificar antes de commit.
10. **Para cambios en JS/CSS/HTML**, solicitar los archivos necesarios.
