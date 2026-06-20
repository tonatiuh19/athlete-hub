# Diagrama del Flujo de Pago y Facturación

## Flujo General

```text
┌─────────────────────┐
│     Participante    │
└──────────┬──────────┘
           │
           │ Compra inscripción
           ▼
┌─────────────────────┐
│     Plataforma      │
│  Checkout Evento    │
└──────────┬──────────┘
           │
           │ Procesa pago
           ▼
┌─────────────────────┐
│   Stripe Connect    │
└──────────┬──────────┘
           │
           │ Distribución automática
           ▼
 ┌────────────────┐    ┌────────────────┐
 │ Organizador    │    │   Plataforma   │
 │ Ingreso Evento │    │ Cargo Servicio │
 └────────────────┘    └────────────────┘

           │
           ▼

┌─────────────────────┐
│ Confirmación Compra │
│ QR / Folio / Ticket │
└──────────┬──────────┘
           │
           │ ¿Solicita factura?
           ▼

      ┌──────────┐
      │   NO     │
      └────┬─────┘
           │
           ▼

 Facturación Global
 según normativa SAT

           │

           ▼

      ┌──────────┐
      │   SÍ     │
      └────┬─────┘
           │
           ▼

┌─────────────────────┐
│ Captura Datos CFDI  │
│ RFC                 │
│ Razón Social        │
│ Régimen Fiscal      │
│ Uso CFDI            │
└──────────┬──────────┘
           │
           ▼

┌─────────────────────┐
│      Facturama      │
└──────────┬──────────┘
           │
           │ Generación CFDI
           ▼

 ┌────────────────┐    ┌────────────────┐
 │ CFDI Evento    │    │ CFDI Servicio  │
 │ Organizador    │    │ Plataforma     │
 └────────────────┘    └────────────────┘

           │
           ▼

┌─────────────────────┐
│ Envío PDF + XML     │
│ al Participante     │
└─────────────────────┘
```

---

# Ejemplo de Compra

## Lo que visualiza el participante

```text
Inscripción Carrera (IVA incluido)      $1,000.00
Cargo por servicio (IVA incluido)         $110.00

----------------------------------------------
Total a pagar                           $1,110.00 MXN
```

Todos los precios mostrados dentro de la plataforma incluyen IVA.

---

## Modo pass-through (predeterminado)

- `price_cents` en categoría = inscripción del organizador.
- El atleta paga inscripción + comisión (ej. 11%).
- Stripe transfiere la inscripción al organizador; la comisión va a la plataforma.

## Modo absorb_all (opcional por organizador / evento)

- `price_cents` en categoría = **precio público final** (IVA incluido).
- El atleta paga solo el sticker (ej. $1,000).
- Comisión plataforma = sticker × 11% ($110).
- IVA informativo en desglose = sticker × 16% ($160).
- Neto organizador (calculadora) = sticker − comisión − IVA informativo ($730).
- Stripe transfiere sticker − comisión ($890) al organizador Connect.
- El desglose IVA es informativo para factura; los CFDI usan back-calculation SAT.

Configuración: `/staff/payouts` (organizador) o edición de evento (heredar / override).

---

# Flujo Financiero Simplificado

```text
Participante
      │
      ▼
Paga $1,110 MXN
      │
      ▼
Stripe Connect
      │
      ├──► Organizador
      │      Ingreso por inscripción
      │
      └──► Plataforma
             Cargo por servicio
```

---

# Flujo de Facturación

```text
Participante solicita factura
               │
               ▼
          Facturama
               │
      ┌────────┴────────┐
      ▼                 ▼

CFDI Organizador   CFDI Plataforma

Inscripción        Cargo por servicio
IVA incluido       IVA incluido
```

---

# Beneficio del Modelo

Este esquema permite:

- Separación clara de ingresos.
- Cumplimiento fiscal para todas las partes.
- Distribución automática de fondos.
- Facturación bajo demanda.
- Escalabilidad para múltiples organizadores.
- Automatización completa del proceso.
- Transparencia para participantes y organizadores.
- Experiencia similar a plataformas líderes de ticketing y registro de eventos en México.

````

### Resumen Ejecutivo

```text
Participante
    ↓
Checkout
    ↓
Stripe Connect
    ↓
Distribución automática
    ↓
Confirmación y QR
    ↓
¿Factura?
    ├─ No → Factura Global
    └─ Sí → Facturama → CFDIs automáticos
````
