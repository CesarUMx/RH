# API de Integración - Búsqueda de Empleados

Esta API permite a desarrolladores externos buscar información de empleados del sistema RH.

## Seguridad

La API está protegida con múltiples capas de seguridad:

1. **Autenticación por API Key**: Requiere el header `X-API-Key` con la clave válida
2. **Rate Limiting**: Máximo 100 peticiones por minuto por IP
3. **CORS**: Solo orígenes permitidos configurados en `CORS_ALLOWED_ORIGINS`

## Configuración

### Variables de Entorno

Agrega al archivo `.env`:

```bash
INTEGRATION_API_KEY=tu_clave_secreta_aqui
```

**Importante**: Usa una clave fuerte y única. No compartas esta clave públicamente.

## Endpoint

### Buscar Empleado

Busca empleados por nombre, correo o número de colaborador.

**URL**: `GET /api/v1/integracion/buscar-empleado`

**Headers**:
```
X-API-Key: tu_clave_secreta_aqui
```

**Parámetros Query**:
- `q` (requerido): Término de búsqueda (máximo 100 caracteres)

**Ejemplo de Petición**:

```bash
curl -X GET "http://localhost:3000/api/v1/integracion/buscar-empleado?q=juan" \
  -H "X-API-Key: tu_clave_secreta_aqui"
```

**Respuesta Exitosa (200)**:

```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": 123,
      "nombre": "Juan García López",
      "correo": "juan.garcia@mondragonmexico.edu.mx",
      "numColaborador": "001234",
      "puesto": "Contador",
      "tipo": "ADMINISTRATIVO"
    },
    {
      "id": 456,
      "nombre": "Juan Carlos Pérez",
      "correo": "juan.perez@mondragonmexico.edu.mx",
      "numColaborador": "001235",
      "puesto": "Analista",
      "tipo": "ADMINISTRATIVO"
    }
  ]
}
```

**Respuestas de Error**:

- **400 Bad Request**: Parámetros inválidos
  ```json
  {
    "error": "Parámetros inválidos",
    "detalles": { ... }
  }
  ```

- **401 Unauthorized**: API Key no proporcionada
  ```json
  {
    "error": "API Key requerida",
    "message": "El header X-API-Key es obligatorio"
  }
  ```

- **403 Forbidden**: API Key inválida
  ```json
  {
    "error": "API Key inválida",
    "message": "La API Key proporcionada no es válida"
  }
  ```

- **429 Too Many Requests**: Límite de peticiones excedido
  ```json
  {
    "error": "Too Many Requests",
    "message": "Límite de peticiones excedido. Intenta nuevamente en X segundos.",
    "retryAfter": 30
  }
  ```

- **500 Internal Server Error**: Error interno del servidor
  ```json
  {
    "error": "Error interno del servidor",
    "success": false
  }
  ```

## Comportamiento de Búsqueda

- **Case-insensitive**: La búsqueda no distingue mayúsculas/minúsculas
- **Búsqueda parcial**: Busca coincidencias parciales en todos los campos
- **Campos buscados**:
  - `nombre` (nombre completo del empleado)
  - `correo` (correo institucional)
  - `numColaborador` (número de colaborador)
- **Límite de resultados**: Máximo 20 resultados por petición
- **Solo empleados activos**: No incluye empleados dados de baja

## Ejemplos de Uso

### Buscar por nombre

```bash
curl -X GET "http://localhost:3000/api/v1/integracion/buscar-empleado?q=garcia" \
  -H "X-API-Key: tu_clave_secreta_aqui"
```

### Buscar por correo

```bash
curl -X GET "http://localhost:3000/api/v1/integracion/buscar-empleado?q=cortiz@mondragonmexico.edu.mx" \
  -H "X-API-Key: tu_clave_secreta_aqui"
```

### Buscar por número de colaborador

```bash
curl -X GET "http://localhost:3000/api/v1/integracion/buscar-empleado?q=001234" \
  -H "X-API-Key: tu_clave_secreta_aqui"
```

## Soporte

Para problemas o preguntas sobre la API de integración, contacta al equipo de desarrollo de RH.
