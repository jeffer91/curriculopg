# Currículo ITSQMET

Aplicaciones de gestión curricular publicadas en GitHub Pages y conectadas a Firebase `curriculo-ddfcd`.

- Administrador: https://jeffer91.github.io/curriculopg/administrador/
- Coordinador: https://jeffer91.github.io/curriculopg/coordinador/

## Instalación / publicación
El repositorio es una aplicación estática. El flujo `.github/workflows/pages.yml` publica automáticamente la rama `main` mediante GitHub Actions. No requiere npm.

## Seguridad y configuración Firebase
Se requiere habilitar **Authentication > Email/Password**, registrar las cuentas y crear en Firestore documentos `usuarios/{uid}`:
- Administrador: `{"rol":"administrador","activo":true}`.
- Coordinador: `{"rol":"coordinador","carreraId":"carrera_administracion","activo":true}`.
El ID de carrera debe ser exactamente el de la colección `carreras`.

**IMPORTANTE**: antes de compartir accesos, revisar, combinar y publicar las reglas de seguridad de `firestore.rules` con las reglas existentes del proyecto. GitHub Pages por sí solo NO controla el acceso a los datos y los enlaces con ?carrera= NO dan permisos. No se configura ninguna cuenta privilegiada en código.

## Flujo
Coordinador consulta únicamente carrera autorizada > propone cambios PEA > solicitud pendiente > administrador revisa/aprueba/devuelve/rechaza > historial y versión oficial > Excel / anexo PDF.

La colección de solicitudes nueva es `solicitudes_curriculares`; NO se vuelve a importar la base ni se cambian los documentos existentes en el primer acceso.

Bibliotecas CDN: Firebase JS 11.10.0, ExcelJS 4.4.0, JSZip 3.10.1 y jsPDF 2.5.2. Se necesita conexión a internet.
