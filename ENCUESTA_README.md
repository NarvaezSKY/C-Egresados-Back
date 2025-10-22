# Archivo de ejemplo para EncuestaEgresados.xlsx

Este archivo debe contener los datos de los egresados que han contestado la encuesta.

## Estructura requerida:

El archivo Excel debe tener al menos una columna con el nombre exacto:
- "Escriba sin puntos ni comas el número de su documento de identidad"

## Ejemplo de estructura:

| Escriba sin puntos ni comas el número de su documento de identidad | Otros campos de la encuesta... |
|-------------------------------------------------------------------|------------------------------|
| 1144138558                                                        | ...                          |
| 1061691048                                                        | ...                          |
| 1061699075                                                        | ...                          |

## Notas importantes:

1. El nombre de la columna debe ser exacto: "Escriba sin puntos ni comas el número de su documento de identidad"
2. Los números de cédula deben estar sin puntos ni comas
3. El archivo debe estar en la raíz del proyecto con el nombre: EncuestaEgresados.xlsx
4. El nombre de la hoja de cálculo por defecto es "Hoja1" (configurable en .env)

## Configuración en .env:

```
SURVEY_FILE_PATH=./EncuestaEgresados.xlsx
SURVEY_SHEET_NAME=Hoja1
```